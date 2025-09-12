import { Metadata } from './threat-model.model';

/**
 * Cell interface for diagram graph data
 */
export interface Cell {
  id: string;
  value?: string;
  geometry?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  style?: string;
  vertex: boolean;
  edge: boolean;
  parent?: string | null;
  source?: string | null;
  target?: string | null;
}

/**
 * Interface for a diagram object supporting collaborative editing
 * Based on the schema in tmi-openapi.json
 */
export interface Diagram {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
  metadata?: Metadata[];
  cells?: Cell[]; // Using proper Cell type instead of any[]
  type: string;
}

// Mock data for development until API is connected
export const MOCK_DIAGRAMS: Diagram[] = [
  {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'System Architecture',
    description: 'High-level system architecture diagram',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    metadata: [],
    cells: [
      {
        id: 'cell-web-server',
        value: 'Web Server',
        geometry: { x: 100, y: 100, width: 120, height: 60 },
        style: 'shape=process;whiteSpace=wrap;html=1;text=Web%20Server;',
        vertex: true,
        edge: false,
        parent: null,
        source: null,
        target: null,
      },
      {
        id: 'cell-database',
        value: 'User Database',
        geometry: { x: 300, y: 100, width: 120, height: 60 },
        style: 'shape=cylinder;whiteSpace=wrap;html=1;text=User%20Database;',
        vertex: true,
        edge: false,
        parent: null,
        source: null,
        target: null,
      },
      {
        id: 'cell-api-gateway',
        value: 'API Gateway',
        geometry: { x: 100, y: 250, width: 120, height: 60 },
        style: 'shape=process;whiteSpace=wrap;html=1;text=API%20Gateway;',
        vertex: true,
        edge: false,
        parent: null,
        source: null,
        target: null,
      },
      {
        id: 'edge-web-db',
        value: '',
        style: 'endArrow=classic;html=1;label=Query%20Data;',
        vertex: false,
        edge: true,
        parent: null,
        source: 'cell-web-server',
        target: 'cell-database',
      },
    ],
    type: 'DFD-1.0.0',
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Data Flow',
    description: 'Data flow between system components',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    metadata: [],
    cells: [
      {
        id: 'cell-user-actor',
        value: 'User',
        geometry: { x: 50, y: 150, width: 80, height: 60 },
        style: 'shape=actor;whiteSpace=wrap;html=1;text=User;',
        vertex: true,
        edge: false,
        parent: null,
        source: null,
        target: null,
      },
      {
        id: 'cell-auth-service',
        value: 'Authentication Service',
        geometry: { x: 200, y: 150, width: 140, height: 60 },
        style: 'shape=process;whiteSpace=wrap;html=1;text=Authentication%20Service;',
        vertex: true,
        edge: false,
        parent: null,
        source: null,
        target: null,
      },
      {
        id: 'edge-user-auth',
        value: '',
        style: 'endArrow=classic;html=1;label=Login%20Request;',
        vertex: false,
        edge: true,
        parent: null,
        source: 'cell-user-actor',
        target: 'cell-auth-service',
      },
    ],
    type: 'DFD-1.0.0',
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Authentication Flow',
    description: 'User authentication process',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    metadata: [],
    cells: [],
    type: 'DFD-1.0.0',
  },
  {
    id: '223e4567-e89b-12d3-a456-426614174000',
    name: 'Cloud Infrastructure',
    description: 'Cloud deployment architecture',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    metadata: [],
    cells: [],
    type: 'DFD-1.0.0',
  },
  {
    id: '223e4567-e89b-12d3-a456-426614174001',
    name: 'Network Security',
    description: 'Network security controls',
    created_at: new Date(Date.now() - 13 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    metadata: [],
    cells: [],
    type: 'DFD-1.0.0',
  },
  {
    id: '323e4567-e89b-12d3-a456-426614174000',
    name: 'Mobile App Components',
    description: 'Mobile application component diagram',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    metadata: [],
    cells: [],
    type: 'DFD-1.0.0',
  },
];

// Map to quickly look up diagrams by ID
export const DIAGRAMS_BY_ID = new Map<string, Diagram>(
  MOCK_DIAGRAMS.map(diagram => [diagram.id, diagram]),
);
