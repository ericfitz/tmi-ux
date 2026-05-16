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

import { TeamMembersDialogComponent, TeamMembersDialogData } from './team-members-dialog.component';
import type { Team, TeamMember } from '@app/types/team.types';

describe('TeamMembersDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockTeamService: { patch: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockTransloco: TranslocoService;
  let envInjector: EnvironmentInjector;

  function makeTeam(members: TeamMember[] = []): Team {
    return { id: 'team-1', name: 'Team A', members } as Team;
  }

  function build(data: TeamMembersDialogData): TeamMembersDialogComponent {
    return runInInjectionContext(
      envInjector,
      () =>
        new TeamMembersDialogComponent(
          mockDialogRef as never,
          data,
          mockDialog as never,
          mockTeamService as never,
          mockLogger as never,
          mockTransloco,
        ),
    );
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockDialog = { open: vi.fn() };
    mockTeamService = { patch: vi.fn(() => of({})) };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should create, copying the team members', () => {
    const members = [{ user_id: 'u1' }] as TeamMember[];
    const component = build({ team: makeTeam(members) });

    expect(component).toBeTruthy();
    expect(component.members).toEqual(members);
    expect(component.members).not.toBe(members);
    expect(component.dirty).toBe(false);
  });

  describe('removeMember', () => {
    it('removes the matching member and marks the dialog dirty', () => {
      const component = build({
        team: makeTeam([{ user_id: 'u1' }, { user_id: 'u2' }] as TeamMember[]),
      });

      component.removeMember({ user_id: 'u1' });

      expect(component.members.map(m => m.user_id)).toEqual(['u2']);
      expect(component.dirty).toBe(true);
    });
  });

  describe('addMember', () => {
    it('appends the picked user as a new member', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () =>
          of({
            user: { internal_uuid: 'u9', name: 'Zed', email: 'zed@x.com' },
            role: 'reader',
          }),
      });
      const component = build({ team: makeTeam() });

      component.addMember();

      expect(component.members).toHaveLength(1);
      expect(component.members[0].user_id).toBe('u9');
      expect(component.dirty).toBe(true);
    });

    it('does not add a duplicate member', () => {
      mockDialog.open.mockReturnValue({
        afterClosed: () => of({ user: { internal_uuid: 'u1', name: 'Dup' }, role: 'reader' }),
      });
      const component = build({ team: makeTeam([{ user_id: 'u1' }] as TeamMember[]) });

      component.addMember();

      expect(component.members).toHaveLength(1);
    });

    it('does nothing when the picker is dismissed', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const component = build({ team: makeTeam() });

      component.addMember();

      expect(component.members).toHaveLength(0);
      expect(component.dirty).toBe(false);
    });
  });

  describe('onSave', () => {
    it('does nothing when not dirty', () => {
      const component = build({ team: makeTeam() });

      component.onSave();

      expect(mockTeamService.patch).not.toHaveBeenCalled();
    });

    it('patches the team members and closes the dialog on success', () => {
      const component = build({ team: makeTeam() });
      component.dirty = true;

      component.onSave();

      expect(mockTeamService.patch).toHaveBeenCalledWith('team-1', { members: [] });
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('surfaces the server error message on failure', () => {
      mockTeamService.patch.mockReturnValue(throwError(() => ({ error: { message: 'bad' } })));
      const component = build({ team: makeTeam() });
      component.dirty = true;

      component.onSave();

      expect(component.errorMessage).toBe('bad');
      expect(component.saving).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with false', () => {
      const component = build({ team: makeTeam() });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
    });
  });
});
