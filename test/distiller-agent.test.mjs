// Oracle for agents/hyperworkflows-distiller.md — a grey unit (an LLM agent
// prompt/spec, no executable acceptance). Its runtime behavior (an LLM
// appending measured stats under memory/) is not deterministically
// executable, so no golden/metamorphic oracle on output is feasible.
//
// Strongest feasible oracle: a PROPERTY test over the spec file that pins the
// invariants the ROLE CONTRACT asserts about itself. The load-bearing property
// is contract/config consistency: the contract says "You write ONLY under
// memory/", so the tool grant must NOT include a write-anywhere escape hatch
// (Bash or Edit). These properties hold for any correct revision of the spec,
// not just the current bytes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AGENT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "agents",
  "hyperworkflows-distiller.md",
);

// Minimal, zero-dep frontmatter parser for the simple `key: value` shape used
// by every agent file in agents/.
function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, "file must open with a `---` YAML frontmatter block");
  const fm = {};
  for (const line of m[1].split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    assert.ok(i > 0, `malformed frontmatter line: ${JSON.stringify(line)}`);
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { fm, body: m[2] };
}

const raw = readFileSync(AGENT, "utf8");
const { fm, body } = parseFrontmatter(raw);

test("distiller: required frontmatter keys present", () => {
  for (const k of ["name", "description", "model", "tools"]) {
    assert.ok(k in fm, `missing frontmatter key: ${k}`);
    assert.ok(fm[k].length > 0, `empty frontmatter value: ${k}`);
  }
});

test("distiller: name matches filename", () => {
  assert.equal(fm.name, "hyperworkflows-distiller");
});

test("distiller: tool grant is consistent with 'writes ONLY under memory/'", () => {
  const tools = fm.tools.split(",").map((t) => t.trim()).filter(Boolean);
  // The contract forbids writing outside memory/. A Bash or Edit grant would be
  // a write-anywhere escape hatch that contradicts the ROLE CONTRACT.
  assert.ok(!tools.includes("Bash"), "distiller must not be granted Bash");
  assert.ok(!tools.includes("Edit"), "distiller must not be granted Edit");
  // It must retain Write (it appends to memory/) and read tools to consume the
  // ledger.
  assert.ok(tools.includes("Write"), "distiller needs Write");
  assert.ok(tools.includes("Read"), "distiller needs Read");
});

test("distiller: body encodes the memory/-only write-scope constraint", () => {
  assert.match(
    body,
    /write[^.]*only[^.]*memory\//i,
    "body must state that writes go only under memory/",
  );
});

test("distiller: body encodes the second-occurrence promotion threshold", () => {
  // Threshold discipline: a candidate is promoted only on its SECOND occurrence.
  assert.match(body, /SECOND occurrence/i);
});
