---
name: merge-discipline
description: Use during any HW delivery merge phase - single-merger protocol, MERGE_TOKEN lifecycle, full-suite gating, and revert-and-quarantine rules.
---

# Merge Discipline

Parallel building, serial merging. One merger, one group at a time, every merge proven.

**Protocol per group:**
1. Create `runs/<run-id>/MERGE_TOKEN` (the PreToolUse guard blocks merge/push without it while a run is active).
2. Merge the tournament winner's branch into the integration branch.
3. Run the FULL suite — not the group's acceptance, the whole thing. Record exit codes.
4. Green → record verdict file with suite exit codes as probes; remove MERGE_TOKEN; next group.
5. Red → revert the merge IMMEDIATELY; mark the group QUARANTINED with the failing exit codes; remove MERGE_TOKEN; continue with the next group. Never proceed on a red integration branch.

**Rules:**
- "The failure was pre-existing" requires proof: re-run the suite on the pre-merge commit and show it red there too. No evidence, no excuse.
- Mechanical conflicts (non-overlapping hunks) may be resolved and noted. Semantic conflicts are STUCK — report, never guess.
- Topological levels merge in order; groups within a level merge serially in group-id order (deterministic, resumable).
- A leftover MERGE_TOKEN after the phase is a bug — surface it, never silently delete it outside the protocol.
- Remote pushes only when the run's instructions explicitly authorize them.
