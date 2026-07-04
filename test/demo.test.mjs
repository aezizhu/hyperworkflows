import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const DEMO = join(dirname(fileURLToPath(import.meta.url)), "..", "examples", "demo.sh");

test("demo.sh: runs offline end-to-end, showing both reproduce and drift", () => {
  const r = spawnSync("sh", [DEMO], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /ALL EVIDENCE REPRODUCES/);
  assert.match(r.stdout, /DRIFT DETECTED/);
  assert.match(r.stdout, /"recorded": 0/);
  assert.match(r.stdout, /"actual": 1/);
});
