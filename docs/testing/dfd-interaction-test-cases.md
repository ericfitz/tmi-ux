# DFD Graph Interaction - Comprehensive Test Cases

**Status**: Consolidated Test Plan
**Last Updated**: 2025-10-10

---

## Overview

This document enumerates all existing and proposed test cases for DFD graph interaction. Tests are organized by feature area and include both unit-level integration tests and browser-based Cypress e2e tests.

## Test Organization

### Unit/Integration Tests
Location: `src/app/pages/dfd/integration/`
- Focus on business logic, validation, and X6 adapter behavior
- Use real X6 graph instances (not mocked)
- Fast execution, run frequently during development

### Browser-Based E2E Tests
Location: `cypress/e2e/dfd/`
- Focus on actual user workflows and visual behavior
- Test real DOM, SVG elements, CSS properties
- Slower execution, run before commits and in CI

---

## Test Categories

### 1. Node Creation and Management
### 2. Embedding and Nesting Operations
### 3. Z-Order and Layering
### 4. Edge Creation and Management
### 5. Port Visibility and Connection Rules
### 6. Selection and Visual Feedback
### 7. Label Editing
### 8. Graph Navigation (Pan/Zoom)
### 9. Context Menu Operations
### 10. History System (Undo/Redo)
### 11. Post-Load Validation
### 12. Export Functionality
### 13. Performance and Browser-Specific
### 14. Collaboration and Real-Time Features

---

## 1. Node Creation and Management

### Test 1.1: Create All Node Types
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Click toolbar buttons for each node type (Actor, Process, Store, Security Boundary, Text Box)
2. Verify node appears on canvas at expected position
3. Verify default label applied
4. Verify default styling (stroke color, width, fill)
5. Verify minimum size enforced (40×30 pixels)

**Expected**:
- Each node type has correct shape and styling per constants
- Blue creation glow appears and fades out over 500ms
- Node is unselected after creation

**Assertions**:
```typescript
expect(node.getShape()).toBe('actor-shape');
expect(node.attr('body/stroke')).toBe('#000000');
expect(node.attr('body/strokeWidth')).toBe(2);
```

---

### Test 1.2: Move Nodes with Drag and Drop
**Type**: Cypress E2E
**Priority**: P0

**Steps**:
1. Create process node at (100, 100)
2. Click and drag node to (300, 200)
3. Verify snap lines appear during drag (red, 1px)
4. Release to drop
5. Verify node at new position

**Expected**:
- Node shows red glow during drag
- Snap lines help align with grid and other nodes
- Grid snapping enabled (10px increments)
- Final position correct

---

### Test 1.3: Resize Nodes via Handles
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create actor node
2. Select node (verify resize handles appear)
3. Drag corner handle to resize
4. Verify minimum size enforced (40×30 pixels)

**Expected**:
- Dashed boundary appears around selected node
- Resize handles visible at corners and midpoints
- Cannot resize below minimum

---

### Test 1.4: Delete Nodes (Three Methods)
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create process node
2. Test deletion via:
   - Button tool (X button on selected node)
   - Keyboard (Delete or Backspace)
   - Context menu (Right-click → Delete)
3. Verify connected edges deleted automatically

**Expected**:
- Node and all edges removed
- Operation undoable

---

## 2. Embedding and Nesting Operations

### Test 2.1: Complete Containment Requirement
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create security boundary at (100, 100) with size 300×300
2. Create process node at (150, 150) with size 100×80
3. Drag process completely inside boundary
4. Release drag

**Expected**:
- Process becomes embedded (getParent() returns boundary)
- Process fill color changes to bluish tint (#F0F2FF)
- Process z-index > boundary z-index
- Orange border appears on boundary during drag (when ~50%+ overlap)

**Assertions**:
```typescript
expect(processNode.getParent()?.id).toBe(securityBoundary.id);
expect(processNode.getZIndex()).toBeGreaterThan(securityBoundary.getZIndex());
```

---

### Test 2.2: Partial Overlap Rejection (bbox mode)
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create security boundary at (100, 100) with size 200×200
2. Create process node at (250, 150) with size 100×80
3. Drag process with <50% overlap into boundary
4. Release drag

**Expected**:
- Node NOT embedded
- No orange border shown on boundary during drag
- Node z-index remains at 10 (default)
- No parent relationship created

---

### Test 2.3: Circular Embedding Prevention (Direct)
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create Process Node A at (100, 100)
2. Create Process Node B at (250, 150)
3. Drag A into B (A becomes child of B)
4. Attempt to drag B into A

**Expected**:
- Embedding rejected
- Red flash appears on B (3px stroke, 300ms)
- Notification shown: "Circular embedding is not allowed"
- B remains unembedded

**Assertions**:
```typescript
expect(nodeB.getParent()).toBeNull();
// Verify notification service called
```

---

### Test 2.4: Circular Embedding Prevention (Deep)
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create Process Nodes A, B, C
2. Embed A → B (A inside B)
3. Embed B → C (B inside C)
4. Attempt to embed C → A (would create cycle)

**Expected**:
- Embedding rejected
- Red flash on C
- Notification shown
- C remains unembedded

---

### Test 2.5: Text-Box Embedding Restrictions
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create text-box node
2. Create process node
3. Attempt to drag text-box into process
4. Attempt to drag process into text-box

**Expected**:
- Both operations rejected
- No orange border shown
- Notifications:
  - "Text boxes cannot be embedded into other shapes"
  - "Cannot embed into text boxes"

---

### Test 2.6: Security Boundary Embedding Rules
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create security boundary S1
2. Create process node P
3. Attempt to drag S1 into P

**Expected**:
- Embedding rejected
- Notification: "Security boundaries can only be embedded into other security boundaries"

**Verification**:
```typescript
const validation = embeddingService.validateEmbedding(processNode, securityBoundary);
expect(validation.isValid).toBe(false);
expect(validation.reason).toContain('Security boundaries');
```

---

### Test 2.7: Re-embedding Between Valid Parents
**Type**: Unit/Integration
**Priority**: P1

**Steps**:
1. Create Process Node A (parent1)
2. Create Security Boundary B (parent2)
3. Create Process Node C (child)
4. Embed C into A
5. Drag C out of A and into B

**Expected**:
- C removed from A
- C becomes child of B
- C's z-index recalculated relative to B
- C's fill color updated based on new depth
- Single history entry (atomic re-embed operation)

**Assertions**:
```typescript
expect(nodeC.getParent()?.id).toBe(boundaryB.id);
expect(nodeC.getZIndex()).toBeGreaterThan(boundaryB.getZIndex());
```

---

### Test 2.8: Invalid Re-embedding Rejection
**Type**: Unit/Integration
**Priority**: P1

**Steps**:
1. Create Process Node A (parent1)
2. Create Text-Box T (parent2 - invalid)
3. Create Security Boundary S (child)
4. Embed S into A
5. Attempt to drag S into T

**Expected**:
- Re-embedding rejected
- S stays embedded in A
- Notification shown

---

### Test 2.9: Re-embed Node with Children (Descendant Recalculation)
**Type**: Unit/Integration
**Priority**: P1

**Steps**:
1. Create structure:
   ```
   Process A (z=10)
     └─ Process B (z=11)
          └─ Process C (z=12)
   ```
2. Create Security Boundary D (z=1)
3. Drag B (with child C) into D

**Expected**:
- B becomes child of D
- B's z-index recalculated relative to D
- C's z-index recalculated relative to B's new z-index
- C's fill color updated based on new embedding depth
- All descendants have depths recalculated

**Assertions**:
```typescript
const bDepth = embeddingService.calculateEmbeddingDepth(B);
const cDepth = embeddingService.calculateEmbeddingDepth(C);
expect(bDepth).toBe(1);
expect(cDepth).toBe(2);
```

---

### Test 2.10: Deeply Nested Re-embedding (3+ Levels)
**Type**: Unit/Integration
**Priority**: P2

**Steps**:
1. Create structure:
   ```
   Process A
     └─ Process B
          └─ Process C
               └─ Process D
   ```
2. Re-embed A into a new parent
3. Verify all descendants (B, C, D) have correct depths and colors

**Expected**:
- All descendant depths updated
- All fill colors match expected depth colors
- All z-indexes recalculated

---

### Test 2.11: Unembed Node (Drag Out of Parent)
**Type**: Unit/Integration
**Priority**: P1

**Steps**:
1. Create security boundary with embedded process
2. Drag process completely outside boundary
3. Release to unembed

**Expected**:
- Process parent relationship removed
- Process fill color returns to white (#FFFFFF)
- Process z-index reset to 10
- All descendants (if any) have z-indexes recalculated

---

### Test 2.12: Highest Z-Index Parent Selection
**Type**: Unit/Integration
**Priority**: P1

**Steps**:
1. Create Security Boundary A at (100, 100), size 400×400, z-index=1
2. Create Security Boundary B at (150, 150), size 300×300, z-index=2
3. Create Process Node P at (50, 50), size 80×60
4. Drag P to position (200, 200) where it's completely inside both A and B
5. Release drag

**Expected**:
- P becomes embedded in B (highest z-index), not A
- Orange border shows on B during drag (not A)
- P.parent = B
- P.z-index > B.z-index

**Assertions**:
```typescript
expect(processNode.getParent()?.id).toBe(boundaryB.id);
expect(processNode.getParent()?.id).not.toBe(boundaryA.id);
```

---

### Test 2.13: Embedding Visual Feedback (Orange Border)
**Type**: Cypress E2E
**Priority**: P0

**Steps**:
1. Create security boundary
2. Create process node
3. Start dragging process
4. Move over boundary until ~50%+ overlap
5. Verify orange border appears (3px stroke, #ff6b00, 4px padding)
6. Move away from boundary
7. Verify orange border disappears

**Expected**:
- Orange border appears/disappears based on valid embedding target
- Border styling matches constants (HIGHLIGHTING.EMBEDDING)
- Smooth visual feedback

---

## 3. Z-Order and Layering

### Test 3.1: Default Z-Order by Node Type
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create unembedded security boundary
2. Create unembedded process node
3. Create unembedded text box
4. Verify z-indexes

**Expected**:
- Security boundary: z=1
- Process node: z=10
- Text box: z=20

---

### Test 3.2: Embedded Node Z-Index (Child > Parent)
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create security boundary (z=1)
2. Create process node (z=10)
3. Embed process into boundary

**Expected**:
- Process z-index increases to > boundary z-index
- Process appears in front of boundary
- Connected edges updated to match highest node z-index

---

### Test 3.3: Nested Security Boundary Z-Index
**Type**: Unit/Integration
**Priority**: P1

**Steps**:
1. Create Security Boundary A (z=1)
2. Create Security Boundary B
3. Embed B into A

**Expected**:
- B z-index = A z-index + 1 (minimum 2)
- B still appears behind regular nodes (z<10)

---

### Test 3.4: Edge Z-Index Matches Highest Node
**Type**: Unit/Integration
**Priority**: P1

**Steps**:
1. Create two nodes: A (z=10), B (z=15)
2. Connect with edge
3. Verify edge z-index = max(10, 15) = 15
4. Change node z-indexes
5. Verify edge z-index updates

**Expected**:
- Edge always at same layer as highest connected node

---

### Test 3.5: Manual Z-Order Changes (Context Menu)
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Create 3 process nodes
2. Right-click on middle node
3. Select "Move to Front"
4. Verify z-index increased
5. Test "Move Backward", "Move Forward", "Move to Back"

**Expected**:
- Z-order changes respect category boundaries
- Cannot move security boundaries above regular nodes
- Cannot move children below parent

---

### Test 3.6: Z-Order Restoration After Failed Drag
**Type**: Unit/Integration
**Priority**: P2

**Steps**:
1. Create Process Node P with z-index = 15
2. Start drag (z-index temporarily raised)
3. Drop outside any valid parent
4. Verify z-index restored to 15

**Expected**:
- P.z-index = 15 (restored)
- `_originalZIndex` metadata cleared

---

### Test 3.7: Security Boundary Drag Z-Order Restoration
**Type**: Unit/Integration
**Priority**: P2

**Steps**:
1. Create Security Boundary S with z-index = 1
2. Drag (temporarily raised to prevent overlap issues)
3. Drop in empty space (no embedding)
4. Verify z-index restored to 1

**Expected**:
- Security boundary returns to z=1

---

## 4. Edge Creation and Management

### Test 4.1: Create Edge via Port Drag
**Type**: Cypress E2E
**Priority**: P0

**Steps**:
1. Create two process nodes
2. Hover over source node (ports appear)
3. Click and drag from source port
4. Verify all ports on all nodes become visible
5. Verify temporary edge line follows cursor
6. Drop on target port

**Expected**:
- Edge created with default styling (black, 2px, smooth connector)
- Default label "Flow" applied
- Both ports remain visible (connected ports always visible)

---

### Test 4.2: Port Magnetization (Snap to Port)
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Start edge creation
2. Move cursor near (within 20px) target port
3. Verify blue highlight on port (#1890ff)
4. Verify edge snaps to port

**Expected**:
- Blue circle appears at port
- Edge endpoint aligns with port center

---

### Test 4.3: Valid Target Port Highlighting
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create actor and process nodes
2. Start edge creation from actor
3. Hover over process port
4. Verify green highlight (#31D06E)

**Expected**:
- Valid targets show green highlight
- Invalid targets show no highlight

---

### Test 4.4: Edge Connection Rules Enforcement
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Verify X6 connection config:
   - `allowNode: false` - Cannot connect to node directly
   - `allowPort: true` - Must connect to ports
   - `allowBlank: false` - Cannot start from blank canvas
   - `allowLoop: true` - Self-connections allowed
   - `allowMulti: true` - Multiple edges between same nodes allowed

**Expected**:
- Attempting invalid connections rejected
- Valid connections succeed

---

### Test 4.5: Edge Tools on Selection
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create edge
2. Click edge to select
3. Verify tools appear:
   - Source arrowhead (blue circle)
   - Target arrowhead (orange circle)
   - Button-remove (red X)
   - Vertices (click to add)

**Expected**:
- All tools visible when edge selected
- Tools hidden when deselected

---

### Test 4.6: Edge Vertex Management
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create edge
2. Select edge
3. Click on edge stroke to add vertex
4. Drag vertex to reposition
5. Drag vertex onto another vertex to remove

**Expected**:
- Vertices allow precise edge routing
- Can add/remove/reposition vertices

---

### Test 4.7: Edge Deletion (Three Methods)
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create edge
2. Test deletion via:
   - Button tool (X on selected edge)
   - Keyboard (Delete or Backspace)
   - Context menu (Right-click → Delete)

**Expected**:
- Edge removed
- Operation undoable

---

### Test 4.8: Edge Reconnection via Arrowheads
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Create edge between nodes A and B
2. Select edge
3. Drag source arrowhead (blue circle) to node C
4. Verify edge reconnected: C → B

**Expected**:
- Edge source updated
- Edge z-index recalculated

---

## 5. Port Visibility and Connection Rules

### Test 5.1: Port Visibility States
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create process node
2. Verify ports hidden by default
3. Hover over node → ports appear
4. Unhover → ports hidden
5. Create edge connected to port → port remains visible

**Expected**:
- Ports hidden unless:
  - Mouse hovers over node
  - Port has connected edge
  - User creating edge (all ports visible)

---

### Test 5.2: All Ports Visible During Edge Creation
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create 3 process nodes
2. Start edge creation from first node
3. Verify all ports on all nodes visible
4. Complete or cancel edge creation
5. Verify only connected ports remain visible

**Expected**:
- Global port visibility during edge creation
- Returns to normal after completion/cancellation

---

### Test 5.3: DFD Connection Validation Rules
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create actor and store nodes
2. Attempt to connect actor → store (invalid)
3. Verify connection rejected
4. Add process node between them
5. Connect actor → process → store (valid)

**Expected**:
- Invalid connections rejected
- Valid DFD patterns succeed

---

## 6. Selection and Visual Feedback

### Test 6.1: Single Node Selection
**Type**: Cypress E2E
**Priority**: P0

**Steps**:
1. Create process node
2. Click on node to select
3. Verify red glow (drop-shadow filter)
4. Verify stroke width increases to 3px
5. Click blank canvas to deselect

**Expected**:
- Selected: Red glow, 3px stroke
- Deselected: Clean state, 2px stroke

**Assertions**:
```typescript
cy.get('[data-node-id="process"]')
  .should('have.css', 'filter')
  .and('contain', 'drop-shadow');
cy.get('[data-node-id="process"] rect')
  .should('have.css', 'stroke-width', '3px');
```

---

### Test 6.2: Multiple Node Selection (Rubberband)
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create 3 process nodes in a cluster
2. Click and drag on blank canvas to draw selection rectangle
3. Release to select all within rectangle
4. Verify all selected nodes show red glow

**Expected**:
- All cells within rectangle selected
- All show selection styling

---

### Test 6.3: Hover Effect (Unselected Only)
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create process node
2. Hover over node (unselected)
3. Verify subtle red glow (rgba(255,0,0,0.6))
4. Select node
5. Hover again
6. Verify hover effect suppressed (selection effect takes priority)

**Expected**:
- Hover effect only on unselected nodes
- Selection effect overrides hover

---

### Test 6.4: Creation Effect (Blue Glow Fade-out)
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create new node
2. Verify blue glow appears (rgba(0,150,255,0.9))
3. Wait 500ms
4. Verify glow fades out completely

**Expected**:
- Blue glow for local operations
- Green glow for remote operations (collaboration)
- Fades over 500ms using animation frames
- Effect suppressed if cell selected during animation

---

### Test 6.5: Invalid Embedding Visual Feedback (Red Flash)
**Type**: Cypress E2E
**Priority**: P0

**Steps**:
1. Create text-box node
2. Create process node
3. Drag text-box over process (invalid embedding)
4. Release
5. Verify red border flash on text-box (3px, #ff0000, 300ms)

**Expected**:
- Red flash indicates invalid operation
- Flash duration = 300ms
- Returns to normal styling after flash

---

### Test 6.6: Selection Styling Persistence Bug (CRITICAL)
**Type**: Cypress E2E
**Priority**: P0 🚨

**Steps**:
1. Create node
2. Select node (verify red glow and tools appear)
3. Delete selected node
4. Undo deletion
5. **CRITICAL**: Verify NO selection styling artifacts

**Expected**:
- Restored node has clean state (no glow, no tools)
- Stroke width = 2px (not 3px)
- No active visual effects
- Graph selection is empty

**Assertions**:
```typescript
cy.dfdUndo();
cy.dfdGetNodes().should('have.length', 1);
cy.dfdVerifySelectionStyling('actor', false);
cy.dfdVerifyTools('actor', []);
cy.dfdVerifyCleanState('actor');
cy.dfdGetSelectedCells().should('have.length', 0);
```

---

### Test 6.7: Multi-Cell Selection Persistence
**Type**: Cypress E2E
**Priority**: P0 🚨

**Steps**:
1. Create 3 nodes of different types
2. Select all (Ctrl+A or rubberband)
3. Verify all show selection styling
4. Delete all selected
5. Undo deletion
6. **CRITICAL**: Verify ALL restored nodes have clean state

**Expected**:
- All nodes restored without selection artifacts
- No tools visible on any node
- Graph selection empty

---

### Test 6.8: Visual Effects Lifecycle During Selection
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create node (blue creation glow appears)
2. Immediately select node during creation glow
3. Verify creation effect suppressed
4. Verify selection effect shown instead

**Expected**:
- Active effects tracked to prevent conflicts
- Selection takes priority over creation effect

---

## 7. Label Editing

### Test 7.1: Double-Click to Edit Label
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create process node with default label
2. Double-click on node
3. Verify inline text editor appears
4. Type new label text
5. Press Enter to save

**Expected**:
- X6 text editor appears at label position
- Can edit text directly
- Enter saves, Escape cancels
- Click outside saves and closes

---

### Test 7.2: Edit Edge Label
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create edge
2. Double-click on edge label
3. Edit label text
4. Save

**Expected**:
- Edge labels editable same as node labels

---

### Test 7.3: Keyboard Shortcuts Disabled During Edit
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Create node
2. Start editing label
3. Press Delete key
4. Verify Delete key inserts text (doesn't delete node)
5. Finish editing
6. Press Delete
7. Verify node deleted (shortcut works when not editing)

**Expected**:
- Keyboard shortcuts filtered when editing labels
- Focus management prevents conflicts

---

## 8. Graph Navigation (Pan/Zoom)

### Test 8.1: Pan with Shift+Drag
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create diagram with nodes
2. Hold Shift key + left mouse drag
3. Verify graph pans
4. Release Shift

**Expected**:
- Graph pans in direction of drag
- Nodes remain at relative positions

---

### Test 8.2: Zoom with Shift+Wheel
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create node at center
2. Hold Shift + mouse wheel up (zoom in)
3. Verify zoom increases (max 1.5×)
4. Hold Shift + mouse wheel down (zoom out)
5. Verify zoom decreases (min 0.5×)

**Expected**:
- Zoom centers on mouse cursor position
- Zoom factor: 1.1 per step
- Min zoom: 0.5× (50%)
- Max zoom: 1.5× (150%)

---

### Test 8.3: Grid Visibility and Snapping
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Verify grid visible by default
2. Verify 10px spacing
3. Move node and verify grid snapping
4. Verify snap lines appear (red, 1px)

**Expected**:
- Grid: 10px spacing, #666 primary, #888 secondary
- Nodes snap to grid when moving
- Snap lines help align with other nodes

---

### Test 8.4: Canvas Resize (Responsive)
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Create diagram
2. Resize window
3. Verify canvas resizes
4. Verify nodes remain at same relative positions
5. Verify zoom level maintained

**Expected**:
- Canvas auto-resizes on window resize
- Graph maintains aspect ratio

---

## 9. Context Menu Operations

### Test 9.1: Show Object (Debug Info)
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Create node
2. Select node
3. Right-click on node
4. Select "Show Object"
5. Verify dialog shows JSON structure
6. Verify copy-to-clipboard button works

**Expected**:
- Dialog displays complete cell structure
- Useful for debugging

---

### Test 9.2: Z-Order Context Menu Operations
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Create 3 process nodes with different z-indexes
2. Right-click on middle node
3. Test each option:
   - Move Forward (z-index + 1)
   - Move Backward (z-index - 1)
   - Move to Front (max z in category)
   - Move to Back (min z in category)

**Expected**:
- Z-order changes respect hierarchy rules
- Operations are undoable

---

## 10. History System (Undo/Redo)

### Test 10.1: Undo/Redo Node Creation
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create process node
2. Press Ctrl+Z (undo)
3. Verify node removed
4. Press Ctrl+Shift+Z (redo)
5. Verify node restored

**Expected**:
- Undo removes node
- Redo restores node with correct state

---

### Test 10.2: Undo/Redo Node Movement
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create node at (100, 100)
2. Move to (300, 200)
3. Undo → verify position (100, 100)
4. Redo → verify position (300, 200)

**Expected**:
- Undo/redo restores exact positions

---

### Test 10.3: Undo/Redo Embedding (Atomic Operation)
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create security boundary and process
2. Embed process into boundary
3. Press Ctrl+Z (undo)
4. Verify process unembedded
5. Verify appearance restored (white fill, z=10)
6. Press Ctrl+Shift+Z (redo)
7. Verify process re-embedded with correct appearance

**Expected**:
- Embedding is single undo operation
- All appearance changes restored correctly

---

### Test 10.4: Undo/Redo Re-embedding (Atomic)
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Embed process into Security Boundary A
2. Re-embed process into Security Boundary B
3. Press Ctrl+Z once
4. Verify process restored to parent A (not unembedded state)

**Expected**:
- Re-embedding is atomic (single undo restores previous parent)
- Not separate unembed + embed operations

---

### Test 10.5: History Excludes Visual Effects
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create node
2. Hover over node (visual effect)
3. Select node (visual effect)
4. Deselect node
5. Check history entries

**Expected**:
- History contains only structural changes:
  - Node/edge add/remove/move/resize
  - Embedding operations
  - Label edits
  - Z-order changes
- History excludes:
  - Visual effects (hover, selection styling)
  - Port visibility changes
  - Tool visibility

---

### Test 10.6: Rapid Undo/Redo Sequence (Race Conditions)
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Perform embedding operation
2. Rapidly press Ctrl+Z, Ctrl+Shift+Z, Ctrl+Z, Ctrl+Shift+Z (10 times)
3. Verify final state consistent

**Expected**:
- No errors thrown
- Final state matches expected (either embedded or not)

---

## 11. Post-Load Validation

### Test 11.1: Load Diagram with Invalid Embeddings
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create JSON diagram data with:
   - Text-box embedded in process (invalid)
   - Circular embedding: A→B→A (invalid)
2. Load diagram via `loadDiagram()` operation
3. Call `validateAndFixLoadedDiagram()`

**Expected**:
- Invalid embeddings unembedded
- Circular embeddings broken
- Violations logged
- Summary notification shown: "Diagram loaded with N corrections applied (M embedding, K z-order)"

**Assertions**:
```typescript
const result = embeddingAdapter.validateAndFixLoadedDiagram(graph);
expect(result.fixed).toBeGreaterThan(0);
expect(result.violations).toHaveLength(2);
```

---

### Test 11.2: Load Diagram with Z-Order Violations
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create JSON with unembedded security boundary having z-index=15 (wrong)
2. Load diagram
3. Run `validateAndCorrectLoadedDiagram()`

**Expected**:
- Security boundary z-index corrected to 1
- Regular nodes remain at z≥10
- Notification shown if fixes made

**Assertions**:
```typescript
const result = zOrderAdapter.validateAndCorrectLoadedDiagram(graph);
expect(result.fixed).toBe(1);
expect(securityBoundary.getZIndex()).toBe(1);
```

---

### Test 11.3: Load Diagram with Embedded Children at Wrong Z-Index
**Type**: Unit/Integration
**Priority**: P0

**Steps**:
1. Create JSON:
   ```json
   {
     "nodes": [
       { "id": "parent", "z": 10 },
       { "id": "child", "z": 8, "parent": "parent" }  // Invalid!
     ]
   }
   ```
2. Load diagram
3. Run validation

**Expected**:
- Child z-index corrected to > parent z-index
- Violation logged

---

### Test 11.4: Load Diagram with Orphaned Parent References
**Type**: Unit/Integration
**Priority**: P1

**Steps**:
1. Create JSON with node referencing non-existent parent ID
2. Load diagram
3. Run validation

**Expected**:
- Orphaned parent reference removed
- Node appears as unembedded

---

## 12. Export Functionality

### Test 12.1: Export to SVG
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create sample diagram
2. Click export toolbar button
3. Select SVG format
4. Verify file downloads
5. Verify SVG contains all nodes and edges

**Expected**:
- SVG export includes all styling
- Scalable vector format
- File named with timestamp

---

### Test 12.2: Export to PNG
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create sample diagram
2. Export to PNG
3. Verify raster image created
4. Verify quality configurable

**Expected**:
- PNG export with configurable quality

---

### Test 12.3: Export to JPEG
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create sample diagram
2. Export to JPEG
3. Verify compression applied
4. Verify quality setting (0-100)

**Expected**:
- JPEG with compression, configurable quality

---

### Test 12.4: Export Options (Background, Padding)
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Create diagram
2. Test export options:
   - Include/exclude background
   - Add padding around diagram
3. Verify exported image matches settings

**Expected**:
- Export uses X6 export plugin
- Options applied correctly

---

## 13. Performance and Browser-Specific

### Test 13.1: Large Diagram Performance (50+ Nodes, 100+ Edges)
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Create 50 nodes and 100 edges
2. Measure performance:
   - Select all (< 50ms)
   - Move selection (60fps)
   - Deselect (< 50ms)
3. Verify no memory leaks

**Expected**:
- Smooth interaction with large diagrams
- Performance characteristics met:
  - Selection/deselection < 50ms
  - Drag operations at 60fps
  - Creation effects at 60fps

**Assertions**:
```typescript
cy.dfdMeasurePerformance(() => {
  cy.dfdSelectAll();
  cy.dfdMoveSelection({ x: 50, y: 50 });
  cy.dfdClearSelection();
}).should('be.lessThan', 1000); // < 1 second
```

---

### Test 13.2: Deeply Nested Security Boundaries (5 Levels)
**Type**: Unit/Integration
**Priority**: P2

**Steps**:
1. Create nested structure:
   ```
   SB A (z=1)
     └─ SB B (z=2)
          └─ SB C (z=3)
               └─ SB D (z=4)
                    └─ SB E (z=5)
   ```
2. Drag E out of D (unembed)
3. Verify all descendants of E (if any) recalculated
4. Measure performance

**Expected**:
- Efficient recursive z-index updates
- No performance degradation

---

### Test 13.3: Simultaneous Multi-Node Drag
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Create 3 process nodes
2. Select all 3
3. Drag into security boundary
4. Verify all 3 embedded correctly
5. Verify single history entry

**Expected**:
- Multi-node operations batched
- Appears as single history entry

---

### Test 13.4: Window Resize (Responsive Behavior)
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Create diagram at viewport (1920, 1080)
2. Resize to (1200, 800)
3. Verify canvas resizes
4. Verify node still visible and interactive
5. Resize to (800, 600)
6. Verify responsive behavior

**Expected**:
- Canvas auto-resizes
- Nodes remain visible
- Selection still works

**Assertions**:
```typescript
cy.viewport(1200, 800);
cy.dfdVerifyCanvasSize(1200, 800);
cy.dfdVerifyNodeVisible('process');
cy.dfdSelectNode('process');
cy.dfdVerifySelectionStyling('process', true);
```

---

### Test 13.5: Zoom and Pan Operations
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Create node at (200, 200)
2. Zoom to 1.5×
3. Verify node still visible
4. Pan by (100, 50)
5. Verify node still selectable

**Expected**:
- Zoom centers on cursor
- Pan maintains node positions
- Selection works after zoom/pan

---

### Test 13.6: Cross-Browser Compatibility
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Run all tests in:
   - Chrome
   - Firefox
   - Safari
   - Edge
2. Verify consistent behavior

**Expected**:
- Works in all supported browsers

---

## 14. Collaboration and Real-Time Features

### Test 14.1: Multi-User Editing Scenarios
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Simulate second user connection
2. User 1 creates node
3. Verify user 2 sees the node (green creation glow for remote)
4. User 2 modifies node
5. Verify user 1 sees the change

**Expected**:
- Real-time synchronization
- Remote operations show green glow (vs blue for local)
- Changes propagate immediately

**Assertions**:
```typescript
cy.dfdSimulateUserJoin('user2');
cy.dfdVerifyUserPresence('user2', true);
cy.dfdCreateNode('process', { x: 200, y: 200 }, 'Shared Process');
cy.dfdVerifyNodeExistsForUser('Shared Process', 'user2');
```

---

### Test 14.2: Concurrent Edit Conflict Resolution
**Type**: Cypress E2E
**Priority**: P1

**Steps**:
1. Two users select same node
2. Both attempt to move node simultaneously
3. Verify conflict resolution mechanism
4. Verify final state consistent

**Expected**:
- Conflicts resolved gracefully
- No data loss

---

### Test 14.3: User Presence Indicators
**Type**: Cypress E2E
**Priority**: P2

**Steps**:
1. Simulate multiple users joining
2. Verify presence indicators shown
3. User leaves
4. Verify presence indicator removed

**Expected**:
- Real-time user presence tracking

---

## Test Utilities and Helpers

### Custom Cypress Commands

```typescript
// cypress/support/dfd-commands.ts
declare global {
  namespace Cypress {
    interface Chainable {
      // Node operations
      dfdCreateNode(type: string, position: {x: number, y: number}, label?: string): Chainable<Element>
      dfdSelectNode(identifier: string): Chainable<Element>
      dfdMoveNode(identifier: string, position: {x: number, y: number}): Chainable<Element>
      dfdDeleteSelected(): Chainable<Element>

      // Visual verification
      dfdVerifySelectionStyling(identifier: string, isSelected: boolean): Chainable<Element>
      dfdVerifyCleanState(identifier: string): Chainable<Element>
      dfdVerifyCreationEffect(identifier: string, hasEffect: boolean): Chainable<Element>
      dfdVerifyHoverEffect(identifier: string, hasEffect: boolean): Chainable<Element>

      // Embedding operations
      dfdDragToEmbed(childId: string, parentId: string): Chainable<Element>
      dfdVerifyEmbedding(childId: string, parentId: string): Chainable<Element>

      // Z-order verification
      dfdVerifyZOrder(identifier: string, expectedZ: number): Chainable<Element>

      // History operations
      dfdUndo(): Chainable<Element>
      dfdRedo(): Chainable<Element>

      // Graph state
      dfdGetNodes(): Chainable<Element[]>
      dfdGetEdges(): Chainable<Element[]>
      dfdGetSelectedCells(): Chainable<Element[]>
      dfdClearSelection(): Chainable<Element>

      // Performance
      dfdMeasurePerformance(operation: () => void): Chainable<number>
      dfdCheckMemoryUsage(): Chainable<{ stable: boolean }>

      // Collaboration
      dfdSimulateUserJoin(userId: string): Chainable<void>
      dfdVerifyUserPresence(userId: string, present: boolean): Chainable<Element>
    }
  }
}
```

### Test Fixtures

```
src/app/pages/dfd/integration/fixtures/
├── invalid-embeddings.json           # Circular/invalid embeddings
├── z-order-violations.json           # Security boundaries in front
├── nested-boundaries.json            # 5-level nested structure
├── large-diagram.json                # 50+ nodes, 100+ edges
└── multi-user-scenario.json          # Collaboration test data
```

---

## Test Coverage Gaps

Based on the user interaction guide, these areas need additional test coverage:

1. **Port Label Editing**: Not yet implemented, no tests needed
2. **Keyboard-Only Navigation**: Future enhancement, tests TBD
3. **Screen Reader Support**: Future enhancement, tests TBD
4. **High Contrast Mode**: Future enhancement, tests TBD
5. **Save Functionality**: Button disabled, not implemented
6. **Minimap for Large Diagrams**: Not implemented
7. **Self-Connection Circular Paths**: Known limitation (renders as straight line)

---

## Test Execution Priority

### Phase 1: Critical (P0)
**Focus**: Selection persistence bug, embedding validation, visual feedback

- Test 6.6: Selection Styling Persistence Bug 🚨
- Test 6.7: Multi-Cell Selection Persistence 🚨
- Test 2.1: Complete Containment Requirement
- Test 2.3: Circular Embedding Prevention (Direct)
- Test 2.5: Text-Box Embedding Restrictions
- Test 2.6: Security Boundary Embedding Rules
- Test 2.13: Embedding Visual Feedback (Orange Border)
- Test 1.1: Create All Node Types
- Test 4.1: Create Edge via Port Drag
- Test 11.1: Load with Invalid Embeddings
- Test 11.2: Load with Z-Order Violations
- Test 11.3: Load with Wrong Child Z-Index
- Test 10.5: History Excludes Visual Effects

**Total**: 13 tests

---

### Phase 2: Core Features (P1)
**Focus**: Complete user workflows, re-embedding, z-order, undo/redo

- Test 2.7: Re-embedding Between Valid Parents
- Test 2.9: Re-embed with Children
- Test 2.12: Highest Z-Index Parent Selection
- Test 3.2: Embedded Node Z-Index
- Test 4.2: Port Magnetization
- Test 6.1: Single Node Selection
- Test 6.2: Multiple Node Selection
- Test 6.4: Creation Effect
- Test 10.1: Undo/Redo Node Creation
- Test 10.3: Undo/Redo Embedding
- Test 10.4: Undo/Redo Re-embedding
- Test 13.1: Large Diagram Performance
- Test 14.1: Multi-User Editing
- Test 14.2: Concurrent Edit Conflict Resolution

**Total**: 14 tests

---

### Phase 3: Advanced Features (P2)
**Focus**: Polish, edge cases, browser-specific, performance

- All remaining tests (context menu, export, zoom/pan, accessibility)

**Total**: ~20 tests

---

## Success Criteria

### Critical Issue Resolution
- ✅ Selection styling persistence eliminated
- ✅ Visual effects state management working correctly
- ✅ History system excludes visual effects

### Feature Coverage
- ✅ All P0 tests pass
- ✅ All P1 tests pass
- 🔄 P2 tests implemented incrementally

### Quality Standards
- ✅ Maintainable test code with reusable commands
- ✅ Comprehensive error coverage
- ✅ Visual regression detection
- ✅ CI/CD integration

---

## Notes

- Tests use real X6 graph instances (not mocked) for accuracy
- Cypress commands provide reusable test utilities
- Test fixtures provide complex scenario data
- Performance tests measure actual browser metrics
- Collaboration tests require WebSocket simulation
