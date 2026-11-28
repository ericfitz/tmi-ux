// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, Subscription, throwError } from 'rxjs';

import { TmEditComponent } from './tm-edit.component';
import type { Threat, ThreatModel } from './models/threat-model.model';

/**
 * #1076: threats in the threat model come from the list endpoint, which does
 * not include metadata, so the row's metadata dialog must fetch it first.
 * TmEditComponent has too many dependencies to construct here; the method
 * under test only touches the fields assigned below; add any dependency the
 * method gains to the Object.assign() call, or these tests fail.
 */
describe('TmEditComponent.openThreatMetadataDialog', () => {
  const stored = [{ key: 'run_id', value: 'ace18002-3d78-4ffc-804d-0c46f1419ce4' }];
  const threat = { id: 't1', name: 'Threat 1', metadata: [] } as unknown as Threat;

  let component: TmEditComponent;
  let threatCrud: {
    getThreatMetadata: ReturnType<typeof vi.fn>;
    updateThreatMetadata: ReturnType<typeof vi.fn>;
  };
  let dialogService: { openMetadata: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  const event = { stopPropagation: vi.fn(), target: null } as unknown as Event;

  beforeEach(() => {
    threatCrud = {
      getThreatMetadata: vi.fn().mockReturnValue(of(stored)),
      updateThreatMetadata: vi.fn((_tm: string, _id: string, md: unknown) => of(md)),
    };
    dialogService = { openMetadata: vi.fn().mockReturnValue(of(undefined)) };
    logger = { error: vi.fn(), info: vi.fn() };
    snackBar = { open: vi.fn() };
    threat.metadata = [];

    component = Object.create(TmEditComponent.prototype) as TmEditComponent;
    Object.assign(component, {
      threatModel: { id: 'tm-1', threats: [threat] } as unknown as ThreatModel,
      canEdit: true,
      threatCrud,
      dialogService,
      logger,
      snackBar,
      transloco: { translate: (key: string) => key },
      _subscriptions: new Subscription(),
    });
  });

  it('opens the dialog with the metadata fetched from the sub-resource', () => {
    component.openThreatMetadataDialog(threat, event);

    expect(threatCrud.getThreatMetadata).toHaveBeenCalledWith('tm-1', 't1');
    expect(dialogService.openMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: stored, isReadOnly: false }),
    );
  });

  it('does not open the dialog when the metadata cannot be loaded', () => {
    threatCrud.getThreatMetadata.mockReturnValue(throwError(() => new Error('boom')));

    component.openThreatMetadataDialog(threat, event);

    expect(dialogService.openMetadata).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith(
      'common.metadataLoadFailed',
      'common.close',
      expect.anything(),
    );
  });

  it('refreshes the list copy with the fetched metadata', () => {
    component.openThreatMetadataDialog(threat, event);

    expect(component.threatModel?.threats?.[0].metadata).toEqual(stored);
  });

  it('loads threat metadata into the row addon context', () => {
    component.setAddonRowContext('threat', 't1', 'Threat 1', []);

    expect(threatCrud.getThreatMetadata).toHaveBeenCalledWith('tm-1', 't1');
    expect(
      (component as unknown as { currentAddonRowContext: { metadata: unknown } })
        .currentAddonRowContext.metadata,
    ).toEqual(stored);
  });

  it('does not fetch metadata for non-threat addon rows', () => {
    component.setAddonRowContext('asset', 'a1', 'Asset 1', []);

    expect(threatCrud.getThreatMetadata).not.toHaveBeenCalled();
  });

  it('persists the dialog result and updates the list copy', () => {
    const edited = [{ key: 'reviewed', value: 'yes' }];
    dialogService.openMetadata.mockReturnValue(of(edited));

    component.openThreatMetadataDialog(threat, event);

    expect(threatCrud.updateThreatMetadata).toHaveBeenCalledWith('tm-1', 't1', edited);
    expect(component.threatModel?.threats?.[0].metadata).toEqual(edited);
  });
});
