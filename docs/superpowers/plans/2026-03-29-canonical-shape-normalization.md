# Canonical Shape Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align all cell shape values to API-canonical forms (`'flow'` for edges, `'text-box'` for text boxes), normalize legacy values on input, and fix root causes that generate non-canonical values.

**Architecture:** Three layers of fixes: (1) normalize legacy shapes during cell format normalization on load/import, (2) fix the validator to accept canonical shapes, (3) fix all root-cause sites that generate non-canonical `'edge'` or `'textbox'` shapes. Uses `CANONICAL_EDGE_SHAPE` constant from `cell-property-filter.util.ts` for all edge shape references.

**Tech Stack:** Angular, TypeScript, Vitest, AntV X6

**Related issue:** https://github.com/ericfitz/tmi-ux/issues/540

---

## Branches

This plan produces commits on **two branches**:

| Branch | Scope | Tasks |
|--------|-------|-------|
| `main` | Validator fix only (accept `'flow'` as canonical edge shape) | Task 1 |
| `dev/1.4.0` | All fixes: input normalization, validator, root causes, comparisons, tests | Tasks 2–9 |

Task 1 is done on `main` first, then cherry-picked or re-applied on `dev/1.4.0` as part of Task 2.

---

## Task 1: Fix validator to accept canonical shapes (main branch)

**Branch:** `main`

**Files:**
- Modify: `src/app/pages/tm/validation/diagram-validators.ts:89-96,168-169,460`
- Modify: `src/app/pages/tm/validation/diagram-validators.spec.ts`

- [ ] **Step 1.1: Switch to main branch**

```bash
git checkout main && git pull
```

- [ ] **Step 1.2: Update VALID_DFD_SHAPES array**

In `src/app/pages/tm/validation/diagram-validators.ts`, change the `VALID_DFD_SHAPES` static array (line 89-96):

```typescript
  private static readonly VALID_DFD_SHAPES = [
    'actor',
    'process',
    'store',
    'security-boundary',
    'text-box',
    'flow',
  ];
```

Changes: `'textbox'` → `'text-box'`, `'edge'` → `'flow'`.

- [ ] **Step 1.3: Update EDGE_SHAPES in validateDfdCell**

In the same file, change the local `EDGE_SHAPES` constant (line 169):

```typescript
    const EDGE_SHAPES = ['flow'];
```

- [ ] **Step 1.4: Update validateCellRelationships shape check**

In the same file, change line 460:

```typescript
      if (isEdgeShape(cell?.shape) && cell.source && cell.target) {
```

Add the import at the top of the file:

```typescript
import { isEdgeShape } from '../../dfd/utils/cell-property-filter.util';
```

Note: This is a cross-domain import (tm/validation → dfd/utils). It is acceptable because `isEdgeShape` is a pure utility function that defines the canonical source of truth for edge shape recognition. The alternative — duplicating the logic — would create the exact inconsistency this plan eliminates.

- [ ] **Step 1.5: Update tests in diagram-validators.spec.ts**

In `src/app/pages/tm/validation/diagram-validators.spec.ts`, update all test edge cells from `shape: 'edge'` to `shape: 'flow'`. There are instances at approximately lines 54, 281, 293, 303, 313, 380. Each one:

```typescript
// Before:
shape: 'edge',
// After:
shape: 'flow',
```

Also add a test that verifies `'edge'` is now rejected as an invalid shape (regression test):

```typescript
    it('should reject legacy edge shape', () => {
      const diagram = createValidDiagram({
        cells: [
          createValidNode('node-1'),
          createValidNode('node-2'),
          {
            id: '550e8400-e29b-41d4-a716-446655440099',
            shape: 'edge',
            source: { cell: '550e8400-e29b-41d4-a716-446655440001' },
            target: { cell: '550e8400-e29b-41d4-a716-446655440002' },
          },
        ],
      });

      const errors = validator.validateCells(diagram.cells!, context);
      expect(errors.some(e => e.code === 'INVALID_CELL_TYPE')).toBe(true);
    });
```

Add a test that verifies `'textbox'` (without hyphen) is rejected:

```typescript
    it('should reject legacy textbox shape (without hyphen)', () => {
      const diagram = createValidDiagram({
        cells: [
          {
            id: '550e8400-e29b-41d4-a716-446655440099',
            shape: 'textbox',
            position: { x: 0, y: 0 },
            size: { width: 100, height: 50 },
          },
        ],
      });

      const errors = validator.validateCells(diagram.cells!, context);
      expect(errors.some(e => e.code === 'INVALID_CELL_TYPE')).toBe(true);
    });
```

- [ ] **Step 1.6: Run validator tests**

```bash
pnpm vitest run src/app/pages/tm/validation/diagram-validators.spec.ts
```

Expected: All tests pass.

- [ ] **Step 1.7: Run full validation integration tests**

```bash
pnpm vitest run src/app/pages/tm/validation/
```

Expected: All tests pass. Note: `validation-integration.spec.ts` and `threat-model-validator.service.spec.ts` also have `shape: 'edge'` in test data — these tests will fail because they exercise the full validator pipeline. Update those test files too: change `shape: 'edge'` to `shape: 'flow'` in all instances.

- [ ] **Step 1.8: Lint, build, commit**

```bash
pnpm run lint:all
pnpm run build
```

Commit with message: `fix: update DFD validator to use API-canonical shape values`

---

## Task 2: Add shape normalization to cell format normalization (dev/1.4.0)

**Branch:** `dev/1.4.0`

**Files:**
- Modify: `src/app/pages/dfd/utils/cell-format-normalization.util.ts:29-68`
- Modify: `src/app/pages/dfd/utils/cell-format-normalization.util.spec.ts`

- [ ] **Step 2.1: Switch to dev/1.4.0 branch**

```bash
git checkout dev/1.4.0
```

- [ ] **Step 2.2: Write failing tests for shape normalization**

In `src/app/pages/dfd/utils/cell-format-normalization.util.spec.ts`, add a new `describe` block for shape normalization:

```typescript
import { CANONICAL_EDGE_SHAPE } from '../utils/cell-property-filter.util';

  describe('shape normalization', () => {
    it('should normalize legacy edge shape to canonical flow', () => {
      const cell: Cell = {
        id: 'e1',
        shape: 'edge',
        source: { cell: 'n1' },
        target: { cell: 'n2' },
      };
      const result = normalizeCellFormat(cell);
      expect(result.shape).toBe(CANONICAL_EDGE_SHAPE);
    });

    it('should normalize legacy textbox shape to text-box', () => {
      const cell: Cell = {
        id: 'n1',
        shape: 'textbox',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
      };
      const result = normalizeCellFormat(cell);
      expect(result.shape).toBe('text-box');
    });

    it('should leave canonical flow shape unchanged', () => {
      const cell: Cell = {
        id: 'e1',
        shape: 'flow',
        source: { cell: 'n1' },
        target: { cell: 'n2' },
      };
      const result = normalizeCellFormat(cell);
      expect(result.shape).toBe('flow');
    });

    it('should leave canonical text-box shape unchanged', () => {
      const cell: Cell = {
        id: 'n1',
        shape: 'text-box',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
      };
      const result = normalizeCellFormat(cell);
      expect(result.shape).toBe('text-box');
    });

    it('should leave other node shapes unchanged', () => {
      const cell: Cell = {
        id: 'n1',
        shape: 'process',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 50 },
      };
      const result = normalizeCellFormat(cell);
      expect(result.shape).toBe('process');
    });
  });
```

- [ ] **Step 2.3: Run tests to verify they fail**

```bash
pnpm vitest run src/app/pages/dfd/utils/cell-format-normalization.util.spec.ts
```

Expected: The `'edge'` → `'flow'` and `'textbox'` → `'text-box'` tests fail.

- [ ] **Step 2.4: Implement shape normalization in normalizeCellFormat**

In `src/app/pages/dfd/utils/cell-format-normalization.util.ts`, add import and normalization logic:

Add import at top:

```typescript
import { CANONICAL_EDGE_SHAPE } from './cell-property-filter.util';
```

In the `normalizeCellFormat` function, add shape normalization after the shallow copy (after line 31 `const normalized = { ...cell };`):

```typescript
  // Normalize legacy shape values to API-canonical forms
  if (normalized.shape === 'edge') {
    normalized.shape = CANONICAL_EDGE_SHAPE;
  } else if (normalized.shape === 'textbox') {
    normalized.shape = 'text-box';
  }
```

- [ ] **Step 2.5: Run tests to verify they pass**

```bash
pnpm vitest run src/app/pages/dfd/utils/cell-format-normalization.util.spec.ts
```

Expected: All tests pass.

- [ ] **Step 2.6: Lint and commit**

```bash
pnpm run lint:all
```

Commit with message: `fix: normalize legacy cell shapes during format normalization`

---

## Task 3: Apply validator fix from main to dev/1.4.0

**Branch:** `dev/1.4.0`

**Files:** Same files as Task 1.

- [ ] **Step 3.1: Apply the same validator changes from Task 1**

Apply the identical changes from Task 1 (steps 1.2–1.5) to `dev/1.4.0`:
- Update `VALID_DFD_SHAPES` in `diagram-validators.ts`
- Update `EDGE_SHAPES` to `['flow']`
- Update `validateCellRelationships` to use `isEdgeShape()`
- Add import of `isEdgeShape`
- Update all test files in `src/app/pages/tm/validation/`

- [ ] **Step 3.2: Run validator tests**

```bash
pnpm vitest run src/app/pages/tm/validation/
```

Expected: All tests pass.

- [ ] **Step 3.3: Lint and commit**

```bash
pnpm run lint:all
```

Commit with message: `fix: update DFD validator to use API-canonical shape values`

---

## Task 4: Fix root cause — EdgeInfo domain object

**Branch:** `dev/1.4.0`

**Files:**
- Modify: `src/app/pages/dfd/domain/value-objects/edge-info.ts:21,125,191,241,259`
- Modify: `src/app/pages/dfd/domain/value-objects/edge-info.spec.ts`

- [ ] **Step 4.1: Update EdgeInfo constructor default**

In `src/app/pages/dfd/domain/value-objects/edge-info.ts`, add import:

```typescript
import { CANONICAL_EDGE_SHAPE } from '../../utils/cell-property-filter.util';
```

Change line 21:

```typescript
    public readonly shape: string = CANONICAL_EDGE_SHAPE,
```

- [ ] **Step 4.2: Update EdgeInfo.fromJSON fallback**

Change line 125:

```typescript
      data.shape || CANONICAL_EDGE_SHAPE,
```

- [ ] **Step 4.3: Update EdgeInfo.create**

Change line 191:

```typescript
      CANONICAL_EDGE_SHAPE,
```

- [ ] **Step 4.4: Update EdgeInfo.createSimple**

Change line 241:

```typescript
    return new EdgeInfo(id, CANONICAL_EDGE_SHAPE, source, target, 1, true, {}, labels);
```

- [ ] **Step 4.5: Update EdgeInfo.createWithPorts**

Change line 259:

```typescript
    return new EdgeInfo(id, CANONICAL_EDGE_SHAPE, source, target, 1, true, {}, labels);
```

- [ ] **Step 4.6: Update edge-info.spec.ts**

In `src/app/pages/dfd/domain/value-objects/edge-info.spec.ts`, update all instances of `shape: 'edge'` to `shape: 'flow'`. Add import of `CANONICAL_EDGE_SHAPE` and update any assertions that check for `'edge'` shape value.

- [ ] **Step 4.7: Run tests**

```bash
pnpm vitest run src/app/pages/dfd/domain/value-objects/edge-info.spec.ts
```

Expected: All tests pass.

- [ ] **Step 4.8: Lint and commit**

```bash
pnpm run lint:all
```

Commit with message: `fix: use canonical edge shape in EdgeInfo domain object`

---

## Task 5: Fix root cause — cell extraction and graph adapter

**Branch:** `dev/1.4.0`

**Files:**
- Modify: `src/app/pages/dfd/utils/cell-extraction.util.ts:94`
- Modify: `src/app/pages/dfd/utils/cell-extraction.util.spec.ts`
- Modify: `src/app/pages/dfd/infrastructure/adapters/infra-x6-graph.adapter.ts:476`

- [ ] **Step 5.1: Fix cell-extraction.util.ts**

Add import at top of `src/app/pages/dfd/utils/cell-extraction.util.ts`:

```typescript
import { CANONICAL_EDGE_SHAPE } from './cell-property-filter.util';
```

Change line 94:

```typescript
    shape: CANONICAL_EDGE_SHAPE,
```

- [ ] **Step 5.2: Fix infra-x6-graph.adapter.ts**

In `src/app/pages/dfd/infrastructure/adapters/infra-x6-graph.adapter.ts`, add import:

```typescript
import { CANONICAL_EDGE_SHAPE } from '../../utils/cell-property-filter.util';
```

Change line 476:

```typescript
            shape: CANONICAL_EDGE_SHAPE,
```

- [ ] **Step 5.3: Update cell-extraction.util.spec.ts**

In `src/app/pages/dfd/utils/cell-extraction.util.spec.ts`, change `shape: 'edge'` to `shape: 'flow'` in all test data and assertions.

- [ ] **Step 5.4: Run tests**

```bash
pnpm vitest run src/app/pages/dfd/utils/cell-extraction.util.spec.ts
```

Expected: All tests pass.

- [ ] **Step 5.5: Lint and commit**

```bash
pnpm run lint:all
```

Commit with message: `fix: use canonical edge shape in cell extraction and graph adapter`

---

## Task 6: Fix root cause — executors and diagram service

**Branch:** `dev/1.4.0`

**Files:**
- Modify: `src/app/pages/dfd/application/executors/edge-operation-executor.ts:101`
- Modify: `src/app/pages/dfd/application/executors/load-diagram-executor.ts:211`
- Modify: `src/app/pages/dfd/application/services/app-diagram.service.ts:613`
- Modify: `src/app/pages/tm/models/diagram.model.ts:105,142`

- [ ] **Step 6.1: Fix edge-operation-executor.ts**

Add import at top of `src/app/pages/dfd/application/executors/edge-operation-executor.ts`:

```typescript
import { CANONICAL_EDGE_SHAPE } from '../../utils/cell-property-filter.util';
```

Change line 101:

```typescript
        shape: edgeInfo.shape || CANONICAL_EDGE_SHAPE,
```

- [ ] **Step 6.2: Fix load-diagram-executor.ts**

Add import at top of `src/app/pages/dfd/application/executors/load-diagram-executor.ts`:

```typescript
import { CANONICAL_EDGE_SHAPE } from '../../utils/cell-property-filter.util';
```

Change line 211:

```typescript
      shape: edgeData.shape || CANONICAL_EDGE_SHAPE,
```

- [ ] **Step 6.3: Fix app-diagram.service.ts**

Add import at top of `src/app/pages/dfd/application/services/app-diagram.service.ts` (note: `isEdgeShape` is already imported in this file):

```typescript
import { isEdgeShape, CANONICAL_EDGE_SHAPE } from '../../utils/cell-property-filter.util';
```

Change line 613:

```typescript
      shape: CANONICAL_EDGE_SHAPE,
```

- [ ] **Step 6.4: Fix diagram.model.ts mock data**

In `src/app/pages/tm/models/diagram.model.ts`, change lines 105 and 142:

```typescript
        shape: 'flow',
```

- [ ] **Step 6.5: Run related tests**

```bash
pnpm vitest run src/app/pages/dfd/application/executors/
pnpm vitest run src/app/pages/dfd/application/services/app-diagram.service.spec.ts
```

Expected: Tests may fail if spec files still use `shape: 'edge'`. Update spec files as needed (see Task 8).

- [ ] **Step 6.6: Lint and commit**

```bash
pnpm run lint:all
```

Commit with message: `fix: use canonical edge shape in executors and diagram service`

---

## Task 7: Fix shape comparisons — use CANONICAL_EDGE_SHAPE

**Branch:** `dev/1.4.0`

**Files:**
- Modify: `src/app/pages/dfd/utils/cell-normalization.util.ts:42`
- Modify: `src/app/pages/dfd/application/services/app-cell-operation-converter.service.ts:90,298`
- Modify: `src/app/pages/dfd/application/services/app-remote-operation-handler.service.ts:311`
- Modify: `src/app/shared/services/cell-data-extraction.service.ts:286`
- Modify: `src/app/pages/dfd/application/services/app-dfd-orchestrator.service.ts:1502,1503,1962,1966`

All of these files check `cell.shape === 'edge'` or `cell.shape !== 'edge'` to distinguish nodes from edges. Change them to use `CANONICAL_EDGE_SHAPE`.

- [ ] **Step 7.1: Fix cell-normalization.util.ts**

Add import:

```typescript
import { CANONICAL_EDGE_SHAPE } from './cell-property-filter.util';
```

Change line 42:

```typescript
  if (normalized.shape === CANONICAL_EDGE_SHAPE && Array.isArray(normalized['labels'])) {
```

- [ ] **Step 7.2: Fix app-cell-operation-converter.service.ts**

Add import:

```typescript
import { CANONICAL_EDGE_SHAPE } from '../../utils/cell-property-filter.util';
```

Change lines 90 and 298:

```typescript
    const isNode = cell.shape !== CANONICAL_EDGE_SHAPE;
```

- [ ] **Step 7.3: Fix app-remote-operation-handler.service.ts**

Add import:

```typescript
import { CANONICAL_EDGE_SHAPE } from '../../utils/cell-property-filter.util';
```

Change line 311:

```typescript
    const isNode = cellData.shape !== CANONICAL_EDGE_SHAPE;
```

- [ ] **Step 7.4: Fix cell-data-extraction.service.ts**

Add import in `src/app/shared/services/cell-data-extraction.service.ts`:

```typescript
import { CANONICAL_EDGE_SHAPE } from '../../pages/dfd/utils/cell-property-filter.util';
```

Change line 286:

```typescript
    if (cell.shape !== CANONICAL_EDGE_SHAPE || !Array.isArray(cell.labels) || cell.labels.length === 0) {
```

- [ ] **Step 7.5: Fix app-dfd-orchestrator.service.ts**

Add `CANONICAL_EDGE_SHAPE` to the existing import from `cell-property-filter.util` (line 51-54):

```typescript
import {
  shouldTriggerHistoryOrPersistence,
  sanitizeCellForApi,
  CANONICAL_EDGE_SHAPE,
} from '../../utils/cell-property-filter.util';
```

Change lines 1502-1503:

```typescript
        nodeIds: currentCells.filter(c => c.shape !== CANONICAL_EDGE_SHAPE).map(c => c.id),
        edgeIds: currentCells.filter(c => c.shape === CANONICAL_EDGE_SHAPE).map(c => c.id),
```

Change lines 1962 and 1966:

```typescript
      .filter((cell: any) => cell.shape !== CANONICAL_EDGE_SHAPE)
```

```typescript
      .filter((cell: any) => cell.shape === CANONICAL_EDGE_SHAPE)
```

- [ ] **Step 7.6: Run affected tests**

```bash
pnpm vitest run src/app/pages/dfd/utils/cell-normalization.util.spec.ts
pnpm vitest run src/app/pages/dfd/application/services/app-cell-operation-converter.service.spec.ts
pnpm vitest run src/app/shared/services/cell-data-extraction.service.spec.ts
```

Expected: Some tests may fail due to test data still using `shape: 'edge'`. Fix in Task 8.

- [ ] **Step 7.7: Lint and commit**

```bash
pnpm run lint:all
```

Commit with message: `refactor: replace edge shape string literals with CANONICAL_EDGE_SHAPE`

---

## Task 8: Update all test files

**Branch:** `dev/1.4.0`

**Files (all `*.spec.ts` files with `shape: 'edge'`):**
- `src/app/pages/dfd/utils/cell-normalization.util.spec.ts`
- `src/app/pages/dfd/utils/cell-property-filter.util.spec.ts`
- `src/app/pages/dfd/utils/cell-relationship-validation.util.spec.ts`
- `src/app/pages/dfd/application/services/app-cell-operation-converter.service.spec.ts`
- `src/app/pages/dfd/application/services/app-diagram.service.spec.ts`
- `src/app/pages/dfd/application/services/app-diagram-resync.service.spec.ts`
- `src/app/pages/dfd/application/executors/node-operation-executor.spec.ts`
- `src/app/pages/dfd/infrastructure/strategies/infra-rest-persistence.strategy.spec.ts`
- `src/app/pages/dfd/infrastructure/services/infra-x6-core-operations.service.spec.ts`
- `src/app/pages/dfd/domain/value-objects/edge-info.spec.ts` (if not already done in Task 4)
- `src/app/shared/services/cell-data-extraction.service.spec.ts`
- `src/app/pages/tm/services/import/readonly-field-filter.service.spec.ts`
- `src/app/pages/tm/services/import/reference-rewriter.service.spec.ts`

This is mechanical: in each file, replace `shape: 'edge'` with `shape: 'flow'` in all test data. The `cell-property-filter.util.spec.ts` file is special — it has tests that specifically verify the `'edge'` → `'flow'` normalization behavior. Those tests should keep `shape: 'edge'` as **input** but assert `shape: 'flow'` as **output**.

- [ ] **Step 8.1: Update all test files**

For each file listed above, change all `shape: 'edge'` in test data to `shape: 'flow'`.

**Exception:** In `cell-property-filter.util.spec.ts`, the tests for `normalizeEdgeShape()` and `sanitizeCellForApi()` that verify normalization behavior should keep `'edge'` as the input value and assert `'flow'` as the output. Any test that creates edge cells as general test fixtures should use `'flow'`.

- [ ] **Step 8.2: Run all DFD tests**

```bash
pnpm vitest run src/app/pages/dfd/
```

Expected: All tests pass.

- [ ] **Step 8.3: Run all TM tests**

```bash
pnpm vitest run src/app/pages/tm/
```

Expected: All tests pass.

- [ ] **Step 8.4: Run shared service tests**

```bash
pnpm vitest run src/app/shared/
```

Expected: All tests pass.

- [ ] **Step 8.5: Lint and commit**

```bash
pnpm run lint:all
```

Commit with message: `test: update test data to use canonical edge shape`

---

## Task 9: Final verification

**Branch:** `dev/1.4.0`

- [ ] **Step 9.1: Run full test suite**

```bash
pnpm test
```

Expected: All tests pass.

- [ ] **Step 9.2: Run build**

```bash
pnpm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 9.3: Run lint**

```bash
pnpm run lint:all
```

Expected: No lint errors.

- [ ] **Step 9.4: Verify no remaining non-canonical shape literals in source (excluding tests and generated)**

```bash
grep -rn "shape.*'edge'" src/app/ --include='*.ts' | grep -v '.spec.ts' | grep -v 'generated/' | grep -v 'normalizeEdgeShape' | grep -v 'isEdgeShape' | grep -v "EDGE_SHAPES.*=.*\['edge'" | grep -v "cell\.shape === 'edge'"
```

The only remaining `'edge'` references should be in:
- `cell-property-filter.util.ts` — the `EDGE_SHAPES` array (for `isEdgeShape()` backwards compat) and `normalizeEdgeShape()` function
- Test files that specifically test legacy-to-canonical normalization

No source files should have `shape: 'edge'` assignments or `shape === 'edge'` comparisons.

- [ ] **Step 9.5: Code review**

Run the code review skill (`superpowers:requesting-code-review`) before final commit.
