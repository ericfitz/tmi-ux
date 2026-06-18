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

// SEM@b562cc8846260a61f266975d7fec6be675ea6ec3: enumerate the loading, confirm, submitting, and error view states (pure)
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
// SEM@bd45fb9a4810c15dfaf1be6bb8d3774c84caa2c9: handle identity-link callback URL, confirm or cancel linking a new identity provider
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

  // SEM@b562cc8846260a61f266975d7fec6be675ea6ec3: parse link_pending token or error from query params and load pending link details
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

  // SEM@bd45fb9a4810c15dfaf1be6bb8d3774c84caa2c9: fetch pending identity link details by token and transition to confirm state (reads DB)
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

  // SEM@b562cc8846260a61f266975d7fec6be675ea6ec3: confirm pending identity link and navigate to identity preferences on success
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

  // SEM@b562cc8846260a61f266975d7fec6be675ea6ec3: cancel identity link and navigate back to identity preferences
  onCancel(): void {
    void this.router.navigateByUrl('/dashboard?openPrefs=identities');
  }

  // SEM@b562cc8846260a61f266975d7fec6be675ea6ec3: dispatch step-up or set error state when identity link confirmation fails
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
