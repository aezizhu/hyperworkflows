// Oracle for .github/workflows/ci.yml
//
// Metamorphic relation: the CI job is only meaningful if every check it
// declares actually passes on the code in the same tree. This test parses the
// `run:` steps out of the workflow file and executes each one locally,
// asserting exit 0 — so "green in CI" is provably reproducible from the repo
// root. The recursive `node --test` step is skipped (it re-runs this file).
//
// Test-only: reads ci.yml and runs its already-declared commands. It adds no
// new production behavior; if a step here fails, CI itself would fail.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const wf = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf8');

// Extract single-line `run:` commands from the workflow.
const steps = [];
for (const line of wf.split('\n')) {
  const m = line.match(/^\s+run:\s+(.*\S)\s*$/);
  if (m) steps.push(m[1]);
}

test('ci.yml declares the expected run steps', () => {
  // Guards against silent parser drift (e.g. YAML block scalars).
  assert.ok(steps.length >= 5, `expected >=5 run steps, parsed ${steps.length}`);
});

for (const cmd of steps) {
  // Skip the recursive test runner and any placeholder no-ops.
  if (/\bnode\s+--test\b/.test(cmd)) continue;

  test(`CI step exits 0: ${cmd.slice(0, 60)}`, () => {
    let status = 0;
    try {
      execSync(cmd, {
        cwd: repoRoot,
        stdio: 'pipe',
        shell: '/bin/sh',
        env: process.env,
      });
    } catch (err) {
      status = err.status ?? 1;
      const out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
      assert.fail(`\`${cmd}\` exited ${status}\n${out}`);
    }
    assert.equal(status, 0);
  });
}
