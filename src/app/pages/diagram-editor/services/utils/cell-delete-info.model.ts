// Cell deletion information model

/**
 * Interface defining the information captured before deleting a cell
 * This is used to avoid accessing cell properties after deletion
 */
export interface CellDeleteInfo {
  // Basic cell information
  id: string;
  type: 'vertex' | 'edge';

  // Visual data
  label: string;
  style?: string;

  // Position information
  geometry?: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    points?: { x: number; y: number }[];
    sourcePoint?: { x: number; y: number };
    targetPoint?: { x: number; y: number };
  };

  // Connectivity information
  source?: string; // For edges: source cell ID
  target?: string; // For edges: target cell ID
  connectedEdgeIds?: string[]; // For vertices: IDs of connected edges

  // Component relationship
  componentId?: string;

  // For logging
  description?: string;
}
