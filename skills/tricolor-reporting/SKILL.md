---
name: tricolor-reporting
description: Use when rendering any HW result to a human - the mandatory report format with verified/unverified/quarantined+grey buckets, coverage arithmetic, and evidence links.
---

# Tricolor Reporting

Every HW deliverable is a tricolor report. No other final format exists.

**The three buckets (constitution C4):**
1. **VERIFIED** — machine-adjudicated green. Each item links its `verdicts/*.json` (raw exit codes) and states its depth (D0 acceptance / D1 attack-survived / D2 mutation-hardened / D3 differential / D4 bench-clean).
2. **DONE-UNVERIFIED** — produced but not machine-verified (no oracle reachable, verification skipped with a logged reason). Never counted as verified. Say why, per item.
3. **QUARANTINED + GREY** — failed units with their failure signature and last failing command; grey units with their `infeasible_reason`.

**Hard rules:**
- Coverage arithmetic is shown: `verified / total`, with grey and quarantined counted in `total`. A denominator that silently shrinks is lying.
- A failed unit is NEVER aggregated into a success count. A red suite is never "mostly passing".
- Every claim a human might act on carries its evidence path. The footer always includes the one-line recheck command and the model-family residual-risk note.
- Plain language for failures: the concrete failing command and exit code, what it means, and what the human can do next — never internal jargon.
- Timestamps in Asia/Singapore.
