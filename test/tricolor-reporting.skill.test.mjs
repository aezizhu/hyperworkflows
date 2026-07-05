// Oracle for skills/tricolor-reporting/SKILL.md
//
// This unit is a prose specification skill with no runtime entrypoint, so a byte
// snapshot would be vacuous (it re-asserts the file's own bytes and rejects every
// legitimate edit). Instead this is a PROPERTY-BASED oracle: it encodes the
// invariants the skill MUST satisfy to be a valid Claude Code skill AND to carry
// its load-bearing "constitution C4" contract. These properties fail if the
// frontmatter is renamed/desynced from its directory, if the mandatory report
// format loses one of its three buckets, or if a footer guarantee is dropped.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "skills", "tricolor-reporting");
const SRC = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");

// --- frontmatter parse (minimal, no yaml dep) ------------------------------
function frontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "SKILL.md must open with a --- delimited frontmatter block");
  const fields = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2];
  }
  return fields;
}

test("frontmatter: name matches directory and description is non-empty", () => {
  const fm = frontmatter(SRC);
  assert.equal(fm.name, basename(SKILL_DIR), "skill `name` must equal its directory name");
  assert.equal(fm.name, "tricolor-reporting");
  assert.ok(fm.description && fm.description.trim().length > 20, "skill needs a substantive description");
});

test("C4 contract: exactly the three mandated buckets are declared", () => {
  const buckets = [...SRC.matchAll(/^\d+\.\s+\*\*([A-Z][A-Z +\-]+?)\*\*/gm)].map(m => m[1].trim());
  assert.deepEqual(buckets, ["VERIFIED", "DONE-UNVERIFIED", "QUARANTINED + GREY"],
    "the tricolor report must declare exactly VERIFIED, DONE-UNVERIFIED, QUARANTINED + GREY in order");
  assert.match(SRC, /constitution C4/);
});

test("VERIFIED bucket enumerates all five depths D0..D4", () => {
  for (const d of ["D0", "D1", "D2", "D3", "D4"]) {
    assert.match(SRC, new RegExp(`\\b${d}\\b`), `depth ${d} must be named`);
  }
});

test("hard rules: coverage arithmetic and no-aggregation guarantees present", () => {
  assert.match(SRC, /verified\s*\/\s*total/, "must show `verified / total` coverage arithmetic");
  assert.match(SRC, /grey and quarantined counted in `total`/,
    "grey + quarantined must be counted in the denominator");
  assert.match(SRC, /failed unit is NEVER aggregated/i, "no-aggregation rule must be stated");
});

test("footer guarantees: recheck command, residual-risk note, SG timestamps", () => {
  assert.match(SRC, /recheck command/, "footer must include the one-line recheck command");
  assert.match(SRC, /residual-risk/, "footer must include the model-family residual-risk note");
  assert.match(SRC, /Asia\/Singapore/, "timestamps must be Asia/Singapore");
});
