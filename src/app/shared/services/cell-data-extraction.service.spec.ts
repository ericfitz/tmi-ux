/**
 * Unit tests for CellDataExtractionService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/shared/services/cell-data-extraction.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { CellDataExtractionService } from './cell-data-extraction.service';
import { ThreatModel } from '../../pages/tm/models/threat-model.model';

describe('CellDataExtractionService', () => {
  let service: CellDataExtractionService;
  let mockLogger: {
    debugComponent: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      debugComponent: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new CellDataExtractionService(mockLogger as any);
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });
  });

  describe('extractFromThreatModel()', () => {
    it('should extract diagrams and cells from threat model', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test Threat Model',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [
              { id: 'cell1', shape: 'process', attrs: { text: { text: 'Cell 1' } } },
              { id: 'cell2', shape: 'process', attrs: { text: { text: 'Cell 2' } } },
            ],
          },
          {
            id: 'diag2',
            name: 'Diagram 2',
            cells: [{ id: 'cell3', shape: 'process', attrs: { text: { text: 'Cell 3' } } }],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.diagrams).toHaveLength(2);
      expect(result.diagrams[0]).toEqual({ id: 'diag1', name: 'Diagram 1' });
      expect(result.diagrams[1]).toEqual({ id: 'diag2', name: 'Diagram 2' });
      expect(result.cells).toHaveLength(3);
      expect(result.cells[0].diagramId).toBe('diag1');
      expect(result.cells[2].diagramId).toBe('diag2');
    });

    it('should filter cells by diagram ID', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [
              { id: 'cell1', shape: 'process', attrs: { text: { text: 'Cell 1' } } },
              { id: 'cell2', shape: 'process', attrs: { text: { text: 'Cell 2' } } },
            ],
          },
          {
            id: 'diag2',
            name: 'Diagram 2',
            cells: [{ id: 'cell3', shape: 'process', attrs: { text: { text: 'Cell 3' } } }],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel, 'diag1');

      expect(result.diagrams).toHaveLength(2); // All diagrams still returned
      expect(result.cells).toHaveLength(2); // Only cells from diag1
      expect(result.cells.every(c => c.diagramId === 'diag1')).toBe(true);
    });

    it('should handle threat model with no diagrams', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.diagrams).toEqual([]);
      expect(result.cells).toEqual([]);
    });

    it('should handle diagram with no cells', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.diagrams).toHaveLength(1);
      expect(result.cells).toEqual([]);
    });

    it('should extract cell labels from attrs.text.text (X6 format)', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [
              {
                id: 'cell1',
                shape: 'process',
                attrs: { text: { text: 'My Process Label' } },
              },
            ],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.cells[0].label).toBe('My Process Label');
    });

    it('should extract label from attrs.text.text', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [
              {
                id: 'cell1',
                shape: 'process',
                attrs: { text: { text: 'Correct Label' } },
              },
            ],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.cells[0].label).toBe('Correct Label');
    });

    it('should extract edge labels from labels[].attrs.text.text (X6 native edge format)', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [
              {
                id: 'edge1',
                shape: 'edge',
                source: { cell: 'node1', port: 'out' },
                target: { cell: 'node2', port: 'in' },
                labels: [{ attrs: { text: { text: 'Data Flow' } }, position: 0.5 }],
              },
            ],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.cells[0].label).toBe('Data Flow');
    });

    it('should handle edges with multiple labels (use first)', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [
              {
                id: 'edge1',
                shape: 'edge',
                labels: [
                  { attrs: { text: { text: 'First Label' } } },
                  { attrs: { text: { text: 'Second Label' } } },
                ],
              },
            ],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.cells[0].label).toBe('First Label');
    });

    it('should handle edges with empty labels array', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [
              {
                id: 'edge1',
                shape: 'edge',
                labels: [],
              },
            ],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      // Should fallback to truncated ID
      expect(result.cells[0].label).toBe('edge1');
    });

    it('should prefer labels array over attrs.text.text for edges', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [
              {
                id: 'edge1',
                shape: 'edge',
                labels: [{ attrs: { text: { text: 'Correct Edge Label' } } }],
                attrs: { text: { text: 'Wrong Label' } },
              },
            ],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.cells[0].label).toBe('Correct Edge Label');
    });

    it('should fallback to cell ID when no label found', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [{ id: 'cell1', shape: 'process' }],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.cells[0].label).toBe('cell1');
    });

    it('should log extraction details', () => {
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [{ id: 'cell1', shape: 'process', attrs: { text: { text: 'Test' } } }],
          },
        ],
      } as any;

      service.extractFromThreatModel(threatModel);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'CellDataExtractionService',
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe('extractFromX6Graph()', () => {
    it('should extract diagram and cells from X6 graph', () => {
      const mockGraph = {
        getCells: vi.fn(() => [
          {
            id: 'cell1',
            isNode: () => true,
            isEdge: () => false,
            getLabel: () => ({ attrs: { text: { value: 'Node A' } } }),
          },
          {
            id: 'cell2',
            isNode: () => false,
            isEdge: () => true,
            getLabel: () => ({ attrs: { text: { value: 'Edge B' } } }),
          },
        ]),
      };

      const result = service.extractFromX6Graph(mockGraph as any, 'diag1', 'Diagram 1');

      expect(result.diagrams).toHaveLength(1);
      expect(result.diagrams[0]).toEqual({ id: 'diag1', name: 'Diagram 1' });
      expect(result.cells).toHaveLength(2);
      expect(result.cells[0].id).toBe('cell1');
      expect(result.cells[0].label).toBe('Node A');
      expect(result.cells[0].diagramId).toBe('diag1');
    });

    it('should handle graph with no cells', () => {
      const mockGraph = {
        getCells: vi.fn(() => []),
      };

      const result = service.extractFromX6Graph(mockGraph as any, 'diag1', 'Diagram 1');

      expect(result.diagrams).toHaveLength(1);
      expect(result.cells).toEqual([]);
    });

    it('should handle cells without getLabel method', () => {
      const mockGraph = {
        getCells: vi.fn(() => [
          {
            id: 'cell1',
            isNode: () => true,
            isEdge: () => false,
            getAttrByPath: (path: string) => (path === 'text/text' ? 'Node A' : null),
          },
        ]),
      };

      const result = service.extractFromX6Graph(mockGraph as any, 'diag1', 'Diagram 1');

      expect(result.cells[0].label).toBe('Node A');
    });

    it('should extract edge labels from labels array', () => {
      const mockGraph = {
        getCells: vi.fn(() => [
          {
            id: 'edge1',
            isNode: () => false,
            isEdge: () => true,
            getLabels: () => [{ attrs: { text: { value: 'Edge Label' } } }],
          },
        ]),
      };

      const result = service.extractFromX6Graph(mockGraph as any, 'diag1', 'Diagram 1');

      expect(result.cells[0].label).toBe('Edge Label');
    });

    it('should fallback to cell ID when no label found', () => {
      const mockGraph = {
        getCells: vi.fn(() => [
          {
            id: 'cell1',
            isNode: () => true,
            isEdge: () => false,
          },
        ]),
      };

      const result = service.extractFromX6Graph(mockGraph as any, 'diag1', 'Diagram 1');

      expect(result.cells[0].label).toBe('cell1');
    });

    it('should handle null graph gracefully', () => {
      const result = service.extractFromX6Graph(null as any, 'diag1', 'Diagram 1');

      expect(result.diagrams).toHaveLength(1);
      expect(result.cells).toEqual([]);
    });

    it('should handle graph without getCells method', () => {
      const mockGraph = {};

      const result = service.extractFromX6Graph(mockGraph as any, 'diag1', 'Diagram 1');

      expect(result.diagrams).toHaveLength(1);
      expect(result.cells).toEqual([]);
    });

    it('should log error when extraction fails', () => {
      const mockGraph = {
        getCells: vi.fn(() => {
          throw new Error('Test error');
        }),
      };

      service.extractFromX6Graph(mockGraph as any, 'diag1', 'Diagram 1');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error extracting cells from X6 graph',
        expect.any(Error),
      );
    });

    it('should clean up labels by removing newlines', () => {
      const mockGraph = {
        getCells: vi.fn(() => [
          {
            id: 'cell1',
            isNode: () => true,
            isEdge: () => false,
            getLabel: () => ({ attrs: { text: { value: 'Multi\nLine\nLabel' } } }),
          },
        ]),
      };

      const result = service.extractFromX6Graph(mockGraph as any, 'diag1', 'Diagram 1');

      expect(result.cells[0].label).toBe('Multi Line Label');
    });
  });

  describe('Label Extraction Edge Cases', () => {
    it('should handle cells with very long IDs', () => {
      const longId = 'a'.repeat(100);
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [{ id: longId, shape: 'process' }],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.cells[0].label).toContain('...');
      expect(result.cells[0].label.length).toBeLessThan(longId.length);
    });

    it('should handle UUID-style IDs', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      const threatModel: ThreatModel = {
        id: 'tm1',
        name: 'Test',
        diagrams: [
          {
            id: 'diag1',
            name: 'Diagram 1',
            cells: [{ id: uuid, shape: 'process' }],
          },
        ],
      } as any;

      const result = service.extractFromThreatModel(threatModel);

      expect(result.cells[0].label).toBe('123e4567...');
    });
  });
});
