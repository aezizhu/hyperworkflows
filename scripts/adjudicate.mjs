#!/usr/bin/env node
// Hyperworkflows deterministic adjudication library + CLI. Node >= 18, zero dependencies.
// Constitution C2: this is the ONLY place verdicts are computed. LLMs report raw
// exit codes; these pure functions turn them into verdicts. The same logic is
// inlined into the workflow engines (the workflow runtime cannot import modules);
// this module is the canonical source for hooks, commands, and recheck.

// --- adjudicate(probes, exitCodes) -> { pass, results, failures } ---------------
// probes:    [{ cmd, expect_exit }]
// exitCodes: [{ cmd, exit }]  (raw, as reported by a verifier)
export function adjudicate(probes, exitCodes) {
  const byCmd = new Map();
  for (const e of exitCodes || []) if (!byCmd.has(e.cmd)) byCmd.set(e.cmd, e.exit);
  const results = (probes || []).map(p => {
    const exit = byCmd.has(p.cmd) ? byCmd.get(p.cmd) : null;
    return { cmd: p.cmd, expect_exit: p.expect_exit, exit, ok: exit !== null && exit === p.expect_exit };
  });
  const failures = results.filter(r => !r.ok);
  return { pass: results.length > 0 && failures.length === 0, results, failures };
}

// --- failureSignature(exitCodes) -> stable short hash ---------------------------
// Same set of failing (cmd, exit) pairs => same signature, regardless of order.
export function failureSignature(exitCodes) {
  const norm = (exitCodes || [])
    .map(e => `${e.cmd}::${e.exit}`)
    .sort()
    .join("|");
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h * 33) ^ norm.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

// --- reconcileUnits(enumerations) -> { units, disputed } -------------------------
// enumerations: array of { units: [{ id, path, ... }] } from independent enumerators.
// Consensus: a path listed by >= 2 enumerators. Disputed: listed by exactly 1.
export function reconcileUnits(enumerations) {
  const seen = new Map(); // path -> { count, unit }
  for (const e of enumerations || []) {
    const paths = new Set();
    for (const u of (e && e.units) || []) {
      if (!u || !u.path || paths.has(u.path)) continue;
      paths.add(u.path);
      const rec = seen.get(u.path);
      if (rec) rec.count += 1;
      else seen.set(u.path, { count: 1, unit: u });
    }
  }
  const units = [], disputed = [];
  for (const [, rec] of [...seen.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    (rec.count >= 2 ? units : disputed).push(rec.unit);
  }
  return { units, disputed };
}

// --- selectWinner(entries) -> entry | null ---------------------------------------
// Deterministic comparator on the C8 depth ladder, lexicographic:
// PASS status > fewer confirmed attacker findings > higher mutation score >
// better bench score > fewer repair rounds > branch name (total order tiebreak).
export function selectWinner(entries) {
  const green = (entries || []).filter(e => e && e.status === "PASS");
  if (!green.length) return null;
  const num = (v, fallback) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
  return green.slice().sort((a, b) =>
    (num(a.confirmed_findings, Infinity) - num(b.confirmed_findings, Infinity)) ||
    (num(b.mutation_score, -1) - num(a.mutation_score, -1)) ||
    (num(b.bench_score, -1) - num(a.bench_score, -1)) ||
    (num(a.rounds, Infinity) - num(b.rounds, Infinity)) ||
    String(a.build && a.build.branch).localeCompare(String(b.build && b.build.branch))
  )[0];
}

// --- levelsOf(groups) -> [[group]] ordered by level ------------------------------
export function levelsOf(groups) {
  const byLevel = new Map();
  for (const g of groups || []) {
    const l = Number.isFinite(g.level) ? g.level : 0;
    if (!byLevel.has(l)) byLevel.set(l, []);
    byLevel.get(l).push(g);
  }
  return [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([, gs]) =>
    gs.slice().sort((x, y) => String(x.id).localeCompare(String(y.id))));
}

// --- sortByPath(units) ------------------------------------------------------------
export function sortByPath(units) {
  return (units || []).slice().sort((a, b) => String(a.path).localeCompare(String(b.path)));
}

// --- slug(s) -> filesystem-safe identifier ----------------------------------------
export function slug(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]/g, "_");
}

// --- validateVerdict(v) -> { ok, errors, warnings } --------------------------------
// Canonical verdict schema check. Core fields are errors (CI-fatal); metadata
// fields are warnings (reported, non-fatal).
export function validateVerdict(v) {
  const errors = [], warnings = [];
  if (!v || typeof v !== "object") return { ok: false, errors: ["not an object"], warnings };
  if (typeof v.unit !== "string" || !v.unit) errors.push("unit: required string");
  if (typeof v.verdict !== "string" || !v.verdict) errors.push("verdict: required string");
  if (!Array.isArray(v.probes) || v.probes.length === 0) errors.push("probes: required non-empty array");
  else v.probes.forEach((p, i) => {
    if (!p || typeof p.cmd !== "string" || !p.cmd) errors.push(`probes[${i}].cmd: required string`);
    if (typeof p.expect_exit !== "number") errors.push(`probes[${i}].expect_exit: required number`);
    if (typeof p.exit !== "number") errors.push(`probes[${i}].exit: required number (raw recorded exit)`);
  });
  for (const f of ["head", "depth", "ts", "agent_label"]) {
    if (typeof v[f] !== "string" || !v[f]) warnings.push(`${f}: missing (metadata)`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

// --- buildTricolor(results, allUnits, crosscut) -> report -------------------------
// results: [{ meta, verdict: { pass, results, failures }, status?, depth? }]
// Constitution C4: verified / done-unverified / quarantined + grey, with coverage math.
export function buildTricolor(results, allUnits, crosscut) {
  const verified = [], unverified = [], quarantined = [];
  for (const r of results || []) {
    if (r.status === "STUCK" || r.status === "FLAKY-ORACLE" || r.status === "QUARANTINED") quarantined.push(r);
    else if (r.verdict && r.verdict.pass) verified.push(r);
    else if (r.verdict) quarantined.push(r);
    else unverified.push(r);
  }
  const grey = (allUnits || []).filter(u => u && u.grey);
  return {
    tricolor: { verified, unverified, quarantined, grey },
    crosscutting: (crosscut && crosscut.crosscutting) || [],
    coverage: {
      total: (allUnits || []).length,
      verified: verified.length,
      unverified: unverified.length,
      quarantined: quarantined.length,
      grey: grey.length
    }
  };
}

// --- CLI ---------------------------------------------------------------------------
// node adjudicate.mjs adjudicate '{"probes":[...],"exit_codes":[...]}'
// node adjudicate.mjs signature  '{"exit_codes":[...]}'
// node adjudicate.mjs reconcile  '{"enumerations":[...]}'
import { fileURLToPath } from "node:url";
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , fn, json] = process.argv;
  const arg = json ? JSON.parse(json) : {};
  const out =
    fn === "adjudicate" ? adjudicate(arg.probes, arg.exit_codes) :
    fn === "signature"  ? { signature: failureSignature(arg.exit_codes) } :
    fn === "reconcile"  ? reconcileUnits(arg.enumerations) :
    { error: `unknown function: ${fn}`, usage: "adjudicate|signature|reconcile '<json>'" };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  if (out.error) process.exit(2);
}
