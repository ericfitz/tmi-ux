import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService } from './threat-model.service';
import { Document, Metadata } from '../models/threat-model.model';
import { DocumentEditorDialogResult } from '../components/document-editor-dialog/document-editor-dialog.component';
import type { components } from '@app/generated/api-types';

// SEM@ba9b79db6a4de74a7d4fb361c47c368342bdc317: type alias for the API DocumentInput schema (pure)
type ApiDocumentInput = components['schemas']['DocumentInput'];

/** Documents loaded for one page of the documents sub-table. */
export interface DocumentsPage {
  documents: Document[];
  total: number;
}

/**
 * Document CRUD orchestration extracted from TmEditComponent. Owns the
 * editor-form-value mapping and the ThreatModelService calls. Does NOT touch
 * MatTableDataSource or pagination view state — methods return data/Observables
 * and the component applies them.
 */
@Injectable({ providedIn: 'root' })
// SEM@80e49c08e1b6efd5e6360d4e15b4c8940e4b92b0: orchestrate document CRUD operations against the threat model API
export class TmDocumentCrudService {
  // SEM@4ab33d2c30f4673c23ee776e1914d3f77cb0162b: inject ThreatModelService dependency for document CRUD operations
  constructor(private threatModelService: ThreatModelService) {}

  /**
   * Map document editor form values to a Partial<ApiDocumentInput> for the API.
   */
  // SEM@80e49c08e1b6efd5e6360d4e15b4c8940e4b92b0: convert document editor form values to API document input payload (pure)
  buildDocumentData(values: DocumentEditorDialogResult['values']): Partial<ApiDocumentInput> {
    return {
      name: values.name,
      uri: values.uri,
      description: values.description || undefined,
      include_in_report: values.include_in_report,
      ...(values.picker_registration ? { picker_registration: values.picker_registration } : {}),
    };
  }

  /**
   * Load one page of documents for a threat model.
   */
  // SEM@4ab33d2c30f4673c23ee776e1914d3f77cb0162b: fetch one paginated page of documents for a threat model (reads DB)
  loadDocuments(
    threatModelId: string,
    pageIndex: number,
    pageSize: number,
  ): Observable<DocumentsPage> {
    const offset = calculateOffset(pageIndex, pageSize);
    return this.threatModelService.getDocumentsForThreatModel(threatModelId, pageSize, offset).pipe(
      map(response => ({
        documents: response.documents ?? [],
        total: response.total ?? 0,
      })),
    );
  }

  /**
   * Create a document from editor form values.
   */
  // SEM@4ab33d2c30f4673c23ee776e1914d3f77cb0162b: store a new document on a threat model from editor form values (reads DB)
  createDocument(
    threatModelId: string,
    values: DocumentEditorDialogResult['values'],
  ): Observable<Document> {
    return this.threatModelService.createDocument(threatModelId, this.buildDocumentData(values));
  }

  /**
   * Update a document from editor form values; emits the updated document.
   */
  // SEM@4ab33d2c30f4673c23ee776e1914d3f77cb0162b: update an existing document from editor form values; emit updated document (reads DB)
  updateDocument(
    threatModelId: string,
    documentId: string,
    values: DocumentEditorDialogResult['values'],
  ): Observable<Document> {
    return this.threatModelService.updateDocument(
      threatModelId,
      documentId,
      this.buildDocumentData(values),
    );
  }

  /**
   * Delete a document; emits the success boolean.
   */
  // SEM@4ab33d2c30f4673c23ee776e1914d3f77cb0162b: delete a document from a threat model; emit success boolean (reads DB)
  deleteDocument(threatModelId: string, documentId: string): Observable<boolean> {
    return this.threatModelService.deleteDocument(threatModelId, documentId);
  }

  /**
   * Update a document's metadata; emits the updated metadata array.
   */
  // SEM@4ab33d2c30f4673c23ee776e1914d3f77cb0162b: update a document's metadata array; emit updated metadata (reads DB)
  updateDocumentMetadata(
    threatModelId: string,
    documentId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateDocumentMetadata(threatModelId, documentId, metadata);
  }
}
