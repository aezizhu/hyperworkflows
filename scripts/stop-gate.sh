#!/bin/sh
# Hyperworkflows E2 Stop gate — DISCLOSURE MODE (constitution C4, applied to the gate itself).
# It does NOT force verification; it forces honesty: a session that edited files may end
# only with verdict evidence OR an explicit UNVERIFIED disclosure in the final message.
#
# Survivability properties (why this gate won't get the plugin uninstalled):
#   - Sessions without file mutations are never gated (breadcrumb precondition).
#   - One-bounce: the platform sets stop_hook_active=true when the model continues
#     because of a previous Stop block — we always pass then. The gate cannot loop.
#   - Disclosure is always a legal exit: saying "UNVERIFIED" plainly satisfies it.
#   - Fail-open: any parse/read error passes (a broken gate must not take the session hostage).
# Active only at enforcement level >= 2.

INPUT=$(cat)

. "$(dirname "$0")/lib-enforce.sh"
LEVEL=$(hyperworkflows_level)
[ "$LEVEL" -ge 2 ] || exit 0

PARSED=$(printf '%s' "$INPUT" | node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(d);
    const sid = String(j.session_id || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const active = j.stop_hook_active ? "1" : "0";
    const t = String(j.transcript_path || "");
    process.stdout.write(sid + "\t" + active + "\t" + t);
  } catch { process.stdout.write(""); }
});' 2>/dev/null)
[ -n "$PARSED" ] || exit 0                                  # fail-open on parse error

SID=$(printf '%s' "$PARSED" | cut -f1)
ACTIVE=$(printf '%s' "$PARSED" | cut -f2)
TRANSCRIPT=$(printf '%s' "$PARSED" | cut -f3)

[ "$ACTIVE" = "1" ] && exit 0                               # one-bounce: never block twice
[ -n "$SID" ] || exit 0
BREADCRUMB="runs/.sessions/$SID.mutated"
[ -f "$BREADCRUMB" ] || exit 0                              # no mutations => no gate

# Evidence check: any verdict file written after the first mutation satisfies the gate.
NEWER=$(find runs evidence -path '*/verdicts/*.json' -newer "$BREADCRUMB" 2>/dev/null | head -1)
[ -n "$NEWER" ] && exit 0

# Disclosure check: last assistant message in the transcript. Fail-open if unreadable.
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ]; then
  DISCLOSED=$(node -e '
const fs = require("fs");
try {
  const lines = fs.readFileSync(process.argv[1], "utf8").trim().split("\n");
  let last = "";
  for (const line of lines) {
    try {
      const j = JSON.parse(line);
      if (j.type === "assistant" && j.message && Array.isArray(j.message.content)) {
        const text = j.message.content.filter(c => c.type === "text").map(c => c.text).join("\n");
        if (text) last = text;
      }
    } catch {}
  }
  process.stdout.write(/unverified/i.test(last) ? "yes" : "no");
} catch { process.stdout.write("yes"); }                    // unreadable => fail-open
' "$TRANSCRIPT" 2>/dev/null)
  [ "$DISCLOSED" = "no" ] || exit 0
else
  exit 0                                                    # no transcript => fail-open
fi

echo "Hyperworkflows Stop gate (disclosure mode): this session edited files but produced no verdict evidence, and the final message does not disclose the work as UNVERIFIED. Either (a) verify now — run the acceptance/repro commands, adjudicate the raw exit codes via the plugin's adjudicate script, write runs/<id>/verdicts/<unit>.json — or (b) state plainly in your final message which changes are UNVERIFIED and why. Honest disclosure always satisfies this gate; it will not fire twice." >&2
exit 2
