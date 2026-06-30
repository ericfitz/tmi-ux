import { Component, Inject, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TooltipAriaLabelDirective } from '@app/shared/imports';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { Repository } from '../../models/threat-model.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { getUriSuggestionFromControl } from '@app/shared/utils/form-validation.util';

/**
 * Interface for repository form values
 */
interface RepositoryFormValues {
  name: string;
  description?: string;
  type: 'git' | 'svn' | 'mercurial' | 'other';
  uri: string;
  refType?: 'branch' | 'tag' | 'commit';
  refValue?: string;
  subPath?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
}

/**
 * Interface for dialog data
 */
export interface RepositoryEditorDialogData {
  repository?: Repository;
  mode: 'create' | 'edit';
  isReadOnly?: boolean;
}

@Component({
  selector: 'app-repository-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatCheckboxModule,
    MatTooltipModule,
    TooltipAriaLabelDirective,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './repository-editor-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./repository-editor-dialog.component.scss'],
})
// SEM@23d2e9645a0d6cce61ba5b795b2751498771352d: dialog for creating, editing, or viewing a repository entry
export class RepositoryEditorDialogComponent implements OnInit, OnDestroy {
  repositoryForm: FormGroup;
  mode: 'create' | 'edit';
  isReadOnly: boolean;

  private _subscriptions: Subscription = new Subscription();

  // SEM@cee4a5ff46c0649755a9808fdf31ce0eea5f0a3e: initialize repository form from dialog data and disable if read-only (mutates shared state)
  constructor(
    private dialogRef: MatDialogRef<RepositoryEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: RepositoryEditorDialogData,
  ) {
    this.mode = data.mode;
    this.isReadOnly = data.isReadOnly || false;
    this.repositoryForm = this.buildForm(data);

    if (this.isReadOnly) {
      this.repositoryForm.disable();
    }
  }

  // SEM@23d2e9645a0d6cce61ba5b795b2751498771352d: build a validated reactive form pre-populated with repository data (pure)
  private buildForm(data: RepositoryEditorDialogData): FormGroup {
    const repo = data.repository;
    const params = repo?.parameters;
    return this.fb.group({
      name: [repo?.name || '', [Validators.required, Validators.maxLength(256)]],
      description: [repo?.description || '', Validators.maxLength(2048)],
      type: [repo?.type || 'git', Validators.required],
      uri: [
        repo?.uri || '',
        [
          Validators.required,
          Validators.maxLength(1024),
          FormValidationService.validators.uriGuidance,
        ],
      ],
      refType: [params?.refType || 'branch'],
      refValue: [params?.refValue || '', Validators.maxLength(256)],
      subPath: [params?.subPath || '', Validators.maxLength(256)],
      include_in_report: [data.mode === 'create' ? true : repo?.include_in_report],
      timmy_enabled: [repo?.timmy_enabled ?? true],
    });
  }

  // SEM@df857842acb683048164ddc3b37030f666db756c: Angular lifecycle hook; no-op initialization placeholder
  ngOnInit(): void {
    // Component initialization complete
  }

  // SEM@0b80acf835f1ad7f9fc0e5cbaf2bc4f125615152: unsubscribe all subscriptions on component teardown (mutates shared state)
  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /**
   * Get URI validation suggestion message (if any)
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: return URI validation suggestion message from the form control, or null (pure)
  getUriSuggestion(): string | null {
    return getUriSuggestionFromControl(this.repositoryForm.get('uri'));
  }

  /**
   * Close the dialog with the repository data
   */
  // SEM@a5d47afbe751f0027d056ced66949574212e626e: validate form and close dialog with repository data on success
  onSubmit(): void {
    // Only check for blocking errors (required, maxLength)
    // Allow submission even with URI suggestions
    const nameControl = this.repositoryForm.get('name');
    const descControl = this.repositoryForm.get('description');
    const typeControl = this.repositoryForm.get('type');
    const uriControl = this.repositoryForm.get('uri');
    const refValueControl = this.repositoryForm.get('refValue');
    const subPathControl = this.repositoryForm.get('subPath');

    const hasBlockingErrors =
      nameControl?.hasError('required') ||
      nameControl?.hasError('maxlength') ||
      descControl?.hasError('maxlength') ||
      typeControl?.hasError('required') ||
      uriControl?.hasError('required') ||
      uriControl?.hasError('maxlength') ||
      refValueControl?.hasError('maxlength') ||
      subPathControl?.hasError('maxlength');

    if (hasBlockingErrors) {
      return;
    }

    const formValues = this.repositoryForm.getRawValue() as RepositoryFormValues;

    // Build the result with proper structure
    const result = {
      name: formValues.name,
      description: formValues.description,
      type: formValues.type,
      uri: formValues.uri,
      parameters: formValues.refValue
        ? {
            refType: formValues.refType || 'branch',
            refValue: formValues.refValue,
            subPath: formValues.subPath,
          }
        : undefined,
      include_in_report: formValues.include_in_report,
      timmy_enabled: formValues.timmy_enabled,
    };

    this.dialogRef.close(result);
  }

  /**
   * Close the dialog without saving
   */
  // SEM@bb45011ce0669ca0e59b0f729627aa9f7068a67a: close the dialog without returning any repository data
  onCancel(): void {
    this.dialogRef.close();
  }
}
