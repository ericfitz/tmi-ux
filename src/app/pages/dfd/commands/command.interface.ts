import { Graph } from '@antv/x6';

/**
 * Origin of a command - local or remote
 */
export type CommandOrigin = 'local' | 'remote';

/**
 * Interface for command execution result
 */
export interface CommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * Base Command interface - defines the contract for all commands
 */
export interface Command<T = unknown> {
  /**
   * Unique identifier for the command
   */
  readonly id: string;

  /**
   * Display name of the command
   */
  readonly name: string;

  /**
   * Origin of the command - local or remote
   */
  origin: CommandOrigin;

  /**
   * Execute the command
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  execute(graph: Graph): Promise<CommandResult<T>>;

  /**
   * Undo the command
   * @param graph The X6 graph instance
   * @returns Promise that resolves to a CommandResult
   */
  undo(graph: Graph): Promise<CommandResult>;

  /**
   * Check if this command can be executed on the current graph state
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be executed
   */
  canExecute(graph: Graph): boolean;

  /**
   * Check if this command can be undone
   * @param graph The X6 graph instance
   * @returns Boolean indicating if the command can be undone
   */
  canUndo(graph: Graph): boolean;

  /**
   * Serialize the command to a JSON string
   * @returns JSON string representation of the command
   */
  serialize(): string;

  /**
   * Get the command type for deserialization
   * @returns The command type identifier
   */
  getType(): string;
}

/**
 * Base class for commands that provides common functionality
 */
export abstract class BaseCommand<T = unknown> implements Command<T> {
  readonly id: string = Math.random().toString(36).substring(2, 11);

  abstract readonly name: string;

  origin: CommandOrigin = 'local';

  canExecute(_graph: Graph): boolean {
    return true;
  }

  canUndo(_graph: Graph): boolean {
    return true;
  }

  /**
   * Serialize the command to a JSON string
   * @returns JSON string representation of the command
   */
  serialize(): string {
    const serialized = {
      id: this.id,
      type: this.getType(),
      origin: this.origin,
      data: this.serializeData(),
    };

    return JSON.stringify(serialized);
  }

  /**
   * Get the command type for deserialization
   * This should be overridden by subclasses to return a unique type identifier
   * @returns The command type identifier
   */
  abstract getType(): string;

  /**
   * Serialize command-specific data
   * This should be overridden by subclasses to serialize their specific data
   * @returns An object containing the command-specific data
   */
  protected abstract serializeData(): Record<string, unknown>;

  protected createSuccessResult<R = T>(data?: R): CommandResult<R> {
    return {
      success: true,
      data,
    };
  }

  protected createErrorResult<R = T>(error: Error | string): CommandResult<R> {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    return {
      success: false,
      error: errorObj,
    };
  }

  abstract execute(graph: Graph): Promise<CommandResult<T>>;
  abstract undo(graph: Graph): Promise<CommandResult>;
}

/**
 * Interface for node-related command parameters
 */
export interface NodeCommandParams {
  [key: string]: unknown;
  id?: string;
  type?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  attrs?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

/**
 * Interface for edge-related command parameters
 */
export interface EdgeCommandParams {
  [key: string]: unknown;
  source?: { id: string; port?: string };
  target?: { id: string; port?: string };
  vertices?: Array<{ x: number; y: number }>;
  attrs?: Record<string, unknown>;
  data?: Record<string, unknown>;
}
