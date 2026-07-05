import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Oracle for the grey unit agents/hyperworkflows-auditor.md.
// The unit is a static agent-definition prompt (YAML frontmatter + ROLE CONTRACT
// body) with no runtime behavior, so acceptance is a property test over the
// structural + contract invariants that make the definition machine-loadable and
// keep its role contract intact. Every assertion below is verified to hold on the
// current file; a regression (malformed frontmatter, wrong name/model, dropped
// return-shape, or a loosened "never fix" invariant) fails the suite.

const AGENTS = join(dirname(fileURLToPath(import.meta.url)), "..", "agents");
const FILE = join(AGENTS, "hyperworkflows-auditor.md");
const STEM = "hyperworkflows-auditor";

// Minimal frontmatter splitter: leading `---\n...\n---` block, then body.
function parse(raw) {
  assert.match(raw, /^---\n/, "file must open with a YAML frontmatter fence");
  const end = raw.indexOf("\n---", 4);
  assert.ok(end > 0, "frontmatter must be closed by a `---` fence");
  const fm = raw.slice(4, end);
  const body = raw.slice(end + 4);
  const kv = {};
  for (const line of fm.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    assert.ok(m, `frontmatter line is not a key: value pair -> ${JSON.stringify(line)}`);
    kv[m[1]] = m[2].trim();
  }
  return { kv, body };
}

const raw = readFileSync(FILE, "utf8");
const { kv, body } = parse(raw);

const ALLOWED_TOOLS = new Set([
  "Bash", "Read", "Write", "Edit", "Grep", "Glob", "Task", "WebFetch", "WebSearch",
]);
const ALLOWED_MODELS = new Set(["opus", "sonnet", "haiku"]);

test("auditor: frontmatter name matches the filename stem", () => {
  assert.equal(kv.name, STEM);
});

test("auditor: declares a non-empty description mentioning security/dependency scanning", () => {
  assert.ok(kv.description && kv.description.length > 20, "description present");
  assert.match(kv.description, /audit|scan|security|dependency|supply-chain/i);
});

test("auditor: tools are a non-empty subset of the known tool set", () => {
  assert.ok(kv.tools, "tools key present");
  const tools = kv.tools.split(",").map(s => s.trim()).filter(Boolean);
  assert.ok(tools.length > 0, "at least one tool");
  for (const t of tools) assert.ok(ALLOWED_TOOLS.has(t), `unknown tool: ${t}`);
  // A scanner runner must be able to run scanners and read their output.
  assert.ok(tools.includes("Bash"), "auditor needs Bash to run scanners");
});

test("auditor: model is a valid Claude tier", () => {
  assert.ok(ALLOWED_MODELS.has(kv.model), `unexpected model: ${kv.model}`);
});

test("auditor: body carries its ROLE CONTRACT header", () => {
  assert.match(body, /ROLE CONTRACT\s+—\s+auditor/);
});

test("auditor: return-shape invariant is specified (exit, log_path, counts)", () => {
  assert.match(body, /exit/);
  assert.match(body, /log_path/);
  assert.match(body, /counts/);
  for (const sev of ["critical", "high", "moderate", "low"]) {
    assert.match(body, new RegExp(sev), `counts must include ${sev}`);
  }
});

test("auditor: measure-only invariant (never fixes) is preserved", () => {
  assert.match(body, /[Nn]ever\s+"?fix|no lockfile edits|no version bumps/);
});

test("auditor: uninstalled-scanner honesty invariant is preserved", () => {
  assert.match(body, /not installed|never simulate/i);
});
