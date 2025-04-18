# Architecture Notes

## maxGraph examples

maxGraph typescript code examples are stored in the "maxgraph-examples" directory in the project root. Preferentially follow the patterns in the examples

## Component and Cell Relationship

### Previous Approach

Initially, we attempted to maintain a tight coupling between TMI components and mxGraph cells through the `componentToCellMap`. This approach had several issues:

1. **Synchronization Problems**: When cells were created or modified directly in mxGraph, the component map became out of sync, leading to errors when trying to find cells by component ID.

2. **Complex Operation Chaining**: Creating an edge required first creating components, then creating cells, and then trying to map them back together. This multi-step process was error-prone.

3. **Bidirectional Dependency**: Code constantly looked up cells by component IDs and vice versa, creating a complex web of dependencies.

4. **Circular Dependencies**: Updates to component properties triggered updates to cells, which then triggered component updates, causing infinite recursion.

### Current Implemented Approach

We've successfully implemented a cleaner architecture that:

1. **Separates Concerns**: mxGraph cells and TMI components are maintained as separate concerns:

   - mxGraph cells handle graph visualization and interaction
   - TMI components store business metadata and will persist to the server

2. **Unidirectional Data Flow**:

   - All operations start by creating or modifying mxGraph cells
   - After a successful mxGraph operation, we update the component store
   - When loading from the component store, we create corresponding mxGraph cells
   - We never update mxGraph from component store changes directly

3. **Loose Coupling Strategy**:

   - Components store `cellId` references to mxGraph cells
   - We use cell IDs as the primary key for lookups in visual operations
   - Combined component data with cell data is maintained for API transmission

4. **Clean Listener Pattern**:
   - mxGraph triggers events when cells are created, modified, or deleted
   - We listen for these events to update the component store accordingly
   - This avoids circular reference issues

### Implementation Details

The current implementation follows these patterns:

1. **For Creating Elements**:

   - First create the mxGraph cell and let it generate its own ID
   - After successful creation, create a component that references the cell ID
   - Store both, maintaining them as separate concerns
   - Ensure component updates never trigger re-rendering of mxGraph cells

   ```typescript
   // Example from diagram-renderer.service.ts
   const vertex = this.graph.insertVertex(parent, null, label, x, y, width, height, style);
   const cellId = vertex.id;
   const component = this.diagramService.addComponent('vertex', { ...componentData, cellId });
   ```

2. **For Modifying Elements**:

   - Modify the mxGraph cell directly
   - Update the corresponding component in the component store
   - Use `bulkUpdateComponentsWithoutRender` for batch updates to avoid circular updates

3. **For Deleting Elements**:

   - Delete the mxGraph cell first
   - Then remove the corresponding component from the component store
   - Handle cascading deletes for connected elements

4. **For Loading from Storage**:

   - Load diagram structure first
   - Create mxGraph cells based on component data
   - Store cell IDs back in the components
   - Use a batched update approach to avoid circular dependencies

5. **Breaking Dependency Cycles**:
   - Never update the graph in response to component updates
   - Treat mxGraph as the source of truth for visual elements
   - Treat components as the source of truth for business data
   - Component changes accumulate but do not trigger graph rendering

### Operation-Based Architecture

We've also implemented an operation-based architecture for tracking changes:

1. All diagram modifications are represented as operations (add, update, delete)
2. Operations are recorded in history to support undo/redo functionality
3. Each operation has a unique ID, timestamp, and user ID for future conflict resolution
4. Operations provide the foundation for collaborative editing features

### Next Steps

1. **Complete Undo/Redo Implementation**:

   - Implement proper inverse operations for undo capabilities
   - Connect the operation history to the UI

2. **Enhance Collaborative Features**:

   - Build on the operation-based architecture for collaboration
   - Implement optimistic updates with rollback capability
   - Develop WebSocket integration for real-time updates

3. **Server Synchronization**:
   - Integrate with the backend API
   - Implement conflict resolution for concurrent edits
   - Add versioning support

This architecture has made the code more robust, easier to debug, and more maintainable, while avoiding the infinite recursion issues from circular dependencies.
