# DFD Test Coverage Implementation Plan

## Overview

This document outlines the comprehensive test coverage implementation for the Data Flow Diagram (DFD) components, focusing on user-level operations and integration testing approaches.

## Testing Philosophy

### Integration Testing Approach

- **Use real service instances** instead of mocks to avoid duplicating logic
- **Mock only cross-cutting concerns** like LoggerService
- **Focus on user-level operations** as described in `DFD_GRAPH_INTERACTION.md`
- **Test actual behavior** rather than implementation details

### Technical Foundation

- **Framework**: Vitest with native syntax (no Jasmine/Jest)
- **Environment**: JSDOM for DOM simulation
- **X6 Library Support**: Custom SVG method mocking and shape registration handling
- **Code Quality**: Full lint compliance and build success required

## Progress Status

### ✅ Completed (9/33 tasks)

1. **X6GraphAdapter.spec.ts** - Complete test coverage (20 tests)
   - Node creation for all DFD types (Actor, Process, Store, Security Boundary, Text Box)
   - Edge creation with port connections and validation
   - Node movement, resizing, and graph navigation
   - Selection events and graph state management
   - Viewport transformations and content area calculations

2. **X6SelectionAdapter.spec.ts** - Complete test coverage (36 tests)
   - Individual cell selection with visual feedback (hover/selection effects)
   - Rubberband multi-selection and selection clearing on blank click
   - Selection tools (node tools, edge tools) and cell deletion via tools
   - Copy/paste functionality and alignment/distribution operations
   - Plugin initialization and configuration testing
   - Selection mode control and grouping operations

### 🔄 In Progress

3. **X6EmbeddingAdapter.spec.ts** - Node embedding tests
4. **X6ZOrderAdapter.spec.ts** - Z-order management tests

### 📋 Pending (24 tasks)

- X6PortManager.spec.ts (3 tasks)
- X6LabelEditorAdapter.spec.ts (2 tasks)
- X6KeyboardHandler.spec.ts (2 tasks)
- Service tests: PortStateManagerService, EdgeQueryService, SelectionService, EmbeddingService (8 tasks)
- Integration and documentation tasks (3 tasks)

## Technical Solutions Implemented

### X6 Library Testing Challenges

#### 1. JSDOM Environment Setup

```typescript
// Setup JSDOM environment for X6
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  pretendToBeVisual: true,
  resources: 'usable',
});

global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
```

#### 2. SVG Method Mocking

```typescript
const mockSVGElement = {
  getCTM: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
  getScreenCTM: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 })),
  createSVGMatrix: vi.fn(() => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    e: 0,
    f: 0,
    rotate: function (_angle: number) {
      return this;
    },
    translate: function (_x: number, _y: number) {
      return this;
    },
    scale: function (_factor: number) {
      return this;
    },
    inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  })),
};
```

#### 3. Shape Registration Conflict Prevention

```typescript
// Track registered shapes to prevent duplicate registration
const registeredShapes = new Set<string>();

export function registerCustomShapes(): void {
  if (!registeredShapes.has('store')) {
    registeredShapes.add('store');
    Shape.Rect.define({ shape: 'store' /* ... */ });
  }
  // ... other shapes
}
```

#### 4. MockLoggerService Implementation

```typescript
class MockLoggerService {
  debug = vi.fn();
  info = vi.fn();
  warn = vi.fn();
  error = vi.fn();
  debugComponent = vi.fn(); // Required by X6GraphAdapter
}
```

## Test Coverage Details

### X6GraphAdapter.spec.ts (20 tests)

#### Node Creation Tests (6 tests)

- ✅ Actor node with rectangular styling
- ✅ Process node with elliptical shape
- ✅ Store node with custom top/bottom borders
- ✅ Security Boundary with dashed borders
- ✅ Text Box with transparent background
- ✅ Z-order handling (security boundaries behind other nodes)

#### Edge Creation Tests (3 tests)

- ✅ Port-based edge connections
- ✅ Magnet validation for connections
- ✅ Custom labels and styling

#### Interaction Tests (11 tests)

- ✅ Node movement and positioning
- ✅ Resize events with proper data
- ✅ Pan and zoom operations (`zoomTo()` for absolute levels)
- ✅ Cell selection handling
- ✅ Graph state management and cleanup
- ✅ Content area calculations
- ✅ Viewport transformations (scale, rotate, translate)

### X6SelectionAdapter.spec.ts (36 tests)

#### Plugin Initialization Tests (3 tests)

- ✅ Selection and Transform plugin initialization
- ✅ Selection plugin configuration (enabled, multiple, rubberband, movable)
- ✅ Transform plugin configuration (resizing enabled, rotating disabled)

#### Individual Cell Selection Tests (7 tests)

- ✅ Hover effects for nodes (drop-shadow filter)
- ✅ Hover effects for text-box nodes (text element targeting)
- ✅ Hover effects for edges (line filter)
- ✅ Hover effect removal on mouse leave
- ✅ No hover effects on selected cells
- ✅ Selection effects (stronger drop-shadow, stroke width)
- ✅ Selection effect removal on deselection

#### Multi-Selection Tests (8 tests)

- ✅ Multi-selection via selection API
- ✅ Selection clearing on blank click
- ✅ Selection change event handling
- ✅ Selected nodes filtering (nodes only)
- ✅ Selected edges filtering (edges only)
- ✅ Select all cells functionality
- ✅ Programmatic selection clearing

#### Selection Tools Tests (6 tests)

- ✅ Node tools addition (button-remove, boundary)
- ✅ Edge tools addition (vertices, arrowheads, button-remove)
- ✅ Tools removal on deselection
- ✅ Button-remove tool with deletion callback
- ✅ Programmatic selected cell deletion
- ✅ Deletion handling with no selection

#### Copy/Paste Tests (4 tests)

- ✅ Copy selected cells using SelectionService
- ✅ Paste with SelectionService position calculation
- ✅ Paste handling with no cells
- ✅ Selection clearing and pasted cell selection

#### Alignment/Distribution Tests (5 tests)

- ✅ Node alignment using SelectionService calculations
- ✅ Node distribution using SelectionService calculations
- ✅ All alignment types support (left, center, right, top, middle, bottom)
- ✅ Both distribution directions (horizontal, vertical)

#### Grouping Tests (3 tests)

- ✅ Group creation with SelectionService logic
- ✅ Group validation failure handling
- ✅ Ungrouping with child removal

## Key Patterns Established

### 1. Integration Test Setup Pattern

```typescript
beforeEach(() => {
  // Create real service instances
  edgeQueryService = new EdgeQueryService(mockLogger);
  nodeConfigurationService = new NodeConfigurationService();
  embeddingService = new EmbeddingService(mockLogger);

  // Create adapter with real dependencies
  adapter = new X6GraphAdapter(
    mockLogger,
    edgeQueryService,
    nodeConfigurationService,
    // ... other real services
  );

  adapter.initialize(container);
});
```

### 2. Domain Object Creation Pattern

```typescript
// Use proper domain object constructors
const nodeData = NodeData.create({
  id: 'node-1',
  type: 'actor',
  label: 'User',
  position: { x: 100, y: 100 },
  width: 120,
  height: 80,
});
const diagramNode = new DiagramNode(nodeData);
```

### 3. X6 API Testing Pattern

```typescript
// Test X6 operations with proper error handling
const graph = adapter.getGraph();
graph.zoomTo(1.5); // Use absolute zoom
expect(graph.zoom()).toBe(1.5);

// Test transformations
const transform = graph.matrix();
expect(transform.e).toBe(50); // Translation X
expect(transform.f).toBe(30); // Translation Y
```

## Next Steps

### Immediate Priorities

1. **X6EmbeddingAdapter.spec.ts** - Node embedding, visual effects, hierarchy
2. **X6ZOrderAdapter.spec.ts** - Z-order manipulation, security boundary rules
3. **X6PortManager.spec.ts** - Port visibility and connection management

### Testing Strategy for Remaining Components

- Apply established integration testing patterns
- Reuse JSDOM and SVG mocking setup
- Focus on user-level operations from `DFD_GRAPH_INTERACTION.md`
- Maintain comprehensive coverage with real service dependencies

## Quality Standards

### Code Quality Requirements

- ✅ All tests must pass
- ✅ Full lint compliance (no unused variables/imports)
- ✅ Successful build with no errors
- ✅ Follow project coding standards (2-space indentation, single quotes, 100-char limit)

### Test Quality Requirements

- Focus on user-level operations, not implementation details
- Use real service instances for integration testing
- Comprehensive coverage of all major functionality
- Clear, descriptive test names and structure

## Success Metrics

- **Test Coverage**: 33 comprehensive test files covering all DFD adapters and services
- **Integration Quality**: Real service dependencies with minimal mocking
- **User Focus**: Tests align with actual user interactions
- **Maintainability**: Established patterns for consistent future development

This plan provides a roadmap for completing comprehensive test coverage of the DFD component system while maintaining high quality standards and focusing on real-world usage scenarios.
