#!/bin/sh
# Property/metamorphic acceptance for scripts/run-detached.sh
#
# TEST-ONLY. Exercises the detached runner against a STUB `claude` on PATH so no
# real model/network is touched. Asserts the script's contract:
#   - argument/dependency guards exit 2
#   - a live launch exits 0, materializes log+pid, and the pid is a real process
#   - an instant death / "Unknown command" launch exits 1
# Timestamps and PIDs are non-deterministic, so we assert structural properties
# and exit codes rather than a byte-exact golden file.
#
# Usage: sh scripts/tests/run-detached_test.sh   (run from repo root)
# Exit 0 = all assertions hold on current code.
set -u

# Resolve the script under test relative to this test file.
TESTDIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SUT="$TESTDIR/../run-detached.sh"
[ -f "$SUT" ] || { echo "FAIL: cannot find SUT at $SUT" >&2; exit 1; }

WORK=$(mktemp -d 2>/dev/null || mktemp -d -t rundetached)
trap 'rm -rf "$WORK"; [ -n "${STUBPID:-}" ] && kill "$STUBPID" 2>/dev/null' EXIT
FAILS=0
pass() { echo "ok   - $1"; }
fail() { echo "FAIL - $1" >&2; FAILS=$((FAILS+1)); }

# ---------------------------------------------------------------------------
# T1: no prompt -> exit 2 with usage on stderr, before any runs/ dir is made.
# ---------------------------------------------------------------------------
d="$WORK/t1"; mkdir -p "$d"
out=$( (cd "$d" && sh "$SUT") 2>&1 ); rc=$?
[ "$rc" -eq 2 ] && pass "T1 no-arg exits 2" || fail "T1 no-arg exit=$rc want 2"
echo "$out" | grep -qi usage && pass "T1 prints usage" || fail "T1 missing usage msg"
[ -d "$d/runs" ] && fail "T1 created runs/ before validating args" || pass "T1 no runs/ side effect"

# ---------------------------------------------------------------------------
# T2: prompt given but `claude` absent from PATH -> exit 2 with clear message.
# ---------------------------------------------------------------------------
# PATH=/usr/bin:/bin keeps sh/grep/ps/date etc. but excludes ~/.local/bin/claude,
# so the dependency guard is what fires (not a missing interpreter).
d="$WORK/t2"; mkdir -p "$d"
out=$( (cd "$d" && PATH="/usr/bin:/bin" sh "$SUT" "do a thing") 2>&1 ); rc=$?
[ "$rc" -eq 2 ] && pass "T2 missing-claude exits 2" || fail "T2 exit=$rc want 2"
echo "$out" | grep -qi "claude CLI not found" && pass "T2 explains missing claude" \
  || fail "T2 missing 'claude CLI not found'"

# ---------------------------------------------------------------------------
# T3: live launch. Stub `claude` stays alive > liveness window -> exit 0,
#     log+pid materialized, pid file holds a real running process.
# ---------------------------------------------------------------------------
d="$WORK/t3"; mkdir -p "$d/bin"
cat > "$d/bin/claude" <<'STUB'
#!/bin/sh
echo "stub claude started with: $*"
sleep 8
STUB
chmod +x "$d/bin/claude"
out=$( (cd "$d" && PATH="$d/bin:$PATH" sh "$SUT" "long campaign" 5) 2>&1 ); rc=$?
[ "$rc" -eq 0 ] && pass "T3 live launch exits 0" || fail "T3 exit=$rc want 0"
echo "$out" | grep -q "detached: pid=" && pass "T3 announces detached pid" \
  || fail "T3 no 'detached: pid=' line"
ls "$d"/runs/detached-*.log >/dev/null 2>&1 && pass "T3 wrote a log file" \
  || fail "T3 no runs/detached-*.log"
pidf=$(ls "$d"/runs/detached-*.pid 2>/dev/null | head -1)
if [ -n "$pidf" ]; then
  pass "T3 wrote a pid file"
  STUBPID=$(cat "$pidf")
  if ps -p "$STUBPID" >/dev/null 2>&1; then
    pass "T3 pid file references a live process"
  else
    fail "T3 pid $STUBPID not running"
  fi
  kill "$STUBPID" 2>/dev/null; STUBPID=""
else
  fail "T3 no runs/detached-*.pid"
fi

# ---------------------------------------------------------------------------
# T4: instant death. Stub prints "Unknown command" and exits 0 immediately;
#     the liveness gate must classify it as failure -> exit 1.
# ---------------------------------------------------------------------------
d="$WORK/t4"; mkdir -p "$d/bin"
cat > "$d/bin/claude" <<'STUB'
#!/bin/sh
echo "Unknown command: /bogus"
exit 0
STUB
chmod +x "$d/bin/claude"
out=$( (cd "$d" && PATH="$d/bin:$PATH" sh "$SUT" "bad cmd" 5) 2>&1 ); rc=$?
[ "$rc" -eq 1 ] && pass "T4 instant-death exits 1" || fail "T4 exit=$rc want 1"

# ---------------------------------------------------------------------------
echo "---"
if [ "$FAILS" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "$FAILS assertion(s) failed"
  exit 1
fi
