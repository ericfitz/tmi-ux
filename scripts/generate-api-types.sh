#!/usr/bin/env sh
set -e

# Regenerate src/app/generated/api-types.d.ts from the tmi server's OpenAPI spec.
# Prefers the local tmi checkout declared in .local-projects.json (see CLAUDE.md);
# falls back to the published spec on the tmi repo's main branch otherwise.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG="$PROJECT_ROOT/.local-projects.json"
OUTPUT_FILE="$PROJECT_ROOT/src/app/generated/api-types.d.ts"
FALLBACK_SPEC="https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/main/api-schema/tmi-openapi.json"

SPEC=""
if [ -f "$CONFIG" ]; then
  TMI_PATH=$(jq -r '.projects[]? | select(.name=="tmi") | .path // empty' "$CONFIG")
  if [ -n "$TMI_PATH" ] && [ -f "$TMI_PATH/api-schema/tmi-openapi.json" ]; then
    SPEC="$TMI_PATH/api-schema/tmi-openapi.json"
  fi
fi

if [ -z "$SPEC" ]; then
  SPEC="$FALLBACK_SPEC"
fi

echo "Generating API types from: $SPEC"
openapi-typescript "$SPEC" -o "$OUTPUT_FILE"
prettier --write "$OUTPUT_FILE"
