#!/bin/sh
# Hyperworkflows E1 drumbeat (UserPromptSubmit): one line of context per user turn,
# only in enforced projects. Recency beats volume — a fresh line near the context
# tail outlives a constitution injected 200k tokens ago. Never blocks (always exit 0).

cat > /dev/null 2>&1 || true   # consume payload; this hook needs no fields from it

. "$(dirname "$0")/lib-enforce.sh"
LEVEL=$(hyperworkflows_level)
[ "$LEVEL" -ge 1 ] || exit 0

echo "Hyperworkflows[E$LEVEL]: verification claims require script-computed verdicts (runs/<id>/verdicts/); deliverables are tricolor; undisclosed-unverified work is a violation."
exit 0
