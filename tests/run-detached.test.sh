#!/bin/sh
# Oracle for scripts/run-detached.sh (property-based).
#
# The unit is a launcher: it detaches `claude`, records a pid/log, and reports
# liveness. We cannot invoke the real `claude` deterministically, so we STUB it
# on PATH and assert the launcher's observable contract:
#   P1. missing prompt          -> exit 2, usage on stderr (fail-fast, no launch)
#   P2. live child              -> exit 0, "detached: pid=", pidfile holds the
#                                  running pid, log exists, forwarded args carry
#                                  the default --max-turns 200
#   P3. custom turns + passthru -> forwarded argv carries --max-turns 50 and the
#                                  trailing pass-through args verbatim
#   P4. child that dies/errors  -> exit 1 (liveness window catches instant death)
# TEST-ONLY. No production code is touched.
set -u

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(dirname "$SCRIPT_DIR")
TARGET="$REPO_ROOT/scripts/run-detached.sh"

fail() { echo "FAIL: $1" >&2; exit 1; }
[ -f "$TARGET" ] || fail "target not found: $TARGET"

# --- shared stub dir: a fake `claude` that records its argv then blocks --------
STUBDIR=$(mktemp -d)
trap 'rm -rf "$STUBDIR"' EXIT

make_alive_stub() {
  cat > "$STUBDIR/claude" <<'EOF'
#!/bin/sh
# record forwarded argv, then stay alive so the launcher sees a live pid
printf '%s\n' "$*" > "$STUB_ARGS_FILE"
exec sleep 30
EOF
  chmod +x "$STUBDIR/claude"
}

make_dead_stub() {
  cat > "$STUBDIR/claude" <<'EOF'
#!/bin/sh
echo "Unknown command: /nope"
exit 1
EOF
  chmod +x "$STUBDIR/claude"
}

run_in_tmp() {
  # run the launcher inside a throwaway cwd so runs/ artifacts don't leak;
  # sets globals WD (workdir) and RC (exit code) — no command substitution so
  # the exit code survives.
  WD=$(mktemp -d)
  ( cd "$WD" && PATH="$STUBDIR:$PATH" sh "$TARGET" "$@" ) >"$WD/.out" 2>"$WD/.err"
  RC=$?
}

# ---------------------------------------------------------------- P1: no prompt
wd=$(cd / && sh "$TARGET" </dev/null 2>/tmp/.p1err >/dev/null; echo $?)
[ "$wd" = "2" ] || fail "P1: expected exit 2 for missing prompt, got $wd"
grep -qi usage /tmp/.p1err || fail "P1: expected usage message on stderr"

# ----------------------------------------------------------- P2: live child ok
make_alive_stub
export STUB_ARGS_FILE="$STUBDIR/args_p2"
run_in_tmp "my prompt"
[ "$RC" = "0" ] || { cat "$WD/.err" >&2; fail "P2: expected exit 0 for live child, got $RC"; }
grep -q "detached: pid=" "$WD/.out" || fail "P2: expected 'detached: pid=' on stdout"
pidfile=$(ls "$WD"/runs/detached-*.pid 2>/dev/null | head -1)
logfile=$(ls "$WD"/runs/detached-*.log 2>/dev/null | head -1)
[ -f "$pidfile" ] || fail "P2: pidfile not written"
[ -f "$logfile" ] || fail "P2: logfile not written"
pid=$(cat "$pidfile")
case "$pid" in ''|*[!0-9]*) fail "P2: pidfile does not contain a numeric pid: '$pid'";; esac
ps -p "$pid" >/dev/null 2>&1 || fail "P2: recorded pid $pid is not a live process"
[ -f "$STUB_ARGS_FILE" ] || fail "P2: child never launched (no args file)"
grep -q -- "--max-turns 200" "$STUB_ARGS_FILE" || fail "P2: default max-turns 200 not forwarded (got: $(cat "$STUB_ARGS_FILE"))"
grep -q -- "-p my prompt" "$STUB_ARGS_FILE" || fail "P2: prompt not forwarded via -p"
kill "$pid" >/dev/null 2>&1

# ------------------------------------------- P3: custom turns + pass-through args
make_alive_stub
export STUB_ARGS_FILE="$STUBDIR/args_p3"
run_in_tmp "job" 50 --plugin-dir .
[ "$RC" = "0" ] || { cat "$WD/.err" >&2; fail "P3: expected exit 0, got $RC"; }
grep -q -- "--max-turns 50" "$STUB_ARGS_FILE" || fail "P3: custom max-turns 50 not forwarded (got: $(cat "$STUB_ARGS_FILE"))"
grep -q -- "--plugin-dir ." "$STUB_ARGS_FILE" || fail "P3: pass-through args not forwarded (got: $(cat "$STUB_ARGS_FILE"))"
pid=$(cat "$(ls "$WD"/runs/detached-*.pid | head -1)")
kill "$pid" >/dev/null 2>&1

# ------------------------------------------------- P4: instant death -> exit 1
make_dead_stub
export STUB_ARGS_FILE="$STUBDIR/args_p4"
run_in_tmp "doomed"
[ "$RC" = "1" ] || fail "P4: expected exit 1 for dying child, got $RC"
grep -qi "died or errored" "$WD/.err" || fail "P4: expected death diagnostic on stderr"

echo "OK: run-detached oracle P1-P4 passed"
