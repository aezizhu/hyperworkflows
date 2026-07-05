import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Oracle-forged acceptance for the grey unit: agents/hyperworkflows-planner.md
// This is a Claude Code subagent definition (static markdown + YAML frontmatter).
// A whole-file golden would be a circular self-comparison, so the strongest
// meaningful oracle is a property test over the subagent frontmatter contract:
// the invariants that must hold for the agent to be discoverable, invocable, and
// to carry its defining acceptance-contract responsibility.

const UNIT = join(dirname(fileURLToPath(import.meta.url)), "..", "agents", "hyperworkflows-planner.md");

// Claude Code built-in tool names a subagent may legally grant.
const VALID_TOOLS = new Set(["Read", "Grep", "Glob", "Bash", "Edit", "Write", "WebFetch", "WebSearch"]);
const VALID_MODELS = new Set(["opus", "sonnet", "haiku"]);

/** Split a subagent .md into {fm: rawFrontmatter, body}. Throws on malformed fences. */
function parse(src) {
  assert.match(src, /^---\n/, "must open with a YAML frontmatter fence");
  const end = src.indexOf("\n---", 3);
  assert.ok(end > 0, "must close the YAML frontmatter fence");
  const fm = src.slice(4, end);
  const body = src.slice(end + 4);
  const kv = {};
  for (const line of fm.split("\n")) {
    const m = /^([A-Za-z_]+):\s*(.*)$/.exec(line);
    if (m) kv[m[1]] = m[2].trim();
  }
  return { kv, body };
}

test("planner agent: frontmatter carries every required subagent key", () => {
  const { kv } = parse(readFileSync(UNIT, "utf8"));
  for (const key of ["name", "description", "tools", "model"]) {
    assert.ok(kv[key] && kv[key].length > 0, `missing/empty frontmatter key: ${key}`);
  }
});

test("planner agent: name matches filename stem (discoverability invariant)", () => {
  const { kv } = parse(readFileSync(UNIT, "utf8"));
  const stem = basename(UNIT, ".md");
  assert.equal(kv.name, stem, `frontmatter name '${kv.name}' must equal filename stem '${stem}'`);
});

test("planner agent: declares only valid tools and a valid model", () => {
  const { kv } = parse(readFileSync(UNIT, "utf8"));
  const tools = kv.tools.split(",").map(t => t.trim()).filter(Boolean);
  assert.ok(tools.length > 0, "tools list must be non-empty");
  for (const t of tools) assert.ok(VALID_TOOLS.has(t), `unknown Claude Code tool: ${t}`);
  // Planner is read-only by design: it must NOT hold any mutating tool.
  for (const forbidden of ["Bash", "Edit", "Write"]) {
    assert.ok(!tools.includes(forbidden), `read-only planner must not grant '${forbidden}'`);
  }
  assert.ok(VALID_MODELS.has(kv.model), `unknown model: ${kv.model}`);
});

test("planner agent: role body encodes the acceptance-contract responsibility", () => {
  const { body } = parse(readFileSync(UNIT, "utf8"));
  assert.ok(body.trim().length > 0, "role body must be non-empty");
  assert.match(body, /ROLE CONTRACT/, "body must declare its ROLE CONTRACT");
  // The planner's defining output is executable acceptance {cmd, expect_exit}.
  assert.match(body, /\{cmd,\s*expect_exit\}/, "body must specify the {cmd, expect_exit} acceptance shape");
  // Un-expressible acceptance must be routed to grey / oracle-smith.
  assert.match(body, /grey/, "body must define the grey escape hatch for un-forgeable acceptance");
});
