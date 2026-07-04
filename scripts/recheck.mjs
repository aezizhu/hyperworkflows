#!/usr/bin/env node
// Hyperworkflows recheck: re-execute every recorded evidence command and diff exit codes.
// Zero LLM calls — this is what makes an Hyperworkflows report falsifiable (constitution C4).
//
// Usage: node recheck.mjs <runs/<run-id> | verdicts-dir> [--cwd <repo-root>] [--timeout <seconds>]
// Exit codes: 0 = all evidence reproduces; 1 = drift detected; 2 = usage/IO error.
//
// Canonical verdict file schema (runs/<id>/verdicts/*.json):
// {
//   "unit": "src/foo.ts", "head": "abc1234", "depth": "D1", "verdict": "PASS",
//   "probes": [{ "cmd": "npm test -- foo", "expect_exit": 0, "exit": 0 }],
//   "agent_label": "verify:src/foo.ts", "ts": "2026-07-04T17:00:00+08:00"
// }

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

function usage(msg) {
  if (msg) console.error(`recheck: ${msg}`);
  console.error("usage: node recheck.mjs <runs/<run-id> | verdicts-dir> [--cwd <repo-root>] [--timeout <seconds>]");
  process.exit(2);
}

const argv = process.argv.slice(2);
if (!argv.length) usage();
let target = null, cwd = process.cwd(), timeoutSec = 120;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--cwd") cwd = resolve(argv[++i]);
  else if (argv[i] === "--timeout") timeoutSec = Number(argv[++i]) || 120;
  else if (!target) target = argv[i];
  else usage(`unexpected argument: ${argv[i]}`);
}
if (!target) usage("missing target directory");

let dir = resolve(target);
if (existsSync(join(dir, "verdicts"))) dir = join(dir, "verdicts");
if (!existsSync(dir) || !statSync(dir).isDirectory()) usage(`not a directory: ${dir}`);

const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();
if (!files.length) usage(`no verdict files in ${dir}`);

let checked = 0, matched = 0;
const drifts = [], errors = [];

for (const f of files) {
  let v;
  try { v = JSON.parse(readFileSync(join(dir, f), "utf8")); }
  catch (e) { errors.push({ file: f, error: `unparseable JSON: ${e.message}` }); continue; }
  for (const p of v.probes || []) {
    checked++;
    // Sequential, shell-executed, per-command timeout. Determinism over speed.
    const r = spawnSync(p.cmd, { shell: true, cwd, timeout: timeoutSec * 1000, stdio: ["ignore", "ignore", "ignore"] });
    const actual = r.error && r.error.code === "ETIMEDOUT" ? "TIMEOUT" : (r.status === null ? "KILLED" : r.status);
    const recorded = p.exit;
    if (actual === recorded) { matched++; }
    else drifts.push({ file: f, unit: v.unit, cmd: p.cmd, recorded, actual, expect_exit: p.expect_exit });
  }
}

const report = {
  dir, cwd, checked, matched,
  drifted: drifts.length, unparseable: errors.length,
  drifts, errors,
  conclusion: drifts.length === 0 && errors.length === 0
    ? "ALL EVIDENCE REPRODUCES — the report still holds at this working tree."
    : "DRIFT DETECTED — the report's evidence no longer reproduces; treat affected claims as stale."
};
process.stdout.write(JSON.stringify(report, null, 2) + "\n");
process.exit(drifts.length || errors.length ? 1 : 0);
