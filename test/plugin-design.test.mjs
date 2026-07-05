// Oracle for plugin-design.md — a metamorphic doc<->repo consistency test.
//
// plugin-design.md is not a generated artifact, so there is no golden file to
// diff against and no meaningful snapshot (a content hash would only detect
// "someone edited the doc", not whether the doc is correct). The strongest
// FEASIBLE oracle is a property/consistency relation: every concrete artifact
// the design enumerates as shipping in the plugin MUST exist in the repo, and
// the quantitative claims (14-role roster, the five methodology skills) must
// match the actual component set. This makes the design doc falsifiable by a
// script with zero LLM calls, and fails loudly if the doc and the tree drift.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = readFileSync(join(ROOT, "plugin-design.md"), "utf8");
const lines = DOC.split("\n");

// --- Extract the plugin-layout ASCII tree (the first fenced block, rooted at
// "hyperworkflows/"). The second fenced block describes lazily-created
// project-side state (runs/, memory/, .claude/) and is deliberately excluded.
function pluginLayoutBlock() {
  const blocks = [];
  let inBlock = false, buf = [];
  for (const ln of lines) {
    if (ln.trimStart().startsWith("```")) {
      if (inBlock) { blocks.push(buf.join("\n")); buf = []; }
      inBlock = !inBlock;
      continue;
    }
    if (inBlock) buf.push(ln);
  }
  const block = blocks.find(b => b.trimStart().startsWith("hyperworkflows/"));
  assert.ok(block, "plugin-design.md §2 must contain a fenced layout rooted at 'hyperworkflows/'");
  return block;
}

// Reconstruct full paths from the indentation-encoded tree.
function filesFromTree(block) {
  const files = [];
  const stack = []; // stack[level] = directory name
  for (const raw of block.split("\n")) {
    const m = raw.match(/[├└]── /);
    if (!m) continue;
    const idx = m.index;
    const level = Math.round(raw.slice(0, idx).length / 4);
    const token = raw.slice(idx + 4).trimStart().split(/\s+/)[0];
    if (!token) continue;
    const isDir = token.endsWith("/");
    const name = isDir ? token.slice(0, -1) : token;
    if (isDir) {
      stack[level] = name;
      stack.length = level + 1;
    } else {
      const parent = stack.slice(0, level).join("/");
      files.push(parent ? `${parent}/${name}` : name);
    }
  }
  return files;
}

test("§2 layout: every enumerated plugin file exists in the repo", () => {
  const files = filesFromTree(pluginLayoutBlock());
  // Sanity: the tree must yield the load-bearing artifacts, not just a stray line.
  assert.ok(files.length >= 20, `expected the layout to enumerate many files, got ${files.length}`);
  assert.ok(files.includes(".claude-plugin/plugin.json"));
  assert.ok(files.includes("workflows/hyperaudit.js"));
  const missing = files.filter(f => !existsSync(join(ROOT, f)));
  assert.deepEqual(missing, [], `design doc §2 names files that do not exist: ${missing.join(", ")}`);
});

// --- §3.2 agent roster: the table rows are the source of truth.
function sectionBetween(startRe, endRe) {
  const start = lines.findIndex(l => startRe.test(l));
  assert.ok(start >= 0, `section start ${startRe} not found`);
  let end = lines.findIndex((l, i) => i > start && endRe.test(l));
  if (end < 0) end = lines.length;
  return lines.slice(start, end);
}

test("§3.2: the 14-role roster is real and count matches the heading claim", () => {
  const sec = sectionBetween(/^### 3\.2 /, /^### 3\.3 /);
  const heading = sec[0];
  const claimed = Number(heading.match(/\((\d+) roles/)[1]);
  const roles = sec
    .map(l => l.match(/^\| `hyperworkflows-([a-z-]+)`/))
    .filter(Boolean)
    .map(m => m[1]);
  assert.equal(roles.length, claimed, `heading claims ${claimed} roles, table lists ${roles.length}`);
  const missing = roles
    .map(r => `agents/hyperworkflows-${r}.md`)
    .filter(f => !existsSync(join(ROOT, f)));
  assert.deepEqual(missing, [], `roster names roles with no agent file: ${missing.join(", ")}`);
});

test("§3.5: every methodology skill listed has a SKILL.md", () => {
  const sec = sectionBetween(/^### 3\.5 /, /^### 3\.6 /);
  const skills = sec
    .map(l => l.match(/^- \*\*([a-z-]+)\*\* —/))
    .filter(Boolean)
    .map(m => m[1]);
  assert.ok(skills.length >= 5, `expected the five methodology skills, got ${skills.length}`);
  const missing = skills
    .map(s => `skills/${s}/SKILL.md`)
    .filter(f => !existsSync(join(ROOT, f)));
  assert.deepEqual(missing, [], `§3.5 names skills with no SKILL.md: ${missing.join(", ")}`);
});
