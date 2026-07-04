---
description: Iterative audit-fix rounds until clean or plateau - confirmed findings must shrink monotonically, measured by fingerprints
argument-hint: "[scope] [max_rounds]"
---

Run audit → approve → apply → re-audit rounds until the scope is clean or progress plateaus. Arguments: `$ARGUMENTS` (optional scope; optional max_rounds, default 4). The human gate is NEVER skipped — this loop automates the cycle, not the approval.

**Per round R1, R2, ... (up to max_rounds):**
1. Run the full `/hyperworkflows:audit` flow on the scope at the current head. Record the round's confirmed-finding set as fingerprints (unit + repro command hash) — fingerprints, not counts, so a "fixed one, introduced one" round cannot masquerade as progress.
2. Zero confirmed findings → render the final progression card and stop: **CLEAN at R<n>**.
3. Otherwise present the decision request; the human approves fixes (or stops the loop — that is always an acceptable answer).
4. Run the `/hyperworkflows:apply` flow on the approved plan. Quarantined groups carry into the next round's expectations — they are not silently retried.
5. Re-audit happens as the next round, at the new head.

**Plateau detection (stop early, say so plainly):**
- The fingerprint set fails to shrink strictly between two consecutive rounds → **PLATEAU**: stop, report which findings survived every attempt, and recommend escalation (`/hyperworkflows:court` for contested ones, N=5 critical tournament for stuck groups, or human intervention).
- The same finding fingerprint reappears after being fixed in an earlier round → flag it as a REGRESSION-LOOP finding with both rounds' evidence; these are prioritized in the plateau report.

**Final card (always, whatever the exit reason):**
- Round progression with measured numbers: `R1: 14 confirmed → R2: 5 → R3: 1 → R4: 1 (PLATEAU)`.
- Tricolor state of the final round + evidence paths for every round (`runs/audit-<head>/`, one per round — rounds are separate runs stitched by this card).
- Wall-clock per round, from run journals. Asia/Singapore timestamps.

Cache note: each round runs at a new head, so prefix caches naturally invalidate only where the code actually changed — unchanged units replay from cache and cost nothing.
