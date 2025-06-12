import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LoggerService } from '../../../core/services/logger.service';
import { Command, CommandResult } from './command.interface';
import { DfdStateStore } from '../state/dfd.state';

/**
 * Service responsible for executing and tracking commands
 * Provides undo/redo functionality separate from X6's built-in history
 */
@Injectable({
  providedIn: 'root',
})
export class CommandManagerService {
  // Public observables
  readonly canUndo$: Observable<boolean>;
  readonly canRedo$: Observable<boolean>;
  readonly isExecuting$: Observable<boolean>;

  // Private instance fields for BehaviorSubjects
  private _canUndo = new BehaviorSubject<boolean>(false);
  private _canRedo = new BehaviorSubject<boolean>(false);
  private _isExecuting = new BehaviorSubject<boolean>(false);

  // Private instance fields for command stacks
  private executedCommands: Command[] = [];
  private undoneCommands: Command[] = [];

  constructor(
    private logger: LoggerService,
    private stateStore: DfdStateStore,
  ) {
    // Initialize observables from BehaviorSubjects
    this.canUndo$ = this._canUndo.asObservable();
    this.canRedo$ = this._canRedo.asObservable();
    this.isExecuting$ = this._isExecuting.asObservable();

    this.logger.info('CommandManagerService initialized');
    this.updateCommandStates();
  }

  // Public Getters
  /**
   * Get whether commands can be undone
   */
  get canUndo(): boolean {
    return this.executedCommands.length > 0;
  }

  /**
   * Get whether commands can be redone
   */
  get canRedo(): boolean {
    return this.undoneCommands.length > 0;
  }

  /**
   * Get whether a command is currently executing
   */
  get isExecuting(): boolean {
    return this._isExecuting.value;
  }

  /**
   * Execute a command
   * @param command The command to execute
   * @returns Observable that emits the command result
   */
  executeCommand<T>(command: Command<T>): Observable<CommandResult<T>> {
    this.logger.info(`Executing command: ${command.name}`);
    this._isExecuting.next(true);

    const graph = this.stateStore.graph;
    if (!graph) {
      this._isExecuting.next(false);
      return of(this.createErrorResult<T>('Graph is not initialized'));
    }

    if (!command.canExecute(graph)) {
      this._isExecuting.next(false);
      return of(
        this.createErrorResult<T>(
          `Command ${command.name} cannot be executed in the current state`,
        ),
      );
    }

    return from(command.execute(graph)).pipe(
      tap(result => {
        if (result.success) {
          this.executedCommands.push(command);
          // Clear the redo stack when a new command is executed
          this.undoneCommands = [];
          this.updateCommandStates();
          this.logger.info(`Command executed successfully: ${command.name}`);
        } else {
          this.logger.error(`Command execution failed: ${command.name}`, result.error);
        }
        this._isExecuting.next(false);
      }),
      catchError((error: Error) => {
        this.logger.error(`Error executing command: ${command.name}`, error);
        this._isExecuting.next(false);
        return of(this.createErrorResult<T>(error));
      }),
    );
  }

  /**
   * Undo the last executed command
   * @returns Observable that emits the command result
   */
  undo(): Observable<CommandResult> {
    if (!this.canUndo) {
      return of(this.createErrorResult('No commands to undo'));
    }

    const graph = this.stateStore.graph;
    if (!graph) {
      return of(this.createErrorResult('Graph is not initialized'));
    }

    this._isExecuting.next(true);

    const commandToUndo = this.executedCommands.pop();
    if (!commandToUndo) {
      this._isExecuting.next(false);
      return of(this.createErrorResult('No command to undo'));
    }

    if (!commandToUndo.canUndo(graph)) {
      // Push the command back onto the stack since we couldn't undo it
      this.executedCommands.push(commandToUndo);
      this._isExecuting.next(false);
      return of(this.createErrorResult(`Command ${commandToUndo.name} cannot be undone`));
    }

    this.logger.info(`Undoing command: ${commandToUndo.name}`);

    return from(commandToUndo.undo(graph)).pipe(
      tap(result => {
        if (result.success) {
          this.undoneCommands.push(commandToUndo);
          this.updateCommandStates();
          this.logger.info(`Command undone successfully: ${commandToUndo.name}`);
        } else {
          // Push the command back onto the stack since the undo failed
          this.executedCommands.push(commandToUndo);
          this.logger.error(`Command undo failed: ${commandToUndo.name}`, result.error);
        }
        this._isExecuting.next(false);
      }),
      catchError((error: Error) => {
        // Push the command back onto the stack since an error occurred
        this.executedCommands.push(commandToUndo);
        this.logger.error(`Error undoing command: ${commandToUndo.name}`, error);
        this._isExecuting.next(false);
        return of(this.createErrorResult(error));
      }),
    );
  }

  /**
   * Redo the last undone command
   * @returns Observable that emits the command result
   */
  redo(): Observable<CommandResult> {
    if (!this.canRedo) {
      return of(this.createErrorResult('No commands to redo'));
    }

    const graph = this.stateStore.graph;
    if (!graph) {
      return of(this.createErrorResult('Graph is not initialized'));
    }

    this._isExecuting.next(true);

    const commandToRedo = this.undoneCommands.pop();
    if (!commandToRedo) {
      this._isExecuting.next(false);
      return of(this.createErrorResult('No command to redo'));
    }

    if (!commandToRedo.canExecute(graph)) {
      // Push the command back onto the undo stack since we couldn't redo it
      this.undoneCommands.push(commandToRedo);
      this._isExecuting.next(false);
      return of(this.createErrorResult(`Command ${commandToRedo.name} cannot be redone`));
    }

    this.logger.info(`Redoing command: ${commandToRedo.name}`);

    return from(commandToRedo.execute(graph)).pipe(
      tap(result => {
        if (result.success) {
          this.executedCommands.push(commandToRedo);
          this.updateCommandStates();
          this.logger.info(`Command redone successfully: ${commandToRedo.name}`);
        } else {
          // Push the command back onto the undo stack since the redo failed
          this.undoneCommands.push(commandToRedo);
          this.logger.error(`Command redo failed: ${commandToRedo.name}`, result.error);
        }
        this._isExecuting.next(false);
      }),
      catchError((error: Error) => {
        // Push the command back onto the undo stack since an error occurred
        this.undoneCommands.push(commandToRedo);
        this.logger.error(`Error redoing command: ${commandToRedo.name}`, error);
        this._isExecuting.next(false);
        return of(this.createErrorResult(error));
      }),
    );
  }

  /**
   * Clear all command history
   */
  clearHistory(): void {
    this.executedCommands = [];
    this.undoneCommands = [];
    this.updateCommandStates();
    this.logger.info('Command history cleared');
  }

  // Private methods
  /**
   * Update the undo/redo state based on the command stacks
   */
  private updateCommandStates(): void {
    this._canUndo.next(this.executedCommands.length > 0);
    this._canRedo.next(this.undoneCommands.length > 0);

    // Update the state store with history capabilities
    this.stateStore.updateState(
      {
        canUndo: this.executedCommands.length > 0,
        canRedo: this.undoneCommands.length > 0,
      },
      'CommandManagerService.updateCommandStates',
    );
  }

  /**
   * Utility method to create an error result
   */
  private createErrorResult<T>(error: Error | string): CommandResult<T> {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    return {
      success: false,
      error: errorObj,
      // data is implicitly undefined, which is fine as it's optional in CommandResult<T>
    };
  }
}
