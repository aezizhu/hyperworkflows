---
description: Re-verify a past HW report with zero LLM calls - re-runs every recorded evidence command and diffs exit codes
argument-hint: "[run-dir]"
---

Re-verify recorded evidence. Argument: `$ARGUMENTS` (a `runs/<run-id>` directory; default = the most recent run under `runs/`).

1. Run: `node ${CLAUDE_PLUGIN_ROOT}/scripts/recheck.mjs <run-dir> --cwd <repo-root>`
2. Report exactly what it prints, distilled:
   - All reproduce: "N/N evidence commands reproduce — the report still holds at HEAD <current head>." Note if HEAD differs from the report's recorded head (evidence can hold across commits; the note is context, not an alarm).
   - Drift: list each drifted command with recorded vs actual exit code, and say plainly which report claims are now stale. Recommend re-running `/hw:audit` scoped to the drifted units.
3. This command performs no fixes and spawns no agents — it is the falsifiability check (constitution C4). Its value is that anyone can run the same line without Claude and get the same answer.
