#!/bin/sh
# HW SessionStart brief: stdout is injected as session context. Hard cap: stay under 50 lines.
# Fast, read-only, silent about anything that does not exist.

echo "## HW (Hyperworkflows) brief"
echo "Formation gate: <5 touched units -> solo (no orchestration); >=5 units or evidence-grade treatment demanded -> /hw:audit. One threshold, one source of truth. Override with 'force'."

if [ -d .claude/workflows ]; then
  W=$(ls .claude/workflows/hyperaudit.js .claude/workflows/hyperapply.js .claude/workflows/hw-sentinel.js 2>/dev/null)
  if [ -n "$W" ]; then
    echo "HW workflows installed:"
    printf '%s\n' "$W" | sed 's/^/  - /'
  else
    echo "HW workflows not installed in this project. Run /hw:init, then restart and run /hw:doctor."
  fi
else
  echo "HW not initialized in this project. Run /hw:init, then restart and run /hw:doctor."
fi

if [ -f runs/ACTIVE ]; then
  echo "ACTIVE HW RUN: $(cat runs/ACTIVE) — merge/push is gated by the MERGE_TOKEN protocol until it completes."
fi

if [ -f memory/router.md ]; then
  echo "Router table (latest measured runs):"
  tail -3 memory/router.md | sed 's/^/  /'
fi

if [ -f memory/last-good.json ]; then
  echo "Sentinel baseline present: memory/last-good.json (diff-only regression reporting active)."
fi

exit 0
