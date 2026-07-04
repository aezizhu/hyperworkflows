import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts");

// Run a hook script with payload + env in an isolated cwd.
function hook(script, payload, cwd, env = {}) {
  const r = spawnSync("sh", [join(SCRIPTS, script)], {
    input: typeof payload === "string" ? payload : JSON.stringify(payload),
    cwd, encoding: "utf8",
    env: { ...process.env, HYPERWORKFLOWS_ENFORCE: "", ...env }
  });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
const tmp = () => mkdtempSync(join(tmpdir(), "hyperworkflows-enforce-"));

// Make a transcript JSONL whose last assistant message is `text`.
function transcript(dir, text) {
  const p = join(dir, "transcript.jsonl");
  writeFileSync(p, [
    JSON.stringify({ type: "user", message: { content: [{ type: "text", text: "do it" }] } }),
    JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text }] } })
  ].join("\n") + "\n");
  return p;
}

// Old-mtime breadcrumb so later verdict files compare strictly newer.
function breadcrumb(dir, sid) {
  mkdirSync(join(dir, "runs", ".sessions"), { recursive: true });
  const p = join(dir, "runs", ".sessions", `${sid}.mutated`);
  writeFileSync(p, "");
  const old = new Date(Date.now() - 3600_000);
  utimesSync(p, old, old);
  return p;
}

// ---------------- level resolution ----------------

test("level: env wins, file second, markers third, clean project = 0", () => {
  const dir = tmp();
  try {
    assert.equal(hook("drumbeat.sh", {}, dir).code, 0);
    assert.equal(hook("drumbeat.sh", {}, dir).out, "");                       // clean => level 0 => silent
    assert.match(hook("drumbeat.sh", {}, dir, { HYPERWORKFLOWS_ENFORCE: "1" }).out, /Hyperworkflows\[E1\]/); // env
    mkdirSync(join(dir, ".hyperworkflows"), { recursive: true });
    assert.match(hook("drumbeat.sh", {}, dir).out, /Hyperworkflows\[E1\]/);   // marker => default 1
    writeFileSync(join(dir, ".hyperworkflows", "enforce"), "2");
    assert.match(hook("drumbeat.sh", {}, dir).out, /Hyperworkflows\[E2\]/);   // file
    assert.equal(hook("drumbeat.sh", {}, dir, { HYPERWORKFLOWS_ENFORCE: "0" }).out, ""); // env overrides file
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------- E1: brief + drumbeat + nudge ----------------

test("brief: ambient only in clean projects; constitution appears at level>=1; E2 line at 2", () => {
  const dir = tmp();
  try {
    const ambient = hook("session-brief.sh", "", dir);
    assert.ok(!/Operating constitution/.test(ambient.out));
    mkdirSync(join(dir, ".hyperworkflows"), { recursive: true });
    const l1 = hook("session-brief.sh", "", dir);
    assert.match(l1.out, /Operating constitution \(enforced project, level 1\)/);
    assert.ok(!/E2 gates armed/.test(l1.out));
    writeFileSync(join(dir, ".hyperworkflows", "enforce"), "2");
    const l2 = hook("session-brief.sh", "", dir);
    assert.match(l2.out, /E2 gates armed/);
    assert.ok(l2.out.split("\n").length < 50);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("nudge: fires once per session on test commands, only at level>=1", () => {
  const dir = tmp();
  const sid = `t${Date.now()}`;
  try {
    const payload = { session_id: sid, tool_input: { command: "npm test -- --run" } };
    assert.equal(hook("nudge.sh", payload, dir).out, "");                     // level 0 => silent
    mkdirSync(join(dir, ".hyperworkflows"), { recursive: true });
    const first = hook("nudge.sh", payload, dir);
    assert.match(first.out, /adjudicate this result from raw exit codes/);
    assert.equal(hook("nudge.sh", payload, dir).out, "");                     // once per session
    assert.equal(hook("nudge.sh", { session_id: `${sid}b`, tool_input: { command: "ls -la" } }, dir).out, ""); // non-test cmd
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(`/tmp/hyperworkflows-nudge-${sid}`, { force: true }); }
});

// ---------------- E2: mutation sensor + stop gate ----------------

test("mutation-sensor: breadcrumb only at level>=2", () => {
  const dir = tmp();
  try {
    hook("mutation-sensor.sh", { session_id: "s1" }, dir, { HYPERWORKFLOWS_ENFORCE: "1" });
    assert.equal(hook("stop-gate.sh", { session_id: "s1", stop_hook_active: false }, dir, { HYPERWORKFLOWS_ENFORCE: "2" }).code, 0); // no breadcrumb was written
    hook("mutation-sensor.sh", { session_id: "s1" }, dir, { HYPERWORKFLOWS_ENFORCE: "2" });
    const r = spawnSync("ls", [join(dir, "runs", ".sessions")], { encoding: "utf8" });
    assert.match(r.stdout, /s1\.mutated/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("stop-gate: blocks once when mutated + no evidence + no disclosure", () => {
  const dir = tmp();
  try {
    breadcrumb(dir, "s2");
    const t = transcript(dir, "All done! Everything works great.");
    const blocked = hook("stop-gate.sh", { session_id: "s2", stop_hook_active: false, transcript_path: t }, dir, { HYPERWORKFLOWS_ENFORCE: "2" });
    assert.equal(blocked.code, 2);
    assert.match(blocked.err, /disclosure mode/);
    // One-bounce: platform marks the continuation; gate must pass.
    const bounced = hook("stop-gate.sh", { session_id: "s2", stop_hook_active: true, transcript_path: t }, dir, { HYPERWORKFLOWS_ENFORCE: "2" });
    assert.equal(bounced.code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("stop-gate: honest UNVERIFIED disclosure always satisfies it", () => {
  const dir = tmp();
  try {
    breadcrumb(dir, "s3");
    const t = transcript(dir, "Changed the parser. UNVERIFIED: no test suite exists for this module yet.");
    assert.equal(hook("stop-gate.sh", { session_id: "s3", stop_hook_active: false, transcript_path: t }, dir, { HYPERWORKFLOWS_ENFORCE: "2" }).code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("stop-gate: verdict evidence newer than the mutation satisfies it", () => {
  const dir = tmp();
  try {
    breadcrumb(dir, "s4");
    mkdirSync(join(dir, "runs", "audit-x", "verdicts"), { recursive: true });
    writeFileSync(join(dir, "runs", "audit-x", "verdicts", "u.json"), "{}"); // now > breadcrumb (1h old)
    const t = transcript(dir, "Done, all verified.");
    assert.equal(hook("stop-gate.sh", { session_id: "s4", stop_hook_active: false, transcript_path: t }, dir, { HYPERWORKFLOWS_ENFORCE: "2" }).code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("stop-gate: inert below level 2, without mutations, and fail-open on garbage", () => {
  const dir = tmp();
  try {
    breadcrumb(dir, "s5");
    const t = transcript(dir, "Done!");
    assert.equal(hook("stop-gate.sh", { session_id: "s5", stop_hook_active: false, transcript_path: t }, dir, { HYPERWORKFLOWS_ENFORCE: "1" }).code, 0); // level 1
    assert.equal(hook("stop-gate.sh", { session_id: "nomut", stop_hook_active: false, transcript_path: t }, dir, { HYPERWORKFLOWS_ENFORCE: "2" }).code, 0); // no breadcrumb
    assert.equal(hook("stop-gate.sh", "not json", dir, { HYPERWORKFLOWS_ENFORCE: "2" }).code, 0); // fail-open
    assert.equal(hook("stop-gate.sh", { session_id: "s5", stop_hook_active: false, transcript_path: join(dir, "missing.jsonl") }, dir, { HYPERWORKFLOWS_ENFORCE: "2" }).code, 0); // no transcript => fail-open
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
