// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { FormBuilder } from '@angular/forms';
import type { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { of, throwError } from 'rxjs';

import {
  RelatedTeamsDialogComponent,
  RelatedTeamsDialogData,
} from './related-teams-dialog.component';
import type { Team, RelatedTeam, TeamListItem } from '@app/types/team.types';

describe('RelatedTeamsDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockTeamService: { list: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  const otherTeam: TeamListItem = { id: 'team-9', name: 'Other Team' } as TeamListItem;

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: build a test Team fixture with optional related teams list (pure)
  function makeTeam(related: RelatedTeam[] = []): Team {
    return { id: 'team-1', name: 'Team A', related_teams: related } as Team;
  }

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: construct and initialize a RelatedTeamsDialogComponent under test injection context (pure)
  function build(data: RelatedTeamsDialogData): RelatedTeamsDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new RelatedTeamsDialogComponent(
          mockDialogRef as never,
          data,
          new FormBuilder(),
          mockTeamService as never,
          mockLogger as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockTeamService = {
      list: vi.fn(() => of({ teams: [otherTeam] })),
      patch: vi.fn(() => of({})),
    };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should create, copying the related teams', () => {
    const related = [{ related_team_id: 'team-2', relationship: 'parent' }] as RelatedTeam[];
    const component = build({ team: makeTeam(related) });

    expect(component.relatedTeams).toEqual(related);
    expect(component.relatedTeams).not.toBe(related);
  });

  describe('displayTeam', () => {
    it('returns the team name', () => {
      const component = build({ team: makeTeam() });

      expect(component.displayTeam(otherTeam)).toBe('Other Team');
    });
  });

  describe('onTeamSelected', () => {
    it('stores the selected team', () => {
      const component = build({ team: makeTeam() });

      component.onTeamSelected({ option: { value: otherTeam } } as MatAutocompleteSelectedEvent);

      expect(component.selectedTeam).toBe(otherTeam);
    });
  });

  describe('addRelated', () => {
    it('does nothing when no team is selected', () => {
      const component = build({ team: makeTeam() });
      component.addForm.get('relationship')?.setValue('peer');

      component.addRelated();

      expect(component.relatedTeams).toHaveLength(0);
    });

    it('adds the selected team with its relationship and resets the form', () => {
      const component = build({ team: makeTeam() });
      component.selectedTeam = otherTeam;
      component.addForm.get('relationship')?.setValue('peer');

      component.addRelated();

      expect(component.relatedTeams).toHaveLength(1);
      expect(component.relatedTeams[0].related_team_id).toBe('team-9');
      expect(component.relatedTeams[0].relationship).toBe('peer');
      expect(component.teamNames.get('team-9')).toBe('Other Team');
      expect(component.dirty).toBe(true);
      expect(component.showAddForm).toBe(false);
    });

    it('does not add a duplicate related team', () => {
      const component = build({
        team: makeTeam([{ related_team_id: 'team-9', relationship: 'peer' }] as RelatedTeam[]),
      });
      component.selectedTeam = otherTeam;
      component.addForm.get('relationship')?.setValue('parent');

      component.addRelated();

      expect(component.relatedTeams).toHaveLength(1);
    });
  });

  describe('removeRelated', () => {
    it('removes the matching related team and marks dirty', () => {
      const component = build({
        team: makeTeam([
          { related_team_id: 'team-2', relationship: 'peer' },
          { related_team_id: 'team-3', relationship: 'parent' },
        ] as RelatedTeam[]),
      });

      component.removeRelated({ related_team_id: 'team-2', relationship: 'peer' } as RelatedTeam);

      expect(component.relatedTeams.map(r => r.related_team_id)).toEqual(['team-3']);
      expect(component.dirty).toBe(true);
    });
  });

  describe('cancelAddForm', () => {
    it('hides the add form and clears the selection', () => {
      const component = build({ team: makeTeam() });
      component.showAddForm = true;
      component.selectedTeam = otherTeam;

      component.cancelAddForm();

      expect(component.showAddForm).toBe(false);
      expect(component.selectedTeam).toBeNull();
    });
  });

  describe('onSave', () => {
    it('does nothing when not dirty', () => {
      const component = build({ team: makeTeam() });

      component.onSave();

      expect(mockTeamService.patch).not.toHaveBeenCalled();
    });

    it('patches the related teams and closes on success', () => {
      const component = build({ team: makeTeam() });
      component.dirty = true;

      component.onSave();

      expect(mockTeamService.patch).toHaveBeenCalledWith('team-1', { related_teams: [] });
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('surfaces the server error message on failure', () => {
      mockTeamService.patch.mockReturnValue(throwError(() => ({ error: { message: 'bad' } })));
      const component = build({ team: makeTeam() });
      component.dirty = true;

      component.onSave();

      expect(component.errorMessage).toBe('bad');
      expect(component.saving).toBe(false);
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
