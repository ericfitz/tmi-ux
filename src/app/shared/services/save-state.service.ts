import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Represents the save state of a form or field
 */
export interface SaveState {
  status: 'clean' | 'dirty' | 'saving' | 'saved' | 'error';
  lastSaved?: Date;
  errorMessage?: string;
  hasUnsavedChanges: boolean;
  changedFields: Set<string>;
  originalValues: Map<string, any>;
}

/**
 * Represents the connection state to the server
 */
export interface ConnectionState {
  isOnline: boolean;
  lastDisconnectTime?: Date;
  hasShownOfflineToast: boolean;
}

/**
 * Service for managing save state across forms and components
 * Provides centralized state management for save operations, change detection,
 * and coordination with server connectivity
 */
@Injectable({
  providedIn: 'root'
})
export class SaveStateService {
  // Map of form/component IDs to their save states
  private _saveStates = new Map<string, BehaviorSubject<SaveState>>();
  
  // Global connection state
  private _connectionState = new BehaviorSubject<ConnectionState>({
    isOnline: navigator.onLine,
    hasShownOfflineToast: false
  });

  constructor() {
    // Listen for browser online/offline events
    window.addEventListener('online', () => this.updateConnectionState(true));
    window.addEventListener('offline', () => this.updateConnectionState(false));
  }

  /**
   * Initialize save state for a form or component
   * @param formId Unique identifier for the form/component
   * @param initialValues Initial field values
   * @returns Observable of save state
   */
  initializeSaveState(formId: string, initialValues: Record<string, any> = {}): Observable<SaveState> {
    const initialState: SaveState = {
      status: 'clean',
      hasUnsavedChanges: false,
      changedFields: new Set<string>(),
      originalValues: new Map<string, any>(Object.entries(initialValues))
    };

    const subject = new BehaviorSubject<SaveState>(initialState);
    this._saveStates.set(formId, subject);
    
    return subject.asObservable();
  }

  /**
   * Get save state observable for a form
   * @param formId Unique identifier for the form/component
   * @returns Observable of save state or undefined if not initialized
   */
  getSaveState(formId: string): Observable<SaveState> | undefined {
    return this._saveStates.get(formId)?.asObservable();
  }

  /**
   * Get current save state snapshot
   * @param formId Unique identifier for the form/component
   * @returns Current save state or undefined if not initialized
   */
  getCurrentSaveState(formId: string): SaveState | undefined {
    return this._saveStates.get(formId)?.value;
  }

  /**
   * Update save state status
   * @param formId Unique identifier for the form/component
   * @param status New save status
   * @param errorMessage Optional error message for error status
   */
  updateSaveStatus(formId: string, status: SaveState['status'], errorMessage?: string): void {
    const subject = this._saveStates.get(formId);
    if (!subject) return;

    const currentState = subject.value;
    const newState: SaveState = {
      ...currentState,
      status,
      errorMessage: status === 'error' ? errorMessage : undefined,
      lastSaved: status === 'saved' ? new Date() : currentState.lastSaved,
      hasUnsavedChanges: status === 'dirty' || (status === 'error' && currentState.hasUnsavedChanges)
    };

    subject.next(newState);
  }

  /**
   * Mark a field as changed and update save state
   * @param formId Unique identifier for the form/component
   * @param fieldName Name of the changed field
   * @param newValue New field value
   * @returns true if the value actually changed, false otherwise
   */
  markFieldChanged(formId: string, fieldName: string, newValue: any): boolean {
    const subject = this._saveStates.get(formId);
    if (!subject) return false;

    const currentState = subject.value;
    const originalValue = currentState.originalValues.get(fieldName);
    
    // Use deep equality check for objects and arrays
    const hasChanged = !this.valuesEqual(newValue, originalValue);
    
    if (!hasChanged) {
      // Value reverted to original - remove from changed fields
      const newChangedFields = new Set(currentState.changedFields);
      newChangedFields.delete(fieldName);
      
      const newState: SaveState = {
        ...currentState,
        changedFields: newChangedFields,
        hasUnsavedChanges: newChangedFields.size > 0,
        status: newChangedFields.size > 0 ? 'dirty' : 'clean'
      };
      
      subject.next(newState);
      return false;
    }

    // Value changed - add to changed fields
    const newChangedFields = new Set(currentState.changedFields);
    newChangedFields.add(fieldName);
    
    const newState: SaveState = {
      ...currentState,
      changedFields: newChangedFields,
      hasUnsavedChanges: true,
      status: 'dirty'
    };
    
    subject.next(newState);
    return true;
  }

  /**
   * Update original values after successful save
   * @param formId Unique identifier for the form/component
   * @param savedValues Values that were successfully saved
   */
  updateOriginalValues(formId: string, savedValues: Record<string, any>): void {
    const subject = this._saveStates.get(formId);
    if (!subject) return;

    const currentState = subject.value;
    const newOriginalValues = new Map(currentState.originalValues);
    
    // Update original values for saved fields
    Object.entries(savedValues).forEach(([key, value]) => {
      newOriginalValues.set(key, value);
    });

    // Remove saved fields from changed fields
    const newChangedFields = new Set(currentState.changedFields);
    Object.keys(savedValues).forEach(key => {
      newChangedFields.delete(key);
    });

    const newState: SaveState = {
      ...currentState,
      originalValues: newOriginalValues,
      changedFields: newChangedFields,
      hasUnsavedChanges: newChangedFields.size > 0,
      status: newChangedFields.size > 0 ? 'dirty' : 'saved'
    };

    subject.next(newState);
  }

  /**
   * Get fields that have changed from their original values
   * @param formId Unique identifier for the form/component
   * @returns Set of changed field names
   */
  getChangedFields(formId: string): Set<string> {
    const state = this.getCurrentSaveState(formId);
    return state ? new Set(state.changedFields) : new Set();
  }

  /**
   * Check if a specific field has changed
   * @param formId Unique identifier for the form/component
   * @param fieldName Name of the field to check
   * @returns true if field has changed, false otherwise
   */
  hasFieldChanged(formId: string, fieldName: string): boolean {
    const state = this.getCurrentSaveState(formId);
    return state ? state.changedFields.has(fieldName) : false;
  }

  /**
   * Reset save state (e.g., after navigation or form reset)
   * @param formId Unique identifier for the form/component
   */
  resetSaveState(formId: string): void {
    const subject = this._saveStates.get(formId);
    if (!subject) return;

    const currentState = subject.value;
    const newState: SaveState = {
      ...currentState,
      status: 'clean',
      hasUnsavedChanges: false,
      changedFields: new Set<string>(),
      errorMessage: undefined
    };

    subject.next(newState);
  }

  /**
   * Cleanup save state (call on component destroy)
   * @param formId Unique identifier for the form/component
   */
  destroySaveState(formId: string): void {
    const subject = this._saveStates.get(formId);
    if (subject) {
      subject.complete();
      this._saveStates.delete(formId);
    }
  }

  /**
   * Get connection state observable
   * @returns Observable of connection state
   */
  getConnectionState(): Observable<ConnectionState> {
    return this._connectionState.asObservable();
  }

  /**
   * Update connection state
   * @param isOnline Whether the connection is online
   */
  private updateConnectionState(isOnline: boolean): void {
    const currentState = this._connectionState.value;
    
    const newState: ConnectionState = {
      isOnline,
      lastDisconnectTime: !isOnline ? new Date() : currentState.lastDisconnectTime,
      hasShownOfflineToast: isOnline ? false : currentState.hasShownOfflineToast // Reset when back online
    };

    this._connectionState.next(newState);
  }

  /**
   * Mark that offline toast has been shown to prevent spam
   */
  markOfflineToastShown(): void {
    const currentState = this._connectionState.value;
    this._connectionState.next({
      ...currentState,
      hasShownOfflineToast: true
    });
  }

  /**
   * Deep equality check for values
   * @param a First value
   * @param b Second value
   * @returns true if values are equal, false otherwise
   */
  private valuesEqual(a: any, b: any): boolean {
    // Handle null/undefined cases
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    
    // Handle primitive types
    if (typeof a !== 'object' || typeof b !== 'object') {
      return a === b;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.valuesEqual(item, b[index]));
    }

    // Handle objects
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    return keysA.every(key => 
      keysB.includes(key) && this.valuesEqual(a[key], b[key])
    );
  }
}