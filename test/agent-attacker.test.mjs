// Oracle for the grey unit agents/hyperworkflows-attacker.md
//
// The attacker agent is a Claude subagent *prompt* — its full behaviour only
// manifests when an LLM runs it, so a deterministic golden file of its output is
// infeasible. What IS deterministically checkable, and what actually breaks the
// product if wrong, is the STATIC CONTRACT between this prompt file and the code
// that dispatches it (workflows/hyperaudit.js). This is a property/consistency
// oracle: it pins the invariants that must hold for the attacker to be wired and
// self-consistent with its consumer.
//
// Coupling under test:
//   workflows/hyperaudit.js dispatches ROLE("attacker") ==
//   "hyperworkflows:hyperworkflows-attacker" with a structured-output schema
//   requiring findings of shape {claim, repro_cmd, expect_exit} and model "opus".
//   The agent file must (a) carry the name that binding resolves to, and (b) tell
//   the agent to emit exactly those field names, or the schema rejects its output.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_PATH = join(ROOT, "agents", "hyperworkflows-attacker.md");
const WORKFLOW_PATH = join(ROOT, "workflows", "hyperaudit.js");

const raw = readFileSync(AGENT_PATH, "utf8");
const workflow = readFileSync(WORKFLOW_PATH, "utf8");

// --- minimal frontmatter parser (no yaml dep in this repo) -----------------
function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(m, "agent file must open with a --- delimited YAML frontmatter block");
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return fm;
}

const fm = parseFrontmatter(raw);

test("name matches the ROLE binding the workflow resolves", () => {
  // hyperaudit.js: ROLE = n => `hyperworkflows:hyperworkflows-${n}` ; ROLE("attacker")
  assert.equal(fm.name, "hyperworkflows-attacker");
});

test("filename matches frontmatter name", () => {
  assert.match(AGENT_PATH, /agents\/hyperworkflows-attacker\.md$/);
});

test("declares all required frontmatter keys", () => {
  for (const key of ["name", "description", "tools", "model", "isolation"]) {
    assert.ok(key in fm, `missing frontmatter key: ${key}`);
    assert.notEqual(fm[key], "", `empty frontmatter value: ${key}`);
  }
});

test("model matches the model the workflow dispatches the attack step with", () => {
  // hyperaudit.js attack step (label `attack:...`) uses model: "opus".
  assert.equal(fm.model, "opus");
  assert.match(workflow, /agentType: ROLE\("attacker"\)[\s\S]*?model: "opus"/);
});

test("tools grant Bash so the agent can run its own repros", () => {
  // Contract body: "Run it yourself first: a repro you have not executed is speculation".
  const tools = fm.tools.split(",").map((t) => t.trim());
  assert.ok(tools.includes("Bash"), `tools must include Bash, got: ${fm.tools}`);
});

test("runs in worktree isolation (attacker attacks products that are not its own)", () => {
  assert.equal(fm.isolation, "worktree");
});

test("finding schema in the prompt matches the consumer's required fields", () => {
  // The workflow rejects any attacker output whose findings lack these exact keys.
  const requiredFields = ["claim", "repro_cmd", "expect_exit"];

  // Consumer side: confirm the schema this test pins is the one actually in code.
  assert.match(
    workflow,
    /required: \["claim", "repro_cmd", "expect_exit"\]/,
    "workflow attacker schema drifted from the fields this oracle pins"
  );

  // Producer side: the prompt must instruct the agent to emit exactly these keys.
  const body = raw.slice(raw.indexOf("ROLE CONTRACT"));
  for (const field of requiredFields) {
    assert.ok(
      body.includes(field),
      `attacker prompt must mention output field "${field}" so the agent emits it`
    );
  }
  // And they must appear together as the finding tuple, not scattered coincidences.
  assert.match(
    body,
    /\{claim, repro_cmd, expect_exit\}/,
    "attacker prompt must state the finding tuple {claim, repro_cmd, expect_exit}"
  );
});

test("prompt states expect_exit semantics that match the schema comment", () => {
  // Both files define expect_exit as the code the repro exits with IF the claim is TRUE.
  assert.match(raw, /expect_exit is what the command exits with IF YOUR CLAIM IS TRUE/i);
});
