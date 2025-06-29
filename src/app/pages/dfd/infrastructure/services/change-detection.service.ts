import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

import {
  IChangeDetectionService,
  ChangeSource,
  DiagramChange,
} from '../interfaces/change-detection.interface';

/**
 * Service that tracks and categorizes changes in the diagram to distinguish
 * between user-initiated, remote, and system changes for collaboration support.
 */
@Injectable({
  providedIn: 'root',
})
export class ChangeDetectionService implements IChangeDetectionService {
  private _currentSource: ChangeSource = ChangeSource.SYSTEM;
  private _currentUserId: string | null = null;
  private _isTracking = true;
  private _changeCounter = 0;

  private readonly _changes$ = new Subject<DiagramChange>();

  /**
   * Mark the beginning of a user-initiated change
   */
  markUserChangeStart(): void {
    this._currentSource = ChangeSource.USER;
    this._currentUserId = null;
  }

  /**
   * Mark the end of a user-initiated change
   */
  markUserChangeEnd(): void {
    this._currentSource = ChangeSource.SYSTEM;
    this._currentUserId = null;
  }

  /**
   * Mark the beginning of a remote change (from collaboration)
   */
  markRemoteChangeStart(userId: string): void {
    this._currentSource = ChangeSource.REMOTE;
    this._currentUserId = userId;
  }

  /**
   * Mark the end of a remote change
   */
  markRemoteChangeEnd(): void {
    this._currentSource = ChangeSource.SYSTEM;
    this._currentUserId = null;
  }

  /**
   * Mark the beginning of a system change (programmatic)
   */
  markSystemChangeStart(): void {
    this._currentSource = ChangeSource.SYSTEM;
    this._currentUserId = null;
  }

  /**
   * Mark the end of a system change
   */
  markSystemChangeEnd(): void {
    this._currentSource = ChangeSource.SYSTEM;
    this._currentUserId = null;
  }

  /**
   * Get the current change source
   */
  getCurrentChangeSource(): ChangeSource {
    return this._currentSource;
  }

  /**
   * Get the current user ID for remote changes
   */
  getCurrentUserId(): string | null {
    return this._currentUserId;
  }

  /**
   * Check if changes are currently being tracked
   */
  isTrackingChanges(): boolean {
    return this._isTracking;
  }

  /**
   * Observable for all detected changes
   */
  get changes$(): Observable<DiagramChange> {
    return this._changes$.asObservable();
  }

  /**
   * Observable for user-initiated changes only
   */
  get userChanges$(): Observable<DiagramChange> {
    return this._changes$.pipe(filter(change => change.source === ChangeSource.USER));
  }

  /**
   * Observable for remote changes only
   */
  get remoteChanges$(): Observable<DiagramChange> {
    return this._changes$.pipe(filter(change => change.source === ChangeSource.REMOTE));
  }

  /**
   * Observable for system changes only
   */
  get systemChanges$(): Observable<DiagramChange> {
    return this._changes$.pipe(filter(change => change.source === ChangeSource.SYSTEM));
  }

  /**
   * Record a change with the current context
   */
  recordChange(type: DiagramChange['type'], data: Record<string, unknown>): void {
    if (!this._isTracking) {
      return;
    }

    const change: DiagramChange = {
      id: this._generateChangeId(),
      type,
      source: this._currentSource,
      timestamp: Date.now(),
      data,
      userId: this._currentUserId || undefined,
    };

    this._changes$.next(change);
  }

  /**
   * Enable or disable change tracking
   */
  setTrackingEnabled(enabled: boolean): void {
    this._isTracking = enabled;
  }

  /**
   * Clear all recorded changes
   */
  clearChanges(): void {
    // Note: This doesn't clear the observable history, just resets internal state
    this._changeCounter = 0;
  }

  /**
   * Generate a unique change ID
   */
  private _generateChangeId(): string {
    this._changeCounter++;
    return `change_${Date.now()}_${this._changeCounter}`;
  }
}
