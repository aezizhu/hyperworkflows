#!/bin/sh
# Golden-file oracle for scripts/sentinel-install.sh
#
# Exercises both code paths deterministically and diffs against committed golden
# fixtures. Machine-specific values are pinned/normalized:
#   - REPO_DIR  = a throwaway temp cwd  -> normalized to <REPO>
#   - $0        = absolute script path  -> normalized to <SCRIPT>
#   - HOME      = a throwaway temp dir  -> normalized to <HOME>
#   - CLAUDE_BIN: `command -v claude` is forced to fail (minimal PATH with no
#     `claude`), so the script falls back to /usr/local/bin/claude on every host.
#   - launchctl is stubbed with a no-op so --install-launchd has zero side effects.
#
# TEST-ONLY: does not touch the target script or any production code.
set -e

# Locate the target script relative to this test file, resolve to absolute.
TEST_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SCRIPT_ABS=$(CDPATH= cd -- "$TEST_DIR/.." && pwd)/sentinel-install.sh
GOLDEN_DIR="$TEST_DIR/golden"

if [ ! -f "$SCRIPT_ABS" ]; then
  echo "FAIL: target script not found at $SCRIPT_ABS" >&2
  exit 2
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
FAKE_HOME="$WORK/home"
REPO_CWD="$WORK/repo"
STUB_BIN="$WORK/bin"
mkdir -p "$FAKE_HOME" "$REPO_CWD" "$STUB_BIN"
printf '#!/bin/sh\nexit 0\n' > "$STUB_BIN/launchctl"
chmod +x "$STUB_BIN/launchctl"

# Minimal PATH: real coreutils, our launchctl stub, but no `claude`.
RUN_PATH="$STUB_BIN:/usr/bin:/bin"

normalize() {
  sed -e "s#$SCRIPT_ABS#<SCRIPT>#g" \
      -e "s#$REPO_CWD#<REPO>#g" \
      -e "s#$FAKE_HOME#<HOME>#g"
}

fail=0
check() {
  # $1 = label, $2 = actual file, $3 = golden file
  if [ ! -f "$3" ]; then
    echo "FAIL[$1]: golden missing: $3" >&2
    fail=1
    return
  fi
  if diff -u "$3" "$2" >/dev/null; then
    echo "PASS[$1]"
  else
    echo "FAIL[$1]: output differs from golden" >&2
    diff -u "$3" "$2" >&2 || true
    fail=1
  fi
}

# --- Case 1: default (no-arg) mode: prints the three scheduling options ---
( cd "$REPO_CWD" && HOME="$FAKE_HOME" PATH="$RUN_PATH" sh "$SCRIPT_ABS" ) \
  > "$WORK/default.raw" 2>&1
ec_default=$?
[ "$ec_default" -eq 0 ] || { echo "FAIL[default]: exit $ec_default" >&2; fail=1; }
normalize < "$WORK/default.raw" > "$WORK/default.norm"
check default "$WORK/default.norm" "$GOLDEN_DIR/default.golden"

# --- Case 2: --install-launchd: writes the plist + loads it (launchctl stubbed) ---
( cd "$REPO_CWD" && HOME="$FAKE_HOME" PATH="$RUN_PATH" sh "$SCRIPT_ABS" --install-launchd ) \
  > "$WORK/install.raw" 2>&1
ec_install=$?
[ "$ec_install" -eq 0 ] || { echo "FAIL[install]: exit $ec_install" >&2; fail=1; }
normalize < "$WORK/install.raw" > "$WORK/install_stdout.norm"
check install-stdout "$WORK/install_stdout.norm" "$GOLDEN_DIR/install-stdout.golden"

PLIST="$FAKE_HOME/Library/LaunchAgents/com.hyperworkflows.sentinel.plist"
if [ ! -f "$PLIST" ]; then
  echo "FAIL[install-plist]: plist was not written to $PLIST" >&2
  fail=1
else
  normalize < "$PLIST" > "$WORK/plist.norm"
  check install-plist "$WORK/plist.norm" "$GOLDEN_DIR/plist.golden"
fi

if [ "$fail" -ne 0 ]; then
  echo "sentinel-install oracle: FAILED" >&2
  exit 1
fi
echo "sentinel-install oracle: all cases passed"
exit 0
