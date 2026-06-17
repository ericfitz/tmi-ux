import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import { copyToClipboard, copyToClipboardWithFeedback } from './clipboard.util';

describe('copyToClipboard', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeChildSpy: ReturnType<typeof vi.fn>;
  let alertSpy: ReturnType<typeof vi.fn>;
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    writeTextMock = vi.fn();
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(node => node);
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(node => node);
    // execCommand may not exist in test environment, so define it
    if (!document.execCommand) {
      (document as any).execCommand = vi.fn().mockReturnValue(true);
    } else {
      vi.spyOn(document, 'execCommand').mockReturnValue(true);
    }
    alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('should use Clipboard API when available', () => {
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    copyToClipboard('test text');

    expect(writeTextMock).toHaveBeenCalledWith('test text');
  });

  it('should fall back to execCommand when Clipboard API rejects', async () => {
    writeTextMock.mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    copyToClipboard('fallback text');

    // Wait for promise rejection to propagate
    await vi.waitFor(() => {
      expect(document.execCommand).toHaveBeenCalledWith('copy');
    });
  });

  it('should fall back to execCommand when Clipboard API throws', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => {
          throw new Error('not supported');
        },
      },
      writable: true,
      configurable: true,
    });

    copyToClipboard('error text');

    expect(appendChildSpy).toHaveBeenCalled();
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(removeChildSpy).toHaveBeenCalled();
  });

  it('should show alert when execCommand also fails', () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: () => {
          throw new Error('not supported');
        },
      },
      writable: true,
      configurable: true,
    });
    (document.execCommand as any).mockImplementation(() => {
      throw new Error('execCommand failed');
    });

    copyToClipboard('alert text');

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('alert text'));
  });
});

describe('copyToClipboardWithFeedback', () => {
  let writeTextMock: ReturnType<typeof vi.fn>;
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let transloco: { translate: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };
  const originalClipboard = navigator.clipboard;

  const deps = (): {
    snackBar: MatSnackBar;
    transloco: TranslocoService;
    logger: LoggerService;
  } => ({
    snackBar: snackBar as unknown as MatSnackBar,
    transloco: transloco as unknown as TranslocoService,
    logger: logger as unknown as LoggerService,
  });

  beforeEach(() => {
    writeTextMock = vi.fn();
    snackBar = { open: vi.fn() };
    transloco = { translate: vi.fn((key: string) => key) };
    logger = { error: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('writes the text and shows a success snackbar', async () => {
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    copyToClipboardWithFeedback('hello', deps());

    expect(writeTextMock).toHaveBeenCalledWith('hello');
    await vi.waitFor(() => {
      expect(snackBar.open).toHaveBeenCalledWith('common.copiedToClipboard', 'common.close', {
        duration: 2000,
      });
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs an error when the Clipboard API rejects', async () => {
    const error = new Error('denied');
    writeTextMock.mockRejectedValue(error);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });

    copyToClipboardWithFeedback('hello', deps());

    await vi.waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith('Could not copy text: ', error);
    });
    expect(snackBar.open).not.toHaveBeenCalled();
  });
});
