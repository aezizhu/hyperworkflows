// Forged acceptance oracle for agents/hyperworkflows-benchmarker.md.
//
// The unit is an LLM agent prompt spec, not executable code: its runtime behavior
// (running a bench suite, reporting deltas) is non-deterministic and LLM-driven, so a
// golden/output oracle is infeasible. What IS deterministically checkable is the spec's
// CONTRACT — the frontmatter schema and the behavioral invariants the ROLE CONTRACT
// itself promises. This is a property test over those invariants: it fails if an edit
// drops a required field, renames the agent away from its filename, strips a declared
// tool, or removes a load-bearing behavioral guarantee (N>=3 sampling, the output
// schema, or the "never invent numbers" guard).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "agents", "hyperworkflows-benchmarker.md");
const raw = readFileSync(FILE, "utf8");

// --- split YAML frontmatter from body (agents use `---\n<fm>\n---\n<body>`) ----------
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, "file must begin with a `---` fenced YAML frontmatter block");
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body: m[2] };
}

const { fm, body } = splitFrontmatter(raw);

test("frontmatter: name matches filename stem", () => {
  const stem = basename(FILE, ".md");
  assert.equal(fm.name, stem);
  assert.equal(fm.name, "hyperworkflows-benchmarker");
});

test("frontmatter: required fields present and non-empty", () => {
  for (const k of ["name", "description", "tools", "model"]) {
    assert.ok(fm[k] && fm[k].length > 0, `missing/empty frontmatter field: ${k}`);
  }
});

test("frontmatter: description states its measure-only benchmarking role", () => {
  assert.match(fm.description, /benchmark/i);
  assert.match(fm.description, /baseline/i);
  // Constitution: "Measures only - never tunes." — the measure-only invariant.
  assert.match(fm.description, /never tunes|measures only/i);
});

test("frontmatter: declares exactly the tools it needs and no write/edit surface", () => {
  const tools = fm.tools.split(",").map(t => t.trim()).filter(Boolean);
  assert.deepEqual([...tools].sort(), ["Bash", "Read"]);
  // A measure-only agent must not be handed mutation tools.
  for (const forbidden of ["Write", "Edit", "NotebookEdit"]) {
    assert.ok(!tools.includes(forbidden), `benchmarker must not hold mutation tool: ${forbidden}`);
  }
});

test("body: statistical-sampling invariant (N>=3, median + spread, never single sample)", () => {
  assert.match(body, /N>=3|N ?>= ?3/);
  assert.match(body, /median/i);
  assert.match(body, /spread/i);
  assert.match(body, /never a single sample/i);
});

test("body: output schema keys are specified", () => {
  for (const key of ["bench_score", "deltas", "change_pct", "log_path"]) {
    assert.match(body, new RegExp(key.replace(/_/g, "_")), `output schema must name: ${key}`);
  }
});

test("body: honesty guards — no invented numbers, n/a at D4 when no suite", () => {
  assert.match(body, /never invent numbers/i);
  assert.match(body, /n\/a at D4/);
});

test("body: carries the depth-D4 / constitution-C8 role contract header", () => {
  assert.match(body, /ROLE CONTRACT/);
  assert.match(body, /C8/);
  assert.match(body, /D4/);
});
