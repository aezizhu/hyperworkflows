#!/usr/bin/env node
// Hyperworkflows workflow bundler: keeps the deterministic helpers inlined in the workflow
// engines byte-identical to their canonical source in scripts/adjudicate.mjs.
// (The workflow runtime cannot import modules, so helpers must be inlined; this
// tool makes the duplication mechanical instead of drift-prone.)
//
// Usage:
//   node scripts/bundle-workflows.mjs --check   # exit 1 if any engine is out of sync
//   node scripts/bundle-workflows.mjs --write   # regenerate the marker blocks in place
//
// Marker block inside each engine's default function:
//   // HYPERWORKFLOWS-HELPERS-BEGIN ...
//   <generated function declarations, 2-space indented>
//   // HYPERWORKFLOWS-HELPERS-END

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL = join(ROOT, "scripts", "adjudicate.mjs");

// Which canonical helpers each engine needs (order is emission order).
const MANIFEST = {
  "workflows/hyperaudit.js": ["adjudicate", "reconcileUnits", "sortByPath", "slug"],
  "workflows/hyperapply.js": ["adjudicate", "failureSignature", "selectWinner", "levelsOf", "slug"],
  "workflows/hypersentinel.js": ["slug"]
};

const BEGIN = "// HYPERWORKFLOWS-HELPERS-BEGIN (generated from scripts/adjudicate.mjs — edit the canonical source and run `npm run bundle`; do not edit this block by hand)";
const END = "// HYPERWORKFLOWS-HELPERS-END";

// --- extract `export function name(...) { ... }` bodies with brace matching ---------
function extractFunctions(source) {
  const fns = new Map();
  const re = /export function ([A-Za-z0-9_]+)/g;
  let m;
  while ((m = re.exec(source))) {
    const name = m[1];
    const start = m.index + "export ".length;
    let i = source.indexOf("{", m.index);
    if (i === -1) throw new Error(`no body for ${name}`);
    let depth = 0;
    for (; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") { depth--; if (depth === 0) break; }
    }
    if (depth !== 0) throw new Error(`unbalanced braces in ${name}`);
    fns.set(name, source.slice(start, i + 1));
  }
  return fns;
}

function generateBlock(names, fns) {
  const parts = [];
  for (const n of names) {
    if (!fns.has(n)) throw new Error(`canonical helper not found: ${n}`);
    parts.push(fns.get(n));
  }
  // Engines are runtime-native top-level scripts (W5): helpers live at 0 indent.
  return parts.join("\n");
}

function processFile(rel, fns, write) {
  const path = join(ROOT, rel);
  const src = readFileSync(path, "utf8");
  const b = src.indexOf(BEGIN), e = src.indexOf(END);
  if (b === -1 || e === -1 || e < b) return { rel, status: "NO-MARKERS" };
  const currentNorm = src.slice(b + BEGIN.length, e);
  const expectedBlock = "\n" + generateBlock(MANIFEST[rel], fns) + "\n";
  if (currentNorm === expectedBlock) return { rel, status: "IN-SYNC" };
  if (!write) return { rel, status: "OUT-OF-SYNC" };
  writeFileSync(path, src.slice(0, b + BEGIN.length) + expectedBlock + src.slice(e));
  return { rel, status: "REWRITTEN" };
}

const mode = process.argv[2];
if (mode !== "--check" && mode !== "--write") {
  console.error("usage: bundle-workflows.mjs --check | --write");
  process.exit(2);
}
const fns = extractFunctions(readFileSync(CANONICAL, "utf8"));
let bad = 0;
for (const rel of Object.keys(MANIFEST)) {
  const r = processFile(rel, fns, mode === "--write");
  console.log(`${r.status.padEnd(12)} ${r.rel}`);
  if (r.status === "OUT-OF-SYNC" || r.status === "NO-MARKERS") bad++;
}
process.exit(bad ? 1 : 0);
