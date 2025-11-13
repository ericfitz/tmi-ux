# P0 Operations Manual Testing Guide

## Overview

This guide provides manual testing instructions for all 10 Phase 1 (P0) GraphOperation history tracking implementations. Each operation should support proper undo/redo functionality.

**Testing Environment**: Use `pnpm run dev` or `pnpm run dev:local` to run the application locally.

**Prerequisites**:
1. Start the development server
2. Navigate to a DFD diagram (create a new threat model if needed)
3. Open browser DevTools Console to monitor log messages
4. Test each operation in isolation first, then test combinations

---

## 1. Edge Creation ✅

**Operation**: User drags from one node's port to create an edge to another node

**Test Steps**:
1. Create two process nodes on the canvas
2. Click and drag from the output port of the first process
3. Release on the input port of the second process
4. Observe edge is created

**Expected Behavior**:
- Edge appears connecting the two nodes
- Console logs: "Edge validated successfully, creating GraphOperation for history"
- Console logs: "Creating retroactive CreateEdgeOperation"

**Undo Test**:
1. Click Undo button (or Ctrl/Cmd+Z)
2. Edge should disappear
3. Console logs: "Executing DeleteEdgeOperation"

**Redo Test**:
1. Click Redo button (or Ctrl/Cmd+Shift+Z)
2. Edge should reappear
3. Console logs: "Executing CreateEdgeOperation"

**Edge Cases**:
- Create multiple edges between different nodes
- Create edges with labels
- Create edges between different node types (process→datastore, process→external entity)

---

## 2. Node Creation ✅

**Operation**: User drags a node from the palette onto the canvas

**Test Steps**:
1. Drag a Process node from the left palette
2. Drop it onto the canvas
3. Observe node is created

**Expected Behavior**:
- Node appears on canvas at drop location
- Console logs: "Node added to graph, handling node addition"
- Console logs: "Creating retroactive CreateNodeOperation"

**Undo Test**:
1. Click Undo button
2. Node should disappear
3. Console logs: "Executing DeleteNodeOperation"

**Redo Test**:
1. Click Redo button
2. Node should reappear at original location
3. Console logs: "Executing CreateNodeOperation"

**Edge Cases**:
- Create multiple node types: Process, Data Store, External Entity, Trust Boundary, Security Boundary, Text Box
- Create nodes in different locations
- Create nodes then immediately move them (test multiple operations)

---

## 3. Node Movement ✅

**Operation**: User drags a node to move it to a new position

**Test Steps**:
1. Create a process node
2. Click and drag the node to a new position
3. Release the mouse button
4. Observe node in new position

**Expected Behavior**:
- Node moves smoothly during drag
- On release, console logs: "Drag completed" with dragType: "move"
- Console logs: "Creating UpdateNodeOperation for node move"

**Undo Test**:
1. Click Undo button
2. Node should return to original position
3. Console logs: "Executing UpdateNodeOperation"

**Redo Test**:
1. Click Redo button
2. Node should move back to new position

**Edge Cases**:
- Move a node multiple times (test multiple undo/redo steps)
- Move a node with connected edges (edges should move with it)
- Move an embedded node (parent relationship should be maintained)

---

## 4. Node Resizing ✅

**Operation**: User drags a node's resize handle to change its size

**Test Steps**:
1. Create a security boundary node (supports resizing)
2. Click on the node to select it
3. Drag one of the corner resize handles
4. Release to apply new size

**Expected Behavior**:
- Node resizes during drag
- On release, console logs: "Drag completed" with dragType: "resize"
- Console logs: "Creating UpdateNodeOperation for node resize"

**Undo Test**:
1. Click Undo button
2. Node should return to original size
3. Console logs: "Executing UpdateNodeOperation"

**Redo Test**:
1. Click Redo button
2. Node should resize to new size

**Edge Cases**:
- Resize different node types (security boundary, trust boundary, text box)
- Resize a node with embedded children
- Resize very small and very large

---

## 5. Node Deletion ✅

**Operation**: User deletes a selected node

**Test Steps**:
1. Create a process node
2. Select the node
3. Press Delete key (or click delete button if available)
4. Observe node is removed

**Expected Behavior**:
- Node disappears from canvas
- Console logs: "Executing DeleteNodeOperation"
- Any connected edges are also removed

**Undo Test**:
1. Click Undo button
2. Node should reappear at original position
3. Connected edges should also reappear
4. Console logs: "Executing CreateNodeOperation"

**Redo Test**:
1. Click Redo button
2. Node should be deleted again
3. Console logs: "Executing DeleteNodeOperation"

**Edge Cases**:
- Delete a node with multiple connected edges
- Delete an embedded node (parent should be updated)
- Delete a parent node with embedded children (children should also be deleted)
- Delete multiple selected nodes

---

## 6. Edge Deletion ✅

**Operation**: User deletes a selected edge

**Test Steps**:
1. Create an edge between two nodes
2. Select the edge (click on it)
3. Press Delete key
4. Observe edge is removed

**Expected Behavior**:
- Edge disappears from canvas
- Console logs: "Executing DeleteEdgeOperation"

**Undo Test**:
1. Click Undo button
2. Edge should reappear with same connection
3. Console logs: "Executing CreateEdgeOperation"

**Redo Test**:
1. Click Redo button
2. Edge should be deleted again

**Edge Cases**:
- Delete an edge with a label
- Delete an edge with custom vertices (bent edge)
- Delete multiple selected edges

---

## 7. Node Label Editing ✅

**Operation**: User edits a node's label text

**Test Steps**:
1. Create a process node
2. Double-click the node to enter label edit mode
3. Type "Test Process"
4. Press Enter or click outside to commit the change

**Expected Behavior**:
- Label text updates on the node
- Console logs: "cellLabelChanged$ observable fired" with cellType: "node"
- Console logs: "Creating UpdateNodeOperation for label change"

**Undo Test**:
1. Click Undo button
2. Label should revert to previous text (empty or original)
3. Console logs: "Executing UpdateNodeOperation"

**Redo Test**:
1. Click Redo button
2. Label should change back to "Test Process"

**Edge Cases**:
- Edit label multiple times (test multiple undo steps)
- Clear label (delete all text)
- Edit very long labels
- Edit labels with special characters

---

## 8. Edge Label Editing ✅

**Operation**: User edits an edge's label text

**Test Steps**:
1. Create an edge between two nodes
2. Double-click the edge to enter label edit mode
3. Type "Data Flow"
4. Press Enter or click outside to commit

**Expected Behavior**:
- Label text appears on the edge
- Console logs: "cellLabelChanged$ observable fired" with cellType: "edge"
- Console logs: "Creating UpdateEdgeOperation for label change"

**Undo Test**:
1. Click Undo button
2. Label should revert to previous text (empty or original)

**Redo Test**:
1. Click Redo button
2. Label should change back to "Data Flow"

**Edge Cases**:
- Edit label multiple times
- Clear edge label
- Edit labels on edges with vertices

---

## 9. Edge Vertices Drag ✅

**Operation**: User drags an edge's vertex point to bend the edge

**Test Steps**:
1. Create an edge between two nodes
2. Click and drag the edge's midpoint to create a bend
3. Release the mouse button
4. Observe edge is bent with a vertex point

**Expected Behavior**:
- Edge bends during drag, showing vertex point
- On release, console logs: "Drag completed" with dragType: "vertex"
- Console logs: "Creating UpdateEdgeOperation for vertices drag"

**Undo Test**:
1. Click Undo button
2. Edge should straighten (vertex removed)
3. Console logs: "Executing UpdateEdgeOperation"

**Redo Test**:
1. Click Redo button
2. Edge should bend again with vertex restored

**Edge Cases**:
- Create multiple vertices on one edge
- Drag vertices multiple times (test multiple undo/redo)
- Remove all vertices (edge becomes straight)

---

## 10. Edge Reconnection ✅

**Operation**: User drags an edge's endpoint to reconnect it to a different node or port

**Test Steps**:
1. Create an edge between Node A and Node B
2. Create a third Node C
3. Drag the edge's target endpoint from Node B to Node C
4. Release to reconnect

**Expected Behavior**:
- Edge disconnects from Node B and connects to Node C
- Console logs: "edgeReconnected$ observable fired" with changeType: "target"
- Console logs: "Creating UpdateEdgeOperation for target reconnection"

**Undo Test**:
1. Click Undo button
2. Edge should reconnect back to Node B
3. Console logs: "Executing UpdateEdgeOperation"

**Redo Test**:
1. Click Redo button
2. Edge should reconnect to Node C again

**Source Reconnection Test**:
1. Drag the edge's source endpoint to a different node
2. Verify console logs show changeType: "source"
3. Test undo/redo

**Edge Cases**:
- Reconnect to different ports on the same node
- Reconnect both source and target (test multiple operations)
- Reconnect an edge with vertices (vertices should be preserved)
- Reconnect an edge with a label (label should be preserved)

---

## Combined Operations Testing

After testing each operation individually, test combinations:

### Test 1: Create, Move, Delete
1. Create a process node
2. Move it to a new position
3. Delete it
4. Undo three times (should restore node, then move it back, then delete it)
5. Redo three times (should recreate, move, and delete again)

### Test 2: Create Edge, Label, Delete
1. Create two nodes and an edge between them
2. Label the edge "Test Flow"
3. Delete the edge
4. Undo twice (should restore edge and keep label)
5. Verify label is preserved

### Test 3: Create, Resize, Move
1. Create a security boundary
2. Resize it to be larger
3. Move it to a new position
4. Undo three times
5. Verify each operation undoes correctly in reverse order

### Test 4: Multiple Edge Operations
1. Create an edge
2. Add vertices to bend it
3. Label it
4. Reconnect the target
5. Undo four times (should reverse all operations)

### Test 5: Batch Node Creation
1. Create 5 different nodes
2. Undo five times (should remove nodes in reverse order)
3. Redo five times (should recreate in original order)

---

## Verification Checklist

For each operation:
- [ ] Operation works correctly when performed
- [ ] Undo reverses the operation correctly
- [ ] Redo reapplies the operation correctly
- [ ] Console logs show correct GraphOperation type
- [ ] Multiple undo/redo cycles work correctly
- [ ] No errors in console
- [ ] State is consistent after undo/redo
- [ ] Edge cases work correctly

---

## Known Issues / Limitations

1. **X6 Graph Library Limitations**:
   - Some operations are initiated by X6 directly (retroactive pattern required)
   - Drag operations fire many interim events (only final state is captured)

2. **Not Yet Implemented (P1/P2)**:
   - Cut operations
   - Paste operations
   - Copy operations
   - Style changes
   - Z-order changes
   - Data asset assignment

3. **Testing Notes**:
   - Use browser DevTools Console to monitor operation logs
   - Set log level to DEBUG for detailed information
   - Clear console between tests for cleaner output

---

## Reporting Issues

If you find any issues during testing:

1. Note the operation being tested
2. Record the exact steps to reproduce
3. Capture console logs (especially errors)
4. Note expected vs actual behavior
5. Check if issue occurs consistently or intermittently

Report in the tracking document: `docs/development/HISTORY_TRACKING_IMPLEMENTATION.md`
