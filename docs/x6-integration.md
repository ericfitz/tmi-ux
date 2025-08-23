# X6 Graph Library Integration

The TMI (Threat Modeling Improved) application is fully integrated with the AntV X6 graph library, providing powerful diagramming capabilities with modern web standards.

## Overview

This integration enables:
- **Full X6 Compatibility**: TMI domain objects map directly to X6 cell objects
- **Advanced Customization**: Support for custom shapes, routing algorithms, and interactive tools
- **Type Safety**: Complete TypeScript support for all X6 properties
- **Convenience APIs**: Simplified properties alongside native X6 configuration
- **Backwards Compatibility**: All existing TMI diagrams continue to work

## Supported X6 Features

### Node Features

#### Custom Markup
Define custom SVG/HTML shapes for advanced visual customization:

```json
{
  "id": "custom-process",
  "shape": "process",
  "markup": [
    {
      "tagName": "ellipse",
      "selector": "body",
      "attrs": {
        "fill": "#ffffff",
        "stroke": "#000000",
        "strokeWidth": 2
      }
    },
    {
      "tagName": "text",
      "selector": "label",
      "attrs": {
        "fontSize": 14,
        "fill": "#000000",
        "textAnchor": "middle"
      }
    }
  ]
}
```

#### Interactive Tools
Add interactive elements for user manipulation:

```json
{
  "tools": [
    {
      "name": "boundary",
      "args": { "distance": 20 }
    },
    {
      "name": "button",
      "args": { "x": 10, "y": 10, "width": 20, "height": 20 }
    }
  ]
}
```

### Edge Features

#### Routing Algorithms
Support for multiple path calculation algorithms:

- **manhattan**: Grid-aligned routing with right angles
- **orth**: Orthogonal routing with automatic obstacle avoidance
- **oneSide**: Single-side orthogonal routing for clean layouts
- **metro**: Metro-style routing for professional diagrams
- **er**: Entity-relationship diagram style routing
- **normal**: Direct straight-line connections

```json
{
  "router": {
    "name": "manhattan",
    "args": {
      "padding": 20,
      "step": 10,
      "directions": ["top", "right", "bottom", "left"]
    }
  }
}
```

#### Connector Styles
Visual styling options for edge connections:

- **normal**: Standard straight connections
- **rounded**: Rounded corners at connection points
- **smooth**: Smooth curved transitions
- **jumpover**: Jump-over style for crossing edges

```json
{
  "connector": {
    "name": "rounded",
    "args": {
      "radius": 10
    }
  }
}
```

#### Default Labels
Consistent labeling configuration:

```json
{
  "defaultLabel": {
    "position": 0.5,
    "attrs": {
      "text": {
        "fontSize": 12,
        "fill": "#333333",
        "fontFamily": "Arial, sans-serif"
      },
      "rect": {
        "fill": "#ffffff",
        "stroke": "#cccccc",
        "strokeWidth": 1
      }
    }
  }
}
```

## Convenience Properties

### Simplified Styling
Use convenience properties for common styling needs:

```json
{
  "style": {
    "fill": "#ff0000",
    "stroke": "#000000",
    "strokeWidth": 2,
    "fontSize": 14,
    "fontColor": "#333333"
  }
}
```

### Position and Size Objects
Use object notation for easier positioning:

```json
{
  "position": { "x": 100, "y": 150 },
  "size": { "width": 120, "height": 60 }
}
```

### Simple Labels
Use string labels that automatically create proper attrs structure:

```json
{
  "label": "Process Name"
}
```

## TypeScript Integration

### Domain Objects
All TMI domain objects support X6 properties:

```typescript
import { NodeInfo, EdgeInfo } from './domain/value-objects';

// Create node with X6 properties
const nodeInfo = NodeInfo.fromJSON({
  id: 'process-1',
  shape: 'process',
  x: 100, y: 100, width: 120, height: 60,
  label: 'Data Processing',
  markup: [/* custom markup */],
  tools: [{ name: 'boundary' }],
  style: { fill: '#e6f3ff', stroke: '#0066cc' }
});

// Create edge with routing
const edgeInfo = EdgeInfo.fromJSON({
  id: 'edge-1',
  source: { cell: 'process-1', port: 'out' },
  target: { cell: 'process-2', port: 'in' },
  router: 'manhattan',
  connector: 'rounded',
  label: 'Data Flow'
});
```

### X6 Type Definitions
Complete TypeScript definitions for all X6 properties:

```typescript
import { MarkupElement, CellTool, EdgeRouter, EdgeConnector } from './x6-types';

// Type-safe markup definition
const markup: MarkupElement[] = [
  {
    tagName: 'rect',
    selector: 'body',
    attrs: { fill: '#ffffff' }
  }
];

// Type-safe router configuration
const router: EdgeRouter = {
  name: 'manhattan',
  args: { padding: 10, step: 20 }
};
```

## Validation

### OpenAPI Schema Validation
All X6 properties are validated against OpenAPI schemas:

- **MarkupElement**: SVG/HTML structure validation
- **CellTool**: Tool configuration validation
- **EdgeRouter**: Routing algorithm and parameter validation
- **EdgeConnector**: Connector style and parameter validation

### Runtime Validation
Domain objects validate X6 properties during construction:

```typescript
// This will validate router configuration
const edgeInfo = EdgeInfo.fromJSON({
  router: {
    name: 'manhattan', // Must be valid router name
    args: { padding: 10 } // Must match router requirements
  }
});
```

## Migration Guide

### Existing Diagrams
All existing TMI diagrams are fully compatible. No migration is required.

### Adding X6 Features
Add X6 properties progressively:

1. **Start Simple**: Use convenience properties (label, style, position)
2. **Add Routing**: Configure edge routing for better layouts
3. **Custom Shapes**: Use markup for advanced visual customization
4. **Interactive Tools**: Add tools for enhanced user interaction

### Best Practices

1. **Use Convenience Properties**: Start with simple label and style properties
2. **Progressive Enhancement**: Add X6 features as needed
3. **Type Safety**: Leverage TypeScript for compile-time validation
4. **Test Thoroughly**: Validate X6 configurations with your use cases
5. **Performance**: Be mindful of complex markup and tool configurations

## Examples

### Complete Node Example
```json
{
  "id": "advanced-process",
  "shape": "process",
  "x": 200,
  "y": 150,
  "width": 140,
  "height": 80,
  "label": "Advanced Process",
  "style": {
    "fill": "#e6f3ff",
    "stroke": "#0066cc",
    "strokeWidth": 2,
    "fontSize": 14,
    "fontColor": "#003d7a"
  },
  "markup": [
    {
      "tagName": "rect",
      "selector": "body",
      "attrs": {
        "rx": 10,
        "ry": 10
      }
    },
    {
      "tagName": "text",
      "selector": "label"
    }
  ],
  "tools": [
    {
      "name": "boundary",
      "args": { "distance": 15 }
    }
  ]
}
```

### Complete Edge Example
```json
{
  "id": "advanced-edge",
  "source": { "cell": "process-1", "port": "out" },
  "target": { "cell": "process-2", "port": "in" },
  "label": "Secure Data Flow",
  "style": {
    "stroke": "#0066cc",
    "strokeWidth": 2,
    "fontSize": 12,
    "fontColor": "#003d7a"
  },
  "router": {
    "name": "manhattan",
    "args": {
      "padding": 20,
      "step": 15
    }
  },
  "connector": {
    "name": "rounded",
    "args": {
      "radius": 8
    }
  },
  "tools": [
    {
      "name": "vertices",
      "args": { "distance": 30 }
    }
  ]
}
```

## Resources

- [AntV X6 Documentation](https://x6.antv.vision/en/)
- [TMI OpenAPI Schema](../shared-api/api-specs/tmi-openapi.json)
- [X6 Type Definitions](../src/app/pages/dfd/domain/value-objects/x6-types.ts)
- [Domain Object Tests](../src/app/pages/dfd/domain/value-objects/node-info.spec.ts)