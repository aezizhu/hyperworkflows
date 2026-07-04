---
name: oracle-forging
description: Use when a unit of work has no executable acceptance (no test, no verifiable output) and you need to construct one - golden files, property tests, metamorphic relations, snapshot tests - or prove it infeasible.
---

# Oracle Forging

A missing oracle is a work item, not a label. Forge executable acceptance in this preference order — strongest first:

1. **Exact golden file** — deterministic output? Capture it: `diff <(cmd) fixtures/golden.txt; exit code 0`. Strongest oracle; brittle only if the output legitimately varies.
2. **Property-based test** — output varies but properties hold (sorted, idempotent, round-trips, conserves length/sum). Encode the property, generate inputs.
3. **Metamorphic relation** — no absolute expectation, but relations across runs hold: `f(x) == f(shuffle(x))`, `count(filter(p)) <= count(all)`, `decode(encode(x)) == x`.
4. **Snapshot test** — last resort: freeze current behavior to detect change, not correctness. Label it as change-detection so nobody mistakes it for a correctness oracle.

Rules:
- The forged acceptance must PASS on current code. If it fails, you found a defect — report it as a finding, not an oracle.
- Test-only changes. Restructuring production code "for testability" changes the thing being tested.
- Declare infeasible only with a concrete reason a human can evaluate ("output is subjective visual layout", "requires NDA hardware"). "Hard to test" is not infeasible.
- Every forged oracle is itself verified by an independent verifier run before the unit leaves the grey queue.
