#!/usr/bin/env sh

# Generate build-info.json with the current git commit hash.
# Falls back to "unknown" if git is not available (e.g., Docker builds without .git).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$PROJECT_ROOT/src/build-info.json"

GIT_COMMIT=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")

cat > "$OUTPUT_FILE" <<EOF
{
  "gitCommit": "$GIT_COMMIT"
}
EOF
