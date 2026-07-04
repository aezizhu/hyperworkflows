---
description: Deliver approved changes via N-version tournament builds, fixpoint repair, and gated serial merges
argument-hint: "[plan-path]"
---

Deliver a human-approved change plan. Argument: `$ARGUMENTS` (path to the plan; default = the most recent `runs/*/decision-request.md`).

**Preconditions**
1. The plan MUST be human-approved. If the plan file has no approval marker and the human has not confirmed in this conversation, show the plan summary and ask first — this is the one gate that is never skipped.
2. `head` = `git rev-parse --short HEAD`; `run_id` = `apply-<head>`. Create `runs/<run_id>/verdicts/` (mkdir -p), write `runs/ACTIVE`.
3. Initiation card: groups/units to deliver, tournament size (N=3 default, N=5 if the plan marks a group critical), merge discipline (single merger, serial, full suite per merge). Proceed without waiting.

**Execute**
4. Run the engine shipped with this plugin: prefer the plugin-registered `hyperapply` workflow if invocable by name; otherwise read `${CLAUDE_PLUGIN_ROOT}/workflows/hyperapply.js` and execute it as a dynamic workflow with `{head, plan_path, run_id}`. (A project-local copy from optional `/hyperworkflows:init` takes precedence.)
5. Milestones per level: groups done/total, entries green per group, repair rounds used. Asia/Singapore timestamps, measured-rate ETA.
   **Headless rule (non-interactive `-p` session):** the fleet dies ~600s after your turn ends unless `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0` (run-detached.sh sets it). Stay with the run until the workflow result arrives; never end the turn on a promise to report later.

**Persist & render**
6. Persist verdict files for every group (canonical schema, including the post-merge full-suite exit codes as probes). Write `report.md` + `report.json`.
7. Render the verdict card as tricolor: MERGED-VERIFIED (with suite exit codes) / QUARANTINED (STUCK or FLAKY-ORACLE, each with its failure signature and last failing commands) / NOT-ATTEMPTED. Groups whose acceptance already passed at base render as ALREADY-APPLIED (verified skip — pre-verify evidence attached, no builders were spawned). A quarantined group is never counted as delivered — state plainly what failed and what the human can do (retry with N=5, send to court, or drop).
8. E3 evidence convention: if an `evidence/` directory exists at the repo root, copy `runs/<run_id>/verdicts/` and `report.md` to `evidence/<run_id>/` so the delivery's evidence ships with the PR and CI can re-execute it.
9. Remove `runs/ACTIVE` (the workflow removes MERGE_TOKEN itself after each merge; confirm none is left behind — a leftover token is a bug, report it).
10. Footer: recheck command line for this run.
