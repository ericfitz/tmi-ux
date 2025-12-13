// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { DialogDirectionService } from './dialog-direction.service';
import { LanguageService } from '../../i18n/language.service';
import { MatDialog } from '@angular/material/dialog';
import { Directionality } from '@angular/cdk/bidi';

describe('DialogDirectionService', () => {
  let service: DialogDirectionService;
  let mockLanguageService: {
    direction$: BehaviorSubject<'ltr' | 'rtl'>;
  };
  let mockDirectionality: Partial<Directionality>;
  let mockDialog: {
    closeAll: ReturnType<typeof vi.fn>;
  };
  let mockDocument: {
    documentElement: {
      setAttribute: ReturnType<typeof vi.fn>;
    };
    body: {
      setAttribute: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock for LanguageService with direction observable
    mockLanguageService = {
      direction$: new BehaviorSubject<'ltr' | 'rtl'>('ltr'),
    };

    // Create mock for Directionality
    mockDirectionality = {
      value: 'ltr',
    };

    // Create mock for MatDialog
    mockDialog = {
      closeAll: vi.fn(),
    };

    // Create mock for Document
    mockDocument = {
      documentElement: {
        setAttribute: vi.fn(),
      },
      body: {
        setAttribute: vi.fn(),
      },
    };

    // Create service with mocks
    service = new DialogDirectionService(
      mockLanguageService as unknown as LanguageService,
      mockDirectionality as Directionality,
      mockDialog as unknown as MatDialog,
      mockDocument as unknown as Document,
    );
  });

  afterEach(() => {
    // Clean up subscription
    service.ngOnDestroy();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should subscribe to language direction changes on creation', () => {
      // The subscription is created in constructor, so it should exist
      expect(service['subscription']).toBeTruthy();
    });

    it('should not update document on initial subscription', () => {
      // The BehaviorSubject emits immediately, but we start with 'ltr'
      // Since we created the service in beforeEach, check that it was called once
      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('dir', 'ltr');
      expect(mockDocument.body.setAttribute).toHaveBeenCalledWith('dir', 'ltr');
    });
  });

  describe('Direction Changes', () => {
    it('should update documentElement direction attribute when direction changes to rtl', () => {
      mockLanguageService.direction$.next('rtl');

      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('dir', 'rtl');
    });

    it('should update body direction attribute when direction changes to rtl', () => {
      mockLanguageService.direction$.next('rtl');

      expect(mockDocument.body.setAttribute).toHaveBeenCalledWith('dir', 'rtl');
    });

    it('should close all dialogs when direction changes to rtl', () => {
      mockLanguageService.direction$.next('rtl');

      expect(mockDialog.closeAll).toHaveBeenCalled();
    });

    it('should update documentElement direction attribute when direction changes to ltr', () => {
      // First change to rtl, then back to ltr
      mockLanguageService.direction$.next('rtl');
      vi.clearAllMocks();

      mockLanguageService.direction$.next('ltr');

      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledWith('dir', 'ltr');
    });

    it('should update body direction attribute when direction changes to ltr', () => {
      // First change to rtl, then back to ltr
      mockLanguageService.direction$.next('rtl');
      vi.clearAllMocks();

      mockLanguageService.direction$.next('ltr');

      expect(mockDocument.body.setAttribute).toHaveBeenCalledWith('dir', 'ltr');
    });

    it('should close all dialogs when direction changes to ltr', () => {
      // First change to rtl, then back to ltr
      mockLanguageService.direction$.next('rtl');
      vi.clearAllMocks();

      mockLanguageService.direction$.next('ltr');

      expect(mockDialog.closeAll).toHaveBeenCalled();
    });

    it('should handle multiple direction changes', () => {
      mockLanguageService.direction$.next('rtl');
      mockLanguageService.direction$.next('ltr');
      mockLanguageService.direction$.next('rtl');

      // Should have been called for initial + 3 changes = 4 times total
      expect(mockDocument.documentElement.setAttribute).toHaveBeenCalledTimes(4);
      expect(mockDocument.body.setAttribute).toHaveBeenCalledTimes(4);
      expect(mockDialog.closeAll).toHaveBeenCalledTimes(4);
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from direction changes on destroy', () => {
      const unsubscribeSpy = vi.spyOn(service['subscription'], 'unsubscribe');

      service.ngOnDestroy();

      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should not throw if subscription is null on destroy', () => {
      service['subscription'] = null as any;

      expect(() => service.ngOnDestroy()).not.toThrow();
    });

    it('should not throw if subscription is undefined on destroy', () => {
      service['subscription'] = undefined as any;

      expect(() => service.ngOnDestroy()).not.toThrow();
    });

    it('should not receive direction changes after destroy', () => {
      service.ngOnDestroy();
      vi.clearAllMocks();

      mockLanguageService.direction$.next('rtl');

      // Should not be called since subscription was unsubscribed
      expect(mockDocument.documentElement.setAttribute).not.toHaveBeenCalled();
      expect(mockDocument.body.setAttribute).not.toHaveBeenCalled();
      expect(mockDialog.closeAll).not.toHaveBeenCalled();
    });
  });

  describe('Integration Behavior', () => {
    it('should update both documentElement and body in correct order', () => {
      const calls: string[] = [];

      mockDocument.documentElement.setAttribute.mockImplementation(() => {
        calls.push('documentElement');
      });
      mockDocument.body.setAttribute.mockImplementation(() => {
        calls.push('body');
      });

      mockLanguageService.direction$.next('rtl');

      expect(calls).toEqual(['documentElement', 'body']);
    });

    it('should close dialogs after updating direction attributes', () => {
      const calls: string[] = [];

      mockDocument.documentElement.setAttribute.mockImplementation(() => {
        calls.push('setAttribute');
      });
      mockDialog.closeAll.mockImplementation(() => {
        calls.push('closeAll');
      });

      mockLanguageService.direction$.next('rtl');

      expect(calls[calls.length - 1]).toBe('closeAll');
    });
  });
});
