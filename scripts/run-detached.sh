#!/bin/sh
# Hyperworkflows detached runner for long headless campaigns.
#
# Field lesson (2026-07-04): an audit launched with its stdout piped to a monitoring
# shell DIED mid-run when the monitor went away (SIGPIPE) — 19 minutes of fleet work
# lost to a plumbing accident. Long runs must never depend on the launcher's pipe.
#
# Usage: sh scripts/run-detached.sh "/hyperworkflows:audit scripts/" [max_turns] [extra claude args...]
#   e.g. sh scripts/run-detached.sh "/hyperworkflows:audit scripts/" 200 --plugin-dir .
# Extra args pass through to claude (field lesson #3: a dev launch without
# --plugin-dir died instantly with "Unknown command" — commands only exist where
# the plugin is loaded).
# Writes: runs/detached-<ts>.log, runs/detached-<ts>.pid; survives the launcher exiting.

set -e
PROMPT="$1"
MAX_TURNS="${2:-200}"
[ -n "$PROMPT" ] || { echo "usage: run-detached.sh \"<prompt>\" [max_turns] [extra claude args...]" >&2; exit 2; }
command -v claude >/dev/null || { echo "claude CLI not found in PATH" >&2; exit 2; }
[ $# -ge 2 ] && shift 2 || shift 1

mkdir -p runs
TS=$(date '+%Y%m%d-%H%M%S')
LOG="runs/detached-$TS.log"
PIDFILE="runs/detached-$TS.pid"

# Field lesson #2 (same day): in -p mode the platform TERMINATES background tasks
# ~600s after the model's turn ends ("Background tasks still running after 600s").
# A workflow fleet is a background task — two audits died at exactly +600s before
# this was set. Ceiling 0 = wait indefinitely for the fleet to land.
export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS="${CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS:-0}"

# nohup + full detach: output to file, stdin from /dev/null, disowned from this shell.
nohup claude -p "$PROMPT" --dangerously-skip-permissions --max-turns "$MAX_TURNS" \
  --output-format text "$@" < /dev/null > "$LOG" 2>&1 &
PID=$!
echo "$PID" > "$PIDFILE"

# 3s liveness window: catches instant deaths ("Unknown command", bad flags) that
# a 1s check missed in the field.
sleep 3
if ps -p "$PID" > /dev/null 2>&1 && ! grep -q "^Unknown command" "$LOG" 2>/dev/null; then
  echo "detached: pid=$PID log=$LOG"
  echo "monitor:  tail -f $LOG   |   check: ps -p $PID   |   journal: runs/<run-id>/events.jsonl"
else
  echo "process died or errored immediately — first log lines:" >&2
  head -5 "$LOG" >&2
  exit 1
fi
