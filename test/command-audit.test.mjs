import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Oracle for commands/audit.md (a slash-command spec/prompt file).
// The prose is subjective, so a golden file would be brittle. Instead we forge
// a PROPERTY test over the command's verifiable contract:
//   (1) valid frontmatter (description + argument-hint present),
//   (2) every ${CLAUDE_PLUGIN_ROOT}/<path> the command promises to invoke
//       resolves to a real file in the repo (no dead script/workflow refs).
// This catches the real drift class: a renamed/deleted script leaving the
// command pointing at a path that no longer exists.

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const AUDIT_MD = join(REPO, "commands", "audit.md");
const SRC = readFileSync(AUDIT_MD, "utf8");

test("audit.md: has frontmatter with description and argument-hint", () => {
  const fm = SRC.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, "frontmatter block must be present");
  assert.match(fm[1], /^description:\s*\S/m, "description key required");
  assert.match(fm[1], /^argument-hint:\s*\S/m, "argument-hint key required");
});

test("audit.md: every ${CLAUDE_PLUGIN_ROOT} path reference resolves to a real file", () => {
  const refs = [...SRC.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_./-]+)/g)]
    .map((m) => m[1]);
  const unique = [...new Set(refs)];
  assert.ok(unique.length >= 3, `expected >=3 plugin-root refs, found ${unique.length}`);
  const missing = unique.filter((rel) => !existsSync(join(REPO, rel)));
  assert.deepEqual(missing, [], `dead path references in audit.md: ${missing.join(", ")}`);
});
