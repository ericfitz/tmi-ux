 
// Import Angular compiler
import '@angular/compiler';

import { of, throwError } from 'rxjs';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DfdApplicationService,
  DiagramOperationResult,
  CreateDiagramOptions,
  DfdApplicationServiceExtended,
} from './dfd-application.service';
import { CommandBusService } from './command-bus.service';
import { IDiagramRepository } from '../handlers/diagram-command-handlers';
import { DiagramSnapshot } from '../../domain/aggregates/diagram-aggregate';
import { Point } from '../../domain/value-objects/point';
import { NodeData } from '../../domain/value-objects/node-data';
import { EdgeData } from '../../domain/value-objects/edge-data';
import { BaseDomainEvent } from '../../domain/events/domain-event';

// Import testing utilities
import { waitForAsync } from '../../../../../testing/async-utils';

describe('DfdApplicationService', () => {
  let service: DfdApplicationService;
  let mockCommandBus: {
    execute: ReturnType<typeof vi.fn>;
    registerHandler: ReturnType<typeof vi.fn>;
    registerMiddleware: ReturnType<typeof vi.fn>;
  };
  let mockRepository: {
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  // Test data
  const testDiagramId = 'test-diagram-id';
  const testUserId = 'test-user-id';
  const testNodeId = 'test-node-id';
  const testEdgeId = 'test-edge-id';
  const testPosition = new Point(100, 200);
  const testNodeData = new NodeData(testNodeId, 'actor', 'Test Actor', testPosition, 120, 80, {});
  const testEdgeData = new EdgeData(
    testEdgeId,
    'source-id',
    'target-id',
    undefined,
    undefined,
    'Test Edge',
    [],
    {},
  );

  const mockDiagramSnapshot: DiagramSnapshot = {
    id: testDiagramId,
    name: 'Test Diagram',
    description: 'Test Description',
    createdBy: testUserId,
    nodes: [],
    edges: [],
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDomainEvent: BaseDomainEvent = new (class extends BaseDomainEvent {
    constructor() {
      super('DiagramCreated', testDiagramId, 1, {});
    }
  })();

  const mockOperationResult: DiagramOperationResult = {
    success: true,
    events: [mockDomainEvent],
    diagramSnapshot: mockDiagramSnapshot,
  };

  beforeEach(() => {
    // Create mocks
    mockCommandBus = {
      execute: vi.fn(),
      registerHandler: vi.fn(),
      registerMiddleware: vi.fn(),
    };

    mockRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    // Create the service directly without TestBed
    service = new DfdApplicationService(
      mockCommandBus as unknown as CommandBusService,
      mockRepository as unknown as IDiagramRepository,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    service.destroy();
  });

  describe('Observable Properties', () => {
    it('should expose diagramEvents$ observable', waitForAsync(() => {
      return new Promise<void>(resolve => {
        service.diagramEvents$.subscribe(event => {
          expect(event).toBeDefined();
          resolve();
        });

        // Trigger an event by creating a diagram
        mockCommandBus.execute.mockReturnValue(of(mockOperationResult));
        service.createDiagram('Test', 'Description', testUserId).subscribe();
      });
    }));

    it('should expose currentDiagram$ observable', waitForAsync(() => {
      return new Promise<void>(resolve => {
        service.currentDiagram$.subscribe(diagram => {
          if (diagram) {
            expect(diagram.id).toBe(testDiagramId);
            resolve();
          }
        });

        // Trigger diagram update
        mockCommandBus.execute.mockReturnValue(of(mockOperationResult));
        service.createDiagram('Test', 'Description', testUserId).subscribe();
      });
    }));

    it('should expose isLoading$ observable', waitForAsync(() => {
      return new Promise<void>(resolve => {
        const loadingStates: boolean[] = [];

        service.isLoading$.subscribe(isLoading => {
          loadingStates.push(isLoading);
          if (loadingStates.length === 3) {
            // initial false, true during operation, false after
            expect(loadingStates).toEqual([false, true, false]);
            resolve();
          }
        });

        mockCommandBus.execute.mockReturnValue(of(mockOperationResult));
        service.createDiagram('Test', 'Description', testUserId).subscribe();
      });
    }));

    it('should expose errors$ observable', waitForAsync(() => {
      return new Promise<void>(resolve => {
        const testError = new Error('Test error');

        service.errors$.subscribe(error => {
          expect(error).toBe(testError);
          resolve();
        });

        mockCommandBus.execute.mockReturnValue(throwError(() => testError));
        service.createDiagram('Test', 'Description', testUserId).subscribe({
          error: () => {}, // Ignore error for this test
        });
      });
    }));
  });

  describe('createDiagram', () => {
    it('should create a diagram successfully', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        mockCommandBus.execute.mockReturnValue(of(mockOperationResult));

        service.createDiagram('Test Diagram', 'Test Description', testUserId).subscribe({
          next: diagramId => {
            expect(diagramId).toBe(testDiagramId);
            expect(mockCommandBus.execute).toHaveBeenCalledWith(
              expect.objectContaining({
                type: 'CREATE_DIAGRAM',
                userId: testUserId,
              }),
            );
            resolve();
          },
          error: reject,
        });
      });
    }));

    it('should handle creation errors', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const testError = new Error('Creation failed');
        mockCommandBus.execute.mockReturnValue(throwError(() => testError));

        service.createDiagram('Test', 'Description', testUserId).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: error => {
            expect(error).toBe(testError);
            resolve();
          },
        });
      });
    }));

    it('should generate unique diagram IDs', () => {
      const spy = vi.spyOn(service as any, 'generateDiagramId');
      mockCommandBus.execute.mockReturnValue(of(mockOperationResult));

      service.createDiagram('Test', 'Description', testUserId).subscribe();

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('loadDiagram', () => {
    const mockDiagramAggregate = {
      toSnapshot: () => mockDiagramSnapshot,
    };

    it('should load an existing diagram', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        mockRepository.findById.mockReturnValue(of(mockDiagramAggregate));

        service.loadDiagram(testDiagramId).subscribe({
          next: snapshot => {
            expect(snapshot).toBe(mockDiagramSnapshot);
            expect(mockRepository.findById).toHaveBeenCalledWith(testDiagramId);
            resolve();
          },
          error: reject,
        });
      });
    }));

    it('should handle diagram not found', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        mockRepository.findById.mockReturnValue(of(null));

        service.loadDiagram(testDiagramId).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: error => {
            expect(error.message).toContain('not found');
            resolve();
          },
        });
      });
    }));

    it('should handle repository errors', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const testError = new Error('Repository error');
        mockRepository.findById.mockReturnValue(throwError(() => testError));

        service.loadDiagram(testDiagramId).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: error => {
            expect(error).toBe(testError);
            resolve();
          },
        });
      });
    }));
  });

  describe('Node Operations', () => {
    beforeEach(() => {
      mockCommandBus.execute.mockReturnValue(of(mockOperationResult));
    });

    it('should add a node', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        service
          .addNode(testDiagramId, testNodeId, testPosition, 'actor', 'Test Actor', testUserId)
          .subscribe({
            next: () => {
              expect(mockCommandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                  type: 'ADD_NODE',
                  diagramId: testDiagramId,
                  userId: testUserId,
                  nodeId: testNodeId,
                }),
              );
              resolve();
            },
            error: reject,
          });
      });
    }));

    it('should update node position', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const newPosition = new Point(150, 250);

        service
          .updateNodePosition(testDiagramId, testNodeId, newPosition, testPosition, testUserId)
          .subscribe({
            next: () => {
              expect(mockCommandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                  type: 'UPDATE_NODE_POSITION',
                  diagramId: testDiagramId,
                  userId: testUserId,
                  nodeId: testNodeId,
                }),
              );
              resolve();
            },
            error: reject,
          });
      });
    }));

    it('should update node data', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const newData = new NodeData(
          testNodeId,
          'store',
          'Updated Label',
          testPosition,
          140,
          90,
          {},
        );

        service
          .updateNodeData(testDiagramId, testNodeId, newData, testNodeData, testUserId)
          .subscribe({
            next: () => {
              expect(mockCommandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                  type: 'UPDATE_NODE_DATA',
                  diagramId: testDiagramId,
                  userId: testUserId,
                  nodeId: testNodeId,
                }),
              );
              resolve();
            },
            error: reject,
          });
      });
    }));

    it('should remove a node', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        service.removeNode(testDiagramId, testNodeId, testUserId).subscribe({
          next: () => {
            expect(mockCommandBus.execute).toHaveBeenCalledWith(
              expect.objectContaining({
                type: 'REMOVE_NODE',
                diagramId: testDiagramId,
                userId: testUserId,
                nodeId: testNodeId,
              }),
            );
            resolve();
          },
          error: reject,
        });
      });
    }));
  });

  describe('Edge Operations', () => {
    beforeEach(() => {
      mockCommandBus.execute.mockReturnValue(of(mockOperationResult));
    });

    it('should add an edge', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        service
          .addEdge(testDiagramId, testEdgeId, 'source-id', 'target-id', testUserId, 'Test Edge')
          .subscribe({
            next: () => {
              expect(mockCommandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                  type: 'ADD_EDGE',
                  diagramId: testDiagramId,
                  userId: testUserId,
                  edgeId: testEdgeId,
                }),
              );
              resolve();
            },
            error: reject,
          });
      });
    }));

    it('should update edge data', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const newData = new EdgeData(
          testEdgeId,
          'source-id',
          'target-id',
          undefined,
          undefined,
          'Updated Edge',
          [],
          {},
        );

        service
          .updateEdgeData(testDiagramId, testEdgeId, newData, testEdgeData, testUserId)
          .subscribe({
            next: () => {
              expect(mockCommandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                  type: 'UPDATE_EDGE_DATA',
                  diagramId: testDiagramId,
                  userId: testUserId,
                  edgeId: testEdgeId,
                }),
              );
              resolve();
            },
            error: reject,
          });
      });
    }));

    it('should remove an edge', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        service.removeEdge(testDiagramId, testEdgeId, testUserId).subscribe({
          next: () => {
            expect(mockCommandBus.execute).toHaveBeenCalledWith(
              expect.objectContaining({
                type: 'REMOVE_EDGE',
                diagramId: testDiagramId,
                userId: testUserId,
                edgeId: testEdgeId,
              }),
            );
            resolve();
          },
          error: reject,
        });
      });
    }));
  });

  describe('updateDiagramMetadata', () => {
    it('should update diagram metadata', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        mockCommandBus.execute.mockReturnValue(of(mockOperationResult));

        service
          .updateDiagramMetadata(testDiagramId, testUserId, 'New Name', 'New Description')
          .subscribe({
            next: () => {
              expect(mockCommandBus.execute).toHaveBeenCalledWith(
                expect.objectContaining({
                  type: 'UPDATE_DIAGRAM_METADATA',
                  diagramId: testDiagramId,
                  userId: testUserId,
                }),
              );
              resolve();
            },
            error: reject,
          });
      });
    }));
  });

  describe('State Management', () => {
    it('should get current diagram', () => {
      // Initially null
      expect(service.getCurrentDiagram()).toBeNull();

      // After loading a diagram
      mockCommandBus.execute.mockReturnValue(of(mockOperationResult));
      service.createDiagram('Test', 'Description', testUserId).subscribe();

      expect(service.getCurrentDiagram()).toBe(mockDiagramSnapshot);
    });

    it('should clear current diagram', () => {
      // Set a diagram first
      mockCommandBus.execute.mockReturnValue(of(mockOperationResult));
      service.createDiagram('Test', 'Description', testUserId).subscribe();

      expect(service.getCurrentDiagram()).toBe(mockDiagramSnapshot);

      // Clear it
      service.clearCurrentDiagram();
      expect(service.getCurrentDiagram()).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle command execution errors', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const testError = new Error('Command failed');
        mockCommandBus.execute.mockReturnValue(throwError(() => testError));

        service
          .addNode(testDiagramId, testNodeId, testPosition, 'actor', 'Test', testUserId)
          .subscribe({
            next: () => reject(new Error('Should have failed')),
            error: error => {
              expect(error).toBe(testError);
              resolve();
            },
          });
      });
    }));

    it('should emit errors through errors$ observable', waitForAsync(() => {
      return new Promise<void>(resolve => {
        const testError = new Error('Test error');

        service.errors$.subscribe(error => {
          expect(error).toBe(testError);
          resolve();
        });

        mockCommandBus.execute.mockReturnValue(throwError(() => testError));
        service
          .addNode(testDiagramId, testNodeId, testPosition, 'actor', 'Test', testUserId)
          .subscribe({
            error: () => {}, // Ignore error for this test
          });
      });
    }));
  });

  describe('Cleanup', () => {
    it('should complete all subjects on destroy', () => {
      const diagramEventsSpy = vi.spyOn(service['_diagramEvents$'], 'complete');
      const currentDiagramSpy = vi.spyOn(service['_currentDiagram$'], 'complete');
      const isLoadingSpy = vi.spyOn(service['_isLoading$'], 'complete');
      const errorsSpy = vi.spyOn(service['_errors$'], 'complete');

      service.destroy();

      expect(diagramEventsSpy).toHaveBeenCalled();
      expect(currentDiagramSpy).toHaveBeenCalled();
      expect(isLoadingSpy).toHaveBeenCalled();
      expect(errorsSpy).toHaveBeenCalled();
    });
  });
});

describe('DfdApplicationServiceExtended', () => {
  let service: DfdApplicationServiceExtended;
  let mockCommandBus: {
    execute: ReturnType<typeof vi.fn>;
    registerHandler: ReturnType<typeof vi.fn>;
    registerMiddleware: ReturnType<typeof vi.fn>;
  };
  let mockRepository: {
    findById: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  const mockOperationResult: DiagramOperationResult = {
    success: true,
    events: [],
    diagramSnapshot: {
      id: 'test-diagram-id',
      name: 'Test Diagram',
      description: 'Test Description',
      createdBy: 'test-user-id',
      nodes: [],
      edges: [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    mockCommandBus = {
      execute: vi.fn(),
      registerHandler: vi.fn(),
      registerMiddleware: vi.fn(),
    };

    mockRepository = {
      findById: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };

    // Create the service directly without TestBed
    service = new DfdApplicationServiceExtended(
      mockCommandBus as unknown as CommandBusService,
      mockRepository as unknown as IDiagramRepository,
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    service.destroy();
  });

  describe('createDiagramWithContent', () => {
    it('should create diagram with initial nodes and edges', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const options: CreateDiagramOptions = {
          name: 'Test Diagram',
          description: 'Test Description',
          userId: 'test-user-id',
          initialNodes: [
            {
              id: 'node1',
              type: 'actor',
              label: 'Actor 1',
              position: new Point(100, 100),
              width: 120,
              height: 80,
            },
          ],
          initialEdges: [
            {
              id: 'edge1',
              sourceNodeId: 'node1',
              targetNodeId: 'node2',
              label: 'Edge 1',
            },
          ],
        };

        mockCommandBus.execute.mockReturnValue(of(mockOperationResult));

        service.createDiagramWithContent(options).subscribe({
          next: diagramId => {
            expect(diagramId).toBe('test-diagram-id');
            // Should be called for create + node + edge = 3 times
            expect(mockCommandBus.execute).toHaveBeenCalledTimes(3);
            resolve();
          },
          error: reject,
        });
      });
    }));

    it('should create diagram without initial content', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const options: CreateDiagramOptions = {
          name: 'Test Diagram',
          userId: 'test-user-id',
        };

        mockCommandBus.execute.mockReturnValue(of(mockOperationResult));

        service.createDiagramWithContent(options).subscribe({
          next: diagramId => {
            expect(diagramId).toBe('test-diagram-id');
            // Should only be called for create diagram
            expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
            resolve();
          },
          error: reject,
        });
      });
    }));
  });

  describe('batchUpdateNodes', () => {
    it('should update multiple nodes in sequence', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        const updates = [
          {
            nodeId: 'node1',
            newData: new NodeData('node1', 'actor', 'Updated 1', new Point(100, 100), 120, 80, {}),
            oldData: new NodeData('node1', 'actor', 'Original 1', new Point(50, 50), 120, 80, {}),
          },
          {
            nodeId: 'node2',
            newData: new NodeData('node2', 'store', 'Updated 2', new Point(200, 200), 120, 80, {}),
            oldData: new NodeData('node2', 'store', 'Original 2', new Point(150, 150), 120, 80, {}),
          },
        ];

        mockCommandBus.execute.mockReturnValue(of(mockOperationResult));

        service.batchUpdateNodes('test-diagram-id', 'test-user-id', updates).subscribe({
          next: () => {
            expect(mockCommandBus.execute).toHaveBeenCalledTimes(2);
            resolve();
          },
          error: reject,
        });
      });
    }));
  });
});
