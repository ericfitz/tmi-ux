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
 * Aligned with OpenAPI spec which uses flat x, y, width, height and shape discriminator
 */
export interface Cell {
  id: string;
  shape: string;
  // Node properties (when shape is actor, process, store, security-boundary, text-box)
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
  attrs?: any;
  data?: any;
  // Legacy properties for backward compatibility
  value?: string;
  geometry?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  style?: string;
  vertex?: boolean;
  edge?: boolean;
}

/**
 * Interface for a diagram object supporting collaborative editing
 * Based on the BaseDiagram schema in tmi-openapi.json
 */
export interface Diagram {
  id: string;
  name: string;
  type: string;
  created_at: string;
  modified_at: string;
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
        value: 'Web Server',
        geometry: { x: 100, y: 100, width: 120, height: 60 },
        style: 'shape=process;whiteSpace=wrap;html=1;text=Web%20Server;',
        parent: null,
      },
      {
        id: 'cell-database',
        shape: 'store',
        value: 'User Database',
        geometry: { x: 300, y: 100, width: 120, height: 60 },
        style: 'shape=cylinder;whiteSpace=wrap;html=1;text=User%20Database;',
        parent: null,
      },
      {
        id: 'cell-api-gateway',
        shape: 'process',
        value: 'API Gateway',
        geometry: { x: 100, y: 250, width: 120, height: 60 },
        style: 'shape=process;whiteSpace=wrap;html=1;text=API%20Gateway;',
        parent: null,
      },
      {
        id: 'edge-web-db',
        shape: 'edge',
        value: '',
        style: 'endArrow=classic;html=1;label=Query%20Data;',
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
        value: 'User',
        geometry: { x: 50, y: 150, width: 80, height: 60 },
        style: 'shape=actor;whiteSpace=wrap;html=1;text=User;',
        parent: null,
      },
      {
        id: 'cell-auth-service',
        shape: 'process',
        value: 'Authentication Service',
        geometry: { x: 200, y: 150, width: 140, height: 60 },
        style: 'shape=process;whiteSpace=wrap;html=1;text=Authentication%20Service;',
        parent: null,
      },
      {
        id: 'edge-user-auth',
        shape: 'edge',
        value: '',
        style: 'endArrow=classic;html=1;label=Login%20Request;',
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
