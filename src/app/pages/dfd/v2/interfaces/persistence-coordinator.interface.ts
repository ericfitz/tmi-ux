/**
 * Interface for the unified persistence coordinator
 */

import { Observable } from 'rxjs';
import { 
  SaveOperation,
  SaveResult,
  LoadOperation,
  LoadResult,
  SyncOperation,
  SyncResult,
  PersistenceStrategy,
  PersistenceConfig,
  PersistenceStats,
  PersistenceEvent,
  CacheStatus,
  SaveStatus,
  CacheEntry,
  PersistenceConflict
} from '../types/persistence.types';

/**
 * Main interface for the persistence coordinator
 * Provides unified persistence across multiple strategies
 */
export interface IPersistenceCoordinator {
  // Core persistence operations
  save(operation: SaveOperation): Observable<SaveResult>;
  load(operation: LoadOperation): Observable<LoadResult>;
  sync(operation: SyncOperation): Observable<SyncResult>;
  
  // Batch operations
  saveBatch(operations: SaveOperation[]): Observable<SaveResult[]>;
  loadBatch(operations: LoadOperation[]): Observable<LoadResult[]>;
  
  // Cache management
  clearCache(diagramId?: string): Observable<void>;
  getCacheStatus(diagramId: string): Observable<CacheStatus>;
  getCacheEntry(diagramId: string): Observable<CacheEntry | null>;
  invalidateCache(diagramId: string): Observable<void>;
  
  // Strategy management
  addStrategy(strategy: PersistenceStrategy): void;
  removeStrategy(strategyType: string): void;
  getStrategies(): PersistenceStrategy[];
  setFallbackStrategy(strategyType: string): void;
  
  // Configuration
  configure(config: Partial<PersistenceConfig>): void;
  getConfiguration(): PersistenceConfig;
  
  // Status observables
  readonly saveStatus$: Observable<SaveStatus>;
  readonly cacheStatus$: Observable<Map<string, CacheStatus>>;
  readonly events$: Observable<PersistenceEvent>;
  readonly conflicts$: Observable<PersistenceConflict>;
  
  // Statistics and monitoring
  getStats(): PersistenceStats;
  resetStats(): void;
  
  // Connection and health
  isOnline(): boolean;
  getHealthStatus(): Observable<PersistenceHealthStatus>;
  
  // Cleanup
  dispose(): void;
}

/**
 * Health status for persistence system
 */
export interface PersistenceHealthStatus {
  readonly overall: 'healthy' | 'degraded' | 'offline';
  readonly strategies: Array<{
    type: string;
    status: 'healthy' | 'degraded' | 'offline';
    lastSuccess?: Date;
    lastError?: string;
  }>;
  readonly cacheHealth: 'healthy' | 'degraded' | 'full';
  readonly pendingOperations: number;
}

/**
 * Factory interface for creating persistence coordinators
 */
export interface IPersistenceCoordinatorFactory {
  create(config?: Partial<PersistenceConfig>): IPersistenceCoordinator;
  createWithStrategies(strategies: PersistenceStrategy[]): IPersistenceCoordinator;
}