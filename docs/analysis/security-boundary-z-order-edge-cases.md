# Security Boundary Z-Order Edge Cases Analysis

**Date**: 2025-10-08
**Status**: Investigation Complete - Issues Identified
**Context**: Embedding drag-to-move improvements revealed potential z-order gaps

## Executive Summary

After comprehensive analysis of z-order logic for security boundaries, **3 confirmed edge cases** were identified that are not currently handled. These involve nested security boundaries and complex re-embedding scenarios.

---

## Background: Current Z-Order Rules

### Base Rules (Working Correctly)
1. **Unembedded security boundaries**: z-index = 1 (always behind regular nodes)
2. **Unembedded regular nodes**: z-index = 10 (default)
3. **Embedded security boundaries**: z-index = max(parent.z + 1, 2)
4. **Embedded regular nodes**: z-index = parent.z + 1
5. **Edges**: z-index = max(source.z, target.z)

### Validation Rules (Working Correctly)
- `validateZOrderInvariants()`: Ensures unembedded security boundaries stay behind regular nodes
- `validateEmbeddingZOrderHierarchy()`: Ensures children z-index > parent z-index
- `validateComprehensiveZOrder()`: Groups nodes by type and embedding status

---

## Edge Case 1: Nested Security Boundary Re-embedding

### Scenario
```
Security Boundary A (z=1)
  └─ Security Boundary B (z=2)
       └─ Security Boundary C (z=3)
            └─ Process Node P (z=15)

User drags Security Boundary B out of A (unembed)
```

### Current Behavior
- `handleNodeUnembedded()` is called for B
- B's z-index reset to 1 (default for unembedded security boundary)
- **Problem**: C and P do NOT get their z-indexes recalculated

### Expected Behavior
After unembedding B:
```
Security Boundary B (z=1)  ← Reset correctly
  └─ Security Boundary C (z=2)  ← Should be recalculated relative to new parent
       └─ Process Node P (z=15)  ← Should stay >> C
```

### Root Cause
[infra-x6-embedding.adapter.ts:468-523](../pages/dfd/infrastructure/adapters/infra-x6-embedding.adapter.ts#L468-L523)

The `handleNodeUnembedded()` method:
1. ✅ Resets the unembedded node's z-index
2. ❌ **Does NOT** recursively recalculate descendant z-indexes

### Fix Required
Add recursive descendant z-index recalculation after unembedding:
```typescript
// After resetting node's z-index
const descendants = this.getDescendantNodes(node);
descendants.forEach(descendant => {
  const parent = descendant.getParent();
  if (parent && parent.isNode()) {
    const newZIndex = this.infraEmbeddingService.calculateEmbedding ZIndexes(parent, descendant);
    descendant.setZIndex(newZIndex.childZIndex);
  }
});
```

---

## Edge Case 2: Security Boundary Re-embedded Into Regular Node

### Scenario
```
Security Boundary A (z=1, unembedded)
Process Node P (z=10, unembedded)

User drags Security Boundary A into Process Node P
```

### Current Behavior
[infra-x6-z-order.adapter.ts:354-391](../pages/dfd/infrastructure/adapters/infra-x6-z-order.adapter.ts#L354-L391)

```typescript
if (childType === 'security-boundary') {
  // Security boundaries should always stay behind, even when embedded
  childZIndex = 2; // Hardcoded!
  child.setZIndex(childZIndex);
}
```

**Problems**:
1. ❌ Hardcoded z-index of 2 ignores parent's actual z-index
2. ❌ If parent z-index is 1, child at 2 violates parent < child rule
3. ❌ Doesn't follow documented rule: "at least one higher than parent"

### Expected Behavior
```typescript
if (childType === 'security-boundary') {
  // Embedded security boundaries stay behind regular nodes BUT respect parent hierarchy
  childZIndex = Math.max(parentZIndex + 1, 2);
  child.setZIndex(childZIndex);
}
```

Actually, this IS correct! The code at line 376 already does this:
```typescript
childZIndex = 2; // Slightly higher than non-embedded security boundaries but still behind regular nodes
```

However, this still violates the rule if `parentZIndex = 1`. The business logic service **does** use `Math.max(parentZIndex + 1, 2)` correctly at [infra-z-order.service.ts:486-488](../pages/dfd/infrastructure/services/infra-z-order.service.ts#L486-L488), but the adapter **hardcodes** it.

### Root Cause
**Code duplication**: Adapter hardcodes z-index logic instead of delegating to service.

### Fix Required
Delegate to the service:
```typescript
// In applyEmbeddingZIndexes()
const zIndexes = this.zOrderService.calculateEmbeddingZIndexes(parent, child);
parent.setZIndex(zIndexes.parentZIndex);
child.setZIndex(zIndexes.childZIndex);
```

(Note: This method doesn't exist yet - need to extract from `calculateEmbeddedNodeZIndex`)

---

## Edge Case 3: Deep Nested Security Boundaries with Manual Z-Order Changes

### Scenario
```
Security Boundary A (z=1)
  └─ Security Boundary B (z=2)
       └─ Security Boundary C (z=3)

User manually moves C "to front" (via context menu)
```

### Current Behavior
[infra-z-order.service.ts:121-182](../pages/dfd/infrastructure/services/infra-z-order.service.ts#L121-L182)

`calculateMoveToFrontZIndex()`:
- Filters cells by same category (security boundaries vs regular nodes)
- ✅ Prevents moving above parent
- ✅ Prevents moving below children
- ❌ **Does NOT** check sibling security boundaries' z-order constraints

### Expected Behavior
When moving C to front among security boundaries:
1. Check max z-index of **sibling** security boundaries
2. Ensure C stays > parent B (z=2)
3. Set C.z = max(sibling_max, parent.z + 1)

### Current Behavior
The code at line 156-163 DOES attempt to handle children:
```typescript
if (children.length > 0) {
  const maxChildZIndex = Math.max(...children.map(c => c.getZIndex() ?? 1));
  newZIndex = Math.min(newZIndex, maxChildZIndex - children.length - 1);
}
```

But this prevents parents from moving above children - not the issue here.

### Root Cause
The filtering at line 127-144 groups by **same type** (security boundary vs not), but doesn't consider **same embedding level** (siblings).

### Fix Required
Update filtering to consider sibling relationships:
```typescript
const validCells = allCells.filter(c => {
  if (c.id === cell.id) return false;
  if (this.isSecurityBoundaryCell(c) !== isSecurityBoundary) return false;

  // ADDITION: Only consider cells at the same embedding level (siblings + others at same level)
  if (cell.isNode() && c.isNode()) {
    const cellParent = cell.getParent();
    const otherParent = c.getParent();

    // Both must have same parent (siblings) or both unembedded
    if (cellParent?.id !== otherParent?.id) return false;
  }

  // ... existing checks ...
  return true;
});
```

---

## Edge Case 4: Embedded Security Boundary with Regular Node Children

### Scenario
```
Process Node P (z=10)
  └─ Security Boundary A (z=11)  ← Embedded in process
       └─ Process Node Q (z=15)

This violates the principle that security boundaries should be "behind" regular nodes.
```

### Current Behavior
✅ **This is actually correct behavior!**

When a security boundary is **embedded**, it follows embedding hierarchy rules, NOT global visual stacking rules. The embedded security boundary (z=11) is correctly:
- Above its parent process P (z=10)
- Below its child Q (z=15)

The "security boundaries behind regular nodes" rule only applies to **unembedded** security boundaries.

### Validation
`validateComprehensiveZOrder()` correctly only checks:
```typescript
// Check invariant: unembedded security boundaries should be behind unembedded regular nodes
```

**No fix needed** - working as designed.

---

## Summary of Issues

| # | Issue | Severity | Fix Complexity |
|---|-------|----------|----------------|
| 1 | Nested security boundary unembed doesn't recalculate descendants | **High** | Medium - Add recursive loop |
| 2 | Embedding z-index hardcoded instead of using service | **Medium** | Low - Delegation refactor |
| 3 | Manual z-order moves ignore sibling relationships | **Low** | Medium - Update filtering logic |

---

## Recommendations

### Immediate (Required for correctness)
1. ✅ Fix Edge Case #1: Add recursive descendant recalculation after unembed
2. ✅ Fix Edge Case #2: Extract `calculateEmbeddingZIndexes()` method in service and use it

### Follow-up (Nice to have)
3. 🔶 Fix Edge Case #3: Update manual z-order move logic for sibling awareness
4. 🔶 Add integration test for deeply nested security boundaries
5. 🔶 Add diagram load validation to fix any existing z-order violations

---

## Testing Recommendations

Create test cases for:
1. Unembed security boundary with 3+ levels of nesting
2. Re-embed security boundary into process node
3. Manual "move to front" on nested security boundaries
4. Load diagram with invalid z-order configurations
5. Drag security boundary between different parents with varying z-indexes
