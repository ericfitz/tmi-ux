import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * X6 History Manager Stub
 *
 * This adapter is retained for interface compatibility but X6 history plugin integration
 * has been removed. History is now managed by AppHistoryService.
 *
 * The observables are kept for backward compatibility but will not emit events.
 */
@Injectable()
export class InfraX6HistoryAdapter {
  private readonly _historyChanged$ = new Subject<{ canUndo: boolean; canRedo: boolean }>();
  private readonly _historyModified$ = new Subject<{
    historyIndex: number;
    isUndo: boolean;
    isRedo: boolean;
  }>();

  constructor(private logger: LoggerService) {}

  /**
   * Observable for history state changes (undo/redo availability)
   * @deprecated X6 history plugin integration removed - use AppHistoryService instead
   */
  get historyChanged$(): Observable<{ canUndo: boolean; canRedo: boolean }> {
    return this._historyChanged$.asObservable();
  }

  /**
   * Observable for when history is actually modified (for auto-save)
   * @deprecated X6 history plugin integration removed - use AppHistoryService instead
   */
  get historyModified$(): Observable<{
    historyIndex: number;
    isUndo: boolean;
    isRedo: boolean;
  }> {
    return this._historyModified$.asObservable();
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._historyChanged$.complete();
    this._historyModified$.complete();
  }
}
