// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { DfdNotificationService } from './dfd-notification.service';
import { WebSocketState } from '../infrastructure/adapters/websocket.adapter';

describe('DfdNotificationService', () => {
  let service: DfdNotificationService;
  let mockSnackBar: any;
  let mockLogger: any;

  beforeEach(() => {
    // Create mocks
    mockSnackBar = {
      open: vi.fn(),
      dismiss: vi.fn()
    };
    
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    // Setup default snackbar behavior
    const mockSnackBarRef = {
      onAction: vi.fn(() => of(null)),
      afterDismissed: vi.fn(() => of(null)),
      dismiss: vi.fn()
    };
    mockSnackBar.open.mockReturnValue(mockSnackBarRef);

    // Create service instance directly with mocks
    service = new DfdNotificationService(mockSnackBar, mockLogger);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should show basic notifications', () => {
    const message = 'Test notification';

    service.show(message).subscribe();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      message,
      'Dismiss',
      expect.objectContaining({
        duration: 3000
      })
    );
  });

  it('should show WebSocket status notifications', () => {
    service.showWebSocketStatus(WebSocketState.CONNECTED).subscribe();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Connected to collaboration server',
      'Dismiss',
      expect.any(Object)
    );
  });

  it('should show session event notifications', () => {
    service.showSessionEvent('started').subscribe();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Collaboration session started. Other users can now join and edit.',
      'Dismiss',
      expect.any(Object)
    );
  });

  it('should show presenter event notifications', () => {
    service.showPresenterEvent('assigned').subscribe();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'You are now the presenter',
      'Dismiss',
      expect.any(Object)
    );
  });

  it('should dismiss all notifications', () => {
    service.dismissAll();

    expect(mockSnackBar.dismiss).toHaveBeenCalled();
  });
});