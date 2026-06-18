/**
 * Narrow structural interfaces for X6 cells and graphs.
 *
 * The DFD presentation services depend on these interfaces instead of X6's
 * concrete `Cell` / `Graph` classes. X6's real types structurally satisfy
 * these, so the component passes live cells/graph unchanged. Unit tests pass
 * plain object fakes implementing only the members a test exercises.
 *
 * When an extracted method reads a cell member not listed here, ADD it here
 * rather than widening a parameter to `any`.
 */

/** Position of a cell in graph coordinates. */
export interface LayoutPoint {
  x: number;
  y: number;
}

/** Size of a cell. */
export interface LayoutSize {
  width: number;
  height: number;
}

/** Structural surface of an X6 Cell used by DFD presentation services. */
export interface LayoutCell {
  readonly id: string;
  readonly shape: string;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: fetch the custom data payload attached to a diagram cell (pure)
  getData<T = Record<string, unknown>>(): T;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: update the custom data payload on a diagram cell (mutates shared state)
  setData(data: Record<string, unknown>, options?: { silent?: boolean; overwrite?: boolean }): void;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: fetch the width and height of a diagram cell (pure)
  getSize(): LayoutSize;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: update the dimensions of a diagram cell (mutates shared state)
  resize(width: number, height: number): void;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: fetch the graph-coordinate position of a diagram cell (pure)
  getPosition(): LayoutPoint;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: update the graph-coordinate position of a diagram cell (mutates shared state)
  setPosition(x: number, y: number, options?: { silent?: boolean }): void;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: fetch the child cells contained within a diagram cell (pure)
  getChildren(): LayoutCell[] | null;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: fetch the parent cell that contains this diagram cell (pure)
  getParent(): LayoutCell | null;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: fetch all X6 style attrs of a diagram cell (pure)
  getAttrs(): Record<string, unknown>;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: fetch a single X6 style attr from a diagram cell by dot-path (pure)
  getAttrByPath(path: string): unknown;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: update a single X6 style attr on a diagram cell by dot-path (mutates shared state)
  setAttrByPath(path: string, value: unknown, options?: { silent?: boolean }): void;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: fetch the z-index rendering order of a diagram cell (pure)
  getZIndex(): number | undefined;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: check whether a diagram cell is currently visible (pure)
  isVisible(): boolean;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: check whether a diagram cell is a node rather than an edge (pure)
  isNode(): boolean;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: check whether a diagram cell is an edge rather than a node (pure)
  isEdge(): boolean;
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: list all ports attached to a diagram cell (pure)
  getPorts(): unknown[];

  // Edge-cell members. Present only on edges; optional so node fakes need not
  // implement them. Used by DfdLayoutService.buildChildBox to detect which
  // cardinal port a connected edge attaches to, and by
  // clearVerticesOfConnectedEdges to strip routing vertices.
  // SEM@ae00299a0633c7d3c9bfe6633b44357e07c7f280: fetch the source cell id of a diagram edge (pure)
  getSourceCellId?(): string | undefined;
  // SEM@ae00299a0633c7d3c9bfe6633b44357e07c7f280: fetch the target cell id of a diagram edge (pure)
  getTargetCellId?(): string | undefined;
  // SEM@ae00299a0633c7d3c9bfe6633b44357e07c7f280: fetch the source port id of a diagram edge (pure)
  getSourcePortId?(): string | undefined;
  // SEM@ae00299a0633c7d3c9bfe6633b44357e07c7f280: fetch the target port id of a diagram edge (pure)
  getTargetPortId?(): string | undefined;
  // SEM@ae00299a0633c7d3c9bfe6633b44357e07c7f280: update routing vertices on a diagram edge (mutates shared state)
  setVertices?(vertices: unknown[]): void;
}

/** Structural surface of an X6 Graph used by DFD presentation services. */
export interface LayoutGraph {
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: list all node cells in a diagram graph (pure)
  getNodes(): LayoutCell[];
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: list all edge cells in a diagram graph (pure)
  getEdges(): LayoutCell[];
  // SEM@d76db367a7b5d406db8c4bf6b7f51c90878cbd81: fetch a diagram cell by its id (pure)
  getCellById(id: string): LayoutCell | null;

  // Used by DfdLayoutService.buildChildBox and clearVerticesOfConnectedEdges
  // to find the edges attached to a given cell.
  // SEM@ae00299a0633c7d3c9bfe6633b44357e07c7f280: list all edges connected to a given diagram cell (pure)
  getConnectedEdges?(cell: LayoutCell): LayoutCell[];
}
