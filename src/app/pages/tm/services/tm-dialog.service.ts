import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable } from 'rxjs';

import {
  DocumentEditorDialogComponent,
  DocumentEditorDialogData,
  DocumentEditorDialogResult,
} from '../components/document-editor-dialog/document-editor-dialog.component';
import {
  DeleteConfirmationDialogComponent,
  DeleteConfirmationDialogData,
  DeleteConfirmationDialogResult,
} from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../components/metadata-dialog/metadata-dialog.component';
import { Metadata } from '../models/threat-model.model';

/**
 * Thin wrapper over MatDialog for the tm-edit entity dialogs. Each method
 * opens one dialog type and returns the typed afterClosed() observable, so
 * CRUD services can depend on this seam instead of MatDialog directly and
 * stay unit-testable without rendering real dialogs.
 */
@Injectable({ providedIn: 'root' })
export class TmDialogService {
  constructor(private dialog: MatDialog) {}

  /** Open the document editor dialog (create or edit mode). */
  openDocumentEditor(
    data: DocumentEditorDialogData,
  ): Observable<DocumentEditorDialogResult | undefined> {
    return this.dialog
      .open<
        DocumentEditorDialogComponent,
        DocumentEditorDialogData,
        DocumentEditorDialogResult
      >(DocumentEditorDialogComponent, { width: '600px', data, disableClose: true })
      .afterClosed();
  }

  /** Open the delete-confirmation dialog. */
  openDeleteConfirmation(
    data: DeleteConfirmationDialogData,
  ): Observable<DeleteConfirmationDialogResult | undefined> {
    return this.dialog
      .open<
        DeleteConfirmationDialogComponent,
        DeleteConfirmationDialogData,
        DeleteConfirmationDialogResult
      >(DeleteConfirmationDialogComponent, { width: '700px', data, disableClose: true })
      .afterClosed();
  }

  /** Open the shared metadata dialog. */
  openMetadata(data: MetadataDialogData): Observable<Metadata[] | undefined> {
    return this.dialog
      .open<MetadataDialogComponent, MetadataDialogData, Metadata[]>(MetadataDialogComponent, {
        width: '90vw',
        maxWidth: '800px',
        minWidth: '500px',
        maxHeight: '80vh',
        data,
      })
      .afterClosed();
  }
}
