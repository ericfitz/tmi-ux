# OpenAPI Schema Normalization for X6 Compatibility

## Executive Summary

This document provides prescriptive instructions for updating the TMI OpenAPI specification (`tmi-openapi.json`) to remove convenience properties and achieve full X6 graph library compatibility with minimal transformation overhead.

**Goal**: Align the OpenAPI schema exactly with AntV X6's native `toJSON()` format, eliminating the need for transformation between the frontend graph library and the API.

**Impact**: Breaking change for API consumers using `label` or `style` convenience properties on Node and Edge schemas.

---

## Background

### Current State

The OpenAPI specification currently includes "convenience properties" (`label`, `style`) on Node and Edge schemas that are **not part** of the X6 graph library's native format. These properties were intended to simplify API usage but create several problems:

1. **Transformation Overhead**: Frontend must transform between convenience format and X6 native format
2. **Ambiguity**: Unclear whether stored data should use convenience or native format
3. **Inconsistency**: Two ways to represent the same data (e.g., `label` vs `attrs.text.text`)
4. **Maintenance Burden**: Transformation logic must be maintained and tested

### Desired State

After this change:
- OpenAPI schema will match X6's native `toJSON()` format exactly
- No convenience properties on Cell, Node, or Edge schemas
- Minimal transformation between X6 graph and API payloads
- Single canonical representation for cell data

---

## Required Schema Changes

### 1. Cell Schema (Base)

**Location**: `components.schemas.Cell`

**Changes**:

1. **Update description** (line ~552):
   ```json
   // FROM:
   "description": "Base schema for all diagram cells (nodes and edges) fully compatible with AntV X6 graph library. This schema includes all X6 native properties plus convenience properties for easier integration. X6-specific properties like markup, tools, router, and connector are supported for advanced customization."

   // TO:
   "description": "Base schema for all diagram cells (nodes and edges) in AntV X6 native format. This schema matches X6's toJSON() output exactly, enabling zero-transformation persistence. X6-specific properties like markup, tools, router, and connector are fully supported."
   ```

**No property changes needed** - the base Cell schema doesn't have convenience properties.

---

### 2. Node Schema

**Location**: `components.schemas.Node`

**Changes**:

#### 2.1 Remove `label` Property

**Find and DELETE** (approximately lines 1040-1043):
```json
"label": {
  "type": "string",
  "description": "Convenience property: Simple text label that automatically creates appropriate attrs.text.text structure",
  "maxLength": 256
}
```

**Rationale**:
- `label` is not part of X6's native Node format
- Node labels must be set via `attrs.text.text` (X6 standard)
- Removes ambiguity about which property takes precedence

#### 2.2 Remove `style` Property

**Find and DELETE** (approximately lines 1044-1064):
```json
"style": {
  "type": "object",
  "description": "Convenience property: Simplified styling options that automatically create appropriate attrs structure",
  "properties": {
    "fill": {
      "type": "string",
      "description": "Background fill color",
      "maxLength": 32
    },
    "stroke": {
      "type": "string",
      "description": "Border/outline color",
      "maxLength": 32
    },
    "strokeWidth": {
      "type": "number",
      "description": "Border/outline width in pixels",
      "minimum": 0
    },
    "fontSize": {
      "type": "number",
      "description": "Text font size in pixels",
      "minimum": 1
    },
    "fontColor": {
      "type": "string",
      "description": "Text color",
      "maxLength": 32
    }
  }
}
```

**Rationale**:
- `style` object is not part of X6's native format
- All styling must be done via `attrs` object (X6 standard)
  - Body styling: `attrs.body.fill`, `attrs.body.stroke`, `attrs.body.strokeWidth`
  - Text styling: `attrs.text.fontSize`, `attrs.text.fill`
- X6 provides full control through `attrs`, making simplified `style` unnecessary

#### 2.3 Update `parent` Property Nullability

**Find** (approximately line ~1030):
```json
"parent": {
  "type": "string",
  "format": "uuid",
  "description": "ID of the parent cell for nested/grouped nodes (UUID)",
  "nullable": true,
  "maxLength": 36
}
```

**Verify** the following is present:
- `"nullable": true` must be set
- Type should be `"string"` (not an array with null)

**Rationale**:
- Prefer explicit `null` over `undefined` for optional parent relationships
- Clearer API contract
- Better JSON serialization

#### 2.4 Update Node Description

**Find** (line ~848 in allOf block):
```json
"description": "A diagram node representing an entity, process, store, or boundary. Fully compatible with X6 Node objects using X6's native toJSON/fromJSON format with position and size objects."
```

**Verify** - no changes needed, already correct.

#### 2.5 Update Node Example

**Find** the Node example (approximately lines 900-1000) and **verify**:

1. **Remove** any `label` or `style` properties if present
2. **Ensure** text is set via `attrs.text.text`:
   ```json
   "attrs": {
     "body": {
       "fill": "#ffffff",
       "stroke": "#000000",
       "strokeWidth": 2
     },
     "text": {
       "text": "Process Data",  // ← Label set here, not via 'label' property
       "fontSize": 14,
       "fill": "#000000"
     }
   }
   ```

---

### 3. Edge Schema

**Location**: `components.schemas.Edge`

**Changes**:

#### 3.1 Remove `label` Property

**Find and DELETE** (approximately lines 1200-1203):
```json
"label": {
  "type": "string",
  "description": "Convenience property: Simple text label that automatically creates appropriate attrs.text.text structure",
  "maxLength": 256
}
```

**Rationale**:
- Edge labels in X6 are set via the `labels` array property
- Each label is an `EdgeLabel` object with full positioning and styling control
- Simple text labels should use: `labels: [{ attrs: { text: { text: "My Label" } } }]`

#### 3.2 Remove `style` Property

**Find and DELETE** (approximately lines 1204-1224):
```json
"style": {
  "type": "object",
  "description": "Convenience property: Simplified styling options that automatically create appropriate attrs structure",
  "properties": {
    "stroke": {
      "type": "string",
      "description": "Line color",
      "maxLength": 32
    },
    "strokeWidth": {
      "type": "number",
      "description": "Line width in pixels",
      "minimum": 0
    },
    "strokeDasharray": {
      "type": "string",
      "description": "Line dash pattern (e.g., '5 5' for dashed)",
      "maxLength": 64
    },
    "fontSize": {
      "type": "number",
      "description": "Label font size in pixels",
      "minimum": 1
    },
    "fontColor": {
      "type": "string",
      "description": "Label text color",
      "maxLength": 32
    }
  }
}
```

**Rationale**:
- Edge styling must be done via `attrs` object (X6 standard)
  - Line styling: `attrs.line.stroke`, `attrs.line.strokeWidth`, `attrs.line.strokeDasharray`
  - Label styling: via `labels[].attrs.text.*`
- X6 provides full control through attrs, making simplified `style` unnecessary

#### 3.3 Update Edge Description

**Find** (line ~848):
```json
"description": "A diagram edge representing a connection or data flow between nodes. Fully compatible with X6 Edge objects and supports X6 routing algorithms (manhattan, orth, oneSide, metro, er), connector styles (normal, rounded, smooth, jumpover), custom markup, tools, and convenience properties (label, style) for easier integration."
```

**Change TO**:
```json
"description": "A diagram edge representing a connection or data flow between nodes in X6 native format. Fully compatible with X6 Edge objects and supports X6 routing algorithms (manhattan, orth, oneSide, metro, er), connector styles (normal, rounded, smooth, jumpover), custom markup, and tools."
```

**Rationale**: Remove mention of "convenience properties"

#### 3.4 Update Edge Example

**Find** the Edge example (approximately lines 1100-1200) and **verify**:

1. **Remove** any `label` or `style` properties if present
2. **Ensure** labels are set via `labels` array:
   ```json
   "attrs": {
     "line": {
       "stroke": "#808080",
       "strokeWidth": 1,
       "targetMarker": {
         "name": "classic",
         "size": 8
       }
     }
   },
   "labels": [
     {
       "attrs": {
         "text": {
           "text": "Data Flow",  // ← Label set here
           "fontSize": 12,
           "fill": "#333333"
         }
       },
       "position": 0.5
     }
   ]
   ```

---

## Migration Path (If Needed)

### Backend Transformation Layer (Optional)

If you want to provide backward compatibility for external API consumers:

1. **Accept** both formats in requests:
   - New format: X6 native (`attrs.text.text`, `attrs.body.*`)
   - Legacy format: Convenience properties (`label`, `style`)

2. **Transform** on input:
   - If `label` is present, copy to `attrs.text.text` and remove `label`
   - If `style` is present, transform to `attrs` and remove `style`

3. **Always return** X6 native format in responses

### Example Transformation (Pseudocode)

```python
def normalize_node(node_data):
    """Transform convenience properties to X6 native format"""

    # Handle label convenience property
    if 'label' in node_data:
        if 'attrs' not in node_data:
            node_data['attrs'] = {}
        if 'text' not in node_data['attrs']:
            node_data['attrs']['text'] = {}
        node_data['attrs']['text']['text'] = node_data['label']
        del node_data['label']

    # Handle style convenience property
    if 'style' in node_data:
        style = node_data['style']
        if 'attrs' not in node_data:
            node_data['attrs'] = {}

        # Map style.fill, stroke, strokeWidth to attrs.body
        if 'body' not in node_data['attrs']:
            node_data['attrs']['body'] = {}
        if 'fill' in style:
            node_data['attrs']['body']['fill'] = style['fill']
        if 'stroke' in style:
            node_data['attrs']['body']['stroke'] = style['stroke']
        if 'strokeWidth' in style:
            node_data['attrs']['body']['strokeWidth'] = style['strokeWidth']

        # Map style.fontSize, fontColor to attrs.text
        if 'text' not in node_data['attrs']:
            node_data['attrs']['text'] = {}
        if 'fontSize' in style:
            node_data['attrs']['text']['fontSize'] = style['fontSize']
        if 'fontColor' in style:
            node_data['attrs']['text']['fill'] = style['fontColor']

        del node_data['style']

    return node_data
```

---

## Validation

After making these changes, verify:

1. **Schema validates**: Run OpenAPI schema validation tools
2. **Examples match schema**: All examples should validate against the schema
3. **No `label` or `style` properties remain**: Search for these terms in Node/Edge schemas
4. **X6 compatibility**: Compare against X6's TypeScript definitions for Node/Edge

### Quick Verification Checklist

- [ ] Search entire schema for `"Convenience property"` - should return 0 results in Cell/Node/Edge
- [ ] Node schema has NO `label` property
- [ ] Node schema has NO `style` property
- [ ] Edge schema has NO `label` property
- [ ] Edge schema has NO `style` property
- [ ] All examples use `attrs.text.text` instead of `label`
- [ ] All examples use `attrs.body.*` and `attrs.line.*` instead of `style`
- [ ] `parent` property has `"nullable": true`

---

## Impact Assessment

### Breaking Changes

**Who is affected**:
- External API consumers who use `label` or `style` properties
- Any API clients that haven't been updated to X6 native format

**What breaks**:
- Requests with `label` property will be rejected (or ignored, depending on validation)
- Requests with `style` property will be rejected (or ignored)
- API consumers expecting `label`/`style` in responses will get only `attrs`

### Non-Breaking (Frontend)

**Who is NOT affected**:
- TMI-UX frontend application (already uses X6 native format internally)
- Stored diagram data (already in X6 format)
- WebSocket messages (already use X6 format per AsyncAPI spec)

---

## Timeline Recommendation

1. **Schema Update**: 1 day
   - Update OpenAPI spec
   - Update any code generation
   - Update API documentation

2. **Backend Changes**: 1-2 days (if transformation layer needed)
   - Implement transformation for backward compatibility
   - Add tests

3. **Testing**: 1 day
   - Validate schema
   - Test API endpoints
   - Integration testing with frontend

4. **Deployment**:
   - If no backward compatibility: Deploy with frontend simultaneously
   - If backward compatibility: Can deploy independently

---

## Questions for Backend Team

1. **Backward Compatibility**: Do we need to support `label`/`style` for a deprecation period?
2. **Validation**: Should requests with `label`/`style` be rejected (400) or silently ignored?
3. **API Version**: Should this be a new API version (v2) or update existing version?
4. **Documentation**: Where should we document the migration guide for external consumers?

---

## References

- **X6 Node Documentation**: https://x6.antv.antgroup.com/en/docs/api/model/node
- **X6 Edge Documentation**: https://x6.antv.antgroup.com/en/docs/api/model/edge
- **X6 Attrs Documentation**: https://x6.antv.antgroup.com/en/docs/api/registry/attr
- **Current OpenAPI Spec**: `docs-server/reference/apis/tmi-openapi.json`
- **Frontend X6 Types**: `src/app/pages/dfd/domain/value-objects/x6-types.ts`

---

## Contact

For questions about this change:
- **Frontend Impact**: [Your Team]
- **X6 Integration**: See `docs/reference/architecture/overview.md`
- **Cell Format**: See `src/app/pages/dfd/domain/value-objects/` for X6 native structure examples
