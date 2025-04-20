/**
 * Interface for theme metadata
 */
export interface ThemeMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
}

/**
 * Interface for node shape definition
 */
export interface NodeShapeDefinition {
  type: string;
  width: number;
  height: number;
  markup: Array<{
    tagName: string;
    selector: string;
  }>;
  attrs: Record<string, any>;
  zIndex?: number;
}

/**
 * Interface for edge style definition
 */
export interface EdgeStyleDefinition {
  router: string;
  connector: {
    name: string;
    args?: Record<string, any>;
  };
  attrs: {
    line: {
      stroke: string;
      strokeWidth: number;
      targetMarker?: {
        name: string;
        size: number;
      };
      [key: string]: any;
    };
    [key: string]: any;
  };
  zIndex?: number;
}

/**
 * Type for CSS properties
 */
export type CSSProperties = Record<string, string | number>;

/**
 * Interface for CSS style definition
 */
export interface CssStyleDefinition {
  selector: string;
  properties: Record<string, string>;
}

/**
 * Interface for a complete theme
 */
export interface Theme {
  metadata: ThemeMetadata;
  nodeShapes: Record<string, NodeShapeDefinition>;
  edgeStyle: EdgeStyleDefinition;
  cssStyles: CssStyleDefinition[];
  graphOptions?: Record<string, any>;
}

/**
 * Interface for theme file
 */
export interface ThemeFile {
  path: string;
  content: string;
}
