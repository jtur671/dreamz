#!/bin/bash
# Install the Dreamz marketing dashboard as a macOS LaunchAgent so it
# starts automatically at login and restarts if it crashes.
#
# Runs only on macOS (uses launchctl + ~/Library/LaunchAgents/).
# Requires: a login shell that resolves `npm` via the user's PATH
# (nvm, brew, asdf, system node — anything works because we invoke
# through `/bin/zsh -l -c` which loads the user's shell profile).
#
# Usage:
#   ./scripts/install-launchagent.sh     # install + load
#   ./scripts/uninstall-launchagent.sh   # remove it

set -euo pipefail

LABEL="com.dreamzjournal.marketing-dashboard"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/dreamz-marketing"

# Resolve the automation directory (the parent of this scripts/ folder).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOMATION_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

mkdir -p "$(dirname "$PLIST_PATH")"
mkdir -p "$LOG_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>-l</string>
        <string>-c</string>
        <string>cd "${AUTOMATION_DIR}" &amp;&amp; npm run dashboard</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${AUTOMATION_DIR}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
    </dict>

    <key>ThrottleInterval</key>
    <integer>30</integer>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/dashboard.out.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/dashboard.err.log</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
PLIST

echo "Wrote $PLIST_PATH"

# Unload first if already present (safe no-op if not loaded).
launchctl unload "$PLIST_PATH" 2>/dev/null || true

launchctl load "$PLIST_PATH"

echo "Loaded ${LABEL}."
echo "Logs: ${LOG_DIR}/dashboard.{out,err}.log"
echo "Open: http://127.0.0.1:4455"
echo ""
echo "To verify it is running: launchctl list | grep ${LABEL}"
echo "To stop temporarily:     launchctl unload $PLIST_PATH"
echo "To uninstall completely: ./scripts/uninstall-launchagent.sh"
