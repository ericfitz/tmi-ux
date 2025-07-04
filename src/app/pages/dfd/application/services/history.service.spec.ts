import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LoggerService } from '../../../../core/services/logger.service';
import { HistoryService } from './history.service';
import { DiagramCommandFactory } from '../../domain/commands/diagram-commands';
import { Point } from '../../domain/value-objects/point';
import { X6NodeSnapshot } from '../../types/x6-cell.types';

describe('HistoryService', () => {
  let service: HistoryService;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  // Helper function to create X6NodeSnapshot
  const createNodeSnapshot = (
    id: string,
    shape: string,
    label: string,
    position: Point,
    width: number = 140,
    height: number = 80,
  ): X6NodeSnapshot => ({
    id,
    shape,
    position: { x: position.x, y: position.y },
    size: { width, height },
    attrs: {
      text: {
        text: label,
      },
    },
    ports: {},
    zIndex: 1,
    visible: true,
    type: shape,
    metadata: [],
  });

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create the service directly without TestBed
    service = new HistoryService(
      mockLogger as unknown as LoggerService,
      undefined, // No command bus for basic tests
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty history', () => {
    expect(service.getHistory()).toEqual([]);
  });

  it('should have canUndo$ observable that starts with false', () => {
    return new Promise<void>(resolve => {
      service.canUndo$.subscribe(canUndo => {
        expect(canUndo).toBe(false);
        resolve();
      });
    });
  });

  it('should have canRedo$ observable that starts with false', () => {
    return new Promise<void>(resolve => {
      service.canRedo$.subscribe(canRedo => {
        expect(canRedo).toBe(false);
        resolve();
      });
    });
  });

  it('should record commands in history', () => {
    const nodeSnapshot = createNodeSnapshot(
      'test-node',
      'actor',
      'Test Actor',
      new Point(100, 100),
      120,
      80,
    );

    const command = DiagramCommandFactory.addNode(
      'test-diagram',
      'test-user',
      'test-node',
      new Point(100, 100),
      nodeSnapshot,
    );

    const inverseCommand = DiagramCommandFactory.removeNode(
      'test-diagram',
      'test-user',
      'test-node',
    );

    service.recordCommand(command, inverseCommand, 'test-operation');

    const history = service.getHistory();
    expect(history.length).toBe(1);
    expect(history[0].command).toBe(command);
    expect(history[0].inverse).toBe(inverseCommand);
    expect(history[0].operationId).toBe('test-operation');
  });

  it('should update canUndo$ when commands are recorded', () => {
    return new Promise<void>(resolve => {
      const nodeSnapshot = createNodeSnapshot(
        'test-node',
        'actor',
        'Test Actor',
        new Point(100, 100),
        120,
        80,
      );

      const command = DiagramCommandFactory.addNode(
        'test-diagram',
        'test-user',
        'test-node',
        new Point(100, 100),
        nodeSnapshot,
      );

      const inverseCommand = DiagramCommandFactory.removeNode(
        'test-diagram',
        'test-user',
        'test-node',
      );

      // Skip the initial false value and check the updated value
      let skipFirst = true;
      service.canUndo$.subscribe(canUndo => {
        if (skipFirst) {
          skipFirst = false;
          return;
        }
        expect(canUndo).toBe(true);
        resolve();
      });

      service.recordCommand(command, inverseCommand, 'test-operation');
    });
  });

  it('should clear history', () => {
    const nodeSnapshot = createNodeSnapshot(
      'test-node',
      'actor',
      'Test Actor',
      new Point(100, 100),
      120,
      80,
    );

    const command = DiagramCommandFactory.addNode(
      'test-diagram',
      'test-user',
      'test-node',
      new Point(100, 100),
      nodeSnapshot,
    );

    const inverseCommand = DiagramCommandFactory.removeNode(
      'test-diagram',
      'test-user',
      'test-node',
    );

    service.recordCommand(command, inverseCommand, 'test-operation');
    expect(service.getHistory().length).toBe(1);

    service.clear();
    expect(service.getHistory().length).toBe(0);
  });

  it('should clear redo stack when new command is recorded', () => {
    const nodeSnapshot = createNodeSnapshot(
      'test-node',
      'actor',
      'Test Actor',
      new Point(100, 100),
      120,
      80,
    );

    const command = DiagramCommandFactory.addNode(
      'test-diagram',
      'test-user',
      'test-node',
      new Point(100, 100),
      nodeSnapshot,
    );

    const inverseCommand = DiagramCommandFactory.removeNode(
      'test-diagram',
      'test-user',
      'test-node',
    );

    service.recordCommand(command, inverseCommand, 'test-operation');

    // Simulate having something in redo stack by calling clearRedoStack
    service.clearRedoStack();

    // Record another command
    service.recordCommand(command, inverseCommand, 'test-operation-2');

    // Verify clearRedoStack was called (indirectly through the logger)
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('should enable collaborative mode', () => {
    service.enableCollaborativeMode();
    expect(mockLogger.info).toHaveBeenCalledWith('Collaborative mode enabled');
  });

  it('should enable local-only mode', () => {
    service.enableLocalOnlyMode();
    expect(mockLogger.info).toHaveBeenCalledWith('Local-only mode enabled');
  });

  it('should track undo/redo in progress state', () => {
    expect(service.isUndoRedoInProgress()).toBe(false);
  });

  it('should set undo/redo in progress during undo operation', async () => {
    const nodeSnapshot = createNodeSnapshot(
      'test-node',
      'actor',
      'Test Actor',
      new Point(100, 100),
      120,
      80,
    );

    const command = DiagramCommandFactory.addNode(
      'test-diagram',
      'test-user',
      'test-node',
      new Point(100, 100),
      nodeSnapshot,
    );

    const inverseCommand = DiagramCommandFactory.removeNode(
      'test-diagram',
      'test-user',
      'test-node',
    );

    service.recordCommand(command, inverseCommand, 'test-operation');

    // Mock command bus to track when isUndoRedoInProgress is checked
    let undoRedoStateChecked = false;
    const mockCommandBus = {
      execute: vi.fn().mockImplementation(() => {
        undoRedoStateChecked = service.isUndoRedoInProgress();
        return {
          toPromise: () => Promise.resolve(),
        };
      }),
    };

    // Replace the command bus
    (service as any)._commandBus = mockCommandBus;

    await service.undo();

    expect(undoRedoStateChecked).toBe(true);
    expect(service.isUndoRedoInProgress()).toBe(false); // Should be reset after operation
  });

  it('should set undo/redo in progress during redo operation', async () => {
    const nodeSnapshot = createNodeSnapshot(
      'test-node',
      'actor',
      'Test Actor',
      new Point(100, 100),
      120,
      80,
    );

    const command = DiagramCommandFactory.addNode(
      'test-diagram',
      'test-user',
      'test-node',
      new Point(100, 100),
      nodeSnapshot,
    );

    const inverseCommand = DiagramCommandFactory.removeNode(
      'test-diagram',
      'test-user',
      'test-node',
    );

    service.recordCommand(command, inverseCommand, 'test-operation');

    // Mock command bus
    const mockCommandBus = {
      execute: vi.fn().mockReturnValue({
        toPromise: () => Promise.resolve(),
      }),
    };
    (service as any)._commandBus = mockCommandBus;

    // First undo to populate redo stack
    await service.undo();

    // Now test redo
    let undoRedoStateChecked = false;
    mockCommandBus.execute = vi.fn().mockImplementation(() => {
      undoRedoStateChecked = service.isUndoRedoInProgress();
      return {
        toPromise: () => Promise.resolve(),
      };
    });

    await service.redo();

    expect(undoRedoStateChecked).toBe(true);
    expect(service.isUndoRedoInProgress()).toBe(false); // Should be reset after operation
  });

  it('should reset undo/redo flag even if operation fails', async () => {
    const nodeSnapshot = createNodeSnapshot(
      'test-node',
      'actor',
      'Test Actor',
      new Point(100, 100),
      120,
      80,
    );

    const command = DiagramCommandFactory.addNode(
      'test-diagram',
      'test-user',
      'test-node',
      new Point(100, 100),
      nodeSnapshot,
    );

    const inverseCommand = DiagramCommandFactory.removeNode(
      'test-diagram',
      'test-user',
      'test-node',
    );

    service.recordCommand(command, inverseCommand, 'test-operation');

    // Mock command bus to throw error
    const mockCommandBus = {
      execute: vi.fn().mockReturnValue({
        toPromise: () => Promise.reject(new Error('Command execution failed')),
      }),
    };
    (service as any)._commandBus = mockCommandBus;

    const result = await service.undo();

    expect(result).toBe(false);
    expect(service.isUndoRedoInProgress()).toBe(false); // Should be reset even after error
  });
});
