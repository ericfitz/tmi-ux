# SSVC Supplier Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an SSVC Supplier decision tree calculator to the threat page, enabling structured vulnerability prioritization alongside the existing CVSS calculator.

**Architecture:** Dialog-based stepper wizard (4 steps) with a self-contained decision engine (no external library). Follows the same integration pattern as the CVSS calculator — chip display on the threat page, dialog for create/edit. Custom stepper logic (not MatStepper) for full control over downstream invalidation behavior.

**Tech Stack:** Angular 21, Angular Material, Transloco i18n, Vitest

**Spec:** `docs/superpowers/specs/2026-04-08-ssvc-calculator-design.md`

---

### Task 1: Data Model — SSVCScore Interface and Threat Extension

**Files:**
- Modify: `src/app/pages/tm/models/threat-model.model.ts:92-120`

- [ ] **Step 1: Add SSVCScore interface and ssvc field to Threat**

Add the `SSVCScore` interface after the existing `CVSSScore` interface (line 95), and add the `ssvc` field to the `Threat` interface.

```typescript
// Add after CVSSScore interface (after line 95):
export interface SSVCScore {
  vector: string;
  decision: string;
  methodology: string;
}
```

Add to the `Threat` interface (after `cvss?: CVSSScore[];` on line 119):

```typescript
  ssvc?: SSVCScore;
```

- [ ] **Step 2: Verify build compiles**

Run: `pnpm run build`
Expected: Build succeeds (new types are additive, no consumers yet)

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/models/threat-model.model.ts
git commit -m "feat(ssvc): add SSVCScore interface and ssvc field to Threat model"
```

---

### Task 2: Decision Engine — Lookup Table and Vector Builder

**Files:**
- Create: `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-decision-tree.ts`
- Create: `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-decision-tree.spec.ts`

- [ ] **Step 1: Write the decision engine tests**

Create `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-decision-tree.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';

import {
  SsvcDecision,
  SsvcExploitation,
  SsvcUtility,
  SsvcTechnicalImpact,
  SsvcPublicSafetyImpact,
  getSupplierDecision,
  buildSsvcVector,
  parseSsvcVector,
  SSVC_DECISION_POINTS,
} from './ssvc-decision-tree';

describe('ssvc-decision-tree', () => {
  describe('getSupplierDecision', () => {
    it('should return Defer for None/Laborious/Partial/Minimal', () => {
      expect(getSupplierDecision('N', 'L', 'P', 'M')).toBe('Defer');
    });

    it('should return Scheduled for None/Laborious/Partial/Significant', () => {
      expect(getSupplierDecision('N', 'L', 'P', 'S')).toBe('Scheduled');
    });

    it('should return Out-of-Cycle for None/Laborious/Total/Significant', () => {
      expect(getSupplierDecision('N', 'L', 'T', 'S')).toBe('Out-of-Cycle');
    });

    it('should return Immediate for Active/Super Effective/Total/Significant', () => {
      expect(getSupplierDecision('A', 'S', 'T', 'S')).toBe('Immediate');
    });

    it('should return Immediate for Active/Super Effective/Partial/Minimal', () => {
      expect(getSupplierDecision('A', 'S', 'P', 'M')).toBe('Immediate');
    });

    it('should return Out-of-Cycle for Active/Laborious/Partial/Minimal', () => {
      expect(getSupplierDecision('A', 'L', 'P', 'M')).toBe('Out-of-Cycle');
    });

    it('should return Immediate for PoC/Efficient/Total/Significant', () => {
      expect(getSupplierDecision('P', 'E', 'T', 'S')).toBe('Immediate');
    });

    it('should return Scheduled for PoC/Laborious/Partial/Minimal', () => {
      expect(getSupplierDecision('P', 'L', 'P', 'M')).toBe('Scheduled');
    });

    it('should return null for invalid inputs', () => {
      expect(getSupplierDecision('X' as SsvcExploitation, 'L', 'P', 'M')).toBeNull();
    });
  });

  describe('buildSsvcVector', () => {
    it('should build a valid vector string with date', () => {
      const vector = buildSsvcVector('A', 'S', 'T', 'S');
      expect(vector).toMatch(/^SSVCv2\/E:A\/U:S\/T:T\/P:S\/\d{4}-\d{2}-\d{2}\/$/);
    });

    it('should use provided date', () => {
      const vector = buildSsvcVector('N', 'L', 'P', 'M', '2026-04-08');
      expect(vector).toBe('SSVCv2/E:N/U:L/T:P/P:M/2026-04-08/');
    });
  });

  describe('parseSsvcVector', () => {
    it('should parse a valid vector string', () => {
      const result = parseSsvcVector('SSVCv2/E:A/U:S/T:T/P:S/2026-04-08/');
      expect(result).toEqual({
        exploitation: 'A',
        utility: 'S',
        technicalImpact: 'T',
        publicSafetyImpact: 'S',
        date: '2026-04-08',
      });
    });

    it('should return null for invalid vector string', () => {
      expect(parseSsvcVector('invalid')).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseSsvcVector('')).toBeNull();
    });

    it('should return null for wrong version prefix', () => {
      expect(parseSsvcVector('SSVCv1/E:A/U:S/T:T/P:S/2026-04-08/')).toBeNull();
    });

    it('should return null for invalid decision point values', () => {
      expect(parseSsvcVector('SSVCv2/E:X/U:S/T:T/P:S/2026-04-08/')).toBeNull();
    });
  });

  describe('SSVC_DECISION_POINTS', () => {
    it('should have 4 decision points', () => {
      expect(SSVC_DECISION_POINTS).toHaveLength(4);
    });

    it('should have exploitation with 3 values', () => {
      const exploitation = SSVC_DECISION_POINTS[0];
      expect(exploitation.key).toBe('exploitation');
      expect(exploitation.values).toHaveLength(3);
    });

    it('should have technicalImpact with 2 values', () => {
      const ti = SSVC_DECISION_POINTS[2];
      expect(ti.key).toBe('technicalImpact');
      expect(ti.values).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-decision-tree.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the decision engine**

Create `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-decision-tree.ts`:

```typescript
/** Short codes for Exploitation decision point */
export type SsvcExploitation = 'N' | 'P' | 'A';

/** Short codes for Utility decision point */
export type SsvcUtility = 'L' | 'E' | 'S';

/** Short codes for Technical Impact decision point */
export type SsvcTechnicalImpact = 'P' | 'T';

/** Short codes for Public Safety Impact decision point */
export type SsvcPublicSafetyImpact = 'M' | 'S';

/** SSVC Supplier decision outcomes */
export type SsvcDecision = 'Defer' | 'Scheduled' | 'Out-of-Cycle' | 'Immediate';

/** Parsed SSVC vector components */
export interface SsvcVectorComponents {
  exploitation: SsvcExploitation;
  utility: SsvcUtility;
  technicalImpact: SsvcTechnicalImpact;
  publicSafetyImpact: SsvcPublicSafetyImpact;
  date: string;
}

/** A single value option for a decision point */
export interface SsvcDecisionPointValue {
  shortName: string;
  nameKey: string;
  descriptionKey: string;
}

/** A decision point with its values */
export interface SsvcDecisionPoint {
  key: string;
  nameKey: string;
  descriptionKey: string;
  values: SsvcDecisionPointValue[];
}

/**
 * SSVC Supplier decision tree lookup table.
 * Key format: "E:U:T:P" using short codes.
 * Source: https://certcc.github.io/SSVC/howto/supplier_tree/
 */
const SUPPLIER_TREE: Record<string, SsvcDecision> = {
  // Exploitation: None
  'N:L:P:M': 'Defer',
  'N:L:P:S': 'Scheduled',
  'N:L:T:M': 'Scheduled',
  'N:L:T:S': 'Out-of-Cycle',
  'N:E:P:M': 'Scheduled',
  'N:E:P:S': 'Out-of-Cycle',
  'N:E:T:M': 'Scheduled',
  'N:E:T:S': 'Out-of-Cycle',
  'N:S:P:M': 'Scheduled',
  'N:S:P:S': 'Out-of-Cycle',
  'N:S:T:M': 'Out-of-Cycle',
  'N:S:T:S': 'Out-of-Cycle',
  // Exploitation: Public PoC
  'P:L:P:M': 'Scheduled',
  'P:L:P:S': 'Out-of-Cycle',
  'P:L:T:M': 'Scheduled',
  'P:L:T:S': 'Immediate',
  'P:E:P:M': 'Scheduled',
  'P:E:P:S': 'Immediate',
  'P:E:T:M': 'Out-of-Cycle',
  'P:E:T:S': 'Immediate',
  'P:S:P:M': 'Out-of-Cycle',
  'P:S:P:S': 'Immediate',
  'P:S:T:M': 'Out-of-Cycle',
  'P:S:T:S': 'Immediate',
  // Exploitation: Active
  'A:L:P:M': 'Out-of-Cycle',
  'A:L:P:S': 'Immediate',
  'A:L:T:M': 'Out-of-Cycle',
  'A:L:T:S': 'Immediate',
  'A:E:P:M': 'Out-of-Cycle',
  'A:E:P:S': 'Immediate',
  'A:E:T:M': 'Out-of-Cycle',
  'A:E:T:S': 'Immediate',
  'A:S:P:M': 'Immediate',
  'A:S:P:S': 'Immediate',
  'A:S:T:M': 'Immediate',
  'A:S:T:S': 'Immediate',
};

const VALID_EXPLOITATION: readonly string[] = ['N', 'P', 'A'];
const VALID_UTILITY: readonly string[] = ['L', 'E', 'S'];
const VALID_TECHNICAL_IMPACT: readonly string[] = ['P', 'T'];
const VALID_PUBLIC_SAFETY: readonly string[] = ['M', 'S'];

/** Decision point metadata for UI rendering. All display strings are i18n keys. */
export const SSVC_DECISION_POINTS: SsvcDecisionPoint[] = [
  {
    key: 'exploitation',
    nameKey: 'ssvcCalculator.exploitation.name',
    descriptionKey: 'ssvcCalculator.exploitation.description',
    values: [
      { shortName: 'N', nameKey: 'ssvcCalculator.exploitation.none', descriptionKey: 'ssvcCalculator.exploitation.noneDesc' },
      { shortName: 'P', nameKey: 'ssvcCalculator.exploitation.poc', descriptionKey: 'ssvcCalculator.exploitation.pocDesc' },
      { shortName: 'A', nameKey: 'ssvcCalculator.exploitation.active', descriptionKey: 'ssvcCalculator.exploitation.activeDesc' },
    ],
  },
  {
    key: 'utility',
    nameKey: 'ssvcCalculator.utility.name',
    descriptionKey: 'ssvcCalculator.utility.description',
    values: [
      { shortName: 'L', nameKey: 'ssvcCalculator.utility.laborious', descriptionKey: 'ssvcCalculator.utility.laboriousDesc' },
      { shortName: 'E', nameKey: 'ssvcCalculator.utility.efficient', descriptionKey: 'ssvcCalculator.utility.efficientDesc' },
      { shortName: 'S', nameKey: 'ssvcCalculator.utility.superEffective', descriptionKey: 'ssvcCalculator.utility.superEffectiveDesc' },
    ],
  },
  {
    key: 'technicalImpact',
    nameKey: 'ssvcCalculator.technicalImpact.name',
    descriptionKey: 'ssvcCalculator.technicalImpact.description',
    values: [
      { shortName: 'P', nameKey: 'ssvcCalculator.technicalImpact.partial', descriptionKey: 'ssvcCalculator.technicalImpact.partialDesc' },
      { shortName: 'T', nameKey: 'ssvcCalculator.technicalImpact.total', descriptionKey: 'ssvcCalculator.technicalImpact.totalDesc' },
    ],
  },
  {
    key: 'publicSafetyImpact',
    nameKey: 'ssvcCalculator.publicSafetyImpact.name',
    descriptionKey: 'ssvcCalculator.publicSafetyImpact.description',
    values: [
      { shortName: 'M', nameKey: 'ssvcCalculator.publicSafetyImpact.minimal', descriptionKey: 'ssvcCalculator.publicSafetyImpact.minimalDesc' },
      { shortName: 'S', nameKey: 'ssvcCalculator.publicSafetyImpact.significant', descriptionKey: 'ssvcCalculator.publicSafetyImpact.significantDesc' },
    ],
  },
];

/**
 * Look up the Supplier decision for a given combination of decision point values.
 * Returns null if inputs are invalid.
 */
export function getSupplierDecision(
  exploitation: SsvcExploitation,
  utility: SsvcUtility,
  technicalImpact: SsvcTechnicalImpact,
  publicSafetyImpact: SsvcPublicSafetyImpact,
): SsvcDecision | null {
  const key = `${exploitation}:${utility}:${technicalImpact}:${publicSafetyImpact}`;
  return SUPPLIER_TREE[key] ?? null;
}

/**
 * Build an SSVC vector string from decision point values.
 * Uses today's date if none provided.
 */
export function buildSsvcVector(
  exploitation: SsvcExploitation,
  utility: SsvcUtility,
  technicalImpact: SsvcTechnicalImpact,
  publicSafetyImpact: SsvcPublicSafetyImpact,
  date?: string,
): string {
  const d = date ?? new Date().toISOString().slice(0, 10);
  return `SSVCv2/E:${exploitation}/U:${utility}/T:${technicalImpact}/P:${publicSafetyImpact}/${d}/`;
}

/**
 * Parse an SSVC vector string into its components.
 * Returns null if the string is invalid.
 */
export function parseSsvcVector(vector: string): SsvcVectorComponents | null {
  if (!vector || !vector.startsWith('SSVCv2/')) return null;

  const match = vector.match(
    /^SSVCv2\/E:([A-Z])\/U:([A-Z])\/T:([A-Z])\/P:([A-Z])\/(\d{4}-\d{2}-\d{2})\/$/,
  );
  if (!match) return null;

  const [, e, u, t, p, date] = match;
  if (!VALID_EXPLOITATION.includes(e)) return null;
  if (!VALID_UTILITY.includes(u)) return null;
  if (!VALID_TECHNICAL_IMPACT.includes(t)) return null;
  if (!VALID_PUBLIC_SAFETY.includes(p)) return null;

  return {
    exploitation: e as SsvcExploitation,
    utility: u as SsvcUtility,
    technicalImpact: t as SsvcTechnicalImpact,
    publicSafetyImpact: p as SsvcPublicSafetyImpact,
    date,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-decision-tree.spec.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-decision-tree.ts \
       src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-decision-tree.spec.ts
git commit -m "feat(ssvc): add Supplier decision tree engine with tests"
```

---

### Task 3: Dialog Types

**Files:**
- Create: `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.types.ts`

- [ ] **Step 1: Create the types file**

Create `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.types.ts`:

```typescript
import { SSVCScore } from '../../models/threat-model.model';

/** Data passed into the SSVC calculator dialog */
export interface SsvcCalculatorDialogData {
  /** Existing SSVC entry to edit, or undefined for new */
  existingEntry?: SSVCScore;
}

/** Result returned from the SSVC calculator dialog */
export interface SsvcCalculatorDialogResult {
  /** The computed SSVC entry */
  entry: SSVCScore;
}
```

- [ ] **Step 2: Verify build compiles**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.types.ts
git commit -m "feat(ssvc): add dialog data and result types"
```

---

### Task 4: Dialog Component — Stepper UI

**Files:**
- Create: `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.ts`
- Create: `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.html`
- Create: `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.scss`

- [ ] **Step 1: Create the component TypeScript**

Create `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.ts`:

```typescript
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  Inject,
  OnInit,
  Optional,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { DIALOG_IMPORTS, DATA_MATERIAL_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { SSVCScore } from '../../models/threat-model.model';
import {
  SsvcCalculatorDialogData,
  SsvcCalculatorDialogResult,
} from './ssvc-calculator-dialog.types';
import {
  SsvcDecision,
  SsvcDecisionPoint,
  SsvcExploitation,
  SsvcPublicSafetyImpact,
  SsvcTechnicalImpact,
  SsvcUtility,
  SSVC_DECISION_POINTS,
  buildSsvcVector,
  getSupplierDecision,
  parseSsvcVector,
} from './ssvc-decision-tree';

@Component({
  selector: 'app-ssvc-calculator-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, ...DATA_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './ssvc-calculator-dialog.component.html',
  styleUrl: './ssvc-calculator-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SsvcCalculatorDialogComponent implements OnInit {
  /** All decision points for template rendering */
  decisionPoints: SsvcDecisionPoint[] = SSVC_DECISION_POINTS;

  /** Selected values per step index (null = not yet selected) */
  selections: (string | null)[] = [null, null, null, null];

  /** Current step index (0-3 for decision points, 4 for summary) */
  currentStep = 0;

  /** Computed decision outcome */
  decision: SsvcDecision | null = null;

  /** Decision CSS class for color coding */
  decisionClass = '';

  /** Whether the dialog was opened in edit mode */
  isEditMode = false;

  /** Current text direction */
  currentDirection: 'ltr' | 'rtl' = 'ltr';

  /** Total number of decision point steps (not counting summary) */
  readonly totalSteps = SSVC_DECISION_POINTS.length;

  constructor(
    public dialogRef: MatDialogRef<SsvcCalculatorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SsvcCalculatorDialogData,
    private _cdr: ChangeDetectorRef,
    private _logger: LoggerService,
    private _languageService: LanguageService,
    private _translocoService: TranslocoService,
    @Optional() private _destroyRef?: DestroyRef,
  ) {}

  ngOnInit(): void {
    // Watch for text direction changes
    if (this._destroyRef) {
      this._languageService.direction$
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe(dir => {
          this.currentDirection = dir;
          this._cdr.markForCheck();
        });
    }

    // Initialize from existing entry if editing
    if (this.data?.existingEntry) {
      this._initializeFromEntry(this.data.existingEntry);
    }
  }

  /** Whether the current step has a selection */
  get isCurrentStepComplete(): boolean {
    return this.currentStep < this.totalSteps && this.selections[this.currentStep] !== null;
  }

  /** Whether all decision points have been selected */
  get isAllComplete(): boolean {
    return this.selections.every(s => s !== null);
  }

  /** Handle value selection on the current step */
  onValueSelect(shortName: string): void {
    const previousValue = this.selections[this.currentStep];
    this.selections[this.currentStep] = shortName;

    // If the value changed, invalidate all downstream steps
    if (previousValue !== null && previousValue !== shortName) {
      for (let i = this.currentStep + 1; i < this.totalSteps; i++) {
        this.selections[i] = null;
      }
    }

    this._recalculate();
  }

  /** Advance to the next step */
  next(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  /** Go back to the previous step */
  back(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  /** Navigate directly to a specific step (only if that step or earlier steps are complete) */
  goToStep(index: number): void {
    // Allow navigating to any step up to and including the first incomplete step
    if (index <= this._firstIncompleteStep()) {
      this.currentStep = index;
    }
  }

  /** Apply the result and close the dialog */
  apply(): void {
    if (!this.isAllComplete || !this.decision) return;

    const vector = buildSsvcVector(
      this.selections[0] as SsvcExploitation,
      this.selections[1] as SsvcUtility,
      this.selections[2] as SsvcTechnicalImpact,
      this.selections[3] as SsvcPublicSafetyImpact,
    );

    const result: SsvcCalculatorDialogResult = {
      entry: {
        vector,
        decision: this.decision,
        methodology: 'Supplier',
      },
    };

    this.dialogRef.close(result);
  }

  /** Close the dialog without saving */
  cancel(): void {
    this.dialogRef.close();
  }

  /** Recalculate decision from current selections */
  private _recalculate(): void {
    if (this.isAllComplete) {
      this.decision = getSupplierDecision(
        this.selections[0] as SsvcExploitation,
        this.selections[1] as SsvcUtility,
        this.selections[2] as SsvcTechnicalImpact,
        this.selections[3] as SsvcPublicSafetyImpact,
      );
    } else {
      this.decision = null;
    }
    this._updateDecisionClass();
    this._cdr.markForCheck();
  }

  /** Map decision to CSS class for color coding */
  private _updateDecisionClass(): void {
    switch (this.decision) {
      case 'Defer':
        this.decisionClass = 'decision-defer';
        break;
      case 'Scheduled':
        this.decisionClass = 'decision-scheduled';
        break;
      case 'Out-of-Cycle':
        this.decisionClass = 'decision-out-of-cycle';
        break;
      case 'Immediate':
        this.decisionClass = 'decision-immediate';
        break;
      default:
        this.decisionClass = '';
    }
  }

  /** Initialize selections from an existing SSVC entry */
  private _initializeFromEntry(entry: SSVCScore): void {
    const parsed = parseSsvcVector(entry.vector);
    if (!parsed) {
      this._logger.error('SsvcCalculatorDialog', 'Could not parse existing SSVC vector', entry.vector);
      return;
    }

    this.isEditMode = true;
    this.selections = [
      parsed.exploitation,
      parsed.utility,
      parsed.technicalImpact,
      parsed.publicSafetyImpact,
    ];
    // Show the summary step in edit mode
    this.currentStep = this.totalSteps;
    this._recalculate();
  }

  /** Find the index of the first step without a selection (public for template access) */
  _firstIncompleteStep(): number {
    const idx = this.selections.findIndex(s => s === null);
    return idx === -1 ? this.totalSteps : idx;
  }
}
```

- [ ] **Step 2: Create the component template**

Create `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.html`:

```html
<div [dir]="currentDirection" *transloco="let t" class="ssvc-calculator-dialog">
  <!-- Title -->
  <h2 mat-dialog-title class="dialog-title">
    <span>{{ t('ssvcCalculator.title') }}</span>
    @if (decision) {
      <span class="decision-badge" [class]="decisionClass">
        {{ t('ssvcCalculator.decisions.' + decision) }}
      </span>
    }
  </h2>

  <mat-dialog-content>
    <!-- Step indicator -->
    <div class="step-indicator">
      @for (dp of decisionPoints; track dp.key; let i = $index) {
        <div
          class="step-dot"
          [class.active]="i === currentStep"
          [class.complete]="selections[i] !== null && i !== currentStep"
          [class.clickable]="i <= _firstIncompleteStep()"
          (click)="goToStep(i)"
        >
          <div class="dot">
            @if (selections[i] !== null && i !== currentStep) {
              <mat-icon class="check-icon">check</mat-icon>
            } @else {
              {{ i + 1 }}
            }
          </div>
          <span class="step-label">{{ t(dp.nameKey) }}</span>
        </div>
        @if (i < decisionPoints.length - 1) {
          <div class="step-connector" [class.complete]="selections[i] !== null"></div>
        }
      }
    </div>

    <!-- Decision point steps -->
    @if (currentStep < totalSteps) {
      <div class="step-content">
        <div class="step-number">{{ t('ssvcCalculator.stepOf', { current: currentStep + 1, total: totalSteps }) }}</div>
        <h3 class="step-title">{{ t(decisionPoints[currentStep].nameKey) }}</h3>
        <p class="step-description">{{ t(decisionPoints[currentStep].descriptionKey) }}</p>

        <div class="value-options">
          @for (value of decisionPoints[currentStep].values; track value.shortName) {
            <div
              class="value-card"
              [class.selected]="selections[currentStep] === value.shortName"
              (click)="onValueSelect(value.shortName)"
            >
              <div class="value-name">{{ t(value.nameKey) }}</div>
              <div class="value-description">{{ t(value.descriptionKey) }}</div>
            </div>
          }
        </div>
      </div>
    }

    <!-- Summary step -->
    @if (currentStep === totalSteps && isAllComplete) {
      <div class="step-content summary-step">
        <h3 class="step-title">{{ t('ssvcCalculator.summary') }}</h3>

        <div class="summary-grid">
          @for (dp of decisionPoints; track dp.key; let i = $index) {
            <div class="summary-row">
              <span class="summary-label">{{ t(dp.nameKey) }}</span>
              <span class="summary-value">
                @for (v of dp.values; track v.shortName) {
                  @if (v.shortName === selections[i]) {
                    {{ t(v.nameKey) }}
                  }
                }
              </span>
            </div>
          }
        </div>

        <div class="decision-result" [class]="decisionClass">
          <div class="decision-result-label">{{ t('ssvcCalculator.decisionLabel') }}</div>
          <div class="decision-result-value">{{ t('ssvcCalculator.decisions.' + decision) }}</div>
          <div class="decision-result-description">{{ t('ssvcCalculator.decisions.' + decision + 'Desc') }}</div>
        </div>
      </div>
    }
  </mat-dialog-content>

  <mat-dialog-actions align="end" class="dialog-actions">
    @if (currentStep > 0) {
      <button mat-button (click)="back()">
        <mat-icon>arrow_back</mat-icon>
        {{ t('ssvcCalculator.back') }}
      </button>
    }
    <span class="spacer"></span>
    <button mat-button (click)="cancel()">{{ t('ssvcCalculator.cancel') }}</button>
    @if (currentStep < totalSteps) {
      <button
        mat-flat-button
        color="primary"
        [disabled]="!isCurrentStepComplete"
        (click)="next()"
      >
        {{ t('ssvcCalculator.next') }}
        <mat-icon iconPositionEnd>arrow_forward</mat-icon>
      </button>
    } @else {
      <button
        mat-flat-button
        color="primary"
        [disabled]="!isAllComplete"
        (click)="apply()"
      >
        {{ t('ssvcCalculator.apply') }}
      </button>
    }
  </mat-dialog-actions>
</div>
```

- [ ] **Step 3: Create the component styles**

Create `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.scss`:

```scss
.ssvc-calculator-dialog {
  min-width: 500px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.decision-badge {
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 12px;
}

.decision-defer {
  color: var(--color-severity-none);
  background-color: color-mix(in srgb, var(--color-severity-none) 15%, transparent);
}

.decision-scheduled {
  color: var(--color-severity-low);
  background-color: color-mix(in srgb, var(--color-severity-low) 15%, transparent);
}

.decision-out-of-cycle {
  color: var(--color-severity-high);
  background-color: color-mix(in srgb, var(--color-severity-high) 15%, transparent);
}

.decision-immediate {
  color: var(--color-severity-critical);
  background-color: color-mix(in srgb, var(--color-severity-critical) 15%, transparent);
}

// Step indicator
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0;
  gap: 4px;
}

.step-dot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: default;

  &.clickable {
    cursor: pointer;
  }

  .dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    background: var(--mat-sys-surface-variant);
    color: var(--mat-sys-on-surface-variant);
    transition: background-color 0.2s, color 0.2s;
  }

  &.active .dot {
    background: var(--mat-sys-primary);
    color: var(--mat-sys-on-primary);
  }

  &.complete .dot {
    background: var(--mat-sys-primary);
    color: var(--mat-sys-on-primary);
  }

  .check-icon {
    font-size: 16px;
    width: 16px;
    height: 16px;
  }

  .step-label {
    font-size: 11px;
    color: var(--mat-sys-on-surface-variant);
    white-space: nowrap;
  }

  &.active .step-label {
    color: var(--mat-sys-primary);
    font-weight: 600;
  }
}

.step-connector {
  width: 32px;
  height: 1px;
  background: var(--mat-sys-outline-variant);
  margin-bottom: 18px; // align with dot center, not label

  &.complete {
    background: var(--mat-sys-primary);
  }
}

// Step content
.step-content {
  padding: 8px 0 16px;
}

.step-number {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--mat-sys-on-surface-variant);
  margin-bottom: 4px;
}

.step-title {
  margin: 0 0 8px;
  font-size: 18px;
}

.step-description {
  margin: 0 0 20px;
  color: var(--mat-sys-on-surface-variant);
  font-size: 14px;
  line-height: 1.5;
}

// Value cards (radio-card style)
.value-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.value-card {
  border: 2px solid var(--mat-sys-outline-variant);
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;

  &:hover {
    border-color: var(--mat-sys-outline);
  }

  &.selected {
    border-color: var(--mat-sys-primary);
    background-color: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
  }

  .value-name {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 2px;
  }

  &.selected .value-name {
    color: var(--mat-sys-primary);
  }

  .value-description {
    font-size: 12px;
    color: var(--mat-sys-on-surface-variant);
    line-height: 1.4;
  }
}

// Summary step
.summary-grid {
  margin-bottom: 20px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--mat-sys-outline-variant);

  .summary-label {
    font-weight: 500;
    color: var(--mat-sys-on-surface-variant);
  }

  .summary-value {
    font-weight: 600;
  }
}

.decision-result {
  text-align: center;
  padding: 20px;
  border-radius: 12px;
  margin-top: 8px;

  .decision-result-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
    opacity: 0.8;
  }

  .decision-result-value {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .decision-result-description {
    font-size: 13px;
    opacity: 0.85;
  }
}

// Dialog actions
.dialog-actions {
  .spacer {
    flex: 1;
  }
}

// Responsive
@media (max-width: 600px) {
  .ssvc-calculator-dialog {
    min-width: unset;
  }

  .step-indicator {
    gap: 2px;
  }

  .step-label {
    font-size: 9px !important;
  }

  .step-connector {
    width: 16px;
  }
}
```

- [ ] **Step 4: Verify build compiles**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.ts \
       src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.html \
       src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.scss
git commit -m "feat(ssvc): add stepper dialog component"
```

---

### Task 5: Dialog Component Tests

**Files:**
- Create: `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.spec.ts`

- [ ] **Step 1: Write the dialog component tests**

Create `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.spec.ts`:

```typescript
// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { BehaviorSubject } from 'rxjs';

import { SsvcCalculatorDialogComponent } from './ssvc-calculator-dialog.component';
import { SsvcCalculatorDialogData } from './ssvc-calculator-dialog.types';

interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

interface MockLoggerService {
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
}

interface MockLanguageService {
  direction$: BehaviorSubject<'ltr' | 'rtl'>;
}

interface MockTranslocoService {
  translate: ReturnType<typeof vi.fn>;
}

describe('SsvcCalculatorDialogComponent', () => {
  let component: SsvcCalculatorDialogComponent;
  let dialogRef: MockDialogRef;
  let loggerService: MockLoggerService;
  let languageService: MockLanguageService;
  let translocoService: MockTranslocoService;

  function createComponent(dialogData: SsvcCalculatorDialogData = {}): void {
    dialogRef = { close: vi.fn() };
    loggerService = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    };
    languageService = {
      direction$: new BehaviorSubject('ltr' as const),
    };
    translocoService = {
      translate: vi.fn((key: string) => key),
    };

    component = new SsvcCalculatorDialogComponent(
      dialogRef as any,
      dialogData,
      { markForCheck: vi.fn() } as any,
      loggerService as any,
      languageService as any,
      translocoService as any,
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    createComponent();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should start at step 0 with no selections', () => {
      component.ngOnInit();
      expect(component.currentStep).toBe(0);
      expect(component.selections).toEqual([null, null, null, null]);
      expect(component.isEditMode).toBe(false);
      expect(component.decision).toBeNull();
    });

    it('should initialize from existing entry in edit mode', () => {
      createComponent({
        existingEntry: {
          vector: 'SSVCv2/E:A/U:S/T:T/P:S/2026-04-08/',
          decision: 'Immediate',
          methodology: 'Supplier',
        },
      });
      component.ngOnInit();
      expect(component.isEditMode).toBe(true);
      expect(component.selections).toEqual(['A', 'S', 'T', 'S']);
      expect(component.currentStep).toBe(4); // summary step
      expect(component.decision).toBe('Immediate');
    });

    it('should handle invalid existing vector gracefully', () => {
      createComponent({
        existingEntry: {
          vector: 'invalid-vector',
          decision: 'Defer',
          methodology: 'Supplier',
        },
      });
      component.ngOnInit();
      expect(component.isEditMode).toBe(false);
      expect(component.selections).toEqual([null, null, null, null]);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('stepper navigation', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should advance to next step', () => {
      component.selections[0] = 'N';
      component.next();
      expect(component.currentStep).toBe(1);
    });

    it('should go back to previous step', () => {
      component.currentStep = 2;
      component.back();
      expect(component.currentStep).toBe(1);
    });

    it('should not go back from step 0', () => {
      component.back();
      expect(component.currentStep).toBe(0);
    });

    it('should not advance past summary step', () => {
      component.currentStep = 4;
      component.next();
      expect(component.currentStep).toBe(4);
    });
  });

  describe('value selection', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should set the selection for the current step', () => {
      component.onValueSelect('N');
      expect(component.selections[0]).toBe('N');
    });

    it('should invalidate downstream steps when changing a selection', () => {
      // Fill in all steps
      component.selections = ['N', 'L', 'P', 'M'];
      component.currentStep = 0;

      // Change step 0
      component.onValueSelect('A');
      expect(component.selections[0]).toBe('A');
      expect(component.selections[1]).toBeNull();
      expect(component.selections[2]).toBeNull();
      expect(component.selections[3]).toBeNull();
    });

    it('should not invalidate downstream when selecting the same value', () => {
      component.selections = ['N', 'L', 'P', 'M'];
      component.currentStep = 0;

      component.onValueSelect('N');
      expect(component.selections).toEqual(['N', 'L', 'P', 'M']);
    });

    it('should calculate decision when all steps are complete', () => {
      component.currentStep = 0;
      component.onValueSelect('N');
      component.currentStep = 1;
      component.onValueSelect('L');
      component.currentStep = 2;
      component.onValueSelect('P');
      component.currentStep = 3;
      component.onValueSelect('M');
      expect(component.decision).toBe('Defer');
    });
  });

  describe('decision class mapping', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('should set decision-defer class', () => {
      component.selections = ['N', 'L', 'P', 'M'];
      component.onValueSelect('M'); // trigger recalculate from step 3
      // Need to set currentStep to 3 first
      component.currentStep = 3;
      component.selections = ['N', 'L', 'P', null];
      component.onValueSelect('M');
      expect(component.decisionClass).toBe('decision-defer');
    });

    it('should set decision-immediate class', () => {
      component.currentStep = 3;
      component.selections = ['A', 'S', 'T', null];
      component.onValueSelect('S');
      expect(component.decisionClass).toBe('decision-immediate');
    });
  });

  describe('dialog actions', () => {
    it('should close with result on apply', () => {
      createComponent();
      component.ngOnInit();
      component.selections = ['A', 'S', 'T', 'S'];
      component.currentStep = 4;
      // Trigger recalculation by selecting the last value
      component.currentStep = 3;
      component.selections = ['A', 'S', 'T', null];
      component.onValueSelect('S');
      component.currentStep = 4;

      component.apply();

      expect(dialogRef.close).toHaveBeenCalledWith(
        expect.objectContaining({
          entry: expect.objectContaining({
            decision: 'Immediate',
            methodology: 'Supplier',
            vector: expect.stringMatching(/^SSVCv2\/E:A\/U:S\/T:T\/P:S\//),
          }),
        }),
      );
    });

    it('should not apply when incomplete', () => {
      createComponent();
      component.ngOnInit();
      component.selections = ['A', null, null, null];
      component.apply();
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should close without result on cancel', () => {
      createComponent();
      component.ngOnInit();
      component.cancel();
      expect(dialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('computed properties', () => {
    beforeEach(() => {
      component.ngOnInit();
    });

    it('isCurrentStepComplete should be false when no selection', () => {
      expect(component.isCurrentStepComplete).toBe(false);
    });

    it('isCurrentStepComplete should be true when step has selection', () => {
      component.selections[0] = 'N';
      expect(component.isCurrentStepComplete).toBe(true);
    });

    it('isAllComplete should be false when any step is null', () => {
      component.selections = ['N', 'L', null, 'M'];
      expect(component.isAllComplete).toBe(false);
    });

    it('isAllComplete should be true when all steps have values', () => {
      component.selections = ['N', 'L', 'P', 'M'];
      expect(component.isAllComplete).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm vitest run src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.spec.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.spec.ts
git commit -m "test(ssvc): add dialog component unit tests"
```

---

### Task 6: Localization — English Translation Keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Add ssvcCalculator translation keys**

Add the following `ssvcCalculator` section to `src/assets/i18n/en-US.json` (place it alphabetically near the `cvssCalculator` section):

```json
  "ssvcCalculator": {
    "title": "SSVC Calculator",
    "methodology": "Supplier",
    "apply": "Apply",
    "cancel": "Cancel",
    "next": "Next",
    "back": "Back",
    "stepOf": "Step {{current}} of {{total}}",
    "openCalculator": "Add SSVC",
    "vectorString": "Vector String",
    "decisionLabel": "Decision",
    "summary": "Summary",
    "exploitation": {
      "name": "Exploitation",
      "description": "What is the current state of exploitation of this vulnerability?",
      "none": "None",
      "noneDesc": "No evidence of active exploitation and no public proof-of-concept.",
      "poc": "Public PoC",
      "pocDesc": "A typical public proof-of-concept exists (e.g., on Metasploit or ExploitDB), or a well-known exploitation method is documented.",
      "active": "Active",
      "activeDesc": "There is reliable evidence that this vulnerability is being actively exploited in the wild by attackers."
    },
    "utility": {
      "name": "Utility",
      "description": "How useful is exploitation of this vulnerability to a typical attacker?",
      "laborious": "Laborious",
      "laboriousDesc": "Exploitation cannot be automated and targets are diffuse \u2014 manual effort with low return per attack.",
      "efficient": "Efficient",
      "efficientDesc": "Either exploitation can be automated with diffuse targets, or it requires manual effort but targets are concentrated \u2014 moderate attacker benefit.",
      "superEffective": "Super Effective",
      "superEffectiveDesc": "Exploitation can be automated and targets are concentrated \u2014 automated exploitation of high-value systems."
    },
    "technicalImpact": {
      "name": "Technical Impact",
      "description": "What is the severity of the technical impact if the vulnerability is exploited?",
      "partial": "Partial",
      "partialDesc": "Limited control over software behavior or information exposure, or a small probability of gaining total control.",
      "total": "Total",
      "totalDesc": "Total control of the software's behavior, or complete disclosure of all information on the system."
    },
    "publicSafetyImpact": {
      "name": "Public Safety Impact",
      "description": "Does exploitation of this vulnerability pose a risk to public safety?",
      "minimal": "Minimal",
      "minimalDesc": "Safety impact is negligible. No expected harm to persons or critical infrastructure.",
      "significant": "Significant",
      "significantDesc": "Safety impact is marginal, critical, or catastrophic. Potential harm to persons or disruption of critical services."
    },
    "decisions": {
      "Defer": "Defer",
      "DeferDesc": "No immediate action required. Resolve within normal development cycles (~90 days).",
      "Scheduled": "Scheduled",
      "ScheduledDesc": "Address during regular maintenance or development cycles.",
      "Out-of-Cycle": "Out-of-Cycle",
      "Out-of-CycleDesc": "Develop a fix outside normal processes. Reallocate resources for expedited delivery.",
      "Immediate": "Immediate",
      "ImmediateDesc": "Mobilize all available resources for rapid remediation. Highest urgency."
    }
  }
```

- [ ] **Step 2: Verify build compiles**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "chore(i18n): add SSVC calculator English translation keys"
```

---

### Task 7: Threat Page Integration — SSVC Chip and Dialog Triggers

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.ts`
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.html`
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.scss`

- [ ] **Step 1: Add imports and form field to the component TypeScript**

In `src/app/pages/tm/components/threat-page/threat-page.component.ts`:

Add import for SSVCScore at line 38 (extend the existing import):

```typescript
import { CVSSScore, SSVCScore, Threat, ThreatModel } from '../../models/threat-model.model';
```

Add imports for the SSVC dialog (after the CVSS calculator import, around line 51):

```typescript
import { SsvcCalculatorDialogComponent } from '../ssvc-calculator-dialog/ssvc-calculator-dialog.component';
import {
  SsvcCalculatorDialogData,
  SsvcCalculatorDialogResult,
} from '../ssvc-calculator-dialog/ssvc-calculator-dialog.types';
```

Add `ssvc` to the form group (after `cvss: [[]],` on line 214):

```typescript
      ssvc: [null],
```

- [ ] **Step 2: Add SSVC methods to the component**

Add the following methods after the `_getExistingCvssVersions()` method (after line 1030):

```typescript
  /**
   * Open the SSVC calculator dialog to create a new entry
   */
  openSsvcCalculator(): void {
    const dialogRef = this.dialog.open(SsvcCalculatorDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {} as SsvcCalculatorDialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: SsvcCalculatorDialogResult | undefined) => {
        if (!result) return;
        this.threatForm.patchValue({ ssvc: result.entry });
        this.threatForm.markAsDirty();
      });
  }

  /**
   * Open the SSVC calculator dialog to edit the existing entry
   */
  editSsvcEntry(): void {
    const existing = this.threatForm.get('ssvc')?.value as SSVCScore | null;
    if (!existing) return;

    const dialogRef = this.dialog.open(SsvcCalculatorDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: { existingEntry: existing } as SsvcCalculatorDialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(this.untilDestroyed())
      .subscribe((result: SsvcCalculatorDialogResult | undefined) => {
        if (!result) return;
        this.threatForm.patchValue({ ssvc: result.entry });
        this.threatForm.markAsDirty();
      });
  }

  /**
   * Remove the SSVC entry
   */
  removeSsvcEntry(): void {
    this.threatForm.patchValue({ ssvc: null });
    this.threatForm.markAsDirty();
  }

  /**
   * Get CSS class for the SSVC decision chip
   */
  getSsvcDecisionClass(): string {
    const ssvc = this.threatForm.get('ssvc')?.value as SSVCScore | null;
    if (!ssvc) return '';
    switch (ssvc.decision) {
      case 'Defer': return 'ssvc-decision-defer';
      case 'Scheduled': return 'ssvc-decision-scheduled';
      case 'Out-of-Cycle': return 'ssvc-decision-out-of-cycle';
      case 'Immediate': return 'ssvc-decision-immediate';
      default: return '';
    }
  }
```

- [ ] **Step 3: Add SSVC section to the template**

In `src/app/pages/tm/components/threat-page/threat-page.component.html`, add the following after the CVSS section closing `</div>` (after line 275):

```html
        <!-- SSVC Entry -->
        <div class="ssvc-section">
          <mat-label class="section-label">{{ 'ssvcCalculator.title' | transloco }}</mat-label>

          @if (threatForm.get('ssvc')?.value; as ssvc) {
            <mat-chip-set class="ssvc-chip-set">
              <mat-chip
                [removable]="canEdit"
                (removed)="removeSsvcEntry()"
                (click)="canEdit ? editSsvcEntry() : null"
                [class.clickable]="canEdit"
                [class]="getSsvcDecisionClass()"
                [matTooltip]="ssvc.vector"
              >
                SSVC: {{ 'ssvcCalculator.decisions.' + ssvc.decision | transloco }}
                @if (canEdit) {
                  <button matChipRemove [attr.aria-label]="'Remove SSVC entry'">
                    <mat-icon>cancel</mat-icon>
                  </button>
                }
              </mat-chip>
            </mat-chip-set>
          } @else if (canEdit) {
            <button
              mat-stroked-button
              color="primary"
              (click)="openSsvcCalculator()"
              class="ssvc-calculator-button"
            >
              <mat-icon>add</mat-icon>
              {{ 'ssvcCalculator.openCalculator' | transloco }}
            </button>
          }
        </div>
```

- [ ] **Step 4: Add SSVC styles to the threat page**

In `src/app/pages/tm/components/threat-page/threat-page.component.scss`, add after the `.cvss-input-row` section (after the CVSS-related styles):

```scss
// SSVC section
.ssvc-section {
  margin-top: 4px;
  margin-bottom: 4px;

  .section-label {
    display: block;
    margin-bottom: 8px;
  }
}

.ssvc-chip-set {
  margin-bottom: 8px;
}

.ssvc-decision-defer {
  --mdc-chip-elevated-container-color: color-mix(in srgb, var(--color-severity-none) 15%, transparent);
  --mdc-chip-label-text-color: var(--color-severity-none);
}

.ssvc-decision-scheduled {
  --mdc-chip-elevated-container-color: color-mix(in srgb, var(--color-severity-low) 15%, transparent);
  --mdc-chip-label-text-color: var(--color-severity-low);
}

.ssvc-decision-out-of-cycle {
  --mdc-chip-elevated-container-color: color-mix(in srgb, var(--color-severity-high) 15%, transparent);
  --mdc-chip-label-text-color: var(--color-severity-high);
}

.ssvc-decision-immediate {
  --mdc-chip-elevated-container-color: color-mix(in srgb, var(--color-severity-critical) 15%, transparent);
  --mdc-chip-label-text-color: var(--color-severity-critical);
}

.ssvc-calculator-button {
  margin-top: 4px;
}
```

- [ ] **Step 5: Verify build compiles**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 6: Run all related tests**

Run: `pnpm vitest run src/app/pages/tm/components/ssvc-calculator-dialog/ src/app/pages/tm/components/threat-page/`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/tm/components/threat-page/threat-page.component.ts \
       src/app/pages/tm/components/threat-page/threat-page.component.html \
       src/app/pages/tm/components/threat-page/threat-page.component.scss \
       src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.ts
git commit -m "feat(ssvc): integrate SSVC calculator into threat page"
```

---

### Task 8: Localization Backfill

**Files:**
- Modify: All locale files in `src/assets/i18n/` (except `en-US.json`)

- [ ] **Step 1: Run the localization backfill command**

Run: `/localization-backfill`

This will add the `ssvcCalculator.*` keys to all non-English locale files.

- [ ] **Step 2: Verify build compiles**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/
git commit -m "chore(i18n): backfill SSVC calculator translations"
```

---

### Task 9: Lint, Build, and Full Test Pass

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm run lint:all`
Expected: No lint errors. Fix any that appear.

- [ ] **Step 2: Run build**

Run: `pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 4: Fix any issues**

If any lint, build, or test failures occur, fix them before proceeding.

- [ ] **Step 5: Commit any fixes**

Only if fixes were needed:

```bash
git add -A
git commit -m "fix(ssvc): address lint and test issues"
```

---

### Task 10: File Server Issue for Threat Schema Extension

**Files:** None (GitHub issue only)

- [ ] **Step 1: File the server issue**

Use the `/file_server_bug` skill to create an issue against `ericfitz/tmi` with the following details:

**Title:** `feat: add ssvc field to Threat schema`

**Body:**

The TMI-UX client has implemented an SSVC (Stakeholder-Specific Vulnerability Categorization) Supplier calculator that produces a structured decision result. The client sends this data in the `ssvc` field on Threat objects, but the server schema does not yet include this field.

**Proposed schema addition to the Threat object:**

```json
{
  "ssvc": {
    "vector": "SSVCv2/E:A/U:S/T:T/P:S/2026-04-08/",
    "decision": "Immediate",
    "methodology": "Supplier"
  }
}
```

Field definitions:
- `vector` (string): SSVC vector string following CERT/CC convention
- `decision` (string, enum): One of `Defer`, `Scheduled`, `Out-of-Cycle`, `Immediate`
- `methodology` (string): The SSVC stakeholder perspective used (currently only `Supplier`)

The field is optional (nullable). Until this is implemented, the client will send the field but it will not persist.

**Reference:** [CERT/CC SSVC Supplier Tree](https://certcc.github.io/SSVC/howto/supplier_tree/)

- [ ] **Step 2: Note the issue number**

Record the issue number for future reference.
