// Oracle for commands/enforce.md — a slash-command *prose* artifact (LLM instructions),
// not executable code. The prose behaviour is subjective, but the doc makes concrete,
// falsifiable claims that CAN be checked:
//   (1) Referential integrity: every plugin file it tells the agent to copy must exist.
//   (2) Front-matter well-formedness + argument-hint ↔ documented sections agree.
//   (3) Metamorphic consistency: the enforcement-level resolution order and the marker
//       set the doc describes must match the actual resolver in scripts/lib-enforce.sh.
// These are the strongest feasible oracles for a command doc: a property test plus a
// doc↔code metamorphic relation. All must pass on current code.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = readFileSync(join(ROOT, "commands", "enforce.md"), "utf8");

// ---------------- (1) referential integrity ----------------

test("enforce.md: every script it instructs the agent to copy exists in scripts/", () => {
  // The `ci` section copies these from ${CLAUDE_PLUGIN_ROOT}/scripts/.
  for (const f of ["ci-verify.mjs", "recheck.mjs", "adjudicate.mjs"]) {
    assert.ok(DOC.includes(f), `doc must reference the script it copies: ${f}`);
    assert.ok(existsSync(join(ROOT, "scripts", f)), `referenced script missing: scripts/${f}`);
  }
});

test("enforce.md: the CI template it instructs the agent to copy exists in templates/", () => {
  const tpl = "hyperworkflows-verify.yml";
  assert.ok(DOC.includes(`templates/${tpl}`), "doc must name the template path it copies");
  assert.ok(existsSync(join(ROOT, "templates", tpl)), `referenced template missing: templates/${tpl}`);
  // And it must land at the destination path the doc claims.
  assert.ok(DOC.includes(".github/workflows/hyperworkflows-verify.yml"),
    "doc must name the workflow destination path");
});

test("enforce.md: the E3 CI-verify script path it checks in `status` exists", () => {
  // status step 2 checks for .hyperworkflows/ci-verify.mjs — sourced from scripts/ci-verify.mjs.
  assert.ok(DOC.includes(".hyperworkflows/ci-verify.mjs"), "doc must name the installed ci-verify path");
  assert.ok(existsSync(join(ROOT, "scripts", "ci-verify.mjs")), "source scripts/ci-verify.mjs must exist");
});

// ---------------- (2) front-matter + argument-hint ----------------

test("enforce.md: front-matter has description and argument-hint listing the documented modes", () => {
  const fm = DOC.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, "doc must open with YAML front-matter");
  assert.match(fm[1], /^description:\s*\S/m, "front-matter needs a description");
  const hint = fm[1].match(/^argument-hint:\s*"?\[([^\]]+)\]"?/m);
  assert.ok(hint, "front-matter needs an argument-hint of the form [a|b|c]");
  const modes = hint[1].split("|").map(s => s.trim());
  assert.deepEqual(modes, ["status", "ci", "0", "1", "2"], "argument-hint modes drifted");
  // Each advertised mode must actually be documented as a bold section header.
  for (const m of ["status", "ci"]) {
    assert.ok(new RegExp("\\*\\*`" + m + "`\\*\\*").test(DOC), `mode not documented: ${m}`);
  }
  // The numeric level section is documented as **`0` | `1` | `2`**.
  assert.match(DOC, /\*\*`0`\*\* \| \*\*`1`\*\* \| \*\*`2`\*\*|\*\*`0` \| `1` \| `2`\*\*/,
    "numeric-level section (0|1|2) must be documented");
});

// ---------------- (3) doc ↔ code metamorphic consistency ----------------

test("enforce.md: level-resolution order matches scripts/lib-enforce.sh", () => {
  const lib = readFileSync(join(ROOT, "scripts", "lib-enforce.sh"), "utf8");

  // Both must name the env var as the top-priority source.
  assert.ok(DOC.includes("HYPERWORKFLOWS_ENFORCE"), "doc must name the env var");
  assert.ok(lib.includes("HYPERWORKFLOWS_ENFORCE"), "resolver must read the env var");

  // Both must name the project override file.
  assert.ok(DOC.includes(".hyperworkflows/enforce"), "doc must name the enforce file");
  assert.ok(lib.includes(".hyperworkflows/enforce"), "resolver must read the enforce file");

  // The doc's stated ordering: env ... before ... file ... before ... markers.
  const iEnv = DOC.indexOf("HYPERWORKFLOWS_ENFORCE");
  const iFile = DOC.indexOf(".hyperworkflows/enforce");
  const iMarker = DOC.indexOf("memory/router.md");
  assert.ok(iEnv >= 0 && iFile >= 0 && iMarker >= 0, "doc must mention all three resolution sources");
  assert.ok(iEnv < iFile && iFile < iMarker,
    "doc must state resolution order env -> file -> markers");
});

test("enforce.md: the marker set it lists equals the markers lib-enforce.sh actually checks", () => {
  const lib = readFileSync(join(ROOT, "scripts", "lib-enforce.sh"), "utf8");
  // The resolver checks: -d .hyperworkflows, -f memory/router.md, -d evidence.
  const markers = [".hyperworkflows", "memory/router.md", "evidence"];
  for (const m of markers) {
    assert.ok(lib.includes(m), `resolver must check marker: ${m}`);
    assert.ok(DOC.includes(m), `doc must list marker it claims triggers default level 1: ${m}`);
  }
  // The doc must NOT claim generic markers the resolver deliberately excludes.
  // lib-enforce.sh comment: "never generic dirs like runs/ or memory/". The doc must
  // not promise `runs/` alone as a marker.
  assert.ok(!/\bruns\/\b[^.]*marker/i.test(DOC), "doc must not advertise runs/ as a marker");
});
