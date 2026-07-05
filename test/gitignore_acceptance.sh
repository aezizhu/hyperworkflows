#!/usr/bin/env bash
# Behavioral acceptance oracle for the repo-root .gitignore unit.
#
# A .gitignore is a data/config unit; its correct "output" is which paths git
# ignores. This oracle drives that behavior directly via `git check-ignore`,
# asserting each declared pattern matches its representative paths (positive
# cases) and that pattern semantics do not over-reach (negative cases: dir-only
# patterns must not swallow same-named files, and unrelated tracked paths stay
# visible).
#
# Passes on current .gitignore; a change that weakens/over-broadens ignore rules
# breaks a specific assertion. Test-only; makes no repo modifications.
set -u

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT" || { echo "cannot cd to repo root"; exit 2; }

fail=0

# assert_ignored <path>
assert_ignored() {
  if git check-ignore -q -- "$1"; then
    echo "ok       IGNORED     $1"
  else
    echo "FAIL     expected IGNORED but visible: $1"
    fail=1
  fi
}

# assert_visible <path>
assert_visible() {
  if git check-ignore -q -- "$1"; then
    echo "FAIL     expected VISIBLE but ignored: $1"
    fail=1
  else
    echo "ok       VISIBLE     $1"
  fi
}

# --- positive: every declared pattern must ignore its representatives ---
# node_modules/
assert_ignored "node_modules/"
assert_ignored "node_modules/foo/bar.js"
assert_ignored "adapters/node_modules/pkg/index.js"   # nested dir also matched
# runs/
assert_ignored "runs/"
assert_ignored "runs/run-1/log.txt"
# memory/
assert_ignored "memory/"
assert_ignored "memory/state.json"
# .DS_Store
assert_ignored ".DS_Store"
assert_ignored "scripts/.DS_Store"                    # matched at any depth

# --- negative: patterns must not over-reach; real repo paths stay tracked ---
assert_visible "README.md"
assert_visible "package.json"
assert_visible "scripts/run.sh"
assert_visible "runs.md"     # dir pattern 'runs/' must not swallow a file 'runs.md'
assert_visible "runs"        # trailing-slash pattern matches dirs only, not a file

if [ "$fail" -ne 0 ]; then
  echo "GITIGNORE ACCEPTANCE: FAIL"
  exit 1
fi
echo "GITIGNORE ACCEPTANCE: PASS"
exit 0
