import { Observable } from 'rxjs';
import { AnyDiagramCommand } from '../../domain/commands/diagram-commands';

/**
 * Command bus interface for handling commands with middleware support
 */
export interface ICommandBus {
  /**
   * Executes a command through the command bus
   */
  execute<T = unknown>(command: AnyDiagramCommand): Observable<T>;

  /**
   * Registers a command handler
   */
  registerHandler<T extends AnyDiagramCommand>(
    commandType: string,
    handler: ICommandHandler<T>,
  ): void;

  /**
   * Adds middleware to the command bus
   */
  addMiddleware(middleware: ICommandMiddleware): void;
}

/**
 * Command handler interface
 */
export interface ICommandHandler<T extends AnyDiagramCommand = AnyDiagramCommand> {
  /**
   * Handles the command execution
   */
  handle(command: T): Observable<unknown>;

  /**
   * Returns the command type this handler supports
   */
  getCommandType(): string;
}

/**
 * Command middleware interface for cross-cutting concerns
 */
export interface ICommandMiddleware {
  /**
   * Priority for middleware execution order (lower = earlier)
   */
  priority: number;

  /**
   * Executes middleware logic
   */
  execute<T = unknown>(
    command: AnyDiagramCommand,
    next: (command: AnyDiagramCommand) => Observable<T>,
  ): Observable<T>;
}

/**
 * Command execution context
 */
export interface CommandExecutionContext {
  readonly command: AnyDiagramCommand;
  readonly timestamp: Date;
  readonly executionId: string;
  readonly metadata: Record<string, unknown>;
}

/**
 * Command execution result
 */
export interface CommandExecutionResult<T = unknown> {
  readonly success: boolean;
  readonly result?: T;
  readonly error?: Error;
  readonly executionTime: number;
  readonly context: CommandExecutionContext;
}
