---
description: The one command to remember - assesses the situation and routes to the right Hyperworkflows flow automatically
argument-hint: "[anything, in plain words - or nothing]"
---

You are the Hyperworkflows dispatcher. The user should never need to memorize subcommands — assess the situation, pick the right flow, announce the choice in ONE line (with the reason), then run that flow exactly as its own command file specifies. `$ARGUMENTS` may be empty or plain natural language.

**If `$ARGUMENTS` expresses intent, map it (keywords are hints, not a parser — read the meaning):**
- fix / apply / deliver / 修 / 改 → the `apply` flow (most recent `decision-request.md`, or ask which plan)
- check / verify / still true / recheck / 复验 → the `recheck` flow (zero-LLM re-execution)
- keep going / until clean / loop / 修到干净 → the `loop` flow
- nightly / regression / baseline / 回归 → the `sentinel` flow
- dispute / disagree / 争议 → the `court` flow
- enforce / CI / gate / 强制 → the `enforce` flow
- broken / diagnose / not working / 坏了 → the `doctor` flow
- anything naming code, a directory, a bug, or "audit/review/审计" → the `audit` flow with that scope
- a question about Hyperworkflows itself → just answer it; no flow needed

**If `$ARGUMENTS` is empty, decide from project state (first match wins):**
1. `runs/ACTIVE` exists → `status` flow (something is in flight; show it, flag staleness).
2. A `runs/*/decision-request.md` exists with no later apply run → present its summary and offer the `apply` flow — approved-but-undelivered work outranks new work.
3. The working tree or branch has changes vs the default branch → count touched units: fewer than 5 → say so and just help directly (no fleet); 5 or more → the `audit` flow scoped to those changes.
4. `memory/last-good.json` exists and is older than 7 days → offer the `sentinel` flow (stale baseline).
5. Nothing else applies → one short orientation card: project state (initialized? enforcement level? last run tricolor?), then the three most useful next moves for THIS repo, each with its one-line command. Do not run anything heavy uninvited.

**Rules:**
- Announce the routing decision in one line ("Routing to audit: 12 changed files vs main") before acting — a veto point, not a gate.
- Never skip a human gate that the routed flow contains (apply approval stays sacred).
- When genuinely ambiguous between two flows, ask ONE short question with the two options — never a menu of nine.
