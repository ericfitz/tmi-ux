import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LoggerService } from '../../../core/services/logger.service';
import { ThreatModelService } from '../../tm/services/threat-model.service';

/**
 * Interface for diagram data
 */
export interface DiagramData {
  id: string;
  name: string;
  threatModelId?: string;
  cells?: any[]; // Full diagram cells data for rendering
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
  constructor(
    private logger: LoggerService,
    private threatModelService: ThreatModelService,
  ) {}

  /**
   * Load diagram data by ID
   * Returns observable with load result
   */
  loadDiagram(diagramId: string, threatModelId?: string): Observable<DiagramLoadResult> {
    this.logger.info('Loading diagram data', { diagramId, threatModelId });

    if (!threatModelId) {
      this.logger.error('Threat model ID is required to load diagram data');
      return of({
        success: false,
        error: 'Threat model ID is required',
      });
    }

    // Load diagram data from the threat model service
    return this.threatModelService.getThreatModelById(threatModelId).pipe(
      map(threatModel => {
        if (!threatModel) {
          this.logger.warn('Threat model not found', { threatModelId });
          return {
            success: false,
            error: `Threat model with ID ${threatModelId} not found`,
          };
        }

        // Find the diagram within the threat model
        const diagram = threatModel.diagrams?.find(d => d.id === diagramId);
        if (!diagram) {
          this.logger.warn('Diagram not found in threat model', { diagramId, threatModelId });
          return {
            success: false,
            error: `Diagram with ID ${diagramId} not found in threat model`,
          };
        }

        const diagramData: DiagramData = {
          id: diagramId,
          name: diagram.name,
          threatModelId,
          cells: diagram.cells || [], // Include the actual diagram cells from threat model
        };
        
        this.logger.info('Successfully loaded diagram data from threat model', { 
          name: diagramData.name, 
          id: diagramId,
          threatModelId,
          cellCount: diagramData.cells?.length || 0
        });
        
        return {
          success: true,
          diagram: diagramData,
        };
      }),
      catchError(error => {
        this.logger.error('Error loading diagram data from threat model', error);
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
  validateDiagramAccess(diagramId: string, threatModelId?: string): Observable<boolean> {
    return this.loadDiagram(diagramId, threatModelId).pipe(
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