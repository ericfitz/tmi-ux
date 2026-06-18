import '@angular/compiler';
import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';

import { DfdDialogService } from './dfd-dialog.service';
import { HistoryDialogComponent } from '../components/history-dialog/history-dialog.component';
import { GraphDataDialogComponent } from '../components/graph-data-dialog/graph-data-dialog.component';
import { HelpDialogComponent } from '../components/help-dialog/help-dialog.component';
import { ClipboardDialogComponent } from '../components/clipboard-dialog/clipboard-dialog.component';
import { CellPropertiesDialogComponent } from '../components/cell-properties-dialog/cell-properties-dialog.component';
import { MetadataDialogComponent } from '../../../tm/components/metadata-dialog/metadata-dialog.component';
import { ThreatEditorDialogComponent } from '../../../tm/components/threat-editor-dialog/threat-editor-dialog.component';
import { ThreatsDialogComponent } from '../../../tm/components/threats-dialog/threats-dialog.component';
import { ConfirmActionDialogComponent } from '../../../../shared/components/confirm-action-dialog/confirm-action-dialog.component';

describe('DfdDialogService', () => {
  // SEM@7f466de323f861b38be13a53d4c3f3bcd8ee0346: build a DfdDialogService with a mocked MatDialog for unit tests (pure)
  function setup(): {
    service: DfdDialogService;
    matDialog: { open: ReturnType<typeof vi.fn> };
  } {
    const matDialog = { open: vi.fn() };
    const service = new DfdDialogService(matDialog as any);
    return { service, matDialog };
  }

  describe('confirmDeletion', () => {
    it('resolves true when the dialog reports confirmed', async () => {
      const { service, matDialog } = setup();
      matDialog.open.mockReturnValue({ afterClosed: () => of({ confirmed: true }) });

      const result = await new Promise<boolean>(resolve => {
        service.confirmDeletion().subscribe(resolve);
      });

      expect(result).toBe(true);
      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open).toHaveBeenCalledWith(ConfirmActionDialogComponent, expect.anything());
      expect(matDialog.open.mock.calls[0][1]).toMatchObject({ disableClose: true });
    });

    it('resolves false when the dialog is dismissed with no result', async () => {
      const { service, matDialog } = setup();
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

      const result = await new Promise<boolean>(resolve => {
        service.confirmDeletion().subscribe(resolve);
      });

      expect(result).toBe(false);
      expect(matDialog.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('openHistory', () => {
    it('opens HistoryDialogComponent with the supplied data', () => {
      const { service, matDialog } = setup();
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const data = { historyState: {}, historyService: {} } as any;

      service.openHistory(data);

      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open).toHaveBeenCalledWith(
        HistoryDialogComponent,
        expect.objectContaining({ data }),
      );
    });
  });

  describe('openGraphData', () => {
    it('opens GraphDataDialogComponent with the supplied data', () => {
      const { service, matDialog } = setup();
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const data = { graph: {} } as any;

      service.openGraphData(data);

      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open).toHaveBeenCalledWith(
        GraphDataDialogComponent,
        expect.objectContaining({ data }),
      );
    });
  });

  describe('openHelp', () => {
    it('opens HelpDialogComponent', () => {
      const { service, matDialog } = setup();
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });

      service.openHelp();

      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open).toHaveBeenCalledWith(HelpDialogComponent, expect.anything());
    });
  });

  describe('openClipboard', () => {
    it('opens ClipboardDialogComponent with the supplied data', () => {
      const { service, matDialog } = setup();
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const data = { graph: {} } as any;

      service.openClipboard(data);

      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open).toHaveBeenCalledWith(
        ClipboardDialogComponent,
        expect.objectContaining({ data }),
      );
    });
  });

  describe('openCellProperties', () => {
    it('opens CellPropertiesDialogComponent with the supplied data', () => {
      const { service, matDialog } = setup();
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const data = { cell: {} } as any;

      service.openCellProperties(data);

      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open).toHaveBeenCalledWith(
        CellPropertiesDialogComponent,
        expect.objectContaining({ data }),
      );
    });
  });

  describe('openMetadata', () => {
    it('opens MetadataDialogComponent with the supplied data', () => {
      const { service, matDialog } = setup();
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const data = { threatModelId: 'tm-1', cellId: 'c-1', metadata: [] } as any;

      service.openMetadata(data);

      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open).toHaveBeenCalledWith(
        MetadataDialogComponent,
        expect.objectContaining({ data }),
      );
    });
  });

  describe('openThreatEditor', () => {
    it('opens ThreatEditorDialogComponent with the supplied data', () => {
      const { service, matDialog } = setup();
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const data = { threatModelId: 'tm-1', mode: 'create' } as any;

      service.openThreatEditor(data);

      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open).toHaveBeenCalledWith(
        ThreatEditorDialogComponent,
        expect.objectContaining({ data }),
      );
      expect(matDialog.open.mock.calls[0][1]).toMatchObject({
        panelClass: 'threat-editor-dialog-650',
      });
    });
  });

  describe('openThreats', () => {
    it('opens ThreatsDialogComponent with the supplied data', () => {
      const { service, matDialog } = setup();
      matDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const data = { threats: [], isReadOnly: false, objectType: 'node' } as any;

      service.openThreats(data);

      expect(matDialog.open).toHaveBeenCalledTimes(1);
      expect(matDialog.open).toHaveBeenCalledWith(
        ThreatsDialogComponent,
        expect.objectContaining({ data }),
      );
    });
  });
});
