// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormBuilder } from '@angular/forms';

import {
  RepositoryEditorDialogComponent,
  RepositoryEditorDialogData,
} from './repository-editor-dialog.component';
import type { Repository } from '../../models/threat-model.model';

describe('RepositoryEditorDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  // SEM@417a9151d82d6abf834b61ca217dace46154b149: build a RepositoryEditorDialogComponent instance for unit tests (pure)
  function build(data: RepositoryEditorDialogData): RepositoryEditorDialogComponent {
    return new RepositoryEditorDialogComponent(mockDialogRef as never, new FormBuilder(), data);
  }

  const existingRepo: Repository = {
    id: 'r1',
    name: 'app-repo',
    description: 'Application source',
    type: 'git',
    uri: 'https://github.com/example/app',
    parameters: { refType: 'tag', refValue: 'v1.0', subPath: 'src' },
    include_in_report: false,
    timmy_enabled: false,
    created_at: '2024-01-01',
    modified_at: '2024-01-01',
  };

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
  });

  describe('create mode', () => {
    let component: RepositoryEditorDialogComponent;

    beforeEach(() => {
      component = build({ mode: 'create' });
    });

    it('should create', () => {
      expect(component).toBeTruthy();
      expect(component.mode).toBe('create');
    });

    it('starts with an empty, git-typed form', () => {
      expect(component.repositoryForm.get('name')?.value).toBe('');
      expect(component.repositoryForm.get('type')?.value).toBe('git');
      expect(component.repositoryForm.get('uri')?.value).toBe('');
    });

    it('defaults include_in_report to true and timmy_enabled to true in create mode', () => {
      expect(component.repositoryForm.get('include_in_report')?.value).toBe(true);
      expect(component.repositoryForm.get('timmy_enabled')?.value).toBe(true);
    });

    it('is invalid until name and uri are provided', () => {
      expect(component.repositoryForm.invalid).toBe(true);

      component.repositoryForm.patchValue({ name: 'repo', uri: 'https://x/y' });
      expect(component.repositoryForm.get('name')?.hasError('required')).toBe(false);
      expect(component.repositoryForm.get('uri')?.hasError('required')).toBe(false);
    });

    it('flags a name longer than 256 characters', () => {
      component.repositoryForm.patchValue({ name: 'a'.repeat(257) });
      expect(component.repositoryForm.get('name')?.hasError('maxlength')).toBe(true);
    });
  });

  describe('edit mode', () => {
    let component: RepositoryEditorDialogComponent;

    beforeEach(() => {
      component = build({ mode: 'edit', repository: existingRepo });
    });

    it('pre-populates the form from the repository', () => {
      expect(component.repositoryForm.get('name')?.value).toBe('app-repo');
      expect(component.repositoryForm.get('type')?.value).toBe('git');
      expect(component.repositoryForm.get('uri')?.value).toBe('https://github.com/example/app');
      expect(component.repositoryForm.get('refType')?.value).toBe('tag');
      expect(component.repositoryForm.get('refValue')?.value).toBe('v1.0');
    });

    it('preserves the repository include_in_report value in edit mode', () => {
      expect(component.repositoryForm.get('include_in_report')?.value).toBe(false);
    });
  });

  describe('read-only mode', () => {
    it('disables the form when isReadOnly is set', () => {
      const component = build({ mode: 'edit', repository: existingRepo, isReadOnly: true });

      expect(component.isReadOnly).toBe(true);
      expect(component.repositoryForm.disabled).toBe(true);
    });
  });

  describe('onSubmit', () => {
    it('closes the dialog with the repository data including parameters', () => {
      const component = build({ mode: 'create' });
      component.repositoryForm.patchValue({
        name: 'new-repo',
        type: 'git',
        uri: 'https://github.com/x/y',
        refType: 'branch',
        refValue: 'main',
        subPath: 'pkg',
      });

      component.onSubmit();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result.name).toBe('new-repo');
      expect(result.parameters).toEqual({
        refType: 'branch',
        refValue: 'main',
        subPath: 'pkg',
      });
    });

    it('omits parameters when no refValue is provided', () => {
      const component = build({ mode: 'create' });
      component.repositoryForm.patchValue({
        name: 'new-repo',
        type: 'git',
        uri: 'https://github.com/x/y',
        refValue: '',
      });

      component.onSubmit();

      expect(mockDialogRef.close.mock.calls[0][0].parameters).toBeUndefined();
    });

    it('does not close the dialog when a required field is missing', () => {
      const component = build({ mode: 'create' });
      // name and uri left empty
      component.onSubmit();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog without a result', () => {
      const component = build({ mode: 'create' });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
