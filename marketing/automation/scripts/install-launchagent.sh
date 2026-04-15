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
OPENER_LABEL="com.dreamzjournal.marketing-dashboard-opener"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
OPENER_PLIST_PATH="$HOME/Library/LaunchAgents/${OPENER_LABEL}.plist"
LOG_DIR="$HOME/Library/Logs/dreamz-marketing"
DASHBOARD_URL="http://127.0.0.1:4455"

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

# ── Opener LaunchAgent ───────────────────────────────────────────────────
# Runs ONCE at login (no KeepAlive), waits for the dashboard service to
# bind its socket, then opens http://127.0.0.1:4455 in the default
# browser. Separating this from the main service prevents the browser
# tab from re-popping on every crash-restart of the dashboard.
cat > "$OPENER_PLIST_PATH" <<OPENER_PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${OPENER_LABEL}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>for i in 1 2 3 4 5 6 7 8 9 10; do if /usr/bin/curl -fs -o /dev/null "${DASHBOARD_URL}/api/status"; then /usr/bin/open "${DASHBOARD_URL}"; exit 0; fi; /bin/sleep 1; done; exit 1</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/opener.out.log</string>

    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/opener.err.log</string>
</dict>
</plist>
OPENER_PLIST

echo "Wrote $OPENER_PLIST_PATH"

# Unload first if already present (safe no-op if not loaded).
launchctl unload "$PLIST_PATH" 2>/dev/null || true
launchctl unload "$OPENER_PLIST_PATH" 2>/dev/null || true

launchctl load "$PLIST_PATH"
launchctl load "$OPENER_PLIST_PATH"

echo "Loaded ${LABEL} (always-on service)."
echo "Loaded ${OPENER_LABEL} (opens browser at next login)."
echo "Logs: ${LOG_DIR}/{dashboard,opener}.{out,err}.log"
echo "Open: ${DASHBOARD_URL}"
echo ""
echo "To verify the service is running: launchctl list | grep ${LABEL}"
echo "To pop the dashboard open now:    open ${DASHBOARD_URL}"
echo "To stop temporarily:              launchctl unload $PLIST_PATH"
echo "To uninstall completely:          ./scripts/uninstall-launchagent.sh"
