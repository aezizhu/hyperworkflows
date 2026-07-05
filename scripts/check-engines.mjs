#!/usr/bin/env node
// Syntax gate for workflow engines in their runtime-native form (W5): top-level body,
// inputs from the `args` global, top-level `return`, plus `export const meta`.
// Plain `node --check` cannot parse this hybrid (ESM export + function-body return),
// so we replicate what the Workflow evaluator does: strip export statements and
// compile the body as an AsyncFunction with the runtime globals in scope.
//
// Usage: node scripts/check-engines.mjs workflows/*.js

import { readFileSync } from "node:fs";

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
let bad = 0;
for (const f of process.argv.slice(2)) {
  const src = readFileSync(f, "utf8").replace(/^export /gm, "");
  try {
    new AsyncFunction("args", "log", "phase", "agent", "parallel", "workflow", src);
    console.log(`OK ${f}`);
  } catch (e) {
    console.error(`SYNTAX ${f}: ${e.message}`);
    bad++;
  }
}
process.exit(bad ? 1 : 0);
