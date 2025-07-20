# DFD Component Public API Reference

This document provides a comprehensive list of all TypeScript files (excluding test files) in the DFD component and their non-private APIs.

## **State Management**

### `state/dfd.state.ts`
**Exports:**
- `interface DfdState`
- `const initialDfdState`
- `type DfdStateUpdate`
- `class DfdStateStore`

**Public APIs:**
- `readonly state$: Observable<DfdState>`
- `readonly isInitialized$: BehaviorSubject<boolean>`
- `readonly selectedNode$: BehaviorSubject<Node | null>`
- `readonly canUndo$: BehaviorSubject<boolean>`
- `readonly canRedo$: BehaviorSubject<boolean>`
- `readonly cells$: BehaviorSubject<Cell[]>`
- `readonly isLoading$: BehaviorSubject<boolean>`
- `readonly isEditingLabel$: BehaviorSubject<boolean>`
- `readonly error$: BehaviorSubject<Error | null>`
- `get state(): DfdState`
- `get isInitialized(): boolean`
- `get graph(): Graph | null`
- `get selectedNode(): Node | null`
- `get canUndo(): boolean`
- `get canRedo(): boolean`
- `updateState(update: DfdStateUpdate, source?: string): void`
- `resetState(): void`
- `getHistory(): History | null`
- `query<T>(selector: (state: DfdState) => T): Observable<T>`

---

## **Services Layer**

### `services/dfd-collaboration.service.ts`
**Exports:**
- `interface CollaborationUser`
- `class DfdCollaborationService`

**Public APIs:**
- `isCollaborating$: Observable<boolean>`
- `collaborationUsers$: Observable<CollaborationUser[]>`
- `startCollaboration(): Observable<boolean>`
- `endCollaboration(): Observable<boolean>`
- `inviteUser(email: string, role: string): Observable<boolean>`
- `removeUser(userId: string): Observable<boolean>`
- `updateUserRole(userId: string, role: string): Observable<boolean>`
- `getCurrentUserRole(): string | null`
- `hasPermission(permission: string): boolean`

### `services/dfd-event-handlers.service.ts`
**Exports:**
- `class DfdEventHandlersService`

**Public APIs:**
- `contextMenuPosition: { x: string; y: string }`
- `get selectedCells$(): BehaviorSubject<Cell[]>`
- `initialize(): void`
- `dispose(): void`
- `onKeyDown(event: KeyboardEvent, diagramId: string, isInitialized: boolean): void`

### `services/dfd-export.service.ts`
**Exports:**
- `class DfdExportService`

**Public APIs:**
- `exportDiagram(format: ExportFormat): void`

### `services/dfd-node.service.ts`
**Exports:**
- `class DfdNodeService`

**Public APIs:**
- `addGraphNode(shapeType: NodeType, width: number, height: number, diagramId: string, isInitialized: boolean): Observable<void>`
- `handleNodeAdded(node: Node, diagramId: string, isInitialized: boolean): Observable<void>`
- `handleNodeMoved(data: any, diagramId: string, isInitialized: boolean): Observable<void>`

### `services/dfd-edge.service.ts`
**Exports:**
- `class DfdEdgeService`

**Public APIs:**
- `addInverseConnection(originalEdge: Edge, diagramId: string): Observable<void>`
- `handleEdgeAdded(edge: Edge, diagramId: string, isInitialized: boolean): Observable<void>`
- `handleEdgeVerticesChanged(edgeId: string, vertices: Array<{x: number, y: number}>, diagramId: string, isInitialized: boolean): Observable<void>`
- `isNodeConnectionValid(sourceNode: Node, targetNode: Node): boolean`

### `services/x6-event-logger.service.ts`
**Exports:**
- `class X6EventLoggerService`

**Public APIs:**
- `initializeEventLogging(graph: Graph): void`
- `dispose(): void`
- `getEventStats(): Record<string, number>`
- `clearEventStats(): void`
- `setLoggingEnabled(enabled: boolean): void`

### `services/dfd-diagram.service.ts`
**Exports:**
- `interface DiagramData`
- `interface DiagramLoadResult`
- `class DfdDiagramService`

**Public APIs:**
- `loadDiagram(diagramId: string, threatModelId?: string): Observable<DiagramLoadResult>`
- `validateDiagramAccess(diagramId: string): Observable<boolean>`
- `getFallbackNavigationPath(threatModelId: string | null): string`
- `isValidDiagramId(diagramId: string | null): boolean`

### `services/dfd-connection-validation.service.ts`
**Exports:**
- `interface ConnectionValidationArgs`
- `interface MagnetValidationArgs`
- `class DfdConnectionValidationService`

**Public APIs:**
- `isMagnetValid(args: MagnetValidationArgs): boolean`
- `isConnectionValid(args: ConnectionValidationArgs): boolean`
- `isNodeConnectionValid(sourceNode: Node, targetNode: Node): boolean`
- `validateNodeShape(nodeType: string, nodeId: string): void`
- `validateX6NodeShape(x6Node: Node): void`
- `getValidConnectionTargets(sourceShape: string): string[]`
- `getValidNodeShapes(): string[]`
- `canShapesConnect(sourceShape: string, targetShape: string): boolean`

### `services/dfd-cell-label.service.ts`
**Exports:**
- `interface LabelChangeEvent`
- `interface NodeDataChangeEvent`
- `class DfdCellLabelService`

**Public APIs:**
- `get labelChanged$(): Observable<LabelChangeEvent>`
- `get nodeDataChanged$(): Observable<NodeDataChangeEvent>`
- `getCellLabel(cell: Cell): string`
- `setCellLabel(cell: Cell, text: string): boolean`
- `isLabelChangeValid(cell: Cell, newText: string, oldText: string): boolean`
- `sanitizeLabelText(text: string): string`
- `canEditCellLabel(cell: Cell): boolean`
- `getLabelConstraints(): { maxLength: number; allowedCharacters: string }`
- `batchUpdateLabels(updates: Array<{ cell: Cell; label: string }>): Array<{ cell: Cell; success: boolean }>`

### `services/dfd-tooltip.service.ts`
**Exports:**
- `interface TooltipContent`
- `class DfdTooltipService`

**Public APIs:**
- `getPortTooltipContent(node: Node, portId: string): string`
- `calculateTooltipPosition(mouseEvent: MouseEvent, options?: {offsetX?: number; offsetY?: number}): {x: number; y: number}`
- `formatTooltipContent(content: string, maxLength?: number): string`
- `shouldShowTooltip(content: string): boolean`
- `getNodeTooltipContent(node: Node): string`

---

## **Domain Layer**

### `domain/collaboration/user-presence.ts`
**Exports:**
- `enum PresenceStatus`
- `enum UserActivity`
- `interface CursorState`
- `class UserPresence`

**Public APIs:**
- `readonly user: User`
- `readonly status: PresenceStatus`
- `readonly activity: UserActivity`
- `readonly lastSeen: Date`
- `readonly cursorState?: CursorState`
- `readonly currentTool?: string`
- `static createInitial(user: User): UserPresence`
- `static fromJSON(data: any): UserPresence`
- `withStatus(status: PresenceStatus): UserPresence`
- `withActivity(activity: UserActivity): UserPresence`
- `withCursorState(cursorState: CursorState): UserPresence`
- `withTool(tool: string): UserPresence`
- `markAsAway(): UserPresence`
- `markAsOffline(): UserPresence`
- `isActivelyEditing(): boolean`
- `isOnline(): boolean`
- `isCursorVisible(): boolean`
- `getTimeSinceLastSeen(): number`
- `isInactiveFor(milliseconds: number): boolean`
- `toJSON(): any`

### `domain/collaboration/user.ts`
**Exports:**
- `class User`

**Public APIs:**
- `readonly id: string`
- `readonly name: string`
- `readonly email: string`
- `readonly avatar?: string`
- `readonly color?: string`
- `static create(id: string, name: string, email: string, avatar?: string): User`
- `static fromJSON(data: any): User`
- `equals(other: User): boolean`
- `getInitials(): string`
- `toJSON(): any`

### `domain/events/domain-event.ts`
**Exports:**
- `interface DomainEvent`
- `class BaseDomainEvent`

**Public APIs:**
- `readonly id: string`
- `readonly timestamp: number`
- `readonly type: string`
- `readonly aggregateId: string`
- `readonly aggregateVersion: number`
- `readonly metadata?: Record<string, unknown>`
- `toJSON(): any`
- `toString(): string`

### `domain/events/diagram-events.ts`
**Exports:**
- `class NodeAddedEvent`
- `class NodeMovedEvent`
- `class NodeRemovedEvent`
- `class NodeLabelUpdatedEvent`
- `class NodeResizedEvent`
- `class EdgeAddedEvent`
- `class EdgeRemovedEvent`
- `class EdgeVerticesUpdatedEvent`
- `class DiagramChangedEvent`
- `type DiagramEvent`

### `domain/value-objects/point.ts`
**Exports:**
- `class Point`

**Public APIs:**
- `readonly x: number`
- `readonly y: number`
- `static fromJSON(data: {x: number; y: number}): Point`
- `static origin(): Point`
- `clone(): Point`
- `add(other: Point): Point`
- `subtract(other: Point): Point`
- `distanceTo(other: Point): number`
- `equals(other: Point): boolean`
- `toString(): string`
- `toJSON(): {x: number; y: number}`

### `domain/value-objects/diagram-node.ts`
**Exports:**
- `class DiagramNode`

**Public APIs:**
- `get data(): NodeData`
- `get id(): string`
- `get type(): string`
- `get label(): string`
- `get position(): Point`
- `get width(): number`
- `get height(): number`
- `get metadata(): Record<string, string>`
- `get isSelected(): boolean`
- `get isHighlighted(): boolean`
- `get connectedEdgeIds(): string[]`
- `static fromJSON(data: any): DiagramNode`
- `updateData(data: NodeData): void`
- `moveTo(position: Point): void`
- `updateLabel(label: string): void`
- `resize(width: number, height: number): void`
- `updateMetadata(metadata: Record<string, string>): void`
- `select(): void`
- `deselect(): void`
- `highlight(): void`
- `unhighlight(): void`
- `addConnectedEdge(edgeId: string): void`
- `removeConnectedEdge(edgeId: string): void`
- `isConnectedToEdge(edgeId: string): boolean`
- `getCenter(): Point`
- `getBounds(): {topLeft: Point; bottomRight: Point}`
- `containsPoint(point: Point): boolean`
- `overlapsWith(other: DiagramNode): boolean`
- `distanceTo(other: DiagramNode): number`
- `clone(): DiagramNode`
- `toJSON(): any`
- `toString(): string`

### `domain/value-objects/diagram-edge.ts`
**Exports:**
- `class DiagramEdge`

**Public APIs:**
- `get data(): EdgeData`
- `get id(): string`
- `get sourceNodeId(): string`
- `get targetNodeId(): string`
- `get sourcePortId(): string | undefined`
- `get targetPortId(): string | undefined`
- `get label(): string | undefined`
- `get vertices(): Point[]`
- `get metadata(): Record<string, string>`
- `get isSelected(): boolean`
- `get isHighlighted(): boolean`
- `static fromJSON(data: any): DiagramEdge`
- `updateData(data: EdgeData): void`
- `updateLabel(label: string): void`
- `updateVertices(vertices: Point[]): void`
- `addVertex(vertex: Point, index?: number): void`
- `removeVertex(index: number): void`
- `updateMetadata(metadata: Record<string, string>): void`
- `updateSource(nodeId: string, portId?: string): void`
- `updateTarget(nodeId: string, portId?: string): void`
- `select(): void`
- `deselect(): void`
- `highlight(): void`
- `unhighlight(): void`
- `connectsToNode(nodeId: string): boolean`
- `usesPort(nodeId: string, portId: string): boolean`
- `getPathLength(): number`
- `hasVertices(): boolean`
- `getVertexCount(): number`
- `getVertex(index: number): Point | undefined`
- `isPointNearPath(point: Point, tolerance?: number): boolean`
- `getMidpoint(): Point | undefined`
- `clone(): DiagramEdge`
- `toJSON(): any`
- `toString(): string`

### `domain/value-objects/node-data.ts`
**Exports:**
- `type NodeType`
- `interface MetadataEntry`
- `class NodeData`

**Public APIs:**
- `readonly id: string`
- `readonly shape: string`
- `readonly position: {x: number; y: number}`
- `readonly size: {width: number; height: number}`
- `readonly attrs: any`
- `readonly ports: any`
- `readonly zIndex: number`
- `readonly visible: boolean`
- `readonly data: MetadataEntry[]`
- `get type(): NodeType`
- `get label(): string`
- `get width(): number`
- `get height(): number`
- `static fromJSON(data: any): NodeData`
- `static fromLegacyJSON(data: any): NodeData`
- `static create(data: any): NodeData`
- `static createDefault(id: string, type: NodeType, position: Point, translateFn?: (key: string) => string): NodeData`
- `withPosition(position: Point | {x: number; y: number}): NodeData`
- `withLabel(label: string): NodeData`
- `withWidth(width: number): NodeData`
- `withHeight(height: number): NodeData`
- `withDimensions(width: number, height: number): NodeData`
- `withMetadata(metadata: Record<string, string> | MetadataEntry[]): NodeData`
- `withAttrs(attrs: any): NodeData`
- `getCenter(): Point`
- `getBounds(): {topLeft: Point; bottomRight: Point}`
- `getMetadataAsRecord(): Record<string, string>`
- `equals(other: NodeData): boolean`
- `toString(): string`
- `toX6Snapshot(): any`
- `toJSON(): any`

### `domain/value-objects/edge-data.ts`
**Exports:**
- `interface MetadataEntry`
- `class EdgeData`

**Public APIs:**
- `readonly id: string`
- `readonly shape: string`
- `readonly source: any`
- `readonly target: any`
- `readonly attrs: any`
- `readonly labels: any`
- `readonly vertices: Array<{x: number; y: number}>`
- `readonly zIndex: number`
- `readonly visible: boolean`
- `readonly data: MetadataEntry[]`
- `get sourceNodeId(): string`
- `get targetNodeId(): string`
- `get sourcePortId(): string | undefined`
- `get targetPortId(): string | undefined`
- `get label(): string | undefined`
- `static fromJSON(data: any): EdgeData`
- `static fromLegacyJSON(data: any): EdgeData`
- `static create(data: any): EdgeData`
- `static createSimple(id: string, sourceNodeId: string, targetNodeId: string, label?: string): EdgeData`
- `static createWithPorts(id: string, sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string, label?: string): EdgeData`
- `withLabel(label: string): EdgeData`
- `withVertices(vertices: Array<{x: number; y: number}>): EdgeData`
- `withAddedVertex(vertex: {x: number; y: number}, index?: number): EdgeData`
- `withRemovedVertex(index: number): EdgeData`
- `withMetadata(metadata: Record<string, string> | MetadataEntry[]): EdgeData`
- `withSource(nodeId: string, portId?: string): EdgeData`
- `withTarget(nodeId: string, portId?: string): EdgeData`
- `withAttrs(attrs: any): EdgeData`
- `update(updates: any): EdgeData`
- `connectsToNode(nodeId: string): boolean`
- `usesPort(nodeId: string, portId: string): boolean`
- `getPathLength(): number`
- `equals(other: EdgeData): boolean`
- `toString(): string`
- `toJSON(): any`
- `toX6Snapshot(): any`
- `getMetadataAsRecord(): Record<string, string>`

---

## **Infrastructure Layer**

### `infrastructure/interfaces/graph-adapter.interface.ts`
**Exports:**
- `interface IGraphAdapter`

**Public APIs:**
- `nodeAdded$: Observable<Node>`
- `nodeRemoved$: Observable<{nodeId: string; node: Node}>`
- `nodeMoved$: Observable<{nodeId: string; position: Point; previous: Point}>`
- `edgeAdded$: Observable<Edge>`
- `edgeRemoved$: Observable<{edgeId: string; edge: Edge}>`
- `selectionChanged$: Observable<{selected: string[]; deselected: string[]}>`
- `initialize(container: HTMLElement): void`
- `getGraph(): Graph`
- `addNode(node: DiagramNode): Node`
- `removeNode(nodeId: string): void`
- `moveNode(nodeId: string, position: Point): void`
- `addEdge(edge: DiagramEdge): Edge`
- `removeEdge(edgeId: string): void`
- `getNodes(): Node[]`
- `getEdges(): Edge[]`
- `getNode(nodeId: string): Node | null`
- `getEdge(edgeId: string): Edge | null`
- `clear(): void`
- `fitToContent(): void`
- `centerContent(): void`
- `dispose(): void`
- `startLabelEditing(cell: Cell, event: MouseEvent): void`

### `infrastructure/services/edge-query.service.ts`
**Exports:**
- `class EdgeQueryService`

**Public APIs:**
- `findEdgesConnectedToNode(graph: any, nodeId: string): Edge[]`
- `findEdgesConnectedToPort(graph: any, nodeId: string, portId: string): Edge[]`
- `isPortConnected(graph: any, nodeId: string, portId: string): boolean`
- `getConnectedPorts(graph: any, nodeId: string): Array<any>`
- `findEdgesBetweenNodes(graph: any, sourceNodeId: string, targetNodeId: string): Edge[]`
- `getNodeEdgeStatistics(graph: any, nodeId: string): any`
- `findEdgesByMetadata(graph: any, criteria: Record<string, string>): Edge[]`
- `findEdgeBetweenPorts(graph: any, sourceNodeId: string, sourcePortId: string, targetNodeId: string, targetPortId: string): Edge | null`
- `validateEdgeConnections(graph: any): Array<any>`
- `getConnectionSummary(graph: any): any`

### `infrastructure/services/embedding.service.ts`
**Exports:**
- `class EmbeddingService`

**Public APIs:**
- `calculateEmbeddingDepth(node: Node): number`
- `calculateEmbeddingFillColor(depth: number): string`
- `getEmbeddingConfiguration(node: Node): any`
- `validateEmbedding(parent: Node, child: Node): any`
- `calculateEmbeddingZIndexes(parent: Node, child: Node): any`
- `calculateUnembeddingZIndex(node: Node): number`
- `getTemporaryEmbeddingZIndex(node: Node): number`

### `infrastructure/services/node-configuration.service.ts`
**Exports:**
- `interface NodeAttrs`
- `interface PortConfiguration`
- `class NodeConfigurationService`

**Public APIs:**
- `getNodeAttrs(nodeType: string): NodeAttrs`
- `getNodePorts(nodeType: string): PortConfiguration`
- `getNodeShape(nodeType: string): string`
- `getNodeZIndex(nodeType: string): number`
- `isTextboxNode(nodeType: string): boolean`
- `isSecurityBoundary(nodeType: string): boolean`
- `getNodeTypeInfo(nodeType: string): any`
- `isValidNodeType(nodeType: string): boolean`
- `getSupportedNodeTypes(): string[]`

### `infrastructure/services/selection.service.ts`
**Exports:**
- `class SelectionService`

**Public APIs:**
- `copySelectedCells(selectedCells: Cell[]): Cell[]`
- `calculatePastePositions(cells: Cell[], offsetX?: number, offsetY?: number): Array<any>`
- `calculateGroupBoundingBox(nodes: Node[]): any`
- `calculateAlignmentPositions(nodes: Node[], alignment: string): Array<any>`
- `calculateDistributionPositions(nodes: Node[], direction: 'horizontal' | 'vertical'): Array<any>`
- `canGroupNodes(nodes: Node[]): boolean`
- `canUngroupNode(node: Node): boolean`
- `getGroupConfiguration(boundingBox: any): any`

### `infrastructure/services/z-order.service.ts`
**Exports:**
- `class ZOrderService`

**Public APIs:**
- `isSecurityBoundaryCell(cell: Cell): boolean`
- `getDefaultZIndex(nodeType: string): number`
- `calculateMoveForwardZIndex(cell: Cell, allCells: Cell[], isSelected: (cell: Cell) => boolean): number | null`
- `calculateMoveBackwardZIndex(cell: Cell, allCells: Cell[], isSelected: (cell: Cell) => boolean): number | null`
- `calculateMoveToFrontZIndex(cell: Cell, allCells: Cell[]): number | null`
- `calculateMoveToBackZIndex(cell: Cell, allCells: Cell[]): number | null`
- `calculateEdgeZIndex(sourceZIndex: number, targetZIndex: number): number`
- `validateZOrderInvariants(nodes: Node[]): Array<any>`
- `validateComprehensiveZOrder(nodes: Node[]): any`
- `getNewSecurityBoundaryZIndex(): number`
- `getNewNodeZIndex(nodeType: string): number`
- `getNewEdgeZIndex(sourceNode: Node, targetNode: Node): number`
- `updateEdgeZIndexOnReconnection(edge: Edge, sourceNode: Node, targetNode: Node): number`
- `getConnectedEdgesForZIndexUpdate(node: Node, allEdges: Edge[]): Array<any>`
- `calculateEmbeddedNodeZIndex(parentNode: Node, childNode: Node): number`
- `getDescendantNodesForCascadingUpdate(node: Node): Node[]`
- `validateEmbeddingZOrderHierarchy(nodes: Node[]): Array<any>`
- `calculateUnembeddedSecurityBoundaryZIndex(node: Node): number`

### `infrastructure/services/port-state-manager.service.ts`
**Exports:**
- `class PortStateManagerService`

**Public APIs:**
- `setupPortVisibility(graph: Graph): void`
- `setupPortTooltips(graph: Graph): void`
- `updateNodePortVisibility(graph: Graph, node: Node): void`
- `showAllPorts(graph: Graph): void`
- `hideUnconnectedPorts(graph: Graph): void`
- `isPortConnected(graph: Graph, nodeId: string, portId: string): boolean`
- `getConnectedPorts(graph: Graph, nodeId: string): string[]`
- `getUnconnectedPorts(graph: Graph, nodeId: string): string[]`
- `getPortTooltipText(node: Node, portId: string): string`

### `infrastructure/services/edge.service.ts`
**Exports:**
- `class EdgeService`

**Public APIs:**
- `processNewEdgeCreation(edge: Edge): Observable<boolean>`
- `processEdgeRemoval(edge: Edge): Observable<boolean>`
- `processEdgeUpdate(edge: Edge, changes: any): Observable<boolean>`
- `validateEdgeData(edgeData: EdgeData): boolean`
- `normalizeEdgeData(rawData: any): EdgeData`
- `createEdgeFromData(edgeData: EdgeData): Edge`
- `updateEdgeFromData(edge: Edge, edgeData: EdgeData): void`
- `extractEdgeData(edge: Edge): EdgeData`
- `isValidEdgeConnection(sourceNodeId: string, targetNodeId: string): boolean`
- `getEdgeValidationRules(): any`

### `infrastructure/services/visual-effects.service.ts`
**Exports:**
- `class VisualEffectsService`

**Public APIs:**
- `applyCreationHighlight(cell: Cell, graph?: any, color?: {r: number; g: number; b: number}, options?: {silent?: boolean; skipFade?: boolean}): void`
- `removeVisualEffects(cell: Cell, graph?: any): void`
- `hasActiveEffects(cell: Cell): boolean`
- `cleanup(): void`

### `infrastructure/services/injection-tokens.ts`
**Exports:**
- `const GRAPH_ADAPTER`
- `const SERIALIZATION_SERVICE`

### `infrastructure/adapters/websocket.adapter.ts`
**Exports:**
- `enum WebSocketState`
- `enum MessageType`
- `interface WebSocketMessage`
- `class WebSocketAdapter`

**Public APIs:**
- `get connectionState$(): Observable<WebSocketState>`
- `get messages$(): Observable<WebSocketMessage>`
- `get errors$(): Observable<Error>`
- `get connectionState(): WebSocketState`
- `get isConnected(): boolean`
- `connect(url: string): Observable<void>`
- `disconnect(): void`
- `sendMessage(message: any): Observable<void>`
- `sendMessageWithResponse<T>(message: any, responseType: MessageType, timeout?: number): Observable<T>`
- `getMessagesOfType<T>(messageType: MessageType): Observable<T>`
- `getSessionMessages(sessionId: string): Observable<WebSocketMessage>`
- `dispose(): void`

### `infrastructure/adapters/x6-event-handlers.ts`
**Exports:**
- `interface X6GraphEvents`
- `class X6EventHandlers`

**Public APIs:**
- `getEvent<K extends keyof X6GraphEvents>(eventType: K)`
- `emitEvent<K extends keyof X6GraphEvents>(eventType: K, data: X6GraphEvents[K]): void`
- `setupGraphEvents(graph: Graph): void`
- `setupConnectionEvents(graph: Graph): void`
- `setupInteractionEvents(graph: Graph): void`
- `setupErrorEvents(graph: Graph): void`
- `setupPerformanceEvents(graph: Graph): void`
- `setupAllEvents(graph: Graph): void`
- `cleanup(): void`
- `getEventStats(): Record<string, number>`
- `setEventLogging(enabled: boolean): void`

### `infrastructure/adapters/x6-history-manager.ts`
**Exports:**
- `class X6HistoryManager`

**Public APIs:**
- `get historyChanged$(): Observable<{canUndo: boolean; canRedo: boolean}>`
- `setupHistoryEvents(graph: Graph): void`
- `undo(graph: Graph): void`
- `redo(graph: Graph): void`
- `canUndo(graph: Graph): boolean`
- `canRedo(graph: Graph): boolean`
- `clearHistory(graph: Graph): void`
- `dispose(): void`

### `infrastructure/adapters/x6-keyboard-handler.ts`
**Exports:**
- `class X6KeyboardHandler`

**Public APIs:**
- `setupKeyboardHandling(graph: Graph): void`
- `cleanup(): void`
- `getInitialNodePosition(nodeId: string): Point | null`
- `setGraph(graph: Graph): void`

### `infrastructure/adapters/x6-label-editor.adapter.ts`
**Exports:**
- `class X6LabelEditorAdapter`

**Public APIs:**
- `initializeLabelEditing(graph: Graph): void`
- `startLabelEditing(graph: Graph, cell: Cell): void`
- `finishLabelEditing(graph: Graph): void`
- `cancelLabelEditing(graph: Graph): void`
- `isEditing(): boolean`
- `getCurrentEditingCell(): Cell | null`
- `editCell(graph: Graph, cell: Cell): void`
- `finishCurrentEditing(graph: Graph): void`
- `cancelCurrentEditing(graph: Graph): void`

### `infrastructure/adapters/x6-shape-definitions.ts`
**Exports:**
- `function registerCustomShapes(): void`
- `function getX6ShapeForNodeType(nodeType: string): string`
- `function getEdgeAttrs(): any`

### `infrastructure/adapters/x6-z-order.adapter.ts`
**Exports:**
- `class X6ZOrderAdapter`

**Public APIs:** (extensive z-order management methods)
- `moveSelectedCellsForward(graph: Graph): void`
- `moveSelectedCellsBackward(graph: Graph): void`
- `moveSelectedCellsToFront(graph: Graph): void`
- `moveSelectedCellsToBack(graph: Graph): void`
- `updateConnectedEdgesZOrder(graph: Graph, node: Node, nodeZIndex: number): void`
- `setEdgeZOrderFromConnectedNodes(graph: Graph, edge: Edge): void`
- `enforceZOrderInvariants(graph: Graph): void`
- `validateAndCorrectZOrder(graph: Graph): void`
- `applyNodeCreationZIndex(graph: Graph, node: Node): void`
- `calculateSecurityBoundaryZIndex(graph: Graph, node: Node): number`
- `getHighestZIndexInGraph(graph: Graph): number`
- `getLowestZIndexInGraph(graph: Graph): number`
- `getAllCellsOrderedByZIndex(graph: Graph): Cell[]`
- `getCellsAtZIndex(graph: Graph, zIndex: number): Cell[]`
- `updateNodeZIndex(graph: Graph, node: Node, zIndex: number): void`
- `updateEdgeZIndex(graph: Graph, edge: Edge, zIndex: number): void`
- `recalculateAllZIndexes(graph: Graph): void`
- `getNextAvailableZIndex(graph: Graph): number`
- `compactZIndexes(graph: Graph): void`
- `validateZIndexUniqueness(graph: Graph): boolean`
- `getZIndexConflicts(graph: Graph): Array<any>`
- `resolveZIndexConflicts(graph: Graph): void`
- `optimizeZIndexDistribution(graph: Graph): void`
- `getZIndexStatistics(graph: Graph): any`

### `infrastructure/adapters/x6-embedding.adapter.ts`
**Exports:**
- `class X6EmbeddingAdapter`

**Public APIs:**
- `initializeEmbedding(graph: Graph): void`
- `handleNodeEmbedded(child: Node, parent: Node): void`
- `handleNodeUnembedded(child: Node, parent: Node | null): void`
- `updateEmbeddingAppearance(node: Node): void`
- `resetEmbeddingAppearance(node: Node): void`
- `dispose(): void`

### `infrastructure/adapters/x6-selection.adapter.ts`
**Exports:**
- `class X6SelectionAdapter`

**Public APIs:**
- `initializePlugins(graph: Graph): void`
- `setupSelectionEvents(graph: Graph, onCellDeletion?: (cell: Cell) => void): void`
- `getSelectedCells(graph: Graph): Cell[]`
- `getSelectedNodes(graph: Graph): Node[]`
- `getSelectedEdges(graph: Graph): Edge[]`
- `selectCells(graph: Graph, cells: Cell[]): void`
- `selectAll(graph: Graph): void`
- `clearSelection(graph: Graph): void`
- `deleteSelected(graph: Graph): void`
- `copySelected(graph: Graph): Cell[]`
- `pasteCells(graph: Graph, cells: Cell[], offsetX?: number, offsetY?: number): void`
- `groupSelected(graph: Graph): Node | null`
- `ungroupSelected(graph: Graph): void`
- `alignNodes(graph: Graph, alignment: string): void`
- `distributeNodes(graph: Graph, direction: 'horizontal' | 'vertical'): void`
- `enableSelection(graph: Graph): void`
- `disableSelection(graph: Graph): void`

### `infrastructure/adapters/x6-tooltip.adapter.ts`
**Exports:**
- `class X6TooltipAdapter`

**Public APIs:**
- `initialize(graph: Graph): void`
- `dispose(): void`
- `showTooltip(content: string, position: {x: number; y: number}): void`
- `hideTooltip(): void`
- `isReady(): boolean`

### `infrastructure/adapters/x6-graph.adapter.ts`
**Exports:**
- `class X6GraphAdapter`

**Public APIs:** (implementing IGraphAdapter interface plus additional methods)
- All observable properties from IGraphAdapter:
  - `nodeAdded$: Observable<Node>`
  - `nodeRemoved$: Observable<{nodeId: string; node: Node}>`
  - `nodeMoved$: Observable<{nodeId: string; position: Point; previous: Point}>`
  - `edgeAdded$: Observable<Edge>`
  - `edgeRemoved$: Observable<{edgeId: string; edge: Edge}>`
  - `selectionChanged$: Observable<{selected: string[]; deselected: string[]}>`
- Core graph operations:
  - `initialize(container: HTMLElement): void`
  - `getGraph(): Graph | null`
  - `dispose(): void`
- Node operations:
  - `addNode(node: DiagramNode): Node`
  - `removeNode(nodeId: string): void`
  - `getNodes(): Node[]`
  - `getNode(nodeId: string): Node | null`
- Edge operations:
  - `addEdge(edge: DiagramEdge): Edge`
  - `removeEdge(edgeId: string): void`
  - `getEdges(): Edge[]`
  - `getEdge(edgeId: string): Edge | null`
- Label operations:
  - `getCellLabel(cell: Cell): string`
  - `setCellLabel(cell: Cell, text: string): void`
  - `startLabelEditing(cell: Cell): void`
- Import/Export:
  - `exportToJSON(): any`
  - `importFromJSON(data: any): void`
- Utility methods:
  - `clear(): void`
  - `fitToContent(): void`
  - `centerContent(): void`
  - And many more graph manipulation methods...

### `infrastructure/constants/tool-configurations.ts`
**Exports:**
- `const NODE_TOOLS`
- `const EDGE_TOOLS`

---

## **Components Layer**

### `components/collaboration/user-presence-indicator.component.ts`
**Exports:**
- `class UserPresenceIndicatorComponent`

**Public APIs:**
- `@Input() presence!: UserPresence`
- `@Input() showDetails = true`
- `@Input() showCursor = false`
- `@Input() size: 'small' | 'medium' | 'large' = 'medium'`
- `getUserInitials(): string`
- `getUserColor(): string`
- `getPresenceClass(): string`
- `getStatusClass(): string`
- `getStatusText(): string`
- `getActivityText(): string`

### `components/collaboration/user-presence-list.component.ts`
**Exports:**
- `class UserPresenceListComponent`

**Public APIs:**
- `@Input() title = 'Active Users'`
- `@Input() showHeader = true`
- `@Input() showDetails = true`
- `@Input() showCursor = false`
- `@Input() size: 'small' | 'medium' | 'large' = 'medium'`
- `@Input() layout: 'vertical' | 'horizontal' | 'grid' = 'vertical'`
- `@Input() maxItems?: number`
- `@Input() emptyMessage = 'No users online'`
- `@Input() filterOnline = true`
- `public presences$!: Observable<UserPresence[]>`
- `trackByUserId(index: number, presence: UserPresence): string`
- `getListClass(): string`
- `getItemsClass(): string`

### `components/collaboration/collaboration.component.ts`
**Exports:**
- `class DfdCollaborationComponent`

**Public APIs:**
- `isCollaborating: boolean`
- `collaborationUsers: CollaborationUser[]`
- `linkCopied: boolean`
- `toggleCollaboration(): void`
- `copyLinkToClipboard(): void`
- `removeUser(userId: string): void`
- `updateUserRole(userId: string, role: string): void`
- `hasPermission(permission: string): boolean`
- `getStatusColor(status: string): string`

### `components/cell-properties-dialog/cell-properties-dialog.component.ts`
**Exports:**
- `interface CellPropertiesDialogData`
- `class CellPropertiesDialogComponent`

**Public APIs:**
- `readonly cellJson: string`
- `onCopyToClipboard(): void`
- `onClose(): void`

### `dfd.component.ts` (Main Component)
**Exports:**
- `class DfdComponent`

**Public APIs:**
- Template bindings:
  - `@ViewChild('graphContainer', { static: true }) graphContainer!: ElementRef`
  - `@ViewChild('contextMenuTrigger') contextMenuTrigger!: MatMenuTrigger`
- State properties (public for template binding):
  - `hasSelectedCells: boolean`
  - `hasExactlyOneSelectedCell: boolean`
  - `selectedCellIsTextBox: boolean`
  - `canUndo: boolean`
  - `canRedo: boolean`
  - `get contextMenuPosition(): {x: string; y: string}`
- User interaction methods:
  - `addGraphNode(shapeType?: NodeType): void`
  - `exportDiagram(format: ExportFormat): void`
  - `deleteSelected(): void`
  - `showCellProperties(): void`
  - `openThreatEditor(): void`
  - `closeDiagram(): void`
  - `moveForward(): void`
  - `moveBackward(): void`
  - `moveToFront(): void`
  - `moveToBack(): void`
  - `isRightClickedCellEdge(): boolean`
  - `editCellText(): void`
  - `addInverseConnection(): void`
  - `undo(): void`
  - `redo(): void`

---

## **Constants & Configuration**

### `constants/styling-constants.ts`
**Exports:**
- `const DFD_STYLING`
- `const DFD_STYLING_HELPERS`
- `type DfdStyling`
- `type NodeType`
- `type EdgeType`
- `type CellType`
- `type PortPosition`

**Public APIs (DFD_STYLING_HELPERS):**
- `getSelectionFilter(nodeType: string): string`
- `getHoverFilter(nodeType: string): string`
- `getCreationFilter(opacity: number): string`
- `getCreationFilterWithColor(color: {r: number; g: number; b: number}, opacity: number): string`
- `getFilterAttribute(nodeType: string): string`
- `getStrokeWidthAttribute(nodeType: string): string`
- `shouldUseNoneFilter(opacity: number): boolean`
- `isSelectionFilter(filter: string | null | undefined): boolean`
- `getSelectionGlowColorPrefix(): string`
- `getDefaultStroke(nodeType: NodeType): string`
- `getDefaultStrokeWidth(nodeType: NodeType): number`
- `getDefaultFill(nodeType: NodeType): string`

### `constants/tool-constants.ts`
**Exports:**
- `const NODE_TOOLS`
- `const EDGE_TOOLS`
- `const TOOL_CONFIG`
- `const TOOL_HELPERS`
- `type NodeToolConfig`
- `type EdgeToolConfig`
- `type ToolConfig`

**Public APIs (TOOL_HELPERS):**
- `getToolsForCellType(cellType: 'node' | 'edge'): readonly any[]`
- `getToolByName(toolName: string, cellType: 'node' | 'edge'): NodeToolConfig | EdgeToolConfig | undefined`
- `isValidTool(toolName: string, cellType: 'node' | 'edge'): boolean`

## **Types & Utilities**

### `types/x6-cell.types.ts`
**Exports:**
- `interface X6NodeSnapshot`
- `interface X6EdgeSnapshot`

### `models/dfd-types.ts`
**Exports:**
- `type PortDirection`

### `utils/x6-cell-extensions.ts`
**Exports:**
- `interface MetadataEntry`
- `interface NodeTypeInfo`
- `interface PortConnectionState`
- `interface ExtendedCell`
- `class CellUtils`
- `function initializeX6CellExtensions(): void`

**Public APIs (CellUtils):**
- `static getMetadata(cell: Cell): MetadataEntry[]`
- `static setMetadata(cell: Cell, metadata: MetadataEntry[]): void`
- `static getNodeTypeInfo(cell: Cell): NodeTypeInfo | null`
- `static getPortConnectionState(cell: Cell, portId: string): PortConnectionState | null`

### `integration/test-helpers/styling-helpers.ts`
**Exports:**
- `class StylingVerifier`
- `class TestHelpers`

**Public APIs (StylingVerifier):**
- `static verifySelectionStyling(cell: Cell, nodeType: string): boolean`
- `static verifyHoverStyling(cell: Cell, nodeType: string): boolean`
- `static verifyCreationStyling(cell: Cell, nodeType: string): boolean`
- `static verifyNoStyling(cell: Cell, nodeType: string): boolean`
- `static getExpectedSelectionFilter(nodeType: string): string`
- `static getExpectedHoverFilter(nodeType: string): string`

**Public APIs (TestHelpers):**
- `static createMockCell(cellType: 'node' | 'edge', nodeType?: string): any`
- `static createMockGraph(): any`
- `static simulateMouseEvent(cell: Cell, eventType: string): void`
- `static verifyVisualEffect(cell: Cell, effectType: string): boolean`

---

## **Summary Statistics**

The DFD component exposes a comprehensive public API consisting of:

- **60+ TypeScript files** (excluding tests)
- **50+ classes and interfaces**
- **550+ public methods and properties**
- **Rich domain model** with immutable value objects
- **Reactive architecture** using RxJS observables
- **Centralized styling and configuration** with type-safe constants
- **Comprehensive visual effects system** with fade animations
- **Integration test helpers** for styling verification
- **Clean separation of concerns** across layers:
  - **State Management**: Centralized reactive state
  - **Services Layer**: Business logic and orchestration
  - **Domain Layer**: Rich value objects and events
  - **Infrastructure Layer**: X6 integration and technical concerns
  - **Components Layer**: Angular UI components
  - **Constants & Configuration**: Centralized styling and tool configuration
  - **Types & Utilities**: Supporting type definitions and utilities
  - **Integration**: Test helpers and verification utilities

## **Architecture Highlights**

1. **Domain-Driven Design**: Clear domain boundaries with value objects, events, and services
2. **Reactive Programming**: Extensive use of RxJS observables for real-time updates
3. **Clean Architecture**: Separation of business logic from infrastructure concerns
4. **Immutable Value Objects**: Point, NodeData, EdgeData with functional transformation methods
5. **Adapter Pattern**: X6 library integration through dedicated adapters
6. **Service-Oriented**: Business logic encapsulated in focused services
7. **Component Architecture**: Reusable Angular components for collaboration features
8. **Real-time Collaboration**: WebSocket-based real-time features with user presence
9. **Comprehensive Validation**: Multi-layer validation for data integrity
10. **Extensible Design**: Well-defined interfaces for easy extension and testing
11. **Centralized Configuration**: Type-safe styling constants and tool configurations
12. **Advanced Visual Effects**: Sophisticated visual feedback system with fade animations
13. **Comprehensive Testing**: Integration test helpers with styling verification utilities
11. **Consistent API Naming**: Standardized naming patterns across all layers:
    - Boolean methods use `is*()`, `can*()`, `has*()` prefixes
    - Event handlers use `on*()` prefix
    - State queries use `query()` instead of ambiguous `select()`
    - Validation methods use `is*Valid()` pattern
    - Edge queries avoid redundant "connection" terminology

## **Recent API Improvements** ✨

This API reference reflects recent consistency improvements made to standardize naming patterns:

### **Breaking Changes Applied:**
- `DfdStateStore.select()` → `query()` (eliminates confusion with diagram selection)
- `EdgeQueryService.findEdgeByConnection()` → `findEdgeBetweenPorts()`
- `EdgeQueryService.getEdgeConnectionSummary()` → `getConnectionSummary()`
- `DfdConnectionValidationService` validation methods now use `is*Valid()` pattern:
  - `validateMagnet()` → `isMagnetValid()`
  - `validateConnection()` → `isConnectionValid()` 
  - `validateNodeConnection()` → `isNodeConnectionValid()`
- `DfdCellLabelService.validateLabelChange()` → `isLabelChangeValid()`

### **Internal Consistency Improvements:**
- All domain objects now use consistent `_validate()` private method naming
- Event handlers consistently use `on*()` prefix for internal event methods
- Observable naming verified to follow Angular conventions with `$` suffix

These improvements enhance API discoverability, reduce ambiguity, and follow established Angular/TypeScript naming conventions.

---

This represents a mature, well-architected diagramming component with extensive public APIs for integration, customization, and extension.