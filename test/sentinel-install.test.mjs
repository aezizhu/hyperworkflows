// Golden-file oracle for scripts/sentinel-install.sh.
//
// The installer's default path is a pure function of four inputs ($0, $HOME,
// $REPO_DIR=cwd, $CLAUDE_BIN). We pin all four to sandboxed values, normalize
// them back to placeholders, and diff the output byte-for-byte against a
// committed golden. The --install-launchd path is exercised with zero
// real-system impact: HOME is a temp dir and `launchctl`/`claude` are stubbed
// on PATH, so nothing is loaded into the real user's LaunchAgents.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync,
  realpathSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "scripts", "sentinel-install.sh");
const FIX = join(HERE, "fixtures");

// Build a hermetic sandbox: temp cwd, temp HOME, and a PATH-prefixed bin dir
// holding no-op `claude` and `launchctl` stubs. Returns paths + a normalizer.
function sandbox() {
  // realpath so the sandbox path matches what `pwd`/getcwd emits inside sh
  // (macOS /var -> /private/var symlink would otherwise defeat normalization).
  const root = realpathSync(mkdtempSync(join(tmpdir(), "hw-sentinel-")));
  const bin = join(root, "bin");
  const repo = join(root, "repo");
  const home = join(root, "home");
  for (const d of [bin, repo, home]) mkdirSync(d, { recursive: true });
  writeFileSync(join(bin, "claude"), "#!/bin/sh\n");
  writeFileSync(join(bin, "launchctl"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(bin, "claude"), 0o755);
  chmodSync(join(bin, "launchctl"), 0o755);
  const env = { ...process.env, HOME: home, PATH: `${bin}:${process.env.PATH}` };
  const claudeBin = join(bin, "claude");
  const normalize = (s) =>
    s
      .split(SCRIPT).join("<SCRIPT>")
      .split(claudeBin).join("<CLAUDE_BIN>")
      .split(repo).join("<REPO_DIR>")
      .split(home).join("<HOME>");
  return { root, repo, home, env, claudeBin, normalize };
}

test("sentinel-install: default output matches golden (schedule defs, cron, TZ arithmetic)", () => {
  const s = sandbox();
  const r = spawnSync("sh", [SCRIPT], { cwd: s.repo, env: s.env, encoding: "utf8" });
  assert.equal(r.status, 0, `exit; stderr=${r.stderr}`);
  const golden = readFileSync(join(FIX, "sentinel-install.default.golden"), "utf8");
  assert.equal(s.normalize(r.stdout), golden);
});

test("sentinel-install: default path is read-only (writes no plist)", () => {
  const s = sandbox();
  spawnSync("sh", [SCRIPT], { cwd: s.repo, env: s.env, encoding: "utf8" });
  const plist = join(s.home, "Library/LaunchAgents/com.hyperworkflows.sentinel.plist");
  assert.equal(existsSync(plist), false, "default run must not touch LaunchAgents");
});

test("sentinel-install: --install-launchd writes plist matching golden", () => {
  const s = sandbox();
  const r = spawnSync("sh", [SCRIPT, "--install-launchd"], {
    cwd: s.repo, env: s.env, encoding: "utf8",
  });
  assert.equal(r.status, 0, `exit; stderr=${r.stderr}`);
  const plistPath = join(s.home, "Library/LaunchAgents/com.hyperworkflows.sentinel.plist");
  assert.equal(existsSync(plistPath), true, "plist must be written");
  const golden = readFileSync(join(FIX, "sentinel-install.plist.golden"), "utf8");
  assert.equal(s.normalize(readFileSync(plistPath, "utf8")), golden);
});

test("sentinel-install: TZ metamorphic relation — launchd 02:30 local == GH Actions 18:30 UTC", () => {
  // SGT is UTC+8, so 02:30 Asia/Singapore is 18:30 UTC (previous day). The
  // launchd/cron schedule fires at local 02:30 while the CI schedule fires at
  // UTC 18:30; these must stay consistent or the nightly job drifts 8h.
  const s = sandbox();
  const out = spawnSync("sh", [SCRIPT], { cwd: s.repo, env: s.env, encoding: "utf8" }).stdout;
  assert.match(out, /^30 2 \* \* \*/m);          // crontab: local 02:30
  assert.match(out, /cron: "30 18 \* \* \*"/);    // GH Actions: UTC 18:30
  const localMin = 2 * 60 + 30;
  const utcMin = 18 * 60 + 30;
  assert.equal(((localMin - utcMin + 1440) % 1440) / 60, 8); // +8h == Asia/Singapore
});
