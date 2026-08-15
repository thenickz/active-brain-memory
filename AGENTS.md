# active-brain-memory

Persistent, self-maintaining project memory for AI agents: a `memory.md` "brain"
that agent sessions read at start and update continuously. Ships an Agent Skills
skill plus an optional opencode enforcement plugin. Tested on opencode.

## Stack
- Skill: Agent Skills format (`skills/active-brain-memory/SKILL.md`, `name` + `description` frontmatter).
- Plugin: JavaScript (ESM, zero deps — Bun.file, Bun `$` shell, SDK client only).
- Template: plain Markdown (`templates/memory.md`).

## Commands
> EXACT and verified commands.
- Install (symlinks skill + plugin): `./install.sh`
- Preview: `./install.sh --dry-run`
- Remove symlinks: `./install.sh --unlink`
- Validate plugin syntax, skill frontmatter, template, installer: `./scripts/validate.sh`

## Conventions
- Keep `README.md`, `skills/active-brain-memory/SKILL.md`, and this file in sync when behavior changes.
- The plugin enforces `memory.md` updates on opencode: `session.idle` → if
  `memory.md` exists, the project is a git repo, `memory.md` is not gitignored,
  and `git status --porcelain -- memory.md` is empty → inject a prompt to run the
  skill. Root sessions only (subagent idles are skipped), at most once per
  10 minutes per session. Loop guard: only once per user message.
- No env vars — the plugin is zero-config.
- Never store secrets in `memory.md`, docs, or logs.

## Structure
```
skills/active-brain-memory/SKILL.md   portable skill (brain behavior only)
plugins/opencode-memory.js            opencode enforcement plugin
templates/memory.md                   memory.md skeleton projects copy
install.sh                            symlink installer (non-destructive, --dry-run/--unlink)
scripts/validate.sh                   syntax + structure checks
```

## Boundaries
- `install.sh` never overwrites existing config (skips with a warning).
- The plugin does nothing in projects without `memory.md`, outside git, or where `memory.md` is gitignored.
- Troubleshooting lives in the README, not the skill (skill stays focused on brain behavior).
