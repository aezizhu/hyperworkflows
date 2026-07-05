// Oracle for commands/doctor.md — the Hyperworkflows "assumption register".
//
// doctor.md is an agentic diagnostic spec. Its orchestration steps (spawning
// agents, hook activation, worktree isolation, model resolution) are
// non-deterministic and cannot be executed in a unit test. But the doc is a
// register of CONCRETE platform assumptions, and those assumptions are exactly
// what it asserts as PASS/FAIL. This oracle pins the load-bearing, checkable
// claims against the current repo so the doc cannot silently drift from the
// artifacts it describes. Strongest tie: item 8 embeds a LITERAL executable
// command whose own contract ("confirm `pass: true`") we run for real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOCTOR = readFileSync(join(ROOT, "commands", "doctor.md"), "utf8");

test("doctor.md: exists and is the assumption register (8 numbered checks)", () => {
  for (let i = 1; i <= 8; i++) {
    assert.match(DOCTOR, new RegExp(`^${i}\\. \\*\\*`, "m"), `missing check #${i}`);
  }
});

test("doctor.md item 2: the three plugin engines it names are present at workflows/*.js", () => {
  for (const eng of ["hyperaudit", "hyperapply", "hypersentinel"]) {
    assert.match(DOCTOR, new RegExp(`\\b${eng}\\b`), `doc no longer names ${eng}`);
    readFileSync(join(ROOT, "workflows", `${eng}.js`), "utf8"); // throws if absent
  }
});

test("doctor.md item 3: exactly 14 hyperworkflows-* agents exist, as the doc claims", () => {
  assert.match(DOCTOR, /all 14 `hyperworkflows-\*` agents/);
  const agents = readdirSync(join(ROOT, "agents"))
    .filter(f => /^hyperworkflows-.*\.md$/.test(f));
  assert.equal(agents.length, 14, `doc says 14 agents, found ${agents.length}`);
});

test("doctor.md item 3: verifier tools are exactly Bash+Read (write must be impossible)", () => {
  assert.match(DOCTOR, /its tools are Bash\+Read/);
  const fm = readFileSync(join(ROOT, "agents", "hyperworkflows-verifier.md"), "utf8");
  const line = fm.split("\n").find(l => /^tools:/i.test(l));
  assert.ok(line, "verifier has no tools: frontmatter");
  const tools = line.replace(/^tools:/i, "").split(",").map(t => t.trim()).filter(Boolean);
  assert.deepEqual(tools.sort(), ["Bash", "Read"], "verifier tools must be exactly Bash,Read");
  assert.ok(!/\bEdit\b|\bWrite\b/.test(line), "verifier must not have Edit/Write");
});

test("doctor.md item 8: the literal embedded adjudicate command yields pass:true", () => {
  // Extract the exact command the doc tells the operator to run, so the oracle
  // tracks the doc's own contract rather than a hand-copied duplicate.
  const m = DOCTOR.match(/node \$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/adjudicate\.mjs adjudicate '([^']+)'/);
  assert.ok(m, "item 8 no longer contains the literal adjudicate command");
  const payload = m[1];
  const out = execFileSync("node", [join(ROOT, "scripts", "adjudicate.mjs"), "adjudicate", payload], { encoding: "utf8" });
  const parsed = JSON.parse(out);
  assert.equal(parsed.pass, true, "doc item 8 promises `pass: true`");
});
