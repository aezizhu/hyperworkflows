// Forged acceptance oracle for agents/hyperworkflows-scout.md
//
// The scout agent contract has no executable acceptance. Its content is a
// declarative agent definition (YAML frontmatter + prose ROLE CONTRACT).
//
// Oracle class: PROPERTY TEST (oracle-forging tier 2). An exact golden file
// (tier 1) would over-fit to the prose wording and flag legitimate edits as
// failures; instead we encode the invariants that make this unit CORRECT:
//   - the frontmatter is well-formed and carries the loader-critical keys;
//   - `name` matches the filename (the Claude Code agent loader keys agents by
//     name — a mismatch silently breaks dispatch);
//   - the DEFINING contract property: the file self-declares a "read-only
//     reconnaissance worker", so its granted tools MUST be a subset of the
//     read-only set {Read, Grep, Glob} and MUST NOT include any tool that can
//     mutate state or execute code (Bash, Write, Edit, MultiEdit, NotebookEdit).
//     Granting scout Bash/Write would violate its read-only charter — a real
//     defect this oracle is designed to catch.
//
// These all hold on the current file, so the oracle PASSES on current code.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_PATH = join(REPO, "agents", "hyperworkflows-scout.md");

const READ_ONLY_TOOLS = new Set(["Read", "Grep", "Glob"]);
const MUTATING_TOOLS = new Set(["Bash", "Write", "Edit", "MultiEdit", "NotebookEdit"]);
const KNOWN_MODELS = new Set(["haiku", "sonnet", "opus"]);

// Minimal frontmatter parser: leading `---` line, key: value lines, closing `---`.
function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  assert.equal(lines[0], "---", "file must open with a `---` frontmatter fence");
  const fm = {};
  let closed = false;
  let i = 1;
  for (; i < lines.length; i++) {
    if (lines[i] === "---") { closed = true; i++; break; }
    const m = lines[i].match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
    assert.ok(m, `frontmatter line is not a key: value pair -> ${JSON.stringify(lines[i])}`);
    fm[m[1]] = m[2].trim();
  }
  assert.ok(closed, "frontmatter must be closed with a second `---` fence");
  return { fm, body: lines.slice(i).join("\n") };
}

const raw = readFileSync(AGENT_PATH, "utf8");
const { fm, body } = parseFrontmatter(raw);

test("scout: frontmatter carries loader-critical keys", () => {
  for (const key of ["name", "description", "tools", "model"]) {
    assert.ok(fm[key] && fm[key].length > 0, `missing/empty frontmatter key: ${key}`);
  }
});

test("scout: name matches filename (agent loader keys on name)", () => {
  const expected = basename(AGENT_PATH, ".md");
  assert.equal(fm.name, expected);
});

test("scout: model is a known tier", () => {
  assert.ok(KNOWN_MODELS.has(fm.model), `unknown model tier: ${fm.model}`);
});

test("scout: maxTurns, if present, is a positive integer", () => {
  if (fm.maxTurns === undefined) return;
  assert.match(fm.maxTurns, /^\d+$/, "maxTurns must be an integer literal");
  assert.ok(Number(fm.maxTurns) > 0, "maxTurns must be positive");
});

test("scout: granted tools honor the read-only charter", () => {
  const tools = fm.tools.split(",").map(t => t.trim()).filter(Boolean);
  assert.ok(tools.length > 0, "tools list must be non-empty");
  for (const t of tools) {
    assert.ok(!MUTATING_TOOLS.has(t), `read-only scout must not be granted mutating tool: ${t}`);
    assert.ok(READ_ONLY_TOOLS.has(t), `scout tool not in the read-only set {Read,Grep,Glob}: ${t}`);
  }
});

test("scout: prose self-declares the read-only reconnaissance charter", () => {
  assert.match(body, /read-only/i, "body must self-declare a read-only role");
  assert.match(body, /recon|reconnaissance/i, "body must declare a reconnaissance role");
});
