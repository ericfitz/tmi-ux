import { ThreatModel } from '../../pages/tm/models/threat-model.model';
import { Diagram, Cell } from '../../pages/tm/models/diagram.model';
import { createMockCell } from '../factories/cell.factory';
import { createMockThreat } from '../factories/threat.factory';

/**
 * Third mock threat model: Mobile Application
 * This represents a mobile app with client-server architecture
 */

// Define diagram IDs for reference
const DIAGRAM_IDS = {
  mobileComponents: '323e4567-e89b-12d3-a456-426614174000',
};

// Create cells for the mobile components diagram
const mobileComponentsCells: Cell[] = [
  // Nodes
  createMockCell('actor', {
    id: 'mobile-cell-1',
    value: 'Mobile User',
    geometry: { x: 100, y: 200, width: 80, height: 80 },
  }),
  createMockCell('process', {
    id: 'mobile-cell-2',
    value: 'Mobile App',
    geometry: { x: 250, y: 200, width: 120, height: 60 },
  }),
  createMockCell('store', {
    id: 'mobile-cell-3',
    value: 'Local Storage',
    geometry: { x: 250, y: 300, width: 120, height: 60 },
  }),
  createMockCell('process', {
    id: 'mobile-cell-4',
    value: 'API Gateway',
    geometry: { x: 450, y: 200, width: 120, height: 60 },
  }),
  createMockCell('process', {
    id: 'mobile-cell-5',
    value: 'Authentication Service',
    geometry: { x: 650, y: 150, width: 120, height: 60 },
  }),
  createMockCell('process', {
    id: 'mobile-cell-6',
    value: 'Business Logic',
    geometry: { x: 650, y: 250, width: 120, height: 60 },
  }),
  createMockCell('store', {
    id: 'mobile-cell-7',
    value: 'Database',
    geometry: { x: 850, y: 200, width: 100, height: 60 },
  }),
  createMockCell('security-boundary', {
    id: 'mobile-cell-8',
    value: 'Mobile Device',
    geometry: { x: 200, y: 150, width: 200, height: 250 },
  }),
  createMockCell('security-boundary', {
    id: 'mobile-cell-9',
    value: 'Server Environment',
    geometry: { x: 600, y: 100, width: 400, height: 250 },
  }),
  // Edges
  createMockCell('edge', {
    id: 'mobile-edge-1',
    value: 'User Input',
    source: 'mobile-cell-1',
    target: 'mobile-cell-2',
  }),
  createMockCell('edge', {
    id: 'mobile-edge-2',
    value: 'Store Data',
    source: 'mobile-cell-2',
    target: 'mobile-cell-3',
  }),
  createMockCell('edge', {
    id: 'mobile-edge-3',
    value: 'API Requests',
    source: 'mobile-cell-2',
    target: 'mobile-cell-4',
  }),
  createMockCell('edge', {
    id: 'mobile-edge-4',
    value: 'Authenticate',
    source: 'mobile-cell-4',
    target: 'mobile-cell-5',
  }),
  createMockCell('edge', {
    id: 'mobile-edge-5',
    value: 'Process Data',
    source: 'mobile-cell-4',
    target: 'mobile-cell-6',
  }),
  createMockCell('edge', {
    id: 'mobile-edge-6',
    value: 'Query/Update',
    source: 'mobile-cell-6',
    target: 'mobile-cell-7',
  }),
  createMockCell('edge', {
    id: 'mobile-edge-7',
    value: 'Verify',
    source: 'mobile-cell-5',
    target: 'mobile-cell-7',
  }),
];

// Create diagrams
const mobileComponentsDiagram: Diagram = {
  id: DIAGRAM_IDS.mobileComponents,
  name: 'Mobile App Components',
  description: 'Mobile application component diagram',
  created_at: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
  modified_at: new Date(Date.now() - 1 * 86400000).toISOString(), // 1 day ago
  metadata: [],
  graphData: mobileComponentsCells,
  version: 1,
};

// Create threats
const threats = [
  createMockThreat({
    id: '8ba7b810-9dad-11d1-80b4-00c04fd430c8',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Insecure Data Storage',
    description: 'Sensitive data stored insecurely on device',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.mobileComponents,
    cell_id: 'mobile-cell-3',
    severity: 'High',
    score: 7.2,
    priority: 'High',
    mitigated: false,
    status: 'Open',
    threat_type: 'Information Disclosure',
  }),
  createMockThreat({
    id: '8ba7b810-9dad-11d1-80b4-00c04fd430c9',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Insecure Communication',
    description: 'Unencrypted data transmission',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.mobileComponents,
    cell_id: 'mobile-edge-3',
    severity: 'Medium',
    score: 6.8,
    priority: 'Medium',
    mitigated: false,
    status: 'Open',
    threat_type: 'Information Disclosure',
  }),
  createMockThreat({
    id: '8ba7b810-9dad-11d1-80b4-00c04fd430ca',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Insufficient Authentication',
    description: 'Weak authentication mechanisms',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.mobileComponents,
    cell_id: 'mobile-cell-5',
    severity: 'High',
    score: 7.5,
    priority: 'High',
    mitigated: false,
    status: 'Open',
    threat_type: 'Authentication Bypass',
  }),
  createMockThreat({
    id: '8ba7b810-9dad-11d1-80b4-00c04fd430cb',
    threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Code Injection',
    description: 'Injection of malicious code through user input',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    diagram_id: DIAGRAM_IDS.mobileComponents,
    cell_id: 'mobile-cell-2',
    severity: 'Critical',
    score: 8.7,
    priority: 'Critical',
    mitigated: false,
    status: 'Open',
    threat_type: 'Elevation of Privilege',
  }),
];

// Create the complete threat model
export const mockThreatModel3: ThreatModel = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  name: 'Mobile App Threat Model',
  description: 'Security assessment for mobile application',
  created_at: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
  modified_at: new Date(Date.now() - 1 * 86400000).toISOString(), // 1 day ago
  owner: 'user@example.com',
  created_by: 'user@example.com',
  threat_model_framework: 'LINDDUN',
  issue_url: 'https://issues.example.com/browse/TM-125',
  authorization: [
    {
      subject: 'user@example.com',
      role: 'owner',
    },
    {
      subject: 'mobile-dev@example.com',
      role: 'writer',
    },
    {
      subject: 'qa-team@example.com',
      role: 'reader',
    },
  ],
  metadata: [
    {
      key: 'Platform',
      value: 'iOS, Android',
    },
    {
      key: 'Version',
      value: '2.0',
    },
    {
      key: 'Development Stage',
      value: 'Beta',
    },
  ],
  diagrams: [DIAGRAM_IDS.mobileComponents],
  threats: threats,
};

// Export diagrams for reference
export const mockDiagrams3 = {
  [DIAGRAM_IDS.mobileComponents]: mobileComponentsDiagram,
};
