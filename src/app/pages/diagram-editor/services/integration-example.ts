/**
 * This file demonstrates how to integrate the StateManagerService and DiagramElementRegistryService
 * into the existing diagram editor code. It's not meant to be used directly, but rather as a
 * reference for how to refactor the existing code.
 */

import { Injectable } from '@angular/core';
import { Observable, map, take, filter, BehaviorSubject } from '../../../core/rxjs-imports';
import { LoggerService } from '../../../core/services/logger.service';
import { StateManagerService } from './state/state-manager.service';
import { EditorState } from './state/editor-state.enum';
import { DiagramElementRegistryService } from './registry/diagram-element-registry.service';

/**
 * Example service showing how to integrate the state manager and registry
 */
@Injectable({
  providedIn: 'root',
})
export class IntegrationExampleService {
  constructor(
    private logger: LoggerService,
    private stateManager: StateManagerService,
    private registry: DiagramElementRegistryService,
  ) {
    this.logger.info('IntegrationExampleService initialized');
  }

  /**
   * Example of how to initialize the diagram editor using the state manager
   */
  public async initializeEditor(): Promise<void> {
    // Check if we're in the correct state
    if (this.stateManager.getCurrentState() !== EditorState.UNINITIALIZED) {
      this.logger.warn('Cannot initialize editor: Not in UNINITIALIZED state');
      return;
    }

    try {
      // Transition to INITIALIZING state
      this.stateManager.transitionTo(EditorState.INITIALIZING);

      // Perform initialization tasks
      await this.performInitialization();

      // Transition to READY state
      this.stateManager.transitionTo(EditorState.READY);
      this.logger.info('Editor initialized successfully');
    } catch (error) {
      // Transition to ERROR state on failure
      this.stateManager.transitionTo(EditorState.ERROR);
      this.logger.error('Editor initialization failed', error);
      throw error;
    }
  }

  /**
   * Example of how to create a vertex using the state manager and registry
   */
  public createVertex(x: number, y: number, label: string): Promise<string> {
    // Use executeIfAllowed to check if the operation is allowed in the current state
    return new Promise<string>((resolve, reject) => {
      const result = this.stateManager.executeIfAllowed('createVertex', () => {
        try {
          // Simulate creating a vertex in mxGraph
          const cellId = `cell-${Date.now()}`;

          // Simulate creating a component
          const componentId = `component-${Date.now()}`;

          // Register the cell-component pair
          this.registry.register(cellId, componentId, 'vertex');

          this.logger.info(`Created vertex: cell=${cellId}, component=${componentId}`);
          return { cellId, componentId };
        } catch (error) {
          this.logger.error('Error creating vertex', error);
          throw error;
        }
      });

      if (result) {
        resolve(result.cellId);
      } else {
        reject(new Error('Cannot create vertex: Operation not allowed in current state'));
      }
    });
  }

  /**
   * Example of how to delete a cell using the state manager and registry
   */
  public deleteCell(cellId: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Transition to DELETING state
      if (!this.stateManager.transitionTo(EditorState.DELETING)) {
        reject(new Error('Cannot transition to DELETING state'));
        return;
      }

      try {
        // Get component ID from registry
        const componentId = this.registry.getComponentId(cellId);

        if (!componentId) {
          this.logger.warn(`No component found for cell ${cellId}`);
          // Still proceed with deletion
        }

        // Capture all needed information BEFORE deletion
        const deleteInfo = this.capturePreDeleteInfo(cellId);

        // Delete component first (if found)
        if (componentId) {
          // Simulate deleting the component
          this.logger.info(`Deleting component ${componentId}`);
        }

        // Then delete the cell
        this.logger.info(`Deleting cell ${cellId}`);

        // Unregister from registry
        this.registry.unregister(cellId, componentId || '');

        // Transition back to READY state
        this.stateManager.transitionTo(EditorState.READY);

        resolve();
      } catch (error) {
        // Transition to ERROR state on failure
        this.stateManager.transitionTo(EditorState.ERROR);
        this.logger.error(`Error deleting cell ${cellId}`, error);
        reject(error);
      }
    });
  }

  /**
   * Example of how to wait for the editor to be ready
   */
  public waitForEditorReady(): Promise<void> {
    return new Promise<void>(resolve => {
      this.stateManager
        .waitForState(EditorState.READY)
        .pipe(take(1))
        .subscribe(() => {
          this.logger.info('Editor is ready');
          resolve();
        });
    });
  }

  /**
   * Example of how to check if a cell exists using the registry
   */
  public cellExists(cellId: string): boolean {
    return this.registry.hasCellId(cellId);
  }

  /**
   * Example of how to find orphaned references and clean them up
   */
  public cleanupOrphanedReferences(): number {
    return this.registry.cleanupOrphanedReferences();
  }

  /**
   * Example of how to use observables to react to state and registry changes
   */
  public setupChangeListeners(): Observable<{ isReady: boolean; vertexCount: number }> {
    // Create a custom observable that combines state and registry changes
    return new Observable<{ isReady: boolean; vertexCount: number }>(observer => {
      // Track latest values
      let isReady = false;
      let registryEntries: Array<{ type: string }> = [];

      // Subscribe to state changes
      const stateSubscription = this.stateManager.isInState(EditorState.READY).subscribe(ready => {
        isReady = ready;
        emitCombinedValue();
      });

      // Subscribe to registry changes
      const registrySubscription = this.registry.registryChanges$.subscribe(entries => {
        registryEntries = entries;
        emitCombinedValue();
      });

      // Function to emit the combined value
      const emitCombinedValue = () => {
        const vertexCount = registryEntries.filter(entry => entry.type === 'vertex').length;
        observer.next({ isReady, vertexCount });
      };

      // Return cleanup function
      return () => {
        stateSubscription.unsubscribe();
        registrySubscription.unsubscribe();
      };
    });
  }

  /**
   * Example of how to capture pre-delete information
   */
  private capturePreDeleteInfo(cellId: string): any {
    // This would capture all necessary information about the cell before deletion
    // to avoid "Cell does not exist" errors
    return {
      cellId,
      // Add other properties as needed
    };
  }

  /**
   * Example of initialization tasks
   */
  private async performInitialization(): Promise<void> {
    // Simulate initialization tasks
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
