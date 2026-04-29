import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Injector,
  Input,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { Observable } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { ContentTokenService } from '../../../core/services/content-token.service';
import { CONTENT_PROVIDERS } from '../../../core/services/content-provider-registry';
import type {
  AccessRemediation,
  ContentProviderId,
  DocumentAccessDiagnostics,
  IContentPickerService,
} from '../../../core/models/content-provider.types';
import type { Document } from '../../../pages/tm/models/threat-model.model';
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

const REMEDIATION_KEYS: Record<string, string> = {
  link_account: 'documentAccess.remediation.linkAccount',
  relink_account: 'documentAccess.remediation.relinkAccount',
  repick_file: 'documentAccess.remediation.repickFile',
  share_with_service_account: 'documentAccess.remediation.shareWithServiceAccount',
  repick_after_share: 'documentAccess.remediation.repickAfterShare',
  retry: 'documentAccess.remediation.retry',
  contact_owner: 'documentAccess.remediation.contactOwner',
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
                  <button
                    mat-stroked-button
                    [attr.data-testid]="'remediation-' + rem.action"
                    (click)="handleRemediation(rem)"
                  >
                    {{ remediationLabel(rem) | async }}
                  </button>
                  @if (
                    rem.action === 'share_with_service_account' && getServiceAccountEmail(rem);
                    as email
                  ) {
                    <span class="service-email">
                      {{ 'documentAccess.serviceAccountEmail' | transloco }}
                      <code>{{ email }}</code>
                    </span>
                    <button
                      mat-icon-button
                      data-testid="copy-email-btn"
                      [matTooltip]="'documentAccess.copyEmail' | transloco"
                      (click)="copyServiceEmail(email)"
                    >
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  }
                }
              }
            </div>
            @if (showCheckNow) {
              <div class="diagnostics-check-now">
                <button mat-stroked-button data-testid="check-now-btn" (click)="onCheckNow()">
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

      .service-email {
        font-size: 12px;
      }

      .service-email code {
        font-family: monospace;
        background: rgba(0, 0, 0, 0.05);
        padding: 2px 4px;
        border-radius: 2px;
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

  constructor(
    private injector: Injector,
    private transloco: TranslocoService,
    private clipboard: Clipboard,
    private snackBar: MatSnackBar,
    private contentTokens: ContentTokenService,
    private router: Router,
  ) {}

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

  remediationLabel(rem: AccessRemediation): Observable<string> {
    const key = REMEDIATION_KEYS[rem.action] ?? 'common.unknown';
    return this.transloco.selectTranslate(key);
  }

  getServiceAccountEmail(rem: AccessRemediation): string | null {
    const email = rem.params?.['service_account_email'];
    return typeof email === 'string' ? email : null;
  }

  handleRemediation(rem: AccessRemediation): void {
    switch (rem.action) {
      case 'link_account':
      case 'relink_account': {
        const providerId = rem.params?.['provider_id'] as ContentProviderId | undefined;
        if (providerId) {
          this.contentTokens.authorize(providerId, this.router.url).subscribe({
            next: res => {
              window.location.href = res.authorization_url;
            },
          });
        }
        break;
      }
      case 'repick_file':
      case 'repick_after_share': {
        const providerId = rem.params?.['provider_id'] as ContentProviderId | undefined;
        if (!providerId) break;
        const meta = CONTENT_PROVIDERS[providerId];
        if (!meta?.supportsPicker) break;
        const svc = this.injector.get<IContentPickerService>(meta.pickerService);
        svc.pick().subscribe({
          next: file => {
            if (file) {
              this.snackBar.open('File re-picked. Save to apply.', undefined, { duration: 3000 });
            }
          },
        });
        break;
      }
      case 'share_with_service_account': {
        const email = this.getServiceAccountEmail(rem);
        if (email) this.copyServiceEmail(email);
        break;
      }
      case 'retry':
        this.snackBar.open(
          this.transloco.translate('documentAccess.remediation.retry'),
          undefined,
          { duration: 2000 },
        );
        break;
      case 'contact_owner':
      default:
        break;
    }
  }

  copyServiceEmail(email: string): void {
    this.clipboard.copy(email);
    this.snackBar.open(this.transloco.translate('documentAccess.copiedEmail'), undefined, {
      duration: 2000,
    });
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
