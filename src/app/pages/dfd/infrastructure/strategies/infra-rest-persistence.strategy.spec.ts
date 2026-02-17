/**
 * Tests for InfraRestPersistenceStrategy
 *
 * Covers: save/load operations via REST API, error handling,
 * data transformation, and missing field validation.
 */

import '@angular/compiler';

import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { HttpClient } from '@angular/common/http';
import { LoggerService } from '../../../../core/services/logger.service';
import { AppDiagramService } from '../../application/services/app-diagram.service';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import {
  SaveOperation,
  LoadOperation,
} from '../../application/services/app-persistence-coordinator.service';
import { InfraRestPersistenceStrategy } from './infra-rest-persistence.strategy';
import { createTypedMockLoggerService, type MockLoggerService } from '@testing/mocks';

describe('InfraRestPersistenceStrategy', () => {
  let strategy: InfraRestPersistenceStrategy;
  let loggerService: MockLoggerService;
  let mockHttpClient: { get: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };
  let mockDiagramService: { loadDiagram: ReturnType<typeof vi.fn> };
  let mockThreatModelService: { patchDiagramCells: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    loggerService = createTypedMockLoggerService();

    mockHttpClient = {
      get: vi.fn(),
      patch: vi.fn(),
    };

    mockDiagramService = {
      loadDiagram: vi.fn(),
    };

    mockThreatModelService = {
      patchDiagramCells: vi.fn(),
    };

    strategy = new InfraRestPersistenceStrategy(
      mockHttpClient as unknown as HttpClient,
      loggerService as unknown as LoggerService,
      mockDiagramService as unknown as AppDiagramService,
      mockThreatModelService as unknown as ThreatModelService,
    );
  });

  describe('save()', () => {
    it('should save successfully with valid threatModelId and data', () => {
      const mockResponse = { update_vector: 5, cells: [] };
      mockThreatModelService.patchDiagramCells.mockReturnValue(of(mockResponse));

      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
        data: {
          nodes: [{ id: 'n1', shape: 'rect' }],
          edges: [{ id: 'e1', shape: 'edge' }],
        },
      };

      let result: any;
      strategy.save(operation).subscribe(r => (result = r));

      expect(result.success).toBe(true);
      expect(result.diagramId).toBe('diagram-1');
      expect(result.metadata?.update_vector).toBe(5);
      expect(result.metadata?.cellsSaved).toBe(2);

      // Verify cells were combined from nodes + edges
      expect(mockThreatModelService.patchDiagramCells).toHaveBeenCalledWith('tm-1', 'diagram-1', [
        { id: 'n1', shape: 'rect' },
        { id: 'e1', shape: 'edge' },
      ]);
    });

    it('should return failure when threatModelId is missing', () => {
      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: '',
        data: { nodes: [], edges: [] },
      };

      let result: any;
      strategy.save(operation).subscribe(r => (result = r));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Threat model ID is required');
      expect(mockThreatModelService.patchDiagramCells).not.toHaveBeenCalled();
    });

    it('should handle API error gracefully and return failure result', () => {
      mockThreatModelService.patchDiagramCells.mockReturnValue(
        throwError(() => new Error('Network timeout')),
      );

      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
        data: { nodes: [{ id: 'n1' }], edges: [] },
      };

      let result: any;
      strategy.save(operation).subscribe(r => (result = r));

      expect(result.success).toBe(false);
      expect(result.error).toContain('REST save failed');
      expect(result.error).toContain('Network timeout');
    });

    it('should handle data with empty nodes and edges arrays', () => {
      const mockResponse = { update_vector: 1, cells: [] };
      mockThreatModelService.patchDiagramCells.mockReturnValue(of(mockResponse));

      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
        data: { nodes: [], edges: [] },
      };

      let result: any;
      strategy.save(operation).subscribe(r => (result = r));

      expect(result.success).toBe(true);
      expect(result.metadata?.cellsSaved).toBe(0);
      expect(mockThreatModelService.patchDiagramCells).toHaveBeenCalledWith(
        'tm-1',
        'diagram-1',
        [],
      );
    });

    it('should handle data with missing nodes or edges gracefully', () => {
      const mockResponse = { update_vector: 1, cells: [] };
      mockThreatModelService.patchDiagramCells.mockReturnValue(of(mockResponse));

      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
        data: {}, // No nodes or edges properties
      };

      let result: any;
      strategy.save(operation).subscribe(r => (result = r));

      expect(result.success).toBe(true);
      expect(mockThreatModelService.patchDiagramCells).toHaveBeenCalledWith(
        'tm-1',
        'diagram-1',
        [],
      );
    });

    it('should handle API error without message property', () => {
      mockThreatModelService.patchDiagramCells.mockReturnValue(throwError(() => ({ status: 500 })));

      const operation: SaveOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
        data: { nodes: [], edges: [] },
      };

      let result: any;
      strategy.save(operation).subscribe(r => (result = r));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error');
    });
  });

  describe('load()', () => {
    it('should load diagram successfully', () => {
      const mockDiagram = {
        success: true,
        diagram: {
          cells: [{ id: 'n1', shape: 'rect' }],
          name: 'Test Diagram',
          description: 'A test',
          threatModelId: 'tm-1',
          threatModelName: 'Test TM',
          update_vector: 3,
        },
      };
      mockDiagramService.loadDiagram.mockReturnValue(of(mockDiagram));

      const operation: LoadOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
      };

      let result: any;
      strategy.load(operation).subscribe(r => (result = r));

      expect(result.success).toBe(true);
      expect(result.diagramId).toBe('diagram-1');
      expect(result.source).toBe('api');
      expect(result.data.cells).toHaveLength(1);
      expect(result.data.update_vector).toBe(3);
    });

    it('should return failure when threatModelId is missing', () => {
      const operation: LoadOperation = {
        diagramId: 'diagram-1',
        threatModelId: '',
      };

      let result: any;
      strategy.load(operation).subscribe(r => (result = r));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Threat model ID is required');
      expect(mockDiagramService.loadDiagram).not.toHaveBeenCalled();
    });

    it('should handle load failure from diagram service', () => {
      mockDiagramService.loadDiagram.mockReturnValue(
        of({
          success: false,
          error: 'Diagram not found',
        }),
      );

      const operation: LoadOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
      };

      let result: any;
      strategy.load(operation).subscribe(r => (result = r));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Diagram not found');
    });

    it('should handle API network error gracefully', () => {
      mockDiagramService.loadDiagram.mockReturnValue(
        throwError(() => new Error('Connection refused')),
      );

      const operation: LoadOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
      };

      let result: any;
      strategy.load(operation).subscribe(r => (result = r));

      expect(result.success).toBe(false);
      expect(result.error).toContain('REST load failed');
      expect(result.error).toContain('Connection refused');
    });

    it('should handle load result with no diagram data', () => {
      mockDiagramService.loadDiagram.mockReturnValue(
        of({
          success: true,
          diagram: {
            cells: null,
            name: 'Empty Diagram',
            update_vector: 0,
          },
        }),
      );

      const operation: LoadOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
      };

      let result: any;
      strategy.load(operation).subscribe(r => (result = r));

      expect(result.success).toBe(true);
      expect(result.data.cells).toEqual([]);
    });

    it('should handle load failure with no error message', () => {
      mockDiagramService.loadDiagram.mockReturnValue(
        of({
          success: false,
        }),
      );

      const operation: LoadOperation = {
        diagramId: 'diagram-1',
        threatModelId: 'tm-1',
      };

      let result: any;
      strategy.load(operation).subscribe(r => (result = r));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to load diagram');
    });
  });
});
