# Hyperworkflows

> **Your coding agent says "All tests pass, everything works."**
> **Hyperworkflows is how you stop taking its word for it.**

[![CI](https://github.com/aezizhu/hyperworkflows/actions/workflows/ci.yml/badge.svg)](https://github.com/aezizhu/hyperworkflows/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](https://code.claude.com/docs/en/plugins)
[![Works with 17 coding agents](https://img.shields.io/badge/adapters-17%20coding%20agents-8A2BE2)](#beyond-claude-code-every-mainstream-coding-agent)

Every AI coding tool has the same failure mode: the model grades its own homework. Hyperworkflows makes that structurally impossible:

- **Verdicts come from exit codes, not opinions.** Verifier agents report raw exit codes; a deterministic script — not any LLM — decides pass/fail. A model cannot talk its way past a red suite.
- **Reports are falsifiable objects.** Every claim links a verdict file with the exact commands and recorded exit codes. Re-verify any report later with **zero LLM calls**: `node scripts/recheck.mjs runs/<id>`.
- **Enforcement, not exhortation.** A 4-level ladder from context injection all the way to a CI required-status check that re-executes committed evidence on every PR — binding every agent, every tool, and every human.

## The 60-second proof (no API key needed)

```sh
git clone https://github.com/aezizhu/hyperworkflows && cd hyperworkflows
sh examples/demo.sh
```

You'll watch a report verify green by re-execution, then watch a sneaky off-by-one "refactor" get caught — with recheck naming the exact command that no longer reproduces:

```
"conclusion": "ALL EVIDENCE REPRODUCES — the report still holds at this working tree."
...app.sh changed (off-by-one introduced)...
"recorded": 0,  "actual": 1,
"conclusion": "DRIFT DETECTED — the report's evidence no longer reproduces; treat affected claims as stale."
```

Reports are not prose. They are re-executable evidence.

## Install

```
/plugin marketplace add aezizhu/hyperworkflows
/plugin install hyperworkflows@hyperworkflows
```

**That's it — zero setup.** Engines, hooks, agents, and skills ship with the plugin; `runs/` and `memory/` are created lazily on first use. Open any project and go:

```
/hyperworkflows:audit               # evidence-grade audit of your changed files (or pass a scope)
```

For local development: `claude --plugin-dir /path/to/hyperworkflows`

Optional (never required):

- `/hyperworkflows:doctor` — troubleshooting: verifies every platform assumption with evidence
- `/hyperworkflows:init` — only if you want project-local engine copies or to pre-seed baselines

One platform note (applies to every plugin, not just Hyperworkflows): hooks register at session start, so the command deny wall becomes active from the next session after first install. Everything else works immediately.

## Commands

| Command | What it does |
|---|---|
| `/hyperworkflows:audit [scope] [force]` | Full-coverage adversarial audit → adjudicated tricolor report + decision request |
| `/hyperworkflows:apply [plan]` | Deliver approved changes: N-version blind tournament, fixpoint repair, gated serial merges |
| `/hyperworkflows:court [contested]` | Adjudicate contested items — agent-team court or sequential fallback; rulings need executed evidence |
| `/hyperworkflows:sentinel [mode]` | Time plane: merge/nightly/weekly probe suites, delta-vs-last-good, auto-bisect; `install` schedules nightly 02:30 |
| `/hyperworkflows:recheck [run]` | Re-run every recorded evidence command, diff exit codes — zero LLM calls |
| `/hyperworkflows:status` | One progress surface: done/total, measured rate, ETA with arithmetic shown |
| `/hyperworkflows:ratchet [run]` | Record measured run stats to the router table; distill candidates |
| `/hyperworkflows:init` / `/hyperworkflows:doctor` | Optional: project-local engine copies / evidence-backed troubleshooting |

## What makes it different

1. **Verdicts are computed by script, never by an LLM.** Verifier agents report raw exit codes; deterministic functions (`scripts/adjudicate.mjs`, inlined in the engines) turn them into verdicts. An LLM structurally cannot overrule a red suite.
2. **The denominator is defended.** Three independent enumerators, script-reconciled; unresolved disagreement halts the run instead of silently shrinking coverage.
3. **Missing oracles are work items.** Grey units go to an oracle-smith (golden files, property tests, metamorphic relations) before being accepted as unverifiable.
4. **Contracts get attacked before code does.** A spec-attacker hunts missing acceptance dimensions (perf, security, concurrency, boundaries) so "all green but wrong" can't ship through contract holes.
5. **Delivery is a tournament, not a hope.** N mutually blind builders per group; verification after every repair round; correctness-based stops (repeated failure signature, flaky-oracle detection) — never budget-based ones; deterministic winner selection; single merger with the full suite after every merge.
6. **Reports are falsifiable.** `node scripts/recheck.mjs runs/<id>` re-executes all recorded evidence and diffs exit codes. You don't have to trust an Hyperworkflows report — you can recheck it.

## Layout

```
.claude-plugin/   plugin.json + marketplace.json
commands/         9 slash commands (thin controllers)
agents/           14 roles with tool-allowlist permission gradients
workflows/        3 engines: hyperaudit, hyperapply, hypersentinel (installed by /hyperworkflows:init)
hooks/            deny wall, session brief, telemetry sensor, court evidence gate
scripts/          deterministic zero-dependency logic (Node >= 18 + POSIX sh)
skills/           methodology: oracle-forging, spec-attack, tricolor-reporting, adjudication-protocol, merge-discipline
adapters/         universal installer for every mainstream coding agent (see below)
test/             node:test suite for every deterministic component
```

## Enforcement ladder (E0–E3)

Discipline that must be remembered gets skipped exactly when it matters most. Hyperworkflows enforces by default — but with consent scoping and honest gates (full analysis: [`enforcement-design.md`](enforcement-design.md)):

| Level | Scope | What it does |
|---|---|---|
| **E0 Ambient** | every session | Short brief: Hyperworkflows exists, formation gate threshold |
| **E1 Salience** | enforced projects | Operating constitution injected at session start/resume/**compact**; one-line per-turn drumbeat; targeted nudge after test commands (once per session) |
| **E2 Session gates** | level 2 | **Disclosure-mode Stop gate**: a session that edited files may only end with verdict evidence OR an explicit `UNVERIFIED` disclosure. Never loops (platform one-bounce), never gates Q&A sessions (mutation breadcrumb precondition), fail-open on errors |
| **E3 CI absolute** | the repository | `ci-verify.mjs` re-executes committed evidence (`evidence/<run-id>/verdicts/`) + validates schemas on every PR. As a required status check it binds **every** agent and human, on every tool |

Configuration (first match wins): `HYPERWORKFLOWS_ENFORCE=0|1|2` env → `.hyperworkflows/enforce` file (`/hyperworkflows:enforce 2`) → default: level 1 in projects with Hyperworkflows markers, level 0 everywhere else.

Install the E3 gate: `/hyperworkflows:enforce ci` (copies `templates/hyperworkflows-verify.yml` + the `.hyperworkflows/` toolkit), then mark it required in branch protection — that single click is what makes it absolute.

The E2 gate enforces the constitution's actual demand — not "verify everything" but "**never present unverified work as verified**". Honest disclosure always satisfies it.

## Beyond Claude Code: every mainstream coding agent

Claude Code gets the full engine (workflows, agent fleet, hooks). Every other tool gets the portable core — `.hyperworkflows/` toolkit (script-computed verdicts + zero-LLM recheck), the Hyperworkflows operating rules in the tool's native rules surface, and native commands where the tool supports them:

```sh
sh adapters/install.sh <tool> /path/to/project     # or: all
```

| Tool | Rules surface | Native commands |
|---|---|---|
| Codex / Amp / Jules / generic (`agents-md`) | `AGENTS.md` (marked section) | — |
| Cursor | `.cursor/rules/hyperworkflows.mdc` (alwaysApply) | `.cursor/commands/hyperworkflows-{audit,apply,recheck}.md` |
| GitHub Copilot | `.github/copilot-instructions.md` + `.github/instructions/hyperworkflows.instructions.md` | — |
| Gemini CLI | `GEMINI.md` | `.gemini/commands/hyperworkflows/{audit,apply,recheck}.toml` |
| Windsurf | `.windsurf/rules/hyperworkflows.md` | `.windsurf/workflows/hyperworkflows-{audit,apply,recheck}.md` |
| opencode | `AGENTS.md` | `.opencode/command/hyperworkflows-{audit,apply,recheck}.md` |
| Cline / Roo Code | `.clinerules/hyperworkflows.md` / `.roo/rules/hyperworkflows.md` | — |
| Aider | `CONVENTIONS.md` (+ `read:` in `.aider.conf.yml`) | — |
| Qwen Code | `QWEN.md` | — |
| Kiro | `.kiro/steering/hyperworkflows.md` (inclusion: always) | — |
| Warp | `WARP.md` | — |
| Zed | `.rules` | — |
| JetBrains Junie | `.junie/guidelines.md` | — |
| Trae | `.trae/rules/hyperworkflows.md` | — |
| Devin | `.devin/skills/hyperworkflows-*` + role prompts | — |

Marked sections are idempotent (re-running the installer updates in place, never duplicates) and preserve your existing file content. Every adapter is covered by the test suite.

## How is this different from a methodology plugin?

| | Plain agent | Methodology plugins (Superpowers-style) | **Hyperworkflows** |
|---|---|---|---|
| Who decides "it works"? | The model itself | The model, after being told to be careful | **A deterministic script, from raw exit codes** |
| Compliance is... | hoped for | preached at session start | **checkable — gates return exit 2** |
| Report format | prose | prose | **tricolor + verdict files with commands & exit codes** |
| Re-verifiable next week? | no | no | **one command, zero LLM calls** |
| Survives context decay? | n/a | fades as the session grows | **re-injection on compact + per-turn drumbeat + gates that need no salience** |
| Binds other tools/humans? | no | no | **E3 CI gate: required status on every PR** |
| Coverage claims | vibes | vibes | **3-way enumeration, script-reconciled, HALT on dispute** |

## FAQ

**Won't this slow down small tasks?** No — the formation gate is code: under 5 touched units the fleet never launches and the session just works normally. Enforcement below level 2 never blocks anything.

**What if my project has no tests?** Missing oracles are work items, not excuses: an oracle-smith forges executable acceptance (golden files, property tests, metamorphic relations) before anything is accepted as unverifiable — and what remains grey is *labeled* grey, never counted as verified.

**Can't the model just fabricate verdict files?** It can write them — and get caught: `recheck` re-executes every recorded command, and the E3 CI gate does it on every PR. Fabricated evidence fails re-execution. That's the point of executable evidence over prose.

**Does it work outside Claude Code?** The full engine (agent fleet, workflows, hooks) is Claude Code; the evidence discipline, verdict toolkit, and CI gate install into 17 other tools with one command (`sh adapters/install.sh <tool> <project>`).

**What does it cost?** Fleet runs spend real tokens — that's a choice you make per task via the formation gate, never a surprise. The recheck/CI side costs zero LLM calls forever.

## Development

```sh
npm test              # node:test suite (pure logic, recheck end-to-end, all four hooks)
npm run bundle        # regenerate helper blocks inlined in workflow engines
npm run bundle:check  # CI gate: engines byte-identical to scripts/adjudicate.mjs
npm run check         # bundle:check + tests (what CI runs)
```

The workflow runtime cannot import modules, so the deterministic helpers are inlined into each engine between `HYPERWORKFLOWS-HELPERS` markers — generated from the canonical `scripts/adjudicate.mjs` by `scripts/bundle-workflows.mjs`, and CI fails if they drift.

Design documents: [`hyperworkflows-design.md`](hyperworkflows-design.md) (architecture) and [`plugin-design.md`](plugin-design.md) (this plugin's design).

## Honesty section

- Producer, attacker, and verifier share a model family; correlated blind spots are mitigated by mutation/differential depth checks and early-run human spot-checks — not eliminated. Every report footer says so.
- `/hyperworkflows:doctor` empirically resolves the platform's open questions (named-workflow loading, workflow agent options, hook payload shape) and reports which fallbacks engaged.
- Hooks activate on the **next** session after install. Protection is not installed until `/hyperworkflows:doctor`'s guard check passes.

## License

MIT
