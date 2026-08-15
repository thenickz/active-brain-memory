<div align="center">

# active-brain-memory

**Persistent, self-maintaining project memory for AI agents**

A `memory.md` that works like a brain: every agent session reads it at the start and updates it continuously — decisions, learnings, verified commands, session history. No context is ever lost, nothing is ever re-explained.

Works with **Claude Code · opencode · Codex** (Agent Skills format). *Tested on [opencode](https://opencode.ai).*

[Quickstart](#quickstart) · [How it works](#how-it-works) · [Troubleshooting](#troubleshooting) · [Companion skills](#companion-skills)

</div>

---

## What it is

Every session your AI agent starts with zero memory of your project. `active-brain-memory` gives the agent a brain in one versioned file:

- **At the start** of a session the agent reads `memory.md` and wakes up knowing the project state.
- **During work** it records what matters — decisions (with the *why*), learnings, verified commands, session bullets — **without the user asking**.
- **Over time** it condenses old session logs into durable knowledge and forgets what is irrelevant.

Result: the user never re-explains, short sessions carry full context, and the project's knowledge grows in git history.

## Features

- **Zero config** — one file (`memory.md`) with a fixed structure; no daemons, no databases.
- **Autonomous** — the agent updates memory continuously; saving is not a user chore.
- **Cross-tool** — ships as an [Agent Skills](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview) `SKILL.md`, the open standard read by Claude Code, opencode, and Codex.
- **Deliberate forgetting** — condensation keeps memory small; only decisions and learnings persist.
- **Optional enforcement plugin (opencode)** — turns updates from voluntary into automatic: if a turn ends without touching `memory.md`, the plugin injects a prompt to update it.
- **Non-destructive install** — symlinks only; never overwrites existing config.

## Quickstart

```bash
git clone https://github.com/thenickz/active-brain-memory.git ~/.active-brain-memory
~/.active-brain-memory/install.sh
```

Then **restart opencode** (plugins load at startup). The skill is now available to every agent. Next time you start a session on a project that has (or needs) a `memory.md`, tell your agent: *"set up the project brain"*.

To give a new project its brain files, copy `templates/memory.md` into the project root (or use the [scaffold-agents-md](https://github.com/thenickz/agent-dotfiles) companion skill, which generates `AGENTS.md` + `memory.md` + `architecture.md` together).

## How it works

```
   ┌──────────────────────────── agent session ────────────────────────────┐
   │                                                                        │
   │  START → read memory.md (restore project state)                        │
   │  WORK  → record decisions / learnings / commands / session bullets     │
   │  ⟳     → condense old logs, prune what is irrelevant                   │
   │                                                                        │
   └──────────────────────────────────┬─────────────────────────────────────┘
                                      ▼
                       memory.md (versioned, git history)
                                      ▲
   ┌──────────────────────────────────┴───────────────────────────────────┐
   │  opencode enforcement plugin (optional)                               │
   │  on session.idle: memory.md untouched this turn?                      │
   │    → inject "run active-brain-memory and update memory.md"            │
   └───────────────────────────────────────────────────────────────────────┘
```

The brain loop: **AGENTS.md → memory.md ⇄ architecture.md**. `AGENTS.md` (always loaded) points the agent to the brain files; `memory.md` stores state; `architecture.md`/`architecture/` store the map and flows. When the structure changes, the **architecture** skill updates the map and mirrors its flows back into memory.

### The enforcement plugin (`plugins/opencode-memory.js`)

The skill makes memory updates voluntary (the agent follows it). The plugin makes them automatic **on opencode**:

- At the end of every agent turn (`session.idle`) it checks whether `memory.md` was touched in this project.
- If not, it injects a prompt asking the agent to run the skill and update `memory.md`.
- **Natural termination**: once the model saves, `git status` shows `memory.md` modified, so the next `session.idle` is a no-op.
- **Cooldown**: at most one reminder per session every 10 minutes, so a clean `memory.md` does not nag on every turn.
- **Loop guard**: if the model answers "done" without saving, the plugin will not re-inject until a new user message arrives — no infinite prompts.
- **Root sessions only**: subagent turns (sessions with a parent) never trigger enforcement.
- It does **nothing** in projects without `memory.md`, in projects that are not git repos, or in projects where `memory.md` is **gitignored** (a per-project opt-out: `git status` can never see an ignored file as modified, so the "saved?" check would never terminate).

Disable it: `~/.active-brain-memory/install.sh --unlink` (removes all symlinks) or delete `~/.config/opencode/plugins/opencode-memory.js`.

## Installation details

`install.sh` creates symlinks (single source of truth):

| Target | Purpose |
|---|---|
| `~/.config/opencode/plugins/opencode-memory.js` | enforcement plugin (opencode) |
| `~/.claude/skills/active-brain-memory` | skill — Claude Code + opencode |
| `~/.agents/skills/active-brain-memory` | skill — Codex + opencode |
| `~/.config/opencode/skills/active-brain-memory` | skill — opencode native path |

```bash
./install.sh            # install
./install.sh --dry-run  # preview without changing anything
./install.sh --unlink   # remove the symlinks
```

No environment variables — the plugin is zero-config.

## Troubleshooting

If something isn't working, ask your agent — *"the project memory isn't being updated"* — or diagnose yourself with this guide. It covers everything needed to fix the skill and the plugin.

### The agent isn't updating memory.md

1. **Is the skill installed?**
   `ls -l ~/.claude/skills/active-brain-memory ~/.agents/skills/active-brain-memory ~/.config/opencode/skills/active-brain-memory 2>&1`
   Missing → re-run `~/.active-brain-memory/install.sh` and restart opencode.
2. **Does the project have a `memory.md`?**
   If not, copy `templates/memory.md` into the project root (the skill creates it too when missing).
3. **Is the agent in the project that owns the file?**
   The skill only manages the `memory.md` in the current working directory.
4. **Trust level / permissions:** on opencode, the agent needs permission to write files. If writes are blocked, no memory gets saved.
5. **Was it a long single turn?** The skill updates continuously, but a session that dies mid-turn loses only the last exchange — `Session Log` is written progressively by design.

### The enforcement plugin isn't injecting prompts

The plugin only acts when **all** of these are true:

- `memory.md` exists in the project root (`ls memory.md`).
- The project is a git repo (`git rev-parse --is-inside-work-tree` succeeds).
- `memory.md` is **not** gitignored (`git check-ignore --quiet -- memory.md` fails). Gitignored projects intentionally skip enforcement — an ignored file can never show as modified, so the "saved?" check would loop forever.
- `memory.md` is clean — `git status --porcelain -- memory.md` returns empty. If the model already saved this turn, the plugin is intentionally silent (that's the natural termination).
- The turn was on a **root session** (not a subagent) and at least 10 minutes passed since the last reminder (cooldown).
- The plugin is loaded: `ls -l ~/.config/opencode/plugins/opencode-memory.js`, and opencode was **restarted** after install (plugins load at startup).

### Memory updates stop after a "done"

By design: if the plugin injected a prompt and the agent replied "done" without saving, it won't re-inject for that same user message (loop guard). Send a new message to re-arm it.

### Plugin does nothing on a fresh scaffold

Right after `memory.md` is created but **before the first commit**, `git status --porcelain` reports it as untracked (non-empty), so the plugin treats memory as "already touched" and stays quiet. Commit the new files once and enforcement resumes normally.

### Everything else

1. Run opencode with the opencode log visible (`opencode` debug logs) — the plugin logs under the service name `opencode-memory` (`warn`/`error` levels).
2. Check the session message history: after a turn, is a `[memory-enforcer]` prompt present? If yes and memory is still empty, the model failed to save (inspect its final message).
3. Still stuck? Open an [issue](https://github.com/thenickz/active-brain-memory/issues) with: opencode version, output of `git status --porcelain -- memory.md`, and whether the `[memory-enforcer]` prompt appeared.

## Companion skills

Part of a larger AI-agent knowledge system, kept in [agent-dotfiles](https://github.com/thenickz/agent-dotfiles):

- **architecture** — maintains `architecture.md`/`architecture/` with `NODE(X)` notation and data flows, and mirrors flows into memory.
- **scaffold-agents-md** — bootstraps a new project with `AGENTS.md` + `memory.md` + `architecture.md`.

## Requirements

- An agent that reads Agent Skills — Claude Code, opencode, or Codex.
- The enforcement plugin: [opencode](https://opencode.ai) (tested there; plugin uses only the opencode SDK + git).

## License

MIT — see [LICENSE](LICENSE).
