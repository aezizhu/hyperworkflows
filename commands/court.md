---
description: Adjudicate a contested set - agent-team court (advocate/skeptic/risk-officer) or sequential fallback
argument-hint: "[contested-file]"
---

Adjudicate contested items. Argument: `$ARGUMENTS` (path to a contested set JSON/MD; default = the contested section of the most recent audit report).

**Rules of the court (constitution C6)**
- The court consumes ONLY the distilled contested set — never raw corpus, never producer reasoning.
- Every ruling needs executed evidence: the skeptic RUNS the repro commands; rulings without recorded exit codes do not complete (the TaskCompleted gate enforces this while `runs/<run_id>/COURT` exists).
- Timebox the whole court; volatile by assumption — every ruling flushes to `runs/<run_id>/verdicts/task-<task_id>.json` the moment it is decided.

**Procedure**
1. Load the contested set. If ≤3 items: adjudicate sequentially right here — for each item, run the repro, compute the verdict from exit codes (`node ${CLAUDE_PLUGIN_ROOT}/scripts/adjudicate.mjs adjudicate '...'`), record the verdict file. No team needed.
2. If >3 items AND `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set: `run_id` = active or `court-<head>`; touch `runs/<run_id>/COURT`; spawn three teammates — advocate (argues each item's strongest case), skeptic (executes every repro and tries to break claims), risk-officer (blast-radius and second-order effects). One shared task per contested item. Collect rulings as they flush.
3. If teams are unavailable: say so once (DEGRADED: sequential fallback) and do step 1 for all items.
4. Items where evidence is genuinely ambiguous after execution are the ONLY things escalated to the human — present each with both sides' strongest executed evidence, never "what do you think?".
5. Render the ruling card: upheld / overturned / escalated, each with its evidence file path. Remove the COURT marker.
