# Complete X6 Integration Guide

This document consolidates all X6 graph library documentation, including integration patterns and API reference.

## Table of Contents

1. [Overview](#overview)
2. [Integration Architecture](#integration-architecture)
3. [Custom Shapes](#custom-shapes)
4. [Edge Routing](#edge-routing)
5. [Event Handling](#event-handling)
6. [Styling System](#styling-system)
7. [API Reference](#api-reference)
8. [Best Practices](#best-practices)

## Overview

AntV X6 is a graph editing engine that provides low-level capabilities for building graph editing applications. TMI-UX uses X6 version 2.x for its Data Flow Diagram (DFD) editor.

### Key Features Used

- Custom node shapes for DFD elements
- Manhattan routing for edges
- Built-in history management (undo/redo)
- Selection and keyboard shortcuts
- Port-based connections
- Embedding support for trust boundaries

## Integration Architecture

### Service Layers

1. **Infrastructure Layer** (`/infrastructure/adapters/`)
   - X6GraphAdapter - Main graph management
   - X6SelectionAdapter - Selection handling
   - X6HistoryManager - Undo/redo operations
   - X6KeyboardHandler - Keyboard shortcuts

2. **Domain Layer** (`/domain/value-objects/`)
   - NodeInfo, EdgeInfo - Domain models
   - Pure business logic, no X6 dependencies

3. **Application Layer** (`/services/`)
   - DfdNodeService, DfdEdgeService
   - Orchestrates domain and infrastructure

### Initialization Flow

```typescript
// 1. Create graph instance
const graph = new Graph({
  container: this.container.nativeElement,
  autoResize: true,
  grid: { size: 10, visible: true },
  connecting: { router: 'manhattan' },
  // ... other options
});

// 2. Register custom shapes
Graph.registerNode('dfd-process', {
  /* shape config */
});

// 3. Setup adapters
this.selectionAdapter = new X6SelectionAdapter(graph);
this.historyManager = new X6HistoryManager(logger);
```

## Custom Shapes

### Shape Registration

```typescript
Graph.registerNode('dfd-process', {
  inherit: 'rect',
  width: 120,
  height: 60,
  attrs: {
    body: {
      rx: 30,
      ry: 30,
      fill: '#E3F2FD',
      stroke: '#1976D2',
    },
    label: {
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
    },
  },
  ports: {
    groups: {
      in: { position: 'left' },
      out: { position: 'right' },
    },
  },
});
```

### Available DFD Shapes

- `dfd-process` - Rounded rectangle for processes
- `dfd-external-entity` - Rectangle for external entities
- `dfd-data-store` - Double-line rectangle for data stores
- `dfd-trust-boundary` - Dashed container for trust zones

## Edge Routing

### Manhattan Router Configuration

```typescript
connecting: {
  router: {
    name: 'manhattan',
    args: {
      padding: 20,
      excludeShapes: ['dfd-trust-boundary']
    }
  },
  connector: 'rounded',
  connectionPoint: 'boundary'
}
```

### Custom Edge Styles

```typescript
const edge = graph.addEdge({
  source: sourceId,
  target: targetId,
  attrs: {
    line: {
      stroke: '#333',
      strokeWidth: 2,
      targetMarker: {
        name: 'block',
        size: 8,
      },
    },
  },
});
```

## Event Handling

### Node Events

```typescript
graph.on('node:added', ({ node }) => {
  console.log('Node added:', node.id);
});

graph.on('node:moved', ({ node, position }) => {
  console.log('Node moved to:', position);
});

graph.on('node:removed', ({ node }) => {
  console.log('Node removed:', node.id);
});
```

### Edge Events

```typescript
graph.on('edge:connected', ({ edge }) => {
  console.log('Edge connected:', edge.getSourceCellId(), '->', edge.getTargetCellId());
});

graph.on('edge:removed', ({ edge }) => {
  console.log('Edge removed:', edge.id);
});
```

### Selection Events

```typescript
graph.on('selection:changed', ({ selected }) => {
  console.log('Selection changed:', selected);
});
```

## Styling System

### Node Styling

```typescript
node.setAttrs({
  body: {
    fill: isSelected ? '#BBDEFB' : '#E3F2FD',
    stroke: hasError ? '#F44336' : '#1976D2',
    strokeWidth: isSelected ? 2 : 1,
  },
});
```

### Edge Styling

```typescript
edge.setAttrs({
  line: {
    stroke: isHighlighted ? '#2196F3' : '#666',
    strokeDasharray: isBidirectional ? '5 5' : null,
  },
});
```

### Z-Order Management

```typescript
cell.toFront(); // Bring to front
cell.toBack(); // Send to back
cell.setZIndex(10); // Set specific z-index
```

## API Reference

### Graph Methods

#### Node Operations

- `addNode(metadata)` - Create new node
- `getCells()` - Get all cells
- `getNodes()` - Get all nodes
- `findNodeById(id)` - Find specific node
- `removeNode(node)` - Remove node

#### Edge Operations

- `addEdge(metadata)` - Create new edge
- `getEdges()` - Get all edges
- `getConnectedEdges(node)` - Get edges for node
- `removeEdge(edge)` - Remove edge

#### Selection

- `select(cells)` - Select cells
- `unselect(cells)` - Unselect cells
- `getSelectedCells()` - Get selection
- `cleanSelection()` - Clear selection

#### History

- `undo()` - Undo last operation
- `redo()` - Redo operation
- `canUndo()` - Check undo availability
- `canRedo()` - Check redo availability

#### View Operations

- `centerContent()` - Center graph content
- `fit()` - Fit content to viewport
- `zoom(factor)` - Zoom in/out
- `translate(x, y)` - Pan view

### Cell Methods

#### Common Methods

- `getProp(key)` - Get property
- `setProp(key, value)` - Set property
- `setAttrs(attrs)` - Update attributes
- `remove()` - Remove from graph

#### Node-Specific

- `getPortId(group)` - Get port ID
- `getPorts()` - Get all ports
- `setPosition(x, y)` - Move node
- `resize(width, height)` - Resize node

#### Edge-Specific

- `getSourceNode()` - Get source node
- `getTargetNode()` - Get target node
- `setSource(source)` - Update source
- `setTarget(target)` - Update target

## Best Practices

### 1. Performance

- Use `graph.freeze()` for bulk operations
- Batch updates with `graph.batchUpdate()`
- Limit real-time validation during drag
- Use virtual rendering for large graphs

### 2. State Management

- Keep domain state separate from X6
- Use events for state synchronization
- Implement proper cleanup in destructors

### 3. Error Handling

- Validate operations before execution
- Handle edge connection failures
- Provide user feedback for errors

### 4. Testing

- Mock X6 dependencies in unit tests
- Use real graph instances for integration
- Test event sequences thoroughly

### 5. Accessibility

- Add ARIA labels to nodes
- Implement keyboard navigation
- Provide screen reader descriptions

## Common Issues and Solutions

### Issue: Memory Leaks

**Solution:** Always dispose graph and clean event listeners

```typescript
ngOnDestroy() {
  this.graph.dispose();
  this.subscriptions.forEach(s => s.unsubscribe());
}
```

### Issue: Performance with Many Nodes

**Solution:** Use async rendering and viewport culling

```typescript
graph.use(
  new Scroller({
    enabled: true,
    pageVisible: true,
    pageBreak: true,
  }),
);
```

### Issue: Z-Order Problems

**Solution:** Explicitly manage z-indices

```typescript
trustBoundaries.forEach(tb => tb.toBack());
nodes.forEach(n => n.setZIndex(10));
edges.forEach(e => e.setZIndex(5));
```

## References

- [X6 Official Documentation](https://x6.antv.antgroup.com/)
- [X6 API Reference](https://x6.antv.antgroup.com/api/graph/graph)
- [X6 Examples](https://x6.antv.antgroup.com/examples)
- [TMI DFD Implementation](../src/app/pages/dfd/)
