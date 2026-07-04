# Hyperworkflows — Claude Code Plugin Design

**Version**: 0.1 (pre-implementation design)
**Date**: 2026-07-04 (Asia/Singapore)
**Scope**: Installable plugin packaging of the Hyperworkflows architecture (`hyperworkflows-design.md`). Target harness: **Claude Code first**; portability layer for other coding agents in §6.

---

## 0. Product Statement

Hyperworkflows turns any Claude Code session into an **evidence factory**: every claim shipped to the user is machine-verified (exit codes, not LLM opinion), every unit of work is enumerated with a coverage ledger, and every deliverable is a tricolor report (verified / done-unverified / quarantined+grey) whose evidence chain can be re-checked by a script with zero LLM calls.

Design stance: **maximize result quality; tokens are purchasable**. The plugin never downgrades for cost. The only guards are correctness guards (non-progress detection, flaky-oracle detection, safety rails on destructive commands).

One-line pitch: `/hyperworkflows:audit` → adjudicated findings; `/hyperworkflows:apply` → tournament-built, independently verified, serially merged changes; `/hyperworkflows:sentinel` → regressions found by 03:00 and bisected to the culprit commit.

---

## 1. Verified Platform Capability Map

Verified against official docs (code.claude.com) on 2026-07-04. This is the plugin's assumption register — anything marked OPEN gets verified in milestone M0 before we build on it.

| # | Capability | Status | Hyperworkflows usage |
|---|-----------|--------|----------|
| P1 | Plugins: `.claude-plugin/plugin.json`; components at plugin root: `commands/`, `agents/`, `skills/`, `hooks/hooks.json`, `.mcp.json`, `scripts/`; `${CLAUDE_PLUGIN_ROOT}` path variable; marketplace distribution (`.claude-plugin/marketplace.json`, `/plugin install hyperworkflows@...`) | VERIFIED (docs) | Packaging & distribution |
| P2 | Dynamic workflows: JS script run by a deterministic background runtime; primitives `agent(prompt, opts)`, `parallel(thunks)` (barrier, ~16 concurrency cap), `pipeline(items, ...stages)` (no barrier), `phase()`, `log()`, `workflow(name, args)` (1 level of nesting), `args`, `budget`; named workflows live in `.claude/workflows/`; `/workflows` panel; journal + resume | VERIFIED (docs + community deep-dives) | L2 evidence / L4 delivery engines |
| P3 | Subagents: markdown defs with frontmatter `tools`, `disallowedTools`, `model` (`sonnet/opus/haiku/fable/<full-id>/inherit`), `effort`, `maxTurns`, `permissionMode`, `isolation: worktree`, `background`, `memory`, `skills`; Task tool renamed **Agent** (v2.1.63); `Agent(agent_type)` allowlist syntax; agents addressable via `SendMessage({to: name})` | VERIFIED (docs) | 14-role roster, permission gradient |
| P4 | Worktree isolation: `isolation: worktree` gives each subagent a temp git worktree; branches from `origin/HEAD` by default, configurable `worktree.baseRef: "head"`; auto-cleanup when no changes | VERIFIED (docs) | Builder/oracle-smith/prover isolation |
| P5 | Agent teams (experimental, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`): lead + teammates, shared file-based task list, mailboxes; hooks `TeammateIdle`, `TaskCreated`, `TaskCompleted` (exit 2 blocks; `{"continue": false}` stops); teammates honor agent-definition `tools`/`model`; **no resume, volatile** | VERIFIED (docs; experimental) | Adjudication court (§5.3), optional |
| P6 | Hooks: `PreToolUse` (blocking), `PostToolUse`, `SessionStart`, `UserPromptSubmit`, `Stop`, `SubagentStart`, `SubagentStop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`; plugins ship `hooks/hooks.json`; hook config changes take effect **next session** | VERIFIED (docs) | L1 policy layer, zero-token sensors |
| P7 | Headless: `claude -p` with `--output-format json/stream-json`, `--json-schema` → `structured_output`, `--allowedTools`, `--max-turns`, `--bare` (skip discovery; recommended for scripted calls), cost fields in JSON output | VERIFIED (docs) | Sentinel cron / CI runner |
| W1 | Can a plugin **ship named workflows** so they're invocable without copying? | **VERIFIED — YES** (smoke-tested on Claude Code 2.1.201: `workflows/*.js` auto-register, visible as `/hyperworkflows:hyperaudit` etc.). Onboarding is therefore zero-setup; `/hyperworkflows:init` is demoted to optional provisioning (local engine copies for cache stability / customization) | No copying needed; dynamic-workflow read from `${CLAUDE_PLUGIN_ROOT}/workflows/` remains as fallback |
| W2 | Workflow runtime module access: can workflow JS `import`/`require` (fs, path)? Community analysis says the runtime injects only the primitives | **OPEN — assume NO** | All adjudication helpers are **inlined pure functions** in each workflow script; file IO happens inside `agent()` calls or via hooks. Standalone `.mjs` scripts exist separately for hooks/commands |
| W3 | Does `agent()` inside a workflow accept `agentType`/custom agent + `isolation: worktree`? Docs show subagent frontmatter supports it; workflow docs show `label/schema/phase/model` | **OPEN** | If `agentType` unsupported: embed the role's system-prompt contract directly in the `agent()` prompt (roles ship as both agent files AND prompt fragments — see §3.6) |
| W4 | PreToolUse payload: does it identify the calling agent (so the guard can enforce "only hyperworkflows-merger merges")? | **OPEN** | Fallback: merge-token file protocol (§3.4) — guard allows `git merge/push` only while `runs/<id>/MERGE_TOKEN` exists, created/removed by the merge phase |

Residual platform risk (accepted, documented): all models are same-family (`fable` is still an Anthropic model) → correlated blind spots. Mitigated by verification-depth ladder (mutation/differential testing), never claimed eliminated.

---

## 2. Repository & Plugin Layout

Single repo = marketplace + one plugin. Name: repo `hyperworkflows`, plugin `hyperworkflows` (commands namespace `/hyperworkflows:*`).

```
hyperworkflows/
├── .claude-plugin/
│   ├── plugin.json              # name: "hyperworkflows", version, description
│   └── marketplace.json         # lists this plugin; enables /plugin marketplace add <owner>/hyperworkflows
├── commands/                    # slash commands (thin: parse args, invoke workflows/scripts, render cards)
│   ├── init.md                  #   /hyperworkflows:init     — OPTIONAL provisioning (local engine copies, baselines)
│   ├── doctor.md                #   /hyperworkflows:doctor   — verify platform assumptions W1–W4, hooks live, roster loaded
│   ├── audit.md                 #   /hyperworkflows:audit    — evidence plane (hyperaudit workflow)
│   ├── apply.md                 #   /hyperworkflows:apply    — delivery plane (hyperapply workflow)
│   ├── court.md                 #   /hyperworkflows:court    — adjudicate contested set (teams if enabled, else sequential)
│   ├── sentinel.md              #   /hyperworkflows:sentinel — run probe suite now; `install` writes launchd/cron/CI job
│   ├── recheck.md               #   /hyperworkflows:recheck  — re-run every evidence cmd in a report, diff verdicts
│   ├── status.md                #   /hyperworkflows:status   — digest of runs/<latest> ledger + /workflows state
│   └── ratchet.md               #   /hyperworkflows:ratchet  — save named workflow, write measured stats to router, dispatch distiller
├── agents/                      # 14-role roster (§3.2), one .md each, hyperworkflows- prefix
├── skills/                      # methodology skills loaded on demand (§3.5)
│   ├── oracle-forging/SKILL.md
│   ├── spec-attack/SKILL.md
│   ├── tricolor-reporting/SKILL.md
│   ├── adjudication-protocol/SKILL.md
│   └── merge-discipline/SKILL.md
├── workflows/                   # engines; auto-registered by the plugin (W1 verified) — no copying needed
│   ├── hyperaudit.js
│   ├── hyperapply.js
│   └── hypersentinel.js
├── hooks/
│   └── hooks.json               # PreToolUse guard, SessionStart brief, SubagentStop sensor, TaskCompleted gate
├── scripts/                     # deterministic, zero-dependency; POSIX sh for hooks (fast), Node >=18 ESM for logic
│   ├── guard.sh                 # dangerous-command wall + merge-token enforcement
│   ├── session-brief.sh         # inject formation table + assets index (<50 lines)
│   ├── sensor.sh                # append events.jsonl (zero-token telemetry)
│   ├── task-gate.sh             # TaskCompleted: block completion without a verdict file
│   ├── adjudicate.mjs           # exit-code comparison, tricolor builder (used by commands/recheck, NOT by workflows — W2)
│   ├── recheck.mjs              # re-run evidence cmds from verdicts/*.json, diff, zero LLM calls
│   └── sentinel-install.sh      # launchd plist (macOS) / crontab / GitHub Actions template emitter
└── README.md
```

Project-side state, created lazily on first use (never inside the plugin dir):

```
<repo>/
├── .claude/workflows/{hyperaudit,hyperapply,hypersentinel}.js   # copied, version-stamped
├── runs/<run-id>/                                             # blackboard: plan.json, events.jsonl,
│   ├── plan.json                                              #   verdicts/*.json, ledger.jsonl,
│   ├── events.jsonl                                           #   decision-request.md, report.md
│   ├── verdicts/<unit-id>.json
│   └── ledger.jsonl
└── memory/                                                    # router.md, last-good.json, candidates/
```

File-truth discipline: files are ground truth, context is cache. `events.jsonl` is an append-only line journal (O_APPEND line-atomic, explicitly exempt from the single-writer rule); every other blackboard file has exactly one writer, recorded in `plan.json`.

---

## 3. Component Design

### 3.1 Commands (thin controllers, fat evidence)

Commands never do batch work themselves; they parse arguments, launch workflows/scripts, and render the four card types (initiation card, decision card, milestone, verdict card). All human interaction stays in the main session (subagents cannot ask the user — platform property, P3/P5).

| Command | Contract |
|---|---|
| `/hyperworkflows:init` | OPTIONAL provisioning (zero-setup is the default): local engine copies for prefix-cache stability or customization, gitignore hygiene, baseline seeding. Never part of onboarding. |
| `/hyperworkflows:doctor` | Executes the assumption register: minimal 2-agent workflow probe (P2/W3), verifier write-denial test (P3), hook liveness (P6 — reminds that hook changes need a restart), teams env flag (P5), `git worktree` sanity (P4), model availability probe (`fable`, `opus`). Writes `runs/doctor-<date>/report.md`. |
| `/hyperworkflows:audit [scope]` | Initiation card → `workflow('hyperaudit', {head, scope})` → on completion renders verdict card (tricolor + coverage + evidence-chain paths) and, if fixes are proposed, writes `decision-request.md` for the human gate. |
| `/hyperworkflows:apply <plan-path>` | Human-approved plan only (the human gate is the workflow split point: audit ends → human decides → apply starts). Launches `workflow('hyperapply', ...)`. Renders merge results with per-group full-suite exit codes. |
| `/hyperworkflows:court <contested.json>` | ≤3 items: sequential adjudication in the main session (cheap, resumable). >3 items: spawn a 3-teammate court (advocate / skeptic / risk-officer) if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is set, else degrade to sequential with a notice. Every ruling flushed to `verdicts/` immediately (teams are volatile, P5). |
| `/hyperworkflows:sentinel [merge\|nightly\|weekly]` | Runs the probe suite now via `workflow('hypersentinel', {mode})`. `install` sub-action calls `sentinel-install.sh` to emit a launchd plist (02:30 Asia/Singapore), crontab line, or GitHub Actions job that runs headless: `claude -p "/hyperworkflows:sentinel nightly" --output-format json --max-turns 200`. |
| `/hyperworkflows:recheck <report>` | Zero-LLM path: `node scripts/recheck.mjs runs/<id>` re-executes every `{cmd, expect_exit}` in `verdicts/*.json`, diffs actual vs recorded exit codes, flags stale evidence. The report is itself falsifiable — this is C4's teeth. |
| `/hyperworkflows:status` | Reads `ledger.jsonl` + `/workflows` panel state; renders done/total, throughput, ETA (from measured rate, with the arithmetic shown, Asia/Singapore timestamps). |
| `/hyperworkflows:ratchet` | Post-run tail: names & saves the workflow, appends measured quality/wall-clock stats to `memory/router.md`, dispatches `hyperworkflows-distiller` (main session dispatches it — hooks are shell commands and cannot call the Agent tool). |

### 3.2 Agent Roster (14 roles, permission gradient = role definition)

All ship as `agents/hyperworkflows-*.md`. Frontmatter is the enforcement mechanism (C3 independence, C2 verifier lockdown); prompts are the contract.

| Role | tools | model / effort | isolation | maxTurns | Duty |
|---|---|---|---|---|---|
| `hyperworkflows-scout` | Read, Grep, Glob | haiku / low | — | 15 | Recon probes; enumeration passes; output feeds routing only, never reports |
| `hyperworkflows-planner` | Read, Grep, Glob | opus / high | — | — | Unit decomposition with acceptance contracts `{cmd, expect_exit}`; runs 2x (dual-plan, reconciled deterministically) |
| `hyperworkflows-spec-attacker` | Read, Grep, Glob | opus / high | — | — | Attacks the contracts themselves: missing acceptance dimensions (perf, security, edge semantics) before any build starts |
| `hyperworkflows-oracle-smith` | full toolset | opus / high | worktree | — | Forges executable oracles for grey units (golden files, property tests, metamorphic relations); grey is a work queue, not a label (C1) |
| `hyperworkflows-builder` | full toolset | opus / high | worktree | — | Produces changes; N-version tournament entries are separate hyperworkflows-builder spawns with mutually blind prompts (C3/C7) |
| `hyperworkflows-attacker` | Read, Grep, Glob, Bash | opus / high | worktree | — | Adversarial falsification; every finding must carry an executable repro `{cmd, expect_exit}`; encouraged to attack the contract too |
| `hyperworkflows-verifier` | **Bash, Read only** | sonnet / low | — | 10 | Prompt locked: "run the given commands, report raw exit codes verbatim; no modification, no interpretation." The C2 executor — it never emits verdicts, only exit codes |
| `hyperworkflows-auditor` | Bash, Read | sonnet / medium | — | — | Dependency / security scans (needs Bash; read-only scouts cannot run scanners) |
| `hyperworkflows-bisector` | Bash, Read | sonnet / medium | worktree | — | `git bisect run` regression localization for sentinel |
| `hyperworkflows-prover` | Bash, Read | sonnet / medium | worktree | — | Mutation-testing & property campaigns (verification depth D2 — structural counter to verification theater) |
| `hyperworkflows-benchmarker` | Bash, Read | sonnet / low | — | — | Perf baseline comparison (depth D4) |
| `hyperworkflows-cartographer` | Read, Grep, Glob | sonnet / medium | — | — | Resident repo-map expert; name-addressable via `SendMessage` across a session |
| `hyperworkflows-merger` | Bash, Read, Edit | opus / high | — | — | The ONLY agent that merges to the integration branch; serial merges; full suite after every merge; enforced by merge-token guard (W4 fallback) |
| `hyperworkflows-distiller` | Read, Grep, Write | haiku / low | — | 10 | Ratchet tail: distills ledger → `memory/candidates/`; Write is soft-scoped to `memory/**` by guard.sh (honest note: frontmatter cannot path-scope Write — the guard hook does) |

### 3.3 Named Workflows (the two engines + sentinel)

Shipped in `workflows/` and auto-registered by the plugin (W1 verified); optional project-local copies via `/hyperworkflows:init` take precedence. Key structural properties:

- **hyperaudit.js** — evidence plane. Phases: `recon` (formation gate: `touched < 5 && !args.force` → return solo recommendation) → `enumerate-x3` (three independent enumerators: fs-walk, symbol-graph, build-graph; **deterministic set reconciliation inlined in the script**; unresolved disagreement >5% of units → HALT with decision-request — a hard gate, not a log line) → `forge-oracles` (grey queue → hyperworkflows-oracle-smith) → `spec-attack` → `analyze+attack+verify` (a `pipeline()` where stage functions **thread unit metadata through explicitly**: `async u => ({meta: u, analysis: await agent(...)})` so downstream stages always see unit metadata, not just the previous stage's schema; 100% coverage, no sampling; verifier returns exit codes only and the **verdict is computed by an inlined pure function** `adjudicate(acceptance, exitCodes)` — C2) → `crosscut+reduce` (one global pass over the distilled digest; tricolor built deterministically in script).
- **hyperapply.js** — delivery plane. Phases: `topo-group` (group by shared files; emit **topological levels**) → `tournament-build` (outer `for` over levels **serially**, `parallel()` across groups within a level, so file-sharing groups can never build concurrently; per group, N=3 mutually-blind hyperworkflows-builder entries; each entry runs `verifyToFixpoint`: verify → adjudicate in script → repair with fresh builder + failure history → **verify again after every repair**, so no repair round is ever discarded unverified; stop conditions are correctness-based, never budget-based: same failure signature twice = STUCK, k≥8 = FLAKY-ORACLE → route to oracle-smith; winner selected by a deterministic comparator on the C8 depth ladder: acceptance-green > fewer confirmed attacker findings > differential agreement > bench) → `merge` (hyperworkflows-merger only, serial, full suite after each merge, MERGE_TOKEN protocol) → tricolor.
- **hypersentinel.js** — time plane. `mode` selects probe set: `merge` = tests+lint; `nightly` = + deps, mutation, fuzz, bench; `weekly` = + full asset/fixtures regression. Diff vs `memory/last-good.json` (schema: `{head, date, failures: [{suite, fingerprint, location}]}`, set-difference on fingerprint). New regressions → `auto-bisect` phase (hyperworkflows-bisector) → write `fix-request.md` (hyperapply-ready). `last-good.json` advances only after verified-green confirmation. Prompts contain no `Date.now`/randomness; `head`/`date` come from `args` (cache/resume discipline).

### 3.4 Hooks (`hooks/hooks.json`)

| Event | Handler | Purpose |
|---|---|---|
| `PreToolUse` (matcher: Bash) | `guard.sh` | Deny wall (exit 2): `git push --force`, `rm -rf` outside `runs/`/worktrees, `dd`, history rewrites, `git merge`/`git push` to the default branch **unless** `runs/<active>/MERGE_TOKEN` exists (W4 fallback protocol: token created by hyperapply's merge phase, removed after). Also soft-scopes hyperworkflows-distiller writes to `memory/**` |
| `SessionStart` | `session-brief.sh` | Injects <50 lines: formation table (single threshold: touched <5 → solo unless evidence explicitly demanded), assets index (named workflows, router stats, last sentinel delta) |
| `SubagentStop` | `sensor.sh` | Appends `{ts, agent, label, outcome}` to `runs/<active>/events.jsonl` — zero-token telemetry |
| `TaskCompleted` (teams mode) | `task-gate.sh` | Exit 2 if the task claims completion without a corresponding `verdicts/*.json` entry — no evidence, no completion |
| `UserPromptSubmit` | `drumbeat.sh` | E1: one-line per-turn salience in enforced projects (recency beats volume; never blocks) |
| `PostToolUse` (matcher: Bash) | `nudge.sh` | E1: after test/lint-looking commands, once per session: adjudicate exit codes via script, don't eyeball |
| `PostToolUse` (matcher: Edit\|Write\|MultiEdit\|NotebookEdit) | `mutation-sensor.sh` | E2: per-session mutation breadcrumb (`runs/.sessions/<sid>.mutated`) — the Stop gate's precondition |
| `Stop` | `stop-gate.sh` | E2 (level >= 2): disclosure-mode gate — mutated session may end only with verdict evidence or an explicit UNVERIFIED disclosure; one-bounce via `stop_hook_active`; fail-open on any error |

Enforcement levels resolve via `lib-enforce.sh`: `HYPERWORKFLOWS_ENFORCE` env → `.hyperworkflows/enforce` file → marker-based default (1 if `.hyperworkflows/` / `memory/router.md` / `evidence/` present, else 0). The E3 CI gate (`scripts/ci-verify.mjs` + `templates/hyperworkflows-verify.yml`, installed by `/hyperworkflows:enforce ci`) is documented in `enforcement-design.md`.

Hook changes take effect next session (P6) — the one platform latency Hyperworkflows cannot remove; `/hyperworkflows:doctor` and `/hyperworkflows:enforce` state it wherever relevant.

### 3.5 Skills (methodology, loaded on demand)

- **oracle-forging** — how to build executable acceptance for oracle-less units (golden/property/metamorphic/snapshot), when to declare `infeasible_reason`.
- **spec-attack** — checklist of acceptance dimensions attackers probe for (perf, concurrency, i18n, security, boundary semantics).
- **tricolor-reporting** — the C4 report format: verified (with evidence links) / done-unverified / quarantined+grey; coverage arithmetic shown; no silent buckets.
- **adjudication-protocol** — court procedure: advocate/skeptic/risk-officer roles, timebox, per-ruling flush, degrade-to-sequential rule.
- **merge-discipline** — single-merger protocol, MERGE_TOKEN lifecycle, full-suite-per-merge, revert-and-quarantine on red.

### 3.6 Deterministic Scripts & the W2/W3 hedge

Because workflow JS likely cannot import modules (W2), every adjudication helper (`adjudicate`, `reconcileUnits`, `selectWinner`, `failureSignature`, `buildTricolor`, `levelsOf`) is an **inlined pure function** at the top of each workflow file — single source in `scripts/adjudicate.mjs`, inlined at build time by a repo script (`npm run bundle-workflows`), so logic never drifts between the standalone CLI path and the workflow path. If W3 fails (no `agentType` in workflow `agent()` calls), each role's contract also exists as a prompt fragment inlined by the same bundler.

---

## 4. Constitution → Enforcement Mapping

Every clause of the Hyperworkflows constitution has a named enforcement point in the plugin — no clause enforced by "the model should remember".

| Clause | Enforced by |
|---|---|
| C1 Contract-first + oracle-forging duty | hyperaudit `enumerate` schema requires `acceptance[]`; grey units routed to hyperworkflows-oracle-smith phase; `task-gate.sh` blocks completion without verdicts |
| C2 Exit codes rule; verdicts computed in script | hyperworkflows-verifier schema contains **only** `exit_codes[]`; `adjudicate()` pure function inlined in workflows; `adjudicate.mjs` for CLI paths |
| C3 Cognitive independence | Verifier prompts built from contract + repro only (never producer reasoning); N-version builder prompts mutually blind; attacker attacks non-self products; enforced by prompt-builder functions in workflow scripts |
| C4 Tricolor finality + evidence chain | `buildTricolor()` in scripts; every verified item links `verdicts/<unit>.json`; `/hyperworkflows:recheck` makes the report falsifiable without an LLM |
| C5 No silent truncation | Sampling abolished (100% coverage default); any skip/degrade path must call `log()` + appear in report coverage section; enum hard gate HALTs instead of shrinking the denominator |
| C6 Judges eat distilled sets only | `/hyperworkflows:court` input schema is the contested set (≤ dozens of items); court never receives raw corpus |
| C7 Redundant cognition on critical paths | 3x enumeration + dual planner + spec-attacker; reconciliation is deterministic script, never LLM vote |
| C8 Verification depth ladder | Verdict files carry `depth: D0–D4`; hyperworkflows-prover (D2 mutation), differential comparison in tournament (D3), hyperworkflows-benchmarker (D4); reports aggregate min-depth per unit |

## 5. Core Flow Sequences

### 5.1 `/hyperworkflows:audit src/`
```
main session: initiation card (exit criteria, phase plan, roster, N-version plan)
  └─ workflow('hyperaudit', {head, scope})          # background; session stays usable
       recon → [gate] → enumerate-x3 → [reconcile, HALT if >5% disputed]
       → forge-oracles → spec-attack
       → pipeline: analyze(u) → attack(u) → verify(u) → adjudicate() in script
       → crosscut → tricolor report + decision-request.md
main session: verdict card → AskUserQuestion (which fixes to apply)   # the human gate
```

### 5.2 `/hyperworkflows:apply runs/<id>/decision-request.md`
```
workflow('hyperapply', {head, plan_path})
  topo-group → for each level (serial):
    parallel groups → per group: 3 blind builders (worktrees)
      each: verify → adjudicate → repair(fresh builder + failure history) → verify …
      stop: green | same-signature-twice (STUCK) | k≥8 (FLAKY-ORACLE → oracle-smith)
    winner = deterministic comparator (D-ladder lexicographic)
  merge: create MERGE_TOKEN → hyperworkflows-merger serial merges + full suite each → remove token
  → tricolor (verified w/ suite exit codes | STUCK quarantined | untouched)
```

### 5.3 `/hyperworkflows:court` — contested items (teams optional)
Teams enabled: lead spawns advocate/skeptic/risk-officer teammates; skeptic must **execute** repro commands (TaskCompleted gate rejects rulings without verdict files); every ruling flushed to `verdicts/` immediately; timeboxed; on team loss, degrade to sequential main-session adjudication reading the same files. Teams disabled: sequential from the start. Court is the only channel allowed to escalate genuinely-ambiguous items to the human.

### 5.4 Sentinel + recheck
`sentinel-install.sh` emits: macOS launchd plist (02:30 Asia/Singapore) or GitHub Actions cron, running `claude -p "/hyperworkflows:sentinel nightly" --output-format json` from the repo. Morning session: SessionStart brief injects the overnight delta. `/hyperworkflows:recheck` runs anywhere, anytime, zero LLM: re-executes evidence commands, diffs exit codes, flags drift.

## 6. Portability to Other Coding Agents

Claude Code is the primary target; the design keeps a portable core so adapters stay thin:

| Layer | Portable? | Notes |
|---|---|---|
| Blackboard format (`runs/`, verdicts, ledger, tricolor) | 100% | Plain files; any agent can read/write |
| Deterministic scripts (`adjudicate.mjs`, `recheck.mjs`, `guard.sh`) | 100% | Node ≥18 + POSIX sh, zero deps |
| Role contracts + skills (markdown) | High | Devin: `.devin/skills/`; generic: `AGENTS.md` sections; Cursor: rules |
| Workflow engines | Low | CC-specific runtime. Adapter path for other harnesses: a `hyperworkflows-runner.mjs` that fans out via headless CLI calls (e.g. `claude -p --bare --json-schema`, or the harness's own headless mode) driving the same blackboard |
| Hooks | Medium | Map to each harness's hook system where it exists; guard.sh logic reusable |

v1 ships `adapters/devin/` (skills mirroring the five methodology skills + role prompt fragments) as proof of portability; others on demand.

## 7. Roadmap & Acceptance Gates

| Milestone | Scope | Acceptance (machine-checkable) |
|---|---|---|
| **M0 skeleton** | plugin.json, `/hyperworkflows:init`, `/hyperworkflows:doctor`, guard + brief hooks, hyperworkflows-verifier, `recheck.mjs`; resolve W1–W4 | Installs via `--plugin-dir`; after restart `/hyperworkflows:doctor` all green; guard blocks `git push --force` (exit 2); doctor report answers W1–W4 with evidence |
| **M1 evidence** | hyperaudit + scout/planner/spec-attacker/oracle-smith/attacker/verifier + blackboard + tricolor | Audit a real ≥30-unit repo: 100% non-grey units have verdict files; `/hyperworkflows:recheck` reproduces every recorded exit code; enum hard gate demonstrably HALTs on an injected gap |
| **M2 delivery** | hyperapply tournament + hyperworkflows-merger + fixpoint repair + MERGE_TOKEN guard | N=3 tournament on a real fix plan; serial merges each followed by green full suite; a forced-red merge triggers revert-and-quarantine |
| **M3 time + court** | hypersentinel 3 modes + `install` + auto-bisect; `/hyperworkflows:court` (teams + sequential); `/hyperworkflows:ratchet` + router.md | Nightly run produces delta vs last-good; injected regression gets bisected to the culprit commit; court produces per-ruling verdict files under both modes |
| **M4 distribution** | marketplace.json, README, `adapters/devin/`, version discipline | `/plugin marketplace add` + `/plugin install hyperworkflows@hyperworkflows` works from a clean machine |

Dogfooding rule: from M1 onward, every Hyperworkflows milestone is audited by Hyperworkflows itself (`/hyperworkflows:audit` on this repo) — the tricolor report for each milestone is part of its acceptance.

## 8. Open Questions & Risks

1. **W1–W4** (see §1) — all resolved empirically in M0 by `/hyperworkflows:doctor`; each has a designed fallback so none blocks the architecture.
2. **Stack confirmation** (greenfield): Node ≥18 zero-dep ESM + POSIX sh hooks. Rationale: Claude Code itself is Node (no new runtime for users); hooks need <50 ms startup; no Python dependency. Confirm before M0.
3. **Teams volatility** (P5): court designed to lose nothing on crash (per-ruling flush); still experimental — sequential mode is the contractual baseline, teams an enhancement.
4. **Concurrency ceiling** (~16): wall-clock for 1000-unit audits is hours, not minutes; ETA always from measured throughput; sharding across runs via `ledger.jsonl` cross-run stitching.
5. **Same-family models**: `fable`/`opus`/`sonnet` diversity is tiering, not family diversity — correlated blind spots persist; D2/D3 depths mitigate; stated honestly in every report footer.
6. **Headless permissions**: sentinel runs with explicit `--allowedTools` allowlist (never `--dangerously-skip-permissions`); safety rail, not a cost rail.
7. **Cache/resume discipline**: prompts derive only from `(head, scope, unit content)`; script edits during an active run invalidate the prefix cache — `/hyperworkflows:status` warns if the installed workflow hash changed mid-run.
