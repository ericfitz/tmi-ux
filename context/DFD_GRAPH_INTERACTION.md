# User interaction and graphical feedback in the DFD graph component

## General notes

We strongly prefer using X6 capabilities rather than inventing our own, for interacting with the graph.

## General style notes

We strongly prefer using X6 native styling rather than CSS

Where we have to use CSS, we avoid !important unless it's the only practical way to do something.

We might use !important for debugging, but if we determine that !important solves a style problem, we remove !important and fix the underlying style issue.

We use strokes with color #000 and weight 2 for all shapes.

We use white or transparent fill for all shapes.

We will only use Roboto Condensed for text in the graph.

## Node Creation and Management

### Node Creation

- **✅ IMPLEMENTED**: Nodes are created by clicking the corresponding button in the toolbar
- **✅ IMPLEMENTED**: Five node types supported: Actor (rectangle), Process (ellipse), Store (custom shape with top/bottom borders), Security Boundary (dashed rectangle), and Textbox (transparent rectangle)
- **✅ IMPLEMENTED**: Nodes are created via clicking a toolbar button. Currently placed at random locations.
- **✅ IMPLEMENTED**: Each node type has appropriate default styling and labels
- **✅ IMPLEMENTED**: Node creation uses command pattern with domain model integration

### Node Interaction

- **✅ IMPLEMENTED**: Nodes can be moved by dragging
- **✅ IMPLEMENTED**: Nodes can be resized using transform plugin (min: 40x30, max: 400x300)
- **✅ IMPLEMENTED**: Node embedding/nesting is supported with visual feedback (fill color changes based on depth)
- **✅ IMPLEMENTED**: Security boundaries have lower z-index to appear behind other nodes
- **✅ IMPLEMENTED**: Embedded nodes get progressively darker bluish tints based on nesting depth

## Edge Creation and Management

### Edge Creation

- **✅ IMPLEMENTED**: Edges are created by dragging from a port on one node to a port on another node
- **✅ IMPLEMENTED**: Edge creation uses validateMagnet and validateConnection for proper port-to-port connections
- **✅ IMPLEMENTED**: Self-connections are prevented
- **✅ IMPLEMENTED**: Edges require valid source and target ports (allowNode: false, allowPort: true)
- **✅ IMPLEMENTED**: Multiple edges between same nodes are allowed (allowMulti: true)
- **✅ IMPLEMENTED**: Loop connections are allowed (allowLoop: true)
- **✅ IMPLEMENTED**: Edge creation integrates with domain model via command pattern

### Edge Styling

- **✅ IMPLEMENTED**: Edges use dual-path markup (wrap path for interaction, line path for visual)
- **✅ IMPLEMENTED**: Default edge styling: black stroke (#000), 2px width, block arrowhead
- **✅ IMPLEMENTED**: Smooth connector with normal router
- **✅ IMPLEMENTED**: Default label "Flow" positioned at midpoint

## Ports

### Port Visibility

- **✅ IMPLEMENTED**: Ports are normally invisible unless connected
- **✅ IMPLEMENTED**: Connected ports remain always visible
- **✅ IMPLEMENTED**: Hovering over a node shows all ports on that node
- **✅ IMPLEMENTED**: Starting edge creation (drag from port) shows all ports on all nodes
- **✅ IMPLEMENTED**: Ports return to normal visibility after edge creation completes
- **✅ IMPLEMENTED**: Ports are displayed as circles with radius 5, black stroke, white fill

### Port Configuration

- **✅ IMPLEMENTED**: All nodes have 4 ports: top, right, bottom, left
- **✅ IMPLEMENTED**: Ports have magnet="active" for connection validation
- **✅ IMPLEMENTED**: Port tooltips show port group information on hover

## Selection and Highlighting

### Selection Behavior

- **✅ IMPLEMENTED**: Individual cells (nodes or edges) can be selected by clicking
- **✅ IMPLEMENTED**: Multiple selection supported with rubberband selection (drag on blank area)
- **✅ IMPLEMENTED**: Selection cleared by clicking on blank area
- **✅ IMPLEMENTED**: Keyboard delete/backspace removes selected cells
- **✅ IMPLEMENTED**: Toolbar buttons are enabled/disabled based on selection state

### Visual Feedback

- **✅ IMPLEMENTED**: Hover effects: subtle red glow (drop-shadow filter) for unselected cells
- **✅ IMPLEMENTED**: Selection effects: stronger red glow and increased stroke width (3px)
- **✅ IMPLEMENTED**: No selection boxes displayed (showNodeSelectionBox: false, showEdgeSelectionBox: false)
- **✅ IMPLEMENTED**: Custom highlighting using drop-shadow filters instead of bounding boxes

## Tools and Interaction

### Node Tools (on selection)

- **✅ IMPLEMENTED**: Button-remove tool (top-right corner) for deletion
- **✅ IMPLEMENTED**: Boundary tool showing dashed orange border around selected nodes
- **✅ IMPLEMENTED**: Tools automatically added/removed based on selection state

### Edge Tools (on selection)

- **✅ IMPLEMENTED**: Vertices tool for adding/removing/moving edge control points
- **✅ IMPLEMENTED**: Target-arrowhead tool for reconnecting edge target
- **✅ IMPLEMENTED**: Button-remove tool (middle of edge) for deletion
- **✅ IMPLEMENTED**: Vertex changes tracked and synchronized with domain model

### Context Menu

- **✅ IMPLEMENTED**: Right-click on cells opens context menu
- **✅ IMPLEMENTED**: Copy cell definition to clipboard (complete JSON structure)
- **✅ IMPLEMENTED**: Z-order manipulation: Move Forward, Move Backward, Move to Front, Move to Back
- **✅ IMPLEMENTED**: Z-order operations respect cell categories (security boundaries vs regular nodes)

## Label Editing

### Current Implementation

- **✅ IMPLEMENTED**: Double-click on cells opens custom label editor
- **✅ IMPLEMENTED**: Custom textarea editor with multiline support
- **✅ IMPLEMENTED**: Editor positioned at cell center with proper styling
- **✅ IMPLEMENTED**: Enter commits edit, Shift+Enter adds line breaks, Escape cancels
- **✅ IMPLEMENTED**: Label changes synchronized between visual and domain models
- **✅ IMPLEMENTED**: Supports both node and edge label editing

### Future Plans

- **🔄 FUTURE**: Built-in X6 node-editor and edge-editor tools (currently using custom implementation)
- **🔄 FUTURE**: Port label editing capabilities

## Graph Navigation and View

### Current Capabilities

- **✅ IMPLEMENTED**: Pan with Shift+drag or Shift+mouse wheel
- **✅ IMPLEMENTED**: Zoom with Shift+mouse wheel (factor: 1.1, range: 0.5-1.5)
- **✅ IMPLEMENTED**: Grid display (10px spacing, visible)
- **✅ IMPLEMENTED**: Snaplines for node alignment during movement
- **✅ IMPLEMENTED**: Auto-resize on window resize events

### Export Functionality

- **✅ IMPLEMENTED**: Export to PNG, JPEG, SVG formats
- **✅ IMPLEMENTED**: Configurable export options (background, padding, quality)
- **✅ IMPLEMENTED**: Automatic file download with timestamp

## Keyboard Shortcuts

### Currently Supported

- **✅ IMPLEMENTED**: Delete/Backspace: Remove selected cells
- **✅ IMPLEMENTED**: Keyboard events properly filtered to avoid conflicts with input fields

### Future Plans

- **🔄 FUTURE**: Undo/Redo shortcuts (Ctrl+Z, Ctrl+Y)
- **🔄 FUTURE**: Copy/Paste shortcuts (Ctrl+C, Ctrl+V)
- **🔄 FUTURE**: Select All (Ctrl+A)

## Performance and Optimization

### Current Features

- **✅ IMPLEMENTED**: Passive event listeners for touch/wheel events
- **✅ IMPLEMENTED**: DOM mutation observer for dynamic element handling
- **✅ IMPLEMENTED**: Debounced resize handling (100ms)
- **✅ IMPLEMENTED**: Performance testing service integration

## Collaboration Features

### Current Status

- **✅ IMPLEMENTED**: Collaboration component placeholder integrated
- **🔄 FUTURE**: Real-time collaborative editing
- **🔄 FUTURE**: User cursors and selection indicators
- **🔄 FUTURE**: Conflict resolution for simultaneous edits

## Accessibility and Usability

### Current Features

- **✅ IMPLEMENTED**: Tooltips for toolbar buttons with internationalization
- **✅ IMPLEMENTED**: Port tooltips showing connection information
- **✅ IMPLEMENTED**: Proper focus management for label editing
- **✅ IMPLEMENTED**: Keyboard navigation support

### Future Enhancements

- **🔄 FUTURE**: Screen reader support
- **🔄 FUTURE**: High contrast mode
- **🔄 FUTURE**: Keyboard-only navigation

## Technical Architecture

### Graph Adapter Pattern

- **✅ IMPLEMENTED**: X6GraphAdapter provides abstraction over X6 Graph
- **✅ IMPLEMENTED**: Event-driven architecture with observables
- **✅ IMPLEMENTED**: Command pattern integration for domain model updates
- **✅ IMPLEMENTED**: Proper resource cleanup and disposal

### Plugin Integration

- **✅ IMPLEMENTED**: Selection plugin with custom configuration
- **✅ IMPLEMENTED**: Snapline plugin for alignment guides
- **✅ IMPLEMENTED**: Transform plugin for node resizing
- **✅ IMPLEMENTED**: Export plugin for diagram export

## Known Limitations and Future Work

### Current Limitations

- **⚠️ LIMITATION**: Undo/Redo not yet implemented (toolbar buttons disabled)
- **⚠️ LIMITATION**: Save functionality not implemented (button disabled)
- **⚠️ LIMITATION**: Port label editing not available
- **⚠️ LIMITATION**: Limited keyboard shortcuts

### Planned Improvements

- **🔄 FUTURE**: History management for undo/redo
- **🔄 FUTURE**: Persistent storage integration
- **🔄 FUTURE**: Advanced edge routing options
- **🔄 FUTURE**: Custom node shapes and templates
- **🔄 FUTURE**: Minimap for large diagrams
- **🔄 FUTURE**: Advanced selection tools (lasso, magic wand)

## Legend

- **✅ IMPLEMENTED**: Feature is fully implemented and working
- **🔄 FUTURE**: Feature is planned for future implementation
- **⚠️ LIMITATION**: Known limitation or incomplete feature
