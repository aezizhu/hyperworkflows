#!/bin/sh
# Hyperworkflows TaskCompleted gate: while a court is in session, a ruling cannot be marked complete
# without its evidence file (raw exit codes) on disk. No evidence, no completion.
# Outside court mode this gate is inert, so normal task usage is never blocked.

[ -f runs/ACTIVE ] || exit 0
RUN_ID=$(cat runs/ACTIVE 2>/dev/null)
[ -n "$RUN_ID" ] || exit 0
[ -f "runs/$RUN_ID/COURT" ] || exit 0

TASK_ID=$(cat | node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try { process.stdout.write(String(JSON.parse(d).task_id || "")); }
  catch { process.stdout.write(""); }
});' 2>/dev/null)

[ -z "$TASK_ID" ] && exit 0

if [ ! -f "runs/$RUN_ID/verdicts/task-$TASK_ID.json" ]; then
  echo "Hyperworkflows court gate: missing evidence file runs/$RUN_ID/verdicts/task-$TASK_ID.json. Execute the repro commands and record raw exit codes to that path before completing this ruling (skeptic duty: run it, don't argue it)." >&2
  exit 2
fi

exit 0
