import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPTS = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts");

// Run a hook script with a JSON payload on stdin, in an isolated cwd.
function hook(script, payload, cwd) {
  const r = spawnSync("sh", [join(SCRIPTS, script)], { input: JSON.stringify(payload), cwd, encoding: "utf8" });
  return { code: r.status, err: r.stderr };
}
const bash = cmd => ({ tool_input: { command: cmd } });
const tmp = () => mkdtempSync(join(tmpdir(), "hyperworkflows-hook-"));

test("guard: blocks force push variants", () => {
  const dir = tmp();
  try {
    assert.equal(hook("guard.sh", bash("git push --force origin main"), dir).code, 2);
    assert.equal(hook("guard.sh", bash("git push --force-with-lease origin main"), dir).code, 2);
    assert.equal(hook("guard.sh", bash("git push -f origin main"), dir).code, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("guard: passes ordinary commands and sanctioned deletes", () => {
  const dir = tmp();
  try {
    assert.equal(hook("guard.sh", bash("ls -la"), dir).code, 0);
    assert.equal(hook("guard.sh", bash("git push origin feature-x"), dir).code, 0);
    assert.equal(hook("guard.sh", bash("rm -rf /tmp/scratch"), dir).code, 0);
    assert.equal(hook("guard.sh", bash("rm -rf node_modules"), dir).code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("guard: blocks recursive delete outside sanctioned areas and history rewrites", () => {
  const dir = tmp();
  try {
    assert.equal(hook("guard.sh", bash("rm -rf src/"), dir).code, 2);
    assert.equal(hook("guard.sh", bash("git filter-branch --all"), dir).code, 2);
    assert.equal(hook("guard.sh", bash("dd if=/dev/zero of=/dev/disk2"), dir).code, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("guard: MERGE_TOKEN protocol gates merge/push only while a run is active", () => {
  const dir = tmp();
  try {
    // No active run: merge passes.
    assert.equal(hook("guard.sh", bash("git merge feature-x"), dir).code, 0);
    // Active run without token: blocked.
    mkdirSync(join(dir, "runs", "r1"), { recursive: true });
    writeFileSync(join(dir, "runs", "ACTIVE"), "r1");
    const blocked = hook("guard.sh", bash("git merge feature-x"), dir);
    assert.equal(blocked.code, 2);
    assert.match(blocked.err, /MERGE_TOKEN/);
    // Token present: allowed.
    writeFileSync(join(dir, "runs", "r1", "MERGE_TOKEN"), "");
    assert.equal(hook("guard.sh", bash("git merge feature-x"), dir).code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("guard: malformed payload never blocks (fail-open for the deny wall parser)", () => {
  const dir = tmp();
  try {
    const r = spawnSync("sh", [join(SCRIPTS, "guard.sh")], { input: "not json", cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("sensor: appends a journal line only when a run is active", () => {
  const dir = tmp();
  try {
    assert.equal(hook("sensor.sh", { hook_event_name: "SubagentStop", agent_type: "hyperworkflows-verifier" }, dir).code, 0);
    assert.equal(existsSync(join(dir, "runs")), false); // inert without ACTIVE
    mkdirSync(join(dir, "runs", "r1"), { recursive: true });
    writeFileSync(join(dir, "runs", "ACTIVE"), "r1");
    assert.equal(hook("sensor.sh", { hook_event_name: "SubagentStop", agent_type: "hyperworkflows-verifier", agent_id: "x1" }, dir).code, 0);
    const line = JSON.parse(readFileSync(join(dir, "runs", "r1", "events.jsonl"), "utf8").trim());
    assert.equal(line.agent, "hyperworkflows-verifier");
    assert.match(line.ts, /\+08:00$/); // Asia/Singapore journal timestamps
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("task-gate: blocks court rulings without evidence, passes with it, inert outside court", () => {
  const dir = tmp();
  try {
    // Inert without court marker.
    mkdirSync(join(dir, "runs", "r1", "verdicts"), { recursive: true });
    writeFileSync(join(dir, "runs", "ACTIVE"), "r1");
    assert.equal(hook("task-gate.sh", { task_id: "42" }, dir).code, 0);
    // Court in session: no evidence -> blocked.
    writeFileSync(join(dir, "runs", "r1", "COURT"), "");
    const blocked = hook("task-gate.sh", { task_id: "42" }, dir);
    assert.equal(blocked.code, 2);
    assert.match(blocked.err, /task-42\.json/);
    // Evidence present -> passes.
    writeFileSync(join(dir, "runs", "r1", "verdicts", "task-42.json"), "{}");
    assert.equal(hook("task-gate.sh", { task_id: "42" }, dir).code, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("session-brief: renders under 50 lines and flags active runs", () => {
  const dir = tmp();
  try {
    mkdirSync(join(dir, "runs"), { recursive: true });
    writeFileSync(join(dir, "runs", "ACTIVE"), "r9");
    const r = spawnSync("sh", [join(SCRIPTS, "session-brief.sh")], { cwd: dir, encoding: "utf8" });
    assert.equal(r.status, 0);
    assert.ok(r.stdout.split("\n").length < 50);
    assert.match(r.stdout, /ACTIVE Hyperworkflows RUN: r9/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
