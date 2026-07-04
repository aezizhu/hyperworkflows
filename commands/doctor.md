---
description: Verify every HW platform assumption with evidence - workflows, agents, hooks, worktrees, teams, models
---

Run the HW assumption register end-to-end and write a machine-readable report. Every check produces PASS, FAIL, or DEGRADED(fallback engaged) — with the observed evidence, never an unchecked claim.

Create `runs/doctor-<yyyymmdd-HHmm>/report.md` and check:

1. **Workflow runtime (A1/A2)**: launch a minimal dynamic workflow (two `agent()` calls, one `parallel`, one schema). Record whether `agentType`, `isolation`, and `model` options are honored (open questions W2/W3 — report what actually happened).
2. **Named workflow loading (W1)**: check `.claude/workflows/hyperaudit.js` exists and is invocable by name. If plugin-shipped workflows loaded without copying, note the fallback is unnecessary.
3. **Agent roster (A8)**: confirm all 14 `hw-*` agents are visible. Spawn `hw-verifier` and instruct it to attempt a file write via Edit — the attempt MUST be denied (its tools are Bash+Read). A verifier that can write is a FAIL, not a warning.
4. **Hooks (A5)**: run `git push --force-with-lease origin nonexistent-branch-hw-probe` via Bash and confirm the guard blocks it (exit 2 feedback). If it does not block, say plainly: hooks are not active — restart the session; protection is NOT installed until this check passes.
5. **Worktrees (P4)**: spawn a subagent with `isolation: worktree`, have it `git rev-parse --show-toplevel`, confirm the path differs from the main worktree.
6. **Agent teams (P5)**: check `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` env. If unset, mark court mode DEGRADED(sequential fallback) — this is fine, say so without alarm.
7. **Models (A9)**: attempt spawns with model sonnet/opus/haiku; record which resolve.
8. **Zero-LLM tooling**: run `node ${CLAUDE_PLUGIN_ROOT}/scripts/adjudicate.mjs adjudicate '{"probes":[{"cmd":"true","expect_exit":0}],"exit_codes":[{"cmd":"true","exit":0}]}'` and confirm `pass: true`.

Finish with a verdict card: overall READY / NOT-READY, the list of DEGRADED capabilities with their engaged fallbacks, and the exact blocking items if NOT-READY.
