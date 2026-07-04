#!/usr/bin/env node
// Hyperworkflows E3 gate: verify committed evidence in CI with zero LLM calls.
// For every run directory under the evidence root: validate verdict schemas
// (validateVerdict) and re-execute every recorded probe (runRecheck).
//
// Usage: node ci-verify.mjs [--dir evidence] [--cwd <repo-root>] [--timeout <seconds>] [--require]
//
// Behavior without evidence: soft-pass with a NOTICE (so adopting the workflow
// never breaks a repo overnight). With --require (or HYPERWORKFLOWS_REQUIRE_EVIDENCE=1),
// missing evidence is a failure — that is the "required status check" posture.
// Exit codes: 0 = pass; 1 = schema errors, drift, or missing-but-required; 2 = usage.

import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runRecheck } from "./recheck.mjs";
import { validateVerdict } from "./adjudicate.mjs";

function usage(msg) {
  if (msg) console.error(`ci-verify: ${msg}`);
  console.error("usage: node ci-verify.mjs [--dir evidence] [--cwd <repo-root>] [--timeout <seconds>] [--require]");
  process.exit(2);
}

const argv = process.argv.slice(2);
let evidenceDir = "evidence", cwd = process.cwd(), timeoutSec = 120;
let required = process.env.HYPERWORKFLOWS_REQUIRE_EVIDENCE === "1";
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--dir") evidenceDir = argv[++i];
  else if (argv[i] === "--cwd") cwd = resolve(argv[++i]);
  else if (argv[i] === "--timeout") timeoutSec = Number(argv[++i]) || 120;
  else if (argv[i] === "--require") required = true;
  else usage(`unexpected argument: ${argv[i]}`);
}

const root = resolve(cwd, evidenceDir);
if (!existsSync(root) || !statSync(root).isDirectory()) {
  if (required) {
    console.error(`ci-verify: FAIL — evidence root '${evidenceDir}' does not exist and evidence is required.`);
    console.error("Produce evidence with a Hyperworkflows audit/apply run and commit its verdicts to the evidence root.");
    process.exit(1);
  }
  console.log(JSON.stringify({ notice: `no evidence root '${evidenceDir}' — soft pass (use --require to make evidence mandatory)`, pass: true }, null, 2));
  process.exit(0);
}

// A run dir is any directory containing verdicts/ (or being a bare verdicts dir).
const runDirs = readdirSync(root)
  .map(d => join(root, d))
  .filter(d => statSync(d).isDirectory() && (existsSync(join(d, "verdicts")) || readdirSync(d).some(f => f.endsWith(".json"))))
  .sort();
if (!runDirs.length && existsSync(join(root, "verdicts"))) runDirs.push(root);
if (!runDirs.length) {
  if (required) { console.error(`ci-verify: FAIL — evidence root '${evidenceDir}' contains no run directories.`); process.exit(1); }
  console.log(JSON.stringify({ notice: `evidence root '${evidenceDir}' is empty — soft pass`, pass: true }, null, 2));
  process.exit(0);
}

const runs = [];
let fatal = 0;
for (const dir of runDirs) {
  const vDir = existsSync(join(dir, "verdicts")) ? join(dir, "verdicts") : dir;
  const schema_errors = [], schema_warnings = [];
  for (const f of readdirSync(vDir).filter(f => f.endsWith(".json")).sort()) {
    try {
      const res = validateVerdict(JSON.parse(readFileSync(join(vDir, f), "utf8")));
      if (!res.ok) schema_errors.push({ file: f, errors: res.errors });
      if (res.warnings.length) schema_warnings.push({ file: f, warnings: res.warnings });
    } catch (e) { schema_errors.push({ file: f, errors: [`unparseable JSON: ${e.message}`] }); }
  }
  let recheck = null;
  try { recheck = runRecheck(dir, { cwd, timeoutSec }); }
  catch (e) { schema_errors.push({ file: "(run)", errors: [e.message] }); }
  const ok = schema_errors.length === 0 && recheck && recheck.drifted === 0 && recheck.unparseable === 0;
  if (!ok) fatal++;
  runs.push({
    dir, ok,
    schema_errors, schema_warnings,
    checked: recheck ? recheck.checked : 0,
    matched: recheck ? recheck.matched : 0,
    drifts: recheck ? recheck.drifts : []
  });
}

const report = {
  evidence_root: root,
  runs,
  pass: fatal === 0,
  conclusion: fatal === 0
    ? `ALL EVIDENCE VERIFIES: ${runs.length} run(s), every schema valid, every probe reproduces.`
    : `EVIDENCE FAILURE: ${fatal}/${runs.length} run(s) have schema errors or drifted probes — the claims they back are not trustworthy as committed.`
};
console.log(JSON.stringify(report, null, 2));
process.exit(fatal ? 1 : 0);
