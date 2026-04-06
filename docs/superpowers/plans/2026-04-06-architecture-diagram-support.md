# Architecture Diagram Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cloud provider architecture icons (AWS, Azure, GCP, OCI) to DFD shapes via a search-driven floating panel, persisted in cell data.

**Architecture:** Icons are stored in `cell.data._arch` (no server changes). A build-time manifest enables instant search. A new draggable floating panel provides search-driven icon selection with placement controls. Shape markup gains an `<image>` element for rendering. A user preference controls whether shape borders/fill are hidden when icons are displayed.

**Tech Stack:** Angular 19, AntV X6, Angular Material, Angular CDK (drag-drop), Vitest, Transloco (i18n), tsx (script runner)

**Spec:** `docs/superpowers/specs/2026-04-06-architecture-diagram-support-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/app/pages/dfd/types/icon-placement.types.ts` | Icon placement types, constants, and utilities (parallel to `label-position.types.ts`) |
| `src/app/pages/dfd/types/arch-icon.types.ts` | `ArchIconData`, `ArchIconManifestEntry`, `ArchIconSearchResult` interfaces |
| `src/app/pages/dfd/infrastructure/services/architecture-icon.service.ts` | Manifest loading, search, path resolution |
| `src/app/pages/dfd/infrastructure/services/architecture-icon.service.spec.ts` | Tests for the service |
| `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.ts` | Icon picker panel component |
| `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.html` | Icon picker panel template |
| `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.scss` | Icon picker panel styles |
| `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.spec.ts` | Icon picker panel tests |
| `scripts/generate-icon-manifest.ts` | Build-time manifest generator |
| `src/assets/architecture-icons/manifest.json` | Generated icon manifest (1,849 entries) |
| `src/assets/architecture-icons/**/*.svg` | Copied icon SVG files |

### Modified Files

| File | Changes |
|------|---------|
| `src/app/pages/dfd/infrastructure/adapters/infra-x6-shape-definitions.ts` | Add `<image>` element to shape markup arrays |
| `src/app/pages/dfd/presentation/components/dfd.component.ts` | Toggle icon picker panel, handle icon changes, apply border preference |
| `src/app/pages/dfd/presentation/components/dfd.component.html` | Add toolbar button and icon picker panel element |
| `src/app/core/services/user-preferences.service.ts` | Add `showShapeBordersWithIcons` to interface and defaults |
| `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts` | Add handler for new preference |
| `src/assets/i18n/en-US.json` | Add i18n keys for icon picker and preference |
| `package.json` | Add `generate:icon-manifest` script |

---

## Task 1: Copy Icon Assets and Generate Manifest

**Files:**
- Create: `scripts/generate-icon-manifest.ts`
- Create: `src/assets/architecture-icons/` (copied from tmi-resources)
- Create: `src/assets/architecture-icons/manifest.json` (generated)
- Modify: `package.json`

- [ ] **Step 1: Copy icon files from tmi-resources**

```bash
cp -r /Users/efitz/Projects/tmi-resources/cloud-architecture-icons/* src/assets/architecture-icons/
```

Verify the copy:

```bash
find src/assets/architecture-icons -name "*.svg" | wc -l
# Expected: 1849
```

- [ ] **Step 2: Write the manifest generation script**

Create `scripts/generate-icon-manifest.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const ICONS_DIR = path.resolve(__dirname, '../src/assets/architecture-icons');
const OUTPUT_FILE = path.join(ICONS_DIR, 'manifest.json');

// Known acronyms to uppercase in labels
const ACRONYMS = new Set([
  'ec2', 'ecs', 'eks', 'sql', 'db', 'vpn', 'api', 'cdn', 'iam', 'rds',
  'sqs', 'sns', 'emr', 's3', 'efs', 'ebs', 'elb', 'alb', 'nlb', 'acm',
  'kms', 'waf', 'vpc', 'nat', 'dns', 'ssl', 'tls', 'ssh', 'http', 'https',
  'tcp', 'udp', 'ip', 'iot', 'ai', 'ml', 'ci', 'cd', 'vm', 'gpu', 'cpu',
  'ram', 'ssd', 'hdd', 'os', 'sdk', 'cli', 'ui', 'ux', 'id', 'arn',
  'oci', 'gcp', 'aws', 'dms', 'fsx', 'msk', 'mq', 'ses', 'lex', 'glue',
  'sso', 'ad', 'ldap', 'saml', 'oidc', 'oauth', 'adb', 'ocid',
]);

interface ManifestEntry {
  provider: string;
  type: string;
  subcategory: string;
  icon: string;
  label: string;
  tokens: string[];
}

function humanizeFilename(filename: string): string {
  return filename
    .split('-')
    .map(word => {
      if (ACRONYMS.has(word.toLowerCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function generateTokens(entry: Omit<ManifestEntry, 'tokens'>): string[] {
  const parts = [
    entry.provider,
    entry.type,
    entry.subcategory,
    ...entry.icon.split('-'),
  ];
  const tokens = new Set(parts.map(p => p.toLowerCase()).filter(p => p.length > 0));
  return Array.from(tokens);
}

function walkIcons(): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  const providers = fs.readdirSync(ICONS_DIR).filter(f => {
    const fullPath = path.join(ICONS_DIR, f);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const provider of providers) {
    const providerDir = path.join(ICONS_DIR, provider);
    const types = fs.readdirSync(providerDir).filter(f =>
      fs.statSync(path.join(providerDir, f)).isDirectory()
    );

    for (const type of types) {
      const typeDir = path.join(providerDir, type);
      const subcategories = fs.readdirSync(typeDir).filter(f =>
        fs.statSync(path.join(typeDir, f)).isDirectory()
      );

      if (subcategories.length > 0) {
        // Has subcategory directories
        for (const subcategory of subcategories) {
          const subcatDir = path.join(typeDir, subcategory);
          const svgs = fs.readdirSync(subcatDir).filter(f => f.endsWith('.svg'));

          for (const svg of svgs) {
            const icon = svg.replace('.svg', '');
            const partial = { provider, type, subcategory, icon, label: humanizeFilename(icon) };
            entries.push({ ...partial, tokens: generateTokens(partial) });
          }
        }
      } else {
        // SVGs directly in type directory (no subcategories)
        const svgs = fs.readdirSync(typeDir).filter(f => f.endsWith('.svg'));

        for (const svg of svgs) {
          const icon = svg.replace('.svg', '');
          const partial = { provider, type, subcategory: type, icon, label: humanizeFilename(icon) };
          entries.push({ ...partial, tokens: generateTokens(partial) });
        }
      }
    }
  }

  return entries.sort((a, b) =>
    `${a.provider}/${a.type}/${a.subcategory}/${a.icon}`.localeCompare(
      `${b.provider}/${b.type}/${b.subcategory}/${b.icon}`
    )
  );
}

const icons = walkIcons();
const manifest = { icons };
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Generated manifest with ${icons.length} icons at ${OUTPUT_FILE}`);
```

- [ ] **Step 3: Add pnpm script to package.json**

Add to the `"scripts"` section in `package.json`:

```json
"generate:icon-manifest": "tsx scripts/generate-icon-manifest.ts"
```

- [ ] **Step 4: Run the manifest generator and verify**

```bash
pnpm run generate:icon-manifest
```

Expected output: `Generated manifest with 1849 icons at .../manifest.json`

Verify the manifest:

```bash
cat src/assets/architecture-icons/manifest.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d[\"icons\"])} icons'); print(json.dumps(d['icons'][0], indent=2))"
```

- [ ] **Step 5: Commit**

```bash
git add src/assets/architecture-icons/ scripts/generate-icon-manifest.ts package.json
git commit -m "feat(dfd): add architecture icon assets and manifest generator (#96)"
```

---

## Task 2: Icon Types and Placement Constants

**Files:**
- Create: `src/app/pages/dfd/types/arch-icon.types.ts`
- Create: `src/app/pages/dfd/types/icon-placement.types.ts`

- [ ] **Step 1: Write tests for icon placement utilities**

Create `src/app/pages/dfd/types/icon-placement.types.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  getIconPlacementKey,
  getIconPlacementFromKey,
  ICON_PLACEMENT_ATTRS,
  ICON_VERTICAL_POSITIONS,
  ICON_HORIZONTAL_POSITIONS,
  IconPlacement,
} from './icon-placement.types';

describe('Icon Placement Types', () => {
  describe('getIconPlacementKey', () => {
    it('should create key from placement', () => {
      const placement: IconPlacement = { vertical: 'middle', horizontal: 'center' };
      expect(getIconPlacementKey(placement)).toBe('middle-center');
    });

    it('should handle all positions', () => {
      expect(getIconPlacementKey({ vertical: 'top', horizontal: 'left' })).toBe('top-left');
      expect(getIconPlacementKey({ vertical: 'bottom', horizontal: 'right' })).toBe('bottom-right');
    });
  });

  describe('getIconPlacementFromKey', () => {
    it('should parse key into placement', () => {
      expect(getIconPlacementFromKey('top-left')).toEqual({ vertical: 'top', horizontal: 'left' });
      expect(getIconPlacementFromKey('middle-center')).toEqual({ vertical: 'middle', horizontal: 'center' });
    });

    it('should return null for invalid key', () => {
      expect(getIconPlacementFromKey('invalid')).toBeNull();
      expect(getIconPlacementFromKey('')).toBeNull();
    });
  });

  describe('ICON_PLACEMENT_ATTRS', () => {
    it('should have 9 positions', () => {
      expect(Object.keys(ICON_PLACEMENT_ATTRS)).toHaveLength(9);
    });

    it('should have refX and refY for each position', () => {
      for (const attrs of Object.values(ICON_PLACEMENT_ATTRS)) {
        expect(attrs.refX).toBeDefined();
        expect(attrs.refY).toBeDefined();
      }
    });
  });

  describe('position arrays', () => {
    it('should have 3 vertical positions', () => {
      expect(ICON_VERTICAL_POSITIONS).toEqual(['top', 'middle', 'bottom']);
    });

    it('should have 3 horizontal positions', () => {
      expect(ICON_HORIZONTAL_POSITIONS).toEqual(['left', 'center', 'right']);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/app/pages/dfd/types/icon-placement.types.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create arch-icon.types.ts**

Create `src/app/pages/dfd/types/arch-icon.types.ts`:

```typescript
/**
 * Architecture Icon Types
 *
 * Data model for architecture icons displayed on DFD shapes.
 * Icons are stored in cell.data._arch and resolved to SVG asset paths.
 */

export type ArchIconProvider = 'aws' | 'azure' | 'gcp' | 'oci';
export type ArchIconType = 'services' | 'resources' | 'groups' | 'categories';

export interface ArchIconPlacement {
  vertical: 'top' | 'middle' | 'bottom';
  horizontal: 'left' | 'center' | 'right';
}

/** Stored on cell.data._arch */
export interface ArchIconData {
  provider: ArchIconProvider;
  type: ArchIconType;
  subcategory: string;
  icon: string;
  placement: ArchIconPlacement;
}

/** Single entry in the icon manifest */
export interface ArchIconManifestEntry {
  provider: string;
  type: string;
  subcategory: string;
  icon: string;
  label: string;
  tokens: string[];
}

/** Icon manifest root object */
export interface ArchIconManifest {
  icons: ArchIconManifestEntry[];
}

/** Search result grouped by subcategory */
export interface ArchIconSearchResult {
  subcategory: string;
  provider: string;
  icons: ArchIconManifestEntry[];
}

/** Default placement for newly assigned icons */
export const DEFAULT_ARCH_ICON_PLACEMENT: ArchIconPlacement = {
  vertical: 'middle',
  horizontal: 'center',
};

/** Shape types that support architecture icons */
export const ICON_ELIGIBLE_SHAPES = ['actor', 'process', 'store', 'security-boundary'] as const;

/** Shape types where border/fill hiding applies (excludes security-boundary) */
export const ICON_HIDEABLE_BORDER_SHAPES = ['actor', 'process', 'store'] as const;
```

- [ ] **Step 4: Create icon-placement.types.ts**

Create `src/app/pages/dfd/types/icon-placement.types.ts`:

```typescript
/**
 * Icon Placement Types
 *
 * Types, constants, and utilities for architecture icon positioning in DFD shapes.
 * Mirrors the label position system (label-position.types.ts) with a 3x3 grid.
 */

export type IconHorizontalPosition = 'left' | 'center' | 'right';
export type IconVerticalPosition = 'top' | 'middle' | 'bottom';

export interface IconPlacement {
  horizontal: IconHorizontalPosition;
  vertical: IconVerticalPosition;
}

export interface IconPlacementAttrs {
  refX: string;
  refY: string;
}

/**
 * Maps an icon placement key (e.g. 'middle-center') to X6 image positioning attrs.
 * Uses 15%/85% padding to keep icons from touching node boundaries.
 */
export const ICON_PLACEMENT_ATTRS: Record<string, IconPlacementAttrs> = {
  'top-left': { refX: '15%', refY: '15%' },
  'top-center': { refX: '50%', refY: '15%' },
  'top-right': { refX: '85%', refY: '15%' },
  'middle-left': { refX: '15%', refY: '50%' },
  'middle-center': { refX: '50%', refY: '50%' },
  'middle-right': { refX: '85%', refY: '50%' },
  'bottom-left': { refX: '15%', refY: '85%' },
  'bottom-center': { refX: '50%', refY: '85%' },
  'bottom-right': { refX: '85%', refY: '85%' },
};

/** All vertical positions in display order */
export const ICON_VERTICAL_POSITIONS: IconVerticalPosition[] = ['top', 'middle', 'bottom'];

/** All horizontal positions in display order */
export const ICON_HORIZONTAL_POSITIONS: IconHorizontalPosition[] = ['left', 'center', 'right'];

/** Icon size in pixels (square) */
export const ICON_SIZE = 32;

/**
 * Build a placement key from an IconPlacement.
 */
export function getIconPlacementKey(placement: IconPlacement): string {
  return `${placement.vertical}-${placement.horizontal}`;
}

/**
 * Parse a placement key (e.g. 'top-left') into an IconPlacement.
 * Returns null if the key is invalid.
 */
export function getIconPlacementFromKey(key: string): IconPlacement | null {
  if (!key || !ICON_PLACEMENT_ATTRS[key]) {
    return null;
  }
  const [vertical, horizontal] = key.split('-') as [IconVerticalPosition, IconHorizontalPosition];
  return { vertical, horizontal };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm vitest run src/app/pages/dfd/types/icon-placement.types.spec.ts
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/dfd/types/arch-icon.types.ts src/app/pages/dfd/types/icon-placement.types.ts src/app/pages/dfd/types/icon-placement.types.spec.ts
git commit -m "feat(dfd): add architecture icon and placement type definitions (#96)"
```

---

## Task 3: Architecture Icon Service

**Files:**
- Create: `src/app/pages/dfd/infrastructure/services/architecture-icon.service.ts`
- Create: `src/app/pages/dfd/infrastructure/services/architecture-icon.service.spec.ts`

- [ ] **Step 1: Write tests for the service**

Create `src/app/pages/dfd/infrastructure/services/architecture-icon.service.spec.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArchitectureIconService } from './architecture-icon.service';
import { ArchIconManifest } from '../../types/arch-icon.types';

const MOCK_MANIFEST: ArchIconManifest = {
  icons: [
    {
      provider: 'aws',
      type: 'services',
      subcategory: 'compute',
      icon: 'amazon-ec2',
      label: 'Amazon EC2',
      tokens: ['aws', 'services', 'compute', 'amazon', 'ec2'],
    },
    {
      provider: 'aws',
      type: 'services',
      subcategory: 'compute',
      icon: 'aws-lambda',
      label: 'AWS Lambda',
      tokens: ['aws', 'services', 'compute', 'lambda'],
    },
    {
      provider: 'aws',
      type: 'services',
      subcategory: 'databases',
      icon: 'amazon-elasticache',
      label: 'Amazon ElastiCache',
      tokens: ['aws', 'services', 'databases', 'amazon', 'elasticache'],
    },
    {
      provider: 'azure',
      type: 'services',
      subcategory: 'compute',
      icon: 'virtual-machines',
      label: 'Virtual Machines',
      tokens: ['azure', 'services', 'compute', 'virtual', 'machines'],
    },
    {
      provider: 'azure',
      type: 'services',
      subcategory: 'databases',
      icon: 'azure-cosmos-db',
      label: 'Azure Cosmos DB',
      tokens: ['azure', 'services', 'databases', 'cosmos', 'db'],
    },
  ],
};

describe('ArchitectureIconService', () => {
  let service: ArchitectureIconService;

  beforeEach(() => {
    // Mock fetch to return our test manifest
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_MANIFEST),
    });
    service = new ArchitectureIconService();
  });

  describe('search (before manifest loaded)', () => {
    it('should return empty array before manifest is loaded', () => {
      expect(service.search('aws')).toEqual([]);
    });
  });

  describe('search (after manifest loaded)', () => {
    beforeEach(async () => {
      await service.loadManifest();
    });

    it('should return empty array for empty query', () => {
      expect(service.search('')).toEqual([]);
      expect(service.search('   ')).toEqual([]);
    });

    it('should match single token', () => {
      const results = service.search('aws');
      expect(results).toHaveLength(2); // compute and databases subcategories
      const allIcons = results.flatMap(r => r.icons);
      expect(allIcons).toHaveLength(3);
    });

    it('should match multiple tokens with AND logic', () => {
      const results = service.search('aws ec2');
      const allIcons = results.flatMap(r => r.icons);
      expect(allIcons).toHaveLength(1);
      expect(allIcons[0].icon).toBe('amazon-ec2');
    });

    it('should be case-insensitive', () => {
      const results = service.search('AWS EC2');
      const allIcons = results.flatMap(r => r.icons);
      expect(allIcons).toHaveLength(1);
      expect(allIcons[0].icon).toBe('amazon-ec2');
    });

    it('should match with token order independence', () => {
      const results1 = service.search('ec2 aws');
      const results2 = service.search('aws ec2');
      expect(results1).toEqual(results2);
    });

    it('should use prefix matching', () => {
      const results = service.search('aws e');
      const allIcons = results.flatMap(r => r.icons);
      // Should match ec2 (prefix 'e' on 'ec2') and elasticache (prefix 'e' on 'elasticache')
      expect(allIcons).toHaveLength(2);
    });

    it('should group results by subcategory', () => {
      const results = service.search('aws');
      expect(results[0].subcategory).toBe('compute');
      expect(results[0].provider).toBe('aws');
      expect(results[1].subcategory).toBe('databases');
    });

    it('should sort subcategories alphabetically', () => {
      const results = service.search('aws');
      const subcategories = results.map(r => r.subcategory);
      expect(subcategories).toEqual([...subcategories].sort());
    });

    it('should match across providers', () => {
      const results = service.search('compute');
      expect(results).toHaveLength(2); // aws/compute and azure/compute
    });

    it('should return no results for non-matching query', () => {
      expect(service.search('nonexistent')).toEqual([]);
    });
  });

  describe('getIconPath', () => {
    it('should resolve asset path from arch data', () => {
      const path = service.getIconPath({
        provider: 'aws',
        type: 'services',
        subcategory: 'compute',
        icon: 'amazon-ec2',
        placement: { vertical: 'middle', horizontal: 'center' },
      });
      expect(path).toBe('assets/architecture-icons/aws/services/compute/amazon-ec2.svg');
    });
  });

  describe('getIconBreadcrumb', () => {
    it('should return formatted breadcrumb', () => {
      const breadcrumb = service.getIconBreadcrumb({
        provider: 'aws',
        type: 'services',
        subcategory: 'compute',
        icon: 'amazon-ec2',
        placement: { vertical: 'middle', horizontal: 'center' },
      });
      expect(breadcrumb).toBe('AWS · Services · Compute');
    });
  });

  describe('getIconLabel', () => {
    beforeEach(async () => {
      await service.loadManifest();
    });

    it('should return label from manifest when found', () => {
      const label = service.getIconLabel({
        provider: 'aws',
        type: 'services',
        subcategory: 'compute',
        icon: 'amazon-ec2',
        placement: { vertical: 'middle', horizontal: 'center' },
      });
      expect(label).toBe('Amazon EC2');
    });

    it('should fallback to humanized filename when not in manifest', () => {
      const label = service.getIconLabel({
        provider: 'aws',
        type: 'services',
        subcategory: 'compute',
        icon: 'unknown-service',
        placement: { vertical: 'middle', horizontal: 'center' },
      });
      expect(label).toBe('Unknown Service');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run src/app/pages/dfd/infrastructure/services/architecture-icon.service.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

Create `src/app/pages/dfd/infrastructure/services/architecture-icon.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import {
  ArchIconData,
  ArchIconManifest,
  ArchIconManifestEntry,
  ArchIconSearchResult,
} from '../../types/arch-icon.types';

@Injectable({ providedIn: 'root' })
export class ArchitectureIconService {
  private manifest: ArchIconManifestEntry[] = [];
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;

  /**
   * Load the icon manifest. Lazy, cached — safe to call multiple times.
   */
  async loadManifest(): Promise<void> {
    if (this.loaded) return;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = this._doLoad();
    return this.loadingPromise;
  }

  private async _doLoad(): Promise<void> {
    const response = await fetch('assets/architecture-icons/manifest.json');
    if (!response.ok) {
      throw new Error(`Failed to load icon manifest: ${response.status}`);
    }
    const data: ArchIconManifest = await response.json();
    this.manifest = data.icons;
    this.loaded = true;
  }

  /**
   * Search icons by multi-token prefix matching.
   * Returns results grouped by subcategory, sorted alphabetically.
   * Returns empty array if query is empty or manifest not loaded.
   */
  search(query: string): ArchIconSearchResult[] {
    const trimmed = query.trim();
    if (!trimmed || !this.loaded) return [];

    const queryTokens = trimmed.toLowerCase().split(/\s+/);

    const matches = this.manifest.filter(entry =>
      queryTokens.every(qt =>
        entry.tokens.some(et => et.startsWith(qt))
      )
    );

    // Group by provider + subcategory
    const groups = new Map<string, ArchIconSearchResult>();
    for (const icon of matches) {
      const key = `${icon.provider}/${icon.subcategory}`;
      if (!groups.has(key)) {
        groups.set(key, { subcategory: icon.subcategory, provider: icon.provider, icons: [] });
      }
      groups.get(key)!.icons.push(icon);
    }

    // Sort groups alphabetically by subcategory, then icons by label within each group
    const results = Array.from(groups.values()).sort((a, b) =>
      `${a.provider}/${a.subcategory}`.localeCompare(`${b.provider}/${b.subcategory}`)
    );
    for (const group of results) {
      group.icons.sort((a, b) => a.label.localeCompare(b.label));
    }

    return results;
  }

  /**
   * Resolve the SVG asset path for an architecture icon.
   */
  getIconPath(arch: ArchIconData): string {
    return `assets/architecture-icons/${arch.provider}/${arch.type}/${arch.subcategory}/${arch.icon}.svg`;
  }

  /**
   * Get the display label for an icon.
   * Looks up the manifest first, falls back to humanizing the filename.
   */
  getIconLabel(arch: ArchIconData): string {
    const entry = this.manifest.find(
      e => e.provider === arch.provider && e.icon === arch.icon
    );
    if (entry) return entry.label;
    return this._humanizeFilename(arch.icon);
  }

  /**
   * Get a breadcrumb string for an icon, e.g. "AWS · Services · Compute"
   */
  getIconBreadcrumb(arch: ArchIconData): string {
    const capitalize = (s: string): string =>
      s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `${arch.provider.toUpperCase()} · ${capitalize(arch.type)} · ${capitalize(arch.subcategory)}`;
  }

  private _humanizeFilename(filename: string): string {
    return filename
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm vitest run src/app/pages/dfd/infrastructure/services/architecture-icon.service.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/dfd/infrastructure/services/architecture-icon.service.ts src/app/pages/dfd/infrastructure/services/architecture-icon.service.spec.ts
git commit -m "feat(dfd): add architecture icon service with search (#96)"
```

---

## Task 4: Add `<image>` Element to Shape Markup

**Files:**
- Modify: `src/app/pages/dfd/infrastructure/adapters/infra-x6-shape-definitions.ts`

- [ ] **Step 1: Add image element to actor shape markup**

In `src/app/pages/dfd/infrastructure/adapters/infra-x6-shape-definitions.ts`, find the actor shape markup at line ~146 and add the image element between body and text:

```typescript
      markup: [
        {
          tagName: 'rect',
          selector: 'body',
        },
        {
          tagName: 'image',
          selector: 'icon',
        },
        {
          tagName: 'text',
          selector: 'text',
        },
      ],
```

- [ ] **Step 2: Add image element to process shape markup**

Find the process shape markup at line ~182 and add the same `{ tagName: 'image', selector: 'icon' }` element between body and text.

- [ ] **Step 3: Add image element to store shape markup**

Find the store shape markup at line ~24. The store has `path` (body), `ellipse` (top), and `text`. Add the image element between `top` and `text`:

```typescript
      markup: [
        {
          tagName: 'path',
          selector: 'body',
        },
        {
          tagName: 'ellipse',
          selector: 'top',
        },
        {
          tagName: 'image',
          selector: 'icon',
        },
        {
          tagName: 'text',
          selector: 'text',
        },
      ],
```

- [ ] **Step 4: Add image element to security-boundary shape markup**

Find the security-boundary shape markup at line ~218 and add `{ tagName: 'image', selector: 'icon' }` between body and text.

- [ ] **Step 5: Add image element to text-box shape markup**

Find the text-box shape markup at line ~273 and add `{ tagName: 'image', selector: 'icon' }` between body and text. (For markup consistency — icons are never set on text-boxes.)

- [ ] **Step 6: Run build to verify no regressions**

```bash
pnpm run build
```

Expected: build succeeds.

- [ ] **Step 7: Run existing tests to verify no regressions**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/dfd/infrastructure/adapters/infra-x6-shape-definitions.ts
git commit -m "feat(dfd): add image element to shape markup for icon rendering (#96)"
```

---

## Task 5: User Preference for Shape Borders

**Files:**
- Modify: `src/app/core/services/user-preferences.service.ts`
- Modify: `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts` (inline template)
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add property to UserPreferencesData interface**

In `src/app/core/services/user-preferences.service.ts`, add `showShapeBordersWithIcons` to the `UserPreferencesData` interface (after `hoverShowMetadata` at line ~19):

```typescript
export interface UserPreferencesData {
  animations: boolean;
  themeMode: ThemeMode;
  colorBlindMode: boolean;
  showDeveloperTools: boolean;
  dashboardListView: boolean;
  hoverShowMetadata: boolean;
  showShapeBordersWithIcons: boolean;
  pageSize: 'usLetter' | 'A4';
  marginSize: 'narrow' | 'standard' | 'wide';
}
```

- [ ] **Step 2: Add default value**

In `DEFAULT_PREFERENCES` (line ~34), add:

```typescript
const DEFAULT_PREFERENCES: UserPreferencesData = {
  animations: true,
  themeMode: 'automatic',
  colorBlindMode: false,
  showDeveloperTools: false,
  dashboardListView: false,
  hoverShowMetadata: false,
  showShapeBordersWithIcons: true,
  pageSize: 'usLetter',
  marginSize: 'standard',
};
```

- [ ] **Step 3: Add checkbox to user preferences dialog**

In `src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts`, find the Display tab's Diagram Editor section. After the hover metadata checkbox (line ~228), add:

```html
            <div class="preference-item">
              <mat-checkbox
                [(ngModel)]="preferences.showShapeBordersWithIcons"
                (change)="onShowShapeBordersWithIconsChange($event)"
              >
                <span [transloco]="'userPreferences.showShapeBordersWithIcons'">
                  Show shape fill and border when icon is displayed
                </span>
              </mat-checkbox>
            </div>
```

- [ ] **Step 4: Add change handler method**

In the component class, add the handler method (follow the pattern of existing handlers like `onHoverShowMetadataChange`):

```typescript
onShowShapeBordersWithIconsChange(event: any): void {
  this.userPreferencesService.updatePreferences({
    showShapeBordersWithIcons: this.preferences.showShapeBordersWithIcons,
  });
}
```

- [ ] **Step 5: Add i18n key**

In `src/assets/i18n/en-US.json`, find the `userPreferences` section and add near the existing display keys:

```json
"showShapeBordersWithIcons": "Show shape fill and border when icon is displayed"
```

- [ ] **Step 6: Run build and tests**

```bash
pnpm run build && pnpm test
```

Expected: build succeeds, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/core/services/user-preferences.service.ts src/app/core/components/user-preferences-dialog/user-preferences-dialog.component.ts src/assets/i18n/en-US.json
git commit -m "feat(prefs): add shape border with icons preference (#96)"
```

---

## Task 6: Icon Picker Panel Component

**Files:**
- Create: `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.ts`
- Create: `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.html`
- Create: `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.scss`
- Create: `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.spec.ts`
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add i18n keys**

In `src/assets/i18n/en-US.json`, add the icon picker keys inside the `dfd` section:

```json
"iconPicker": {
  "title": "Architecture Icon",
  "searchPlaceholder": "Search by provider, service, or category...",
  "searchToChange": "Search to change icon...",
  "emptyStatePrompt": "Type to search across all providers",
  "emptyStateTryExamples": "Try: aws ec2, azure sql, gcp compute",
  "statusMatches": "{count} matches",
  "statusAvailable": "{count} icons available",
  "statusShapesSelected": "{count} shape(s) selected",
  "placement": "Placement",
  "remove": "Remove",
  "notAvailable": "Icons not available for this shape",
  "selectShape": "Select a shape first",
  "toolbarTooltip": "Architecture Icon"
}
```

- [ ] **Step 2: Write tests for the icon picker panel**

Create `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.spec.ts`:

```typescript
import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IconPickerPanelComponent, IconPickerCellInfo } from './icon-picker-panel.component';
import { ChangeDetectorRef, SimpleChange } from '@angular/core';
import { ArchitectureIconService } from '../../../infrastructure/services/architecture-icon.service';
import { ArchIconData } from '../../../types/arch-icon.types';

describe('IconPickerPanelComponent', () => {
  let component: IconPickerPanelComponent;
  let mockCdr: ChangeDetectorRef;
  let mockIconService: ArchitectureIconService;

  beforeEach(() => {
    mockCdr = { markForCheck: vi.fn(), detectChanges: vi.fn() } as unknown as ChangeDetectorRef;
    mockIconService = {
      loadManifest: vi.fn().mockResolvedValue(undefined),
      search: vi.fn().mockReturnValue([]),
      getIconPath: vi.fn().mockReturnValue('assets/architecture-icons/aws/services/compute/amazon-ec2.svg'),
      getIconLabel: vi.fn().mockReturnValue('Amazon EC2'),
      getIconBreadcrumb: vi.fn().mockReturnValue('AWS · Services · Compute'),
    } as unknown as ArchitectureIconService;
    component = new IconPickerPanelComponent(mockCdr, mockIconService);
  });

  function makeCell(overrides: Partial<IconPickerCellInfo> = {}): IconPickerCellInfo {
    return {
      cellId: 'node-1',
      nodeType: 'process',
      arch: null,
      ...overrides,
    };
  }

  describe('eligibility', () => {
    it('should be eligible for actor shapes', () => {
      component.selectedCells = [makeCell({ nodeType: 'actor' })];
      component.ngOnChanges({ selectedCells: new SimpleChange([], component.selectedCells, false) });
      expect(component.isEligible).toBe(true);
    });

    it('should be eligible for process shapes', () => {
      component.selectedCells = [makeCell({ nodeType: 'process' })];
      component.ngOnChanges({ selectedCells: new SimpleChange([], component.selectedCells, false) });
      expect(component.isEligible).toBe(true);
    });

    it('should be eligible for store shapes', () => {
      component.selectedCells = [makeCell({ nodeType: 'store' })];
      component.ngOnChanges({ selectedCells: new SimpleChange([], component.selectedCells, false) });
      expect(component.isEligible).toBe(true);
    });

    it('should be eligible for security-boundary shapes', () => {
      component.selectedCells = [makeCell({ nodeType: 'security-boundary' })];
      component.ngOnChanges({ selectedCells: new SimpleChange([], component.selectedCells, false) });
      expect(component.isEligible).toBe(true);
    });

    it('should not be eligible for text-box shapes', () => {
      component.selectedCells = [makeCell({ nodeType: 'text-box' })];
      component.ngOnChanges({ selectedCells: new SimpleChange([], component.selectedCells, false) });
      expect(component.isEligible).toBe(false);
    });

    it('should not be eligible when no cells selected', () => {
      component.selectedCells = [];
      component.ngOnChanges({ selectedCells: new SimpleChange([], [], false) });
      expect(component.isEligible).toBe(false);
    });
  });

  describe('current icon', () => {
    it('should show current icon when cell has _arch data', () => {
      const arch: ArchIconData = {
        provider: 'aws', type: 'services', subcategory: 'compute',
        icon: 'amazon-ec2', placement: { vertical: 'middle', horizontal: 'center' },
      };
      component.selectedCells = [makeCell({ arch })];
      component.ngOnChanges({ selectedCells: new SimpleChange([], component.selectedCells, false) });
      expect(component.currentArch).toEqual(arch);
    });

    it('should show no icon when cell has no _arch data', () => {
      component.selectedCells = [makeCell({ arch: null })];
      component.ngOnChanges({ selectedCells: new SimpleChange([], component.selectedCells, false) });
      expect(component.currentArch).toBeNull();
    });
  });

  describe('search', () => {
    it('should call service search on query change', () => {
      component.onSearchInput('aws ec2');
      expect(mockIconService.search).toHaveBeenCalledWith('aws ec2');
    });

    it('should not search for empty query', () => {
      component.onSearchInput('');
      expect(component.searchResults).toEqual([]);
    });
  });

  describe('icon selection', () => {
    it('should emit iconSelected with arch data and default placement', () => {
      const spy = vi.spyOn(component.iconSelected, 'emit');
      const entry = {
        provider: 'aws', type: 'services', subcategory: 'compute',
        icon: 'amazon-ec2', label: 'Amazon EC2', tokens: [],
      };
      component.selectedCells = [makeCell()];
      component.ngOnChanges({ selectedCells: new SimpleChange([], component.selectedCells, false) });
      component.onIconClick(entry);
      expect(spy).toHaveBeenCalledWith({
        arch: {
          provider: 'aws', type: 'services', subcategory: 'compute',
          icon: 'amazon-ec2',
          placement: { vertical: 'middle', horizontal: 'center' },
        },
        cellIds: ['node-1'],
      });
    });
  });

  describe('icon removal', () => {
    it('should emit iconRemoved with cell IDs', () => {
      const spy = vi.spyOn(component.iconRemoved, 'emit');
      component.selectedCells = [makeCell()];
      component.ngOnChanges({ selectedCells: new SimpleChange([], component.selectedCells, false) });
      component.onRemoveIcon();
      expect(spy).toHaveBeenCalledWith({ cellIds: ['node-1'] });
    });
  });

  describe('placement change', () => {
    it('should emit placementChanged with new placement', () => {
      const spy = vi.spyOn(component.placementChanged, 'emit');
      component.selectedCells = [makeCell()];
      component.ngOnChanges({ selectedCells: new SimpleChange([], component.selectedCells, false) });
      component.onPlacementClick('top', 'left');
      expect(spy).toHaveBeenCalledWith({
        placement: { vertical: 'top', horizontal: 'left' },
        cellIds: ['node-1'],
      });
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
pnpm vitest run src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.spec.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Create the component TypeScript file**

Create `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.ts`:

```typescript
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CdkDrag, CdkDragHandle } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';

import { ArchitectureIconService } from '../../../infrastructure/services/architecture-icon.service';
import {
  ArchIconData,
  ArchIconManifestEntry,
  ArchIconSearchResult,
  DEFAULT_ARCH_ICON_PLACEMENT,
  ICON_ELIGIBLE_SHAPES,
} from '../../../types/arch-icon.types';
import {
  ICON_VERTICAL_POSITIONS,
  ICON_HORIZONTAL_POSITIONS,
  getIconPlacementKey,
} from '../../../types/icon-placement.types';

export interface IconPickerCellInfo {
  cellId: string;
  nodeType: string | null;
  arch: ArchIconData | null;
}

export interface IconSelectedEvent {
  arch: ArchIconData;
  cellIds: string[];
}

export interface IconRemovedEvent {
  cellIds: string[];
}

export interface PlacementChangedEvent {
  placement: { vertical: string; horizontal: string };
  cellIds: string[];
}

@Component({
  selector: 'app-icon-picker-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkDrag,
    CdkDragHandle,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoModule,
  ],
  templateUrl: './icon-picker-panel.component.html',
  styleUrl: './icon-picker-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconPickerPanelComponent implements OnChanges, OnInit {
  @Input() selectedCells: IconPickerCellInfo[] = [];
  @Input() disabled = false;

  @Output() iconSelected = new EventEmitter<IconSelectedEvent>();
  @Output() iconRemoved = new EventEmitter<IconRemovedEvent>();
  @Output() placementChanged = new EventEmitter<PlacementChangedEvent>();

  searchQuery = '';
  searchResults: ArchIconSearchResult[] = [];
  currentArch: ArchIconData | null = null;
  isEligible = false;
  hasSelection = false;
  collapsedGroups = new Set<string>();

  readonly verticalPositions = ICON_VERTICAL_POSITIONS;
  readonly horizontalPositions = ICON_HORIZONTAL_POSITIONS;

  private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly cdr: ChangeDetectorRef,
    private readonly iconService: ArchitectureIconService,
  ) {}

  ngOnInit(): void {
    this.iconService.loadManifest().then(() => {
      this.cdr.markForCheck();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedCells']) {
      this.updateFromSelection();
    }
  }

  private updateFromSelection(): void {
    this.hasSelection = this.selectedCells.length > 0;
    const eligibleCells = this.selectedCells.filter(c =>
      c.nodeType && (ICON_ELIGIBLE_SHAPES as readonly string[]).includes(c.nodeType)
    );
    this.isEligible = eligibleCells.length > 0;

    if (this.isEligible && eligibleCells[0]?.arch) {
      this.currentArch = eligibleCells[0].arch;
    } else {
      this.currentArch = null;
    }
    this.cdr.markForCheck();
  }

  get eligibleCellIds(): string[] {
    return this.selectedCells
      .filter(c => c.nodeType && (ICON_ELIGIBLE_SHAPES as readonly string[]).includes(c.nodeType))
      .map(c => c.cellId);
  }

  get currentIconPath(): string | null {
    return this.currentArch ? this.iconService.getIconPath(this.currentArch) : null;
  }

  get currentIconLabel(): string | null {
    return this.currentArch ? this.iconService.getIconLabel(this.currentArch) : null;
  }

  get currentIconBreadcrumb(): string | null {
    return this.currentArch ? this.iconService.getIconBreadcrumb(this.currentArch) : null;
  }

  get matchCount(): number {
    return this.searchResults.reduce((sum, r) => sum + r.icons.length, 0);
  }

  onSearchInput(query: string): void {
    this.searchQuery = query;
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
    }
    if (!query.trim()) {
      this.searchResults = [];
      this.cdr.markForCheck();
      return;
    }
    this.searchDebounceTimer = setTimeout(() => {
      this.searchResults = this.iconService.search(query);
      this.cdr.markForCheck();
    }, 150);
  }

  onIconClick(entry: ArchIconManifestEntry): void {
    const cellIds = this.eligibleCellIds;
    if (cellIds.length === 0) return;

    const placement = this.currentArch?.placement ?? DEFAULT_ARCH_ICON_PLACEMENT;
    const arch: ArchIconData = {
      provider: entry.provider as ArchIconData['provider'],
      type: entry.type as ArchIconData['type'],
      subcategory: entry.subcategory,
      icon: entry.icon,
      placement,
    };
    this.iconSelected.emit({ arch, cellIds });
  }

  onRemoveIcon(): void {
    const cellIds = this.eligibleCellIds;
    if (cellIds.length === 0) return;
    this.iconRemoved.emit({ cellIds });
  }

  onPlacementClick(vertical: string, horizontal: string): void {
    const cellIds = this.eligibleCellIds;
    if (cellIds.length === 0) return;
    this.placementChanged.emit({ placement: { vertical, horizontal }, cellIds });
  }

  isActivePlacement(vertical: string, horizontal: string): boolean {
    if (!this.currentArch) return false;
    return (
      this.currentArch.placement.vertical === vertical &&
      this.currentArch.placement.horizontal === horizontal
    );
  }

  toggleGroup(groupKey: string): void {
    if (this.collapsedGroups.has(groupKey)) {
      this.collapsedGroups.delete(groupKey);
    } else {
      this.collapsedGroups.add(groupKey);
    }
  }

  isGroupCollapsed(groupKey: string): boolean {
    return this.collapsedGroups.has(groupKey);
  }

  getIconPath(entry: ArchIconManifestEntry): string {
    return this.iconService.getIconPath({
      provider: entry.provider as ArchIconData['provider'],
      type: entry.type as ArchIconData['type'],
      subcategory: entry.subcategory,
      icon: entry.icon,
      placement: DEFAULT_ARCH_ICON_PLACEMENT,
    });
  }
}
```

- [ ] **Step 5: Create the component template**

Create `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.html`:

```html
<div class="icon-picker-panel" cdkDrag cdkDragBoundary=".dfd-container">
  <div class="panel-header" cdkDragHandle>
    <mat-icon class="drag-handle-icon">drag_indicator</mat-icon>
    <span class="panel-title">{{ 'dfd.iconPicker.title' | transloco }}</span>
  </div>

  <div class="panel-body">
    @if (!hasSelection) {
      <div class="status-hint">
        {{ 'dfd.iconPicker.selectShape' | transloco }}
      </div>
    } @else if (!isEligible) {
      <div class="status-hint">
        {{ 'dfd.iconPicker.notAvailable' | transloco }}
      </div>
    } @else {
      <!-- Current icon section -->
      @if (currentArch) {
        <div class="current-icon-section">
          <div class="current-icon-row">
            <img
              [src]="currentIconPath"
              [alt]="currentIconLabel"
              class="current-icon-preview"
            />
            <div class="current-icon-info">
              <div class="current-icon-label">{{ currentIconLabel }}</div>
              <div class="current-icon-breadcrumb">{{ currentIconBreadcrumb }}</div>
            </div>
            <button
              mat-stroked-button
              color="warn"
              class="remove-button"
              (click)="onRemoveIcon()"
            >
              {{ 'dfd.iconPicker.remove' | transloco }}
            </button>
          </div>

          <!-- Placement grid -->
          <div class="placement-section">
            <span class="placement-label">{{ 'dfd.iconPicker.placement' | transloco }}</span>
            <div class="placement-grid">
              @for (v of verticalPositions; track v) {
                @for (h of horizontalPositions; track h) {
                  <button
                    class="placement-cell"
                    [class.active]="isActivePlacement(v, h)"
                    (click)="onPlacementClick(v, h)"
                  >
                    <span class="placement-dot"></span>
                  </button>
                }
              }
            </div>
          </div>
        </div>
      }

      <!-- Search -->
      <div class="search-section">
        <input
          type="text"
          class="search-input"
          [placeholder]="'dfd.iconPicker.searchPlaceholder' | transloco"
          [value]="searchQuery"
          (input)="onSearchInput($any($event.target).value)"
        />
      </div>

      <!-- Results -->
      @if (searchQuery.trim() && searchResults.length > 0) {
        <div class="results-section">
          @for (group of searchResults; track group.provider + '/' + group.subcategory) {
            <div class="subcategory-group">
              <button
                class="subcategory-header"
                (click)="toggleGroup(group.provider + '/' + group.subcategory)"
              >
                <span class="collapse-indicator">
                  {{ isGroupCollapsed(group.provider + '/' + group.subcategory) ? '▸' : '▾' }}
                </span>
                <span class="subcategory-name">{{ group.subcategory }}</span>
                <span class="subcategory-count">({{ group.icons.length }})</span>
              </button>

              @if (!isGroupCollapsed(group.provider + '/' + group.subcategory)) {
                <div class="icon-grid">
                  @for (icon of group.icons; track icon.icon) {
                    <button
                      class="icon-cell"
                      [class.selected]="currentArch?.icon === icon.icon && currentArch?.provider === icon.provider"
                      [matTooltip]="icon.label"
                      (click)="onIconClick(icon)"
                    >
                      <img [src]="getIconPath(icon)" [alt]="icon.label" class="icon-image" />
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>
      } @else if (searchQuery.trim() && searchResults.length === 0) {
        <div class="empty-results">
          {{ 'dfd.iconPicker.emptyStatePrompt' | transloco }}
        </div>
      } @else {
        <!-- Empty search state -->
        <div class="empty-search-state">
          <div class="empty-search-icon">🔍</div>
          <div class="empty-search-text">
            {{ 'dfd.iconPicker.emptyStatePrompt' | transloco }}
          </div>
          <div class="empty-search-examples">
            <code>aws ec2</code>
            <code>azure sql</code>
            <code>gcp compute</code>
          </div>
        </div>
      }
    }
  </div>

  <!-- Status bar -->
  <div class="panel-footer">
    @if (searchQuery.trim() && searchResults.length > 0) {
      <span>{{ matchCount }} matches</span>
    } @else {
      <span>{{ 'dfd.iconPicker.statusAvailable' | transloco: { count: 1849 } }}</span>
    }
    @if (hasSelection) {
      <span>·</span>
      <span>{{ eligibleCellIds.length }} shape(s) selected</span>
    }
  </div>
</div>
```

- [ ] **Step 6: Create the component styles**

Create `src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.scss`:

```scss
.icon-picker-panel {
  position: absolute;
  top: 60px;
  right: 290px;
  width: 340px;
  background-color: var(--color-background-white);
  border: 1px solid var(--color-border-light);
  border-radius: 8px;
  box-shadow: 0 4px 12px var(--color-shadow-medium);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  background-color: var(--color-background-lighter);
  border-bottom: 1px solid var(--color-border-light);
  cursor: grab;
  user-select: none;

  &:active {
    cursor: grabbing;
  }
}

.drag-handle-icon {
  font-size: 18px;
  width: 18px;
  height: 18px;
  color: var(--color-text-muted);
}

.panel-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.panel-body {
  padding: 8px;
  overflow-y: auto;
  max-height: 500px;
}

.status-hint {
  text-align: center;
  padding: 16px 8px;
  color: var(--color-text-muted);
  font-size: 12px;
}

// Current icon section
.current-icon-section {
  padding: 8px;
  background-color: var(--color-background-lighter);
  border-radius: 6px;
  margin-bottom: 8px;
}

.current-icon-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.current-icon-preview {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  background: var(--color-background-white);
  border: 1px solid var(--color-border-light);
  padding: 4px;
  object-fit: contain;
}

.current-icon-info {
  flex: 1;
  min-width: 0;
}

.current-icon-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-icon-breadcrumb {
  font-size: 11px;
  color: var(--color-text-muted);
}

.remove-button {
  font-size: 11px;
  padding: 2px 8px;
  min-width: auto;
  line-height: 1.6;
}

// Placement grid
.placement-section {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}

.placement-label {
  font-size: 11px;
  color: var(--color-text-muted);
  font-weight: 600;
}

.placement-grid {
  display: inline-grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  background: var(--color-border-light);
  padding: 2px;
  border-radius: 5px;
}

.placement-cell {
  width: 24px;
  height: 24px;
  background: var(--color-background-white);
  border: none;
  border-radius: 3px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  &:hover {
    background: var(--color-background-lighter);
  }

  &.active {
    background: var(--mat-sys-primary);

    .placement-dot {
      background: white;
    }
  }
}

.placement-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

// Search
.search-section {
  margin-bottom: 8px;
}

.search-input {
  width: 100%;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid var(--color-border-light);
  font-size: 13px;
  box-sizing: border-box;
  background: var(--color-background-white);
  color: var(--color-text-primary);

  &:focus {
    outline: none;
    border-color: var(--mat-sys-primary);
    box-shadow: 0 0 0 2px rgba(var(--mat-sys-primary-rgb, 74, 144, 217), 0.2);
  }
}

// Results
.results-section {
  max-height: 300px;
  overflow-y: auto;
}

.subcategory-header {
  display: flex;
  align-items: center;
  gap: 4px;
  width: 100%;
  border: none;
  background: none;
  padding: 4px 0;
  cursor: pointer;
  font-size: 11px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 600;
}

.collapse-indicator {
  font-size: 10px;
}

.subcategory-count {
  font-weight: 400;
  opacity: 0.6;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 10px;
}

.icon-cell {
  aspect-ratio: 1;
  background: var(--color-background-lighter);
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;

  &:hover {
    background: var(--color-background-white);
    border-color: var(--color-border-light);
  }

  &.selected {
    background: rgba(var(--mat-sys-primary-rgb, 74, 144, 217), 0.1);
    border-color: var(--mat-sys-primary);
  }
}

.icon-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

// Empty states
.empty-search-state {
  text-align: center;
  padding: 20px 8px;
}

.empty-search-icon {
  font-size: 28px;
  opacity: 0.3;
  margin-bottom: 8px;
}

.empty-search-text {
  color: var(--color-text-muted);
  font-size: 13px;
  margin-bottom: 8px;
}

.empty-search-examples {
  display: flex;
  gap: 6px;
  justify-content: center;
  flex-wrap: wrap;

  code {
    background: var(--color-background-lighter);
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 11px;
    color: var(--color-text-muted);
  }
}

.empty-results {
  text-align: center;
  padding: 16px 8px;
  color: var(--color-text-muted);
  font-size: 12px;
}

// Footer
.panel-footer {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  background: var(--color-background-lighter);
  border-top: 1px solid var(--color-border-light);
  font-size: 11px;
  color: var(--color-text-muted);
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
pnpm vitest run src/app/pages/dfd/presentation/components/icon-picker-panel/icon-picker-panel.component.spec.ts
```

Expected: all tests PASS.

- [ ] **Step 8: Run build to verify**

```bash
pnpm run build
```

Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/dfd/presentation/components/icon-picker-panel/ src/assets/i18n/en-US.json
git commit -m "feat(dfd): add icon picker panel component (#96)"
```

---

## Task 7: Wire Icon Picker into DFD Editor

**Files:**
- Modify: `src/app/pages/dfd/presentation/components/dfd.component.ts`
- Modify: `src/app/pages/dfd/presentation/components/dfd.component.html`

- [ ] **Step 1: Add toolbar button for icon picker**

In `src/app/pages/dfd/presentation/components/dfd.component.html`, after the style panel toggle button (line ~145), add:

```html
      <button
        mat-icon-button
        (click)="toggleIconPickerPanel()"
        [disabled]="isReadOnlyMode || !isSystemInitialized"
        [matTooltip]="'dfd.iconPicker.toolbarTooltip' | transloco"
        [class.active-toggle]="isIconPickerPanelOpen"
      >
        <mat-icon>category</mat-icon>
      </button>
```

- [ ] **Step 2: Add icon picker panel element to template**

Find where the style panel element is rendered in the template (look for `<app-style-panel`). After it, add:

```html
    @if (isIconPickerPanelOpen) {
      <app-icon-picker-panel
        [selectedCells]="iconPickerCells"
        [disabled]="isReadOnlyMode"
        (iconSelected)="onIconSelected($event)"
        (iconRemoved)="onIconRemoved($event)"
        (placementChanged)="onIconPlacementChanged($event)"
      />
    }
```

- [ ] **Step 3: Add component properties and imports**

In `src/app/pages/dfd/presentation/components/dfd.component.ts`, add:

1. Import the icon picker panel component and its event types
2. Import `ArchitectureIconService`, `ArchIconData`, `ICON_ELIGIBLE_SHAPES`, `ICON_HIDEABLE_BORDER_SHAPES`
3. Import `ICON_PLACEMENT_ATTRS`, `getIconPlacementKey`
4. Add `IconPickerPanelComponent` to the component's `imports` array
5. Add properties:

```typescript
isIconPickerPanelOpen = false;
iconPickerCells: IconPickerCellInfo[] = [];
```

6. Inject `ArchitectureIconService` and `UserPreferencesService` in the constructor (if not already injected).

- [ ] **Step 4: Add toggle method**

```typescript
toggleIconPickerPanel(): void {
  this.isIconPickerPanelOpen = !this.isIconPickerPanelOpen;
  if (this.isIconPickerPanelOpen) {
    this.updateIconPickerCells();
  }
  this.cdr.detectChanges();
}
```

- [ ] **Step 5: Add updateIconPickerCells method**

This method builds `IconPickerCellInfo[]` from the current selection, similar to `updateStylePanelCells`:

```typescript
private updateIconPickerCells(): void {
  const selectedCellIds = this.appDfdOrchestrator.getSelectedCells();
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) {
    this.iconPickerCells = [];
    return;
  }

  this.iconPickerCells = selectedCellIds
    .map(id => graph.getCellById(id))
    .filter(cell => cell?.isNode())
    .map(cell => ({
      cellId: cell!.id,
      nodeType: cell!.shape,
      arch: (cell!.getData()?._arch as ArchIconData) ?? null,
    }));
}
```

Call `updateIconPickerCells()` wherever `updateStylePanelCells()` is called (selection change handlers).

- [ ] **Step 6: Add icon event handlers**

```typescript
onIconSelected(event: IconSelectedEvent): void {
  if (this.isReadOnlyMode) return;
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) return;

  for (const cellId of event.cellIds) {
    const cell = graph.getCellById(cellId);
    if (!cell || !cell.isNode()) continue;

    const previousData = cell.getData() ?? {};
    const newData = { ...previousData, _arch: event.arch };
    cell.setData(newData, { silent: true });

    // Apply icon to the <image> element
    this.applyIconToCell(cell, event.arch);

    // Apply border preference
    this.applyBorderPreference(cell, event.arch);

    const operation = {
      id: `icon-set-${Date.now()}-${cellId}`,
      type: 'update-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      nodeId: cellId,
      updates: { properties: { _arch: event.arch } },
      previousState: { properties: { _arch: previousData._arch ?? null } },
      includeInHistory: true,
    };
    this.appDfdOrchestrator.executeOperation(operation as any).subscribe();
  }

  this.updateIconPickerCells();
  this.cdr.detectChanges();
}

onIconRemoved(event: IconRemovedEvent): void {
  if (this.isReadOnlyMode) return;
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) return;

  for (const cellId of event.cellIds) {
    const cell = graph.getCellById(cellId);
    if (!cell || !cell.isNode()) continue;

    const previousData = cell.getData() ?? {};
    const { _arch, ...restData } = previousData;
    cell.setData(restData, { silent: true });

    // Clear icon from <image> element
    cell.setAttrByPath('icon/href', null);

    // Restore label position if it was shifted for centered icon
    const previousArch = previousData._arch as ArchIconData | undefined;
    if (
      previousArch?.placement.vertical === 'middle' &&
      previousArch?.placement.horizontal === 'center' &&
      cell.shape !== 'security-boundary'
    ) {
      cell.setAttrByPath('text/refY', '50%');
      cell.setAttrByPath('text/textVerticalAnchor', 'middle');
    }

    // Restore border
    this.restoreBorder(cell);

    const operation = {
      id: `icon-remove-${Date.now()}-${cellId}`,
      type: 'update-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      nodeId: cellId,
      updates: { properties: { _arch: null } },
      previousState: { properties: { _arch: previousData._arch ?? null } },
      includeInHistory: true,
    };
    this.appDfdOrchestrator.executeOperation(operation as any).subscribe();
  }

  this.updateIconPickerCells();
  this.cdr.detectChanges();
}

onIconPlacementChanged(event: PlacementChangedEvent): void {
  if (this.isReadOnlyMode) return;
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) return;

  for (const cellId of event.cellIds) {
    const cell = graph.getCellById(cellId);
    if (!cell || !cell.isNode()) continue;

    const previousData = cell.getData() ?? {};
    const previousArch = previousData._arch as ArchIconData | undefined;
    if (!previousArch) continue;

    const newArch = { ...previousArch, placement: event.placement };
    cell.setData({ ...previousData, _arch: newArch }, { silent: true });
    this.applyIconToCell(cell, newArch as ArchIconData);

    const operation = {
      id: `icon-placement-${Date.now()}-${cellId}`,
      type: 'update-node' as const,
      source: 'user-interaction' as const,
      priority: 'normal' as const,
      timestamp: Date.now(),
      nodeId: cellId,
      updates: { properties: { _arch: newArch } },
      previousState: { properties: { _arch: previousArch } },
      includeInHistory: true,
    };
    this.appDfdOrchestrator.executeOperation(operation as any).subscribe();
  }

  this.updateIconPickerCells();
  this.cdr.detectChanges();
}
```

- [ ] **Step 7: Add rendering helper methods**

```typescript
private applyIconToCell(cell: Cell, arch: ArchIconData): void {
  const iconPath = this.architectureIconService.getIconPath(arch);
  const placementKey = getIconPlacementKey(arch.placement);
  const placementAttrs = ICON_PLACEMENT_ATTRS[placementKey];

  cell.setAttrByPath('icon/href', iconPath);
  cell.setAttrByPath('icon/width', 32);
  cell.setAttrByPath('icon/height', 32);
  cell.setAttrByPath('icon/refX', placementAttrs.refX);
  cell.setAttrByPath('icon/refY', placementAttrs.refY);
  cell.setAttrByPath('icon/xAlignment', 'middle');
  cell.setAttrByPath('icon/yAlignment', 'middle');

  // When icon is centered, shift label below the icon (for non-security-boundary shapes)
  if (
    arch.placement.vertical === 'middle' &&
    arch.placement.horizontal === 'center' &&
    cell.shape !== 'security-boundary'
  ) {
    cell.setAttrByPath('text/refY', '75%');
    cell.setAttrByPath('text/textVerticalAnchor', 'top');
  }
}

private applyBorderPreference(cell: Cell, arch: ArchIconData): void {
  const prefs = this.userPreferencesService.getPreferences();
  const shape = cell.shape;
  if (
    !prefs.showShapeBordersWithIcons &&
    (ICON_HIDEABLE_BORDER_SHAPES as readonly string[]).includes(shape)
  ) {
    cell.setAttrByPath('body/stroke', 'transparent');
    cell.setAttrByPath('body/fill', 'transparent');
  }
}

private restoreBorder(cell: Cell): void {
  // Restore original styles from cell data or defaults
  const data = cell.getData() ?? {};
  if (data.customStyles) {
    // If custom styles were set, don't override — just make visible again
    // The original colors are preserved in the cell's attrs before we set transparent
  }
  // For simplicity, restore defaults based on shape type
  const shape = cell.shape;
  const defaults = this.getDefaultStylesForShape(shape);
  if (defaults) {
    cell.setAttrByPath('body/stroke', defaults.stroke);
    cell.setAttrByPath('body/fill', defaults.fill);
  }
}

private getDefaultStylesForShape(shape: string): { stroke: string; fill: string } | null {
  const nodeStyles = DFD_STYLING.NODES as Record<string, any>;
  const shapeKey = shape.toUpperCase().replace('-', '_');
  const config = nodeStyles[shapeKey];
  if (config) {
    return { stroke: config.STROKE ?? DFD_STYLING.DEFAULT_STROKE, fill: config.FILL ?? DFD_STYLING.DEFAULT_FILL };
  }
  return null;
}
```

- [ ] **Step 8: Apply icons when diagram loads**

After a diagram is loaded and rendered, existing cells with `_arch` data need their icons applied. Find the method in `dfd.component.ts` that runs after cells are added to the graph (look for where `updateStylePanelCells()` is first called after graph initialization, or where cells are iterated after loading). Add a call to `applyIconsOnLoad()` there:

```typescript
private applyIconsOnLoad(): void {
  const graph = this.appDfdOrchestrator.getGraph;
  if (!graph) return;

  const prefs = this.userPreferencesService.getPreferences();

  for (const node of graph.getNodes()) {
    const data = node.getData();
    const arch = data?._arch as ArchIconData | undefined;
    if (arch) {
      this.applyIconToCell(node, arch);
      if (
        !prefs.showShapeBordersWithIcons &&
        (ICON_HIDEABLE_BORDER_SHAPES as readonly string[]).includes(node.shape)
      ) {
        node.setAttrByPath('body/stroke', 'transparent');
        node.setAttrByPath('body/fill', 'transparent');
      }
    }
  }
}
```

Call `applyIconsOnLoad()` after the diagram is loaded and rendered.

- [ ] **Step 9: Run build and tests**

```bash
pnpm run build && pnpm test
```

Expected: build succeeds, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/app/pages/dfd/presentation/components/dfd.component.ts src/app/pages/dfd/presentation/components/dfd.component.html
git commit -m "feat(dfd): wire icon picker panel into DFD editor (#96)"
```

---

## Task 8: Lint, Build, Full Test Run

**Files:** All modified files from previous tasks.

- [ ] **Step 1: Run linter**

```bash
pnpm run lint:all
```

Fix any issues reported.

- [ ] **Step 2: Run full build**

```bash
pnpm run build
```

Fix any build errors.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test
```

Fix any test failures.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(dfd): lint and test fixes for architecture icon support (#96)"
```

(Only if there were fixes needed.)

---

## Task 9: Localization Backfill

**Files:**
- Modify: All i18n files in `src/assets/i18n/` (non-English locales)

- [ ] **Step 1: Run the localization backfill skill**

Use the `/localization-backfill` skill to add the new `dfd.iconPicker.*` and `userPreferences.showShapeBordersWithIcons` keys to all non-English locale files.

- [ ] **Step 2: Verify localization coverage**

```bash
python3 scripts/check-i18n.py
```

Expected: no missing keys for the new icon picker keys.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/
git commit -m "i18n: add architecture icon picker translations (#96)"
```
