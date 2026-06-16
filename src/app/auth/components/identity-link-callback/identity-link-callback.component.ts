import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

import { IdentityLinkService } from '../../services/identity-link.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  IDENTITY_LINK_ERROR,
  PendingIdentityLinkResponse,
  StepUpRequiredError,
} from '../../models/identity-link.types';

type ViewState = 'loading' | 'confirm' | 'submitting' | 'error';

@Component({
  selector: 'app-identity-link-callback',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
    TranslocoModule,
  ],
  templateUrl: './identity-link-callback.component.html',
  styleUrls: ['./identity-link-callback.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityLinkCallbackComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private identityLink = inject(IdentityLinkService);
  private auth = inject(AuthService);
  private transloco = inject(TranslocoService);
  private logger = inject(LoggerService);

  state: ViewState = 'loading';
  errorKey = 'identities.link.error.generic';
  pending: PendingIdentityLinkResponse | null = null;
  private token = '';

  ngOnInit(): void {
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const error = params['error'] as string | undefined;
      const token = params['link_pending'] as string | undefined;

      if (error) {
        this.errorKey =
          error === IDENTITY_LINK_ERROR.alreadyBound
            ? 'identities.link.error.alreadyBound'
            : 'identities.link.error.generic';
        this.state = 'error';
        return;
      }
      if (!token) {
        this.errorKey = 'identities.link.error.generic';
        this.state = 'error';
        return;
      }

      this.token = token;
      this.loadPending(token);
    });
  }

  private loadPending(token: string): void {
    this.identityLink.getPending(token).subscribe({
      next: details => {
        this.pending = details;
        this.state = 'confirm';
      },
      error: (err: unknown) => {
        this.logger.warn('Failed to load pending identity link', err);
        // 404 = expired/foreign/consumed token; anything else is a transient failure.
        this.errorKey =
          (err as { status?: number })?.status === 404
            ? 'identities.link.error.expired'
            : 'identities.link.error.generic';
        this.state = 'error';
      },
    });
  }

  onConfirm(): void {
    this.state = 'submitting';
    this.identityLink.confirmLink(this.token).subscribe({
      next: () => {
        this.snackBar.open(this.transloco.translate('identities.link.success'), undefined, {
          duration: 4000,
        });
        void this.router.navigateByUrl('/dashboard?openPrefs=identities');
      },
      error: (err: unknown) => this.handleConfirmError(err),
    });
  }

  onCancel(): void {
    void this.router.navigateByUrl('/dashboard?openPrefs=identities');
  }

  private handleConfirmError(err: unknown): void {
    if (err instanceof StepUpRequiredError) {
      void this.auth.initiateStepUp(
        `/oauth2/link/callback?link_pending=${encodeURIComponent(this.token)}`,
      );
      return;
    }
    const code = (err as { error?: { error?: string } })?.error?.error;
    if (code === IDENTITY_LINK_ERROR.alreadyBound) {
      this.errorKey = 'identities.link.error.alreadyBound';
    } else if ((err as { status?: number })?.status === 404) {
      this.errorKey = 'identities.link.error.expired';
    } else {
      this.errorKey = 'identities.link.error.generic';
    }
    this.logger.warn('Identity-link confirm failed', err);
    this.state = 'error';
  }
}
