# Architecture Notes

## maxGraph examples

maxGraph typescript code examples are stored in the "maxgraph-examples" directory in the project root. Preferentially follow the patterns in the examples

## Cell Management

### Previous Approach

Initially, we attempted to maintain a mapping between business components and mxGraph cells. This approach had several issues:

1. **Synchronization Problems**: When cells were created or modified directly in mxGraph, the mapping became out of sync, leading to errors.

2. **Complex Operation Chaining**: Creating an edge required multiple steps and mappings, which was error-prone.

3. **Bidirectional Dependency**: Code constantly looked up cells by different IDs, creating a complex web of dependencies.

4. **Circular Dependencies**: Updates to properties triggered cascading updates, causing infinite recursion.

### Current Implemented Approach

We've successfully implemented a cleaner architecture that:

1. **Direct Cell References**:

   - mxGraph cells are the primary data structure
   - Cells store both visual information and business data
   - No separate component layer exists

2. **Unidirectional Data Flow**:

   - All operations start by creating or modifying mxGraph cells
   - After a successful mxGraph operation, we update the diagram model
   - When loading from storage, we create mxGraph cells directly
   - We maintain a clear flow of data to avoid circular references

3. **Cell-Centric Strategy**:

   - We use cell IDs as the primary key for all operations
   - All data is stored directly in the cells
   - The diagram model maintains a flat list of cells

4. **Clean Listener Pattern**:
   - mxGraph triggers events when cells are created, modified, or deleted
   - We listen for these events to update the diagram model accordingly
   - This avoids circular reference issues

### Implementation Details

The current implementation follows these patterns:

1. **For Creating Elements**:

   - Create the mxGraph cell and let it generate its own ID
   - Store the cell in the diagram model
   - Ensure updates never trigger unnecessary re-rendering

   ```typescript
   // Example from diagram-renderer.service.ts
   const vertex = this.graph.insertVertex(parent, null, label, x, y, width, height, style);
   const cellId = vertex.id;
   this.diagramService.addCell('vertex', { ...cellData, id: cellId });
   ```

2. **For Modifying Elements**:

   - Modify the mxGraph cell directly
   - Update the corresponding cell in the diagram model
   - Use `bulkUpdateCellsWithoutRender` for batch updates to avoid circular updates

3. **For Deleting Elements**:

   - Capture all needed information before deletion
   - Delete the mxGraph cell
   - Remove the cell from the diagram model
   - Handle cascading deletes for connected elements

4. **For Loading from Storage**:

   - Load diagram structure first
   - Create mxGraph cells based on the stored cell data
   - Use a batched update approach to avoid circular dependencies

5. **Breaking Dependency Cycles**:
   - Maintain a clear separation between visual updates and data updates
   - Treat mxGraph as the source of truth for visual elements
   - Treat the diagram model as the source of truth for persistence
   - Changes to the model do not automatically trigger graph rendering

### Operation-Based Architecture

We've implemented an operation-based architecture for tracking changes:

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

This simplified cell-centric architecture has made the code more robust, easier to debug, and more maintainable, while avoiding the infinite recursion issues from circular dependencies.
