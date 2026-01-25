import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormGroup,
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import {
  Addon,
  AddonObjectType,
  InvokeAddonRequest,
  InvokeAddonResponse,
} from '@app/types/addon.types';
import { AddonService } from '@app/core/services/addon.service';
import { LoggerService } from '@app/core/services/logger.service';
import { UserPreferencesService } from '@app/core/services/user-preferences.service';

/**
 * Data passed to the InvokeAddonDialog
 */
export interface InvokeAddonDialogData {
  /** The addon being invoked */
  addon: Addon;
  /** Threat model ID (required) */
  threatModelId: string;
  /** Threat model name for display */
  threatModelName: string;
  /** Object type being operated on */
  objectType: AddonObjectType;
  /** True for card-level (all objects), false for row-level (single object) */
  isBulk: boolean;
  /** Object ID (optional - only for row-level invocations) */
  objectId?: string;
  /** Object name for display (optional - only for row-level invocations) */
  objectName?: string;
}

/**
 * Result returned from the dialog
 */
export interface InvokeAddonDialogResult {
  /** Whether the invocation was submitted */
  submitted: boolean;
  /** The invocation response (if submitted) */
  response?: InvokeAddonResponse;
}

/**
 * Custom validator for JSON format
 */
function jsonValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value as string;
    if (!value || value.trim() === '') {
      return null; // Empty is valid (payload is optional)
    }
    try {
      JSON.parse(value);
      return null;
    } catch {
      return { jsonInvalid: true };
    }
  };
}

/**
 * Invoke Addon Dialog Component
 *
 * Dialog for invoking addons with context-specific parameters.
 * Displays addon info, context, and optional JSON payload input.
 */
@Component({
  selector: 'app-invoke-addon-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './invoke-addon-dialog.component.html',
  styleUrls: ['./invoke-addon-dialog.component.scss'],
})
export class InvokeAddonDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  invoking = false;
  errorMessage = '';
  showDeveloperTools = false;

  /** Maximum characters allowed in payload */
  readonly MAX_PAYLOAD_LENGTH = 1000;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: InvokeAddonDialogData,
    private dialogRef: MatDialogRef<InvokeAddonDialogComponent>,
    private addonService: AddonService,
    private fb: FormBuilder,
    private logger: LoggerService,
    private transloco: TranslocoService,
    private userPreferencesService: UserPreferencesService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      payload: ['', [jsonValidator()]],
    });

    // Subscribe to user preferences to get showDeveloperTools setting
    this.userPreferencesService.preferences$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(prefs => {
        this.showDeveloperTools = prefs.showDeveloperTools;
      });
  }

  /**
   * Get addon icon for display (strips material-symbols: prefix)
   */
  getAddonIcon(): string {
    if (!this.data.addon.icon) {
      return 'extension';
    }
    return this.data.addon.icon.replace('material-symbols:', '');
  }

  /**
   * Get translation key for object type display
   * Maps snake_case API values to camelCase translation keys
   */
  getObjectTypeTranslationKey(): string {
    const typeMap: Record<AddonObjectType, string> = {
      threat_model: 'common.objectTypes.threatModel',
      diagram: 'common.objectTypes.diagram',
      asset: 'common.objectTypes.asset',
      threat: 'common.objectTypes.threat',
      document: 'common.objectTypes.document',
      note: 'common.objectTypes.note',
      repository: 'common.objectTypes.repository',
      metadata: 'common.objectTypes.metadata',
    };
    return typeMap[this.data.objectType] || this.data.objectType;
  }

  /**
   * Check if OK button should be enabled
   */
  get canInvoke(): boolean {
    return (
      this.form.valid &&
      !this.invoking &&
      !!this.data.addon?.id &&
      !!this.data.threatModelId &&
      !!this.data.objectType
    );
  }

  /**
   * Handle invoke button click
   */
  onInvoke(): void {
    if (!this.canInvoke) {
      return;
    }

    this.invoking = true;
    this.errorMessage = '';

    const payloadStr = this.form.get('payload')?.value as string;
    let payload: Record<string, unknown> | undefined;

    if (payloadStr && payloadStr.trim()) {
      try {
        // Parse and re-stringify to minify and normalize the JSON
        const parsed = JSON.parse(payloadStr) as Record<string, unknown>;
        payload = JSON.parse(JSON.stringify(parsed)) as Record<string, unknown>;
      } catch {
        // Should not happen due to validator, but handle gracefully
        this.errorMessage = this.transloco.translate('addons.invokeDialog.invalidJson');
        this.invoking = false;
        return;
      }
    }

    const request: InvokeAddonRequest = {
      threat_model_id: this.data.threatModelId,
      object_type: this.data.objectType,
      ...(this.data.objectId && { object_id: this.data.objectId }),
      ...(payload && { payload }),
    };

    this.addonService
      .invoke(this.data.addon.id, request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.logger.info('Addon invocation accepted', {
            invocation_id: response.invocation_id,
          });
          const result: InvokeAddonDialogResult = { submitted: true, response };
          this.dialogRef.close(result);
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to invoke addon', error);
          this.errorMessage =
            error.error?.message || this.transloco.translate('addons.invokeDialog.errorInvoking');
          this.invoking = false;
        },
      });
  }

  /**
   * Handle cancel button click
   */
  onCancel(): void {
    const result: InvokeAddonDialogResult = { submitted: false };
    this.dialogRef.close(result);
  }
}
