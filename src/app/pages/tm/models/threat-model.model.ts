export interface Metadata {
  key: string;
  value: string;
}

export interface Authorization {
  subject: string;
  role: 'reader' | 'writer' | 'owner';
}

export interface Threat {
  id: string;
  threat_model_id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
  metadata?: Metadata[];
}

export interface ThreatModel {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
  owner: string;
  authorization: Authorization[];
  metadata?: Metadata[];
  diagrams?: string[];
  threats?: Threat[];
}

// Mock data for development until API is connected
export const MOCK_THREAT_MODELS: ThreatModel[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'System Threat Model',
    description: 'Threats for system X',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(), // 7 days ago
    modified_at: new Date(Date.now() - 2 * 86400000).toISOString(), // 2 days ago
    owner: 'user@example.com',
    authorization: [
      {
        subject: 'user@example.com',
        role: 'owner',
      },
    ],
    metadata: [],
    diagrams: [
      '123e4567-e89b-12d3-a456-426614174000',
      '123e4567-e89b-12d3-a456-426614174001',
      '123e4567-e89b-12d3-a456-426614174002',
    ],
    threats: [
      {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Data Breach',
        description: 'Unauthorized data access',
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        metadata: [],
      },
      {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c9',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'SQL Injection',
        description: 'Malicious SQL queries via user input',
        created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        metadata: [],
      },
      {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430ca',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Cross-Site Scripting',
        description: 'XSS attacks through unvalidated input',
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        metadata: [],
      },
      {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430cb',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Denial of Service',
        description: 'Resource exhaustion attack',
        created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        metadata: [],
      },
    ],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Cloud Infrastructure Threat Model',
    description: 'Security analysis for cloud deployment',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(), // 14 days ago
    modified_at: new Date(Date.now() - 5 * 86400000).toISOString(), // 5 days ago
    owner: 'user@example.com',
    authorization: [
      {
        subject: 'user@example.com',
        role: 'owner',
      },
    ],
    metadata: [],
    diagrams: ['223e4567-e89b-12d3-a456-426614174000', '223e4567-e89b-12d3-a456-426614174001'],
    threats: [
      {
        id: '7ba7b810-9dad-11d1-80b4-00c04fd430c8',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Unauthorized Access',
        description: 'Unauthorized access to cloud resources',
        created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        metadata: [],
      },
      {
        id: '7ba7b810-9dad-11d1-80b4-00c04fd430c9',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Data Exfiltration',
        description: 'Unauthorized data extraction from cloud storage',
        created_at: new Date(Date.now() - 13 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        metadata: [],
      },
    ],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'Mobile App Threat Model',
    description: 'Security assessment for mobile application',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(), // 3 days ago
    modified_at: new Date(Date.now() - 1 * 86400000).toISOString(), // 1 day ago
    owner: 'user@example.com',
    authorization: [
      {
        subject: 'user@example.com',
        role: 'owner',
      },
    ],
    metadata: [],
    diagrams: ['323e4567-e89b-12d3-a456-426614174000'],
    threats: [
      {
        id: '8ba7b810-9dad-11d1-80b4-00c04fd430c8',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Insecure Data Storage',
        description: 'Sensitive data stored insecurely on device',
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        metadata: [],
      },
      {
        id: '8ba7b810-9dad-11d1-80b4-00c04fd430c9',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Insecure Communication',
        description: 'Unencrypted data transmission',
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        metadata: [],
      },
      {
        id: '8ba7b810-9dad-11d1-80b4-00c04fd430ca',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Insufficient Authentication',
        description: 'Weak authentication mechanisms',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        metadata: [],
      },
    ],
  },
];
