import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { ActivatedRoute, Params } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';

import { ContentCallbackComponent } from './content-callback.component';
import { ContentTokenService } from '../../services/content-token.service';
import { LoggerService } from '../../services/logger.service';

describe('ContentCallbackComponent', () => {
  let queryParams$: BehaviorSubject<Params>;
  let mockRoute: Partial<ActivatedRoute>;
  let mockRouter: { navigateByUrl: ReturnType<typeof vi.fn> };
  let mockSnack: { open: ReturnType<typeof vi.fn> };
  let mockTokens: { refresh: ReturnType<typeof vi.fn> };
  let mockTransloco: { translate: ReturnType<typeof vi.fn> };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  function createComponent(): ContentCallbackComponent {
    return new ContentCallbackComponent(
      mockRoute as ActivatedRoute,
      mockRouter as never,
      mockSnack as unknown as MatSnackBar,
      mockTokens as unknown as ContentTokenService,
      mockTransloco as unknown as TranslocoService,
      mockLogger as unknown as LoggerService,
    );
  }

  beforeEach(() => {
    queryParams$ = new BehaviorSubject<Params>({});
    mockRoute = { queryParams: queryParams$.asObservable() };
    mockRouter = { navigateByUrl: vi.fn() };
    mockSnack = { open: vi.fn() };
    mockTokens = { refresh: vi.fn() };
    mockTransloco = { translate: vi.fn().mockReturnValue('translated') };
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  it('on status=success, refreshes tokens, navigates to return_to, opens success snackbar', () => {
    queryParams$.next({
      status: 'success',
      return_to: '/dashboard?openPrefs=document-sources',
      provider_id: 'google_workspace',
    });
    const component = createComponent();
    component.ngOnInit();

    expect(mockTokens.refresh).toHaveBeenCalled();
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/dashboard?openPrefs=document-sources');
    expect(mockSnack.open).toHaveBeenCalled();
  });

  it('on status=error, opens error snackbar and navigates to return_to', () => {
    queryParams$.next({
      status: 'error',
      return_to: '/tm/abc',
      provider_id: 'google_workspace',
      reason: 'consent_denied',
    });
    const component = createComponent();
    component.ngOnInit();

    expect(mockTokens.refresh).not.toHaveBeenCalled();
    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/tm/abc');
    expect(mockSnack.open).toHaveBeenCalled();
  });

  it('falls back to /dashboard when return_to is missing', () => {
    queryParams$.next({ status: 'success', provider_id: 'google_workspace' });
    const component = createComponent();
    component.ngOnInit();

    expect(mockRouter.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
});
