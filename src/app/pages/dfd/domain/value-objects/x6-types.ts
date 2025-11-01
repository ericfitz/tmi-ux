/**
 * Type definitions for X6-specific properties
 *
 * This module provides TypeScript type definitions that align with the AntV X6 graph library
 * and the TMI OpenAPI schema definitions. These types enable full X6 compatibility while
 * maintaining type safety and integration with the TMI domain model.
 *
 * ## X6 Compatibility
 *
 * The TMI application uses X6's native format with zero transformation overhead.
 * All cell data matches X6's toJSON() format exactly, enabling direct persistence
 * and minimal conversion between the graph library and the API.
 *
 * ### Integration Notes
 *
 * 1. **X6 Native Format**: All cells use X6's native toJSON() format
 * 2. **Type Safety**: Full TypeScript support for all X6 properties
 * 3. **Validation**: OpenAPI schema validation for all X6 configurations
 * 4. **Zero Transformation**: Direct serialization/deserialization with X6
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Custom node with markup and attrs (X6 native)
 * const nodeInfo = NodeInfo.fromJSON({
 *   id: 'custom-node',
 *   shape: 'process',
 *   x: 100, y: 100, width: 120, height: 60,
 *   attrs: {
 *     text: { text: 'Custom Process' },
 *     body: { fill: '#ff0000' }
 *   },
 *   markup: [
 *     { tagName: 'rect', selector: 'body', attrs: { fill: '#ff0000' } },
 *     { tagName: 'text', selector: 'label', attrs: { fontSize: 14 } }
 *   ],
 *   tools: [{ name: 'boundary', args: { distance: 10 } }]
 * });
 *
 * // Edge with manhattan routing and labels (X6 native)
 * const edgeInfo = EdgeInfo.fromJSON({
 *   id: 'routed-edge',
 *   source: { cell: 'node1', port: 'out' },
 *   target: { cell: 'node2', port: 'in' },
 *   router: { name: 'manhattan', args: { padding: 20 } },
 *   connector: { name: 'rounded', args: { radius: 5 } },
 *   labels: [{ attrs: { text: { text: 'Data Flow' } } }]
 * });
 * ```
 *
 * These types align with the OpenAPI schema definitions for X6 compatibility
 */

/**
 * SVG/HTML markup element for custom shape definitions in X6
 */
export interface MarkupElement {
  /** SVG or HTML tag name (e.g., 'rect', 'circle', 'path', 'text') */
  tagName: string;
  /** CSS selector for targeting this element in styling */
  selector?: string;
  /** Element attributes and styling properties */
  attrs?: Record<string, any>;
  /** Nested child elements */
  children?: MarkupElement[];
}

/**
 * Interactive tool configuration for X6 cells
 */
export interface CellTool {
  /** Tool identifier (e.g., 'boundary', 'button', 'remove') */
  name: string;
  /** Tool-specific configuration arguments */
  args?: Record<string, any>;
}

/**
 * Edge routing algorithm configuration
 */
export type EdgeRouter =
  | 'normal'
  | 'orth'
  | 'oneSide'
  | 'manhattan'
  | 'metro'
  | 'er'
  | {
      name: 'normal' | 'orth' | 'oneSide' | 'manhattan' | 'metro' | 'er';
      args?: {
        [key: string]: any;
        /** Padding around obstacles for routing */
        padding?: number;
        /** Grid step size for orthogonal routing */
        step?: number;
        /** Allowed routing directions */
        directions?: ('top' | 'right' | 'bottom' | 'left')[];
      };
    };

/**
 * Edge connector style configuration
 */
export type EdgeConnector =
  | 'normal'
  | 'rounded'
  | 'smooth'
  | 'jumpover'
  | {
      name: 'normal' | 'rounded' | 'smooth' | 'jumpover';
      args?: {
        [key: string]: any;
        /** Radius for rounded connectors */
        radius?: number;
        /** Precision for smooth connectors */
        precision?: number;
        /** Jump size for jumpover connectors */
        size?: number;
        /** Jump style for jumpover connectors */
        jump?: 'arc' | 'gap' | 'cubic';
      };
    };
