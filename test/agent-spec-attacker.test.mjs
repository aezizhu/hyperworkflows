import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Oracle for the grey unit agents/hyperworkflows-spec-attacker.md — a Claude
// subagent definition (static prompt + YAML frontmatter). It has no runtime
// behavior of its own, so the strongest feasible oracle is a property-based
// test over the agent CONTRACT: the invariants that make this file a valid,
// safe, correctly-scoped spec-attacker subagent. These properties hold on the
// current file and would fail if a future edit breaks the contract (wrong name,
// unsafe tool grant, missing executability requirement, malformed frontmatter).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "agents", "hyperworkflows-spec-attacker.md");
const NAME = "hyperworkflows-spec-attacker";

const RAW = readFileSync(FILE, "utf8");

// Split leading YAML frontmatter (--- ... ---) from the prompt body.
function parse(raw) {
  assert.ok(raw.startsWith("---\n"), "must open with a --- frontmatter fence");
  const end = raw.indexOf("\n---\n", 4);
  assert.ok(end !== -1, "must have a closing --- frontmatter fence");
  const fm = raw.slice(4, end);
  const body = raw.slice(end + 5);
  const meta = {};
  for (const line of fm.split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    assert.ok(i !== -1, `frontmatter line is a key:value pair: "${line}"`);
    meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body };
}

const { meta, body } = parse(RAW);

test("frontmatter carries the required subagent keys", () => {
  for (const k of ["name", "description", "tools", "model"]) {
    assert.ok(k in meta, `missing required frontmatter key: ${k}`);
    assert.notEqual(meta[k], "", `frontmatter key ${k} must be non-empty`);
  }
});

test("name matches the filename basename", () => {
  assert.equal(meta.name, NAME);
});

test("model is a recognized tier", () => {
  assert.ok(["opus", "sonnet", "haiku"].includes(meta.model), `unexpected model: ${meta.model}`);
});

test("spec-attacker is READ-ONLY: no mutating tools granted", () => {
  const tools = meta.tools.split(",").map(t => t.trim()).filter(Boolean);
  assert.ok(tools.length > 0, "tools list must be non-empty");
  // It "attacks the spec itself, not the code" — granting Bash/Write/Edit/
  // MultiEdit would be a safety defect for a read-only contract attacker.
  for (const forbidden of ["Bash", "Write", "Edit", "MultiEdit"]) {
    assert.ok(!tools.includes(forbidden), `spec-attacker must not be granted ${forbidden}`);
  }
  // Every granted tool must be from the read-only reconnaissance set.
  const allowed = new Set(["Read", "Grep", "Glob"]);
  for (const t of tools) {
    assert.ok(allowed.has(t), `unexpected tool grant: ${t}`);
  }
});

test("prompt binds the spec-attacker role and its constitution", () => {
  assert.match(body, /ROLE CONTRACT — spec-attacker/);
  assert.match(body, /constitution C7/);
});

test("prompt enforces the executable-proposed_cmd invariant", () => {
  // The core oracle-forging discipline: a hole is not a finding unless it comes
  // with an executable command. This clause is the reason the agent exists.
  assert.match(body, /proposed_cmd/);
  assert.match(body, /is not a finding/);
});

test("prompt enumerates the systematic attack dimensions", () => {
  for (const dim of [/performance/i, /security/i, /concurrenc/i, /boundary/i, /i18n/i]) {
    assert.match(body, dim);
  }
});
