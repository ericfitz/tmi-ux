// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';

import {
  CredentialSecretDialogComponent,
  CredentialSecretDialogData,
} from './credential-secret-dialog.component';
import { createTypedMockLoggerService, type MockLoggerService } from '@testing/mocks';

// Mock environment module
vi.mock('../../../../../environments/environment', () => ({
  environment: {
    apiUrl: 'https://api.test.example.com',
  },
}));

interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

interface MockClipboard {
  copy: ReturnType<typeof vi.fn>;
}

describe('CredentialSecretDialogComponent', () => {
  let component: CredentialSecretDialogComponent;
  let dialogRef: MockDialogRef;
  let loggerService: MockLoggerService;
  let clipboard: MockClipboard;
  let dialogData: CredentialSecretDialogData;

  beforeEach(() => {
    vi.clearAllMocks();

    dialogRef = { close: vi.fn() };
    loggerService = createTypedMockLoggerService();
    clipboard = { copy: vi.fn().mockReturnValue(true) };
    dialogData = {
      clientId: 'test-client-id-123',
      clientSecret: 'test-secret-abc-456',
    };

    component = new CredentialSecretDialogComponent(
      dialogRef as any,
      dialogData,
      clipboard as any,
      loggerService as any,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('onCopyClientId', () => {
    it('copies client ID to clipboard', () => {
      component.onCopyClientId();
      expect(clipboard.copy).toHaveBeenCalledWith('test-client-id-123');
    });

    it('logs success when copy succeeds', () => {
      clipboard.copy.mockReturnValue(true);
      component.onCopyClientId();
      expect(loggerService.info).toHaveBeenCalledWith('Client ID copied to clipboard');
    });

    it('logs error when copy fails', () => {
      clipboard.copy.mockReturnValue(false);
      component.onCopyClientId();
      expect(loggerService.error).toHaveBeenCalledWith('Failed to copy client ID to clipboard');
    });
  });

  describe('onCopyClientSecret', () => {
    it('copies client secret to clipboard', () => {
      component.onCopyClientSecret();
      expect(clipboard.copy).toHaveBeenCalledWith('test-secret-abc-456');
    });

    it('logs success when copy succeeds', () => {
      clipboard.copy.mockReturnValue(true);
      component.onCopyClientSecret();
      expect(loggerService.info).toHaveBeenCalledWith('Client secret copied to clipboard');
    });

    it('logs error when copy fails', () => {
      clipboard.copy.mockReturnValue(false);
      component.onCopyClientSecret();
      expect(loggerService.error).toHaveBeenCalledWith('Failed to copy client secret to clipboard');
    });
  });

  describe('onClose', () => {
    it('closes the dialog', () => {
      component.onClose();
      expect(dialogRef.close).toHaveBeenCalled();
    });
  });

  describe('onDownload', () => {
    let createElementSpy: ReturnType<typeof vi.spyOn>;
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let mockAnchor: { href: string; download: string; click: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      mockAnchor = { href: '', download: '', click: vi.fn() };
      createElementSpy = vi
        .spyOn(document, 'createElement')
        .mockReturnValue(mockAnchor as unknown as HTMLAnchorElement);
      createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-url');
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    it('creates a text file with correct content', () => {
      component.onDownload();

      expect(createElementSpy).toHaveBeenCalledWith('a');
      // Verify the Blob was created with correct content
      const blobArg = (createObjectURLSpy.mock.calls[0] as unknown[])[0] as Blob;
      expect(blobArg).toBeInstanceOf(Blob);
      expect(blobArg.type).toBe('text/plain');
    });

    it('includes client ID, client secret, and server URL in file content', async () => {
      component.onDownload();

      const blobArg = (createObjectURLSpy.mock.calls[0] as unknown[])[0] as Blob;
      const text = await blobArg.text();

      expect(text).toContain('export TMI_CLIENT_ID=test-client-id-123');
      expect(text).toContain('export TMI_CLIENT_SECRET=test-secret-abc-456');
      expect(text).toContain('export TMI_SERVER=https://api.test.example.com');
      expect(text).toMatch(/\n$/);
    });

    it('triggers download with filename client-credentials.txt', () => {
      component.onDownload();

      expect(mockAnchor.download).toBe('client-credentials.txt');
      expect(mockAnchor.href).toBe('blob:test-url');
      expect(mockAnchor.click).toHaveBeenCalled();
    });

    it('revokes the object URL after download', () => {
      component.onDownload();

      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:test-url');
    });

    it('logs the download action', () => {
      component.onDownload();

      expect(loggerService.info).toHaveBeenCalledWith(expect.stringContaining('credential'));
    });
  });
});
