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
