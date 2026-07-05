#!/usr/bin/env node
// Hyperworkflows deny-wall analyzer. Reads the PreToolUse payload on stdin,
// prints the denial reason to stderr and exits 2 to block; exits 0 to allow.
// Fail-open on any parse error (a broken gate must never take the session hostage).
//
// Hardened per audit-13d2374 findings (the plugin's own attacker broke the old
// substring patterns):
//   A. force-push detection tokenizes: `git -c k=v push --force`, `git push origin
//      +main` (refspec force) and option-order variants are all caught.
//   B. compound commands split on && ; | || — each rm clause is judged alone, so a
//      sanctioned /tmp/ clause can no longer ride along an unsanctioned delete;
//      `..` traversal in allowlisted prefixes is rejected.
//   C. MERGE_TOKEN gate uses the same tokenizer (shared hole closed).

import { existsSync, readFileSync } from "node:fs";

function main(input) {
  let cmd = "";
  try { cmd = String(JSON.parse(input).tool_input?.command || ""); } catch { return 0; }
  if (!cmd) return 0;

  const deny = (reason, alt) => {
    process.stderr.write(`Hyperworkflows guard blocked this command.\nReason: ${reason}\nSafe alternative: ${alt}\n`);
    return 2;
  };

  // Approximate-but-honest tokenization: whitespace split with quote awareness.
  const tokenize = s => (s.match(/"[^"]*"|'[^']*'|\S+/g) || []).map(t => t.replace(/^["']|["']$/g, ""));
  // Split compound commands into clauses; judge each independently (finding B).
  const clauses = cmd.split(/&&|\|\||;|\|/).map(c => c.trim()).filter(Boolean);

  // git subcommand extraction: skip global options (-c k=v, -C dir, --config=..., etc).
  const gitSub = tokens => {
    let i = tokens.findIndex(t => t === "git" || t.endsWith("/git"));
    if (i === -1) return null;
    i++;
    while (i < tokens.length) {
      const t = tokens[i];
      if (t === "-c" || t === "-C") { i += 2; continue; }
      if (t.startsWith("-")) { i++; continue; }
      return { sub: t, rest: tokens.slice(i + 1) };
    }
    return null;
  };

  for (const clause of clauses) {
    const tokens = tokenize(clause);
    const git = gitSub(tokens);

    if (git && git.sub === "push") {
      const force = git.rest.some(t =>
        t === "-f" || t === "--force" || t.startsWith("--force-with-lease") || t.startsWith("--force-if-includes") ||
        (/^-[a-z]*f[a-z]*$/i.test(t) && t !== "-f" ? true : false) ||   // bundled short flags e.g. -uf
        (/^\+\S/.test(t)));                                             // +refspec force form
      if (force) return deny("force push rewrites shared history", "push to a new branch, or ask the human to force-push explicitly");
    }

    if (git && (git.sub === "filter-branch" || git.sub === "filter-repo" || (git.sub === "reflog" && git.rest[0] === "expire"))) {
      return deny("history rewrite", "ask the human before rewriting history");
    }

    if (tokens.some(t => t === "dd") && tokens.some(t => /^of=\/dev\//.test(t))) {
      return deny("raw device write", "never write block devices from an agent; ask the human");
    }
    if (tokens.some(t => t.startsWith("mkfs")) && tokens.some(t => t.startsWith("/dev/"))) {
      return deny("raw device write", "never write block devices from an agent; ask the human");
    }

    // rm -rf: flags in any order or bundled; every path judged against the allowlist.
    const rmIdx = tokens.findIndex(t => t === "rm" || t.endsWith("/rm"));
    if (rmIdx !== -1) {
      const args = tokens.slice(rmIdx + 1);
      const flags = args.filter(t => t.startsWith("-"));
      const recursive = flags.some(t => /r/i.test(t));
      const force = flags.some(t => /f/.test(t));
      if (recursive && force) {
        const paths = args.filter(t => !t.startsWith("-"));
        const ALLOW = ["runs/", "./runs/", ".claude/worktrees", "./.claude/worktrees", "/tmp/", "node_modules", "./node_modules"];
        const ok = p => !p.includes("..") && ALLOW.some(a => p === a.replace(/\/$/, "") || p.startsWith(a));
        if (paths.length === 0 || !paths.every(ok)) {
          return deny("recursive delete outside runs/, .claude/worktrees/, /tmp/, node_modules (each path judged; no .. traversal)", "delete specific files instead, or ask the human");
        }
      }
    }
  }

  // MERGE_TOKEN protocol — same tokenizer, enforced only while a run is active.
  // M2 field lesson: ACTIVE may contain driver garbage (multiline, log fragments) —
  // take the first line, sanitized, so the gate stays coherent with the sensor.
  if (existsSync("runs/ACTIVE")) {
    const runId = (readFileSync("runs/ACTIVE", "utf8").split("\n")[0] || "").replace(/[^A-Za-z0-9._-]/g, "");
    if (runId && !existsSync(`runs/${runId}/MERGE_TOKEN`)) {
      for (const clause of clauses) {
        const git = gitSub(tokenize(clause));
        if (git && (git.sub === "merge" || git.sub === "push")) {
          return deny(`hyperworkflows run ${runId} is active: merge/push requires runs/${runId}/MERGE_TOKEN (single-merger protocol)`,
            "let the hyperworkflows-merger phase perform the merge; if no run is actually in flight, remove the stale runs/ACTIVE file");
        }
      }
    }
  }
  return 0;
}

let data = "";
process.stdin.on("data", c => data += c);
process.stdin.on("end", () => {
  let code = 0;
  try { code = main(data); } catch { code = 0; }   // fail-open
  process.exit(code);
});
