// opencode-memory.js — memory enforcement plugin for opencode.
//
// Turns memory.md updates from "voluntary" (the agent following the
// active-brain-memory skill) into an enforced mechanism: at the end of every
// agent turn (session.idle) the plugin checks whether memory.md was touched.
// If not, it injects a prompt asking the agent to run active-brain-memory and
// update memory.md.
//
// Natural termination: when the model saves, `git status` shows memory.md as
// modified, so the next session.idle becomes a no-op. A cooldown keeps the
// reminder from firing on every turn, and the loop guard (last real user
// message id) stops re-injection when the model answers "done" without saving.
//
// Per-project opt-out: when memory.md is gitignored, `git status` can never
// see it as modified (ignored files are excluded), so the "was it saved?"
// check is meaningless and enforcement is skipped entirely for that project.
//
// Root sessions only: subagents (sessions with a parentID) fire their own
// session.idle events; the enforcer ignores them so it does not spawn prompts
// inside subagent turns.
//
// No external dependencies: uses only Bun.file, Bun's $ shell, and the SDK
// client provided in the plugin context.

export const OpenCodeMemory = async ({ client, $, directory }) => {
  const memoryPath = `${directory}/memory.md`
  const git = $.nothrow().cwd(directory)
  // Last real user message id we already prompted for, per root session. The
  // injected reminder is itself a synthetic user message; it is skipped when
  // scanning, so this guard can terminate the "done without saving" cycle.
  const promptedFor = new Map()
  // Last time a reminder was injected, per root session, for the cooldown.
  const lastPromptedAt = new Map()
  // Subagent session ids (sessions created with a parentID).
  const subagents = new Set()
  const COOLDOWN_MS = 10 * 60 * 1000

  const log = (level, message) => {
    client.app
      .log({
        body: { service: "opencode-memory", level, message },
      })
      .catch(() => {})
  }

  const lastRealUserMessageID = async (sessionID) => {
    try {
      const { data } = await client.session.messages({ path: { id: sessionID } })
      for (let i = data.length - 1; i >= 0; i--) {
        const msg = data[i]
        if (msg.info?.role !== "user") continue
        // Skip synthetic user messages (e.g. our own injected reminder).
        if (msg.parts?.some((part) => part.synthetic)) continue
        return msg.info.id
      }
    } catch (err) {
      log("warn", `failed to list messages: ${String(err)}`)
    }
    return null
  }

  return {
    event: async ({ event }) => {
      // Track subagent sessions so session.idle can ignore them.
      if (event.type === "session.created") {
        if (event.properties?.info?.parentID) {
          subagents.add(event.properties.info.id)
        }
        return
      }

      if (event.type !== "session.idle") return
      const { sessionID } = event.properties

      // Subagent turns are not user turns — do not enforce on them.
      if (subagents.has(sessionID)) {
        subagents.delete(sessionID)
        return
      }

      try {
        // No memory.md in this project -> nothing to enforce.
        if (!(await Bun.file(memoryPath).exists())) return

        // Not a git repo -> the git-based "was it saved" check is undefined.
        // stdout is redirected to /dev/null: only the exit code is used, and
        // Bun's $ streams command output to the terminal as well as capturing
        // it (rev-parse would otherwise print "true" into the TUI).
        const inside = await git`git rev-parse --is-inside-work-tree >/dev/null`
        if (inside.exitCode !== 0) return

        // memory.md intentionally gitignored -> git-status detection is
        // meaningless (ignored files never show as modified); skip enforcement
        // for this project (per-project opt-out).
        const ignored = await git`git check-ignore --quiet -- memory.md`
        if (ignored.exitCode === 0) return

        // Already saved this turn? `git status --porcelain` covers modified,
        // staged, and untracked memory.md (untracked happens right after a
        // scaffold, before the first commit). Consumed via .text() so the
        // porcelain output is captured without leaking into the terminal.
        const status = await git`git status --porcelain -- memory.md`.text()
        if (status.trim() !== "") return

        // Cooldown: at most one reminder per session per window, so a clean
        // memory.md does not nag on every single turn.
        const now = Date.now()
        const lastAt = lastPromptedAt.get(sessionID)
        if (lastAt !== undefined && now - lastAt < COOLDOWN_MS) return

        // Loop guard: if the last real user message is the one we already
        // prompted for, the model answered "done" without saving — don't
        // re-inject until the user actually sends a new message.
        const lastUser = await lastRealUserMessageID(sessionID)
        if (lastUser === null || lastUser === promptedFor.get(sessionID)) return
        promptedFor.set(sessionID, lastUser)
        lastPromptedAt.set(sessionID, now)

        const prompt = [
          "[memory-enforcer] This turn ended without touching memory.md.",
          "Run the active-brain-memory skill: review the recent turn and update memory.md",
          "(Current State / Decisions / Learnings / Workflows & Commands / Session Log) as appropriate.",
          "Touch ONLY memory.md, then reply exactly \"done\".",
        ].join(" ")

        await client.session.prompt({
          path: { id: sessionID },
          body: {
            parts: [{ type: "text", text: prompt, synthetic: true }],
          },
        })
      } catch (err) {
        log("error", `memory enforcement failed: ${String(err)}`)
      }
    },
  }
}
