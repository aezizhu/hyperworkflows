// Oracle for commands/ratchet.md (a slash-command prompt spec with no code impl).
//
// The unit's runtime behavior is LLM-executed, so there is no deterministic
// output to golden. What IS deterministically checkable is the command's
// STRUCTURAL CONTRACT: it must remain a well-formed Claude Code slash command,
// and the artifacts/format it prescribes (router.md pipe row, blackboard
// inputs, candidates dir) must stay internally consistent. Breaking any of
// these silently breaks the command. This is a property/contract oracle, not a
// bare snapshot: each assertion pins a semantic invariant, not exact bytes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "commands", "ratchet.md");
const src = readFileSync(FILE, "utf8");

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, "ratchet.md must open with a YAML frontmatter block");
  const fm = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body: text.slice(m[0].length) };
}

test("ratchet.md: valid slash-command frontmatter (description + argument-hint)", () => {
  const { fm } = frontmatter(src);
  assert.ok(fm.description && fm.description.length > 0, "non-empty description required");
  // It documents an optional [run-dir] arg, so it must declare an argument-hint.
  assert.ok("argument-hint" in fm, "argument-hint required (command takes an argument)");
  assert.match(fm["argument-hint"], /run-dir/, "argument-hint should name the run-dir arg");
});

test("ratchet.md: body consumes $ARGUMENTS declared by the argument-hint", () => {
  const { body } = frontmatter(src);
  assert.match(body, /\$ARGUMENTS/, "body must reference $ARGUMENTS to receive the run-dir");
});

test("ratchet.md: prescribes a 6-column router.md table row consistent with its schema", () => {
  const { body } = frontmatter(src);
  assert.match(body, /memory\/router\.md/, "must target memory/router.md");
  // Locate the router row template (contains the <formation>...<health> placeholders).
  const rowLine = body.split("\n").find(l => l.includes("<formation>") && l.includes("<health>"));
  assert.ok(rowLine, "router row template must be present");
  // Strip surrounding backticks/prose, isolate the pipe table row.
  const raw = (rowLine.match(/\|[^`]*\|/) || [])[0];
  assert.ok(raw, "router row must be a pipe-delimited markdown table row");
  const cells = raw.split("|").slice(1, -1).map(s => s.trim());
  assert.equal(cells.length, 6, `router row must have 6 columns, got ${cells.length}: ${raw}`);
  // Column order/identity is the schema contract downstream readers depend on.
  assert.deepEqual(cells, [
    "<formation>", "<scope>", "<units>", "<agents>", "<wall-clock>", "<health>",
  ]);
});

test("ratchet.md: references the blackboard inputs and candidates output it depends on", () => {
  const { body } = frontmatter(src);
  for (const needle of ["events.jsonl", "verdicts", "report.json", "memory/candidates/"]) {
    assert.ok(body.includes(needle), `body must reference ${needle}`);
  }
});

test("ratchet.md: states the tail-of-run invariant (never starts new work)", () => {
  const { body } = frontmatter(src);
  assert.match(body, /never starts new work/i, "the append-only / no-new-work invariant must be stated");
});
