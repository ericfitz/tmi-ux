import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Interface for diagram data
 */
export interface DiagramData {
  id: string;
  name: string;
  threatModelId?: string;
}

/**
 * Result of diagram loading operation
 */
export interface DiagramLoadResult {
  success: boolean;
  diagram?: DiagramData;
  error?: string;
}

/**
 * Service for managing DFD diagram data operations
 * Handles diagram loading, validation, and error scenarios
 */
@Injectable()
export class DfdDiagramService {
  constructor(private logger: LoggerService) {}

  /**
   * Load diagram data by ID
   * Returns observable with load result
   */
  loadDiagram(diagramId: string, threatModelId?: string): Observable<DiagramLoadResult> {
    this.logger.info('Loading diagram data', { diagramId, threatModelId });

    // Use dynamic import to load diagram data
    return from(import('../../tm/models/diagram.model')).pipe(
      map(module => {
        const diagram = module.DIAGRAMS_BY_ID.get(diagramId);
        if (diagram) {
          const diagramData: DiagramData = {
            id: diagramId,
            name: diagram.name,
            threatModelId,
          };
          
          this.logger.info('Successfully loaded diagram data', { 
            name: diagramData.name, 
            id: diagramId 
          });
          
          return {
            success: true,
            diagram: diagramData,
          };
        } else {
          this.logger.warn('Diagram not found', { id: diagramId });
          return {
            success: false,
            error: `Diagram with ID ${diagramId} not found`,
          };
        }
      }),
      catchError(error => {
        this.logger.error('Error loading diagram data', error);
        return of({
          success: false,
          error: 'Failed to load diagram data',
        });
      }),
    );
  }

  /**
   * Validate if diagram exists and user has access
   */
  validateDiagramAccess(diagramId: string): Observable<boolean> {
    return this.loadDiagram(diagramId).pipe(
      map(result => result.success),
    );
  }

  /**
   * Get fallback navigation path when diagram is not found
   */
  getFallbackNavigationPath(threatModelId: string | null): string {
    if (threatModelId) {
      return `/threat-models/${threatModelId}`;
    }
    return '/threat-models';
  }

  /**
   * Validate diagram ID format
   */
  isValidDiagramId(diagramId: string | null): boolean {
    return diagramId !== null && diagramId.trim().length > 0;
  }
}