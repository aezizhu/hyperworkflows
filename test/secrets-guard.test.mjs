import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "secrets-guard.sh");

function guard(payload) {
  const dir = mkdtempSync(join(tmpdir(), "hyperworkflows-secrets-"));
  try {
    const r = spawnSync("sh", [SCRIPT], {
      input: typeof payload === "string" ? payload : JSON.stringify(payload),
      cwd: dir, encoding: "utf8"
    });
    return { code: r.status, err: r.stderr };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const edit = p => ({ tool_input: { file_path: p } });

test("secrets-guard: blocks .env and environment variants", () => {
  assert.equal(guard(edit("/repo/.env")).code, 2);
  assert.equal(guard(edit("/repo/.env.production")).code, 2);
  assert.equal(guard(edit("apps/api/.env.local")).code, 2);
  assert.match(guard(edit("/repo/.env")).err, /secret material/);
});

test("secrets-guard: template variants stay editable", () => {
  for (const f of [".env.example", ".env.sample", ".env.template", ".env.dist", ".env.test"]) {
    assert.equal(guard(edit(`/repo/${f}`)).code, 0, f);
  }
});

test("secrets-guard: ordinary files pass, including env-ish names", () => {
  assert.equal(guard(edit("/repo/src/env.ts")).code, 0);
  assert.equal(guard(edit("/repo/environment.py")).code, 0);
  assert.equal(guard(edit("/repo/README.md")).code, 0);
});

test("secrets-guard: notebook_path payloads are covered; garbage fails open", () => {
  assert.equal(guard({ tool_input: { notebook_path: "/repo/.env.staging" } }).code, 2);
  assert.equal(guard("not json").code, 0);
  assert.equal(guard({}).code, 0);
});

test("secrets-guard: audit-13d2374 group C regressions — .envrc, tilde backups, backslash paths", () => {
  assert.equal(guard(edit("/repo/.envrc")).code, 2);
  assert.equal(guard(edit("/repo/.env~")).code, 2);
  assert.equal(guard(edit("C:\\repo\\.env.production")).code, 2);   // backslash basename split
  assert.equal(guard(edit("/repo/.env.example")).code, 0);          // templates still editable
});
