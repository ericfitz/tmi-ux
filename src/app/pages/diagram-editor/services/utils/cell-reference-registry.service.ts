import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';

import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Interface for cell deletion notification
 */
export interface CellDeletionNotification {
  cellId: string;
  sourceService: string;
}

/**
 * Service to track references to cells across different services
 * This helps with cleanup when cells are deleted
 */
@Injectable({
  providedIn: 'root',
})
export class CellReferenceRegistryService {
  // Public observable for pre-delete notifications
  public beforeCellDelete$: Observable<CellDeletionNotification>;

  // Private subject and map
  private _beforeCellDelete = new Subject<CellDeletionNotification>();
  private references = new Map<string, Set<string>>();

  constructor(private logger: LoggerService) {
    this.logger.info('CellReferenceRegistryService initialized');
    // Initialize the observable
    this.beforeCellDelete$ = this._beforeCellDelete.asObservable();
  }

  /**
   * Register a service as having a reference to a cell
   */
  registerReference(cellId: string, service: string): void {
    if (!cellId) return;

    if (!this.references.has(cellId)) {
      this.references.set(cellId, new Set<string>());
    }

    this.references.get(cellId)?.add(service);
    this.logger.debug(`Service ${service} registered reference to cell ${cellId}`);
  }

  /**
   * Get all services that reference a cell
   */
  getReferences(cellId: string): string[] {
    if (!cellId) return [];
    return Array.from(this.references.get(cellId) || []);
  }

  /**
   * Remove a service's reference to a cell
   */
  removeReference(cellId: string, service: string): void {
    if (!cellId) return;

    if (this.references.has(cellId)) {
      this.references.get(cellId)?.delete(service);

      // Clean up empty sets
      if (this.references.get(cellId)?.size === 0) {
        this.references.delete(cellId);
      }

      this.logger.debug(`Service ${service} removed reference to cell ${cellId}`);
    }
  }

  /**
   * Notify all services before a cell is deleted
   */
  notifyBeforeDelete(cellId: string, sourceService: string): void {
    if (!cellId) return;

    const services = this.getReferences(cellId);
    this.logger.debug(`Notifying ${services.length} services about deletion of cell ${cellId}`);

    // Emit notification
    this._beforeCellDelete.next({ cellId, sourceService });
  }

  /**
   * Clear all references to a cell
   */
  clearReferences(cellId: string): void {
    if (!cellId) return;

    if (this.references.has(cellId)) {
      this.logger.debug(`Clearing all references to cell ${cellId}`);
      this.references.delete(cellId);
    }
  }
}
