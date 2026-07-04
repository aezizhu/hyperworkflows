---
description: Deliver approved changes via N-version tournament builds, fixpoint repair, and gated serial merges
argument-hint: "[plan-path]"
---

Deliver a human-approved change plan. Argument: `$ARGUMENTS` (path to the plan; default = the most recent `runs/*/decision-request.md`).

**Preconditions**
1. The plan MUST be human-approved. If the plan file has no approval marker and the human has not confirmed in this conversation, show the plan summary and ask first — this is the one gate that is never skipped.
2. `head` = `git rev-parse --short HEAD`; `run_id` = `hw-apply-<head>`. Create `runs/<run_id>/verdicts/`, write `runs/ACTIVE`.
3. Initiation card: groups/units to deliver, tournament size (N=3 default, N=5 if the plan marks a group critical), merge discipline (single merger, serial, full suite per merge). Proceed without waiting.

**Execute**
4. Invoke named workflow `hyperapply` with `{head, plan_path, run_id}` (dynamic-workflow fallback from `${CLAUDE_PLUGIN_ROOT}/workflows/hyperapply.js` if needed).
5. Milestones per level: groups done/total, entries green per group, repair rounds used. Asia/Singapore timestamps, measured-rate ETA.

**Persist & render**
6. Persist verdict files for every group (canonical schema, including the post-merge full-suite exit codes as probes). Write `report.md` + `report.json`.
7. Render the verdict card as tricolor: MERGED-VERIFIED (with suite exit codes) / QUARANTINED (STUCK or FLAKY-ORACLE, each with its failure signature and last failing commands) / NOT-ATTEMPTED. A quarantined group is never counted as delivered — state plainly what failed and what the human can do (retry with N=5, send to court, or drop).
8. Remove `runs/ACTIVE` (the workflow removes MERGE_TOKEN itself after each merge; confirm none is left behind — a leftover token is a bug, report it).
9. Footer: recheck command line for this run.
