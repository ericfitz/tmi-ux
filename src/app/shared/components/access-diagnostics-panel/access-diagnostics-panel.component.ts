import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { CONTENT_PROVIDERS } from '../../../core/services/content-provider-registry';
import type {
  ContentProviderId,
  DocumentAccessDiagnostics,
} from '../../../core/models/content-provider.types';
import type { Document } from '../../../pages/tm/models/threat-model.model';
import { RemediationCardComponent } from './remediation-card/remediation-card.component';
import { ShareWithApplicationRemediationComponent } from './share-with-application-remediation/share-with-application-remediation.component';

const REASON_KEYS: Record<string, string> = {
  token_not_linked: 'documentAccess.reason.tokenNotLinked',
  token_refresh_failed: 'documentAccess.reason.tokenRefreshFailed',
  token_transient_failure: 'documentAccess.reason.tokenTransientFailure',
  picker_registration_invalid: 'documentAccess.reason.pickerRegistrationInvalid',
  no_accessible_source: 'documentAccess.reason.noAccessibleSource',
  source_not_found: 'documentAccess.reason.sourceNotFound',
  fetch_error: 'documentAccess.reason.fetchError',
  microsoft_not_shared: 'documentAccess.reason.microsoftNotShared',
  other: 'documentAccess.reason.other',
};

@Component({
  selector: 'app-access-diagnostics-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoModule,
    RemediationCardComponent,
    ShareWithApplicationRemediationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (document.access_diagnostics) {
      <div
        class="diagnostics-banner"
        [class.error]="document.access_status === 'auth_required'"
        [class.warn]="document.access_status === 'pending_access'"
        data-testid="diagnostics-banner"
      >
        <mat-icon class="diagnostics-icon">
          {{ document.access_status === 'auth_required' ? 'error' : 'warning' }}
        </mat-icon>
        <div class="diagnostics-body">
          <p class="diagnostics-message">{{ message }}</p>
          @if (document.access_diagnostics.remediations.length > 0) {
            <div class="diagnostics-remediations">
              @for (rem of document.access_diagnostics.remediations; track rem.action) {
                @if (rem.action === 'share_with_application') {
                  <app-share-with-application-remediation
                    [remediation]="rem"
                  ></app-share-with-application-remediation>
                } @else {
                  <app-remediation-card [remediation]="rem"></app-remediation-card>
                }
              }
            </div>
            @if (showCheckNow) {
              <div class="diagnostics-check-now">
                <button
                  mat-flat-button
                  color="primary"
                  data-testid="check-now-btn"
                  (click)="onCheckNow()"
                >
                  <mat-icon>refresh</mat-icon>
                  {{ 'documentAccess.checkNow.button' | transloco }}
                </button>
              </div>
            }
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      .diagnostics-banner {
        display: flex;
        gap: 12px;
        padding: 12px 16px;
        margin-bottom: 16px;
        border-radius: 4px;
        background-color: var(--theme-surface-variant, rgba(0, 0, 0, 0.04));
        border-left: 4px solid var(--mat-warn-color, #f57c00);
      }

      .diagnostics-banner.error {
        border-left-color: var(--mat-error-color, #f44336);
      }

      .diagnostics-icon {
        flex-shrink: 0;
      }

      .diagnostics-body {
        flex: 1;
      }

      .diagnostics-message {
        margin: 0 0 8px 0;
      }

      .diagnostics-remediations {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }

      .diagnostics-check-now {
        margin-top: 12px;
      }
    `,
  ],
})
export class AccessDiagnosticsPanelComponent {
  @Input({ required: true }) document!: Document;
  @Output() recheck = new EventEmitter<void>();

  get showCheckNow(): boolean {
    return this.document?.access_status === 'pending_access';
  }

  onCheckNow(): void {
    this.recheck.emit();
  }

  constructor(private transloco: TranslocoService) {}

  get message(): string {
    const diag = this.document?.access_diagnostics;
    if (!diag) return '';
    if (diag.reason_code === 'other' && diag.reason_detail) {
      return diag.reason_detail;
    }
    const key = REASON_KEYS[diag.reason_code] ?? 'documentAccess.reason.fallback';
    const sourceParam = this._sourceName(diag);
    return this.transloco.translate(key, { source: sourceParam });
  }

  private _sourceName(diag: DocumentAccessDiagnostics): string {
    const link = diag.remediations.find(r => r.params?.['provider_id']);
    const id = link?.params?.['provider_id'] as ContentProviderId | undefined;
    if (id && CONTENT_PROVIDERS[id]) {
      return this.transloco.translate(CONTENT_PROVIDERS[id].displayNameKey);
    }
    return '';
  }
}
