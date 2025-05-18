import { ThreatModel } from '../../pages/tm/models/threat-model.model';
import { Diagram, Cell } from '../../pages/tm/models/diagram.model';
import { createMockCell } from '../factories/cell.factory';
import { createMockThreat } from '../factories/threat.factory';

/**
 * First mock threat model: System Authentication
 * This represents a typical authentication system with login flows
 */

// Define diagram IDs for reference
const DIAGRAM_IDS = {
  authFlow: '123e4567-e89b-12d3-a456-426614174000',
  dataStorage: '123e4567-e89b-12d3-a456-426614174001',
};

// Create cells for the authentication flow diagram
const authFlowCells: Cell[] = [
  // Nodes
  createMockCell('actor', {
    id: 'auth-cell-1',
    value: 'User',
    geometry: { x: 100, y: 150, width: 80, height: 80 },
  }),
  createMockCell('process', {
    id: 'auth-cell-2',
    value: 'Authentication Service',
    geometry: { x: 300, y: 150, width: 120, height: 60 },
  }),
  createMockCell('store', {
    id: 'auth-cell-3',
    value: 'User Database',
    geometry: { x: 500, y: 150, width: 100, height: 60 },
  }),
  createMockCell('process', {
    id: 'auth-cell-4',
    value: 'Token Generator',
    geometry: { x: 300, y: 250, width: 120, height: 60 },
  }),
  // Edges
  createMockCell('edge', {
    id: 'auth-edge-1',
    value: 'Login Request',
    source: 'auth-cell-1',
    target: 'auth-cell-2',
  }),
  createMockCell('edge', {
    id: 'auth-edge-2',
    value: 'Verify Credentials',
    source: 'auth-cell-2',
    target: 'auth-cell-3',
  }),
  createMockCell('edge', {
    id: 'auth-edge-3',
    value: 'Generate Token',
    source: 'auth-cell-2',
    target: 'auth-cell-4',
  }),
  createMockCell('edge', {
    id: 'auth-edge-4',
    value: 'Return Token',
    source: 'auth-cell-4',
    target: 'auth-cell-1',
  }),
];

// Create cells for the data storage diagram
const dataStorageCells: Cell[] = [
  // Nodes
  createMockCell('store', {
    id: 'storage-cell-1',
    value: 'User Database',
    geometry: { x: 300, y: 150, width: 100, height: 60 },
  }),
  createMockCell('process', {
    id: 'storage-cell-2',
    value: 'Data Access Layer',
    geometry: { x: 300, y: 300, width: 120, height: 60 },
  }),
  createMockCell('process', {
    id: 'storage-cell-3',
    value: 'Encryption Service',
    geometry: { x: 500, y: 150, width: 120, height: 60 },
  }),
  createMockCell('security-boundary', {
    id: 'storage-cell-4',
    value: 'Database Security Zone',
    geometry: { x: 200, y: 100, width: 250, height: 200 },
  }),
  // Edges
  createMockCell('edge', {
    id: 'storage-edge-1',
    value: 'Query Data',
    source: 'storage-cell-2',
    target: 'storage-cell-1',
  }),
  createMockCell('edge', {
    id: 'storage-edge-2',
    value: 'Encrypt/Decrypt',
    source: 'storage-cell-1',
    target: 'storage-cell-3',
  }),
];

// Create diagrams
const authFlowDiagram: Diagram = {
  id: DIAGRAM_IDS.authFlow,
  name: 'Authentication Flow',
  description: 'User authentication process flow',
  created_at: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 days ago
  modified_at: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
  metadata: [],
  graphData: authFlowCells,
  version: 1,
};

const dataStorageDiagram: Diagram = {
  id: DIAGRAM_IDS.dataStorage,
  name: 'Data Storage',
  description: 'User data storage and encryption',
  created_at: new Date(Date.now() - 6 * 86400000).toISOString(), // 6 days ago
  modified_at: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
  metadata: [],
  graphData: dataStorageCells,
  version: 1,
};

// Create threats
const threats = [
  // Authentication flow threats
  createMockThreat({
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Credential Theft',
    description: 'Attacker steals user credentials during transmission',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.authFlow,
    cell_id: 'auth-edge-1',
    severity: 'High',
    score: 7.5,
    priority: 'High',
    mitigated: false,
    status: 'Open',
    threat_type: 'Information Disclosure',
  }),
  createMockThreat({
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430c9',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'SQL Injection',
    description: 'Attacker injects malicious SQL into authentication queries',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.authFlow,
    cell_id: 'auth-cell-2',
    severity: 'Critical',
    score: 9.1,
    priority: 'Critical',
    mitigated: false,
    status: 'Open',
    threat_type: 'Elevation of Privilege',
  }),
  // Data storage threats
  createMockThreat({
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430ca',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Sensitive Data Exposure',
    description: 'Sensitive user data is exposed due to improper encryption',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.dataStorage,
    cell_id: 'storage-cell-1',
    severity: 'High',
    score: 8.2,
    priority: 'High',
    mitigated: false,
    status: 'In Progress',
    threat_type: 'Information Disclosure',
  }),
  createMockThreat({
    id: '6ba7b810-9dad-11d1-80b4-00c04fd430cb',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Encryption Key Theft',
    description: 'Attacker gains access to encryption keys',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.dataStorage,
    cell_id: 'storage-cell-3',
    severity: 'Critical',
    score: 9.5,
    priority: 'Critical',
    mitigated: false,
    status: 'Open',
    threat_type: 'Information Disclosure',
  }),
];

// Create the complete threat model
export const mockThreatModel1: ThreatModel = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'System Authentication',
  description: 'Authentication system security analysis',
  created_at: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 days ago
  modified_at: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
  owner: 'user@example.com',
  created_by: 'user@example.com',
  threat_model_framework: 'STRIDE',
  issue_url: 'https://issues.example.com/browse/TM-123',
  authorization: [
    {
      subject: 'user@example.com',
      role: 'owner',
    },
  ],
  metadata: [
    {
      key: 'Reviewer',
      value: 'John Doe',
    },
    {
      key: 'Priority',
      value: 'High',
    },
  ],
  diagrams: [DIAGRAM_IDS.authFlow, DIAGRAM_IDS.dataStorage],
  threats: threats,
};

// Export diagrams for reference
export const mockDiagrams1 = {
  [DIAGRAM_IDS.authFlow]: authFlowDiagram,
  [DIAGRAM_IDS.dataStorage]: dataStorageDiagram,
};
