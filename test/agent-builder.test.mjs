// Oracle for agents/hyperworkflows-builder.md
//
// The builder agent file is a static definition consumed by the harness. Its
// prose ROLE CONTRACT is subjective and cannot be tested deterministically, but
// its YAML frontmatter is the machine-consumed interface: Claude Code loads the
// agent by `name`, routes it to `model`, and honors `isolation`. These are
// load-bearing invariants — if they regress, the agent silently fails to load or
// runs on the wrong model / without worktree isolation.
//
// Oracle type: golden/property test on the frontmatter contract.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const AGENTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "agents");
const BUILDER = join(AGENTS_DIR, "hyperworkflows-builder.md");

// Minimal frontmatter parser: leading `---\n ... \n---`, flat `key: value` lines.
function parseFrontmatter(text) {
  assert.ok(text.startsWith("---\n"), "file must open with a `---` frontmatter fence");
  const end = text.indexOf("\n---", 4);
  assert.ok(end !== -1, "frontmatter must be closed with a `---` fence");
  const block = text.slice(4, end);
  const body = text.slice(end + 4);
  const fm = {};
  for (const line of block.split("\n")) {
    if (!line.trim()) continue;
    const idx = line.indexOf(":");
    assert.ok(idx !== -1, `malformed frontmatter line: ${JSON.stringify(line)}`);
    fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { fm, body };
}

test("builder agent frontmatter satisfies the loader contract", () => {
  const { fm, body } = parseFrontmatter(readFileSync(BUILDER, "utf8"));

  // Required, load-bearing keys.
  assert.equal(fm.name, "hyperworkflows-builder", "name must match the filename stem");
  assert.equal(fm.model, "opus", "builder is declared to run on opus");
  assert.equal(fm.isolation, "worktree", "builder must be isolated in a worktree");
  assert.ok(fm.description && fm.description.length > 0, "description must be non-empty");

  // The prose contract must actually be present (guards against a truncated file).
  assert.match(body, /ROLE CONTRACT\s+—\s+builder/, "body must carry the builder ROLE CONTRACT");
});

test("every agent file's frontmatter `name` matches its filename stem", () => {
  const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".md"));
  assert.ok(files.length > 0, "expected at least one agent file");
  for (const f of files) {
    const { fm } = parseFrontmatter(readFileSync(join(AGENTS_DIR, f), "utf8"));
    assert.equal(fm.name, basename(f, ".md"), `${f}: frontmatter name must equal filename stem`);
    assert.ok(fm.description && fm.description.length > 0, `${f}: description must be non-empty`);
    assert.ok(fm.model && fm.model.length > 0, `${f}: model must be declared`);
  }
});
