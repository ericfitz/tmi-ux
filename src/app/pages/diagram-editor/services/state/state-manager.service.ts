import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, filter, map } from '../../../../core/rxjs-imports';
import { LoggerService } from '../../../../core/services/logger.service';
import { EditorState, VALID_TRANSITIONS, ALLOWED_OPERATIONS } from './editor-state.enum';

/**
 * Service for managing the state of the diagram editor
 * Implements the State Machine pattern to control valid state transitions
 * and allowed operations in each state
 */
@Injectable({
  providedIn: 'root',
})
export class StateManagerService {
  // Current state as a BehaviorSubject
  private _state$ = new BehaviorSubject<EditorState>(EditorState.UNINITIALIZED);

  // Observable for the current state
  public state$ = this._state$.asObservable();

  // Track state transition history for debugging
  private _stateHistory: { state: EditorState; timestamp: number }[] = [
    { state: EditorState.UNINITIALIZED, timestamp: Date.now() },
  ];

  constructor(private logger: LoggerService) {
    this.logger.info('StateManagerService initialized');

    // Log state changes
    this.state$.subscribe((state: EditorState) => {
      this.logger.info(`Editor state changed to: ${state}`);
    });
  }

  /**
   * Get the current state
   */
  public getCurrentState(): EditorState {
    return this._state$.getValue();
  }

  /**
   * Check if a specific operation is allowed in the current state
   * @param operation The operation to check
   * @returns True if the operation is allowed, false otherwise
   */
  public isOperationAllowed(operation: string): boolean {
    const currentState = this.getCurrentState();
    const allowedOps = ALLOWED_OPERATIONS[currentState] || [];
    return allowedOps.includes(operation);
  }

  /**
   * Transition to a new state if the transition is valid
   * @param newState The state to transition to
   * @returns True if the transition was successful, false otherwise
   */
  public transitionTo(newState: EditorState): boolean {
    const currentState = this.getCurrentState();

    // Check if the transition is valid
    const isValidTransition = VALID_TRANSITIONS.some(
      transition => transition.from === currentState && transition.to === newState,
    );

    if (!isValidTransition) {
      this.logger.warn(
        `Invalid state transition: ${currentState} -> ${newState}. ` +
          `This transition is not allowed.`,
      );
      return false;
    }

    // Perform the transition
    this._state$.next(newState);

    // Record in history
    this._stateHistory.push({ state: newState, timestamp: Date.now() });

    return true;
  }

  /**
   * Wait for a specific state to be reached
   * @param state The state to wait for
   * @returns An Observable that emits when the state is reached
   */
  public waitForState(state: EditorState): Observable<EditorState> {
    return this.state$.pipe(filter((currentState: EditorState) => currentState === state));
  }

  /**
   * Check if the editor is in a specific state
   * @param state The state to check
   * @returns An Observable that emits true if the editor is in the specified state
   */
  public isInState(state: EditorState): Observable<boolean> {
    return this.state$.pipe(map((currentState: EditorState) => currentState === state));
  }

  /**
   * Check if the editor is initialized
   * @returns An Observable that emits true if the editor is initialized
   */
  public isInitialized(): Observable<boolean> {
    return this.state$.pipe(map((state: EditorState) => state === EditorState.READY));
  }

  /**
   * Get the state history for debugging
   * @returns The state transition history
   */
  public getStateHistory(): { state: EditorState; timestamp: number }[] {
    return [...this._stateHistory];
  }

  /**
   * Reset the state machine to its initial state
   * This should only be used for testing or in extreme error cases
   */
  public reset(): void {
    this.logger.warn('Resetting state machine to UNINITIALIZED state');
    this._state$.next(EditorState.UNINITIALIZED);
    this._stateHistory = [{ state: EditorState.UNINITIALIZED, timestamp: Date.now() }];
  }

  /**
   * Execute an operation if it's allowed in the current state
   * @param operation The operation name
   * @param callback The function to execute
   * @returns The result of the callback if the operation is allowed, undefined otherwise
   */
  public executeIfAllowed<T>(operation: string, callback: () => T): T | undefined {
    if (this.isOperationAllowed(operation)) {
      return callback();
    } else {
      const currentState = this.getCurrentState();
      this.logger.warn(
        `Operation "${operation}" is not allowed in state "${currentState}". ` +
          `Allowed operations are: ${ALLOWED_OPERATIONS[currentState].join(', ')}`,
      );
      return undefined;
    }
  }
}
