**Developer's Guide: AntV X6 Graphing Library (Version 2.x)**

**Version Note:** This guide targets the latest stable 2.x versions of X6. As of my last update, versions like `2.18.1` are relevant. Always cross-reference with the specific version in your `package.json` and the official repository.

**Philosophy:** This guide is written from the perspective of having examined the source code. API descriptions, parameters, and types are intended to reflect the codebase.

**Repository:** [https://github.com/antvis/X6](https://github.com/antvis/X6)
**Relevant Source Code:** [https://github.com/antvis/X6/tree/master/packages](https://github.com/antvis/X6/tree/master/packages)
**Examples:** [https://github.com/antvis/X6/tree/master/examples/x6-example-features/src/pages](https://github.com/antvis/X6/tree/master/examples/x6-example-features/src/pages)
**More Examples:** (may be outdated) [https://github.com/antvis/X6/tree/master/sites/x6-sites/examples](https://github.com/antvis/X6/tree/master/sites/x6-sites/examples)

**I. Core Library (`@antv/x6`)**

The core library provides the fundamental building blocks for creating and managing graphs.

**1\. `Graph` Class**

The central class for creating and managing a graph instance.

- **Constructor:** `new Graph(options: Graph.Options)`
  - `options`: An object to configure the graph. Key properties (verify exact names and types in `Graph.Options` interface in the code, typically in `graph/options.ts` or similar):
    - `container: HTMLElement`: **Required.** The HTML element to render the graph into.
    - `width?: number`: Width of the graph canvas. Defaults to container width.
    - `height?: number`: Height of the graph canvas. Defaults to container height.
    - `background?: string | { color?: string; image?: string; position?: string; size?: string; repeat?: string; opacity?: number; }`: Background color or image.
    - `grid?: boolean | { type?: 'dot' | 'fixedDot' | 'mesh'; size?: number; visible?: boolean; args?: any[]; }`: Grid configuration.
      - `type`: `'dot'` or `'mesh'`.
      - `size`: Spacing of grid lines/dots.
      - `visible`: Toggles grid visibility.
      - `args`: Array of objects for further customization (e.g., color, thickness).
    - `interacting?: boolean | Cell.Interaction`: Global interaction configuration. Can be a boolean or an object specifying node/edge/blank interactions.
      - Example (check `Cell.Interaction` type): `{ nodeMovable?: boolean; edgeMovable?: boolean; magnetConnectable?: boolean; }`
    - `connecting?: Graph.ConnectingOptions`: Options for creating edges interactively.
      - `snap?: boolean | { radius?: number; }`: Snap to ports or points.
      - `allowBlank?: boolean`: Allow creating edges by dragging from a blank area.
      - `allowMulti?: boolean`: Allow multiple edges between the same source and target.
      - `allowLoop?: boolean`: Allow self-loops.
      - `allowNode?: boolean`: Allow connecting to nodes directly (not just ports).
      - `allowEdge?: boolean`: Allow connecting to edges.
      - `allowPort?: boolean`: Allow connecting to ports.
      - `highlight?: boolean`: Highlight available connection points.
      - `connector?: string | Edge.ConnectorJSON | ((this: Graph, sourcePoint, targetPoint, sourceCell, targetCell, type) => Edge.ConnectorJSON)`: Default connector type (e.g., `'normal'`, `'smooth'`, `'rounded'`).
      - `connectionPoint?: string | Edge.ConnectionPointJSON | ((this: Graph, line, view, magnet, options, type) => Point.PointLike)`: Default connection point strategy (e.g., `'anchor'`, `'boundary'`).
      - `router?: string | Edge.RouterJSON | ((this: Graph, vertices, args, view) => Point.PointLike[])`: Default edge router (e.g., `'normal'`, `'orth'`, `'manhattan'`).
      - `validateConnection?: (this: Graph, options: { sourceView; targetView; sourceMagnet; targetMagnet; sourceCell; targetCell; type; }) => boolean`: Function to validate a new connection.
      - `createEdge?: (this: Graph, options: { sourceCell; sourcePort; targetCell; targetPort; }) => Edge`: Function to customize edge creation.
    - `selecting?: Graph.SelectingOptions`: Selection behavior.
      - `enabled?: boolean`: Enable/disable selection.
      - `multiple?: boolean`: Allow multiple selections.
      - `rubberband?: boolean`: Enable rubberband selection.
      - `movable?: boolean`: Allow moving selected cells.
      - `strict?: boolean`: Strict selection (e.g., only select if completely within rubberband).
      - `showNodeSelectionBox?: boolean`: Display selection box for nodes.
      - `showEdgeSelectionBox?: boolean`: Display selection box for edges.
    - `panning?: boolean | Graph.PanningOptions`: Panning configuration.
      - `enabled?: boolean`.
      - `eventTypes?: ('leftMouseDown' | 'rightMouseDown' | 'mouseWheel')[]`: Mouse events that trigger panning.
    - `mousewheel?: boolean | Graph.MouseWheelOptions`: Mouse wheel zoom/pan configuration.
      - `enabled?: boolean`.
      - `zoom?: boolean | number`: Enable zoom and specify zoom factor.
      - `minScale?: number`.
      - `maxScale?: number`.
      - `modifiers?: string | ("alt" | "ctrl" | "meta" | "shift")[] | null`: Modifier keys.
    - `history?: boolean | number | Graph.HistoryOptions`: Undo/redo history.
      - `enabled?: boolean`.
      - `beforeAddCommand?: (event: string, args: any) => boolean`.
      - `afterAddCommand?: (event: string, args: any) => void`.
    - `clipboard?: boolean | Graph.ClipboardOptions`: Clipboard functionality.
      - `enabled?: boolean`.
      - `useLocalStorage?: boolean`.
    - `scroller?: boolean | Graph.ScrollerOptions`: Scroller (minimap-like panning).
      - `enabled?: boolean`.
      - `pannable?: boolean`.
      - `width?: number`.
      - `height?: number`.
      - `padding?: number`.
      - `className?: string`.
    - `minimap?: boolean | Graph.MiniMapOptions`: Minimap configuration.
      - `enabled?: boolean`.
      - `container: HTMLElement`.
      - `width?: number`.
      - `height?: number`.
      - `padding?: number`.
    - `embedding?: Graph.EmbeddingOptions`: Node embedding (nesting).
      - `enabled?: boolean`.
      - `findParent?: 'bbox' | 'strict' | ((options: { node: Node; }) => Node | null)`.
      - `validate?: (options: { parent: Node; child: Node; }) => boolean`.
    - `snapline?: boolean | Graph.SnaplineOptions`: Snaplines for aligning nodes.
      - `enabled?: boolean`.
      - `radius?: number`.
      - `filter?: string[] | ((this: Graph, node: Node) => boolean)`.
    - `resizing?: boolean | Graph.ResizingOptions`: Node resizing options.
      - `enabled?: boolean`.
      - `minWidth?: number`, `maxWidth?: number`, `minHeight?: number`, `maxHeight?: number`.
      - `orthogonal?: boolean`.
      - `restrict?: boolean | number`. 1
      - [1\. github.com](https://github.com/antvis/X6)
      - [github.com](https://github.com/antvis/X6)
      -
      - `preserveAspectRatio?: boolean`.
    - `rotating?: boolean | Graph.RotatingOptions`: Node rotating options.
      - `enabled?: boolean`.
      - `grid?: number` (snap angle).
    - `translating?: { restrict?: boolean | number | ((this: Graph, view: CellView) => BBox) }`: Options for cell translation.
    - `nodeView?: string | ViewRegistry.NodeView`: Default view for nodes.
    - `edgeView?: string | ViewRegistry.EdgeView`: Default view for edges.
    - `frozen?: boolean`: If true, the graph is not interactive initially.
    - `async?: boolean`: Enable asynchronous rendering for performance.
    - `sorting?: Graph.Sorting`: `'approx'` or `'exact'` for z-index sorting.
    - `moveThreshold?: number`: Pixels to move before a drag is initiated.
    - `clickThreshold?: number`: Max movement pixels for a click event to register.
    - `preventDefaultMouseDown?: boolean`: Prevent default on mouse down.
    - `preventDefaultContextMenu?: boolean | ((this: Graph, e: JQuery.ContextMenuEvent) => boolean)`
    - `preventDefaultBlankAction?: boolean`

- **Key Methods (selection, check code for full list and exact signatures):**
  - `isFrozen(): boolean`
  - `freeze(options?: Graph.FreezeOptions): void`
  - `unfreeze(options?: Graph.FreezeOptions): void`
  - `addNode(node: Node | Node.Metadata, options?: Graph.AddOptions): Node`
  - `addNodes(nodes: (Node | Node.Metadata)[], options?: Graph.AddOptions): Node[]`
  - `removeNode(node: Node | string, options?: Graph.RemoveOptions): Node | null`
  - `removeNodes(nodes: (Node | string)[], options?: Graph.RemoveOptions): Node[]`
  - `addEdge(edge: Edge | Edge.Metadata, options?: Graph.AddOptions): Edge`
  - `addEdges(edges: (Edge | Edge.Metadata)[], options?: Graph.AddOptions): Edge[]`
  - `removeEdge(edge: Edge | string, options?: Graph.RemoveOptions): Edge | null`
  - `removeEdges(edges: (Edge | string)[], options?: Graph.RemoveOptions): Edge[]`
  - `getNodes(): Node[]`
  - `getEdges(): Edge[]`
  - `getCell(id: string): Cell | null`
  - `getCells(): Cell[]`
  - `getCellsInArea(x: number, y: number, width: number, height: number, options?: Graph.GetCellsInAreaOptions): Cell[]`
  - `clearCells(options?: Graph.RemoveOptions): this`
  - `fromJSON(data: Cell.Properties[] | { cells: Cell.Properties[] }, options?: Graph.FromJSONOptions): this`
    - `data`: Can be an array of cell metadata or an object `{ cells: [...] }`.
  - `toJSON(options?: Graph.ToJSONOptions): { cells: Cell.Properties[] }`
  - `zoom(factor?: number, options?: Graph.ZoomOptions): this`
  - `zoomTo(scale: number, options?: Graph.ZoomOptions): this`
  - `zoomToRect(rect: Rectangle.RectangleLike, options?: Graph.ZoomOptions & { scaleGrid?: number; maxScale?: number; }): this`
  - `zoomToFit(options?: Graph.ZoomOptions & { padding?: number | Point.PointLike; scaleGrid?: number; minScale?: number; maxScale?: number; }): this`
  - `scale(sx: number, sy?: number, cx?: number, cy?: number): this` // Gets or sets scale
  - `translate(tx: number, ty: number): this` // Gets or sets translation
  - `fitToContent(options?: Graph.FitToContentOptions): void`
  - `getContentArea(options?: { useCellGeometry?: boolean }): Rectangle`
  - `getContentBBox(options?: { useCellGeometry?: boolean }): Rectangle`
  - `getGraphArea(): Rectangle` // The viewport area
  - `clientToLocal(x: number, y: number): Point.PointLike` // Converts client coords to graph coords
  - `clientToLocal(p: Point.PointLike): Point.PointLike`
  - `localToClient(x: number, y: number): Point.PointLike` // Converts graph coords to client coords
  - `localToClient(p: Point.PointLike): Point.PointLike`
  - `pageToLocal(x: number, y: number): Point.PointLike`
  - `pageToLocal(p: Point.PointLike): Point.PointLike`
  - `localToPage(x: number, y: number): Point.PointLike`
  - `localToPage(p: Point.PointLike): Point.PointLike`
  - `graphToLocal(...)`, `localToGraph(...)`, `graphToPage(...)`, `pageToGraph(...)` etc. for different coordinate transformations.
  - `center(x?: number, y?: number, options?: Animation.StartOptions): this`
  - `centerContent(options?: Graph.CenterContentOptions): this`
  - `centerCell(cell: Cell, options?: Graph.CenterContentOptions): this`
  - `findView(ref: Cell | Element | JQuery): CellView | null`
  - `findViewByCell(cell: Cell | string): CellView | null`
  - `findViewByElem(elem: Element | JQuery): CellView | null`
  - `getMountedViews(): CellView[]`
  - `getUnmountedViews(): CellView[]`
  - `isMounted(view: CellView): boolean`
  - `isPortsEnabled(): boolean` // Checks if ports are generally enabled (often via options.interacting)
  - `enablePanning()`, `disablePanning()`, `togglePanning(enabled?: boolean)`
  - `enableSelection()`, `disableSelection()`, `toggleSelection(enabled?: boolean)`
  - `enableMouseWheel()`, `disableMouseWheel()`, `toggleMouseWheel(enabled?: boolean)`
  - `enableHistory()`, `disableHistory()`, `toggleHistory(enabled?: boolean)`
  - `undo(options?: any)`, `redo(options?: any)`, `canUndo()`, `canRedo()`, `clearHistory()`
  - `enableClipboard()`, `disableClipboard()`, `toggleClipboard(enabled?: boolean)`
  - `copy(cells: Cell[], options?: Graph.ClipboardCopyOptions)`
  - `cut(cells: Cell[], options?: Graph.ClipboardCopyOptions)`
  - `paste(options?: Graph.ClipboardPasteOptions, cells?: Cell[])`
  - `isClipboardEmpty(): boolean`, `cleanClipboard()`
  - `getSelection(): Cell[]`
  - `setSelection(cells: Cell[] | string[], options?: Graph.SetSelectionOptions)`
  - `select(cell: Cell | string, options?: Graph.SelectCellOptions)`
  - `unselect(cell: Cell | string, options?: Graph.UnselectCellOptions)`
  - `resetSelection(cells?: Cell[] | string[] | null, options?: Graph.ResetSelectionOptions)`
  - `cleanSelection(options?: Graph.CleanSelectionOptions)`
  - `isSelected(cell: Cell | string): boolean`
  - `startBatch(name: string, data?: any)`
  - `stopBatch(name: string, data?: any)`
  - `batchUpdate<T>(name: string | (() => T), execute: () => T, data?: any): T`
  - `isAsync(): boolean`
  - `createView(cell: Cell): CellView | null`
  - `resize(width?: number, height?: number): this` // Resize the graph container and viewport
  - `resizeGraph(width?: number, height?: number): this` // Resizes only the graph area, not the container
  - `getScrollbar(): { horizontal?: HTMLDivElement; vertical?: HTMLDivElement; corner?: HTMLDivElement } | null` (if scroller enabled)
  - `lockScroller()`, `unlockScroller()`, `updateScroller()`
  - `getMiniMap(): { instance: any; $container: JQuery; } | null` (if minimap enabled)
  - `enableTransform()`, `disableTransform()`, `isTransformEnabled()` (related to plugins like `transform`)
  - `dispose()`: Destroys the graph instance and cleans up resources.

- **Event Handling:** Uses an event emitter pattern.
  - `on(eventName: string, handler: Function, context?: any): this`
  - `once(eventName: string, handler: Function, context?: any): this`
  - `off(eventName?: string, handler?: Function, context?: any): this`
  - `trigger(eventName: string, ...args: any[]): this`
  - **Common Events (check code for a full list of event names and their payloads):**
    - `graph:rendered`
    - `model:batch:start`, `model:batch:stop`
    - `cell:added`, `cell:removed`, `cell:changed:*` (e.g., `cell:changed:position`)
    - `node:added`, `node:removed`, `node:changed:*`, `node:moved`, `node:resized`, `node:rotated`
    - `edge:added`, `edge:removed`, `edge:changed:*`, `edge:connected`, `edge:target:changed`, `edge:source:changed`, `edge:vertices:changed`
    - `blank:mousedown`, `blank:mousemove`, `blank:mouseup`, `blank:click`, `blank:dblclick`, `blank:contextmenu`, `blank:mousewheel`
    - `cell:mousedown`, `cell:mousemove`, `cell:mouseup`, `cell:click`, `cell:dblclick`, `cell:contextmenu`, `cell:mouseenter`, `cell:mouseleave`, `cell:mousewheel`
    - `node:embedding`, `node:embedded`, `node:embed`
    - `selection:changed`, `selection:added`, `selection:removed`
    - `history:undo`, `history:redo`, `history:change`, `history:clear`
    - `scale`, `translate`
    - `resize`

- **Static Methods:**
  - `Graph.registerNode(name: string, options: Node.Definition | NodeRegistry.Config, overwrite?: boolean): typeof Node`
    - Registers a custom node type. `options` can be a class extending `Node` or a configuration object.
  - `Graph.registerEdge(name: string, options: Edge.Definition | EdgeRegistry.Config, overwrite?: boolean): typeof Edge`
    - Registers a custom edge type.
  - `Graph.registerView(name: string, view: ViewRegistry.GenericView, overwrite?: boolean)`
  - `Graph.registerAttr(name: string, definition: Attr.Definition)`: Define custom SVG attribute handlers.
  - `Graph.registerMarkup(name: string, markup: string | Markup.JSONMarkup | Markup.JSONMarkup[], options?: { ns?: string; parseForeignObject?: boolean })`
  - `Graph.registerConnector(name: string, fn: Edge.Connector, overwrite?: boolean)`
  - `Graph.registerRouter(name: string, fn: Edge.Router, overwrite?: boolean)`
  - `Graph.registerConnectionPoint(name: string, fn: Edge.ConnectionPoint, overwrite?: boolean)`
  - `Graph.registerAnchor(name: string, fn: Node.Anchor, overwrite?: boolean)`
  - `Graph.registerPortLayout(name: string, fn: PortLayout.Layout, overwrite?: boolean)`
  - `Graph.registerPortLabelLayout(name: string, fn: PortLabelLayout.Layout, overwrite?: boolean)`
  - `Graph.unregisterNode(name: string)`, `Graph.unregisterEdge(name: string)`, etc.

**2\. `Cell` Class (Base for Nodes and Edges)**

Found in `model/cell.ts` or similar.

- **Properties (common):**
  - `id: string`
  - `graph: Graph` (reference to the parent graph)
  - `store: Store<Cell.Properties>` (manages cell data)
  - `parent: Cell | null` (for grouping/embedding)
  - `children: Cell[] | null`
- **Key Methods:**
  - `prop(key?: string | string[], value?: any, options?: Cell.SetOptions): any` (get/set properties)
  - `removeProp(key: string | string[], options?: Cell.SetOptions): this`
  - `hasChanged(key?: string): boolean`
  - `getProp<T>(key: string): T`
  - `setProp(key: string, value: any, options?: Cell.SetOptions): this`
  - `setProp(props: Cell.Properties, options?: Cell.SetOptions): this`
  - `attr(key?: string | string[], value?: Attr.CellAttrs | null): any` (get/set SVG attributes)
  - `removeAttr(key: string | string[] | { [key: string]: any }, options?: Cell.SetOptions): this`
  - `getAttrs(): Attr.CellAttrs | undefined`
  - `setAttrs(attrs: Attr.CellAttrs | null, options?: Cell.SetOptions): this`
  - `processAttrs(attrs: Attr.CellAttrs, options?: { cache?: boolean }): Attr.CellAttrs`
  - `isNode(): this is Node`
  - `isEdge(): this is Edge`
  - `isGroup(): boolean` (typically for nodes that can contain children)
  - `getAncestors(options?: { deep?: boolean; }): Cell[]`
  - `getDescendants(options?: { deep?: boolean; }): Cell[]`
  - `getLowestCommonAncestor(...cells: (Cell | null | undefined)[]): Cell | null`
  - `getParent(): Cell | null`
  - `getChildren(): Cell[] | null`
  - `hasParent(): boolean`
  - `isParentOf(child: Cell | null): boolean`
  - `isChildOf(parent: Cell | null): boolean`
  - `contains(cell: Cell): boolean`
  - `getEmbeddedCells(options?: { deep?: boolean }): Cell[]`
  - `addTo(graph: Graph, options?: any): this`
  - `remove(options?: Cell.RemoveOptions): this`
  - `setParent(parent: Cell | null, options?: Cell.SetOptions): this`
  - `unembed(options?: Cell.SetOptions): this`
  - `embed(parent: Cell, options?: Cell.SetOptions): this`
  - `translate(tx: number, ty: number, options?: Cell.TranslateOptions): this`
  - `getBBox(options?: { deep?: boolean; target?: CellView | SVGElement }): Rectangle`
  - `getConnectionPoint(edge: Edge, type: Edge.TerminalType): Point`
  - `toJSON(options?: Cell.ToJSONOptions): Cell.Properties`
  - `clone(options?: { deep?: boolean }): this`
  - `findView(graph: Graph): CellView | null`
  - `getTools(): ToolsView | null`
  - `hasTools(name?: string): boolean`
  - `addTools(items?: ToolsView.ToolItem | ToolsView.ToolItem[] | ToolsView.Options | null, options?: ToolsView.AddOptions): this`
  - `updateTools(options?: ToolsView.UpdateOptions): this`
  - `removeTools(options?: ToolsView.RemoveOptions): this`
  - `setZIndex(zIndex: number, options?: Cell.SetOptions): this`
  - `getZIndex(): number | undefined`
  - `getData<T>(): T`
  - `setData<T>(data: T, options?: Cell.SetOptions): this`
  - `setVisible(visible: boolean, options?: Cell.SetOptions): this`
  - `isVisible(): boolean`
  - `previous<K extends keyof Cell.Properties>(name?: K): Cell.Properties[K] | Cell.Properties`
  - `isSameStore(cell: Cell): boolean`

**3\. `Node` Class (Extends `Cell`)**

Represents a node in the graph. Found in `model/node.ts` or similar.

- **`Node.Metadata` interface (common properties for constructor/`addNode`):**
  - `id?: string`
  - `x?: number`, `y?: number` (position of top-left corner)
  - `width?: number`, `height?: number` (dimensions)
  - `angle?: number` (rotation)
  - `label?: string | Markup.JSONMarkup | ((this: Node, node: Node) => string | Markup.JSONMarkup)` (text label)
  - `markup?: string | Markup.JSONMarkup | ((this: Node, node: Node) => string | Markup.JSONMarkup)` (SVG/HTML structure)
  - `attrs?: Attr.CellAttrs | ((this: Node, node: Node) => Attr.CellAttrs)` (SVG/HTML attributes)
  - `ports?: PortManager.PortMetadata[] | PortManager.Options` (port definitions)
  - `shape?: string` (registered node shape name, e.g., 'rect', 'circle')
  - `zIndex?: number`
  - `visible?: boolean`
  - `data?: any` (custom user data)
  - `tools?: ToolsView.ToolItem | ToolsView.ToolItem[] | ToolsView.Options`
  - `view?: string` (custom view ID)
  - ... other properties defined by specific node types or `propHooks`.
- **Key Methods (in addition to `Cell` methods):**
  - `getPosition(options?: { relative?: boolean }): Point.PointLike`
  - `setPosition(x: number, y: number, options?: Node.SetPositionOptions): this`
  - `setPosition(pos: Point.PointLike, options?: Node.SetPositionOptions): this`
  - `getSize(): Size`
  - `setSize(width: number, height: number, options?: Node.SetSizeOptions): this`
  - `setSize(size: Size, options?: Node.SetSizeOptions): this`
  - `getAngle(): number`
  - `rotate(angle: number, abs?: boolean, origin?: Point.PointLike, options?: Cell.SetOptions): this`
  - `getBBox(options?: { deep?: boolean; target?: CellView | SVGElement; fromCell?: Cell }): Rectangle` // Overrides Cell's bbox
  - `getUsedPorts(): PortManager.Port[]`
  - `getPorts(): PortManager.Port[]`
  - `getPort(portId: string): PortManager.Port | null`
  - `hasPort(portId: string): boolean`
  - `addPort(port: PortManager.PortMetadata, options?: Cell.SetOptions): this`
  - `addPorts(ports: PortManager.PortMetadata[], options?: Cell.SetOptions): this`
  - `insertPort(index: number, port: PortManager.PortMetadata, options?: Cell.SetOptions): this`
  - `removePort(port: string | PortManager.Port, options?: Cell.SetOptions): this`
  - `removePortAt(index: number, options?: Cell.SetOptions): this`
  - `removePorts(ports?: (string | PortManager.Port)[], options?: Cell.SetOptions): this`
  - `getPortsByGroup(groupName: string): PortManager.Port[]`
  - `getPortProp(portId: string, path?: string | string[]): any`
  - `setPortProp(portId: string, path: string | string[], value: any, options?: Cell.SetOptions): this`
  - `setPortProp(portId: string, props: DeepPartial<PortManager.Port>, options?: Cell.SetOptions): this`
  - `removePortProp(portId: string, path?: string | string[], options?: Cell.SetOptions): this`
  - `getPortName(portId: string): string | undefined`
  - `getPortLayoutArgs(portId: string): PortManager.Port['args']`
  - `getPortAttrs(portId: string): Attr.CellAttrs | undefined`
  - `getPortsPosition(groupName?: string): { [key: string]: Point }`
  - `getPortPosition(portId: string): Point`
  - `getPortIndex(portIdOrPort: string | PortManager.Port): number`
  - `hasPorts(): boolean`
  - `canEmbed(node: Node, options?: { deep?: boolean }): boolean`

**4\. `Edge` Class (Extends `Cell`)**

Represents an edge (link/connector) in the graph. Found in `model/edge.ts` or similar.

- **`Edge.Metadata` interface (common properties for constructor/`addEdge`):**
  - `id?: string`
  - `source: Edge.TerminalData` (e.g., `{ cell: 'nodeId', port: 'portId' }` or `{ x: number, y: number }`)
  - `target: Edge.TerminalData`
  - `label?: string | Edge.Label | (Edge.Label & { position?: Edge.LabelPosition; })[]` (edge label(s))
  - `labels?: (string | Edge.Label | (Edge.Label & { position?: Edge.LabelPosition; }))[]`
  - `vertices?: Point.PointLike[]` (intermediate points)
  - `router?: { name: string; args?: any; } | string` (e.g., 'normal', 'manhattan', 'orth', 'er')
  - `connector?: { name: string; args?: any; } | string` (e.g., 'normal', 'smooth', 'rounded', 'jumpover')
  - `markup?: string | Markup.JSONMarkup | ((this: Edge, edge: Edge) => string | Markup.JSONMarkup)`
  - `attrs?: Attr.CellAttrs | ((this: Edge, edge: Edge) => Attr.CellAttrs)`
  - `shape?: string` (registered edge shape name)
  - `zIndex?: number`
  - `visible?: boolean`
  - `data?: any`
  - `tools?: ToolsView.ToolItem | ToolsView.ToolItem[] | ToolsView.Options`
  - `view?: string`
- **Key Methods (in addition to `Cell` methods):**
  - `getSource(): Edge.TerminalPointData | Edge.TerminalCellData`
  - `setSource(source: Edge | Node | Point.PointLike | Edge.TerminalData, args?: Edge.SetTerminalOptions, options?: Cell.SetOptions): this`
  - `getSourceCell(): Cell | null`
  - `getSourceNode(): Node | null`
  - `getSourcePortId(): string | null`
  - `getSourcePoint(): Point`
  - `getTarget(): Edge.TerminalPointData | Edge.TerminalCellData`
  - `setTarget(target: Edge | Node | Point.PointLike | Edge.TerminalData, args?: Edge.SetTerminalOptions, options?: Cell.SetOptions): this`
  - `getTargetCell(): Cell | null`
  - `getTargetNode(): Node | null`
  - `getTargetPortId(): string | null`
  - `getTargetPoint(): Point`
  - `getTerminal(type: Edge.TerminalType): Edge.TerminalPointData | Edge.TerminalCellData`
  - `setTerminal(type: Edge.TerminalType, terminal: Edge | Node | Point.PointLike | Edge.TerminalData, args?: Edge.SetTerminalOptions, options?: Cell.SetOptions): this`
  - `getRouter(): Edge.RouterData | undefined`
  - `setRouter(name?: string | Edge.RouterData | null, args?: any, options?: Cell.SetOptions): this`
  - `removeRouter(options?: Cell.SetOptions): this`
  - `getConnector(): Edge.ConnectorData | undefined`
  - `setConnector(name?: string | Edge.ConnectorData | null, args?: any, options?: Cell.SetOptions): this`
  - `removeConnector(options?: Cell.SetOptions): this`
  - `getVertices(): Point.PointData[]`
  - `setVertices(vertices: Point.PointData[] | Point.PointLike[], options?: Cell.SetOptions): this`
  - `insertVertex(vertex: Point.PointLike, index: number, options?: Cell.SetOptions): this`
  - `appendVertex(vertex: Point.PointLike, options?: Cell.SetOptions): this`
  - `removeVertexAt(index: number, options?: Cell.SetOptions): this`
  - `getVertexAt(index: number): Point.PointData | null`
  - `getLabels(): Edge.Label[]`
  - `setLabels(labels: string | Edge.Label | (Edge.Label & { position?: Edge.LabelPosition })[], options?: Cell.SetOptions): this`
  - `getLabelAt(index: number): Edge.Label | null`
  - `insertLabel(label: string | Edge.Label, index: number, options?: Cell.SetOptions): this`
  - `appendLabel(label: string | Edge.Label, options?: Cell.SetOptions): this`
  - `removeLabelAt(index: number, options?: Cell.SetOptions): this`
  - `getLabelProp(labelPath: string | string[]): any`
  - `setLabelProp(labelPath: string | string[], value: any, options?: Cell.SetOptions): this`
  - `removeLabelProp(labelPath: string | string[], options?: Cell.SetOptions): this`
  - `getDefaultLabel(): Edge.Label`
  - `getSourceMarkerName(): string | null`, `getTargetMarkerName(): string | null` (via attrs)
  - `getSourceView(): CellView | null`, `getTargetView(): CellView | null`
  - `updateParent(options?: Cell.SetOptions): this` (moves edge to common ancestor of source/target)

**5\. Built-in Shapes (Nodes & Edges)**

X6 comes with predefined shapes. These are typically registered automatically. You use them by specifying the `shape` string in metadata. Examples:

- **Nodes:** `'rect'`, `'circle'`, `'ellipse'`, `'polygon'`, `'polyline'`, `'image'`, `'html'`, `'text-block'` (or custom registered names)
- **Edges:** `'edge'` (default), or often custom edges are registered. Standard edges are highly configurable through `attrs`, `connector`, `router`.

The specific default `markup` and `attrs` for these built-in shapes would be defined in their respective source files (e.g., `shape/standard/rect.ts`).

**6\. `CellView` (Base for `NodeView` and `EdgeView`)**

Responsible for rendering a `Cell` (Node or Edge) and handling its interactions. You generally don't instantiate these directly; the `Graph` does it.

- Key methods (inspect `view/cell.ts` or similar):
  - `render()`
  - `confirmUpdate(flag: number, options: any): number`
  - `findMagnet(elem?: Element | string): Element | undefined` (find connectable parts, usually ports)
  - `getBBox(options?: { fromCell?: boolean }): Rectangle`
  - `highlight(options?: { magnet?: Element, type?: string, options?: any })`
  - `unhighlight(options?: { magnet?: Element, type?: string, options?: any })`
  - `can(feature: string): boolean` (checks if an interaction is enabled, e.g., `can('nodeMovable')`)
  - `getpriority(): number` (for event handling order)
  - `cleanCache()`, `getCache(name: string)`, `setCache(name: string, data: any)`
  - `prepareCaching()`, `clearCaching()`
  - `onMouseDown(e: JQuery.MouseDownEvent, x: number, y: number)` (and other event handlers like `onMouseMove`, `onClick`, etc.)
  - `findRelatedView(elem: Element, options?: { views?: CellView[], reverse?: boolean }): CellView | null`

**7\. Key Enums and Types (Illustrative \- check codebase for exact definitions)**

- **Port Layouts (for `ports.groups.[groupName].position`):**
  - `'left'`, `'right'`, `'top'`, `'bottom'`, `'absolute'`, `'ellipse'`, `'ellipseSpread'` etc.
  - Or a custom function: `(portsArgs: any[], elemBBox: Rectangle, groupArgs: any) => Point[]`
- **Port Label Layouts (for `ports.groups.[groupName].label.position`):**
  - `'left'`, `'right'`, `'top'`, `'bottom'`, `'radial'`, `'radialOriented'` etc.
  - Or a custom function.
- **Edge Connectors (`connector.name`):**
  - `'normal'` (straight line)
  - `'smooth'` (bézier curve)
  - `'rounded'` (polyline with rounded corners)
  - `'jumpover'` (for line jumps)
- **Edge Routers (`router.name`):**
  - `'normal'` (direct line, often with vertices)
  - `'orth'` (orthogonal segments, experimental or plugin-based in some versions)
  - `'manhattan'` (orthogonal, trying to avoid node crossings)
  - `'metro'` (like manhattan but with more options for bend radius etc.)
  - `'er'` (entity-relationship style)
  - `'oneSide'` (routes from one side of a node)
- **Edge Connection Points (`connectionPoint.name` on Graph or per-edge):**
  - `'boundary'` (connects to the node's bounding box)
  - `'anchor'` (connects to a specified anchor point on the node, e.g., center, topLeft)
  - `'bbox'` (similar to boundary but with options for ratio)
- **Node Anchors (for `connectionPoint` when it's `'anchor'` or for custom logic):**
  - `'center'`, `'topLeft'`, `'top'`, `'topRight'`, `'right'`, `'bottomRight'`, `'bottom'`, `'bottomLeft'`, `'left'`
  - Or a custom function: `(view: NodeView, magnet: SVGElement, refPoint?: Point.PointLike, options?: any) => Point`

**II. Optional Packages (`/packages` directory)**

X6's architecture is modular, with many features provided as optional packages. You'll find these in subdirectories under `/packages` in the GitHub repository.

**Common Optional Packages (check `packages/` for the full list, e.g., `x6-plugin-clipboard`, `x6-plugin-history`, `x6-plugin-keyboard`, `x6-plugin-minimap`, `x6-plugin-scroller`, `x6-plugin-selection`, `x6-plugin-snapline`, `x6-react-shape`, `x6-vue-shape`, etc.):**

**1\. `@antv/x6-plugin-clipboard`**

- **Purpose:** Enables copy, cut, and paste functionality for graph cells.
- **Integration:** Usually initialized via `graph.use(new Clipboard(options))` or enabled via `clipboard: true` or `clipboard: { enabled: true, ... }` in graph options.
- **API (on `graph` instance after plugin is used):**
  - `graph.copy(cells: Cell[], options?: Clipboard.CopyOptions)`
  - `graph.cut(cells: Cell[], options?: Clipboard.CopyOptions)`
  - `graph.paste(options?: Clipboard.PasteOptions, cells?: Cell[])`
  - `graph.isClipboardEmpty(): boolean`
  - `graph.cleanClipboard()`
  - `graph.enableClipboard()`, `graph.disableClipboard()`, `graph.toggleClipboard(enabled?: boolean)`
- **Options (passed to constructor or in graph config):**
  - `enabled?: boolean`
  - `useLocalStorage?: boolean`: Persist clipboard content in local storage.
  - `offset?: number | Point.PointLike`: Offset for pasted elements.
  - `selection?: boolean`: Automatically select pasted elements.
  - `validate?: (this: Graph, cell: Cell, options: { options: Clipboard.PasteOptions; cells: Cell[]; }) => boolean | Cell.Properties`: Validate or modify cells before pasting.

**2\. `@antv/x6-plugin-history`**

- **Purpose:** Provides undo/redo capabilities.
- **Integration:** `graph.use(new History(options))` or `history: true` / `history: { enabled: true, ... }` in graph options.
- **API (on `graph` instance):**
  - `graph.undo(options?: any)`
  - `graph.redo(options?: any)`
  - `graph.canUndo(): boolean`
  - `graph.canRedo(): boolean`
  - `graph.clearHistory(options?: any)`
  - `graph.addHistoryCommand(cmd: History.Command)` (for custom commands)
  - `graph.enableHistory()`, `graph.disableHistory()`, `graph.toggleHistory(enabled?: boolean)`
- **Options:**
  - `enabled?: boolean`
  - `maxStackSize?: number`: Maximum number of undo/redo steps.
  - `beforeAddCommand?: (this: Graph, event: string, args: any) => boolean`: Hook before a command is added.
  - `afterAddCommand?: (this: Graph, event: string, args: any) => void`: Hook after a command is added.
  - `ignoreAdd?: boolean`: If true, graph.addCell won't be recorded.
  - `ignoreRemove?: boolean`
  - `ignoreChange?: boolean | string[]`: Ignore all or specific property changes.

**3\. `@antv/x6-plugin-selection`**

- **Purpose:** Manages cell selection, including rubberband selection.
- **Integration:** `graph.use(new Selection(options))` or `selecting: { enabled: true, ... }` in graph options.
- **API (on `graph` instance):**
  - `graph.getSelectedCells(): Cell[]`
  - `graph.select(cells: Cell | string | (Cell | string)[], options?: Selection.SelectOptions)`
  - `graph.unselect(cells: Cell | string | (Cell | string)[], options?: Selection.UnselectOptions)`
  - `graph.resetSelection(cells?: Cell | string | (Cell | string)[], options?: Selection.ResetSelectionOptions)`
  - `graph.cleanSelection(options?: Selection.CleanSelectionOptions)`
  - `graph.isCellSelected(cell: Cell | string): boolean`
  - `graph.enableSelection()`, `graph.disableSelection()`, `graph.toggleSelection(enabled?: boolean)`
- **Options:**
  - `enabled?: boolean`
  - `multiple?: boolean`: Allow multiple selections. Default: `true`.
  - `rubberband?: boolean`: Enable rubberband selection. Default: `false`.
  - `movable?: boolean`: Allow moving selected cells. Default: `true`.
  - `strict?: boolean`: Strict rubberband selection. Default: `false`.
  - `showNodeSelectionBox?: boolean`: Display selection box for nodes. Default: `false`.
  - `showEdgeSelectionBox?: boolean`: Display selection box for edges. Default: `false`.
  - `pointerEvents?: 'auto' | 'none' | 'visiblePainted' | ...`: Control how selection interacts with pointer events.
  - `filter?: string[] | ((this: Graph, cell: Cell) => boolean)`: Filter which cells can be selected.
  - `selectionBoxZIndex?: number`
  - `rubberNode?: boolean | ((this: Graph, node: Node) => boolean)`: If true, nodes can be selected by rubberband.
  - `rubberEdge?: boolean | ((this: Graph, edge: Edge) => boolean)`: If true, edges can be selected by rubberband.

**4\. `@antv/x6-plugin-snapline`**

- **Purpose:** Displays alignment guides (snaplines) when moving nodes.
- **Integration:** `graph.use(new Snapline(options))` or `snapline: { enabled: true, ... }` in graph options.
- **API:** Primarily configuration-driven.
- **Options:**
  - `enabled?: boolean`
  - `radius?: number`: Snapping tolerance distance. Default: `10`.
  - `className?: string`: CSS class for snaplines.
  - `filter?: string[] | ((this: Graph, node: Node) => boolean)`: Filter which nodes to snap against.
  - `clean?: boolean | number`: Auto-hide snaplines after a delay (ms) or if `true` (default `2000ms`). `false` to keep them.
  - `resizing?: boolean`: Enable snaplines during node resizing.
  - `sharp?: boolean`: Pixel-perfect snapping.

**5\. `@antv/x6-plugin-minimap`**

- **Purpose:** Renders a small overview map of the graph.
- **Integration:** `graph.use(new MiniMap(options))` or `minimap: { enabled: true, container: HTMLElement, ... }` in graph options.
- **API (on `graph.minimap` if using graph options, or on the plugin instance):**
  - `update(viewBox?: Rectangle.RectangleLike)`: Force update the minimap.
  - `resize(width?: number, height?: number)`
- **Options:**
  - `enabled?: boolean`
  - `container: HTMLElement`: **Required.** The HTML element for the minimap.
  - `width?: number`: Default: `200`.
  - `height?: number`: Default: `150`.
  - `padding?: number`: Default: `10`.
  - `graphOptions?: Graph.Options`: Options for the internal graph used by the minimap.
  - `showNode kēpshape?: boolean`: Whether to render node shapes or simple rects.
  - `showEdge?: boolean`: Whether to render edges.
  - `minScale?: number`, `maxScale?: number`: Zoom limits for the minimap graph.
  - `theme?: string` (e.g. 'default', 'dark')

**6\. `@antv/x6-plugin-scroller`**

- **Purpose:** Adds scrollbars to the graph container if content overflows, and enables panning by dragging the graph.
- **Integration:** `graph.use(new Scroller(options))` or `scroller: { enabled: true, ... }` in graph options.
- **API (on `graph.scroller` or the plugin instance):**
  - `lock()`, `unlock()`
  - `update()`
  - `center(x?:number, y?:number)`, `centerContent()`, `centerCell(cell: Cell)`
  - `zoom(factor?: number, options?: Graph.ZoomOptions)`
  - `scrollTo(x: number, y: number)`
  - `getScrollbarContainer(): HTMLDivElement | null`
- **Options:**
  - `enabled?: boolean`
  - `pannable?: boolean`: Enable panning by dragging the graph background. Default: `false`.
  - `className?: string`
  - `width?: number`, `height?: number`: Explicit dimensions for the scroller viewport.
  - `padding?: number | { top?: number, left?: number, right?: number, bottom?: number }`. Default: `0`.
  - `cursor?: string`: CSS cursor for panning.
  - `modifiers?: string | ("alt" | "ctrl" | "meta" | "shift")[] | null`: Modifier keys for panning.
  - `autoResize?: boolean`: Auto resize scroller with graph. Default: `true`.
  - `pageVisible?: boolean`: Show page breaks.
  - `pageBreak?: boolean | Scroller.PageBreakOptions`: Page break lines.
  - `minVisibleWidth?: number`, `minVisibleHeight?: number`: Minimum visible area.

**7\. `@antv/x6-react-shape` / `@antv/x6-vue-shape`**

- **Purpose:** Allows using React/Vue components as the rendering for X6 nodes.
- **Integration:**
  - Define a React/Vue component.
  - Register it with X6:
    - React: `Graph.registerNode('my-react-node', { shape: 'react-shape', component: MyReactComponent, ...nodeOptions })`
    - Vue: `Graph.registerNode('my-vue-node', { shape: 'vue-shape', component: MyVueComponent, ...nodeOptions })` (The exact `shape` key might be `html` with a special `component` field, check package docs).
    - In X6 2.x, often the node's `component` property in its metadata is used with a shape like `html` or a custom registered one that handles components.
  - When adding a node: `graph.addNode({ shape: 'my-react-node', ... })`
- **Key aspect:** The node's `data` property in X6 often becomes the `props` for the React/Vue component. Changes to `node.setData()` can trigger re-renders of the component. The component can also emit events back to X6 via `this.props.node.trigger(...)` or similar mechanisms provided by the integration.
- **Important:** These packages handle mounting/unmounting the framework components within the X6 SVG/HTML structure. The `portal` or similar mechanism is often used for React.

**8\. `@antv/x6-plugin-keyboard`** \* **Purpose:** Provides keyboard shortcuts for common actions. \* **Integration:** `graph.use(new Keyboard(options))` or `keyboard: { enabled: true, ...}` in graph options. \* **API:** \* `graph.bindKey(keys: string | string[], callback: Keyboard.Handler, action?: Keyboard.Action)` \* `graph.unbindKey(keys: string | string[], action?: Keyboard.Action)` \* `graph.enableKeyboard()`, `graph.disableKeyboard()`, `graph.toggleKeyboard(enabled?: boolean)` \* **Options:** \* `enabled?: boolean` \* `global?: boolean`: Listen for keys on document or graph container. \* `format?: (key: string) => string`: Format key strings. \* `guard?: (this: Graph, e: KeyboardEvent) => boolean`: Global event guard. \* **Default Bindings (examples, can be customized):** \* `ctrl+c` / `cmd+c`: copy \* `ctrl+v` / `cmd+v`: paste \* `ctrl+x` / `cmd+x`: cut \* `ctrl+z` / `cmd+z`: undo \* `ctrl+y` / `cmd+y`: redo \* `delete` / `backspace`: delete selected cells

**III. Composition for Common Tasks**

This section describes how to combine APIs to achieve common graphing tasks.

**1\. Initializing a Graph**

TypeScript  
import { Graph } from '@antv/x6';  
// Optional: import plugins  
import { Snapline } from '@antv/x6-plugin-snapline';  
import { History } from '@antv/x6-plugin-history';  
import { Keyboard } from '@antv/x6-plugin-keyboard';  
import { Selection } from '@antv/x6-plugin-selection';  
import { Clipboard } from '@antv/x6-plugin-clipboard';

const graphContainer \= document.getElementById('my-graph-container');

if (graphContainer) {  
 const graph \= new Graph({  
 container: graphContainer,  
 width: 800,  
 height: 600,  
 background: {  
 color: '\#f5f5f5', // Light gray background  
 },  
 grid: {  
 visible: true,  
 type: 'doubleMesh',  
 args: \[  
 { color: '\#cccccc', thickness: 1 }, // Primary grid  
 { color: '\#e0e0e0', thickness: 1, factor: 4 }, // Secondary grid  
 \],  
 },  
 panning: { // Enable panning by dragging background  
 enabled: true,  
 eventTypes: \['leftMouseDown', 'mouseWheel'\]  
 },  
 mousewheel: { // Enable zooming with mouse wheel  
 enabled: true,  
 modifiers: \['ctrl', 'meta'\], // Zoom with Ctrl/Cmd \+ Wheel  
 },  
 interacting: {  
 nodeMovable: true,  
 edgeMovable: true,  
 edgeLabelMovable: true,  
 arrowheadMovable: true,  
 vertexMovable: true,  
 vertexAddable: true,  
 vertexDeletable: true,  
 },  
 connecting: { // Configure edge creation  
 router: 'manhattan', // or 'orth', 'er', 'normal', 'metro'  
 connector: {  
 name: 'rounded', // or 'normal', 'smooth'  
 args: { radius: 8 },  
 },  
 allowBlank: false, // Don't allow starting edge from blank area  
 allowLoop: false, // No self-loops  
 allowNode: true, // Connect to node body  
 allowPort: true, // Connect to ports  
 allowEdge: false, // Don't allow connecting an edge to another edge  
 snap: { radius: 20 },  
 highlight: true,  
 createEdge() { // Customize edge creation  
 return this.createEdge({  
 shape: 'edge', // or custom edge shape  
 attrs: {  
 line: {  
 stroke: '\#5F95FF',  
 strokeWidth: 1,  
 targetMarker: { name: 'classic', size: 7 },  
 },  
 },  
 zIndex: 0,  
 });  
 },  
 validateConnection({ sourceView, targetView, sourceMagnet, targetMagnet }) {  
 if (sourceView \=== targetView) return false; // Prevent self-loop via UI  
 if (\!sourceMagnet) return false; // Must connect from a port  
 if (\!targetMagnet) return false; // Must connect to a port  
 // Further custom validation: e.g., check cell types  
 // const sourceCellType \= sourceView.cell.prop('type');  
 // const targetCellType \= targetView.cell.prop('type');  
 // if (sourceCellType \=== 'typeA' && targetCellType \!== 'typeB') return false;  
 return true;  
 },  
 },  
 // For plugins, either use graph.use() or configure directly if supported  
 history: true, // Enables History plugin with default options  
 snapline: true, // Enables Snapline plugin  
 keyboard: { enabled: true },  
 clipboard: { enabled: true },  
 selecting: {  
 enabled: true,  
 rubberband: true, // Enable Shift \+ Drag to select multiple  
 showNodeSelectionBox: true,  
 // multiple: true, (default)  
 // strict: false, (default)  
 },  
 embedding: { // For node nesting  
 enabled: true,  
 findParent: 'bbox', // Find parent by bounding box containment  
 validate({ parent, child }) {  
 // const parentType \= parent.prop('type');  
 // const childType \= child.prop('type');  
 // if (parentType \=== 'groupNode' && childType \=== 'atomicNode') return true;  
 return true; // Allow any embedding by default if enabled  
 }  
 },  
 highlighting: {  
 magnetAdsorbed: { // Highlight when magnet is ready to connect  
 name: 'stroke',  
 args: {  
 padding: 4,  
 attrs: {  
 strokeWidth: 4,  
 stroke: '\#5F95FF',  
 },  
 },  
 },  
 // Other highlighters: magnetAvailable, nodeAvailable, connecting  
 },  
 });

// Using plugins explicitly (alternative to direct options)  
 // graph.use(new History());  
 // graph.use(new Snapline({ enabled: true, sharp: true }));  
 // graph.use(new Keyboard({ enabled: true }));  
 // graph.use(new Selection({ enabled: true, rubberband: true }));  
 // graph.use(new Clipboard({ enabled: true }));

// Ready to add nodes/edges and set up event listeners  
}

**2\. Adding and Removing Nodes/Edges**

TypeScript  
// Assuming 'graph' is an initialized Graph instance

// Add a basic rectangular node  
const node1 \= graph.addNode({  
 shape: 'rect', // Built-in shape  
 x: 100,  
 y: 100,  
 width: 120,  
 height: 50,  
 label: 'Node 1',  
 attrs: { // Customize appearance  
 body: { fill: '\#A6CFFF', stroke: '\#5F95FF', strokeWidth: 2, rx: 5, ry: 5 },  
 label: { fill: '\#333', fontSize: 13 },  
 },  
 ports: { // Define ports  
 groups: {  
 'in': { position: 'left', attrs: { circle: { r: 4, magnet: true, stroke: '\#5F95FF', fill: '\#FFF' } } },  
 'out': { position: 'right', attrs: { circle: { r: 4, magnet: true, stroke: '\#5F95FF', fill: '\#FFF' } } },  
 },  
 items: \[  
 { id: 'port_in_1', group: 'in' },  
 { id: 'port_out_1', group: 'out' },  
 \],  
 },  
 data: { type: 'customNodeTypeA', value: 42 }, // Custom data  
});

// Add another node (e.g., a circle)  
const node2 \= graph.addNode({  
 shape: 'circle',  
 x: 300,  
 y: 150,  
 width: 60,  
 height: 60,  
 label: 'Node 2',  
 attrs: {  
 body: { fill: '\#FFD6A6', stroke: '\#FFA55F' },  
 label: { fill: '\#333' },  
 },  
 ports: {  
 groups: { 'default': { position: 'ellipseSpread', attrs: { circle: { magnet: true, r: 4 } } } },  
 items: \[{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }\],  
 },  
});

// Add an edge connecting the two nodes via ports  
const edge1 \= graph.addEdge({  
 source: { cell: node1.id, port: 'port_out_1' }, // or just node1  
 target: { cell: node2.id, port: 'p1' }, // or just node2 (if allowNode true)  
 // shape: 'custom-edge' // if you have one registered  
 attrs: {  
 line: {  
 stroke: '\#808080',  
 strokeWidth: 1,  
 targetMarker: { name: 'classic', size: 7 }, // Built-in marker  
 },  
 },  
 labels: \[{ // Add a label to the edge  
 attrs: { label: { text: 'Connects To' } },  
 position: { distance: 0.5 } // Position label at midpoint  
 }\],  
 // vertices: \[{ x: 200, y: 200 }\], // Optional intermediate points  
 // router: { name: 'manhattan' }, // Override graph default router  
 // connector: { name: 'smooth' }, // Override graph default connector  
});

// Remove a node (this will also remove connected edges by default)  
// graph.removeNode(node1.id);  
// or graph.removeCell(node1);

// Remove an edge  
// graph.removeEdge(edge1.id);  
// or graph.removeCell(edge1);

// Batch operations for performance when adding/removing many  
graph.startBatch('load-data');  
// ... many graph.addNode/addEdge calls ...  
const nodesData \= \[/\* large array of node metadata \*/\];  
const edgesData \= \[/\* large array of edge metadata \*/\];  
// graph.addNodes(nodesData);  
// graph.addEdges(edgesData);  
// Or use fromJSON for full graph replacement:  
// graph.fromJSON({ cells: \[...nodesData, ...edgesData\] });  
graph.stopBatch('load-data');

**3\. Customizing Nodes and Edges (Shape Registration)**

TypeScript  
import { Node, Edge, Shape, Graph } from '@antv/x6';

// Custom Rectangular Node with Icon  
class CustomRectNode extends Shape.Rect {  
 // You can override methods or add custom logic  
}  
CustomRectNode.config({  
 // Inherits Rect props like width, height, x, y  
 markup: \[ // Define SVG structure  
 { tagName: 'rect', selector: 'body' },  
 { tagName: 'image', selector: 'icon' },  
 { tagName: 'text', selector: 'label' },  
 \],  
 attrs: {  
 body: {  
 rx: 6, ry: 6, stroke: '\#333', fill: '\#FFF', strokeWidth: 1,  
 },  
 icon: {  
 'xlink:href': 'path/to/your/icon.svg', // Default icon  
 width: 16, height: 16, x: 12, y: 12,  
 },  
 label: {  
 fontSize: 12, fill: '\#333', refX: 0.5, refY: 0.5, // Center label  
 textAnchor: 'middle', textVerticalAnchor: 'middle',  
 },  
 },  
 // Add custom properties accessible via node.prop('myCustomProp')  
 // or that influence rendering via propHooks  
 propHooks(metadata) {  
 const { iconUrl, ...others } \= metadata;  
 if (iconUrl) {  
 Shape.Util.applyAttributes(others.attrs.icon, { 'xlink:href': iconUrl });  
 }  
 return others;  
 },  
 // Port setup  
 ports: {  
 groups: {  
 'top': { position: 'top', attrs: { circle: {r: 4, magnet: true, stroke: '\#31d0c6', strokeWidth: 2, fill: '\#fff'} } },  
 'bottom': { position: 'bottom', attrs: { circle: {r: 4, magnet: true, stroke: '\#31d0c6', strokeWidth: 2, fill: '\#fff'} } },  
 'left': { position: 'left', attrs: { circle: {r: 4, magnet: true, stroke: '\#31d0c6', strokeWidth: 2, fill: '\#fff'} } },  
 'right': { position: 'right', attrs: { circle: {r: 4, magnet: true, stroke: '\#31d0c6', strokeWidth: 2, fill: '\#fff'} } },  
 },  
 // Default items (can be overridden instance by instance)  
 items: \[ { group: 'top' }, { group: 'bottom' }, { group: 'left' }, { group: 'right' } \]  
 }  
});  
Graph.registerNode('custom-rect', CustomRectNode, true /\* overwrite \*/);

// Using the custom node  
// graph.addNode({  
// shape: 'custom-rect',  
// x: 50, y: 250, width: 150, height: 60,  
// label: 'My Custom Node',  
// iconUrl: 'path/to/specific-icon.png', // Custom prop via propHooks  
// ports: { items: \[{group: 'in', id: 'in1'}, {group: 'out', id: 'out1'}\] } // Override default ports  
// });

// Custom Edge with animated dash  
class FlowingEdge extends Shape.Edge {  
 // Override methods if needed  
}  
FlowingEdge.config({  
 attrs: {  
 line: {  
 stroke: '\#A2B1C3',  
 strokeWidth: 2,  
 targetMarker: 'classic',  
 style: { // For CSS animations  
 animation: 'ant-line-flow 30s linear infinite',  
 },  
 },  
 },  
 // Define CSS for animation (usually in a global stylesheet)  
 // @keyframes ant-line-flow {  
 // to { stroke-dashoffset: \-1000; }  
 // }  
 // line: { strokeDasharray: '5 5', ... } // if using SVG dash animation directly  
});  
Graph.registerEdge('flowing-edge', FlowingEdge, true);

// graph.addEdge({  
// shape: 'flowing-edge',  
// source: { cell: 'id1' }, target: { cell: 'id2' },  
// });

_(For the animation, you'd also need to define the `@keyframes` in your CSS.)_

**4\. Event Handling**

TypeScript  
// Assuming 'graph' is an initialized Graph instance

graph.on('node:click', ({ node, e, x, y }) \=\> {  
 console.log(\`Node clicked: ${node.id}\`, node.prop('label'));  
 node.attr('body/stroke', 'orange'); // Highlight clicked node  
});

graph.on('node:mouseenter', ({ node }) \=\> {  
 node.addTools(\[ // Show a 'button-remove' tool on hover  
 {  
 name: 'button-remove',  
 args: {  
 x: 0, y: 0,  
 offset: { x: 10, y: 10 },  
 onClick: ({ cell }) \=\> { graph.removeCell(cell); },  
 },  
 },  
 {  
 name: 'boundary', // Show boundary tool  
 args: {  
 padding: 5,  
 attrs: { fill: 'none', stroke: '\#7c68fc', 'stroke-width': 2, 'stroke-dasharray': '5,5' },  
 },  
 }  
 \]);  
});

graph.on('node:mouseleave', ({ node }) \=\> {  
 if (node.hasTools()) {  
 node.removeTools();  
 }  
 node.attr('body/stroke', '\#5F95FF'); // Reset stroke  
});

graph.on('edge:connected', ({ edge, isNew, currentTerminal, previousTerminal }) \=\> {  
 if (isNew) {  
 console.log(\`New edge ${edge.id} connected.\`);  
 edge.attr('line/stroke', 'green');  
 }  
});

graph.on('blank:dblclick', ({ e, x, y }) \=\> {  
 graph.addNode({  
 shape: 'circle',  
 x: x, y: y, width: 30, height: 30,  
 label: 'New',  
 attrs: { body: { fill: 'lightgreen' } }  
 });  
});

// Listening to model changes for undo/redo or data persistence  
graph.on('cell:changed', ({ cell, options }) \=\> {  
 if (options.command) { // Check if change is part of a history command  
 console.log('Cell changed, potentially save:', cell.toJSON());  
 // Call your data persistence logic here  
 }  
});

**5\. Using Node/Edge Tools** Tools provide interactive elements on nodes or edges.

TypeScript  
// Adding tools dynamically (as seen in mouseenter event above)  
// Or define them statically when creating a cell:  
const nodeWithTools \= graph.addNode({  
 // ... other node props  
 tools: \[  
 'boundary', // Built-in boundary tool  
 {  
 name: 'button-remove',  
 args: { x: '100%', y: 0, offset: { x: \-15, y: 10 } } // Top-right corner  
 },  
 {  
 name: 'button',  
 args: {  
 markup: \[ // Custom button markup  
 { tagName: 'circle', selector: 'button', attrs: { r: 7, stroke: '\#fe854f', fill: 'white', cursor: 'pointer' } },  
 { tagName: 'text', selector: 'icon', text: 'E', attrs: { fill: '\#fe854f', fontSize: 10, textAnchor: 'middle', pointerEvents: 'none', y: '0.3em' } }  
 \],  
 x: 0, y: 0, offset: { x: 15, y: 15 },  
 onClick({ cell, view, e }) { alert(\`Edit clicked for ${cell.id}\`); }  
 }  
 }  
 \]  
});

// Edge tools  
// graph.addEdge({  
// // ... edge props  
// tools: \[  
// 'vertices', // Manipulate vertices  
// 'segments', // Manipulate segments (parts between vertices)  
// 'source-arrowhead',  
// 'target-arrowhead',  
// { name: 'button-remove', args: { distance: \-40 } } // Button along the edge  
// \]  
// });

**6\. Serialization and Deserialization**

TypeScript  
// Get JSON representation of the graph  
const jsonData \= graph.toJSON();  
console.log(JSON.stringify(jsonData));  
// This typically includes { cells: \[node1Data, node2Data, edge1Data, ...\] }

// Later, or in another instance, load from JSON  
// graph.clearCells(); // Clear existing graph if needed  
graph.fromJSON(jsonData); // or graph.fromJSON(jsonData.cells) if that's what you stored

// For specific options during serialization/deserialization:  
// graph.toJSON({ diff: true }) // only changed attributes  
// graph.fromJSON(data, { silent: false }) // trigger events

---

This guide provides a starting point. The AntV X6 library is rich in features and customization options. **The most critical step for a developer is to explore the `*.d.ts` TypeScript definition files within the `packages/x6/src` (and plugin folders) of the version you are using.** These files are the ultimate source of truth for API signatures, option objects, and available enumerations. The official examples ([https://x6.antv.vision/en/examples](https://x6.antv.vision/en/examples)) are also invaluable, but always validate them against the codebase if you suspect version differences.
