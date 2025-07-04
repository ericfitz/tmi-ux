# X6 Data Migration Plan

## Overview

This document outlines the plan to eliminate the problematic `.data` abstraction layer in the DFD component and migrate to using X6's native properties directly. This addresses the critical architectural issue where data duplication between domain models and X6 properties creates risk of inconsistency.

## Problem Statement

### Current Architecture Issues

- **Data Duplication**: Domain models (DiagramNode/DiagramEdge) → NodeData/EdgeData → X6GraphAdapter → X6 Cell.data → X6 Native Properties
- **Synchronization Risk**: Multiple sources of truth can become inconsistent
- **Complexity**: Unnecessary abstraction layers that don't add value
- **Performance**: Extra serialization/deserialization steps

### Current Files with Issues

- `src/app/pages/dfd/domain/value-objects/diagram-node.ts` - Domain model abstraction
- `src/app/pages/dfd/domain/value-objects/diagram-edge.ts` - Domain model abstraction
- `src/app/pages/dfd/domain/value-objects/node-data.ts` - Data abstraction layer
- `src/app/pages/dfd/domain/value-objects/edge-data.ts` - Data abstraction layer

## Target Architecture

### New Approach

- **Single Source of Truth**: X6's native properties as the primary data store
- **Direct Property Access**: Use X6 Cell prototype extensions for domain operations
- **Snapshot Caching**: Cache X6 cell snapshots for undo operations and server communication
- **Metadata Array Format**: Store domain-specific data as `Array<{key: string, value: string}>`

### Key Principles

1. **X6 Native Properties First**: Always use X6's built-in properties for rendering and interaction
2. **Prototype Extensions**: Add domain-specific methods directly to X6 Cell objects
3. **Snapshot-Based Caching**: Use lightweight snapshots for operations requiring serialization
4. **No Backward Compatibility**: Clean break from existing domain objects

## Implementation Plan

### Phase 1: Foundation (✅ COMPLETED)

- [x] Create X6 cell snapshot type definitions (`src/app/pages/dfd/types/x6-cell.types.ts`)
- [x] Implement X6 Cell prototype extensions (`src/app/pages/dfd/utils/x6-cell-extensions.ts`)
- [x] Add metadata management methods
- [x] Add unified label handling methods
- [x] Ensure clean linting and building

### Phase 2: Adapter Migration (🔄 IN PROGRESS)

- [ ] Initialize X6 cell extensions in application startup
- [ ] Update X6GraphAdapter to use native properties
- [ ] Implement snapshot caching in X6GraphAdapter
- [ ] Remove `.data` property usage
- [ ] Update graph serialization/deserialization

### Phase 3: Domain Layer Updates

- [ ] Update command handlers to work with X6 snapshots
- [ ] Modify aggregates to use snapshot-based operations
- [ ] Update event handling for X6 native properties
- [ ] Remove domain value object dependencies

### Phase 4: Cleanup

- [ ] Remove obsolete domain value objects
- [ ] Update tests to use new architecture
- [ ] Update server API integration
- [ ] Performance validation

## Technical Details

### X6 Cell Extensions

#### Metadata Management

```typescript
cell.setMetadataValue('nodeType', 'process');
cell.getMetadataValue('nodeType'); // 'process'
cell.getMetadataAsObject(); // { nodeType: 'process' }
cell.removeMetadataKey('nodeType');
```

#### Unified Label Handling

```typescript
cell.setLabel('My Label'); // Works for both nodes and edges
cell.getLabel(); // 'My Label'
```

### Snapshot Types

```typescript
interface X6NodeSnapshot {
  id: string;
  shape: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  type: string;
  metadata: Array<{ key: string; value: string }>;
  // ... other X6 native properties
}
```

### Caching Strategy

- **In-Memory Cache**: X6GraphAdapter maintains snapshots for undo/redo
- **Server Communication**: Snapshots serialized for API calls
- **Event Sourcing**: Commands work with snapshot diffs

## Migration Benefits

1. **Consistency**: Single source of truth eliminates sync issues
2. **Performance**: Direct property access, no extra serialization
3. **Simplicity**: Fewer abstraction layers to maintain
4. **Type Safety**: Full TypeScript support with X6 native types
5. **Maintainability**: Cleaner architecture aligned with X6 patterns

## Risk Mitigation

- **Testing**: Comprehensive test coverage during migration
- **Incremental**: Phase-by-phase implementation with validation
- **Rollback**: Keep old code until new implementation is proven
- **Documentation**: Clear migration path for future developers

## Current Status

### ✅ Completed

- X6 cell type definitions
- Prototype extensions with metadata and label management
- Clean linting and building
- Documentation

### 🔄 Next Steps

1. Initialize extensions in application startup
2. Update X6GraphAdapter implementation
3. Begin domain layer migration

---

_Last Updated: 2025-01-03_
_Status: Phase 1 Complete, Phase 2 Starting_
