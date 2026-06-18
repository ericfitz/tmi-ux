/**
 * Types for the unified persistence system
 */

import { Graph } from '@antv/x6';
import { Observable } from 'rxjs';
import { CellOperation } from '../../../core/types/websocket-message.types';

/**
 * Types of persistence strategies
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate supported diagram persistence strategy types (pure)
export type PersistenceStrategyType = 'websocket' | 'rest' | 'cache-only' | 'hybrid';

/**
 * Priority levels for save operations
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate priority levels for diagram save operations (pure)
export type SavePriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Context for save operations
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate triggering contexts for diagram save operations (pure)
export type SaveContext = 'auto-save' | 'manual-save' | 'collaboration' | 'export' | 'backup';

/**
 * Status of save operations
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate lifecycle states of a diagram save operation (pure)
export type SaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'success'
  | 'error'
  | 'conflict'
  | 'offline';

/**
 * Cache synchronization status
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate synchronization states of the diagram cache (pure)
export type CacheStatus = 'synced' | 'pending' | 'conflict' | 'error' | 'offline';

/**
 * Base interface for save operations
 */
export interface SaveOperation {
  readonly id: string;
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly graph: Graph;
  readonly priority: SavePriority;
  readonly context: SaveContext;
  readonly timestamp: number;
  readonly providerId?: string;
  readonly cellOperations?: CellOperation[];
  readonly imageData?: {
    svg?: string;
    update_vector?: number;
  };
  readonly metadata?: Record<string, unknown>;
}

/**
 * Result of save operations
 */
export interface SaveResult {
  readonly success: boolean;
  readonly operationId: string;
  readonly timestamp: Date;
  readonly strategy: PersistenceStrategyType;
  readonly action: SaveAction;
  readonly error?: string;
  readonly warnings?: string[];
  readonly metadata?: Record<string, unknown>;
}

/**
 * Actions that can result from save operations
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate outcome actions resulting from a diagram save operation (pure)
export type SaveAction =
  | 'saved'
  | 'queued'
  | 'cached'
  | 'retry'
  | 'resync'
  | 'permission_error'
  | 'conflict';

/**
 * Load operation interface
 */
export interface LoadOperation {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly forceRefresh?: boolean;
  readonly includeHistory?: boolean;
}

/**
 * Result of load operations
 */
export interface LoadResult {
  readonly success: boolean;
  readonly diagramData?: any;
  readonly source: 'cache' | 'api' | 'websocket';
  readonly timestamp: Date;
  readonly error?: string;
}

/**
 * Cache entry interface
 */
export interface CacheEntry {
  readonly data: any;
  readonly lastModified: Date;
  readonly status: CacheStatus;
  readonly version: number;
  readonly retryCount: number;
  readonly source: 'local' | 'remote';
}

/**
 * Interface for persistence strategies
 */
export interface PersistenceStrategy {
  readonly type: PersistenceStrategyType;
  readonly priority: number;

  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: store a diagram via this persistence strategy; return save result observable
  save(operation: SaveOperation): Observable<SaveResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch a diagram via this persistence strategy; return load result observable
  load(operation: LoadOperation): Observable<LoadResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate whether this strategy can handle a given save or load operation (pure)
  canHandle(operation: SaveOperation | LoadOperation): boolean;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: validate whether this persistence strategy is currently operational (pure)
  isAvailable(): boolean;

  // Optional methods for advanced strategies
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: synchronize a diagram between local cache and remote persistence strategy
  sync?(diagramId: string): Observable<SaveResult>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: delete all cached data for a diagram from this persistence strategy
  clear?(diagramId: string): Observable<void>;
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: fetch current health and queue status of this persistence strategy
  getStatus?(): Observable<PersistenceStrategyStatus>;
}

/**
 * Status information for persistence strategies
 */
export interface PersistenceStrategyStatus {
  readonly type: PersistenceStrategyType;
  readonly available: boolean;
  readonly connected: boolean;
  readonly lastSuccessTime?: Date;
  readonly lastErrorTime?: Date;
  readonly pendingOperations: number;
  readonly errorRate: number;
}

/**
 * Configuration for persistence coordinator
 */
export interface PersistenceConfig {
  readonly enableCaching: boolean;
  readonly cacheExpirationMs: number;
  readonly maxCacheSize: number;
  readonly enableOfflineMode: boolean;
  readonly autoSyncEnabled: boolean;
  readonly autoSyncIntervalMs: number;
  readonly retryAttempts: number;
  readonly retryDelayMs: number;
  readonly timeoutMs: number;
  readonly strategies: PersistenceStrategyType[];
  readonly fallbackStrategy: PersistenceStrategyType;
}

/**
 * Statistics about persistence operations
 */
export interface PersistenceStats {
  readonly totalSaves: number;
  readonly successfulSaves: number;
  readonly failedSaves: number;
  readonly cacheHitRate: number;
  readonly averageSaveTimeMs: number;
  readonly savesByStrategy: Record<PersistenceStrategyType, number>;
  readonly savesByContext: Record<SaveContext, number>;
  readonly lastResetTime: Date;
}

/**
 * Events emitted by persistence coordinator
 */
export interface PersistenceEvent {
  readonly type: PersistenceEventType;
  readonly timestamp: Date;
  readonly data: any;
}

// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate event types emitted by the persistence coordinator (pure)
export type PersistenceEventType =
  | 'save-started'
  | 'save-completed'
  | 'save-failed'
  | 'load-started'
  | 'load-completed'
  | 'load-failed'
  | 'cache-updated'
  | 'sync-completed'
  | 'strategy-changed'
  | 'offline-mode-changed';

/**
 * Conflict resolution strategies
 */
// SEM@00558ec66867848e260e04954f555ab98f64f0e4: enumerate conflict resolution strategies for diagram save conflicts (pure)
export type ConflictResolutionStrategy =
  | 'server-wins'
  | 'client-wins'
  | 'manual-resolution'
  | 'merge-automatic'
  | 'create-version';

/**
 * Conflict information
 */
export interface PersistenceConflict {
  readonly diagramId: string;
  readonly localVersion: number;
  readonly serverVersion: number;
  readonly conflictTime: Date;
  readonly description: string;
  readonly resolution?: ConflictResolutionStrategy;
}

/**
 * Sync operation interface
 */
export interface SyncOperation {
  readonly diagramId: string;
  readonly threatModelId: string;
  readonly strategy: ConflictResolutionStrategy;
  readonly force?: boolean;
}

/**
 * Result of sync operations
 */
export interface SyncResult {
  readonly success: boolean;
  readonly conflicts: PersistenceConflict[];
  readonly resolutionsApplied: number;
  readonly error?: string;
}
