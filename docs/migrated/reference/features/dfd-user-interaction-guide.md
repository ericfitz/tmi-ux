# DFD Graph User Interaction Guide

This document describes the complete user experience for interacting with the DFD (Data Flow Diagram) graph component, including all gestures, actions, visual feedback, and behavioral rules.

## Design Philosophy

- **X6-First**: Prefer using AntV X6 native capabilities over custom implementations
- **Visual Clarity**: Use X6 native styling over CSS when possible; avoid `!important` except for debugging
- **Consistent Styling**: Default stroke color #000, weight 2px, white/transparent fill
- **Single Font**: Roboto Condensed for all text in the graph

## Node Creation and Management

### Creating Nodes

Users create nodes by clicking toolbar buttons. Each node type has specific characteristics:

| Node Type             | Shape                 | Default Styling                                    | Usage                              |
| --------------------- | --------------------- | -------------------------------------------------- | ---------------------------------- |
| **Actor**             | Rectangle             | Black stroke (2px), white fill                     | External entities (users, systems) |
| **Process**           | Ellipse               | Black stroke (2px), white fill                     | Data transformation operations     |
| **Store**             | Custom rectangle      | Top/bottom borders only (2px)                      | Data storage (databases, files)    |
| **Security Boundary** | Dashed rectangle      | Black dashed stroke (2px, 5-5 pattern), white fill | Trust boundaries, zones            |
| **Text Box**          | Transparent rectangle | Transparent stroke and fill                        | Annotations, labels                |

**Behavior**:

- Click toolbar button → node appears on canvas at algorithmically determined position
- Default labels applied based on node type
- Minimum size: 40×30 pixels, no maximum
- Command pattern integration for undo/redo support

### Moving Nodes

Users move nodes by **click-and-drag**:

1. Click on node to select (node highlights with red glow)
2. Drag to new position
3. Release to drop
4. **Snap lines** appear during drag to help align with other nodes
5. Grid snapping enabled (10px grid)

**Visual Feedback During Drag**:

- Selected node shows stronger red glow (drop-shadow filter)
- Snap lines (red, 1px) show alignment with other nodes
- No traditional selection box shown

### Resizing Nodes

Users resize nodes via **selection handles**:

1. Click node to select
2. **Resize handles** appear at corners and midpoints
3. Drag handles to resize
4. Minimum size enforced (40×30 pixels)
5. Optional: Preserve aspect ratio (not default)

**Visual Feedback**:

- Dashed boundary appears around selected node (X6 Boundary tool)
- Resize handles are visible only when node is selected

### Deleting Nodes

Three methods:

1. **Button tool**: Click "X" button in top-right corner of selected node
2. **Keyboard**: Press Delete or Backspace after selecting
3. **Context menu**: Right-click → Delete

**Behavior**:

- All connected edges are automatically deleted
- Operation is undoable

### Node Tools (Appear on Selection)

When a node is selected, X6 tools automatically appear:

- **Button-remove**: Small "X" button in top-right corner (deletes node)
- **Boundary**: Dashed border indicating selection (not a traditional selection box)
- **Transform**: Resize handles at corners/midpoints (when enabled)

Tools disappear when node is deselected.

## Node Embedding and Nesting

### Embedding Behavior

Nodes can be embedded (nested) into other nodes by dragging:

**Visual Feedback During Drag**:

1. Drag node over potential parent
2. When bbox overlaps sufficiently (X6's `'bbox'` mode, ~50%+ overlap):
   - **Parent shows orange border** (3px stroke, #ff6b00, 4px padding)
   - Orange border indicates valid embedding target
3. Release mouse to complete embedding

**After Embedding**:

- Child node's fill color changes to bluish tint based on nesting depth:
  - Depth 1: #F0F2FF (very light bluish)
  - Depth 2: #E0E5FF (slightly darker)
  - Depth 3+: Progressively darker (up to #C8D0FF)
- Child node gets opacity reduction (0.9 at depth 1, 0.8 at depth 2, etc.)
- Z-index adjusted: child always has z-index > parent

### Embedding Rules

| Scenario                              | Allowed? | Visual Feedback                      | Notification                                                              |
| ------------------------------------- | -------- | ------------------------------------ | ------------------------------------------------------------------------- |
| Process → Security Boundary           | ✅ Yes   | Orange border on boundary            | None                                                                      |
| Security Boundary → Security Boundary | ✅ Yes   | Orange border                        | None                                                                      |
| Process → Process                     | ✅ Yes   | Orange border                        | None                                                                      |
| Text Box → Any                        | ❌ No    | No orange border                     | "Text boxes cannot be embedded"                                           |
| Any → Text Box                        | ❌ No    | No orange border                     | "Cannot embed into text boxes"                                            |
| Security Boundary → Process           | ❌ No    | No orange border                     | "Security boundaries can only be embedded into other security boundaries" |
| Circular (A→B→A)                      | ❌ No    | No orange border, red flash on child | "Circular embedding is not allowed"                                       |

**Invalid Embedding Feedback**:

- No orange border appears during drag
- On drop attempt: dragged node flashes **red border** (3px, #ff0000) for 300ms
- Notification toast appears explaining why embedding failed
- Node returns to original position or remains unembedded

### Re-embedding

Users can move an embedded node from one parent to another:

1. Drag embedded node out of current parent
2. Drag over new parent
3. New parent shows orange border when overlap is sufficient
4. Release to re-embed

**Behavior**:

- Node is removed from old parent, added to new parent (atomic operation)
- Z-index recalculated relative to new parent
- Fill color updated based on new depth
- All descendants (if any) have depths recalculated
- Single history entry (not separate unembed + embed)

### Unembedding

Users can unembed a node (remove it from parent):

1. Drag embedded node completely outside parent bounds
2. Orange border disappears from parent
3. Release to unembed

**After Unembedding**:

- Node's fill color returns to default (white)
- Opacity returns to 1.0
- Z-index reset based on node type:
  - Security boundaries → z=1
  - Regular nodes → z=10
- All descendants (if any) have z-indexes recalculated

## Z-Order (Layering)

### Z-Order Hierarchy

Z-order determines which elements appear in front or behind:

| Element Type                   | Default Z-Index         | Behavior                            |
| ------------------------------ | ----------------------- | ----------------------------------- |
| Security Boundary (unembedded) | 1                       | Always behind regular nodes         |
| Regular Nodes (unembedded)     | 10                      | Default layer                       |
| Embedded Security Boundary     | parent.z + 1 (min 2)    | Above parent, but follows hierarchy |
| Embedded Regular Node          | parent.z + 1            | Always above parent                 |
| Edge                           | max(source.z, target.z) | Matches highest connected node      |
| Text Box                       | 20                      | Always in front                     |

### Z-Order Rules

**On Embedding**:

- Child z-index = parent z-index + 1
- All edges connected to child are updated: edge.z = max(source.z, target.z)
- Cascades recursively to all descendants

**On Unembedding**:

- Security boundaries reset to z=1
- Regular nodes reset to z=10
- All descendants' z-indexes recalculated relative to new parent hierarchy
- Connected edges updated

**On Edge Connection/Reconnection**:

- Edge z-index = max(source node z, target node z)
- Ensures edge appears at same layer as nodes

**Manual Z-Order Changes**:
Users can adjust z-order via context menu:

- **Move Forward**: Increase z-index by 1 (move one layer up)
- **Move Backward**: Decrease z-index by 1 (move one layer down)
- **Move to Front**: Set z-index to maximum in category
- **Move to Back**: Set z-index to minimum in category

Manual changes respect:

- Category boundaries (security boundaries can't move above regular nodes)
- Embedding hierarchy (can't move above children or below parent)
- Sibling relationships (moves within same embedding level)

## Edge Creation and Management

### Creating Edges

Users create edges by **drag-and-drop between ports**:

1. **Hover over source node** → ports appear (4 ports: top, right, bottom, left)
2. **Click and drag from a port** → all ports on all nodes become visible
3. **Temporary edge line** follows mouse cursor
4. **Drop on target port** → edge is created
5. All ports return to normal visibility (hidden unless connected)

**Port Styling**:

- Small circles (5px radius)
- Black stroke (#000), white fill (#FFF)
- Normally invisible
- Visible when:
  - Mouse hovers over node
  - Port has a connected edge (always visible)
  - User is creating an edge (all ports visible)

**Visual Feedback**:

- Source port: Highlight when dragging starts
- Valid target ports: **Green highlight** (#31D06E) when edge can connect
- Magnetized: When edge snaps to port, **blue highlight** (#1890ff)
- Invalid targets: No highlight

### Edge Styling

Default styling:

- **Stroke**: Black (#000), 2px width
- **Connector**: Smooth (curved paths)
- **Router**: Normal
- **Arrowhead**: Block style, black fill
- **Label**: "Flow" (positioned at midpoint)
- **Dual-path markup**:
  - **Wrap path**: Transparent, 10px width (for click target)
  - **Line path**: Visible, 2px width (actual line)

### Edge Connection Rules

X6 enforces port-to-port connections:

- `allowNode: false` - Cannot connect to node directly
- `allowPort: true` - Must connect to ports
- `allowBlank: false` - Cannot start from blank canvas
- `allowLoop: true` - Self-connections allowed (different ports)
- `allowMulti: true` - Multiple edges between same nodes allowed
- `allowEdge: false` - Cannot connect to edges

**Snap Behavior**:

- When dragging near a port (within 20px), edge snaps to port
- Blue circle appears at port to indicate snap

### Edge Tools (Appear on Selection)

When an edge is selected, X6 tools appear:

- **Source arrowhead**: Small blue circle at source end (drag to reconnect source)
- **Target arrowhead**: Small orange circle at target end (drag to reconnect target)
- **Button-remove**: Small red "X" button (deletes edge)
- **Vertices**: Click anywhere on edge to add vertex (bend point)

**Vertex Management**:

- Click on edge stroke → adds vertex at click point
- Drag vertex to reposition
- Drag vertex onto another vertex → removes dragged vertex
- Vertices allow precise edge routing

## Selection and Highlighting

### Selection Methods

**Single Selection**:

- Click on node or edge → selects it
- Previous selection is cleared
- Visual feedback: Red glow (drop-shadow filter)

**Multiple Selection**:

- **Rubberband**: Click and drag on blank canvas → draws selection rectangle
- All cells within rectangle are selected
- Visual feedback: All selected cells show red glow

**Clear Selection**:

- Click on blank canvas area → clears all selection
- Visual feedback removed from all cells

### Visual Feedback Hierarchy

| State                  | Visual Effect      | Stroke Width | Filter                                                 |
| ---------------------- | ------------------ | ------------ | ------------------------------------------------------ |
| **Default**            | None               | 2px          | none                                                   |
| **Hover** (unselected) | Subtle red glow    | 2px          | drop-shadow(0 0 4px rgba(255,0,0,0.6))                 |
| **Selected**           | Strong red glow    | 2px          | drop-shadow(0 0 8px rgba(255,0,0,0.8))                 |
| **Creating**           | Blue fade-out glow | 2px          | drop-shadow(0 0 12px rgba(0,150,255,0.9→0)) over 500ms |
| **Embedding Target**   | Orange border      | 3px          | X6 stroke highlighter                                  |
| **Invalid Embedding**  | Red flash          | 3px          | Red stroke for 300ms, then removed                     |

**Hover vs Selection**:

- Hover effect only appears on unselected cells
- Once selected, hover effect is suppressed
- After deselection, hover works again

**Creation Effect**:

- New nodes and edges show **blue glow** (local operations)
- Remote operations (collaboration) show **green glow**
- Effect fades out over 500ms using animation frames
- Effect is suppressed if cell is selected during animation

## Label Editing

### Editing Labels

**Activation**:

- **Double-click** on node or edge → opens X6 text editor
- Text editor appears inline at label position

**Behavior**:

- Supports both node and edge labels
- Text can be edited directly
- Press Enter to save and close editor
- Press Escape to cancel and close editor
- Click outside editor to save and close

**Future Enhancements** (not yet implemented):

- Label repositioning within/around nodes
- Shift+Enter for newlines
- Rich text formatting

## Graph Navigation and View

### Panning

**Method 1: Mouse Drag**:

- Hold **Shift key** + left mouse drag → pans graph

**Method 2: Mouse Wheel** (vertical panning):

- Hold **Shift key** + mouse wheel scroll → pans graph

**Visual Feedback**:

- Cursor changes to indicate pan mode when Shift is held (future)

### Zooming

**Method**:

- Hold **Shift key** + mouse wheel → zooms in/out

**Behavior**:

- Zoom factor: 1.1
- Min zoom: 0.2× (20%)
- Max zoom (automatic zoom-to-fit): 1.25× (125%)
- Max zoom (manual Shift+Wheel): 3.0× (300%)
- Zoom centers on mouse cursor position

### Grid and Guides

**Grid**:

- Visible by default
- 10px spacing
- Primary grid: #666 color
- Secondary grid: #888 color (every 4th line)

**Snaplines**:

- Appear when moving nodes
- Red color (#ff0000), 1px width
- Help align nodes with each other
- Snap to:
  - Node edges (bbox alignment)
  - Node centers
  - Canvas center

### Canvas Resizing

**Behavior**:

- Canvas automatically resizes when window resizes
- Graph maintains aspect ratio and zoom level
- Nodes remain at same relative positions

## Keyboard Shortcuts

| Shortcut                    | Action                | Notes                                          |
| --------------------------- | --------------------- | ---------------------------------------------- |
| **Delete** or **Backspace** | Delete selected cells | Only when graph has focus, not in input fields |

**Implemented**:

- Ctrl+Z / Cmd+Z: Undo
- Ctrl+Y / Cmd+Shift+Z: Redo

**Not yet implemented**:

- Ctrl+C / Cmd+C: Copy
- Ctrl+V / Cmd+V: Paste
- Ctrl+A / Cmd+A: Select All

**Focus Management**:

- Keyboard events are filtered to avoid conflicts with input fields
- When editing labels, keyboard shortcuts are disabled
- Shortcuts work only when graph canvas has focus

## Context Menu

### Accessing Context Menu

**Method**:

- Right-click on selected node or edge

**Options**:

1. **Show Object**: Opens dialog showing complete JSON structure of cell
   - Includes copy-to-clipboard button
   - Useful for debugging
   - (Future: Only visible in dev mode)

2. **Move Forward**: Brings cell one layer up (z-index + 1)

3. **Move Backward**: Sends cell one layer down (z-index - 1)

4. **Move to Front**: Brings cell to top layer of its category

5. **Move to Back**: Sends cell to bottom layer of its category

**Behavior**:

- Context menu only appears when cell is already selected
- Operations respect z-order hierarchy rules
- All operations are undoable

## Export Functionality

### Supported Formats

Users can export diagrams via toolbar:

- **SVG**: Vector format, scalable, includes all styling
- **PNG**: Raster format, configurable quality
- **JPEG**: Raster format with compression, configurable quality

**Options**:

- Background: Include or exclude canvas background
- Padding: Add padding around exported diagram
- Quality: JPEG quality setting (0-100)

**Behavior**:

- File automatically downloads with timestamp in filename
- Export uses X6 export plugin
- Exported diagram matches current view (zoom/pan)

## Undo/Redo System

**Current Behavior**:

History System tracks:

- Structural changes (node/edge add/remove/move/resize)
- Embedding operations (embed/unembed)
- Label edits
- Z-order changes

History System **excludes**:

- Visual effects (hover, selection styling)
- Temporary UI states
- Port visibility changes
- Tool visibility

**Atomic Operations**:

- Re-embedding: Single history entry (not separate unembed + embed)
- Multi-node operations: Single history entry for all nodes
- Drag completion: Final state recorded as one entry

## Post-Load Validation

When diagrams are loaded from saved data, automatic validation and correction occurs:

### Embedding Validation

**Checks for**:

- Circular embeddings (A→B→A)
- Invalid type combinations (text boxes, security boundaries)
- Orphaned parent references

**Actions**:

- Unembeds invalid embeddings
- Logs all violations
- Shows notification if fixes were applied

### Z-Order Validation

**Checks for**:

- Security boundaries in front of regular nodes
- Children with z-index ≤ parent z-index
- Edges with incorrect z-index relative to connected nodes

**Actions**:

- Corrects z-index values
- Logs all corrections
- Shows notification if fixes were applied

**User Notification**:
If any fixes are made during load:

```
"Diagram loaded with N corrections applied (M embedding, K z-order)"
```

This ensures old or corrupted diagrams are automatically corrected to current standards.

## Performance Characteristics

**Optimizations**:

- Visual effects use X6's built-in highlighter system
- Z-order updates are batched when possible
- Edge z-index updates cascade efficiently
- History operations are atomic to reduce entries

**Expected Performance**:

- Smooth interaction with 50+ nodes and 100+ edges
- Selection/deselection < 50ms
- Drag operations at 60fps
- Creation effects at 60fps (16ms animation intervals)

## Accessibility

**Current**:

- Tooltips on toolbar buttons (internationalized)
- Port tooltips showing connection information
- Keyboard navigation support for deletion
- Focus management for label editing

**Future Enhancements**:

- Screen reader support
- High contrast mode
- Full keyboard-only navigation
- ARIA labels for all interactive elements

## Known Limitations

- Port label editing not available
- Limited keyboard shortcuts (only Delete/Backspace and Undo/Redo)
- No minimap for large diagrams
- Self-connections don't create circular paths (renders as straight line)
- Shift+Enter for newlines in label editing not yet implemented
- Label repositioning within/around nodes not yet implemented

## Technical Notes

### Command Pattern Integration

All user actions use command pattern:

- Each action creates a command object
- Commands are executed through operation manager
- Commands support undo/redo (when implemented)
- Commands update domain model

### Event-Driven Architecture

Graph adapter uses observables for events:

- Node/edge add/remove events
- Position/size change events
- Selection change events
- Drag completion events
- History state events

### Plugin Integration

X6 plugins used:

- **Selection**: Custom configuration for multi-selection
- **Snapline**: Alignment guides during drag
- **Transform**: Node resizing handles
- **Export**: Diagram export to multiple formats
- **Highlighting**: Visual feedback for embedding and connections

This guide represents the complete current and intended behavior of the DFD graph interaction system.

<!--
VERIFICATION SUMMARY
Verified on: 2026-01-25
Agent: verify-migrate-doc

Verified items (against source code):
- AntV X6 library: Confirmed in package.json (@antv/x6: 2.19.2)
- Node shapes: Verified in infra-x6-shape-definitions.ts (Actor=Rectangle, Process=Ellipse, Store=custom rect with top/bottom borders, Security Boundary=dashed rect, Text Box=transparent)
- Default stroke #000, 2px: Verified in styling-constants.ts (DEFAULT_STROKE: '#000000', DEFAULT_STROKE_WIDTH: 2)
- Font Roboto Condensed: Verified in styling-constants.ts (TEXT_FONT_FAMILY)
- Minimum size 40x30px: Verified in styling-constants.ts (MIN_WIDTH: 40, MIN_HEIGHT: 30)
- Grid size 10px: Verified in styling-constants.ts (GRID.SIZE: 10)
- Zoom factor 1.1: Verified in styling-constants.ts (VIEWPORT.ZOOM_FACTOR: 1.1)
- Port radius 5px: Verified in styling-constants.ts (PORTS.RADIUS: 5)
- Selection glow rgba(255,0,0,0.8): Verified in styling-constants.ts (SELECTION.GLOW_COLOR)
- Hover glow rgba(255,0,0,0.6): Verified in styling-constants.ts (HOVER.GLOW_COLOR)
- Embedding orange border #ff6b00: Verified in styling-constants.ts (HIGHLIGHTING.EMBEDDING.STROKE_COLOR)
- Invalid embedding red flash 300ms: Verified in styling-constants.ts (HIGHLIGHTING.INVALID_EMBEDDING.DURATION_MS)
- Z-order values (security boundary=1, node=10, text-box=20): Verified in styling-constants.ts and infra-z-order.service.ts
- Edge default label "Flow": Verified in styling-constants.ts (EDGES.DEFAULT_LABEL)
- Snap radius 20px: Verified in infra-x6-graph.adapter.ts (snap: { radius: 20 })
- X6 plugins (Selection, Snapline, Transform, Export, Clipboard): Verified in infra-x6-graph.adapter.ts
- Undo/Redo keyboard shortcuts: Verified in infra-x6-keyboard.adapter.ts (Cmd+Z/Ctrl+Z for undo, Cmd+Shift+Z/Ctrl+Y for redo)
- Embedding validation rules: Verified in infra-embedding.service.ts (circular prevention, text-box restrictions, security boundary rules)
- Z-order recalculation: Verified in infra-z-order.service.ts (iterative algorithm for cascading violations)
- Creation effect colors (blue local, green remote): Verified in styling-constants.ts (CREATION.GLOW_COLOR_RGB, REMOTE_GLOW_COLOR_RGB)
- Creation effect duration 500ms: Verified in styling-constants.ts (CREATION.FADE_DURATION_MS: 500)
- Grid colors (#666, #888): Verified in styling-constants.ts (GRID.PRIMARY_COLOR, SECONDARY_COLOR)

Corrections made:
- Removed incorrect claim about stroke width increasing to 3px on selection (code shows 2px)
- Fixed zoom values: min 0.2x, auto-max 1.25x, manual-max 3.0x (was incorrectly stated as 0.5x-1.5x)
- Updated undo/redo from "Future" to "Implemented" based on keyboard adapter code
- Updated Known Limitations to reflect current state

Items needing review:
- None identified
-->
