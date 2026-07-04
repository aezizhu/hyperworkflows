#!/bin/sh
# Golden-file oracle for scripts/lib-enforce.sh :: hyperworkflows_level()
# Enumerates the full resolution decision table (env > file > markers > default)
# and diffs actual output against a frozen golden. Exit 0 = match, 1 = drift.
# Test-only. Run from repo root: sh scripts/test-lib-enforce.sh

set -u
LIB="$(CDPATH= cd "$(dirname "$0")" && pwd)/lib-enforce.sh"
[ -f "$LIB" ] || { echo "FATAL: lib not found at $LIB" >&2; exit 2; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# case <name> <env-value-or-UNSET> <dir> => prints "name: <level>"
run_case() {
  name="$1"; envval="$2"; dir="$3"
  if [ "$envval" = "UNSET" ]; then
    out="$( cd "$dir" && unset HYPERWORKFLOWS_ENFORCE; . "$LIB"; hyperworkflows_level )"
  else
    out="$( cd "$dir" && HYPERWORKFLOWS_ENFORCE="$envval"; export HYPERWORKFLOWS_ENFORCE; . "$LIB"; hyperworkflows_level )"
  fi
  printf '%s: %s\n' "$name" "$out"
}

# --- fixtures ---
mkdir -p "$WORK/bare"
mkdir -p "$WORK/mark/.hyperworkflows"
mkdir -p "$WORK/router/memory"; : > "$WORK/router/memory/router.md"
mkdir -p "$WORK/ev/evidence"
mkdir -p "$WORK/file2/.hyperworkflows"; printf '2'    > "$WORK/file2/.hyperworkflows/enforce"
mkdir -p "$WORK/file0nl/.hyperworkflows"; printf '0\n' > "$WORK/file0nl/.hyperworkflows/enforce"
mkdir -p "$WORK/femp/.hyperworkflows";   : >            "$WORK/femp/.hyperworkflows/enforce"
mkdir -p "$WORK/fgarb/.hyperworkflows";  printf 'xyz\n'> "$WORK/fgarb/.hyperworkflows/enforce"

ACTUAL="$(
  run_case "no-markers-default0"     UNSET "$WORK/bare"
  run_case "marker-dir-default1"     UNSET "$WORK/mark"
  run_case "router-marker-default1"  UNSET "$WORK/router"
  run_case "evidence-marker-default1" UNSET "$WORK/ev"
  run_case "file-2-wins"             UNSET "$WORK/file2"
  run_case "file-0-newline-wins"     UNSET "$WORK/file0nl"
  run_case "file-empty-falls-to-marker" UNSET "$WORK/femp"
  run_case "file-garbage-falls-to-marker" UNSET "$WORK/fgarb"
  run_case "env-0-overrides-marker"  0     "$WORK/mark"
  run_case "env-2-over-bare"         2     "$WORK/bare"
  run_case "env-0-overrides-file2"   0     "$WORK/file2"
  run_case "env-9-invalid-default1"  9     "$WORK/bare"
  run_case "env-abc-invalid-default1" abc  "$WORK/bare"
  run_case "env-2abc-invalid-default1" 2abc "$WORK/bare"
  run_case "env-empty-treated-unset" ""    "$WORK/bare"
)"

GOLDEN="no-markers-default0: 0
marker-dir-default1: 1
router-marker-default1: 1
evidence-marker-default1: 1
file-2-wins: 2
file-0-newline-wins: 0
file-empty-falls-to-marker: 1
file-garbage-falls-to-marker: 1
env-0-overrides-marker: 0
env-2-over-bare: 2
env-0-overrides-file2: 0
env-9-invalid-default1: 1
env-abc-invalid-default1: 1
env-2abc-invalid-default1: 1
env-empty-treated-unset: 0"

if [ "$ACTUAL" = "$GOLDEN" ]; then
  echo "PASS: 15/15 resolution cases match golden"
  exit 0
else
  echo "FAIL: output drifted from golden" >&2
  printf '%s\n' "$GOLDEN"  > "$WORK/golden.txt"
  printf '%s\n' "$ACTUAL"  > "$WORK/actual.txt"
  diff "$WORK/golden.txt" "$WORK/actual.txt" >&2 || true
  exit 1
fi
