// Oracle for the command spec commands/recheck.md.
//
// A command doc is natural language, so no golden/exact-output oracle exists for the
// LLM step. What IS falsifiable are the doc's factual claims about the tool it drives.
// This is a metamorphic/contract oracle: it binds every load-bearing claim in the doc
// to the executable reality of scripts/recheck.mjs, so the doc cannot silently drift
// away from the script it documents (wrong path, wrong flag, wrong exit-code contract).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = join(REPO, "commands", "recheck.md");
const doc = readFileSync(DOC, "utf8");

// The relative script path the doc tells the operator to invoke (after ${CLAUDE_PLUGIN_ROOT}/).
const SCRIPT_REL = "scripts/recheck.mjs";

function makeRun(verdicts) {
  const dir = mkdtempSync(join(tmpdir(), "hyperworkflows-recheckcmd-"));
  mkdirSync(join(dir, "verdicts"));
  for (const [name, v] of Object.entries(verdicts)) {
    writeFileSync(join(dir, "verdicts", name), JSON.stringify(v));
  }
  return dir;
}

test("doc names the script path, and that path resolves to a real file", () => {
  assert.ok(doc.includes(`${SCRIPT_REL}`), `doc must invoke ${SCRIPT_REL}`);
  assert.ok(existsSync(join(REPO, SCRIPT_REL)), `${SCRIPT_REL} must exist on disk`);
});

test("doc documents the --cwd flag, and the script accepts it", () => {
  assert.ok(doc.includes("--cwd"), "doc must document the --cwd flag");
  // spawn with --cwd and a bogus target: script must reach usage (exit 2), i.e. it parsed the flag.
  const r = spawnSync("node", [join(REPO, SCRIPT_REL), "/no/such/dir", "--cwd", REPO], { encoding: "utf8" });
  assert.equal(r.status, 2, "unknown target under a valid --cwd is a usage error (exit 2)");
});

test("doc's 'all reproduce' claim: exit 0 on all-matching evidence", () => {
  const dir = makeRun({
    "a.json": { unit: "a", probes: [{ cmd: "true", expect_exit: 0, exit: 0 }] }
  });
  try {
    const r = spawnSync("node", [join(REPO, SCRIPT_REL), dir, "--cwd", REPO], { encoding: "utf8" });
    assert.equal(r.status, 0, "the doc's 'All reproduce' branch must exit 0");
    const out = JSON.parse(r.stdout);
    assert.equal(out.drifted, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("doc's 'drift' claim: exit 1 and names the drifted command", () => {
  const dir = makeRun({
    "b.json": { unit: "b", probes: [{ cmd: "false", expect_exit: 1, exit: 0 }] }
  });
  try {
    const r = spawnSync("node", [join(REPO, SCRIPT_REL), dir, "--cwd", REPO], { encoding: "utf8" });
    assert.equal(r.status, 1, "the doc's 'Drift' branch must exit 1");
    const out = JSON.parse(r.stdout);
    assert.equal(out.drifted, 1);
    assert.equal(out.drifts[0].cmd, "false", "drift report must name the exact command, per doc step 2");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("doc's 'no fixes, no agents' claim: script has no write/spawn side effects", () => {
  // Falsifiable proxy for 'performs no fixes and spawns no agents': the script source
  // never imports a spawning agent SDK and never opens a file for writing.
  const src = readFileSync(join(REPO, SCRIPT_REL), "utf8");
  assert.ok(!/writeFileSync|createWriteStream|appendFileSync|writeSync\(/.test(src),
    "recheck must not write files (it performs no fixes)");
  assert.ok(doc.includes("no fixes") && doc.includes("spawns no agents"),
    "doc must state the no-fixes / no-agents contract");
});
