// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { describe, it, expect } from 'vitest';

import { ChatContextBuilderService, isTimmyEnabled } from './chat-context-builder.service';
import { ThreatModel } from '../../tm/models/threat-model.model';

describe('isTimmyEnabled', () => {
  it('should return true when metadata is undefined', () => {
    expect(isTimmyEnabled({ metadata: undefined })).toBe(true);
  });

  it('should return true when metadata is empty', () => {
    expect(isTimmyEnabled({ metadata: [] })).toBe(true);
  });

  it('should return true when timmy key is absent', () => {
    expect(isTimmyEnabled({ metadata: [{ key: 'other', value: 'value' }] })).toBe(true);
  });

  it('should return true when timmy value is "true"', () => {
    expect(isTimmyEnabled({ metadata: [{ key: 'timmy', value: 'true' }] })).toBe(true);
  });

  it('should return false when timmy value is "false"', () => {
    expect(isTimmyEnabled({ metadata: [{ key: 'timmy', value: 'false' }] })).toBe(false);
  });
});

describe('ChatContextBuilderService', () => {
  let service: ChatContextBuilderService;

  const baseThreatModel: ThreatModel = {
    id: 'tm-1',
    name: 'Test Model',
    description: 'A test threat model',
    created_at: '2025-01-01T00:00:00Z',
    modified_at: '2025-01-02T00:00:00Z',
    owner: {
      principal_type: 'user',
      provider: 'test',
      provider_id: 'user-1',
      display_name: 'Test User',
      email: 'test@example.com',
    },
    created_by: {
      principal_type: 'user',
      provider: 'test',
      provider_id: 'user-1',
      display_name: 'Test User',
      email: 'test@example.com',
    },
    threat_model_framework: 'STRIDE',
    authorization: [],
    documents: [],
    repositories: [],
    notes: [],
    assets: [],
    threats: [],
    diagrams: [],
  };

  beforeEach(() => {
    service = new ChatContextBuilderService();
  });

  it('should build context with threat model metadata', () => {
    const result = service.buildContext(baseThreatModel);

    expect(result.threatModel.id).toBe('tm-1');
    expect(result.threatModel.name).toBe('Test Model');
    expect(result.threatModel.framework).toBe('STRIDE');
    expect(result.entities).toHaveLength(0);
  });

  it('should serialize notes with content', () => {
    const tm: ThreatModel = {
      ...baseThreatModel,
      notes: [
        {
          id: 'note-1',
          name: 'Security Note',
          content: '# Important\nSome content here',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const result = service.buildContext(tm);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].type).toBe('note');
    expect(result.entities[0].name).toBe('Security Note');
    expect(result.entities[0].summary).toContain('# Important');
  });

  it('should exclude entities with timmy=false metadata', () => {
    const tm: ThreatModel = {
      ...baseThreatModel,
      notes: [
        {
          id: 'note-included',
          name: 'Included Note',
          content: 'visible',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'note-excluded',
          name: 'Excluded Note',
          content: 'hidden',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
          metadata: [{ key: 'timmy', value: 'false' }],
        },
      ],
    };

    const result = service.buildContext(tm);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].id).toBe('note-included');
  });

  it('should serialize threats with severity and status', () => {
    const tm: ThreatModel = {
      ...baseThreatModel,
      threats: [
        {
          id: 'threat-1',
          threat_model_id: 'tm-1',
          name: 'SQL Injection',
          description: 'Input validation bypass',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
          threat_type: ['Tampering', 'Elevation of Privilege'],
          severity: 'critical',
          score: 9.1,
          status: 'open',
        },
      ],
    };

    const result = service.buildContext(tm);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].summary).toContain('Severity: critical');
    expect(result.entities[0].summary).toContain('Score: 9.1');
    expect(result.entities[0].summary).toContain('Status: open');
    expect(result.entities[0].summary).toContain('Tampering, Elevation of Privilege');
  });

  it('should serialize assets with type and criticality', () => {
    const tm: ThreatModel = {
      ...baseThreatModel,
      assets: [
        {
          id: 'asset-1',
          name: 'Database',
          description: 'Customer data store',
          type: 'data',
          criticality: 'high',
          sensitivity: 'pii',
          classification: ['confidential'],
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const result = service.buildContext(tm);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].summary).toContain('Type: data');
    expect(result.entities[0].summary).toContain('Criticality: high');
    expect(result.entities[0].summary).toContain('Classification: confidential');
  });

  it('should serialize documents with URI', () => {
    const tm: ThreatModel = {
      ...baseThreatModel,
      documents: [
        {
          id: 'doc-1',
          name: 'Architecture Doc',
          uri: 'https://docs.example.com/arch.pdf',
          description: 'System architecture',
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const result = service.buildContext(tm);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].summary).toContain('URI: https://docs.example.com/arch.pdf');
  });

  it('should serialize repositories with ref info', () => {
    const tm: ThreatModel = {
      ...baseThreatModel,
      repositories: [
        {
          id: 'repo-1',
          name: 'Main Repo',
          type: 'git',
          uri: 'https://github.com/org/repo.git',
          parameters: {
            refType: 'branch',
            refValue: 'main',
            subPath: 'src/',
          },
          created_at: '2025-01-01T00:00:00Z',
          modified_at: '2025-01-01T00:00:00Z',
        },
      ],
    };

    const result = service.buildContext(tm);
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].summary).toContain('Ref: branch/main');
    expect(result.entities[0].summary).toContain('Path: src/');
  });

  it('should handle empty/undefined sub-entity collections', () => {
    const tm: ThreatModel = {
      ...baseThreatModel,
      documents: undefined,
      repositories: undefined,
      notes: undefined,
      assets: undefined,
      threats: undefined,
      diagrams: undefined,
    };

    const result = service.buildContext(tm);
    expect(result.entities).toHaveLength(0);
  });
});
