/**
 * Types for the unified persistence system
 */

import { Graph } from '@antv/x6';
import { Observable } from 'rxjs';
import { CellOperation } from '../../../core/types/websocket-message.types';

/**
 * Types of persistence strategies
 */
export type PersistenceStrategyType = 'websocket' | 'rest' | 'cache-only' | 'hybrid';

/**
 * Priority levels for save operations
 */
export type SavePriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Context for save operations
 */
export type SaveContext = 'auto-save' | 'manual-save' | 'collaboration' | 'export' | 'backup';

/**
 * Status of save operations
 */
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
  readonly userId?: string;
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

  save(operation: SaveOperation): Observable<SaveResult>;
  load(operation: LoadOperation): Observable<LoadResult>;
  canHandle(operation: SaveOperation | LoadOperation): boolean;
  isAvailable(): boolean;

  // Optional methods for advanced strategies
  sync?(diagramId: string): Observable<SaveResult>;
  clear?(diagramId: string): Observable<void>;
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
 * Default persistence configuration
 */
export const DEFAULT_PERSISTENCE_CONFIG: PersistenceConfig = {
  enableCaching: true,
  cacheExpirationMs: 300000, // 5 minutes
  maxCacheSize: 100, // 100 diagrams
  enableOfflineMode: true,
  autoSyncEnabled: true,
  autoSyncIntervalMs: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  strategies: ['websocket', 'rest', 'cache-only'],
  fallbackStrategy: 'rest',
};

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
 * Interface for persistence event handlers
 */
export interface PersistenceEventHandler {
  handle(event: PersistenceEvent): void;
  canHandle(eventType: PersistenceEventType): boolean;
}

/**
 * Conflict resolution strategies
 */
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
