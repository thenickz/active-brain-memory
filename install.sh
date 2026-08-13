#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_SRC="$REPO_DIR/plugins/opencode-memory.js"
SKILL_SRC="$REPO_DIR/skills/active-brain-memory"

OPENCODE_PLUGIN_DIR="$HOME/.config/opencode/plugins"
SKILL_DEST_DIRS=(
  "$HOME/.claude/skills"
  "$HOME/.agents/skills"
  "$HOME/.config/opencode/skills"
)

DRY=false
UNLINK=false

usage() {
  cat <<'EOF'
Installs the active-brain-memory skill and the opencode memory enforcement
plugin as symlinks in the tools' global paths.

Usage: ./install.sh [--dry-run] [--unlink]

Paths (created if missing):
  ~/.config/opencode/plugins/opencode-memory.js   the opencode enforcement plugin
  ~/.claude/skills/active-brain-memory            skill (Claude Code + opencode)
  ~/.agents/skills/active-brain-memory            skill (Codex + opencode)
  ~/.config/opencode/skills/active-brain-memory   skill (opencode native path)

The memory.md template stays in this repo (templates/memory.md); projects copy
it (or a scaffold skill creates it) when they adopt the memory system.

Options:
  --dry-run  show what it would do without changing anything
  --unlink   remove the created symlinks (does not touch the repo)

Non-destructive: never overwrites an existing dir/file that is not a symlink
to this repo; in those cases it skips with a warning.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY=true ;;
    --unlink) UNLINK=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

if [[ ! -f "$PLUGIN_SRC" ]]; then
  echo "Error: plugin not found at $PLUGIN_SRC" >&2
  exit 1
fi

link_one() {
  local src="$1" dest="$2"

  if [[ "$UNLINK" == true ]]; then
    if [[ -L "$dest" ]]; then
      echo "  remove $dest"
      if [[ "$DRY" == false ]]; then
        rm "$dest"
      fi
    else
      echo "  skip $dest (not a symlink)"
    fi
    return
  fi

  if [[ -e "$dest" || -L "$dest" ]]; then
    if [[ -L "$dest" ]]; then
      echo "  ok $dest (already linked)"
    else
      echo "  SKIP $dest (exists and is not a symlink to this repo)"
    fi
    return
  fi

  echo "  link $dest"
  if [[ "$DRY" == false ]]; then
    ln -s "$src" "$dest"
  fi
}

if [[ "$DRY" == true ]]; then
  echo "## DRY RUN — nothing will be changed"
fi

if [[ "$UNLINK" == false && "$DRY" == false ]]; then
  mkdir -p "$OPENCODE_PLUGIN_DIR"
  for dir in "${SKILL_DEST_DIRS[@]}"; do
    mkdir -p "$dir"
  done
fi

echo "## Plugin"
link_one "$PLUGIN_SRC" "$OPENCODE_PLUGIN_DIR/opencode-memory.js"

echo "## Skill"
if [[ -d "$SKILL_SRC" ]]; then
  for dir in "${SKILL_DEST_DIRS[@]}"; do
    link_one "$SKILL_SRC" "$dir/active-brain-memory"
  done
else
  echo "skip skill (missing $SKILL_SRC)"
fi

echo "done."
