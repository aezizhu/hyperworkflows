#!/bin/sh
# Hyperworkflows 60-second proof — zero API keys, zero LLM calls.
# Shows the falsifiability loop: a report whose evidence re-executes, then a
# code change that silently breaks the claim, caught by recheck naming the
# exact command that no longer reproduces.
#
# Usage: sh examples/demo.sh    (from the repository root)

set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d /tmp/hyperworkflows-demo-XXXXXX)
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

say() { printf '\n== %s\n' "$1"; }

say "1/4  A tiny 'project': app.sh with an add() function, and a claim about it"
cat > app.sh <<'EOF'
add() { echo $(( $1 + $2 )); }
EOF
cat app.sh

say "2/4  The claim ships with EVIDENCE — a verdict file with an executable probe"
mkdir -p evidence/audit-demo/verdicts
cat > evidence/audit-demo/verdicts/app.json <<'EOF'
{
  "unit": "app.sh",
  "head": "demo000",
  "depth": "D0",
  "verdict": "PASS",
  "agent_label": "verify:app.sh",
  "ts": "2026-07-04T18:00:00+08:00",
  "probes": [
    { "cmd": "sh -c '. ./app.sh && [ \"$(add 2 3)\" = \"5\" ]'", "expect_exit": 0, "exit": 0 }
  ]
}
EOF
echo "evidence/audit-demo/verdicts/app.json (claim: add(2,3)==5, recorded exit 0)"

say "3/4  Re-verify the report — no AI involved, just re-execution"
node "$ROOT/scripts/recheck.mjs" evidence/audit-demo --cwd "$WORK" | grep -E '"(checked|matched|drifted|conclusion)"'

say "4/4  Someone 'refactors' add() and breaks it. Does the old report still hold?"
cat > app.sh <<'EOF'
add() { echo $(( $1 + $2 + 1 )); }
EOF
echo "app.sh changed (off-by-one introduced)."
node "$ROOT/scripts/recheck.mjs" evidence/audit-demo --cwd "$WORK" | grep -E '"(cmd|recorded|actual|conclusion)"' || true

printf '\nThat is the whole idea: reports are not prose, they are re-executable evidence.\n'
printf 'Inside Claude Code this evidence is produced for you: /hyperworkflows:audit\n'
