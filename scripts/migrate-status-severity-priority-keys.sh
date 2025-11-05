#!/usr/bin/env bash
#
# Status, Severity, and Priority Localization Migration Script
# =============================================================
#
# Purpose:
#   Migrates severity keys from common.severity* to threatEditor.threatSeverity.*
#   and removes the empty footer section from all language files.
#
# What it does:
#   1. Moves common.severityCritical → threatEditor.threatSeverity."0"
#   2. Moves common.severityHigh → threatEditor.threatSeverity."1"
#   3. Moves common.severityMedium → threatEditor.threatSeverity."2"
#   4. Moves common.severityLow → threatEditor.threatSeverity."3"
#   5. Moves common.severityUnknown → threatEditor.threatSeverity."5"
#   6. Removes empty footer section
#   7. Formats all files with prettier after processing
#
# Note: Key "4" (Informational) will be added separately along with other new keys
#
# Usage:
#   ./scripts/migrate-status-severity-priority-keys.sh
#
# Requirements:
#   - jq (command-line JSON processor)
#   - pnpm (for running prettier)
#
# Notes:
#   - Processes all language files including en-US.json
#   - All changes are applied atomically using temporary files
#   - The script will exit on any error (set -euo pipefail)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
I18N_DIR="${SCRIPT_DIR}/../src/assets/i18n"

echo "Starting status/severity/priority localization migration..."
echo ""

# Process each language file
for lang_file in "${I18N_DIR}"/*.json; do
  filename=$(basename "$lang_file")

  echo "Processing: $filename"

  # Create a temporary file
  temp_file=$(mktemp)

  # Apply all the transformations using jq
  jq '
    # Store the old severity values before deleting them
    .threatEditor.threatSeverity."0" = .common.severityCritical |
    .threatEditor.threatSeverity."1" = .common.severityHigh |
    .threatEditor.threatSeverity."2" = .common.severityMedium |
    .threatEditor.threatSeverity."3" = .common.severityLow |
    .threatEditor.threatSeverity."5" = .common.severityUnknown |

    # Delete the old common.severity* keys
    del(.common.severityCritical, .common.severityHigh, .common.severityLow,
        .common.severityMedium, .common.severityUnknown) |

    # Remove empty footer section
    del(.footer)
  ' "$lang_file" > "$temp_file"

  # Replace the original file with the modified version
  mv "$temp_file" "$lang_file"

  echo "✓ Completed: $filename"
  echo ""
done

echo "Localization migration complete!"
echo ""
echo "Running prettier to format the files..."
pnpm run format -- "src/assets/i18n/*.json"
