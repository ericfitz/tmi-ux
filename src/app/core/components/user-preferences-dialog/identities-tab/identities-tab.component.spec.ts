import '@angular/compiler';

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EMPTY, Observable, of, throwError } from 'rxjs';

import { IdentitiesTabComponent } from './identities-tab.component';
import { IdentityLinkService } from '@app/auth/services/identity-link.service';
import { AuthService } from '@app/auth/services/auth.service';
import { LoggerService } from '@app/core/services/logger.service';
import { MyIdentitiesResponse, StepUpRequiredError } from '@app/auth/models/identity-link.types';

beforeAll(() => {
  TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
});

afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

interface Mocks {
  identityLink: {
    listIdentities: ReturnType<typeof vi.fn>;
    startLink: ReturnType<typeof vi.fn>;
    unlink: ReturnType<typeof vi.fn>;
  };
  auth: {
    getAvailableProviders: ReturnType<typeof vi.fn>;
    initiateStepUp: ReturnType<typeof vi.fn>;
  };
  dialog: { open: ReturnType<typeof vi.fn> };
  snackBar: { open: ReturnType<typeof vi.fn> };
  logger: { warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
}

function buildMocks(overrides: Partial<Mocks['identityLink']> = {}): Mocks {
  return {
    identityLink: {
      listIdentities: vi.fn(() => EMPTY as Observable<MyIdentitiesResponse>),
      startLink: vi.fn(() => of({ authorization_url: 'https://auth.example/authorize' })),
      unlink: vi.fn(() => of(undefined)),
      ...overrides,
    },
    auth: {
      getAvailableProviders: vi.fn(() => of([])),
      initiateStepUp: vi.fn(() => Promise.resolve()),
    },
    dialog: { open: vi.fn() },
    snackBar: { open: vi.fn() },
    logger: { warn: vi.fn(), error: vi.fn() },
  };
}

function buildFixture(mocks: Mocks): ComponentFixture<IdentitiesTabComponent> {
  const translocoTesting = TranslocoTestingModule.forRoot({
    langs: { en: {} },
    translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
    preloadLangs: true,
  });

  void TestBed.configureTestingModule({
    imports: [IdentitiesTabComponent, translocoTesting],
    providers: [
      { provide: IdentityLinkService, useValue: mocks.identityLink },
      { provide: AuthService, useValue: mocks.auth },
      { provide: MatDialog, useValue: mocks.dialog },
      { provide: MatSnackBar, useValue: mocks.snackBar },
      { provide: LoggerService, useValue: mocks.logger },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(IdentitiesTabComponent);
  fixture.detectChanges();
  return fixture;
}

const sampleIdentities: MyIdentitiesResponse = {
  primary: { provider: 'google', email: 'primary@example.com', name: 'Primary User' },
  linked: [
    {
      id: 'link-1',
      provider: 'github',
      provider_user_id: 'gh-123',
      email: 'secondary@example.com',
      name: 'Secondary User',
      linked_at: '2026-01-01T00:00:00Z',
    },
  ],
};

describe('IdentitiesTabComponent', () => {
  let mocks: Mocks;
  let fixture: ComponentFixture<IdentitiesTabComponent>;

  beforeEach(() => {
    mocks = buildMocks();
    fixture = buildFixture(mocks);
  });

  it('should create the component', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('rows()', () => {
    it('puts the primary identity first with isPrimary true and maps linked identities', () => {
      const rows = fixture.componentInstance.rows(sampleIdentities);

      expect(rows.length).toBe(2);
      expect(rows[0]).toEqual({
        id: 'primary',
        provider: 'google',
        label: 'primary@example.com',
        isPrimary: true,
      });
      expect(rows[1]).toEqual({
        id: 'link-1',
        provider: 'github',
        label: 'secondary@example.com',
        isPrimary: false,
      });
    });
  });

  describe('onLink()', () => {
    it('navigates to authorization_url on success', () => {
      const setHref = vi.fn();
      vi.spyOn(window, 'location', 'get').mockReturnValue({
        set href(value: string) {
          setHref(value);
        },
      } as unknown as Location);

      fixture.componentInstance.onLink('github');

      expect(mocks.identityLink.startLink).toHaveBeenCalledWith('github');
      expect(setHref).toHaveBeenCalledWith('https://auth.example/authorize');
    });

    it('calls initiateStepUp when startLink throws StepUpRequiredError', () => {
      mocks.identityLink.startLink.mockReturnValue(throwError(() => new StepUpRequiredError()));

      fixture.componentInstance.onLink('github');

      expect(mocks.auth.initiateStepUp).toHaveBeenCalledWith('/dashboard?openPrefs=identities');
    });
  });

  describe('onUnlink()', () => {
    const row = {
      id: 'link-1',
      provider: 'github',
      label: 'secondary@example.com',
      isPrimary: false,
    };

    it('calls initiateStepUp when unlink throws StepUpRequiredError after confirmation', () => {
      mocks.dialog.open.mockReturnValue({ afterClosed: () => of(true) });
      mocks.identityLink.unlink.mockReturnValue(throwError(() => new StepUpRequiredError()));

      fixture.componentInstance.onUnlink(row);

      expect(mocks.identityLink.unlink).toHaveBeenCalledWith('link-1');
      expect(mocks.auth.initiateStepUp).toHaveBeenCalledWith('/dashboard?openPrefs=identities');
    });

    it('does not unlink when the dialog is dismissed', () => {
      mocks.dialog.open.mockReturnValue({ afterClosed: () => of(false) });

      fixture.componentInstance.onUnlink(row);

      expect(mocks.identityLink.unlink).not.toHaveBeenCalled();
    });
  });
});
