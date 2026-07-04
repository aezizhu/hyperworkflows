#!/usr/bin/env bash
# Oracle for .gitignore: metamorphic/property test over `git check-ignore`.
# The file's only observable behavior is which paths git ignores, so we assert
# every declared pattern ignores a representative path and control paths do not.
set -u

ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
cd "$ROOT" || { echo "cannot cd to repo root"; exit 2; }

fail=0

must_ignore() {
  if git check-ignore -q "$1"; then
    echo "ok   ignored: $1"
  else
    echo "FAIL not ignored (expected ignore): $1"; fail=1
  fi
}

must_track() {
  if git check-ignore -q "$1"; then
    echo "FAIL ignored (expected tracked): $1"; fail=1
  else
    echo "ok   tracked: $1"
  fi
}

# --- Positive cases: one representative path per declared pattern ---
must_ignore "node_modules/foo.js"        # node_modules/
must_ignore "runs/2026-07-04/run.log"    # runs/
must_ignore "memory/state.json"          # memory/
must_ignore ".DS_Store"                  # .DS_Store (repo root)
must_ignore "src/nested/.DS_Store"       # .DS_Store matches at any depth

# --- Negative controls: real project paths must stay tracked ---
must_track "README.md"
must_track "src/index.js"
must_track "memory_notes.txt"            # substring, not the memory/ dir
must_track "node_modulesX"               # substring, not node_modules/ dir

# --- Coverage: every non-comment, non-blank line has a positive case above ---
covered=("node_modules/" "runs/" "memory/" ".DS_Store")
while IFS= read -r line; do
  [ -z "$line" ] && continue
  case "$line" in \#*) continue;; esac
  hit=0
  for c in "${covered[@]}"; do [ "$c" = "$line" ] && hit=1; done
  if [ "$hit" -eq 0 ]; then
    echo "FAIL uncovered .gitignore pattern (add a case): $line"; fail=1
  fi
done < .gitignore

exit $fail
