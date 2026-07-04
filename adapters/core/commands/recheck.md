Re-verify a past Hyperworkflows report with zero LLM judgment. Argument: a `runs/<run-id>` directory (default: the most recent under `runs/`).

1. Run: `node .hyperworkflows/recheck.mjs <run-dir>` — it re-executes every recorded evidence command and diffs actual vs recorded exit codes.
2. Report its output faithfully:
   - All reproduce: state "N/N evidence commands reproduce; the report still holds", noting if HEAD moved since the report was written.
   - Drift: list each drifted command with recorded vs actual exit codes and say plainly which report claims are now stale; recommend a re-audit scoped to the drifted units.
3. Perform no fixes and make no judgment calls beyond relaying the script's result — this command exists so the report can be falsified by anyone, with or without an AI.
