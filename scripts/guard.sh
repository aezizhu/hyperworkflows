#!/bin/sh
# HW PreToolUse guard (deny wall). Exit 2 blocks the tool call; stderr is fed back to the model.
# Blocks: force pushes, history rewrites, raw device writes, recursive deletes outside
# sanctioned areas, and merge/push without MERGE_TOKEN while an hw run is active.
# Everything else passes untouched (safety without friction).

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | node -e '
let d = "";
process.stdin.on("data", c => d += c);
process.stdin.on("end", () => {
  try { const j = JSON.parse(d); process.stdout.write(String((j.tool_input && j.tool_input.command) || "")); }
  catch { process.stdout.write(""); }
});' 2>/dev/null)

[ -z "$CMD" ] && exit 0

deny() {
  printf 'HW guard blocked this command.\nReason: %s\nSafe alternative: %s\n' "$1" "$2" >&2
  exit 2
}

case "$CMD" in
  *"git push"*"--force"*|*"git push -f"*|*"git push"*" -f "*)
    deny "force push rewrites shared history" "push to a new branch, or ask the human to force-push explicitly" ;;
esac

case "$CMD" in
  *"git filter-branch"*|*"git filter-repo"*|*"git reflog expire"*)
    deny "history rewrite" "ask the human before rewriting history" ;;
esac

case "$CMD" in
  *"dd "*"of=/dev/"*|*"mkfs"*"/dev/"*)
    deny "raw device write" "never write block devices from an agent; ask the human" ;;
esac

case "$CMD" in
  *"rm -rf"*|*"rm -fr"*|*"rm -r -f"*)
    case "$CMD" in
      *"rm -rf runs/"*|*"rm -rf ./runs/"*|*"rm -rf .claude/worktrees"*|*"rm -rf ./.claude/worktrees"*|*"rm -rf /tmp/"*|*"rm -rf node_modules"*|*"rm -rf ./node_modules"*)
        : ;;
      *)
        deny "recursive delete outside runs/, .claude/worktrees/, /tmp/, node_modules" "delete specific files instead, or ask the human" ;;
    esac ;;
esac

# MERGE_TOKEN protocol (single-merger discipline) — enforced only while an hw run is active,
# so normal git flows outside hw runs are never gated.
if [ -f "runs/ACTIVE" ]; then
  RUN_ID=$(cat runs/ACTIVE 2>/dev/null)
  if [ -n "$RUN_ID" ]; then
    case "$CMD" in
      *"git merge"*|*"git push"*)
        if [ ! -f "runs/$RUN_ID/MERGE_TOKEN" ]; then
          deny "hw run $RUN_ID is active: merge/push requires runs/$RUN_ID/MERGE_TOKEN (single-merger protocol)" "let the hw-merger phase perform the merge; if no run is actually in flight, remove the stale runs/ACTIVE file"
        fi ;;
    esac
  fi
fi

exit 0
