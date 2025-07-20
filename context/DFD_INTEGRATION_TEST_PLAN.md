# DFD Integration Test Plan - Real X6 Graph Operations

## Overview

This document defines a comprehensive integration test plan for the DFD graph component that tests **real X6 graph operations** without mocking. The tests will create actual X6 graph instances, perform user-like interactions, and verify the actual state and styling of X6 cells to help debug complex styling and state issues.

## Testing Philosophy

### Real X6 Integration Testing
- **Use actual X6 Graph instances** - No mocking of X6 library
- **Test real user interactions** - Operations that mirror actual user behavior
- **Verify actual X6 cell properties** - Examine real SVG attributes, tools, and styling
- **Debug styling issues** - Specifically designed to catch visual state problems

### Coverage Strategy
- **Single-object operations** - Individual node/edge manipulations
- **Multi-object operations** - Bulk selections and operations
- **State verification** - Before/after comparisons of actual X6 cell attributes
- **History integration** - Undo/redo with styling verification
- **Dynamic styling verification** - Look up expected values from code/constants rather than hardcoding

## Test Structure

### Multiple Focused Test Files

Tests are organized into multiple focused files for better maintainability:

```typescript
// Integration test directory structure
src/app/pages/dfd/integration/
├── styling-constants.spec.ts           // Styling constants and helpers
├── node-creation-styling.spec.ts       // Node creation and visual effects
├── edge-creation-styling.spec.ts       // Edge creation and connections
├── selection-styling.spec.ts           // Selection effects and tools (CRITICAL)
├── history-styling.spec.ts             // Undo/redo with styling verification
├── ports-visibility.spec.ts            // Port management and visibility
├── z-order-embedding.spec.ts           // Z-order and embedding operations
├── tools-context-menu.spec.ts          // Interactive tools and context menu
└── keyboard-interactions.spec.ts       // Keyboard and mouse interactions
```

## Dynamic Styling Verification Approach

### Styling Constants Centralization

To avoid hardcoded styling values in tests, we need to centralize styling constants that can be referenced by both implementation code and tests.

#### Recommended Constants Structure

```typescript
// Location: src/app/pages/dfd/constants/styling-constants.ts
export const DFD_STYLING = {
  // Default stroke and fill
  DEFAULT_STROKE: '#000',
  DEFAULT_STROKE_WIDTH: 2,
  DEFAULT_FILL: '#ffffff',
  
  // Selection styling
  SELECTION: {
    STROKE_WIDTH: 3,
    GLOW_COLOR: 'rgba(255, 0, 0, 0.8)',
    GLOW_BLUR_RADIUS: 8,
    FILTER_TEMPLATE: (blur: number, color: string) => `drop-shadow(0 0 ${blur}px ${color})`,
  },
  
  // Hover effects
  HOVER: {
    GLOW_COLOR: 'rgba(255, 0, 0, 0.6)',
    GLOW_BLUR_RADIUS: 4,
  },
  
  // Creation effects
  CREATION: {
    GLOW_COLOR: 'rgba(0, 150, 255, 0.9)',
    GLOW_BLUR_RADIUS: 12,
    FADE_DURATION_MS: 1000,
  },
  
  // Node-specific styling
  NODES: {
    MIN_WIDTH: 40,
    MIN_HEIGHT: 30,
    DEFAULT_FONT: 'Roboto Condensed',
    DEFAULT_FONT_SIZE: 14,
    
    // Node type specific
    SECURITY_BOUNDARY: {
      STROKE_DASHARRAY: '5,5',
      DEFAULT_Z_INDEX: 1,
    },
    TEXT_BOX: {
      FILL: 'transparent',
    },
  },
  
  // Edge styling
  EDGES: {
    DEFAULT_LABEL: 'Flow',
    ARROWHEAD: 'block',
    CONNECTOR: 'smooth',
  },
  
  // Port styling
  PORTS: {
    RADIUS: 5,
    STROKE: '#000',
    FILL: '#ffffff',
    STROKE_WIDTH: 1,
  },
  
  // Z-order values
  Z_ORDER: {
    SECURITY_BOUNDARY_DEFAULT: 1,
    NODE_DEFAULT: 10,
    EDGE_OFFSET: 0, // Edges inherit from connected nodes
  },
} as const;

// Type-safe access to styling constants
export type DfdStyling = typeof DFD_STYLING;
```

#### Tool Configuration Constants

```typescript
// Location: src/app/pages/dfd/constants/tool-constants.ts
export const TOOL_CONFIG = {
  NODE_TOOLS: {
    BUTTON_REMOVE: {
      name: 'button-remove',
      args: { x: '100%', y: 0, offset: { x: -10, y: 10 } },
    },
    BOUNDARY: {
      name: 'boundary',
      args: { attrs: { fill: 'none', stroke: '#000', strokeDasharray: '2,4' } },
    },
  },
  
  EDGE_TOOLS: {
    SOURCE_ARROWHEAD: {
      name: 'source-arrowhead',
      args: { attrs: { fill: '#4C9AFF' } },
    },
    TARGET_ARROWHEAD: {
      name: 'target-arrowhead', 
      args: { attrs: { fill: '#FF7452' } },
    },
    BUTTON_REMOVE: {
      name: 'button-remove',
      args: { distance: '50%' },
    },
    VERTICES: {
      name: 'vertices',
    },
  },
} as const;
```

### Test Helper Utilities

```typescript
// Location: src/app/pages/dfd/integration/test-helpers/styling-helpers.ts
import { DFD_STYLING } from '../../constants/styling-constants';
import { Cell } from '@antv/x6';

export class StylingVerifier {
  /**
   * Verify default node styling matches constants
   */
  static verifyDefaultNodeStyling(cell: Cell, nodeType: string): void {
    expect(cell.attr('body/stroke')).toBe(DFD_STYLING.DEFAULT_STROKE);
    expect(cell.attr('body/strokeWidth')).toBe(DFD_STYLING.DEFAULT_STROKE_WIDTH);
    
    if (nodeType === 'text-box') {
      expect(cell.attr('body/fill')).toBe(DFD_STYLING.NODES.TEXT_BOX.FILL);
    } else {
      expect(cell.attr('body/fill')).toBe(DFD_STYLING.DEFAULT_FILL);
    }
  }
  
  /**
   * Verify selection styling matches constants
   */
  static verifySelectionStyling(cell: Cell, nodeType: string): void {
    const expectedFilter = DFD_STYLING.SELECTION.FILTER_TEMPLATE(
      DFD_STYLING.SELECTION.GLOW_BLUR_RADIUS,
      DFD_STYLING.SELECTION.GLOW_COLOR
    );
    
    if (nodeType === 'text-box') {
      expect(cell.attr('text/filter')).toBe(expectedFilter);
    } else {
      expect(cell.attr('body/filter')).toBe(expectedFilter);
      expect(cell.attr('body/strokeWidth')).toBe(DFD_STYLING.SELECTION.STROKE_WIDTH);
    }
  }
  
  /**
   * Verify cell has no visual effects (clean state)
   */
  static verifyCleanStyling(cell: Cell, nodeType: string): void {
    if (nodeType === 'text-box') {
      expect(cell.attr('text/filter')).toBeOneOf(['none', undefined, null]);
    } else {
      expect(cell.attr('body/filter')).toBeOneOf(['none', undefined, null]);
      expect(cell.attr('body/strokeWidth')).toBe(DFD_STYLING.DEFAULT_STROKE_WIDTH);
    }
    
    // Verify no tools
    expect(cell.hasTools()).toBe(false);
  }
  
  /**
   * Verify hover styling matches constants
   */
  static verifyHoverStyling(cell: Cell, nodeType: string): void {
    const expectedFilter = DFD_STYLING.HOVER.FILTER_TEMPLATE(
      DFD_STYLING.HOVER.GLOW_BLUR_RADIUS,
      DFD_STYLING.HOVER.GLOW_COLOR
    );
    
    const filterAttr = nodeType === 'text-box' ? 'text/filter' : 'body/filter';
    expect(cell.attr(filterAttr)).toBe(expectedFilter);
  }
  
  /**
   * Verify creation effect styling
   */
  static verifyCreationEffect(cell: Cell, nodeType: string, expectedOpacity: number): void {
    const expectedColor = DFD_STYLING.CREATION.GLOW_COLOR.replace('0.9', expectedOpacity.toString());
    const expectedFilter = DFD_STYLING.CREATION.FILTER_TEMPLATE(
      DFD_STYLING.CREATION.GLOW_BLUR_RADIUS,
      expectedColor
    );
    
    const filterAttr = nodeType === 'text-box' ? 'text/filter' : 'body/filter';
    expect(cell.attr(filterAttr)).toBe(expectedFilter);
  }
}
```

## Test Categories

### 1. Styling Constants and Helpers (`styling-constants.spec.ts`)

**Purpose**: Verify styling constants are correctly defined and test helper utilities work.

#### 1.1 Constants Validation
- **Test**: Verify all styling constants are defined and have correct types
- **Verification**: 
  - All required styling properties exist
  - Color values are valid CSS colors
  - Numeric values are within expected ranges
  - Template functions produce valid CSS

#### 1.2 Helper Utilities
- **Test**: Verify test helper functions work correctly
- **Verification**:
  - StylingVerifier methods correctly check expected vs actual values
  - Error messages are clear and helpful
  - Edge cases handled properly

### 2. Node Creation and Styling Tests (`node-creation-styling.spec.ts`)

**Purpose**: Verify that all node types are created with correct visual properties and that their X6 attributes match expectations.

#### 2.1 Single Node Creation
- **Test**: Create each node type (Actor, Process, Store, Security Boundary, Text Box)
- **Verification**: 
  - Node exists in X6 graph (`graph.getCells()`)
  - Correct shape registered (`cell.shape`)
  - **Dynamic styling verification**: `StylingVerifier.verifyDefaultNodeStyling(cell, nodeType)`
  - Z-index matches constants: `DFD_STYLING.Z_ORDER.NODE_DEFAULT` or `DFD_STYLING.Z_ORDER.SECURITY_BOUNDARY_DEFAULT`
  - Port configuration matches `DFD_STYLING.PORTS` constants

#### 2.2 Node Visual Creation Effect
- **Test**: Create node and verify creation highlight effect
- **Verification**:
  - Initial creation effect: `StylingVerifier.verifyCreationEffect(cell, nodeType, 0.9)`
  - Effect fades over `DFD_STYLING.CREATION.FADE_DURATION_MS`
  - Final clean state: `StylingVerifier.verifyCleanStyling(cell, nodeType)`

#### 2.3 Node Creation Position Algorithm
- **Test**: Create multiple nodes and verify positioning algorithm
- **Verification**:
  - Predictable layered positioning
  - No overlapping placements
  - Grid-aligned positions

### 3. Edge Creation and Connection Tests (`edge-creation-styling.spec.ts`)

**Purpose**: Verify edge creation, port connections, and edge styling.

#### 3.1 Basic Edge Creation
- **Test**: Create edges between different node types
- **Verification**:
  - Edge exists with correct source/target (`edge.getSource()`, `edge.getTarget()`)
  - Port connections are valid
  - **Dynamic styling**: Default edge attributes match `DFD_STYLING.EDGES` and `DFD_STYLING.DEFAULT_STROKE*` constants
  - Z-index inheritance follows `DFD_STYLING.Z_ORDER.EDGE_OFFSET` rules

#### 3.2 Edge Visual Effects
- **Test**: Create edge and verify creation highlight
- **Verification**:
  - Creation effect: `StylingVerifier.verifyCreationEffect(edge, 'edge', 0.9)`
  - Effect fades over `DFD_STYLING.CREATION.FADE_DURATION_MS`
  - Final clean state: `StylingVerifier.verifyCleanStyling(edge, 'edge')`

#### 3.3 Edge Tools and Reconnection
- **Test**: Select edge and test reconnection tools
- **Verification**:
  - Tools match `TOOL_CONFIG.EDGE_TOOLS` specifications
  - Successful reconnection updates source/target
  - Z-index recalculation follows constants

### 4. Selection and Visual Effects Tests (`selection-styling.spec.ts`) **🔥 CRITICAL**

**Purpose**: Verify selection mechanics and styling, including the critical issue of selection styling persistence after undo.

#### 4.1 Single Cell Selection
- **Test**: Select individual nodes and edges
- **Verification**:
  - **Dynamic selection styling**: `StylingVerifier.verifySelectionStyling(cell, nodeType)`
  - Tools match `TOOL_CONFIG.NODE_TOOLS` or `TOOL_CONFIG.EDGE_TOOLS`
  - Hover effects disabled during selection
  - Clean deselection: `StylingVerifier.verifyCleanStyling(cell, nodeType)`

#### 4.2 Multi-Selection Operations
- **Test**: Select multiple cells via rubberband or programmatic selection
- **Verification**:
  - All selected cells pass `StylingVerifier.verifySelectionStyling()`
  - Selection styling batched properly (no individual history entries)
  - Tools applied consistently across all selected cells

#### 4.3 **🚨 CRITICAL: Selection Styling and History Integration**
- **Test**: Select multiple cells, delete them, then undo
- **Verification Pattern**:
```typescript
// Before delete - verify selection state
selectedCells.forEach(cell => {
  StylingVerifier.verifySelectionStyling(cell, getNodeType(cell));
  expect(cell.hasTools()).toBe(true);
});

// Delete operation
adapter.deleteSelected();
expect(graph.getCells()).toHaveLength(0);

// Undo operation  
adapter.undo();
const restoredCells = graph.getCells();

// CRITICAL: Verify completely clean state after undo
restoredCells.forEach(cell => {
  StylingVerifier.verifyCleanStyling(cell, getNodeType(cell));
});

// Verify graph selection is empty
expect(graph.getSelectedCells()).toHaveLength(0);
```

### 5. History and Undo/Redo Tests (`history-styling.spec.ts`)

**Purpose**: Verify history filtering works correctly and styling doesn't pollute undo/redo.

#### 5.1 History Filtering Verification
- **Test**: Apply various styling changes and verify they don't enter history
- **Verification**:
  - Selection effects don't create history entries (monitor `graph.history.length`)
  - Hover effects don't create history entries
  - Tool changes don't create history entries
  - Only structural changes create history (position, size, labels)
  - Verify excluded attributes list matches implementation

#### 5.2 Complex Undo/Redo Scenarios
- **Test**: Complex operations with undo/redo and styling verification
- **Scenarios & Verification**:
  - Create node → select → delete → undo: `StylingVerifier.verifyCleanStyling()`
  - Move multiple selected nodes → undo: Position restored, no selection artifacts
  - Resize node while selected → undo: Size restored, clean styling
  - Change label while selected → undo: Label restored, no tools or selection effects

### 6. Port Visibility and Connection Tests (`ports-visibility.spec.ts`)

**Purpose**: Verify port management and visibility rules.

#### 6.1 Port Visibility States
- **Test**: Hover, drag, and connection scenarios
- **Verification**:
  - Ports invisible by default (`port.attr('circle/style')` contains `display: none`)
  - Ports visible on hover (style updated to visible)
  - All ports visible during edge creation
  - Connected ports remain visible
  - **Dynamic port styling**: Port attributes match `DFD_STYLING.PORTS` constants

#### 6.2 Port Connection Validation
- **Test**: Valid and invalid connection attempts using real X6 connection validation
- **Verification**:
  - Port-to-port connections succeed
  - Node-to-node connections rejected
  - Self-connections allowed on different ports
  - Multiple connections between same nodes allowed

### 7. Z-Order and Embedding Tests (`z-order-embedding.spec.ts`)

**Purpose**: Verify z-order management and node embedding with real X6 z-index values.

#### 7.1 Z-Order Rules
- **Test**: Create different node types and verify z-order
- **Verification**:
  - Security boundaries: `cell.getZIndex() === DFD_STYLING.Z_ORDER.SECURITY_BOUNDARY_DEFAULT`
  - Regular nodes: `cell.getZIndex() === DFD_STYLING.Z_ORDER.NODE_DEFAULT`
  - Edges inherit z-index correctly from connected nodes

#### 7.2 Node Embedding
- **Test**: Drag nodes into/out of parent nodes
- **Verification**:
  - Visual embedding effects (verify bluish tint attributes)
  - Z-index adjustments follow embedding rules
  - Cascading z-index updates for connected edges
  - **Dynamic verification**: All z-index values derived from constants

### 8. Tools and Context Menu Tests (`tools-context-menu.spec.ts`)

**Purpose**: Verify tools behavior and context menu operations with real tool instances.

#### 8.1 Node Tools
- **Test**: Select nodes and verify tools using real X6 tool objects
- **Verification**:
  - Tools match `TOOL_CONFIG.NODE_TOOLS` configuration exactly
  - Tool positioning and styling from constants
  - Tools trigger correct deletion behavior
  - Tool cleanup on deselection

#### 8.2 Edge Tools  
- **Test**: Select edges and verify tools
- **Verification**:
  - Tools match `TOOL_CONFIG.EDGE_TOOLS` specifications
  - Source/target arrowhead colors match constants
  - Button-remove positioning from constants
  - Vertices tool functionality

#### 8.3 Context Menu Operations
- **Test**: Right-click operations with real context menu interactions
- **Verification**:
  - Z-order manipulation updates actual `cell.getZIndex()`
  - Cell properties dialog shows real cell data
  - Label editing activates real X6 text editor

### 9. Keyboard and Interaction Tests (`keyboard-interactions.spec.ts`)

**Purpose**: Verify keyboard shortcuts and mouse interactions with real event handling.

#### 9.1 Keyboard Operations
- **Test**: Delete, navigation, and shortcuts with real KeyboardEvent simulation
- **Verification**:
  - Delete/Backspace removes selected cells (verify with `StylingVerifier.verifyCleanStyling()` after undo)
  - Keyboard events properly filtered for input fields
  - Focus management doesn't interfere with styling

#### 9.2 Mouse Interactions
- **Test**: Pan, zoom, selection operations with real mouse events
- **Verification**:
  - Shift+drag panning updates graph transform matrix
  - Shift+wheel zooming affects graph.zoom() value
  - Rubberband selection applies selection styling correctly
  - Blank click clears selection and restores clean styling

## Test Implementation Patterns

### Common Setup Pattern
```typescript
// Each test file follows this pattern
import { DFD_STYLING } from '../../constants/styling-constants';
import { TOOL_CONFIG } from '../../constants/tool-constants';
import { StylingVerifier } from '../test-helpers/styling-helpers';

describe('DFD Integration - Selection Styling', () => {
  let container: HTMLElement;
  let graph: Graph;
  let adapter: X6GraphAdapter;
  let selectionAdapter: X6SelectionAdapter;
  
  beforeEach(() => {
    // Create real DOM container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);
    
    // Initialize real services with minimal mocking
    const mockLogger = new MockLoggerService();
    const realServices = {
      edgeQueryService: new EdgeQueryService(mockLogger),
      nodeConfigService: new NodeConfigurationService(),
      // ... other real services
    };
    
    // Initialize real X6 graph with all adapters
    adapter = new X6GraphAdapter(mockLogger, ...realServices);
    selectionAdapter = new X6SelectionAdapter(mockLogger, /* real deps */);
    
    adapter.initialize(container);
    graph = adapter.getGraph();
  });
  
  afterEach(() => {
    adapter.dispose();
    document.body.removeChild(container);
  });
});
```

### Dynamic Styling Verification Pattern
```typescript
it('should restore deleted cells without selection styling', async () => {
  // Create and select multiple nodes using real node data
  const node1 = adapter.addNode(NodeData.create({
    id: 'node-1',
    type: 'actor',
    label: 'User',
    position: { x: 100, y: 100 },
    width: 120,
    height: 80,
  }));
  const node2 = adapter.addNode(NodeData.create({
    id: 'node-2', 
    type: 'process',
    label: 'Process',
    position: { x: 300, y: 100 },
    width: 120,
    height: 80,
  }));
  
  // Select both nodes
  graph.select([node1, node2]);
  
  // Verify selection styling using dynamic constants
  StylingVerifier.verifySelectionStyling(node1, 'actor');
  StylingVerifier.verifySelectionStyling(node2, 'process');
  
  // Verify tools are present
  expect(node1.hasTools()).toBe(true);
  expect(node2.hasTools()).toBe(true);
  
  // Delete selected cells
  adapter.deleteSelected();
  expect(graph.getCells()).toHaveLength(0);
  
  // Undo deletion
  adapter.undo();
  
  // CRITICAL: Verify restored cells have completely clean state
  const restoredCells = graph.getCells();
  expect(restoredCells).toHaveLength(2);
  
  // Use dynamic verification for clean state
  restoredCells.forEach(cell => {
    const nodeType = getNodeTypeFromCell(cell);
    StylingVerifier.verifyCleanStyling(cell, nodeType);
  });
  
  // Verify graph selection is empty
  expect(graph.getSelectedCells()).toHaveLength(0);
});
```

### Test Helper Utilities Pattern
```typescript
// Utility functions for common operations
function getNodeTypeFromCell(cell: Cell): string {
  return (cell as any).getNodeTypeInfo?.()?.type || 'process';
}

function createTestNodes(adapter: X6GraphAdapter, count: number): Cell[] {
  const nodes: Cell[] = [];
  const nodeTypes = ['actor', 'process', 'store', 'security-boundary', 'text-box'];
  
  for (let i = 0; i < count; i++) {
    const nodeType = nodeTypes[i % nodeTypes.length];
    const node = adapter.addNode(NodeData.create({
      id: `test-node-${i}`,
      type: nodeType as NodeType,
      label: `Test ${nodeType} ${i}`,
      position: { x: 100 + (i * 150), y: 100 },
      width: 120,
      height: 80,
    }));
    nodes.push(node);
  }
  
  return nodes;
}

async function waitForAnimationComplete(durationMs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, durationMs + 50));
}
```

### Constants Integration Example
```typescript
it('should apply creation effects with correct styling', async () => {
  const node = adapter.addNode(NodeData.create({...}));
  
  // Verify initial creation effect using constants
  StylingVerifier.verifyCreationEffect(node, 'actor', 0.9);
  
  // Wait for fade to complete
  await waitForAnimationComplete(DFD_STYLING.CREATION.FADE_DURATION_MS);
  
  // Verify clean final state
  StylingVerifier.verifyCleanStyling(node, 'actor');
});

it('should apply hover effects correctly', () => {
  const node = createTestNodes(adapter, 1)[0];
  
  // Simulate hover
  selectionAdapter.applyHoverEffect(node);
  
  // Verify hover styling matches constants
  StylingVerifier.verifyHoverStyling(node, 'actor');
  
  // Remove hover
  selectionAdapter.removeHoverEffect(node);
  
  // Verify clean state
  StylingVerifier.verifyCleanStyling(node, 'actor');
});
```

## Implementation Priority

### Phase 1: Foundation and Critical Issues (High Priority)
1. **`styling-constants.spec.ts`** - Establish constants and helper infrastructure
2. **`selection-styling.spec.ts`** - **🚨 CRITICAL: Selection styling and history integration**
3. **`history-styling.spec.ts`** - History filtering verification  
4. **`node-creation-styling.spec.ts`** - Basic node creation with dynamic verification

### Phase 2: Core Operations (Medium Priority)  
5. **`edge-creation-styling.spec.ts`** - Edge creation and connections
6. **`ports-visibility.spec.ts`** - Port management and visibility rules
7. **`keyboard-interactions.spec.ts`** - Delete operations and basic interactions

### Phase 3: Advanced Features (Lower Priority)
8. **`z-order-embedding.spec.ts`** - Z-order and embedding operations
9. **`tools-context-menu.spec.ts`** - Interactive tools and context menu

## Prerequisites for Implementation

### 1. Constants Infrastructure Setup
Before implementing tests, create the constants infrastructure:

```bash
# Create constants directory and files
mkdir -p src/app/pages/dfd/constants
mkdir -p src/app/pages/dfd/integration/test-helpers

# Files to create:
touch src/app/pages/dfd/constants/styling-constants.ts
touch src/app/pages/dfd/constants/tool-constants.ts  
touch src/app/pages/dfd/integration/test-helpers/styling-helpers.ts
```

### 2. Refactor Existing Code
Update existing adapters and services to use the new constants:

- **X6SelectionAdapter**: Import and use `DFD_STYLING.SELECTION.*` constants
- **Visual Effects Service**: Import and use `DFD_STYLING.CREATION.*` constants  
- **Tool Configuration**: Import and use `TOOL_CONFIG.*` constants
- **Node/Edge Creation**: Use styling constants for default attributes

### 3. Test Infrastructure
Set up the integration test directory and shared utilities.

## Success Criteria

### Technical Success
- ✅ **All tests pass consistently** with real X6 objects
- ✅ **No hardcoded styling values** - all verification uses constants
- ✅ **Comprehensive attribute coverage** - every visual property verified
- ✅ **Multiple focused test files** - maintainable and targeted

### Problem Detection Success
- 🎯 **Tests catch selection styling persistence after undo** (primary goal)
- 🎯 **Tests detect history pollution from visual effects**
- 🎯 **Tests verify correct tool state management**
- 🎯 **Tests catch styling regressions during development**

### Constants Integration Success
- ✅ **Dynamic styling verification** - no hardcoded values in tests
- ✅ **Single source of truth** - constants shared between implementation and tests
- ✅ **Type safety** - constants are strongly typed and compile-time checked
- ✅ **Maintainability** - styling changes only require constant updates

### Maintenance Success
- ✅ **Tests are maintainable and readable** with clear helper utilities
- ✅ **Clear patterns established** for adding new test scenarios
- ✅ **Integration with existing infrastructure** - follows established patterns
- ✅ **Proper resource management** - X6 graphs properly created and disposed

## Quality Standards

### Code Quality
- ✅ **Full TypeScript compliance** with strict typing
- ✅ **ESLint and Prettier conformance** 
- ✅ **Comprehensive error handling** for async operations
- ✅ **Proper async/await usage** for timing-sensitive tests (animations, effects)

### Test Quality  
- ✅ **Clear, descriptive test names** that explain the verification being performed
- ✅ **Comprehensive before/after state verification** using dynamic helpers
- ✅ **Realistic user interaction simulation** with real X6 events
- ✅ **Robust timing and synchronization** for visual effects and animations

### Constants Quality
- ✅ **Complete coverage** of all styling properties used in the application
- ✅ **Logical organization** - grouped by feature area (selection, hover, creation, etc.)
- ✅ **Template functions** for complex CSS generation (filters, etc.)
- ✅ **Type safety** with `as const` assertions and proper TypeScript types

## Expected Outcomes

This revised integration test plan will:

1. **Solve the core problem**: Catch and prevent selection styling persistence after undo operations
2. **Establish infrastructure**: Create reusable constants and verification helpers  
3. **Enable comprehensive testing**: Cover all visual aspects with dynamic verification
4. **Improve maintainability**: Centralize styling constants and eliminate hardcoded values
5. **Support future development**: Provide robust patterns for testing visual interactions

The focus on **dynamic styling verification** using constants will make the tests both more reliable and more maintainable, while the **multiple focused test files** approach will make the test suite easier to understand and extend.