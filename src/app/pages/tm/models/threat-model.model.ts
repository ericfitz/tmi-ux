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
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString(),
    owner: 'user@example.com',
    authorization: [
      {
        subject: 'user@example.com',
        role: 'owner',
      },
    ],
    metadata: [],
    diagrams: ['123e4567-e89b-12d3-a456-426614174000'],
    threats: [
      {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Data Breach',
        description: 'Unauthorized data access',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString(),
        metadata: [],
      },
    ],
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'Cloud Infrastructure Threat Model',
    description: 'Security analysis for cloud deployment',
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    modified_at: new Date(Date.now() - 86400000).toISOString(),
    owner: 'user@example.com',
    authorization: [
      {
        subject: 'user@example.com',
        role: 'owner',
      },
    ],
    metadata: [],
    diagrams: [],
    threats: [],
  },
];
