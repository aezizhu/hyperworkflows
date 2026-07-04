#!/bin/sh
# HW Devin adapter installer.
# Usage: sh adapters/devin/install.sh /path/to/target/project
# Copies the five methodology skills to <target>/.devin/skills/hw-*/ and generates
# <target>/.devin/hw-role-prompts.md from agents/*.md. Idempotent; overwrites only
# the artifacts it generates.

set -e

TARGET="$1"
[ -n "$TARGET" ] || { echo "usage: install.sh /path/to/target/project" >&2; exit 2; }
[ -d "$TARGET" ] || { echo "target does not exist: $TARGET" >&2; exit 2; }

HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)

# --- skills ---------------------------------------------------------------
for s in oracle-forging spec-attack tricolor-reporting adjudication-protocol merge-discipline; do
  mkdir -p "$TARGET/.devin/skills/hw-$s"
  cp "$ROOT/skills/$s/SKILL.md" "$TARGET/.devin/skills/hw-$s/SKILL.md"
  echo "installed skill: .devin/skills/hw-$s/SKILL.md"
done

# --- role prompts (frontmatter stripped, contract bodies kept) -------------
OUT="$TARGET/.devin/hw-role-prompts.md"
{
  echo "# HW role contracts (generated from agents/*.md — regenerate with adapters/devin/install.sh)"
  echo
  for f in "$ROOT"/agents/hw-*.md; do
    name=$(basename "$f" .md)
    echo "## $name"
    echo
    # Strip the YAML frontmatter (first --- ... --- block), keep the body.
    awk 'BEGIN{fm=0} /^---$/{fm++; next} fm>=2{print}' "$f"
    echo
  done
} > "$OUT"
echo "generated: $OUT"

echo "done. Skills live under .devin/skills/hw-*; paste role contracts from hw-role-prompts.md into subagent prompts."
