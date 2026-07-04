# HW adapter: Devin

Ports the harness-agnostic parts of Hyperworkflows to Devin (or Devin CLI). What ports cleanly:

| Layer | Portability | How |
|---|---|---|
| Methodology skills (oracle-forging, spec-attack, tricolor-reporting, adjudication-protocol, merge-discipline) | 100% | Installed as `.devin/skills/hw-<name>/SKILL.md` |
| Role contracts (14 roles) | High | Generated as `role-prompts.md` — paste the relevant contract into any subagent/task prompt |
| Deterministic scripts (`adjudicate.mjs`, `recheck.mjs`) | 100% | Plain Node >= 18; call them from any agent via shell |
| Blackboard format (`runs/`, verdict schema, tricolor) | 100% | Plain files |
| Workflow engines / hooks | Not ported | Claude Code-specific runtime; on other harnesses, drive the same blackboard with the harness's own orchestration |

## Install into a project

```sh
sh adapters/devin/install.sh /path/to/your/project
```

This copies the five skills to `<project>/.devin/skills/hw-*/` and generates
`<project>/.devin/hw-role-prompts.md` from `agents/*.md` (frontmatter stripped,
contract bodies kept). Re-run any time; it overwrites the generated artifacts only.

## Usage pattern on Devin

1. Ask for an audit using the tricolor-reporting + spec-attack skills; require every
   finding to carry `{cmd, expect_exit}` evidence.
2. Run verification through a subagent given ONLY the verifier contract from
   `hw-role-prompts.md` (commands in, raw exit codes out).
3. Adjudicate with `node scripts/adjudicate.mjs adjudicate '<json>'` — never let the
   model decide pass/fail.
4. Persist verdict files in the canonical schema; re-verify any time with
   `node scripts/recheck.mjs <run-dir>` — zero LLM calls.
