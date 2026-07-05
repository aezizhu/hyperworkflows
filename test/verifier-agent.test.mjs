import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Oracle for agents/hyperworkflows-verifier.md.
// The agent body is a natural-language prompt (no computable golden output), so the
// strongest feasible oracle is a property-based test on its YAML frontmatter contract:
// the load-bearing, machine-checkable invariants that must hold for the C2 verifier to
// be a safe, correctly-wired Claude Code subagent.

const AGENT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "agents",
  "hyperworkflows-verifier.md"
);

// Minimal flat-frontmatter parser: the agent files use simple `key: value` lines
// between two `---` fences. No nested YAML is used, so this is sufficient and avoids
// adding a dependency.
function parseFrontmatter(src) {
  assert.ok(src.startsWith("---\n"), "file must open with a --- frontmatter fence");
  const end = src.indexOf("\n---", 3);
  assert.ok(end !== -1, "frontmatter must be closed with a --- fence");
  const block = src.slice(4, end + 1);
  const body = src.slice(src.indexOf("\n", end + 1) + 1);
  const fm = {};
  for (const line of block.split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    assert.ok(i > 0, `frontmatter line is not key: value -> ${JSON.stringify(line)}`);
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body };
}

const src = readFileSync(AGENT, "utf8");
const { fm, body } = parseFrontmatter(src);
const tools = (fm.tools || "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

test("verifier agent: name field equals filename basename", () => {
  const expected = basename(AGENT, ".md");
  assert.equal(fm.name, expected);
});

test("verifier agent: has a non-empty description", () => {
  assert.ok(fm.description && fm.description.length > 0);
});

test("verifier agent: declares a model", () => {
  assert.ok(fm.model && fm.model.length > 0);
});

test("verifier agent: declares at least one tool", () => {
  assert.ok(tools.length > 0, `tools was ${JSON.stringify(fm.tools)}`);
});

// The core C2 safety contract: the verifier "never modifies anything". Its declared
// tools must therefore be read/execute-only. If any write-capable tool ever appears in
// this frontmatter, the agent could violate its own constitution — this property makes
// that regression fail loudly.
test("verifier agent: tools are read/execute-only (never write-capable)", () => {
  const WRITE_CAPABLE = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
  const offenders = tools.filter((t) => WRITE_CAPABLE.has(t));
  assert.deepEqual(offenders, [], `write-capable tools declared: ${offenders.join(", ")}`);
});

// The frontmatter contract explicitly enumerates Bash and Read, matching the body's
// "You run commands and report raw exit codes."
test("verifier agent: tool set is exactly {Bash, Read}", () => {
  assert.deepEqual([...tools].sort(), ["Bash", "Read"]);
});

test("verifier agent: body forbids modification and interpretation", () => {
  assert.match(body, /exit code/i);
  assert.match(body, /[Nn]ever modif/);
});
