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
