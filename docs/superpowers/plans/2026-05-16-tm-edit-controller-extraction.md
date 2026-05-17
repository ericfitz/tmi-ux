# tm-edit Controller Logic Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract pure formatting/migration helpers and form auto-save logic out of the 3,884-line `tm-edit.component.ts` into two unit-tested services, then prototype an entity-CRUD seam and stop for a decision (#695).

**Architecture:** Two new `@Injectable({ providedIn: 'root' })` services under `src/app/pages/tm/services/`. `TmEditFormattingService` holds stateless formatters and threat field-value migration. `TmEditAutoSaveService` holds form dirty-tracking and the auto-save field-diff builder. The component injects each and delegates; behavior is unchanged. Phase 3 prototypes the entity-CRUD dialog seam against one entity and stops.

**Tech Stack:** Angular 20 standalone components, TypeScript (strict), Vitest, Transloco i18n.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/app/pages/tm/services/tm-edit-formatting.service.ts` | NEW — stateless formatters, diagram/asset icons, SVG validation/viewBox, threat field-value migration |
| `src/app/pages/tm/services/tm-edit-formatting.service.spec.ts` | NEW — unit specs for the above |
| `src/app/pages/tm/services/tm-edit-auto-save.service.ts` | NEW — form dirty-tracking, auto-save field-diff builder |
| `src/app/pages/tm/services/tm-edit-auto-save.service.spec.ts` | NEW — unit specs for the above |
| `src/app/pages/tm/tm-edit.component.ts` | MODIFY — inject services, delete moved methods, delegate |

## Reference: existing patterns

- Service style: `src/app/pages/tm/services/permissions-autocomplete.service.ts` (constructor DI, JSDoc, `@Injectable({ providedIn: 'root' })`).
- Spec style: `src/app/pages/tm/services/permissions-autocomplete.service.spec.ts` — `import '@angular/compiler';` first line, plain-object mocks cast via `as unknown as <Type>`, no `TestBed`, `vitest` imports (`vi, describe, it, expect, beforeEach`).
- Run tests for one file: `pnpm test -- src/app/pages/tm/services/<name>.spec.ts`

---

## Phase 1 — `TmEditFormattingService`

### Task 1: Create the formatting service with the simple pure formatters

**Files:**
- Create: `src/app/pages/tm/services/tm-edit-formatting.service.ts`
- Test: `src/app/pages/tm/services/tm-edit-formatting.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/pages/tm/services/tm-edit-formatting.service.spec.ts`:

```typescript
import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';

import { TmEditFormattingService } from './tm-edit-formatting.service';

describe('TmEditFormattingService', () => {
  let service: TmEditFormattingService;

  beforeEach(() => {
    service = new TmEditFormattingService(
      { warn: () => {}, debugComponent: () => {} } as never,
      { translate: (k: string) => k } as never,
    );
  });

  describe('getMimeTypeForFormat', () => {
    it('maps json to application/json', () => {
      expect(service.getMimeTypeForFormat('json')).toBe('application/json');
    });
    it('maps yaml to application/x-yaml', () => {
      expect(service.getMimeTypeForFormat('yaml')).toBe('application/x-yaml');
    });
    it('maps graphml to application/xml', () => {
      expect(service.getMimeTypeForFormat('graphml')).toBe('application/xml');
    });
  });

  describe('getExtensionForFormat', () => {
    it('maps json to .json', () => {
      expect(service.getExtensionForFormat('json')).toBe('.json');
    });
    it('maps yaml to .yaml', () => {
      expect(service.getExtensionForFormat('yaml')).toBe('.yaml');
    });
    it('maps graphml to .graphml', () => {
      expect(service.getExtensionForFormat('graphml')).toBe('.graphml');
    });
  });

  describe('getTruncatedUrl', () => {
    it('returns empty string for empty input', () => {
      expect(service.getTruncatedUrl('')).toBe('');
    });
    it('strips protocol and www prefix', () => {
      expect(service.getTruncatedUrl('https://www.example.com/x')).toBe('example.com/x');
    });
    it('truncates URLs longer than 40 chars with ellipsis', () => {
      const long = 'https://example.com/' + 'a'.repeat(60);
      const result = service.getTruncatedUrl(long);
      expect(result.length).toBe(40);
      expect(result.endsWith('...')).toBe(true);
    });
  });

  describe('getDiagramIcon', () => {
    it('returns graph_3 for a DFD diagram type', () => {
      expect(service.getDiagramIcon({ type: 'DFD-1.0' } as never)).toBe('graph_3');
    });
    it('returns fallback icon when type is missing', () => {
      expect(service.getDiagramIcon({} as never)).toBe('indeterminate_question_box');
    });
    it('returns fallback icon for unrecognized type', () => {
      expect(service.getDiagramIcon({ type: 'XYZ' } as never)).toBe('indeterminate_question_box');
    });
  });

  describe('getDiagramTooltip', () => {
    it('returns the diagram type when present', () => {
      expect(service.getDiagramTooltip({ type: 'DFD-1.0' } as never)).toBe('DFD-1.0');
    });
    it('returns Unknown Type when type is missing', () => {
      expect(service.getDiagramTooltip({} as never)).toBe('Unknown Type');
    });
  });

  describe('getAssetTypeIcon', () => {
    it('returns diamond for undefined type', () => {
      expect(service.getAssetTypeIcon(undefined)).toBe('diamond');
    });
    it('maps known asset types to icons', () => {
      expect(service.getAssetTypeIcon('data')).toBe('database');
      expect(service.getAssetTypeIcon('software')).toBe('deployed_code');
      expect(service.getAssetTypeIcon('personnel')).toBe('person');
    });
    it('returns diamond for unknown type', () => {
      expect(service.getAssetTypeIcon('mystery')).toBe('diamond');
    });
  });

  describe('generateDiagramModelFilename', () => {
    it('builds {model}-{diagram}-model{ext} and sanitizes unsafe chars', () => {
      expect(service.generateDiagramModelFilename('My TM', 'Flow:1', '.json')).toBe(
        'My-TM-Flow-1-model.json',
      );
    });
    it('falls back to ThreatModel when the model name is blank', () => {
      expect(service.generateDiagramModelFilename('   ', 'Flow', '.yaml')).toBe(
        'ThreatModel-Flow-model.yaml',
      );
    });
    it('truncates each part to 40 chars', () => {
      const result = service.generateDiagramModelFilename('a'.repeat(60), 'b'.repeat(60), '.json');
      expect(result).toBe('a'.repeat(40) + '-' + 'b'.repeat(40) + '-model.json');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/tm/services/tm-edit-formatting.service.spec.ts`
Expected: FAIL — `Cannot find module './tm-edit-formatting.service'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/pages/tm/services/tm-edit-formatting.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { LoggerService } from '../../../core/services/logger.service';
import { Diagram } from '../models/diagram.model';

type DiagramModelFormat = 'json' | 'yaml' | 'graphml';

/**
 * Stateless presentation helpers and threat field-value migration extracted
 * from TmEditComponent. No component state; pure input -> output (the logger
 * and Transloco dependencies are only used for diagnostics and label lookup).
 */
@Injectable({ providedIn: 'root' })
export class TmEditFormattingService {
  constructor(
    private logger: LoggerService,
    private transloco: TranslocoService,
  ) {}

  /** MIME type for a diagram model export format. */
  getMimeTypeForFormat(format: DiagramModelFormat): string {
    switch (format) {
      case 'json':
        return 'application/json';
      case 'yaml':
        return 'application/x-yaml';
      case 'graphml':
        return 'application/xml';
      default:
        return 'application/octet-stream';
    }
  }

  /** File extension for a diagram model export format. */
  getExtensionForFormat(format: DiagramModelFormat): string {
    switch (format) {
      case 'json':
        return '.json';
      case 'yaml':
        return '.yaml';
      case 'graphml':
        return '.graphml';
      default:
        return '';
    }
  }

  /**
   * Generate a filename for a diagram model download.
   * Format: "{threatModelName}-{diagramName}-model{extension}".
   */
  generateDiagramModelFilename(
    threatModelName: string | undefined,
    diagramName: string,
    extension: string,
  ): string {
    const sanitizeAndTruncate = (name: string, maxLength: number): string => {
      const sanitized = name
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      return sanitized.length > maxLength ? sanitized.substring(0, maxLength) : sanitized;
    };

    const threatModelPart = sanitizeAndTruncate(threatModelName?.trim() || 'ThreatModel', 40);
    const diagramPart = sanitizeAndTruncate(diagramName.trim(), 40);
    const filename = `${threatModelPart}-${diagramPart}-model${extension}`;

    this.logger.debugComponent('TmEdit', 'Generated diagram model filename', {
      threatModelName,
      diagramName,
      filename,
    });

    return filename;
  }

  /** Material icon name for a diagram, derived from its type prefix. */
  getDiagramIcon(diagram: Diagram): string {
    if (!diagram.type) {
      return 'indeterminate_question_box';
    }
    const typePrefix = diagram.type.split('-')[0].toUpperCase();
    switch (typePrefix) {
      case 'DFD':
        return 'graph_3';
      default:
        return 'indeterminate_question_box';
    }
  }

  /** Tooltip text for a diagram icon. */
  getDiagramTooltip(diagram: Diagram): string {
    return diagram.type || 'Unknown Type';
  }

  /** Material icon name for an asset type. */
  getAssetTypeIcon(type?: string): string {
    if (!type) {
      return 'diamond';
    }
    const iconMap: Record<string, string> = {
      data: 'database',
      software: 'deployed_code',
      hardware: 'host',
      infrastructure: 'factory',
      service: 'cloud_circle',
      personnel: 'person',
    };
    return iconMap[type] || 'diamond';
  }

  /** Strip protocol/www prefix and truncate a URL to 40 chars for display. */
  getTruncatedUrl(url: string): string {
    if (!url) return '';
    let displayUrl = url.replace(/^https?:\/\/(www\.)?/, '');
    const maxLength = 40;
    if (displayUrl.length > maxLength) {
      displayUrl = displayUrl.substring(0, maxLength - 3) + '...';
    }
    return displayUrl;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/pages/tm/services/tm-edit-formatting.service.spec.ts`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/services/tm-edit-formatting.service.ts src/app/pages/tm/services/tm-edit-formatting.service.spec.ts
git commit -m "refactor: add TmEditFormattingService with stateless formatters (#695)"
```

---

### Task 2: Add SVG validation and viewBox extraction to the formatting service

**Files:**
- Modify: `src/app/pages/tm/services/tm-edit-formatting.service.ts`
- Test: `src/app/pages/tm/services/tm-edit-formatting.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Append these describe blocks inside the top-level `describe('TmEditFormattingService', ...)` in the spec file:

```typescript
  describe('isValidBase64Svg', () => {
    const toB64 = (s: string): string => Buffer.from(s, 'utf-8').toString('base64');

    it('returns false for empty input', () => {
      expect(service.isValidBase64Svg('')).toBe(false);
    });
    it('returns true for a well-formed base64 SVG', () => {
      expect(service.isValidBase64Svg(toB64('<svg><rect/></svg>'))).toBe(true);
    });
    it('returns true when content starts with an XML declaration', () => {
      expect(service.isValidBase64Svg(toB64('<?xml version="1.0"?><svg></svg>'))).toBe(true);
    });
    it('returns false when content does not start with <svg or <?xml', () => {
      expect(service.isValidBase64Svg(toB64('<div><svg></svg></div>'))).toBe(false);
    });
    it('returns false when the closing </svg> tag is missing', () => {
      expect(service.isValidBase64Svg(toB64('<svg><rect/>'))).toBe(false);
    });
  });

  describe('extractViewBoxFromSvg', () => {
    const toB64 = (s: string): string => Buffer.from(s, 'utf-8').toString('base64');

    it('returns null when the diagram has no SVG', () => {
      expect(service.extractViewBoxFromSvg({} as never)).toBeNull();
    });
    it('returns the viewBox attribute when present', () => {
      const svg = toB64('<svg viewBox="0 0 100 50"></svg>');
      expect(service.extractViewBoxFromSvg({ image: { svg } } as never)).toBe('0 0 100 50');
    });
    it('returns null when the SVG has no viewBox attribute', () => {
      const svg = toB64('<svg></svg>');
      expect(service.extractViewBoxFromSvg({ image: { svg } } as never)).toBeNull();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/tm/services/tm-edit-formatting.service.spec.ts`
Expected: FAIL — `service.isValidBase64Svg is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add these two methods to `TmEditFormattingService` (before the closing brace):

```typescript
  /** Validate that a base64 string decodes to well-formed SVG markup. */
  isValidBase64Svg(base64Svg: string): boolean {
    try {
      if (!base64Svg || base64Svg.length === 0) {
        return false;
      }
      const svgText = atob(base64Svg);
      const trimmed = svgText.trim();
      if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) {
        this.logger.warn('SVG validation failed: does not start with <svg or <?xml', {
          actualStart: trimmed.substring(0, 20),
        });
        return false;
      }
      if (!trimmed.includes('<svg')) {
        this.logger.warn('SVG validation failed: does not contain <svg tag');
        return false;
      }
      if (!trimmed.includes('</svg>')) {
        this.logger.warn('SVG validation failed: does not contain </svg> closing tag');
        return false;
      }
      return true;
    } catch (error) {
      this.logger.warn('SVG validation failed with error', { error });
      return false;
    }
  }

  /** Extract the viewBox attribute from a diagram's base64-encoded SVG, or null. */
  extractViewBoxFromSvg(diagram: Diagram): string | null {
    if (!diagram.image?.svg) {
      return null;
    }
    try {
      const svgContent = atob(diagram.image.svg);
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');
      if (!svgElement) {
        return null;
      }
      return svgElement.getAttribute('viewBox');
    } catch (error) {
      this.logger.warn('Failed to extract viewBox from SVG', { error });
      return null;
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/pages/tm/services/tm-edit-formatting.service.spec.ts`
Expected: PASS.

Note: `DOMParser` and `atob` are provided by Vitest's jsdom environment — no extra setup needed.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/services/tm-edit-formatting.service.ts src/app/pages/tm/services/tm-edit-formatting.service.spec.ts
git commit -m "refactor: add SVG validation/viewBox helpers to TmEditFormattingService (#695)"
```

---

### Task 3: Add threat field-value migration and severity-class to the service

**Files:**
- Modify: `src/app/pages/tm/services/tm-edit-formatting.service.ts`
- Test: `src/app/pages/tm/services/tm-edit-formatting.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Append inside the top-level `describe`:

```typescript
  describe('getThreatSeverityClass', () => {
    it('returns severity-unknown for null/undefined', () => {
      expect(service.getThreatSeverityClass(null)).toBe('severity-unknown');
      expect(service.getThreatSeverityClass(undefined)).toBe('severity-unknown');
    });
    it('prefixes a camelCase key with severity-', () => {
      expect(service.getThreatSeverityClass('high')).toBe('severity-high');
    });
  });

  describe('migrateThreatFieldValues', () => {
    it('migrates numeric-key severity to camelCase key', () => {
      const result = service.migrateThreatFieldValues({ severity: '0' } as never);
      expect(result.severity).toBe('critical');
    });
    it('migrates legacy English severity strings', () => {
      const result = service.migrateThreatFieldValues({ severity: 'High' } as never);
      expect(result.severity).toBe('high');
    });
    it('migrates numeric-key status to camelCase key', () => {
      const result = service.migrateThreatFieldValues({ status: '2' } as never);
      expect(result.status).toBe('mitigation_planned');
    });
    it('migrates numeric-key priority to camelCase key', () => {
      const result = service.migrateThreatFieldValues({ priority: '0' } as never);
      expect(result.priority).toBe('immediate');
    });
    it('leaves an already-migrated value unchanged', () => {
      const result = service.migrateThreatFieldValues({ severity: 'low' } as never);
      expect(result.severity).toBe('low');
    });
    it('does not mutate the input threat object', () => {
      const input = { severity: '0' } as never as { severity: string };
      service.migrateThreatFieldValues(input as never);
      expect(input.severity).toBe('0');
    });
  });
```

Note: `migrateThreatFieldValues` calls `getFieldKeysForFieldType`, which reads from a static field-definition map and does not require Transloco — the mock `{ translate: (k) => k }` is sufficient for the migration paths exercised here.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/tm/services/tm-edit-formatting.service.spec.ts`
Expected: FAIL — `service.getThreatSeverityClass is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to the imports at the top of `tm-edit-formatting.service.ts`:

```typescript
import {
  getFieldKeysForFieldType,
  migrateFieldValue,
} from '../../../shared/utils/field-value-helpers';
import { Threat } from '../models/threat-model.model';
```

Add these members to `TmEditFormattingService` (the maps go near the top of the class body, the methods below the formatters):

```typescript
  /** Legacy-to-camelCase severity key mapping for synchronous migration. */
  private readonly severityMap: Record<string, string> = {
    '0': 'critical',
    '1': 'high',
    '2': 'medium',
    '3': 'low',
    '4': 'informational',
    '5': 'unknown',
    Critical: 'critical',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
    Informational: 'informational',
    Info: 'informational',
    Unknown: 'unknown',
    None: 'unknown',
  };

  private readonly statusMap: Record<string, string> = {
    '0': 'open',
    '1': 'confirmed',
    '2': 'mitigation_planned',
    '3': 'mitigation_in_progress',
    '4': 'verification_pending',
    '5': 'resolved',
    '6': 'accepted',
    '7': 'false_positive',
    '8': 'deferred',
    '9': 'closed',
    Open: 'open',
    Confirmed: 'confirmed',
    'Mitigation Planned': 'mitigation_planned',
    'Mitigation In Progress': 'mitigation_in_progress',
    'Verification Pending': 'verification_pending',
    Resolved: 'resolved',
    Accepted: 'accepted',
    'False Positive': 'false_positive',
    Deferred: 'deferred',
    Closed: 'closed',
  };

  private readonly priorityMap: Record<string, string> = {
    '0': 'immediate',
    '1': 'high',
    '2': 'medium',
    '3': 'low',
    '4': 'deferred',
    'Immediate (P0)': 'immediate',
    'High (P1)': 'high',
    'Medium (P2)': 'medium',
    'Low (P3)': 'low',
    'Deferred (P4)': 'deferred',
    Immediate: 'immediate',
    High: 'high',
    Medium: 'medium',
    Low: 'low',
  };

  private readonly severityKeys = getFieldKeysForFieldType('threatEditor.threatSeverity');
  private readonly threatStatusKeys = getFieldKeysForFieldType('threatEditor.threatStatus');

  /** CSS class for a threat severity value, handling legacy numeric values. */
  getThreatSeverityClass(severity: string | null | undefined): string {
    const key = severity
      ? (migrateFieldValue(severity, 'threatEditor.threatSeverity', this.transloco) ?? 'unknown')
      : 'unknown';
    return 'severity-' + key;
  }

  /**
   * Migrate a threat's legacy field values (numeric keys or English strings)
   * to camelCase keys. Returns a new threat; does not mutate the input.
   */
  migrateThreatFieldValues(threat: Threat): Threat {
    const migratedThreat = { ...threat };

    if (
      migratedThreat.severity &&
      !this.severityKeys.includes(migratedThreat.severity) &&
      this.severityMap[migratedThreat.severity]
    ) {
      migratedThreat.severity = this.severityMap[migratedThreat.severity];
    }

    if (
      migratedThreat.status &&
      !this.threatStatusKeys.includes(migratedThreat.status) &&
      this.statusMap[migratedThreat.status]
    ) {
      migratedThreat.status = this.statusMap[migratedThreat.status];
    }

    const priorityKeys = getFieldKeysForFieldType('threatEditor.threatPriority');
    if (
      migratedThreat.priority &&
      !priorityKeys.includes(migratedThreat.priority) &&
      this.priorityMap[migratedThreat.priority]
    ) {
      migratedThreat.priority = this.priorityMap[migratedThreat.priority];
    }

    return migratedThreat;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/pages/tm/services/tm-edit-formatting.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/services/tm-edit-formatting.service.ts src/app/pages/tm/services/tm-edit-formatting.service.spec.ts
git commit -m "refactor: add threat field-value migration to TmEditFormattingService (#695)"
```

---

### Task 4: Wire TmEditComponent to the formatting service and delete the moved methods

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.ts`

- [ ] **Step 1: Inject the service**

In the constructor parameter list of `TmEditComponent`, add (after `private threatFilterStateService: ThreatFilterStateService,`):

```typescript
    private formattingService: TmEditFormattingService,
```

Add the import near the other `./services/...` imports:

```typescript
import { TmEditFormattingService } from './services/tm-edit-formatting.service';
```

- [ ] **Step 2: Delete the moved members and add delegating wrappers**

Delete these members from `tm-edit.component.ts` entirely:
- `severityMap`, `statusMap`, `priorityMap` (lines ~403–458)
- `severityKeys`, `threatStatusKeys` (lines ~460–461)
- `migrateThreatFieldValues` (lines ~468–500)
- `getMimeTypeForFormat`, `getExtensionForFormat`, `generateDiagramModelFilename` (lines ~2068–2126)
- `getDiagramIcon`, `getDiagramTooltip` (lines ~2718–2742)
- `extractViewBoxFromSvg`, `isValidBase64Svg` (lines ~2816–2890)
- `getTruncatedUrl` (lines ~2923–2936)
- `getAssetTypeIcon` (lines ~3220–3235)

Replace `getThreatSeverityClass` (lines ~556–561) body with delegation:

```typescript
  /** Gets the CSS class for a threat severity value, handling legacy numeric values. */
  getThreatSeverityClass(severity: string | null | undefined): string {
    return this.formattingService.getThreatSeverityClass(severity);
  }
```

For the template-bound methods that were deleted (`getDiagramIcon`, `getDiagramTooltip`, `getAssetTypeIcon`, `getTruncatedUrl`, `getSvgViewBox` callers), the template references must keep working. Add thin delegating wrappers for the ones the template calls directly. Search the template first:

Run: `rg -n 'getDiagramIcon|getDiagramTooltip|getAssetTypeIcon|getTruncatedUrl|getSvgViewBox' src/app/pages/tm/tm-edit.component.html`

For every method name the template uses, keep a one-line public wrapper in the component:

```typescript
  getDiagramIcon(diagram: Diagram): string {
    return this.formattingService.getDiagramIcon(diagram);
  }

  getDiagramTooltip(diagram: Diagram): string {
    return this.formattingService.getDiagramTooltip(diagram);
  }

  getAssetTypeIcon(type?: string): string {
    return this.formattingService.getAssetTypeIcon(type);
  }

  getTruncatedUrl(url: string): string {
    return this.formattingService.getTruncatedUrl(url);
  }
```

`getSvgViewBox` stays in the component but delegates to the service:

```typescript
  getSvgViewBox(diagram: Diagram): string | null {
    return this.formattingService.extractViewBoxFromSvg(diagram);
  }
```

- [ ] **Step 3: Update internal callers of the moved methods**

Update the call sites that previously used `this.<method>`:

- `computeDiagramSvgData` (line ~2761): `this.isValidBase64Svg(...)` → `this.formattingService.isValidBase64Svg(...)`
- `loadThreats` (line ~3312): `this.migrateThreatFieldValues(t)` → `this.formattingService.migrateThreatFieldValues(t)`
- `downloadDiagramModel` (lines ~2049–2051): `this.getMimeTypeForFormat(format)` → `this.formattingService.getMimeTypeForFormat(format)`, `this.getExtensionForFormat(format)` → `this.formattingService.getExtensionForFormat(format)`, `this.generateDiagramModelFilename(diagram.name, extension)` → `this.formattingService.generateDiagramModelFilename(this.threatModel?.name, diagram.name, extension)`

Run `rg -n 'this\.(getMimeTypeForFormat|getExtensionForFormat|generateDiagramModelFilename|getDiagramIcon|getDiagramTooltip|getAssetTypeIcon|getTruncatedUrl|isValidBase64Svg|extractViewBoxFromSvg|migrateThreatFieldValues|severityMap|statusMap|priorityMap)' src/app/pages/tm/tm-edit.component.ts` to confirm no stale references remain except the delegating wrappers added in Step 2.

- [ ] **Step 4: Remove now-unused imports**

If `migrateFieldValue` and `getFieldKeysForFieldType` are no longer referenced in `tm-edit.component.ts` after the deletions, remove them from the import on lines ~113–119. Verify with:

Run: `rg -n 'migrateFieldValue|getFieldKeysForFieldType' src/app/pages/tm/tm-edit.component.ts`

If a name still appears (e.g. `getFieldKeysForFieldType` used elsewhere), keep it; remove only the unused ones.

- [ ] **Step 5: Build and test**

Run: `pnpm run build`
Expected: build succeeds, no TypeScript errors.

Run: `pnpm test -- src/app/pages/tm`
Expected: PASS — existing tm specs plus the new formatting spec.

- [ ] **Step 6: Lint**

Run: `pnpm run lint:all`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.ts
git commit -m "refactor: delegate tm-edit formatters to TmEditFormattingService (#695)"
```

**Checkpoint 1 complete** — Phase 1 done. ~400–500 lines moved, build + tests + lint green.

---

## Phase 2 — `TmEditAutoSaveService`

### Task 5: Create the auto-save service with the field-diff builder

**Files:**
- Create: `src/app/pages/tm/services/tm-edit-auto-save.service.ts`
- Test: `src/app/pages/tm/services/tm-edit-auto-save.service.spec.ts`

This task extracts the dirty-tracking comparison (`hasFormChanged`) and the
field-diff logic currently inline in `performAutoSave` (tm-edit.component.ts
lines ~3013–3050) into a pure `buildUpdates` method.

- [ ] **Step 1: Write the failing test**

Create `src/app/pages/tm/services/tm-edit-auto-save.service.spec.ts`:

```typescript
import '@angular/compiler';

import { describe, it, expect, beforeEach } from 'vitest';

import { TmEditAutoSaveService, ThreatModelFormValues } from './tm-edit-auto-save.service';

describe('TmEditAutoSaveService', () => {
  let service: TmEditAutoSaveService;

  const baseline: ThreatModelFormValues = {
    name: 'TM',
    description: 'desc',
    threat_model_framework: 'STRIDE',
    issue_uri: '',
    status: null,
  };

  beforeEach(() => {
    service = new TmEditAutoSaveService({ warn: () => {} } as never);
  });

  describe('hasFormChanged', () => {
    it('returns false when there are no original values', () => {
      expect(service.hasFormChanged(baseline, undefined)).toBe(false);
    });
    it('returns false when current equals original', () => {
      expect(service.hasFormChanged({ ...baseline }, baseline)).toBe(false);
    });
    it('returns true when name changes', () => {
      expect(service.hasFormChanged({ ...baseline, name: 'New' }, baseline)).toBe(true);
    });
    it('returns true when description changes', () => {
      expect(service.hasFormChanged({ ...baseline, description: 'x' }, baseline)).toBe(true);
    });
    it('returns true when framework changes', () => {
      expect(
        service.hasFormChanged({ ...baseline, threat_model_framework: 'LINDDUN' }, baseline),
      ).toBe(true);
    });
    it('returns true when issue_uri changes', () => {
      expect(service.hasFormChanged({ ...baseline, issue_uri: 'http://x' }, baseline)).toBe(true);
    });
    it('treats undefined and null status as equal', () => {
      expect(service.hasFormChanged({ ...baseline, status: undefined }, baseline)).toBe(false);
    });
    it('returns true when status changes from null to a value', () => {
      expect(service.hasFormChanged({ ...baseline, status: 'active' }, baseline)).toBe(true);
    });
  });

  describe('buildUpdates', () => {
    it('returns an empty object when nothing changed', () => {
      expect(service.buildUpdates({ ...baseline }, baseline)).toEqual({});
    });
    it('includes only the changed name field', () => {
      expect(service.buildUpdates({ ...baseline, name: 'New' }, baseline)).toEqual({ name: 'New' });
    });
    it('includes multiple changed fields', () => {
      const updates = service.buildUpdates(
        { ...baseline, name: 'New', issue_uri: 'http://x' },
        baseline,
      );
      expect(updates).toEqual({ name: 'New', issue_uri: 'http://x' });
    });
    it('includes a status change', () => {
      expect(service.buildUpdates({ ...baseline, status: 'active' }, baseline)).toEqual({
        status: 'active',
      });
    });
    it('strips an authorization field if one is somehow present', () => {
      const current = { ...baseline, name: 'New' } as ThreatModelFormValues &
        Record<string, unknown>;
      current['authorization'] = [{}];
      const updates = service.buildUpdates(current, baseline) as Record<string, unknown>;
      expect('authorization' in updates).toBe(false);
      expect(updates['name']).toBe('New');
    });
    it('strips an owner field if one is somehow present', () => {
      const current = { ...baseline, name: 'New' } as ThreatModelFormValues &
        Record<string, unknown>;
      current['owner'] = 'someone';
      const updates = service.buildUpdates(current, baseline) as Record<string, unknown>;
      expect('owner' in updates).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/tm/services/tm-edit-auto-save.service.spec.ts`
Expected: FAIL — `Cannot find module './tm-edit-auto-save.service'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/pages/tm/services/tm-edit-auto-save.service.ts`:

```typescript
import { Injectable } from '@angular/core';

import { LoggerService } from '../../../core/services/logger.service';
import { ThreatModel } from '../models/threat-model.model';

/** Form values tracked for threat model auto-save dirty-checking. */
export interface ThreatModelFormValues {
  name: string;
  description: string;
  threat_model_framework: string;
  issue_uri?: string;
  status?: string | null;
}

/** Subset of ThreatModel fields the form auto-save is allowed to patch. */
export type ThreatModelFormUpdates = Partial<
  Pick<ThreatModel, 'name' | 'description' | 'threat_model_framework' | 'issue_uri' | 'status'>
>;

/**
 * Dirty-tracking and field-diff logic for threat model form auto-save,
 * extracted from TmEditComponent. Operates on plain form-value objects so it
 * is unit-testable without a live FormGroup.
 */
@Injectable({ providedIn: 'root' })
export class TmEditAutoSaveService {
  constructor(private logger: LoggerService) {}

  /**
   * Whether the current form values differ from the original (saved) values.
   * Returns false when no original snapshot exists.
   */
  hasFormChanged(
    formValue: ThreatModelFormValues,
    original: ThreatModelFormValues | undefined,
  ): boolean {
    if (!original) return false;

    const statusChanged = (formValue.status ?? null) !== (original.status ?? null);

    return (
      formValue.name !== original.name ||
      formValue.description !== original.description ||
      formValue.threat_model_framework !== original.threat_model_framework ||
      formValue.issue_uri !== original.issue_uri ||
      statusChanged
    );
  }

  /**
   * Build a partial-update object containing only the form fields that
   * changed from the original. Defensively strips authorization/owner —
   * those are managed via separate API paths and must never ride along on a
   * form auto-save PATCH.
   */
  buildUpdates(
    formValue: ThreatModelFormValues,
    original: ThreatModelFormValues,
  ): ThreatModelFormUpdates {
    const updates: ThreatModelFormUpdates = {};

    if (formValue.name !== original.name) {
      updates.name = formValue.name;
    }
    if (formValue.description !== original.description) {
      updates.description = formValue.description;
    }
    if (formValue.threat_model_framework !== original.threat_model_framework) {
      updates.threat_model_framework = formValue.threat_model_framework;
    }
    if (formValue.issue_uri !== original.issue_uri) {
      updates.issue_uri = formValue.issue_uri;
    }
    if ((formValue.status ?? null) !== (original.status ?? null)) {
      updates.status = formValue.status;
    }

    const safeUpdates = updates as Record<string, unknown>;
    if ('authorization' in safeUpdates) {
      this.logger.warn('Unexpected authorization field in form auto-save updates - removing it', {
        updateKeys: Object.keys(safeUpdates),
      });
      delete safeUpdates['authorization'];
    }
    if ('owner' in safeUpdates) {
      this.logger.warn('Unexpected owner field in form auto-save updates - removing it', {
        updateKeys: Object.keys(safeUpdates),
      });
      delete safeUpdates['owner'];
    }

    return updates;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/pages/tm/services/tm-edit-auto-save.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/services/tm-edit-auto-save.service.ts src/app/pages/tm/services/tm-edit-auto-save.service.spec.ts
git commit -m "refactor: add TmEditAutoSaveService with form field-diff builder (#695)"
```

---

### Task 6: Wire TmEditComponent to the auto-save service

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.ts`

- [ ] **Step 1: Inject the service and import its types**

Add the import near the other `./services/...` imports, importing the `ThreatModelFormValues` type from the service so the component reuses one definition:

```typescript
import {
  TmEditAutoSaveService,
  ThreatModelFormValues,
} from './services/tm-edit-auto-save.service';
```

Delete the component's local `ThreatModelFormValues` interface (tm-edit.component.ts lines ~133–139) — the imported type replaces it. The shapes are identical, so all existing `as ThreatModelFormValues` casts in the component compile unchanged.

Add to the constructor parameter list (after `private formattingService: TmEditFormattingService,`):

```typescript
    private autoSaveService: TmEditAutoSaveService,
```

- [ ] **Step 2: Delegate hasFormChanged**

Replace the body of `hasFormChanged` (lines ~823–836) with delegation. Keep it as a private method since `setupFormChangeMonitoring` and `performAutoSave` call it:

```typescript
  /**
   * Check if form values have changed from original
   */
  private hasFormChanged(formValue: ThreatModelFormValues): boolean {
    return this.autoSaveService.hasFormChanged(formValue, this._originalFormValues);
  }
```

- [ ] **Step 3: Delegate the field-diff inside performAutoSave**

In `performAutoSave`, replace the inline updates-building block (lines ~3013–3050: from the `const updates: Partial<...> = {};` declaration through the end of the `if ('owner' in safeUpdates)` block) with:

```typescript
    // Build a partial update containing only changed fields. The service
    // also strips authorization/owner defensively.
    const updates = this.autoSaveService.buildUpdates(formValues, this._originalFormValues!);
    const safeUpdates = updates as Record<string, unknown>;
```

The subsequent `this.logger.info('Auto-save PATCH request', { ... updateKeys: Object.keys(safeUpdates) })` line and the rest of `performAutoSave` (the `_isSaving` flag, the service call) stay unchanged — `safeUpdates` is still in scope.

- [ ] **Step 4: Verify no behavior change in setupFormChangeMonitoring**

`setupFormChangeMonitoring` stays in the component (it wires RxJS to the live `FormGroup`). Confirm it still calls the private `hasFormChanged` and the `debounceTime(1000)` is untouched. No edit needed unless Step 2 changed the signature — it did not.

- [ ] **Step 5: Build and test**

Run: `pnpm run build`
Expected: build succeeds.

Run: `pnpm test -- src/app/pages/tm`
Expected: PASS.

- [ ] **Step 6: Manually verify auto-save timing is unchanged**

Run: `pnpm run dev`, open an existing threat model, edit the name field, and confirm the auto-save PATCH fires ~1 second after typing stops (check the network tab / logger output). This is the safety net from the spec's risk section — the `debounceTime(1000)` behavior must be identical.

Expected: auto-save fires once, ~1s after the last keystroke, with only the changed field in the payload.

- [ ] **Step 7: Lint**

Run: `pnpm run lint:all`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.ts
git commit -m "refactor: delegate tm-edit auto-save diff to TmEditAutoSaveService (#695)"
```

**Checkpoint 2 complete** — Phase 2 done.

---

## Phase 3 — Entity-CRUD seam prototype (STOP for decision)

### Task 7: Prototype the documents-CRUD seam two ways, then stop

This task is a **spike, not a merge**. It produces a written comparison and
stops for a user decision. Do NOT extract the other five entity groups.

**Files (prototype only — may be discarded):**
- Scratch branch or uncommitted working tree is fine; do not commit prototype code unless the user approves.

- [ ] **Step 1: Read the documents CRUD methods**

Read these methods in `tm-edit.component.ts`: `addDocument` (~1418), `onDocumentUrlDropped` (~1481), `editDocument` (~1492), `deleteDocument` (~1549), `getDocumentTooltip` (~1603), `openDocumentMetadataDialog` (~2257), `loadDocuments` (~3156), `onDocumentsPageChange` (~3176). Note every `MatDialog.open(...)`, every `afterClosed()` handler, and every `this.threatModel.documents` mutation.

- [ ] **Step 2: Prototype seam (a) — dialog-result-handler split**

Sketch a `TmDocumentCrudService` where `MatDialog.open()` stays in the component and the *result handler* (the success/array-mutate/service-call logic after `afterClosed()` emits) is a service method receiving the dialog result as a plain object. Write one example method (e.g. `applyDocumentEditResult(threatModel, document, result)`) and a 2-3 case unit spec sketch for it.

- [ ] **Step 3: Prototype seam (b) — injectable dialog wrapper**

Sketch a thin `TmDialogService` wrapping `MatDialog.open` per dialog type, returning a typed `Observable` of the result. Sketch how `TmDocumentCrudService` would depend on it and how a test would mock the wrapper.

- [ ] **Step 4: Write the comparison and STOP**

Write a short comparison (in chat, or appended to the design doc) covering, for documents specifically:
- Lines moved out of the component under each seam.
- Test setup complexity under each seam.
- Which reads cleaner and why.
- Whether extracting all six entity groups (threats, diagrams, documents, repositories, notes, assets) into a `TmEntityCrudService` is worth the ~2,000 lines moved.

Then **STOP**. Present the comparison and ask the user to choose the seam and whether to proceed to Phase 4. Do not write Phase 4 code without explicit approval.

---

## Self-Review

**Spec coverage:**
- Phase 1 (pure helpers → `TmEditFormattingService`) — Tasks 1–4. ✓
- Phase 2 (form/auto-save → `TmEditAutoSaveService`) — Tasks 5–6. ✓
- Phase 3 (seam prototype + stop) — Task 7. ✓
- Phase 4 (conditional full CRUD extraction) — intentionally not planned; gated on Task 7's decision per the spec. ✓
- "What stays in the component" — respected: lifecycle, `@ViewChild`, hover timers, section toggles, SVG cache maps, `computeDiagramSvgData` all remain. ✓
- Risk: `DOMParser`/jsdom — noted in Task 2 Step 4. Risk: auto-save timing — verified in Task 6 Step 6. ✓

**Placeholder scan:** No TBD/TODO; all code steps show full code. Task 7 is explicitly a spike with no placeholder implementation. ✓

**Type consistency:** `ThreatModelFormValues` is defined once in `tm-edit-auto-save.service.ts` (Task 5); Task 6 Step 1 deletes the component's identical local interface and imports the service's type, so there is a single definition. `TmEditFormattingService` method names (`getMimeTypeForFormat`, `isValidBase64Svg`, `migrateThreatFieldValues`, etc.) are consistent between Tasks 1–3 definitions and Task 4 call sites. ✓

---

## Phase 4 (3a) — Documents CRUD extraction

> Added 2026-05-17 after the Task 7 spike. The user chose: **documents only, then re-decide** (not all six entity groups), and **fix the missing error handlers during extraction**. The seam is the spike's recommendation — an injectable `TmDialogService` wrapper plus a per-entity `TmDocumentCrudService`.

**Decisions locked in from the spike:**
- Per-entity services (`TmDocumentCrudService`), not a monolithic `TmEntityCrudService`.
- A shared `TmDialogService` wraps `MatDialog.open(...).afterClosed()` per dialog type.
- **View state stays in the component.** `documentsDataSource` (`MatTableDataSource`), `documentsPageIndex/Size`, `totalDocuments` are view infrastructure — the CRUD service must not touch them. The service returns data/Observables; the component subscribes and assigns view state.
- **Error-handler fix is in scope.** `editDocument`, `deleteDocument`, `openDocumentMetadataDialog` currently subscribe with no `error` callback to service methods that `throw`. The extracted component subscriptions must add an `error` callback that calls `logger.error` — matching the pattern `addDocument` already uses. This is an intentional, user-approved behavior change.
- Three mutation styles (`editDocument` in-place replace, `deleteDocument` immutable filter, `openDocumentMetadataDialog` nested-field write) are preserved as-is — not unified.

### File Structure (Phase 4)

| File | Responsibility |
|------|----------------|
| `src/app/pages/tm/services/tm-dialog.service.ts` | NEW — thin wrapper over `MatDialog.open(...).afterClosed()` for the document editor, delete-confirmation, and metadata dialogs |
| `src/app/pages/tm/services/tm-dialog.service.spec.ts` | NEW — unit specs (mock `MatDialog`) |
| `src/app/pages/tm/services/tm-document-crud.service.ts` | NEW — document CRUD orchestration: dialog → API → return result |
| `src/app/pages/tm/services/tm-document-crud.service.spec.ts` | NEW — unit specs (mock `TmDialogService` + `ThreatModelService`) |
| `src/app/pages/tm/tm-edit.component.ts` | MODIFY — inject both services, delegate the 8 document methods to thin glue |

---

### Task 8: Create `TmDialogService` (dialog wrapper)

**Files:**
- Create: `src/app/pages/tm/services/tm-dialog.service.ts`
- Test: `src/app/pages/tm/services/tm-dialog.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/pages/tm/services/tm-dialog.service.spec.ts`:

```typescript
import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmDialogService } from './tm-dialog.service';

describe('TmDialogService', () => {
  let service: TmDialogService;
  let afterClosed: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    afterClosed = vi.fn().mockReturnValue(of('RESULT'));
    open = vi.fn().mockReturnValue({ afterClosed });
    service = new TmDialogService({ open } as never);
  });

  it('openDocumentEditor opens DocumentEditorDialogComponent with width 600px and disableClose', () => {
    const data = { mode: 'create' } as never;
    service.openDocumentEditor(data).subscribe();
    expect(open).toHaveBeenCalledTimes(1);
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('600px');
    expect(config.disableClose).toBe(true);
    expect(config.data).toBe(data);
    expect(afterClosed).toHaveBeenCalled();
  });

  it('openDeleteConfirmation opens DeleteConfirmationDialogComponent with width 700px and disableClose', () => {
    const data = { id: 'd1', name: 'Doc', objectType: 'document' } as never;
    service.openDeleteConfirmation(data).subscribe();
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('700px');
    expect(config.disableClose).toBe(true);
    expect(config.data).toBe(data);
  });

  it('openMetadata opens MetadataDialogComponent with the documented sizing', () => {
    const data = { metadata: [], isReadOnly: false, objectType: 'Document', objectName: 'x' } as never;
    service.openMetadata(data).subscribe();
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('90vw');
    expect(config.maxWidth).toBe('800px');
    expect(config.minWidth).toBe('500px');
    expect(config.maxHeight).toBe('80vh');
    expect(config.data).toBe(data);
  });

  it('forwards the afterClosed() observable result', () => {
    let received: unknown;
    service.openDocumentEditor({} as never).subscribe(r => (received = r));
    expect(received).toBe('RESULT');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/tm/services/tm-dialog.service.spec.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/pages/tm/services/tm-dialog.service.ts`. Import the three dialog components and their data/result types from the same paths `tm-edit.component.ts` uses (verify the exact import paths by reading the component's import block — `DocumentEditorDialogComponent` and `DeleteConfirmationDialogComponent` and `MetadataDialogComponent` with their `*DialogData` / `*DialogResult` types):

```typescript
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';

import {
  DocumentEditorDialogComponent,
  DocumentEditorDialogData,
  DocumentEditorDialogResult,
} from '../components/document-editor-dialog/document-editor-dialog.component';
import {
  DeleteConfirmationDialogComponent,
  DeleteConfirmationDialogData,
  DeleteConfirmationDialogResult,
} from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../components/metadata-dialog/metadata-dialog.component';
import { Metadata } from '../models/threat-model.model';

/**
 * Thin wrapper over MatDialog for the tm-edit entity dialogs. Each method
 * opens one dialog type and returns the typed afterClosed() observable, so
 * CRUD services can depend on this seam instead of MatDialog directly and
 * stay unit-testable without rendering real dialogs.
 */
@Injectable({ providedIn: 'root' })
export class TmDialogService {
  constructor(private dialog: MatDialog) {}

  /** Open the document editor dialog (create or edit mode). */
  openDocumentEditor(
    data: DocumentEditorDialogData,
  ): Observable<DocumentEditorDialogResult | undefined> {
    return this.dialog
      .open(DocumentEditorDialogComponent, { width: '600px', data, disableClose: true })
      .afterClosed();
  }

  /** Open the delete-confirmation dialog. */
  openDeleteConfirmation(
    data: DeleteConfirmationDialogData,
  ): Observable<DeleteConfirmationDialogResult | undefined> {
    return this.dialog
      .open(DeleteConfirmationDialogComponent, { width: '700px', data, disableClose: true })
      .afterClosed();
  }

  /** Open the shared metadata dialog. */
  openMetadata(data: MetadataDialogData): Observable<Metadata[] | undefined> {
    return this.dialog
      .open(MetadataDialogComponent, {
        width: '90vw',
        maxWidth: '800px',
        minWidth: '500px',
        maxHeight: '80vh',
        data,
      })
      .afterClosed();
  }
}
```

NOTE: `disableClose: true` is intentionally set on the document editor (the original component comment explains: the Google Picker iframe steals focus and stray backdrop clicks would destroy form state). Preserve it. The metadata dialog has NO `disableClose` in the original — do not add one.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/pages/tm/services/tm-dialog.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/services/tm-dialog.service.ts src/app/pages/tm/services/tm-dialog.service.spec.ts
git commit -m "refactor: add TmDialogService wrapper for tm-edit entity dialogs (#695)"
```

---

### Task 9: Create `TmDocumentCrudService`

**Files:**
- Create: `src/app/pages/tm/services/tm-document-crud.service.ts`
- Test: `src/app/pages/tm/services/tm-document-crud.service.spec.ts`

The service owns the dialog → API orchestration for documents. It does NOT touch `MatTableDataSource` or pagination state — it returns data, the component assigns view state. Each method returns an `Observable`; the component subscribes (with an `error` callback) and applies the mutation.

Verified original behavior from `tm-edit.component.ts`:
- `getDocumentTooltip(document)`: returns `document.uri`, plus `\n\n${description}` if a description exists. Pure.
- `loadDocuments(threatModelId)`: `calculateOffset(pageIndex, pageSize)` → `threatModelService.getDocumentsForThreatModel(threatModelId, pageSize, offset)` → response has `{ documents?, total? }`.
- `addDocument`: builds `Partial<Document>` from `result.values` (`name`, `uri`, `description || undefined`, `include_in_report`, conditional `picker_registration`); the `result.createdDocument` "service-mode" branch means the dialog already created it.
- `editDocument`: builds `Partial<Document>` (`name`, `uri`, `description || undefined`, `include_in_report`) → `updateDocument(tmId, docId, data)` → returns the updated `Document`.
- `deleteDocument`: `deleteDocument(tmId, docId)` → returns a `success` boolean.
- `openDocumentMetadataDialog`: `updateDocumentMetadata(tmId, docId, metadata)` → returns the updated `Metadata[]`.

- [ ] **Step 1: Write the failing test**

Create `src/app/pages/tm/services/tm-document-crud.service.spec.ts`:

```typescript
import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmDocumentCrudService } from './tm-document-crud.service';
import type { Document } from '../models/threat-model.model';

describe('TmDocumentCrudService', () => {
  let service: TmDocumentCrudService;
  let threatModelService: {
    createDocument: ReturnType<typeof vi.fn>;
    updateDocument: ReturnType<typeof vi.fn>;
    deleteDocument: ReturnType<typeof vi.fn>;
    updateDocumentMetadata: ReturnType<typeof vi.fn>;
    getDocumentsForThreatModel: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      createDocument: vi.fn().mockReturnValue(of({ id: 'd9' })),
      updateDocument: vi.fn().mockReturnValue(of({ id: 'd1', name: 'New' })),
      deleteDocument: vi.fn().mockReturnValue(of(true)),
      updateDocumentMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
      getDocumentsForThreatModel: vi
        .fn()
        .mockReturnValue(of({ documents: [{ id: 'd1' }], total: 1 })),
    };
    service = new TmDocumentCrudService(threatModelService as never);
  });

  describe('getDocumentTooltip', () => {
    it('returns just the uri when there is no description', () => {
      expect(service.getDocumentTooltip({ uri: 'http://x' } as Document)).toBe('http://x');
    });
    it('appends the description after a blank line', () => {
      expect(
        service.getDocumentTooltip({ uri: 'http://x', description: 'desc' } as Document),
      ).toBe('http://x\n\ndesc');
    });
  });

  describe('buildDocumentData', () => {
    it('maps editor values and coerces empty description to undefined', () => {
      const data = service.buildDocumentData({
        name: 'N',
        uri: 'U',
        description: '',
        include_in_report: true,
      } as never);
      expect(data).toEqual({
        name: 'N',
        uri: 'U',
        description: undefined,
        include_in_report: true,
      });
    });
    it('includes picker_registration when present', () => {
      const data = service.buildDocumentData({
        name: 'N',
        uri: 'U',
        description: 'd',
        include_in_report: false,
        picker_registration: { provider: 'google' },
      } as never);
      expect(data).toMatchObject({ picker_registration: { provider: 'google' } });
    });
  });

  describe('loadDocuments', () => {
    it('calls getDocumentsForThreatModel with the computed offset', () => {
      service.loadDocuments('tm1', 2, 10).subscribe();
      expect(threatModelService.getDocumentsForThreatModel).toHaveBeenCalledWith('tm1', 10, 20);
    });
    it('emits documents and total from the response', () => {
      let result: { documents: Document[]; total: number } | undefined;
      service.loadDocuments('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ documents: [{ id: 'd1' }], total: 1 });
    });
    it('defaults documents to [] and total to 0 when the response omits them', () => {
      threatModelService.getDocumentsForThreatModel.mockReturnValue(of({}));
      let result: { documents: Document[]; total: number } | undefined;
      service.loadDocuments('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ documents: [], total: 0 });
    });
  });

  describe('createDocument', () => {
    it('calls createDocument with the built data', () => {
      service
        .createDocument('tm1', { name: 'N', uri: 'U', description: '', include_in_report: true } as never)
        .subscribe();
      expect(threatModelService.createDocument).toHaveBeenCalledWith('tm1', {
        name: 'N',
        uri: 'U',
        description: undefined,
        include_in_report: true,
      });
    });
  });

  describe('updateDocument', () => {
    it('calls updateDocument with id and built data, emits the updated document', () => {
      let updated: Document | undefined;
      service
        .updateDocument('tm1', 'd1', { name: 'New', uri: 'U', description: 'd', include_in_report: true } as never)
        .subscribe(d => (updated = d));
      expect(threatModelService.updateDocument).toHaveBeenCalledWith('tm1', 'd1', {
        name: 'New',
        uri: 'U',
        description: 'd',
        include_in_report: true,
      });
      expect(updated).toEqual({ id: 'd1', name: 'New' });
    });
  });

  describe('deleteDocument', () => {
    it('calls deleteDocument and emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteDocument('tm1', 'd1').subscribe(v => (ok = v));
      expect(threatModelService.deleteDocument).toHaveBeenCalledWith('tm1', 'd1');
      expect(ok).toBe(true);
    });
  });

  describe('updateDocumentMetadata', () => {
    it('calls updateDocumentMetadata and emits the updated metadata', () => {
      let meta: unknown;
      service.updateDocumentMetadata('tm1', 'd1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateDocumentMetadata).toHaveBeenCalledWith('tm1', 'd1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/app/pages/tm/services/tm-document-crud.service.spec.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

Create `src/app/pages/tm/services/tm-document-crud.service.ts`. Read `tm-edit.component.ts`'s import block and `threat-model.service.ts` to confirm the exact type names — `DocumentEditorDialogResult['values']` is the editor form-value shape; `Document`, `Metadata` are in `threat-model.model`. Use `calculateOffset` from `@app/shared/utils/pagination.util` (the path the component uses).

```typescript
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService } from './threat-model.service';
import { Document, Metadata } from '../models/threat-model.model';
import { DocumentEditorDialogResult } from '../components/document-editor-dialog/document-editor-dialog.component';

/** Documents loaded for one page of the documents sub-table. */
export interface DocumentsPage {
  documents: Document[];
  total: number;
}

/**
 * Document CRUD orchestration extracted from TmEditComponent. Owns the
 * editor-form-value mapping and the ThreatModelService calls. Does NOT touch
 * MatTableDataSource or pagination view state — methods return data/Observables
 * and the component applies them.
 */
@Injectable({ providedIn: 'root' })
export class TmDocumentCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Tooltip text for a document list item: uri plus optional description. */
  getDocumentTooltip(document: Document): string {
    let tooltip = document.uri;
    if (document.description) {
      tooltip += `\n\n${document.description}`;
    }
    return tooltip;
  }

  /** Map document editor form values to a Partial<Document> for the API. */
  buildDocumentData(values: DocumentEditorDialogResult['values']): Partial<Document> {
    return {
      name: values.name,
      uri: values.uri,
      description: values.description || undefined,
      include_in_report: values.include_in_report,
      ...(values.picker_registration
        ? { picker_registration: values.picker_registration }
        : {}),
    };
  }

  /** Load one page of documents for a threat model. */
  loadDocuments(
    threatModelId: string,
    pageIndex: number,
    pageSize: number,
  ): Observable<DocumentsPage> {
    const offset = calculateOffset(pageIndex, pageSize);
    return this.threatModelService
      .getDocumentsForThreatModel(threatModelId, pageSize, offset)
      .pipe(
        map(response => ({
          documents: response.documents ?? [],
          total: response.total ?? 0,
        })),
      );
  }

  /** Create a document from editor form values. */
  createDocument(
    threatModelId: string,
    values: DocumentEditorDialogResult['values'],
  ): Observable<Document> {
    return this.threatModelService.createDocument(threatModelId, this.buildDocumentData(values));
  }

  /** Update a document from editor form values; emits the updated document. */
  updateDocument(
    threatModelId: string,
    documentId: string,
    values: DocumentEditorDialogResult['values'],
  ): Observable<Document> {
    return this.threatModelService.updateDocument(
      threatModelId,
      documentId,
      this.buildDocumentData(values),
    );
  }

  /** Delete a document; emits the success boolean. */
  deleteDocument(threatModelId: string, documentId: string): Observable<boolean> {
    return this.threatModelService.deleteDocument(threatModelId, documentId);
  }

  /** Update a document's metadata; emits the updated metadata array. */
  updateDocumentMetadata(
    threatModelId: string,
    documentId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateDocumentMetadata(threatModelId, documentId, metadata);
  }
}
```

NOTE: `createDocument` returns `Observable<Document>` — confirm the real `ThreatModelService.createDocument` return type. If it returns something else (e.g. `Observable<void>` or the created doc), match the real signature; the test's mock returns `of({ id: 'd9' })`, adjust the mock and the declared return type to whatever the real method actually emits. The component's `addDocument` ignores `createDocument`'s emitted value (it just calls `loadDocuments` on `next`), so the exact emitted type is not load-bearing for the component — but the declared type must match the real service.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/app/pages/tm/services/tm-document-crud.service.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/services/tm-document-crud.service.ts src/app/pages/tm/services/tm-document-crud.service.spec.ts
git commit -m "refactor: add TmDocumentCrudService for document CRUD orchestration (#695)"
```

---

### Task 10: Wire TmEditComponent to the document services

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.ts`

Rewrite the 8 document methods as thin glue: open dialog via `TmDialogService`, on result call `TmDocumentCrudService`, on success apply the view-state mutation, on error call `logger.error`. The dialog-`open`/`afterClosed` plumbing moves into `TmDialogService`; the result-mapping/API calls move into `TmDocumentCrudService`; only the view-state writes and permission guards stay.

- [ ] **Step 1: Inject the two services**

Add imports near the other `./services/...` imports:
```typescript
import { TmDialogService } from './services/tm-dialog.service';
import { TmDocumentCrudService } from './services/tm-document-crud.service';
```
Add to the constructor parameter list (after `private autoSaveService: TmEditAutoSaveService,`):
```typescript
    private dialogService: TmDialogService,
    private documentCrud: TmDocumentCrudService,
```

- [ ] **Step 2: Rewrite `loadDocuments`, `onDocumentsPageChange`, `getDocumentTooltip`**

```typescript
  private loadDocuments(threatModelId: string): void {
    this._subscriptions.add(
      this.documentCrud
        .loadDocuments(threatModelId, this.documentsPageIndex, this.documentsPageSize)
        .subscribe({
          next: page => {
            if (this.threatModel) {
              this.threatModel.documents = page.documents;
              this.documentsDataSource.data = page.documents;
              this.totalDocuments = page.total;
            }
          },
          error: error => this.logger.error('Failed to load documents', error),
        }),
    );
  }
```
`onDocumentsPageChange` is unchanged (it sets the page fields and calls `loadDocuments`). `getDocumentTooltip` delegates:
```typescript
  getDocumentTooltip(document: Document): string {
    return this.documentCrud.getDocumentTooltip(document);
  }
```

- [ ] **Step 3: Rewrite `addDocument` and `onDocumentUrlDropped`**

```typescript
  addDocument(uri?: string): void {
    if (!this.canEdit) {
      this.logger.warn('Cannot add document - insufficient permissions');
      return;
    }
    const dialogData: DocumentEditorDialogData = {
      mode: 'create',
      isReadOnly: !this.canEdit,
      threatModelId: this.threatModel?.id,
      ...(uri ? { document: { uri } as Document } : {}),
    };

    this._subscriptions.add(
      this.dialogService.openDocumentEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;

        // Service-mode: the dialog already created the document in-place.
        if (result.createdDocument) {
          this.loadDocuments(this.threatModel.id);
          return;
        }

        this._subscriptions.add(
          this.documentCrud.createDocument(this.threatModel.id, result.values).subscribe({
            next: () => {
              if (this.threatModel) {
                this.loadDocuments(this.threatModel.id);
              }
            },
            error: error => this.logger.error('Failed to create document', error),
          }),
        );
      }),
    );
  }
```
`onDocumentUrlDropped` is unchanged (guards on `canEdit`/`dialog.openDialogs.length`, calls `addDocument(url)`). The `this.dialog.openDialogs` reference in `onDocumentUrlDropped` still uses the component's `MatDialog` — that is fine; `TmDialogService` does not need to expose `openDialogs`.

- [ ] **Step 4: Rewrite `editDocument` (adds the error handler — behavior fix)**

```typescript
  editDocument(document: Document, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel) {
      return;
    }

    const dialogData: DocumentEditorDialogData = {
      document,
      mode: 'edit',
      isReadOnly: !this.canEdit,
      threatModelId: this.threatModel.id,
    };

    this._subscriptions.add(
      this.dialogService.openDocumentEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;

        this._subscriptions.add(
          this.documentCrud
            .updateDocument(this.threatModel.id, document.id, result.values)
            .subscribe({
              next: updatedDocument => {
                if (this.threatModel && this.threatModel.documents) {
                  const index = this.threatModel.documents.findIndex(d => d.id === document.id);
                  if (index !== -1) {
                    this.threatModel.documents[index] = updatedDocument;
                  }
                  this.documentsDataSource.data = this.threatModel.documents;
                }
              },
              error: error => this.logger.error('Failed to update document', error),
            }),
        );
      }),
    );
  }
```

- [ ] **Step 5: Rewrite `deleteDocument` (adds the error handler — behavior fix)**

```typescript
  deleteDocument(document: Document, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.canEdit) {
      this.logger.warn('Cannot delete document - insufficient permissions');
      return;
    }

    if (!this.threatModel || !this.threatModel.documents) {
      return;
    }

    const dialogData: DeleteConfirmationDialogData = {
      id: document.id,
      name: document.name,
      objectType: 'document',
    };

    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel) return;

        this._subscriptions.add(
          this.documentCrud.deleteDocument(this.threatModel.id, document.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.documents) {
                this.threatModel.documents = this.threatModel.documents.filter(
                  d => d.id !== document.id,
                );
                this.documentsDataSource.data = this.threatModel.documents;
              }
            },
            error: error => this.logger.error('Failed to delete document', error),
          }),
        );
      }),
    );
  }
```

- [ ] **Step 6: Rewrite `openDocumentMetadataDialog` (adds the error handler — behavior fix)**

```typescript
  openDocumentMetadataDialog(document: Document, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: document.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Document',
      objectName: `${this.transloco.translate('common.objectTypes.document')}: ${document.name} (${document.id})`,
    };

    this._subscriptions.add(
      this.dialogService.openMetadata(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;

        this._subscriptions.add(
          this.documentCrud
            .updateDocumentMetadata(this.threatModel.id, document.id, result)
            .subscribe({
              next: updatedMetadata => {
                if (updatedMetadata && this.threatModel && this.threatModel.documents) {
                  const documentIndex = this.threatModel.documents.findIndex(
                    d => d.id === document.id,
                  );
                  if (documentIndex !== -1) {
                    this.threatModel.documents[documentIndex].metadata = updatedMetadata;
                  }
                  this.logger.info('Updated document metadata via API', {
                    documentId: document.id,
                    metadata: updatedMetadata,
                  });
                }
              },
              error: error => this.logger.error('Failed to update document metadata', error),
            }),
        );
      }),
    );
  }
```

- [ ] **Step 7: Remove now-unused imports**

After the rewrites, the component may no longer directly reference `DocumentEditorDialogComponent`, `DeleteConfirmationDialogComponent`, `DocumentEditorDialogResult` (the result type is now consumed by the services). It DOES still reference `DocumentEditorDialogData`, `DeleteConfirmationDialogData`, `MetadataDialogData` (the component still builds the dialog-data objects). `MetadataDialogComponent` may still be used by OTHER entity metadata dialogs that are not part of this task — do NOT remove an import another method still uses. Verify each with `rg -n '<Name>' src/app/pages/tm/tm-edit.component.ts` and remove only genuinely-unused ones.

- [ ] **Step 8: Build, test, lint**

Run: `pnpm run build` — must succeed.
Run: `pnpm test` — full suite (`vitest run`) must pass.
Run: `pnpm run lint:all` — zero errors.

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.ts
git commit -m "refactor: delegate tm-edit document CRUD to TmDocumentCrudService (#695)

Also adds missing error handlers to the document edit/delete/metadata
flows, whose underlying service calls throw on API failure."
```

---

### Task 11: Phase 4 verification + decision gate

- [ ] **Step 1: Measure the result**

Report: `tm-edit.component.ts` line count before/after Phase 4; new unit-test count added by `TmDialogService` + `TmDocumentCrudService` specs; whether the three mutation styles or view-state ownership caused any friction during Task 10.

- [ ] **Step 2: Confirm the error-handler fix landed**

Confirm `editDocument`, `deleteDocument`, `openDocumentMetadataDialog` each now have an `error` callback in their innermost subscribe. This is the user-approved behavior change.

- [ ] **Step 3: Re-scope decision (STOP)**

Present to the user: the actual component reduction from documents-only, and a re-estimate for the remaining five entity groups (threats, diagrams, repositories, notes, assets) based on real data. Recommend whether to continue (and in what order — the spike suggests threats second, as the likely-messiest group) or stop. Do NOT start any further entity extraction without approval.

## Phase 4 Self-Review

**Spec coverage:** Documents-only extraction (user's choice) — Tasks 8–10. Error-handler fix (user's choice) — folded into Task 10 Steps 4–6 and verified in Task 11 Step 2. Decision gate — Task 11 Step 3. ✓

**Placeholder scan:** All code steps show full code. Two NOTE blocks flag real verification points (exact dialog import paths, `createDocument` return type) — these are "verify against the real source" instructions, not placeholders. ✓

**Type consistency:** `DocumentsPage` defined in `tm-document-crud.service.ts` (Task 9), not re-exported elsewhere. `TmDialogService` method names (`openDocumentEditor`, `openDeleteConfirmation`, `openMetadata`) consistent between Task 8 definition and Task 10 call sites. `TmDocumentCrudService` method names (`loadDocuments`, `createDocument`, `updateDocument`, `deleteDocument`, `updateDocumentMetadata`, `getDocumentTooltip`, `buildDocumentData`) consistent between Task 9 and Task 10. ✓

**View-state boundary:** Verified — no Task-9 service method touches `documentsDataSource`, `documentsPageIndex/Size`, or `totalDocuments`; all such writes are in Task 10's component code. ✓

---

## Phase 5 — Remaining entity-group CRUD extraction

> Added 2026-05-17 after the Phase 4 documents extraction landed and the user approved continuing. This phase extends the proven documents template (`TmDialogService` wrapper + per-entity `Tm<Entity>CrudService`) to the remaining five entity groups. Implementation order is **diagrams → threats → repositories → notes → assets**. Threats is intentionally early (second) because the Phase 3 spike flagged it as the messiest group — server-side filter/sort/pagination state plus a `ThreatFilterStateService`.

**Decisions locked in (same as Phase 4, restated for self-containment):**
- Per-entity services (`TmDiagramCrudService`, `TmThreatCrudService`, `TmRepositoryCrudService`, `TmNoteCrudService`, `TmAssetCrudService`), each `@Injectable({ providedIn: 'root' })`.
- The existing `TmDialogService` is extended with new per-entity editor-dialog wrapper methods. `openDeleteConfirmation` and `openMetadata` already exist and are reused as-is — **do not duplicate them**. The metadata dialog config in `openMetadata` (`width: '90vw'`, `maxWidth: '800px'`, `minWidth: '500px'`, `maxHeight: '80vh'`, no `disableClose`) exactly matches every entity's inline metadata dialog, so all five reuse it.
- **View state stays in the component.** `MatTableDataSource` instances (`diagramsDataSource`, `threatsDataSource`, `repositoriesDataSource`, `notesDataSource`, `assetsDataSource`), pagination fields (`<entity>PageIndex/Size`, `total<Entity>`), threat filter/sort state, the `diagrams` getter/setter + `_diagrams`, SVG caches (`diagramSvgValidation`, `diagramSvgDataUrls`, `svgCacheService`), and the `DIAGRAMS_BY_ID` module-level map are all view/UI infrastructure. CRUD services must not touch them — services return data/Observables, the component subscribes and applies view state.
- **Error-handler fix is in scope** (user-approved, same as Phase 4). Every extracted innermost `.subscribe(...)` against a `throw`-ing service method that currently lacks an `error` callback gets one that calls `this.logger.error`. The missing handlers found per group are listed in each entity's wiring task.
- Mutation styles (in-place index replace, immutable `filter`, nested-field write) are preserved exactly as the originals — not unified.

### File Structure (Phase 5)

| File | Responsibility |
|------|----------------|
| `src/app/pages/tm/services/tm-dialog.service.ts` | MODIFY — add `openDiagramCreate`, `openThreatEditor`, `openRepositoryEditor`, `openNoteEditor`, `openAssetEditor` |
| `src/app/pages/tm/services/tm-dialog.service.spec.ts` | MODIFY — specs for the five new methods |
| `src/app/pages/tm/services/tm-diagram-crud.service.ts` (+ `.spec.ts`) | NEW — diagram CRUD orchestration |
| `src/app/pages/tm/services/tm-threat-crud.service.ts` (+ `.spec.ts`) | NEW — threat CRUD orchestration, including `ThreatListParams` building |
| `src/app/pages/tm/services/tm-repository-crud.service.ts` (+ `.spec.ts`) | NEW — repository CRUD orchestration |
| `src/app/pages/tm/services/tm-note-crud.service.ts` (+ `.spec.ts`) | NEW — note CRUD orchestration |
| `src/app/pages/tm/services/tm-asset-crud.service.ts` (+ `.spec.ts`) | NEW — asset CRUD orchestration |
| `src/app/pages/tm/tm-edit.component.ts` | MODIFY — inject the five services, delegate each entity group to thin glue |

### Verified facts the implementer must rely on

**`ThreatModelService` signatures (read `src/app/pages/tm/services/threat-model.service.ts` to confirm):**
- `getDiagramsForThreatModel(tmId, limit?, offset?): Observable<ListDiagramsResponse>` — `{ diagrams: Diagram[]; total; limit; offset }`.
- `createDiagram(tmId, diagram: Partial<ApiBaseDiagramInput>): Observable<Diagram>`
- `deleteDiagram(tmId, diagramId): Observable<boolean>`
- `getDiagramMetadata(tmId, diagramId): Observable<Metadata[]>` / `updateDiagramMetadata(tmId, diagramId, metadata): Observable<Metadata[]>`
- `getDiagramModel(tmId, diagramId, format): Observable<string>`
- `getThreatsForThreatModel(tmId, listParams?: ThreatListParams): Observable<ListThreatsResponse>` — `{ threats: Threat[]; total; limit; offset }`.
- `createThreat(tmId, threat: Partial<ApiThreatInput>): Observable<Threat>` / `updateThreat(tmId, threatId, threat: Partial<ApiThreatInput>): Observable<Threat>` / `deleteThreat(tmId, threatId): Observable<boolean>`
- `updateThreatMetadata(tmId, threatId, metadata): Observable<Metadata[]>`
- `getRepositoriesForThreatModel(tmId, limit?, offset?): Observable<ListRepositoriesResponse>` — `{ repositories: Repository[]; total; ... }`.
- `createRepository(tmId, repository: Partial<ApiRepositoryInput>): Observable<Repository>` / `updateRepository(tmId, repositoryId, repository: Partial<ApiRepositoryInput>): Observable<Repository>` / `deleteRepository(tmId, repositoryId): Observable<boolean>`
- `updateRepositoryMetadata(tmId, repositoryId, metadata): Observable<Metadata[]>`
- `getNotesForThreatModel(tmId, limit?, offset?): Observable<ListNotesResponse>` — `{ notes: Note[]; total; ... }`.
- `createNote(tmId, note: Partial<ApiNoteInput>): Observable<Note>` / `updateNote(tmId, noteId, note: Partial<ApiNoteInput>): Observable<Note>` / `deleteNote(tmId, noteId): Observable<boolean>`
- `updateNoteMetadata(tmId, noteId, metadata): Observable<Metadata[]>`
- `getAssetsForThreatModel(tmId, limit?, offset?): Observable<ListAssetsResponse>` — `{ assets: Asset[]; total; ... }`.
- `createAsset(tmId, asset: Partial<ApiAssetInput>): Observable<Asset>` / `updateAsset(tmId, assetId, asset: Partial<ApiAssetInput>): Observable<Asset>` / `deleteAsset(tmId, assetId): Observable<boolean>`
- `updateAssetMetadata(tmId, assetId, metadata): Observable<Metadata[]>`

All `create*`/`update*`/`delete*`/`*Metadata` methods `throw` in their `catchError` — they require an `error` callback at the subscribe site. The `get*ForThreatModel` list methods swallow errors (`catchError` returns an empty response), so `load*` subscriptions do not strictly need an `error` callback, but the existing `loadAssets`/`loadNotes`/`loadThreats` already supply one defensively — preserve that.

**Dialog component facts (read each component file to confirm import paths):**
- `CreateDiagramDialogComponent` — `./components/create-diagram-dialog/create-diagram-dialog.component`. `CreateDiagramDialogData` is **not exported** (`{ threatModelName: string }`). `afterClosed()` emits `{ name: string; type: string } | undefined`. No `disableClose` in the original `addDiagram`.
- `ThreatEditorDialogComponent`, `ThreatEditorDialogData` — `./components/threat-editor-dialog/threat-editor-dialog.component`. No exported result type; `afterClosed()` is typed `Partial<Threat>` via the generic `dialog.open<ThreatEditorDialogComponent, ThreatEditorDialogData, Partial<Threat>>`. Original config: `width: '650px'`, `maxHeight: '90vh'`, `panelClass: 'threat-editor-dialog-650'`, no `disableClose`.
- `RepositoryEditorDialogComponent`, `RepositoryEditorDialogData` — `./components/repository-editor-dialog/repository-editor-dialog.component`. No exported result type; `afterClosed()` result is typed by the component-local `RepositoryFormResult` interface (defined at `tm-edit.component.ts:131`). Original config: `width: '700px'`, no `disableClose`.
- `NoteEditorDialogComponent`, `NoteEditorDialogData`, `NoteEditorResult`, `NoteFormResult` — `@app/shared/components/note-editor-dialog/note-editor-dialog.component`. `afterClosed()` emits `NoteEditorResult | undefined`. The dialog also exposes `componentInstance.saveEvent: EventEmitter<NoteFormResult>` and `componentInstance.setCreatedNoteId(id)`. Original config: `width: '90vw'`, `maxWidth: '900px'`, `minWidth: '600px'`, `maxHeight: '90vh'`, no `disableClose`.
- `AssetEditorDialogComponent`, `AssetEditorDialogData` — `./components/asset-editor-dialog/asset-editor-dialog.component`. No exported result type; `afterClosed()` emits `Partial<Asset> | undefined`. Original config: `width: '600px'`, `maxHeight: '90vh'`, no `disableClose`.

---

### Task 12: Add diagram + threat + repository + note + asset editor wrappers to `TmDialogService`

**Files:**
- Modify: `src/app/pages/tm/services/tm-dialog.service.ts`
- Modify: `src/app/pages/tm/services/tm-dialog.service.spec.ts`

All five new wrapper methods are added in one task because they are mechanically identical to the existing `openDocumentEditor` (open one dialog type, return its typed `afterClosed()`). `openDeleteConfirmation` and `openMetadata` are NOT touched — every entity reuses them.

- [ ] **Step 1: Extend the spec**

Add to `src/app/pages/tm/services/tm-dialog.service.spec.ts` (the existing `beforeEach` already builds `open`/`afterClosed` mocks):

```typescript
  it('openDiagramCreate opens CreateDiagramDialogComponent with width 400px', () => {
    const data = { threatModelName: 'TM' } as never;
    service.openDiagramCreate(data).subscribe();
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('400px');
    expect(config.data).toBe(data);
    expect(config.disableClose).toBeUndefined();
  });

  it('openThreatEditor opens ThreatEditorDialogComponent with width 650px and the documented panelClass', () => {
    const data = { mode: 'create' } as never;
    service.openThreatEditor(data).subscribe();
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('650px');
    expect(config.maxHeight).toBe('90vh');
    expect(config.panelClass).toBe('threat-editor-dialog-650');
    expect(config.data).toBe(data);
  });

  it('openRepositoryEditor opens RepositoryEditorDialogComponent with width 700px', () => {
    const data = { mode: 'create' } as never;
    service.openRepositoryEditor(data).subscribe();
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('700px');
    expect(config.data).toBe(data);
  });

  it('openNoteEditor opens NoteEditorDialogComponent with the documented sizing', () => {
    const data = { mode: 'create', entityType: 'threat_model' } as never;
    service.openNoteEditor(data).subscribe();
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('90vw');
    expect(config.maxWidth).toBe('900px');
    expect(config.minWidth).toBe('600px');
    expect(config.maxHeight).toBe('90vh');
    expect(config.data).toBe(data);
  });

  it('openAssetEditor opens AssetEditorDialogComponent with width 600px and maxHeight 90vh', () => {
    const data = { mode: 'create' } as never;
    service.openAssetEditor(data).subscribe();
    const [, config] = open.mock.calls[0];
    expect(config.width).toBe('600px');
    expect(config.maxHeight).toBe('90vh');
    expect(config.data).toBe(data);
  });
```

NOTE: `openNoteEditor` returns the dialog's `MatDialogRef`, not just `afterClosed()` — the component needs `componentInstance.saveEvent` and `componentInstance.setCreatedNoteId`. Adjust the `openNoteEditor` spec accordingly: assert `open` was called and the returned object exposes `afterClosed`/`componentInstance` (the mock from `beforeEach` returns `{ afterClosed }`; extend that mock object inline in this test with a `componentInstance` stub if the implementation reads it). See Step 2's `openNoteEditor` signature.

- [ ] **Step 2: Run the spec to verify the new cases fail**

Run: `pnpm test -- src/app/pages/tm/services/tm-dialog.service.spec.ts`
Expected: the five new cases FAIL (methods do not exist); the three Phase-4 cases still PASS.

- [ ] **Step 3: Add the five methods to `TmDialogService`**

Add these imports to `tm-dialog.service.ts`:

```typescript
import { MatDialogRef } from '@angular/material/dialog';

import { CreateDiagramDialogComponent } from '../components/create-diagram-dialog/create-diagram-dialog.component';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../components/threat-editor-dialog/threat-editor-dialog.component';
import {
  RepositoryEditorDialogComponent,
  RepositoryEditorDialogData,
} from '../components/repository-editor-dialog/repository-editor-dialog.component';
import {
  NoteEditorDialogComponent,
  NoteEditorDialogData,
} from '@app/shared/components/note-editor-dialog/note-editor-dialog.component';
import {
  AssetEditorDialogComponent,
  AssetEditorDialogData,
} from '../components/asset-editor-dialog/asset-editor-dialog.component';
import { Threat, Asset } from '../models/threat-model.model';
```

`CreateDiagramDialogData` is not exported by the dialog component. Declare a local input type in `tm-dialog.service.ts` matching the dialog's `MAT_DIALOG_DATA` shape:

```typescript
/** Input for the create-diagram dialog (CreateDiagramDialogData is not exported). */
export interface DiagramCreateDialogData {
  threatModelName: string;
}

/** Result emitted by the create-diagram dialog's afterClosed(). */
export interface DiagramCreateDialogResult {
  name: string;
  type: string;
}
```

Add the five methods inside the class:

```typescript
  /** Open the create-diagram dialog. */
  openDiagramCreate(
    data: DiagramCreateDialogData,
  ): Observable<DiagramCreateDialogResult | undefined> {
    return this.dialog
      .open<
        CreateDiagramDialogComponent,
        DiagramCreateDialogData,
        DiagramCreateDialogResult
      >(CreateDiagramDialogComponent, { width: '400px', data })
      .afterClosed();
  }

  /** Open the threat editor dialog (create mode — edit navigates to a page). */
  openThreatEditor(data: ThreatEditorDialogData): Observable<Partial<Threat> | undefined> {
    return this.dialog
      .open<ThreatEditorDialogComponent, ThreatEditorDialogData, Partial<Threat>>(
        ThreatEditorDialogComponent,
        {
          width: '650px',
          maxHeight: '90vh',
          panelClass: 'threat-editor-dialog-650',
          data,
        },
      )
      .afterClosed();
  }

  /** Open the repository editor dialog (create or edit mode). */
  openRepositoryEditor(
    data: RepositoryEditorDialogData,
  ): Observable<RepositoryFormResult | undefined> {
    return this.dialog
      .open<
        RepositoryEditorDialogComponent,
        RepositoryEditorDialogData,
        RepositoryFormResult
      >(RepositoryEditorDialogComponent, { width: '700px', data })
      .afterClosed();
  }

  /**
   * Open the note editor dialog. Returns the MatDialogRef (not just
   * afterClosed()) because the addNote flow subscribes to
   * componentInstance.saveEvent and calls componentInstance.setCreatedNoteId.
   */
  openNoteEditor(data: NoteEditorDialogData): MatDialogRef<NoteEditorDialogComponent> {
    return this.dialog.open<NoteEditorDialogComponent, NoteEditorDialogData>(
      NoteEditorDialogComponent,
      {
        width: '90vw',
        maxWidth: '900px',
        minWidth: '600px',
        maxHeight: '90vh',
        data,
      },
    );
  }

  /** Open the asset editor dialog (create or edit mode). */
  openAssetEditor(data: AssetEditorDialogData): Observable<Partial<Asset> | undefined> {
    return this.dialog
      .open<AssetEditorDialogComponent, AssetEditorDialogData, Partial<Asset>>(
        AssetEditorDialogComponent,
        { width: '600px', maxHeight: '90vh', data },
      )
      .afterClosed();
  }
```

`RepositoryFormResult` is currently a component-local interface (`tm-edit.component.ts:131`). Move it into `tm-dialog.service.ts` and export it (the repository CRUD service and the component both need it). Add to `tm-dialog.service.ts`:

```typescript
/** Form result emitted by the repository editor dialog's afterClosed(). */
export interface RepositoryFormResult {
  name: string;
  description?: string;
  type: 'git' | 'svn' | 'mercurial' | 'other';
  uri: string;
  parameters?: {
    refType: 'branch' | 'tag' | 'commit';
    refValue: string;
    subPath?: string;
  };
  include_in_report?: boolean;
}
```

The component's local `RepositoryFormResult` interface (lines 131–142) is deleted in Task 16 Step 1 and re-imported from the service.

NOTE: `openNoteEditor` deliberately deviates from the other wrappers — it returns the `MatDialogRef` rather than `afterClosed()`. This is unavoidable: `addNote` wires `dialogRef.componentInstance.saveEvent` and calls `setCreatedNoteId`. Wrapping `afterClosed()` only would hide the `componentInstance` the component still needs.

- [ ] **Step 4: Run the spec to verify all cases pass**

Run: `pnpm test -- src/app/pages/tm/services/tm-dialog.service.spec.ts`
Expected: PASS (8 cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/services/tm-dialog.service.ts src/app/pages/tm/services/tm-dialog.service.spec.ts
git commit -m "refactor: add diagram/threat/repository/note/asset dialog wrappers to TmDialogService (#695)"
```

---

### Task 13: Create `TmDiagramCrudService` and wire the component

**Files:**
- Create: `src/app/pages/tm/services/tm-diagram-crud.service.ts` (+ `.spec.ts`)
- Modify: `src/app/pages/tm/tm-edit.component.ts`

**Structural surprise — diagrams has NO edit method.** Editing a diagram navigates to the DFD editor (`openThreatEditor`-style navigation lives elsewhere); there is no `editDiagram` and no `updateDiagram` call in the diagram CRUD flow. The diagram CRUD surface is therefore: `loadDiagrams`, `createDiagram`, `deleteDiagram`, `updateDiagramMetadata`, plus `getDiagramMetadata` (the metadata dialog fetches metadata from the API first because the list endpoint omits it — see `openDiagramMetadataDialog`). `downloadDiagramModel`/`handleDiagramModelExport`/`getFileTypesForFormat` involve `getDiagramModel` but are dominated by browser File System Access API logic — extract only the `getDiagramModel` API call; the blob/file-picker code stays in the component.

**View state that stays in the component:** the `diagrams` getter/setter and `_diagrams`, `diagramsDataSource`, `diagramsPageIndex/Size`, `totalDiagrams`, `DIAGRAMS_BY_ID` map writes, `diagramSvgValidation`, `diagramSvgDataUrls`, `svgCacheService`, `computeDiagramSvgData`, `hasSvgImage`, `getSvgDataUrl`, `onThumbnailHover`, `getHoveredDiagramSvgUrl`, `getDiagramIcon`/`getDiagramTooltip` (already delegated to `TmEditFormattingService`). None of this moves.

- [ ] **Step 1: Write the failing spec**

Create `src/app/pages/tm/services/tm-diagram-crud.service.spec.ts`:

```typescript
import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmDiagramCrudService } from './tm-diagram-crud.service';
import type { Diagram } from '../models/diagram.model';

describe('TmDiagramCrudService', () => {
  let service: TmDiagramCrudService;
  let threatModelService: {
    getDiagramsForThreatModel: ReturnType<typeof vi.fn>;
    createDiagram: ReturnType<typeof vi.fn>;
    deleteDiagram: ReturnType<typeof vi.fn>;
    getDiagramMetadata: ReturnType<typeof vi.fn>;
    updateDiagramMetadata: ReturnType<typeof vi.fn>;
    getDiagramModel: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      getDiagramsForThreatModel: vi
        .fn()
        .mockReturnValue(of({ diagrams: [{ id: 'g1' }], total: 1 })),
      createDiagram: vi.fn().mockReturnValue(of({ id: 'g9' })),
      deleteDiagram: vi.fn().mockReturnValue(of(true)),
      getDiagramMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
      updateDiagramMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v2' }])),
      getDiagramModel: vi.fn().mockReturnValue(of('MODEL')),
    };
    service = new TmDiagramCrudService(threatModelService as never);
  });

  describe('loadDiagrams', () => {
    it('calls getDiagramsForThreatModel with the computed offset', () => {
      service.loadDiagrams('tm1', 2, 10).subscribe();
      expect(threatModelService.getDiagramsForThreatModel).toHaveBeenCalledWith('tm1', 10, 20);
    });
    it('emits diagrams and total, defaulting both when omitted', () => {
      threatModelService.getDiagramsForThreatModel.mockReturnValue(of({}));
      let result: { diagrams: Diagram[]; total: number } | undefined;
      service.loadDiagrams('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ diagrams: [], total: 0 });
    });
  });

  describe('createDiagram', () => {
    it('calls createDiagram with name and type', () => {
      service.createDiagram('tm1', { name: 'D', type: 'DFD-1.0.0' }).subscribe();
      expect(threatModelService.createDiagram).toHaveBeenCalledWith('tm1', {
        name: 'D',
        type: 'DFD-1.0.0',
      });
    });
  });

  describe('deleteDiagram', () => {
    it('calls deleteDiagram and emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteDiagram('tm1', 'g1').subscribe(v => (ok = v));
      expect(threatModelService.deleteDiagram).toHaveBeenCalledWith('tm1', 'g1');
      expect(ok).toBe(true);
    });
  });

  describe('getDiagramMetadata / updateDiagramMetadata', () => {
    it('forwards getDiagramMetadata', () => {
      let meta: unknown;
      service.getDiagramMetadata('tm1', 'g1').subscribe(m => (meta = m));
      expect(threatModelService.getDiagramMetadata).toHaveBeenCalledWith('tm1', 'g1');
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
    it('forwards updateDiagramMetadata', () => {
      let meta: unknown;
      service.updateDiagramMetadata('tm1', 'g1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateDiagramMetadata).toHaveBeenCalledWith('tm1', 'g1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v2' }]);
    });
  });

  describe('getDiagramModel', () => {
    it('forwards getDiagramModel with the format', () => {
      let content: string | undefined;
      service.getDiagramModel('tm1', 'g1', 'yaml').subscribe(c => (content = c));
      expect(threatModelService.getDiagramModel).toHaveBeenCalledWith('tm1', 'g1', 'yaml');
      expect(content).toBe('MODEL');
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `pnpm test -- src/app/pages/tm/services/tm-diagram-crud.service.spec.ts` — FAIL (cannot find module).

- [ ] **Step 3: Create the service**

Create `src/app/pages/tm/services/tm-diagram-crud.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService } from './threat-model.service';
import { Diagram } from '../models/diagram.model';
import { Metadata } from '../models/threat-model.model';
import type { ApiBaseDiagramInput } from '@app/generated/api-type-helpers';

/** Diagrams loaded for one page of the diagrams sub-table. */
export interface DiagramsPage {
  diagrams: Diagram[];
  total: number;
}

/**
 * Diagram CRUD orchestration extracted from TmEditComponent. Diagrams have no
 * edit method — editing navigates to the DFD editor. Does NOT touch
 * MatTableDataSource, the diagrams setter, DIAGRAMS_BY_ID, or SVG caches.
 */
@Injectable({ providedIn: 'root' })
export class TmDiagramCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Load one page of diagrams for a threat model. */
  loadDiagrams(
    threatModelId: string,
    pageIndex: number,
    pageSize: number,
  ): Observable<DiagramsPage> {
    const offset = calculateOffset(pageIndex, pageSize);
    return this.threatModelService
      .getDiagramsForThreatModel(threatModelId, pageSize, offset)
      .pipe(
        map(response => ({
          diagrams: response.diagrams ?? [],
          total: response.total ?? 0,
        })),
      );
  }

  /** Create a diagram from the create-dialog result. */
  createDiagram(
    threatModelId: string,
    values: { name: string; type: string },
  ): Observable<Diagram> {
    const data: Partial<ApiBaseDiagramInput> = {
      name: values.name,
      type: values.type as Diagram['type'],
    };
    return this.threatModelService.createDiagram(threatModelId, data);
  }

  /** Delete a diagram; emits the success boolean. */
  deleteDiagram(threatModelId: string, diagramId: string): Observable<boolean> {
    return this.threatModelService.deleteDiagram(threatModelId, diagramId);
  }

  /** Fetch a diagram's metadata (list endpoint omits it). */
  getDiagramMetadata(threatModelId: string, diagramId: string): Observable<Metadata[]> {
    return this.threatModelService.getDiagramMetadata(threatModelId, diagramId);
  }

  /** Update a diagram's metadata; emits the updated metadata array. */
  updateDiagramMetadata(
    threatModelId: string,
    diagramId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateDiagramMetadata(threatModelId, diagramId, metadata);
  }

  /** Fetch a diagram model as a string in the given export format. */
  getDiagramModel(
    threatModelId: string,
    diagramId: string,
    format: 'json' | 'yaml' | 'graphml',
  ): Observable<string> {
    return this.threatModelService.getDiagramModel(threatModelId, diagramId, format);
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `pnpm test -- src/app/pages/tm/services/tm-diagram-crud.service.spec.ts` — PASS.

- [ ] **Step 5: Wire the component**

In `tm-edit.component.ts`, add the import near the other `./services/...` imports and the constructor param after `private documentCrud: TmDocumentCrudService,`:

```typescript
import { TmDiagramCrudService } from './services/tm-diagram-crud.service';
// ...
    private diagramCrud: TmDiagramCrudService,
```

Rewrite `loadDiagrams` (the diagram setter still owns `diagramsDataSource`; keep the `DIAGRAMS_BY_ID` writes and `threatModel.diagrams` assignment in the component):

```typescript
  private loadDiagrams(threatModelId: string): void {
    this._subscriptions.add(
      this.diagramCrud
        .loadDiagrams(threatModelId, this.diagramsPageIndex, this.diagramsPageSize)
        .subscribe({
          next: page => {
            this.diagrams = page.diagrams;
            this.totalDiagrams = page.total;
            page.diagrams.forEach(diagram => DIAGRAMS_BY_ID.set(diagram.id, diagram));
            if (this.threatModel) {
              this.threatModel.diagrams = page.diagrams;
            }
          },
          error: error => this.logger.error('Failed to load diagrams', error),
        }),
    );
  }
```

Rewrite `addDiagram` — dialog via `TmDialogService.openDiagramCreate`, create via `TmDiagramCrudService`. The original `createDiagram` subscribe already has an `error` callback; preserve it:

```typescript
  addDiagram(): void {
    if (!this.canEdit) {
      this.logger.warn('Cannot add diagram - insufficient permissions');
      return;
    }
    this._subscriptions.add(
      this.dialogService
        .openDiagramCreate({ threatModelName: this.threatModel?.name || '' })
        .subscribe(diagramData => {
          if (!diagramData || !this.threatModel) return;
          this._subscriptions.add(
            this.diagramCrud.createDiagram(this.threatModel.id, diagramData).subscribe({
              next: created => {
                if (!this.threatModel) return;
                this.diagrams = [...this.diagrams, created];
                this.totalDiagrams = this.totalDiagrams + 1;
                this.threatModel.diagrams = [...(this.threatModel.diagrams ?? []), created];
              },
              error: error => this.logger.error('Failed to create diagram', error),
            }),
          );
        }),
    );
  }
```

Rewrite `deleteDiagram` — dialog via `TmDialogService.openDeleteConfirmation`, delete via `TmDiagramCrudService`. **Missing-error-handler fix:** the original `deleteDiagram` subscribe (single-arg `subscribe(success => ...)`) has no `error` callback against `deleteDiagram`, which `throw`s. Add one:

```typescript
  deleteDiagram(diagram: Diagram, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel || !this.threatModel.diagrams || !this.canEdit) {
      if (!this.canEdit) {
        this.logger.warn('Cannot delete diagram - insufficient permissions');
      }
      return;
    }

    const dialogData: DeleteConfirmationDialogData = {
      id: diagram.id,
      name: diagram.name,
      objectType: 'diagram',
    };

    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel) return;
        this._subscriptions.add(
          this.diagramCrud.deleteDiagram(this.threatModel.id, diagram.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.diagrams) {
                this.threatModel.diagrams = this.threatModel.diagrams.filter(
                  (d: string | Diagram) => (typeof d === 'string' ? d : d.id) !== diagram.id,
                );
                this.diagrams = this.diagrams.filter(d => d.id !== diagram.id);
                DIAGRAMS_BY_ID.delete(diagram.id);
              }
            },
            error: error => this.logger.error('Failed to delete diagram', error),
          }),
        );
      }),
    );
  }
```

Rewrite `openDiagramMetadataDialog` — fetch metadata via `TmDiagramCrudService.getDiagramMetadata`, open the metadata dialog via `TmDialogService.openMetadata`, update via `TmDiagramCrudService.updateDiagramMetadata`. **Missing-error-handler fix:** the original has no `error` callback on either `getDiagramMetadata` or `updateDiagramMetadata` (both `throw`). Add both:

```typescript
  openDiagramMetadataDialog(diagram: Diagram, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel) return;

    this._subscriptions.add(
      this.diagramCrud.getDiagramMetadata(this.threatModel.id, diagram.id).subscribe({
        next: metadata => {
          const dialogData: MetadataDialogData = {
            metadata: metadata || [],
            isReadOnly: !this.canEdit,
            objectType: 'Diagram',
            objectName: `${this.transloco.translate('common.objectTypes.diagram')}: ${diagram.name} (${diagram.id})`,
          };
          this._subscriptions.add(
            this.dialogService.openMetadata(dialogData).subscribe(result => {
              if (!result || !this.threatModel) return;
              this._subscriptions.add(
                this.diagramCrud
                  .updateDiagramMetadata(this.threatModel.id, diagram.id, result)
                  .subscribe({
                    next: updatedMetadata => {
                      if (updatedMetadata) {
                        this.logger.info('Updated diagram metadata via API', {
                          diagramId: diagram.id,
                          metadata: updatedMetadata,
                        });
                      }
                    },
                    error: error =>
                      this.logger.error('Failed to update diagram metadata', error),
                  }),
              );
            }),
          );
        },
        error: error => this.logger.error('Failed to fetch diagram metadata', error),
      }),
    );
  }
```

Rewrite `downloadDiagramModel` to source the model string from `TmDiagramCrudService.getDiagramModel` (the original already has an `error` callback — preserve it). `handleDiagramModelExport` and `getFileTypesForFormat` stay unchanged in the component:

```typescript
  downloadDiagramModel(diagram: Diagram, format: 'json' | 'yaml' | 'graphml'): void {
    if (!this.threatModel) {
      this.logger.warn('Cannot download diagram model: no threat model loaded');
      return;
    }
    this.logger.info('Downloading diagram model', {
      diagramId: diagram.id,
      diagramName: diagram.name,
      format,
    });
    this._subscriptions.add(
      this.diagramCrud.getDiagramModel(this.threatModel.id, diagram.id, format).subscribe({
        next: content => {
          const mimeType = this.formattingService.getMimeTypeForFormat(format);
          const extension = this.formattingService.getExtensionForFormat(format);
          const filename = this.formattingService.generateDiagramModelFilename(
            this.threatModel?.name,
            diagram.name,
            extension,
          );
          const blob = new Blob([content], { type: mimeType });
          this.handleDiagramModelExport(blob, filename, format).catch(error => {
            this.logger.error('Error downloading diagram model', error);
          });
        },
        error: error => this.logger.error('Error fetching diagram model from API', error),
      }),
    );
  }
```

`onDiagramsPageChange` is unchanged.

- [ ] **Step 6: Build, test, lint**

`pnpm run build` (must succeed) → `pnpm test` (full suite, must pass) → `pnpm run lint:all` (zero errors).

- [ ] **Step 7: Commit (both files)**

```bash
git add src/app/pages/tm/services/tm-diagram-crud.service.ts src/app/pages/tm/services/tm-diagram-crud.service.spec.ts src/app/pages/tm/tm-edit.component.ts
git commit -m "refactor: extract diagram CRUD into TmDiagramCrudService (#695)

Also adds missing error handlers to the diagram delete and metadata
flows, whose underlying service calls throw on API failure."
```

---

### Task 14: Create `TmThreatCrudService` and wire the component

**Files:**
- Create: `src/app/pages/tm/services/tm-threat-crud.service.ts` (+ `.spec.ts`)
- Modify: `src/app/pages/tm/tm-edit.component.ts`

**Structural surprises — threats is the messiest group:**
1. **Server-side filter/sort/pagination.** `loadThreats` builds a `ThreatListParams` object from `this.threatFilters` (a `ThreatFilters` object), `this.threatSortActive`/`threatSortDirection`, and the page fields. The `ThreatCrudService` takes these as an explicit, fully-typed parameter — it does NOT read component state.
2. **`ThreatFilterStateService`.** `loadThreatsAndSaveState`, `saveThreatCardState`, `restoreThreatCardState`, `onThreatNameFilterChange` (debounced via `threatNameFilterChanged$`), `onThreatFilterChange`, `onThreatSortChange`, `clearAllThreatFilters`, `toggleMitigatedFilter`, `updateThreatTypeOptions`, and the `hasActiveThreatFilters`/`hasAdvancedThreatFiltersActive` getters are all **filter UI state management** — they stay in the component. `ThreatFilterStateService` stays injected in the component. The CRUD service only owns the API calls.
3. **`migrateThreatFieldValues`.** `loadThreats` maps each returned threat through `this.formattingService.migrateThreatFieldValues(t)`. Note `ThreatModelService.getThreatsForThreatModel` already applies `migrateLegacyThreatFieldValues` internally — there are two migration passes. Preserve the component-side `formattingService.migrateThreatFieldValues` pass exactly (do not move it into the CRUD service; it depends on `TmEditFormattingService`, and keeping it at the component subscribe site matches the documents pattern of view-adjacent mapping). The CRUD service returns raw `ListThreatsResponse` threats.
4. **`openThreatEditor` has a create/edit split.** Edit navigates to `/tm/:id/threat/:threatId` (a route, no dialog) — that navigation stays in the component untouched. Only create-mode opens `ThreatEditorDialogComponent`. The dialog-data assembly pulls from `cellDataExtractionService`, `frameworks`, `threatModelForm` — that assembly stays in the component (it is view/form state); the CRUD service only receives the resulting `Partial<Threat>` dialog result.
5. **Two private result handlers.** `_handleCreateThreatResult` and `_handleEditThreatResult` build `Partial<ApiThreatInput>` via `_copyDefinedFields`. The field-copy mapping logic moves into the CRUD service as `buildCreateThreatData` / `buildUpdateThreatData`; `_copyDefinedFields` moves with them as a private helper. The component's thin glue calls these.

**View state that stays in the component:** `threatsDataSource`, `threatsPageIndex/Size`, `totalThreats`, `threatFilters`, `threatSortActive/Direction`, `showAdvancedThreatFilters`, `threatTypeOptions`, `threatNameFilterChanged$`, `threatFilterStateService`, `cellDataExtractionService`, `frameworks`, `updateFrameworkControlState()`.

- [ ] **Step 1: Write the failing spec**

Create `src/app/pages/tm/services/tm-threat-crud.service.spec.ts`:

```typescript
import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmThreatCrudService } from './tm-threat-crud.service';
import type { Threat } from '../models/threat-model.model';

describe('TmThreatCrudService', () => {
  let service: TmThreatCrudService;
  let threatModelService: {
    getThreatsForThreatModel: ReturnType<typeof vi.fn>;
    createThreat: ReturnType<typeof vi.fn>;
    updateThreat: ReturnType<typeof vi.fn>;
    deleteThreat: ReturnType<typeof vi.fn>;
    updateThreatMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      getThreatsForThreatModel: vi
        .fn()
        .mockReturnValue(of({ threats: [{ id: 't1' }], total: 1 })),
      createThreat: vi.fn().mockReturnValue(of({ id: 't9' })),
      updateThreat: vi.fn().mockReturnValue(of({ id: 't1', name: 'New' })),
      deleteThreat: vi.fn().mockReturnValue(of(true)),
      updateThreatMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
    };
    service = new TmThreatCrudService(threatModelService as never);
  });

  describe('buildThreatListParams', () => {
    it('builds limit/offset only when there is no sort or filter', () => {
      const params = service.buildThreatListParams({
        pageIndex: 1,
        pageSize: 20,
        sortActive: '',
        sortDirection: '',
        filters: {
          name: '',
          severities: [],
          statuses: [],
          priorities: [],
          threatTypes: [],
          mitigated: null,
        } as never,
      });
      expect(params).toEqual({ limit: 20, offset: 20 });
    });

    it('adds sort as "active:direction" and trims the name filter', () => {
      const params = service.buildThreatListParams({
        pageIndex: 0,
        pageSize: 10,
        sortActive: 'severity',
        sortDirection: 'desc',
        filters: {
          name: '  sql  ',
          severities: ['high'],
          statuses: [],
          priorities: [],
          threatTypes: [],
          mitigated: false,
        } as never,
      });
      expect(params).toMatchObject({
        limit: 10,
        offset: 0,
        sort: 'severity:desc',
        name: 'sql',
        severity: ['high'],
        mitigated: false,
      });
    });
  });

  describe('loadThreats', () => {
    it('passes the built params to getThreatsForThreatModel', () => {
      service
        .loadThreats('tm1', {
          pageIndex: 0,
          pageSize: 20,
          sortActive: '',
          sortDirection: '',
          filters: {
            name: '',
            severities: [],
            statuses: [],
            priorities: [],
            threatTypes: [],
            mitigated: null,
          } as never,
        })
        .subscribe();
      expect(threatModelService.getThreatsForThreatModel).toHaveBeenCalledWith('tm1', {
        limit: 20,
        offset: 0,
      });
    });

    it('emits threats and total, defaulting both when omitted', () => {
      threatModelService.getThreatsForThreatModel.mockReturnValue(of({}));
      let result: { threats: Threat[]; total: number } | undefined;
      service
        .loadThreats('tm1', {
          pageIndex: 0,
          pageSize: 20,
          sortActive: '',
          sortDirection: '',
          filters: {
            name: '',
            severities: [],
            statuses: [],
            priorities: [],
            threatTypes: [],
            mitigated: null,
          } as never,
        })
        .subscribe(r => (result = r));
      expect(result).toEqual({ threats: [], total: 0 });
    });
  });

  describe('createThreat', () => {
    it('defaults severity/status/mitigated and copies defined optional fields', () => {
      service.createThreat('tm1', { name: 'N', score: 5 } as never).subscribe();
      expect(threatModelService.createThreat).toHaveBeenCalledWith('tm1', {
        name: 'N',
        description: undefined,
        severity: 'high',
        threat_type: [],
        mitigated: false,
        status: 'open',
        metadata: [],
        score: 5,
      });
    });
  });

  describe('updateThreat', () => {
    it('falls back to the existing threat severity/threat_type and emits the updated threat', () => {
      let updated: Threat | undefined;
      service
        .updateThreat(
          'tm1',
          { id: 't1', severity: 'low', threat_type: ['Spoofing'] } as never,
          { name: 'New' } as never,
        )
        .subscribe(t => (updated = t));
      expect(threatModelService.updateThreat).toHaveBeenCalledWith('tm1', 't1', {
        name: 'New',
        description: undefined,
        severity: 'low',
        threat_type: ['Spoofing'],
      });
      expect(updated).toEqual({ id: 't1', name: 'New' });
    });
  });

  describe('deleteThreat', () => {
    it('calls deleteThreat and emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteThreat('tm1', 't1').subscribe(v => (ok = v));
      expect(threatModelService.deleteThreat).toHaveBeenCalledWith('tm1', 't1');
      expect(ok).toBe(true);
    });
  });

  describe('updateThreatMetadata', () => {
    it('forwards updateThreatMetadata', () => {
      let meta: unknown;
      service.updateThreatMetadata('tm1', 't1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateThreatMetadata).toHaveBeenCalledWith('tm1', 't1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails** — FAIL (cannot find module).

- [ ] **Step 3: Create the service**

Create `src/app/pages/tm/services/tm-threat-crud.service.ts`. Read `tm-edit.component.ts` lines 1047–1129 for the exact `_copyDefinedFields` / create-data / update-data logic, and `models/threat-filter.model.ts` (or wherever `ThreatFilters` is defined — find it via `rg -n "interface ThreatFilters" src/app/pages/tm`) for the `ThreatFilters` import.

```typescript
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService, ThreatListParams } from './threat-model.service';
import { Threat, Metadata } from '../models/threat-model.model';
import { ThreatFilters } from '../models/threat-filter.model';
import type { ApiThreatInput } from '@app/generated/api-type-helpers';

/** Threats loaded for one page of the threats sub-table. */
export interface ThreatsPage {
  threats: Threat[];
  total: number;
}

/** Server-side query state for the threats list (page + sort + filters). */
export interface ThreatQueryState {
  pageIndex: number;
  pageSize: number;
  sortActive: string;
  sortDirection: 'asc' | 'desc' | '';
  filters: ThreatFilters;
}

/**
 * Threat CRUD orchestration extracted from TmEditComponent. Owns the
 * ThreatListParams construction and the create/update field mapping.
 * Does NOT own filter/sort UI state, ThreatFilterStateService, or the
 * formattingService.migrateThreatFieldValues view-mapping pass — those stay
 * in the component.
 */
@Injectable({ providedIn: 'root' })
export class TmThreatCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Build the server-side ThreatListParams from page + sort + filter state. */
  buildThreatListParams(state: ThreatQueryState): ThreatListParams {
    const params: ThreatListParams = {
      limit: state.pageSize,
      offset: calculateOffset(state.pageIndex, state.pageSize),
    };
    if (state.sortActive && state.sortDirection) {
      params.sort = `${state.sortActive}:${state.sortDirection}`;
    }
    const f = state.filters;
    if (f.name.trim()) params.name = f.name.trim();
    if (f.severities.length > 0) params.severity = f.severities;
    if (f.statuses.length > 0) params.status = f.statuses;
    if (f.priorities.length > 0) params.priority = f.priorities;
    if (f.threatTypes.length > 0) params.threat_type = f.threatTypes;
    if (f.mitigated !== null) params.mitigated = f.mitigated;
    return params;
  }

  /** Load one page of threats. Returns raw threats — the component applies migrateThreatFieldValues. */
  loadThreats(threatModelId: string, state: ThreatQueryState): Observable<ThreatsPage> {
    return this.threatModelService
      .getThreatsForThreatModel(threatModelId, this.buildThreatListParams(state))
      .pipe(
        map(response => ({
          threats: response.threats ?? [],
          total: response.total ?? 0,
        })),
      );
  }

  /** Copy only defined optional fields from source to target. */
  private copyDefinedFields<S, T>(
    source: Partial<S>,
    target: Partial<T>,
    fields: (keyof S & keyof T)[],
  ): void {
    for (const field of fields) {
      if (source[field] !== undefined) {
        Object.assign(target, { [field]: source[field] });
      }
    }
  }

  /** Build create-threat payload from the dialog result. */
  buildCreateThreatData(result: Partial<Threat>): Partial<ApiThreatInput> {
    const data: Partial<ApiThreatInput> = {
      name: result.name,
      description: result.description,
      severity: result.severity || 'high',
      threat_type: result.threat_type || [],
      mitigated: result.mitigated || false,
      status: result.status || 'open',
      metadata: [],
    };
    this.copyDefinedFields(result, data, [
      'asset_id',
      'diagram_id',
      'cell_id',
      'score',
      'priority',
      'issue_uri',
      'include_in_report',
    ]);
    return data;
  }

  /** Build update-threat payload from the dialog result, falling back to the existing threat. */
  buildUpdateThreatData(existing: Threat, result: Partial<Threat>): Partial<ApiThreatInput> {
    const data: Partial<ApiThreatInput> = {
      name: result.name,
      description: result.description,
      severity: result.severity ?? existing.severity,
      threat_type: result.threat_type ?? existing.threat_type ?? [],
    };
    this.copyDefinedFields(result, data, [
      'asset_id',
      'diagram_id',
      'cell_id',
      'score',
      'priority',
      'mitigated',
      'status',
      'issue_uri',
      'include_in_report',
    ]);
    return data;
  }

  /** Create a threat from a dialog result. */
  createThreat(threatModelId: string, result: Partial<Threat>): Observable<Threat> {
    return this.threatModelService.createThreat(
      threatModelId,
      this.buildCreateThreatData(result),
    );
  }

  /** Update a threat from a dialog result; emits the updated threat. */
  updateThreat(
    threatModelId: string,
    existing: Threat,
    result: Partial<Threat>,
  ): Observable<Threat> {
    return this.threatModelService.updateThreat(
      threatModelId,
      existing.id,
      this.buildUpdateThreatData(existing, result),
    );
  }

  /** Delete a threat; emits the success boolean. */
  deleteThreat(threatModelId: string, threatId: string): Observable<boolean> {
    return this.threatModelService.deleteThreat(threatModelId, threatId);
  }

  /** Update a threat's metadata; emits the updated metadata array. */
  updateThreatMetadata(
    threatModelId: string,
    threatId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateThreatMetadata(threatModelId, threatId, metadata);
  }
}
```

NOTE: confirm the `ThreatFilters` import path with `rg -n "export interface ThreatFilters"`. If the create/update spec mock object's `ThreatFilters` shape differs from the real interface, adjust the spec's `as never`-cast fixtures, not the production code.

- [ ] **Step 4: Run the spec to verify it passes** — PASS.

- [ ] **Step 5: Wire the component**

Add the import and constructor param after `private diagramCrud: TmDiagramCrudService,`:

```typescript
import { TmThreatCrudService, ThreatQueryState } from './services/tm-threat-crud.service';
// ...
    private threatCrud: TmThreatCrudService,
```

Add a private helper that snapshots the component's current threat query state (used by `loadThreats`):

```typescript
  private buildThreatQueryState(): ThreatQueryState {
    return {
      pageIndex: this.threatsPageIndex,
      pageSize: this.threatsPageSize,
      sortActive: this.threatSortActive,
      sortDirection: this.threatSortDirection,
      filters: this.threatFilters,
    };
  }
```

Rewrite `loadThreats` — delegate the query to `TmThreatCrudService`, keep the `migrateThreatFieldValues` view-mapping pass and the error-fallback view-state reset:

```typescript
  private loadThreats(threatModelId: string): void {
    this._subscriptions.add(
      this.threatCrud.loadThreats(threatModelId, this.buildThreatQueryState()).subscribe({
        next: page => {
          if (this.threatModel) {
            const threats = page.threats.map(t =>
              this.formattingService.migrateThreatFieldValues(t),
            );
            this.threatModel.threats = threats;
            this.threatsDataSource.data = threats;
            this.totalThreats = page.total;
          }
        },
        error: error => {
          this.logger.error('Failed to load threats', error);
          if (this.threatModel) {
            this.threatModel.threats = [];
            this.threatsDataSource.data = [];
            this.totalThreats = 0;
          }
        },
      }),
    );
  }
```

`loadThreatsAndSaveState`, `onThreatsPageChange`, `onThreatNameFilterChange`, `onThreatFilterChange`, `onThreatSortChange`, `clearAllThreatFilters`, `toggleMitigatedFilter`, `saveThreatCardState`, `restoreThreatCardState`, `updateThreatTypeOptions`, and the filter getters are **unchanged** (filter UI state stays in the component).

Rewrite `addThreat` / `openThreatEditor` / `openThreatEditorWithData` — keep `addThreat`, `openThreatEditor`, and the navigation branch as-is. In `openThreatEditorWithData`, keep the dialog-data assembly (it pulls from `cellDataExtractionService`/`frameworks`/`threatModelForm`) but open the dialog through `TmDialogService.openThreatEditor`:

```typescript
    this._subscriptions.add(
      this.dialogService.openThreatEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        if (dialogMode === 'create') {
          this._handleCreateThreatResult(result);
        } else if (dialogMode === 'edit' && threat) {
          this._handleEditThreatResult(result, threat);
        }
      }),
    );
```

NOTE: the original branches on the `mode` *parameter* (`if (mode === 'create')`), but `mode` can be `undefined` when callers rely on the `dialogMode` fallback. Branch on `dialogMode` instead — this is a latent bug fix surfaced by the extraction; flag it to the user as part of Task 17 if it changes behavior. (`openThreatEditor` always passes `mode: 'create'` for the dialog path today, so behavior is unchanged in practice, but `dialogMode` is the correct variable.)

Rewrite `_handleCreateThreatResult` — delegate data-building + the API call to `TmThreatCrudService`. The original `createThreat` subscribe already has an `error` callback; preserve it:

```typescript
  private _handleCreateThreatResult(result: Partial<Threat>): void {
    if (!this.threatModel) return;
    this._subscriptions.add(
      this.threatCrud.createThreat(this.threatModel.id, result).subscribe({
        next: () => {
          if (this.threatModel) {
            this.loadThreats(this.threatModel.id);
          }
          this.updateFrameworkControlState();
        },
        error: error => this.logger.error('Failed to create threat', error),
      }),
    );
  }
```

Rewrite `_handleEditThreatResult` — **missing-error-handler fix:** the original `updateThreat` subscribe (single-arg) has no `error` callback against `updateThreat`, which `throw`s. Add one:

```typescript
  private _handleEditThreatResult(result: Partial<Threat>, threat: Threat): void {
    if (!this.threatModel) return;
    this._subscriptions.add(
      this.threatCrud.updateThreat(this.threatModel.id, threat, result).subscribe({
        next: updatedThreat => {
          const index = this.threatModel?.threats?.findIndex(t => t.id === threat.id) ?? -1;
          if (index !== -1 && this.threatModel?.threats) {
            this.threatModel.threats[index] = updatedThreat;
            this.threatsDataSource.data = this.threatModel.threats;
          }
        },
        error: error => this.logger.error('Failed to update threat', error),
      }),
    );
  }
```

Delete the now-unused private `_copyDefinedFields` from the component (it moved into the service as `copyDefinedFields`). Confirm no other component method uses it: `rg -n "_copyDefinedFields" src/app/pages/tm/tm-edit.component.ts`.

Rewrite `deleteThreat` — dialog via `TmDialogService.openDeleteConfirmation`, delete via `TmThreatCrudService`. **Missing-error-handler fix:** the original `deleteThreat` subscribe (single-arg) has no `error` callback. Add one:

```typescript
  deleteThreat(threat: Threat, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.canEdit) {
      this.logger.warn('Cannot delete threat - insufficient permissions');
      return;
    }
    if (!this.threatModel || !this.threatModel.threats) {
      return;
    }

    const dialogData: DeleteConfirmationDialogData = {
      id: threat.id,
      name: threat.name,
      objectType: 'threat',
    };

    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel || !this.threatModel.threats) return;
        this._subscriptions.add(
          this.threatCrud.deleteThreat(this.threatModel.id, threat.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.threats) {
                this.threatModel.threats = this.threatModel.threats.filter(
                  t => t.id !== threat.id,
                );
                this.threatsDataSource.data = this.threatModel.threats;
                this.updateFrameworkControlState();
              }
            },
            error: error => this.logger.error('Failed to delete threat', error),
          }),
        );
      }),
    );
  }
```

Rewrite `openThreatMetadataDialog` — open the metadata dialog via `TmDialogService.openMetadata`, update via `TmThreatCrudService.updateThreatMetadata`. **Missing-error-handler fix:** the original has no `error` callback on `updateThreatMetadata`. Add one. Preserve the nested-field write of `metadata` AND `modified_at`:

```typescript
  openThreatMetadataDialog(threat: Threat, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: threat.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Threat',
      objectName: `${this.transloco.translate('common.objectTypes.threat')}: ${threat.name} (${threat.id})`,
    };

    this._subscriptions.add(
      this.dialogService.openMetadata(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.threatCrud
            .updateThreatMetadata(this.threatModel.id, threat.id, result)
            .subscribe({
              next: updatedMetadata => {
                if (updatedMetadata && this.threatModel) {
                  const threatIndex = this.threatModel.threats?.findIndex(
                    t => t.id === threat.id,
                  );
                  if (
                    threatIndex !== undefined &&
                    threatIndex !== -1 &&
                    this.threatModel.threats
                  ) {
                    this.threatModel.threats[threatIndex].metadata = updatedMetadata;
                    this.threatModel.threats[threatIndex].modified_at =
                      new Date().toISOString();
                  }
                  this.logger.info('Updated threat metadata via API', {
                    threatId: threat.id,
                    threatName: threat.name,
                    metadata: updatedMetadata,
                  });
                }
              },
              error: error => this.logger.error('Failed to update threat metadata', error),
            }),
        );
      }),
    );
  }
```

- [ ] **Step 6: Build, test, lint** — `pnpm run build` → `pnpm test` → `pnpm run lint:all`.

- [ ] **Step 7: Commit (both files)**

```bash
git add src/app/pages/tm/services/tm-threat-crud.service.ts src/app/pages/tm/services/tm-threat-crud.service.spec.ts src/app/pages/tm/tm-edit.component.ts
git commit -m "refactor: extract threat CRUD into TmThreatCrudService (#695)

Also adds missing error handlers to the threat update/delete/metadata
flows, whose underlying service calls throw on API failure."
```

---

### Task 15: Create `TmRepositoryCrudService` and wire the component

**Files:**
- Create: `src/app/pages/tm/services/tm-repository-crud.service.ts` (+ `.spec.ts`)
- Modify: `src/app/pages/tm/tm-edit.component.ts`

**Structural note — repositories DOES have pagination.** The Phase 5 brief flagged uncertainty here; confirmed against the source: `loadRepositories` (~2774) and `onRepositoriesPageChange` (~2794) DO exist and use `getRepositoriesForThreatModel(tmId, pageSize, offset)` with `repositoriesPageIndex/Size`/`totalRepositories`/`repositoriesDataSource`. Repositories follow the documents pattern exactly: `loadRepositories`, `addRepository`, `onRepositoryUrlDropped`, `editRepository`, `deleteRepository`, `openRepositoryMetadataDialog`, `getRepositoryTooltip`, `onRepositoriesPageChange`. `openRepositoryView` (~2309) is a placeholder stub (`logger.info` only, no CRUD) — leave it untouched in the component.

`RepositoryFormResult` was moved into `tm-dialog.service.ts` in Task 12; the repository CRUD service imports it from there.

- [ ] **Step 1: Write the failing spec**

Create `src/app/pages/tm/services/tm-repository-crud.service.spec.ts`:

```typescript
import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmRepositoryCrudService } from './tm-repository-crud.service';
import type { Repository } from '../models/threat-model.model';

describe('TmRepositoryCrudService', () => {
  let service: TmRepositoryCrudService;
  let threatModelService: {
    getRepositoriesForThreatModel: ReturnType<typeof vi.fn>;
    createRepository: ReturnType<typeof vi.fn>;
    updateRepository: ReturnType<typeof vi.fn>;
    deleteRepository: ReturnType<typeof vi.fn>;
    updateRepositoryMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      getRepositoriesForThreatModel: vi
        .fn()
        .mockReturnValue(of({ repositories: [{ id: 'r1' }], total: 1 })),
      createRepository: vi.fn().mockReturnValue(of({ id: 'r9' })),
      updateRepository: vi.fn().mockReturnValue(of({ id: 'r1', name: 'New' })),
      deleteRepository: vi.fn().mockReturnValue(of(true)),
      updateRepositoryMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
    };
    service = new TmRepositoryCrudService(threatModelService as never);
  });

  describe('getRepositoryTooltip', () => {
    it('returns just the uri when there is no description or parameters', () => {
      expect(service.getRepositoryTooltip({ uri: 'http://x' } as Repository)).toBe('http://x');
    });
    it('appends description and parameters', () => {
      const tip = service.getRepositoryTooltip({
        uri: 'http://x',
        description: 'desc',
        parameters: { refType: 'branch', refValue: 'main', subPath: 'src' },
      } as Repository);
      expect(tip).toBe('http://x\n\ndesc\n\nbranch: main\nPath: src');
    });
  });

  describe('buildRepositoryData', () => {
    it('maps form values and coerces empty description to undefined', () => {
      const data = service.buildRepositoryData({
        name: 'N',
        description: '',
        type: 'git',
        uri: 'U',
        include_in_report: true,
      } as never);
      expect(data).toEqual({
        name: 'N',
        description: undefined,
        type: 'git',
        uri: 'U',
        parameters: undefined,
        include_in_report: true,
      });
    });
  });

  describe('loadRepositories', () => {
    it('calls getRepositoriesForThreatModel with the computed offset', () => {
      service.loadRepositories('tm1', 2, 10).subscribe();
      expect(threatModelService.getRepositoriesForThreatModel).toHaveBeenCalledWith('tm1', 10, 20);
    });
    it('emits repositories and total, defaulting both when omitted', () => {
      threatModelService.getRepositoriesForThreatModel.mockReturnValue(of({}));
      let result: { repositories: Repository[]; total: number } | undefined;
      service.loadRepositories('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ repositories: [], total: 0 });
    });
  });

  describe('createRepository / updateRepository / deleteRepository', () => {
    it('createRepository calls createRepository with the built data', () => {
      service
        .createRepository('tm1', { name: 'N', type: 'git', uri: 'U' } as never)
        .subscribe();
      expect(threatModelService.createRepository).toHaveBeenCalledTimes(1);
    });
    it('updateRepository calls updateRepository with id and built data', () => {
      let updated: Repository | undefined;
      service
        .updateRepository('tm1', 'r1', { name: 'New', type: 'git', uri: 'U' } as never)
        .subscribe(r => (updated = r));
      expect(threatModelService.updateRepository).toHaveBeenCalledWith(
        'tm1',
        'r1',
        expect.objectContaining({ name: 'New' }),
      );
      expect(updated).toEqual({ id: 'r1', name: 'New' });
    });
    it('deleteRepository emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteRepository('tm1', 'r1').subscribe(v => (ok = v));
      expect(threatModelService.deleteRepository).toHaveBeenCalledWith('tm1', 'r1');
      expect(ok).toBe(true);
    });
  });

  describe('updateRepositoryMetadata', () => {
    it('forwards updateRepositoryMetadata', () => {
      let meta: unknown;
      service.updateRepositoryMetadata('tm1', 'r1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateRepositoryMetadata).toHaveBeenCalledWith('tm1', 'r1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails** — FAIL (cannot find module).

- [ ] **Step 3: Create the service**

Create `src/app/pages/tm/services/tm-repository-crud.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService } from './threat-model.service';
import { Repository, Metadata } from '../models/threat-model.model';
import { RepositoryFormResult } from './tm-dialog.service';
import type { ApiRepositoryInput } from '@app/generated/api-type-helpers';

/** Repositories loaded for one page of the repositories sub-table. */
export interface RepositoriesPage {
  repositories: Repository[];
  total: number;
}

/**
 * Repository CRUD orchestration extracted from TmEditComponent. Owns the
 * form-value mapping and the ThreatModelService calls. Does NOT touch
 * repositoriesDataSource or pagination view state.
 */
@Injectable({ providedIn: 'root' })
export class TmRepositoryCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Tooltip text for a repository list item: uri, optional description, optional parameters. */
  getRepositoryTooltip(repository: Repository): string {
    let tooltip = repository.uri;
    if (repository.description) {
      tooltip += `\n\n${repository.description}`;
    }
    if (repository.parameters) {
      tooltip += `\n\n${repository.parameters.refType}: ${repository.parameters.refValue}`;
      if (repository.parameters.subPath) {
        tooltip += `\nPath: ${repository.parameters.subPath}`;
      }
    }
    return tooltip;
  }

  /** Map repository editor form values to a Partial<ApiRepositoryInput>. */
  buildRepositoryData(values: RepositoryFormResult): Partial<ApiRepositoryInput> {
    return {
      name: values.name,
      description: values.description || undefined,
      type: values.type,
      uri: values.uri,
      parameters: values.parameters,
      include_in_report: values.include_in_report,
    };
  }

  /** Load one page of repositories for a threat model. */
  loadRepositories(
    threatModelId: string,
    pageIndex: number,
    pageSize: number,
  ): Observable<RepositoriesPage> {
    const offset = calculateOffset(pageIndex, pageSize);
    return this.threatModelService
      .getRepositoriesForThreatModel(threatModelId, pageSize, offset)
      .pipe(
        map(response => ({
          repositories: response.repositories ?? [],
          total: response.total ?? 0,
        })),
      );
  }

  /** Create a repository from editor form values. */
  createRepository(
    threatModelId: string,
    values: RepositoryFormResult,
  ): Observable<Repository> {
    return this.threatModelService.createRepository(
      threatModelId,
      this.buildRepositoryData(values),
    );
  }

  /** Update a repository from editor form values; emits the updated repository. */
  updateRepository(
    threatModelId: string,
    repositoryId: string,
    values: RepositoryFormResult,
  ): Observable<Repository> {
    return this.threatModelService.updateRepository(
      threatModelId,
      repositoryId,
      this.buildRepositoryData(values),
    );
  }

  /** Delete a repository; emits the success boolean. */
  deleteRepository(threatModelId: string, repositoryId: string): Observable<boolean> {
    return this.threatModelService.deleteRepository(threatModelId, repositoryId);
  }

  /** Update a repository's metadata; emits the updated metadata array. */
  updateRepositoryMetadata(
    threatModelId: string,
    repositoryId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateRepositoryMetadata(
      threatModelId,
      repositoryId,
      metadata,
    );
  }
}
```

NOTE: the type cast of `values.type` — `RepositoryFormResult.type` is `'git' | 'svn' | 'mercurial' | 'other'`; confirm `ApiRepositoryInput['type']` accepts the same union. If not, narrow with a cast and flag in Task 17.

- [ ] **Step 4: Run the spec to verify it passes** — PASS.

- [ ] **Step 5: Wire the component**

Add the import and constructor param after `private threatCrud: TmThreatCrudService,`:

```typescript
import { TmRepositoryCrudService } from './services/tm-repository-crud.service';
// ...
    private repositoryCrud: TmRepositoryCrudService,
```

Rewrite `loadRepositories`:

```typescript
  private loadRepositories(threatModelId: string): void {
    this._subscriptions.add(
      this.repositoryCrud
        .loadRepositories(threatModelId, this.repositoriesPageIndex, this.repositoriesPageSize)
        .subscribe({
          next: page => {
            if (this.threatModel) {
              this.threatModel.repositories = page.repositories;
              this.repositoriesDataSource.data = page.repositories;
              this.totalRepositories = page.total;
            }
          },
          error: error => this.logger.error('Failed to load repositories', error),
        }),
    );
  }
```

Rewrite `addRepository` — dialog via `TmDialogService.openRepositoryEditor`, create via `TmRepositoryCrudService`. The original `createRepository` subscribe already has an `error` callback; preserve it:

```typescript
  addRepository(uri?: string): void {
    if (!this.canEdit) {
      this.logger.warn('Cannot add repository - insufficient permissions');
      return;
    }
    const dialogData: RepositoryEditorDialogData = {
      mode: 'create',
      isReadOnly: !this.canEdit,
      ...(uri ? { repository: { uri } as Repository } : {}),
    };
    this._subscriptions.add(
      this.dialogService.openRepositoryEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.repositoryCrud.createRepository(this.threatModel.id, result).subscribe({
            next: () => {
              if (this.threatModel) {
                this.loadRepositories(this.threatModel.id);
              }
            },
            error: error => this.logger.error('Failed to create repository', error),
          }),
        );
      }),
    );
  }
```

`onRepositoryUrlDropped` is unchanged (guards on `canEdit`/`dialog.openDialogs.length`, calls `addRepository(url)`).

Rewrite `editRepository` — **missing-error-handler fix:** the original `updateRepository` subscribe (single-arg) has no `error` callback. Add one:

```typescript
  editRepository(repository: Repository, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel) {
      return;
    }
    const dialogData: RepositoryEditorDialogData = {
      repository,
      mode: 'edit',
      isReadOnly: !this.canEdit,
    };
    this._subscriptions.add(
      this.dialogService.openRepositoryEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.repositoryCrud
            .updateRepository(this.threatModel.id, repository.id, result)
            .subscribe({
              next: updatedRepository => {
                if (this.threatModel && this.threatModel.repositories) {
                  const index = this.threatModel.repositories.findIndex(
                    r => r.id === repository.id,
                  );
                  if (index !== -1) {
                    this.threatModel.repositories[index] = updatedRepository;
                  }
                  this.repositoriesDataSource.data = this.threatModel.repositories;
                }
              },
              error: error => this.logger.error('Failed to update repository', error),
            }),
        );
      }),
    );
  }
```

Rewrite `deleteRepository` — **missing-error-handler fix:** the original `deleteRepository` subscribe (single-arg) has no `error` callback. Add one:

```typescript
  deleteRepository(repository: Repository, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.canEdit) {
      this.logger.warn('Cannot delete repository - insufficient permissions');
      return;
    }
    if (!this.threatModel || !this.threatModel.repositories) {
      return;
    }
    const dialogData: DeleteConfirmationDialogData = {
      id: repository.id,
      name: repository.name,
      objectType: 'repository',
    };
    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel || !this.threatModel.repositories) return;
        this._subscriptions.add(
          this.repositoryCrud.deleteRepository(this.threatModel.id, repository.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.repositories) {
                this.threatModel.repositories = this.threatModel.repositories.filter(
                  r => r.id !== repository.id,
                );
                this.repositoriesDataSource.data = this.threatModel.repositories;
              }
            },
            error: error => this.logger.error('Failed to delete repository', error),
          }),
        );
      }),
    );
  }
```

Rewrite `getRepositoryTooltip` to delegate:

```typescript
  getRepositoryTooltip(repository: Repository): string {
    return this.repositoryCrud.getRepositoryTooltip(repository);
  }
```

Rewrite `openRepositoryMetadataDialog` — **missing-error-handler fix:** the original has no `error` callback on `updateRepositoryMetadata`. Add one:

```typescript
  openRepositoryMetadataDialog(repository: Repository, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: repository.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Repository',
      objectName: `${this.transloco.translate('common.objectTypes.repository')}: ${repository.name} (${repository.id})`,
    };
    this._subscriptions.add(
      this.dialogService.openMetadata(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.repositoryCrud
            .updateRepositoryMetadata(this.threatModel.id, repository.id, result)
            .subscribe({
              next: updatedMetadata => {
                if (updatedMetadata && this.threatModel && this.threatModel.repositories) {
                  const repositoryIndex = this.threatModel.repositories.findIndex(
                    r => r.id === repository.id,
                  );
                  if (repositoryIndex !== -1) {
                    this.threatModel.repositories[repositoryIndex].metadata = updatedMetadata;
                  }
                  this.logger.info('Updated repository metadata via API', {
                    repositoryId: repository.id,
                    metadata: updatedMetadata,
                  });
                }
              },
              error: error =>
                this.logger.error('Failed to update repository metadata', error),
            }),
        );
      }),
    );
  }
```

Delete the component-local `RepositoryFormResult` interface (lines 131–142) — it now lives in `tm-dialog.service.ts`. If the component still references `RepositoryFormResult` anywhere else, import it from `./services/tm-dialog.service` (`rg -n "RepositoryFormResult" src/app/pages/tm/tm-edit.component.ts`).

`onRepositoriesPageChange` is unchanged.

- [ ] **Step 6: Build, test, lint** — `pnpm run build` → `pnpm test` → `pnpm run lint:all`.

- [ ] **Step 7: Commit (both files)**

```bash
git add src/app/pages/tm/services/tm-repository-crud.service.ts src/app/pages/tm/services/tm-repository-crud.service.spec.ts src/app/pages/tm/tm-edit.component.ts
git commit -m "refactor: extract repository CRUD into TmRepositoryCrudService (#695)

Also adds missing error handlers to the repository edit/delete/metadata
flows, whose underlying service calls throw on API failure."
```

---

### Task 16: Create `TmNoteCrudService` and wire the component

**Files:**
- Create: `src/app/pages/tm/services/tm-note-crud.service.ts` (+ `.spec.ts`)
- Modify: `src/app/pages/tm/tm-edit.component.ts`

**Structural surprises — notes has a two-phase create.** `addNote` is the most complex method in the group:
1. It subscribes to `dialogRef.componentInstance.saveEvent` (a `NoteFormResult` emitter) to create the note *while the dialog is still open* (the dialog's Save button), then calls `dialogRef.componentInstance.setCreatedNoteId(createdNote.id)` to tell the dialog the note now exists.
2. It also subscribes to `afterClosed()` (a `NoteEditorResult`). If `result.wasCreated && result.noteId`, the note already exists → call `updateNote`. Otherwise → call `createNote`.

Because the component must touch `componentInstance`, `TmDialogService.openNoteEditor` (Task 12) returns the `MatDialogRef`, not just `afterClosed()`. The CRUD service stays a plain orchestrator (`loadNotes`, `createNote`, `updateNote`, `deleteNote`, `updateNoteMetadata`); the two-phase wiring stays in the component.
- `editNote` navigates to `/tm/:id/note/:noteId` — a route, no dialog, no CRUD. Stays unchanged in the component.
- `downloadNote` builds a markdown blob client-side — no service call. Stays unchanged in the component.
- `createNote`/`updateNote` accept `Partial<ApiNoteInput>`; `NoteFormResult` is structurally compatible (the component passes `NoteFormResult` directly today). The CRUD service methods type their input as `NoteFormResult` and pass it through.

- [ ] **Step 1: Write the failing spec**

Create `src/app/pages/tm/services/tm-note-crud.service.spec.ts`:

```typescript
import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmNoteCrudService } from './tm-note-crud.service';
import type { Note } from '../models/threat-model.model';

describe('TmNoteCrudService', () => {
  let service: TmNoteCrudService;
  let threatModelService: {
    getNotesForThreatModel: ReturnType<typeof vi.fn>;
    createNote: ReturnType<typeof vi.fn>;
    updateNote: ReturnType<typeof vi.fn>;
    deleteNote: ReturnType<typeof vi.fn>;
    updateNoteMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      getNotesForThreatModel: vi
        .fn()
        .mockReturnValue(of({ notes: [{ id: 'n1' }], total: 1 })),
      createNote: vi.fn().mockReturnValue(of({ id: 'n9' })),
      updateNote: vi.fn().mockReturnValue(of({ id: 'n1', name: 'New' })),
      deleteNote: vi.fn().mockReturnValue(of(true)),
      updateNoteMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
    };
    service = new TmNoteCrudService(threatModelService as never);
  });

  describe('loadNotes', () => {
    it('calls getNotesForThreatModel with the computed offset', () => {
      service.loadNotes('tm1', 2, 10).subscribe();
      expect(threatModelService.getNotesForThreatModel).toHaveBeenCalledWith('tm1', 10, 20);
    });
    it('emits notes and total, defaulting both when omitted', () => {
      threatModelService.getNotesForThreatModel.mockReturnValue(of({}));
      let result: { notes: Note[]; total: number } | undefined;
      service.loadNotes('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ notes: [], total: 0 });
    });
  });

  describe('createNote / updateNote / deleteNote', () => {
    it('createNote forwards the form value', () => {
      const form = { name: 'N', content: 'C' } as never;
      let created: Note | undefined;
      service.createNote('tm1', form).subscribe(n => (created = n));
      expect(threatModelService.createNote).toHaveBeenCalledWith('tm1', form);
      expect(created).toEqual({ id: 'n9' });
    });
    it('updateNote forwards id and form value', () => {
      const form = { name: 'New', content: 'C' } as never;
      let updated: Note | undefined;
      service.updateNote('tm1', 'n1', form).subscribe(n => (updated = n));
      expect(threatModelService.updateNote).toHaveBeenCalledWith('tm1', 'n1', form);
      expect(updated).toEqual({ id: 'n1', name: 'New' });
    });
    it('deleteNote emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteNote('tm1', 'n1').subscribe(v => (ok = v));
      expect(threatModelService.deleteNote).toHaveBeenCalledWith('tm1', 'n1');
      expect(ok).toBe(true);
    });
  });

  describe('updateNoteMetadata', () => {
    it('forwards updateNoteMetadata', () => {
      let meta: unknown;
      service.updateNoteMetadata('tm1', 'n1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateNoteMetadata).toHaveBeenCalledWith('tm1', 'n1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails** — FAIL (cannot find module).

- [ ] **Step 3: Create the service**

Create `src/app/pages/tm/services/tm-note-crud.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService } from './threat-model.service';
import { Note, Metadata } from '../models/threat-model.model';
import { NoteFormResult } from '@app/shared/components/note-editor-dialog/note-editor-dialog.component';

/** Notes loaded for one page of the notes sub-table. */
export interface NotesPage {
  notes: Note[];
  total: number;
}

/**
 * Note CRUD orchestration extracted from TmEditComponent. The two-phase
 * addNote flow (saveEvent + afterClosed) stays in the component because it
 * must touch the dialog's componentInstance; this service only owns the
 * API calls. Does NOT touch notesDataSource or pagination view state.
 */
@Injectable({ providedIn: 'root' })
export class TmNoteCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Load one page of notes for a threat model. */
  loadNotes(threatModelId: string, pageIndex: number, pageSize: number): Observable<NotesPage> {
    const offset = calculateOffset(pageIndex, pageSize);
    return this.threatModelService
      .getNotesForThreatModel(threatModelId, pageSize, offset)
      .pipe(
        map(response => ({
          notes: response.notes ?? [],
          total: response.total ?? 0,
        })),
      );
  }

  /** Create a note from the note editor form value. */
  createNote(threatModelId: string, formValue: NoteFormResult): Observable<Note> {
    return this.threatModelService.createNote(threatModelId, formValue);
  }

  /** Update a note from the note editor form value; emits the updated note. */
  updateNote(
    threatModelId: string,
    noteId: string,
    formValue: NoteFormResult,
  ): Observable<Note> {
    return this.threatModelService.updateNote(threatModelId, noteId, formValue);
  }

  /** Delete a note; emits the success boolean. */
  deleteNote(threatModelId: string, noteId: string): Observable<boolean> {
    return this.threatModelService.deleteNote(threatModelId, noteId);
  }

  /** Update a note's metadata; emits the updated metadata array. */
  updateNoteMetadata(
    threatModelId: string,
    noteId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateNoteMetadata(threatModelId, noteId, metadata);
  }
}
```

NOTE: `createNote`/`updateNote` declare `formValue: NoteFormResult` but `ThreatModelService.createNote` expects `Partial<ApiNoteInput>`. These are structurally compatible today (the component already passes `NoteFormResult` straight through). If TypeScript rejects the pass-through, add an explicit `as Partial<ApiNoteInput>` cast inside the service and flag it in Task 17.

- [ ] **Step 4: Run the spec to verify it passes** — PASS.

- [ ] **Step 5: Wire the component**

Add the import and constructor param after `private repositoryCrud: TmRepositoryCrudService,`:

```typescript
import { TmNoteCrudService } from './services/tm-note-crud.service';
// ...
    private noteCrud: TmNoteCrudService,
```

Rewrite `loadNotes` — keep the leading `threatModel.notes = []` reset and the error-fallback reset:

```typescript
  private loadNotes(threatModelId: string): void {
    if (this.threatModel) {
      this.threatModel.notes = [];
    }
    this._subscriptions.add(
      this.noteCrud.loadNotes(threatModelId, this.notesPageIndex, this.notesPageSize).subscribe({
        next: page => {
          if (this.threatModel) {
            this.threatModel.notes = page.notes;
            this.notesDataSource.data = page.notes;
            this.totalNotes = page.total;
          }
        },
        error: error => {
          this.logger.error('Failed to load notes', error);
          if (this.threatModel) {
            this.threatModel.notes = [];
            this.notesDataSource.data = [];
            this.totalNotes = 0;
          }
        },
      }),
    );
  }
```

Rewrite `addNote` — open the dialog via `TmDialogService.openNoteEditor` (which returns the `MatDialogRef`), keep the two-phase `saveEvent`/`afterClosed` wiring, route the API calls through `TmNoteCrudService`. The `saveEvent` create and the `afterClosed` create already have `error` callbacks; the `afterClosed` `updateNote` uses the deprecated two-arg `subscribe(next, error)` form — convert it to the object form `subscribe({ next, error })`:

```typescript
  addNote(): void {
    if (!this.canEdit) {
      this.logger.warn('User does not have permission to create notes');
      return;
    }
    const dialogData: NoteEditorDialogData = {
      mode: 'create',
      entityType: 'threat_model',
      isReadOnly: !this.canEdit,
    };
    const dialogRef = this.dialogService.openNoteEditor(dialogData);

    const saveSubscription = dialogRef.componentInstance.saveEvent.subscribe(noteResult => {
      if (!this.threatModel) return;
      this._subscriptions.add(
        this.noteCrud.createNote(this.threatModel.id, noteResult).subscribe({
          next: createdNote => {
            if (this.threatModel) {
              this.loadNotes(this.threatModel.id);
              dialogRef.componentInstance.setCreatedNoteId(createdNote.id);
            }
          },
          error: error => this.logger.error('Failed to create note', error),
        }),
      );
    });
    this._subscriptions.add(saveSubscription);

    this._subscriptions.add(
      dialogRef.afterClosed().subscribe((result: NoteEditorResult | undefined) => {
        if (!result || !this.threatModel) return;
        if (result.wasCreated && result.noteId) {
          this._subscriptions.add(
            this.noteCrud
              .updateNote(this.threatModel.id, result.noteId, result.formValue)
              .subscribe({
                next: updatedNote => {
                  if (this.threatModel && this.threatModel.notes) {
                    const index = this.threatModel.notes.findIndex(
                      n => n.id === result.noteId,
                    );
                    if (index !== -1) {
                      this.threatModel.notes[index] = updatedNote;
                    }
                    this.notesDataSource.data = this.threatModel.notes;
                    this.logger.info('Updated note via API', { note: updatedNote });
                  }
                },
                error: error => this.logger.error('Failed to update note', error),
              }),
          );
        } else {
          this._subscriptions.add(
            this.noteCrud.createNote(this.threatModel.id, result.formValue).subscribe({
              next: () => {
                if (this.threatModel) {
                  this.loadNotes(this.threatModel.id);
                }
              },
              error: error => this.logger.error('Failed to create note', error),
            }),
          );
        }
      }),
    );
  }
```

`editNote` (navigation only) and `downloadNote` (client-side blob) are **unchanged**.

Rewrite `deleteNote` — dialog via `TmDialogService.openDeleteConfirmation`, delete via `TmNoteCrudService`. **Missing-error-handler fix:** the original `deleteNote` subscribe (single-arg) has no `error` callback. Add one:

```typescript
  deleteNote(note: Note, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel || !this.threatModel.notes || !this.canEdit) {
      this.logger.warn('User does not have permission to delete notes');
      return;
    }
    const dialogData: DeleteConfirmationDialogData = {
      id: note.id,
      name: note.name,
      objectType: 'note',
    };
    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel || !this.threatModel.notes) return;
        this._subscriptions.add(
          this.noteCrud.deleteNote(this.threatModel.id, note.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.notes) {
                this.threatModel.notes = this.threatModel.notes.filter(n => n.id !== note.id);
                this.notesDataSource.data = this.threatModel.notes;
                this.logger.info('Deleted note', { noteId: note.id });
              }
            },
            error: error => this.logger.error('Failed to delete note', error),
          }),
        );
      }),
    );
  }
```

Rewrite `openNoteMetadataDialog` — **missing-error-handler fix:** the original has no `error` callback on `updateNoteMetadata`. Add one. Preserve the `&& this.canEdit` guard before the update call:

```typescript
  openNoteMetadataDialog(note: Note, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: note.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Note',
      objectName: `${this.transloco.translate('common.objectTypes.note')}: ${note.name} (${note.id})`,
    };
    this._subscriptions.add(
      this.dialogService.openMetadata(dialogData).subscribe(result => {
        if (!result || !this.threatModel || !this.canEdit) return;
        this._subscriptions.add(
          this.noteCrud
            .updateNoteMetadata(this.threatModel.id, note.id, result)
            .subscribe({
              next: updatedMetadata => {
                if (updatedMetadata && this.threatModel && this.threatModel.notes) {
                  const noteIndex = this.threatModel.notes.findIndex(n => n.id === note.id);
                  if (noteIndex !== -1) {
                    this.threatModel.notes[noteIndex].metadata = updatedMetadata;
                  }
                  this.logger.info('Updated note metadata via API', {
                    noteId: note.id,
                    metadata: updatedMetadata,
                  });
                }
              },
              error: error => this.logger.error('Failed to update note metadata', error),
            }),
        );
      }),
    );
  }
```

`onNotesPageChange` is unchanged.

- [ ] **Step 6: Build, test, lint** — `pnpm run build` → `pnpm test` → `pnpm run lint:all`.

- [ ] **Step 7: Commit (both files)**

```bash
git add src/app/pages/tm/services/tm-note-crud.service.ts src/app/pages/tm/services/tm-note-crud.service.spec.ts src/app/pages/tm/tm-edit.component.ts
git commit -m "refactor: extract note CRUD into TmNoteCrudService (#695)

Also adds missing error handlers to the note delete/metadata flows,
whose underlying service calls throw on API failure."
```

---

### Task 17: Create `TmAssetCrudService`, wire the component, and Phase 5 verification

**Files:**
- Create: `src/app/pages/tm/services/tm-asset-crud.service.ts` (+ `.spec.ts`)
- Modify: `src/app/pages/tm/tm-edit.component.ts`

**Structural note — assets fits the documents pattern cleanly.** `loadAssets`, `addAsset`, `editAsset`, `deleteAsset`, `openAssetMetadataDialog`, `onAssetsPageChange`. `getAssetTypeIcon` is already extracted to `TmEditFormattingService` — **do not re-extract it**. The asset editor dialog emits a `Partial<Asset>` directly (no form-result intermediary, no `buildAssetData` mapping needed — `createAsset`/`updateAsset` take `Partial<ApiAssetInput>` and the component passes the dialog `Partial<Asset>` through today).

- [ ] **Step 1: Write the failing spec**

Create `src/app/pages/tm/services/tm-asset-crud.service.spec.ts`:

```typescript
import '@angular/compiler';

import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { TmAssetCrudService } from './tm-asset-crud.service';
import type { Asset } from '../models/threat-model.model';

describe('TmAssetCrudService', () => {
  let service: TmAssetCrudService;
  let threatModelService: {
    getAssetsForThreatModel: ReturnType<typeof vi.fn>;
    createAsset: ReturnType<typeof vi.fn>;
    updateAsset: ReturnType<typeof vi.fn>;
    deleteAsset: ReturnType<typeof vi.fn>;
    updateAssetMetadata: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    threatModelService = {
      getAssetsForThreatModel: vi
        .fn()
        .mockReturnValue(of({ assets: [{ id: 'a1' }], total: 1 })),
      createAsset: vi.fn().mockReturnValue(of({ id: 'a9' })),
      updateAsset: vi.fn().mockReturnValue(of({ id: 'a1', name: 'New' })),
      deleteAsset: vi.fn().mockReturnValue(of(true)),
      updateAssetMetadata: vi.fn().mockReturnValue(of([{ key: 'k', value: 'v' }])),
    };
    service = new TmAssetCrudService(threatModelService as never);
  });

  describe('loadAssets', () => {
    it('calls getAssetsForThreatModel with the computed offset', () => {
      service.loadAssets('tm1', 2, 10).subscribe();
      expect(threatModelService.getAssetsForThreatModel).toHaveBeenCalledWith('tm1', 10, 20);
    });
    it('emits assets and total, defaulting both when omitted', () => {
      threatModelService.getAssetsForThreatModel.mockReturnValue(of({}));
      let result: { assets: Asset[]; total: number } | undefined;
      service.loadAssets('tm1', 0, 20).subscribe(r => (result = r));
      expect(result).toEqual({ assets: [], total: 0 });
    });
  });

  describe('createAsset / updateAsset / deleteAsset', () => {
    it('createAsset forwards the asset', () => {
      const asset = { name: 'A' } as never;
      service.createAsset('tm1', asset).subscribe();
      expect(threatModelService.createAsset).toHaveBeenCalledWith('tm1', asset);
    });
    it('updateAsset forwards id and asset, emits the updated asset', () => {
      let updated: Asset | undefined;
      service.updateAsset('tm1', 'a1', { name: 'New' } as never).subscribe(a => (updated = a));
      expect(threatModelService.updateAsset).toHaveBeenCalledWith('tm1', 'a1', { name: 'New' });
      expect(updated).toEqual({ id: 'a1', name: 'New' });
    });
    it('deleteAsset emits the success boolean', () => {
      let ok: boolean | undefined;
      service.deleteAsset('tm1', 'a1').subscribe(v => (ok = v));
      expect(threatModelService.deleteAsset).toHaveBeenCalledWith('tm1', 'a1');
      expect(ok).toBe(true);
    });
  });

  describe('updateAssetMetadata', () => {
    it('forwards updateAssetMetadata', () => {
      let meta: unknown;
      service.updateAssetMetadata('tm1', 'a1', []).subscribe(m => (meta = m));
      expect(threatModelService.updateAssetMetadata).toHaveBeenCalledWith('tm1', 'a1', []);
      expect(meta).toEqual([{ key: 'k', value: 'v' }]);
    });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails** — FAIL (cannot find module).

- [ ] **Step 3: Create the service**

Create `src/app/pages/tm/services/tm-asset-crud.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService } from './threat-model.service';
import { Asset, Metadata } from '../models/threat-model.model';
import type { ApiAssetInput } from '@app/generated/api-type-helpers';

/** Assets loaded for one page of the assets sub-table. */
export interface AssetsPage {
  assets: Asset[];
  total: number;
}

/**
 * Asset CRUD orchestration extracted from TmEditComponent. The asset editor
 * dialog emits a Partial<Asset> directly, so there is no form-mapping step.
 * Does NOT touch assetsDataSource or pagination view state.
 */
@Injectable({ providedIn: 'root' })
export class TmAssetCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Load one page of assets for a threat model. */
  loadAssets(threatModelId: string, pageIndex: number, pageSize: number): Observable<AssetsPage> {
    const offset = calculateOffset(pageIndex, pageSize);
    return this.threatModelService
      .getAssetsForThreatModel(threatModelId, pageSize, offset)
      .pipe(
        map(response => ({
          assets: response.assets ?? [],
          total: response.total ?? 0,
        })),
      );
  }

  /** Create an asset from the asset editor dialog result. */
  createAsset(threatModelId: string, asset: Partial<Asset>): Observable<Asset> {
    return this.threatModelService.createAsset(
      threatModelId,
      asset as Partial<ApiAssetInput>,
    );
  }

  /** Update an asset from the asset editor dialog result; emits the updated asset. */
  updateAsset(
    threatModelId: string,
    assetId: string,
    asset: Partial<Asset>,
  ): Observable<Asset> {
    return this.threatModelService.updateAsset(
      threatModelId,
      assetId,
      asset as Partial<ApiAssetInput>,
    );
  }

  /** Delete an asset; emits the success boolean. */
  deleteAsset(threatModelId: string, assetId: string): Observable<boolean> {
    return this.threatModelService.deleteAsset(threatModelId, assetId);
  }

  /** Update an asset's metadata; emits the updated metadata array. */
  updateAssetMetadata(
    threatModelId: string,
    assetId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateAssetMetadata(threatModelId, assetId, metadata);
  }
}
```

NOTE: the `asset as Partial<ApiAssetInput>` cast mirrors how the component passes the dialog `Partial<Asset>` straight to `createAsset`/`updateAsset` today. If `Asset` and `ApiAssetInput` are structurally compatible enough to drop the cast, do so.

- [ ] **Step 4: Run the spec to verify it passes** — PASS.

- [ ] **Step 5: Wire the component**

Add the import and constructor param after `private noteCrud: TmNoteCrudService,`:

```typescript
import { TmAssetCrudService } from './services/tm-asset-crud.service';
// ...
    private assetCrud: TmAssetCrudService,
```

Rewrite `loadAssets` — keep the leading `threatModel.assets = []` reset and the error-fallback reset:

```typescript
  private loadAssets(threatModelId: string): void {
    if (this.threatModel) {
      this.threatModel.assets = [];
    }
    this._subscriptions.add(
      this.assetCrud.loadAssets(threatModelId, this.assetsPageIndex, this.assetsPageSize).subscribe({
        next: page => {
          if (this.threatModel) {
            this.threatModel.assets = page.assets;
            this.assetsDataSource.data = page.assets;
            this.totalAssets = page.total;
          }
        },
        error: error => {
          this.logger.error('Failed to load assets', error);
          if (this.threatModel) {
            this.threatModel.assets = [];
            this.assetsDataSource.data = [];
            this.totalAssets = 0;
          }
        },
      }),
    );
  }
```

Rewrite `addAsset` — dialog via `TmDialogService.openAssetEditor`, create via `TmAssetCrudService`. The original `createAsset` subscribe already has an `error` callback; preserve it:

```typescript
  addAsset(): void {
    if (!this.canEdit) {
      this.logger.warn('User does not have permission to create assets');
      return;
    }
    const dialogData: AssetEditorDialogData = {
      mode: 'create',
      isReadOnly: !this.canEdit,
    };
    this._subscriptions.add(
      this.dialogService.openAssetEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.assetCrud.createAsset(this.threatModel.id, result).subscribe({
            next: () => {
              if (this.threatModel) {
                this.loadAssets(this.threatModel.id);
              }
            },
            error: error => this.logger.error('Failed to create asset', error),
          }),
        );
      }),
    );
  }
```

Rewrite `editAsset` — the original `updateAsset` subscribe uses the deprecated two-arg `subscribe(next, error)` form; it DOES have an `error` callback (no missing-handler fix needed) but convert it to the object form `subscribe({ next, error })`:

```typescript
  editAsset(asset: Asset, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: AssetEditorDialogData = {
      mode: 'edit',
      asset: { ...asset },
      isReadOnly: !this.canEdit,
    };
    this._subscriptions.add(
      this.dialogService.openAssetEditor(dialogData).subscribe(result => {
        if (!result || !this.threatModel) return;
        this._subscriptions.add(
          this.assetCrud.updateAsset(this.threatModel.id, asset.id, result).subscribe({
            next: updatedAsset => {
              if (this.threatModel && this.threatModel.assets) {
                const index = this.threatModel.assets.findIndex(a => a.id === asset.id);
                if (index !== -1) {
                  this.threatModel.assets[index] = updatedAsset;
                }
                this.assetsDataSource.data = this.threatModel.assets;
                this.logger.info('Updated asset via API', { asset: updatedAsset });
              }
            },
            error: error => this.logger.error('Failed to update asset', error),
          }),
        );
      }),
    );
  }
```

Rewrite `deleteAsset` — dialog via `TmDialogService.openDeleteConfirmation`, delete via `TmAssetCrudService`. **Missing-error-handler fix:** the original `deleteAsset` subscribe (single-arg) has no `error` callback. Add one:

```typescript
  deleteAsset(asset: Asset, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    if (!this.threatModel || !this.threatModel.assets || !this.canEdit) {
      this.logger.warn('User does not have permission to delete assets');
      return;
    }
    const dialogData: DeleteConfirmationDialogData = {
      id: asset.id,
      name: asset.name,
      objectType: 'asset',
    };
    this._subscriptions.add(
      this.dialogService.openDeleteConfirmation(dialogData).subscribe(result => {
        if (!result?.confirmed || !this.threatModel || !this.threatModel.assets) return;
        this._subscriptions.add(
          this.assetCrud.deleteAsset(this.threatModel.id, asset.id).subscribe({
            next: success => {
              if (success && this.threatModel && this.threatModel.assets) {
                this.threatModel.assets = this.threatModel.assets.filter(
                  a => a.id !== asset.id,
                );
                this.assetsDataSource.data = this.threatModel.assets;
                this.logger.info('Deleted asset', { assetId: asset.id });
              }
            },
            error: error => this.logger.error('Failed to delete asset', error),
          }),
        );
      }),
    );
  }
```

Rewrite `openAssetMetadataDialog` — **missing-error-handler fix:** the original has no `error` callback on `updateAssetMetadata`. Add one. Preserve the `&& this.canEdit` guard:

```typescript
  openAssetMetadataDialog(asset: Asset, event: Event): void {
    event.stopPropagation();
    (event.target as HTMLElement)?.blur();

    const dialogData: MetadataDialogData = {
      metadata: asset.metadata || [],
      isReadOnly: !this.canEdit,
      objectType: 'Asset',
      objectName: `${this.transloco.translate('common.objectTypes.asset')}: ${asset.name} (${asset.id})`,
    };
    this._subscriptions.add(
      this.dialogService.openMetadata(dialogData).subscribe(result => {
        if (!result || !this.threatModel || !this.canEdit) return;
        this._subscriptions.add(
          this.assetCrud
            .updateAssetMetadata(this.threatModel.id, asset.id, result)
            .subscribe({
              next: updatedMetadata => {
                if (updatedMetadata && this.threatModel && this.threatModel.assets) {
                  const assetIndex = this.threatModel.assets.findIndex(a => a.id === asset.id);
                  if (assetIndex !== -1) {
                    this.threatModel.assets[assetIndex].metadata = updatedMetadata;
                  }
                  this.logger.info('Updated asset metadata via API', {
                    assetId: asset.id,
                    metadata: updatedMetadata,
                  });
                }
              },
              error: error => this.logger.error('Failed to update asset metadata', error),
            }),
        );
      }),
    );
  }
```

`onAssetsPageChange` is unchanged.

- [ ] **Step 6: Remove now-unused component imports**

After all five entity groups are wired, several dialog-component imports in `tm-edit.component.ts` are no longer directly referenced (the component now builds only `*DialogData` objects; `TmDialogService` owns the `*DialogComponent` references and the `*Result` types). Verify each with `rg -n '<Name>' src/app/pages/tm/tm-edit.component.ts` and remove only genuinely-unused ones. Likely removable: `CreateDiagramDialogComponent`, `RepositoryEditorDialogComponent`, `NoteEditorDialogComponent`, `NoteEditorResult` may still be needed (the `addNote` `afterClosed` callback annotates `result: NoteEditorResult`), `AssetEditorDialogComponent`, `ThreatEditorDialogComponent`. Likely still needed: `RepositoryEditorDialogData`, `NoteEditorDialogData`, `AssetEditorDialogData`, `ThreatEditorDialogData`, `MetadataDialogData`, `DeleteConfirmationDialogData` (the component still constructs these). `MetadataDialogComponent` / `DeleteConfirmationDialogComponent` / `DeleteConfirmationDialogResult` should be gone once no method opens those dialogs directly. Do not guess — grep each.

- [ ] **Step 7: Build, test, lint** — `pnpm run build` → `pnpm test` → `pnpm run lint:all`.

- [ ] **Step 8: Commit (both files)**

```bash
git add src/app/pages/tm/services/tm-asset-crud.service.ts src/app/pages/tm/services/tm-asset-crud.service.spec.ts src/app/pages/tm/tm-edit.component.ts
git commit -m "refactor: extract asset CRUD into TmAssetCrudService (#695)

Also adds a missing error handler to the asset delete flow and the
asset metadata flow, whose underlying service calls throw on API failure."
```

- [ ] **Step 9: Phase 5 verification report**

Report: `tm-edit.component.ts` line count before Phase 5 (3,456) vs after; total new unit-test count from the five `*-crud.service.spec.ts` files plus the five new `TmDialogService` cases; confirm all five entity groups now delegate to thin glue; list the missing error handlers fixed (see Phase 5 Self-Review). Flag the `dialogMode` vs `mode` correction in `openThreatEditorWithData` (Task 14 Step 5) and any type casts that were added (`RepositoryFormResult.type`, `NoteFormResult` → `ApiNoteInput`, `Partial<Asset>` → `ApiAssetInput`) as deviations from a pure pass-through, so the user can review them.

## Phase 5 Self-Review

**Spec coverage — every group's methods accounted for:**
- **Diagrams (Task 13):** `loadDiagrams`, `addDiagram`, `deleteDiagram`, `onDiagramsPageChange`, `openDiagramMetadataDialog`, `downloadDiagramModel`. CRUD service covers `loadDiagrams`/`createDiagram`/`deleteDiagram`/`getDiagramMetadata`/`updateDiagramMetadata`/`getDiagramModel`. Stays in component: `handleDiagramModelExport`, `getFileTypesForFormat`, `computeDiagramSvgData`, `hasSvgImage`, `getSvgDataUrl`, `getDiagramIcon`/`getDiagramTooltip` (already delegated to formatting service), `onThumbnailHover`, `getHoveredDiagramSvgUrl`. No `editDiagram` exists — confirmed. ✓
- **Threats (Task 14):** `addThreat`, `openThreatEditor`, `openThreatEditorWithData`, `_handleCreateThreatResult`, `_handleEditThreatResult`, `_copyDefinedFields` (moved into service), `deleteThreat`, `loadThreats`, `openThreatMetadataDialog`. CRUD service covers `buildThreatListParams`/`loadThreats`/`buildCreateThreatData`/`buildUpdateThreatData`/`createThreat`/`updateThreat`/`deleteThreat`/`updateThreatMetadata`. Stays in component: `loadThreatsAndSaveState`, `onThreatsPageChange`, `onThreatNameFilterChange`, `onThreatFilterChange`, `onThreatSortChange`, `clearAllThreatFilters`, `toggleMitigatedFilter`, `saveThreatCardState`, `restoreThreatCardState`, `updateThreatTypeOptions`, `hasActiveThreatFilters`/`hasAdvancedThreatFiltersActive` getters, `ThreatFilterStateService`, the edit-mode page navigation, and the `migrateThreatFieldValues` view-mapping pass. ✓
- **Repositories (Task 15):** `loadRepositories`, `addRepository`, `onRepositoryUrlDropped`, `editRepository`, `deleteRepository`, `getRepositoryTooltip`, `openRepositoryMetadataDialog`, `onRepositoriesPageChange`. CRUD service covers `getRepositoryTooltip`/`buildRepositoryData`/`loadRepositories`/`createRepository`/`updateRepository`/`deleteRepository`/`updateRepositoryMetadata`. `loadRepositories`/`onRepositoriesPageChange` confirmed to exist (the Phase 5 brief's uncertainty resolved). Stays in component: `openRepositoryView` (placeholder stub). ✓
- **Notes (Task 16):** `addNote`, `editNote`, `deleteNote`, `downloadNote`, `loadNotes`, `openNoteMetadataDialog`, `onNotesPageChange`. CRUD service covers `loadNotes`/`createNote`/`updateNote`/`deleteNote`/`updateNoteMetadata`. Stays in component: the two-phase `addNote` `saveEvent`/`afterClosed` wiring (must touch `componentInstance`), `editNote` (navigation only), `downloadNote` (client-side blob). ✓
- **Assets (Task 17):** `loadAssets`, `addAsset`, `editAsset`, `deleteAsset`, `openAssetMetadataDialog`, `onAssetsPageChange`. CRUD service covers `loadAssets`/`createAsset`/`updateAsset`/`deleteAsset`/`updateAssetMetadata`. Stays in component: `getAssetTypeIcon` (already in `TmEditFormattingService` — not re-extracted). ✓

**Placeholder scan:** No TBD/TODO. Every task shows full code for both the service and the component glue. The NOTE blocks (`openNoteEditor` returns `MatDialogRef`; `dialogMode` vs `mode`; the three structural type casts; `ThreatFilters` import path) are verification/deviation flags, not placeholders. The one pre-existing `openRepositoryView` TODO is left in the component intentionally (out of scope). ✓

**Type consistency:** Each per-page interface is defined once in its own service file and not re-exported: `DiagramsPage` (Task 13), `ThreatsPage` + `ThreatQueryState` (Task 14), `RepositoriesPage` (Task 15), `NotesPage` (Task 16), `AssetsPage` (Task 17). `RepositoryFormResult` is defined once — moved from the component into `tm-dialog.service.ts` (Task 12) and imported by both `TmRepositoryCrudService` and the component. `DiagramCreateDialogData`/`DiagramCreateDialogResult` are defined once in `tm-dialog.service.ts` (Task 12). `TmDialogService` method names (`openDiagramCreate`, `openThreatEditor`, `openRepositoryEditor`, `openNoteEditor`, `openAssetEditor`) are consistent between the Task 12 definitions and the Task 13–17 call sites. Each CRUD service's method names are consistent between its Task-N service definition and Task-N component wiring. All declared service return types match the real `ThreatModelService` signatures verified in "Verified facts" above (`Observable<Diagram|Threat|Repository|Note|Asset>`, `Observable<boolean>`, `Observable<Metadata[]>`, `Observable<string>`). ✓

**View-state boundary — confirmed component-side for every group:** No CRUD-service method in Tasks 13–17 touches any `MatTableDataSource` (`diagramsDataSource`/`threatsDataSource`/`repositoriesDataSource`/`notesDataSource`/`assetsDataSource`), any pagination field (`*PageIndex`/`*PageSize`/`total*`), the `diagrams` getter/setter or `_diagrams`, the `DIAGRAMS_BY_ID` map, the SVG caches (`diagramSvgValidation`/`diagramSvgDataUrls`/`svgCacheService`), the threat filter/sort UI state, or `ThreatFilterStateService`. Every such write lives in the Task 13–17 component glue. CRUD services receive primitives (ids, page index/size, query state, dialog results) and return data/Observables only. ✓

**Error-handler fixes (user-approved behavior change) — per group:**
- Diagrams: 2 — `deleteDiagram`, `openDiagramMetadataDialog` (the latter counts both the `getDiagramMetadata` fetch and the `updateDiagramMetadata` write as one flow with two added handlers).
- Threats: 3 — `_handleEditThreatResult` (`updateThreat`), `deleteThreat`, `openThreatMetadataDialog` (`updateThreatMetadata`).
- Repositories: 3 — `editRepository` (`updateRepository`), `deleteRepository`, `openRepositoryMetadataDialog` (`updateRepositoryMetadata`).
- Notes: 2 — `deleteNote`, `openNoteMetadataDialog` (`updateNoteMetadata`). (`addNote`'s `updateNote` already had a handler via the deprecated two-arg form — converted to object form, not a missing-handler fix.)
- Assets: 2 — `deleteAsset`, `openAssetMetadataDialog` (`updateAssetMetadata`). (`editAsset`'s `updateAsset` already had a handler via the deprecated two-arg form — converted to object form, not a missing-handler fix.) ✓
