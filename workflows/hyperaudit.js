// Hyperworkflows hyperaudit — evidence-plane engine.
// Invoke: workflow('hyperaudit', { head, scope, run_id, force })
// Cache discipline: every prompt derives only from (head, scope, unit content, run_id).
// No Date.now, no randomness, path-lexicographic traversal throughout.
//
// Constitution enforced here:
//  C2 — verdicts computed by the inlined adjudicate() below, never by an LLM.
//  C3 — verifier prompts contain commands only; attacker never sees producer reasoning.
//  C5 — every skip/degrade calls log(); enumeration disputes HALT instead of shrinking.
//  C7 — three independent enumerators reconciled by script.

export const meta = {
  name: "hyperaudit",
  description: "Full-coverage adversarial audit: 3-way enumeration, oracle forging, spec-attack, analyze+attack+verify, tricolor report.",
  phases: ["recon", "enumerate-x3", "forge-oracles", "spec-attack", "analyze-attack-verify", "crosscut-reduce"]
};

export default async function ({ head, scope, run_id, force }) {

  // HYPERWORKFLOWS-HELPERS-BEGIN (generated from scripts/adjudicate.mjs — edit the canonical source and run `npm run bundle`; do not edit this block by hand)
  function adjudicate(probes, exitCodes) {
    const byCmd = new Map();
    for (const e of exitCodes || []) if (!byCmd.has(e.cmd)) byCmd.set(e.cmd, e.exit);
    const results = (probes || []).map(p => {
      const exit = byCmd.has(p.cmd) ? byCmd.get(p.cmd) : null;
      return { cmd: p.cmd, expect_exit: p.expect_exit, exit, ok: exit !== null && exit === p.expect_exit };
    });
    const failures = results.filter(r => !r.ok);
    return { pass: results.length > 0 && failures.length === 0, results, failures };
  }
  function reconcileUnits(enumerations) {
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
  function sortByPath(units) {
    return (units || []).slice().sort((a, b) => String(a.path).localeCompare(String(b.path)));
  }
  function slug(s) {
    return String(s).replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  // HYPERWORKFLOWS-HELPERS-END

  // ---------- role contracts embedded in prompts (agentType may be unavailable in workflows) ----------
  const SCOUT = "ROLE: read-only scout. Measure and enumerate deterministically (path-lexicographic). Report numbers with the method that produced them. Never conclude beyond direct observation.";
  const VERIFIER = "ROLE: verifier. Run EXACTLY the commands given, in order, from the repo root. Report every raw exit code verbatim. Never retry, never fix, never interpret, never modify repository files. Verdicts are computed by script from your exit codes, not by you.";
  const ATTACKER = "ROLE: adversarial falsifier. You receive claims and a contract, never the producer's reasoning. Every finding MUST carry an executable repro you have personally run: {claim, repro_cmd, expect_exit} where expect_exit is what the command exits with if the claim is TRUE. No repros, no finding.";

  // ---------- schemas ----------
  const Probe = { type: "object", properties: { cmd: { type: "string" }, expect_exit: { type: "number" } }, required: ["cmd", "expect_exit"] };
  const Unit = {
    type: "object",
    properties: {
      path: { type: "string" },
      risk: { type: "string", enum: ["high", "medium", "low"] },
      risk_reason: { type: "string" },
      acceptance: { type: "array", items: Probe },
      grey: { type: "boolean" }
    },
    required: ["path", "risk", "acceptance", "grey"]
  };
  const EnumSchema = { type: "object", properties: { method: { type: "string" }, units: { type: "array", items: Unit } }, required: ["method", "units"] };
  const Finding = {
    type: "object",
    properties: {
      file: { type: "string" }, line: { type: "number" }, claim: { type: "string" },
      severity: { type: "string", enum: ["critical", "high", "medium", "low"] },
      evidence_cmd: { type: "string" }, evidence_expect_exit: { type: "number" }
    },
    required: ["file", "claim", "severity", "evidence_cmd", "evidence_expect_exit"]
  };
  const ExitCodes = { type: "object", properties: { exit_codes: { type: "array", items: { type: "object", properties: { cmd: { type: "string" }, exit: { type: "number" } }, required: ["cmd", "exit"] } } }, required: ["exit_codes"] };

  // ---------- phase: recon ----------
  phase("recon");
  const probe = await agent(
    `${SCOUT}\nRecon ${scope} at commit ${head}: count auditable work units (source files in scope), assess homogeneity, sketch risk spread. Output numbers and the counting method.`,
    { schema: { type: "object", properties: { touched: { type: "number" }, homogeneous: { type: "boolean" }, notes: { type: "array", items: { type: "string" } } }, required: ["touched"] }, label: "probe", model: "haiku" });
  if (probe.touched < 5 && !force) {
    log("FORMATION: solo — orchestration adds coordination surface, not evidence quality, below 5 units");
    return { formation: "solo", probe };
  }

  // ---------- phase: enumerate-x3 (C7) ----------
  phase("enumerate-x3");
  const enumPrompt = (method) =>
    `${SCOUT}\nEnumerate ALL auditable units in ${scope} at commit ${head} using METHOD: ${method}. ` +
    `For each unit output: path, risk (high|medium|low) with risk_reason, acceptance (array of {cmd, expect_exit} ` +
    `executable from the repo root that currently verify this unit — existing tests, build/lint targeting it), ` +
    `grey=true when no executable acceptance exists. Path-lexicographic order. Do not omit units because they look trivial. ` +
    `Files over 500 lines: split into section-aligned sub-units (unit path "file#L<start>-L<end>", boundaries on ` +
    `function/class/section edges) so no analyzer swallows a 2000-line file whole; sub-units inherit the file's acceptance.`;
  const enums = (await parallel([
    () => agent(enumPrompt("filesystem walk via git ls-files"), { schema: EnumSchema, label: "enum:fs", model: "sonnet" }),
    () => agent(enumPrompt("symbol/module graph via rg and import tracing"), { schema: EnumSchema, label: "enum:sym", model: "sonnet" }),
    () => agent(enumPrompt("build/test dependency graph (build files, test manifests)"), { schema: EnumSchema, label: "enum:build", model: "sonnet" }),
  ])).filter(Boolean);
  if (enums.length < 2) { log("ENUM-FATAL: fewer than 2 enumerators returned (C7 unmet)"); return { formation: "HALT-ENUM", reason: "enumerator failures", enums_ok: enums.length }; }

  let { units, disputed } = reconcileUnits(enums);
  if (disputed.length) {
    log(`ENUM-GAP: ${disputed.length} disputed units (listed by exactly one enumerator)`); // C5
    const gap = await agent(
      `${SCOUT}\nThese paths at ${head} were flagged by exactly one of three independent enumerators:\n` +
      disputed.map(u => `- ${u.path}`).join("\n") +
      `\nFor each: confirm whether it is a real in-scope auditable unit (emit the full unit record) or out of scope (emit path + one-line reason).`,
      { schema: { type: "object", properties: { resolved: { type: "array", items: Unit }, out_of_scope: { type: "array", items: { type: "object", properties: { path: { type: "string" }, reason: { type: "string" } }, required: ["path", "reason"] } } }, required: ["resolved", "out_of_scope"] }, label: "enum:gap", model: "opus" });
    units = sortByPath(units.concat(gap.resolved || []));
    const unresolved = disputed.length - (gap.resolved || []).length - (gap.out_of_scope || []).length;
    if (unresolved > Math.max(1, units.length * 0.05)) {
      log(`HALT-ENUM: ${unresolved} units unresolved (>5% of denominator) — a wrong denominator poisons every downstream claim`);
      return { formation: "HALT-ENUM", unresolved, disputed, units_so_far: units.length };
    }
  }

  // ---------- phase: forge-oracles (C1) ----------
  phase("forge-oracles");
  const grey = sortByPath(units.filter(u => u.grey));
  if (grey.length) {
    const forged = (await pipeline(grey,
      async g => ({ meta: g, forge: await agent(
        `ROLE: oracle-smith. Unit ${g.path} at ${head} has no executable acceptance. Forge the strongest feasible oracle ` +
        `(golden file > property test > metamorphic relation > snapshot), as TEST-ONLY changes in your isolated worktree. ` +
        `The forged acceptance must PASS on current code — if it fails you found a defect: report it as defect_found instead. ` +
        `Output acceptance [{cmd, expect_exit}] runnable from the repo root, or infeasible_reason (one concrete sentence).`,
        { schema: { type: "object", properties: { acceptance: { type: "array", items: Probe }, infeasible_reason: { type: "string" }, defect_found: { type: "string" }, branch: { type: "string" } } }, label: `forge:${slug(g.path)}`, model: "opus" }) })
    )).filter(Boolean);
    for (const f of forged) {
      const u = units.find(x => x.path === f.meta.path);
      if (u && f.forge && Array.isArray(f.forge.acceptance) && f.forge.acceptance.length) { u.acceptance = f.forge.acceptance; u.grey = false; u.forged_branch = f.forge.branch || null; }
      else if (u) { u.infeasible_reason = (f.forge && f.forge.infeasible_reason) || "oracle-smith returned nothing"; u.defect_found = (f.forge && f.forge.defect_found) || null; }
    }
    log(`forge-oracles: ${grey.length - units.filter(u => u.grey).length}/${grey.length} grey units now have oracles`);
  }

  // ---------- phase: spec-attack ----------
  phase("spec-attack");
  const holes = await agent(
    `ROLE: spec-attacker. Below are units with their acceptance contracts at ${head}. Find missing acceptance dimensions ` +
    `(performance, security, concurrency, boundary semantics, error paths, resource lifecycle). Every hole MUST carry an ` +
    `executable proposed {cmd, expect_exit}. Holes without commands are opinions — omit them.\n` +
    sortByPath(units.filter(u => !u.grey)).map(u => `UNIT ${u.path}: ${JSON.stringify(u.acceptance)}`).join("\n"),
    { schema: { type: "object", properties: { missing: { type: "array", items: { type: "object", properties: { path: { type: "string" }, dimension: { type: "string" }, cmd: { type: "string" }, expect_exit: { type: "number" } }, required: ["path", "dimension", "cmd", "expect_exit"] } } }, required: ["missing"] }, label: "spec-attack", model: "opus" });
  for (const h of holes.missing || []) {
    const u = units.find(x => x.path === h.path);
    if (u && !u.grey) u.acceptance.push({ cmd: h.cmd, expect_exit: h.expect_exit });
  }
  log(`spec-attack: ${(holes.missing || []).length} contract holes patched into acceptance`);

  // ---------- phase: analyze-attack-verify (100% coverage, metadata threaded) ----------
  phase("analyze-attack-verify");
  const testable = sortByPath(units.filter(u => !u.grey));
  const results = (await pipeline(testable,
    async u => ({ meta: u, analysis: await agent(
      `Audit unit ${u.path} at commit ${head} for real defects (correctness, security, resource handling, API misuse). ` +
      `Every finding MUST carry evidence_cmd + evidence_expect_exit: an executable command from the repo root whose exit ` +
      `code equals evidence_expect_exit IF the defect is real. No command, no finding. An empty findings list after a real ` +
      `analysis is a valid result.`,
      { schema: { type: "object", properties: { findings: { type: "array", items: Finding }, anomalies: { type: "array", items: { type: "string" } } }, required: ["findings"] }, label: `analyze:${slug(u.path)}`, model: "opus" }) }),
    async r => ({ ...r, attack: await agent(
      `${ATTACKER}\nUNIT: ${r.meta.path} at ${head}.\nCONTRACT: ${JSON.stringify(r.meta.acceptance)}\n` +
      `CLAIMS UNDER TEST (falsify wrong ones, find what they missed):\n` +
      (r.analysis.findings || []).map(f => `- ${f.claim} [evidence: ${f.evidence_cmd} => ${f.evidence_expect_exit}]`).join("\n") +
      `\nOutput additional or falsifying findings with executed repros only.`,
      { schema: { type: "object", properties: { findings: { type: "array", items: { type: "object", properties: { claim: { type: "string" }, repro_cmd: { type: "string" }, expect_exit: { type: "number" } }, required: ["claim", "repro_cmd", "expect_exit"] } } }, required: ["findings"] }, label: `attack:${slug(r.meta.path)}`, model: "opus" }) }),
    async r => {
      const acceptance = r.meta.acceptance;
      const findingProbes = (r.analysis.findings || []).map(f => ({ cmd: f.evidence_cmd, expect_exit: f.evidence_expect_exit }));
      const attackProbes = (r.attack.findings || []).map(f => ({ cmd: f.repro_cmd, expect_exit: f.expect_exit }));
      const all = [...acceptance, ...findingProbes, ...attackProbes];
      const v = await agent(
        `${VERIFIER}\nWorking directory: repo root at commit ${head}.\nRun these commands in order and report every raw exit code:\n` +
        all.map(p => p.cmd).join("\n") +
        `\nAfter running, append your raw results as one JSON line {"unit":"${r.meta.path}","exit_codes":[...]} to runs/${run_id}/verdicts-raw/${slug(r.meta.path)}.jsonl using Bash (telemetry checkpoint — the only write you perform).`,
        { schema: ExitCodes, label: `verify:${slug(r.meta.path)}`, model: "sonnet" });
      // C2: all verdicts computed here, in script.
      const acceptanceVerdict = adjudicate(acceptance, v.exit_codes);
      const confirmedFindings = adjudicate(findingProbes, v.exit_codes).results.filter(x => x.ok);
      const confirmedAttacks = adjudicate(attackProbes, v.exit_codes).results.filter(x => x.ok);
      return { ...r, exit_codes: v.exit_codes, verdict: acceptanceVerdict, confirmed_findings: confirmedFindings, confirmed_attacks: confirmedAttacks };
    }
  )).filter(Boolean);
  const crashed = testable.length - results.length;
  if (crashed > 0) log(`PIPELINE-LOSS: ${crashed} units returned null (agent failure) — they are reported as unverified, not dropped`); // C5

  // ---------- phase: crosscut-reduce ----------
  phase("crosscut-reduce");
  const digest = results.map(r => ({ unit: r.meta.path, acceptance_pass: r.verdict.pass, confirmed: [...r.confirmed_findings, ...r.confirmed_attacks].map(c => c.cmd), anomalies: r.analysis.anomalies || [] }));
  const crosscut = await agent(
    `Read this per-unit digest of a full audit at ${head} and report ONLY cross-module findings a per-unit view cannot see ` +
    `(architectural coupling, duplicated invariants, inconsistent error contracts). Each with an evidence_cmd + evidence_expect_exit where expressible.\n` +
    JSON.stringify(digest),
    { schema: { type: "object", properties: { crosscutting: { type: "array", items: Finding } }, required: ["crosscutting"] }, label: "crosscut", model: "opus" });

  const verified = results.filter(r => r.verdict.pass);
  const failedAcceptance = results.filter(r => !r.verdict.pass);
  const stillGrey = units.filter(u => u.grey);
  const report = {
    formation: "audit", head, scope, run_id,
    tricolor: {
      verified: verified.map(r => ({ unit: r.meta.path, depth: (r.attack.findings || []).length ? "D1" : "D0", probes: r.verdict.results, confirmed_findings: [...r.confirmed_findings, ...r.confirmed_attacks] })),
      unverified: failedAcceptance.map(r => ({ unit: r.meta.path, failures: r.verdict.failures, confirmed_findings: [...r.confirmed_findings, ...r.confirmed_attacks] })),
      grey: stillGrey.map(u => ({ unit: u.path, infeasible_reason: u.infeasible_reason || "no oracle", defect_found: u.defect_found || null }))
    },
    crosscutting: crosscut.crosscutting || [],
    coverage: { total: units.length, adjudicated: results.length, pipeline_loss: crashed, grey: stillGrey.length, enum_method: "3-way census (fs walk + symbol graph + build graph), script-reconciled" },
    contested: results.filter(r => r.confirmed_findings.length + r.confirmed_attacks.length > 0).map(r => ({ unit: r.meta.path, confirmed: [...r.confirmed_findings, ...r.confirmed_attacks] }))
  };
  log(`coverage=${report.coverage.adjudicated}/${report.coverage.total} grey=${report.coverage.grey} confirmed-finding-units=${report.contested.length}`);
  return report;
}
