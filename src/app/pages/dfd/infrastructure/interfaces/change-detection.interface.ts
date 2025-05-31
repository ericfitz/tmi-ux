import { Observable } from 'rxjs';

/**
 * Represents the source of a change in the diagram
 */
export enum ChangeSource {
  USER = 'user',
  REMOTE = 'remote',
  SYSTEM = 'system',
}

/**
 * Represents a detected change in the diagram
 */
export interface DiagramChange {
  id: string;
  type: 'node-added' | 'node-removed' | 'node-moved' | 'edge-added' | 'edge-removed';
  source: ChangeSource;
  timestamp: number;
  data: Record<string, unknown>;
  userId?: string;
}

/**
 * Interface for change detection service that distinguishes between
 * user-initiated changes and remote/system changes for collaboration support.
 */
export interface IChangeDetectionService {
  /**
   * Mark the beginning of a user-initiated change
   */
  markUserChangeStart(): void;

  /**
   * Mark the end of a user-initiated change
   */
  markUserChangeEnd(): void;

  /**
   * Mark the beginning of a remote change (from collaboration)
   */
  markRemoteChangeStart(userId: string): void;

  /**
   * Mark the end of a remote change
   */
  markRemoteChangeEnd(): void;

  /**
   * Mark the beginning of a system change (programmatic)
   */
  markSystemChangeStart(): void;

  /**
   * Mark the end of a system change
   */
  markSystemChangeEnd(): void;

  /**
   * Get the current change source
   */
  getCurrentChangeSource(): ChangeSource;

  /**
   * Get the current user ID for remote changes
   */
  getCurrentUserId(): string | null;

  /**
   * Check if changes are currently being tracked
   */
  isTrackingChanges(): boolean;

  /**
   * Observable for all detected changes
   */
  changes$: Observable<DiagramChange>;

  /**
   * Observable for user-initiated changes only
   */
  userChanges$: Observable<DiagramChange>;

  /**
   * Observable for remote changes only
   */
  remoteChanges$: Observable<DiagramChange>;

  /**
   * Observable for system changes only
   */
  systemChanges$: Observable<DiagramChange>;

  /**
   * Record a change with the current context
   */
  recordChange(type: DiagramChange['type'], data: Record<string, unknown>): void;

  /**
   * Enable or disable change tracking
   */
  setTrackingEnabled(enabled: boolean): void;

  /**
   * Clear all recorded changes
   */
  clearChanges(): void;
}
