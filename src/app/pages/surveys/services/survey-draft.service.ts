import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Observable, Subscription, EMPTY } from 'rxjs';
import { debounceTime, switchMap, catchError } from 'rxjs/operators';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveySubmissionService } from './survey-submission.service';
import { SurveySubmission, SurveyUIState } from '@app/types/survey.types';

/**
 * Payload for queued save operations
 */
interface SavePayload {
  submissionId: string;
  data: Record<string, unknown>;
  uiState: SurveyUIState;
}

/**
 * Service for handling auto-save of survey drafts
 * Provides debounced saving to prevent excessive API calls
 */
@Injectable({
  providedIn: 'root',
})
export class SurveyDraftService implements OnDestroy {
  /** Debounce time in milliseconds */
  private readonly autoSaveDebounceMs = 2000;

  /** Subject for queuing save operations */
  private saveSubject$ = new Subject<SavePayload>();

  /** Subscription for auto-save */
  private saveSubscription: Subscription | null = null;

  /** Whether a save operation is in progress */
  private isSavingSubject$ = new BehaviorSubject<boolean>(false);
  public isSaving$: Observable<boolean> = this.isSavingSubject$.asObservable();

  /** Timestamp of last successful save */
  private lastSavedSubject$ = new BehaviorSubject<Date | null>(null);
  public lastSaved$: Observable<Date | null> = this.lastSavedSubject$.asObservable();

  /** Error message from last failed save */
  private saveErrorSubject$ = new BehaviorSubject<string | null>(null);
  public saveError$: Observable<string | null> = this.saveErrorSubject$.asObservable();

  /** Whether there are unsaved changes */
  private hasUnsavedChangesSubject$ = new BehaviorSubject<boolean>(false);
  public hasUnsavedChanges$: Observable<boolean> = this.hasUnsavedChangesSubject$.asObservable();

  constructor(
    private submissionService: SurveySubmissionService,
    private logger: LoggerService,
  ) {
    this.initAutoSave();
  }

  ngOnDestroy(): void {
    this.saveSubscription?.unsubscribe();
    this.saveSubject$.complete();
  }

  /**
   * Queue a save operation (debounced)
   * Multiple calls within the debounce window will only result in one save
   */
  public queueSave(
    submissionId: string,
    data: Record<string, unknown>,
    uiState: SurveyUIState,
  ): void {
    this.hasUnsavedChangesSubject$.next(true);
    this.saveSubject$.next({ submissionId, data, uiState });
  }

  /**
   * Force an immediate save (bypasses debounce)
   * Use this when the user explicitly saves or before navigation
   */
  public saveNow(
    submissionId: string,
    data: Record<string, unknown>,
    uiState: SurveyUIState,
  ): Observable<SurveySubmission> {
    this.isSavingSubject$.next(true);
    this.saveErrorSubject$.next(null);

    return this.submissionService.updateDraft(submissionId, data, uiState).pipe(
      switchMap(submission => {
        this.isSavingSubject$.next(false);
        this.lastSavedSubject$.next(new Date());
        this.hasUnsavedChangesSubject$.next(false);
        this.logger.debug('Draft saved immediately', { submissionId });
        return [submission];
      }),
      catchError(error => {
        this.isSavingSubject$.next(false);
        this.saveErrorSubject$.next('Failed to save draft');
        this.logger.error('Failed to save draft immediately', error);
        throw error;
      }),
    );
  }

  /**
   * Clear the save state (call when starting a new survey or leaving)
   */
  public clearState(): void {
    this.isSavingSubject$.next(false);
    this.lastSavedSubject$.next(null);
    this.saveErrorSubject$.next(null);
    this.hasUnsavedChangesSubject$.next(false);
  }

  /**
   * Get the current saving state
   */
  public get isSaving(): boolean {
    return this.isSavingSubject$.getValue();
  }

  /**
   * Get the last saved timestamp
   */
  public get lastSaved(): Date | null {
    return this.lastSavedSubject$.getValue();
  }

  /**
   * Get the current error state
   */
  public get saveError(): string | null {
    return this.saveErrorSubject$.getValue();
  }

  /**
   * Check if there are unsaved changes
   */
  public get hasUnsavedChanges(): boolean {
    return this.hasUnsavedChangesSubject$.getValue();
  }

  /**
   * Initialize the auto-save subscription
   */
  private initAutoSave(): void {
    this.saveSubscription = this.saveSubject$
      .pipe(
        debounceTime(this.autoSaveDebounceMs),
        switchMap(({ submissionId, data, uiState }) => {
          this.isSavingSubject$.next(true);
          this.saveErrorSubject$.next(null);
          return this.submissionService.updateDraft(submissionId, data, uiState).pipe(
            catchError(error => {
              this.isSavingSubject$.next(false);
              this.saveErrorSubject$.next('Failed to save draft');
              this.logger.error('Auto-save failed', error);
              // Return EMPTY to swallow the error without completing the outer chain.
              // The next queueSave() call will trigger a new save attempt.
              return EMPTY;
            }),
          );
        }),
      )
      .subscribe({
        next: () => {
          this.isSavingSubject$.next(false);
          this.saveErrorSubject$.next(null);
          this.lastSavedSubject$.next(new Date());
          this.hasUnsavedChangesSubject$.next(false);
          this.logger.debug('Draft auto-saved');
        },
        error: error => {
          this.isSavingSubject$.next(false);
          this.saveErrorSubject$.next('Failed to save draft');
          this.logger.error('Auto-save subscription error', error);
        },
      });
  }
}
