// Hyperworkflows hyperapply — delivery-plane engine.
// Invoke: workflow('hyperapply', { head, plan_path, run_id })
// plan_path = human-approved change plan (the human gate sits BEFORE this workflow).
//
// Structure: topological levels run strictly serially; groups within a level run in
// parallel (file-disjoint by construction); every group is an N-version tournament of
// mutually blind builders; every entry repairs to fixpoint with verification after
// EVERY repair; winners merge serially through a single merger under MERGE_TOKEN,
// with the full suite after every merge. Stops are correctness-based, never budget-based.

export const meta = {
  name: "hyperapply",
  description: "Tournament delivery: N-version blind builds, fixpoint repair, deterministic winner selection, gated serial merges.",
  phases: ["topo-group", "tournament-build", "merge"]
};

export default async function ({ head, plan_path, run_id } = {}) {

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
  function failureSignature(exitCodes) {
    const norm = (exitCodes || [])
      .map(e => `${e.cmd}::${e.exit}`)
      .sort()
      .join("|");
    let h = 5381;
    for (let i = 0; i < norm.length; i++) h = ((h * 33) ^ norm.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, "0");
  }
  function selectWinner(entries) {
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
  function levelsOf(groups) {
    const byLevel = new Map();
    for (const g of groups || []) {
      const l = Number.isFinite(g.level) ? g.level : 0;
      if (!byLevel.has(l)) byLevel.set(l, []);
      byLevel.get(l).push(g);
    }
    return [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([, gs]) =>
      gs.slice().sort((x, y) => String(x.id).localeCompare(String(y.id))));
  }
  function slug(s) {
    return String(s).replace(/[^a-zA-Z0-9._-]/g, "_");
  }
  // HYPERWORKFLOWS-HELPERS-END

  const VERIFIER = "ROLE: verifier. Run EXACTLY the commands given, in order. Report every raw exit code verbatim. Never retry, never fix, never interpret, never modify repository files. Verdicts are computed by script, not by you.";
  const BUILDER = "ROLE: builder. FIRST create an isolated worktree: git worktree add .claude/worktrees/<your-branch> -b <your-branch> — NEVER checkout branches in the main working copy (parallel entries would stomp each other; observed in the field). Implement to the contract there, follow existing repository conventions, commit your work to the branch. Run the acceptance commands yourself before reporting; report branch, files changed, self-observed exit codes. You may be one of several blind tournament entries — commit fully to your approach.";
  const MERGER = "ROLE: single merger. Serial merges only. Full suite after every merge. Red suite means revert immediately. Mechanical conflicts may be resolved and noted; semantic conflicts are STUCK. Never push to remotes.";
  // Doctor-verified (W3): workflow agentType requires the fully-qualified plugin name.
  const ROLE = n => `hyperworkflows:hyperworkflows-${n}`;

  const Probe = { type: "object", properties: { cmd: { type: "string" }, expect_exit: { type: "number" } }, required: ["cmd", "expect_exit"] };
  const ExitCodes = { type: "object", properties: { exit_codes: { type: "array", items: { type: "object", properties: { cmd: { type: "string" }, exit: { type: "number" } }, required: ["cmd", "exit"] } } }, required: ["exit_codes"] };
  const BuildOut = { type: "object", properties: { branch: { type: "string" }, files_changed: { type: "array", items: { type: "string" } }, self_exit_codes: { type: "array", items: { type: "object", properties: { cmd: { type: "string" }, exit: { type: "number" } } } } }, required: ["branch", "files_changed"] };

  // Three genuinely different framings keep tournament entries decorrelated.
  const STRATEGY = [
    "Prefer the minimal diff: smallest change that satisfies every acceptance command.",
    "Prefer the root-cause fix: address the underlying design flaw even if the diff is larger, without expanding scope beyond the group's units.",
    "Prefer the defensive fix: satisfy acceptance AND harden the nearest failure modes (input validation, error paths) within the group's units."
  ];

  // Repair to fixpoint: verify after EVERY repair; stop on green, on a repeated
  // failure signature (no new information), or at k>=8 (flaky oracle — the test is the bug).
  async function verifyToFixpoint(build, g, tag) {
    const sigs = [];
    for (let k = 0; ; k++) {
      const v = await agent(
        `${VERIFIER}\nWorktree branch: ${build.branch} (check it out in your working copy or run commands against it as instructed).\n` +
        `Run these commands in order from the repo root and report raw exit codes:\n` + g.acceptance.map(p => p.cmd).join("\n") +
        `\nAppend {"group":"${g.id}","entry":"${tag}","k":${k},"exit_codes":[...]} as one JSON line to runs/${run_id}/verdicts-raw/${slug(tag)}.jsonl via Bash.`,
        { schema: ExitCodes, agentType: ROLE("verifier"), label: `verify:${slug(tag)}:k${k}`, model: "sonnet" });
      const verdict = adjudicate(g.acceptance, v.exit_codes);              // C2
      if (verdict.pass) return { build, status: "PASS", evidence: v.exit_codes, rounds: k, confirmed_findings: 0 };
      const sig = failureSignature(verdict.failures.map(f => ({ cmd: f.cmd, exit: f.exit })));
      if (sigs.filter(s => s === sig).length >= 2) return { build, status: "STUCK", sig, last_failures: verdict.failures, rounds: k };
      if (k >= 8) return { build, status: "FLAKY-ORACLE", sigs, last_failures: verdict.failures, rounds: k };
      sigs.push(sig);
      build = await agent(
        `${BUILDER}\nRepair pass on branch ${build.branch} for group ${g.id} at base ${head}.\n` +
        `FAILURE HISTORY (fix these; do not undo prior passing behavior):\n` +
        verdict.failures.map(f => `- ${f.cmd} expected ${f.expect_exit} got ${f.exit}`).join("\n") +
        `\nContract: ${JSON.stringify(g.acceptance)}\nReport branch, files changed, self-observed exit codes.`,
        { schema: BuildOut, agentType: ROLE("builder"), label: `repair:${slug(tag)}:k${k}`, model: k % 2 === 0 ? "opus" : "sonnet" }); // rotate tiers to break anchoring
    }
  }

  // Field lessons #6/#9: dynamic-workflow arg passing is UNRELIABLE at the platform
  // level (two independent drivers both delivered head=undefined). When args are
  // missing, resolve identity from the repo itself via a minimal probe — ACTIVE first
  // (the driver-created run dir + the path the merge gate checks), then git HEAD.
  if (!head || !run_id || !plan_path) {
    const idp = await agent(
      "ROLE: verifier. Run exactly these commands from the repo root and report outputs verbatim, trimmed: " +
      "(1) git rev-parse --short HEAD  (2) head -1 runs/ACTIVE 2>/dev/null || true  " +
      "(3) ls -t runs/*/decision-request.md 2>/dev/null | head -1 || true. Never modify anything.",
      { schema: { type: "object", properties: { head: { type: "string" }, active: { type: "string" }, latest_plan: { type: "string" } }, required: ["head"] },
        agentType: ROLE("verifier"), label: "identity-probe", model: "haiku" });
    head = head || idp.head;
    run_id = run_id || (idp.active || "").replace(/[^A-Za-z0-9._-]/g, "") || `apply-${head}`;
    plan_path = plan_path || idp.latest_plan;
  }
  log(`run_id=${run_id} head=${head} plan=${plan_path}`);

  // ---------- phase: topo-group ----------
  phase("topo-group");
  const plan = await agent(
    `Read the approved change plan at ${plan_path} (base commit ${head}). Output:\n` +
    `1) groups: units grouped by shared files — groups that touch ANY common file must share a level ordering ` +
    `(different levels) or be merged into one group; groups within one level MUST be file-disjoint. Each group: ` +
    `id, units (paths), level (0-based dependency order), acceptance [{cmd, expect_exit}] covering all its units, critical (boolean).\n` +
    `2) full_suite: [{cmd, expect_exit}] — the repository's complete test/lint suite commands from the plan or project config.`,
    { schema: { type: "object", properties: { groups: { type: "array", items: { type: "object", properties: { id: { type: "string" }, units: { type: "array", items: { type: "string" } }, level: { type: "number" }, acceptance: { type: "array", items: Probe }, critical: { type: "boolean" } }, required: ["id", "units", "level", "acceptance"] } }, full_suite: { type: "array", items: Probe } }, required: ["groups", "full_suite"] }, agentType: ROLE("scout"), label: "topo-group", model: "opus" });
  if (!plan.full_suite || !plan.full_suite.length) { log("HALT: plan has no full_suite commands — merges cannot be gated (C2)"); return { formation: "HALT-NO-SUITE" }; }

  // ---------- phase: tournament-build ----------
  phase("tournament-build");
  const done = [];
  for (const level of levelsOf(plan.groups)) {          // levels strictly serial
    const results = (await parallel(level.map(g => async () => {
      // Pre-verify (dedup): if this group's acceptance already passes at base, the work
      // exists — report ALREADY-APPLIED (verified) and spawn no builders. Makes reruns
      // and racing orchestrators idempotent instead of duplicating work.
      const pre = await agent(
        `${VERIFIER}\nBase commit ${head}, current working tree. Run these commands in order and report raw exit codes:\n` +
        g.acceptance.map(p => p.cmd).join("\n"),
        { schema: ExitCodes, agentType: ROLE("verifier"), label: `preverify:${slug(g.id)}`, model: "sonnet" });
      const preVerdict = adjudicate(g.acceptance, pre.exit_codes);         // C2
      if (preVerdict.pass) {
        log(`ALREADY-APPLIED: group ${g.id} acceptance passes at base — verified skip, no builders spawned`);
        return { group: g, winner: { build: { branch: "(base)" }, status: "PASS", evidence: pre.exit_codes, rounds: 0, confirmed_findings: 0, already_applied: true } };
      }
      const N = g.critical ? 5 : 3;
      const entries = (await parallel(Array.from({ length: N }, (_, i) => async () => {
        const build = await agent(
          `${BUILDER}\nGroup ${g.id} at base ${head}. Units: ${g.units.join(", ")}.\n` +
          `Read the full task details for these units in ${plan_path}.\nSTRATEGY: ${STRATEGY[i % STRATEGY.length]}\n` +
          `Contract (must all pass): ${JSON.stringify(g.acceptance)}`,
          { schema: BuildOut, agentType: ROLE("builder"), label: `build:${slug(g.id)}:v${i}`, model: "opus" });
        return verifyToFixpoint(build, g, `${g.id}:v${i}`);
      }))).filter(Boolean);
      return { group: g, entries, winner: selectWinner(entries) };
    }))).filter(Boolean);
    done.push(...results);
  }

  // ---------- phase: merge (single merger, serial, gated) ----------
  phase("merge");
  const merged = [], quarantined = [];
  for (const d of done) {
    if (!d.winner) { quarantined.push({ group: d.group.id, reason: "no green tournament entry", entries: d.entries.map(e => ({ status: e.status, sig: e.sig || null })) }); continue; }
    if (d.winner.already_applied) {                    // verified at base; nothing to merge
      merged.push({ group: d.group.id, branch: "(already applied at base)", rounds: 0, suite: d.winner.evidence, already_applied: true });
      continue;
    }
    const m = await agent(
      `${MERGER}\nRun ${run_id}, group ${d.group.id}. Protocol, in order, from the MAIN worktree (repo root):\n` +
      `0) git checkout the integration branch (the repository default: master/main) — never merge while a feature branch is checked out.\n` +
      `1) touch the token file at the path the guard checks: runs/$(head -1 runs/ACTIVE | tr -cd 'A-Za-z0-9._-')/MERGE_TOKEN (also touch runs/${run_id}/MERGE_TOKEN if different).\n` +
      `2) git merge --no-ff ${d.winner.build.branch}\n` +
      `3) Run the FULL suite and record raw exit codes: ${plan.full_suite.map(p => p.cmd).join(" ; ")}\n` +
      `4) If any suite command's exit differs from expectation ${JSON.stringify(plan.full_suite)}: git revert -m 1 the merge commit immediately and say so.\n` +
      `5) rm the MERGE_TOKEN file(s) you created\n` +
      `Report: merged (boolean, true only if the merge REMAINED in place), conflict_files, suite exit_codes, reverted (boolean).`,
      { schema: { type: "object", properties: { merged: { type: "boolean" }, reverted: { type: "boolean" }, conflict_files: { type: "array", items: { type: "string" } }, exit_codes: { type: "array", items: { type: "object", properties: { cmd: { type: "string" }, exit: { type: "number" } } } } }, required: ["merged", "exit_codes"] }, agentType: ROLE("merger"), label: `merge:${slug(d.group.id)}`, model: "opus" });
    const suiteVerdict = adjudicate(plan.full_suite, m.exit_codes);        // C2: script re-adjudicates the merger's report
    if (m.merged && suiteVerdict.pass) merged.push({ group: d.group.id, branch: d.winner.build.branch, rounds: d.winner.rounds, suite: m.exit_codes });
    else quarantined.push({ group: d.group.id, reason: m.reverted ? "full suite red after merge (reverted)" : "merge failed", failures: suiteVerdict.failures, conflict_files: m.conflict_files || [] });
  }

  const report = {
    formation: "apply", head, run_id, plan_path,
    tricolor: {
      verified: merged,
      quarantined,
      not_attempted: plan.groups.filter(g => !done.some(d => d.group.id === g.id)).map(g => g.id)
    },
    coverage: { groups_total: plan.groups.length, merged: merged.length, quarantined: quarantined.length }
  };
  log(`delivered=${merged.length}/${plan.groups.length} quarantined=${quarantined.length}`);
  return report;
}
