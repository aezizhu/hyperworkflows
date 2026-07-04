---
description: Run the HW evidence factory over a scope - full-coverage adversarial audit with an adjudicated tricolor report
argument-hint: "[scope] [force]"
---

Run an evidence-grade audit. Arguments: `$ARGUMENTS` (optional scope path; optional literal `force` to override the solo gate).

**Setup**
1. `head` = `git rev-parse --short HEAD`. Scope = the given path; if none, changed files vs the default branch; if none, the repo root.
2. `run_id` = `hw-audit-<head>`. Create `runs/<run_id>/verdicts/`, write `<run_id>` into `runs/ACTIVE`.
3. Print the initiation card (4 lines): exit condition (tricolor report with 100% of non-grey units adjudicated), phase plan (recon → enumerate-x3 → forge-oracles → spec-attack → analyze-attack-verify → crosscut-reduce), roster summary, and scope@head. Then proceed — do not wait for confirmation (the card is a veto point, not a gate).

**Execute**
4. Invoke the named workflow `hyperaudit` with `{head, scope, run_id, force}`. If named workflows are unavailable, read `${CLAUDE_PLUGIN_ROOT}/workflows/hyperaudit.js` and run it as a dynamic workflow with the same args. The session stays responsive; report milestones only (done/total, measured rate, ETA with arithmetic, Asia/Singapore timestamps).

**Persist & render**
5. If the workflow returned `formation: solo` — say why (touched < 5), remove `runs/ACTIVE`, and simply do the task directly in-session. Never run the fleet on a task that small unless `force` was given.
6. If it returned `HALT-ENUM` — render the enumeration dispute as a decision card and stop. A wrong denominator poisons every downstream claim; this stop is the system working.
7. Otherwise persist: for every adjudicated unit write `runs/<run_id>/verdicts/<unit-slug>.json` in the canonical schema `{unit, head, depth, verdict, probes: [{cmd, expect_exit, exit}], agent_label, ts}` (ts in Asia/Singapore). Write the full report to `runs/<run_id>/report.md` and the machine copy to `report.json`.
8. Render the verdict card: tricolor counts with coverage arithmetic, top confirmed findings (each with its repro command), grey units with `infeasible_reason`, crosscutting findings, and the footer: "Evidence recheck: `node ${CLAUDE_PLUGIN_ROOT}/scripts/recheck.mjs runs/<run_id>`. Residual risk: producer/attacker/verifier share a model family."
9. If confirmed findings exist, write `runs/<run_id>/decision-request.md` listing proposed fixes, and ask the human which to approve (this is the human gate before /hw:apply).
10. Remove `runs/ACTIVE`. Suggest `/hw:ratchet` if this scope shape is likely to recur.
