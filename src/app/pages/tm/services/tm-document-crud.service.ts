import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { calculateOffset } from '@app/shared/utils/pagination.util';
import { ThreatModelService } from './threat-model.service';
import { Document, Metadata } from '../models/threat-model.model';
import { DocumentEditorDialogResult } from '../components/document-editor-dialog/document-editor-dialog.component';
import type { ApiDocumentInput } from '@app/generated/api-type-helpers';

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
export class TmDocumentCrudService {
  constructor(private threatModelService: ThreatModelService) {}

  /**
   * Map document editor form values to a Partial<ApiDocumentInput> for the API.
   */
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
  createDocument(
    threatModelId: string,
    values: DocumentEditorDialogResult['values'],
  ): Observable<Document> {
    return this.threatModelService.createDocument(threatModelId, this.buildDocumentData(values));
  }

  /**
   * Update a document from editor form values; emits the updated document.
   */
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
  deleteDocument(threatModelId: string, documentId: string): Observable<boolean> {
    return this.threatModelService.deleteDocument(threatModelId, documentId);
  }

  /**
   * Update a document's metadata; emits the updated metadata array.
   */
  updateDocumentMetadata(
    threatModelId: string,
    documentId: string,
    metadata: Metadata[],
  ): Observable<Metadata[]> {
    return this.threatModelService.updateDocumentMetadata(threatModelId, documentId, metadata);
  }
}
