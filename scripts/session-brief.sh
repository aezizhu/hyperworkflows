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

# E1 constitutional tier: only in enforced projects (level >= 1). Re-injected
# automatically on session start, resume, AND compaction — decay-resistant by design.
. "$(dirname "$0")/lib-enforce.sh"
LEVEL=$(hyperworkflows_level)
if [ "$LEVEL" -ge 1 ]; then
  echo "### Operating constitution (enforced project, level $LEVEL)"
  echo "- NEVER present work as verified without a script-computed verdict: run the probes, capture raw exit codes, adjudicate via the plugin's adjudicate script, write runs/<id>/verdicts/<unit>.json."
  echo "- A session that edits files must end with either verdict evidence or an explicit UNVERIFIED disclosure in the final message. Undisclosed-unverified is the one prohibited state."
  echo "- Deliverables are tricolor (VERIFIED / DONE-UNVERIFIED / QUARANTINED+GREY) with coverage arithmetic; failures are never folded into success counts."
  echo "- >=5 touched units: route through /hyperworkflows:audit. Delivery: single merger, full suite after every merge, MERGE_TOKEN protocol."
  echo "- Reports are falsifiable: include the recheck footer. If evidence/ exists, copy run verdicts there for the CI gate."
fi
if [ "$LEVEL" -ge 2 ]; then
  echo "- E2 gates armed: ending a file-editing session without evidence or an UNVERIFIED disclosure will be bounced once by the Stop gate. Disclosure always satisfies it."
fi

exit 0
