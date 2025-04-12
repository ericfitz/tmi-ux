import { Observable } from 'rxjs';
import { DiagramTheme, ThemeInfo } from '../../models/diagram-theme.model';

/**
 * Interface for cell click event data
 */
export interface CellClickData {
  cellId: string;
  cellType: 'vertex' | 'edge';
}

/**
 * Interface for cell selection event data
 */
export interface CellSelectionData {
  cellId: string;
  cellType: 'vertex' | 'edge';
}

/**
 * Anchor point position types
 */
export type AnchorPointPosition = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW' | 'C';

/**
 * Interface for vertex creation result
 */
export interface VertexCreationResult {
  cellId: string;
  componentId: string;
  success: boolean;
}

/**
 * Interface for edge creation result
 */
export interface EdgeCreationResult {
  cellId: string;
  componentId: string;
  success: boolean;
}

/**
 * Common interface for diagram renderer services
 */
export interface IDiagramRendererService {
  // Lifecycle
  initialize(container: HTMLElement): void;
  initializeRenderer(): Promise<void>;
  destroy(): void;
  isInitialized(): boolean;
  waitForStabilization(): Promise<void>;
  
  // Graph Observation
  readonly cellClicked$: Observable<CellClickData | null>;
  readonly cellSelected$: Observable<CellSelectionData | null>;
  
  // Theme
  getAvailableThemes(): Observable<ThemeInfo[]>;
  getCurrentThemeId(): string | null;
  loadTheme(themeId: string): Promise<DiagramTheme>;
  switchTheme(themeId: string): Promise<void>;
  
  // Grid
  isGridEnabled(): boolean;
  toggleGridVisibility(): boolean;
  
  // Cell Creation
  createVertex(x: number, y: number, label: string, width?: number, height?: number, style?: string): string;
  createVertexWithIds(x: number, y: number, label: string, width?: number, height?: number, style?: string): VertexCreationResult;
  createEdgeBetweenComponents(sourceComponentId: string, targetComponentId: string, label?: string, style?: string): EdgeCreationResult;
  createSingleEdgeWithVertices(
    sourceId: string, 
    targetId: string, 
    label?: string, 
    style?: string, 
    sourceIsCell?: boolean, 
    targetIsCell?: boolean
  ): string;
  
  // Cell Manipulation
  highlightCell(cellOrComponentId: string, highlight: boolean, isComponentId?: boolean): void;
  deleteComponent(componentId: string): void;
  deleteCellById(cellId: string): void;
  setEdgeCreationMode(enabled: boolean): void;
  
  // Diagram Management
  updateDiagram(): void;
  getCellById(id: string): any;
  getGraph(): any;
}