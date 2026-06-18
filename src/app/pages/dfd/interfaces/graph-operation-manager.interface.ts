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
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: dispatch a single graph operation and return its result (mutates shared state)
  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: dispatch multiple graph operations atomically and return all results (mutates shared state)
  executeBatch(
    operations: GraphOperation[],
    context: OperationContext,
  ): Observable<OperationResult[]>;

  // Operation lifecycle
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate a graph operation against registered validators (pure)
  validate(operation: GraphOperation, context: OperationContext): Observable<boolean>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: check synchronously whether a graph operation is currently permitted (pure)
  canExecute(operation: GraphOperation, context: OperationContext): boolean;

  // Configuration
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: apply partial configuration overrides to the operation manager (mutates shared state)
  configure(config: Partial<OperationConfig>): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return the current operation manager configuration (pure)
  getConfiguration(): OperationConfig;

  // Extensibility
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: register an operation validator with the manager (mutates shared state)
  addValidator(validator: OperationValidator): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: deregister an operation validator from the manager (mutates shared state)
  removeValidator(validator: OperationValidator): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: register an operation executor with the manager (mutates shared state)
  addExecutor(executor: OperationExecutor): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: deregister an operation executor from the manager (mutates shared state)
  removeExecutor(executor: OperationExecutor): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: register an operation interceptor with the manager (mutates shared state)
  addInterceptor(interceptor: OperationInterceptor): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: deregister an operation interceptor from the manager (mutates shared state)
  removeInterceptor(interceptor: OperationInterceptor): void;

  // Observables for monitoring
  readonly operationCompleted$: Observable<OperationCompletedEvent>;
  readonly operationFailed$: Observable<{ operation: GraphOperation; error: string }>;
  readonly operationValidated$: Observable<{ operation: GraphOperation; valid: boolean }>;

  // Statistics and monitoring
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch accumulated operation statistics from the operation manager (pure)
  getStats(): OperationStats;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: clear accumulated operation statistics on the operation manager (mutates shared state)
  resetStats(): void;

  // State management
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: check whether a specific operation is currently queued or in-flight (pure)
  isPending(operationId: string): boolean;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: list all currently queued graph operations (pure)
  getPendingOperations(): GraphOperation[];
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: cancel a pending graph operation by ID (mutates shared state)
  cancelOperation(operationId: string): boolean;

  // Cleanup
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: release all graph operation manager resources (mutates shared state)
  dispose(): void;
}
