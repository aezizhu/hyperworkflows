#!/bin/sh
# Hyperworkflows E1 targeted nudge (PostToolUse, matcher: Bash): after a test/lint
# looking command, remind once per session that pass/fail comes from the script
# adjudicator, not from eyeballing output. Contextual reminders outperform ambient
# ones. Never blocks (always exit 0).

INPUT=$(cat)

. "$(dirname "$0")/lib-enforce.sh"
LEVEL=$(hyperworkflows_level)
[ "$LEVEL" -ge 1 ] || exit 0

PARSED=$(printf '%s' "$INPUT" | node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try {
    const j = JSON.parse(d);
    const cmd = String((j.tool_input && j.tool_input.command) || "");
    const sid = String(j.session_id || "nosession").replace(/[^a-zA-Z0-9_-]/g, "");
    process.stdout.write(sid + "\t" + cmd);
  } catch { process.stdout.write(""); }
});' 2>/dev/null)
[ -n "$PARSED" ] || exit 0
SID=${PARSED%%	*}
CMD=${PARSED#*	}

case "$CMD" in
  *"npm test"*|*"npm run test"*|*pytest*|*"cargo test"*|*"go test"*|*jest*|*vitest*|*"mvn test"*|*"cargo clippy"*|*"npm run lint"*|*eslint*|*ruff*)
    MARK="/tmp/hyperworkflows-nudge-$SID"
    [ -f "$MARK" ] && exit 0
    : > "$MARK" 2>/dev/null || exit 0
    echo "Hyperworkflows: adjudicate this result from raw exit codes via the plugin's adjudicate script — do not eyeball pass/fail from output text. Record a verdict file if this backs a claim."
    ;;
esac
exit 0
