import { Injectable } from '@angular/core';
import { Observable, Subject } from '../../../../core/rxjs-imports';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  DiagramEventBusService,
  DiagramEventType,
  ErrorEvent,
} from '../event-bus/diagram-event-bus.service';
import { StateManagerService } from '../state/state-manager.service';
import { EditorState } from '../state/editor-state.enum';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Error categories
 */
export enum ErrorCategory {
  INITIALIZATION = 'initialization',
  RENDERING = 'rendering',
  STATE = 'state',
  OPERATION = 'operation',
  REGISTRY = 'registry',
  NETWORK = 'network',
  UNKNOWN = 'unknown',
}

/**
 * Structured error information
 */
export interface DiagramError {
  id: string;
  message: string;
  originalError?: Error;
  timestamp: number;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context?: Record<string, unknown>;
  handled: boolean;
  recoveryAttempted: boolean;
  recoverySuccessful?: boolean;
}

/**
 * Service for centralized error handling and recovery
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramErrorHandlingService {
  private errors: DiagramError[] = [];
  private errorSubject = new Subject<DiagramError>();

  // Maximum number of errors to keep in history
  private readonly MAX_ERROR_HISTORY = 100;

  // Recovery strategies by category
  private recoveryStrategies: Record<ErrorCategory, (error: DiagramError) => Promise<boolean>> = {
    [ErrorCategory.INITIALIZATION]: this.recoverFromInitializationError.bind(this),
    [ErrorCategory.RENDERING]: this.recoverFromRenderingError.bind(this),
    [ErrorCategory.STATE]: this.recoverFromStateError.bind(this),
    [ErrorCategory.OPERATION]: this.recoverFromOperationError.bind(this),
    [ErrorCategory.REGISTRY]: this.recoverFromRegistryError.bind(this),
    [ErrorCategory.NETWORK]: this.recoverFromNetworkError.bind(this),
    [ErrorCategory.UNKNOWN]: this.recoverFromUnknownError.bind(this),
  };

  constructor(
    private logger: LoggerService,
    private eventBus: DiagramEventBusService,
    private stateManager: StateManagerService,
  ) {
    this.logger.info('DiagramErrorHandlingService initialized');

    // Subscribe to error events from the event bus
    this.eventBus.on<ErrorEvent>(DiagramEventType.ERROR_OCCURRED).subscribe(event => {
      this.handleError(event.error, event.context);
    });
  }

  /**
   * Get the error observable
   * @returns An observable that emits errors as they occur
   */
  public getErrors(): Observable<DiagramError> {
    return this.errorSubject.asObservable();
  }

  /**
   * Get the error history
   * @returns The error history
   */
  public getErrorHistory(): DiagramError[] {
    return [...this.errors];
  }

  /**
   * Handle an error
   * @param error The error to handle
   * @param context Optional context information
   * @returns The structured error information
   */
  public handleError(error: Error, context?: Record<string, unknown>): DiagramError {
    // Create a structured error
    const diagramError: DiagramError = {
      id: `error-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      message: error.message,
      originalError: error,
      timestamp: Date.now(),
      severity: this.determineSeverity(error, context),
      category: this.determineCategory(error, context),
      context,
      handled: false,
      recoveryAttempted: false,
    };

    // Log the error
    this.logError(diagramError);

    // Add to history
    this.addToHistory(diagramError);

    // Emit the error
    this.errorSubject.next(diagramError);

    // Attempt recovery for non-critical errors
    if (diagramError.severity !== ErrorSeverity.CRITICAL) {
      this.attemptRecovery(diagramError);
    }

    return diagramError;
  }

  /**
   * Attempt to recover from an error
   * @param error The error to recover from
   * @returns A promise that resolves to true if recovery was successful
   */
  public async attemptRecovery(error: DiagramError): Promise<boolean> {
    if (error.recoveryAttempted) {
      this.logger.warn(`Recovery already attempted for error: ${error.id}`);
      return error.recoverySuccessful || false;
    }

    error.recoveryAttempted = true;

    try {
      // Get the recovery strategy for the error category
      const recoveryStrategy = this.recoveryStrategies[error.category];

      // Attempt recovery
      const success = await recoveryStrategy(error);

      // Update error status
      error.recoverySuccessful = success;
      error.handled = true;

      // Log the result
      if (success) {
        this.logger.info(`Successfully recovered from error: ${error.id}`);
      } else {
        this.logger.warn(`Failed to recover from error: ${error.id}`);
      }

      return success;
    } catch (recoveryError) {
      this.logger.error(`Error during recovery attempt: ${error.id}`, recoveryError);
      error.recoverySuccessful = false;
      error.handled = true;
      return false;
    }
  }

  /**
   * Clear the error history
   */
  public clearErrorHistory(): void {
    this.errors = [];
  }

  /**
   * Determine the severity of an error
   * @param error The error
   * @param context The error context
   * @returns The error severity
   */
  private determineSeverity(error: Error, context?: Record<string, unknown>): ErrorSeverity {
    // Check for known critical errors
    if (
      error.message.includes('Graph not initialized') ||
      error.message.includes('Cannot initialize renderer') ||
      error.message.includes('Failed to load diagram')
    ) {
      return ErrorSeverity.CRITICAL;
    }

    // Check for known error patterns
    if (
      error.message.includes('Operation not allowed') ||
      error.message.includes('Invalid state transition') ||
      error.message.includes('Cell not found')
    ) {
      return ErrorSeverity.ERROR;
    }

    // Check for warnings
    if (error.message.includes('already registered') || error.message.includes('already exists')) {
      return ErrorSeverity.WARNING;
    }

    // Default to ERROR
    return ErrorSeverity.ERROR;
  }

  /**
   * Determine the category of an error
   * @param error The error
   * @param context The error context
   * @returns The error category
   */
  private determineCategory(error: Error, context?: Record<string, unknown>): ErrorCategory {
    // Check context for operation information
    if (context && 'operation' in context) {
      return ErrorCategory.OPERATION;
    }

    // Check for initialization errors
    if (
      error.message.includes('Graph not initialized') ||
      error.message.includes('Cannot initialize renderer') ||
      error.message.includes('Container not set')
    ) {
      return ErrorCategory.INITIALIZATION;
    }

    // Check for state errors
    if (
      error.message.includes('Operation not allowed in current state') ||
      error.message.includes('Invalid state transition') ||
      (error.message.includes('Not in') && error.message.includes('state'))
    ) {
      return ErrorCategory.STATE;
    }

    // Check for registry errors
    if (
      error.message.includes('Cell not found in registry') ||
      error.message.includes('Component not found in registry') ||
      error.message.includes('already registered')
    ) {
      return ErrorCategory.REGISTRY;
    }

    // Check for rendering errors
    if (
      error.message.includes('Failed to render') ||
      error.message.includes('Failed to create vertex') ||
      error.message.includes('Failed to create edge')
    ) {
      return ErrorCategory.RENDERING;
    }

    // Check for network errors
    if (
      error.message.includes('Failed to load') ||
      error.message.includes('Network error') ||
      error.message.includes('timeout')
    ) {
      return ErrorCategory.NETWORK;
    }

    // Default to UNKNOWN
    return ErrorCategory.UNKNOWN;
  }

  /**
   * Log an error
   * @param error The error to log
   */
  private logError(error: DiagramError): void {
    switch (error.severity) {
      case ErrorSeverity.INFO:
        this.logger.info(`[${error.category}] ${error.message}`, error.context);
        break;
      case ErrorSeverity.WARNING:
        this.logger.warn(`[${error.category}] ${error.message}`, error.context);
        break;
      case ErrorSeverity.ERROR:
        this.logger.error(`[${error.category}] ${error.message}`, error.originalError);
        break;
      case ErrorSeverity.CRITICAL:
        this.logger.error(`[CRITICAL] [${error.category}] ${error.message}`, error.originalError);
        break;
    }
  }

  /**
   * Add an error to the history
   * @param error The error to add
   */
  private addToHistory(error: DiagramError): void {
    this.errors.push(error);

    // Trim history if it exceeds the maximum size
    if (this.errors.length > this.MAX_ERROR_HISTORY) {
      this.errors = this.errors.slice(-this.MAX_ERROR_HISTORY);
    }
  }

  /**
   * Recover from an initialization error
   * @param error The error to recover from
   * @returns A promise that resolves to true if recovery was successful
   */
  private async recoverFromInitializationError(error: DiagramError): Promise<boolean> {
    this.logger.info(`Attempting to recover from initialization error: ${error.id}`);

    // Check current state
    const currentState = this.stateManager.getCurrentState();

    // If we're in ERROR state, transition to RECOVERING
    if (currentState === EditorState.ERROR) {
      this.stateManager.transitionTo(EditorState.RECOVERING);
    }

    // Wait a moment to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Attempt to transition to INITIALIZING
    const success = this.stateManager.transitionTo(EditorState.INITIALIZING);

    return success;
  }

  /**
   * Recover from a rendering error
   * @param error The error to recover from
   * @returns A promise that resolves to true if recovery was successful
   */
  private async recoverFromRenderingError(error: DiagramError): Promise<boolean> {
    this.logger.info(`Attempting to recover from rendering error: ${error.id}`);

    // Check current state
    const currentState = this.stateManager.getCurrentState();

    // If we're in ERROR state, transition to RECOVERING
    if (currentState === EditorState.ERROR) {
      this.stateManager.transitionTo(EditorState.RECOVERING);
    }

    // Wait a moment to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Attempt to transition to READY
    const success = this.stateManager.transitionTo(EditorState.READY);

    return success;
  }

  /**
   * Recover from a state error
   * @param error The error to recover from
   * @returns A promise that resolves to true if recovery was successful
   */
  private async recoverFromStateError(error: DiagramError): Promise<boolean> {
    this.logger.info(`Attempting to recover from state error: ${error.id}`);

    // Check current state
    const currentState = this.stateManager.getCurrentState();

    // If we're in ERROR state, transition to RECOVERING
    if (currentState === EditorState.ERROR) {
      this.stateManager.transitionTo(EditorState.RECOVERING);
    }

    // Wait a moment to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Attempt to transition to READY
    const success = this.stateManager.transitionTo(EditorState.READY);

    return success;
  }

  /**
   * Recover from an operation error
   * @param error The error to recover from
   * @returns A promise that resolves to true if recovery was successful
   */
  private async recoverFromOperationError(error: DiagramError): Promise<boolean> {
    this.logger.info(`Attempting to recover from operation error: ${error.id}`);

    // For operation errors, we just need to ensure we're in a valid state
    const currentState = this.stateManager.getCurrentState();

    // If we're not in READY state, try to transition to it
    if (currentState !== EditorState.READY) {
      // If we're in ERROR state, transition to RECOVERING first
      if (currentState === EditorState.ERROR) {
        this.stateManager.transitionTo(EditorState.RECOVERING);

        // Wait a moment to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Attempt to transition to READY
      return this.stateManager.transitionTo(EditorState.READY);
    }

    // Already in READY state, consider it recovered
    return true;
  }

  /**
   * Recover from a registry error
   * @param error The error to recover from
   * @returns A promise that resolves to true if recovery was successful
   */
  private async recoverFromRegistryError(error: DiagramError): Promise<boolean> {
    this.logger.info(`Attempting to recover from registry error: ${error.id}`);

    // Registry errors are usually non-critical and don't require state changes
    // Just ensure we're in a valid state
    const currentState = this.stateManager.getCurrentState();

    // If we're not in READY state, try to transition to it
    if (currentState !== EditorState.READY) {
      // If we're in ERROR state, transition to RECOVERING first
      if (currentState === EditorState.ERROR) {
        this.stateManager.transitionTo(EditorState.RECOVERING);

        // Wait a moment to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Attempt to transition to READY
      return this.stateManager.transitionTo(EditorState.READY);
    }

    // Already in READY state, consider it recovered
    return true;
  }

  /**
   * Recover from a network error
   * @param error The error to recover from
   * @returns A promise that resolves to true if recovery was successful
   */
  private async recoverFromNetworkError(error: DiagramError): Promise<boolean> {
    this.logger.info(`Attempting to recover from network error: ${error.id}`);

    // Network errors usually require user intervention
    // Just ensure we're in a valid state
    const currentState = this.stateManager.getCurrentState();

    // If we're not in READY state, try to transition to it
    if (currentState !== EditorState.READY) {
      // If we're in ERROR state, transition to RECOVERING first
      if (currentState === EditorState.ERROR) {
        this.stateManager.transitionTo(EditorState.RECOVERING);

        // Wait a moment to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Attempt to transition to READY
      return this.stateManager.transitionTo(EditorState.READY);
    }

    // Already in READY state, consider it recovered
    return true;
  }

  /**
   * Recover from an unknown error
   * @param error The error to recover from
   * @returns A promise that resolves to true if recovery was successful
   */
  private async recoverFromUnknownError(error: DiagramError): Promise<boolean> {
    this.logger.info(`Attempting to recover from unknown error: ${error.id}`);

    // For unknown errors, we just try to get back to READY state
    const currentState = this.stateManager.getCurrentState();

    // If we're not in READY state, try to transition to it
    if (currentState !== EditorState.READY) {
      // If we're in ERROR state, transition to RECOVERING first
      if (currentState === EditorState.ERROR) {
        this.stateManager.transitionTo(EditorState.RECOVERING);

        // Wait a moment to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Attempt to transition to READY
      return this.stateManager.transitionTo(EditorState.READY);
    }

    // Already in READY state, consider it recovered
    return true;
  }
}
