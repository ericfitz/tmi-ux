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

## Nodes

Nodes are created by clicking the corresponding button in the toolbox.

## Edges

Edges are created by hovering over a node, and dragging from a port on that node to a port on another node.

# Ports

Ports are normally invisible unless they are connected, in which case they are always visible until disconnected.

While hovering over a node, all ports on that node become visible. When a drag is initiated from a port, then all ports on all nodes become visible. When the drag is completed, the ports return to their normal visibility state- visible if connected, invisible otherwise.

Ports are displayed as circles with radius 5.

## Highlighting

We prefer to highlight using changes in brightness and/or adding a yellow "glow". We never display or change the styling of bounding boxes during highlighting.

Nodes and edges should be slightly highlighted on hover, returning to normal when hover ends.

Selected objects should be highlighted until unselected.

## Tools

Selecting a cell will display the relevant X6 tools that we have enabled.

## Selection

We will allow selecting individual cells (nodes or edges) by clicking them.

When an object is selected, we will enable toolbar buttons (e.g. delete) that apply to that type of object. If multiple objects are selected, we will only display buttons that apply to all selected objects. When no objects are selected, we will disable/dim toolbar buttons that only apply to selected objects.

## Label editing

We will use the text property of a node or edge as its label. We will use the built-in X6 'node-editor' or 'edge-editor' tools to edit label text. The user will initiate label editing by double-clicking the shape.

We will allow port labels to be edited, method tbd.
