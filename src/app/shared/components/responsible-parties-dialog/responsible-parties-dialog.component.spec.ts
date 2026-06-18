// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { of, throwError } from 'rxjs';
import type { TranslocoService } from '@jsverse/transloco';

import {
  ResponsiblePartiesDialogComponent,
  ResponsiblePartiesDialogData,
} from './responsible-parties-dialog.component';
import type { ResponsibleParty } from '@app/types/team.types';

describe('ResponsiblePartiesDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockTransloco: TranslocoService;
  let patchFn: ReturnType<typeof vi.fn>;
  let envInjector: EnvironmentInjector;

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: construct a ResponsiblePartiesDialogComponent under test injection context (pure)
  function build(
    overrides: Partial<ResponsiblePartiesDialogData> = {},
  ): ResponsiblePartiesDialogComponent {
    const data: ResponsiblePartiesDialogData = {
      entityId: 'ent-1',
      entityType: 'team',
      parties: [],
      patchFn,
      ...overrides,
    };
    return runInInjectionContext(
      envInjector,
      () =>
        new ResponsiblePartiesDialogComponent(
          mockDialogRef as never,
          data,
          mockDialog as never,
          mockLogger as never,
          mockTransloco,
        ),
    );
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockDialog = { open: vi.fn() };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
    patchFn = vi.fn(() => of({}));
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should create, copying the parties', () => {
    const parties = [{ user_id: 'u1' }] as ResponsibleParty[];
    const component = build({ parties });

    expect(component.parties).toEqual(parties);
    expect(component.parties).not.toBe(parties);
  });

  describe('i18n prefix', () => {
    it('uses the teams prefix for a team entity', () => {
      expect(build({ entityType: 'team' }).i18nPrefix).toBe('teams');
    });

    it('uses the projects prefix for a project entity', () => {
      expect(build({ entityType: 'project' }).i18nPrefix).toBe('projects');
    });
  });

  describe('removeParty', () => {
    it('removes the matching party and marks the dialog dirty', () => {
      const component = build({
        parties: [{ user_id: 'u1' }, { user_id: 'u2' }] as ResponsibleParty[],
      });

      component.removeParty({ user_id: 'u1' });

      expect(component.parties.map(p => p.user_id)).toEqual(['u2']);
      expect(component.dirty).toBe(true);
    });
  });

  describe('addParty', () => {
    it('appends the picked user as a new party', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () =>
          of({ user: { internal_uuid: 'u9', name: 'Zed', email: 'z@x.com' }, role: 'owner' }),
      });
      const component = build();

      component.addParty();

      expect(component.parties).toHaveLength(1);
      expect(component.parties[0].user_id).toBe('u9');
      expect(component.dirty).toBe(true);
    });

    it('does not add a duplicate party', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of({ user: { internal_uuid: 'u1', name: 'Dup' }, role: 'owner' }),
      });
      const component = build({ parties: [{ user_id: 'u1' }] as ResponsibleParty[] });

      component.addParty();

      expect(component.parties).toHaveLength(1);
    });
  });

  describe('onSave', () => {
    it('does nothing when not dirty', () => {
      const component = build();

      component.onSave();

      expect(patchFn).not.toHaveBeenCalled();
    });

    it('invokes the supplied patchFn and closes on success', () => {
      const component = build();
      component.dirty = true;

      component.onSave();

      expect(patchFn).toHaveBeenCalledWith('ent-1', []);
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('surfaces the server error message on failure', () => {
      patchFn.mockReturnValue(throwError(() => ({ error: { message: 'denied' } })));
      const component = build();
      component.dirty = true;

      component.onSave();

      expect(component.errorMessage).toBe('denied');
      expect(component.saving).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with false', () => {
      const component = build();

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
    });
  });
});
