/**
 * Type definitions for X6-specific properties
 *
 * This module provides TypeScript type definitions that align with the AntV X6 graph library
 * and the TMI OpenAPI schema definitions. These types enable full X6 compatibility while
 * maintaining type safety and integration with the TMI domain model.
 *
 * ## X6 Compatibility
 *
 * The TMI application is fully compatible with AntV X6 graph library
 *
 * ### Integration Notes
 *
 * 1. **Progressive Enhancement**: X6 properties are optional and additive
 * 2. **Type Safety**: Full TypeScript support for all X6 properties
 * 3. **Validation**: OpenAPI schema validation for all X6 configurations
 * 4. **Convenience Properties**: Simplified APIs alongside native X6 properties
 *
 * ## Usage Examples
 *
 * ```typescript
 * // Custom node with markup
 * const nodeInfo = NodeInfo.fromJSON({
 *   id: 'custom-node',
 *   shape: 'process',
 *   x: 100, y: 100, width: 120, height: 60,
 *   label: 'Custom Process',
 *   markup: [
 *     { tagName: 'rect', selector: 'body', attrs: { fill: '#ff0000' } },
 *     { tagName: 'text', selector: 'label', attrs: { fontSize: 14 } }
 *   ],
 *   tools: [{ name: 'boundary', args: { distance: 10 } }]
 * });
 *
 * // Edge with manhattan routing and rounded connectors
 * const edgeInfo = EdgeInfo.fromJSON({
 *   id: 'routed-edge',
 *   source: { cell: 'node1', port: 'out' },
 *   target: { cell: 'node2', port: 'in' },
 *   router: { name: 'manhattan', args: { padding: 20 } },
 *   connector: { name: 'rounded', args: { radius: 5 } },
 *   label: 'Data Flow'
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
