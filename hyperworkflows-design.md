# Hyperworkflows: A Maximal-Capability Multi-Agent Operating Architecture for Claude Code

**Version**: 1.0
**Date**: 2026-07-04 (Asia/Singapore)
**Companion document**: `plugin-design.md` (packaging of this architecture as the `hyperworkflows` Claude Code plugin)

---

## 0. Assumption Register

Load-bearing assumptions must be explicit; any mechanism sitting on an unverified assumption cannot itself carry a "verified" label. Each row is checked during ignition step 0 (§6).

| # | Claim | Source | Verification method | Blast radius |
|---|-------|--------|---------------------|--------------|
| A1 | Dynamic workflow API: `workflow / agent / pipeline / parallel / phase / log / args / budget` | Official docs | Run a minimal 3-agent workflow | All skeletons (§5) |
| A2 | `agent()` supports `schema / label / model / effort`; subagent definitions support `tools / disallowedTools / maxTurns / isolation: worktree / memory / background` | Official docs | Exercise each parameter once | Role gradient (§3) |
| A3 | Prefix-cache resume: rerunning an unchanged workflow replays cached `agent()` prefixes | Official docs + community analysis | Rerun same args twice, compare token metering | §4.7 |
| A4 | Concurrency cap ≈16 parallel subagents; large runs are throttled, not failed | Official docs | Shard a 100-thunk `parallel()` and observe | Wall-clock planning only, never correctness |
| A5 | Hooks: `PreToolUse` (exit 2 blocks), `SessionStart`, `SubagentStop`, `TaskCreated/TaskCompleted/TeammateIdle`; config changes take effect next session | Official docs | Restart and re-test the deny wall | Policy plane (L1) |
| A6 | Subagents cannot call AskUserQuestion; all human approval converges on the main session | Official docs | Have a subagent attempt it | Human plane (L0) |
| A7 | Agent teams are experimental (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`): volatile, no resume; teammates honor agent-definition tools/model; `SendMessage` between agents | Official docs | Probe with flag set | Court discipline (§3.2) |
| A8 | Frontmatter `tools` allowlists are enforced per agent | Official docs | Verifier attempts a write; must be denied | Permission gradient |
| A9 | Model pool is single-family (`haiku/sonnet/opus/fable`) — no cross-vendor diversity inside the harness | Official docs | Enumerate available models at ignition | Residual risk R3 (§7): correlated blind spots |
| A10 | `budget` exists as a script-readable number | Official docs | n/a | This design does **not** use budget gates; the only stops are correctness-based (§4.5) |

---

## 1. Objective Function & Constitution

### 1.1 From economics to maximalism

The design question is not "is orchestration worth the tokens?" — tokens are purchasable. Correctness and completeness are not. Only three things remain genuinely scarce:

1. **Oracle ground truth.** Executable acceptance commands are the only hard currency. In domains without oracles, more agents produce mutual persuasion, not truth.
2. **Human judgment signal.** Every human touchpoint must carry information a machine cannot produce — intent, taste, authorization for external side effects — never ferry confirmations.
3. **Serial wall-clock.** With a ~16-agent concurrency cap (A4), thousand-agent campaigns take hours. Parallelism and sharding are wall-clock engineering, not a spending question.

**The naive-maximalism trap** (this design's anti-pattern): throwing a hundred agents at one repository produces merge conflicts, not quality; letting ten LLMs deliberate produces rhetorical convergence, not truth. Maximalism must be disciplined by **adjudication structure** — all redundancy grows on a skeleton of *independent production + machine adjudication*. Multi-way outputs are always selected by deterministic script logic over exit codes and measurable criteria, never by LLM committee vote.

In one line: **discipline converts unlimited spend into trustworthiness.**

### 1.2 Constitution (C1–C8, non-negotiable)

- **C1 — Contract-first, with an oracle-forging duty.** Every unit of work enters the pipeline with executable acceptance `{cmd, expect_exit}`. A missing oracle is not a label; it is a **work item**: an oracle-smith attempts to forge one (golden files, property tests, metamorphic relations, snapshots). Only units where forging is demonstrably infeasible stay grey, and they carry an `infeasible_reason`.
- **C2 — Exit codes rule; verdicts are computed in script.** Every verdict (CONFIRMED / REJECTED / PASS / FAIL) is produced by a deterministic script function comparing `exit == expect`. No LLM — including the verifier itself — ever emits a verdict field. Verifier schemas contain raw exit codes only, making the violation structurally impossible.
- **C3 — Cognitive independence.** A verifier's input is commands plus a repository path — never the producer's reasoning. N-version producers are mutually blind (prompts never reference each other). Attackers attack products that are not their own.
- **C4 — Tricolor finality with an evidence chain.** Every deliverable is a tricolor report — verified / done-but-unverified / quarantined+grey — and every "verified" item links to a `verdicts/*.json` record holding the raw exit codes. Reports are machine-recheckable (§4.10).
- **C5 — Zero silent truncation.** Sampling is abolished; full coverage is the default. Therefore any skip or degradation is an incident-grade event: logged, disclosed in the report, and traceable to an assumption-register row.
- **C6 — Judges consume distilled sets only (signal purity).** Courts and tournament judges receive the distilled contested set, never raw corpus. The rationale is accuracy, not cost: flooding a judge's context dilutes judgment. This clause survives unlimited budgets.
- **C7 — Redundant cognition on critical paths.** No single-point cognition where an error poisons the denominator: enumeration runs three independent ways, planning runs two, contracts face a dedicated spec-attack. Redundant outputs are reconciled by deterministic script, never by LLM vote (see 1.1).
- **C8 — Verification depth ladder.** An exit code is the floor, not the ceiling. Every "green" is labeled with the depth it reached:
  - **D0** acceptance green (all acceptance commands pass)
  - **D1** attack-survived (every adversarial repro machine-adjudicated as REJECTED)
  - **D2** mutation-hardened (mutation-testing score over the touched code meets threshold — proves the tests themselves are real; the structural counter to verification theater)
  - **D3** differential-agreed (N versions agree on a generated input corpus)
  - **D4** benchmark-clean (no performance regression vs baseline)
  Reports aggregate the minimum depth per unit; "all green" always states *which* green.

---

## 2. Overall Architecture

Six planes plus a persistent layer. Control flow sinks downward; disputes and decision requests bubble upward; human attention only ever consumes distilled, high-density cards.

```
            ┌────────────────────────────────────────────────────────┐
            │ L0 HUMAN PLANE (main session = the only console)        │
            │ Four card types: initiation card | AskUserQuestion      │
            │ decisions (intent/taste/authorization) | milestones     │
            │ (measured numbers) | verdict cards (tricolor+evidence)  │
            └──────┬─────────────────────────────────▲────────────────┘
                   │ formation selection (§4.1)      │ disputes / intent requests
        ┌──────────┼──────────────┐                  │
        ▼          ▼              ▼                  │
     T0 solo    T1 subagents   T2/T3 orchestration ──┘
   (single bug/ (≤4 independent
    diagnosis)   side tasks)
   ┌────────────────────────────────────────────────────────────────┐
   │ L1 POLICY PLANE (harness-enforced, never model goodwill)        │
   │ SessionStart: formation table + <50-line asset index injected   │
   │ PreToolUse (exit 2): global deny wall for dangerous commands    │
   │ agents/*.md tool allowlists = permission gradient               │
   │ TaskCompleted (exit 2): no evidence file, no completion         │
   └────────────────────────────────────────────────────────────────┘
   ┌────────────────────────────────────────────────────────────────┐
   │ L2 EVIDENCE PLANE (full-coverage evidence factory + firewall)   │
   │ 3-way enumeration → script reconciliation (hard gate)           │
   │ → oracle forging → spec-attack                                  │
   │ → 100% analyze+attack+verify (no sampling)                      │
   │ → crosscut sweep → deterministic reduce                         │
   └───────┬───────────────────────────────────────┬────────────────┘
           │ CONTESTED set (distilled)              │ approved change plan
           ▼                                       ▼
   ┌─────────────────────────┐  ┌─────────────────────────────────────┐
   │ L3 ADJUDICATION PLANE    │  │ L4 DELIVERY PLANE                    │
   │ script adjudicator (C2,  │  │ N-version mutually-blind builders    │
   │ zero LLM) | courts on    │  │ → fixpoint repair → deterministic    │
   │ demand (volatile) |      │  │ winner selection (C8 ladder)         │
   │ design tournaments for   │  │ → single merger, serial merges,      │
   │ greenfield decisions     │  │ full suite after every merge         │
   └─────────────────────────┘  └─────────────────────────────────────┘
   ┌────────────────────────────────────────────────────────────────┐
   │ L5 TIME PLANE (sentinel: merge / nightly 02:30 SGT / weekly)    │
   │ deep campaigns: mutation+fuzz+deps+bench | new regression →     │
   │ auto-bisect to culprit commit | ratchet: named workflows +      │
   │ measured stats → router | weekly full asset regression          │
   └────────────────────────────────────────────────────────────────┘
   ┌────────────────────────────────────────────────────────────────┐
   │ PERSISTENT LAYER: runs/<id>/{plan.json, events.jsonl,           │
   │ verdicts/*.json, ledger.jsonl} — files are ground truth,        │
   │ context is cache; events.jsonl is an append-only line journal   │
   │ (O_APPEND line-atomic, exempt from single-writer); every other  │
   │ file has exactly one writer, recorded in plan.json              │
   └────────────────────────────────────────────────────────────────┘
```

### Primitive responsibility boundaries

| Primitive | Owns | Never owns |
|---|---|---|
| **Main session** | Formation selection, initiation cards, all AskUserQuestion decisions (A6 makes approval converge here by construction), verdict-card rendering, direct adjudication of ≤3 contested items | Bulk data processing, raw-corpus reading |
| **Workflow** | Every fan-out beyond ~3 agents; deterministic control flow, schema enforcement, resume; **all verdict computation** (C2) | Judgments needing mid-run human input (split at the human gate instead), taste calls |
| **Subagent** | Single-shot data-plane workers (14 roles, §3.1); code-writing roles always run `isolation: worktree`; resident experts (cartographer) kept warm across turns via `SendMessage` | Asking the user anything, approvals |
| **Agent teams** | Adjudication courts, design tournaments, multi-hour sign-off shells — created on demand, never resident, treated as volatile, every ruling flushed to disk immediately | Resident control planes, bulk execution |
| **Hooks** | Zero-token sensors (`events.jsonl` appends) and the immune system (exit-2 walls and gates) | Semantic judgment; hook changes activate **next session** and must be labeled as such (A5) |
| **Memory / cron** | Router table (measured quality/wall-clock), last-good baseline, asset index, sentinel heartbeat | Storing "lessons" that never passed the promotion gate |

---

## 3. The Role Corps

### 3.1 Subagent roles (frontmatter allowlists are the enforcement mechanism)

| Role | Tools | Model / effort | Isolation | maxTurns | Duty |
|---|---|---|---|---|---|
| `scout` | Read, Grep, Glob | haiku / low | — | 15 | Recon probes and enumeration passes; output feeds routing and planning only, never reports |
| `planner` | Read, Grep, Glob | opus / high | — | — | Unit decomposition with acceptance contracts; runs twice (dual plan), reconciled deterministically (C7) |
| `spec-attacker` | Read, Grep, Glob | opus / high | — | — | Attacks the contracts themselves: hunts missing acceptance dimensions (performance, security, boundary semantics, concurrency) before any build starts |
| `oracle-smith` | full toolset | opus / high | worktree | — | Forges executable oracles for grey units (C1); test-only changes, verified like any other unit |
| `builder` | full toolset | opus / high | worktree | — | Produces changes; tournament entries are separate builder spawns with mutually blind prompts (C3/C7) |
| `attacker` | Read, Grep, Glob, Bash | opus / high | worktree | — | Adversarial falsification: every finding carries an executable repro `{cmd, expect_exit}`; explicitly encouraged to attack the contract as well as the product |
| `verifier` | **Bash, Read only** | sonnet / low | — | 10 | Prompt locked to: "run the given commands; report raw exit codes verbatim; never modify, never interpret." The C2 executor — emits exit codes, never verdicts |
| `auditor` | Bash, Read | sonnet / medium | — | — | Dependency and security scans (requires Bash; read-only scouts cannot run scanners) |
| `bisector` | Bash, Read | sonnet / medium | worktree | — | `git bisect run` regression localization for the time plane |
| `prover` | Bash, Read | sonnet / medium | worktree | — | Mutation-testing and property campaigns (depth D2) |
| `benchmarker` | Bash, Read | sonnet / low | — | — | Performance baseline comparison (depth D4) |
| `cartographer` | Read, Grep, Glob | sonnet / medium | — | — | Resident repository-map expert, name-addressable via `SendMessage`, kept warm across tasks |
| `merger` | Bash, Read, Edit | opus / high | — | — | The ONLY agent that merges to the integration branch; serial merges; full suite after every merge; enforced by a merge-token guard, not by convention |
| `distiller` | Read, Grep, Write | haiku / low | — | 10 | Ratchet tail: distills the run ledger into `memory/candidates/`; write scope soft-enforced to `memory/**` by the PreToolUse guard (frontmatter cannot path-scope Write — stated honestly) |

Every role gets the strongest sensible model. Risk tiers only ever **add** firepower (more tournament entries, more attack rounds); they never subtract verification.

### 3.2 Teammate formations (on demand, never resident, always volatile)

**Adjudication court (3 teammates)** — created when the evidence plane emits more than 3 contested items; 3 or fewer are adjudicated sequentially in the main session (resumable, no team-volatility exposure).

| Role | Duty | Discipline |
|---|---|---|
| Advocate | Argues for a finding/approach, states its applicability boundary | One shared task-list item per contested item |
| Skeptic | **Executes** the repro commands trying to break the claim — never armchair doubt | TaskCompleted gate: rulings without evidence files are bounced (exit 2) |
| Risk officer | Second-order effects and blast-radius assessment, priced trade-offs | TeammateIdle hook nudges convergence (timebox) |

The court is the only channel allowed to escalate a genuinely ambiguous item to the human. Teams have no resume (A7), so the contested set must be small, timeboxed, and every ruling flushes to `verdicts/` immediately — a crash loses only the in-flight item, and the whole court degrades to sequential main-session adjudication reading the same files.

**Design tournament** — for greenfield or architecture-level decisions: 3–5 mutually blind designer teammates produce competing designs against the same brief; adversarial cross-review; a synthesizer merges the survivors; the human picks with a decision card. Selection pressure comes from cross-review findings, not from committee consensus (C6/C7).

**Long-run shell (Runner + Auditor, optional)** — only for multi-hour, multi-stage sign-off deliveries. The Runner launches named workflow stages in order (plan → build → gauntlet) and hands the human a tricolor go/no-go card between stages; the Auditor spot-checks the ledger. Both are volatile by assumption; on loss, state rebuilds from the blackboard.

**Explicitly rejected**: any resident conductor/integrator/librarian team. Planning is one planner call, merging is one merger agent at the end of a workflow, blackboard upkeep is free hook work. A standing staff would add coordination surface and volatility exposure without adding evidence quality.

---

## 4. Core Mechanisms

### 4.0 Usability contract — capability is only real if it is drivable

Maximal machinery that requires a manual is failed machinery. Ten guarantees, each backed by a mechanism (never by model goodwill):

1. **Zero-argument entry.** `/hyperworkflows:audit` with no args infers scope (changed files vs default branch, else whole repo); `/hyperworkflows:apply` with no args picks up the latest `decision-request.md`. Defaults come from the measured router table, not guesses.
2. **No mode-selection burden.** The formation gate (§4.1) picks solo/T1/T2 automatically and prints *why* on the initiation card. One-word override (`force`) if the human disagrees.
3. **Non-blocking by default.** Workflows run in the background; the session stays interactive; the initiation card executes unless vetoed — the human is never a confirmation ferry.
4. **One progress surface.** Milestones and `/hyperworkflows:status` show done/total, measured rate, and ETA *with the arithmetic shown*, timestamped Asia/Singapore. No log spelunking.
5. **Interruption is cheap.** Prefix-cache resume plus per-unit verdict files: a crash or rate-limit never restarts a campaign from zero; the rerun pays only for the un-cached suffix.
6. **Graceful degradation everywhere.** Every experimental dependency (agent teams, plugin-shipped workflows) has a designed fallback; every degradation is disclosed on the card (C5), never silent.
7. **Plain-language cards.** Verdict cards state what the human can *do* next (approve / reject / unblock). Failed items name the concrete failing command and its exit code — never internal jargon. A failed unit is never aggregated into a success count.
8. **Recheckable output.** Any report re-verifies with one command and zero LLM calls (§4.10).
9. **Safety without friction.** The deny wall blocks genuinely destructive commands only; a blocked command gets the reason plus the safe alternative in the same message.
10. **Self-diagnosing.** `/hyperworkflows:doctor` reports exactly which capability is missing, what still works without it, and which fallback engaged.

### 4.1 Formation selection (quality-driven triage)

One threshold table, one source of truth, referenced everywhere:

| Task shape | Formation | Rationale (quality, not cost) |
|---|---|---|
| Single bug, quick diagnosis, Q&A | T0 solo main session | Orchestration adds coordination surface, zero evidence gain |
| ≤4 independent side tasks | T1 subagents (+`SendMessage` steering) | Context isolation with steerability |
| ≥5 touched units, or any change where the human wants an evidence chain | T2 workflow engines | Full enumeration + adversarial verification |
| Contested judgments, greenfield architecture | T3 court / design tournament | Independent perspectives under machine adjudication |
| Recurring/periodic needs, multi-hour campaigns | Time plane + detached runs | Time leverage |

The gate is **code** — the first workflow phase is always a cheap scout probe, and `if (probe.touched < 5 && !args.force) return { formation: 'solo' }`. Upgrades are always allowed (the human can demand evidence-grade treatment of a 2-file change); downgrades are always disclosed.

### 4.2 Redundant cognition (C7 concretized)

- **Three-way enumeration**: independent enumerators via filesystem walk, symbol graph, and build/dependency graph; reconciled by a deterministic set function in script. Unresolved disagreement >5% of units → **HALT** with a decision request. A wrong denominator silently poisons every downstream claim, so this is the one place the system prefers stopping over proceeding.
- **Dual planning**: two planners decompose independently; deterministic reconciliation; conflicts surface as explicit units rather than being averaged away.
- **Spec-attack**: before any build, a dedicated attacker hunts missing acceptance dimensions (performance, security, boundary semantics, concurrency, i18n). The planner is a single point of cognitive failure without it.

### 4.3 Oracle forging (C1 concretized)

Grey units enter a forging queue: an oracle-smith constructs executable acceptance — golden files, property tests, metamorphic relations, snapshot tests — in an isolated worktree, verified like any other unit. Only demonstrably infeasible units stay grey, each carrying `infeasible_reason` into the report. The grey zone is actively shrunk, not passively labeled.

### 4.4 Full-coverage adversarial verification

```
producer (builder, worktree) ──product + self-reported acceptance──▶
attacker (independent context: product + contract only, no producer reasoning)
        ──findings, each with executable repro {cmd, expect_exit}──▶
verifier (Bash+Read only) ──raw exit codes──▶
script: adjudicate(probes, exit_codes)   # the ONLY place verdicts are born (C2)
        confirmed / rejected → repair loop or report
```

- **100% coverage.** Every unit gets analyze + attack + verify. No sampling tiers. Risk tiers only add firepower (more tournament entries, more attack rounds).
- **Depth ladder labeling** (C8): every green is stamped D0–D4; prover campaigns (D2 mutation) and differential agreement (D3) run wherever the toolchain supports them, and report "n/a" honestly where it does not.
- **Calibration, not gate**: the human spot-checks a small slice of CONFIRMED items during early runs; the observed spot-check failure rate is recorded in memory as the framework's health metric. The core value claim ultimately rests on this honesty loop.

### 4.5 Tournament delivery and fixpoint repair

- **N-version tournament**: every delivery group gets N=3 mutually blind builders by default (N=5 for architecture-critical, N=2 for trivial mechanical changes). Different prompt framings and model tiers per entry.
- **Fixpoint repair** (per entry): verify → script-adjudicate → on failure, spawn a *fresh* builder with the failure history (no anchoring) → **verify again after every repair**. Stop conditions are correctness-based, never budget-based:
  - green → PASS;
  - same failure signature twice → STUCK (the entry hit a wall; more attempts add no information);
  - k ≥ 8 without a stable signature → FLAKY-ORACLE → route the unit to the oracle-smith (the test is the bug).
- **Escalation ladder for STUCK**: one fresh N-version rebuild from scratch → adjudication court → human. Quarantine only after strategy exhaustion.
- **Deterministic winner selection**: lexicographic comparator on the C8 ladder — acceptance green > fewer confirmed attacker findings > differential agreement > mutation score > benchmark. Computed in script; no LLM vote.
- **Merge discipline**: topological levels execute serially (levels are dependency-ordered; only groups *within* a level parallelize, so file-sharing groups never build concurrently); a single merger agent merges serially under a MERGE_TOKEN guard; the full suite runs after **every** merge; a red suite triggers revert-and-quarantine, never ship-and-hope.

### 4.6 The context firewall is an epistemic asset

Fresh context per agent is not a cost optimization — it is what makes verification *independent* (C3). Rules:

1. Every `agent()` call carries a `schema`; validation retries happen at the tool layer and never pollute any context.
2. Artifacts >2KB are written to disk; only `path + sha256 + ≤200-token digest` crosses boundaries. Every subagent prompt embeds the contract: "return ≤30 lines plus absolute paths; large outputs go to files."
3. Main-session context grows O(phases), not O(files): intermediate results live in script variables and the ledger; the session receives one final digest.
4. Resident experts (cartographer) are kept warm via `SendMessage` instead of re-exploring the repository each task.

### 4.7 Checkpoint / resume as iteration speed

Resume exists to make *more quality iterations per day* possible. Four disciplines make cached prefixes deterministic:

1. Units traverse in path-lexicographic order; prompts are built only from `(head, scope, unit content)` — no timestamps, no randomness, no unordered collections.
2. `head` (short git hash) enters every prompt prefix via `args`: a new commit naturally invalidates stale caches.
3. Per-unit verdict files stitch runs together across the run-size ceiling and across days.
4. Scripts are frozen during active runs; `/hyperworkflows:status` warns if the installed workflow hash changed mid-run (a one-line edit invalidates the entire prefix cache — that is physics, so it is surfaced, not hidden).

### 4.8 Time plane

`hypersentinel` modes: **merge** (tests+lint), **nightly 02:30 SGT** (+ dependency audit, mutation, fuzz, bench), **weekly** (+ full asset/fixtures regression). The diff agent reports only the set-difference vs `memory/last-good.json` (fingerprint = suite + normalized location + message hash) — the human sees *new* regressions, never the same wall of known issues. New regressions trigger an auto-bisect phase that localizes the culprit commit and writes a `fix-request.md` ready for `/hyperworkflows:apply`. `last-good.json` advances only after a verified-green confirmation. The next morning's SessionStart brief injects the overnight delta.

### 4.9 Self-evolution flywheel

Distillation is the tail of a run, never a parallel second system:

1. **Ratchet tail** (main session, after each successful T2 run): save the workflow under a name; append measured agent count / wall-clock / spot-check health to `memory/router.md` (the formation table becomes a data-backed living table); dispatch a distiller over the ledger.
2. **Failure-signature threshold**: verification failures, user pushback, and hook bounces are hashed; a signature seen **≥2 times** generates a skill candidate — thresholded distillation, no per-run note noise.
3. **Adversarial promotion gate**: candidates face an advocate + red-team pass; a found counterexample bounces the candidate and lands in `fixtures/` as a boundary condition. Promotion never writes directly into always-on rules; a `candidates/` inbox preserves human veto.
4. **Weekly full asset regression** (sentinel weekly mode) keeps the library honest as it grows.
5. **Activation-latency discipline**: anything touching hooks/settings is labeled "active next session" and is never claimed as protection before a restarted session verifies it.

### 4.10 Recheckable reports (the audit chain)

Every verdict file records `{unit, cmd, expect_exit, exit, head, depth, agent_label, ts}`. `recheck` re-executes every evidence command and diffs actual vs recorded exit codes — zero LLM calls. A report is therefore a falsifiable object: stale or drifted evidence is flagged with the exact command and delta. This is what "trust the report" means here: you don't have to.

---

## 5. Workflow Skeletons

Three engines. All helpers (`reconcileUnits`, `adjudicate`, `selectWinner`, `failureSignature`, `buildTricolor`, `levelsOf`, `sortByPath`) are deterministic pure functions **inlined** in each script (the workflow runtime is assumed to inject only its own primitives — A1/A2); the same logic ships separately as `adjudicate.mjs` for hook/CLI paths, kept in sync by a bundler step. Schemas are illustrative shorthand.

### 5.1 `hyperaudit.js` — evidence plane

```js
// Invoke: workflow('hyperaudit', { head, scope, force })
// Cache discipline: every prompt derives only from (head, scope, unit content).
export default async function ({ head, scope, force }) {

  phase('recon');
  const probe = await agent(
    `Read-only recon of ${scope}@${head}: count work units, assess homogeneity and risk spread.`,
    { schema: { touched: 'number', homogeneous: 'boolean', notes: ['string'] },
      agentType: 'scout', label: 'probe' });
  // Formation gate: a fleet on a 3-file task adds coordination surface, not evidence quality.
  if (probe.touched < 5 && !force) { log('FORMATION: solo'); return { formation: 'solo', probe }; }

  phase('enumerate-x3');                     // C7: no single-point enumerator
  const enums = await parallel([
    () => agent(enumPrompt(scope, head, 'filesystem walk (git ls-files)'), { schema: EnumSchema, agentType: 'scout', label: 'enum:fs' }),
    () => agent(enumPrompt(scope, head, 'symbol graph (rg/ctags)'),        { schema: EnumSchema, agentType: 'scout', label: 'enum:sym' }),
    () => agent(enumPrompt(scope, head, 'build/module dependency graph'),  { schema: EnumSchema, agentType: 'scout', label: 'enum:build' }),
  ]);
  const { units, disputed } = reconcileUnits(enums);     // deterministic set reconciliation
  if (disputed.length) {
    log(`ENUM-GAP: ${disputed.length} disputed units`);  // C5: disclosed, never absorbed
    const gap = await agent(gapAuditPrompt(disputed, head),
      { schema: { resolved: [UnitSchema], out_of_scope: [{ id: 'string', reason: 'string' }] }, label: 'enum:gap' });
    units.push(...gap.resolved);
    if (disputed.length - gap.resolved.length - gap.out_of_scope.length > units.length * 0.05)
      return { formation: 'HALT-ENUM', decision_request: 'runs/current/decision-request.md' };  // hard gate
  }

  phase('forge-oracles');                    // C1: grey is a work queue, not a label
  const grey = units.filter(u => !u.acceptance.length);
  const forged = await pipeline(grey,
    g => agent(forgePrompt(g, head),
      { schema: { acceptance: [{ cmd: 'string', expect_exit: 'number' }], infeasible_reason: 'string' },
        agentType: 'oracle-smith', label: `forge:${g.id}` }));
  applyForged(units, forged);                // still-grey units carry infeasible_reason into the report

  phase('spec-attack');                      // attack the contract before spending on analysis
  const holes = await agent(specAttackPrompt(units, head),
    { schema: { missing: [{ unit: 'string', dimension: 'string', proposed_cmd: 'string' }] },
      agentType: 'spec-attacker', label: 'spec-attack' });
  patchAcceptance(units, holes);

  phase('analyze-attack-verify');            // 100% coverage; metadata threaded through every stage
  const testable = sortByPath(units.filter(u => u.acceptance.length));
  const results = await pipeline(testable,
    async u => ({ meta: u, analysis: await agent(analyzePrompt(u, head),
      { schema: FindingSchema, label: `analyze:${u.id}`, model: 'opus', effort: 'high' }) }),
    async r => ({ ...r, attack: await agent(attackPrompt(r.meta, r.analysis.product_only, head),  // C3
      { schema: { findings: [{ claim: 'string', repro_cmd: 'string', expect_exit: 'number' }] },
        agentType: 'attacker', label: `attack:${r.meta.id}`, effort: 'high' }) }),
    async r => {
      const probes = [...r.meta.acceptance,
        ...r.attack.findings.map(f => ({ cmd: f.repro_cmd, expect_exit: f.expect_exit }))];
      const v = await agent(verifyPrompt(probes, head),          // exit codes ONLY
        { schema: { exit_codes: [{ cmd: 'string', exit: 'number' }] },
          agentType: 'verifier', label: `verify:${r.meta.id}` });
      return { ...r, verdict: adjudicate(probes, v.exit_codes) }; // C2: verdicts born in script
    });

  phase('crosscut-reduce');
  const crosscut = await agent(crosscutPrompt(digestOf(results), head),  // cross-module findings
    { schema: { crosscutting: [FindingSchema], anomalies: ['string'] }, label: 'crosscut', effort: 'high' });
  const report = buildTricolor(results, units, crosscut);        // deterministic reduce
  log(`coverage=${report.coverage.verified}/${report.coverage.total} grey=${report.coverage.grey} enum=3-way`);
  return report;   // contested items -> court; approved fixes -> workflow('hyperapply', ...)
}
```

### 5.2 `hyperapply.js` — delivery plane

```js
// Invoke: workflow('hyperapply', { head, plan_path })   // plan_path = human-approved change list
export default async function ({ head, plan_path }) {

  phase('topo-group');
  const { groups } = await agent(
    `Read ${plan_path}; group units by shared files; emit topological LEVELS: groups within ` +
    `a level are file-disjoint and independent; levels are dependency-ordered.`,
    { schema: { groups: [{ id: 'string', units: ['string'], level: 'number', acceptance: 'array' }] },
      agentType: 'scout', label: 'group' });

  phase('tournament-build');
  const done = [];
  for (const level of levelsOf(groups)) {              // levels strictly serial ...
    const results = await parallel(level.map(g => async () => {  // ... groups within a level parallel
      const N = g.critical ? 5 : 3;                    // capability first: N-version by default
      const entries = await parallel(range(N).map(i => async () => {
        const build = await agent(buildPrompt(g, head, STRATEGY[i]),   // mutually blind (C3/C7)
          { schema: { branch: 'string', files_changed: ['string'] },
            agentType: 'builder', isolation: 'worktree',
            model: TIER[i % TIER.length], label: `build:${g.id}:v${i}` });
        return verifyToFixpoint(build, g, head, `${g.id}:v${i}`);
      }));
      return { group: g, winner: selectWinner(entries) };  // deterministic C8-ladder comparator
    }));
    done.push(...results);
  }

  phase('merge');                                      // single merger, serial, gated
  const merged = [];
  for (const d of done.filter(x => x.winner)) {
    await agent(mergeTokenPrompt('create'), { agentType: 'merger', label: `token:${d.group.id}` });
    const m = await agent(mergePrompt(d.winner, head),
      { schema: { merged: 'boolean', conflict_files: ['string'] },
        agentType: 'merger', label: `merge:${d.group.id}` });
    const suite = await agent(fullSuitePrompt(head),
      { schema: { exit_codes: [{ cmd: 'string', exit: 'number' }] },
        agentType: 'verifier', label: `suite:${d.group.id}` });
    if (!adjudicate(FULL_SUITE, suite.exit_codes).pass) { revertAndQuarantine(d, merged); continue; }
    merged.push({ ...d, suite: suite.exit_codes });    // never ship an unverified merge
    await agent(mergeTokenPrompt('remove'), { agentType: 'merger', label: `untoken:${d.group.id}` });
  }
  return buildTricolor(merged, done);                  // C4
}

// Repair to fixpoint. Stops are correctness-based, never budget-based:
// green | same failure signature twice (no new information) | k>=8 (flaky oracle).
async function verifyToFixpoint(build, g, head, tag) {
  const sigs = [];
  for (let k = 0; ; k++) {
    const v = await agent(verifyPrompt(g.acceptance, head, build.branch),
      { schema: { exit_codes: [{ cmd: 'string', exit: 'number' }] },
        agentType: 'verifier', label: `${tag}:verify:k${k}` });
    const verdict = adjudicate(g.acceptance, v.exit_codes);      // C2
    if (verdict.pass) return { build, status: 'PASS', evidence: v.exit_codes, rounds: k };
    const sig = failureSignature(v.exit_codes);
    if (sigs.filter(s => s === sig).length >= 2) return { build, status: 'STUCK', sig };
    if (k >= 8) return { build, status: 'FLAKY-ORACLE', sigs };  // the test is the bug -> oracle-smith
    sigs.push(sig);
    build = await agent(repairPrompt(build, verdict.failures),   // fresh builder + failure history
      { schema: { branch: 'string', files_changed: ['string'] },
        agentType: 'builder', isolation: 'worktree',
        model: TIER[(k + 1) % TIER.length],                      // rotate tiers to break anchoring
        label: `${tag}:repair:k${k}` });
  }
}
```

### 5.3 `hypersentinel.js` — time plane

```js
// Invoke: workflow('hypersentinel', { head, date, mode })  // injected by the outer routine;
// no Date.now/randomness inside (cache discipline).
export default async function ({ head, date, mode }) {

  phase('probe');
  const SUITES = {
    merge:   ['tests', 'lint'],
    nightly: ['tests', 'lint', 'deps', 'mutation', 'fuzz', 'bench'],
    weekly:  ['tests', 'lint', 'deps', 'mutation', 'fuzz', 'bench', 'assets'],
  }[mode];
  const out = await parallel(SUITES.map(s => () => agent(PROBE_PROMPT[s](head),
    { schema: { exit: 'number', log_path: 'string', counts: 'object' },
      agentType: PROBE_AGENT[s],      // verifier for command probes, auditor for deps, prover for mutation
      label: `${mode}:${s}` })));

  phase('diff');                       // report only the delta vs last-good
  const delta = await agent(diffPrompt(out, 'memory/last-good.json'),
    // last-good schema: { head, date, failures: [{ suite, fingerprint, location }] }
    { schema: { new_regressions: [RegressionSchema], fixed: [RegressionSchema] },
      model: 'opus', label: 'diff' });

  if (delta.new_regressions.length) {
    phase('auto-bisect');              // find the culprit, not just the symptom
    const bisect = await agent(bisectPrompt(delta.new_regressions, head),
      { schema: { culprits: [{ regression: 'string', commit: 'string', evidence_cmd: 'string' }] },
        agentType: 'bisector', label: 'bisect' });
    log(`NEW-REGRESSIONS: ${delta.new_regressions.length}, bisected: ${bisect.culprits.length}`);
    return { date, head, mode, delta, bisect, fix_request: 'runs/current/fix-request.md' };
  }
  return { date, head, mode, delta };
  // Outer routine: notify on new regressions; last-good.json advances only after
  // verified-green confirmation; next morning's SessionStart brief injects this delta.
}
```

---

## 6. Ignition Sequence

Dependency-ordered installation — each step's acceptance is machine-checkable before the next begins:

0. **Assumption probe** (~1 hour): run the §0 register end-to-end; record every answer with evidence in `runs/ignition/`.
1. **Policy plane**: install hooks (deny wall, session brief, sensors, task gate) + the 14-role roster. **Restart the session** and verify the wall actually blocks (A5 latency is real).
2. **Evidence plane**: initialize the blackboard; run `hyperaudit` on a real ≥30-unit target; human spot-checks a slice of CONFIRMED items; record the health baseline.
3. **Delivery plane**: run `hyperapply` on an approved fix plan; verify serial merges each pass the full suite; force one red merge to prove revert-and-quarantine fires.
4. **Time plane**: install sentinel schedules (nightly 02:30 SGT, weekly); verify the morning brief carries the delta; inject a synthetic regression and confirm auto-bisect finds it.
5. **Flywheel**: enable the ratchet tail and promotion gate; confirm a repeated failure signature produces a candidate and the red-team pass can bounce it.

---

## 7. Physical Boundaries & Residual Risks

Honesty section: these are physics and platform realities. The design never self-limits for economy, but it does not pretend physics away.

| # | Boundary / risk | Consequence | Mitigation (never elimination) |
|---|---|---|---|
| R1 | Context windows are finite | A single context cannot hold a large audit | Firewall architecture (§4.6); digests; blackboard |
| R2 | Concurrency cap ≈16 (A4) | Thousand-unit campaigns take hours of wall-clock | Sharding via ledger; detached runs; ETA from measured throughput, arithmetic shown |
| R3 | Single-family model pool (A9) | Producer/attacker/verifier share blind spots; correlation cannot be tuned away | Depth ladder D2/D3 (mutation, differential); human spot-check calibration; stated in every report footer |
| R4 | Oracle-free domains (taste, visuals, copy) | The adversarial loop converges to persuasion | Route to design tournament + human; label UNVERIFIABLE, never fake-green |
| R5 | Agent-team volatility (A7) | A court crash loses in-flight work | Small contested sets, timeboxes, per-ruling flush, sequential fallback |
| R6 | Cache avalanche on script edits | One edited line invalidates a whole run's prefix cache | Freeze scripts during runs; hash-change warning in status |
| R7 | Enumeration is not provably complete | "100% coverage" is relative to the reconciled denominator | 3-way census + hard gate reduce, cannot eliminate; the report's `enum` method field exists to be read |
| R8 | Flaky oracles | Fixpoint repair can chase noise | k≥8 non-convergence detection routes the unit to the oracle-smith |
| R9 | Hook activation latency (A5) | "Protection installed" can be false until restart | Mandatory next-session labeling; doctor re-verification |
| R10 | Toolchain gaps (no mutation/fuzz support in some languages) | D2/D3 unavailable for some units | Depth reported as "n/a at D2+", never simulated |
| R11 | Evidence commands can themselves be wrong | A mis-written acceptance command exits 0 and lies | Spec-attack targets contracts; attacker rewarded for contract holes; early-run human spot-checks are the final backstop — stated plainly |
