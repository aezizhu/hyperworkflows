// Oracle for the grey unit `enforcement-design.md`.
//
// A design-rationale essay has no natural executable acceptance, and a golden/snapshot
// of the prose would be a tautology (it only re-asserts the bytes are unchanged). The
// strongest FEASIBLE oracle is a doc<->implementation fidelity property test: the doc's
// concrete, machine-checkable claims must hold against the SHIPPED enforcement scripts.
// This has real discriminating power in both directions:
//   - edit the doc to claim something the code doesn't do  -> test fails
//   - drift the code away from what the doc documents       -> test fails
//
// Every assertion below was measured to pass on the current tree before this file was
// committed. No production code is touched.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, "scripts");
const DOC = readFileSync(join(ROOT, "enforcement-design.md"), "utf8");

// Run a hook script with a payload + env from an isolated cwd.
function run(script, payload, cwd, env = {}) {
  const r = spawnSync("sh", [join(SCRIPTS, script)], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    cwd, encoding: "utf8",
    env: { ...process.env, HYPERWORKFLOWS_ENFORCE: "", ...env }
  });
  return { code: r.status, out: r.stdout || "", err: r.stderr || "" };
}
const nonEmptyLines = (s) => s.split("\n").filter((l) => l.trim() !== "").length;
const tmp = () => mkdtempSync(join(tmpdir(), "hw-design-"));
function initProject(level) {
  const d = tmp();
  mkdirSync(join(d, ".hyperworkflows"), { recursive: true });
  if (level !== undefined) writeFileSync(join(d, ".hyperworkflows", "enforce"), String(level));
  return d;
}

// ---------------------------------------------------------------------------
// Claim (doc header + §7): the ladder names exactly E0/E1/E2/E3, and every
// mechanism the ladder cites ships as a real script in the repo.
// ---------------------------------------------------------------------------
test("ladder E0-E3 documented and its cited mechanisms exist as scripts", () => {
  for (const level of ["E0", "E1", "E2", "E3"]) {
    assert.ok(DOC.includes(level), `doc must name ladder level ${level}`);
  }
  // Scripts the doc leans on by behavior (recheck/adjudicate named in §4/§6; the
  // salience + gate mechanisms are the session-brief / drumbeat / stop-gate hooks).
  for (const s of ["recheck.mjs", "adjudicate.mjs", "session-brief.sh", "drumbeat.sh", "stop-gate.sh"]) {
    assert.ok(existsSync(join(SCRIPTS, s)), `referenced mechanism ${s} must exist`);
  }
});

// ---------------------------------------------------------------------------
// Claim (§3 "E1 <= 30 lines", §7 "Hard line caps (E1 <= 30 ...)"): the E1
// constitutional injection is capped. Bind the NUMBER the doc states to the
// actual line count emitted by session-brief.sh at level >= 1.
// ---------------------------------------------------------------------------
test("E1 constitutional injection honors the doc's stated line cap", () => {
  const m = DOC.match(/E1\s*(?:≤|<=)\s*(\d+)\s*lines/i);
  assert.ok(m, "doc must state an explicit 'E1 <= N lines' cap");
  const cap = Number(m[1]);
  assert.equal(cap, 30, "the documented E1 cap is 30 lines");

  for (const level of [1, 2]) {
    const d = initProject(level);
    try {
      const { out } = run("session-brief.sh", {}, d);
      const idx = out.indexOf("### Operating constitution");
      assert.ok(idx >= 0, `constitution block must appear at level ${level}`);
      const block = out.slice(idx);
      const lines = nonEmptyLines(block);
      assert.ok(lines <= cap, `constitution block is ${lines} lines, must be <= ${cap}`);
    } finally { rmSync(d, { recursive: true, force: true }); }
  }
});

// ---------------------------------------------------------------------------
// Claim (§3 "inject ONE line per turn", §7 "drumbeat <= 2"): the per-turn
// drumbeat is at most the documented cap, and is silent in clean projects.
// ---------------------------------------------------------------------------
test("drumbeat honors the doc's stated line cap and is silent when unenforced", () => {
  const m = DOC.match(/drumbeat\s*(?:≤|<=)\s*(\d+)/i);
  assert.ok(m, "doc must state an explicit drumbeat line cap");
  const cap = Number(m[1]);
  assert.equal(cap, 2, "the documented drumbeat cap is 2 lines");

  const clean = tmp();
  try {
    assert.equal(run("drumbeat.sh", {}, clean).out, "", "clean project => no drumbeat");
  } finally { rmSync(clean, { recursive: true, force: true }); }

  const d = initProject(1);
  try {
    const { out } = run("drumbeat.sh", {}, d);
    const lines = nonEmptyLines(out);
    assert.ok(lines >= 1 && lines <= cap, `drumbeat is ${lines} lines, must be 1..${cap}`);
    assert.match(out, /Hyperworkflows\[E1\]/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// Claim (§5 consent architecture): three levels 0/1/2; enforcement keys off
// `.hyperworkflows/` presence; "Default for initialized projects: 1"; env var
// HYPERWORKFLOWS_ENFORCE selects the level. Bind to lib-enforce.sh resolution
// (observed via drumbeat's E-tag, which prints the resolved level).
// ---------------------------------------------------------------------------
test("level model matches doc: default 1 for initialized, env overrides, clean = silent", () => {
  assert.match(DOC, /HYPERWORKFLOWS_ENFORCE/);
  assert.match(DOC, /Default for initialized projects:\s*1/);

  const clean = tmp();
  try {
    // clean project -> level 0 -> silent
    assert.equal(run("drumbeat.sh", {}, clean).out, "");
    // env can force a level even without a marker
    assert.match(run("drumbeat.sh", {}, clean, { HYPERWORKFLOWS_ENFORCE: "1" }).out, /Hyperworkflows\[E1\]/);
  } finally { rmSync(clean, { recursive: true, force: true }); }

  const init = initProject(); // marker only, no explicit level
  try {
    assert.match(run("drumbeat.sh", {}, init).out, /Hyperworkflows\[E1\]/, "marker => default level 1");
    // explicit file level 2
    writeFileSync(join(init, ".hyperworkflows", "enforce"), "2");
    assert.match(run("drumbeat.sh", {}, init).out, /Hyperworkflows\[E2\]/);
    // env 0 overrides the file back to silent
    assert.equal(run("drumbeat.sh", {}, init, { HYPERWORKFLOWS_ENFORCE: "0" }).out, "");
  } finally { rmSync(init, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------
// Claim (§4 + §7 + §8): the E2 Stop gate is DISCLOSURE-mode, one-bounce, and
// disclosure is always a legal exit. Verify each documented property against
// stop-gate.sh behavior.
// ---------------------------------------------------------------------------
function transcript(dir, text) {
  const p = join(dir, "transcript.jsonl");
  writeFileSync(p, [
    JSON.stringify({ type: "user", message: { content: [{ type: "text", text: "do it" }] } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text }] } })
  ].join("\n") + "\n");
  return p;
}
function breadcrumb(dir, sid) {
  mkdirSync(join(dir, "runs", ".sessions"), { recursive: true });
  const p = join(dir, "runs", ".sessions", `${sid}.mutated`);
  writeFileSync(p, "");
  const old = new Date(Date.now() - 3600_000);
  utimesSync(p, old, old);
}

test("Stop gate is disclosure-mode and one-bounce, exactly as the doc claims", () => {
  assert.match(DOC, /[Dd]isclosure-mode Stop gate/);
  assert.match(DOC, /[Oo]ne-bounce/);
  assert.match(DOC, /UNVERIFIED/);

  const SID = "sess-design-1";
  const d = initProject(2);
  try {
    // (a) No mutation breadcrumb => Q&A/planning never gated.
    const tp0 = transcript(d, "here is my analysis, no files touched");
    assert.equal(run("stop-gate.sh", { session_id: SID, stop_hook_active: false, transcript_path: tp0 }, d).code, 0,
      "no mutations => gate must not fire");

    // Now simulate a file-editing session.
    breadcrumb(d, SID);

    // (b) Undisclosed + no verdict => bounce once (exit 2).
    const tpBad = transcript(d, "I made the change and it works great");
    const bad = run("stop-gate.sh", { session_id: SID, stop_hook_active: false, transcript_path: tpBad }, d);
    assert.equal(bad.code, 2, "edited files, no evidence, no disclosure => exit 2");
    assert.match(bad.err, /disclosure mode/i);

    // (c) Disclosure is always legal: last message says UNVERIFIED => pass.
    const tpDisc = transcript(d, "The edits are UNVERIFIED — I did not run acceptance.");
    assert.equal(run("stop-gate.sh", { session_id: SID, stop_hook_active: false, transcript_path: tpDisc }, d).code, 0,
      "honest UNVERIFIED disclosure satisfies the gate");

    // (d) One-bounce: stop_hook_active=true always passes (cannot loop).
    assert.equal(run("stop-gate.sh", { session_id: SID, stop_hook_active: true, transcript_path: tpBad }, d).code, 0,
      "one-bounce: a second Stop always passes");
  } finally { rmSync(d, { recursive: true, force: true }); }
});
