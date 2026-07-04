---
description: Troubleshooting - verify Hyperworkflows platform assumptions with evidence (never required for onboarding)
---

This is a diagnostic, NOT an onboarding step — Hyperworkflows works with zero setup. Run it when something misbehaves, or when the user wants evidence that everything is wired before a large fleet run.

Run the Hyperworkflows assumption register end-to-end and write a machine-readable report. Every check produces PASS, FAIL, or DEGRADED(fallback engaged) — with the observed evidence, never an unchecked claim.

Create `runs/doctor-<yyyymmdd-HHmm>/report.md` and check:

1. **Workflow runtime (A1/A2)**: launch a minimal dynamic workflow (two `agent()` calls, one `parallel`, one schema). Confirm `agentType` works with fully-qualified names (`hyperworkflows:hyperworkflows-<role>` — verified 2026-07-04; bare names error out), and that `isolation: worktree` and `model` are honored. Any regression from this baseline is a FAIL, not a shrug.
2. **Engine availability (W1)**: confirm the plugin-shipped engines are reachable — the `hyperaudit`/`hyperapply`/`hypersentinel` workflows registered by this plugin, with `${CLAUDE_PLUGIN_ROOT}/workflows/*.js` readable as the dynamic fallback. Note any project-local `.claude/workflows/` overrides and whether they diverge from the plugin versions.
3. **Agent roster (A8)**: confirm all 14 `hyperworkflows-*` agents are visible. Spawn `hyperworkflows-verifier` and instruct it to attempt a file write via Edit — the attempt MUST be denied (its tools are Bash+Read). A verifier that can write is a FAIL, not a warning.
4. **Hooks (A5)**: run `git push --force-with-lease origin nonexistent-branch-hyperworkflows-probe` via Bash and confirm the guard blocks it (exit 2 feedback). If it does not block: the likely cause is that the plugin was installed during THIS session — hooks register at session start (platform property, applies to every plugin). Say plainly that the deny wall activates from the next session, and that this is the ONLY situation with a restart involved.
5. **Worktrees (P4)**: spawn a subagent with `isolation: worktree`, have it `git rev-parse --show-toplevel`, confirm the path differs from the main worktree.
6. **Agent teams (P5)**: check `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env. If unset, mark court mode DEGRADED(sequential fallback) — this is fine, say so without alarm.
7. **Models (A9)**: attempt spawns with model sonnet/opus/haiku; record which resolve.
8. **Zero-LLM tooling**: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/adjudicate.mjs adjudicate '{"probes":[{"cmd":"true","expect_exit":0}],"exit_codes":[{"cmd":"true","exit":0}]}'` and confirm `pass: true`.

Finish with a verdict card: overall READY / NOT-READY, the list of DEGRADED capabilities with their engaged fallbacks, and the exact blocking items if NOT-READY.
