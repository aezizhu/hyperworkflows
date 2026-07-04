---
description: Initialize HW in this project - install workflow engines, blackboard directories, and memory baseline (idempotent)
---

Initialize Hyperworkflows in the current project. Be idempotent: report every step as CREATED, UPDATED, or ALREADY-PRESENT — never skip silently.

1. Verify this is a git repository (`git rev-parse --git-dir`). If not, stop and say HW requires git.
2. Create directories if missing: `.claude/workflows/`, `runs/`, `memory/candidates/`.
3. Copy the three workflow engines from `${CLAUDE_PLUGIN_ROOT}/workflows/` into `.claude/workflows/`:
   `hyperaudit.js`, `hyperapply.js`, `hw-sentinel.js`. If a destination file exists and differs, show a diff summary and ask before overwriting (the project may have local modifications).
4. Create `memory/router.md` if missing, with the header line:
   `# HW router - measured runs (formation | scope | units | agents | wall-clock | health)`
5. Create `memory/last-good.json` if missing, containing: `{"head": null, "date": null, "failures": []}`
6. Append `runs/` to `.gitignore` if not already ignored (run blackboards are local telemetry, not source).
7. Print a completion card listing: what was created/updated/already present, then EXACTLY these two next steps:
   - Restart this session (hooks activate next session — this is a platform property, not optional).
   - Run `/hw:doctor` to verify every platform assumption with evidence.

Do not run any workflow, audit, or other side effect during init.
