/**
 * Diagram Resynchronization Service
 *
 * Handles debounced state correction events and performs full diagram
 * resynchronization by fetching the latest diagram data from the server
 * via REST API and updating the local diagram without triggering
 * outbound WebSocket operations.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, timer, of, throwError } from 'rxjs';
import { debounceTime, switchMap, catchError, tap, takeUntil, finalize } from 'rxjs/operators';
import { Graph } from '@antv/x6';

import { LoggerService } from '../../../../core/services/logger.service';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { AppStateService } from './app-state.service';
import { AppDiagramLoadingService } from './app-diagram-loading.service';
import { InfraX6GraphAdapter } from '../../infrastructure/adapters/infra-x6-graph.adapter';
import { DfdStateStore } from '../../state/dfd.state';

/**
 * Configuration for resynchronization behavior
 */
export interface ResyncConfig {
  debounceMs: number; // How long to wait before triggering resync
  maxRetries: number; // Maximum number of retry attempts
  retryDelayMs: number; // Delay between retry attempts
}

/**
 * Result of a resynchronization operation
 */
export interface ResyncResult {
  success: boolean;
  error?: string;
  cellsUpdated?: number;
  timestamp: number;
}

@Injectable()
export class AppDiagramResyncService implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _resyncTrigger$ = new Subject<void>();
  private _isResyncInProgress = false;
  private _currentDiagramId: string | null = null;
  private _currentThreatModelId: string | null = null;
  private _currentGraph: Graph | null = null;
  private _currentX6GraphAdapter: InfraX6GraphAdapter | null = null;

  private readonly _config: ResyncConfig = {
    debounceMs: 1000, // 1 second debounce
    maxRetries: 3,
    retryDelayMs: 2000, // 2 seconds between retries
  };

  // Events for external observation
  private readonly _resyncStarted$ = new Subject<void>();
  private readonly _resyncCompleted$ = new Subject<ResyncResult>();

  public readonly resyncStarted$ = this._resyncStarted$.asObservable();
  public readonly resyncCompleted$ = this._resyncCompleted$.asObservable();

  constructor(
    private logger: LoggerService,
    private threatModelService: ThreatModelService,
    private appStateService: AppStateService,
    private appDiagramLoadingService: AppDiagramLoadingService,
    private dfdStateStore: DfdStateStore,
  ) {
    this._setupDebouncedResync();
    // this.logger.info('AppDiagramResyncService initialized');
  }

  /**
   * Initialize the service with diagram context
   */
  initialize(
    diagramId: string,
    threatModelId: string,
    graph: Graph,
    infraX6GraphAdapter: InfraX6GraphAdapter,
  ): void {
    this._currentDiagramId = diagramId;
    this._currentThreatModelId = threatModelId;
    this._currentGraph = graph;
    this._currentX6GraphAdapter = infraX6GraphAdapter;

    // this.logger.info('AppDiagramResyncService initialized with context', {
    //   diagramId,
    //   threatModelId,
    // });
  }

  /**
   * Trigger a debounced resynchronization
   * Multiple calls within the debounce window will be collapsed into a single resync
   */
  triggerResync(): void {
    if (
      !this._currentDiagramId ||
      !this._currentThreatModelId ||
      !this._currentGraph ||
      !this._currentX6GraphAdapter
    ) {
      this.logger.warn('Cannot trigger resync - service not properly initialized');
      return;
    }

    this.logger.debug('Resync triggered - will be debounced');
    this._resyncTrigger$.next();
  }

  /**
   * Get current resync configuration
   */
  getConfig(): ResyncConfig {
    return { ...this._config };
  }

  /**
   * Update resync configuration
   */
  updateConfig(config: Partial<ResyncConfig>): void {
    Object.assign(this._config, config);
    this.logger.debug('Resync configuration updated', this._config);
  }

  /**
   * Check if resync is currently in progress
   */
  isResyncInProgress(): boolean {
    return this._isResyncInProgress;
  }

  /**
   * Setup the debounced resync pipeline
   */
  private _setupDebouncedResync(): void {
    this._resyncTrigger$
      .pipe(
        takeUntil(this._destroy$),
        debounceTime(this._config.debounceMs),
        switchMap(() => this._performResyncWithRetries()),
      )
      .subscribe({
        next: result => {
          this.logger.info('Resynchronization completed', result);
          this._resyncCompleted$.next(result);
        },
        error: error => {
          this.logger.error('Resynchronization pipeline error', error);
          this._resyncCompleted$.next({
            success: false,
            error: error.message,
            timestamp: Date.now(),
          });
        },
      });
  }

  /**
   * Perform resynchronization with retry logic
   */
  private _performResyncWithRetries(): Observable<ResyncResult> {
    if (this._isResyncInProgress) {
      this.logger.debug('Resync already in progress, skipping duplicate request');
      return of({
        success: false,
        error: 'Resync already in progress',
        timestamp: Date.now(),
      });
    }

    return this._performResync().pipe(catchError(error => this._retryResync(error, 0)));
  }

  /**
   * Retry resync operation with exponential backoff
   */
  private _retryResync(error: any, attempt: number): Observable<ResyncResult> {
    if (attempt >= this._config.maxRetries) {
      this.logger.error('Resync failed after maximum retries', {
        attempts: attempt,
        error: error.message,
      });
      return of({
        success: false,
        error: `Failed after ${this._config.maxRetries} attempts: ${error.message}`,
        timestamp: Date.now(),
      });
    }

    const delayMs = this._config.retryDelayMs * Math.pow(2, attempt);
    this.logger.warn(`Resync attempt ${attempt + 1} failed, retrying in ${delayMs}ms`, {
      error: error.message,
    });

    return timer(delayMs).pipe(
      switchMap(() => this._performResync()),
      catchError(retryError => this._retryResync(retryError, attempt + 1)),
    );
  }

  /**
   * Perform the actual resynchronization
   */
  private _performResync(): Observable<ResyncResult> {
    if (
      !this._currentDiagramId ||
      !this._currentThreatModelId ||
      !this._currentGraph ||
      !this._currentX6GraphAdapter
    ) {
      return throwError(() => new Error('Resync service not properly initialized'));
    }

    this._isResyncInProgress = true;
    this._resyncStarted$.next();

    this.logger.info('Starting diagram resynchronization', {
      diagramId: this._currentDiagramId,
      threatModelId: this._currentThreatModelId,
    });

    // Fetch the latest diagram data from the server
    return this.threatModelService
      .getDiagramById(this._currentThreatModelId, this._currentDiagramId)
      .pipe(
        switchMap(diagram => {
          if (!diagram) {
            throw new Error(`Diagram ${this._currentDiagramId} not found`);
          }

          this.logger.info('Fetched latest diagram data from server', {
            diagramName: diagram.name,
            cellCount: diagram.cells?.length || 0,
          });

          return this._updateLocalDiagram(diagram);
        }),
        tap(() => {
          // Mark resync as complete in the state service
          this.appStateService.resyncComplete();
        }),
        catchError(error => {
          this.logger.error('Resync operation failed', error);
          throw error;
        }),
        finalize(() => {
          this._isResyncInProgress = false;
        }),
      );
  }

  /**
   * Update the local diagram with fetched data without triggering WebSocket operations
   */
  private _updateLocalDiagram(diagram: any): Observable<ResyncResult> {
    return new Observable<ResyncResult>(observer => {
      try {
        if (!this._currentGraph || !this._currentX6GraphAdapter) {
          throw new Error('Graph reference or adapter not available');
        }

        const graph = this._currentGraph;
        const cells = diagram.cells || [];
        const updateVector = diagram.update_vector;

        this.logger.info('Updating local diagram with server data', {
          cellCount: cells.length,
          diagramName: diagram.name,
          updateVector,
        });

        // Set flag to prevent triggering outbound operations
        this.appStateService.setApplyingRemoteChange(true);

        try {
          // Use the shared diagram loading service with resync-specific options
          this.appDiagramLoadingService.loadCellsIntoGraph(
            cells,
            graph,
            this._currentDiagramId!,
            this._currentX6GraphAdapter,
            {
              clearExisting: true, // Clear existing cells for full resync
              suppressHistory: true, // Don't create history entries
              updateEmbedding: true, // Update embedding appearances
              source: 'resync', // Mark source for logging
            },
          );

          // Update the state store with the server's update vector to prevent resync loops
          if (updateVector !== undefined && updateVector !== null) {
            this.dfdStateStore.updateState({ updateVector }, 'AppDiagramResyncService.resync');
            this.logger.info('Updated local update vector after resync', { updateVector });
          }

          const result: ResyncResult = {
            success: true,
            cellsUpdated: cells.length,
            timestamp: Date.now(),
          };

          this.logger.info('Local diagram updated successfully', result);
          observer.next(result);
          observer.complete();
        } catch (updateError) {
          this.logger.error('Error updating local diagram', updateError);
          observer.error(updateError);
        } finally {
          // Always clear the flag
          this.appStateService.setApplyingRemoteChange(false);
        }
      } catch (error) {
        this.logger.error('Error in updateLocalDiagram', error);
        observer.error(error);
      }
    });
  }

  /**
   * Reset the service state
   */
  reset(): void {
    this._currentDiagramId = null;
    this._currentThreatModelId = null;
    this._currentGraph = null;
    this._currentX6GraphAdapter = null;
    this._isResyncInProgress = false;
    this.logger.debug('AppDiagramResyncService reset');
  }

  /**
   * Cleanup
   */
  ngOnDestroy(): void {
    this.logger.info('Destroying AppDiagramResyncService');
    this._destroy$.next();
    this._destroy$.complete();
  }
}
