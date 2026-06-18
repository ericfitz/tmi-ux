import { Component, DestroyRef, inject, Inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, FormControl, ValidatorFn, Validators } from '@angular/forms';
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
  AddonParameter,
  InvokeAddonRequest,
  InvokeAddonResponse,
} from '@app/types/addon.types';
import { Metadata } from '@app/pages/tm/models/threat-model.model';
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
  /** Metadata from the context object */
  metadata?: Metadata[];
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

/** Allowed characters for string parameter values */
const STRING_PARAM_PATTERN = /^[a-zA-Z0-9 \-.,/]*$/;

/**
 * Invoke Addon Dialog Component
 *
 * Dialog for invoking addons with context-specific parameters.
 * Fetches addon details to get parameter definitions, then renders
 * appropriate form controls for each parameter type.
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
// SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: dialog component for configuring and invoking an addon against a threat model object
export class InvokeAddonDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  invoking = false;
  loading = true;
  errorMessage = '';
  showDeveloperTools = false;

  /** Parameters fetched from addon details */
  parameters: AddonParameter[] = [];

  /** Tracks which optional parameters the user has included */
  includedParams: Record<string, boolean> = {};

  /** Validation errors for metadata_key parameters */
  metadataKeyErrors: Record<string, string> = {};

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: inject dialog data, services, and form builder dependencies (pure)
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: InvokeAddonDialogData,
    private dialogRef: MatDialogRef<InvokeAddonDialogComponent>,
    private addonService: AddonService,
    private fb: FormBuilder,
    private logger: LoggerService,
    private transloco: TranslocoService,
    private userPreferencesService: UserPreferencesService,
  ) {}

  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: fetch fresh addon details and build dynamic parameter form on init (reads DB)
  ngOnInit(): void {
    this.form = this.fb.group({});

    this.userPreferencesService.preferences$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(prefs => {
        this.showDeveloperTools = prefs.showDeveloperTools;
      });

    // Fetch fresh addon details to get parameters
    this.addonService
      .get(this.data.addon.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: addon => {
          this.parameters = addon.parameters ?? [];
          this.buildForm();
          this.loading = false;
        },
        error: (error: { error?: { message?: string } }) => {
          this.logger.error('Failed to fetch addon details', error);
          // Fall back to the addon data we already have
          this.parameters = this.data.addon.parameters ?? [];
          this.buildForm();
          this.loading = false;
        },
      });
  }

  /**
   * Build dynamic form controls from parameter definitions
   */
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: build reactive form controls from addon parameter definitions (mutates shared state)
  private buildForm(): void {
    for (const param of this.parameters) {
      const isRequired = param.required === true;
      this.includedParams[param.name] = isRequired;

      const control = this.createControlForParam(param);
      this.form.addControl(param.name, control);

      // Disable controls for optional params by default (not included)
      if (!isRequired) {
        control.disable();
      }
    }
  }

  /**
   * Create a FormControl with appropriate validators for the parameter type
   */
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: build a FormControl with type-appropriate validators for an addon parameter (pure)
  private createControlForParam(param: AddonParameter): FormControl {
    const validators: ValidatorFn[] = [];
    if (param.required) {
      validators.push(Validators.required);
    }

    const defaultValue = this.resolveDefaultValue(param, validators);
    return new FormControl(defaultValue, validators);
  }

  /**
   * Resolve the default value and add type-specific validators
   */
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: resolve typed default value and attach validators for an addon parameter (pure)
  private resolveDefaultValue(
    param: AddonParameter,
    validators: ValidatorFn[],
  ): string | number | boolean | null {
    const raw = param.default_value ?? null;

    switch (param.type) {
      case 'string':
        this.addStringValidators(param, validators);
        return raw;

      case 'number':
        this.addNumberValidators(param, validators);
        return raw !== null ? Number(raw) : null;

      case 'boolean':
        return raw !== null ? raw === 'true' : false;

      case 'enum':
        if (raw && param.enum_values && !param.enum_values.includes(String(raw))) {
          return null;
        }
        return raw;

      case 'metadata_key':
        return this.resolveMetadataKeyDefault(param);

      default:
        return raw;
    }
  }

  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: attach max-length and pattern validators to a string addon parameter (pure)
  private addStringValidators(param: AddonParameter, validators: ValidatorFn[]): void {
    validators.push(Validators.maxLength(param.string_max_length ?? 256));
    validators.push(Validators.pattern(STRING_PARAM_PATTERN));
    if (param.string_validation_regex) {
      validators.push(Validators.pattern(param.string_validation_regex));
    }
  }

  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: attach min and max validators to a numeric addon parameter (pure)
  private addNumberValidators(param: AddonParameter, validators: ValidatorFn[]): void {
    if (param.number_min !== undefined) {
      validators.push(Validators.min(param.number_min));
    }
    if (param.number_max !== undefined) {
      validators.push(Validators.max(param.number_max));
    }
  }

  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: resolve default value for a metadata_key parameter and flag missing required keys (pure)
  private resolveMetadataKeyDefault(param: AddonParameter): string {
    const metadataValue = this.lookupMetadataValue(param.metadata_key ?? param.name);
    if (param.required && !metadataValue) {
      this.metadataKeyErrors[param.name] = this.transloco.translate(
        'addons.invokeDialog.metadataKeyMissing',
        { key: param.metadata_key ?? param.name },
      );
    }
    return metadataValue ?? '';
  }

  /**
   * Look up a metadata value by key from the context metadata
   */
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: fetch a metadata entry value by key from dialog context (pure)
  private lookupMetadataValue(key: string): string | undefined {
    if (!this.data.metadata) {
      return undefined;
    }
    const entry = this.data.metadata.find(m => m.key === key);
    return entry?.value;
  }

  /**
   * Toggle inclusion of an optional parameter
   */
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: enable or disable an optional addon parameter form control (mutates shared state)
  toggleParam(paramName: string, included: boolean): void {
    this.includedParams[paramName] = included;
    const control = this.form.get(paramName);
    if (control) {
      if (included) {
        control.enable();
      } else {
        control.disable();
      }
    }
  }

  /**
   * Check if a parameter is required
   */
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: return whether an addon parameter is required (pure)
  isParamRequired(param: AddonParameter): boolean {
    return param.required === true;
  }

  /**
   * Get addon icon for display (strips material-symbols: prefix)
   */
  // SEM@04ec57f52a96d3a77af63334dfa3631637c8b6fe: return the addon icon name, stripping the material-symbols prefix (pure)
  getAddonIcon(): string {
    if (!this.data.addon.icon) {
      return 'extension';
    }
    return this.data.addon.icon.replace('material-symbols:', '');
  }

  /**
   * Get translation key for object type display
   */
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: map an object type identifier to its i18n translation key (pure)
  getObjectTypeTranslationKey(): string {
    const typeMap: Record<string, string> = {
      threat_model: 'common.objectTypes.threatModel',
      diagram: 'common.objectTypes.diagram',
      asset: 'common.objectTypes.asset',
      threat: 'common.objectTypes.threat',
      document: 'common.objectTypes.document',
      note: 'common.objectTypes.note',
      repository: 'common.objectTypes.repository',
      metadata: 'common.objectTypes.metadata',
      survey: 'common.objectTypes.survey',
      survey_response: 'common.objectTypes.surveyResponse',
    };
    return typeMap[this.data.objectType] || this.data.objectType;
  }

  /**
   * Check if OK button should be enabled
   */
  get canInvoke(): boolean {
    if (this.invoking || this.loading) {
      return false;
    }
    if (!this.data.addon?.id || !this.data.threatModelId || !this.data.objectType) {
      return false;
    }
    // Check for metadata_key validation errors
    if (Object.keys(this.metadataKeyErrors).length > 0) {
      return false;
    }
    return this.form.valid;
  }

  /**
   * Handle invoke button click
   */
  // SEM@3ef058b55fa1cb48b295638770d9df824a0d3a8a: collect included parameter values and invoke the addon via API, then close dialog
  onInvoke(): void {
    if (!this.canInvoke) {
      return;
    }

    this.invoking = true;
    this.errorMessage = '';

    // Build data object from included parameter values
    const data: Record<string, unknown> = {};
    for (const param of this.parameters) {
      if (!this.includedParams[param.name]) {
        continue;
      }
      const value = this.form.get(param.name)?.value as string | number | boolean | null;
      if (value !== null && value !== undefined && value !== '') {
        if (param.type === 'boolean') {
          data[param.name] = String(value);
        } else if (param.type === 'number') {
          data[param.name] = Number(value);
        } else {
          data[param.name] = value;
        }
      }
    }

    const request: InvokeAddonRequest = {
      threat_model_id: this.data.threatModelId,
      object_type: this.data.objectType,
      ...(this.data.objectId && { object_id: this.data.objectId }),
      ...(Object.keys(data).length > 0 && { data }),
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
  // SEM@04ec57f52a96d3a77af63334dfa3631637c8b6fe: close dialog signalling the addon invocation was cancelled (pure)
  onCancel(): void {
    const result: InvokeAddonDialogResult = { submitted: false };
    this.dialogRef.close(result);
  }
}
