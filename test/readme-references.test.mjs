// Oracle for README.md: reference integrity.
//
// A README is prose, but its factual claims about the repository ARE checkable:
// every relative link it advertises, every repo-layout path it lists, and every
// npm script / install command it tells the reader to run must actually resolve.
// This is a metamorphic relation (README claims <-> filesystem reality): if the
// docs and the tree drift apart, the reader is being told something false.
//
// Test-only. Reads the committed README.md and asserts against the real tree.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const README = readFileSync(join(ROOT, "README.md"), "utf8");

// A destination is a local repo path we can check when it is neither an
// external URL, a mailto:, nor a pure in-document anchor (#...).
function isLocalPath(dest) {
  if (!dest) return false;
  if (/^(https?:|mailto:|tel:)/i.test(dest)) return false;
  if (dest.startsWith("#")) return false;
  return true;
}

// Strip a trailing #anchor and surrounding backticks/whitespace from a target.
function normalize(dest) {
  return dest.split("#")[0].trim().replace(/^`+|`+$/g, "");
}

test("README: every relative markdown link resolves to a file that exists", () => {
  // [text](dest) — dest captured up to the first whitespace or closing paren.
  const linkRe = /\]\(\s*([^)\s]+)/g;
  const missing = [];
  const checked = [];
  let m;
  while ((m = linkRe.exec(README)) !== null) {
    const dest = m[1];
    if (!isLocalPath(dest)) continue;
    const rel = normalize(dest);
    if (!rel) continue;
    checked.push(rel);
    if (!existsSync(join(ROOT, rel))) missing.push(rel);
  }
  assert.ok(checked.length > 0, "expected at least one relative markdown link in README");
  assert.deepEqual(missing, [], `README links to non-existent paths: ${missing.join(", ")}`);
});

test("README: every path in the 'Repository layout' block exists", () => {
  // The layout block lists "path/   description" lines inside a fenced code block.
  const block = README.split("## Repository layout")[1] || "";
  const fence = block.split("```")[1] || "";
  const layoutPaths = [];
  for (const line of fence.split("\n")) {
    const mm = line.match(/^([A-Za-z0-9._\-\/]+\/)\s{2,}\S/);
    if (mm) layoutPaths.push(mm[1]);
  }
  assert.ok(layoutPaths.length >= 8, `expected the repo-layout block to list many dirs, got ${layoutPaths.length}`);
  const missing = layoutPaths.filter((p) => !existsSync(join(ROOT, p)));
  assert.deepEqual(missing, [], `Repository-layout paths do not exist: ${missing.join(", ")}`);
});

test("README: npm scripts it tells you to run exist in package.json", () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const scripts = pkg.scripts || {};
  // Collect `npm run <name>` mentions from the README's fenced examples.
  const runRe = /npm run ([a-z:-]+)/g;
  const referenced = new Set();
  let m;
  while ((m = runRe.exec(README)) !== null) referenced.add(m[1]);
  assert.ok(referenced.size > 0, "expected README to reference at least one npm script");
  const missing = [...referenced].filter((s) => !(s in scripts));
  assert.deepEqual(missing, [], `README references npm scripts absent from package.json: ${missing.join(", ")}`);
});

test("README: the adapters install command's script exists", () => {
  // README documents: sh adapters/install.sh <tool> /path/to/project
  const m = README.match(/sh (adapters\/install\.sh)/);
  assert.ok(m, "expected README to document the adapters install script");
  assert.ok(existsSync(join(ROOT, m[1])), `${m[1]} referenced by README does not exist`);
});
