# User interaction and graphical feedback in the DFD graph component

## General notes

We strongly prefer using X6 capabilities rather than inventing our own, for interacting with the graph.

## General style notes

- We strongly prefer using X6 native styling rather than CSS
- Where we have to use CSS, we avoid !important unless it's the only practical way to do something.
  - We might use !important for debugging, but if we determine that !important solves a style problem, we remove !important and fix the underlying style issue.
- We use strokes with color #000 by default for all shapes.
- We use strokes with weight 2 for all shapes.
- We use white or transparent fill by default for all shapes.
- We will only use Roboto Condensed for text in the graph.

## Node Creation and Management

### Node Creation

- **✅ IMPLEMENTED**: Nodes are created by clicking the corresponding button in the toolbar. For instance, to add an Actor node, the user clicks the "Actor" button in the toolbar. The new node appears on the canvas in an algorithmically determined position.
- **✅ IMPLEMENTED**: Five node types supported: Actor (rectangle), Process (ellipse), Store (custom rectangle shape with top/bottom borders), Security Boundary (dashed rectangle), and Text Box (transparent rectangle)
- **✅ IMPLEMENTED**: Nodes are created via clicking a toolbar button. Currently placed at random locations.
- **✅ IMPLEMENTED**: Each node type has appropriate default styling and labels
- **✅ IMPLEMENTED**: Node creation uses command pattern with domain model integration

### Node Interaction

- **✅ IMPLEMENTED**: Nodes can be moved by dragging them with the mouse.
- **✅ IMPLEMENTED**: Nodes can be resized by clicking on them to reveal resize handles, then dragging the handles. The minimum size is 40x30 pixels, and there is no maxiumum size.
- **✅ IMPLEMENTED**: Node embedding/nesting is supported. When a node is dragged over another node, the potential parent node is highlighted to indicate it can accept the dragged node as a child.
  - **✅ IMPLEMENTED**: Embedded nodes get progressively darker bluish tints based on their nesting depth, providing clear visual feedback of their hierarchy.
- **✅ IMPLEMENTED**: Security boundaries have lower z-index to appear behind other nodes

## Edge Creation and Management

### Edge Creation

- **✅ IMPLEMENTED**: Edges are created by hovering over a source node to expose its ports (small circles on the node's perimeter). The user then clicks and drags from one of these ports to a port on a target node. As the user drags, a temporary line indicates the potential connection.
- **✅ IMPLEMENTED**: Edge creation uses validateMagnet and validateConnection for proper port-to-port connections
- **✅ IMPLEMENTED**: Self-connections are allowed between different ports on the same node
- **🔄 FUTURE**: Self-connection creates a circular path away from the port and back to itself.
- **✅ IMPLEMENTED**: Edges require valid source and target ports (allowNode: false, allowPort: true)
- **✅ IMPLEMENTED**: Multiple edges between same nodes are allowed (allowMulti: true)
- **✅ IMPLEMENTED**: Loop connections are allowed (allowLoop: true)
- **✅ IMPLEMENTED**: Edge creation integrates with domain model via command pattern

### Edge Styling

- **✅ IMPLEMENTED**: Edges use dual-path markup (wrap path for interaction, line path for visual)
- **✅ IMPLEMENTED**: Default edge styling: black stroke (#000), 2px width, block arrowhead
- **✅ IMPLEMENTED**: Smooth connector with normal router
- **✅ IMPLEMENTED**: Default label "Flow" positioned at midpoint

## Z-Order

### Z-Order Components

- **✅ IMPLEMENTED**: the ZOrderService implements business logic for z-order calculation
- **✅ IMPLEMENTED**: the X6ZOrderAdapter changes the actual zIndex values of X6 cells according to the ZOrderService' rules.

### Rules

- **✅ IMPLEMENTED**: New security boundary shapes are created with a lower zIndex than the default zIndex for nodes and edges
- **✅ IMPLEMENTED**: New nodes (other than security boundaries) get a higher default zIndex than the default zIndex for security boundary nodes
- **✅ IMPLEMENTED**: The zIndex of new edges gets set to the higher value of either the zIndex for the source node they connect to, or the zIndex for the target node they connect to.
- **✅ IMPLEMENTED**: On reconnecting an edge, the zIndex of the edge is recalculated and set to the higher value of either the zIndex for the source node they connect to, or the zIndex for the target node they connect to.
- **✅ IMPLEMENTED**: When the zIndex of a node is adjusted, every edge connected to that node has its zIndex recalculated and set to the higher value of either the zIndex for the source node they connect to, or the zIndex for the target node they connect to.
- **✅ IMPLEMENTED**: On embedding, the zIndex of the new child node is set to at least one higher than the zIndex of the new parent node. This triggers cascading recalculation of zIndex values for edges connected to the new child node, and then recursively to child nodes of that node and their connected edges, until there are no child nodes left.
- **✅ IMPLEMENTED**: When a security boundary node is unembedded and is no longer the child of any other object, its zIndex is set back to the default zIndex for security boundary nodes.

## Ports

### Port Components

- **✅ IMPLEMENTED**: The PortStateManagerService implements the rules for port visibility and connection management
- **✅ IMPLEMENTED**: The X6PortManager makes actual changes to port visibility and connections.

### Port Visibility

- **✅ IMPLEMENTED**: Ports are normally invisible.
- **✅ IMPLEMENTED**: Once an edge is connected to a port, that port remains always visible.
- **✅ IMPLEMENTED**: Hovering the mouse cursor over a node makes all ports on that node visible.
- **✅ IMPLEMENTED**: When the user starts dragging from a port to create a new edge, all ports on all nodes become visible during the drag operation to facilitate connection.
- **✅ IMPLEMENTED**: Ports return to their normal visibility state (invisible, unless connected) after the edge creation process is completed.
- **✅ IMPLEMENTED**: Ports are displayed as small circles with a radius of 5 pixels, a black stroke, and a white fill.

### Port Configuration

- **✅ IMPLEMENTED**: All nodes have 4 ports: top, right, bottom, and left, each located in the center of the corresponding side of that shape.
- **✅ IMPLEMENTED**: Ports have magnet="active" for connection validation
- **🔄 FUTURE**: Ability for user to add additional ports
- **🔄 FUTURE**: Ability to add, edit and relocate port labels

## Selection and Highlighting

### Selection Behavior

- **✅ IMPLEMENTED**: Individual cells (nodes or edges) can be selected by clicking on them.
- **✅ IMPLEMENTED**: Multiple selection is supported using rubberband selection: the user clicks and drags on a blank area of the canvas to draw a selection rectangle, and all cells within this rectangle are selected.
- **✅ IMPLEMENTED**: The current selection is cleared by clicking on any blank area of the canvas.
- **✅ IMPLEMENTED**: Pressing the Delete or Backspace key on the keyboard removes all currently selected cells.
- **✅ IMPLEMENTED**: Toolbar buttons, such as "Delete Selected," are dynamically enabled or disabled based on whether any cells are currently selected.

### Visual Feedback

- **✅ IMPLEMENTED**: Hover effects: When the mouse cursor hovers over an unselected node or edge, a subtle red glow (achieved with a drop-shadow filter) appears around the element, indicating it is interactive.
- **✅ IMPLEMENTED**: Selection effects: When a node or edge is selected, it displays a stronger red glow and its stroke width increases to 3 pixels, providing clear visual feedback of its selected state.
- **✅ IMPLEMENTED**: No traditional selection boxes are displayed around selected nodes or edges.
- **✅ IMPLEMENTED**: Custom highlighting is implemented using drop-shadow filters, offering a more integrated and visually appealing feedback mechanism compared to standard bounding boxes.
- **🔄 FUTURE**: New cells and cells restored via "undo" get a short highlight effect that is initially bright to call attention to a non-user-added cell, but which fades out over one second.

## Tools and Interaction

### Node Tools (on selection)

- **✅ IMPLEMENTED**: X6 Button-remove tool: When a node is selected, a small "X" button appears in its top-right corner. Clicking this button deletes the node.
- **✅ IMPLEMENTED**: X6 Boundary tool: When a node is selected, a dashed border appears around it, indicating its boundaries.
- **✅ IMPLEMENTED**: X6 Tools are automatically added to or removed from nodes and edges based on their selection state, appearing only when relevant.

### Edge Tools (on selection)

- **✅ IMPLEMENTED**: X6 Source-arrowhead tool: A small blue circle appears at the source end of a selected edge. The user can drag this circle to reconnect the edge's source to a different port on any node.
- **✅ IMPLEMENTED**: X6 Target-arrowhead tool: A small orange circle appears at the target end of a selected edge. The user can drag this arrow to reconnect the edge's target to a different port on any node.
- **✅ IMPLEMENTED**: X6 Button-remove tool: A small red button with an "X" appears near a selected edge. Clicking this button deletes the edge.
- **✅ IMPLEMENTED**: Clicking anywhere along an edge's stroke automatically adds a new vertex at that point, allowing for precise control over edge routing. Dragging a vertex onto another vertex removes the dragged vertex.

### Context Menu

- **✅ IMPLEMENTED**: Right-clicking on a selected node or edge opens a context menu with various operations.
- **✅ IMPLEMENTED**: The "Show Object" option opens a dialog that shows the complete JSON structure of the selected cell. The dialog has a button that copies the complete JSON structure of the selected cell to the system clipboard.
- **🔄 FUTURE**: The "show object" menu item only appears in dev mode, not production mode.
- **✅ IMPLEMENTED**: Z-order manipulation options: "Move Forward" (brings the selected cell one layer up), "Move Backward" (sends the selected cell one layer down), "Move to Front" (brings the selected cell to the very top layer), and "Move to Back" (sends the selected cell to the very bottom layer).

## Label Editing

### Current Implementation

- **✅ IMPLEMENTED**: Double-clicking on a node or an edge opens the X6 text editor.
- **✅ IMPLEMENTED**: The label editing functionality supports both node and edge labels.
- **🔄 FUTURE**: Labels on nodes can be repositioned within or around the node.
- **🔄 FUTURE**: Shift-enter inside the text editor supports adding a newline in text.

### Future Plans

## Graph Navigation and View

### Current Capabilities

- **✅ IMPLEMENTED**: Pan: The user can pan the graph by holding down the `Shift` key and dragging the mouse, or by holding `Shift` and using the mouse wheel.
- **🔄 FUTURE**: The default cursor is the pointer/select cursor until shift is pressed.
- **✅ IMPLEMENTED**: Zoom: The user can zoom in or out of the graph by holding down the `Shift` key and using the mouse wheel. The zoom factor is 1.1, and the zoom level ranges from 0.5x to 1.5x.
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
- **🔄 FUTURE**: Custom node shapes and templates
- **🔄 FUTURE**: Minimap for large diagrams
- **🔄 FUTURE**: Context menu for metadata add/remove/change.

## Legend

- **✅ IMPLEMENTED**: Feature is fully implemented and working
- **🔄 FUTURE**: Feature is planned for future implementation
- **⚠️ LIMITATION**: Known limitation or incomplete feature
