#!/bin/bash

# Weekly rebuild script for free Apple provisioning
# Run this weekly or set up as a cron job

echo "Starting weekly rebuild for Eidolon..."

# Build with device profile
eas build --profile device --platform ios --non-interactive --message "Weekly rebuild $(date +%Y-%m-%d)"

# Send notification when complete (optional)
echo "Build submitted. Check https://expo.dev/accounts/khenbest/projects/eidolon/builds for status"

# To automate installation:
# 1. Download .ipa when ready
# 2. Use Apple Configurator 2 CLI or other tools to auto-install