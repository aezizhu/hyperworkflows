#!/bin/sh
# Hyperworkflows secrets wall (PreToolUse, matcher: Edit|Write|MultiEdit|NotebookEdit).
# Refuses modification of .env-family secret files; template variants stay editable.
# Pattern absorbed from a battle-tested user configuration: agents routinely try to
# "helpfully" edit .env while wiring features — that is a secrets-handling incident,
# not a convenience. Never blocks anything else; fail-open on parse errors.

INPUT=$(cat)
FILE=$(printf '%s' "$INPUT" | node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try { const j = JSON.parse(d); process.stdout.write(String((j.tool_input && (j.tool_input.file_path || j.tool_input.notebook_path)) || "")); }
  catch { process.stdout.write(""); }
});' 2>/dev/null)

[ -n "$FILE" ] || exit 0

# Basename split on both / and \ (audit-13d2374 group C: backslash paths slipped past).
BASE=${FILE##*/}
BASE=${BASE##*\\}
case "$BASE" in
  .env.example|.env.sample|.env.template|.env.dist|.env.test)
    exit 0 ;;
  .env|.env.*|.envrc|.env~)
    printf 'Hyperworkflows secrets wall: refusing to modify %s (secret material).\nEdit the template variant (.env.example) instead, or ask the human to change secrets themselves.\n' "$BASE" >&2
    exit 2 ;;
esac
exit 0
