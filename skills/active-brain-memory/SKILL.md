---
name: active-brain-memory
description: Manages the project's persistent memory (memory.md) like a brain. Use in ANY session on projects that contain memory.md or an AGENTS.md brain block: at START read memory.md to restore project state, decisions, and past-session context; DURING work record decisions, learnings, verified commands, workflow changes, and session bullets continuously and autonomously; periodically condense old session logs into long-term knowledge and prune what is irrelevant. Also use when the user asks to "remember this", "save this", or "forget X".
---

# Active Brain Memory

The project keeps a `memory.md` file at its root: the project's persistent memory. Your job is to read and maintain that file like a brain — **without the user asking**.

Repo: <https://github.com/thenickz/active-brain-memory>

## Goal

No relevant information stays trapped in the session context. Everything that matters becomes a versioned file, so the user never re-explains things and new sessions wake up knowing the project state.

## When to act

- **At the START of a session** (or when entering the project): READ `memory.md`. If it does not exist, create it from the template (structure below).
- **DURING work**: after each interaction, evaluate whether something relevant emerged and **UPDATE IMMEDIATELY**:
  - a decision was made (with the why and context) → `Decisions`
  - a learning or gotcha was discovered → `Learnings`
  - a command/procedure worked → `Workflows & Commands`
  - the project state changed → `Current State`
  - meaningful activity happened → `Session Log` (1 bullet per relevant exchange, not per message)
- **Do not wait for the end of the session. Do not wait for an explicit request.** When in doubt, record it.

## memory.md structure

```markdown
# Memory

## Current State        ← what is in progress, next steps
## Decisions            ← date | decision — why (context)
## Learnings            ← verifiable long-term knowledge
## Workflows & Commands ← verified commands/procedures
## Primordial Flows     ← mirror of architecture/ (flows always in mind)
## Session Log          ← date | bullets from recent sessions (short-term)
```

## Rules

1. Short bullets, one line each. No generic "clean code".
2. **Dedup**: before recording, check the item does not already exist. Do not repeat.
3. Do not duplicate AGENTS.md or architecture/: **reference, don't copy**.
4. Never store secrets, passwords, or tokens.
5. Always record: decision + **why**; verifiable learning; exact command.
6. Keep `Current State` always up to date (in-progress / next).
7. Update `Session Log` continuously — so even if the session dies, almost everything is already saved.

## Condensation (deliberate forgetting)

- When `Session Log` grows past ~10 entries, or there are entries older than ~2 weeks:
  - fold distinct items into `Decisions` / `Learnings` / `Workflows & Commands`;
  - remove the rest. **Only decisions and learnings persist.**
- If an item is old and irrelevant: FORGET it (prune). Good memory is small memory.

## Architecture updates

- If the project's structure or flows change, trigger the **architecture** skill to update `architecture.md`/`architecture/` and re-sync the `Primordial Flows` (the mirror here in memory.md).

## Explicit user commands

- "remember this" / "save this" → record it immediately.
- "forget X" → remove X from memory.md.
- "show the memory" → read and summarize the current contents.

## Installation

- Install: `git clone https://github.com/thenickz/active-brain-memory.git ~/.active-brain-memory && ~/.active-brain-memory/install.sh`, then restart opencode (plugins load at startup).
- Optional opencode enforcement plugin: makes memory.md updates automatic — at the end of every turn, if `memory.md` was not touched, it injects a prompt to run this skill. Root sessions only, at most once per 10 minutes, and skipped in projects where `memory.md` is gitignored. Details in the repo README.
