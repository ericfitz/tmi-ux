// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { HmacSecretDialogComponent } from './hmac-secret-dialog.component';

describe('HmacSecretDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockClipboard: { copy: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let component: HmacSecretDialogComponent;

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockClipboard = { copy: vi.fn().mockReturnValue(true) };
    mockLogger = { info: vi.fn(), error: vi.fn() };
    component = new HmacSecretDialogComponent(
      mockDialogRef as never,
      { secret: 'hmac-secret-value' },
      mockClipboard as never,
      mockLogger as never,
    );
  });

  it('should create and expose the secret from dialog data', () => {
    expect(component).toBeTruthy();
    expect(component.data.secret).toBe('hmac-secret-value');
  });

  describe('onCopySecret', () => {
    it('copies the secret to the clipboard and logs success', () => {
      component.onCopySecret();

      expect(mockClipboard.copy).toHaveBeenCalledWith('hmac-secret-value');
      expect(mockLogger['info']).toHaveBeenCalled();
      expect(mockLogger['error']).not.toHaveBeenCalled();
    });

    it('logs an error when the clipboard copy fails', () => {
      mockClipboard.copy.mockReturnValue(false);

      component.onCopySecret();

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(mockLogger['info']).not.toHaveBeenCalled();
    });
  });

  describe('onClose', () => {
    it('closes the dialog', () => {
      component.onClose();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
