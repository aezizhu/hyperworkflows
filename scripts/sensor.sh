#!/bin/sh
# HW SubagentStop sensor: zero-token telemetry. Appends one JSON line per subagent stop
# to the active run's journal. Never blocks, never fails the session.

[ -f runs/ACTIVE ] || exit 0
RUN_ID=$(cat runs/ACTIVE 2>/dev/null)
[ -n "$RUN_ID" ] || exit 0
mkdir -p "runs/$RUN_ID" 2>/dev/null || exit 0

node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  let j = {};
  try { j = JSON.parse(d); } catch {}
  // Timestamps in Asia/Singapore for operator-facing journals.
  const ts = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Singapore" }).replace(" ", "T") + "+08:00";
  const line = JSON.stringify({
    ts,
    event: j.hook_event_name || "SubagentStop",
    agent: j.agent_type || j.subagent_type || null,
    id: j.agent_id || j.session_id || null
  });
  try { require("fs").appendFileSync(process.argv[1] + "/events.jsonl", line + "\n"); } catch {}
});' "runs/$RUN_ID" 2>/dev/null

exit 0
