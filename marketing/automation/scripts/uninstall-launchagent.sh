#!/bin/bash
# Uninstall the Dreamz marketing dashboard LaunchAgent.
# Unloads it, removes the plist, and leaves log files in place so the
# user can still inspect history.

set -euo pipefail

LABEL="com.dreamzjournal.marketing-dashboard"
OPENER_LABEL="com.dreamzjournal.marketing-dashboard-opener"
PLIST_PATH="$HOME/Library/LaunchAgents/${LABEL}.plist"
OPENER_PLIST_PATH="$HOME/Library/LaunchAgents/${OPENER_LABEL}.plist"

removed_any=0

for plist in "$PLIST_PATH" "$OPENER_PLIST_PATH"; do
    if [ -f "$plist" ]; then
        launchctl unload "$plist" 2>/dev/null || true
        rm -f "$plist"
        echo "Removed $plist"
        removed_any=1
    fi
done

if [ "$removed_any" = "0" ]; then
    echo "Nothing to remove (no dreamz marketing plists in ~/Library/LaunchAgents/)."
    exit 0
fi

echo "Logs preserved at ~/Library/Logs/dreamz-marketing/ — delete manually if you want."
