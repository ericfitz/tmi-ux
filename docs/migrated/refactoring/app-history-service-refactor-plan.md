# AppHistoryService Refactoring Plan

**Goal**: Extract ~250 lines of cell-to-operation conversion logic into a dedicated `AppCellOperationConverterService` to reduce complexity and improve maintainability.

**Current State**: 886 lines, HIGH complexity
**Target State**: ~630 lines (29% reduction), MEDIUM complexity

---

## Overview

The AppHistoryService currently has two primary responsibilities:
1. Managing undo/redo history stacks and operations
2. Converting graph cells to operation objects for history tracking

This plan extracts the second responsibility into a new dedicated service.

---

## Step 1: Create New Service Interface

**File**: `src/app/pages/dfd/application/services/app-cell-operation-converter.service.ts`

### Service Signature

```typescript
import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';
import { Cell } from '@antv/x6';
import {
  GraphOperation,
  CreateNodeOperation,
  UpdateNodeOperation,
  CreateEdgeOperation,
  UpdateEdgeOperation,
} from '../../../domain/types/graph-operation.types';

@Injectable()
export class AppCellOperationConverterService {
  constructor(private logger: LoggerService) {}

  /**
   * Convert array of cells to graph operations by comparing with previous state
   * @param cells - Current cells
   * @param previousCells - Previous cell state for comparison
   * @param source - Source of the change ('user-interaction' | 'undo-redo')
   * @returns Array of graph operations
   */
  convertCellsToOperations(
    cells: Cell[],
    previousCells: Cell[],
    source: 'user-interaction' | 'undo-redo',
  ): GraphOperation[];

  /**
   * Convert single cell to graph operation
   * @param cell - Current cell
   * @param previousCell - Previous cell state (undefined if new)
   * @param source - Source of the change
   * @returns Graph operation or null if no operation needed
   */
  convertCellToOperation(
    cell: Cell,
    previousCell: Cell | undefined,
    source: 'user-interaction' | 'undo-redo',
  ): GraphOperation | null;

  /**
   * Create a node creation operation
   */
  createNodeOperation(
    cell: Cell,
    baseOperation: Partial<GraphOperation>,
  ): CreateNodeOperation;

  /**
   * Create a node update operation
   */
  createNodeUpdateOperation(
    cell: Cell,
    previousCell: Cell,
    baseOperation: Partial<GraphOperation>,
  ): UpdateNodeOperation;

  /**
   * Create an edge creation operation
   */
  createEdgeOperation(
    cell: Cell,
    baseOperation: Partial<GraphOperation>,
  ): CreateEdgeOperation;

  /**
   * Create an edge update operation
   */
  createEdgeUpdateOperation(
    cell: Cell,
    previousCell: Cell,
    baseOperation: Partial<GraphOperation>,
  ): UpdateEdgeOperation;

  /**
   * Create a delete operation
   */
  createDeleteOperation(
    cell: Cell,
    source: 'user-interaction' | 'undo-redo',
  ): GraphOperation;
}
```

---

## Step 2: Extract Methods from AppHistoryService

### Methods to Move (Lines 557-837)

All private conversion methods will become public methods in the new service:

1. `_convertCellsToOperations()` → `convertCellsToOperations()` (lines 557-587)
2. `_convertCellToOperation()` → `convertCellToOperation()` (lines 592-622)
3. `_createNodeOperation()` → `createNodeOperation()` (lines 627-664)
4. `_updateNodeOperation()` → `createNodeUpdateOperation()` (lines 669-708)
5. `_createEdgeOperation()` → `createEdgeOperation()` (lines 713-766)
6. `_updateEdgeOperation()` → `createEdgeUpdateOperation()` (lines 771-805)
7. `_createDeleteOperation()` → `createDeleteOperation()` (lines 810-836)

### Changes Required

- Remove `private` modifier (all become public)
- Remove `_` prefix from method names
- Update method name `_updateNodeOperation` → `createNodeUpdateOperation` (for consistency)
- Update method name `_updateEdgeOperation` → `createEdgeUpdateOperation` (for consistency)
- Keep all method signatures identical
- Move all helper logic and type guards

---

## Step 3: Update AppHistoryService

### Add Dependency Injection

```typescript
constructor(
  private logger: LoggerService,
  private collaborationService: DfdCollaborationService,
  private graphOperationManager: AppGraphOperationManager,
  private diagramOperationBroadcaster: AppDiagramOperationBroadcaster,
  private persistenceCoordinator: AppPersistenceCoordinator,
  private appStateService: AppStateService,
  private cellOperationConverter: AppCellOperationConverterService, // NEW
) {}
```

### Update Method Calls

Replace all internal calls to conversion methods with delegated calls:

**Before:**
```typescript
const operations = this._convertCellsToOperations(
  addedCells,
  previousCellMap.values(),
  isUndoRedo ? 'undo-redo' : 'user-interaction',
);
```

**After:**
```typescript
const operations = this.cellOperationConverter.convertCellsToOperations(
  addedCells,
  previousCellMap.values(),
  isUndoRedo ? 'undo-redo' : 'user-interaction',
);
```

### Affected Methods in AppHistoryService

Update these methods to use the converter service:

1. `_processCellChanges()` (line 455) - calls `_convertCellsToOperations()`
2. Any other internal references to the conversion methods

---

## Step 4: Update Service Providers

### Add to DFD Module Providers

The new service should be added to the providers array where AppHistoryService is provided.

**File**: `src/app/pages/dfd/presentation/dfd.component.ts` (or wherever services are provided)

```typescript
providers: [
  // ... existing providers
  AppHistoryService,
  AppCellOperationConverterService, // ADD THIS
  // ... other providers
]
```

---

## Step 5: Testing Strategy

### Option A: Test-First Approach (RECOMMENDED)

1. **Before refactoring**: Write comprehensive unit tests for AppHistoryService focusing on conversion logic
   - Test `_convertCellsToOperations()` with various cell combinations
   - Test `_convertCellToOperation()` for all cell types
   - Test all 7 conversion methods with edge cases
   - Ensure ~50-60 tests covering conversion scenarios

2. **After refactoring**:
   - Run existing tests to ensure no regression
   - Extract conversion tests to new `app-cell-operation-converter.service.spec.ts`
   - Update AppHistoryService tests to mock the converter service
   - Verify all 2301+ tests still pass

### Option B: Refactor-First Approach

1. **Perform refactoring** as outlined above
2. **Write unit tests** for both services:
   - `app-cell-operation-converter.service.spec.ts` - Test conversion logic in isolation
   - Update `app-history.service.spec.ts` - Test history management with mocked converter
3. Higher risk of introducing bugs during refactoring

---

## Step 6: Migration Checklist

- [ ] Create `app-cell-operation-converter.service.ts` with service skeleton
- [ ] Copy 7 conversion methods from AppHistoryService (lines 557-837)
- [ ] Rename methods (remove `_` prefix, update names for consistency)
- [ ] Make all methods public
- [ ] Add service to DFD component providers
- [ ] Inject converter service into AppHistoryService constructor
- [ ] Update all internal calls in AppHistoryService to use converter service
- [ ] Remove old conversion methods from AppHistoryService
- [ ] Run `pnpm run format` and `pnpm run lint:all`
- [ ] Run `pnpm run build` - verify no build errors
- [ ] Run `pnpm test` - verify all tests pass
- [ ] Create/update unit tests as per testing strategy
- [ ] Verify AppHistoryService reduced from 886 → ~630 lines
- [ ] Update documentation if needed

---

## Expected Outcomes

### Before Refactoring

- **AppHistoryService**: 886 lines, 6 dependencies, HIGH complexity
- **Responsibilities**: History management + cell conversion

### After Refactoring

- **AppHistoryService**: ~630 lines (-29%), 7 dependencies (+1 for converter), MEDIUM complexity
  - **Single Responsibility**: History stack management, undo/redo coordination

- **AppCellOperationConverterService**: ~260 lines, 1 dependency (LoggerService), LOW complexity
  - **Single Responsibility**: Cell-to-operation conversion logic

### Benefits

1. **Improved Testability**: Conversion logic can be tested in complete isolation
2. **Reduced Complexity**: Each service has single, clear responsibility
3. **Better Maintainability**: Conversion logic changes don't affect history management
4. **Reusability**: Converter service can be used by other services if needed
5. **Easier Debugging**: Smaller services with focused responsibilities

---

## Risk Assessment

### Low Risk

- Conversion logic is self-contained with clear inputs/outputs
- No shared state between conversion methods
- All methods are private (internal implementation detail)

### Mitigation

- Use test-first approach to create safety net before refactoring
- Run full test suite after each migration step
- Keep commits granular (create service → move methods → update calls)

---

## Timeline Estimate

- **With Test-First Approach**:
  - Write tests: ~2-3 hours
  - Perform refactoring: ~1 hour
  - Verify and update tests: ~1 hour
  - **Total**: ~4-5 hours

- **With Refactor-First Approach**:
  - Perform refactoring: ~1 hour
  - Write tests: ~2-3 hours
  - Debug and fix issues: ~1-2 hours
  - **Total**: ~4-6 hours

**Recommendation**: Use test-first approach for higher confidence and lower risk.
