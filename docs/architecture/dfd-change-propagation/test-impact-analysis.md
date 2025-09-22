# DFD Test Impact Analysis - Feature GraphArch

This document catalogs all existing DFD tests and their impact status for the new architecture implementation.

## Test Classification

### ✅ **PRESERVE** - Tests that validate behavior we want to keep
### 🔄 **REWRITE** - Tests for components being replaced but behavior preserved  
### ❌ **REMOVE** - Tests for components/behavior being eliminated
### 🆕 **NEW** - New tests needed for new architecture

## Existing Test Files

### Unit Tests (.spec.ts)

#### **Infrastructure/Adapters Tests**
1. **x6-selection.adapter.spec.ts** - 🔄 REWRITE
   - Tests selection management logic
   - Behavior preserved but adapter may change

2. **x6-embedding.adapter.spec.ts** - ✅ PRESERVE  
   - Tests node embedding/nesting logic
   - Core X6 adapter functionality preserved

3. **x6-label-editor.adapter.spec.ts** - ✅ PRESERVE
   - Tests inline label editing
   - X6 adapter functionality preserved

4. **x6-z-order.adapter.spec.ts** - ✅ PRESERVE
   - Tests z-order manipulation
   - X6 adapter functionality preserved

5. **x6-graph.adapter.spec.ts** - 🔄 REWRITE
   - Tests main graph adapter - MAJOR CHANGES EXPECTED
   - Core X6 integration preserved but orchestration changes

6. **x6-keyboard-handler.spec.ts** - ✅ PRESERVE
   - Tests keyboard shortcuts
   - Functionality preserved

#### **Infrastructure/Services Tests**  
7. **z-order.service.spec.ts** - ✅ PRESERVE
   - Tests z-order business logic
   - Service behavior preserved

8. **edge-query.service.spec.ts** - ✅ PRESERVE
   - Tests edge querying utilities
   - Utility service preserved

9. **selection.service.spec.ts** - 🔄 REWRITE
   - Tests selection state management
   - Logic preserved but may move to new state manager

10. **node-configuration.service.spec.ts** - ✅ PRESERVE
    - Tests node configuration logic
    - Configuration service preserved

11. **visual-effects.service.spec.ts** - ✅ PRESERVE
    - Tests visual effects application
    - Service functionality preserved

12. **edge.service.spec.ts** - 🔄 REWRITE
    - Tests edge creation/manipulation
    - Logic preserved but moves to GraphOperationManager

13. **node.service.spec.ts** - 🔄 REWRITE  
    - Tests node creation/manipulation
    - Logic preserved but moves to GraphOperationManager

14. **x6-core-operations.service.spec.ts** - 🔄 REWRITE
    - Tests core X6 operations
    - Functionality preserved but reorganized

15. **embedding.service.spec.ts** - ✅ PRESERVE
    - Tests embedding business logic
    - Service behavior preserved

16. **port-state-manager.service.spec.ts** - ✅ PRESERVE
    - Tests port visibility management
    - Service functionality preserved

#### **Domain/Value Objects Tests**
17. **diagram-info.spec.ts** - ✅ PRESERVE
    - Tests diagram value object
    - Domain object preserved

18. **node-info.spec.ts** - ✅ PRESERVE
    - Tests node value object  
    - Domain object preserved

19. **edge-info.spec.ts** - ✅ PRESERVE
    - Tests edge value object
    - Domain object preserved

#### **Services Tests**
20. **dfd-notification.service.spec.ts** - ✅ PRESERVE
    - Tests notification service
    - Service functionality preserved

21. **dfd-edge.service.spec.ts** - 🔄 REWRITE
    - Tests high-level edge operations
    - Logic preserved but moves to GraphOperationManager

#### **Integration Tests**
22. **styling-constants.spec.ts** - ✅ PRESERVE
    - Tests styling constants
    - Constants preserved

23. **selection-styling.spec.ts** - 🔄 REWRITE
    - Tests selection styling integration
    - Functionality preserved but orchestration changes

24. **visual-effects.spec.ts** - ✅ PRESERVE
    - Tests visual effects integration
    - Integration preserved

25. **history-styling.spec.ts** - 🔄 REWRITE
    - Tests history and styling integration
    - History management changes significantly

### Component Tests (.cy.ts)

26. **dfd.component.cy.ts** - 🔄 REWRITE
    - Tests main DFD component
    - Component behavior preserved but internal architecture changes completely

## Impact Summary

### Tests to Preserve (12 files): ✅
- X6 adapters for embedding, labels, z-order, keyboard
- Core services: z-order, edge-query, node-configuration, visual-effects, embedding, port-state-manager
- Domain value objects: diagram-info, node-info, edge-info  
- Notification service
- Styling constants and visual effects integration

### Tests to Rewrite (8 files): 🔄
- **Major Architecture Changes**: x6-graph.adapter, dfd.component
- **Operation Management**: edge.service, node.service, dfd-edge.service, x6-core-operations.service
- **State Management**: selection.service
- **History Integration**: history-styling, selection-styling

### Tests to Remove (0 files): ❌
- No tests identified for removal - all represent valuable functionality

## New Tests Needed: 🆕

### Core New Architecture Tests
1. **graph-operation-manager.service.spec.ts** - Test unified operation handling
2. **persistence-coordinator.service.spec.ts** - Test unified persistence logic
3. **auto-save-manager.service.spec.ts** - Test centralized auto-save logic  
4. **dfd-orchestrator.service.spec.ts** - Test component coordination
5. **state-coordinator.service.spec.ts** - Test state synchronization
6. **collaboration-coordinator.service.spec.ts** - Test collaboration features

### Integration Tests for New Architecture
7. **new-dfd-integration.spec.ts** - Test end-to-end operation flows
8. **persistence-strategy.spec.ts** - Test different persistence strategies
9. **auto-save-integration.spec.ts** - Test auto-save scenarios
10. **collaboration-integration.spec.ts** - Test collaborative editing flows

### Component Tests
11. **new-dfd.component.cy.ts** - Test new DFD component architecture

## Migration Strategy

### Phase 1: Preserve Existing Functionality
- Keep all ✅ PRESERVE tests running against existing code
- Ensure new architecture maintains same behavior

### Phase 2: Parallel Implementation  
- Build new services with comprehensive test coverage
- 🆕 NEW tests for all new architecture components
- Validate behavior matches existing integration tests

### Phase 3: Replace and Validate
- 🔄 REWRITE tests for services being replaced
- Ensure new tests validate same behavior as old tests
- Run full test suite to validate no regressions

### Phase 4: Cleanup
- Remove old test files when services are fully replaced
- Consolidate test coverage reports
- Update documentation

## Test File Locations

### Existing Tests to Preserve
```
src/app/pages/dfd/infrastructure/adapters/x6-embedding.adapter.spec.ts
src/app/pages/dfd/infrastructure/adapters/x6-label-editor.adapter.spec.ts
src/app/pages/dfd/infrastructure/adapters/x6-z-order.adapter.spec.ts
src/app/pages/dfd/infrastructure/adapters/x6-keyboard-handler.spec.ts
src/app/pages/dfd/infrastructure/services/z-order.service.spec.ts
src/app/pages/dfd/infrastructure/services/edge-query.service.spec.ts
src/app/pages/dfd/infrastructure/services/node-configuration.service.spec.ts
src/app/pages/dfd/infrastructure/services/visual-effects.service.spec.ts
src/app/pages/dfd/infrastructure/services/embedding.service.spec.ts
src/app/pages/dfd/infrastructure/services/port-state-manager.service.spec.ts
src/app/pages/dfd/domain/value-objects/diagram-info.spec.ts
src/app/pages/dfd/domain/value-objects/node-info.spec.ts
src/app/pages/dfd/domain/value-objects/edge-info.spec.ts
src/app/pages/dfd/services/dfd-notification.service.spec.ts
src/app/pages/dfd/integration/styling-constants.spec.ts
src/app/pages/dfd/integration/visual-effects.spec.ts
```

### New Test Locations  
```
src/app/pages/dfd/v2/services/graph-operation-manager.service.spec.ts
src/app/pages/dfd/v2/services/persistence-coordinator.service.spec.ts
src/app/pages/dfd/v2/services/auto-save-manager.service.spec.ts
src/app/pages/dfd/v2/services/dfd-orchestrator.service.spec.ts
src/app/pages/dfd/v2/services/state-coordinator.service.spec.ts
src/app/pages/dfd/v2/services/collaboration-coordinator.service.spec.ts
src/app/pages/dfd/v2/integration/
src/app/pages/dfd/v2/dfd-v2.component.cy.ts
```

This analysis ensures we maintain all valuable functionality while building a cleaner, more maintainable architecture.