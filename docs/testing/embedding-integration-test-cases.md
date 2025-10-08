# Embedding & Z-Order Integration Test Cases

**Date**: 2025-10-08
**Status**: Proposed
**Purpose**: Comprehensive integration testing for drag-to-embed improvements

---

## Test Organization

All tests should be created in: `src/app/pages/dfd/integration/embedding-operations.spec.ts`

Tests should use Cypress with real X6 graph instances (not mocked) to verify actual visual behavior.

---

## Category 1: Complete Containment Validation

### Test 1.1: Partial Overlap Rejection
**Description**: Verify that nodes are NOT embedded when only partially overlapping a potential parent

**Steps**:
1. Create a security boundary at (100, 100) with size 200x200
2. Create a process node at (250, 150) with size 100x80
3. Drag process node partially into security boundary (50% overlap)
4. Release drag

**Expected**:
- Node should NOT become embedded
- Node z-index should remain at 10 (default)
- No parent relationship created

**Assertion**:
```typescript
expect(processNode.getParent()).toBeNull();
expect(processNode.getZIndex()).toBe(10);
```

---

### Test 1.2: Complete Containment Success
**Description**: Verify that nodes ARE embedded when 100% contained within a parent

**Steps**:
1. Create a security boundary at (100, 100) with size 300x300
2. Create a process node at (150, 150) with size 100x80
3. Drag process node completely inside security boundary
4. Release drag

**Expected**:
- Node becomes embedded
- Node z-index updated to be > parent z-index
- Parent relationship created
- Embedding appearance applied (fill color updated)

**Assertions**:
```typescript
expect(processNode.getParent()?.id).toBe(securityBoundary.id);
expect(processNode.getZIndex()).toBeGreaterThan(securityBoundary.getZIndex());
```

---

## Category 2: Multiple Overlapping Parents

### Test 2.1: Highest Z-Index Parent Selection
**Description**: When multiple valid parents overlap, the topmost (highest z-index) should be selected

**Steps**:
1. Create Security Boundary A at (100, 100), size 400x400, z-index=1
2. Create Security Boundary B at (150, 150), size 300x300, z-index=2
3. Create Process Node P at (50, 50), size 80x60
4. Drag P to position (200, 200) where it's completely inside both A and B
5. Release drag

**Expected**:
- P becomes embedded in B (highest z-index), not A
- P.parent = B
- P.z-index > B.z-index

**Assertions**:
```typescript
expect(processNode.getParent()?.id).toBe(boundaryB.id);
expect(processNode.getParent()?.id).not.toBe(boundaryA.id);
```

---

### Test 2.2: Z-Index Tie-Breaking
**Description**: If two parents have the same z-index, first in array wins

**Steps**:
1. Create two security boundaries with same z-index at overlapping positions
2. Drag node into overlapping region
3. Verify which parent is selected

**Expected**:
- Consistent parent selection based on array order

---

## Category 3: Circular Embedding Prevention

### Test 3.1: Direct Circular Prevention (A → B → A)
**Description**: Prevent embedding Node B into Node A if A is already embedded in B

**Steps**:
1. Create Process Node A at (100, 100)
2. Create Process Node B at (250, 150)
3. Drag A into B (A becomes child of B)
4. Attempt to drag B into A

**Expected**:
- Embedding is rejected
- Notification shown: "Circular embedding is not allowed"
- B remains unembedded (not child of A)

**Assertions**:
```typescript
expect(nodeB.getParent()).toBeNull();
// Verify notification was shown (may require spy)
```

---

### Test 3.2: Deep Circular Prevention (A → B → C → A)
**Description**: Prevent circular embedding through multiple levels

**Steps**:
1. Create Process Nodes A, B, C
2. Embed A → B (A inside B)
3. Embed B → C (B inside C)
4. Attempt to embed C → A (would create cycle)

**Expected**:
- Embedding rejected
- Notification shown
- C remains unembedded

---

### Test 3.3: Self-Embedding Prevention
**Description**: Prevent node from being embedded into itself

**Steps**:
1. Create Process Node A
2. Mock drag operation with parent = child = A
3. Verify validation rejects it

**Expected**:
- Validation returns `isValid: false`
- Reason: "Circular embedding is not allowed"

---

## Category 4: Validation Error Notifications

### Test 4.1: Text-Box Embedding Rejection
**Description**: Verify user-friendly notification when attempting invalid embedding

**Steps**:
1. Create text-box node
2. Create process node
3. Attempt to drag text-box into process

**Expected**:
- Embedding rejected
- Notification shown: "Text boxes cannot be embedded into other shapes"
- Warning panel class applied

**Assertions**:
```typescript
// May need to spy on AppNotificationService.showEmbeddingValidationError
expect(notificationService.showEmbeddingValidationError).toHaveBeenCalledWith(
  'editor.embedding.cannotEmbedTextBox'
);
```

---

### Test 4.2: Security Boundary Restriction
**Description**: Verify notification for security boundary embedding restriction

**Steps**:
1. Create security boundary
2. Create process node
3. Attempt to drag security boundary into process

**Expected**:
- Notification: "Security boundaries can only be embedded into other security boundaries"

---

## Category 5: Re-embedding with Validation

### Test 5.1: Valid Re-embedding (Process → Process → Security Boundary)
**Description**: Re-embed from one valid parent to another valid parent

**Steps**:
1. Create Process Node A (parent1)
2. Create Security Boundary B (parent2)
3. Create Process Node C (child)
4. Embed C into A
5. Drag C out of A and into B

**Expected**:
- C is removed from A
- C becomes child of B
- C's z-index recalculated relative to B
- Single history entry created (re-embed, not unembed + embed)

**Assertions**:
```typescript
expect(nodeC.getParent()?.id).toBe(boundaryB.id);
expect(nodeC.getZIndex()).toBeGreaterThan(boundaryB.getZIndex());
```

---

### Test 5.2: Invalid Re-embedding Rejection
**Description**: Attempt to re-embed into an invalid parent

**Steps**:
1. Create Process Node A (parent1)
2. Create Text-Box T (parent2 - invalid)
3. Create Security Boundary S (child)
4. Embed S into A
5. Attempt to drag S into T

**Expected**:
- Re-embedding rejected
- S reverts to parent A (stays embedded in A)
- Notification shown

**Assertions**:
```typescript
expect(securityBoundary.getParent()?.id).toBe(nodeA.id); // Still in A
```

---

## Category 6: Descendant Depth Recalculation

### Test 6.1: Re-embed with Children
**Description**: When re-embedding a node with children, all descendants should have depths recalculated

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

**Assertions**:
```typescript
const bDepth = calculateEmbeddingDepth(B); // Should be 1
const cDepth = calculateEmbeddingDepth(C); // Should be 2
expect(bDepth).toBe(1);
expect(cDepth).toBe(2);
// Verify fill colors match expected depth colors
```

---

### Test 6.2: Deeply Nested Re-embedding
**Description**: Re-embed a node with 3+ levels of descendants

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

---

## Category 7: Z-Order Restoration After Drag

### Test 7.1: Failed Embedding Restores Original Z-Index
**Description**: If drag doesn't result in embedding, original z-index should be restored

**Steps**:
1. Create Process Node P with z-index = 15
2. Start drag (z-index temporarily raised)
3. Drop outside any valid parent
4. Verify z-index restored to 15

**Expected**:
- P.z-index = 15 (restored)
- `_originalZIndex` metadata cleared

---

### Test 7.2: Security Boundary Drag Restoration
**Description**: Security boundaries should restore to z=1 after failed drag

**Steps**:
1. Create Security Boundary S with z-index = 1
2. Drag (temporarily raised to prevent overlap issues)
3. Drop in empty space (no embedding)
4. Verify z-index restored to 1

---

## Category 8: Post-Load Validation

### Test 8.1: Load Diagram with Invalid Embeddings
**Description**: Loading a diagram with circular or invalid embeddings should fix them

**Steps**:
1. Create JSON diagram data with:
   - Text-box embedded in process (invalid)
   - Circular embedding: A→B→A (invalid)
2. Load diagram via `loadDiagram()` operation
3. After load completes, call validation methods

**Expected**:
- Invalid embeddings are unembedded
- Circular embeddings broken
- Violations logged
- Summary notification shown to user (if any fixes made)

**Assertions**:
```typescript
const result = embeddingAdapter.validateAndFixLoadedDiagram(graph);
expect(result.fixed).toBeGreaterThan(0);
expect(result.violations).toHaveLength(2);
```

---

### Test 8.2: Load Diagram with Z-Order Violations
**Description**: Security boundaries in front of regular nodes should be fixed

**Steps**:
1. Create JSON with unembedded security boundary having z-index=15 (wrong)
2. Load diagram
3. Run z-order validation

**Expected**:
- Security boundary z-index corrected to 1
- Regular nodes remain at z≥10

**Assertions**:
```typescript
const result = zOrderAdapter.validateAndCorrectLoadedDiagram(graph);
expect(result.fixed).toBe(1);
expect(securityBoundary.getZIndex()).toBe(1);
```

---

### Test 8.3: Load Diagram with Embedded Children at Wrong Z-Index
**Description**: Children with z-index ≤ parent should be fixed

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

## Category 9: Undo/Redo for Embedding

### Test 9.1: Undo/Redo Initial Embedding
**Description**: Embedding operation should be undoable/redoable

**Steps**:
1. Create security boundary and process node
2. Drag process into boundary (embed)
3. Press Ctrl+Z (undo)
4. Press Ctrl+Shift+Z (redo)

**Expected**:
- After undo: Node unembedded, appearance restored
- After redo: Node re-embedded, appearance reapplied

---

### Test 9.2: Undo/Redo Re-embedding (Atomic Operation)
**Description**: Re-embedding from parent A to parent B should be single undo operation

**Steps**:
1. Embed process into Security Boundary A
2. Re-embed process into Security Boundary B
3. Press Ctrl+Z once

**Expected**:
- Single undo restores process to parent A (not unembedded state)
- Proves re-embedding is atomic

**Assertions**:
```typescript
// After undo
expect(processNode.getParent()?.id).toBe(boundaryA.id);
```

---

### Test 9.3: Rapid Undo/Redo Sequence
**Description**: Test for race conditions in rapid undo/redo

**Steps**:
1. Perform embedding operation
2. Rapidly press Ctrl+Z, Ctrl+Shift+Z, Ctrl+Z, Ctrl+Shift+Z (10 times)
3. Verify final state is consistent

**Expected**:
- No errors thrown
- Final state matches expected (either embedded or not, depending on count)

---

## Category 10: Edge Cases

### Test 10.1: Drag Node with 50+ Connected Edges
**Description**: Performance test for edge z-order batch updates

**Steps**:
1. Create process node with 50 connected edges
2. Embed node into security boundary
3. Measure time for z-order updates
4. Verify all edge z-indexes updated correctly

**Expected**:
- Operation completes in <500ms
- All edges have z-index = max(source.z, target.z)

---

### Test 10.2: Deeply Nested Security Boundaries (5 Levels)
**Description**: Test extreme nesting scenario

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
3. Verify all descendants of E (if any) are recalculated

---

### Test 10.3: Simultaneous Multi-Node Drag
**Description**: Dragging multiple selected nodes

**Steps**:
1. Create 3 process nodes
2. Select all 3
3. Drag into security boundary
4. Verify all 3 are embedded correctly

**Expected**:
- All 3 nodes embedded
- All have correct z-indexes
- Appears as single history entry

---

## Implementation Notes

### Test Utilities Needed
1. **`createTestNode(type, x, y, z?)`**: Helper to create typed nodes
2. **`calculateEmbeddingDepth(node)`**: Calculate actual embedding depth
3. **`getExpectedFillColor(depth)`**: Get expected fill color for depth
4. **`assertEmbeddingState(node, parent?, depth?)`**: Combined assertions

### Spy/Mock Requirements
- **AppNotificationService**: Spy on `showEmbeddingValidationError()`
- **LoggerService**: Verify warning/error logs for violations
- **History**: Verify atomic operations create single entries

### Test Data
Create fixture files in `src/app/pages/dfd/integration/fixtures/`:
- `invalid-embeddings.json`: Diagram with circular/invalid embeddings
- `z-order-violations.json`: Diagram with security boundaries in front
- `nested-boundaries.json`: 5-level nested structure

---

## Execution Priority

**P0 (Must Have)**:
- Tests 1.1, 1.2 (Containment)
- Tests 3.1, 3.3 (Circular prevention)
- Tests 4.1, 4.2 (Notifications)
- Tests 8.1, 8.2, 8.3 (Post-load validation)

**P1 (Should Have)**:
- Tests 2.1 (Multiple parents)
- Tests 5.1, 5.2 (Re-embedding)
- Tests 6.1 (Descendant depth)
- Tests 9.1, 9.2 (Undo/Redo)

**P2 (Nice to Have)**:
- Tests 7.1, 7.2 (Z-order restoration)
- Tests 10.1, 10.2, 10.3 (Edge cases)

---

## Success Criteria

All P0 and P1 tests must pass before considering the embedding feature complete. P2 tests are aspirational and can be implemented incrementally.
