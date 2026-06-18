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
  PersistenceConflict,
} from '../types/persistence.types';

/**
 * Main interface for the persistence coordinator
 * Provides unified persistence across multiple strategies
 */
export interface IPersistenceCoordinator {
  // Core persistence operations
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: store a diagram via the configured persistence strategy
  save(operation: SaveOperation): Observable<SaveResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch a diagram from the configured persistence strategy
  load(operation: LoadOperation): Observable<LoadResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: synchronize local and remote diagram state via persistence strategy
  sync(operation: SyncOperation): Observable<SyncResult>;

  // Batch operations
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: store multiple diagrams as a batch via the persistence strategy
  saveBatch(operations: SaveOperation[]): Observable<SaveResult[]>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch multiple diagrams as a batch from the persistence strategy
  loadBatch(operations: LoadOperation[]): Observable<LoadResult[]>;

  // Cache management
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: delete cached diagram data, optionally scoped to one diagram (mutates shared state)
  clearCache(diagramId?: string): Observable<void>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch cache occupancy and staleness status for a diagram (reads DB)
  getCacheStatus(diagramId: string): Observable<CacheStatus>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch a single cached diagram entry or null if absent (reads DB)
  getCacheEntry(diagramId: string): Observable<CacheEntry | null>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: mark a diagram's cache entry stale, forcing next load to re-fetch (mutates shared state)
  invalidateCache(diagramId: string): Observable<void>;

  // Strategy management
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: register a persistence strategy with the coordinator (mutates shared state)
  addStrategy(strategy: PersistenceStrategy): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: delete a registered persistence strategy by type (mutates shared state)
  removeStrategy(strategyType: string): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: list all registered persistence strategies (pure)
  getStrategies(): PersistenceStrategy[];
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: designate a persistence strategy as the fallback when others fail (mutates shared state)
  setFallbackStrategy(strategyType: string): void;

  // Configuration
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: update persistence coordinator configuration at runtime (mutates shared state)
  configure(config: Partial<PersistenceConfig>): void;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return the current persistence coordinator configuration (pure)
  getConfiguration(): PersistenceConfig;

  // Status observables
  readonly saveStatus$: Observable<SaveStatus>;
  readonly cacheStatus$: Observable<Map<string, CacheStatus>>;
  readonly events$: Observable<PersistenceEvent>;
  readonly conflicts$: Observable<PersistenceConflict>;

  // Statistics and monitoring
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return accumulated persistence operation statistics (pure)
  getStats(): PersistenceStats;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: clear accumulated persistence operation statistics (mutates shared state)
  resetStats(): void;

  // Connection and health
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return whether the persistence backend is currently reachable (pure)
  isOnline(): boolean;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch overall and per-strategy persistence health status
  getHealthStatus(): Observable<PersistenceHealthStatus>;

  // Cleanup
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: release all persistence coordinator resources and subscriptions (mutates shared state)
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
