// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';
import { of } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { DfdNotificationService } from './dfd-notification.service';
import { WebSocketState } from '../../../core/services/websocket.adapter';

describe('DfdNotificationService', () => {
  let service: DfdNotificationService;
  let mockSnackBar: any;
  let mockLogger: any;

  beforeEach(() => {
    // Create mocks
    mockSnackBar = {
      open: vi.fn(),
      dismiss: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Setup default snackbar behavior
    const mockSnackBarRef = {
      onAction: vi.fn(() => of(null)),
      afterDismissed: vi.fn(() => of(null)),
      dismiss: vi.fn(),
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
        duration: 3000,
      }),
    );
  });

  it('should suppress WebSocket success notifications', () => {
    // Success states should not show notifications (already indicated by UI icons)
    service.showWebSocketStatus(WebSocketState.CONNECTED).subscribe();
    service.showWebSocketStatus(WebSocketState.CONNECTING).subscribe();
    service.showWebSocketStatus(WebSocketState.RECONNECTING).subscribe();

    expect(mockSnackBar.open).not.toHaveBeenCalled();
  });

  it('should show WebSocket error notifications', () => {
    service.showWebSocketStatus(WebSocketState.ERROR).subscribe();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'Connection error. Working in offline mode.',
      'Retry',
      expect.objectContaining({
        actionCallback: undefined,
        actionLabel: 'Retry',
        type: 'error',
      }),
    );
  });

  it('should suppress session start/end notifications', () => {
    // Session start/end should not show notifications (already indicated by collaboration icon)
    service.showSessionEvent('started').subscribe();
    service.showSessionEvent('ended').subscribe();

    expect(mockSnackBar.open).not.toHaveBeenCalled();
  });

  it('should show user join/leave notifications', () => {
    service.showSessionEvent('userJoined', 'John Doe').subscribe();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'John Doe joined the collaboration',
      'Dismiss',
      expect.any(Object),
    );
  });

  it('should show presenter event notifications', () => {
    service.showPresenterEvent('assigned').subscribe();

    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'You are now the presenter',
      'Dismiss',
      expect.any(Object),
    );
  });

  it('should dismiss all notifications', () => {
    service.dismissAll();

    expect(mockSnackBar.dismiss).toHaveBeenCalled();
  });
});
