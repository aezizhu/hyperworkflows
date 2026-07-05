#!/bin/sh
# Hyperworkflows detached runner + supervisor for long headless campaigns.
#
# Field lessons baked in (all from real fleet deaths, 2026-07-04):
#   #1 stdout piped to a monitor -> monitor died -> fleet died. Output goes to a file.
#   #2 -p mode terminates background tasks ~600s after the turn ends. Ceiling set to 0.
#   #3 launch without --plugin-dir dies instantly with "Unknown command". Args pass through.
#   #4 a 37-minute fleet died to one transient "API Error: ConnectionRefused" with no
#      retry. The runner is now a SUPERVISOR: abnormal exits with API/connection
#      signatures relaunch the same prompt (same head -> same run_id -> checkpoints and
#      prefix cache make retries cheap). Config errors (Unknown command) never retry.
#
# Usage: sh scripts/run-detached.sh "/hyperworkflows:audit scripts/" [max_turns] [extra claude args...]
#   e.g. sh scripts/run-detached.sh "/hyperworkflows:audit scripts/" 200 --plugin-dir .
# Env:   HYPERWORKFLOWS_RETRIES (default 2 retries after the first attempt)
# Writes: runs/detached-<ts>.log, runs/detached-<ts>.pid (supervisor pid).

set -e

# ---------------------------------------------------------------- supervisor ----
if [ "$1" = "--supervise" ]; then
  shift
  LOG="$1"; MAX_TURNS="$2"; PROMPT="$3"; shift 3
  export CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS="${CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS:-0}"
  attempt=1
  max_retries="${HYPERWORKFLOWS_RETRIES:-2}"
  while :; do
    echo "=== supervisor attempt $attempt @ $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG"
    claude -p "$PROMPT" --dangerously-skip-permissions --max-turns "$MAX_TURNS" \
      --output-format text "$@" < /dev/null >> "$LOG" 2>&1
    rc=$?
    if grep -q "^Unknown command" "$LOG" 2>/dev/null; then
      echo "=== supervisor: config error (Unknown command) — not retryable ===" >> "$LOG"
      exit 1
    fi
    if [ $rc -eq 0 ] && ! tail -5 "$LOG" | grep -qiE "API Error|ConnectionRefused|ECONNRESET|ETIMEDOUT|overloaded|rate.?limit"; then
      echo "=== supervisor: clean completion (rc=0) ===" >> "$LOG"
      exit 0
    fi
    if [ $attempt -gt $max_retries ]; then
      echo "=== supervisor: giving up after $attempt attempts (last rc=$rc) ===" >> "$LOG"
      exit 1
    fi
    backoff=$((60 * attempt))
    echo "=== supervisor: abnormal exit (rc=$rc) — retrying in ${backoff}s (checkpoints + prefix cache make this cheap) ===" >> "$LOG"
    sleep "$backoff"
    attempt=$((attempt + 1))
  done
fi

# ---------------------------------------------------------------- launcher ------
PROMPT="$1"
MAX_TURNS="${2:-200}"
[ -n "$PROMPT" ] || { echo "usage: run-detached.sh \"<prompt>\" [max_turns] [extra claude args...]" >&2; exit 2; }
command -v claude >/dev/null || { echo "claude CLI not found in PATH" >&2; exit 2; }
[ $# -ge 2 ] && shift 2 || shift 1

mkdir -p runs
TS=$(date '+%Y%m%d-%H%M%S')
LOG="runs/detached-$TS.log"
PIDFILE="runs/detached-$TS.pid"
: > "$LOG"

nohup sh "$0" --supervise "$LOG" "$MAX_TURNS" "$PROMPT" "$@" < /dev/null > /dev/null 2>&1 &
PID=$!
echo "$PID" > "$PIDFILE"

# 3s liveness window: instant deaths (bad flags, Unknown command) are reported here,
# not discovered minutes later.
sleep 3
if ps -p "$PID" > /dev/null 2>&1 && ! grep -q "^Unknown command" "$LOG" 2>/dev/null; then
  echo "detached under supervisor: pid=$PID log=$LOG (retries=${HYPERWORKFLOWS_RETRIES:-2} on API/connection failures)"
  echo "monitor:  tail -f $LOG   |   check: ps -p $PID   |   journal: runs/<run-id>/events.jsonl"
else
  echo "process died or errored immediately — first log lines:" >&2
  head -8 "$LOG" >&2
  exit 1
fi
