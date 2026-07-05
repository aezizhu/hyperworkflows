// Oracle for commands/init.md — the /init command spec.
//
// init.md is a natural-language command prompt, so its emergent behavior
// (what an agent does) is non-deterministic and has no golden output. But the
// spec makes CONCRETE, EXECUTABLE contract claims that can be pinned:
//   1. It must be a loadable Claude Code command (valid `---` frontmatter with
//      a `description`).
//   2. It seeds `memory/last-good.json` with a literal JSON shape; that shape
//      must be valid JSON AND its top-level keys must match the schema the
//      consumer engine (workflows/hypersentinel.js) documents and reads. This
//      is a cross-artifact consistency (metamorphic) relation: producer seed
//      shape == consumer schema shape.
//   3. It seeds `memory/router.md` with a literal header; assert that literal
//      is present and well-formed (self-declared structural invariant — no
//      external consumer exists for it).
//   4. The engine copy source it names (`workflows/*.js`) must actually resolve
//      to real engine files in the repo.
//
// These properties all hold on the CURRENT code; a drift in any of them (key
// rename, broken frontmatter, changed seed path) fails this oracle.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INIT = readFileSync(join(ROOT, "commands", "init.md"), "utf8");
const SENTINEL = readFileSync(join(ROOT, "workflows", "hypersentinel.js"), "utf8");

test("init.md is a loadable command: has frontmatter with a description", () => {
  const fm = INIT.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, "init.md must open with a --- YAML frontmatter block");
  assert.match(fm[1], /^description:\s*\S/m, "frontmatter must set a non-empty description");
});

test("init.md seeds last-good.json with a shape matching the sentinel consumer schema", () => {
  // Producer: the literal JSON object seeded by init.md.
  const seedLit = INIT.match(/`(\{"head":[\s\S]*?\})`/);
  assert.ok(seedLit, "init.md must embed the last-good.json seed as a backtick literal");
  const seed = JSON.parse(seedLit[1]);
  const seedKeys = Object.keys(seed).sort();
  assert.deepEqual(seedKeys, ["date", "failures", "head"], "seed keys must be head/date/failures");
  assert.ok(Array.isArray(seed.failures), "seeded failures must be an array");
  assert.equal(seed.failures.length, 0, "seeded baseline must start with zero failures");
  assert.equal(seed.head, null);
  assert.equal(seed.date, null);

  // Consumer: schema documented in hypersentinel.js, e.g.
  //   schema: {head, date, failures: [{suite, fingerprint, location}]}
  const schema = SENTINEL.match(/schema:\s*\{head[^}]*?failures:\s*\[[^\]]*\]\s*\}/);
  assert.ok(schema, "hypersentinel.js must document a last-good.json schema");
  for (const key of seedKeys) {
    assert.ok(
      new RegExp(`\\b${key}\\b`).test(schema[0]),
      `consumer schema must reference seeded key '${key}' (producer/consumer drift)`,
    );
  }

  // Both artifacts must agree on the path being seeded/read.
  assert.match(INIT, /memory\/last-good\.json/, "init must seed memory/last-good.json");
  assert.match(SENTINEL, /memory\/last-good\.json/, "sentinel must read memory/last-good.json");
});

test("init.md seeds router.md with a well-formed header literal", () => {
  const header = INIT.match(/`(# Hyperworkflows router[^`]*)`/);
  assert.ok(header, "init.md must embed the router.md header literal");
  assert.match(header[1], /^# /, "router header must be a markdown H1");
  // The header advertises the router row columns; assert the documented tuple.
  for (const col of ["formation", "scope", "units", "agents", "wall-clock", "health"]) {
    assert.ok(header[1].includes(col), `router header must document the '${col}' column`);
  }
  assert.match(INIT, /memory\/router\.md/, "init must seed memory/router.md");
});

test("the engine copy source named by init.md resolves to real engine files", () => {
  assert.match(INIT, /workflows\/\*\.js/, "init must name workflows/*.js as the engine copy source");
  const engines = readdirSync(join(ROOT, "workflows")).filter((f) => f.endsWith(".js"));
  assert.ok(engines.length > 0, "workflows/ must contain at least one .js engine to copy");
});
