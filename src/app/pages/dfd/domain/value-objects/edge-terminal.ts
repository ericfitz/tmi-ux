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

/**
 * Type guard to check if an object is an EdgeTerminal
 */
export function isEdgeTerminal(obj: unknown): obj is EdgeTerminal {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'cell' in obj &&
    typeof (obj as { cell: unknown }).cell === 'string' &&
    ('port' in obj ? typeof (obj as { port: unknown }).port === 'string' : true)
  );
}

/**
 * Creates an EdgeTerminal from a plain object or string
 */
export function createEdgeTerminal(input: string | EdgeTerminal): EdgeTerminal {
  if (typeof input === 'string') {
    return { cell: input };
  }
  return input;
}