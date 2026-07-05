// Oracle for agents/hyperworkflows-bisector.md (a prompt-spec unit).
//
// The bisector agent's RUNTIME behavior (running `git bisect run`) is LLM-driven
// and non-deterministic, so a behavioral golden/property test is infeasible.
// What IS load-bearing and machine-checkable is the agent's frontmatter contract,
// which the platform actually consumes:
//   - workflows/hypersentinel.js binds `agentType: ROLE("bisector")` where
//     `ROLE = n => "hyperworkflows:hyperworkflows-" + n`, so the agent's name /
//     filename MUST resolve to "hyperworkflows-bisector" or the dispatch breaks.
//   - The design docs (hyperworkflows-design.md, plugin-design.md) carry an
//     authoritative contract row: tools "Bash, Read", model "sonnet", isolation
//     "worktree". If the frontmatter drifts from that row, the documented contract
//     and the executable spec disagree.
//   - The role body promises `git bisect` in an isolated worktree; the frontmatter
//     must grant the Bash tool that makes that possible.
//
// This is a consistency/metamorphic oracle: the executable spec, its dispatch
// binding, and its documented contract must agree.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGENT = join(ROOT, "agents", "hyperworkflows-bisector.md");

// Minimal YAML-frontmatter parser for `key: value` pairs (no nesting needed here).
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "file must begin with a YAML frontmatter block delimited by ---");
  const fm = {};
  for (const line of m[1].split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const i = line.indexOf(":");
    assert.ok(i > 0, `frontmatter line is not key: value -> ${JSON.stringify(line)}`);
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body: text.slice(m[0].length) };
}

const raw = readFileSync(AGENT, "utf8");
const { fm, body } = parseFrontmatter(raw);

test("bisector frontmatter: required keys present", () => {
  for (const k of ["name", "description", "tools", "model", "isolation"]) {
    assert.ok(k in fm, `missing required frontmatter key: ${k}`);
    assert.notEqual(fm[k], "", `frontmatter key ${k} must not be empty`);
  }
});

test("bisector name matches filename and the ROLE dispatch binding", () => {
  // hypersentinel.js: agentType = "hyperworkflows:hyperworkflows-" + "bisector"
  assert.equal(fm.name, "hyperworkflows-bisector",
    "name must equal hyperworkflows-bisector so ROLE('bisector') dispatch resolves");
});

test("bisector tools grant Bash+Read exactly (git bisect needs a shell)", () => {
  const tools = fm.tools.split(",").map(s => s.trim()).filter(Boolean);
  assert.deepEqual(tools, ["Bash", "Read"],
    "contract row requires tools = Bash, Read");
  assert.ok(tools.includes("Bash"),
    "role runs `git bisect run` so Bash is mandatory");
});

test("bisector model + isolation match the documented contract row", () => {
  assert.equal(fm.model, "sonnet", "contract row pins model = sonnet");
  assert.equal(fm.isolation, "worktree",
    "role contract says 'never touch the main worktree' -> isolation must be worktree");
});

test("bisector role body encodes its non-negotiable operating rules", () => {
  assert.match(body, /git bisect run/,
    "body must instruct using `git bisect run` with an executable predicate");
  assert.match(body, /git bisect reset/,
    "body must require `git bisect reset` before finishing");
  assert.match(body, /worktree/i,
    "body must state the isolated-worktree constraint");
});

test("bisector frontmatter agrees with the design-doc contract tables", () => {
  // Cross-check the executable spec against every authoritative table row.
  const docs = [
    { file: "hyperworkflows-design.md", key: "bisector" },
    { file: "plugin-design.md", key: "hyperworkflows-bisector" },
  ];
  for (const { file, key } of docs) {
    const doc = readFileSync(join(ROOT, file), "utf8");
    const row = doc.split("\n").find(l =>
      l.includes("|") && l.includes("`" + key + "`"));
    assert.ok(row, `no contract table row for ${key} in ${file}`);
    const cells = row.split("|").map(c => c.trim());
    // cells: ['', name, tools, model/effort, isolation, ...]
    assert.ok(cells[2].includes("Bash") && cells[2].includes("Read"),
      `${file} tools cell drifted from Bash, Read: ${cells[2]}`);
    assert.ok(cells[3].includes(fm.model),
      `${file} model cell drifted from ${fm.model}: ${cells[3]}`);
    assert.equal(cells[4], fm.isolation,
      `${file} isolation cell drifted from ${fm.isolation}: ${cells[4]}`);
  }
});
