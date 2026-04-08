# SSVC Supplier Calculator Design

## Overview

Add an SSVC (Stakeholder-Specific Vulnerability Categorization) calculator to the threat page, enabling security reviewers to make structured prioritization decisions about whether and when to fix a vulnerability. SSVC complements the existing CVSS calculator — where CVSS measures severity, SSVC provides a stakeholder-specific decision framework for action.

This implementation covers the **Supplier** perspective — for teams building/maintaining the software under review.

**Reference:** [CISA SSVC](https://www.cisa.gov/stakeholder-specific-vulnerability-categorization-ssvc) | [CERT/CC Supplier Tree](https://certcc.github.io/SSVC/howto/supplier_tree/)

## Data Model

### SSVCScore Interface

```typescript
interface SSVCScore {
  vector: string;        // "SSVCv2/E:A/U:S/T:T/P:S/2024-01-01/"
  decision: string;      // "Immediate" | "Out-of-Cycle" | "Scheduled" | "Defer"
  methodology: string;   // "Supplier"
}
```

Added to the `Threat` interface as `ssvc?: SSVCScore` (singular — one entry per threat). The `methodology` field future-proofs for adding other perspectives (Deployer, Coordinator) without schema changes.

### Server-Side Schema Change

The TMI server's Threat schema must be extended to include the `ssvc` field. File a GitHub issue against `ericfitz/tmi` with the `SSVCScore` structure above as the proposed schema addition. The client should handle the field being absent (server hasn't been updated yet) gracefully — the "Add SSVC" button simply won't persist until the API supports it.

## Decision Engine

### Approach

Self-contained lookup table — no external npm library. The Supplier decision tree has 36 deterministic paths (3 x 3 x 2 x 2), small enough to encode directly. This avoids dependency risk and keeps the implementation simple and testable.

### Decision Points (Supplier Tree)

#### 1. Exploitation (3 values)
| Value | Short | Description |
|-------|-------|-------------|
| None | N | No evidence of active exploitation and no public proof-of-concept |
| Public PoC | P | Typical public PoC exists (e.g., Metasploit, ExploitDB) or well-known exploitation method |
| Active | A | Reliable evidence of real-world exploitation by attackers |

#### 2. Utility (3 values)
| Value | Short | Description |
|-------|-------|-------------|
| Laborious | L | Not automatable and targets are diffuse (manual effort, low return) |
| Efficient | E | Either automatable with diffuse targets, or not automatable but concentrated targets |
| Super Effective | S | Automatable and targets are concentrated (automated exploitation of high-value systems) |

#### 3. Technical Impact (2 values)
| Value | Short | Description |
|-------|-------|-------------|
| Partial | P | Limited control over software behavior or information exposure |
| Total | T | Total control of software behavior or complete information disclosure |

#### 4. Public Safety Impact (2 values)
| Value | Short | Description |
|-------|-------|-------------|
| Minimal | M | Safety impact is negligible |
| Significant | S | Safety impact is marginal, critical, or catastrophic |

### Decision Outcomes

| Decision | Description |
|----------|-------------|
| Defer | No immediate action; resolve within normal cycles (~90 days) |
| Scheduled | Address during regular maintenance/development cycles |
| Out-of-Cycle | Develop outside normal processes, reallocating resources |
| Immediate | Mobilize all available resources for rapid remediation |

### Decision Table

The full 36-row lookup table maps each combination of (Exploitation, Utility, Technical Impact, Public Safety Impact) to a decision outcome. The table is encoded as a static data structure in the decision engine, keyed by the short codes (e.g., `"N:L:P:M" => "Defer"`).

### Vector String Format

Follows the CERT/CC convention: `SSVCv2/E:<value>/U:<value>/T:<value>/P:<value>/<ISO-date>/`

Example: `SSVCv2/E:A/U:S/T:T/P:S/2026-04-08/`

The date represents when the assessment was made.

## UI: Stepper Dialog

### Layout

A 4-step wizard dialog, one decision point per step. The stepper guides users through the Supplier decision tree sequentially.

### Dialog Configuration

- Width: `700px`
- Max width: `95vw`
- Max height: `90vh`
- Opened from the threat page via `MatDialog`

### Stepper Behavior

- **Step indicator** at the top shows all 4 steps with numbered circles and labels. Current step is highlighted; completed steps show a checkmark or filled state.
- Each step displays:
  - Step number and total ("Step 2 of 4")
  - Decision point name and description
  - Radio-card-style value options, each with a name and description
- **Next →** button advances to the next step (enabled when a value is selected)
- **← Back** button on steps 2-4 returns to the previous step
- **Back + change invalidates downstream:** If the user goes back to step N and changes their selection, steps N+1 through 4 are reset to unset. The user must re-select values for subsequent steps.
- **Final step** (step 4, after selecting Public Safety Impact): shows a summary with the decision outcome (color-coded), the full vector string, and Apply/Cancel buttons.
- **Apply** closes the dialog and returns the `SSVCScore` result.
- **Cancel** closes the dialog without saving.

### Edit Mode

When reopening the calculator for an existing SSVC entry:
- All steps are pre-populated from the existing vector string
- User can navigate to any step using Back/Next
- Changing a step still invalidates downstream steps
- The final step shows the (possibly updated) decision outcome

### RTL Support

The component watches `LanguageService.direction$` for text direction changes, same as the CVSS calculator.

## Decision Outcome Colors

All colors use existing theme CSS custom properties — no hardcoded values.

| Decision | CSS Token | Semantic Match |
|----------|-----------|----------------|
| Defer | `var(--color-severity-none)` | No action needed |
| Scheduled | `var(--color-severity-low)` | Routine priority |
| Out-of-Cycle | `var(--color-severity-high)` | Elevated urgency |
| Immediate | `var(--color-severity-critical)` | Drop everything |

This mapping works across both the standard and colorblind-safe themes since both define these tokens.

## Threat Page Integration

### Display

- A single chip below or alongside the CVSS chips
- Chip text: "SSVC: \<Decision\>" (e.g., "SSVC: Out-of-Cycle")
- Chip background uses the decision color token
- Tooltip on hover shows the full vector string
- Click opens the calculator in edit mode

### Actions

- **"Add SSVC" action button** if no SSVC entry exists (similar to "Add CVSS" button)
- **Remove (X)** button on the chip to clear the SSVC entry
- Chip click opens the calculator in edit mode with existing values pre-populated

### Graceful Degradation

If the server API does not yet support the `ssvc` field, the UI should still render the calculator and allow the user to interact with it. The `ssvc` field will be included in the threat payload sent to the API. If the server silently drops the unknown field, the data will not persist — this is acceptable until the server schema is updated. No feature flag is needed; the UI is always available.

## Localization

All UI strings go through Transloco under the `ssvcCalculator` namespace:

- `ssvcCalculator.title` — "SSVC Calculator"
- `ssvcCalculator.methodology` — "Supplier"
- `ssvcCalculator.apply` — "Apply"
- `ssvcCalculator.cancel` — "Cancel"
- `ssvcCalculator.next` — "Next"
- `ssvcCalculator.back` — "Back"
- `ssvcCalculator.stepOf` — "Step {{current}} of {{total}}"
- `ssvcCalculator.openCalculator` — "Add SSVC"
- `ssvcCalculator.vectorString` — "Vector String"
- `ssvcCalculator.decisionLabel` — "Decision"
- `ssvcCalculator.exploitation.*` — Decision point name, description, and value names/descriptions
- `ssvcCalculator.utility.*` — Same structure
- `ssvcCalculator.technicalImpact.*` — Same structure
- `ssvcCalculator.publicSafetyImpact.*` — Same structure
- `ssvcCalculator.decisions.*` — Decision outcome names and descriptions (Defer, Scheduled, Out-of-Cycle, Immediate)

## Files to Create/Modify

### New Files
- `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.ts`
- `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.html`
- `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.scss`
- `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.types.ts`
- `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.spec.ts`
- `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-decision-tree.ts` — Decision engine (lookup table + vector string builder)
- `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-decision-tree.spec.ts` — Decision engine tests

### Modified Files
- `src/app/pages/tm/models/threat-model.model.ts` — Add `SSVCScore` interface and `ssvc` field to `Threat`
- `src/app/pages/tm/components/threat-page/threat-page.component.ts` — Add SSVC chip display, open/edit/remove methods
- `src/app/pages/tm/components/threat-page/threat-page.component.html` — Add SSVC chip and "Add SSVC" button
- `src/app/pages/tm/components/threat-page/threat-page.component.scss` — SSVC chip styling (using theme tokens)
- `src/assets/i18n/en-US.json` — Add `ssvcCalculator.*` translation keys
- Other locale files — Add `ssvcCalculator.*` keys (backfill)

### Server Issue
- File a GitHub issue against `ericfitz/tmi` proposing the `ssvc` field on the Threat schema
