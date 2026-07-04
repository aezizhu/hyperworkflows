---
description: Manage the enforcement ladder (E0-E3) - status, CI gate installation, session enforcement level
argument-hint: "[status|ci|0|1|2]"
---

Manage Hyperworkflows enforcement. Argument: `$ARGUMENTS` (default: `status`). The ladder, briefly: E0 ambient brief (always) / E1 salience (constitutional injection + drumbeat) / E2 session gates (disclosure-mode Stop gate) / E3 CI evidence gate (absolute, model-independent).

**`status`**
Report, with evidence for each claim:
1. Resolved enforcement level: `HYPERWORKFLOWS_ENFORCE` env if set, else `.hyperworkflows/enforce` file, else 1 if the project shows Hyperworkflows markers (`.hyperworkflows/`, `memory/router.md`, `evidence/`) else 0.
2. E3: does `.github/workflows/hyperworkflows-verify.yml` exist? Does `.hyperworkflows/ci-verify.mjs` exist? Is there an `evidence/` root with runs? Suggest branch protection ("required status check") if the workflow exists but isn't required.
3. E2/E1 hook liveness caveat: hooks register at session start (platform property).

**`ci`** — install the E3 gate:
1. Create `.hyperworkflows/` if missing and copy `ci-verify.mjs`, `recheck.mjs`, `adjudicate.mjs` from `${CLAUDE_PLUGIN_ROOT}/scripts/`.
2. Copy `${CLAUDE_PLUGIN_ROOT}/templates/hyperworkflows-verify.yml` to `.github/workflows/hyperworkflows-verify.yml` (show a diff and ask if it already exists).
3. Explain the evidence convention: committed evidence lives in `evidence/<run-id>/verdicts/*.json`; audit/apply runs copy their verdicts there when the directory exists. `--require` makes evidence mandatory; removing it soft-starts.
4. Tell the human the one manual step you cannot do: mark the check as required in branch protection — that is what makes E3 absolute.

**`0` | `1` | `2`** — set the project's enforcement level:
1. Write the number to `.hyperworkflows/enforce` (create the directory if needed).
2. State plainly what changes at that level and that hook-driven behavior (drumbeat, Stop gate) takes effect from the **next** session.
3. Level 2 honesty note: the Stop gate is disclosure-mode — it never traps; an explicit UNVERIFIED disclosure always satisfies it. It bounces at most once per stop (platform `stop_hook_active` semantics).
