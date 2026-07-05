#!/bin/sh
# Hyperworkflows PreToolUse guard (deny wall). Thin wrapper — all analysis lives in
# guard-analyze.mjs (tokenized, clause-by-clause; hardened per audit-13d2374 after
# the plugin's own attacker bypassed the old substring patterns). Exit 2 blocks;
# fail-open on any error.

exec node "$(dirname "$0")/guard-analyze.mjs"
