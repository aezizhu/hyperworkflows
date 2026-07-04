#!/bin/sh
# Hyperworkflows SessionStart brief: stdout is injected as session context. Zero-setup by design:
# engines, hooks, agents, and skills all ship with the plugin; runs/ and memory/ are
# created lazily on first use. Hard cap: stay under 50 lines. Read-only, fast.

echo "## Hyperworkflows active"
echo "Evidence discipline is available with zero setup: /hyperworkflows:audit [scope] for an evidence-grade audit, /hyperworkflows:apply to deliver an approved plan, /hyperworkflows:recheck to re-verify any past report with zero LLM calls."
echo "Formation gate: <5 touched units -> work solo (no orchestration); >=5 units or the user demands evidence -> /hyperworkflows:audit. Override with 'force'. One threshold, one source of truth."
echo "Verdicts come from scripts, never from model judgment; every deliverable is a tricolor report with evidence files under runs/."

if [ -f runs/ACTIVE ]; then
  echo "ACTIVE Hyperworkflows RUN: $(cat runs/ACTIVE) — merge/push is gated by the MERGE_TOKEN protocol until it completes."
fi

if [ -f memory/router.md ]; then
  echo "Router table (latest measured runs):"
  tail -3 memory/router.md | sed 's/^/  /'
fi

if [ -f memory/last-good.json ]; then
  echo "Sentinel baseline present: memory/last-good.json (diff-only regression reporting active)."
fi

exit 0
