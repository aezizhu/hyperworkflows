// Oracle for adapters/devin/README.md
//
// The README is documentation whose truth is executable: it documents the exact
// command `sh adapters/devin/install.sh /path/to/your/project` and its outcomes.
// This binds every concrete claim in that README to the real behavior of the
// installer it describes, so the doc cannot silently drift from the code.
//
// Claims pinned (README -> assertion):
//  - "sh adapters/devin/install.sh /path/to/your/project" runs, exit 0
//  - "copies the five skills to <project>/.devin/skills/hyperworkflows-*/"
//    (the five NAMED skills, no more, no fewer)
//  - "generates <project>/.devin/hyperworkflows-role-prompts.md"
//  - "Role contracts (14 roles)" -> exactly 14 contract sections, and that count
//    tracks agents/hyperworkflows-*.md (so the doc's "14" stays honest)
//  - "frontmatter stripped, contract bodies kept" -> no YAML frontmatter leaks
//  - "Re-run any time; it overwrites the generated artifacts only" -> idempotent
//  - Deterministic-scripts row / Usage section reference scripts that exist

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INSTALL = join(ROOT, "adapters", "devin", "install.sh");
const README = join(ROOT, "adapters", "devin", "README.md");

// The five skills the README's portability table lists as 100%-portable.
const FIVE_SKILLS = [
  "oracle-forging",
  "spec-attack",
  "tricolor-reporting",
  "adjudication-protocol",
  "merge-discipline",
];

function freshTarget() {
  return mkdtempSync(join(tmpdir(), "devin-oracle-"));
}

function install(target) {
  return spawnSync("sh", [INSTALL, target], { encoding: "utf8" });
}

test("devin install.sh runs with exit 0 as the README documents", () => {
  const t = freshTarget();
  const r = install(t);
  assert.equal(r.status, 0, `install failed:\n${r.stderr}\n${r.stdout}`);
});

test("copies exactly the five named skills to .devin/skills/hyperworkflows-*/", () => {
  const t = freshTarget();
  assert.equal(install(t).status, 0);
  const skillsDir = join(t, ".devin", "skills");
  const got = readdirSync(skillsDir).sort();
  const want = FIVE_SKILLS.map((s) => `hyperworkflows-${s}`).sort();
  assert.deepEqual(got, want, "installed skill set must match the README's five");
  for (const s of FIVE_SKILLS) {
    const f = join(skillsDir, `hyperworkflows-${s}`, "SKILL.md");
    assert.ok(existsSync(f), `missing ${f}`);
    assert.ok(readFileSync(f, "utf8").length > 0, `empty ${f}`);
  }
});

test("generates .devin/hyperworkflows-role-prompts.md", () => {
  const t = freshTarget();
  assert.equal(install(t).status, 0);
  assert.ok(existsSync(join(t, ".devin", "hyperworkflows-role-prompts.md")));
});

test('"14 roles" is accurate and tracks agents/hyperworkflows-*.md', () => {
  const t = freshTarget();
  assert.equal(install(t).status, 0);
  const body = readFileSync(
    join(t, ".devin", "hyperworkflows-role-prompts.md"),
    "utf8"
  );
  const sections = body.match(/^## hyperworkflows-/gm) || [];
  const agentFiles = readdirSync(join(ROOT, "agents")).filter(
    (f) => f.startsWith("hyperworkflows-") && f.endsWith(".md")
  );
  assert.equal(agentFiles.length, 14, "repo must have 14 role contracts");
  assert.equal(
    sections.length,
    agentFiles.length,
    "generated file must contain one section per role contract"
  );
  // README literally claims "14 roles".
  assert.match(readFileSync(README, "utf8"), /\b14 roles\b/);
});

test("frontmatter is stripped, contract bodies kept", () => {
  const t = freshTarget();
  assert.equal(install(t).status, 0);
  const body = readFileSync(
    join(t, ".devin", "hyperworkflows-role-prompts.md"),
    "utf8"
  );
  // YAML frontmatter keys from agents/*.md must not leak into the generated doc.
  for (const key of ["agentType:", "description:", "tools:", "model:"]) {
    assert.ok(
      !new RegExp(`^${key}`, "m").test(body),
      `frontmatter key "${key}" leaked into role-prompts.md`
    );
  }
  // ...but real contract text is kept (bodies non-trivial).
  assert.ok(body.length > 1000, "generated contracts look empty");
});

test("re-run overwrites generated artifacts only (idempotent, exit 0 twice)", () => {
  const t = freshTarget();
  assert.equal(install(t).status, 0);
  const rp = join(t, ".devin", "hyperworkflows-role-prompts.md");
  const first = readFileSync(rp, "utf8");
  assert.equal(install(t).status, 0, "second run must also succeed");
  const second = readFileSync(rp, "utf8");
  assert.equal(second, first, "re-run must reproduce identical generated output");
});

test("scripts the README's usage/table reference exist", () => {
  for (const s of ["adjudicate.mjs", "recheck.mjs"]) {
    assert.ok(existsSync(join(ROOT, "scripts", s)), `missing scripts/${s}`);
  }
  // Node >= 18 is claimed; the scripts parse under the running node.
  for (const s of ["adjudicate.mjs", "recheck.mjs"]) {
    const r = execFileSync(process.execPath, ["--check", join(ROOT, "scripts", s)], {
      encoding: "utf8",
    });
    assert.equal(r, "");
  }
});
