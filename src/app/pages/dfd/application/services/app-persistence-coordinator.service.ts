/**
 * AppPersistenceCoordinator - Simplified storage management for DFD diagrams
 *
 * Responsibilities:
 * - Always load diagrams from REST API
 * - Save via WebSocket (collaboration) or REST (solo editing)
 * - Fallback to LocalStorage for local provider offline mode
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, throwError } from 'rxjs';
import { catchError, tap, map } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { InfraLocalStorageAdapter } from '../../infrastructure/adapters/infra-local-storage.adapter';
import { InfraRestPersistenceStrategy } from '../../infrastructure/strategies/infra-rest-persistence.strategy';
import { WebSocketPersistenceStrategy } from '../../infrastructure/strategies/infra-websocket-persistence.strategy';

export interface SaveOperation {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly data: any;
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
  readonly source: 'api' | 'local-storage';
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

  constructor(
    private readonly logger: LoggerService,
    private readonly localStorageAdapter: InfraLocalStorageAdapter,
    private readonly restStrategy: InfraRestPersistenceStrategy,
    private readonly webSocketStrategy: WebSocketPersistenceStrategy,
  ) {
    // this.logger.debug('AppPersistenceCoordinator initialized (simplified)');
  }

  /**
   * Save diagram data
   * Uses WebSocket if in collaboration mode, otherwise REST API
   * Falls back to localStorage if both fail and local provider is detected
   */
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
   * Save to localStorage (for local provider offline mode)
   */
  saveToLocalStorage(diagramId: string, threatModelId: string, data: any): Observable<SaveResult> {
    this.logger.debugComponent('AppPersistenceCoordinator', 'Saving to localStorage', {
      diagramId,
    });

    return this.localStorageAdapter.saveDiagram(diagramId, threatModelId, data).pipe(
      map(success => ({
        success,
        operationId: `local-save-${Date.now()}`,
        diagramId,
        timestamp: Date.now(),
        metadata: { source: 'local-storage' },
      })),
      tap(result => {
        if (result.success) {
          this._stats.successfulSaves++;
        } else {
          this._stats.failedSaves++;
        }
      }),
    );
  }

  /**
   * Load diagram data
   * Always loads from REST API (never from cache)
   * Falls back to localStorage only if REST fails and local provider detected
   */
  load(operation: LoadOperation, allowLocalStorageFallback = false): Observable<LoadResult> {
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

        // Try localStorage fallback only if explicitly allowed (local provider offline mode)
        if (allowLocalStorageFallback) {
          this.logger.info('Attempting localStorage fallback', {
            diagramId: operation.diagramId,
          });

          return this.localStorageAdapter.loadDiagram(operation.diagramId).pipe(
            map(localData => {
              if (localData) {
                this.logger.debugComponent(
                  'AppPersistenceCoordinator',
                  'Loaded from localStorage fallback',
                  {
                    diagramId: operation.diagramId,
                  },
                );
                return {
                  success: true,
                  diagramId: operation.diagramId,
                  data: localData.data,
                  source: 'local-storage' as const,
                  timestamp: Date.now(),
                };
              } else {
                return {
                  success: false,
                  diagramId: operation.diagramId,
                  source: 'local-storage' as const,
                  timestamp: Date.now(),
                  error: 'No data found in localStorage',
                };
              }
            }),
            catchError(localError => {
              this.logger.error('localStorage fallback also failed', {
                error: localError,
                diagramId: operation.diagramId,
              });
              return throwError(() => error); // Return original REST error
            }),
          );
        }

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
  getStats(): any {
    return { ...this._stats };
  }

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
  dispose(): void {
    this._saveStatus$.complete();
    this._loadStatus$.complete();
    this.logger.debugComponent('AppPersistenceCoordinator', 'AppPersistenceCoordinator disposed');
  }
}
