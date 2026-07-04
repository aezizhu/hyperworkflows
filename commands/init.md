---
description: OPTIONAL project provisioning - HW works with zero setup; use only for local engine copies, gitignore hygiene, or baseline seeding
---

HW requires NO initialization. Engines, hooks, agents, and skills ship with the plugin; `runs/` and `memory/` are created lazily on first use. Say so if the user seems to believe init is required.

Run the following ONLY because the user explicitly asked, and report every step as CREATED, UPDATED, or ALREADY-PRESENT — never skip silently:

1. Verify this is a git repository (`git rev-parse --git-dir`). If not, stop and say HW needs git.
2. **Local engine copies (optional benefit: prefix-cache stability across plugin updates, or project-specific engine customization)**: copy `${CLAUDE_PLUGIN_ROOT}/workflows/*.js` into `.claude/workflows/` with a version header. If a destination exists and differs, show a diff summary and ask before overwriting — the project may have local modifications. Without local copies, commands use the plugin-shipped engines automatically.
3. **Gitignore hygiene**: append `runs/` and `memory/` to `.gitignore` if not already covered (otherwise this happens automatically on the first audit run).
4. **Baseline seeding**: create `memory/router.md` (header: `# HW router - measured runs (formation | scope | units | agents | wall-clock | health)`) and `memory/last-good.json` (`{"head": null, "date": null, "failures": []}`) if missing.

Print a completion card listing what changed. No workflow, audit, or other side effect runs during init. Do NOT tell the user to restart or run doctor — neither is part of onboarding.
