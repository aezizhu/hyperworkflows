# Contributing to Hyperworkflows

The project applies its own constitution to itself. Practically:

## Development loop

```sh
npm run check         # bundle:check + full test suite — what CI runs
npm test              # tests only
npm run bundle        # regenerate engine helper blocks after editing scripts/adjudicate.mjs
sh examples/demo.sh   # the offline falsifiability demo must keep working
```

Requirements: Node >= 18.17, git, POSIX sh. Zero runtime dependencies — keep it that way; a PR adding a dependency needs a very good reason.

## Rules that will be enforced in review

1. **Evidence over prose.** A bug report or fix claim carries an executable repro (`{cmd, expect_exit}`) or a failing test. "It seems to work now" does not merge.
2. **Verdict logic lives in one place.** Deterministic helpers change ONLY in `scripts/adjudicate.mjs`; run `npm run bundle` to sync the engine-inlined copies (CI fails on drift).
3. **Hooks must be survivable.** Any new hook: fail-open on parse errors, never blocks outside its precondition, and comes with tests for the block case, the pass case, and the garbage-input case.
4. **Honesty in UX text.** No message may claim protection or verification that has not actually engaged (e.g. hooks activate next session — say so).
5. **Tests accompany behavior.** Every new script/command path lands with node:test coverage; adapters land with the install-twice idempotency test.

## Good first contributions

- Additional tool adapters (see `adapters/install.sh` — one function + one test entry)
- Mutation/fuzz probe recipes for more language ecosystems (`workflows/hypersentinel.js`)
- Real-world dogfood reports: run `/hyperworkflows:audit` on a repo and file what broke

## Commit style

Imperative subject, body explains *why*. One logical change per commit. All commits are authored by you — no AI attribution trailers.
