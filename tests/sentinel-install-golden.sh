#!/bin/sh
# Golden-file oracle for scripts/sentinel-install.sh (default / no-argument mode).
#
# The script's default output is deterministic given four inputs:
#   $0 (invoked name), $(pwd) (REPO_DIR), $HOME (PLIST_PATH), and the resolved
#   `claude` binary path (CLAUDE_BIN). This harness pins all four in a sandbox,
#   canonicalizes the machine-specific tokens into placeholders using the SAME
#   `pwd` mechanism the script uses, then diffs against a committed golden file.
#
# Exit 0 == output matches golden. Non-zero == drift (diff printed to stderr).
#
# TEST-ONLY: runs an isolated copy of the script in a mktemp sandbox with a
# no-op fake `claude`; the default mode writes nothing and calls no launchctl,
# so there are zero side effects on the host.
set -eu

HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$HERE/.." && pwd)
SCRIPT="$REPO_ROOT/scripts/sentinel-install.sh"
GOLDEN="$HERE/golden/sentinel-install.default.txt"

if [ ! -f "$SCRIPT" ]; then
  echo "FAIL: script not found: $SCRIPT" >&2
  exit 2
fi
if [ ! -f "$GOLDEN" ]; then
  echo "FAIL: golden not found: $GOLDEN" >&2
  exit 2
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
FAKEHOME="$WORK/home"
FAKEBIN="$WORK/bin"
FAKEREPO="$WORK/repo"
mkdir -p "$FAKEHOME" "$FAKEBIN" "$FAKEREPO"

# Deterministic, portable `claude` resolution: a no-op fake on a controlled PATH.
printf '#!/bin/sh\nexit 0\n' > "$FAKEBIN/claude"
chmod +x "$FAKEBIN/claude"

# Copy so $0 == "sentinel-install.sh" (fixed) while cwd == FAKEREPO (fixed).
cp "$SCRIPT" "$FAKEREPO/sentinel-install.sh"

SANDBOX_PATH="$FAKEBIN:/usr/bin:/bin:/usr/sbin:/sbin"

# Compute REPO_ABS with the SAME shell/builtin the script uses for $(pwd),
# so canonicalization substitution is guaranteed to match the script's output.
REPO_ABS=$(cd "$FAKEREPO" && env -i PATH="$SANDBOX_PATH" sh -c 'pwd')

ACTUAL=$(cd "$FAKEREPO" && env -i HOME="$FAKEHOME" PATH="$SANDBOX_PATH" sh sentinel-install.sh)
RC=$?
if [ "$RC" -ne 0 ]; then
  echo "FAIL: script exited $RC in default mode (expected 0)" >&2
  exit 1
fi

# Canonicalize env-specific absolute tokens -> stable placeholders.
NORM=$(printf '%s\n' "$ACTUAL" \
  | sed -e "s#$FAKEBIN/claude#<CLAUDE_BIN>#g" \
        -e "s#$REPO_ABS#<REPO_DIR>#g" \
        -e "s#$FAKEHOME#<HOME>#g")

if printf '%s\n' "$NORM" | diff -u "$GOLDEN" - >/tmp/sentinel-golden-diff.$$  2>&1; then
  echo "PASS: sentinel-install.sh default output matches golden"
  rm -f /tmp/sentinel-golden-diff.$$
  exit 0
else
  echo "FAIL: sentinel-install.sh default output drifted from golden:" >&2
  cat /tmp/sentinel-golden-diff.$$ >&2
  rm -f /tmp/sentinel-golden-diff.$$
  exit 1
fi
