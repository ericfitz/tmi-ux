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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TooltipAriaLabelDirective } from '@app/shared/imports';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';

import { Document } from '../../models/threat-model.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { getUriSuggestionFromControl } from '@app/shared/utils/form-validation.util';
import { ContentTokenService } from '@app/core/services/content-token.service';
import { CONTENT_PROVIDERS } from '@app/core/services/content-provider-registry';
import { AccessDiagnosticsPanelComponent } from '@app/shared/components/access-diagnostics-panel/access-diagnostics-panel.component';
import { ThreatModelService } from '../../services/threat-model.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  ContentTokenNotLinkedError,
  MicrosoftAccountNotLinkedError,
  MicrosoftGraphPermissionRejectedError,
  MicrosoftGraphUnavailableError,
  MicrosoftGrantTimeoutError,
  PickerLoadFailedError,
  type ContentProviderId,
  type ContentProviderMetadata,
  type ContentTokenInfo,
  type IContentPickerService,
  type PickedFile,
  type PickerEvent,
  type PickerRegistration,
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
  threatModelId?: string;
}

interface PickerErrorState {
  messageKey: string;
  showLinkAccountCta: boolean;
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
    MatProgressSpinnerModule,
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
  currentDocument: Document | undefined;
  finalizing = false;
  finalizingMessageKey: string | null = null;
  pickerError: PickerErrorState | null = null;
  private _pickerRegistration: PickerRegistration | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private dialogRef: MatDialogRef<DocumentEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: DocumentEditorDialogData,
    private contentTokens: ContentTokenService,
    private injector: Injector,
    private threatModelService: ThreatModelService,
    private snackBar: MatSnackBar,
    private transloco: TranslocoService,
    private logger: LoggerService,
  ) {
    this.mode = data.mode;
    this.isReadOnly = data.isReadOnly || false;
    this.currentDocument = data.document;

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
    this._refreshDocumentIfPending();
  }

  /**
   * If the editing document is pending_access and we have a threatModelId,
   * silently fetch the latest document state. Don't block dialog rendering.
   */
  private _refreshDocumentIfPending(): void {
    if (this.mode !== 'edit') return;
    if (!this.data.threatModelId || !this.data.document?.id) return;
    if (this.data.document.access_status !== 'pending_access') return;
    this.threatModelService
      .getDocument(this.data.threatModelId, this.data.document.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: doc => {
          this.currentDocument = doc;
        },
        error: err => {
          this.logger.warn('Failed to refresh document on dialog open', err);
        },
      });
  }

  /**
   * Triggered by AccessDiagnosticsPanel's `recheck` Output. POSTs the
   * request_access endpoint, then re-fetches the document.
   */
  onRecheckAccess(): void {
    if (!this.data.threatModelId || !this.currentDocument?.id) return;
    const tmId = this.data.threatModelId;
    const docId = this.currentDocument.id;
    this.threatModelService
      .requestDocumentAccess(tmId, docId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this._fetchAfterRecheck(tmId, docId),
        error: err => {
          // 409 means the document is no longer pending_access (likely already
          // accessible). Treat as success and let the GET resolve the new state.
          if (this._isStatus(err, 409)) {
            this._fetchAfterRecheck(tmId, docId);
            return;
          }
          this.logger.warn('request_access failed', err);
          this.snackBar.open(
            this.transloco.translate('documentAccess.checkNow.failed'),
            undefined,
            { duration: 3000 },
          );
        },
      });
  }

  private _isStatus(err: unknown, status: number): boolean {
    return typeof err === 'object' && err !== null && 'status' in err && err.status === status;
  }

  private _fetchAfterRecheck(threatModelId: string, documentId: string): void {
    this.threatModelService
      .getDocument(threatModelId, documentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: doc => {
          this.currentDocument = doc;
          const key =
            doc.access_status === 'accessible'
              ? 'documentAccess.checkNow.success'
              : 'documentAccess.checkNow.stillPending';
          this.snackBar.open(this.transloco.translate(key), undefined, { duration: 3000 });
        },
        error: err => {
          this.logger.warn('document GET after recheck failed', err);
          this.snackBar.open(
            this.transloco.translate('documentAccess.checkNow.failed'),
            undefined,
            { duration: 3000 },
          );
        },
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

  /** Disabled while a finalizing-grant call is in flight to prevent orphan grants. */
  isCancelDisabled(): boolean {
    return this.finalizing;
  }

  /** Disabled while finalizing — submit would race the picker registration. */
  isSubmitDisabled(): boolean {
    return this.documentForm.invalid || this.finalizing;
  }

  /**
   * Localization key for the picker action button. Microsoft uses a
   * provider-specific label; fall back to the generic key for others.
   */
  pickActionKey(): string {
    return this.selectedSource === 'microsoft'
      ? 'documentEditor.source.pickActionMicrosoft'
      : 'documentEditor.source.pickAction';
  }

  /** Localization key for the unlinked-account prompt, with Microsoft override. */
  linkPromptKey(): string {
    return this.selectedSource === 'microsoft'
      ? 'documentEditor.source.linkPromptMicrosoft'
      : 'documentEditor.source.linkPrompt';
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
    this.pickerError = null;
    const svc = this.injector.get<IContentPickerService>(meta.pickerService);
    svc
      .pick()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event: PickerEvent) => this._handlePickerEvent(event),
        error: err => this._handlePickerError(err),
      });
  }

  private _handlePickerEvent(event: PickerEvent): void {
    switch (event.kind) {
      case 'finalizing':
        this.finalizing = true;
        this.finalizingMessageKey = event.messageKey ?? 'documentEditor.source.finalizing';
        return;
      case 'cancelled':
        this.finalizing = false;
        this.finalizingMessageKey = null;
        return;
      case 'picked': {
        this.finalizing = false;
        this.finalizingMessageKey = null;
        this.pickedFile = event.file;
        this._pickerRegistration = {
          provider_id: this.selectedSource as ContentProviderId,
          file_id: event.file.fileId,
          mime_type: event.file.mimeType,
        };
        this.documentForm.patchValue({ name: event.file.name, uri: event.file.url });
      }
    }
  }

  private _handlePickerError(err: unknown): void {
    this.finalizing = false;
    this.finalizingMessageKey = null;
    this.pickedFile = null;
    this._pickerRegistration = null;
    this.pickerError = this._mapErrorToState(err);
    this.logger.warn('Picker failed', err);
  }

  private _mapErrorToState(err: unknown): PickerErrorState {
    if (
      err instanceof MicrosoftAccountNotLinkedError ||
      err instanceof ContentTokenNotLinkedError
    ) {
      return { messageKey: 'documentEditor.grantError.notLinked', showLinkAccountCta: true };
    }
    if (err instanceof MicrosoftGraphPermissionRejectedError) {
      return {
        messageKey: 'documentEditor.grantError.permissionDenied',
        showLinkAccountCta: false,
      };
    }
    if (err instanceof MicrosoftGraphUnavailableError) {
      return { messageKey: 'documentEditor.grantError.unavailable', showLinkAccountCta: false };
    }
    if (err instanceof MicrosoftGrantTimeoutError) {
      return { messageKey: 'documentEditor.grantError.timeout', showLinkAccountCta: false };
    }
    if (err instanceof PickerLoadFailedError) {
      return {
        messageKey: 'documentEditor.grantError.pickerLoadFailed',
        showLinkAccountCta: false,
      };
    }
    return { messageKey: 'documentEditor.grantError.generic', showLinkAccountCta: false };
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
    if (this.finalizing) return;
    this.dialogRef.close();
  }
}
