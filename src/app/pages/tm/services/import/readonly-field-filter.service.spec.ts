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
    it('should construct typed output with only allowed fields', () => {
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
        is_confidential: false,
      });
      expect(metadata).toBeUndefined();
    });

    it('should extract metadata separately and omit it from filtered', () => {
      const mockMetadata: Metadata[] = [{ key: 'custom-key', value: 'custom-value' }];

      const data = {
        id: 'tm-123',
        name: 'My Threat Model',
        metadata: mockMetadata,
      };

      const { filtered, metadata } = service.filterThreatModel(data);

      // metadata is omitted from filtered (handled via metadata endpoint)
      expect(filtered).toEqual({
        name: 'My Threat Model',
        is_confidential: false,
      });
      expect(metadata).toEqual(mockMetadata);
    });

    it('should include only allowed fields from input', () => {
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
      expect((filtered as Record<string, unknown>)['id']).toBeUndefined();
    });
  });

  describe('filterThreat()', () => {
    it('should construct typed output with only allowed fields', () => {
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
        threat_type: [],
        include_in_report: true,
        timmy_enabled: true,
      });
      expect(metadata).toBeUndefined();
    });

    it('should extract metadata separately and omit it from filtered', () => {
      const mockMetadata: Metadata[] = [{ key: 'jira-ticket', value: 'SEC-123' }];

      const data = {
        name: 'SQL Injection',
        metadata: mockMetadata,
        id: 'threat-123',
      };

      const { filtered, metadata } = service.filterThreat(data);

      // metadata is omitted from filtered (handled via metadata endpoint)
      expect(filtered).toEqual({
        name: 'SQL Injection',
        threat_type: [],
        include_in_report: true,
        timmy_enabled: true,
      });
      expect(metadata).toEqual(mockMetadata);
    });
  });

  describe('filterDiagram()', () => {
    it('should only include name and type in filtered output (allow-list)', () => {
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
        { id: 'cell-2', shape: 'flow' },
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

    it('should exclude unknown fields not in CreateDiagramRequest', () => {
      const data = {
        id: 'diagram-123',
        name: 'My Diagram',
        type: 'dfd',
        color_palette: [{ name: 'red', value: '#ff0000' }],
        deleted_at: '2024-06-01',
        some_future_field: 'unexpected',
      };

      const { filtered, colorPalette } = service.filterDiagram(data);

      expect(filtered).toEqual({
        name: 'My Diagram',
        type: 'dfd',
      });
      expect(colorPalette).toEqual([{ name: 'red', value: '#ff0000' }]);
    });

    it('should extract color_palette and timmy_enabled for PUT', () => {
      const data = {
        name: 'My Diagram',
        type: 'dfd',
        color_palette: [{ name: 'blue', value: '#0000ff' }],
        timmy_enabled: false,
      };

      const { filtered, colorPalette, timmyEnabled } = service.filterDiagram(data);

      expect(filtered).toEqual({
        name: 'My Diagram',
        type: 'dfd',
      });
      expect(colorPalette).toEqual([{ name: 'blue', value: '#0000ff' }]);
      expect(timmyEnabled).toBe(false);
    });

    it('should filter all non-allowed fields for POST', () => {
      const data = {
        id: 'diagram-123',
        name: 'My Diagram',
        type: 'dfd',
        description: 'This should be extracted',
        include_in_report: false,
        cells: [],
        image: {},
        metadata: [],
      };

      const { filtered, includeInReport } = service.filterDiagram(data);

      expect(filtered).toEqual({
        name: 'My Diagram',
        type: 'dfd',
      });
      expect(includeInReport).toBe(false);
    });
  });

  describe('filterNote()', () => {
    it('should construct typed output with only allowed fields', () => {
      const data = {
        id: 'note-123',
        name: 'Important Note',
        content: 'This is the note content',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
        metadata: [],
      };

      const { filtered, metadata } = service.filterNote(data);

      expect(filtered).toEqual({
        name: 'Important Note',
        content: 'This is the note content',
        include_in_report: true,
        timmy_enabled: true,
      });
      expect(metadata).toEqual([]);
    });

    it('should extract metadata separately and omit it from filtered', () => {
      const mockMetadata: Metadata[] = [{ key: 'color', value: 'yellow' }];

      const data = {
        name: 'Note',
        metadata: mockMetadata,
      };

      const { filtered, metadata } = service.filterNote(data);

      expect(filtered).toEqual({
        name: 'Note',
        content: '',
        include_in_report: true,
        timmy_enabled: true,
      });
      expect(metadata).toEqual(mockMetadata);
    });
  });

  describe('filterAsset()', () => {
    it('should construct typed output with only allowed fields', () => {
      const data = {
        id: 'asset-123',
        threat_model_id: 'tm-123',
        name: 'Database',
        type: 'data',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
        metadata: [],
      };

      const { filtered, metadata } = service.filterAsset(data);

      expect(filtered).toEqual({
        name: 'Database',
        type: 'data',
        include_in_report: true,
        timmy_enabled: true,
      });
      expect(metadata).toEqual([]);
    });

    it('should extract metadata separately and omit it from filtered', () => {
      const mockMetadata: Metadata[] = [{ key: 'classification', value: 'confidential' }];

      const data = {
        name: 'Database',
        metadata: mockMetadata,
        id: 'asset-123',
      };

      const { filtered, metadata } = service.filterAsset(data);

      expect(filtered).toEqual({
        name: 'Database',
        type: 'data',
        include_in_report: true,
        timmy_enabled: true,
      });
      expect(metadata).toEqual(mockMetadata);
    });
  });

  describe('filterDocument()', () => {
    it('should construct typed output with only allowed fields', () => {
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
        include_in_report: true,
        timmy_enabled: true,
      });
      expect(metadata).toEqual([]);
    });

    it('should extract metadata separately and omit it from filtered', () => {
      const mockMetadata: Metadata[] = [{ key: 'doc-type', value: 'policy' }];

      const data = {
        name: 'Document',
        metadata: mockMetadata,
      };

      const { filtered, metadata } = service.filterDocument(data);

      expect(filtered).toEqual({
        name: 'Document',
        uri: '',
        include_in_report: true,
        timmy_enabled: true,
      });
      expect(metadata).toEqual(mockMetadata);
    });
  });

  describe('filterRepository()', () => {
    it('should construct typed output with only allowed fields', () => {
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
        include_in_report: true,
        timmy_enabled: true,
      });
      expect(metadata).toEqual([]);
    });

    it('should extract metadata separately and omit it from filtered', () => {
      const mockMetadata: Metadata[] = [{ key: 'branch', value: 'main' }];

      const data = {
        name: 'Repository',
        metadata: mockMetadata,
      };

      const { filtered, metadata } = service.filterRepository(data);

      expect(filtered).toEqual({
        name: 'Repository',
        uri: '',
        include_in_report: true,
        timmy_enabled: true,
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
        shape: 'flow', // Legacy shape
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
        shape: 'flow',
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
        { id: 'edge-1', shape: 'flow', source: { cell: 'n1' }, target: { cell: 'n2' } },
        { id: 'node-1', shape: 'process' },
        { id: 'edge-2', shape: 'flow', source: { cell: 'n3' }, target: { cell: 'n4' } },
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

      expect(filtered).toEqual({
        name: 'Test',
        description: 'Description',
        is_confidential: false,
      });
    });

    it('should handle objects with all readonly fields', () => {
      const data = {
        id: 'test-123',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
      };

      const { filtered } = service.filterThreat(data);

      // Returns required defaults even when no writable fields are present
      expect(filtered).toEqual({
        name: undefined,
        threat_type: [],
        include_in_report: true,
        timmy_enabled: true,
      });
    });

    it('should handle empty objects', () => {
      const { filtered, metadata } = service.filterThreatModel({});

      // Returns required defaults even for empty input
      expect(filtered).toEqual({
        name: undefined,
        is_confidential: false,
      });
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
