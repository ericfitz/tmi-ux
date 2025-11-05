#!/usr/bin/env bash
#
# Add Missing Translation Keys Script
# ====================================
#
# Purpose:
#   Adds missing translation keys to all non-English language files.
#   Uses English text as placeholders for professional translation later.
#
# Usage:
#   ./scripts/add-missing-translations.sh
#
# Requirements:
#   - jq (command-line JSON processor)
#   - pnpm (for running prettier)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
I18N_DIR="${SCRIPT_DIR}/../src/assets/i18n"

echo "Adding missing translation keys..."
echo ""

# Process each language file except en-US.json
for lang_file in "${I18N_DIR}"/*.json; do
  filename=$(basename "$lang_file")

  # Skip en-US.json as it has all the keys
  if [[ "$filename" == "en-US.json" ]]; then
    echo "Skipping en-US.json (source of truth)"
    continue
  fi

  echo "Processing: $filename"

  # Create a temporary file
  temp_file=$(mktemp)

  # Add all missing keys using jq
  jq '
    # Add threatEditor.threatPriority section
    .threatEditor.threatPriority = {
      "0": "Immediate (P0)",
      "0.description": "Must be addressed urgently; active exploitation, regulatory violation, or critical business exposure.",
      "1": "High (P1)",
      "1.description": "Requires prompt resolution; high-risk exposure or upcoming release deadline.",
      "2": "Medium (P2)",
      "2.description": "Address within standard development cycles; moderate exposure.",
      "3": "Low (P3)",
      "3.description": "Include in backlog for future cycles; no immediate exposure.",
      "4": "Deferred (P4)",
      "4.description": "Postponed with documented business approval; tracked but not scheduled."
    } |

    # Add description keys for threatSeverity
    .threatEditor.threatSeverity."0.description" = "Exploitable vulnerability enables complete system compromise, data breach, or safety impact; requires immediate action." |
    .threatEditor.threatSeverity."1.description" = "Significant impact or high likelihood; enables major unauthorized access, privilege escalation, or service disruption." |
    .threatEditor.threatSeverity."2.description" = "Moderate impact or likelihood; limited data exposure, partial functionality impairment, or requires chained exploits." |
    .threatEditor.threatSeverity."3.description" = "Minimal impact or low likelihood; negligible business impact, requires specific conditions or user interaction." |
    .threatEditor.threatSeverity."4" = "Informational" |
    .threatEditor.threatSeverity."4.description" = "No direct exploitability; recommendation, best practice deviation, or configuration improvement." |
    .threatEditor.threatSeverity."5.description" = "Threat severity has not yet been assessed." |

    # Add threatEditor.threatStatus section
    .threatEditor.threatStatus = {
      "0": "Open",
      "0.description": "The finding has been identified and documented but no action has been initiated.",
      "1": "Confirmed",
      "1.description": "The threat has been validated as legitimate through analysis or evidence.",
      "2": "Mitigation Planned",
      "2.description": "A remediation or mitigation strategy has been defined and assigned.",
      "3": "Mitigation In Progress",
      "3.description": "Implementation of controls, code changes, or countermeasures is underway.",
      "4": "Verification Pending",
      "4.description": "Mitigation is complete; security team must test or review effectiveness.",
      "5": "Resolved",
      "5.description": "The threat is fully mitigated and verified; residual risk is acceptable.",
      "6": "Accepted",
      "6.description": "The threat is acknowledged but intentionally not mitigated (e.g., due to business justification); requires formal risk acceptance.",
      "7": "False Positive",
      "7.description": "Investigation determined the finding is not a valid threat; no further action required.",
      "8": "Deferred",
      "8.description": "Action is postponed with approval (e.g., for future sprints); includes rationale and due date.",
      "9": "Closed",
      "9.description": "The finding is archived after resolution, acceptance, or invalidation, with audit trail."
    } |

    # Add threatModels.status section
    .threatModels.status = {
      "0": "Not Started",
      "0.tooltip": "The security review has been initiated but no assessment activities have begun.",
      "1": "In Progress",
      "1.tooltip": "Active assessment is underway, including threat modeling, code review, or testing.",
      "2": "Pending Review",
      "2.tooltip": "Assessment artifacts (e.g., reports, findings) await formal review by security leads or approvers.",
      "3": "Remediation Required",
      "3.tooltip": "Vulnerabilities or issues have been identified; development must address them.",
      "4": "Remediation In Progress",
      "4.tooltip": "Fixes for identified issues are being implemented by the development team.",
      "5": "Verification Pending",
      "5.tooltip": "Remediation is complete; security team must verify effectiveness.",
      "6": "Approved",
      "6.tooltip": "All issues are resolved and verified; the application meets security criteria for release or deployment.",
      "7": "Rejected",
      "7.tooltip": "The review failed critical criteria; significant rework is required before re-submission.",
      "8": "Deferred",
      "8.tooltip": "The review is paused (e.g., due to resource constraints or application changes); resumption is planned.",
      "9": "Closed",
      "9.tooltip": "The review is fully completed and archived, with no further action needed."
    }
  ' "$lang_file" > "$temp_file"

  # Replace the original file with the modified version
  mv "$temp_file" "$lang_file"

  echo "✓ Completed: $filename"
  echo ""
done

echo "Missing translations added!"
echo ""
echo "Running prettier to format the files..."
pnpm run format -- "src/assets/i18n/*.json"
