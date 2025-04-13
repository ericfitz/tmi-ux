import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, map } from '../../../../core/rxjs-imports';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Interface for registry entries
 */
export interface RegistryEntry {
  cellId: string;
  componentId: string;
  type: 'vertex' | 'edge';
  createdAt: number;
  lastUpdated: number;
}

/**
 * Service for managing the registry of diagram elements
 * Implements the Registry pattern to maintain relationships between cells and components
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramElementRegistryService {
  // Maps for quick lookups
  private _cellToComponent = new Map<string, string>();
  private _componentToCell = new Map<string, string>();

  // Detailed registry with additional metadata
  private _registry = new Map<string, RegistryEntry>();

  // Observable for registry changes
  private _registryChanges$ = new BehaviorSubject<RegistryEntry[]>([]);
  public registryChanges$ = this._registryChanges$.asObservable();

  // Statistics
  private _stats = {
    totalRegistrations: 0,
    totalUnregistrations: 0,
    orphanedCells: 0,
    orphanedComponents: 0,
  };

  constructor(private logger: LoggerService) {
    this.logger.info('DiagramElementRegistryService initialized');
  }

  /**
   * Register a cell-component pair
   * @param cellId The cell ID
   * @param componentId The component ID
   * @param type The element type (vertex or edge)
   * @returns True if registration was successful
   */
  public register(cellId: string, componentId: string, type: 'vertex' | 'edge'): boolean {
    if (!cellId || !componentId) {
      this.logger.warn('Cannot register: cellId or componentId is empty');
      return false;
    }

    const now = Date.now();

    // Check if either ID is already registered
    const existingComponentId = this._cellToComponent.get(cellId);
    const existingCellId = this._componentToCell.get(componentId);

    if (existingComponentId && existingComponentId !== componentId) {
      this.logger.warn(
        `Cell ${cellId} is already registered with component ${existingComponentId}. ` +
          `Updating to ${componentId}.`,
      );
      // Unregister the old mapping
      this._componentToCell.delete(existingComponentId);
      this._stats.orphanedComponents++;
    }

    if (existingCellId && existingCellId !== cellId) {
      this.logger.warn(
        `Component ${componentId} is already registered with cell ${existingCellId}. ` +
          `Updating to ${cellId}.`,
      );
      // Unregister the old mapping
      this._cellToComponent.delete(existingCellId);
      this._stats.orphanedCells++;
    }

    // Update the maps
    this._cellToComponent.set(cellId, componentId);
    this._componentToCell.set(componentId, cellId);

    // Create or update registry entry
    const entry: RegistryEntry = {
      cellId,
      componentId,
      type,
      createdAt: this._registry.has(cellId) ? this._registry.get(cellId)!.createdAt : now,
      lastUpdated: now,
    };

    this._registry.set(cellId, entry);

    // Update statistics
    this._stats.totalRegistrations++;

    // Notify observers
    this._notifyChanges();

    this.logger.debug(`Registered ${type}: cell=${cellId}, component=${componentId}`);
    return true;
  }

  /**
   * Unregister a cell-component pair
   * @param cellId The cell ID
   * @param componentId The component ID
   * @returns True if unregistration was successful
   */
  public unregister(cellId: string, componentId: string): boolean {
    if (!cellId && !componentId) {
      this.logger.warn('Cannot unregister: both cellId and componentId are empty');
      return false;
    }

    let success = false;

    // If only one ID is provided, look up the other
    if (cellId && !componentId) {
      componentId = this._cellToComponent.get(cellId) || '';
    } else if (!cellId && componentId) {
      cellId = this._componentToCell.get(componentId) || '';
    }

    // Remove from maps
    if (cellId) {
      success = this._cellToComponent.delete(cellId) || success;
      this._registry.delete(cellId);
    }

    if (componentId) {
      success = this._componentToCell.delete(componentId) || success;
    }

    if (success) {
      // Update statistics
      this._stats.totalUnregistrations++;

      // Notify observers
      this._notifyChanges();

      this.logger.debug(`Unregistered: cell=${cellId}, component=${componentId}`);
    } else {
      this.logger.warn(`Failed to unregister: cell=${cellId}, component=${componentId}`);
    }

    return success;
  }

  /**
   * Get the component ID for a cell
   * @param cellId The cell ID
   * @returns The component ID or undefined if not found
   */
  public getComponentId(cellId: string): string | undefined {
    return this._cellToComponent.get(cellId);
  }

  /**
   * Get the cell ID for a component
   * @param componentId The component ID
   * @returns The cell ID or undefined if not found
   */
  public getCellId(componentId: string): string | undefined {
    return this._componentToCell.get(componentId);
  }

  /**
   * Get a registry entry by cell ID
   * @param cellId The cell ID
   * @returns The registry entry or undefined if not found
   */
  public getEntryByCellId(cellId: string): RegistryEntry | undefined {
    return this._registry.get(cellId);
  }

  /**
   * Get a registry entry by component ID
   * @param componentId The component ID
   * @returns The registry entry or undefined if not found
   */
  public getEntryByComponentId(componentId: string): RegistryEntry | undefined {
    const cellId = this._componentToCell.get(componentId);
    if (!cellId) return undefined;
    return this._registry.get(cellId);
  }

  /**
   * Check if a cell ID is registered
   * @param cellId The cell ID
   * @returns True if the cell ID is registered
   */
  public hasCellId(cellId: string): boolean {
    return this._cellToComponent.has(cellId);
  }

  /**
   * Check if a component ID is registered
   * @param componentId The component ID
   * @returns True if the component ID is registered
   */
  public hasComponentId(componentId: string): boolean {
    return this._componentToCell.has(componentId);
  }

  /**
   * Get all registry entries
   * @returns An array of all registry entries
   */
  public getAllEntries(): RegistryEntry[] {
    return Array.from(this._registry.values());
  }

  /**
   * Get all registry entries of a specific type
   * @param type The element type (vertex or edge)
   * @returns An array of registry entries of the specified type
   */
  public getEntriesByType(type: 'vertex' | 'edge'): RegistryEntry[] {
    return Array.from(this._registry.values()).filter(entry => entry.type === type);
  }

  /**
   * Get all cell IDs
   * @returns An array of all registered cell IDs
   */
  public getAllCellIds(): string[] {
    return Array.from(this._cellToComponent.keys());
  }

  /**
   * Get all component IDs
   * @returns An array of all registered component IDs
   */
  public getAllComponentIds(): string[] {
    return Array.from(this._componentToCell.keys());
  }

  /**
   * Check for orphaned references
   * @returns An object with arrays of orphaned cell and component IDs
   */
  public checkForOrphanedReferences(): { orphanedCells: string[]; orphanedComponents: string[] } {
    const orphanedCells: string[] = [];
    const orphanedComponents: string[] = [];

    // Check for cells that don't have a corresponding component
    for (const [cellId, componentId] of this._cellToComponent.entries()) {
      if (!this._componentToCell.has(componentId)) {
        orphanedCells.push(cellId);
      }
    }

    // Check for components that don't have a corresponding cell
    for (const [componentId, cellId] of this._componentToCell.entries()) {
      if (!this._cellToComponent.has(cellId)) {
        orphanedComponents.push(componentId);
      }
    }

    return { orphanedCells, orphanedComponents };
  }

  /**
   * Clean up orphaned references
   * @returns The number of references cleaned up
   */
  public cleanupOrphanedReferences(): number {
    const { orphanedCells, orphanedComponents } = this.checkForOrphanedReferences();
    let count = 0;

    // Remove orphaned cells
    for (const cellId of orphanedCells) {
      this._cellToComponent.delete(cellId);
      this._registry.delete(cellId);
      count++;
    }

    // Remove orphaned components
    for (const componentId of orphanedComponents) {
      this._componentToCell.delete(componentId);
      count++;
    }

    if (count > 0) {
      this._stats.orphanedCells += orphanedCells.length;
      this._stats.orphanedComponents += orphanedComponents.length;
      this._notifyChanges();
      this.logger.info(`Cleaned up ${count} orphaned references`);
    }

    return count;
  }

  /**
   * Get registry statistics
   * @returns An object with registry statistics
   */
  public getStats(): typeof this._stats {
    return { ...this._stats };
  }

  /**
   * Clear the registry
   */
  public clear(): void {
    this._cellToComponent.clear();
    this._componentToCell.clear();
    this._registry.clear();
    this._notifyChanges();
    this.logger.info('Registry cleared');
  }

  /**
   * Get an observable that emits when a specific cell is registered or unregistered
   * @param cellId The cell ID to watch
   * @returns An Observable that emits true when the cell is registered, false when unregistered
   */
  public watchCell(cellId: string): Observable<boolean> {
    return this.registryChanges$.pipe(map(() => this.hasCellId(cellId)));
  }

  /**
   * Get an observable that emits when a specific component is registered or unregistered
   * @param componentId The component ID to watch
   * @returns An Observable that emits true when the component is registered, false when unregistered
   */
  public watchComponent(componentId: string): Observable<boolean> {
    return this.registryChanges$.pipe(map(() => this.hasComponentId(componentId)));
  }

  /**
   * Notify observers of registry changes
   * @private
   */
  private _notifyChanges(): void {
    this._registryChanges$.next(this.getAllEntries());
  }
}
