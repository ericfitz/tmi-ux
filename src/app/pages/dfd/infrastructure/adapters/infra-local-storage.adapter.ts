/**
 * LocalStorageAdapter - Simple localStorage wrapper for offline diagram persistence
 *
 * Used when the local OAuth provider is active and no server is connected.
 * Provides basic save/load functionality using browser localStorage.
 */

import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { LoggerService } from '../../../../core/services/logger.service';

export interface LocalStorageData {
  diagramId: string;
  threatModelId: string;
  data: any;
  timestamp: string;
  version: number;
}

@Injectable({
  providedIn: 'root',
})
export class InfraLocalStorageAdapter {
  private readonly _keyPrefix = 'tmi-diagram-';

  constructor(private readonly logger: LoggerService) {
    this.logger.debug('InfraLocalStorageAdapter initialized');
  }

  /**
   * Save diagram data to localStorage
   */
  saveDiagram(diagramId: string, threatModelId: string, data: any): Observable<boolean> {
    try {
      const key = this._getKey(diagramId);
      const existingData = this._getFromStorage(key);
      const version = existingData ? existingData.version + 1 : 1;

      const storageData: LocalStorageData = {
        diagramId,
        threatModelId,
        data,
        timestamp: new Date().toISOString(),
        version,
      };

      localStorage.setItem(key, JSON.stringify(storageData));

      this.logger.debug('Diagram saved to localStorage', {
        diagramId,
        version,
        dataSize: JSON.stringify(data).length,
      });

      return of(true);
    } catch (error) {
      this.logger.error('Failed to save diagram to localStorage', {
        error,
        diagramId,
      });
      return throwError(() => error);
    }
  }

  /**
   * Load diagram data from localStorage
   */
  loadDiagram(diagramId: string): Observable<LocalStorageData | null> {
    try {
      const key = this._getKey(diagramId);
      const data = this._getFromStorage(key);

      if (data) {
        this.logger.debug('Diagram loaded from localStorage', {
          diagramId,
          version: data.version,
          timestamp: data.timestamp,
        });
      } else {
        this.logger.debug('No diagram found in localStorage', { diagramId });
      }

      return of(data);
    } catch (error) {
      this.logger.error('Failed to load diagram from localStorage', {
        error,
        diagramId,
      });
      return throwError(() => error);
    }
  }

  /**
   * Check if a diagram exists in localStorage
   */
  hasDiagram(diagramId: string): boolean {
    const key = this._getKey(diagramId);
    return localStorage.getItem(key) !== null;
  }

  /**
   * Delete a diagram from localStorage
   */
  deleteDiagram(diagramId: string): Observable<boolean> {
    try {
      const key = this._getKey(diagramId);
      localStorage.removeItem(key);

      this.logger.debug('Diagram deleted from localStorage', { diagramId });
      return of(true);
    } catch (error) {
      this.logger.error('Failed to delete diagram from localStorage', {
        error,
        diagramId,
      });
      return throwError(() => error);
    }
  }

  /**
   * Clear all diagrams from localStorage
   */
  clearAll(): Observable<boolean> {
    try {
      const keys = Object.keys(localStorage);
      const diagramKeys = keys.filter(key => key.startsWith(this._keyPrefix));

      diagramKeys.forEach(key => localStorage.removeItem(key));

      this.logger.debug('All diagrams cleared from localStorage', {
        count: diagramKeys.length,
      });

      return of(true);
    } catch (error) {
      this.logger.error('Failed to clear localStorage', { error });
      return throwError(() => error);
    }
  }

  /**
   * Get list of all diagram IDs in localStorage
   */
  listDiagrams(): string[] {
    try {
      const keys = Object.keys(localStorage);
      return keys
        .filter(key => key.startsWith(this._keyPrefix))
        .map(key => key.replace(this._keyPrefix, ''));
    } catch (error) {
      this.logger.error('Failed to list diagrams from localStorage', { error });
      return [];
    }
  }

  private _getKey(diagramId: string): string {
    return `${this._keyPrefix}${diagramId}`;
  }

  private _getFromStorage(key: string): LocalStorageData | null {
    const item = localStorage.getItem(key);
    if (!item) {
      return null;
    }

    try {
      return JSON.parse(item) as LocalStorageData;
    } catch (error) {
      this.logger.warn('Failed to parse localStorage data', { key, error });
      return null;
    }
  }
}
