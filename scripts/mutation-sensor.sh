#!/bin/sh
# Hyperworkflows E2 mutation sensor (PostToolUse, matcher: Edit|Write|MultiEdit|NotebookEdit):
# drops a per-session breadcrumb the moment the session mutates files. The Stop gate
# keys off this breadcrumb — sessions that never edit are never gated (Q&A, planning,
# brainstorming stay friction-free). Never blocks (always exit 0).

INPUT=$(cat)

. "$(dirname "$0")/lib-enforce.sh"
LEVEL=$(hyperworkflows_level)
[ "$LEVEL" -ge 2 ] || exit 0

SID=$(printf '%s' "$INPUT" | node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try { process.stdout.write(String(JSON.parse(d).session_id || "").replace(/[^a-zA-Z0-9_-]/g, "")); }
  catch { process.stdout.write(""); }
});' 2>/dev/null)
[ -n "$SID" ] || exit 0

mkdir -p runs/.sessions 2>/dev/null || exit 0
[ -f "runs/.sessions/$SID.mutated" ] || : > "runs/.sessions/$SID.mutated" 2>/dev/null
exit 0
