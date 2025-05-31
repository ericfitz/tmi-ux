import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import {
  ICommandBus,
  ICommandHandler,
  ICommandMiddleware,
  CommandExecutionContext,
  CommandExecutionResult,
} from '../interfaces/command-bus.interface';
import { AnyDiagramCommand } from '../../domain/commands/diagram-commands';
import { DiagramCommandValidator } from '../../domain/commands/diagram-commands';

/**
 * Command bus implementation with middleware support
 */
@Injectable({
  providedIn: 'root',
})
export class CommandBusService implements ICommandBus {
  private readonly _handlers = new Map<string, ICommandHandler>();
  private readonly _middleware: ICommandMiddleware[] = [];

  /**
   * Executes a command through the command bus with middleware pipeline
   */
  execute<T = unknown>(command: AnyDiagramCommand): Observable<T> {
    const context = this.createExecutionContext(command);
    const startTime = Date.now();

    return this.executeWithMiddleware(command).pipe(
      map(result => this.createSuccessResult<T>(result as T, context, startTime)),
      catchError(error => {
        const errorResult = this.createErrorResult<T>(
          error instanceof Error ? error : new Error(String(error)),
          context,
          startTime,
        );
        return throwError(() => errorResult);
      }),
      map(result => result.result as T),
    );
  }

  /**
   * Registers a command handler for a specific command type
   */
  registerHandler<T extends AnyDiagramCommand>(
    commandType: string,
    handler: ICommandHandler<T>,
  ): void {
    if (this._handlers.has(commandType)) {
      throw new Error(`Handler for command type '${commandType}' is already registered`);
    }
    this._handlers.set(commandType, handler as ICommandHandler);
  }

  /**
   * Adds middleware to the command bus
   */
  addMiddleware(middleware: ICommandMiddleware): void {
    this._middleware.push(middleware);
    // Sort middleware by priority (lower priority executes first)
    this._middleware.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Executes command through middleware pipeline
   */
  private executeWithMiddleware<T = unknown>(command: AnyDiagramCommand): Observable<T> {
    if (this._middleware.length === 0) {
      return this.executeHandler(command);
    }

    // Create middleware chain
    let index = 0;
    const next = (cmd: AnyDiagramCommand): Observable<T> => {
      if (index >= this._middleware.length) {
        return this.executeHandler(cmd);
      }
      const middleware = this._middleware[index++];
      return middleware.execute(cmd, next);
    };

    return next(command);
  }

  /**
   * Executes the actual command handler
   */
  private executeHandler<T = unknown>(command: AnyDiagramCommand): Observable<T> {
    const handler = this._handlers.get(command.type);
    if (!handler) {
      return throwError(() => new Error(`No handler registered for command type: ${command.type}`));
    }

    return handler.handle(command) as Observable<T>;
  }

  /**
   * Creates execution context for command
   */
  private createExecutionContext(command: AnyDiagramCommand): CommandExecutionContext {
    return {
      command,
      timestamp: new Date(),
      executionId: this.generateExecutionId(),
      metadata: {},
    };
  }

  /**
   * Creates success result
   */
  private createSuccessResult<T>(
    result: T,
    context: CommandExecutionContext,
    startTime: number,
  ): CommandExecutionResult<T> {
    return {
      success: true,
      result,
      executionTime: Date.now() - startTime,
      context,
    };
  }

  /**
   * Creates error result
   */
  private createErrorResult<T>(
    error: Error,
    context: CommandExecutionContext,
    startTime: number,
  ): CommandExecutionResult<T> {
    return {
      success: false,
      error,
      executionTime: Date.now() - startTime,
      context,
    };
  }

  /**
   * Generates unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Command validation middleware
 */
@Injectable({
  providedIn: 'root',
})
export class CommandValidationMiddleware implements ICommandMiddleware {
  readonly priority = 1;

  execute<T = unknown>(
    command: AnyDiagramCommand,
    next: (command: AnyDiagramCommand) => Observable<T>,
  ): Observable<T> {
    const validation = DiagramCommandValidator.validate(command);

    if (!validation.isValid) {
      return throwError(
        () => new Error(`Command validation failed: ${validation.errors.join(', ')}`),
      );
    }

    return next(command);
  }
}

/**
 * Command logging middleware
 */
@Injectable({
  providedIn: 'root',
})
export class CommandLoggingMiddleware implements ICommandMiddleware {
  readonly priority = 2;

  execute<T = unknown>(
    command: AnyDiagramCommand,
    next: (command: AnyDiagramCommand) => Observable<T>,
  ): Observable<T> {
    // TODO: Replace with proper logging service
    // console.log(`[CommandBus] Executing command: ${command.type}`, {
    //   commandId: command.commandId,
    //   diagramId: command.diagramId,
    //   userId: command.userId,
    // });

    return next(command).pipe(
      tap({
        next: _result => {
          // TODO: Replace with proper logging service
          // const startTime = Date.now();
          // const executionTime = Date.now() - startTime;
          // console.log(`[CommandBus] Command executed successfully: ${command.type}`, {
          //   commandId: command.commandId,
          //   executionTime: `${executionTime}ms`,
          // });
        },
        error: _error => {
          // TODO: Replace with proper logging service
          // const startTime = Date.now();
          // const executionTime = Date.now() - startTime;
          // console.error(`[CommandBus] Command execution failed: ${command.type}`, {
          //   commandId: command.commandId,
          //   executionTime: `${executionTime}ms`,
          //   error: error instanceof Error ? error.message : String(error),
          // });
        },
      }),
    );
  }
}

/**
 * Command serialization middleware for collaboration
 */
@Injectable({
  providedIn: 'root',
})
export class CommandSerializationMiddleware implements ICommandMiddleware {
  readonly priority = 3;

  execute<T = unknown>(
    command: AnyDiagramCommand,
    next: (command: AnyDiagramCommand) => Observable<T>,
  ): Observable<T> {
    // Add serialization metadata
    const serializedCommand = {
      ...command,
      serializedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    return next(serializedCommand as AnyDiagramCommand).pipe(
      tap(() => {
        // Here we could emit the command to collaboration service
        // for real-time synchronization
        this.emitCommandForCollaboration(command);
      }),
    );
  }

  /**
   * Emits command for collaboration (placeholder for future implementation)
   */
  private emitCommandForCollaboration(_command: AnyDiagramCommand): void {
    // TODO: Implement collaboration command emission
    // This will be connected to WebSocket service in Phase 2
  }
}
