# Hyperworkflows Enforcement Analysis: Should Hyperworkflows Force-Load Like Superpowers?

**Date**: 2026-07-04 (Asia/Singapore)
**Status**: approved and implemented (v0.6.0) — E3 CI gate, E1 salience, E2 disclosure-mode Stop gate; E0 shipped earlier
**Question**: make Hyperworkflows unconditionally active in Claude Code sessions, the way Superpowers injects its methodology into every session?

---

## 0. Verdict

Yes — but not by copying Superpowers. Copying it would import its weakness (prompt exhortation that decays) while ignoring Hyperworkflows's unique advantage. The deep point this analysis develops:

> **Superpowers' rules are prose, so the strongest thing it can do is *preach* at session start. Hyperworkflows's constitution is machine-checkable (verdict files, exit codes), so Hyperworkflows can *gate*. Forcing Hyperworkflows correctly makes it the first methodology plugin whose compliance is boolean rather than vibes.**

The correct architecture is a 4-level enforcement ladder (E0–E3) where the editor-side "force" everyone thinks of first is actually the *weakest* level, and the absolute level lives outside the editor entirely.

---

## 1. "Force" decomposes into two different problems

People say "force the model to follow the rules" as if it were one thing. It is two:

| | Salience maintenance | Behavioral gating |
|---|---|---|
| Problem | Rules fall out of the model's attention | Model acts against rules even when aware |
| Mechanism | Inject text into context | Block the action / bounce the turn |
| Decays with context length? | **Yes** — this is the killer | No |
| Can be cheated? | N/A (it's advice) | Only if the check isn't executable |
| Superpowers | This is ~all it does (SessionStart bootstrap) | Cannot — its rules ("brainstorm first", "use TDD") are not machine-checkable |
| Hyperworkflows | Already has a <50-line brief | **Uniquely possible** — "verified" has an executable definition |

Superpowers' real lesson is not its mechanism (a SessionStart hook is trivial). It is: **defaults beat willpower.** Discipline that must be remembered is applied exactly when someone thinks of it — which, by adverse selection, is least often under deadline pressure, precisely when defect rates peak. Forcing flips the default. That lesson we should absolutely take.

## 2. Complete coercion-channel inventory (Claude Code, verified against hook docs)

| Channel | Cadence | Hardness | Notes |
|---|---|---|---|
| SessionStart hook stdout | Once per start/resume/**compact** | Soft | Re-fires on compaction — the free antidote to "my rules got compacted away" |
| UserPromptSubmit hook | Every user turn | Soft (inject) or hard (exit 2 blocks the prompt) | Per-turn drumbeat: 1–2 lines near the context tail have far higher salience than 200k-token-old preamble |
| PreToolUse (exit 2) | Every tool call | **Hard** | Already used: deny wall, MERGE_TOKEN |
| PostToolUse | After tool results | Soft | Contextual nudges: after a test-running Bash call, remind "adjudicate via script, don't eyeball" |
| **Stop hook (exit 2)** | When the model tries to end its turn | **Hard** | The most powerful editor-side gate: can refuse to let a turn end. Also the most dangerous (loops, rage-quits) |
| TaskCompleted / TeammateIdle | Teams mode | Hard | Already used (court evidence gate) |
| Skill auto-trigger descriptions | Model-decided | Soft | Already shipped |
| CI status check on PR | Per push/PR | **Absolute** | Cannot be talked out of, ignored, or forgotten by any model; see §6 |

## 3. The decay problem (why Superpowers-style injection alone fails)

A session-start mandate has three independent decay paths: (a) long sessions push it thousands of tokens back, and attention to policy text loses to task text; (b) compaction summarizes it lossily (mitigated: SessionStart re-fires on compact); (c) "MUST" fatigue — models down-weight boilerplate imperatives they've seen produce no consequences.

Mitigation ladder, cheapest first:
1. **Re-injection on compact** — free, already supported by the platform.
2. **UserPromptSubmit drumbeat** — inject ONE line per turn, only in Hyperworkflows-initialized projects, only when the prompt looks like task work: `Hyperworkflows active: verification claims require script verdicts (runs/<id>/verdicts/); deliverables are tricolor.` Cost ≈ 20 tokens/turn. Recency beats volume.
3. **PostToolUse targeted nudges** — fire only on matching tool patterns (test commands, Edit on source files). Contextual reminders outperform ambient ones.
4. **Stop-gate** — needs zero salience at all; see §4.

Anti-goal: injecting the whole constitution every turn. Every injected line competes with task context; fat mandates are self-defeating. Cap ambient text ruthlessly (E1 ≤ 30 lines, drumbeat ≤ 2 lines).

## 4. The hard gate, designed honestly (the subtle part)

Naive version: "Stop hook: if no verdict files exist, exit 2 — force verification." **This is wrong**, and wrong in an instructive way.

False-positive economics: the naive gate misfires on Q&A, brainstorming, planning, emergencies ("just tell me what's broken"). Misfires → user disables hooks → enforcement drops to zero. A gate's real-world strength = hardness × survival probability.

The fix comes from Hyperworkflows's own constitution. C4 never demands that everything be verified — it demands that **nothing unverified be presented as verified**. So the correct gate gates *honesty*, not *verification*:

> **Disclosure-mode Stop gate**: IF this session mutated files (breadcrumb written by a PostToolUse sensor on Edit/Write/mutating Bash) AND no verdict file was produced AND the final message contains no explicit `UNVERIFIED` disclosure → exit 2 once: "You changed files without machine verification. Either verify (run acceptance, adjudicate via `node .hyperworkflows/adjudicate.mjs`) or say plainly the work is UNVERIFIED — then finish."

Properties:
- Q&A/planning sessions never trip it (no mutations → no gate).
- The model always has a legal exit (disclose honestly) — no infinite loops. One-bounce semantics: the bounce writes a marker; a second Stop always passes. The gate cannot trap, only make dishonesty more work than honesty.
- **Reward-hacking counter**: a gate creates the incentive to fabricate verdict files. Because Hyperworkflows verdicts are executable, fabrication is *detectable*: the gate (cheap mode) validates schema + cross-checks the events journal; CI (E3) re-executes everything via `recheck.mjs`. Superpowers-class rules cannot do this at all — a model can claim "I brainstormed first" and nothing can check it. This asymmetry is the whole reason forcing Hyperworkflows is worth more than forcing any prose methodology.

## 5. Consent architecture (who chose this?)

Blanket coercion across all of a user's projects is how plugins earn uninstalls. Scoping:

- **Project opt-in**: enforcement keys off `.hyperworkflows/` presence (created by `/hw:init`) — the project owner chose Hyperworkflows.
- **Levels**: `HYPERWORKFLOWS_ENFORCE=0` (ambient only) / `1` (salience: constitutional injection + drumbeat) / `2` (adds disclosure-mode Stop gate). Default for initialized projects: 1. Teams that want 2 set it in project settings — that's the enterprise buyer's feature, individuals keep gentler defaults.
- Never write to the user's CLAUDE.md (their file, their voice).
- Document plainly: hooks activate next session; a user can always delete hooks — editor-side force is ultimately advisory. Which leads to:

## 6. The real force is not in the editor

Any session-side enforcement can be bypassed by a determined user or a confused model (disable hooks, edit files, fresh session). The only non-bypassable gate is server-side:

> **E3: a CI job on every PR runs `recheck.mjs` against committed run directories and checks verdict presence/schema for changed units; branch protection makes it a required status.**

- Model-independent and **tool-independent**: the same CI gate enforces Hyperworkflows discipline for all 17 adapted tools (Cursor, Copilot, Gemini, Windsurf...). Editor-side force must be re-implemented per tool; CI-side force is written once and catches everything, including humans.
- This inverts the original question: "can we force Claude Code to load Hyperworkflows" is the weakest link in the chain. Force the *artifact* (the PR must carry reproducible evidence), and every agent that wants to merge — any brand, any harness — must comply.

## 7. The enforcement ladder (proposed final architecture)

| Level | Scope | Mechanism | Hardness |
|---|---|---|---|
| **E0 Ambient** | All sessions | Current <50-line brief (unchanged) | Soft |
| **E1 Salience** | Hyperworkflows-initialized projects | Constitutional injection (≤30 lines) at SessionStart + compact; 1-line UserPromptSubmit drumbeat; targeted PostToolUse nudges | Soft, decay-resistant |
| **E2 Session gates** | Initialized + `HYPERWORKFLOWS_ENFORCE>=2` | Disclosure-mode Stop gate (one-bounce); existing PreToolUse deny wall + MERGE_TOKEN; optional "no push without green recheck" | Hard, survivable |
| **E3 Repo absolute** | The repository itself | CI recheck + verdict-presence as required PR status | Absolute, universal across all tools |

Escape hatches (deliberate): `HYPERWORKFLOWS_ENFORCE=0`; the Stop gate always accepts an honest UNVERIFIED disclosure; per-run override file for emergencies (logged, C5).

## 8. Red-team of this proposal

| Failure mode | Counter |
|---|---|
| Stop-gate loop | One-bounce marker; disclosure always legal |
| Fabricated verdict files | Schema + journal cross-check at E2; full re-execution at E3 |
| Context bloat resentment | Hard line caps (E1 ≤ 30, drumbeat ≤ 2); E0 unchanged |
| Gate misfires on non-code work | Mutation-breadcrumb precondition; Q&A never gated |
| Multi-plugin Stop-hook pileup | Short idempotent messages; bail out if another gate already bounced |
| Hook next-session latency | Already doctrine: doctor verifies, claims labeled |
| User uninstalls in anger | Consent scoping (§5); E3 doesn't care |

## 9. Recommendation & build order

Do it. Build order (each step independently shippable):
1. **E3 first** — `hyperworkflows-verify.yml` GitHub Action + docs. Highest force-per-effort, zero session-side risk, universal across tools.
2. **E1** — upgrade session-brief to two-tier (ambient/constitutional), add drumbeat + nudges.
3. **E2** — mutation-breadcrumb sensor + disclosure-mode Stop gate behind `HYPERWORKFLOWS_ENFORCE=2`, with tests for: no-mutation pass, bounce-once, disclosure pass, fabricated-verdict detection.
4. Measure: spot-check health metric (already in design) becomes the gate's calibration loop.
