# Hyperworkflows (`hw`)

Evidence-factory orchestration for Claude Code. Every claim is machine-verified (exit codes, not LLM opinion), every audit enumerates its denominator three independent ways, every delivery is an N-version tournament with gated serial merges — and every report can be re-verified later with **zero LLM calls**.

## Install

```
/plugin marketplace add aezizhu/hyperworkflows
/plugin install hw@hyperworkflows
```

**That's it — zero setup.** Engines, hooks, agents, and skills ship with the plugin; `runs/` and `memory/` are created lazily on first use. Open any project and go:

```
/hw:audit               # evidence-grade audit of your changed files (or pass a scope)
```

For local development: `claude --plugin-dir /path/to/hyperworkflows`

Optional (never required):

- `/hw:doctor` — troubleshooting: verifies every platform assumption with evidence
- `/hw:init` — only if you want project-local engine copies or to pre-seed baselines

One platform note (applies to every plugin, not just HW): hooks register at session start, so the command deny wall becomes active from the next session after first install. Everything else works immediately.

## Commands

| Command | What it does |
|---|---|
| `/hw:audit [scope] [force]` | Full-coverage adversarial audit → adjudicated tricolor report + decision request |
| `/hw:apply [plan]` | Deliver approved changes: N-version blind tournament, fixpoint repair, gated serial merges |
| `/hw:court [contested]` | Adjudicate contested items — agent-team court or sequential fallback; rulings need executed evidence |
| `/hw:sentinel [mode]` | Time plane: merge/nightly/weekly probe suites, delta-vs-last-good, auto-bisect; `install` schedules nightly 02:30 |
| `/hw:recheck [run]` | Re-run every recorded evidence command, diff exit codes — zero LLM calls |
| `/hw:status` | One progress surface: done/total, measured rate, ETA with arithmetic shown |
| `/hw:ratchet [run]` | Record measured run stats to the router table; distill candidates |
| `/hw:init` / `/hw:doctor` | Optional: project-local engine copies / evidence-backed troubleshooting |

## What makes it different

1. **Verdicts are computed by script, never by an LLM.** Verifier agents report raw exit codes; deterministic functions (`scripts/adjudicate.mjs`, inlined in the engines) turn them into verdicts. An LLM structurally cannot overrule a red suite.
2. **The denominator is defended.** Three independent enumerators, script-reconciled; unresolved disagreement halts the run instead of silently shrinking coverage.
3. **Missing oracles are work items.** Grey units go to an oracle-smith (golden files, property tests, metamorphic relations) before being accepted as unverifiable.
4. **Contracts get attacked before code does.** A spec-attacker hunts missing acceptance dimensions (perf, security, concurrency, boundaries) so "all green but wrong" can't ship through contract holes.
5. **Delivery is a tournament, not a hope.** N mutually blind builders per group; verification after every repair round; correctness-based stops (repeated failure signature, flaky-oracle detection) — never budget-based ones; deterministic winner selection; single merger with the full suite after every merge.
6. **Reports are falsifiable.** `node scripts/recheck.mjs runs/<id>` re-executes all recorded evidence and diffs exit codes. You don't have to trust an HW report — you can recheck it.

## Layout

```
.claude-plugin/   plugin.json + marketplace.json
commands/         9 slash commands (thin controllers)
agents/           14 roles with tool-allowlist permission gradients
workflows/        3 engines: hyperaudit, hyperapply, hw-sentinel (installed by /hw:init)
hooks/            deny wall, session brief, telemetry sensor, court evidence gate
scripts/          deterministic zero-dependency logic (Node >= 18 + POSIX sh)
skills/           methodology: oracle-forging, spec-attack, tricolor-reporting, adjudication-protocol, merge-discipline
adapters/         universal installer for every mainstream coding agent (see below)
test/             node:test suite for every deterministic component
```

## Beyond Claude Code: every mainstream coding agent

Claude Code gets the full engine (workflows, agent fleet, hooks). Every other tool gets the portable core — `.hw/` toolkit (script-computed verdicts + zero-LLM recheck), the HW operating rules in the tool's native rules surface, and native commands where the tool supports them:

```sh
sh adapters/install.sh <tool> /path/to/project     # or: all
```

| Tool | Rules surface | Native commands |
|---|---|---|
| Codex / Amp / Jules / generic (`agents-md`) | `AGENTS.md` (marked section) | — |
| Cursor | `.cursor/rules/hw.mdc` (alwaysApply) | `.cursor/commands/hw-{audit,apply,recheck}.md` |
| GitHub Copilot | `.github/copilot-instructions.md` + `.github/instructions/hw.instructions.md` | — |
| Gemini CLI | `GEMINI.md` | `.gemini/commands/hw/{audit,apply,recheck}.toml` |
| Windsurf | `.windsurf/rules/hw.md` | `.windsurf/workflows/hw-{audit,apply,recheck}.md` |
| opencode | `AGENTS.md` | `.opencode/command/hw-{audit,apply,recheck}.md` |
| Cline / Roo Code | `.clinerules/hw.md` / `.roo/rules/hw.md` | — |
| Aider | `CONVENTIONS.md` (+ `read:` in `.aider.conf.yml`) | — |
| Qwen Code | `QWEN.md` | — |
| Kiro | `.kiro/steering/hw.md` (inclusion: always) | — |
| Warp | `WARP.md` | — |
| Zed | `.rules` | — |
| JetBrains Junie | `.junie/guidelines.md` | — |
| Trae | `.trae/rules/hw.md` | — |
| Devin | `.devin/skills/hw-*` + role prompts | — |

Marked sections are idempotent (re-running the installer updates in place, never duplicates) and preserve your existing file content. Every adapter is covered by the test suite.

## Development

```sh
npm test              # node:test suite (pure logic, recheck end-to-end, all four hooks)
npm run bundle        # regenerate helper blocks inlined in workflow engines
npm run bundle:check  # CI gate: engines byte-identical to scripts/adjudicate.mjs
npm run check         # bundle:check + tests (what CI runs)
```

The workflow runtime cannot import modules, so the deterministic helpers are inlined into each engine between `HW-HELPERS` markers — generated from the canonical `scripts/adjudicate.mjs` by `scripts/bundle-workflows.mjs`, and CI fails if they drift.

Design documents: [`hyperworkflows-design.md`](hyperworkflows-design.md) (architecture) and [`hw-plugin-design.md`](hw-plugin-design.md) (this plugin's design).

## Honesty section

- Producer, attacker, and verifier share a model family; correlated blind spots are mitigated by mutation/differential depth checks and early-run human spot-checks — not eliminated. Every report footer says so.
- `/hw:doctor` empirically resolves the platform's open questions (named-workflow loading, workflow agent options, hook payload shape) and reports which fallbacks engaged.
- Hooks activate on the **next** session after install. Protection is not installed until `/hw:doctor`'s guard check passes.

## License

MIT
