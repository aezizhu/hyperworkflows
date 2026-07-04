import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { validateVerdict } from "../scripts/adjudicate.mjs";

const CI_VERIFY = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "ci-verify.mjs");

const GOOD = { unit: "a", head: "abc1234", depth: "D0", verdict: "PASS", agent_label: "verify:a", ts: "t", probes: [{ cmd: "true", expect_exit: 0, exit: 0 }] };

function repo(evidence) {
  const dir = mkdtempSync(join(tmpdir(), "hyperworkflows-ci-"));
  if (evidence) {
    for (const [run, verdicts] of Object.entries(evidence)) {
      mkdirSync(join(dir, "evidence", run, "verdicts"), { recursive: true });
      for (const [name, v] of Object.entries(verdicts)) {
        writeFileSync(join(dir, "evidence", run, "verdicts", name), typeof v === "string" ? v : JSON.stringify(v));
      }
    }
  }
  return dir;
}

function run(dir, ...args) {
  const r = spawnSync("node", [CI_VERIFY, "--cwd", dir, "--timeout", "10", ...args], { encoding: "utf8", cwd: dir });
  return { code: r.status, out: JSON.parse(r.stdout || "{}"), err: r.stderr };
}

test("validateVerdict: canonical schema passes; core-field violations are errors", () => {
  assert.equal(validateVerdict(GOOD).ok, true);
  assert.equal(validateVerdict(GOOD).warnings.length, 0);
  const bad = validateVerdict({ unit: "a", verdict: "PASS", probes: [{ cmd: "true", expect_exit: 0 }] });
  assert.equal(bad.ok, false); // probes[0].exit missing
  assert.match(bad.errors.join(";"), /probes\[0\]\.exit/);
  const meta = validateVerdict({ unit: "a", verdict: "PASS", probes: GOOD.probes });
  assert.equal(meta.ok, true); // metadata missing = warnings only
  assert.ok(meta.warnings.length >= 3);
});

test("ci-verify: valid, reproducing evidence passes with exit 0", () => {
  const dir = repo({ "audit-abc": { "a.json": GOOD } });
  try {
    const { code, out } = run(dir);
    assert.equal(code, 0, JSON.stringify(out));
    assert.equal(out.pass, true);
    assert.equal(out.runs[0].matched, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ci-verify: drifted probe fails with exit 1 and names the command", () => {
  const dir = repo({ "audit-abc": { "b.json": { ...GOOD, unit: "b", probes: [{ cmd: "false", expect_exit: 1, exit: 0 }] } } });
  try {
    const { code, out } = run(dir);
    assert.equal(code, 1);
    assert.equal(out.pass, false);
    assert.equal(out.runs[0].drifts[0].cmd, "false");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ci-verify: schema violation fails even when commands reproduce", () => {
  const dir = repo({ "audit-abc": { "c.json": { verdict: "PASS", probes: [{ cmd: "true", expect_exit: 0, exit: 0 }] } } }); // no unit
  try {
    const { code, out } = run(dir);
    assert.equal(code, 1);
    assert.match(JSON.stringify(out.runs[0].schema_errors), /unit/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ci-verify: missing evidence root soft-passes by default, fails with --require", () => {
  const dir = repo(null);
  try {
    const soft = run(dir);
    assert.equal(soft.code, 0);
    assert.match(soft.out.notice, /soft pass/);
    const hard = spawnSync("node", [CI_VERIFY, "--cwd", dir, "--require"], { encoding: "utf8", cwd: dir });
    assert.equal(hard.status, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ci-verify: HYPERWORKFLOWS_REQUIRE_EVIDENCE=1 env equals --require", () => {
  const dir = repo(null);
  try {
    const r = spawnSync("node", [CI_VERIFY, "--cwd", dir], { encoding: "utf8", cwd: dir, env: { ...process.env, HYPERWORKFLOWS_REQUIRE_EVIDENCE: "1" } });
    assert.equal(r.status, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("ci-verify: unparseable verdict JSON is fatal", () => {
  const dir = repo({ "audit-abc": { "bad.json": "{not json" } });
  try {
    const { code } = run(dir);
    assert.equal(code, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
