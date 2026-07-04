#!/bin/sh
# Hyperworkflows detached runner for long headless campaigns.
#
# Field lesson (2026-07-04): an audit launched with its stdout piped to a monitoring
# shell DIED mid-run when the monitor went away (SIGPIPE) — 19 minutes of fleet work
# lost to a plumbing accident. Long runs must never depend on the launcher's pipe.
#
# Usage: sh scripts/run-detached.sh "/hyperworkflows:audit scripts/" [max_turns]
# Writes: runs/detached-<ts>.log, runs/detached-<ts>.pid; survives the launcher exiting.

set -e
PROMPT="$1"
MAX_TURNS="${2:-200}"
[ -n "$PROMPT" ] || { echo "usage: run-detached.sh \"<prompt>\" [max_turns]" >&2; exit 2; }
command -v claude >/dev/null || { echo "claude CLI not found in PATH" >&2; exit 2; }

mkdir -p runs
TS=$(date '+%Y%m%d-%H%M%S')
LOG="runs/detached-$TS.log"
PIDFILE="runs/detached-$TS.pid"

# nohup + full detach: output to file, stdin from /dev/null, disowned from this shell.
nohup claude -p "$PROMPT" --dangerously-skip-permissions --max-turns "$MAX_TURNS" \
  --output-format text < /dev/null > "$LOG" 2>&1 &
PID=$!
echo "$PID" > "$PIDFILE"

sleep 1
if ps -p "$PID" > /dev/null 2>&1; then
  echo "detached: pid=$PID log=$LOG"
  echo "monitor:  tail -f $LOG   |   check: ps -p $PID   |   journal: runs/<run-id>/events.jsonl"
else
  echo "process died immediately — first log lines:" >&2
  head -5 "$LOG" >&2
  exit 1
fi
