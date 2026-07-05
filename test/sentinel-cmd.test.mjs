import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Oracle for commands/sentinel.md — a natural-language slash-command spec.
// Regression class guarded: doc rot / dangling references / drifted factual
// claims. Each assertion pins a load-bearing claim in the doc to the artifact
// it references, so renaming/removing/retiming an artifact fails this test.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = readFileSync(join(ROOT, "commands", "sentinel.md"), "utf8");

test("sentinel.md: documented argument-hint modes are recognized by the engine", () => {
  const hint = DOC.match(/argument-hint:\s*"\[([^\]]+)\]"/);
  assert.ok(hint, "frontmatter argument-hint present");
  const modes = hint[1].split("|").map((s) => s.trim());
  assert.deepEqual(modes, ["merge", "nightly", "weekly", "install"]);

  const engine = readFileSync(join(ROOT, "workflows", "hypersentinel.js"), "utf8");
  for (const mode of ["merge", "nightly", "weekly"]) {
    assert.match(engine, new RegExp(`\\b${mode}\\b`), `engine handles mode ${mode}`);
  }
  // `install` is a doc-only branch, not an engine mode.
  assert.match(DOC, /If the argument is `install`/);
});

test("sentinel.md: every referenced scripts/ and workflows/ path resolves", () => {
  const refs = new Set(
    [...DOC.matchAll(/(?:scripts|workflows)\/[A-Za-z0-9._-]+/g)].map((m) => m[0]),
  );
  assert.ok(refs.size >= 2, "doc references at least the install script + engine");
  for (const rel of refs) {
    assert.ok(existsSync(join(ROOT, rel)), `dangling reference: ${rel}`);
  }
});

test("sentinel.md: install claims match sentinel-install.sh behavior", () => {
  // Doc: install runs sentinel-install.sh and shows "three scheduling options",
  // with --install-launchd only for explicit option A.
  assert.match(DOC, /sentinel-install\.sh/);
  assert.match(DOC, /three scheduling options/);
  assert.match(DOC, /--install-launchd/);

  const r = spawnSync("sh", [join(ROOT, "scripts", "sentinel-install.sh")], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const options = (r.stdout.match(/=== Option [A-C]/g) || []).length;
  assert.equal(options, 3, "default output shows exactly three scheduling options");
  assert.match(r.stdout, /--install-launchd/, "option A exposes the launchd flag");
});

test("sentinel.md: 02:30 launchd time claim matches the plist template", () => {
  // Doc: "the launchd job fires at 02:30 machine-local time".
  assert.match(DOC, /02:30/);
  const install = readFileSync(join(ROOT, "scripts", "sentinel-install.sh"), "utf8");
  assert.match(install, /<key>Hour<\/key><integer>2<\/integer>/);
  assert.match(install, /<key>Minute<\/key><integer>30<\/integer>/);
});

test("sentinel.md: headless ceiling env var is actually set where the doc claims", () => {
  // Doc: "run-detached.sh and the launchd template set
  // CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0".
  const VAR = "CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS";
  assert.match(DOC, new RegExp(`${VAR}=0`));

  const detached = readFileSync(join(ROOT, "scripts", "run-detached.sh"), "utf8");
  assert.match(detached, new RegExp(VAR), "run-detached.sh sets the ceiling var");

  const install = readFileSync(join(ROOT, "scripts", "sentinel-install.sh"), "utf8");
  assert.match(install, new RegExp(`${VAR}=0`), "launchd template sets the ceiling var");
});

test("sentinel.md: run-lifecycle state files are named consistently", () => {
  // Doc writes runs/ACTIVE on start (step 1) and removes it on finish (step 4).
  assert.match(DOC, /write `runs\/ACTIVE`/);
  assert.match(DOC, /remove `runs\/ACTIVE`/);
  // Baseline file name is referenced consistently.
  const baseline = [...DOC.matchAll(/memory\/last-good\.json/g)];
  assert.ok(baseline.length >= 2, "baseline file referenced by advance rules");
});
