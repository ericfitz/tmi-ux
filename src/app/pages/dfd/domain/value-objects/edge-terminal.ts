/**
 * Connection point for an edge (source or target)
 * Matches the EdgeTerminal schema from the OpenAPI specification
 */
export interface EdgeTerminal {
  /**
   * ID of the connected node (UUID)
   */
  cell: string;

  /**
   * ID of the specific port on the node (optional)
   */
  port?: string;
}
