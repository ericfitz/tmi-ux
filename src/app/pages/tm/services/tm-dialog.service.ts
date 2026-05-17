import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
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
import { Metadata, Threat, Asset } from '../models/threat-model.model';
import { CreateDiagramDialogComponent } from '../components/create-diagram-dialog/create-diagram-dialog.component';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../components/threat-editor-dialog/threat-editor-dialog.component';
import {
  RepositoryEditorDialogComponent,
  RepositoryEditorDialogData,
} from '../components/repository-editor-dialog/repository-editor-dialog.component';
import {
  NoteEditorDialogComponent,
  NoteEditorDialogData,
} from '@app/shared/components/note-editor-dialog/note-editor-dialog.component';
import {
  AssetEditorDialogComponent,
  AssetEditorDialogData,
} from '../components/asset-editor-dialog/asset-editor-dialog.component';

/** Input for the create-diagram dialog (CreateDiagramDialogData is not exported). */
export interface DiagramCreateDialogData {
  threatModelName: string;
}

/** Result emitted by the create-diagram dialog's afterClosed(). */
export interface DiagramCreateDialogResult {
  name: string;
  type: string;
}

/** Form result emitted by the repository editor dialog's afterClosed(). */
export interface RepositoryFormResult {
  name: string;
  description?: string;
  type: 'git' | 'svn' | 'mercurial' | 'other';
  uri: string;
  parameters?: {
    refType: 'branch' | 'tag' | 'commit';
    refValue: string;
    subPath?: string;
  };
  include_in_report?: boolean;
  timmy_enabled?: boolean;
}

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

  /** Open the create-diagram dialog. */
  openDiagramCreate(
    data: DiagramCreateDialogData,
  ): Observable<DiagramCreateDialogResult | undefined> {
    return this.dialog
      .open<
        CreateDiagramDialogComponent,
        DiagramCreateDialogData,
        DiagramCreateDialogResult
      >(CreateDiagramDialogComponent, { width: '400px', data })
      .afterClosed();
  }

  /** Open the threat editor dialog (create mode — edit navigates to a page). */
  openThreatEditor(data: ThreatEditorDialogData): Observable<Partial<Threat> | undefined> {
    return this.dialog
      .open<ThreatEditorDialogComponent, ThreatEditorDialogData, Partial<Threat>>(
        ThreatEditorDialogComponent,
        {
          width: '650px',
          maxHeight: '90vh',
          panelClass: 'threat-editor-dialog-650',
          data,
        },
      )
      .afterClosed();
  }

  /** Open the repository editor dialog (create or edit mode). */
  openRepositoryEditor(
    data: RepositoryEditorDialogData,
  ): Observable<RepositoryFormResult | undefined> {
    return this.dialog
      .open<
        RepositoryEditorDialogComponent,
        RepositoryEditorDialogData,
        RepositoryFormResult
      >(RepositoryEditorDialogComponent, { width: '700px', data })
      .afterClosed();
  }

  /**
   * Open the note editor dialog. Returns the MatDialogRef (not just
   * afterClosed()) because the addNote flow subscribes to
   * componentInstance.saveEvent and calls componentInstance.setCreatedNoteId.
   */
  openNoteEditor(data: NoteEditorDialogData): MatDialogRef<NoteEditorDialogComponent> {
    return this.dialog.open<NoteEditorDialogComponent, NoteEditorDialogData>(
      NoteEditorDialogComponent,
      {
        width: '90vw',
        maxWidth: '900px',
        minWidth: '600px',
        maxHeight: '90vh',
        data,
      },
    );
  }

  /** Open the asset editor dialog (create or edit mode). */
  openAssetEditor(data: AssetEditorDialogData): Observable<Partial<Asset> | undefined> {
    return this.dialog
      .open<
        AssetEditorDialogComponent,
        AssetEditorDialogData,
        Partial<Asset>
      >(AssetEditorDialogComponent, { width: '600px', maxHeight: '90vh', data })
      .afterClosed();
  }
}
