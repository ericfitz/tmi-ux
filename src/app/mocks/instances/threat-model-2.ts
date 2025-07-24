import { ThreatModel } from '../../pages/tm/models/threat-model.model';
import { Diagram, Cell } from '../../pages/tm/models/diagram.model';
import { createMockCell } from '../factories/cell.factory';
import { createMockThreat } from '../factories/threat.factory';

/**
 * Second mock threat model: Cloud Infrastructure
 * This represents a cloud deployment architecture with security controls
 */

// Define diagram IDs for reference
const DIAGRAM_IDS = {
  cloudInfrastructure: '223e4567-e89b-12d3-a456-426614174000',
  networkSecurity: '223e4567-e89b-12d3-a456-426614174001',
  dataFlow: '223e4567-e89b-12d3-a456-426614174002',
};

// Create cells for the cloud infrastructure diagram
const cloudInfrastructureCells: Cell[] = [
  // Nodes
  createMockCell('process', {
    id: 'cloud-cell-1',
    value: 'Web Application',
    geometry: { x: 200, y: 100, width: 120, height: 60 },
  }),
  createMockCell('process', {
    id: 'cloud-cell-2',
    value: 'API Gateway',
    geometry: { x: 400, y: 100, width: 120, height: 60 },
  }),
  createMockCell('process', {
    id: 'cloud-cell-3',
    value: 'Authentication Service',
    geometry: { x: 400, y: 200, width: 120, height: 60 },
  }),
  createMockCell('store', {
    id: 'cloud-cell-4',
    value: 'User Database',
    geometry: { x: 600, y: 200, width: 100, height: 60 },
  }),
  createMockCell('process', {
    id: 'cloud-cell-5',
    value: 'Business Logic',
    geometry: { x: 400, y: 300, width: 120, height: 60 },
  }),
  createMockCell('store', {
    id: 'cloud-cell-6',
    value: 'Data Storage',
    geometry: { x: 600, y: 300, width: 100, height: 60 },
  }),
  // Edges
  createMockCell('edge', {
    id: 'cloud-edge-1',
    value: 'HTTPS',
    source: 'cloud-cell-1',
    target: 'cloud-cell-2',
  }),
  createMockCell('edge', {
    id: 'cloud-edge-2',
    value: 'Authenticate',
    source: 'cloud-cell-2',
    target: 'cloud-cell-3',
  }),
  createMockCell('edge', {
    id: 'cloud-edge-3',
    value: 'Query',
    source: 'cloud-cell-3',
    target: 'cloud-cell-4',
  }),
  createMockCell('edge', {
    id: 'cloud-edge-4',
    value: 'API Calls',
    source: 'cloud-cell-2',
    target: 'cloud-cell-5',
  }),
  createMockCell('edge', {
    id: 'cloud-edge-5',
    value: 'CRUD Operations',
    source: 'cloud-cell-5',
    target: 'cloud-cell-6',
  }),
];

// Create cells for the network security diagram
const networkSecurityCells: Cell[] = [
  // Nodes
  createMockCell('actor', {
    id: 'network-cell-1',
    value: 'Internet',
    geometry: { x: 100, y: 200, width: 80, height: 80 },
  }),
  createMockCell('process', {
    id: 'network-cell-2',
    value: 'WAF',
    geometry: { x: 250, y: 200, width: 100, height: 60 },
  }),
  createMockCell('process', {
    id: 'network-cell-3',
    value: 'Load Balancer',
    geometry: { x: 400, y: 200, width: 120, height: 60 },
  }),
  createMockCell('process', {
    id: 'network-cell-4',
    value: 'Application Servers',
    geometry: { x: 600, y: 200, width: 120, height: 60 },
  }),
  createMockCell('security-boundary', {
    id: 'network-cell-5',
    value: 'DMZ',
    geometry: { x: 200, y: 150, width: 350, height: 150 },
  }),
  createMockCell('security-boundary', {
    id: 'network-cell-6',
    value: 'Private Network',
    geometry: { x: 550, y: 150, width: 200, height: 150 },
  }),
  // Edges
  createMockCell('edge', {
    id: 'network-edge-1',
    value: 'HTTPS',
    source: 'network-cell-1',
    target: 'network-cell-2',
  }),
  createMockCell('edge', {
    id: 'network-edge-2',
    value: 'Filtered Traffic',
    source: 'network-cell-2',
    target: 'network-cell-3',
  }),
  createMockCell('edge', {
    id: 'network-edge-3',
    value: 'Load Balanced Traffic',
    source: 'network-cell-3',
    target: 'network-cell-4',
  }),
];

// Create cells for the data flow diagram
const dataFlowCells: Cell[] = [
  // Nodes
  createMockCell('actor', {
    id: 'dataflow-cell-1',
    value: 'User',
    geometry: { x: 100, y: 200, width: 80, height: 80 },
  }),
  createMockCell('process', {
    id: 'dataflow-cell-2',
    value: 'Frontend',
    geometry: { x: 250, y: 200, width: 100, height: 60 },
  }),
  createMockCell('process', {
    id: 'dataflow-cell-3',
    value: 'API',
    geometry: { x: 400, y: 200, width: 100, height: 60 },
  }),
  createMockCell('process', {
    id: 'dataflow-cell-4',
    value: 'Data Processing',
    geometry: { x: 550, y: 200, width: 120, height: 60 },
  }),
  createMockCell('store', {
    id: 'dataflow-cell-5',
    value: 'Database',
    geometry: { x: 700, y: 200, width: 100, height: 60 },
  }),
  // Edges
  createMockCell('edge', {
    id: 'dataflow-edge-1',
    value: 'User Input',
    source: 'dataflow-cell-1',
    target: 'dataflow-cell-2',
  }),
  createMockCell('edge', {
    id: 'dataflow-edge-2',
    value: 'API Requests',
    source: 'dataflow-cell-2',
    target: 'dataflow-cell-3',
  }),
  createMockCell('edge', {
    id: 'dataflow-edge-3',
    value: 'Process Data',
    source: 'dataflow-cell-3',
    target: 'dataflow-cell-4',
  }),
  createMockCell('edge', {
    id: 'dataflow-edge-4',
    value: 'Store/Retrieve',
    source: 'dataflow-cell-4',
    target: 'dataflow-cell-5',
  }),
];

// Create diagrams
const cloudInfrastructureDiagram: Diagram = {
  id: DIAGRAM_IDS.cloudInfrastructure,
  name: 'Cloud Infrastructure',
  description: 'Cloud deployment architecture',
  created_at: new Date(Date.now() - 14 * 86400000).toISOString(), // 14 days ago
  modified_at: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
  metadata: [],
  cells: cloudInfrastructureCells,
  type: 'DFD-1.0.0',
};

const networkSecurityDiagram: Diagram = {
  id: DIAGRAM_IDS.networkSecurity,
  name: 'Network Security',
  description: 'Network security controls',
  created_at: new Date(Date.now() - 13 * 86400000).toISOString(), // 13 days ago
  modified_at: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
  metadata: [],
  cells: networkSecurityCells,
  type: 'DFD-1.0.0',
};

const dataFlowDiagram: Diagram = {
  id: DIAGRAM_IDS.dataFlow,
  name: 'Data Flow',
  description: 'Data flow between components',
  created_at: new Date(Date.now() - 12 * 86400000).toISOString(), // 12 days ago
  modified_at: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
  metadata: [],
  cells: dataFlowCells,
  type: 'DFD-1.0.0',
};

// Create threats
const threats = [
  // Cloud infrastructure threats
  createMockThreat({
    id: '7ba7b810-9dad-11d1-80b4-00c04fd430c8',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Unauthorized Access',
    description: 'Unauthorized access to cloud resources',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.cloudInfrastructure,
    cell_id: 'cloud-cell-2',
    severity: 'High',
    score: 7.8,
    priority: 'High',
    mitigated: false,
    status: 'Open',
    threat_type: 'Authentication Bypass',
  }),
  // Network security threats
  createMockThreat({
    id: '7ba7b810-9dad-11d1-80b4-00c04fd430c9',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'DDoS Attack',
    description: 'Distributed Denial of Service attack on public endpoints',
    created_at: new Date(Date.now() - 13 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.networkSecurity,
    cell_id: 'network-cell-2',
    severity: 'High',
    score: 7.5,
    priority: 'High',
    mitigated: false,
    status: 'Open',
    threat_type: 'Denial of Service',
  }),
  // Data flow threats
  createMockThreat({
    id: '7ba7b810-9dad-11d1-80b4-00c04fd430ca',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Data Exfiltration',
    description: 'Unauthorized data extraction from cloud storage',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.dataFlow,
    cell_id: 'dataflow-cell-5',
    severity: 'Critical',
    score: 8.9,
    priority: 'Critical',
    mitigated: false,
    status: 'Open',
    threat_type: 'Information Disclosure',
  }),
  createMockThreat({
    id: '7ba7b810-9dad-11d1-80b4-00c04fd430cb',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Man-in-the-Middle',
    description: 'Interception of data in transit',
    created_at: new Date(Date.now() - 11 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.dataFlow,
    cell_id: 'dataflow-edge-2',
    severity: 'High',
    score: 8.2,
    priority: 'High',
    mitigated: false,
    status: 'In Progress',
    threat_type: 'Information Disclosure',
  }),
];

// Create the complete threat model
export const mockThreatModel2: ThreatModel = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  name: 'Cloud Infrastructure',
  description: 'Security analysis for cloud deployment',
  created_at: new Date(Date.now() - 14 * 86400000).toISOString(), // 14 days ago
  modified_at: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
  owner: 'user@example.com',
  created_by: 'user@example.com',
  threat_model_framework: 'CIA',
  issue_url: 'https://issues.example.com/browse/TM-124',
  authorization: [
    {
      subject: 'user@example.com',
      role: 'owner',
    },
    {
      subject: 'security-team@example.com',
      role: 'writer',
    },
  ],
  metadata: [
    {
      key: 'Environment',
      value: 'Production',
    },
    {
      key: 'Cloud Provider',
      value: 'AWS',
    },
    {
      key: 'Reviewer',
      value: 'Security Team',
    },
  ],
  documents: [
    {
      id: '5ba7b810-9dad-11d1-beef-00c04fd430ca',
      name: 'Cloud Security Playbook',
      url: 'https://docs.example.com/cloud-security-playbook.pdf',
      description: 'Cloud security best practices and procedures',
      metadata: [
        {
          key: 'document_type',
          value: 'playbook',
        },
        {
          key: 'cloud_provider',
          value: 'AWS',
        },
      ],
    },
  ],
  diagrams: [cloudInfrastructureDiagram, networkSecurityDiagram, dataFlowDiagram],
  threats: threats,
};

// Export diagrams for reference
export const mockDiagrams2 = {
  [DIAGRAM_IDS.cloudInfrastructure]: cloudInfrastructureDiagram,
  [DIAGRAM_IDS.networkSecurity]: networkSecurityDiagram,
  [DIAGRAM_IDS.dataFlow]: dataFlowDiagram,
};
