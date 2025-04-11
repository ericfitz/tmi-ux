# Architecture Notes

## Component and Cell Relationship

### Current Approach

Currently, we're attempting to maintain a tight coupling between TMI components and mxGraph cells through the `componentToCellMap`. This approach has several issues:

1. **Synchronization Problems**: When cells are created or modified directly in mxGraph, the component map becomes out of sync, leading to errors when trying to find cells by component ID.

2. **Complex Operation Chaining**: Creating an edge requires first creating components, then creating cells, and then trying to map them back together. This multi-step process is error-prone.

3. **Bidirectional Dependency**: Code must constantly look up cells by component IDs and vice versa, creating a complex web of dependencies.

4. **Circular Dependencies**: Updates to component properties trigger updates to cells, which then trigger component updates, causing infinite recursion.

### Recommended Approach

A cleaner architecture would be to:

1. **Separate Concerns**: Keep mxGraph cells and TMI components as separate concerns:
   - mxGraph cells handle graph visualization and interaction
   - TMI components store business metadata and persist to the server

2. **Unidirectional Data Flow**:
   - After a mxGraph operation completes successfully, update the component store
   - When loading from the component store, create corresponding mxGraph cells
   - Never update mxGraph from component store changes

3. **Loose Coupling Strategy**: 
   - Store cell IDs in components (but don't store component references in cells)
   - Use cell IDs as the primary key for lookups, not component IDs
   - Only combine component data with cell data when serializing for API transmission

4. **Clean Listener Pattern**:
   - Have mxGraph trigger events when cells are created, modified, or deleted
   - Listen for these events to update the component store accordingly

### Implementation Guidelines

When implementing this separation:

1. **For Creating Cells**:
   - First create the mxGraph cell and let it generate its own ID
   - After successful creation, create a component that references the cell ID
   - Store both, but maintain them as separate concerns
   - Ensure component updates never trigger re-rendering of mxGraph cells

2. **For Modifying Cells**:
   - Modify the mxGraph cell directly
   - Update the corresponding component in the component store
   - Avoid bidirectional updates - changes to components should not trigger graph updates

3. **For Deleting Cells**:
   - Delete the mxGraph cell
   - Remove the corresponding component from the component store

4. **For Loading from Server**:
   - Load diagram structure first without components
   - Iterate through components from the diagram file
   - Create corresponding mxGraph cells and store their IDs back in the components
   - Only after all mxGraph operations are complete should components be updated

5. **Breaking Dependency Cycles**:
   - Never update the graph in response to component updates
   - Always treat mxGraph as the source of truth for visual elements
   - Treat components as the source of truth for business data
   - Component changes should accumulate until serialization but never trigger graph rendering

This approach will make the code more robust, easier to debug, and more maintainable in the long run, while avoiding infinite recursion issues from circular dependencies.