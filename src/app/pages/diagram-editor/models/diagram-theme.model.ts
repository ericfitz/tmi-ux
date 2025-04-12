/**
 * Interface for diagram theme configuration
 */
export interface DiagramTheme {
  defaultVertexStyle: Record<string, any>;
  defaultEdgeStyle: Record<string, any>;
  styles: Record<string, Record<string, any>>;
  gridEnabled: boolean;
  gridSize: number;
  backgroundColor: string;
  marker: {
    validColor: string;
    invalidColor: string;
    hotspot: number;
  };
}

/**
 * Interface for theme metadata
 */
export interface ThemeInfo {
  id: string;
  name: string;
  description: string;
}
