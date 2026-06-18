import '@angular/compiler';

import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';

import { IdentityLinkCallbackComponent } from './identity-link-callback.component';
import { IdentityLinkService } from '../../services/identity-link.service';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '@app/core/services/logger.service';
import { PendingIdentityLinkResponse, StepUpRequiredError } from '../../models/identity-link.types';

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
  TestBed.resetTestingModule();
});

const PENDING: PendingIdentityLinkResponse = {
  pending: { provider: 'github', provider_user_id: 'gh-123', email: 'new@example.com' },
  account: { provider: 'google', email: 'me@example.com' },
};

interface MockOverrides {
  queryParams: Record<string, string>;
  getPending?: ReturnType<typeof vi.fn>;
  confirmLink?: ReturnType<typeof vi.fn>;
}

// SEM@b562cc8846260a61f266975d7fec6be675ea6ec3: build a configured TestBed fixture for IdentityLinkCallbackComponent with mock services (pure)
function buildFixture(overrides: MockOverrides): {
  fixture: ComponentFixture<IdentityLinkCallbackComponent>;
  identityLink: { getPending: ReturnType<typeof vi.fn>; confirmLink: ReturnType<typeof vi.fn> };
  auth: { initiateStepUp: ReturnType<typeof vi.fn> };
  router: { navigateByUrl: ReturnType<typeof vi.fn> };
  snackBar: { open: ReturnType<typeof vi.fn> };
} {
  const identityLink = {
    getPending: overrides.getPending ?? vi.fn().mockReturnValue(of(PENDING)),
    confirmLink: overrides.confirmLink ?? vi.fn().mockReturnValue(of({})),
  };
  const auth = { initiateStepUp: vi.fn().mockResolvedValue(undefined) };
  const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };
  const snackBar = { open: vi.fn() };
  const logger = { warn: vi.fn(), info: vi.fn() };
  const activatedRoute = { queryParams: of(overrides.queryParams) };

  const translocoTesting = TranslocoTestingModule.forRoot({
    langs: { en: {} },
    translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
    preloadLangs: true,
  });

  void TestBed.configureTestingModule({
    imports: [IdentityLinkCallbackComponent, translocoTesting],
    providers: [
      { provide: IdentityLinkService, useValue: identityLink },
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
      { provide: MatSnackBar, useValue: snackBar },
      { provide: LoggerService, useValue: logger },
      { provide: ActivatedRoute, useValue: activatedRoute },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(IdentityLinkCallbackComponent);
  fixture.detectChanges();
  return { fixture, identityLink, auth, router, snackBar };
}

describe('IdentityLinkCallbackComponent', () => {
  it('renders error state for error=identity_already_bound without calling getPending', () => {
    const { fixture, identityLink } = buildFixture({
      queryParams: { error: 'identity_already_bound' },
    });
    const component = fixture.componentInstance;

    expect(component.state).toBe('error');
    expect(component.errorKey).toBe('identities.link.error.alreadyBound');
    expect(identityLink.getPending).not.toHaveBeenCalled();
  });

  it('enters confirm state when link_pending token resolves pending details', () => {
    const { fixture, identityLink } = buildFixture({
      queryParams: { link_pending: 'tok' },
    });
    const component = fixture.componentInstance;

    expect(identityLink.getPending).toHaveBeenCalledWith('tok');
    expect(component.state).toBe('confirm');
    expect(component.pending).toEqual(PENDING);
  });

  it('initiates step-up re-auth when confirmLink throws StepUpRequiredError', () => {
    const { fixture, auth } = buildFixture({
      queryParams: { link_pending: 'tok' },
      confirmLink: vi.fn().mockReturnValue(throwError(() => new StepUpRequiredError())),
    });
    const component = fixture.componentInstance;

    component.onConfirm();

    expect(auth.initiateStepUp).toHaveBeenCalledWith('/oauth2/link/callback?link_pending=tok');
  });

  it('navigates to identities prefs on successful confirm', () => {
    const { fixture, router, snackBar } = buildFixture({
      queryParams: { link_pending: 'tok' },
      confirmLink: vi.fn().mockReturnValue(of({})),
    });
    const component = fixture.componentInstance;

    component.onConfirm();

    expect(snackBar.open).toHaveBeenCalled();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard?openPrefs=identities');
  });
});
