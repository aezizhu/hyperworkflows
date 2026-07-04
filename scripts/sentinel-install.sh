#!/bin/sh
# Hyperworkflows sentinel scheduler installer. Prints schedule definitions by default (safe);
# writes the macOS LaunchAgent only with an explicit --install-launchd.
#
# Usage:
#   sentinel-install.sh                    # print launchd plist + crontab + GitHub Actions options
#   sentinel-install.sh --install-launchd  # write ~/Library/LaunchAgents/com.hyperworkflows.sentinel.plist and load it
#
# The nightly job runs at 02:30 Asia/Singapore from the repo it is installed in.

REPO_DIR=$(pwd)
PLIST_LABEL="com.hyperworkflows.sentinel"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_LABEL.plist"
CLAUDE_BIN=$(command -v claude || echo "/usr/local/bin/claude")

plist() {
cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$PLIST_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>cd "$REPO_DIR" &amp;&amp; CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 "$CLAUDE_BIN" -p "/hyperworkflows:sentinel nightly" --output-format json --max-turns 200 >> runs/sentinel-nightly.log 2>&amp;1</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>2</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>$REPO_DIR/runs/sentinel-launchd.log</string>
  <key>StandardErrorPath</key><string>$REPO_DIR/runs/sentinel-launchd.log</string>
</dict>
</plist>
EOF
}

if [ "$1" = "--install-launchd" ]; then
  mkdir -p "$HOME/Library/LaunchAgents" runs
  plist > "$PLIST_PATH"
  launchctl unload "$PLIST_PATH" 2>/dev/null
  launchctl load "$PLIST_PATH"
  echo "Installed and loaded: $PLIST_PATH (nightly 02:30 local time; machine timezone should be Asia/Singapore)"
  echo "Verify with: launchctl list | grep $PLIST_LABEL"
  exit 0
fi

echo "=== Option A: macOS LaunchAgent (recommended on this machine) ==="
echo "Run: $0 --install-launchd   (writes $PLIST_PATH)"
echo
echo "=== Option B: crontab line ==="
echo "30 2 * * * cd \"$REPO_DIR\" && \"$CLAUDE_BIN\" -p \"/hyperworkflows:sentinel nightly\" --output-format json --max-turns 200 >> runs/sentinel-nightly.log 2>&1"
echo
echo "=== Option C: GitHub Actions (runs in CI, needs ANTHROPIC_API_KEY secret) ==="
cat <<'YAML'
name: hypersentinel-nightly
on:
  schedule:
    - cron: "30 18 * * *"   # 02:30 Asia/Singapore == 18:30 UTC
jobs:
  sentinel:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @anthropic-ai/claude-code
      - run: CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0 claude -p "/hyperworkflows:sentinel nightly" --output-format json --max-turns 200
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
YAML
exit 0
