// Oracle for commands/court.md (unit: the court command spec).
//
// court.md's ONLY machine-checkable, load-bearing contract is the CLI it tells the
// adjudicating agent to run to "compute the verdict from exit codes":
//     node ${CLAUDE_PLUGIN_ROOT}/scripts/adjudicate.mjs adjudicate '...'
// Everything else in court.md is subjective LLM orchestration (agent teams, ruling
// cards, escalation copy) with no deterministic oracle. This test pins the executable
// contract court.md depends on: the documented invocation must emit a verdict JSON
// whose `pass` reflects exit-code matching, and must honor constitution C6
// ("rulings without recorded exit codes do not complete" => a missing exit is never a pass).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const CLI = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "adjudicate.mjs");

// Run the exact CLI shape court.md documents: `adjudicate '<json>'`.
function runCourtAdjudicate(payload) {
  let stdout, status = 0;
  try {
    stdout = execFileSync("node", [CLI, "adjudicate", JSON.stringify(payload)], { encoding: "utf8" });
  } catch (e) {
    stdout = e.stdout != null ? String(e.stdout) : "";
    status = e.status;
  }
  return { verdict: JSON.parse(stdout), status };
}

test("court CLI: matching exit codes yield pass=true, process exit 0", () => {
  const { verdict, status } = runCourtAdjudicate({
    probes: [{ cmd: "npm test", expect_exit: 0 }],
    exit_codes: [{ cmd: "npm test", exit: 0 }]
  });
  assert.equal(status, 0);
  assert.equal(verdict.pass, true);
  assert.equal(verdict.failures.length, 0);
});

test("court CLI: mismatched exit code yields pass=false (ruling: overturned), still exit 0", () => {
  const { verdict, status } = runCourtAdjudicate({
    probes: [{ cmd: "repro", expect_exit: 0 }],
    exit_codes: [{ cmd: "repro", exit: 1 }]
  });
  assert.equal(status, 0);
  assert.equal(verdict.pass, false);
  assert.equal(verdict.failures[0].exit, 1);
});

test("court CLI (C6): a probe with no recorded exit code is never a pass", () => {
  const { verdict } = runCourtAdjudicate({
    probes: [{ cmd: "unrun", expect_exit: 0 }],
    exit_codes: []
  });
  assert.equal(verdict.pass, false);
  assert.equal(verdict.failures[0].exit, null);
});

test("court CLI: an empty probe set is not a pass (no evidence, no green)", () => {
  const { verdict } = runCourtAdjudicate({ probes: [], exit_codes: [] });
  assert.equal(verdict.pass, false);
});

test("court CLI: an unknown subcommand fails closed with a nonzero process exit", () => {
  let status = 0;
  try {
    execFileSync("node", [CLI, "not-a-real-fn", "{}"], { encoding: "utf8" });
  } catch (e) {
    status = e.status;
  }
  assert.equal(status, 2);
});
