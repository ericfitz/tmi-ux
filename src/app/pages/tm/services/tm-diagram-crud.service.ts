import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService } from './threat-model.service';
import { Diagram } from '../models/diagram.model';
import { Metadata } from '../models/threat-model.model';
import type { ApiBaseDiagramInput } from '@app/generated/api-type-helpers';

/** Diagrams loaded for one page of the diagrams sub-table. */
export interface DiagramsPage {
  diagrams: Diagram[];
  total: number;
}

/**
 * Diagram CRUD orchestration extracted from TmEditComponent. Diagrams have no
 * edit method — editing navigates to the DFD editor. Does NOT touch
 * MatTableDataSource, the diagrams setter, DIAGRAMS_BY_ID, or SVG caches.
 */
@Injectable({ providedIn: 'root' })
export class TmDiagramCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /** Load one page of diagrams for a threat model. */
  loadDiagrams(
    threatModelId: string,
    pageIndex: number,
    pageSize: number,
  ): Observable<DiagramsPage> {
    const offset = calculateOffset(pageIndex, pageSize);
    return this.threatModelService.getDiagramsForThreatModel(threatModelId, pageSize, offset).pipe(
      map(response => ({
        diagrams: response.diagrams ?? [],
        total: response.total ?? 0,
      })),
    );
  }

  /** Create a diagram from the create-dialog result. */
  createDiagram(
    threatModelId: string,
    values: { name: string; type: string },
  ): Observable<Diagram> {
    const data: Partial<ApiBaseDiagramInput> = {
      name: values.name,
      type: values.type as Diagram['type'],
    };
    return this.threatModelService.createDiagram(threatModelId, data);
  }

  /** Delete a diagram; emits the success boolean. */
  deleteDiagram(threatModelId: string, diagramId: string): Observable<boolean> {
    return this.threatModelService.deleteDiagram(threatModelId, diagramId);
  }

  /** Fetch a diagram's metadata (list endpoint omits it). */
  getDiagramMetadata(threatModelId: string, diagramId: string): Observable<Metadata[]> {
    return this.threatModelService.getDiagramMetadata(threatModelId, diagramId);
  }

  /** Update a diagram's metadata; emits the updated metadata array. */
  updateDiagramMetadata(
    threatModelId: string,
    diagramId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateDiagramMetadata(threatModelId, diagramId, metadata);
  }

  /** Fetch a diagram model as a string in the given export format. */
  getDiagramModel(
    threatModelId: string,
    diagramId: string,
    format: 'json' | 'yaml' | 'graphml',
  ): Observable<string> {
    return this.threatModelService.getDiagramModel(threatModelId, diagramId, format);
  }
}
