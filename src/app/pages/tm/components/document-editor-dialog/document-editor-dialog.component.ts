import { Component, Inject, Injector, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioModule } from '@angular/material/radio';
import { TooltipAriaLabelDirective } from '@app/shared/imports';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';

import { Document } from '../../models/threat-model.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { getUriSuggestionFromControl } from '@app/shared/utils/form-validation.util';
import { ContentTokenService } from '@app/core/services/content-token.service';
import { CONTENT_PROVIDERS } from '@app/core/services/content-provider-registry';
import { AccessDiagnosticsPanelComponent } from '@app/shared/components/access-diagnostics-panel/access-diagnostics-panel.component';
import type {
  ContentProviderId,
  ContentProviderMetadata,
  ContentTokenInfo,
  IContentPickerService,
  PickedFile,
  PickerRegistration,
} from '@app/core/models/content-provider.types';

/**
 * Interface for document form values
 */
interface DocumentFormValues {
  name: string;
  uri: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  picker_registration?: PickerRegistration;
}

/**
 * Interface for dialog data
 */
export interface DocumentEditorDialogData {
  document?: Document;
  mode: 'create' | 'edit';
  isReadOnly?: boolean;
}

@Component({
  selector: 'app-document-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatRadioModule,
    TooltipAriaLabelDirective,
    FormsModule,
    ReactiveFormsModule,
    TranslocoModule,
    AccessDiagnosticsPanelComponent,
  ],
  templateUrl: './document-editor-dialog.component.html',
  styleUrls: ['./document-editor-dialog.component.scss'],
})
export class DocumentEditorDialogComponent implements OnInit, OnDestroy {
  documentForm: FormGroup;
  mode: 'create' | 'edit';
  isReadOnly: boolean;

  selectedSource: 'url' | ContentProviderId = 'url';
  pickerSourceOptions: ContentProviderMetadata[] = Object.values(CONTENT_PROVIDERS).filter(
    p => p.supportsPicker,
  );
  linkedTokens: ContentTokenInfo[] = [];
  pickedFile: PickedFile | null = null;
  private _pickerRegistration: PickerRegistration | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private dialogRef: MatDialogRef<DocumentEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: DocumentEditorDialogData,
    private contentTokens: ContentTokenService,
    private injector: Injector,
  ) {
    this.mode = data.mode;
    this.isReadOnly = data.isReadOnly || false;

    this.documentForm = this.fb.group({
      name: [data.document?.name || '', [Validators.required, Validators.maxLength(256)]],
      uri: [
        data.document?.uri || '',
        [
          Validators.required,
          Validators.maxLength(1024),
          FormValidationService.validators.uriGuidance,
        ],
      ],
      description: [data.document?.description || '', Validators.maxLength(2048)],
      include_in_report: [data.mode === 'create' ? true : data.document?.include_in_report],
      timmy_enabled: [data.document?.timmy_enabled ?? true],
    });

    if (this.isReadOnly) {
      this.documentForm.disable();
    }
  }

  ngOnInit(): void {
    this.contentTokens.contentTokens$.pipe(takeUntil(this.destroy$)).subscribe(tokens => {
      this.linkedTokens = tokens ?? [];
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  hasLinkedToken(providerId: ContentProviderId): boolean {
    return this.linkedTokens.some(t => t.provider_id === providerId && t.status === 'active');
  }

  isProviderSelected(): boolean {
    return this.selectedSource !== 'url';
  }

  /**
   * Get URI validation suggestion message (if any)
   */
  getUriSuggestion(): string | null {
    return getUriSuggestionFromControl(this.documentForm.get('uri'));
  }

  onPickFile(): void {
    if (this.selectedSource === 'url') return;
    const meta = CONTENT_PROVIDERS[this.selectedSource];
    if (!meta) return;
    const svc = this.injector.get<IContentPickerService>(meta.pickerService);
    svc
      .pick()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: file => {
          if (!file) return;
          this.pickedFile = file;
          this._pickerRegistration = {
            provider_id: this.selectedSource as ContentProviderId,
            file_id: file.fileId,
            mime_type: file.mimeType,
          };
          this.documentForm.patchValue({ name: file.name, uri: file.url });
        },
      });
  }

  onLinkSource(): void {
    if (this.selectedSource === 'url') return;
    const providerId = this.selectedSource;
    const returnTo = window.location.pathname + window.location.search;
    this.contentTokens
      .authorize(providerId, returnTo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          window.location.href = res.authorization_url;
        },
      });
  }

  /**
   * Close the dialog with the document data
   */
  onSubmit(): void {
    const nameControl = this.documentForm.get('name');
    const uriControl = this.documentForm.get('uri');
    const descControl = this.documentForm.get('description');

    const hasBlockingErrors =
      nameControl?.hasError('required') ||
      nameControl?.hasError('maxlength') ||
      uriControl?.hasError('required') ||
      uriControl?.hasError('maxlength') ||
      descControl?.hasError('maxlength');

    if (hasBlockingErrors) {
      return;
    }

    const formValues = this.documentForm.getRawValue() as DocumentFormValues;
    if (this._pickerRegistration) {
      formValues.picker_registration = this._pickerRegistration;
    }
    this.dialogRef.close(formValues);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
