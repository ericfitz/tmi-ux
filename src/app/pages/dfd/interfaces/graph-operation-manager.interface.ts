/**
 * Interface for the unified graph operation manager
 */

import { Observable } from 'rxjs';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  OperationConfig,
  OperationStats,
  OperationCompletedEvent,
  OperationValidator,
  OperationExecutor,
  OperationInterceptor,
} from '../types/graph-operation.types';

/**
 * Main interface for the graph operation manager
 * Provides unified handling of all graph operations
 */
export interface IGraphOperationManager {
  // Core operation processing
  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult>;
  executeBatch(
    operations: GraphOperation[],
    context: OperationContext,
  ): Observable<OperationResult[]>;

  // Operation lifecycle
  validate(operation: GraphOperation, context: OperationContext): Observable<boolean>;
  canExecute(operation: GraphOperation, context: OperationContext): boolean;

  // Configuration
  configure(config: Partial<OperationConfig>): void;
  getConfiguration(): OperationConfig;

  // Extensibility
  addValidator(validator: OperationValidator): void;
  removeValidator(validator: OperationValidator): void;
  addExecutor(executor: OperationExecutor): void;
  removeExecutor(executor: OperationExecutor): void;
  addInterceptor(interceptor: OperationInterceptor): void;
  removeInterceptor(interceptor: OperationInterceptor): void;

  // Observables for monitoring
  readonly operationCompleted$: Observable<OperationCompletedEvent>;
  readonly operationFailed$: Observable<{ operation: GraphOperation; error: string }>;
  readonly operationValidated$: Observable<{ operation: GraphOperation; valid: boolean }>;

  // Statistics and monitoring
  getStats(): OperationStats;
  resetStats(): void;

  // State management
  isPending(operationId: string): boolean;
  getPendingOperations(): GraphOperation[];
  cancelOperation(operationId: string): boolean;

  // Cleanup
  dispose(): void;
}

/**
 * Factory interface for creating operation managers
 */
export interface IGraphOperationManagerFactory {
  create(config?: Partial<OperationConfig>): IGraphOperationManager;
  createWithDefaults(): IGraphOperationManager;
}
