// Oracle for skills/spec-attack/SKILL.md (prose skill, no runtime).
//
// The skill's entire value is (a) frontmatter that loads under the right name
// and (b) the enumerated acceptance-dimension checklist it forces auditors to
// walk. Dropping a dimension is the exact "all green but wrong" coverage hole
// the skill exists to prevent, so we golden-pin the load-bearing content.
//
// Oracle type: golden-content / structural (strongest feasible for a prose
// instruction file — an exact byte snapshot would be brittle to harmless
// wording edits while missing the semantic invariants that actually matter).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "skills", "spec-attack");
const SKILL_PATH = join(SKILL_DIR, "SKILL.md");
const raw = readFileSync(SKILL_PATH, "utf8");

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "SKILL.md must open with a YAML frontmatter block delimited by ---");
  const fields = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) fields[kv[1]] = kv[2].trim();
  }
  return fields;
}

test("spec-attack: frontmatter loads the skill under its directory name", () => {
  const fm = parseFrontmatter(raw);
  // name must match the directory or Claude Code registers it under the wrong id.
  assert.equal(fm.name, basename(SKILL_DIR), "frontmatter name must equal the skill directory name");
  assert.ok(fm.description && fm.description.length >= 20, "description must be present and non-trivial");
});

test("spec-attack: all load-bearing acceptance dimensions are present", () => {
  // These bolded checklist items are the skill's reason to exist. Each is the
  // heading of one attack dimension; silently dropping any one reopens a
  // contract hole. Match the exact bold labels used in the file.
  const dimensions = [
    "Performance",
    "Security",
    "Concurrency & ordering",
    "Boundary semantics",
    "Error paths",
    "Resource lifecycle",
    "Compatibility",
  ];
  for (const d of dimensions) {
    assert.ok(raw.includes(`**${d}**`), `missing acceptance dimension: **${d}**`);
  }
});

test("spec-attack: the three enforcement rules survive edits", () => {
  // Rule 1: every hole must carry a concrete command, else it is an opinion.
  assert.match(raw, /concrete\s+`proposed_cmd`\s+per\s+hole/i);
  assert.match(raw, /A hole without an executable `proposed_cmd` is an opinion/);
  // Rule 2: rank by blast radius, not ease of writing the test.
  assert.match(raw, /Rank holes by blast radius/);
  // Rule 3: this role proposes holes, never edits contracts itself.
  assert.match(raw, /you never modify contracts yourself/);
});
