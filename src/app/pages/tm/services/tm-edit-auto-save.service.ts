import { Injectable } from '@angular/core';

import { LoggerService } from '@app/core/services/logger.service';
import { ThreatModel } from '../models/threat-model.model';

/** Form values tracked for threat model auto-save dirty-checking. */
export interface ThreatModelFormValues {
  name: string;
  description: string;
  threat_model_framework: string;
  issue_uri?: string;
  status?: string | null;
}

/** Subset of ThreatModel fields the form auto-save is allowed to patch. */
// SEM@4965798ce1913deffcd3c8db182ca83584cf53fa: type alias for allowed auto-save PATCH fields on a threat model (pure)
export type ThreatModelFormUpdates = Partial<
  Pick<ThreatModel, 'name' | 'description' | 'threat_model_framework' | 'issue_uri' | 'status'>
>;

/**
 * Dirty-tracking and field-diff logic for threat model form auto-save,
 * extracted from TmEditComponent. Operates on plain form-value objects so it
 * is unit-testable without a live FormGroup.
 */
@Injectable({ providedIn: 'root' })
// SEM@4965798ce1913deffcd3c8db182ca83584cf53fa: detect dirty threat model form fields and build a safe partial update (pure)
export class TmEditAutoSaveService {
  // SEM@4965798ce1913deffcd3c8db182ca83584cf53fa: inject LoggerService dependency for auto-save dirty-checking service
  constructor(private logger: LoggerService) {}

  /**
   * Whether the current form values differ from the original (saved) values.
   * @param formValue The current form values.
   * @param original The last-saved form values, or undefined if none.
   * @returns True if any tracked field changed; false when no original exists.
   */
  // SEM@4965798ce1913deffcd3c8db182ca83584cf53fa: compare current form values to saved values; return true if any field differs (pure)
  hasFormChanged(
    formValue: ThreatModelFormValues,
    original: ThreatModelFormValues | undefined,
  ): boolean {
    if (!original) return false;

    const statusChanged = (formValue.status ?? null) !== (original.status ?? null);

    return (
      formValue.name !== original.name ||
      formValue.description !== original.description ||
      formValue.threat_model_framework !== original.threat_model_framework ||
      formValue.issue_uri !== original.issue_uri ||
      statusChanged
    );
  }

  /**
   * Build a partial-update object containing only the form fields that
   * changed from the original. Defensively strips authorization/owner —
   * those are managed via separate API paths and must never ride along on a
   * form auto-save PATCH.
   * @param formValue The current form values.
   * @param original The last-saved form values to diff against.
   * @returns A partial update with only the changed, allowed fields.
   */
  // SEM@4965798ce1913deffcd3c8db182ca83584cf53fa: compute partial update with only changed allowed fields, stripping auth fields (pure)
  buildUpdates(
    formValue: ThreatModelFormValues,
    original: ThreatModelFormValues,
  ): ThreatModelFormUpdates {
    const updates: ThreatModelFormUpdates = {};

    if (formValue.name !== original.name) {
      updates.name = formValue.name;
    }
    if (formValue.description !== original.description) {
      updates.description = formValue.description;
    }
    if (formValue.threat_model_framework !== original.threat_model_framework) {
      updates.threat_model_framework = formValue.threat_model_framework;
    }
    if (formValue.issue_uri !== original.issue_uri) {
      updates.issue_uri = formValue.issue_uri;
    }
    if ((formValue.status ?? null) !== (original.status ?? null)) {
      updates.status = formValue.status;
    }

    const safeUpdates = updates as Record<string, unknown>;
    if ('authorization' in safeUpdates) {
      this.logger.warn('Unexpected authorization field in form auto-save updates - removing it', {
        updateKeys: Object.keys(safeUpdates),
      });
      delete safeUpdates['authorization'];
    }
    if ('owner' in safeUpdates) {
      this.logger.warn('Unexpected owner field in form auto-save updates - removing it', {
        updateKeys: Object.keys(safeUpdates),
      });
      delete safeUpdates['owner'];
    }

    return updates;
  }
}
