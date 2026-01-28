// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReferenceRewriterService } from './reference-rewriter.service';
import type { IdTranslationService } from './id-translation.service';

describe('ReferenceRewriterService', () => {
  let service: ReferenceRewriterService;
  let mockIdTranslation: {
    getDiagramId: ReturnType<typeof vi.fn>;
    getAssetId: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock IdTranslationService
    mockIdTranslation = {
      getDiagramId: vi.fn(),
      getAssetId: vi.fn(),
    };

    // Instantiate service with mock dependency
    service = new ReferenceRewriterService(mockIdTranslation as unknown as IdTranslationService);
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('rewriteThreatReferences()', () => {
    it('should rewrite diagram_id when translation exists', () => {
      mockIdTranslation.getDiagramId.mockReturnValue('new-diagram-123');

      const threat = {
        id: 'threat-1',
        name: 'SQL Injection',
        diagram_id: 'old-diagram-123',
      };

      const result = service.rewriteThreatReferences(threat);

      expect(mockIdTranslation.getDiagramId).toHaveBeenCalledWith('old-diagram-123');
      expect(result).toEqual({
        id: 'threat-1',
        name: 'SQL Injection',
        diagram_id: 'new-diagram-123',
      });
    });

    it('should remove diagram_id when translation not found', () => {
      mockIdTranslation.getDiagramId.mockReturnValue(undefined);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const threat = {
        id: 'threat-1',
        name: 'SQL Injection',
        diagram_id: 'unknown-diagram',
      };

      const result = service.rewriteThreatReferences(threat);

      expect(mockIdTranslation.getDiagramId).toHaveBeenCalledWith('unknown-diagram');
      expect(result).toEqual({
        id: 'threat-1',
        name: 'SQL Injection',
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Threat references unknown diagram_id: unknown-diagram. Reference will be cleared.',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should rewrite asset_id when translation exists', () => {
      mockIdTranslation.getAssetId.mockReturnValue('new-asset-456');

      const threat = {
        id: 'threat-1',
        name: 'XSS Attack',
        asset_id: 'old-asset-456',
      };

      const result = service.rewriteThreatReferences(threat);

      expect(mockIdTranslation.getAssetId).toHaveBeenCalledWith('old-asset-456');
      expect(result).toEqual({
        id: 'threat-1',
        name: 'XSS Attack',
        asset_id: 'new-asset-456',
      });
    });

    it('should remove asset_id when translation not found', () => {
      mockIdTranslation.getAssetId.mockReturnValue(undefined);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const threat = {
        id: 'threat-1',
        name: 'XSS Attack',
        asset_id: 'unknown-asset',
      };

      const result = service.rewriteThreatReferences(threat);

      expect(mockIdTranslation.getAssetId).toHaveBeenCalledWith('unknown-asset');
      expect(result).toEqual({
        id: 'threat-1',
        name: 'XSS Attack',
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Threat references unknown asset_id: unknown-asset. Reference will be cleared.',
      );

      consoleWarnSpy.mockRestore();
    });

    it('should rewrite both diagram_id and asset_id when translations exist', () => {
      mockIdTranslation.getDiagramId.mockReturnValue('new-diagram-789');
      mockIdTranslation.getAssetId.mockReturnValue('new-asset-101');

      const threat = {
        id: 'threat-1',
        name: 'CSRF Attack',
        diagram_id: 'old-diagram-789',
        asset_id: 'old-asset-101',
      };

      const result = service.rewriteThreatReferences(threat);

      expect(mockIdTranslation.getDiagramId).toHaveBeenCalledWith('old-diagram-789');
      expect(mockIdTranslation.getAssetId).toHaveBeenCalledWith('old-asset-101');
      expect(result).toEqual({
        id: 'threat-1',
        name: 'CSRF Attack',
        diagram_id: 'new-diagram-789',
        asset_id: 'new-asset-101',
      });
    });

    it('should preserve cell_id without rewriting', () => {
      const threat = {
        id: 'threat-1',
        name: 'Threat',
        cell_id: 'client-cell-123',
      };

      const result = service.rewriteThreatReferences(threat);

      expect(result).toEqual({
        id: 'threat-1',
        name: 'Threat',
        cell_id: 'client-cell-123',
      });
      expect(mockIdTranslation.getDiagramId).not.toHaveBeenCalled();
      expect(mockIdTranslation.getAssetId).not.toHaveBeenCalled();
    });

    it('should handle threat with no references', () => {
      const threat = {
        id: 'threat-1',
        name: 'Generic Threat',
        description: 'Some description',
      };

      const result = service.rewriteThreatReferences(threat);

      expect(result).toEqual(threat);
      expect(mockIdTranslation.getDiagramId).not.toHaveBeenCalled();
      expect(mockIdTranslation.getAssetId).not.toHaveBeenCalled();
    });

    it('should skip empty string diagram_id', () => {
      const threat = {
        id: 'threat-1',
        name: 'Threat',
        diagram_id: '',
      };

      const result = service.rewriteThreatReferences(threat);

      expect(result).toEqual({
        id: 'threat-1',
        name: 'Threat',
        diagram_id: '',
      });
      expect(mockIdTranslation.getDiagramId).not.toHaveBeenCalled();
    });

    it('should skip empty string asset_id', () => {
      const threat = {
        id: 'threat-1',
        name: 'Threat',
        asset_id: '',
      };

      const result = service.rewriteThreatReferences(threat);

      expect(result).toEqual({
        id: 'threat-1',
        name: 'Threat',
        asset_id: '',
      });
      expect(mockIdTranslation.getAssetId).not.toHaveBeenCalled();
    });

    it('should skip non-string diagram_id', () => {
      const threat = {
        id: 'threat-1',
        name: 'Threat',
        diagram_id: null,
      };

      const result = service.rewriteThreatReferences(threat);

      expect(result).toEqual({
        id: 'threat-1',
        name: 'Threat',
        diagram_id: null,
      });
      expect(mockIdTranslation.getDiagramId).not.toHaveBeenCalled();
    });

    it('should skip non-string asset_id', () => {
      const threat = {
        id: 'threat-1',
        name: 'Threat',
        asset_id: 123,
      };

      const result = service.rewriteThreatReferences(threat);

      expect(result).toEqual({
        id: 'threat-1',
        name: 'Threat',
        asset_id: 123,
      });
      expect(mockIdTranslation.getAssetId).not.toHaveBeenCalled();
    });

    it('should not mutate original threat object', () => {
      mockIdTranslation.getDiagramId.mockReturnValue('new-diagram-999');

      const original = {
        id: 'threat-1',
        name: 'Threat',
        diagram_id: 'old-diagram-999',
      };

      const result = service.rewriteThreatReferences(original);

      expect(original.diagram_id).toBe('old-diagram-999');
      expect(result.diagram_id).toBe('new-diagram-999');
      expect(result).not.toBe(original);
    });
  });

  describe('rewriteDiagramReferences()', () => {
    it('should return a copy of the diagram', () => {
      const diagram = {
        id: 'diagram-1',
        name: 'Architecture Diagram',
        cells: [
          { id: 'cell-1', shape: 'rect' },
          { id: 'cell-2', shape: 'edge' },
        ],
      };

      const result = service.rewriteDiagramReferences(diagram);

      expect(result).not.toBe(diagram); // Should be a copy
    });

    it('should preserve client-managed cell IDs', () => {
      const diagram = {
        id: 'diagram-1',
        cells: [
          { id: 'client-cell-123', shape: 'rect' },
          { id: 'client-cell-456', shape: 'edge' },
        ],
      };

      const result = service.rewriteDiagramReferences(diagram);

      expect((result.cells as any[])[0].id).toBe('client-cell-123');
      expect((result.cells as any[])[1].id).toBe('client-cell-456');
    });

    it('should rewrite data_assets in cell data when translations exist', () => {
      mockIdTranslation.getAssetId.mockImplementation((id: string) => {
        const map: Record<string, string> = {
          'old-asset-1': 'new-asset-1',
          'old-asset-2': 'new-asset-2',
        };
        return map[id];
      });

      const diagram = {
        id: 'diagram-1',
        cells: [
          {
            id: 'cell-1',
            shape: 'rect',
            data: { data_assets: ['old-asset-1', 'old-asset-2'] },
          },
        ],
      };

      const result = service.rewriteDiagramReferences(diagram);

      expect((result.cells as any[])[0].data.data_assets).toEqual(['new-asset-1', 'new-asset-2']);
    });

    it('should handle cells without data property', () => {
      const diagram = {
        id: 'diagram-1',
        cells: [{ id: 'cell-1', shape: 'rect' }],
      };

      const result = service.rewriteDiagramReferences(diagram);

      expect((result.cells as any[])[0]).toEqual({ id: 'cell-1', shape: 'rect' });
    });
  });

  describe('rewriteCellDataAssetReferences()', () => {
    it('should rewrite data_assets array when translations exist', () => {
      mockIdTranslation.getAssetId.mockImplementation((id: string) => {
        const map: Record<string, string> = {
          'old-asset-1': 'new-asset-1',
          'old-asset-2': 'new-asset-2',
        };
        return map[id];
      });

      const cellData = {
        nodeType: 'process',
        data_assets: ['old-asset-1', 'old-asset-2'],
      };

      const result = service.rewriteCellDataAssetReferences(cellData);

      expect(result.data_assets).toEqual(['new-asset-1', 'new-asset-2']);
      expect(result.nodeType).toBe('process');
    });

    it('should filter out unmapped asset IDs from data_assets', () => {
      mockIdTranslation.getAssetId.mockImplementation((id: string) => {
        if (id === 'old-asset-1') return 'new-asset-1';
        return undefined; // old-asset-2 not mapped
      });

      const cellData = {
        data_assets: ['old-asset-1', 'old-asset-2'],
      };

      const result = service.rewriteCellDataAssetReferences(cellData);

      expect(result.data_assets).toEqual(['new-asset-1']);
    });

    it('should remove data_assets when all IDs are unmapped', () => {
      mockIdTranslation.getAssetId.mockReturnValue(undefined);

      const cellData = {
        nodeType: 'store',
        data_assets: ['unmapped-1', 'unmapped-2'],
      };

      const result = service.rewriteCellDataAssetReferences(cellData);

      expect(result.data_assets).toBeUndefined();
      expect(result.nodeType).toBe('store');
    });

    it('should migrate legacy dataAssetId to data_assets format', () => {
      mockIdTranslation.getAssetId.mockReturnValue('new-asset-123');

      const cellData = {
        dataAssetId: 'old-asset-123',
      };

      const result = service.rewriteCellDataAssetReferences(cellData);

      expect(result.data_assets).toEqual(['new-asset-123']);
      expect(result.dataAssetId).toBeUndefined();
    });

    it('should remove legacy dataAssetId even when translation not found', () => {
      mockIdTranslation.getAssetId.mockReturnValue(undefined);

      const cellData = {
        dataAssetId: 'unmapped-asset',
        nodeType: 'actor',
      };

      const result = service.rewriteCellDataAssetReferences(cellData);

      expect(result.dataAssetId).toBeUndefined();
      expect(result.data_assets).toBeUndefined();
      expect(result.nodeType).toBe('actor');
    });

    it('should merge legacy dataAssetId into existing data_assets', () => {
      mockIdTranslation.getAssetId.mockImplementation((id: string) => {
        const map: Record<string, string> = {
          'old-asset-1': 'new-asset-1',
          'legacy-asset': 'new-legacy-asset',
        };
        return map[id];
      });

      const cellData = {
        data_assets: ['old-asset-1'],
        dataAssetId: 'legacy-asset',
      };

      const result = service.rewriteCellDataAssetReferences(cellData);

      expect(result.data_assets).toEqual(['new-asset-1', 'new-legacy-asset']);
      expect(result.dataAssetId).toBeUndefined();
    });

    it('should not duplicate when legacy dataAssetId already in data_assets', () => {
      mockIdTranslation.getAssetId.mockReturnValue('same-asset-id');

      const cellData = {
        data_assets: ['old-asset'],
        dataAssetId: 'old-asset',
      };

      const result = service.rewriteCellDataAssetReferences(cellData);

      expect(result.data_assets).toEqual(['same-asset-id']);
      expect(result.dataAssetId).toBeUndefined();
    });

    it('should handle empty data_assets array', () => {
      const cellData = {
        data_assets: [],
        nodeType: 'process',
      };

      const result = service.rewriteCellDataAssetReferences(cellData);

      expect(result.data_assets).toBeUndefined();
      expect(result.nodeType).toBe('process');
    });

    it('should handle cell data without asset references', () => {
      const cellData = {
        nodeType: 'process',
        customField: 'value',
      };

      const result = service.rewriteCellDataAssetReferences(cellData);

      expect(result).toEqual(cellData);
    });
  });

  describe('rewriteNoteReferences()', () => {
    it('should return a copy of the note unchanged', () => {
      const note = {
        id: 'note-1',
        name: 'Important Note',
        content: 'This is a note',
      };

      const result = service.rewriteNoteReferences(note);

      expect(result).toEqual(note);
      expect(result).not.toBe(note); // Should be a copy
    });

    it('should handle note with all properties', () => {
      const note = {
        id: 'note-1',
        name: 'Note',
        content: 'Content',
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
      };

      const result = service.rewriteNoteReferences(note);

      expect(result).toEqual(note);
    });
  });

  describe('rewriteAssetReferences()', () => {
    it('should return a copy of the asset unchanged', () => {
      const asset = {
        id: 'asset-1',
        name: 'Database Server',
        description: 'Main database',
      };

      const result = service.rewriteAssetReferences(asset);

      expect(result).toEqual(asset);
      expect(result).not.toBe(asset); // Should be a copy
    });

    it('should handle asset with all properties', () => {
      const asset = {
        id: 'asset-1',
        name: 'Server',
        description: 'Description',
        type: 'server',
        criticality: 'high',
      };

      const result = service.rewriteAssetReferences(asset);

      expect(result).toEqual(asset);
    });
  });

  describe('rewriteDocumentReferences()', () => {
    it('should return a copy of the document unchanged', () => {
      const document = {
        id: 'doc-1',
        name: 'Security Policy',
        url: 'https://example.com/policy.pdf',
      };

      const result = service.rewriteDocumentReferences(document);

      expect(result).toEqual(document);
      expect(result).not.toBe(document); // Should be a copy
    });

    it('should handle document with all properties', () => {
      const document = {
        id: 'doc-1',
        name: 'Document',
        url: 'https://example.com/doc',
        description: 'Description',
      };

      const result = service.rewriteDocumentReferences(document);

      expect(result).toEqual(document);
    });
  });

  describe('rewriteRepositoryReferences()', () => {
    it('should return a copy of the repository unchanged', () => {
      const repository = {
        id: 'repo-1',
        name: 'Main Repository',
        url: 'https://github.com/org/repo',
      };

      const result = service.rewriteRepositoryReferences(repository);

      expect(result).toEqual(repository);
      expect(result).not.toBe(repository); // Should be a copy
    });

    it('should handle repository with all properties', () => {
      const repository = {
        id: 'repo-1',
        name: 'Repository',
        url: 'https://github.com/org/repo',
        description: 'Description',
        type: 'git',
      };

      const result = service.rewriteRepositoryReferences(repository);

      expect(result).toEqual(repository);
    });
  });
});
