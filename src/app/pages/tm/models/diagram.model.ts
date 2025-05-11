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
  graphData?: Cell[]; // Using proper Cell type instead of any[]
  version?: number;
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
    graphData: [],
    version: 1,
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174001',
    name: 'Data Flow',
    description: 'Data flow between system components',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    metadata: [],
    graphData: [],
    version: 1,
  },
  {
    id: '123e4567-e89b-12d3-a456-426614174002',
    name: 'Authentication Flow',
    description: 'User authentication process',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    metadata: [],
    graphData: [],
    version: 1,
  },
  {
    id: '223e4567-e89b-12d3-a456-426614174000',
    name: 'Cloud Infrastructure',
    description: 'Cloud deployment architecture',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    metadata: [],
    graphData: [],
    version: 1,
  },
  {
    id: '223e4567-e89b-12d3-a456-426614174001',
    name: 'Network Security',
    description: 'Network security controls',
    created_at: new Date(Date.now() - 13 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    metadata: [],
    graphData: [],
    version: 1,
  },
  {
    id: '323e4567-e89b-12d3-a456-426614174000',
    name: 'Mobile App Components',
    description: 'Mobile application component diagram',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    metadata: [],
    graphData: [],
    version: 1,
  },
];

// Map to quickly look up diagrams by ID
export const DIAGRAMS_BY_ID = new Map<string, Diagram>(
  MOCK_DIAGRAMS.map(diagram => [diagram.id, diagram]),
);
