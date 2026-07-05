// Oracle for unit: agents/hyperworkflows-merger.md
// The behavioral ROLE CONTRACT prose is instructions to an LLM and is not
// executable. What IS verifiable are the structural / internal-consistency
// invariants that make this agent definition loadable by Claude Code and
// coherent with its stated single-merger role. These properties would catch a
// corrupted frontmatter, a name/filename mismatch, an invalid model, an
// undeclared tool the protocol depends on, or the loss of the load-bearing
// MERGE_TOKEN / serial-suite contract clauses.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, "..", "agents", "hyperworkflows-merger.md");
const RAW = readFileSync(FILE, "utf8");

// Minimal frontmatter parser: leading `---\n ... \n---` block of `key: value`.
function parseFrontmatter(raw) {
  assert.match(raw, /^---\n/, "file must open with a YAML frontmatter fence");
  const end = raw.indexOf("\n---", 3);
  assert.ok(end > 0, "frontmatter must be closed with a `---` fence");
  const body = raw.slice(4, end + 1);
  const fm = {};
  for (const line of body.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    assert.ok(m, `frontmatter line is not key: value -> ${JSON.stringify(line)}`);
    fm[m[1]] = m[2].trim();
  }
  return fm;
}

const fm = parseFrontmatter(RAW);

test("name matches filename stem", () => {
  const stem = basename(FILE, ".md");
  assert.equal(fm.name, stem);
});

test("required frontmatter fields present and non-empty", () => {
  for (const key of ["name", "description", "tools", "model"]) {
    assert.ok(fm[key] && fm[key].length > 0, `missing frontmatter field: ${key}`);
  }
});

test("model is a valid Claude Code tier", () => {
  assert.ok(["opus", "sonnet", "haiku"].includes(fm.model), `bad model: ${fm.model}`);
});

test("tools are drawn from the known Claude Code tool set", () => {
  const KNOWN = new Set(["Bash", "Read", "Edit", "Write", "Grep", "Glob"]);
  const tools = fm.tools.split(",").map((t) => t.trim()).filter(Boolean);
  assert.ok(tools.length > 0, "tools list is empty");
  for (const t of tools) assert.ok(KNOWN.has(t), `unknown tool: ${t}`);
});

test("declares Bash — required to run merges, the suite, and MERGE_TOKEN I/O", () => {
  const tools = fm.tools.split(",").map((t) => t.trim());
  assert.ok(tools.includes("Bash"), "merger protocol needs Bash but it is not declared");
});

test("MERGE_TOKEN gating contract is present in the body", () => {
  const body = RAW.slice(RAW.indexOf("\n---", 3) + 4);
  assert.match(body, /MERGE_TOKEN/, "MERGE_TOKEN protocol clause is missing");
  // create -> merge -> full suite -> record exit codes -> remove token.
  assert.match(body, /create[\s\S]*MERGE_TOKEN[\s\S]*merge[\s\S]*remove MERGE_TOKEN/i,
    "the create->merge->...->remove MERGE_TOKEN ordering is missing");
});

test("serial, one-group-at-a-time discipline is stated (not batched)", () => {
  assert.match(RAW, /serial/i, "serial-merge clause missing");
  assert.match(RAW, /never batched|one group at a time/i, "anti-batching clause missing");
});

test("red-suite-after-merge revert+quarantine contract is present", () => {
  assert.match(RAW, /revert/i, "revert-on-red clause missing");
  assert.match(RAW, /QUARANTINED/, "quarantine clause missing");
});

test("no-push-without-explicit-instruction contract is present", () => {
  assert.match(RAW, /never push to remotes|You never push/i, "no-push default clause missing");
});
