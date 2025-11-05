#!/usr/bin/env bash
#
# Localization Deduplication Script
# ====================================
#
# Purpose:
#   Applies the same deduplication changes made to en-US.json to all other language files.
#   This script consolidates duplicate translation keys and moves commonly used strings
#   to centralized locations in the common namespace.
#
# What it does:
#   1. Removes duplicate translation keys across different namespaces
#   2. Consolidates common strings (description, name, emailLabel, etc.) into common.*
#   3. Moves nested structures to preferred locations (e.g., documentEditor.title.edit)
#   4. Cleans up empty objects (e.g., footer becomes {})
#   5. Formats all files with prettier after processing
#
# Keys removed and their replacements:
#   - assetEditor.description → common.description
#   - noteEditor.description → common.description
#   - noteEditor.name → common.name
#   - common.assetId → common.objectTypes.asset
#   - common.severityNone → common.none
#   - threatModels.status → common.status
#   - threatModels.permissionsUser → common.subjectTypes.user
#   - threatEditor.editThreat → common.editThreat (already existed)
#   - threatEditor.viewThreat → common.viewThreat (already existed)
#   - footer.privacy → privacy.title
#   - footer.tos → tos.title
#   - login.local.emailLabel → common.emailLabel
#   - userPreferences.deleteMyData.emailLabel → common.emailLabel
#   - threatModels.name → common.name
#   - tos.lastUpdated → common.lastUpdated
#   - privacy.lastUpdated → common.lastUpdated
#   - threatModels.tooltips.addRepository → threatModels.createNewRepository
#   - threatModels.diagramsCount → threatModels.diagrams
#   - threatModels.editDocument → threatModels.documentEditor.title.edit
#   - threatModels.viewDocument → threatModels.documentEditor.title.view
#   - threatModels.tooltips.editRepository → threatModels.repositoryEditor.title.edit
#   - threatModels.viewRepository → threatModels.repositoryEditor.title.view
#
# Usage:
#   ./scripts/dedup-localization.sh
#
# Requirements:
#   - jq (command-line JSON processor)
#   - pnpm (for running prettier)
#
# Notes:
#   - en-US.json is skipped as it was already manually processed
#   - All changes are applied atomically using temporary files
#   - The script will exit on any error (set -euo pipefail)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
I18N_DIR="${SCRIPT_DIR}/../src/assets/i18n"

echo "Starting localization deduplication..."
echo ""

# Process each language file except en-US.json (which was already done manually)
for lang_file in "${I18N_DIR}"/*.json; do
  filename=$(basename "$lang_file")

  # Skip en-US.json as it's already been processed
  if [[ "$filename" == "en-US.json" ]]; then
    echo "Skipping en-US.json (already processed)"
    continue
  fi

  echo "Processing: $filename"

  # Create a temporary file
  temp_file=$(mktemp)

  # Apply all the transformations using jq
  jq '
    # Delete assetEditor.description
    del(.assetEditor.description) |

    # Delete noteEditor.description and noteEditor.name
    del(.noteEditor.description, .noteEditor.name) |

    # Add common.description, common.name, common.emailLabel, common.lastUpdated
    # (Move values from the first occurrence we find)
    .common.emailLabel = (.login.local.emailLabel // .common.emailLabel) |
    .common.name = (.noteEditor.name // .common.name) |
    .common.lastUpdated = (.tos.lastUpdated // .common.lastUpdated) |

    # Delete common.assetId (will use common.objectTypes.asset instead)
    del(.common.assetId) |

    # Delete common.severityNone (will use common.none)
    del(.common.severityNone) |

    # Delete threatModels.status (will use common.status)
    del(.threatModels.status) |

    # Delete threatModels.permissionsUser (will use common.subjectTypes.user)
    del(.threatModels.permissionsUser) |

    # Delete threatEditor.editThreat and threatEditor.viewThreat
    del(.threatEditor.editThreat, .threatEditor.viewThreat) |

    # Delete footer.privacy and footer.tos (will use privacy.title and tos.title)
    del(.footer.privacy, .footer.tos) |

    # Make footer an empty object if all keys are removed
    if (.footer | keys | length == 0) then .footer = {} else . end |

    # Delete login.local.emailLabel (moved to common.emailLabel)
    del(.login.local.emailLabel) |

    # Delete userPreferences.deleteMyData.emailLabel (will use common.emailLabel)
    del(.userPreferences.deleteMyData.emailLabel) |

    # Delete threatModels.name (will use common.name)
    del(.threatModels.name) |

    # Delete tos.lastUpdated and privacy.lastUpdated (will use common.lastUpdated)
    del(.tos.lastUpdated, .privacy.lastUpdated) |

    # Delete threatModels.tooltips.addRepository (will use threatModels.createNewRepository)
    del(.threatModels.tooltips.addRepository) |

    # Delete threatModels.diagramsCount (will use threatModels.diagrams)
    del(.threatModels.diagramsCount) |

    # Delete threatModels.editDocument and threatModels.viewDocument
    # (will use threatModels.documentEditor.title.edit and .view)
    del(.threatModels.editDocument, .threatModels.viewDocument) |

    # Delete threatModels.tooltips.editRepository and threatModels.editRepository
    # (will use threatModels.repositoryEditor.title.edit)
    del(.threatModels.tooltips.editRepository) |

    # Delete threatModels.viewRepository
    # (will use threatModels.repositoryEditor.title.view)
    del(.threatModels.viewRepository)
  ' "$lang_file" > "$temp_file"

  # Replace the original file with the modified version
  mv "$temp_file" "$lang_file"

  echo "✓ Completed: $filename"
  echo ""
done

echo "Localization deduplication complete!"
echo ""
echo "Running prettier to format the files..."
pnpm run format -- "src/assets/i18n/*.json"
