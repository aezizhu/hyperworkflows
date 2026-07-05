import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Oracle for the grey unit agents/hyperworkflows-cartographer.md.
// This is an agent-definition spec consumed by the Claude Code plugin loader,
// so its "behavior" is the frontmatter contract it publishes plus the semantic
// consistency between that contract and its prose. We forge a property test
// over the invariants that make the spec correct and safe to load.

const AGENTS = join(dirname(fileURLToPath(import.meta.url)), "..", "agents");
const UNIT = join(AGENTS, "hyperworkflows-cartographer.md");

// Minimal, dependency-free frontmatter parser for the simple `key: value`
// YAML these specs use (no nesting). Returns { fm, body }.
function parseSpec(path) {
  const raw = readFileSync(path, "utf8");
  assert.match(raw, /^---\r?\n/, "spec must open with a --- frontmatter fence");
  const end = raw.indexOf("\n---", 3);
  assert.ok(end > 0, "spec must close its frontmatter fence with ---");
  const fmBlock = raw.slice(raw.indexOf("\n") + 1, end);
  const body = raw.slice(raw.indexOf("\n---", 3) + 4);
  const fm = {};
  for (const line of fmBlock.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    assert.ok(m, `unparseable frontmatter line: ${JSON.stringify(line)}`);
    fm[m[1]] = m[2].trim();
  }
  return { fm, body, raw };
}

const MUTATING_TOOLS = ["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"];
const VALID_MODELS = ["opus", "sonnet", "haiku"];

test("cartographer spec: parses and declares required frontmatter keys", () => {
  const { fm } = parseSpec(UNIT);
  for (const key of ["name", "description", "tools", "model"]) {
    assert.ok(fm[key] && fm[key].length > 0, `frontmatter must declare ${key}`);
  }
});

test("cartographer spec: name binds to its filename stem", () => {
  const { fm } = parseSpec(UNIT);
  const stem = basename(UNIT, ".md");
  // The plugin loader keys agents by frontmatter name for agentType binding;
  // a name != filename silently breaks dispatch (see 'qualified agentType' fix).
  assert.equal(fm.name, stem);
  assert.equal(fm.name, "hyperworkflows-cartographer");
});

test("cartographer spec: model is a valid tier", () => {
  const { fm } = parseSpec(UNIT);
  assert.ok(VALID_MODELS.includes(fm.model), `model '${fm.model}' not a valid tier`);
});

test("cartographer spec: description follows the plugin naming convention", () => {
  const { fm } = parseSpec(UNIT);
  assert.match(fm.description, /^Hyperworkflows /);
});

test("cartographer spec: read-only prose is consistent with declared tools", () => {
  const { fm, body } = parseSpec(UNIT);
  // The role contract asserts the agent 'is read-only and never in a delivery
  // path'. That claim is load-bearing: it is the reason this agent can be kept
  // warm and quoted by planners. Enforce the metamorphic consistency between
  // the prose and the tool grant -- a read-only agent must hold zero mutating
  // tools, and must not be granted an isolation worktree (a delivery-path signal).
  assert.match(body, /read-only/i, "contract prose must assert read-only");
  const tools = fm.tools.split(",").map(t => t.trim()).filter(Boolean);
  assert.ok(tools.length > 0, "tools grant must be non-empty");
  for (const t of tools) {
    assert.ok(
      !MUTATING_TOOLS.includes(t),
      `read-only agent must not be granted mutating tool '${t}'`
    );
  }
  assert.equal(fm.isolation, undefined, "read-only agent must not claim a delivery worktree");
});
