import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// Oracle for .github/ISSUE_TEMPLATE/bug.yml — a GitHub Issue Form.
// Strongest feasible oracle: property/schema validation against the invariants
// GitHub's issue-forms parser actually enforces. A golden-file diff would be
// circular (the file compared to a copy of itself); these properties instead
// assert the structural contract that makes the template render on GitHub.

const TEMPLATE = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  ".github",
  "ISSUE_TEMPLATE",
  "bug.yml"
);

// GitHub has no built-in Node YAML parser and this repo vendors no yaml dep,
// so parse via Python (pyyaml) which is present in the toolchain. A parse
// failure here is itself a defect signal (exit != 0).
function loadYaml(path) {
  const r = spawnSync(
    "python3",
    [
      "-c",
      "import sys,yaml,json; json.dump(yaml.safe_load(open(sys.argv[1])), sys.stdout)",
      path,
    ],
    { encoding: "utf8" }
  );
  assert.equal(r.status, 0, `YAML did not parse: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

const doc = loadYaml(TEMPLATE);

// GitHub-documented set of valid issue-form element types.
const VALID_TYPES = new Set([
  "markdown",
  "textarea",
  "input",
  "dropdown",
  "checkboxes",
]);
// Every type except the purely-decorative "markdown" requires attributes.label.
const NEEDS_LABEL = new Set(["textarea", "input", "dropdown", "checkboxes"]);

test("bug.yml: is a valid YAML mapping with required top-level keys", () => {
  assert.equal(typeof doc, "object");
  assert.ok(doc !== null && !Array.isArray(doc));
  assert.equal(typeof doc.name, "string");
  assert.ok(doc.name.length > 0);
  assert.equal(typeof doc.description, "string");
  assert.ok(doc.description.length > 0);
  assert.ok(Array.isArray(doc.body), "body must be a list");
  assert.ok(doc.body.length > 0, "body must have at least one element");
});

test("bug.yml: labels, when present, are a flat list of strings", () => {
  if (doc.labels === undefined) return;
  assert.ok(Array.isArray(doc.labels));
  for (const l of doc.labels) assert.equal(typeof l, "string");
});

test("bug.yml: every body element has a valid type and required fields", () => {
  for (const [i, el] of doc.body.entries()) {
    assert.equal(typeof el, "object", `body[${i}] must be a mapping`);
    assert.ok(
      VALID_TYPES.has(el.type),
      `body[${i}] type "${el.type}" is not a GitHub issue-form type`
    );
    if (NEEDS_LABEL.has(el.type)) {
      assert.equal(typeof el.attributes, "object", `body[${i}] needs attributes`);
      assert.equal(
        typeof el.attributes.label,
        "string",
        `body[${i}] (${el.type}) requires attributes.label`
      );
      assert.ok(el.attributes.label.length > 0, `body[${i}] label is empty`);
    }
  }
});

test("bug.yml: element ids are unique and slug-shaped", () => {
  const seen = new Set();
  for (const [i, el] of doc.body.entries()) {
    if (el.id === undefined) continue;
    assert.equal(typeof el.id, "string");
    assert.match(el.id, /^[A-Za-z0-9_-]+$/, `body[${i}] id "${el.id}" not slug`);
    assert.ok(!seen.has(el.id), `duplicate body id "${el.id}"`);
    seen.add(el.id);
  }
});

test("bug.yml: validations.required, when present, is a boolean", () => {
  for (const [i, el] of doc.body.entries()) {
    if (el.validations === undefined) continue;
    assert.equal(typeof el.validations, "object", `body[${i}] validations`);
    if ("required" in el.validations) {
      assert.equal(
        typeof el.validations.required,
        "boolean",
        `body[${i}] validations.required must be boolean`
      );
    }
  }
});

test("bug.yml: honors house rules — collects an executable repro as required", () => {
  const repro = doc.body.find((el) => el.id === "repro");
  assert.ok(repro, "bug template must have a 'repro' field (house rule: evidence)");
  assert.equal(repro.type, "textarea");
  assert.equal(repro.validations?.required, true, "repro must be required");
});
