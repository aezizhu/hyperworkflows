Run an HW evidence-grade audit of the given scope (default: files changed vs the default branch; else repo root). Follow `.hw/hw-rules.md` strictly.

1. `head=$(git rev-parse --short HEAD)`; `run_id=hw-audit-<head>`; create `runs/<run_id>/verdicts/`.
2. Enumerate the scope TWO independent ways (filesystem walk via `git ls-files`, plus a symbol/build-graph pass). Reconcile with `node .hw/adjudicate.mjs reconcile '<json>'`; resolve or explicitly report every disputed path. State the final denominator and method.
3. For each unit, record acceptance contracts `{cmd, expect_exit}`. Units without oracles: forge one per the oracle-forging preference order (test-only changes); truly infeasible units are grey with `infeasible_reason`.
4. Attack the contracts before the code: list missing acceptance dimensions (perf, security, concurrency, boundaries, error paths) with executable proposed commands; add them to the contracts.
5. Audit every non-grey unit for real defects. Every finding MUST carry `evidence_cmd` + `evidence_expect_exit` (exits that value IF the defect is real). No command, no finding.
6. Execute all probes (acceptance + finding evidence), capture raw exit codes, and adjudicate ONLY via `node .hw/adjudicate.mjs adjudicate '<json>'`. Write one canonical verdict file per unit under `runs/<run_id>/verdicts/`.
7. Write `runs/<run_id>/report.md` as a tricolor report with coverage arithmetic, confirmed findings (each with its repro), grey list, and the recheck footer.
8. If confirmed findings exist, end by listing proposed fixes and ask which to approve — do not start fixing without approval.
