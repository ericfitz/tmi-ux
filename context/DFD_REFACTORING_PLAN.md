# DFD Component Refactoring Plan

## Overview

This plan focuses on three key areas for improving the DFD component's maintainability:
1. **Domain Business Logic Migration** - Move pure DFD business rules to domain layer
2. **History Filtering Logic Organization** - Consolidate history filtering in appropriate location
3. **Component and Service Layer Improvements** - Simplify component responsibilities and clarify service boundaries

## Phase 1: Domain Business Logic Migration (High Priority)

### 1.1 Connection Rules Service
**Goal**: Extract pure DFD connection business rules from infrastructure

**Move from** `DfdEdgeService` → `/src/app/pages/dfd/domain/services/connection-rules.service.ts`

**Specific migrations**:
- `connectionRules` mapping (lines 41-45) → Domain constants
- `isNodeConnectionValid()` (lines 695-717) → Domain validation
- `canShapesConnect()` (lines 775-780) → Domain rule checking
- `getValidConnectionTargets()` (lines 764-765) → Domain query
- `validateNodeShape()` (lines 720-734) → Domain validation

**Result**: Pure business rules about what DFD elements can connect, independent of X6

### 1.2 Embedding Rules Service  
**Goal**: Move embedding business logic from infrastructure to domain

**Move entire file** `/src/app/pages/dfd/infrastructure/services/embedding.service.ts` → `/src/app/pages/dfd/domain/services/embedding-rules.service.ts`

**Why**: This contains pure business logic about DFD embedding rules:
- What can embed what (text-box restrictions, security boundaries)
- Embedding depth calculations
- Visual representation rules based on embedding

### 1.3 DFD Business Policies
**Goal**: Extract business constants into domain policies

**Create**: `/src/app/pages/dfd/domain/rules/dfd-policies.ts`

**Extract from** `DfdEdgeService:41-45`:
```typescript
export const DFD_CONNECTION_POLICIES = {
  PROCESS_CONNECTIONS: ['dfd-datastore', 'dfd-external-entity', 'dfd-process'],
  DATASTORE_CONNECTIONS: ['dfd-process'],
  EXTERNAL_ENTITY_CONNECTIONS: ['dfd-process']
} as const;

export const EMBEDDING_POLICIES = {
  TEXT_BOX_CANNOT_BE_EMBEDDED: true,
  SECURITY_BOUNDARY_ONLY_IN_SECURITY_BOUNDARY: true
} as const;
```

## Phase 2: History Filtering Logic Organization (Medium Priority)

### 2.1 Analysis of Current State
**Current location**: `X6GraphAdapter._shouldIncludeInHistory()` (lines 1754-1883)

**Current dependencies**:
- Uses `GraphHistoryCoordinator.shouldExcludeAttribute()` 
- Needs access to X6 event structure and graph state
- Coordinates with X6 History plugin configuration

### 2.2 Recommended Approach: Consolidate in GraphHistoryCoordinator

**Move from** `X6GraphAdapter._shouldIncludeInHistory()` → `GraphHistoryCoordinator.shouldIncludeInHistory()`

**Rationale**:
- `GraphHistoryCoordinator` already handles some filtering logic
- Centralizes all history-related decisions in one service
- Reduces X6GraphAdapter complexity without creating new dependencies
- Maintains coordination with X6 plugins through single point

**Implementation**:
```typescript
// In GraphHistoryCoordinator
shouldIncludeInHistory(event: string, args: any): boolean {
  // Move the complex filtering logic here
  // Keep the _findActualAttributeChanges logic
  // Maintain the debugging and logging
}
```

**Update X6GraphAdapter**:
```typescript
// In X6GraphAdapter plugin setup
new History({
  beforeAddCommand: (event: string, args: any) => {
    return this._historyCoordinator.shouldIncludeInHistory(event, args);
  }
})
```

## Phase 3: Component Simplification (Medium Priority)

### 3.1 Current Component Issues
**File**: `dfd.component.ts` (562 lines)

**Problems identified**:
- Direct injection of 12+ services creates tight coupling
- Mixes UI coordination, business logic, and event handling
- Large template with complex event bindings
- State management scattered throughout component

### 3.2 Component State Extraction

**Create**: `/src/app/pages/dfd/components/core/dfd-state.manager.ts`

**Move from component**:
- `isInitialized`, `diagramId`, `threatModelId` management
- Loading states and error handling
- Graph container element references
- Window resize timeout handling

**Benefits**:
- Testable state management
- Clear state transitions
- Reduced component complexity

### 3.3 Event Coordination Extraction

**Create**: `/src/app/pages/dfd/components/core/dfd-event.coordinator.ts`

**Move from component**:
- Keyboard event handling (`onKeyDown`, `onDeleteSelected`)
- Window resize coordination
- Context menu positioning
- Dialog opening/closing coordination

**Benefits**:
- Separation of UI events from business operations
- Easier testing of event logic
- Cleaner component template

### 3.4 Template Simplification

**Current issues**:
- Complex event bindings throughout template
- Mixed presentation and business logic
- Hard to test template interactions

**Approach**:
- Extract complex template logic to coordinator methods
- Use component methods that delegate to coordinators
- Simplify event bindings

**Target**: Reduce component to ~200 lines focused on template coordination

## Phase 4: Service Layer Clarity (Lower Priority)

### 4.1 Service Responsibility Analysis

**Current services behind facade**:
- `DfdNodeService` - Node operations + positioning algorithm
- `DfdEdgeService` - Edge operations + business rules (being moved to domain)
- `DfdEventHandlersService` - Mixed UI and business event handling
- `DfdExportService` - Pure export functionality (good)
- `DfdDiagramService` - Diagram loading (good)

### 4.2 Event Handlers Service Clarification

**Current issues with** `DfdEventHandlersService`:
- Mixed responsibilities (UI events + business operations)
- Handles both domain events and UI events
- Complex dependencies on multiple adapters

**Recommended split**:

**Create**: `/src/app/pages/dfd/services/dfd-ui-handlers.service.ts`
- Context menu management
- Dialog coordination
- Window resize handling
- Z-order UI operations

**Create**: `/src/app/pages/dfd/services/dfd-business-handlers.service.ts`
- Domain event processing
- Business operation coordination
- State transitions

### 4.3 Node Service Simplification

**Current**: `DfdNodeService` has mixed responsibilities

**Keep in service**:
- Node creation coordination
- Integration with graph adapter
- Positioning algorithm (mechanical, not business logic)

**Move to domain** (already covered in Phase 1):
- Node validation business rules
- Default configurations that represent business rules

## Implementation Order

### Phase 1: Domain Migration (Week 1-2)
1. Create DFD policies file
2. Move connection rules to domain service
3. Move embedding service to domain
4. Update existing services to use domain services

### Phase 2: History Consolidation (Week 2)
1. Move history filtering to GraphHistoryCoordinator
2. Update X6GraphAdapter to delegate
3. Test history behavior

### Phase 3: Component Simplification (Week 3)
1. Extract state manager
2. Extract event coordinator  
3. Simplify component template
4. Update tests

### Phase 4: Service Clarity (Week 4)
1. Split event handlers service
2. Clarify service boundaries
3. Update facade if needed

## Success Metrics

- **Domain layer**: Pure business logic with no infrastructure dependencies
- **X6GraphAdapter**: Focused on X6 integration, delegates business rules
- **Component**: Under 200 lines, focused on template coordination
- **Services**: Clear single responsibilities
- **Tests**: Improved unit test coverage for business logic

## Notes

- Keep facade pattern - it's working well
- Don't touch node placement algorithm - it's mechanical, not business logic
- Maintain existing functionality throughout refactoring
- Update tests incrementally as components are extracted