/* eslint-disable @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
// Import Angular compiler
import '@angular/compiler';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { CommandBusService, CommandValidationMiddleware } from './command-bus.service';
import { ICommandHandler, ICommandMiddleware } from '../interfaces/command-bus.interface';
import { DiagramCommandFactory, AnyDiagramCommand } from '../../domain/commands/diagram-commands';
import { Point } from '../../domain/value-objects/point';
import { NodeData } from '../../domain/value-objects/node-data';
import { AddNodeCommand } from '../../domain/commands/diagram-commands';

// Import testing utilities
import { waitForAsync } from '../../../../../testing/async-utils';

// Mock command handler for testing
class MockAddNodeHandler implements ICommandHandler<AddNodeCommand> {
  handle = vi.fn().mockReturnValue(of({ success: true }));

  getCommandType(): string {
    return 'ADD_NODE';
  }
}

// Mock middleware for testing
class MockMiddleware implements ICommandMiddleware {
  priority = 10;

  execute = vi.fn((command, next) => next(command)) as unknown as ICommandMiddleware['execute'];
}

describe('CommandBusService', () => {
  let commandBus: CommandBusService;
  let mockHandler: MockAddNodeHandler;

  beforeEach(() => {
    // Create the service directly without TestBed
    commandBus = new CommandBusService();
    mockHandler = new MockAddNodeHandler();
  });

  describe('Handler Registration', () => {
    it('should register command handler', () => {
      // Act
      commandBus.registerHandler('ADD_NODE', mockHandler);

      const command = DiagramCommandFactory.addNode(
        'diagram-1',
        'user-1',
        'node-1',
        new Point(100, 200),
        new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
      );

      // Act
      commandBus.execute(command).subscribe();

      // Assert
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
      expect(mockHandler.handle).toHaveBeenCalledWith(command);
    });

    it('should throw error when registering duplicate handler', () => {
      // Arrange
      commandBus.registerHandler('ADD_NODE', mockHandler);
      const duplicateHandler = new MockAddNodeHandler();

      // Act & Assert
      expect(() => commandBus.registerHandler('ADD_NODE', duplicateHandler)).toThrow(
        "Handler for command type 'ADD_NODE' is already registered",
      );
    });

    it('should throw error when executing command without handler', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        // Arrange
        const command = DiagramCommandFactory.addNode(
          'diagram-1',
          'user-1',
          'node-1',
          new Point(100, 200),
          new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
        );

        // Act
        commandBus.execute(command).subscribe({
          next: () => reject(new Error('Should have thrown error')),
          error: (error: { error: { message: string } }) => {
            try {
              expect(error.error.message).toBe('No handler registered for command type: ADD_NODE');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      });
    }));
  });

  describe('Middleware', () => {
    it('should execute middleware before handlers', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        // Arrange
        const executionOrder: string[] = [];
        const middleware = new MockMiddleware();

        middleware.execute = vi.fn((command, next) => {
          executionOrder.push('middleware');
          return next(command);
        }) as unknown as ICommandMiddleware['execute'];

        mockHandler.handle = vi.fn(() => {
          executionOrder.push('handler');
          return of({ success: true });
        });

        commandBus.addMiddleware(middleware);
        commandBus.registerHandler('ADD_NODE', mockHandler);

        const command = DiagramCommandFactory.addNode(
          'diagram-1',
          'user-1',
          'node-1',
          new Point(100, 200),
          new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
        );

        // Act
        commandBus.execute(command).subscribe({
          next: () => {
            try {
              expect(executionOrder).toEqual(['middleware', 'handler']);
              expect(middleware.execute).toHaveBeenCalledTimes(1);
              expect(mockHandler.handle).toHaveBeenCalledTimes(1);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: reject,
        });
      });
    }));

    it('should execute multiple middleware in priority order', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        // Arrange
        const executionOrder: string[] = [];

        const middleware1 = new MockMiddleware();
        middleware1.priority = 1;

        middleware1.execute = vi.fn((command, next) => {
          executionOrder.push('middleware1');
          return next(command);
        }) as unknown as ICommandMiddleware['execute'];

        const middleware2 = new MockMiddleware();
        middleware2.priority = 2;

        middleware2.execute = vi.fn((command, next) => {
          executionOrder.push('middleware2');
          return next(command);
        }) as unknown as ICommandMiddleware['execute'];

        mockHandler.handle = vi.fn(() => {
          executionOrder.push('handler');
          return of({ success: true });
        });

        // Add in reverse order to test sorting
        commandBus.addMiddleware(middleware2);
        commandBus.addMiddleware(middleware1);
        commandBus.registerHandler('ADD_NODE', mockHandler);

        const command = DiagramCommandFactory.addNode(
          'diagram-1',
          'user-1',
          'node-1',
          new Point(100, 200),
          new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
        );

        // Act
        commandBus.execute(command).subscribe({
          next: () => {
            try {
              expect(executionOrder).toEqual(['middleware1', 'middleware2', 'handler']);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: reject,
        });
      });
    }));

    it('should allow middleware to modify command', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        // Arrange
        const modifyingMiddleware = new MockMiddleware();

        modifyingMiddleware.execute = vi.fn((command, next) => {
          const modifiedCommand = { ...command, userId: 'modified-user' };
          return next(modifiedCommand);
        }) as unknown as ICommandMiddleware['execute'];

        commandBus.addMiddleware(modifyingMiddleware);
        commandBus.registerHandler('ADD_NODE', mockHandler);

        const command = DiagramCommandFactory.addNode(
          'diagram-1',
          'user-1',
          'node-1',
          new Point(100, 200),
          new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
        );

        // Act
        commandBus.execute(command).subscribe({
          next: () => {
            try {
              expect(mockHandler.handle).toHaveBeenCalledWith(
                expect.objectContaining({ userId: 'modified-user' }),
              );
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: reject,
        });
      });
    }));

    it('should handle middleware that throws error', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        // Arrange
        const error = new Error('Middleware error');
        const failingMiddleware = new MockMiddleware();
        failingMiddleware.execute = vi.fn(() => throwError(() => error));

        commandBus.addMiddleware(failingMiddleware);
        commandBus.registerHandler('ADD_NODE', mockHandler);

        const command = DiagramCommandFactory.addNode(
          'diagram-1',
          'user-1',
          'node-1',
          new Point(100, 200),
          new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
        );

        // Act
        commandBus.execute(command).subscribe({
          next: () => reject(new Error('Should have thrown error')),
          error: (err: { error: { message: string } }) => {
            try {
              expect(err.error.message).toBe('Middleware error');
              expect(mockHandler.handle).not.toHaveBeenCalled();
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      });
    }));
  });

  describe('Error Handling', () => {
    it('should propagate handler errors', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        // Arrange
        const error = new Error('Handler error');
        mockHandler.handle = vi.fn(() => throwError(() => error));

        commandBus.registerHandler('ADD_NODE', mockHandler);

        const command = DiagramCommandFactory.addNode(
          'diagram-1',
          'user-1',
          'node-1',
          new Point(100, 200),
          new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
        );

        // Act
        commandBus.execute(command).subscribe({
          next: () => reject(new Error('Should have thrown error')),
          error: (err: { error: { message: string } }) => {
            try {
              expect(err.error.message).toBe('Handler error');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      });
    }));

    it('should handle non-Error objects thrown by handlers', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        // Arrange
        mockHandler.handle = vi.fn(() => throwError(() => 'String error'));

        commandBus.registerHandler('ADD_NODE', mockHandler);

        const command = DiagramCommandFactory.addNode(
          'diagram-1',
          'user-1',
          'node-1',
          new Point(100, 200),
          new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
        );

        // Act
        commandBus.execute(command).subscribe({
          next: () => reject(new Error('Should have thrown error')),
          error: (err: { error: { message: string } }) => {
            try {
              expect(err.error.message).toBe('String error');
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
        });
      });
    }));
  });

  describe('Execution Context', () => {
    it('should create execution context with metadata', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        // Arrange
        commandBus.registerHandler('ADD_NODE', mockHandler);

        const command = DiagramCommandFactory.addNode(
          'diagram-1',
          'user-1',
          'node-1',
          new Point(100, 200),
          new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
        );

        // Act
        commandBus.execute(command).subscribe({
          next: result => {
            try {
              expect(result).toEqual({ success: true });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: reject,
        });
      });
    }));

    it('should measure execution time', waitForAsync(() => {
      return new Promise<void>((resolve, reject) => {
        // Arrange
        mockHandler.handle = vi.fn(() => {
          // Simulate some processing time
          return new Observable(subscriber => {
            setTimeout(() => {
              subscriber.next({ success: true });
              subscriber.complete();
            }, 10);
          });
        });

        commandBus.registerHandler('ADD_NODE', mockHandler);

        const command = DiagramCommandFactory.addNode(
          'diagram-1',
          'user-1',
          'node-1',
          new Point(100, 200),
          new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
        );

        // Act
        const startTime = Date.now();
        commandBus.execute(command).subscribe({
          next: () => {
            try {
              const executionTime = Date.now() - startTime;
              expect(executionTime).toBeGreaterThanOrEqual(10);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error(String(e)));
            }
          },
          error: reject,
        });
      });
    }));
  });
});

describe('CommandValidationMiddleware', () => {
  let middleware: CommandValidationMiddleware;

  beforeEach(() => {
    // Create the middleware directly without TestBed
    middleware = new CommandValidationMiddleware();
  });

  it('should pass valid commands through', waitForAsync(() => {
    return new Promise<void>((resolve, reject) => {
      // Arrange
      const validCommand = DiagramCommandFactory.addNode(
        'diagram-1',
        'user-1',
        'node-1',
        new Point(100, 200),
        new NodeData('node-1', 'process', 'Test', new Point(100, 200), 140, 80),
      );

      const next = vi.fn(() => of({ success: true }));

      // Act
      middleware.execute(validCommand, next).subscribe({
        next: result => {
          try {
            expect(result).toEqual({ success: true });
            expect(next).toHaveBeenCalledWith(validCommand);
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
        error: reject,
      });
    });
  }));

  it('should reject invalid commands', waitForAsync(() => {
    return new Promise<void>((resolve, reject) => {
      // Arrange
      const invalidCommand = { type: 'ADD_NODE' } as unknown as AnyDiagramCommand; // Missing required fields

      const next = vi.fn(() => of({ success: true }));

      // Act
      middleware.execute(invalidCommand, next).subscribe({
        next: () => reject(new Error('Should have thrown validation error')),
        error: (error: Error) => {
          try {
            expect(error.message).toContain('Command validation failed');
            expect(next).not.toHaveBeenCalled();
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
      });
    });
  }));
});
