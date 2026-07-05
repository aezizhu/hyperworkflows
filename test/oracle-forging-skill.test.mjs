import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Oracle for skills/oracle-forging/SKILL.md — a skill prompt-spec whose rendered
// effect (an agent forging a good oracle) is subjective and not deterministically
// checkable. So this forges the strongest FEASIBLE oracle: a property test over the
// skill-file discovery contract Claude Code relies on, plus the load-bearing content
// invariant this particular skill exists to encode — the four oracle types must be
// documented in the exact strongest-first preference order. If that order ever
// regresses (or a type is dropped), this catches it.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SKILL_MD = join(ROOT, "skills", "oracle-forging", "SKILL.md");
const raw = readFileSync(SKILL_MD, "utf8");

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return null;
  const fields = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fields, body: m[2] };
}

test("oracle-forging SKILL.md: has well-formed YAML frontmatter (discovery contract)", () => {
  const fm = parseFrontmatter(raw);
  assert.ok(fm, "SKILL.md must open with a `---`-delimited YAML frontmatter block");
});

test("oracle-forging SKILL.md: name field matches the skill directory (binding contract)", () => {
  const fm = parseFrontmatter(raw);
  assert.equal(
    fm.fields.name,
    "oracle-forging",
    "frontmatter `name` must equal the containing directory so the skill resolves"
  );
});

test("oracle-forging SKILL.md: frontmatter carries a non-empty description (skill menu)", () => {
  const fm = parseFrontmatter(raw);
  assert.ok(fm.fields.description, "frontmatter must define `description`");
  assert.ok(fm.fields.description.length >= 10, "description must be non-trivial");
});

test("oracle-forging SKILL.md: has a non-empty instruction body", () => {
  const fm = parseFrontmatter(raw);
  assert.ok(fm.body.trim().length > 0, "skill body must not be empty");
});

test("oracle-forging SKILL.md: documents all four oracle types in strongest-first order", () => {
  // This is the reason the skill exists: the preference ladder. The anchor phrases
  // below are the section markers used in the body. Their FIRST occurrences must be
  // strictly increasing in position: golden < property < metamorphic < snapshot.
  const body = parseFrontmatter(raw).body;
  const anchors = [
    ["golden file", /golden file/i],
    ["property-based", /property-based/i],
    ["metamorphic relation", /metamorphic relation/i],
    ["snapshot test", /snapshot test/i],
  ];
  const positions = anchors.map(([label, re]) => {
    const idx = body.search(re);
    assert.ok(idx !== -1, `body must mention the "${label}" oracle type`);
    return { label, idx };
  });
  for (let i = 1; i < positions.length; i++) {
    assert.ok(
      positions[i - 1].idx < positions[i].idx,
      `"${positions[i - 1].label}" must appear before "${positions[i].label}" (strongest-first ladder)`
    );
  }
});

test("oracle-forging SKILL.md: preserves the pass-on-current-code / else-defect invariant", () => {
  // The core rule: a forged oracle must pass on current code; if it fails it is a
  // defect finding, not an oracle. Dropping this collapses the skill's meaning.
  assert.match(
    raw,
    /must PASS on current code/i,
    "SKILL.md must state the forged acceptance has to pass on current code"
  );
  assert.match(
    raw,
    /found a defect|report it as a finding/i,
    "SKILL.md must state a failing oracle is a defect finding, not an oracle"
  );
});

test("oracle-forging SKILL.md: preserves the test-only constraint", () => {
  assert.match(
    raw,
    /test-only/i,
    "SKILL.md must state changes are test-only (no restructuring production code for testability)"
  );
});
