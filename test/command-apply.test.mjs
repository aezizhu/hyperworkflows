// Oracle for commands/apply.md (a slash-command spec).
//
// A prose command spec has no self-evident executable acceptance, but it makes
// two machine-checkable promises that must hold or the command is broken at
// invocation time:
//   (P1) It is a well-formed Claude Code command: parseable YAML frontmatter
//        carrying the keys the harness renders (`description`, `argument-hint`),
//        each with a non-empty value.
//   (P2) Referential integrity: every engine file the command promises to
//        "read and execute" via ${CLAUDE_PLUGIN_ROOT}/... actually exists in the
//        shipped plugin. A rename/move of the engine silently breaks the command
//        without this guard.
//   (P3) The core delivery-discipline vocabulary the command is specified around
//        (tournament, serial/gated merge, tricolor verdict, runs/ACTIVE lifecycle,
//        MERGE_TOKEN) is present — a metamorphic guard so an edit that guts the
//        contract fails loudly instead of passing a bare snapshot.
//
// These are properties, not a golden snapshot: prose wording may change freely;
// only the load-bearing invariants are pinned.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = join(ROOT, "commands", "apply.md");

function splitFrontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(src);
  assert.ok(m, "apply.md must open with a YAML frontmatter block delimited by ---");
  return { front: m[1], body: src.slice(m[0].length) };
}

function frontKey(front, key) {
  const m = new RegExp(`^${key}:\\s*(.+?)\\s*$`, "m").exec(front);
  return m ? m[1].replace(/^["']|["']$/g, "").trim() : null;
}

test("apply.md: P1 frontmatter carries non-empty description and argument-hint", () => {
  const { front } = splitFrontmatter(readFileSync(APPLY, "utf8"));
  for (const key of ["description", "argument-hint"]) {
    const val = frontKey(front, key);
    assert.ok(val && val.length > 0, `frontmatter key "${key}" must be present and non-empty`);
  }
});

test("apply.md: P2 every ${CLAUDE_PLUGIN_ROOT} engine reference resolves to a real file", () => {
  const { body } = splitFrontmatter(readFileSync(APPLY, "utf8"));
  const refs = [...body.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([^\s`)]+)/g)].map(m => m[1]);
  assert.ok(refs.length > 0, "command must reference at least one shipped engine path");
  for (const rel of refs) {
    assert.ok(existsSync(join(ROOT, rel)), `referenced engine "${rel}" is missing from the plugin`);
  }
});

test("apply.md: P3 delivery-discipline contract vocabulary is present", () => {
  const src = readFileSync(APPLY, "utf8");
  for (const token of [/tournament/i, /serial/i, /tricolor/i, /runs\/ACTIVE/, /MERGE_TOKEN/, /human-approved/i]) {
    assert.match(src, token, `apply.md must retain contract token ${token}`);
  }
});
