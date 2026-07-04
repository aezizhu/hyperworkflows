---
description: Post-run ratchet - record measured stats to the router table and distill candidates from the ledger
argument-hint: "[run-dir]"
---

Ratchet a completed run into memory. Argument: `$ARGUMENTS` (default = most recent completed run).

1. Compute from the run's blackboard (events.jsonl, verdicts/, report.json): formation used, scope, unit count, agent count, wall-clock (first→last event), coverage, and spot-check health if recorded.
2. Append ONE line to `memory/router.md` (create `memory/` and the header line lazily if missing): `| <formation> | <scope> | <units> | <agents> | <wall-clock> | <health> |` — measured numbers only, no estimates.
3. Dispatch `hw-distiller` (background) over the run directory to write candidates under `memory/candidates/`. Remind it: second-occurrence threshold; memory/ only.
4. If this run's workflow shape is reusable and not yet named, confirm the engines in `.claude/workflows/` are current vs `${CLAUDE_PLUGIN_ROOT}/workflows/` and note any local divergence.
5. Report: the router line added, candidates written (if any), and nothing else. The ratchet is the tail of a run — it never starts new work.
