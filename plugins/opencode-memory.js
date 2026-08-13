// opencode-memory.js — memory enforcement plugin for opencode.
//
// Turns memory.md updates from "voluntary" (the agent following the
// active-brain-memory skill) into an enforced mechanism: at the end of every
// agent turn (session.idle) the plugin checks whether memory.md was touched.
// If not, it injects a prompt asking the agent to run active-brain-memory and
// update memory.md.
//
// Natural termination: when the model saves, `git status` shows memory.md as
// modified, so the next session.idle becomes a no-op. No cooldown, no lock
// files — if the model cannot save, the loop guard (last user message id)
// prevents infinite re-injection.
//
// No external dependencies: uses only Bun.file, Bun's $ shell, and the SDK
// client provided in the plugin context.

export const OpenCodeMemory = async ({ client, $, directory }) => {
  const memoryPath = `${directory}/memory.md`
  const git = $.nothrow().cwd(directory)
  // Id of the last user message for which we already injected a prompt.
  let lastPromptedUserMessage = null

  const log = (level, message) => {
    client.app
      .log({
        body: { service: "opencode-memory", level, message },
      })
      .catch(() => {})
  }

  const lastUserMessageID = async (sessionID) => {
    try {
      const { data } = await client.session.messages({ path: { id: sessionID } })
      for (let i = data.length - 1; i >= 0; i--) {
        const msg = data[i]
        if (msg.info?.role === "user") return msg.info.id
      }
    } catch (err) {
      log("warn", `failed to list messages: ${String(err)}`)
    }
    return null
  }

  return {
    event: async ({ event }) => {
      if (event.type !== "session.idle") return
      const { sessionID } = event.properties

      try {
        // No memory.md in this project -> nothing to enforce.
        if (!(await Bun.file(memoryPath).exists())) return

        // Not a git repo -> the git-based "was it saved" check is undefined.
        const inside = await git`git rev-parse --is-inside-work-tree`
        if (inside.exitCode !== 0) return

        // Already saved this turn? `git status --porcelain` covers modified,
        // staged, and untracked memory.md (untracked happens right after a
        // scaffold, before the first commit).
        const status = await git`git status --porcelain -- memory.md`
        if (status.stdout.toString().trim() !== "") return

        // Loop guard: if the last user message is the one we already prompted
        // for, the model answered "done" without saving — don't re-inject.
        const lastUser = await lastUserMessageID(sessionID)
        if (lastUser === null || lastUser === lastPromptedUserMessage) return
        lastPromptedUserMessage = lastUser

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
