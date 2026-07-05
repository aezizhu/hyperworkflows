import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Oracle for templates/hyperworkflows-verify.yml.
//
// This template is a static config artifact copied verbatim into a consumer's
// .github/workflows/. A byte-for-byte golden test would be tautological (it can
// only assert the file equals itself), so the load-bearing oracle is a set of
// STRUCTURAL PROPERTIES plus a METAMORPHIC/CONTRACT relation: the run command
// the template ships must be a valid invocation of the real ci-verify.mjs it is
// paired with (scripts/ci-verify.mjs is what adapters/install.sh installs as
// .hyperworkflows/ci-verify.mjs). If the template drifts from the script's CLI
// contract, this test fails.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE = join(ROOT, "templates", "hyperworkflows-verify.yml");
const CI_VERIFY = join(ROOT, "scripts", "ci-verify.mjs");

const raw = readFileSync(TEMPLATE, "utf8");
// Non-comment body only (comments start with # at line start / after indent).
const body = raw
  .split("\n")
  .filter((l) => !/^\s*#/.test(l))
  .join("\n");

test("template: workflow name and triggers are the expected E3 gate shape", () => {
  assert.match(body, /^name:\s*hyperworkflows-verify\s*$/m, "workflow name");
  assert.match(body, /^on:/m, "has on: block");
  assert.match(body, /^\s*pull_request:/m, "triggers on pull_request");
  assert.match(body, /^\s*push:/m, "triggers on push");
  assert.match(body, /branches:\s*\[\s*main\s*\]/, "push restricted to main");
});

test("template: single evidence job on ubuntu with pinned checkout + node", () => {
  assert.match(body, /^\s*evidence:/m, "job id 'evidence'");
  assert.match(body, /runs-on:\s*ubuntu-latest/, "runs on ubuntu-latest");
  assert.match(body, /uses:\s*actions\/checkout@v\d+/, "checkout action pinned");
  assert.match(body, /uses:\s*actions\/setup-node@v\d+/, "setup-node action pinned");
  const nodeVer = body.match(/node-version:\s*(\d+)/);
  assert.ok(nodeVer, "node-version is set");
  // Must satisfy package.json engines (>=18.17).
  const engines = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).engines.node;
  const minMajor = Number(engines.replace(/[^\d.]/g, "").split(".")[0]);
  assert.ok(Number(nodeVer[1]) >= minMajor, `node-version ${nodeVer[1]} >= engines min ${minMajor}`);
});

// Extract the ci-verify run invocation from the template.
function templateRunArgs() {
  const m = body.match(/node\s+\.hyperworkflows\/ci-verify\.mjs([^\n]*)/);
  assert.ok(m, "template invokes .hyperworkflows/ci-verify.mjs");
  // strip the leading path token; keep the flags/values after the script name
  return m[1].trim().split(/\s+/).filter(Boolean);
}

test("template: invokes the installed ci-verify.mjs with --dir evidence --require", () => {
  const args = templateRunArgs();
  assert.deepEqual(args, ["--dir", "evidence", "--require"], "exact E3 posture flags");
});

test("metamorphic: template's flags are honoured by the real ci-verify.mjs contract", () => {
  const args = templateRunArgs();
  // Point the invocation at a temp repo with an empty (but present) evidence
  // root. If every flag in the template is recognised by the script, --require
  // makes an empty root FAIL with exit 1 (a *usage* error would be exit 2).
  const dir = mkdtempSync(join(tmpdir(), "hyperworkflows-tmpl-"));
  mkdirSync(join(dir, "evidence"), { recursive: true });
  const r = spawnSync("node", [CI_VERIFY, "--cwd", dir, ...args], { encoding: "utf8", cwd: dir });
  assert.notEqual(r.status, 2, `template flags rejected as usage error by ci-verify: ${r.stderr}`);
  assert.equal(r.status, 1, "empty evidence root under --require fails the gate (not a usage error)");
  assert.match(r.stderr, /no run directories/, "fails for the right reason");
});

test("metamorphic: soft-start (drop --require) turns the same missing-evidence case into a pass", () => {
  // Documents the template's own soft-start note: removing --require must not
  // usage-error and must soft-pass when evidence is absent.
  const args = templateRunArgs().filter((a) => a !== "--require");
  const dir = mkdtempSync(join(tmpdir(), "hyperworkflows-soft-"));
  const r = spawnSync("node", [CI_VERIFY, "--cwd", dir, ...args], { encoding: "utf8", cwd: dir });
  assert.equal(r.status, 0, "soft-start invocation passes with no evidence");
});
