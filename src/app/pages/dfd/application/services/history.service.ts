import { Injectable, OnDestroy, Inject, forwardRef } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { LoggerService } from '../../../../core/services/logger.service';
import { AnyDiagramCommand } from '../../domain/commands/diagram-commands';
import { IHistoryService, HistoryEntry, HistoryConfig } from '../../domain/history/history.types';
import { ICommandBus } from '../interfaces/command-bus.interface';

/**
 * Default configuration for history service
 */
const DEFAULT_CONFIG: HistoryConfig = {
  maxHistorySize: 100,
  cleanupThreshold: 80,
  enableCollaboration: false,
  operationTimeout: 30000,
};

/**
 * Service that manages undo/redo functionality for diagram commands
 */
@Injectable({
  providedIn: 'root',
})
export class HistoryService implements IHistoryService, OnDestroy {
  private readonly _config: HistoryConfig;
  private readonly _destroy$ = new Subject<void>();

  // History stacks
  private readonly _undoStack: HistoryEntry[] = [];
  private readonly _redoStack: HistoryEntry[] = [];

  // Observables for UI state
  private readonly _canUndo$ = new BehaviorSubject<boolean>(false);
  private readonly _canRedo$ = new BehaviorSubject<boolean>(false);
  private readonly _historySize$ = new BehaviorSubject<number>(0);

  // Collaboration mode
  private _collaborativeMode = false;

  constructor(
    private readonly _logger: LoggerService,
    @Inject(forwardRef(() => 'ICommandBus')) private readonly _commandBus?: ICommandBus,
  ) {
    this._config = { ...DEFAULT_CONFIG };
    this._logger.info('History service initialized', { config: this._config });
  }

  /**
   * Observable indicating if undo is possible
   */
  get canUndo$(): Observable<boolean> {
    return this._canUndo$.asObservable();
  }

  /**
   * Observable indicating if redo is possible
   */
  get canRedo$(): Observable<boolean> {
    return this._canRedo$.asObservable();
  }

  /**
   * Observable for current history size
   */
  get historySize$(): Observable<number> {
    return this._historySize$.asObservable();
  }

  /**
   * Performs an undo operation
   */
  async undo(): Promise<boolean> {
    if (this._undoStack.length === 0) {
      this._logger.debug('Undo requested but no commands in undo stack');
      return false;
    }

    const entry = this._undoStack.pop();
    if (!entry) {
      return false;
    }

    try {
      this._logger.debug('Executing undo', {
        commandType: entry.command.type,
        commandId: entry.command.commandId,
      });

      // Execute the inverse command
      await this._executeInverseCommand(entry.inverse);

      // Move to redo stack
      this._redoStack.push(entry);

      // Update observables
      this._updateObservables();

      this._logger.info('Undo completed successfully', {
        commandType: entry.command.type,
        undoStackSize: this._undoStack.length,
        redoStackSize: this._redoStack.length,
      });

      return true;
    } catch (error) {
      this._logger.error('Undo operation failed', {
        error,
        commandType: entry.command.type,
        commandId: entry.command.commandId,
      });

      // Put the entry back on the undo stack
      this._undoStack.push(entry);
      return false;
    }
  }

  /**
   * Performs a redo operation
   */
  async redo(): Promise<boolean> {
    if (this._redoStack.length === 0) {
      this._logger.debug('Redo requested but no commands in redo stack');
      return false;
    }

    const entry = this._redoStack.pop();
    if (!entry) {
      return false;
    }

    try {
      this._logger.debug('Executing redo', {
        commandType: entry.command.type,
        commandId: entry.command.commandId,
      });

      // Execute the original command
      await this._executeOriginalCommand(entry.command);

      // Move back to undo stack
      this._undoStack.push(entry);

      // Update observables
      this._updateObservables();

      this._logger.info('Redo completed successfully', {
        commandType: entry.command.type,
        undoStackSize: this._undoStack.length,
        redoStackSize: this._redoStack.length,
      });

      return true;
    } catch (error) {
      this._logger.error('Redo operation failed', {
        error,
        commandType: entry.command.type,
        commandId: entry.command.commandId,
      });

      // Put the entry back on the redo stack
      this._redoStack.push(entry);
      return false;
    }
  }

  /**
   * Records a command and its inverse in the history
   */
  recordCommand(command: AnyDiagramCommand, inverse: AnyDiagramCommand, operationId: string): void {
    const entry: HistoryEntry = {
      id: this._generateEntryId(),
      command,
      inverse,
      timestamp: Date.now(),
      operationId,
      author: this._getCurrentAuthor(),
    };

    this._undoStack.push(entry);
    this._logger.debug('Command recorded in history', {
      commandType: command.type,
      commandId: command.commandId,
      operationId,
      historySize: this._undoStack.length,
    });

    // Cleanup if needed
    this._cleanupHistoryIfNeeded();

    // Update observables
    this._updateObservables();
  }

  /**
   * Clears the redo stack (called when a new command is executed)
   */
  clearRedoStack(): void {
    if (this._redoStack.length > 0) {
      this._logger.debug('Clearing redo stack', { size: this._redoStack.length });
      this._redoStack.length = 0;
      this._updateObservables();
    }
  }

  /**
   * Clears all history
   */
  clear(): void {
    this._logger.info('Clearing all history', {
      undoStackSize: this._undoStack.length,
      redoStackSize: this._redoStack.length,
    });

    this._undoStack.length = 0;
    this._redoStack.length = 0;
    this._updateObservables();
  }

  /**
   * Gets a copy of the current history
   */
  getHistory(): ReadonlyArray<HistoryEntry> {
    return [...this._undoStack];
  }

  /**
   * Enables collaborative mode
   */
  enableCollaborativeMode(): void {
    this._collaborativeMode = true;
    this._logger.info('Collaborative mode enabled');
  }

  /**
   * Enables local-only mode
   */
  enableLocalOnlyMode(): void {
    this._collaborativeMode = false;
    this._logger.info('Local-only mode enabled');
  }

  /**
   * Cleanup when service is destroyed
   */
  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._canUndo$.complete();
    this._canRedo$.complete();
    this._historySize$.complete();
  }

  /**
   * Executes an inverse command (for undo)
   */
  private async _executeInverseCommand(inverseCommand: AnyDiagramCommand): Promise<void> {
    this._logger.debug('Executing inverse command', {
      commandType: inverseCommand.type,
      commandId: inverseCommand.commandId,
    });

    if (!this._commandBus) {
      this._logger.warn('Command bus not available, cannot execute inverse command');
      return;
    }

    try {
      await this._commandBus.execute(inverseCommand).toPromise();
    } catch (error) {
      this._logger.error('Failed to execute inverse command', {
        error,
        commandType: inverseCommand.type,
        commandId: inverseCommand.commandId,
      });
      throw error;
    }
  }

  /**
   * Executes an original command (for redo)
   */
  private async _executeOriginalCommand(originalCommand: AnyDiagramCommand): Promise<void> {
    this._logger.debug('Executing original command', {
      commandType: originalCommand.type,
      commandId: originalCommand.commandId,
    });

    if (!this._commandBus) {
      this._logger.warn('Command bus not available, cannot execute original command');
      return;
    }

    try {
      await this._commandBus.execute(originalCommand).toPromise();
    } catch (error) {
      this._logger.error('Failed to execute original command', {
        error,
        commandType: originalCommand.type,
        commandId: originalCommand.commandId,
      });
      throw error;
    }
  }

  /**
   * Updates all observables with current state
   */
  private _updateObservables(): void {
    this._canUndo$.next(this._undoStack.length > 0);
    this._canRedo$.next(this._redoStack.length > 0);
    this._historySize$.next(this._undoStack.length);
  }

  /**
   * Cleans up history if it exceeds the configured limits
   */
  private _cleanupHistoryIfNeeded(): void {
    if (this._undoStack.length > this._config.cleanupThreshold) {
      const commandsToRemove = this._undoStack.length - this._config.maxHistorySize;
      const removedCommands = this._undoStack.splice(0, commandsToRemove);

      this._logger.info('Cleaned up old history entries', {
        removedCount: removedCommands.length,
        remainingCount: this._undoStack.length,
      });
    }
  }

  /**
   * Generates a unique entry ID
   */
  private _generateEntryId(): string {
    return `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gets the current author information
   */
  private _getCurrentAuthor(): { id: string; name: string } | undefined {
    // TODO: This will be implemented when we integrate with the auth system
    // For now, return undefined for local operations
    return undefined;
  }
}
