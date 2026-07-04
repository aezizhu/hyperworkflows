import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const RECHECK = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "recheck.mjs");

function makeRun(verdicts) {
  const dir = mkdtempSync(join(tmpdir(), "hw-recheck-"));
  mkdirSync(join(dir, "verdicts"));
  for (const [name, v] of Object.entries(verdicts)) {
    writeFileSync(join(dir, "verdicts", name), JSON.stringify(v));
  }
  return dir;
}

function runRecheck(dir) {
  const r = spawnSync("node", [RECHECK, dir, "--timeout", "10"], { encoding: "utf8" });
  return { code: r.status, out: JSON.parse(r.stdout) };
}

test("recheck: all-reproducing evidence exits 0", () => {
  const dir = makeRun({
    "a.json": { unit: "a", probes: [{ cmd: "true", expect_exit: 0, exit: 0 }, { cmd: "exit 3", expect_exit: 3, exit: 3 }] }
  });
  try {
    const { code, out } = runRecheck(dir);
    assert.equal(code, 0);
    assert.equal(out.checked, 2);
    assert.equal(out.matched, 2);
    assert.equal(out.drifted, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("recheck: drift detected -> exit 1 with the exact command named", () => {
  const dir = makeRun({
    "b.json": { unit: "b", probes: [{ cmd: "false", expect_exit: 1, exit: 0 }] } // recorded exit 0, actual will be 1
  });
  try {
    const { code, out } = runRecheck(dir);
    assert.equal(code, 1);
    assert.equal(out.drifted, 1);
    assert.equal(out.drifts[0].cmd, "false");
    assert.equal(out.drifts[0].recorded, 0);
    assert.equal(out.drifts[0].actual, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("recheck: unparseable verdict file is an error, never silently skipped", () => {
  const dir = mkdtempSync(join(tmpdir(), "hw-recheck-"));
  mkdirSync(join(dir, "verdicts"));
  writeFileSync(join(dir, "verdicts", "bad.json"), "{not json");
  try {
    const { code, out } = runRecheck(dir);
    assert.equal(code, 1);
    assert.equal(out.unparseable, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
