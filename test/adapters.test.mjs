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
  cursor: [".cursor/rules/hw.mdc", ".cursor/commands/hw-audit.md", ".cursor/commands/hw-apply.md", ".cursor/commands/hw-recheck.md"],
  copilot: [".github/copilot-instructions.md", ".github/instructions/hw.instructions.md"],
  gemini: ["GEMINI.md", ".gemini/commands/hw/audit.toml", ".gemini/commands/hw/apply.toml", ".gemini/commands/hw/recheck.toml"],
  windsurf: [".windsurf/rules/hw.md", ".windsurf/workflows/hw-audit.md", ".windsurf/workflows/hw-apply.md", ".windsurf/workflows/hw-recheck.md"],
  opencode: ["AGENTS.md", ".opencode/command/hw-audit.md", ".opencode/command/hw-apply.md", ".opencode/command/hw-recheck.md"],
  cline: [".clinerules/hw.md"],
  roo: [".roo/rules/hw.md"],
  aider: ["CONVENTIONS.md"],
  qwen: ["QWEN.md"],
  kiro: [".kiro/steering/hw.md"],
  warp: ["WARP.md"],
  zed: [".rules"],
  junie: [".junie/guidelines.md"],
  trae: [".trae/rules/hw.md"],
  devin: [".devin/skills/hw-oracle-forging/SKILL.md", ".devin/hw-role-prompts.md"]
};

const CORE = [".hw/adjudicate.mjs", ".hw/recheck.mjs", ".hw/hw-rules.md", ".hw/role-prompts.md"];
const MARKED = ["AGENTS.md", "GEMINI.md", "QWEN.md", "WARP.md", ".rules", "CONVENTIONS.md", ".junie/guidelines.md", ".github/copilot-instructions.md"];

function installTwice(tool, dir) {
  for (let i = 0; i < 2; i++) {
    const r = spawnSync("sh", [INSTALL, tool, dir], { encoding: "utf8" });
    assert.equal(r.status, 0, `${tool} install #${i + 1} failed:\n${r.stderr}\n${r.stdout}`);
  }
}

for (const [tool, files] of Object.entries(EXPECT)) {
  test(`adapter ${tool}: installs expected files, core toolkit, and is idempotent`, () => {
    const dir = mkdtempSync(join(tmpdir(), `hw-adapter-${tool}-`));
    try {
      installTwice(tool, dir);
      for (const f of [...files, ...CORE]) {
        assert.ok(existsSync(join(dir, f)), `${tool}: missing ${f}`);
      }
      // Marked files must contain exactly ONE HW block after double install.
      for (const f of files.filter(f => MARKED.includes(f))) {
        const content = readFileSync(join(dir, f), "utf8");
        const count = (content.match(/HW-BEGIN/g) || []).length;
        assert.equal(count, 1, `${tool}: ${f} has ${count} HW blocks (expected 1)`);
        assert.match(content, /adjudicate\.mjs/);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test("adapter all: installs every tool in one pass", () => {
  const dir = mkdtempSync(join(tmpdir(), "hw-adapter-all-"));
  try {
    const r = spawnSync("sh", [INSTALL, "all", dir], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    for (const files of Object.values(EXPECT)) {
      for (const f of files) assert.ok(existsSync(join(dir, f)), `all: missing ${f}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("adapter: marked section replacement preserves surrounding user content", () => {
  const dir = mkdtempSync(join(tmpdir(), "hw-adapter-preserve-"));
  try {
    const agents = join(dir, "AGENTS.md");
    spawnSync("sh", ["-c", `printf '# My project\\n\\nMy own rules stay.\\n' > "${agents}"`]);
    installTwice("agents-md", dir);
    const content = readFileSync(agents, "utf8");
    assert.match(content, /My own rules stay\./);
    assert.equal((content.match(/HW-BEGIN/g) || []).length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("adapter: unknown tool fails loudly", () => {
  const dir = mkdtempSync(join(tmpdir(), "hw-adapter-unknown-"));
  try {
    const r = spawnSync("sh", [INSTALL, "not-a-tool", dir], { encoding: "utf8" });
    assert.equal(r.status, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("adapter gemini: generated TOML is well-formed (description + triple-quoted prompt)", () => {
  const dir = mkdtempSync(join(tmpdir(), "hw-adapter-toml-"));
  try {
    installTwice("gemini", dir);
    const toml = readFileSync(join(dir, ".gemini/commands/hw/audit.toml"), "utf8");
    assert.match(toml, /^description = ".+"\nprompt = """\n/);
    assert.match(toml, /"""\n$/);
    assert.equal((toml.match(/"""/g) || []).length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
