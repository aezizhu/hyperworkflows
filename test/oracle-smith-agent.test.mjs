import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Property/contract oracle for the oracle-smith agent definition.
//
// The prose semantics (whether an LLM obeys the contract) are subjective and
// NOT machine-verifiable. What IS verifiable is the structural contract other
// tooling depends on: a well-formed YAML frontmatter block, required keys, the
// `name` matching the filename, and cross-consistency between the declared
// `isolation: worktree` and the body's promise to work in an isolated worktree.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "agents", "hyperworkflows-oracle-smith.md");

function parseFrontmatter(src) {
  // Frontmatter is a leading `---` line, keys, then a closing `---` line.
  assert.ok(src.startsWith("---\n"), "file must open with a `---` frontmatter fence");
  const end = src.indexOf("\n---", 3);
  assert.ok(end !== -1, "frontmatter must be closed with a `---` fence");
  const block = src.slice(4, end);
  const body = src.slice(end).replace(/^\n---\s*/, "");
  const kv = {};
  for (const line of block.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    assert.ok(m, `frontmatter line is not a simple key: value pair: ${JSON.stringify(line)}`);
    kv[m[1]] = m[2].trim();
  }
  return { kv, body };
}

test("oracle-smith agent: frontmatter is well-formed with required keys", () => {
  const src = readFileSync(FILE, "utf8");
  const { kv } = parseFrontmatter(src);
  for (const key of ["name", "description", "model", "isolation"]) {
    assert.ok(key in kv, `frontmatter must define \`${key}\``);
    assert.ok(kv[key].length > 0, `frontmatter \`${key}\` must be non-empty`);
  }
});

test("oracle-smith agent: name matches filename", () => {
  const src = readFileSync(FILE, "utf8");
  const { kv } = parseFrontmatter(src);
  const expected = basename(FILE, ".md");
  assert.equal(kv.name, expected, `frontmatter name must equal filename stem ${expected}`);
});

test("oracle-smith agent: isolation is worktree, consistent with prose", () => {
  const src = readFileSync(FILE, "utf8");
  const { kv, body } = parseFrontmatter(src);
  assert.equal(kv.isolation, "worktree", "isolation must be declared `worktree`");
  // Cross-consistency: the body must actually promise isolated-worktree work.
  assert.match(body, /worktree/, "body must reference working in a worktree");
});

test("oracle-smith agent: role contract states oracle preference order", () => {
  const src = readFileSync(FILE, "utf8");
  const { body } = parseFrontmatter(src);
  assert.match(body, /ROLE CONTRACT/, "body must contain the ROLE CONTRACT header");
  // The defining preference chain: golden > property > metamorphic > snapshot.
  const order = ["golden", "property", "metamorphic", "snapshot"];
  let cursor = -1;
  for (const term of order) {
    const idx = body.toLowerCase().indexOf(term, cursor + 1);
    assert.ok(idx > cursor, `oracle preference order must list "${term}" after the previous term`);
    cursor = idx;
  }
});

test("oracle-smith agent: enforces test-only changes", () => {
  const src = readFileSync(FILE, "utf8");
  const { body } = parseFrontmatter(src);
  assert.match(body, /test-only/i, "contract must state changes are test-only");
  assert.match(body, /infeasible/i, "contract must provide for infeasible units");
});
