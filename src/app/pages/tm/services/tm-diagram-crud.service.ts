import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService } from './threat-model.service';
import { Diagram } from '../models/diagram.model';
import { Metadata } from '../models/threat-model.model';
import type { components } from '@app/generated/api-types';

// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: type alias for the API BaseDiagramInput schema (pure)
type ApiBaseDiagramInput = components['schemas']['BaseDiagramInput'];

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
// SEM@8276927976b5e15eec42a3b06951c5fa0409615f: orchestrate diagram CRUD operations against the threat model API
export class TmDiagramCrudService {
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: inject the threat model service dependency (pure)
  constructor(private threatModelService: ThreatModelService) {}

  /** Load one page of diagrams for a threat model. */
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: fetch one page of diagrams for a threat model from the API
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
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: store a new diagram for a threat model via the API
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
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: delete a diagram from a threat model via the API
  deleteDiagram(threatModelId: string, diagramId: string): Observable<boolean> {
    return this.threatModelService.deleteDiagram(threatModelId, diagramId);
  }

  /** Fetch a diagram's metadata (list endpoint omits it). */
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: fetch metadata key-value pairs for a diagram from the API
  getDiagramMetadata(threatModelId: string, diagramId: string): Observable<Metadata[]> {
    return this.threatModelService.getDiagramMetadata(threatModelId, diagramId);
  }

  /** Update a diagram's metadata; emits the updated metadata array. */
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: update metadata key-value pairs for a diagram via the API
  updateDiagramMetadata(
    threatModelId: string,
    diagramId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateDiagramMetadata(threatModelId, diagramId, metadata);
  }

  /** Fetch a diagram model as a string in the given export format. */
  // SEM@8276927976b5e15eec42a3b06951c5fa0409615f: fetch a diagram's serialized model in a specified export format
  getDiagramModel(
    threatModelId: string,
    diagramId: string,
    format: 'json' | 'yaml' | 'graphml',
  ): Observable<string> {
    return this.threatModelService.getDiagramModel(threatModelId, diagramId, format);
  }
}
