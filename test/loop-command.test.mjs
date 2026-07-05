// Oracle for commands/loop.md — a slash-command spec.
// The prose body is subjective, but the file has objective, machine-checkable
// structural invariants. This forges a referential-integrity + frontmatter
// oracle: strongest feasible for a command-definition Markdown unit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const COMMANDS_DIR = join(REPO, "commands");
const LOOP = join(COMMANDS_DIR, "loop.md");

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "loop.md must open with a --- delimited YAML frontmatter block");
  const body = text.slice(m[0].length);
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body };
}

test("loop.md: frontmatter has required non-empty keys", () => {
  const { fm } = parseFrontmatter(readFileSync(LOOP, "utf8"));
  for (const key of ["description", "argument-hint"]) {
    assert.ok(key in fm, `frontmatter must declare "${key}"`);
    assert.ok(fm[key].length > 0, `frontmatter "${key}" must be non-empty`);
  }
});

test("loop.md: declares arguments, so body must consume $ARGUMENTS", () => {
  const { fm, body } = parseFrontmatter(readFileSync(LOOP, "utf8"));
  // argument-hint advertises args; the body must actually reference them,
  // otherwise the declared contract is a dead letter.
  assert.ok(fm["argument-hint"].length > 0, "argument-hint present");
  assert.match(body, /\$ARGUMENTS/, "body must reference $ARGUMENTS placeholder");
});

test("loop.md: every /hyperworkflows:<cmd> cross-reference resolves to a command file", () => {
  const body = readFileSync(LOOP, "utf8");
  const refs = [...body.matchAll(/\/hyperworkflows:([a-z][a-z-]*)/g)].map((m) => m[1]);
  assert.ok(refs.length > 0, "loop orchestrates other commands; expected at least one reference");
  const known = new Set(
    readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3))
  );
  for (const name of new Set(refs)) {
    assert.ok(
      existsSync(join(COMMANDS_DIR, `${name}.md`)) && known.has(name),
      `referenced command /hyperworkflows:${name} must have a commands/${name}.md file`
    );
  }
});
