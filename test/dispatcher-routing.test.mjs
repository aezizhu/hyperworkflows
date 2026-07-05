import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Oracle for commands/hyperworkflows.md (the dispatcher prompt spec).
//
// The dispatcher's *routing decisions* are LLM-interpreted and therefore not
// executably testable. What IS a hard invariant: the dispatcher is "the one
// command to remember" and must never route to a flow that does not exist as a
// sibling command file, and it must carry a valid front-matter contract. A
// renamed/removed flow that the dispatcher still points at is a real regression
// this property test catches.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CMD_DIR = join(ROOT, "commands");
const DISPATCHER = join(CMD_DIR, "hyperworkflows.md");

const src = readFileSync(DISPATCHER, "utf8");

test("dispatcher has valid front-matter with description and argument-hint", () => {
  const m = src.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, "front-matter block (--- ... ---) must be present");
  const fm = m[1];
  assert.match(fm, /^description:\s*\S/m, "front-matter must declare a non-empty description");
  assert.match(fm, /^argument-hint:\s*\S/m, "front-matter must declare a non-empty argument-hint");
});

test("every flow the dispatcher routes to exists as a sibling command file", () => {
  // Body only: strip front-matter so the description line doesn't pollute matches.
  const body = src.replace(/^---\n[\s\S]*?\n---\n/, "");
  // Referenced flows appear as `<name>` flow  (e.g. "the `apply` flow").
  const refs = [...body.matchAll(/`([a-z]+)`\s+flow/g)].map((r) => r[1]);
  const flows = [...new Set(refs)].sort();

  // Sanity: the dispatcher must actually route somewhere.
  assert.ok(flows.length >= 5, `expected the dispatcher to reference several flows, got ${flows.length}: ${flows}`);

  const missing = flows.filter((f) => !existsSync(join(CMD_DIR, `${f}.md`)));
  assert.deepEqual(missing, [], `dispatcher routes to flow(s) with no commands/<name>.md: ${missing.join(", ")}`);

  // The dispatcher itself is a flow name; it must not recursively route to itself.
  assert.ok(!flows.includes("hyperworkflows"), "dispatcher must not route to itself");
});
