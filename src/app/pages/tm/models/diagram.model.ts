import { Metadata } from './threat-model.model';

/**
 * Diagram image data with version information
 */
export interface DiagramImage {
  svg?: string; // BASE64 encoded SVG representation
  update_vector?: number; // Version of diagram when SVG was generated
}

/**
 * Cell interface for diagram graph data
 * Supports both X6 v2 native nested format and X6 v1 legacy flat format
 *
 * The API accepts both formats for backward compatibility:
 * - Nested format (X6 v2 native): position {x,y} and size {width,height} objects
 * - Flat format (X6 v1 legacy): x, y, width, height as direct properties
 *
 * The API prefers nested format, and X6 v2's toJSON() produces nested format.
 * The application normalizes all cells to nested format on import.
 */
export interface Cell {
  id: string;
  shape: string;
  // Node properties - X6 v2 native nested format (preferred)
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  // Node properties - X6 v1 legacy flat format (backward compatibility)
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Edge properties (when shape is edge)
  source?: { cell: string; port?: string } | string;
  target?: { cell: string; port?: string } | string;
  // Common optional properties
  parent?: string | null;
  zIndex?: number;
  visible?: boolean;
  attrs?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

/**
 * Interface for a diagram object supporting collaborative editing
 * Based on the BaseDiagram schema in tmi-openapi.json
 */
export interface Diagram {
  id: string;
  name: string;
  type: 'DFD-1.0.0';
  created_at: string;
  modified_at: string;
  description?: string; // Optional diagram description
  include_in_report?: boolean;
  metadata?: Metadata[];
  update_vector?: number; // Server-managed version counter
  image?: DiagramImage; // Image data with version information
  cells?: Cell[]; // Using proper Cell type instead of any[]
}

// Mock data for development until API is connected
export const MOCK_DIAGRAMS: Diagram[] = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'System Architecture',
    type: 'DFD-1.0.0',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    update_vector: 5,
    metadata: [
      {
        key: 'diagram_type',
        value: 'authentication',
      },
      {
        key: 'complexity',
        value: 'high',
      },
    ],
    cells: [
      {
        id: 'cell-web-server',
        shape: 'process',
        position: { x: 100, y: 100 },
        size: { width: 120, height: 60 },
        parent: null,
      },
      {
        id: 'cell-database',
        shape: 'store',
        position: { x: 300, y: 100 },
        size: { width: 120, height: 60 },
        parent: null,
      },
      {
        id: 'cell-api-gateway',
        shape: 'process',
        position: { x: 100, y: 250 },
        size: { width: 120, height: 60 },
        parent: null,
      },
      {
        id: 'edge-web-db',
        shape: 'edge',
        parent: null,
        source: 'cell-web-server',
        target: 'cell-database',
      },
    ],
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Data Flow',
    type: 'DFD-1.0.0',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    update_vector: 3,
    metadata: [
      {
        key: 'security_level',
        value: 'high',
      },
    ],
    cells: [
      {
        id: 'cell-user-actor',
        shape: 'actor',
        position: { x: 50, y: 150 },
        size: { width: 80, height: 60 },
        parent: null,
      },
      {
        id: 'cell-auth-service',
        shape: 'process',
        position: { x: 200, y: 150 },
        size: { width: 140, height: 60 },
        parent: null,
      },
      {
        id: 'edge-user-auth',
        shape: 'edge',
        parent: null,
        source: 'cell-user-actor',
        target: 'cell-auth-service',
      },
    ],
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Authentication Flow',
    type: 'DFD-1.0.0',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    update_vector: 1,
    metadata: [],
    cells: [],
  },
  {
    id: '223e4567-e89b-12d3-a456-426614174000',
    name: 'Cloud Infrastructure',
    type: 'DFD-1.0.0',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    update_vector: 2,
    metadata: [],
    cells: [],
  },
  {
    id: '223e4567-e89b-12d3-a456-426614174001',
    name: 'Network Security',
    type: 'DFD-1.0.0',
    created_at: new Date(Date.now() - 13 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    update_vector: 4,
    metadata: [],
    cells: [],
  },
  {
    id: '323e4567-e89b-12d3-a456-426614174000',
    name: 'Mobile App Components',
    type: 'DFD-1.0.0',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    update_vector: 7,
    metadata: [],
    cells: [],
  },
];

// Map to quickly look up diagrams by ID
export const DIAGRAMS_BY_ID = new Map<string, Diagram>(
  MOCK_DIAGRAMS.map(diagram => [diagram.id, diagram]),
);
