# Architecture Diagram Support — Design Spec

**Issue:** [#96](https://github.com/ericfitz/tmi-ux/issues/96)
**Date:** 2026-04-06
**Branch:** dev/1.4.0

## Overview

Allow users to optionally display cloud provider architecture icons (AWS, Azure, GCP, OCI) on DFD shapes, transforming data flow diagrams into architecture-style diagrams. Icons are selected via a search-driven floating panel and persisted in cell data.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data storage | `cell.data._arch` (cell data, not attrs) | `Cell.data` already has `additionalProperties: true` — no server API changes needed |
| Icon hosting | Hybrid: manifest bundled, SVGs lazy-loaded from app assets | Zero external dependencies, instant picker population, lazy SVG loading |
| Icon picker UI | Search-driven floating panel (no provider tabs) | Multi-token search across provider/category/name is faster than tab navigation |
| Icon picker trigger | Toolbar button next to style panel toggle | Same interaction pattern as existing style panel |
| Empty search state | Show prompt with examples, no icons | Reinforces search-first interaction, avoids rendering 1,849 icons |
| Shape borders with icons | User-configurable preference (default: show) | Allows experimentation; easy to remove later |
| Border preference scope | Actor, process, store only | Security boundaries always retain stroke/fill (they're containers) |
| Icon color/stroke | No control — render SVGs as-is | Revisit later after experimentation |
| Auto-resize | Not in scope | Can add later if needed |
| Eligible shapes | Actor, process, store, security-boundary | Text-box and flow (edges) are excluded |

## Data Model

Architecture icon data is stored in `cell.data._arch`. The `_` prefix follows the existing `_metadata` convention for reserved namespace properties.

```typescript
interface ArchIconData {
  provider: 'aws' | 'azure' | 'gcp' | 'oci';
  type: 'services' | 'resources' | 'groups' | 'categories';
  subcategory: string;   // e.g. "compute", "databases"
  icon: string;          // filename without .svg, e.g. "amazon-ec2"
  placement: {
    vertical: 'top' | 'middle' | 'bottom';
    horizontal: 'left' | 'center' | 'right';
  };
}
```

Example on a cell:

```typescript
cell.data._arch = {
  provider: 'aws',
  type: 'services',
  subcategory: 'compute',
  icon: 'amazon-ec2',
  placement: { vertical: 'middle', horizontal: 'center' }
};
```

The SVG asset path is resolved as: `assets/architecture-icons/{provider}/{type}/{subcategory}/{icon}.svg`

## Icon Manifest

A build-time generated JSON file at `src/assets/architecture-icons/manifest.json`.

```json
{
  "icons": [
    {
      "provider": "aws",
      "type": "services",
      "subcategory": "compute",
      "icon": "amazon-ec2",
      "label": "Amazon EC2",
      "tokens": ["aws", "services", "compute", "amazon", "ec2"]
    }
  ]
}
```

### Fields

- **`label`**: Human-readable display name derived from the filename. Heuristic: split on `-`, capitalize each word, uppercase known acronyms (EC2, ECS, EKS, SQL, DB, VPN, API, CDN, IAM, etc.).
- **`tokens`**: Pre-computed searchable terms — provider, type, subcategory, and each word from the icon name. All lowercase, deduplicated.

### Generation

- **Script:** `scripts/generate-icon-manifest.ts` (run with `tsx`)
- **pnpm script:** `"generate:icon-manifest": "tsx scripts/generate-icon-manifest.ts"`
- **Input:** Walks `src/assets/architecture-icons/` directory tree
- **Output:** `src/assets/architecture-icons/manifest.json`
- **When to run:** Manually after adding/updating icons. Not part of the regular build. The generated `manifest.json` is checked into the repo.

### Icon Source

Icons are copied from `/Users/efitz/Projects/tmi-resources/cloud-architecture-icons/` into `src/assets/architecture-icons/` as part of this feature. 1,849 SVG files totaling ~6 MB across 4 providers:

- **AWS:** 858 icons (categories, groups, resources, services)
- **Azure:** 705 icons (services)
- **GCP:** 45 icons (categories, services)
- **OCI:** 241 icons (categories, groups, resources, services)

## Architecture Icon Service

A new service to manage manifest loading, search, and icon path resolution.

**Location:** `src/app/pages/dfd/infrastructure/services/architecture-icon.service.ts`

```typescript
@Injectable({ providedIn: 'root' })
export class ArchitectureIconService {
  // Load manifest (lazy, cached — not loaded at app startup)
  loadManifest(): Observable<void>;

  // Search icons — returns matches grouped by subcategory
  // Synchronous after manifest is loaded
  search(query: string): ArchIconSearchResult[];

  // Resolve SVG asset path from arch data
  getIconPath(arch: ArchIconData): string;

  // Get display label for an icon (from manifest, fallback to humanized filename)
  getIconLabel(arch: ArchIconData): string;

  // Get breadcrumb string, e.g. "AWS · Services · Compute"
  getIconBreadcrumb(arch: ArchIconData): string;
}

interface ArchIconSearchResult {
  subcategory: string;
  provider: string;
  icons: ArchIconManifestEntry[];
}
```

### Search Implementation

- Manifest loaded into memory as a flat array (~1,849 entries)
- `search()` splits query by whitespace into tokens
- Each token must prefix-match at least one token in the icon's `tokens` array
- All query tokens must match (AND logic, order-independent)
- Results grouped by subcategory, sorted alphabetically
- Returns empty array for empty/whitespace-only query

## Icon Picker Panel

A new draggable floating panel, following the same pattern as the style panel.

**Location:** `src/app/pages/dfd/presentation/components/icon-picker-panel/`

### Toggle

- New `mat-icon-button` in the DFD editor toolbar, next to the style panel toggle
- Material icon: `category`
- `matTooltip` with i18n label
- Toggles the icon picker panel open/closed

### Panel Layout (top to bottom)

1. **Title bar** — "Architecture Icon" + close button, draggable
2. **Current icon section** (only when an icon is assigned to the selected shape):
   - Icon preview (48px), label, breadcrumb (provider · type · subcategory)
   - Remove button (clears `_arch` from selected shapes)
   - Placement 3x3 grid (mirrors label position grid pattern)
3. **Search field** — placeholder: "Search by provider, service, or category..."
4. **Results area**:
   - Empty search: prompt text with example chips (e.g. `aws ec2`, `azure sql`, `gcp compute`)
   - Active search: icons grouped by subcategory with collapsible headers, 7 icons per row, match count in status bar
5. **Status bar** — match count + selected shape count

### Behavior

- **Context-sensitive:** Updates when shape selection changes. Shows current icon if selected shape has one.
- **Disabled states:** Shows "Icons not available for this shape" when a text-box or edge is selected. Shows "Select a shape first" when nothing is selected.
- **Click icon in grid:** Immediately applies `_arch` to selected shape(s) with default placement `{ vertical: 'middle', horizontal: 'center' }`.
- **Multi-select:** Applying an icon sets it on all selected eligible nodes. If selected nodes have different icons, current icon section shows the icon of the first selected node.
- **Search debounce:** 150ms to avoid re-filtering on every keystroke.
- **Undo/redo:** All icon set/change/remove/placement operations create `UpdateNodeOperation` entries.

## Shape Rendering

### Markup Changes

Add an `<image>` SVG element to each node shape's markup in `infra-x6-shape-definitions.ts`:

```typescript
markup: [
  { tagName: 'rect', selector: 'body' },
  { tagName: 'image', selector: 'icon' },  // NEW — between body and text
  { tagName: 'text', selector: 'text' },
]
```

Added to: actor, process, store, security-boundary, text-box (for markup consistency, but text-box icon is never set).

Z-order: icon renders above shape fill, below label.

### Icon Positioning

Uses the same `refX`/`refY` percentage system as labels:

```typescript
const ICON_PLACEMENT_ATTRS: Record<string, IconPlacementAttrs> = {
  'top-left':      { refX: '15%', refY: '15%' },
  'top-center':    { refX: '50%', refY: '15%' },
  'top-right':     { refX: '85%', refY: '15%' },
  'middle-left':   { refX: '15%', refY: '50%' },
  'middle-center': { refX: '50%', refY: '50%' },
  'middle-right':  { refX: '85%', refY: '50%' },
  'bottom-left':   { refX: '15%', refY: '85%' },
  'bottom-center': { refX: '50%', refY: '85%' },
  'bottom-right':  { refX: '85%', refY: '85%' },
};
```

Exact percentages may need tuning during implementation.

### Icon Sizing

Fixed size of 32x32 px regardless of shape size. The `<image>` element uses `width`/`height` attrs with `xAlignment`/`yAlignment` for centering on the anchor point. This can be adjusted during implementation if it doesn't look right at typical shape sizes.

### Label Behavior When Icon Present

- For actors, stores, processes: if icon placement is center, label shifts below the icon (refY adjusts down). If icon is in a corner, label stays in its current position.
- For security boundaries: no auto-repositioning — label and icon placement are independent.

### When Icon Is Absent

The `<image>` element has no `href` attr → renders nothing. No visual impact.

## User Preference: Shape Borders with Icons

### Data Model Change

Add to `UserPreferencesData`:

```typescript
showShapeBordersWithIcons: boolean;  // default: true
```

### UI

New checkbox in the Display tab of the user preferences dialog, under the "Diagram Editor" section:

**"Show shape fill and border when icon is displayed"**

### Behavior

When `showShapeBordersWithIcons` is `false` and a shape has an icon assigned:
- Shape `body` stroke → `transparent`
- Shape `body` fill → `transparent`

The shape geometry remains for selection, dragging, and port connections — only the visual fill/stroke is hidden.

**Scope:** Applies to **actor, process, store** only. Security boundaries always retain their stroke and fill regardless of this setting (they are containers and hiding their border would break spatial grouping).

## i18n

New keys:

- `dfd.iconPicker.title` — "Architecture Icon"
- `dfd.iconPicker.searchPlaceholder` — "Search by provider, service, or category..."
- `dfd.iconPicker.emptyStatePrompt` — "Type to search across all providers"
- `dfd.iconPicker.emptyStateTryExamples` — (hint text with examples)
- `dfd.iconPicker.statusMatches` — "{count} matches"
- `dfd.iconPicker.statusAvailable` — "{count} icons available"
- `dfd.iconPicker.statusShapesSelected` — "{count} shape(s) selected"
- `dfd.iconPicker.placement` — "Placement"
- `dfd.iconPicker.remove` — "Remove"
- `dfd.iconPicker.notAvailable` — "Icons not available for this shape"
- `dfd.iconPicker.selectShape` — "Select a shape first"
- `dfd.iconPicker.searchToChange` — "Search to change icon..."
- `dfd.iconPicker.toolbarTooltip` — "Architecture Icon"
- `userPreferences.display.showShapeBordersWithIcons` — "Show shape fill and border when icon is displayed"

## What Is NOT In Scope

- Icon color or stroke customization
- Auto-resize of shapes when icon is applied
- Server-side API schema changes for `_arch`
- External CDN hosting for icons
- Localization of icon labels (they're product names)
- Icon support for text-box or flow shapes
