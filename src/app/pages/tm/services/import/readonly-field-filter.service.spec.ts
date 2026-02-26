// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { vi, expect, beforeEach, describe, it } from 'vitest';
import type { Metadata } from '../../models/threat-model.model';
import { ReadonlyFieldFilterService } from './readonly-field-filter.service';
import type { LoggerService } from '../../../../core/services/logger.service';

describe('ReadonlyFieldFilterService', () => {
  let service: ReadonlyFieldFilterService;
  let mockLogger: LoggerService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = {
      warn: vi.fn(),
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    } as unknown as LoggerService;
    service = new ReadonlyFieldFilterService(mockLogger);
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('filterThreatModel()', () => {
    it('should filter read-only fields from threat model', () => {
      const data = {
        id: 'tm-123',
        name: 'My Threat Model',
        description: 'Test description',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
        created_by: 'user@example.com',
        owner: { provider: 'google', provider_id: 'google-123' },
        documents: [],
        repositories: [],
        diagrams: [],
        threats: [],
        notes: [],
        assets: [],
        status_updated: '2024-01-03',
      };

      const { filtered, metadata } = service.filterThreatModel(data);

      expect(filtered).toEqual({
        name: 'My Threat Model',
        description: 'Test description',
      });
      expect(metadata).toBeUndefined();
    });

    it('should extract metadata separately', () => {
      const mockMetadata: Metadata[] = [{ key: 'custom-key', value: 'custom-value' }];

      const data = {
        id: 'tm-123',
        name: 'My Threat Model',
        metadata: mockMetadata,
      };

      const { filtered, metadata } = service.filterThreatModel(data);

      // metadata is extracted but NOT filtered from the object (it's returned separately)
      expect(filtered).toEqual({
        name: 'My Threat Model',
        metadata: mockMetadata,
      });
      expect(metadata).toEqual(mockMetadata);
    });

    it('should preserve non-readonly fields', () => {
      const data = {
        name: 'My Threat Model',
        description: 'Test',
        threat_model_framework: 'STRIDE',
        id: 'tm-123',
      };

      const { filtered } = service.filterThreatModel(data);

      expect(filtered.name).toBe('My Threat Model');
      expect(filtered.description).toBe('Test');
      expect(filtered.threat_model_framework).toBe('STRIDE');
      expect(filtered.id).toBeUndefined();
    });
  });

  describe('filterThreat()', () => {
    it('should filter read-only fields from threat', () => {
      const data = {
        id: 'threat-123',
        threat_model_id: 'tm-123',
        name: 'SQL Injection',
        severity: 'high',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
      };

      const { filtered, metadata } = service.filterThreat(data);

      expect(filtered).toEqual({
        name: 'SQL Injection',
        severity: 'high',
      });
      expect(metadata).toBeUndefined();
    });

    it('should extract metadata separately', () => {
      const mockMetadata: Metadata[] = [{ key: 'jira-ticket', value: 'SEC-123' }];

      const data = {
        name: 'SQL Injection',
        metadata: mockMetadata,
        id: 'threat-123',
      };

      const { filtered, metadata } = service.filterThreat(data);

      // metadata is extracted but NOT filtered from the object (it's returned separately)
      expect(filtered).toEqual({
        name: 'SQL Injection',
        metadata: mockMetadata,
      });
      expect(metadata).toEqual(mockMetadata);
    });
  });

  describe('filterDiagram()', () => {
    it('should filter read-only and create-only fields from diagram', () => {
      const data = {
        id: 'diagram-123',
        name: 'System Architecture',
        type: 'dfd',
        update_vector: 'abc123',
        cells: [{ id: 'cell-1', shape: 'node' }],
        description: 'Main diagram',
        include_in_report: true,
        image: { svg: 'base64...' },
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
      };

      const { filtered, metadata, cells, includeInReport } = service.filterDiagram(data);

      expect(filtered).toEqual({
        name: 'System Architecture',
        type: 'dfd',
      });
      expect(cells).toEqual([{ id: 'cell-1', shape: 'node' }]);
      expect(includeInReport).toBe(true);
      expect(metadata).toBeUndefined();
    });

    it('should extract metadata and cells separately', () => {
      const mockMetadata: Metadata[] = [{ key: 'version', value: '1.0' }];
      const mockCells = [
        { id: 'cell-1', shape: 'node' },
        { id: 'cell-2', shape: 'edge' },
      ];

      const data = {
        name: 'My Diagram',
        type: 'dfd',
        metadata: mockMetadata,
        cells: mockCells,
      };

      const { filtered, metadata, cells } = service.filterDiagram(data);

      expect(filtered).toEqual({
        name: 'My Diagram',
        type: 'dfd',
      });
      expect(metadata).toEqual(mockMetadata);
      expect(cells).toEqual(mockCells);
    });

    it('should filter both readonly and create-only fields for POST', () => {
      const data = {
        id: 'diagram-123',
        name: 'My Diagram',
        type: 'dfd',
        description: 'This should be filtered',
        include_in_report: false,
        cells: [],
        image: {},
        metadata: [],
      };

      const { filtered, includeInReport } = service.filterDiagram(data);

      // Only name and type should remain for CreateDiagramRequest
      expect(filtered).toEqual({
        name: 'My Diagram',
        type: 'dfd',
      });
      expect(includeInReport).toBe(false);
    });
  });

  describe('filterNote()', () => {
    it('should filter read-only fields from note', () => {
      const data = {
        id: 'note-123',
        name: 'Important Note',
        text: 'This is the note content',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
        metadata: [],
      };

      const { filtered, metadata } = service.filterNote(data);

      expect(filtered).toEqual({
        name: 'Important Note',
        text: 'This is the note content',
      });
      expect(metadata).toEqual([]);
    });

    it('should extract metadata separately', () => {
      const mockMetadata: Metadata[] = [{ key: 'color', value: 'yellow' }];

      const data = {
        name: 'Note',
        metadata: mockMetadata,
      };

      const { filtered, metadata } = service.filterNote(data);

      expect(filtered).toEqual({
        name: 'Note',
      });
      expect(metadata).toEqual(mockMetadata);
    });
  });

  describe('filterAsset()', () => {
    it('should filter read-only fields from asset', () => {
      const data = {
        id: 'asset-123',
        threat_model_id: 'tm-123',
        name: 'Database',
        asset_type: 'data-store',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
        metadata: [],
      };

      const { filtered, metadata } = service.filterAsset(data);

      expect(filtered).toEqual({
        name: 'Database',
        asset_type: 'data-store',
      });
      expect(metadata).toEqual([]);
    });

    it('should extract metadata separately', () => {
      const mockMetadata: Metadata[] = [{ key: 'classification', value: 'confidential' }];

      const data = {
        name: 'Database',
        metadata: mockMetadata,
        id: 'asset-123',
      };

      const { filtered, metadata } = service.filterAsset(data);

      expect(filtered).toEqual({
        name: 'Database',
      });
      expect(metadata).toEqual(mockMetadata);
    });
  });

  describe('filterDocument()', () => {
    it('should filter read-only fields from document', () => {
      const data = {
        id: 'doc-123',
        name: 'Security Policy',
        uri: 'https://example.com/policy.pdf',
        description: 'Corporate security policy',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
        metadata: [],
      };

      const { filtered, metadata } = service.filterDocument(data);

      expect(filtered).toEqual({
        name: 'Security Policy',
        uri: 'https://example.com/policy.pdf',
        description: 'Corporate security policy',
      });
      expect(metadata).toEqual([]);
    });

    it('should extract metadata separately', () => {
      const mockMetadata: Metadata[] = [{ key: 'doc-type', value: 'policy' }];

      const data = {
        name: 'Document',
        metadata: mockMetadata,
      };

      const { filtered, metadata } = service.filterDocument(data);

      expect(filtered).toEqual({
        name: 'Document',
      });
      expect(metadata).toEqual(mockMetadata);
    });
  });

  describe('filterRepository()', () => {
    it('should filter read-only fields from repository', () => {
      const data = {
        id: 'repo-123',
        name: 'Main Codebase',
        type: 'git',
        uri: 'https://github.com/example/repo',
        description: 'Main application repository',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
        metadata: [],
      };

      const { filtered, metadata } = service.filterRepository(data);

      expect(filtered).toEqual({
        name: 'Main Codebase',
        type: 'git',
        uri: 'https://github.com/example/repo',
        description: 'Main application repository',
      });
      expect(metadata).toEqual([]);
    });

    it('should extract metadata separately', () => {
      const mockMetadata: Metadata[] = [{ key: 'branch', value: 'main' }];

      const data = {
        name: 'Repository',
        metadata: mockMetadata,
      };

      const { filtered, metadata } = service.filterRepository(data);

      expect(filtered).toEqual({
        name: 'Repository',
      });
      expect(metadata).toEqual(mockMetadata);
    });
  });

  describe('filterAuthorization()', () => {
    it('should filter display_name from authorization', () => {
      const data = {
        principal_type: 'user',
        provider: 'google',
        provider_id: 'google-123',
        role: 'writer',
        display_name: 'John Doe',
      };

      const filtered = service.filterAuthorization(data);

      expect(filtered).toEqual({
        principal_type: 'user',
        provider: 'google',
        provider_id: 'google-123',
        role: 'writer',
      });
    });

    it('should preserve all other authorization fields', () => {
      const data = {
        principal_type: 'group',
        provider: 'github',
        provider_id: 'team-123',
        role: 'reader',
        custom_field: 'custom_value',
      };

      const filtered = service.filterAuthorization(data);

      expect(filtered).toEqual({
        principal_type: 'group',
        provider: 'github',
        provider_id: 'team-123',
        role: 'reader',
        custom_field: 'custom_value',
      });
    });
  });

  describe('filterAuthorizations()', () => {
    it('should filter array of authorizations', () => {
      const authorizations = [
        {
          principal_type: 'user',
          provider: 'google',
          provider_id: 'google-123',
          role: 'owner',
          display_name: 'Owner User',
        },
        {
          principal_type: 'user',
          provider: 'github',
          provider_id: 'github-456',
          role: 'writer',
          display_name: 'Writer User',
        },
      ];

      const filtered = service.filterAuthorizations(authorizations);

      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toEqual({
        principal_type: 'user',
        provider: 'google',
        provider_id: 'google-123',
        role: 'owner',
      });
      expect(filtered[1]).toEqual({
        principal_type: 'user',
        provider: 'github',
        provider_id: 'github-456',
        role: 'writer',
      });
    });

    it('should handle non-object items in array', () => {
      const authorizations = [
        {
          principal_type: 'user',
          provider: 'google',
          provider_id: 'google-123',
          role: 'owner',
        },
        null,
        'string-value',
      ];

      const filtered = service.filterAuthorizations(authorizations);

      expect(filtered).toHaveLength(3);
      expect(filtered[0]).toEqual({
        principal_type: 'user',
        provider: 'google',
        provider_id: 'google-123',
        role: 'owner',
      });
      expect(filtered[1]).toBeNull();
      expect(filtered[2]).toBe('string-value');
    });

    it('should handle empty array', () => {
      const filtered = service.filterAuthorizations([]);

      expect(filtered).toEqual([]);
    });
  });

  describe('filterCell()', () => {
    it('should normalize edge shape to "flow"', () => {
      const edgeCell = {
        id: 'edge-1',
        shape: 'edge', // Legacy shape
        source: { cell: 'node-1' },
        target: { cell: 'node-2' },
      };

      const filtered = service.filterCell(edgeCell);

      expect(filtered.shape).toBe('flow'); // Normalized to canonical 'flow'
    });

    it('should preserve shape for node cells', () => {
      const nodeCell = {
        id: 'node-1',
        shape: 'process',
        position: { x: 100, y: 200 },
      };

      const filtered = service.filterCell(nodeCell);

      expect(filtered.shape).toBe('process');
    });

    it('should remove known transient properties but preserve children', () => {
      const cell = {
        id: 'node-1',
        shape: 'process',
        children: ['child-1'],
        tools: [{ name: 'button' }],
        type: 'node',
        visible: true,
        zIndex: 10,
        markup: [{ tagName: 'rect' }],
      };

      const filtered = service.filterCell(cell);

      expect(filtered.id).toBe('node-1');
      expect(filtered.shape).toBe('process');
      // children is now preserved for API schema (pending server update)
      expect(filtered['children']).toEqual(['child-1']);
      expect(filtered['tools']).toBeUndefined();
      expect(filtered['type']).toBeUndefined();
      expect(filtered['visible']).toBeUndefined();
      expect(filtered['zIndex']).toBeUndefined();
      expect(filtered['markup']).toBeUndefined();
    });

    it('should filter edge attrs to match EdgeAttrs schema', () => {
      const cell = {
        id: 'edge-1',
        shape: 'edge',
        source: { cell: 'node-1', port: 'out' },
        target: { cell: 'node-2', port: 'in' },
        attrs: {
          line: {
            stroke: '#000',
            strokeWidth: 2,
            filter: 'blur(5px)', // Known transient - should be removed
          },
        },
      };

      const filtered = service.filterCell(cell);

      expect(filtered.id).toBe('edge-1');
      expect(filtered.source).toEqual({ cell: 'node-1', port: 'out' });
      expect(filtered.target).toEqual({ cell: 'node-2', port: 'in' });
      expect(filtered.attrs).toEqual({ line: { stroke: '#000', strokeWidth: 2 } });
    });

    it('should filter node attrs to match NodeAttrs schema', () => {
      const cell = {
        id: 'node-1',
        shape: 'process',
        attrs: {
          body: {
            fill: '#fff',
            stroke: '#333',
            filter: 'blur(5px)', // Known transient - should be removed
          },
          text: {
            text: 'Process',
            fontSize: 14,
          },
        },
      };

      const filtered = service.filterCell(cell);

      expect(filtered.attrs).toEqual({
        body: { fill: '#fff', stroke: '#333' },
        text: { text: 'Process', fontSize: 14 },
      });
    });
  });

  describe('filterCells()', () => {
    it('should filter array of cells and normalize edge shapes', () => {
      const cells = [
        { id: 'edge-1', shape: 'edge', source: { cell: 'n1' }, target: { cell: 'n2' } },
        { id: 'node-1', shape: 'process' },
        { id: 'edge-2', shape: 'edge', source: { cell: 'n3' }, target: { cell: 'n4' } },
      ];

      const filtered = service.filterCells(cells);

      expect(filtered).toHaveLength(3);
      expect((filtered[0] as any).shape).toBe('flow'); // Normalized from 'edge'
      expect((filtered[1] as any).shape).toBe('process');
      expect((filtered[2] as any).shape).toBe('flow'); // Normalized from 'edge'
    });

    it('should convert children arrays to parent references while preserving children', () => {
      const cells = [
        { id: 'boundary-1', shape: 'security-boundary', children: ['node-1', 'node-2'] },
        { id: 'node-1', shape: 'process' },
        { id: 'node-2', shape: 'store' },
      ];

      const filtered = service.filterCells(cells);

      // Boundary should retain children property (now preserved for API schema)
      expect((filtered[0] as any).children).toEqual(['node-1', 'node-2']);

      // Child nodes should have parent set (derived from children array)
      expect((filtered[1] as any).parent).toBe('boundary-1');
      expect((filtered[2] as any).parent).toBe('boundary-1');
    });

    it('should filter out non-object items from array', () => {
      const cells = [{ id: 'node-1', shape: 'process' }, null, 'string-value'];

      const filtered = service.filterCells(cells);

      // Only valid object cells are kept
      expect(filtered).toHaveLength(1);
      expect((filtered[0] as any).id).toBe('node-1');
    });

    it('should handle empty array', () => {
      const filtered = service.filterCells([]);

      expect(filtered).toEqual([]);
    });

    it('should warn about unknown properties', () => {
      const cells = [{ id: 'node-1', shape: 'process', unknownProp: 'value' }];

      service.filterCells(cells);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.warn.mock.calls[0][0]).toContain('unknownProp');
    });
  });

  describe('Edge Cases', () => {
    it('should handle objects with no fields to filter', () => {
      const data = {
        name: 'Test',
        description: 'Description',
      };

      const { filtered } = service.filterThreatModel(data);

      expect(filtered).toEqual(data);
    });

    it('should handle objects with all readonly fields', () => {
      const data = {
        id: 'test-123',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
      };

      const { filtered } = service.filterThreat(data);

      expect(filtered).toEqual({});
    });

    it('should handle empty objects', () => {
      const { filtered, metadata } = service.filterThreatModel({});

      expect(filtered).toEqual({});
      expect(metadata).toBeUndefined();
    });

    it('should not modify original object', () => {
      const data = {
        id: 'test-123',
        name: 'Test',
        created_at: '2024-01-01',
      };

      const original = { ...data };
      service.filterThreatModel(data);

      expect(data).toEqual(original);
    });
  });
});
