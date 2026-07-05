// Hyperworkflows sentinel — time-plane engine.
// Invoke: workflow('hypersentinel', { head, date, mode, run_id })
// head/date are injected by the caller; no Date.now/randomness inside (cache discipline).
// mode: merge (tests+lint) | nightly (+deps, mutation, fuzz, bench) | weekly (+asset regression).
// Reports ONLY the delta vs memory/last-good.json — the operator never re-reads known failures.

export const meta = {
  name: "hypersentinel",
  description: "Scheduled regression sentinel: probe suites by mode, diff vs last-good baseline, auto-bisect new regressions to culprit commits.",
  phases: ["probe", "diff", "auto-bisect"]
};

// Runtime-native Workflow-script form (W5): top-level body, inputs from the `args`
// global, top-level `return`. The dynamic evaluator rejects `export default`; this file
// executes VERBATIM — drivers must not rewrite it.
let { head, date, mode, run_id } = (typeof args === "undefined" || !args) ? {} : args;

const VERIFIER = "ROLE: verifier. Run the commands, report raw exit codes verbatim, write full output to the log path given. Never fix, never interpret, never modify repository files.";
// HYPERWORKFLOWS-HELPERS-BEGIN (generated from scripts/adjudicate.mjs — edit the canonical source and run `npm run bundle`; do not edit this block by hand)
function slug(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]/g, "_");
}
// HYPERWORKFLOWS-HELPERS-END

const ROLE = n => `hyperworkflows:hyperworkflows-${n}`;   // doctor-verified (W3): fully-qualified agentType

// Field lessons #6/#9: dynamic-workflow arg passing is UNRELIABLE at the platform
// level. Resolve identity from the repo itself when args are missing.
if (!head || !date || !run_id) {
  const idp = await agent(
    "ROLE: verifier. Run exactly these commands from the repo root and report outputs verbatim, trimmed: " +
    "(1) git rev-parse --short HEAD  (2) TZ=Asia/Singapore date +%F  (3) head -1 runs/ACTIVE 2>/dev/null || true. Never modify anything.",
    { schema: { type: "object", properties: { head: { type: "string" }, date: { type: "string" }, active: { type: "string" } }, required: ["head", "date"] },
      agentType: ROLE("verifier"), label: "identity-probe", model: "haiku" });
  head = head || idp.head;
  date = date || idp.date;
  run_id = run_id || (idp.active || "").replace(/[^A-Za-z0-9._-]/g, "") || `sentinel-${date}-${mode || "merge"}`;
}
log(`run_id=${run_id} head=${head} mode=${mode}`);

const PROBE_TYPE = { tests: "verifier", lint: "verifier", deps: "auditor", mutation: "prover", fuzz: "prover", bench: "benchmarker", assets: "verifier" };
const ProbeOut = { type: "object", properties: { exit: { type: "number" }, log_path: { type: "string" }, counts: { type: "object" } }, required: ["exit", "log_path"] };

const PROBES = {
  tests:    { model: "sonnet", prompt: `${VERIFIER}\nRun the project's full test suite at ${head}. Full output to runs/${run_id}/logs/tests.log; report {exit, log_path, counts:{failed, passed}}.` },
  lint:     { model: "sonnet", prompt: `${VERIFIER}\nRun the project's lint/static-analysis suite at ${head}. Full output to runs/${run_id}/logs/lint.log; report {exit, log_path, counts:{errors, warnings}}.` },
  deps:     { model: "sonnet", prompt: `ROLE: auditor. Detect ecosystems and run dependency/security scanners (npm audit, cargo audit, pip-audit, osv-scanner...) at ${head}. Never fix anything. Full output to runs/${run_id}/logs/deps.log; report {exit, log_path, counts:{critical, high, moderate, low}}. A scanner that is not installed is reported as such — never simulate.` },
  mutation: { model: "sonnet", prompt: `ROLE: prover. Run mutation testing over code changed since the last-good head recorded in memory/last-good.json (fall back to the last 20 commits). If no mutation tooling exists for this language, report exit 0 with counts:{available:0} — never simulate a score. Log to runs/${run_id}/logs/mutation.log; report {exit, log_path, counts:{killed, survived}}.` },
  fuzz:     { model: "sonnet", prompt: `ROLE: prover. Run existing fuzz targets (cargo-fuzz, go-fuzz, libFuzzer harnesses) with a bounded corpus pass. If none exist, report exit 0 with counts:{available:0}. Log to runs/${run_id}/logs/fuzz.log; report {exit, log_path, counts:{crashes}}.` },
  bench:    { model: "sonnet", prompt: `ROLE: benchmarker. Run the project's benchmark suite 3 times at ${head}; compare medians vs any baseline recorded in memory/bench-baseline.json. If no suite exists, report exit 0 with counts:{available:0}. Log to runs/${run_id}/logs/bench.log; report {exit, log_path, counts:{regressed}}.` },
  assets:   { model: "sonnet", prompt: `${VERIFIER}\nReplay every fixture under fixtures/ (each fixture documents its own command and expected exit). Report {exit, log_path, counts:{replayed, failed}}; log to runs/${run_id}/logs/assets.log. No fixtures directory => exit 0, counts:{replayed:0}.` }
};
const SUITES = { merge: ["tests", "lint"], nightly: ["tests", "lint", "deps", "mutation", "fuzz", "bench"], weekly: ["tests", "lint", "deps", "mutation", "fuzz", "bench", "assets"] }[mode] || ["tests", "lint"];

// ---------- phase: probe ----------
phase("probe");
const outs = (await parallel(SUITES.map(s => async () => ({ suite: s, out: await agent(PROBES[s].prompt, { schema: ProbeOut, agentType: ROLE(PROBE_TYPE[s]), label: `${mode}:${s}`, model: PROBES[s].model }) })))).filter(Boolean);
const lost = SUITES.length - outs.length;
if (lost > 0) log(`PROBE-LOSS: ${lost} probe agents failed — their suites are reported as UNKNOWN, not green`); // C5

// ---------- phase: diff (delta vs last-good only) ----------
phase("diff");
const delta = await agent(
  `Read memory/last-good.json (schema: {head, date, failures: [{suite, fingerprint, location}]}; treat a missing file as an empty baseline) ` +
  `and these probe logs at ${head}:\n` + outs.map(o => `- ${o.suite}: exit=${o.out.exit} log=${o.out.log_path} counts=${JSON.stringify(o.out.counts || {})}`).join("\n") +
  `\nCompute the SET DIFFERENCE by fingerprint (suite + normalized location + message hash). Output only:\n` +
  `new_regressions: failures present now but not in baseline — each {suite, fingerprint, location, predicate_cmd, predicate_expect_exit} ` +
  `where predicate_cmd exits predicate_expect_exit on a GOOD commit and differently on a bad one (for bisect);\n` +
  `fixed: baseline failures no longer present.`,
  { schema: { type: "object", properties: { new_regressions: { type: "array", items: { type: "object", properties: { suite: { type: "string" }, fingerprint: { type: "string" }, location: { type: "string" }, predicate_cmd: { type: "string" }, predicate_expect_exit: { type: "number" } }, required: ["suite", "fingerprint", "location"] } }, fixed: { type: "array", items: { type: "object", properties: { suite: { type: "string" }, fingerprint: { type: "string" } } } } }, required: ["new_regressions", "fixed"] }, label: "diff", model: "opus" });

if (!delta.new_regressions.length) {
  log(`sentinel ${mode}@${date}: no new regressions (fixed since baseline: ${delta.fixed.length})`);
  return { date, head, mode, run_id, delta, probes: outs, probe_loss: lost };
}

// ---------- phase: auto-bisect (culprit, not just symptom) ----------
phase("auto-bisect");
const bisectable = delta.new_regressions.filter(r => r.predicate_cmd);
const bisect = bisectable.length ? await agent(
  `ROLE: bisector. In an isolated worktree, for each regression below run git bisect between the last-good head in memory/last-good.json and ${head}, ` +
  `using its predicate via 'git bisect run' (exit ${"${predicate_expect_exit}"} = good). ALWAYS 'git bisect reset' when done. ` +
  `Report {regression_fingerprint, commit, evidence_cmd} per item, or UNRESOLVED with the bisect log if the predicate is flaky:\n` +
  bisectable.map(r => `- ${r.fingerprint}: ${r.predicate_cmd} (good exit ${r.predicate_expect_exit})`).join("\n"),
  { schema: { type: "object", properties: { culprits: { type: "array", items: { type: "object", properties: { regression_fingerprint: { type: "string" }, commit: { type: "string" }, evidence_cmd: { type: "string" }, unresolved: { type: "boolean" } }, required: ["regression_fingerprint"] } } }, required: ["culprits"] }, agentType: ROLE("bisector"), label: "bisect", model: "sonnet" }
) : { culprits: [] };
if (delta.new_regressions.length > bisectable.length)
  log(`BISECT-SKIP: ${delta.new_regressions.length - bisectable.length} regressions had no executable predicate — reported without culprit`); // C5

log(`NEW-REGRESSIONS: ${delta.new_regressions.length}, bisected: ${bisect.culprits.filter(c => c.commit).length}`);
return { date, head, mode, run_id, delta, bisect, probes: outs, probe_loss: lost, fix_request: `runs/${run_id}/fix-request.md` };
// Caller responsibilities: write fix-request.md from new_regressions+culprits; NEVER
// advance memory/last-good.json on a red run; advance only after verified-green + human confirmation.

