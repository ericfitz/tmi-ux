import { Graph, Node, Cell } from '@antv/x6';
import { History } from '@antv/x6-plugin-history';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Interface representing the overall state of the DFD component
 */
export interface DfdState {
  isInitialized: boolean;
  graph: Graph | null;
  selectedNode: Node | null;
  canUndo: boolean;
  canRedo: boolean;
  cells: Cell[];
  isLoading: boolean;
  isEditingLabel: boolean;
  error: Error | null;
}

/**
 * Initial state for the DFD component
 */
export const initialDfdState: DfdState = {
  isInitialized: false,
  graph: null,
  selectedNode: null,
  canUndo: false,
  canRedo: false,
  cells: [],
  isLoading: false,
  isEditingLabel: false,
  error: null,
};

/**
 * Type for state updates - allows partial updates
 */
export type DfdStateUpdate = Partial<DfdState>;

/**
 * Central state store for the DFD component
 * Uses the Observable Store pattern with RxJS BehaviorSubjects
 */
@Injectable({
  providedIn: 'root',
})
export class DfdStateStore {
  // Public readonly observables
  readonly state$: Observable<DfdState>;
  readonly isInitialized$ = new BehaviorSubject<boolean>(false);
  readonly selectedNode$ = new BehaviorSubject<Node | null>(null);
  readonly canUndo$ = new BehaviorSubject<boolean>(false);
  readonly canRedo$ = new BehaviorSubject<boolean>(false);
  readonly cells$ = new BehaviorSubject<Cell[]>([]);
  readonly isLoading$ = new BehaviorSubject<boolean>(false);
  readonly isEditingLabel$ = new BehaviorSubject<boolean>(false);
  readonly error$ = new BehaviorSubject<Error | null>(null);

  // Private BehaviorSubject holding the current state
  private _state = new BehaviorSubject<DfdState>(initialDfdState);

  constructor(private logger: LoggerService) {
    this.logger.info('DfdStateStore initialized');

    // Initialize state$ observable
    this.state$ = this._state.asObservable();

    // Subscribe to main state changes to update individual streams
    this._state.subscribe(state => {
      this.isInitialized$.next(state.isInitialized);
      this.selectedNode$.next(state.selectedNode);
      this.canUndo$.next(state.canUndo);
      this.canRedo$.next(state.canRedo);
      this.cells$.next(state.cells);
      this.isLoading$.next(state.isLoading);
      this.isEditingLabel$.next(state.isEditingLabel);
      this.error$.next(state.error);
    });
  }

  // Public Getters
  get state(): DfdState {
    return this._state.value;
  }

  get isInitialized(): boolean {
    return this._state.value.isInitialized;
  }

  get graph(): Graph | null {
    return this._state.value.graph;
  }

  get selectedNode(): Node | null {
    return this._state.value.selectedNode;
  }

  get canUndo(): boolean {
    return this._state.value.canUndo;
  }

  get canRedo(): boolean {
    return this._state.value.canRedo;
  }

  // Public Methods
  /**
   * Update the state with a partial state object
   * @param update Partial state to merge with current state
   * @param source Optional source identifier for logging
   */
  updateState(update: DfdStateUpdate, source?: string): void {
    const currentState = this._state.value;
    const newState = { ...currentState, ...update };

    this._state.next(newState);

    if (source) {
      this.logger.debug(`State updated from ${source}`, {
        update,
        currentState: this.getLogSafeState(currentState),
        newState: this.getLogSafeState(newState),
      });
    }
  }

  /**
   * Reset the state to initial values
   */
  resetState(): void {
    this._state.next({ ...initialDfdState });
    this.logger.info('DfdStateStore reset to initial state');
  }

  /**
   * Get the history plugin from the graph
   */
  getHistory(): History | null {
    const { graph } = this._state.value;
    return graph ? (graph.getPlugin<History>('history') ?? null) : null;
  }

  /**
   * Query specific state property as an observable
   * @param selector Function that selects a portion of the state
   * @returns Observable of the queried state portion
   */
  query<T>(selector: (state: DfdState) => T): Observable<T> {
    return new Observable<T>(observer => {
      const subscription = this._state.subscribe(state => {
        try {
          const selectedValue = selector(state);
          observer.next(selectedValue);
        } catch (error) {
          observer.error(error);
        }
      });
      return () => subscription.unsubscribe();
    });
  }

  // Private methods
  /**
   * Get a version of the state that's safe for logging
   * Removes circular references and large objects
   */
  private getLogSafeState(state: DfdState): Record<string, unknown> {
    const { graph, selectedNode, cells, ...rest } = state;
    return {
      ...rest,
      hasGraph: !!graph,
      selectedNodeId: selectedNode?.id || null,
      cellCount: cells.length,
    };
  }
}
