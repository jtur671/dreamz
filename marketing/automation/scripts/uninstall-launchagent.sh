#!/bin/bash
# Uninstall the Dreamz marketing dashboard LaunchAgent.
# Unloads it, removes the plist, and leaves log files in place so the
# user can still inspect history.

set -euo pipefail

LABEL="com.dreamzjournal.marketing-dashboard"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"

if [ ! -f "$PLIST_PATH" ]; then
    echo "Not installed (no file at $PLIST_PATH)."
    exit 0
fi

launchctl unload "$PLIST_PATH" 2>/dev/null || true
rm -f "$PLIST_PATH"

echo "Removed $PLIST_PATH"
echo "Logs preserved at ~/Library/Logs/dreamz-marketing/ — delete manually if you want."
