---
description: One-surface progress digest - active run, ledger counts, throughput, ETA with arithmetic shown
---

Render the Hyperworkflows progress surface. Read-only; never mutates run state.

1. Active run: if `runs/ACTIVE` exists, read the run id; check `/workflows` panel state for it if available.
2. From `runs/<active>/events.jsonl` and `verdicts/`: units adjudicated / total planned, events in the last 10 minutes (measured rate), and ETA computed as remaining ÷ measured rate — SHOW the arithmetic (e.g. "142 remaining ÷ 3.2 units/min ≈ 44 min"), Asia/Singapore timestamps. The journal carries both SubagentStart and SubagentStop events: pair them by id to show IN-FLIGHT agents (started, not yet stopped) with their age — a 20-minute in-flight oracle-smith is information, not silence.
3. Integrity warnings (each is actionable, plain language):
   - `runs/ACTIVE` exists but no event in >30 min → "run may be stalled or ACTIVE is stale; check /workflows, or remove runs/ACTIVE if nothing is running."
   - A `MERGE_TOKEN` exists with no active merge phase → "leftover merge token blocks nothing but indicates an interrupted merge — investigate before merging."
   - A project-local `.claude/workflows/` engine override exists whose hash changed mid-run (or diverges from `${CLAUDE_PLUGIN_ROOT}/workflows/`) → "engine changed mid-run: the prefix cache for this run is invalid; finish or restart the run."
4. If no active run: show the last completed run's tricolor one-liner, sentinel baseline age, and the router table's last 3 measured entries.
