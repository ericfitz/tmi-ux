# DFD Component - Comprehensive Browser-Based Integration Test Plan

## Overview

This document defines a comprehensive, realistic browser-based integration test plan for the DFD component that tests actual user workflows and browser behaviors. The plan prioritizes catching the critical selection styling persistence issue while providing complete coverage of all DFD features.

## Testing Philosophy

### Browser-First Integration Testing
- **Real browser environments** - Test in actual browsers (Cypress)
- **Actual user interactions** - Mouse clicks, drags, keyboard input
- **Real DOM verification** - Inspect actual SVG elements and CSS properties
- **Performance monitoring** - Measure actual browser performance
- **Visual regression detection** - Catch styling and visual issues

### Comprehensive Feature Coverage
- **Complete user workflows** - End-to-end diagram creation scenarios
- **Edge cases and error conditions** - Handle failures gracefully
- **Cross-browser compatibility** - Works in all supported browsers
- **Responsive behavior** - Canvas resizing and mobile support
- **Integration points** - Collaboration, export, persistence

## Critical Issues Priority

### 🚨 **Priority 1: Selection Styling Persistence Bug**
**Issue**: After undo operations, restored cells retain selection styling (glow effects, tools)
**Impact**: Major UX issue affecting diagram editing workflow
**Test Focus**: Verify clean state restoration after undo/redo operations

### 🔥 **Priority 2: Visual Effects State Management**
**Issue**: Visual effects may accumulate or persist across operations
**Impact**: Inconsistent user interface, performance degradation
**Test Focus**: State transitions maintain correct styling throughout complex workflows

### ⚡ **Priority 3: History System Integration**
**Issue**: Visual effects may pollute undo/redo history
**Impact**: Incorrect history behavior, unnecessary undo entries
**Test Focus**: History contains only structural changes, not visual effects

## Test Structure

### Cypress Integration Test Organization

```
cypress/e2e/dfd/
├── critical/
│   ├── selection-styling-persistence.cy.ts    // 🚨 CRITICAL BUG
│   ├── visual-effects-consistency.cy.ts       // Visual state management
│   └── history-system-integrity.cy.ts         // History filtering
├── core-features/
│   ├── node-creation-workflows.cy.ts          // Node creation and styling
│   ├── edge-creation-connections.cy.ts        // Edge creation and validation
│   ├── drag-drop-operations.cy.ts             // Movement and positioning
│   └── port-management.cy.ts                  // Port visibility and connections
├── user-workflows/
│   ├── complete-diagram-creation.cy.ts        // End-to-end workflows
│   ├── context-menu-operations.cy.ts          // Right-click operations
│   ├── keyboard-interactions.cy.ts            // Keyboard shortcuts
│   └── multi-user-collaboration.cy.ts         // Real-time collaboration
├── advanced-features/
│   ├── z-order-embedding.cy.ts                // Layer management
│   ├── export-functionality.cy.ts             // Export to various formats
│   ├── label-editing.cy.ts                    // In-place text editing
│   └── performance-testing.cy.ts              // Large diagram performance
└── browser-specific/
    ├── responsive-behavior.cy.ts              // Window resize, zoom, pan
    ├── cross-browser-compatibility.cy.ts      // Browser-specific behaviors
    └── accessibility-testing.cy.ts            // Keyboard navigation, a11y
```

## Critical Test Scenarios

### 1. Selection Styling Persistence (🚨 HIGHEST PRIORITY)

#### 1.1 Single Cell Selection-Delete-Undo
```typescript
describe('Selection Styling Persistence Bug', () => {
  it('should restore deleted nodes without selection styling', () => {
    // Create node
    cy.dfdCreateNode('actor', { x: 100, y: 100 });
    cy.dfdGetNode('actor').should('be.visible');
    
    // Select node and verify selection styling
    cy.dfdSelectNode('actor');
    cy.dfdVerifySelectionStyling('actor', true);
    cy.dfdVerifyTools('actor', ['button-remove', 'boundary']);
    
    // Delete selected node
    cy.dfdDeleteSelected();
    cy.dfdGetNodes().should('have.length', 0);
    
    // Undo deletion - CRITICAL VERIFICATION
    cy.dfdUndo();
    cy.dfdGetNodes().should('have.length', 1);
    
    // VERIFY: No selection styling artifacts
    cy.dfdVerifySelectionStyling('actor', false);
    cy.dfdVerifyTools('actor', []);
    cy.dfdVerifyCleanState('actor');
    
    // VERIFY: Graph selection is empty
    cy.dfdGetSelectedCells().should('have.length', 0);
  });
});
```

#### 1.2 Multi-Cell Selection Persistence
```typescript
it('should restore multiple deleted cells without selection styling', () => {
  // Create multiple nodes of different types
  cy.dfdCreateNode('actor', { x: 100, y: 100 });
  cy.dfdCreateNode('process', { x: 300, y: 100 });
  cy.dfdCreateNode('store', { x: 500, y: 100 });
  
  // Select all nodes
  cy.dfdSelectAll();
  cy.dfdGetSelectedCells().should('have.length', 3);
  
  // Verify selection styling on all
  cy.dfdVerifySelectionStyling('actor', true);
  cy.dfdVerifySelectionStyling('process', true);
  cy.dfdVerifySelectionStyling('store', true);
  
  // Delete all selected
  cy.dfdDeleteSelected();
  cy.dfdGetNodes().should('have.length', 0);
  
  // Undo deletion
  cy.dfdUndo();
  cy.dfdGetNodes().should('have.length', 3);
  
  // CRITICAL: All restored nodes should have clean state
  cy.dfdVerifyCleanState('actor');
  cy.dfdVerifyCleanState('process');
  cy.dfdVerifyCleanState('store');
  cy.dfdGetSelectedCells().should('have.length', 0);
});
```

### 2. Visual Effects State Management

#### 2.1 Creation Effects Lifecycle
```typescript
describe('Visual Effects Consistency', () => {
  it('should properly manage creation effect lifecycle', () => {
    // Create node and verify creation effect
    cy.dfdCreateNode('process', { x: 200, y: 200 });
    cy.dfdVerifyCreationEffect('process', true);
    
    // Wait for fade-out animation
    cy.wait(1000); // Based on DFD_STYLING.CREATION.FADE_DURATION_MS
    
    // Verify clean state after animation
    cy.dfdVerifyCreationEffect('process', false);
    cy.dfdVerifyCleanState('process');
  });
});
```

#### 2.2 Hover Effects During Complex Operations
```typescript
it('should manage hover effects during selection operations', () => {
  cy.dfdCreateNode('actor', { x: 100, y: 100 });
  
  // Test hover effect
  cy.dfdHoverNode('actor');
  cy.dfdVerifyHoverEffect('actor', true);
  
  // Select node (should disable hover)
  cy.dfdSelectNode('actor');
  cy.dfdVerifyHoverEffect('actor', false);
  cy.dfdVerifySelectionStyling('actor', true);
  
  // Deselect and verify hover works again
  cy.dfdClearSelection();
  cy.dfdHoverNode('actor');
  cy.dfdVerifyHoverEffect('actor', true);
});
```

### 3. Complete User Workflows

#### 3.1 Full Diagram Creation Scenario
```typescript
describe('Complete User Workflows', () => {
  it('should handle realistic diagram creation workflow', () => {
    // Create external entity (actor)
    cy.dfdCreateNode('actor', { x: 50, y: 200 }, 'User');
    
    // Create process
    cy.dfdCreateNode('process', { x: 300, y: 200 }, 'Login Process');
    
    // Create data store
    cy.dfdCreateNode('store', { x: 550, y: 200 }, 'User Database');
    
    // Create connections
    cy.dfdCreateEdge('User', 'Login Process', 'Login Request');
    cy.dfdCreateEdge('Login Process', 'User Database', 'Validate User');
    cy.dfdCreateEdge('User Database', 'Login Process', 'User Data');
    cy.dfdCreateEdge('Login Process', 'User', 'Login Response');
    
    // Verify diagram structure
    cy.dfdGetNodes().should('have.length', 3);
    cy.dfdGetEdges().should('have.length', 4);
    
    // Test selection and manipulation
    cy.dfdSelectNode('Login Process');
    cy.dfdMoveNode('Login Process', { x: 400, y: 250 });
    
    // Verify connections maintained
    cy.dfdVerifyConnections('Login Process', 4);
    
    // Test undo/redo
    cy.dfdUndo(); // Undo move
    cy.dfdVerifyNodePosition('Login Process', { x: 300, y: 200 });
    cy.dfdRedo(); // Redo move
    cy.dfdVerifyNodePosition('Login Process', { x: 400, y: 250 });
    
    // Verify clean state throughout
    cy.dfdVerifyAllNodesCleanState();
  });
});
```

#### 3.2 Security Boundary and Embedding
```typescript
it('should handle security boundary creation and embedding', () => {
  // Create security boundary
  cy.dfdCreateNode('security-boundary', { x: 100, y: 100 }, 'Trusted Zone');
  cy.dfdResizeNode('Trusted Zone', { width: 400, height: 300 });
  
  // Create nodes inside boundary
  cy.dfdCreateNode('process', { x: 200, y: 200 }, 'Internal Process');
  cy.dfdCreateNode('store', { x: 350, y: 200 }, 'Internal Data');
  
  // Drag to embed
  cy.dfdDragToEmbed('Internal Process', 'Trusted Zone');
  cy.dfdDragToEmbed('Internal Data', 'Trusted Zone');
  
  // Verify embedding effects
  cy.dfdVerifyEmbedding('Internal Process', 'Trusted Zone');
  cy.dfdVerifyEmbedding('Internal Data', 'Trusted Zone');
  
  // Verify z-order
  cy.dfdVerifyZOrder('Trusted Zone', 1);
  cy.dfdVerifyZOrder('Internal Process', 10);
  cy.dfdVerifyZOrder('Internal Data', 10);
});
```

### 4. Port Management and Connection Validation

#### 4.1 Port Visibility States
```typescript
describe('Port Management', () => {
  it('should manage port visibility correctly', () => {
    cy.dfdCreateNode('process', { x: 200, y: 200 });
    
    // Ports hidden by default
    cy.dfdVerifyPortsVisible('process', false);
    
    // Hover shows ports
    cy.dfdHoverNode('process');
    cy.dfdVerifyPortsVisible('process', true);
    
    // Start edge creation - all ports visible
    cy.dfdStartEdgeCreation('process');
    cy.dfdVerifyAllPortsVisible(true);
    
    // Cancel edge creation - ports hidden again
    cy.dfdCancelEdgeCreation();
    cy.dfdVerifyAllPortsVisible(false);
  });
});
```

#### 4.2 DFD Connection Rules
```typescript
it('should enforce DFD connection validation rules', () => {
  cy.dfdCreateNode('actor', { x: 100, y: 100 }, 'User');
  cy.dfdCreateNode('store', { x: 300, y: 100 }, 'Database');
  
  // Invalid: Actor cannot connect directly to Store
  cy.dfdAttemptConnection('User', 'Database')
    .should('be.rejected');
  
  // Add process for valid connection
  cy.dfdCreateNode('process', { x: 200, y: 100 }, 'Handler');
  
  // Valid: Actor → Process → Store
  cy.dfdCreateEdge('User', 'Handler', 'Request');
  cy.dfdCreateEdge('Handler', 'Database', 'Query');
  
  // Verify connections exist
  cy.dfdVerifyConnection('User', 'Handler', true);
  cy.dfdVerifyConnection('Handler', 'Database', true);
  cy.dfdVerifyConnection('User', 'Database', false);
});
```

### 5. Performance and Browser-Specific Testing

#### 5.1 Large Diagram Performance
```typescript
describe('Performance Testing', () => {
  it('should handle large diagrams without performance degradation', () => {
    // Create 50 nodes and 100 edges
    cy.dfdCreateLargeDiagram(50, 100);
    
    // Measure performance
    cy.dfdMeasurePerformance(() => {
      cy.dfdSelectAll();
      cy.dfdMoveSelection({ x: 50, y: 50 });
      cy.dfdClearSelection();
    }).should('be.lessThan', 1000); // < 1 second
    
    // Verify no memory leaks
    cy.dfdCheckMemoryUsage().should('be.stable');
  });
});
```

#### 5.2 Responsive Canvas Behavior
```typescript
describe('Browser-Specific Behavior', () => {
  it('should handle window resize appropriately', () => {
    cy.dfdCreateNode('process', { x: 400, y: 300 });
    
    // Resize window
    cy.viewport(1200, 800);
    cy.dfdVerifyCanvasSize(1200, 800);
    
    // Verify node still visible and interactive
    cy.dfdVerifyNodeVisible('process');
    cy.dfdSelectNode('process');
    cy.dfdVerifySelectionStyling('process', true);
    
    // Resize to smaller window
    cy.viewport(800, 600);
    cy.dfdVerifyCanvasSize(800, 600);
    cy.dfdVerifyNodeVisible('process');
  });
  
  it('should handle zoom and pan operations', () => {
    cy.dfdCreateNode('actor', { x: 200, y: 200 });
    
    // Test zoom
    cy.dfdZoom(1.5);
    cy.dfdVerifyZoomLevel(1.5);
    cy.dfdVerifyNodeVisible('actor');
    
    // Test pan
    cy.dfdPan({ x: 100, y: 50 });
    cy.dfdVerifyPanOffset({ x: 100, y: 50 });
    
    // Node should still be selectable
    cy.dfdSelectNode('actor');
    cy.dfdVerifySelectionStyling('actor', true);
  });
});
```

### 6. Collaboration and Real-Time Features

#### 6.1 Multi-User Collaboration
```typescript
describe('Collaboration Features', () => {
  it('should handle multi-user editing scenarios', () => {
    // Simulate second user connection
    cy.dfdSimulateUserJoin('user2');
    cy.dfdVerifyUserPresence('user2', true);
    
    // User 1 creates node
    cy.dfdCreateNode('process', { x: 200, y: 200 }, 'Shared Process');
    
    // Verify user 2 sees the node
    cy.dfdVerifyNodeExistsForUser('Shared Process', 'user2');
    
    // User 2 modifies node
    cy.dfdSimulateUserAction('user2', 'moveNode', {
      nodeId: 'Shared Process',
      position: { x: 300, y: 200 }
    });
    
    // Verify user 1 sees the change
    cy.dfdVerifyNodePosition('Shared Process', { x: 300, y: 200 });
    
    // Test conflict resolution
    cy.dfdSimulateConcurrentEdit('Shared Process');
    cy.dfdVerifyConflictResolution();
  });
});
```

### 7. Export and Data Persistence

#### 7.1 Export Functionality
```typescript
describe('Export and Persistence', () => {
  it('should export diagrams in multiple formats', () => {
    // Create sample diagram
    cy.dfdCreateSampleDiagram();
    
    // Test SVG export
    cy.dfdExportDiagram('svg')
      .should('contain', '<svg')
      .should('contain', 'actor')
      .should('contain', 'process');
    
    // Test PNG export
    cy.dfdExportDiagram('png')
      .should('have.property', 'type', 'image/png');
    
    // Test JPEG export
    cy.dfdExportDiagram('jpeg')
      .should('have.property', 'type', 'image/jpeg');
  });
});
```

## Custom Cypress Commands

### Node Operations
```typescript
// cypress/support/dfd-commands.ts
declare global {
  namespace Cypress {
    interface Chainable {
      dfdCreateNode(type: string, position: {x: number, y: number}, label?: string): Chainable<Element>
      dfdSelectNode(identifier: string): Chainable<Element>
      dfdVerifySelectionStyling(identifier: string, isSelected: boolean): Chainable<Element>
      dfdVerifyCleanState(identifier: string): Chainable<Element>
      dfdDeleteSelected(): Chainable<Element>
      dfdUndo(): Chainable<Element>
      dfdRedo(): Chainable<Element>
    }
  }
}

Cypress.Commands.add('dfdCreateNode', (type, position, label = '') => {
  cy.get(`[data-testid="toolbar-${type}"]`).click();
  cy.get('[data-testid="dfd-canvas"]').click(position.x, position.y);
  if (label) {
    cy.get('[data-testid="node-label-input"]').type(label).type('{enter}');
  }
});

Cypress.Commands.add('dfdVerifySelectionStyling', (identifier, isSelected) => {
  const selector = `[data-node-id="${identifier}"]`;
  if (isSelected) {
    cy.get(selector).should('have.css', 'filter').and('contain', 'drop-shadow');
    cy.get(selector).find('.x6-tool').should('exist');
  } else {
    cy.get(selector).should('have.css', 'filter', 'none');
    cy.get(selector).find('.x6-tool').should('not.exist');
  }
});
```

### Visual Verification
```typescript
Cypress.Commands.add('dfdVerifyCleanState', (identifier) => {
  const selector = `[data-node-id="${identifier}"]`;
  
  // No visual effects
  cy.get(selector).should('have.css', 'filter', 'none');
  
  // No tools
  cy.get(selector).find('.x6-tool').should('not.exist');
  
  // Default styling
  cy.get(selector).find('path, rect, ellipse')
    .should('have.css', 'stroke-width', '2px');
});

Cypress.Commands.add('dfdVerifyCreationEffect', (identifier, hasEffect) => {
  const selector = `[data-node-id="${identifier}"]`;
  if (hasEffect) {
    cy.get(selector).should('have.css', 'filter').and('contain', 'drop-shadow');
    cy.get(selector).should('have.css', 'filter').and('contain', 'rgba(0, 150, 255');
  } else {
    cy.get(selector).should('have.css', 'filter', 'none');
  }
});
```

## Success Criteria

### Critical Issue Resolution
- ✅ **Selection styling persistence eliminated** - No selection artifacts after undo
- ✅ **Visual effects state management** - Clean state transitions
- ✅ **History system integrity** - Only structural changes in history

### Feature Coverage
- ✅ **Complete workflow testing** - End-to-end diagram creation
- ✅ **All node and edge types** - Comprehensive type coverage
- ✅ **User interaction patterns** - Realistic user scenarios
- ✅ **Performance validation** - Large diagrams handle smoothly

### Browser Integration
- ✅ **Real DOM verification** - Actual SVG and CSS inspection
- ✅ **Cross-browser compatibility** - Works in all supported browsers
- ✅ **Responsive behavior** - Canvas adaptation to viewport changes
- ✅ **Performance monitoring** - Real browser performance metrics

### Quality Standards
- ✅ **Maintainable test code** - Clear, reusable custom commands
- ✅ **Comprehensive error coverage** - Edge cases and error conditions
- ✅ **Visual regression detection** - Catch styling changes
- ✅ **CI/CD integration** - Automated test execution

## Implementation Priority

### Phase 1: Critical Issues (Week 1)
1. **Selection styling persistence tests** - Address the primary bug
2. **Visual effects state management** - Ensure clean state transitions
3. **Basic Cypress command infrastructure** - Foundation for other tests

### Phase 2: Core Features (Week 2)
1. **Node/edge creation workflows** - Fundamental functionality
2. **History system integration** - Undo/redo behavior
3. **Port management and connections** - Connection validation

### Phase 3: Advanced Features (Week 3)
1. **Complete user workflows** - End-to-end scenarios
2. **Performance testing** - Large diagram handling
3. **Browser-specific behaviors** - Responsive design, zoom/pan

### Phase 4: Collaboration and Integration (Week 4)
1. **Multi-user collaboration** - Real-time features
2. **Export functionality** - File format support
3. **Cross-browser compatibility** - Comprehensive browser testing

This comprehensive test plan focuses on realistic browser-based scenarios that will catch the critical selection styling persistence issue while providing complete coverage of the DFD component's sophisticated feature set. The emphasis on actual browser testing with Cypress ensures that tests reflect real user experiences and catch issues that unit tests might miss.