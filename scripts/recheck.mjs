#!/usr/bin/env node
// Hyperworkflows recheck: re-execute every recorded evidence command and diff exit codes.
// Zero LLM calls — this is what makes a Hyperworkflows report falsifiable (constitution C4).
//
// CLI:    node recheck.mjs <runs/<run-id> | verdicts-dir> [--cwd <repo-root>] [--timeout <seconds>]
// Module: import { runRecheck } from "./recheck.mjs"   (used by ci-verify.mjs)
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
import { fileURLToPath } from "node:url";

// Re-execute all evidence under a run dir (or a bare verdicts dir).
// Returns the report object; throws Error with .usage=true on bad input.
export function runRecheck(target, { cwd = process.cwd(), timeoutSec = 120 } = {}) {
  let dir = resolve(target);
  if (existsSync(join(dir, "verdicts"))) dir = join(dir, "verdicts");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    const e = new Error(`not a directory: ${dir}`); e.usage = true; throw e;
  }
  const files = readdirSync(dir).filter(f => f.endsWith(".json")).sort();
  if (!files.length) { const e = new Error(`no verdict files in ${dir}`); e.usage = true; throw e; }

  let checked = 0, matched = 0;
  const drifts = [], errors = [];
  for (const f of files) {
    let v;
    try { v = JSON.parse(readFileSync(join(dir, f), "utf8")); }
    catch (e) { errors.push({ file: f, error: `unparseable JSON: ${e.message}` }); continue; }
    // audit-13d2374 group D: malformed probes crashed instead of erroring cleanly.
    if (!Array.isArray(v.probes) || v.probes.some(p => !p || typeof p.cmd !== "string")) {
      errors.push({ file: f, error: "malformed verdict: probes must be an array of {cmd, expect_exit, exit}" });
      continue;
    }
    for (const p of v.probes) {
      checked++;
      // Sequential, shell-executed, per-command timeout. Determinism over speed.
      const r = spawnSync(p.cmd, { shell: true, cwd, timeout: timeoutSec * 1000, stdio: ["ignore", "ignore", "ignore"] });
      const actual = r.error && r.error.code === "ETIMEDOUT" ? "TIMEOUT" : (r.status === null ? "KILLED" : r.status);
      if (actual === p.exit) { matched++; }
      else drifts.push({ file: f, unit: v.unit, cmd: p.cmd, recorded: p.exit, actual, expect_exit: p.expect_exit });
    }
  }
  return {
    dir, cwd, checked, matched,
    drifted: drifts.length, unparseable: errors.length,
    drifts, errors,
    conclusion: drifts.length === 0 && errors.length === 0
      ? "ALL EVIDENCE REPRODUCES — the report still holds at this working tree."
      : "DRIFT DETECTED — the report's evidence no longer reproduces; treat affected claims as stale."
  };
}

// ---------------------------------------------------------------- CLI ------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const usage = (msg) => {
    if (msg) console.error(`recheck: ${msg}`);
    console.error("usage: node recheck.mjs <runs/<run-id> | verdicts-dir> [--cwd <repo-root>] [--timeout <seconds>]");
    process.exit(2);
  };
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
  let report;
  try { report = runRecheck(target, { cwd, timeoutSec }); }
  catch (e) { if (e.usage) usage(e.message); else throw e; }
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(report.drifted || report.unparseable ? 1 : 0);
}
