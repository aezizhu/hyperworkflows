// Oracle for CONTRIBUTING.md — referential-integrity property test.
// The contributing guide makes concrete, checkable claims about the repo:
// the npm scripts, file paths, engine floor, and zero-dependency policy it
// documents must all still be true. This freezes the doc's factual surface
// (not its prose) so it cannot silently drift out of sync with the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = readFileSync(join(ROOT, "CONTRIBUTING.md"), "utf8");
const PKG = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));

test("CONTRIBUTING.md: every documented npm script exists in package.json", () => {
  const scripts = PKG.scripts || {};
  // Match `npm run <name>` and the bare `npm test`/`npm <name>` forms.
  const referenced = new Set();
  for (const m of DOC.matchAll(/\bnpm run ([a-z][\w:-]*)/g)) referenced.add(m[1]);
  for (const m of DOC.matchAll(/\bnpm (test)\b/g)) referenced.add(m[1]);
  assert.ok(referenced.size > 0, "expected the guide to reference npm scripts");
  for (const name of referenced) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(scripts, name),
      `CONTRIBUTING.md references "npm run ${name}" but package.json has no such script`,
    );
  }
});

test("CONTRIBUTING.md: every referenced repo file path exists", () => {
  // Concrete source paths the guide points contributors at.
  const paths = new Set();
  for (const m of DOC.matchAll(/\b([\w][\w./-]*\/[\w./-]*\.(?:mjs|js|sh))\b/g)) {
    paths.add(m[1]);
  }
  assert.ok(paths.size > 0, "expected the guide to reference repo file paths");
  for (const p of paths) {
    assert.ok(existsSync(join(ROOT, p)), `CONTRIBUTING.md references missing path: ${p}`);
  }
});

test("CONTRIBUTING.md: documented Node engine floor matches package.json", () => {
  const m = DOC.match(/Node >= ?(\d+\.\d+(?:\.\d+)?)/);
  assert.ok(m, "expected a documented Node version floor");
  const engine = (PKG.engines && PKG.engines.node) || "";
  assert.ok(
    engine.includes(m[1]),
    `guide claims Node >= ${m[1]} but package.json engines.node is "${engine}"`,
  );
});

test("CONTRIBUTING.md: 'zero runtime dependencies' claim holds", () => {
  assert.match(DOC, /[Zz]ero runtime dependencies/);
  const deps = PKG.dependencies || {};
  assert.equal(
    Object.keys(deps).length,
    0,
    `guide claims zero runtime dependencies but package.json has: ${Object.keys(deps).join(", ")}`,
  );
});
