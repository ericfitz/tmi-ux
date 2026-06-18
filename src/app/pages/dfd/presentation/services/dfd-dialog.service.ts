import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import {
  HistoryDialogComponent,
  HistoryDialogData,
} from '../components/history-dialog/history-dialog.component';
import {
  GraphDataDialogComponent,
  GraphDataDialogData,
} from '../components/graph-data-dialog/graph-data-dialog.component';
import { HelpDialogComponent } from '../components/help-dialog/help-dialog.component';
import {
  ClipboardDialogComponent,
  ClipboardDialogData,
} from '../components/clipboard-dialog/clipboard-dialog.component';
import {
  CellPropertiesDialogComponent,
  CellPropertiesDialogData,
} from '../components/cell-properties-dialog/cell-properties-dialog.component';
import {
  MetadataDialogComponent,
  MetadataDialogData,
} from '../../../tm/components/metadata-dialog/metadata-dialog.component';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../../../tm/components/threat-editor-dialog/threat-editor-dialog.component';
import {
  ThreatsDialogComponent,
  ThreatsDialogData,
} from '../../../tm/components/threats-dialog/threats-dialog.component';
import {
  ConfirmActionDialogComponent,
  ConfirmActionDialogData,
  ConfirmActionDialogResult,
} from '../../../../shared/components/confirm-action-dialog/confirm-action-dialog.component';

/**
 * Thin wrapper over MatDialog for the DFD-owned dialogs. Each method opens one
 * dialog type with the exact MatDialogConfig the DFD component used, so the
 * component (and future extracted services) can depend on this seam instead of
 * MatDialog directly and stay unit-testable without rendering real dialogs.
 *
 * Callers build the `data` payload from live graph/component state and pass it
 * straight through; this service does not construct `data` itself.
 *
 * Each `open*` method returns the raw MatDialogRef so callers retain their
 * existing afterClosed() / componentInstance access. `confirmDeletion` is the
 * one exception: it returns `Observable<boolean>` because the component
 * consumes the confirmation result directly as a boolean.
 */
@Injectable({ providedIn: 'root' })
// SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: dispatch all DFD-owned dialogs through a single MatDialog facade
export class DfdDialogService {
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: inject MatDialog dependency (pure)
  constructor(private dialog: MatDialog) {}

  /**
   * Open the metadata-loss confirmation dialog used before deleting cells.
   * Returns the mapped afterClosed() observable — true if the user confirmed.
   */
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: open a deletion confirmation dialog and return an observable boolean result
  confirmDeletion(): Observable<boolean> {
    const dialogRef = this.dialog.open<
      ConfirmActionDialogComponent,
      ConfirmActionDialogData,
      ConfirmActionDialogResult
    >(ConfirmActionDialogComponent, {
      width: '450px',
      data: {
        title: 'editor.deleteMetadataWarning.title',
        message: 'editor.deleteMetadataWarning.message',
        confirmLabel: 'editor.deleteMetadataWarning.confirm',
        confirmIsDestructive: true,
      },
      disableClose: true,
    });

    return dialogRef
      .afterClosed()
      .pipe(map((result: ConfirmActionDialogResult | undefined) => result?.confirmed ?? false));
  }

  /** Open the diagram history dialog. */
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: open the diagram history dialog and return its dialog reference
  openHistory(data: HistoryDialogData): MatDialogRef<HistoryDialogComponent> {
    return this.dialog.open<HistoryDialogComponent, HistoryDialogData>(HistoryDialogComponent, {
      width: '800px',
      maxHeight: '90vh',
      data,
    });
  }

  /** Open the graph data inspector dialog. */
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: open the graph data inspector dialog and return its dialog reference
  openGraphData(data: GraphDataDialogData): MatDialogRef<GraphDataDialogComponent> {
    return this.dialog.open<GraphDataDialogComponent, GraphDataDialogData>(
      GraphDataDialogComponent,
      {
        width: '800px',
        maxHeight: '90vh',
        data,
      },
    );
  }

  /** Open the DFD help dialog. */
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: open the DFD help dialog and return its dialog reference
  openHelp(): MatDialogRef<HelpDialogComponent> {
    return this.dialog.open<HelpDialogComponent>(HelpDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      maxHeight: '90vh',
    });
  }

  /** Open the clipboard contents dialog. */
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: open the clipboard contents dialog and return its dialog reference
  openClipboard(data: ClipboardDialogData): MatDialogRef<ClipboardDialogComponent> {
    return this.dialog.open<ClipboardDialogComponent, ClipboardDialogData>(
      ClipboardDialogComponent,
      {
        width: '800px',
        maxHeight: '90vh',
        data,
      },
    );
  }

  /** Open the cell properties inspector dialog. */
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: open the cell properties inspector dialog and return its dialog reference
  openCellProperties(data: CellPropertiesDialogData): MatDialogRef<CellPropertiesDialogComponent> {
    return this.dialog.open<CellPropertiesDialogComponent, CellPropertiesDialogData>(
      CellPropertiesDialogComponent,
      {
        width: '90vw',
        maxWidth: '800px',
        minWidth: '500px',
        maxHeight: '80vh',
        data,
      },
    );
  }

  /** Open the shared metadata dialog for the selected cell. */
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: open the cell metadata editor dialog and return its dialog reference
  openMetadata(data: MetadataDialogData): MatDialogRef<MetadataDialogComponent> {
    return this.dialog.open<MetadataDialogComponent, MetadataDialogData>(MetadataDialogComponent, {
      width: '600px',
      data,
    });
  }

  /** Open the threat editor dialog (create mode) for a cell. */
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: open the threat editor dialog in create mode and return its dialog reference
  openThreatEditor(data: ThreatEditorDialogData): MatDialogRef<ThreatEditorDialogComponent> {
    return this.dialog.open<ThreatEditorDialogComponent, ThreatEditorDialogData>(
      ThreatEditorDialogComponent,
      {
        width: '650px',
        maxHeight: '90vh',
        panelClass: 'threat-editor-dialog-650',
        data,
      },
    );
  }

  /** Open the threats management dialog for a cell. */
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: open the threats management dialog for a cell and return its dialog reference
  openThreats(data: ThreatsDialogData): MatDialogRef<ThreatsDialogComponent> {
    return this.dialog.open<ThreatsDialogComponent, ThreatsDialogData>(ThreatsDialogComponent, {
      width: '800px',
      maxHeight: '90vh',
      data,
    });
  }
}
