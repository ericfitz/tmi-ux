// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { of, throwError, lastValueFrom } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { ImportOrchestratorService, type ImportDependencies } from './import-orchestrator.service';
import type { IdTranslationService } from './id-translation.service';
import type { ReadonlyFieldFilterService } from './readonly-field-filter.service';
import type { ReferenceRewriterService } from './reference-rewriter.service';
import type { LoggerService } from '../../../../core/services/logger.service';

describe('ImportOrchestratorService', () => {
  let service: ImportOrchestratorService;
  let mockIdTranslation: {
    reset: ReturnType<typeof vi.fn>;
    setThreatModelId: ReturnType<typeof vi.fn>;
    setAssetId: ReturnType<typeof vi.fn>;
    setNoteId: ReturnType<typeof vi.fn>;
    setDiagramId: ReturnType<typeof vi.fn>;
    setThreatId: ReturnType<typeof vi.fn>;
    setDocumentId: ReturnType<typeof vi.fn>;
    setRepositoryId: ReturnType<typeof vi.fn>;
    getStats: ReturnType<typeof vi.fn>;
  };
  let mockFieldFilter: {
    filterThreatModel: ReturnType<typeof vi.fn>;
    filterAsset: ReturnType<typeof vi.fn>;
    filterNote: ReturnType<typeof vi.fn>;
    filterDiagram: ReturnType<typeof vi.fn>;
    filterThreat: ReturnType<typeof vi.fn>;
    filterDocument: ReturnType<typeof vi.fn>;
    filterRepository: ReturnType<typeof vi.fn>;
    filterCells: ReturnType<typeof vi.fn>;
  };
  let mockReferenceRewriter: {
    rewriteAssetReferences: ReturnType<typeof vi.fn>;
    rewriteNoteReferences: ReturnType<typeof vi.fn>;
    rewriteDiagramReferences: ReturnType<typeof vi.fn>;
    rewriteThreatReferences: ReturnType<typeof vi.fn>;
    rewriteDocumentReferences: ReturnType<typeof vi.fn>;
    rewriteRepositoryReferences: ReturnType<typeof vi.fn>;
    rewriteCellDataAssetReferences: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  function createMockDeps(overrides: Partial<ImportDependencies> = {}): ImportDependencies {
    return {
      createThreatModel: vi.fn().mockReturnValue(of({ id: 'new-tm-1', name: 'Imported' })),
      createAsset: vi.fn().mockReturnValue(of({ id: 'new-asset-1' })),
      createNote: vi.fn().mockReturnValue(of({ id: 'new-note-1' })),
      createDiagram: vi
        .fn()
        .mockReturnValue(of({ id: 'new-diagram-1', name: 'Diagram', type: 'dfd' })),
      updateDiagram: vi
        .fn()
        .mockReturnValue(of({ id: 'new-diagram-1', name: 'Diagram', type: 'dfd' })),
      createThreat: vi.fn().mockReturnValue(of({ id: 'new-threat-1' })),
      createDocument: vi.fn().mockReturnValue(of({ id: 'new-doc-1' })),
      createRepository: vi.fn().mockReturnValue(of({ id: 'new-repo-1' })),
      updateThreatModelMetadata: vi.fn().mockReturnValue(of([])),
      updateAssetMetadata: vi.fn().mockReturnValue(of([])),
      updateNoteMetadata: vi.fn().mockReturnValue(of([])),
      updateDiagramMetadata: vi.fn().mockReturnValue(of([])),
      updateThreatMetadata: vi.fn().mockReturnValue(of([])),
      updateDocumentMetadata: vi.fn().mockReturnValue(of([])),
      updateRepositoryMetadata: vi.fn().mockReturnValue(of([])),
      ...overrides,
    };
  }

  function defaultFilterResult(data: Record<string, unknown> = {}): {
    filtered: Record<string, unknown>;
    metadata: undefined;
  } {
    return { filtered: data, metadata: undefined };
  }

  function filterResultWithMetadata(
    data: Record<string, unknown> = {},
    metadata: unknown[] = [{ key: 'k', value: 'v' }],
  ): { filtered: Record<string, unknown>; metadata: unknown[] } {
    return { filtered: data, metadata };
  }

  beforeEach(() => {
    mockIdTranslation = {
      reset: vi.fn(),
      setThreatModelId: vi.fn(),
      setAssetId: vi.fn(),
      setNoteId: vi.fn(),
      setDiagramId: vi.fn(),
      setThreatId: vi.fn(),
      setDocumentId: vi.fn(),
      setRepositoryId: vi.fn(),
      getStats: vi.fn().mockReturnValue({ total: 0 }),
    };

    mockFieldFilter = {
      filterThreatModel: vi.fn().mockReturnValue(defaultFilterResult()),
      filterAsset: vi.fn().mockReturnValue(defaultFilterResult()),
      filterNote: vi.fn().mockReturnValue(defaultFilterResult()),
      filterDiagram: vi.fn().mockReturnValue({
        filtered: {},
        metadata: undefined,
        cells: undefined,
        description: undefined,
        includeInReport: undefined,
        image: undefined,
      }),
      filterThreat: vi.fn().mockReturnValue(defaultFilterResult()),
      filterDocument: vi.fn().mockReturnValue(defaultFilterResult()),
      filterRepository: vi.fn().mockReturnValue(defaultFilterResult()),
      filterCells: vi.fn().mockImplementation((cells: unknown[]) => cells),
    };

    mockReferenceRewriter = {
      rewriteAssetReferences: vi.fn().mockImplementation((data: unknown) => data),
      rewriteNoteReferences: vi.fn().mockImplementation((data: unknown) => data),
      rewriteDiagramReferences: vi.fn().mockImplementation((data: unknown) => data),
      rewriteThreatReferences: vi.fn().mockImplementation((data: unknown) => data),
      rewriteDocumentReferences: vi.fn().mockImplementation((data: unknown) => data),
      rewriteRepositoryReferences: vi.fn().mockImplementation((data: unknown) => data),
      rewriteCellDataAssetReferences: vi.fn().mockImplementation((data: unknown) => data),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    service = new ImportOrchestratorService(
      mockIdTranslation as unknown as IdTranslationService,
      mockFieldFilter as unknown as ReadonlyFieldFilterService,
      mockReferenceRewriter as unknown as ReferenceRewriterService,
      mockLogger as unknown as LoggerService,
    );
  });

  describe('orchestrateImport - basic flow', () => {
    it('should reset ID translation map before each import', async () => {
      const deps = createMockDeps();
      await lastValueFrom(service.orchestrateImport({}, deps));

      expect(mockIdTranslation.reset).toHaveBeenCalled();
    });

    it('should create threat model as first step', async () => {
      const deps = createMockDeps();
      const importData = { name: 'Test TM' };

      await lastValueFrom(service.orchestrateImport(importData, deps));

      expect(mockFieldFilter.filterThreatModel).toHaveBeenCalledWith(importData);
      expect(deps.createThreatModel).toHaveBeenCalled();
    });

    it('should return success=true when import completes with no nested objects', async () => {
      const deps = createMockDeps();
      const result = await lastValueFrom(service.orchestrateImport({}, deps));

      expect(result.success).toBe(true);
      expect(result.threatModel).toEqual({ id: 'new-tm-1', name: 'Imported' });
      expect(result.errors).toEqual([]);
    });

    it('should store threat model ID translation when original has string id', async () => {
      const deps = createMockDeps();
      await lastValueFrom(service.orchestrateImport({ id: 'old-tm-1' }, deps));

      expect(mockIdTranslation.setThreatModelId).toHaveBeenCalledWith('old-tm-1', 'new-tm-1');
    });

    it('should NOT store threat model ID translation when id is not a string', async () => {
      const deps = createMockDeps();
      await lastValueFrom(service.orchestrateImport({ id: 123 }, deps));

      expect(mockIdTranslation.setThreatModelId).not.toHaveBeenCalled();
    });

    it('should NOT store threat model ID translation when id is undefined', async () => {
      const deps = createMockDeps();
      await lastValueFrom(service.orchestrateImport({}, deps));

      expect(mockIdTranslation.setThreatModelId).not.toHaveBeenCalled();
    });
  });

  describe('orchestrateImport - threat model creation failure', () => {
    it('should return success=false when threat model creation fails', async () => {
      const deps = createMockDeps({
        createThreatModel: vi.fn().mockReturnValue(throwError(() => new Error('Create failed'))),
      });

      const result = await lastValueFrom(service.orchestrateImport({}, deps));

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Failed to create threat model: Create failed');
    });

    it('should not attempt nested imports when threat model creation fails', async () => {
      const deps = createMockDeps({
        createThreatModel: vi.fn().mockReturnValue(throwError(() => new Error('fail'))),
      });

      await lastValueFrom(service.orchestrateImport({ assets: [{ id: 'a1' }] }, deps));

      expect(deps.createAsset).not.toHaveBeenCalled();
    });
  });

  describe('orchestrateImport - threat model metadata', () => {
    it('should update threat model metadata when present', async () => {
      mockFieldFilter.filterThreatModel.mockReturnValue(
        filterResultWithMetadata({}, [{ key: 'custom', value: 'data' }]),
      );
      const deps = createMockDeps();

      await lastValueFrom(service.orchestrateImport({}, deps));

      expect(deps.updateThreatModelMetadata).toHaveBeenCalledWith('new-tm-1', [
        { key: 'custom', value: 'data' },
      ]);
    });

    it('should continue import even if metadata update fails', async () => {
      mockFieldFilter.filterThreatModel.mockReturnValue(
        filterResultWithMetadata({}, [{ key: 'k', value: 'v' }]),
      );
      const deps = createMockDeps({
        updateThreatModelMetadata: vi
          .fn()
          .mockReturnValue(throwError(() => new Error('metadata fail'))),
      });

      const result = await lastValueFrom(service.orchestrateImport({}, deps));

      // Import should still succeed even if metadata fails
      expect(result.success).toBe(true);
    });
  });

  describe('orchestrateImport - asset import', () => {
    it('should import assets and track ID translation', async () => {
      const deps = createMockDeps();
      const importData = {
        assets: [{ id: 'old-asset-1', name: 'Asset 1' }],
      };

      const result = await lastValueFrom(service.orchestrateImport(importData, deps));

      expect(deps.createAsset).toHaveBeenCalledWith('new-tm-1', expect.any(Object));
      expect(mockIdTranslation.setAssetId).toHaveBeenCalledWith('old-asset-1', 'new-asset-1');
      expect(result.counts.assets.success).toBe(1);
      expect(result.counts.assets.failed).toBe(0);
    });

    it('should handle asset without original id', async () => {
      const deps = createMockDeps();
      const importData = { assets: [{ name: 'No ID Asset' }] };

      const result = await lastValueFrom(service.orchestrateImport(importData, deps));

      expect(mockIdTranslation.setAssetId).not.toHaveBeenCalled();
      expect(result.counts.assets.success).toBe(1);
    });

    it('should handle mixed asset success and failure', async () => {
      let callCount = 0;
      const deps = createMockDeps({
        createAsset: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            return throwError(() => new Error('Asset 2 failed'));
          }
          return of({ id: `new-asset-${callCount}` });
        }),
      });
      const importData = {
        assets: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
      };

      const result = await lastValueFrom(service.orchestrateImport(importData, deps));

      expect(result.counts.assets.success).toBe(2);
      expect(result.counts.assets.failed).toBe(1);
      expect(result.errors.some((e: string) => e.includes('Asset import failed'))).toBe(true);
      // Import should still succeed overall
      expect(result.success).toBe(true);
    });

    it('should skip asset import when assets array is empty', async () => {
      const deps = createMockDeps();
      await lastValueFrom(service.orchestrateImport({ assets: [] }, deps));

      expect(deps.createAsset).not.toHaveBeenCalled();
    });

    it('should skip asset import when assets field is missing', async () => {
      const deps = createMockDeps();
      await lastValueFrom(service.orchestrateImport({}, deps));

      expect(deps.createAsset).not.toHaveBeenCalled();
    });

    it('should update asset metadata when present', async () => {
      mockFieldFilter.filterAsset.mockReturnValue(
        filterResultWithMetadata({}, [{ key: 'source', value: 'imported' }]),
      );
      const deps = createMockDeps();

      await lastValueFrom(service.orchestrateImport({ assets: [{ id: 'a1' }] }, deps));

      expect(deps.updateAssetMetadata).toHaveBeenCalledWith('new-tm-1', 'new-asset-1', [
        { key: 'source', value: 'imported' },
      ]);
    });

    it('should continue even if asset metadata update fails', async () => {
      mockFieldFilter.filterAsset.mockReturnValue(
        filterResultWithMetadata({}, [{ key: 'k', value: 'v' }]),
      );
      const deps = createMockDeps({
        updateAssetMetadata: vi.fn().mockReturnValue(throwError(() => new Error('metadata fail'))),
      });

      const result = await lastValueFrom(
        service.orchestrateImport({ assets: [{ id: 'a1' }] }, deps),
      );

      // Asset import still counts as success even if metadata fails
      expect(result.counts.assets.success).toBe(1);
    });
  });

  describe('orchestrateImport - diagram import with cells', () => {
    it('should update diagram with cells via updateDiagram after creation', async () => {
      mockFieldFilter.filterDiagram.mockReturnValue({
        filtered: { name: 'DFD', type: 'dfd' },
        metadata: undefined,
        cells: [{ id: 'cell-1', shape: 'process' }],
        description: undefined,
        includeInReport: undefined,
        image: undefined,
      });
      const deps = createMockDeps();

      await lastValueFrom(service.orchestrateImport({ diagrams: [{ id: 'd1' }] }, deps));

      expect(deps.createDiagram).toHaveBeenCalled();
      expect(deps.updateDiagram).toHaveBeenCalledWith(
        'new-tm-1',
        'new-diagram-1',
        expect.objectContaining({ cells: expect.any(Array) }),
      );
    });

    it('should rewrite cell data asset references', async () => {
      const cellData = { data_assets: ['old-asset-1'] };
      mockFieldFilter.filterDiagram.mockReturnValue({
        filtered: { name: 'DFD', type: 'dfd' },
        metadata: undefined,
        cells: [{ id: 'cell-1', data: cellData }],
        description: undefined,
        includeInReport: undefined,
        image: undefined,
      });
      const deps = createMockDeps();

      await lastValueFrom(service.orchestrateImport({ diagrams: [{ id: 'd1' }] }, deps));

      expect(mockReferenceRewriter.rewriteCellDataAssetReferences).toHaveBeenCalledWith(cellData);
    });

    it('should include description and image in diagram update when present', async () => {
      mockFieldFilter.filterDiagram.mockReturnValue({
        filtered: { name: 'DFD', type: 'dfd' },
        metadata: undefined,
        cells: undefined,
        description: 'A data flow diagram',
        includeInReport: undefined,
        image: 'data:image/png;base64,abc',
      });
      const deps = createMockDeps();

      await lastValueFrom(service.orchestrateImport({ diagrams: [{ id: 'd1' }] }, deps));

      expect(deps.updateDiagram).toHaveBeenCalledWith(
        'new-tm-1',
        'new-diagram-1',
        expect.objectContaining({
          cells: [],
          description: 'A data flow diagram',
          image: 'data:image/png;base64,abc',
        }),
      );
    });

    it('should include include_in_report in diagram update when present', async () => {
      mockFieldFilter.filterDiagram.mockReturnValue({
        filtered: { name: 'DFD', type: 'dfd' },
        metadata: undefined,
        cells: undefined,
        description: undefined,
        includeInReport: true,
        image: undefined,
      });
      const deps = createMockDeps();

      await lastValueFrom(service.orchestrateImport({ diagrams: [{ id: 'd1' }] }, deps));

      expect(deps.updateDiagram).toHaveBeenCalledWith(
        'new-tm-1',
        'new-diagram-1',
        expect.objectContaining({
          cells: [],
          include_in_report: true,
        }),
      );
    });

    it('should always include cells array in diagram PUT even when no cells present', async () => {
      mockFieldFilter.filterDiagram.mockReturnValue({
        filtered: { name: 'DFD', type: 'dfd' },
        metadata: undefined,
        cells: undefined,
        description: 'Description only',
        includeInReport: undefined,
        image: undefined,
      });
      const deps = createMockDeps();

      await lastValueFrom(service.orchestrateImport({ diagrams: [{ id: 'd1' }] }, deps));

      const updateCall = (deps.updateDiagram as ReturnType<typeof vi.fn>).mock.calls[0];
      const payload = updateCall[2] as Record<string, unknown>;
      expect(payload['cells']).toEqual([]);
    });


    it('should report success even when updateDiagram fails (silent data loss)', async () => {
      // This test documents a known issue: cells are silently lost when updateDiagram fails
      mockFieldFilter.filterDiagram.mockReturnValue({
        filtered: { name: 'DFD', type: 'dfd' },
        metadata: undefined,
        cells: [{ id: 'cell-1', shape: 'process' }],
        description: undefined,
        includeInReport: undefined,
        image: undefined,
      });
      const deps = createMockDeps({
        updateDiagram: vi.fn().mockReturnValue(throwError(() => new Error('update failed'))),
      });

      const result = await lastValueFrom(
        service.orchestrateImport({ diagrams: [{ id: 'd1' }] }, deps),
      );

      // BUG: diagram counts as success even though cells were lost
      expect(result.counts.diagrams.success).toBe(1);
      expect(result.counts.diagrams.failed).toBe(0);
      // The error is logged but not added to summary.errors
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should not call updateDiagram when no cells/description/includeInReport/image', async () => {
      mockFieldFilter.filterDiagram.mockReturnValue({
        filtered: { name: 'DFD', type: 'dfd' },
        metadata: undefined,
        cells: undefined,
        description: undefined,
        includeInReport: undefined,
        image: undefined,
      });
      const deps = createMockDeps();

      await lastValueFrom(service.orchestrateImport({ diagrams: [{ id: 'd1' }] }, deps));

      expect(deps.updateDiagram).not.toHaveBeenCalled();
    });
  });

  describe('orchestrateImport - threat import', () => {
    it('should import threats after assets and diagrams', async () => {
      const callOrder: string[] = [];
      const deps = createMockDeps({
        createAsset: vi.fn().mockImplementation(() => {
          callOrder.push('asset');
          return of({ id: 'new-asset-1' });
        }),
        createDiagram: vi.fn().mockImplementation(() => {
          callOrder.push('diagram');
          return of({ id: 'new-diagram-1', name: 'D', type: 'dfd' });
        }),
        createThreat: vi.fn().mockImplementation(() => {
          callOrder.push('threat');
          return of({ id: 'new-threat-1' });
        }),
      });

      await lastValueFrom(
        service.orchestrateImport(
          {
            assets: [{ id: 'a1' }],
            diagrams: [{ id: 'd1' }],
            threats: [{ id: 't1' }],
          },
          deps,
        ),
      );

      const assetIndex = callOrder.indexOf('asset');
      const diagramIndex = callOrder.indexOf('diagram');
      const threatIndex = callOrder.indexOf('threat');

      expect(assetIndex).toBeLessThan(threatIndex);
      expect(diagramIndex).toBeLessThan(threatIndex);
    });

    it('should rewrite threat references using translated IDs', async () => {
      const deps = createMockDeps();

      await lastValueFrom(
        service.orchestrateImport({ threats: [{ id: 't1', diagram_id: 'old-d1' }] }, deps),
      );

      expect(mockReferenceRewriter.rewriteThreatReferences).toHaveBeenCalled();
    });
  });

  describe('orchestrateImport - notes, documents, repositories', () => {
    it('should import notes and track ID translation', async () => {
      const deps = createMockDeps();

      const result = await lastValueFrom(
        service.orchestrateImport({ notes: [{ id: 'n1', title: 'Note' }] }, deps),
      );

      expect(deps.createNote).toHaveBeenCalled();
      expect(mockIdTranslation.setNoteId).toHaveBeenCalledWith('n1', 'new-note-1');
      expect(result.counts.notes.success).toBe(1);
    });

    it('should provide default content when note has no content field', async () => {
      mockFieldFilter.filterNote.mockReturnValue({
        filtered: { name: 'Note Without Content' },
        metadata: undefined,
      });
      mockReferenceRewriter.rewriteNoteReferences.mockImplementation((data: unknown) => data);
      const deps = createMockDeps();

      await lastValueFrom(
        service.orchestrateImport({ notes: [{ id: 'n1', name: 'Note Without Content' }] }, deps),
      );

      expect(deps.createNote).toHaveBeenCalledWith(
        'new-tm-1',
        expect.objectContaining({ content: '(imported note)' }),
      );
    });

    it('should import documents and track ID translation', async () => {
      const deps = createMockDeps();

      const result = await lastValueFrom(
        service.orchestrateImport({ documents: [{ id: 'doc1' }] }, deps),
      );

      expect(deps.createDocument).toHaveBeenCalled();
      expect(mockIdTranslation.setDocumentId).toHaveBeenCalledWith('doc1', 'new-doc-1');
      expect(result.counts.documents.success).toBe(1);
    });

    it('should import repositories and track ID translation', async () => {
      const deps = createMockDeps();

      const result = await lastValueFrom(
        service.orchestrateImport({ repositories: [{ id: 'repo1' }] }, deps),
      );

      expect(deps.createRepository).toHaveBeenCalled();
      expect(mockIdTranslation.setRepositoryId).toHaveBeenCalledWith('repo1', 'new-repo-1');
      expect(result.counts.repositories.success).toBe(1);
    });
  });

  describe('orchestrateImport - edge cases and type safety', () => {
    it('should handle empty import data', async () => {
      const deps = createMockDeps();
      const result = await lastValueFrom(service.orchestrateImport({}, deps));

      expect(result.success).toBe(true);
      expect(result.counts.assets).toEqual({ success: 0, failed: 0 });
      expect(result.counts.notes).toEqual({ success: 0, failed: 0 });
      expect(result.counts.diagrams).toEqual({ success: 0, failed: 0 });
      expect(result.counts.threats).toEqual({ success: 0, failed: 0 });
      expect(result.counts.documents).toEqual({ success: 0, failed: 0 });
      expect(result.counts.repositories).toEqual({ success: 0, failed: 0 });
    });

    it('should handle null nested arrays gracefully', async () => {
      const deps = createMockDeps();
      // null || [] evaluates to [], so this should work
      const result = await lastValueFrom(
        service.orchestrateImport(
          { assets: null, notes: null, diagrams: null, threats: null } as unknown as Record<
            string,
            unknown
          >,
          deps,
        ),
      );

      expect(result.success).toBe(true);
      expect(deps.createAsset).not.toHaveBeenCalled();
    });

    it('should handle complete import with all object types', async () => {
      const deps = createMockDeps();
      const importData = {
        id: 'old-tm-1',
        name: 'Full Import',
        assets: [{ id: 'a1' }],
        notes: [{ id: 'n1' }],
        diagrams: [{ id: 'd1' }],
        threats: [{ id: 't1' }],
        documents: [{ id: 'doc1' }],
        repositories: [{ id: 'repo1' }],
      };

      const result = await lastValueFrom(service.orchestrateImport(importData, deps));

      expect(result.success).toBe(true);
      expect(result.counts.assets.success).toBe(1);
      expect(result.counts.notes.success).toBe(1);
      expect(result.counts.diagrams.success).toBe(1);
      expect(result.counts.threats.success).toBe(1);
      expect(result.counts.documents.success).toBe(1);
      expect(result.counts.repositories.success).toBe(1);
    });

    it('should catch unexpected errors in orchestration', async () => {
      const deps = createMockDeps({
        createThreatModel: vi.fn().mockReturnValue(of({ id: 'tm-1', name: 'Test' })),
      });
      // Force an error in nested import by making filterAsset throw
      mockFieldFilter.filterAsset.mockImplementation(() => {
        throw new Error('Unexpected filter error');
      });

      const result = await lastValueFrom(
        service.orchestrateImport({ assets: [{ id: 'a1' }] }, deps),
      );

      // The outer catchError should catch the unexpected error
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
