import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const INSTALL = join(dirname(fileURLToPath(import.meta.url)), "..", "adapters", "install.sh");

// tool -> files that must exist after install
const EXPECT = {
  "agents-md": ["AGENTS.md"],
  codex: ["AGENTS.md"],
  cursor: [".cursor/rules/hyperworkflows.mdc", ".cursor/commands/hyperworkflows-audit.md", ".cursor/commands/hyperworkflows-apply.md", ".cursor/commands/hyperworkflows-recheck.md"],
  copilot: [".github/copilot-instructions.md", ".github/instructions/hyperworkflows.instructions.md"],
  gemini: ["GEMINI.md", ".gemini/commands/hyperworkflows/audit.toml", ".gemini/commands/hyperworkflows/apply.toml", ".gemini/commands/hyperworkflows/recheck.toml"],
  windsurf: [".windsurf/rules/hyperworkflows.md", ".windsurf/workflows/hyperworkflows-audit.md", ".windsurf/workflows/hyperworkflows-apply.md", ".windsurf/workflows/hyperworkflows-recheck.md"],
  opencode: ["AGENTS.md", ".opencode/command/hyperworkflows-audit.md", ".opencode/command/hyperworkflows-apply.md", ".opencode/command/hyperworkflows-recheck.md"],
  cline: [".clinerules/hyperworkflows.md"],
  roo: [".roo/rules/hyperworkflows.md"],
  aider: ["CONVENTIONS.md"],
  qwen: ["QWEN.md"],
  kiro: [".kiro/steering/hyperworkflows.md"],
  warp: ["WARP.md"],
  zed: [".rules"],
  junie: [".junie/guidelines.md"],
  trae: [".trae/rules/hyperworkflows.md"],
  devin: [".devin/skills/hyperworkflows-oracle-forging/SKILL.md", ".devin/hyperworkflows-role-prompts.md"]
};

const CORE = [".hyperworkflows/adjudicate.mjs", ".hyperworkflows/recheck.mjs", ".hyperworkflows/ci-verify.mjs", ".hyperworkflows/rules.md", ".hyperworkflows/role-prompts.md"];
const MARKED = ["AGENTS.md", "GEMINI.md", "QWEN.md", "WARP.md", ".rules", "CONVENTIONS.md", ".junie/guidelines.md", ".github/copilot-instructions.md"];

function installTwice(tool, dir) {
  for (let i = 0; i < 2; i++) {
    const r = spawnSync("sh", [INSTALL, tool, dir], { encoding: "utf8" });
    assert.equal(r.status, 0, `${tool} install #${i + 1} failed:\n${r.stderr}\n${r.stdout}`);
  }
}

for (const [tool, files] of Object.entries(EXPECT)) {
  test(`adapter ${tool}: installs expected files, core toolkit, and is idempotent`, () => {
    const dir = mkdtempSync(join(tmpdir(), `hyperworkflows-adapter-${tool}-`));
    try {
      installTwice(tool, dir);
      for (const f of [...files, ...CORE]) {
        assert.ok(existsSync(join(dir, f)), `${tool}: missing ${f}`);
      }
      // Marked files must contain exactly ONE Hyperworkflows block after double install.
      for (const f of files.filter(f => MARKED.includes(f))) {
        const content = readFileSync(join(dir, f), "utf8");
        const count = (content.match(/HYPERWORKFLOWS-BEGIN/g) || []).length;
        assert.equal(count, 1, `${tool}: ${f} has ${count} Hyperworkflows blocks (expected 1)`);
        assert.match(content, /adjudicate\.mjs/);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test("adapter all: installs every tool in one pass", () => {
  const dir = mkdtempSync(join(tmpdir(), "hyperworkflows-adapter-all-"));
  try {
    const r = spawnSync("sh", [INSTALL, "all", dir], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    for (const files of Object.values(EXPECT)) {
      for (const f of files) assert.ok(existsSync(join(dir, f)), `all: missing ${f}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("adapter: marked section replacement preserves surrounding user content", () => {
  const dir = mkdtempSync(join(tmpdir(), "hyperworkflows-adapter-preserve-"));
  try {
    const agents = join(dir, "AGENTS.md");
    spawnSync("sh", ["-c", `printf '# My project\\n\\nMy own rules stay.\\n' > "${agents}"`]);
    installTwice("agents-md", dir);
    const content = readFileSync(agents, "utf8");
    assert.match(content, /My own rules stay\./);
    assert.equal((content.match(/HYPERWORKFLOWS-BEGIN/g) || []).length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("adapter: unknown tool fails loudly", () => {
  const dir = mkdtempSync(join(tmpdir(), "hyperworkflows-adapter-unknown-"));
  try {
    const r = spawnSync("sh", [INSTALL, "not-a-tool", dir], { encoding: "utf8" });
    assert.equal(r.status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("adapter gemini: generated TOML is well-formed (description + triple-quoted prompt)", () => {
  const dir = mkdtempSync(join(tmpdir(), "hyperworkflows-adapter-toml-"));
  try {
    installTwice("gemini", dir);
    const toml = readFileSync(join(dir, ".gemini/commands/hyperworkflows/audit.toml"), "utf8");
    assert.match(toml, /^description = ".+"\nprompt = """\n/);
    assert.match(toml, /"""\n$/);
    assert.equal((toml.match(/"""/g) || []).length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
