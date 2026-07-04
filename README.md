# Hyperworkflows

> **Your coding agent says "All tests pass, everything works."**
> **Hyperworkflows is how you stop taking its word for it.**

[![CI](https://github.com/aezizhu/hyperworkflows/actions/workflows/ci.yml/badge.svg)](https://github.com/aezizhu/hyperworkflows/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757)](https://code.claude.com/docs/en/plugins)
[![Works with 17 coding agents](https://img.shields.io/badge/adapters-17%20coding%20agents-8A2BE2)](#every-coding-agent-not-just-claude-code)

Every AI coding tool shares one failure mode: **the model grades its own homework.** It writes the code, runs (or claims to run) the checks, and tells you it's done. You either believe it or re-check everything by hand.

Hyperworkflows makes self-grading structurally impossible:

1. **No LLM ever decides pass/fail.** Verifier agents may only report raw exit codes. A deterministic script computes every verdict. The model has no vote.
2. **Reports are evidence, not prose.** Every claim links a verdict file carrying the exact commands and recorded exit codes — re-executable by anyone, forever, with **zero LLM calls**.
3. **The discipline is enforced, not preached.** A four-level ladder runs from context injection to a CI required-status check that re-executes committed evidence on every PR — binding every agent, every tool, and every human.

## The 60-second proof (no API key needed)

```sh
git clone https://github.com/aezizhu/hyperworkflows && cd hyperworkflows
sh examples/demo.sh
```

A report verifies green by re-execution. Then an off-by-one "refactor" quietly breaks the claim — and gets caught, with the exact drifted command named:

```
"conclusion": "ALL EVIDENCE REPRODUCES — the report still holds at this working tree."
   ...app.sh changed (off-by-one introduced)...
"recorded": 0,   "actual": 1,
"conclusion": "DRIFT DETECTED — the report's evidence no longer reproduces; treat affected claims as stale."
```

## Install

```
/plugin marketplace add aezizhu/hyperworkflows
/plugin install hyperworkflows@hyperworkflows
```

**That's it — zero setup.** Engines, agents, hooks, and skills ship with the plugin; project state is created lazily on first use. Open any repo and go:

```
/hyperworkflows:audit        # evidence-grade audit of your changed files (or pass a scope)
```

Local development: `claude --plugin-dir /path/to/hyperworkflows`. One platform note (true of every plugin): hooks register at session start, so the enforcement hooks activate from the next session after first install.

## Commands

**You only need one:**

```
/hyperworkflows [anything, in plain words — or nothing]
```

The dispatcher assesses the situation (changed files? pending approved fixes? active run? stale baseline?) and routes to the right flow, announcing its choice in one line. "fix the auth bug" → audit scoped to auth; "keep going until clean" → loop; nothing at all → the most useful next move for this repo.

Power users can drive flows directly:

| Command | What it does |
|---|---|
| `/hyperworkflows:audit [scope] [force]` | Full-coverage adversarial audit → adjudicated tricolor report + decision request |
| `/hyperworkflows:apply [plan]` | Deliver approved changes: N-version blind tournament, fixpoint repair, gated serial merges |
| `/hyperworkflows:recheck [run]` | Re-execute every recorded evidence command and diff exit codes — zero LLM calls |
| `/hyperworkflows:sentinel [mode]` | merge/nightly/weekly probe suites, delta-vs-last-good, auto-bisect to the culprit commit |
| `/hyperworkflows:court [contested]` | Adjudicate contested findings — rulings require *executed* evidence, never argument quality |
| `/hyperworkflows:loop [scope] [rounds]` | Audit→approve→apply→re-audit rounds until clean or plateau; findings tracked by fingerprint, human gate never skipped |
| `/hyperworkflows:enforce [status\|ci\|0-2]` | Manage the enforcement ladder; `ci` installs the E3 gate |
| `/hyperworkflows:status` | One progress surface: done/total, measured rate, ETA with the arithmetic shown |
| `/hyperworkflows:ratchet [run]` | Record measured run stats to the router table; distill reusable candidates |
| `/hyperworkflows:init` / `:doctor` | Optional: project-local engine copies / evidence-backed troubleshooting |

## How it works

The audit engine, end to end — the one line that matters is the second-to-last:

```
/hyperworkflows:audit
 ├─ recon            formation gate: <5 touched units → no fleet, just work (override: force)
 ├─ enumerate ×3     three independent enumerators; script-reconciled;
 │                   unresolved dispute >5% → HALT (a wrong denominator poisons everything)
 ├─ forge-oracles    units with no tests get executable acceptance BUILT for them
 ├─ spec-attack      the contract is attacked before the code (missing perf/security/boundary checks)
 ├─ analyze→attack→verify   100% coverage; every finding carries an executable repro;
 │                          the verifier's schema contains ONLY raw exit codes
 ├─ adjudicate()     a deterministic script computes every verdict   ← no LLM here
 └─ tricolor report  VERIFIED / DONE-UNVERIFIED / QUARANTINED+GREY, coverage arithmetic shown
```

Delivery (`/hyperworkflows:apply`) is a tournament, not a hope: N mutually blind builders per group (they never see each other's approach), verification after **every** repair round, correctness-based stops (repeated failure signature = stuck; 8 rounds without a stable signature = the *test* is flaky), a deterministic winner comparator, and a single merger that runs the full suite after every merge — red suite means instant revert.

Every "green" states how deep it goes:

| Depth | Meaning |
|---|---|
| D0 | acceptance green — commands exit as expected |
| D1 | attack-survived — every adversarial repro machine-rejected |
| D2 | mutation-hardened — the test suite provably kills mutants (tests are real, not theater) |
| D3 | differential-agreed — N independent versions agree on generated inputs |
| D4 | bench-clean — no performance regression vs baseline |

And the artifact everything reduces to — small enough to read, executable enough to trust:

```json
{
  "unit": "src/parser.ts",
  "head": "a1b2c3d",
  "depth": "D1",
  "verdict": "PASS",
  "probes": [{ "cmd": "npm test -- parser", "expect_exit": 0, "exit": 0 }],
  "agent_label": "verify:src/parser.ts",
  "ts": "2026-07-04T18:00:00+08:00"
}
```

## The enforcement ladder (E0–E3)

Discipline that must be remembered gets skipped exactly when it matters most — under deadline pressure, when defect rates peak. So Hyperworkflows enforces by default, with consent scoping and gates designed to be survivable (full analysis: [`enforcement-design.md`](enforcement-design.md)):

| Level | Scope | Mechanism |
|---|---|---|
| **E0 Ambient** | every session | Short brief: Hyperworkflows exists; formation-gate threshold |
| **E1 Salience** | enforced projects | Operating constitution re-injected at start/resume/**compaction**; one-line per-turn drumbeat; targeted nudge after test commands. Recency beats a mandate buried 200k tokens ago |
| **E2 Session gates** | level 2 | **Disclosure-mode Stop gate**: a session that edited files may only end with verdict evidence OR an explicit `UNVERIFIED` disclosure. One-bounce by platform design, never gates Q&A sessions, fail-open on errors |
| **E3 CI absolute** | the repository | `ci-verify.mjs` validates verdict schemas and re-executes committed evidence (`evidence/<run-id>/`) on every PR. As a required status check it binds **every** agent and human, on **every** tool |

Configuration, first match wins: `HYPERWORKFLOWS_ENFORCE=0|1|2` env → `.hyperworkflows/enforce` file (`/hyperworkflows:enforce 2`) → default level 1 in projects carrying Hyperworkflows markers, 0 everywhere else. Install E3 with `/hyperworkflows:enforce ci`, then make the check required in branch protection — that single click is what makes it absolute.

E2 enforces what the constitution actually demands — not "verify everything" but "**never present unverified work as verified**." Honest disclosure always satisfies the gate. From a real enforced session (Claude Code 2.1.201, level 2), unprompted:

> "The change is UNVERIFIED: I wrote `hello.txt` containing `hi` but ran no verdict script to confirm its on-disk contents."

That sentence is the product working.

## Every coding agent, not just Claude Code

Claude Code gets the full engine — 14-role fleet, workflow engines, hooks. Every other mainstream tool gets the portable core (verdict toolkit + operating rules + native commands where supported) with one command:

```sh
sh adapters/install.sh <tool> /path/to/project     # or: all
```

| Tool | Rules surface | Native commands |
|---|---|---|
| Codex / Amp / Jules / generic | `AGENTS.md` (marked section) | — |
| Cursor | `.cursor/rules/hyperworkflows.mdc` | `.cursor/commands/hyperworkflows-{audit,apply,recheck}.md` |
| GitHub Copilot | `.github/copilot-instructions.md` + path instructions | — |
| Gemini CLI | `GEMINI.md` | `.gemini/commands/hyperworkflows/{audit,apply,recheck}.toml` |
| Windsurf | `.windsurf/rules/` | `.windsurf/workflows/hyperworkflows-{audit,apply,recheck}.md` |
| opencode | `AGENTS.md` | `.opencode/command/hyperworkflows-{audit,apply,recheck}.md` |
| Cline / Roo Code / Trae | `.clinerules/` / `.roo/rules/` / `.trae/rules/` | — |
| Aider / Qwen Code / Warp / Zed | `CONVENTIONS.md` / `QWEN.md` / `WARP.md` / `.rules` | — |
| Kiro / JetBrains Junie | `.kiro/steering/` / `.junie/guidelines.md` | — |
| Devin | `.devin/skills/hyperworkflows-*` + role prompts | — |

Marked sections are idempotent — re-running updates in place, never duplicates, and your existing file content is preserved. Every adapter is covered by the test suite. And because the E3 CI gate checks *committed evidence*, it enforces the same discipline across all of them at once.

## How is this different from a methodology plugin?

| | Plain agent | Methodology plugins (Superpowers-style) | **Hyperworkflows** |
|---|---|---|---|
| Who decides "it works"? | the model | the model, told to be careful | **a deterministic script, from raw exit codes** |
| Compliance is... | hoped for | preached at session start | **checkable — gates return exit 2** |
| Report format | prose | prose | **tricolor + verdict files (commands & exit codes)** |
| Re-verifiable next week? | no | no | **one command, zero LLM calls** |
| Survives context decay? | n/a | fades as the session grows | **compaction re-injection + drumbeat + gates that need no salience** |
| Binds other tools & humans? | no | no | **E3: required CI status on every PR** |
| Coverage claims | vibes | vibes | **3-way enumeration, script-reconciled, HALT on dispute** |

## FAQ

**Won't this slow down small tasks?** No. The formation gate is code, not judgment: under 5 touched units the fleet never launches and the session behaves normally. Below level 2, enforcement never blocks anything.

**What if my project has no tests?** Missing oracles are work items, not excuses. An oracle-smith forges executable acceptance (golden files, property tests, metamorphic relations) before anything is accepted as unverifiable — and whatever stays grey is *labeled* grey with a reason, never counted as verified.

**Can't the model just fabricate verdict files?** It can write them — and get caught. `recheck` re-executes every recorded command; the E3 gate does it on every PR. Fabricated evidence fails re-execution. That is precisely why evidence is executable instead of prose.

**Does the Stop gate ever trap the session?** No, by construction: it only fires when files were actually edited, it accepts an honest `UNVERIFIED` disclosure as a full answer, it bounces at most once (platform `stop_hook_active`), and it fails open on any error.

**What does it cost?** Fleet runs spend real tokens — a per-task choice you make at the formation gate, never a surprise. The recheck/CI side costs zero LLM calls, forever.

## Repository layout

```
.claude-plugin/   plugin.json + marketplace.json
commands/         11 slash commands (thin controllers)
agents/           14 roles with tool-allowlist permission gradients
workflows/        3 engines: hyperaudit, hyperapply, hypersentinel (auto-registered by the plugin)
hooks/            deny wall, secrets wall (.env), session brief, drumbeat, nudge, sensors, Stop gate, court gate
scripts/          deterministic zero-dependency logic (Node >= 18 + POSIX sh)
skills/           oracle-forging, spec-attack, tricolor-reporting, adjudication-protocol, merge-discipline
adapters/         one installer for 17 coding tools
templates/        the E3 CI workflow (hyperworkflows-verify.yml)
examples/         the offline 60-second demo
test/             node:test suite for every deterministic component
```

Design documents: [`hyperworkflows-design.md`](hyperworkflows-design.md) (architecture & constitution), [`plugin-design.md`](plugin-design.md) (plugin design), [`enforcement-design.md`](enforcement-design.md) (the E0–E3 analysis).

## Development

```sh
npm run check         # bundle sync check + full test suite — exactly what CI runs
npm test              # tests only
npm run bundle        # regenerate engine helper blocks after editing scripts/adjudicate.mjs
sh examples/demo.sh   # the offline demo must always work
```

Zero runtime dependencies. The workflow runtime cannot import modules, so deterministic helpers are inlined into each engine between `HYPERWORKFLOWS-HELPERS` markers — generated from the canonical `scripts/adjudicate.mjs`, with CI failing on drift. See [`CONTRIBUTING.md`](CONTRIBUTING.md) — bug reports carry executable repros here, on brand.

## Honest limits

- Producer, attacker, and verifier share a model family. Correlated blind spots are *mitigated* by the depth ladder (mutation, differential) and early human spot-checks — never eliminated. Every report footer says so.
- Large fleet audits take wall-clock hours under platform concurrency caps; ETAs come from measured throughput, with the arithmetic shown.
- Hooks activate on the next session after install (platform property). `/hyperworkflows:doctor` verifies every platform assumption with evidence and reports which fallbacks engaged.
- Taste-domain work (visual design, copy) has no oracle; the honest behavior is labeling it UNVERIFIABLE — not paying an adversarial tax for fake confidence.

## License

MIT
