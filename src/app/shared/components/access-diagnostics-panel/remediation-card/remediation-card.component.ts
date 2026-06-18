import { ChangeDetectionStrategy, Component, Injector, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Clipboard } from '@angular/cdk/clipboard';
import { Observable } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import {
  ContentTokenService,
  buildContentAuthorizeErrorMessage,
} from '@app/core/services/content-token.service';
import { LoggerService } from '@app/core/services/logger.service';
import { CONTENT_PROVIDERS } from '@app/core/services/content-provider-registry';
import type {
  AccessRemediation,
  ContentProviderId,
  IContentPickerService,
} from '@app/core/models/content-provider.types';

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
  selector: 'app-remediation-card',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button mat-button [attr.data-testid]="'remediation-' + remediation.action" (click)="handle()">
      {{ label | async }}
    </button>
    @if (remediation.action === 'share_with_service_account' && serviceAccountEmail; as email) {
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
  `,
  styles: [
    `
      :host {
        display: contents;
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
    `,
  ],
})
// SEM@21df0284358e24c57c5fd991864d31e88af271f3: render an access remediation action card and handle its dispatch (mutates shared state)
export class RemediationCardComponent {
  @Input({ required: true }) remediation!: AccessRemediation;

  // SEM@21df0284358e24c57c5fd991864d31e88af271f3: inject services for content auth, routing, clipboard, and notifications (pure)
  constructor(
    private injector: Injector,
    private transloco: TranslocoService,
    private clipboard: Clipboard,
    private snackBar: MatSnackBar,
    private contentTokens: ContentTokenService,
    private router: Router,
    private logger: LoggerService,
  ) {}

  get label(): Observable<string> {
    const key = REMEDIATION_KEYS[this.remediation.action] ?? 'common.unknown';
    return this.transloco.selectTranslate(key);
  }

  get serviceAccountEmail(): string | null {
    const email = this.remediation.params?.['service_account_email'];
    return typeof email === 'string' ? email : null;
  }

  // SEM@21df0284358e24c57c5fd991864d31e88af271f3: dispatch the appropriate remediation action for the current access issue (mutates shared state)
  handle(): void {
    const rem = this.remediation;
    switch (rem.action) {
      case 'link_account':
      case 'relink_account': {
        const providerId = rem.params?.['provider_id'] as ContentProviderId | undefined;
        if (providerId) {
          this.contentTokens.authorize(providerId, this.router.url).subscribe({
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
        const email = this.serviceAccountEmail;
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

  // SEM@21df0284358e24c57c5fd991864d31e88af271f3: copy service account email to clipboard and notify the user (mutates shared state)
  copyServiceEmail(email: string): void {
    this.clipboard.copy(email);
    this.snackBar.open(this.transloco.translate('documentAccess.copiedEmail'), undefined, {
      duration: 2000,
    });
  }
}
