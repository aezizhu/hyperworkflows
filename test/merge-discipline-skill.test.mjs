import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Oracle for skills/merge-discipline/SKILL.md — a Claude Code skill spec whose
// rendered behavior (an agent following a merge protocol) is not deterministically
// executable here. So this forges the strongest FEASIBLE oracle: a property test over
// the skill-discovery contract Claude Code relies on, plus the load-bearing safety
// invariants the merge-discipline prose MUST assert. Dropping any of these invariants
// from the doc is a real regression (e.g. gating on the group's acceptance instead of
// the full suite, or proceeding on a red integration branch) that this oracle catches.

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "skills", "merge-discipline");
const SKILL_MD = join(SKILL_DIR, "SKILL.md");
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

// ---- discovery contract ----------------------------------------------------

test("SKILL.md: has well-formed YAML frontmatter (discovery contract)", () => {
  const fm = parseFrontmatter(raw);
  assert.ok(fm, "SKILL.md must open with a `---`-delimited YAML frontmatter block");
});

test("SKILL.md: name matches the skill directory (invocation key)", () => {
  const fm = parseFrontmatter(raw);
  assert.equal(
    fm.fields.name,
    basename(SKILL_DIR),
    "frontmatter `name` must equal the skill directory name so the skill resolves"
  );
});

test("SKILL.md: frontmatter carries a non-trivial description (renders in the skill menu)", () => {
  const fm = parseFrontmatter(raw);
  assert.ok(fm.fields.description, "frontmatter must define `description`");
  assert.ok(fm.fields.description.length >= 20, "description must be non-trivial");
});

test("SKILL.md: has a non-empty instruction body", () => {
  const fm = parseFrontmatter(raw);
  assert.ok(fm.body.trim().length > 0, "skill body must not be empty");
});

// ---- load-bearing protocol invariants --------------------------------------

test("SKILL.md: asserts serial merging (one merger / one group at a time)", () => {
  assert.match(raw, /serial/i, "must describe serial merging");
  assert.match(
    raw,
    /one\s+(?:merger|group).{0,40}at a time/i,
    "must state one merger / one group at a time"
  );
});

test("SKILL.md: gates on the FULL suite, not just the group's acceptance", () => {
  assert.match(raw, /full\s+suite/i, "must require running the full suite");
  assert.match(
    raw,
    /not\s+the\s+group'?s?\s+acceptance/i,
    "must explicitly reject gating on only the group's acceptance"
  );
});

test("SKILL.md: mandates immediate revert + quarantine on a red integration branch", () => {
  assert.match(raw, /revert\s+the\s+merge\s+immediately/i, "red must trigger immediate revert");
  assert.match(raw, /quarantin/i, "the failing group must be quarantined");
  assert.match(
    raw,
    /never\s+proceed\s+on\s+a\s+red\s+integration\s+branch/i,
    "must forbid proceeding on a red integration branch"
  );
});

test("SKILL.md: describes the MERGE_TOKEN lifecycle", () => {
  const tokens = raw.match(/MERGE_TOKEN/g) || [];
  assert.ok(
    tokens.length >= 2,
    "MERGE_TOKEN must be created (guard) and removed — expect multiple references"
  );
  assert.match(raw, /remove\s+MERGE_TOKEN/i, "protocol must remove the token after a group");
  assert.match(
    raw,
    /leftover\s+MERGE_TOKEN.{0,60}bug/i,
    "a leftover MERGE_TOKEN after the phase must be flagged as a bug"
  );
});

test("SKILL.md: 'pre-existing failure' excuse requires re-run proof", () => {
  assert.match(
    raw,
    /pre-existing.{0,80}(?:proof|re-?run)/is,
    "the pre-existing-failure excuse must require proof (re-run on the pre-merge commit)"
  );
});

test("SKILL.md: semantic conflicts are stuck, never guessed", () => {
  assert.match(
    raw,
    /semantic\s+conflicts?.{0,60}(?:stuck|never\s+guess)/is,
    "semantic conflicts must be reported, never guessed"
  );
});

test("SKILL.md: remote pushes gated on explicit authorization", () => {
  assert.match(
    raw,
    /remote\s+push(?:es)?\s+only\s+when.{0,60}authoriz/is,
    "remote pushes must require explicit run authorization"
  );
});
