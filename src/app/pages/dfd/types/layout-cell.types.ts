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
  getData<T = Record<string, unknown>>(): T;
  setData(data: Record<string, unknown>, options?: { silent?: boolean; overwrite?: boolean }): void;
  getSize(): LayoutSize;
  resize(width: number, height: number): void;
  getPosition(): LayoutPoint;
  setPosition(x: number, y: number, options?: { silent?: boolean }): void;
  getChildren(): LayoutCell[] | null;
  getParent(): LayoutCell | null;
  getAttrs(): Record<string, unknown>;
  getAttrByPath(path: string): unknown;
  setAttrByPath(path: string, value: unknown, options?: { silent?: boolean }): void;
  getZIndex(): number | undefined;
  isVisible(): boolean;
  isNode(): boolean;
  isEdge(): boolean;
  getPorts(): unknown[];
}

/** Structural surface of an X6 Graph used by DFD presentation services. */
export interface LayoutGraph {
  getNodes(): LayoutCell[];
  getEdges(): LayoutCell[];
  getCellById(id: string): LayoutCell | null;
}
