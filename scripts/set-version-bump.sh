#!/bin/bash

# Helper script to set VERSION_BUMP type via temp file
# Usage: bash scripts/set-version-bump.sh [minor|patch]

BUMP_TYPE=$1
TEMP_FILE=".version-bump-type"

if [ -z "$BUMP_TYPE" ]; then
  echo "❌ Error: Bump type required"
  echo "Usage: bash scripts/set-version-bump.sh [minor|patch]"
  exit 1
fi

if [ "$BUMP_TYPE" != "minor" ] && [ "$BUMP_TYPE" != "patch" ]; then
  echo "❌ Error: Invalid bump type '$BUMP_TYPE'"
  echo "Valid options: minor, patch"
  exit 1
fi

echo "$BUMP_TYPE" > "$TEMP_FILE"
echo "✅ Version bump type set to: $BUMP_TYPE"
echo "   This will be used for the next deployment build"
echo "   Run: pnpm run build:prod (or build:staging, build:hosted-container)"
