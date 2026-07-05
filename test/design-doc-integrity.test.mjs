// Property-based oracle for hyperworkflows-design.md
//
// A design document's prose (whether the architecture is "good") is a subjective
// oracle and stays grey. But the document makes MECHANICALLY-CHECKABLE structural
// claims about itself and the repo. These properties are the strongest feasible
// executable acceptance: they catch doc-rot regressions (broken cross-references,
// dropped constitution clauses, unbalanced code fences, a renamed companion doc)
// without asserting anything about the subjective narrative.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = join(ROOT, "hyperworkflows-design.md");
const text = readFileSync(DOC, "utf8");
const lines = text.split("\n");

// Numbered section headers defined in the doc, e.g. "## 4. Core" / "### 4.10 ...".
function definedSections() {
  const set = new Set();
  for (const l of lines) {
    const m = l.match(/^#{2,4}\s+([0-9]+(?:\.[0-9]+)*)[.\s]/);
    if (m) set.add(m[1]);
  }
  return set;
}

test("property: every §N.M cross-reference resolves to a defined section header", () => {
  const defined = definedSections();
  const refs = [...text.matchAll(/§([0-9]+(?:\.[0-9]+)*)/g)].map((m) => m[1]);
  assert.ok(refs.length > 0, "expected at least one section cross-reference");
  const dangling = [...new Set(refs)].filter((r) => !defined.has(r));
  assert.deepEqual(dangling, [], `dangling §-references (no matching header): ${dangling.join(", ")}`);
});

test("property: Constitution clauses C1..C8 are each defined", () => {
  for (let i = 1; i <= 8; i++) {
    assert.match(text, new RegExp(`\\*\\*C${i} `), `missing Constitution clause C${i}`);
  }
});

test("property: Assumption Register rows A1..A10 are each present", () => {
  for (let i = 1; i <= 10; i++) {
    assert.match(text, new RegExp(`^\\| A${i} `, "m"), `missing assumption row A${i}`);
  }
});

test("property: fenced code blocks are balanced (even number of ``` fences)", () => {
  const fences = lines.filter((l) => l.startsWith("```")).length;
  assert.equal(fences % 2, 0, `odd number of code fences (${fences}) => an unclosed block`);
});

test("property: the companion document it names on disk exists", () => {
  // The header block declares: Companion document: `plugin-design.md`.
  assert.match(text, /Companion document\*\*:\s*`plugin-design\.md`/);
  assert.ok(existsSync(join(ROOT, "plugin-design.md")), "companion doc plugin-design.md is missing");
});

test("property: the three workflow skeletons are documented as §5 subsections", () => {
  for (const [sec, name] of [["5.1", "hyperaudit.js"], ["5.2", "hyperapply.js"], ["5.3", "hypersentinel.js"]]) {
    assert.match(text, new RegExp(`### ${sec.replace(".", "\\.")} \`${name.replace(".", "\\.")}\``),
      `expected §${sec} to document ${name}`);
  }
});
