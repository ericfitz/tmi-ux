# Architecture Notes

## AntV/X6 Integration

AntV/X6 is used for graph visualization and interaction in the diagram editor. The integration follows best practices from the AntV/X6 documentation and examples.

## Node and Edge Management

### Previous Approach

Initially, we used maxGraph (a TypeScript version of mxGraph) for diagram visualization and interaction. This approach had several issues:

1. **Compatibility Issues**: maxGraph had compatibility issues that required extensive patching.

2. **Complex Operation Chaining**: Creating an edge required multiple steps and mappings, which was error-prone.

3. **Bidirectional Dependency**: Code constantly looked up cells by different IDs, creating a complex web of dependencies.

4. **Circular Dependencies**: Updates to properties triggered cascading updates, causing infinite recursion.

### Current Implemented Approach

We've successfully migrated to AntV/X6 with a cleaner architecture that:

1. **Direct Node and Edge References**:

   - X6 nodes and edges are the primary data structures
   - Nodes and edges store both visual information and business data
   - Angular components for node types using `@antv/x6-angular-shape`

2. **Unidirectional Data Flow**:

   - All operations start by creating or modifying X6 nodes and edges
   - After a successful X6 operation, we update the diagram model
   - When loading from storage, we create X6 nodes and edges directly
   - We maintain a clear flow of data to avoid circular references

3. **Node-Centric Strategy**:

   - We use node IDs as the primary key for all operations
   - All data is stored directly in the nodes and edges
   - The diagram model maintains a flat list of nodes and edges

4. **Clean Listener Pattern**:
   - X6 triggers events when nodes and edges are created, modified, or deleted
   - We listen for these events to update the diagram model accordingly
   - This avoids circular reference issues

### Implementation Details

The current implementation follows these patterns:

1. **For Creating Elements**:

   - Create the X6 node or edge and let it generate its own ID
   - Store the node or edge in the diagram model
   - Ensure updates never trigger unnecessary re-rendering

   ```typescript
   // Example from node.service.ts
   const node = this.graphService.createNode({
     shape: 'process-node',
     x,
     y,
     width: 120,
     height: 60,
     attrs: {
       body: {
         fill: '#ffffff',
         stroke: '#5F95FF',
         strokeWidth: 1,
         rx: 6,
         ry: 6,
       },
     },
     id: uuidv4(),
     data: {
       type: 'process',
       label,
     },
   });
   ```

2. **For Modifying Elements**:

   - Modify the X6 node or edge directly
   - Update the corresponding node or edge in the diagram model
   - Use batch updates to avoid circular updates

3. **For Deleting Elements**:

   - Delete the X6 node or edge
   - Remove the node or edge from the diagram model
   - Handle cascading deletes for connected elements

4. **For Loading from Storage**:

   - Load diagram structure first
   - Create X6 nodes and edges based on the stored data
   - Use a batched update approach to avoid circular dependencies

5. **Breaking Dependency Cycles**:
   - Maintain a clear separation between visual updates and data updates
   - Treat X6 as the source of truth for visual elements
   - Treat the diagram model as the source of truth for persistence
   - Changes to the model do not automatically trigger graph rendering

### Operation-Based Architecture

We've implemented an operation-based architecture for tracking changes:

1. All diagram modifications are represented as operations (add, update, delete)
2. Operations are recorded in history to support undo/redo functionality
3. Each operation has a unique ID, timestamp, and user ID for future conflict resolution
4. Operations provide the foundation for collaborative editing features

### Angular Integration

AntV/X6 provides excellent Angular integration through the `@antv/x6-angular-shape` package:

1. Angular components can be used as node shapes
2. Full Angular lifecycle support within nodes
3. Two-way data binding between nodes and Angular components
4. Clean separation of concerns between graph visualization and business logic

### Next Steps

1. **Enhance Collaborative Features**:

   - Build on the operation-based architecture for collaboration
   - Implement optimistic updates with rollback capability
   - Develop WebSocket integration for real-time updates

2. **Server Synchronization**:

   - Integrate with the backend API
   - Implement conflict resolution for concurrent edits
   - Add versioning support

3. **Performance Optimizations**:
   - Implement virtualization for large diagrams
   - Add level-of-detail rendering for zoomed-out views
   - Optimize the rendering pipeline for smoother interactions

This simplified node-centric architecture with AntV/X6 has made the code more robust, easier to debug, and more maintainable, while avoiding the issues we faced with maxGraph.
