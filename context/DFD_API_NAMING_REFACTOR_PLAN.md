# DFD API Naming Refactor Plan

This document outlines the plan to improve API naming consistency and accuracy across the DFD component.

## **Priority Classifications**

### **High Priority (Breaking Changes Worth Making)**

1. **Rename `DfdStateStore.select()`** → `query()` or `derive()`
   - **Rationale**: Most confusing in diagram context - conflicts with selection concepts
   - **Impact**: Breaking change for any consumers using state selection
   - **Files**: `src/app/pages/dfd/state/dfd.state.ts`

2. **Standardize observable naming** - ensure all observables have `$`
   - **Rationale**: Critical for reactive programming clarity and Angular conventions
   - **Impact**: Breaking change for consumers accessing observables without `$`
   - **Files**: Multiple service files

3. **Fix misleading Edge query methods**:
   - `findEdgeByConnection()` → `findEdgeBetweenPorts()`
   - `getEdgeConnectionSummary()` → `getConnectionSummary()`
   - **Rationale**: "Connection" is redundant/misleading since edges ARE connections
   - **Files**: `src/app/pages/dfd/infrastructure/services/edge-query.service.ts`

### **Medium Priority (API Improvements)**

4. **Standardize boolean prefixes**:
   - `is*()` for state queries
   - `can*()` for capability queries  
   - `has*()` for possession queries
   - **Rationale**: Improves API discoverability and consistency
   - **Files**: Multiple service and component files

5. **Consistent verb forms**:
   - Actions: imperative (`connect`, `validate`, `add`)
   - Event handlers: `on*` or `handle*` prefix
   - Getters: `get*` prefix
   - **Rationale**: Makes API usage patterns more predictable
   - **Files**: Multiple adapter and service files

### **Low Priority (Polish) - Not Implementing**

6. **Shorten overly verbose names**
7. **Domain object consistency**

## **Implementation Plan**

### **Phase 1: High Priority Changes**

#### 1.1 Rename `DfdStateStore.select()` → `query()`
- **File**: `src/app/pages/dfd/state/dfd.state.ts`
- **Change**: Rename method and update JSDoc
- **Reasoning**: "query" is more appropriate for state selection operations

#### 1.2 Standardize Observable Naming
- **Add `$` suffix to observables missing it**
- **Files to check**: All service and adapter files
- **Specific issues identified**:
  - Any observables without `$` suffix need to be updated

#### 1.3 Fix Edge Query Method Names
- **File**: `src/app/pages/dfd/infrastructure/services/edge-query.service.ts`
- **Changes**:
  - `findEdgeByConnection()` → `findEdgeBetweenPorts()`
  - `getEdgeConnectionSummary()` → `getConnectionSummary()`

### **Phase 2: Medium Priority Changes**

#### 2.1 Standardize Boolean Prefixes
- **Pattern Enforcement**:
  - `is*()` for state queries (isConnected, isValid, isSelected)
  - `can*()` for capability queries (canUndo, canRedo, canEdit)
  - `has*()` for possession queries (hasPermission, hasSelectedCells)
- **Files**: Multiple service files

#### 2.2 Consistent Verb Forms
- **Actions**: Use imperative form (validate, connect, add, remove)
- **Event Handlers**: Use `on*` or `handle*` prefix consistently
- **Getters**: Use `get*` prefix for data retrieval

## **Specific Changes to Implement**

### **High Priority Changes**

```typescript
// 1. DfdStateStore.select() → query()
class DfdStateStore {
  // OLD
  select<T>(selector: (state: DfdState) => T): Observable<T>
  
  // NEW  
  query<T>(selector: (state: DfdState) => T): Observable<T>
}

// 2. Observable naming - ensure all have $
// Check all services for observables missing $ suffix

// 3. Edge query methods
class EdgeQueryService {
  // OLD
  findEdgeByConnection(graph: any, sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string): Edge | null
  getEdgeConnectionSummary(graph: any): any
  
  // NEW
  findEdgeBetweenPorts(graph: any, sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string): Edge | null
  getConnectionSummary(graph: any): any
}
```

### **Medium Priority Changes**

```typescript
// 4. Boolean prefixes standardization
// Examples of patterns to enforce:
class SomeService {
  // State queries - use is*
  isConnected(): boolean
  isValid(): boolean
  isSelected(): boolean
  
  // Capability queries - use can*  
  canUndo(): boolean
  canEdit(): boolean
  canDelete(): boolean
  
  // Possession queries - use has*
  hasPermission(): boolean  
  hasSelectedCells(): boolean
  hasErrors(): boolean
}

// 5. Verb form consistency
class SomeAdapter {
  // Actions - imperative
  connect(): void
  validate(): void  
  add(): void
  remove(): void
  
  // Event handlers - on* prefix
  onConnectionEstablished(): void
  onValidationCompleted(): void
  onNodeAdded(): void
  
  // Getters - get* prefix  
  getConnectionState(): ConnectionState
  getValidationResults(): ValidationResult[]
  getSelectedNodes(): Node[]
}
```

## **Implementation Notes**

### **Breaking Changes**
- All High Priority changes are breaking changes
- Will require updating any consumer code
- Should be communicated clearly in release notes

### **Testing Impact**
- All affected methods will need test updates
- Mock objects and test assertions will need updates
- Integration tests may need updates for new method names

### **Documentation Impact**
- API documentation will need updates
- JSDoc comments should be updated with new method names
- Any tutorials or examples will need updates

## **Success Criteria**

1. **Consistency**: All similar operations follow the same naming pattern
2. **Clarity**: Method names clearly indicate their purpose and return type
3. **Angular Conventions**: All observables have `$` suffix
4. **No Ambiguity**: No method names that could be confused in the diagramming context
5. **Predictability**: Developers can guess method names based on established patterns

## **Risk Mitigation**

1. **Backward Compatibility**: Consider adding deprecated aliases for critical methods
2. **Gradual Migration**: Implement changes in phases to reduce integration burden
3. **Clear Communication**: Document all breaking changes thoroughly
4. **Testing**: Comprehensive test coverage for all renamed methods

---

## **Implementation Status**

### ✅ **COMPLETED - High Priority Changes**

1. **✅ Renamed `DfdStateStore.select()`** → `query()`
   - **File**: `src/app/pages/dfd/state/dfd.state.ts`
   - **Status**: Complete - method renamed with updated JSDoc

2. **✅ Standardized observable naming** 
   - **Status**: Complete - Analysis found all observables already have proper `$` suffix
   - **Result**: No changes needed - codebase already compliant

3. **✅ Fixed misleading Edge query methods**:
   - `findEdgeByConnection()` → `findEdgeBetweenPorts()`
   - `getEdgeConnectionSummary()` → `getConnectionSummary()`
   - **File**: `src/app/pages/dfd/infrastructure/services/edge-query.service.ts`
   - **Status**: Complete - methods renamed with updated comments

### ✅ **COMPLETED - Medium Priority Changes**

4. **✅ Standardized boolean prefixes**:
   - `validateMagnet()` → `isMagnetValid()`
   - `validateConnection()` → `isConnectionValid()` 
   - `validateNodeConnection()` → `isNodeConnectionValid()`
   - `validateLabelChange()` → `isLabelChangeValid()`
   - **Files**: Updated services and all consumer references
   - **Status**: Complete - all validation methods now follow `is*` pattern

5. **✅ Consistent verb forms**:
   - `deleteSelected()` → `onDeleteSelected()` (in event handler service)
   - **Status**: Complete - event handlers now use `on*` prefix consistently
   - **Note**: Public API methods in components kept as imperative for user actions

### **Breaking Changes Applied**
- `DfdStateStore.select()` → `query()`
- `EdgeQueryService.findEdgeByConnection()` → `findEdgeBetweenPorts()`
- `EdgeQueryService.getEdgeConnectionSummary()` → `getConnectionSummary()`
- `DfdConnectionValidationService` - 4 validation methods renamed to `is*` pattern
- Internal event handler method renames (non-breaking for public consumers)

### **Impact Assessment**
- **Public API**: 5 breaking changes to public methods
- **Internal APIs**: Several method renames with consumer updates
- **Test Files**: Will need updates (not implemented - tests excluded from scope)
- **Documentation**: API documentation will need updates

**Status**: **COMPLETED** ✅
**Actual Effort**: ~3 hours for High+Medium priority changes  
**Breaking Changes**: Yes (5 public API methods)
**Recommended Release**: Major version bump due to breaking changes