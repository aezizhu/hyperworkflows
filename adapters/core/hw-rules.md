# HW operating rules (harness-agnostic core)

This project uses Hyperworkflows (HW) evidence discipline. These rules apply to any coding agent working here. The portable toolkit lives in `.hw/` (Node >= 18, zero dependencies).

## Non-negotiables

1. **Contract-first.** Every unit of work carries executable acceptance `{cmd, expect_exit}` before you build or audit it. No oracle? Forge one first (golden file > property test > metamorphic relation > snapshot); only demonstrably infeasible units stay grey, each with an `infeasible_reason`.
2. **Verdicts are computed by script, never by you.** You run commands and record raw exit codes; pass/fail comes from:
   `node .hw/adjudicate.mjs adjudicate '{"probes":[{"cmd":"...","expect_exit":0}],"exit_codes":[{"cmd":"...","exit":0}]}'`
   You never declare something verified from reading code or output prose.
3. **Independent verification.** Re-run acceptance in a fresh context (subagent/task if the tool has them; at minimum a clean shell pass that ignores your implementation reasoning). Findings need executable repros: `{claim, repro_cmd, expect_exit}` — a repro you have not executed is speculation.
4. **Tricolor finality.** Every deliverable report has exactly three buckets — VERIFIED (with evidence files) / DONE-UNVERIFIED (with reasons) / QUARANTINED+GREY — plus coverage arithmetic (`verified/total`, grey and failed counted in total). A failed unit is never folded into a success count.
5. **No silent truncation.** Any skip, sample, or degradation is disclosed in the report with its reason.
6. **Defend the denominator.** Enumerate scope at least two independent ways (e.g. `git ls-files` walk + symbol/build-graph pass); reconcile with `node .hw/adjudicate.mjs reconcile '...'`; disputes are resolved explicitly or reported — never silently dropped.
7. **Depth labels.** Every "green" states its depth: D0 acceptance / D1 attack-survived / D2 mutation-hardened / D3 differential / D4 bench-clean. "All green" always says which green.

## Blackboard

```
runs/<run-id>/
  verdicts/<unit-slug>.json   # one per unit, canonical schema below
  report.md                   # tricolor report
```

Verdict file schema:

```json
{
  "unit": "src/foo.ts",
  "head": "abc1234",
  "depth": "D1",
  "verdict": "PASS",
  "probes": [{ "cmd": "npm test -- foo", "expect_exit": 0, "exit": 0 }],
  "agent_label": "verify:src/foo.ts",
  "ts": "2026-07-04T17:00:00+08:00"
}
```

## Falsifiability

Every report footer includes:
`Re-verify without any LLM: node .hw/recheck.mjs runs/<run-id>`
and the honesty note that producer and verifier may share a model family.

## Roles

When delegating to subagents/tasks, use the role contracts in `.hw/role-prompts.md` verbatim (verifier gets commands only — never your reasoning).
