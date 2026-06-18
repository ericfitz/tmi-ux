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
  RelatedProjectsDialogComponent,
  RelatedProjectsDialogData,
} from './related-projects-dialog.component';
import type { Project, RelatedProject, ProjectListItem } from '@app/types/project.types';

describe('RelatedProjectsDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockProjectService: { list: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  const otherProject: ProjectListItem = { id: 'proj-9', name: 'Other Project' } as ProjectListItem;

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: build a minimal test Project fixture with optional related projects (pure)
  function makeProject(related: RelatedProject[] = []): Project {
    return { id: 'proj-1', name: 'Project A', related_projects: related } as Project;
  }

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: construct and initialize a RelatedProjectsDialogComponent with mock dependencies for testing (pure)
  function build(data: RelatedProjectsDialogData): RelatedProjectsDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new RelatedProjectsDialogComponent(
          mockDialogRef as never,
          data,
          new FormBuilder(),
          mockProjectService as never,
          mockLogger as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockProjectService = {
      list: vi.fn(() => of({ projects: [otherProject] })),
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

  it('should create, copying the related projects', () => {
    const related = [{ related_project_id: 'proj-2', relationship: 'parent' }] as RelatedProject[];
    const component = build({ project: makeProject(related) });

    expect(component.relatedProjects).toEqual(related);
    expect(component.relatedProjects).not.toBe(related);
  });

  describe('displayProject', () => {
    it('returns the project name', () => {
      const component = build({ project: makeProject() });

      expect(component.displayProject(otherProject)).toBe('Other Project');
    });
  });

  describe('onProjectSelected', () => {
    it('stores the selected project', () => {
      const component = build({ project: makeProject() });

      component.onProjectSelected({
        option: { value: otherProject },
      } as MatAutocompleteSelectedEvent);

      expect(component.selectedProject).toBe(otherProject);
    });
  });

  describe('addRelated', () => {
    it('does nothing when no project is selected', () => {
      const component = build({ project: makeProject() });
      component.addForm.get('relationship')?.setValue('peer');

      component.addRelated();

      expect(component.relatedProjects).toHaveLength(0);
    });

    it('adds the selected project with its relationship and resets the form', () => {
      const component = build({ project: makeProject() });
      component.selectedProject = otherProject;
      component.addForm.get('relationship')?.setValue('peer');

      component.addRelated();

      expect(component.relatedProjects).toHaveLength(1);
      expect(component.relatedProjects[0].related_project_id).toBe('proj-9');
      expect(component.relatedProjects[0].relationship).toBe('peer');
      expect(component.projectNames.get('proj-9')).toBe('Other Project');
      expect(component.dirty).toBe(true);
      expect(component.showAddForm).toBe(false);
    });

    it('does not add a duplicate related project', () => {
      const component = build({
        project: makeProject([
          { related_project_id: 'proj-9', relationship: 'peer' },
        ] as RelatedProject[]),
      });
      component.selectedProject = otherProject;
      component.addForm.get('relationship')?.setValue('parent');

      component.addRelated();

      expect(component.relatedProjects).toHaveLength(1);
    });
  });

  describe('removeRelated', () => {
    it('removes the matching related project and marks dirty', () => {
      const component = build({
        project: makeProject([
          { related_project_id: 'proj-2', relationship: 'peer' },
          { related_project_id: 'proj-3', relationship: 'parent' },
        ] as RelatedProject[]),
      });

      component.removeRelated({
        related_project_id: 'proj-2',
        relationship: 'peer',
      } as RelatedProject);

      expect(component.relatedProjects.map(r => r.related_project_id)).toEqual(['proj-3']);
      expect(component.dirty).toBe(true);
    });
  });

  describe('cancelAddForm', () => {
    it('hides the add form and clears the selection', () => {
      const component = build({ project: makeProject() });
      component.showAddForm = true;
      component.selectedProject = otherProject;

      component.cancelAddForm();

      expect(component.showAddForm).toBe(false);
      expect(component.selectedProject).toBeNull();
    });
  });

  describe('onSave', () => {
    it('does nothing when not dirty', () => {
      const component = build({ project: makeProject() });

      component.onSave();

      expect(mockProjectService.patch).not.toHaveBeenCalled();
    });

    it('patches the related projects and closes on success', () => {
      const component = build({ project: makeProject() });
      component.dirty = true;

      component.onSave();

      expect(mockProjectService.patch).toHaveBeenCalledWith('proj-1', { related_projects: [] });
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('surfaces the server error message on failure', () => {
      mockProjectService.patch.mockReturnValue(throwError(() => ({ error: { message: 'bad' } })));
      const component = build({ project: makeProject() });
      component.dirty = true;

      component.onSave();

      expect(component.errorMessage).toBe('bad');
      expect(component.saving).toBe(false);
    });
  });

  describe('onCancel', () => {
    it('closes the dialog with false', () => {
      const component = build({ project: makeProject() });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith(false);
    });
  });
});
