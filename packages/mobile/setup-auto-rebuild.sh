#!/bin/bash

# Add to crontab for automatic weekly rebuilds
# Runs every Sunday at 2 AM

SCRIPT_PATH="/Users/kenny/repos/personal-assistant/packages/mobile/weekly-rebuild.sh"

# Add to crontab (every Sunday at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * 0 cd /Users/kenny/repos/personal-assistant/packages/mobile && ./weekly-rebuild.sh >> rebuild.log 2>&1") | crontab -

echo "✅ Automatic weekly rebuild scheduled for Sundays at 2 AM"
echo "📝 Logs will be saved to rebuild.log"
echo "🔧 To check scheduled jobs: crontab -l"
echo "❌ To remove: crontab -e and delete the line"