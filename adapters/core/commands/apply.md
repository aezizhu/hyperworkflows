Deliver an approved change plan with HW discipline. Follow `.hw/hw-rules.md` strictly.

1. Confirm the plan is human-approved; if not, show a summary and ask first. `head=$(git rev-parse --short HEAD)`; `run_id=hw-apply-<head>`; create `runs/<run_id>/verdicts/`.
2. Group changes by shared files; order groups so that file-sharing groups never proceed concurrently. Identify the FULL suite commands `{cmd, expect_exit}` — if none exist, stop and say merges cannot be gated.
3. Per group: implement to the contract; run every acceptance command; adjudicate via `node .hw/adjudicate.mjs adjudicate '<json>'`. On failure, repair and RE-VERIFY after every repair — never conclude from a stale run. Stop repairing when the same failure signature (`node .hw/adjudicate.mjs signature '<json>'`) repeats twice (STUCK) or after 8 rounds without a stable signature (FLAKY-ORACLE — the test is the bug; fix the oracle, not the code).
4. After each group lands: run the FULL suite, adjudicate, and record the exit codes in the group's verdict file. A red suite means revert that group immediately and quarantine it with evidence — never continue on red.
5. Finish with a tricolor report: DELIVERED-VERIFIED (suite exit codes) / QUARANTINED (signature + last failing commands, with what the human can do next) / NOT-ATTEMPTED. Include the recheck footer. A quarantined group is never counted as delivered.
