import { Component, Inject, Injector, OnInit, OnDestroy, DOCUMENT } from '@angular/core';
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
import {
  ContentTokenService,
  buildContentAuthorizeErrorMessage,
} from '@app/core/services/content-token.service';
import { CONTENT_PROVIDERS } from '@app/core/services/content-provider-registry';
import {
  ContentProvidersService,
  type SelectableSource,
} from '@app/core/services/content-providers.service';
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
  type ContentTokenInfo,
  type IContentPickerService,
  type PickedFile,
  type PickerContext,
  type PickerEvent,
  type PickerRegistration,
} from '@app/core/models/content-provider.types';

/**
 * Patterns that detect provider URLs pasted into the URL field. When a paste
 * matches a provider that the server advertises, the dialog auto-switches to
 * that provider's tile so the user gets the right post-create UX (e.g. the
 * share-with-service-account prompt for Google Drive).
 */
const URL_PROVIDER_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: 'google_drive',
    pattern: /^https?:\/\/(?:docs|drive)\.google\.com\//i,
  },
  {
    id: 'google_workspace',
    pattern: /^https?:\/\/(?:docs|drive)\.google\.com\//i,
  },
  {
    id: 'microsoft',
    pattern: /^https?:\/\/[^/]*\.(?:sharepoint\.com|onedrive\.live\.com|1drv\.ms)\//i,
  },
];

/** Form values returned by the dialog to its caller. */
interface DocumentFormValues {
  name: string;
  uri: string;
  description?: string;
  include_in_report?: boolean;
  timmy_enabled?: boolean;
  picker_registration?: PickerRegistration;
}

/** Result the dialog returns. The caller decides how to react. */
export interface DocumentEditorDialogResult {
  /** Form values gathered from the user. Always present on save. */
  values: DocumentFormValues;
  /** Source kind that produced these values, for caller dispatch. */
  sourceKind: 'url' | 'delegated' | 'service';
  /** Provider id when sourceKind !== 'url'. */
  providerId?: string;
  /** When the dialog already created the document in-place (service-mode flow). */
  createdDocument?: Document;
}

/** Dialog data input. */
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

/**
 * Internal phase for the create flow. Service-mode submissions transition to
 * 'post-create' so the user can copy the share-with-SA email and recheck access
 * without the dialog closing and reopening (Option X — in-place transition).
 */
type DialogPhase = 'form' | 'creating' | 'post-create';

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

  /** 'url' or a server-advertised provider id. */
  selectedSource: string = 'url';

  /** Sources from the server, joined with the client capability registry. */
  sourceOptions: SelectableSource[] = [];

  linkedTokens: ContentTokenInfo[] = [];
  pickedFile: PickedFile | null = null;
  currentDocument: Document | undefined;
  finalizing = false;
  finalizingMessageKey: string | null = null;
  pickerError: PickerErrorState | null = null;

  /** Drives template branching for service-mode in-place transitions. */
  phase: DialogPhase = 'form';

  /** Inline error shown when the in-place create call fails. */
  createErrorKey: string | null = null;

  /**
   * True while a Google Picker (or other third-party file picker) iframe is
   * open. The dialog hides itself (visibility + pointer-events suppressed)
   * during this window so the picker isn't visually trapped behind the CDK
   * overlay's stacking context. Component stays mounted — form state is
   * preserved and restored when the picker resolves.
   */
  pickingInProgress = false;

  private _pickerRegistration: PickerRegistration | null = null;
  private _suppressPasteDetection = false;

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
    private contentProviders: ContentProvidersService,
    @Inject(DOCUMENT) private htmlDocument: globalThis.Document,
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

    this.contentProviders.selectableSources$.pipe(takeUntil(this.destroy$)).subscribe(sources => {
      this.sourceOptions = sources;
    });

    this.documentForm
      .get('uri')!
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(value => this._onUriChanged(typeof value === 'string' ? value : ''));

    this._refreshDocumentIfPending();
  }

  /**
   * URL-paste auto-detection: if the user pastes a URL that matches a known
   * provider AND that provider is currently advertised by the server, switch
   * the radio so the post-create UX (e.g. share-prompt for Google Drive) kicks
   * in. Only applies in create mode and only when the user is on the URL tile.
   */
  private _onUriChanged(value: string): void {
    if (this._suppressPasteDetection) return;
    if (this.mode !== 'create' || this.selectedSource !== 'url') return;
    if (!value || value.length < 8) return;

    const advertisedIds = new Set(this.sourceOptions.map(s => s.id));
    for (const { id, pattern } of URL_PROVIDER_PATTERNS) {
      if (advertisedIds.has(id) && pattern.test(value)) {
        this.selectedSource = id;
        return;
      }
    }
  }

  /** Called by the radio change handler when the user switches manually. */
  onSourceChange(value: string): void {
    this.selectedSource = value;
    this.pickerError = null;
    this.pickedFile = null;
    this._pickerRegistration = null;
  }

  /** Look up the currently selected source's metadata, if any. */
  get selectedSourceMeta(): SelectableSource | null {
    if (this.selectedSource === 'url') return null;
    return this.sourceOptions.find(s => s.id === this.selectedSource) ?? null;
  }

  /** True when the selected source uses the delegated link/picker flow. */
  get isDelegatedSourceSelected(): boolean {
    return this.selectedSourceMeta?.kind === 'delegated';
  }

  /** True when the selected source is service-mode (URL-only with share-prompt). */
  get isServiceSourceSelected(): boolean {
    return this.selectedSourceMeta?.kind === 'service';
  }

  /**
   * True when the selected service-mode source advertises picker_config from
   * the server, has a picker service registered client-side, and we can offer
   * an in-browser file picker. Otherwise falls back to URL-paste only.
   */
  get canPickServiceModeFile(): boolean {
    const meta = this.selectedSourceMeta;
    if (!meta || meta.kind !== 'service') return false;
    if (!meta.hasPicker) return false;
    if (!meta.pickerConfig?.['client_id']) return false;
    return true;
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

          if (this.phase === 'post-create' && doc.access_status === 'accessible') {
            this._closeWithCreated(doc);
          }
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
    // Defensive: ensure the body class is cleared if the component is torn
    // down with a picker still open (e.g. user navigates away).
    if (this.pickingInProgress) {
      this._setPickingInProgress(false);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  hasLinkedToken(providerId: string): boolean {
    return this.linkedTokens.some(t => t.provider_id === providerId && t.status === 'active');
  }

  isProviderSelected(): boolean {
    return this.selectedSource !== 'url';
  }

  /** Disabled while a finalizing-grant call is in flight to prevent orphan grants. */
  isCancelDisabled(): boolean {
    return this.finalizing || this.phase === 'creating';
  }

  /** Disabled while finalizing or creating — submit would race in-flight calls. */
  isSubmitDisabled(): boolean {
    return this.documentForm.invalid || this.finalizing || this.phase === 'creating';
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

  /** Translation key (or raw display name) for the selected source's display. */
  displayNameForSource(s: SelectableSource): string {
    return s.displayNameKey ?? s.displayName;
  }

  /** Hint copy for service-mode URL field (provider-specific). */
  serviceUrlHintKey(): string {
    return 'documentEditor.source.serviceUrlHint';
  }

  /**
   * Get URI validation suggestion message (if any)
   */
  getUriSuggestion(): string | null {
    return getUriSuggestionFromControl(this.documentForm.get('uri'));
  }

  onPickFile(): void {
    if (this.selectedSource === 'url') return;
    const meta = CONTENT_PROVIDERS[this.selectedSource as ContentProviderId];
    if (!meta) return;

    const sourceMeta = this.selectedSourceMeta;
    let context: PickerContext | undefined;
    if (sourceMeta?.kind === 'service') {
      if (!sourceMeta.pickerConfig?.['client_id']) {
        this.logger.warn(
          'GoogleDrivePickerService invoked for service-mode without picker_config; ' +
            'falling back to URL-paste UX.',
          { providerId: sourceMeta.id },
        );
        return;
      }
      context = { mode: 'service', pickerConfig: sourceMeta.pickerConfig };
    }

    this.pickerError = null;
    this._setPickingInProgress(true);
    const svc = this.injector.get<IContentPickerService>(meta.pickerService);
    svc
      .pick(context)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (event: PickerEvent) => this._handlePickerEvent(event),
        error: err => this._handlePickerError(err),
      });
  }

  /**
   * Toggle the body-level class that hides the CDK overlay container while a
   * third-party picker is open. Hiding the container (not just our component)
   * prevents the dialog's stacking context from trapping the picker behind it.
   * Picker DOM is injected directly on document.body and remains visible.
   */
  private _setPickingInProgress(active: boolean): void {
    this.pickingInProgress = active;
    const body = this.htmlDocument.body;
    if (!body) return;
    if (active) {
      body.classList.add('picker-in-progress');
    } else {
      body.classList.remove('picker-in-progress');
    }
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
        this._setPickingInProgress(false);
        return;
      case 'picked': {
        this.finalizing = false;
        this.finalizingMessageKey = null;
        this._setPickingInProgress(false);
        this.pickedFile = event.file;
        // picker_registration is a delegated-mode artifact; service-mode dispatches
        // via content_source on the server and doesn't carry a per-document grant.
        if (this.isDelegatedSourceSelected) {
          this._pickerRegistration = {
            provider_id: this.selectedSource as PickerRegistration['provider_id'],
            file_id: event.file.fileId,
            mime_type: event.file.mimeType,
          };
        }
        this._suppressPasteDetection = true;
        this.documentForm.patchValue({ name: event.file.name, uri: event.file.url });
        this._suppressPasteDetection = false;
      }
    }
  }

  private _handlePickerError(err: unknown): void {
    this.finalizing = false;
    this.finalizingMessageKey = null;
    this.pickedFile = null;
    this._pickerRegistration = null;
    this._setPickingInProgress(false);
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
    const providerId = this.selectedSource as ContentProviderId;
    const returnTo = window.location.pathname + window.location.search;
    this.contentTokens
      .authorize(providerId, returnTo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          window.location.href = res.authorization_url;
        },
        error: (err: unknown) => {
          this.logger.error('Failed to initiate content token authorize', err);
          this.snackBar.open(
            buildContentAuthorizeErrorMessage(err, providerId, this.transloco),
            undefined,
            { duration: 6000 },
          );
        },
      });
  }

  /**
   * On submit:
   * - Service-mode create: dialog owns the create call so it can transition
   *   in-place to the post-create share-prompt view (Option X).
   * - All other cases (delegated create, edit, plain URL create): close the
   *   dialog and let the caller perform the API call as before.
   */
  onSubmit(): void {
    if (!this._validateForm()) return;

    const formValues = this._collectFormValues();

    if (this.mode === 'create' && this.isServiceSourceSelected && this.data.threatModelId) {
      this._createServiceModeInPlace(formValues);
      return;
    }

    const result: DocumentEditorDialogResult = {
      values: formValues,
      sourceKind: this._currentSourceKind(),
      providerId: this.selectedSource === 'url' ? undefined : this.selectedSource,
    };
    this.dialogRef.close(result);
  }

  private _validateForm(): boolean {
    const nameControl = this.documentForm.get('name');
    const uriControl = this.documentForm.get('uri');
    const descControl = this.documentForm.get('description');

    const hasBlockingErrors =
      nameControl?.hasError('required') ||
      nameControl?.hasError('maxlength') ||
      uriControl?.hasError('required') ||
      uriControl?.hasError('maxlength') ||
      descControl?.hasError('maxlength');

    return !hasBlockingErrors;
  }

  private _collectFormValues(): DocumentFormValues {
    const formValues = this.documentForm.getRawValue() as DocumentFormValues;
    if (this._pickerRegistration && this.isDelegatedSourceSelected) {
      formValues.picker_registration = this._pickerRegistration;
    }
    return formValues;
  }

  private _currentSourceKind(): 'url' | 'delegated' | 'service' {
    const meta = this.selectedSourceMeta;
    if (!meta) return 'url';
    return meta.kind;
  }

  /**
   * Create the document via the API while the dialog stays open, then
   * transition the view to the share-with-service-account panel driven by
   * the existing AccessDiagnosticsPanelComponent.
   */
  private _createServiceModeInPlace(values: DocumentFormValues): void {
    if (!this.data.threatModelId) return;
    this.phase = 'creating';
    this.createErrorKey = null;

    const payload: Partial<Document> = {
      name: values.name,
      uri: values.uri,
      description: values.description || undefined,
      include_in_report: values.include_in_report,
      timmy_enabled: values.timmy_enabled,
    };

    this.threatModelService
      .createDocument(this.data.threatModelId, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: created => {
          this.currentDocument = created;
          if (created.access_status === 'pending_access') {
            this.phase = 'post-create';
          } else {
            this._closeWithCreated(created);
          }
        },
        error: err => {
          this.logger.error('In-place service-mode document create failed', err);
          this.phase = 'form';
          this.createErrorKey = 'documentEditor.create.failed';
        },
      });
  }

  private _closeWithCreated(created: Document): void {
    const result: DocumentEditorDialogResult = {
      values: this._collectFormValues(),
      sourceKind: 'service',
      providerId: this.selectedSource === 'url' ? undefined : this.selectedSource,
      createdDocument: created,
    };
    this.dialogRef.close(result);
  }

  /** "Done" button in post-create phase — user accepts pending state and exits. */
  onPostCreateDone(): void {
    if (this.currentDocument) {
      this._closeWithCreated(this.currentDocument);
    } else {
      this.dialogRef.close();
    }
  }

  onCancel(): void {
    if (this.finalizing || this.phase === 'creating') return;
    this.dialogRef.close();
  }
}
