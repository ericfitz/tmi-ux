export interface Metadata {
  key: string;
  value: string;
}

export interface Authorization {
  subject: string;
  role: 'reader' | 'writer' | 'owner';
}

export interface Document {
  id: string;
  name: string;
  uri: string;
  description?: string;
  metadata?: Metadata[];
}

export interface Repository {
  id: string;
  name: string;
  description?: string;
  type: 'git' | 'svn' | 'mercurial' | 'other';
  uri: string;
  parameters?: {
    refType: 'branch' | 'tag' | 'commit';
    refValue: string;
    subPath?: string;
  };
  metadata?: Metadata[];
}

export interface Threat {
  id: string;
  threat_model_id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
  diagram_id?: string;
  cell_id?: string;
  severity: 'Unknown' | 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
  score?: number;
  priority?: string;
  mitigated?: boolean;
  status?: string;
  threat_type: string;
  issue_uri?: string;
  metadata?: Metadata[];
}

export interface ThreatModel {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  modified_at: string;
  owner: string;
  created_by: string;
  threat_model_framework: string;
  issue_uri?: string;
  authorization: Authorization[];
  metadata?: Metadata[];
  documents?: Document[];
  repositories?: Repository[];
  diagrams?: import('./diagram.model').Diagram[];
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
    created_by: 'user@example.com',
    threat_model_framework: 'STRIDE',
    issue_uri: 'https://issues.example.com/browse/TM-123',
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
        key: 'Contributor',
        value: 'Other Person',
      },
    ],
    documents: [
      {
        id: '3ba7b810-9dad-11d1-beef-00c04fd430c8',
        name: 'System Architecture Document',
        uri: 'https://docs.example.com/system-architecture.pdf',
        description: 'Technical architecture documentation for the system',
        metadata: [
          {
            key: 'document_type',
            value: 'architecture',
          },
          {
            key: 'version',
            value: '2.1',
          },
        ],
      },
      {
        id: '4ba7b810-9dad-11d1-beef-00c04fd430c9',
        name: 'Security Requirements',
        uri: 'https://docs.example.com/security-requirements.docx',
        description: 'Security requirements and compliance documentation',
        metadata: [
          {
            key: 'document_type',
            value: 'requirements',
          },
          {
            key: 'compliance',
            value: 'SOC2',
          },
        ],
      },
    ],
    repositories: [
      {
        id: '6ba7b810-1dad-11d1-8080-00c04fd430c8',
        name: 'GitHub Repo',
        description: 'Main application source code repository',
        type: 'git',
        uri: 'https://github.com/ericfitz/tmi-ux.git',
        parameters: {
          refType: 'branch',
          refValue: 'main',
        },
        metadata: [
          {
            key: 'environment',
            value: 'production',
          },
          {
            key: 'team',
            value: 'security',
          },
        ],
      },
      {
        id: '7ba7b810-1dad-11d1-8080-00c04fd430c9',
        name: 'API Repository',
        description: 'Backend API source code',
        type: 'git',
        uri: 'https://github.com/ericfitz/tmi-api.git',
        parameters: {
          refType: 'tag',
          refValue: 'v2.1.0',
        },
        metadata: [
          {
            key: 'language',
            value: 'python',
          },
          {
            key: 'framework',
            value: 'django',
          },
        ],
      },
    ],
    diagrams: [], // Will be populated by actual Diagram objects
    threats: [
      {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Data Breach',
        description: 'Unauthorized data access',
        created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        diagram_id: '123e4567-e89b-12d3-a456-426614174000',
        cell_id: 'c7d10424-3c10-43d0-8ac6-47d61dee3f88',
        severity: 'High',
        score: 7.3,
        priority: 'High',
        mitigated: false,
        status: 'Open',
        threat_type: 'Information Disclosure',
        issue_uri: 'https://issues.example.com/browse/SEC-456',
        metadata: [],
      },
      {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430c9',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'SQL Injection',
        description: 'Malicious SQL queries via user input',
        created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        diagram_id: '123e4567-e89b-12d3-a456-426614174000',
        cell_id: 'c7d10424-3c10-43d0-8ac6-47d61dee3f88',
        severity: 'Critical',
        score: 8.5,
        priority: 'High',
        mitigated: false,
        status: 'Open',
        threat_type: 'Elevation of Privilege',
        issue_uri: 'https://issues.example.com/browse/SEC-457',
        metadata: [],
      },
      {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430ca',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Cross-Site Scripting',
        description: 'XSS attacks through unvalidated input',
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        diagram_id: '123e4567-e89b-12d3-a456-426614174000',
        cell_id: 'c7d10424-3c10-43d0-8ac6-47d61dee3f88',
        severity: 'High',
        score: 7.0,
        priority: 'Medium',
        mitigated: false,
        status: 'In Progress',
        threat_type: 'Tampering',
        issue_uri: 'https://issues.example.com/browse/SEC-458',
        metadata: [],
      },
      {
        id: '6ba7b810-9dad-11d1-80b4-00c04fd430cb',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440000',
        name: 'Denial of Service',
        description: 'Resource exhaustion attack',
        created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        diagram_id: '123e4567-e89b-12d3-a456-426614174000',
        cell_id: 'c7d10424-3c10-43d0-8ac6-47d61dee3f88',
        severity: 'Medium',
        score: 6.5,
        priority: 'Medium',
        mitigated: false,
        status: 'Open',
        threat_type: 'Denial of Service',
        issue_uri: 'https://issues.example.com/browse/SEC-459',
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
    created_by: 'user@example.com',
    threat_model_framework: 'CIA',
    issue_uri: 'https://issues.example.com/browse/TM-124',
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
        key: 'Contributor',
        value: 'Other Person',
      },
    ],
    documents: [
      {
        id: '5ba7b810-9dad-11d1-beef-00c04fd430ca',
        name: 'Cloud Security Playbook',
        uri: 'https://docs.example.com/cloud-security-playbook.pdf',
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
    repositories: [],
    diagrams: [], // Will be populated by actual Diagram objects
    threats: [
      {
        id: '7ba7b810-9dad-11d1-80b4-00c04fd430c8',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Unauthorized Access',
        description: 'Unauthorized access to cloud resources',
        created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        diagram_id: '223e4567-e89b-12d3-a456-426614174000',
        cell_id: 'd8e20525-4d20-54e1-9bd7-58e72eef4f99',
        severity: 'High',
        score: 7.8,
        priority: 'High',
        mitigated: false,
        status: 'Open',
        threat_type: 'Authentication Bypass',
        issue_uri: 'https://issues.example.com/browse/SEC-460',
        metadata: [],
      },
      {
        id: '7ba7b810-9dad-11d1-80b4-00c04fd430c9',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'Data Exfiltration',
        description: 'Unauthorized data extraction from cloud storage',
        created_at: new Date(Date.now() - 13 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 5 * 86400000).toISOString(),
        diagram_id: '223e4567-e89b-12d3-a456-426614174001',
        cell_id: 'e9f31636-5e31-65f2-0ce8-69f83ff5f0aa',
        severity: 'Critical',
        score: 8.9,
        priority: 'Critical',
        mitigated: false,
        status: 'Open',
        threat_type: 'Information Disclosure',
        issue_uri: 'https://issues.example.com/browse/SEC-461',
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
    created_by: 'user@example.com',
    threat_model_framework: 'LINDDUN',
    issue_uri: 'https://issues.example.com/browse/TM-125',
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
        key: 'Contributor',
        value: 'Other Person',
      },
    ],
    documents: [
      {
        id: '6ba7b810-9dad-11d1-beef-00c04fd430cb',
        name: 'Mobile Security Guidelines',
        uri: 'https://docs.example.com/mobile-security-guidelines.pdf',
        description: 'OWASP mobile security testing guide compliance',
        metadata: [
          {
            key: 'document_type',
            value: 'guidelines',
          },
          {
            key: 'standard',
            value: 'OWASP MSTG',
          },
        ],
      },
      {
        id: '7ba7b810-9dad-11d1-beef-00c04fd430cc',
        name: 'Privacy Impact Assessment',
        uri: 'https://docs.example.com/privacy-impact-assessment.docx',
        description: 'GDPR and privacy compliance assessment for mobile app',
        metadata: [
          {
            key: 'document_type',
            value: 'assessment',
          },
          {
            key: 'regulation',
            value: 'GDPR',
          },
        ],
      },
    ],
    repositories: [],
    diagrams: [], // Will be populated by actual Diagram objects
    threats: [
      {
        id: '8ba7b810-9dad-11d1-80b4-00c04fd430c8',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Insecure Data Storage',
        description: 'Sensitive data stored insecurely on device',
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        diagram_id: '323e4567-e89b-12d3-a456-426614174000',
        cell_id: 'f0f42747-6f42-76g3-1df9-70g94gg6g1bb',
        severity: 'High',
        score: 7.2,
        priority: 'High',
        mitigated: false,
        status: 'Open',
        threat_type: 'Information Disclosure',
        issue_uri: 'https://issues.example.com/browse/SEC-462',
        metadata: [],
      },
      {
        id: '8ba7b810-9dad-11d1-80b4-00c04fd430c9',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Insecure Communication',
        description: 'Unencrypted data transmission',
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        diagram_id: '323e4567-e89b-12d3-a456-426614174000',
        cell_id: 'f0f42747-6f42-76g3-1df9-70g94gg6g1bb',
        severity: 'Medium',
        score: 6.8,
        priority: 'Medium',
        mitigated: false,
        status: 'Open',
        threat_type: 'Information Disclosure',
        issue_uri: 'https://issues.example.com/browse/SEC-463',
        metadata: [],
      },
      {
        id: '8ba7b810-9dad-11d1-80b4-00c04fd430ca',
        threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'Insufficient Authentication',
        description: 'Weak authentication mechanisms',
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
        modified_at: new Date(Date.now() - 1 * 86400000).toISOString(),
        diagram_id: '323e4567-e89b-12d3-a456-426614174000',
        cell_id: 'f0f42747-6f42-76g3-1df9-70g94gg6g1bb',
        severity: 'High',
        score: 7.5,
        priority: 'High',
        mitigated: false,
        status: 'Open',
        threat_type: 'Authentication Bypass',
        issue_uri: 'https://issues.example.com/browse/SEC-464',
        metadata: [],
      },
    ],
  },
];
