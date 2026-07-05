// Oracle for skills/adjudication-protocol/SKILL.md — the court-procedure spec.
//
// This SKILL.md is a prose protocol. Its agentic steps (spawning an advocate/
// skeptic/risk-officer team, timeboxing, escalating to a human) are non-
// deterministic and cannot be executed in a unit test. But the doc makes
// CONCRETE, checkable claims about repo artifacts and one CENTRAL executable
// claim — "Verdicts are computed from exit codes by script (adjudicate.mjs),
// never voted on" — and that claim we run for real. The rest of the oracle
// pins the doc's cross-references (court roles, verdict-file path schema,
// constitution C6, the named script) to the artifacts they point at, so the
// spec cannot silently drift from the command/scripts it governs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL = readFileSync(join(ROOT, "skills", "adjudication-protocol", "SKILL.md"), "utf8");
const ADJ = join(ROOT, "scripts", "adjudicate.mjs");

const runAdjudicate = (payload) =>
  JSON.parse(execFileSync("node", [ADJ, "adjudicate", JSON.stringify(payload)], { encoding: "utf8" }));

test("SKILL.md: frontmatter names this skill and carries a description", () => {
  const fm = SKILL.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, "no YAML frontmatter block");
  assert.match(fm[1], /^name:\s*adjudication-protocol\s*$/m, "name must be adjudication-protocol");
  assert.match(fm[1], /^description:\s*\S/m, "description must be non-empty");
});

test("CENTRAL CLAIM executable: verdicts are computed from exit codes, never voted", () => {
  // The doc: "Verdicts are computed from exit codes by script (`adjudicate.mjs`)".
  // Run the named script for real and confirm the verdict is a pure function of
  // the recorded exit codes: PASS iff exit === expect_exit, FAIL otherwise.
  assert.match(SKILL, /computed from exit codes by script \(`adjudicate\.mjs`\)/);
  const probes = [{ cmd: "true", expect_exit: 0 }];
  const pass = runAdjudicate({ probes, exit_codes: [{ cmd: "true", exit: 0 }] });
  assert.equal(pass.pass, true, "matching exit code must yield PASS — evidence, not a vote");
  const fail = runAdjudicate({ probes, exit_codes: [{ cmd: "true", exit: 1 }] });
  assert.equal(fail.pass, false, "mismatched exit code must yield FAIL");
});

test("METAMORPHIC: verdict ignores exit-code ordering (evidence, not argument order)", () => {
  const probes = [{ cmd: "a", expect_exit: 0 }, { cmd: "b", expect_exit: 0 }];
  const fwd = runAdjudicate({ probes, exit_codes: [{ cmd: "a", exit: 0 }, { cmd: "b", exit: 1 }] });
  const rev = runAdjudicate({ probes, exit_codes: [{ cmd: "b", exit: 1 }, { cmd: "a", exit: 0 }] });
  assert.deepEqual(fwd, rev, "same exit codes in any order must produce the same ruling");
});

test("cross-ref: the three court roles the doc names all exist in commands/court.md", () => {
  const roles = ["advocate", "skeptic", "risk-officer"];
  const COURT = readFileSync(join(ROOT, "commands", "court.md"), "utf8");
  for (const r of roles) {
    assert.ok(SKILL.includes(r), `doc must name the ${r} role`);
    assert.ok(COURT.includes(r), `governed command court.md must also name ${r} (drift check)`);
  }
});

test("cross-ref: verdict-file path schema matches the command that writes it", () => {
  // Doc: runs/<run-id>/verdicts/task-<task-id>.json. Assert the structural
  // literal (placeholder style differs; the shape must not) in both files.
  assert.match(SKILL, /runs\/[^/]*\/verdicts\/task-[^/]*\.json/, "doc must state the verdict path shape");
  const COURT = readFileSync(join(ROOT, "commands", "court.md"), "utf8");
  assert.match(COURT, /verdicts\/task-[^/]*\.json/, "court.md must write to the same verdicts/task-*.json shape");
});

test("cross-ref: the named script exists and exposes an `adjudicate` CLI verb", () => {
  const src = readFileSync(ADJ, "utf8");
  assert.match(src, /fn === "adjudicate"/, "adjudicate.mjs must dispatch the adjudicate verb");
});

test("cross-ref: the C6 citation points at a real constitution clause about distilled sets", () => {
  // Doc: "distilled contested set only (constitution C6)".
  assert.match(SKILL, /distilled contested set only \(constitution C6\)/);
  const design = readFileSync(join(ROOT, "hyperworkflows-design.md"), "utf8");
  const c6 = design.split("\n").find(l => /\bC6\b/.test(l) && /distilled/i.test(l));
  assert.ok(c6, "hyperworkflows-design.md must define a C6 clause about distilled sets");
});
