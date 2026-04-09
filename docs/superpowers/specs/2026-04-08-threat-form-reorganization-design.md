# Threat Page Form Reorganization Design

## Overview

Reorganize the threat edit page form into logical sections with divider labels, reorder fields for workflow priority, and consolidate related fields onto shared rows.

## Section Order and Layout

### 1. Tracking

```
── Tracking ──────────────────────────────────────────────
  [Issue URL                                    ] [edit]
  [Status    ]   [ ] Mitigated   [x] Include in Timmy Chat   [x] Include in Report
```

- Issue URL moves from middle of form to first row
- Status row (with 3 checkboxes) moves to second row
- "Include in Timmy Chat" checkbox joins the status row (already done in prior commit)

### 2. Description

```
── Description ───────────────────────────────────────────
  [Threat Name                                          ]
  [Asset                                                ]
  [Description (textarea)                               ]
```

- Same fields, same layout — just grouped under a section header

### 3. Classification

```
── Classification ────────────────────────────────────────
  [Severity   ]  [Score]  [Priority  ]  [+ Add SSVC]

  Threat Model Framework Mappings            CWE Mappings
  [Threat Type (multi-select)      ]   [CWE chips + input]  [+ Add CWE]

  CVSS
  [CVSS chips]
  [vector input                    ]  [+ Add CVSS]
```

- Severity/Score/Priority/SSVC row first (primary classification)
- Threat Type and CWE IDs merged onto one row with sub-labels:
  - Left: "Threat Model Framework Mappings" label above Threat Type multi-select
  - Right: "CWE Mappings" label above CWE chip input + "Add CWE" button
- CWE "+" button changes from `mat-icon-button` to `mat-stroked-button` with text, matching Add CVSS / Add SSVC style
- CVSS section unchanged

### 4. Mitigation

```
── Mitigation ────────────────────────────────────────────
  [Mitigation (textarea)                                ]
```

### 5. Diagram References

```
── Diagram References ────────────────────────────────────
  [Diagram ID                      ]  [Cell ID          ]
```

## Section Divider Style

Each section header is a `<mat-divider>` with a positioned label:

- Bold text, small (13px), uppercase, `letter-spacing: 0.5px`
- Color: `var(--mat-sys-on-surface-variant)`
- Margin: `24px 0 12px 0` (more top spacing to separate sections, less bottom)
- The label sits above the divider line (not overlaid/interrupting the line)

## Threat Type + CWE Row

Two-column flex layout within a single row:

- Left column (flex: 1): Section sub-label "Threat Model Framework Mappings", then Threat Type `mat-select` (full width of column)
- Right column (flex: 1): Section sub-label "CWE Mappings", then CWE chip input + "Add CWE" button
- Sub-labels use same style as existing section labels: `display: block`, `margin-bottom: 8px`, normal weight, `var(--mat-sys-on-surface-variant)` color
- Gap: 12px between columns

## CWE Button Restyling

The CWE "+" button changes from:
```html
<button mat-icon-button color="primary" (click)="openCwePicker()">
  <mat-icon>add</mat-icon>
</button>
```

To:
```html
<button mat-stroked-button color="primary" (click)="openCwePicker()">
  <mat-icon>add</mat-icon>
  {{ 'cwePicker.addCwe' | transloco }}
</button>
```

This matches the Add CVSS and Add SSVC button styling. The button vertically aligns with the CWE chip input using the same `margin-top: 10px` pattern.

## i18n Keys

New translation keys to add to `en-US.json`:

| Key | Value |
|-----|-------|
| `threatEditor.sections.tracking` | `Tracking` |
| `threatEditor.sections.description` | `Description` |
| `threatEditor.sections.classification` | `Classification` |
| `threatEditor.sections.mitigation` | `Mitigation` |
| `threatEditor.sections.diagramReferences` | `Diagram References` |
| `threatEditor.frameworkMappings` | `Threat Model Framework Mappings` |
| `threatEditor.cweMappings` | `CWE Mappings` |
| `cwePicker.addCwe` | `Add CWE` |

Each key gets a `.comment` sibling for translator context.

## Scope

- **Template only**: Reorder HTML blocks, add section dividers, merge Threat Type + CWE row
- **Style only**: Add section divider styles, mapping row styles
- **i18n**: Add 8 new keys + backfill
- **No logic changes**: No changes to component TypeScript, form setup, validators, or methods

## Files Modified

- `src/app/pages/tm/components/threat-page/threat-page.component.html` — Reorder fields, add section dividers, merge Threat Type + CWE row, restyle CWE button
- `src/app/pages/tm/components/threat-page/threat-page.component.scss` — Section divider styles, mapping row styles
- `src/assets/i18n/en-US.json` — Add 8 new translation keys
- Other locale files — Backfill translations
