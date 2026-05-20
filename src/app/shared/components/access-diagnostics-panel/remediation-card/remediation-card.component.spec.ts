import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, throwError, firstValueFrom } from 'rxjs';
import type { Injector } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

import { RemediationCardComponent } from './remediation-card.component';
import { ContentTokenService } from '@app/core/services/content-token.service';
import { LoggerService } from '@app/core/services/logger.service';
import { ContentTokenProviderNotConfiguredError } from '@app/core/models/content-provider.types';
import type { AccessRemediation } from '@app/core/models/content-provider.types';

describe('RemediationCardComponent', () => {
  let mockClip: { copy: ReturnType<typeof vi.fn> };
  let mockSnack: { open: ReturnType<typeof vi.fn> };
  let mockTokens: { authorize: ReturnType<typeof vi.fn> };
  let mockRouter: { url: string };
  let mockTransloco: {
    translate: ReturnType<typeof vi.fn>;
    selectTranslate: ReturnType<typeof vi.fn>;
  };
  let mockInjector: { get: ReturnType<typeof vi.fn> };
  let mockLogger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };

  function createComponent(remediation: AccessRemediation): RemediationCardComponent {
    const c = new RemediationCardComponent(
      mockInjector as unknown as Injector,
      mockTransloco as unknown as TranslocoService,
      mockClip as unknown as Clipboard,
      mockSnack as unknown as MatSnackBar,
      mockTokens as unknown as ContentTokenService,
      mockRouter as unknown as Router,
      mockLogger as unknown as LoggerService,
    );
    c.remediation = remediation;
    return c;
  }

  beforeEach(() => {
    mockClip = { copy: vi.fn(() => true) };
    mockSnack = { open: vi.fn() };
    mockTokens = { authorize: vi.fn().mockReturnValue(of({ authorization_url: 'https://x' })) };
    mockRouter = { url: '/tm/abc' };
    mockTransloco = {
      translate: vi.fn((key: string) => key),
      selectTranslate: vi.fn((key: string) => of(key)),
    };
    mockInjector = { get: vi.fn() };
    mockLogger = { error: vi.fn(), warn: vi.fn() };
  });

  describe('label', () => {
    it('returns the translated key for a known action', async () => {
      const c = createComponent({ action: 'link_account', params: {} });
      await expect(firstValueFrom(c.label)).resolves.toBe('documentAccess.remediation.linkAccount');
    });

    it('falls back to common.unknown for an unknown action', async () => {
      const c = createComponent({ action: 'not_a_real_action' as never, params: {} });
      await expect(firstValueFrom(c.label)).resolves.toBe('common.unknown');
    });
  });

  describe('serviceAccountEmail', () => {
    it('returns the email when present and a string', () => {
      const c = createComponent({
        action: 'share_with_service_account',
        params: { service_account_email: 'svc@x.iam.gserviceaccount.com' },
      });
      expect(c.serviceAccountEmail).toBe('svc@x.iam.gserviceaccount.com');
    });

    it('returns null when the param is missing', () => {
      const c = createComponent({ action: 'share_with_service_account', params: {} });
      expect(c.serviceAccountEmail).toBeNull();
    });

    it('returns null when the param is not a string', () => {
      const c = createComponent({
        action: 'share_with_service_account',
        params: { service_account_email: 123 },
      });
      expect(c.serviceAccountEmail).toBeNull();
    });
  });

  describe('link_account / relink_account', () => {
    it('calls authorize with current url as return_to and follows the URL', () => {
      const c = createComponent({
        action: 'link_account',
        params: { provider_id: 'google_workspace' },
      });
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: { href: '' },
      });
      try {
        c.handle();
        expect(mockTokens.authorize).toHaveBeenCalledWith('google_workspace', '/tm/abc');
        expect(window.location.href).toBe('https://x');
      } finally {
        Object.defineProperty(window, 'location', {
          configurable: true,
          writable: true,
          value: originalLocation,
        });
      }
    });

    it('relink_account follows the same authorize path', () => {
      const c = createComponent({
        action: 'relink_account',
        params: { provider_id: 'google_workspace' },
      });
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: { href: '' },
      });
      try {
        c.handle();
        expect(mockTokens.authorize).toHaveBeenCalledWith('google_workspace', '/tm/abc');
      } finally {
        Object.defineProperty(window, 'location', {
          configurable: true,
          writable: true,
          value: originalLocation,
        });
      }
    });

    it('surfaces notConfigured snackbar when server has no provider configured', () => {
      mockTokens.authorize.mockReturnValue(
        throwError(() => new ContentTokenProviderNotConfiguredError('google_workspace')),
      );
      const c = createComponent({
        action: 'link_account',
        params: { provider_id: 'google_workspace' },
      });
      c.handle();
      expect(mockSnack.open).toHaveBeenCalledWith(
        'documentSources.callback.notConfigured',
        undefined,
        { duration: 6000 },
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('surfaces a generic error snackbar for other authorize failures', () => {
      mockTokens.authorize.mockReturnValue(throwError(() => new Error('boom')));
      const c = createComponent({
        action: 'link_account',
        params: { provider_id: 'google_workspace' },
      });
      c.handle();
      expect(mockSnack.open).toHaveBeenCalledWith('documentSources.callback.error', undefined, {
        duration: 6000,
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('does nothing when provider_id is missing', () => {
      const c = createComponent({ action: 'link_account', params: {} });
      c.handle();
      expect(mockTokens.authorize).not.toHaveBeenCalled();
    });
  });

  describe('repick_file / repick_after_share', () => {
    it('invokes the picker service for a provider that supports picking', () => {
      const pickerSvc = { pick: vi.fn().mockReturnValue(of({ id: 'fileX', name: 'X' })) };
      mockInjector.get.mockReturnValue(pickerSvc);
      const c = createComponent({
        action: 'repick_file',
        params: { provider_id: 'google_workspace' },
      });
      c.handle();
      expect(mockInjector.get).toHaveBeenCalled();
      expect(pickerSvc.pick).toHaveBeenCalled();
      expect(mockSnack.open).toHaveBeenCalledWith('File re-picked. Save to apply.', undefined, {
        duration: 3000,
      });
    });

    it('does nothing when the picker returns null (user canceled)', () => {
      const pickerSvc = { pick: vi.fn().mockReturnValue(of(null)) };
      mockInjector.get.mockReturnValue(pickerSvc);
      const c = createComponent({
        action: 'repick_after_share',
        params: { provider_id: 'google_workspace' },
      });
      c.handle();
      expect(pickerSvc.pick).toHaveBeenCalled();
      expect(mockSnack.open).not.toHaveBeenCalled();
    });

    it('does nothing when provider_id is missing', () => {
      const c = createComponent({ action: 'repick_file', params: {} });
      c.handle();
      expect(mockInjector.get).not.toHaveBeenCalled();
    });
  });

  describe('share_with_service_account', () => {
    it('copies the email and shows a snackbar', () => {
      const c = createComponent({
        action: 'share_with_service_account',
        params: { service_account_email: 'svc@x.iam.gserviceaccount.com' },
      });
      c.handle();
      expect(mockClip.copy).toHaveBeenCalledWith('svc@x.iam.gserviceaccount.com');
      expect(mockSnack.open).toHaveBeenCalledWith('documentAccess.copiedEmail', undefined, {
        duration: 2000,
      });
    });

    it('does nothing when the email param is missing', () => {
      const c = createComponent({ action: 'share_with_service_account', params: {} });
      c.handle();
      expect(mockClip.copy).not.toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    it('shows the retry snackbar', () => {
      const c = createComponent({ action: 'retry', params: {} });
      c.handle();
      expect(mockSnack.open).toHaveBeenCalledWith(
        'documentAccess.remediation.retry',
        undefined,
        { duration: 2000 },
      );
    });
  });

  describe('contact_owner', () => {
    it('does nothing (no dispatch, no snackbar)', () => {
      const c = createComponent({ action: 'contact_owner', params: {} });
      c.handle();
      expect(mockSnack.open).not.toHaveBeenCalled();
      expect(mockClip.copy).not.toHaveBeenCalled();
    });
  });

  describe('copyServiceEmail', () => {
    it('copies and opens snackbar', () => {
      const c = createComponent({
        action: 'share_with_service_account',
        params: { service_account_email: 'a@b.com' },
      });
      c.copyServiceEmail('a@b.com');
      expect(mockClip.copy).toHaveBeenCalledWith('a@b.com');
      expect(mockSnack.open).toHaveBeenCalledWith('documentAccess.copiedEmail', undefined, {
        duration: 2000,
      });
    });
  });
});
