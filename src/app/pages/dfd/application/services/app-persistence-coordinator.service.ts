/**
 * AppPersistenceCoordinator - Simplified storage management for DFD diagrams
 *
 * Responsibilities:
 * - Always load diagrams from REST API
 * - Save via WebSocket (collaboration) or REST (solo editing)
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { InfraRestPersistenceStrategy } from '../../infrastructure/strategies/infra-rest-persistence.strategy';
import { WebSocketPersistenceStrategy } from '../../infrastructure/strategies/infra-websocket-persistence.strategy';

export interface SaveOperation {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly data: any;
  readonly imageData?: { svg?: string; update_vector?: number };
  readonly metadata?: Record<string, any>;
}

export interface SaveResult {
  readonly success: boolean;
  readonly operationId: string;
  readonly diagramId: string;
  readonly timestamp: number;
  readonly error?: string;
  readonly metadata?: Record<string, any>;
}

export interface LoadOperation {
  readonly diagramId: string;
  readonly threatModelId: string;
}

export interface LoadResult {
  readonly success: boolean;
  readonly diagramId: string;
  readonly data?: any;
  readonly source: 'api';
  readonly timestamp: number;
  readonly error?: string;
}

export interface SaveStatusEvent {
  readonly diagramId: string;
  readonly status: 'saving' | 'saved' | 'error';
  readonly timestamp: number;
  readonly error?: string;
}

@Injectable()
// SEM@b9478a782fe203a4c5d4c0b9c744a0fb140c1b68: coordinate diagram save and load across REST and WebSocket strategies
export class AppPersistenceCoordinator {
  private readonly _saveStatus$ = new Subject<SaveStatusEvent>();
  private readonly _loadStatus$ = new Subject<SaveStatusEvent>();

  // Statistics tracking
  private _stats = {
    totalSaves: 0,
    successfulSaves: 0,
    failedSaves: 0,
    totalLoads: 0,
    successfulLoads: 0,
    failedLoads: 0,
  };

  // SEM@b9478a782fe203a4c5d4c0b9c744a0fb140c1b68: inject persistence adapters and log initialization (mutates shared state)
  constructor(
    private readonly logger: LoggerService,
    private readonly restStrategy: InfraRestPersistenceStrategy,
    private readonly webSocketStrategy: WebSocketPersistenceStrategy,
  ) {
    this.logger.debugComponent(
      'AppPersistenceCoordinator',
      'AppPersistenceCoordinator initialized (simplified)',
    );
  }

  /**
   * Save diagram data
   * Uses WebSocket if in collaboration mode, otherwise REST API
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: store diagram data via WebSocket or REST, emitting save status events (reads DB)
  save(operation: SaveOperation, useWebSocket: boolean): Observable<SaveResult> {
    this.logger.debugComponent('AppPersistenceCoordinator', 'Starting save operation', {
      diagramId: operation.diagramId,
      useWebSocket,
    });

    this._stats.totalSaves++;

    // Emit saving status
    this._saveStatus$.next({
      diagramId: operation.diagramId,
      status: 'saving',
      timestamp: Date.now(),
    });

    const strategy = useWebSocket ? this.webSocketStrategy : this.restStrategy;
    const strategyName = useWebSocket ? 'WebSocket' : 'REST';

    return strategy.save(operation).pipe(
      tap(result => {
        if (result.success) {
          this._stats.successfulSaves++;
          this.logger.debugComponent(
            'AppPersistenceCoordinator',
            `${strategyName} save completed successfully`,
            {
              diagramId: operation.diagramId,
            },
          );

          this._saveStatus$.next({
            diagramId: operation.diagramId,
            status: 'saved',
            timestamp: Date.now(),
          });
        } else {
          this._stats.failedSaves++;
          this.logger.error(`${strategyName} save failed`, {
            diagramId: operation.diagramId,
            error: result.error,
          });

          this._saveStatus$.next({
            diagramId: operation.diagramId,
            status: 'error',
            timestamp: Date.now(),
            error: result.error,
          });
        }
      }),
      catchError(error => {
        this._stats.failedSaves++;
        const errorMessage = error.message || 'Save operation failed';

        this.logger.error(`${strategyName} save failed`, {
          error,
          diagramId: operation.diagramId,
        });

        this._saveStatus$.next({
          diagramId: operation.diagramId,
          status: 'error',
          timestamp: Date.now(),
          error: errorMessage,
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Load diagram data
   * Always loads from REST API (never from cache)
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: fetch diagram data from REST API (reads DB)
  load(operation: LoadOperation): Observable<LoadResult> {
    this.logger.debugComponent('AppPersistenceCoordinator', 'Loading diagram from REST API', {
      diagramId: operation.diagramId,
      threatModelId: operation.threatModelId,
    });

    this._stats.totalLoads++;

    // Always load from REST API first (per requirements)
    return this.restStrategy.load(operation).pipe(
      tap(result => {
        if (result.success) {
          this._stats.successfulLoads++;
          this.logger.debugComponent(
            'AppPersistenceCoordinator',
            'REST load completed successfully',
            {
              diagramId: operation.diagramId,
            },
          );
        } else {
          this._stats.failedLoads++;
        }
      }),
      catchError(error => {
        this._stats.failedLoads++;
        this.logger.error('REST load failed', {
          error,
          diagramId: operation.diagramId,
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Status observables
   */
  get saveStatus$(): Observable<SaveStatusEvent> {
    return this._saveStatus$.asObservable();
  }

  get loadStatus$(): Observable<SaveStatusEvent> {
    return this._loadStatus$.asObservable();
  }

  /**
   * Get statistics
   */
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return a snapshot of save and load operation counters (pure)
  getStats(): any {
    return { ...this._stats };
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: reset all save and load operation counters to zero (mutates shared state)
  resetStats(): void {
    this._stats = {
      totalSaves: 0,
      successfulSaves: 0,
      failedSaves: 0,
      totalLoads: 0,
      successfulLoads: 0,
      failedLoads: 0,
    };
    this.logger.debugComponent('AppPersistenceCoordinator', 'Persistence statistics reset');
  }

  /**
   * Cleanup
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: complete save and load status observables on teardown (mutates shared state)
  dispose(): void {
    this._saveStatus$.complete();
    this._loadStatus$.complete();
    this.logger.debugComponent('AppPersistenceCoordinator', 'AppPersistenceCoordinator disposed');
  }
}
