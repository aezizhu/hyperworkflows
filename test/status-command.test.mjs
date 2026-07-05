import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Oracle for commands/status.md — a slash-command prompt-spec. Its rendered output
// (a natural-language progress digest) is subjective and not deterministically
// checkable, so this forges the strongest FEASIBLE oracle: a property test over the
// command-file contract that Claude Code relies on for discovery, plus the load-bearing
// safety invariant the /status command must uphold (it must never mutate run state).

const STATUS_MD = join(dirname(fileURLToPath(import.meta.url)), "..", "commands", "status.md");
const raw = readFileSync(STATUS_MD, "utf8");

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

test("status.md: has well-formed YAML frontmatter (discovery contract)", () => {
  const fm = parseFrontmatter(raw);
  assert.ok(fm, "status.md must open with a `---`-delimited YAML frontmatter block");
});

test("status.md: frontmatter carries a non-empty description (renders in the slash menu)", () => {
  const fm = parseFrontmatter(raw);
  assert.ok(fm.fields.description, "frontmatter must define `description`");
  assert.ok(fm.fields.description.length >= 10, "description must be non-trivial");
});

test("status.md: has a non-empty instruction body", () => {
  const fm = parseFrontmatter(raw);
  assert.ok(fm.body.trim().length > 0, "command body must not be empty");
});

test("status.md: preserves the read-only safety invariant (must never mutate run state)", () => {
  // /status is a diagnostic surface; turning it into something that writes/mutates
  // run state is a real regression this oracle must catch.
  assert.match(
    raw,
    /read-only|never mutat|does not mutat|without mutat|no.{0,12}mutat/i,
    "status.md must state it is read-only / does not mutate run state"
  );
});
