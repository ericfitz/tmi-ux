// This project uses vitest for all unit tests, with native vitest syntax
// Execute all tests using: "pnpm run test"
// Execute this test only using: "pnpm run test" followed by the relative path to this test file from the project root.

import '@angular/compiler';

import {
  SessionExpiryDialogComponent,
  SessionExpiryDialogData,
} from './session-expiry-dialog.component';
import { vi, expect, beforeEach, describe, it } from 'vitest';

describe('SessionExpiryDialogComponent', () => {
  let component: SessionExpiryDialogComponent;
  let mockDialogRef: any;
  let mockTransloco: any;
  let mockData: SessionExpiryDialogData;

  beforeEach(() => {
    mockDialogRef = {
      close: vi.fn(),
      disableClose: false,
    };

    mockTransloco = {
      translate: vi.fn(),
    };

    const mockOnExtendSession = vi.fn();
    const mockOnLogout = vi.fn();

    mockData = {
      expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
      onExtendSession: mockOnExtendSession,
      onLogout: mockOnLogout,
    };

    // Setup transloco mock responses
    mockTransloco.translate.mockImplementation((key: string, params?: any) => {
      switch (key) {
        case 'sessionExpiry.timeFormat.minutesSeconds':
          return `${params.minutes}:${params.seconds}`;
        case 'sessionExpiry.timeFormat.minutes':
          return '1 minute';
        case 'sessionExpiry.timeFormat.seconds':
          return `${params.seconds} seconds`;
        default:
          return key;
      }
    });

    // Create component directly without TestBed
    component = new SessionExpiryDialogComponent(mockDialogRef, mockData, mockTransloco);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should disable dialog close on creation', () => {
    expect(mockDialogRef.disableClose).toBe(true);
  });

  it('should format time remaining as minutes:seconds', () => {
    // Mock current time to ensure consistent test results
    const baseTime = Date.now();
    vi.setSystemTime(new Date(baseTime));

    // Set expiry to 2 minutes 30 seconds from mocked time
    component.data.expiresAt = new Date(baseTime + 150000);

    // Manually trigger update to test formatting
    (component as any).updateTimeRemaining();

    expect(component.timeRemaining).toBe('2:30');

    vi.useRealTimers();
  });

  it('should format time remaining as "1:00" when exactly 60 seconds left', () => {
    // Set expiry to exactly 60 seconds from now
    const baseTime = Date.now();
    component.data.expiresAt = new Date(baseTime + 60000);
    vi.spyOn(Date, 'now').mockReturnValue(baseTime);

    (component as any).updateTimeRemaining();

    expect(component.timeRemaining).toBe('1:00');
  });

  it('should format time remaining as seconds only when less than a minute', () => {
    // Mock current time to ensure consistent test results
    const baseTime = 1000000000; // Fixed timestamp
    vi.setSystemTime(new Date(baseTime));

    // Set expiry to 30 seconds from mocked time
    component.data.expiresAt = new Date(baseTime + 30000);

    (component as any).updateTimeRemaining();

    expect(component.timeRemaining).toBe('30 seconds');

    vi.useRealTimers();
  });

  it('should call onExtendSession and close dialog when extend button clicked', () => {
    component.onExtendSession();

    expect(mockData.onExtendSession).toHaveBeenCalled();
    expect(mockDialogRef.close).toHaveBeenCalledWith('extend');
  });

  it('should call onLogout and close dialog when logout button clicked', () => {
    component.onLogout();

    expect(mockData.onLogout).toHaveBeenCalled();
    expect(mockDialogRef.close).toHaveBeenCalledWith('logout');
  });

  it('should calculate remaining time correctly', () => {
    const baseTime = Date.now();
    vi.setSystemTime(new Date(baseTime));

    component.data.expiresAt = new Date(baseTime + 65000); // 1 minute 5 seconds

    const remainingTime = (component as any).getRemainingTimeInSeconds();
    expect(remainingTime).toBe(65);

    vi.useRealTimers();
  });

  it('should return zero for expired tokens', () => {
    const baseTime = Date.now();
    component.data.expiresAt = new Date(baseTime - 1000); // 1 second ago

    vi.spyOn(Date, 'now').mockReturnValue(baseTime);

    const remainingTime = (component as any).getRemainingTimeInSeconds();
    expect(remainingTime).toBe(0);
  });

  it('should format seconds with leading zeros in minutes:seconds format', () => {
    // Set expiry to exactly 2 minutes 4 seconds from now (124 seconds)
    const baseTime = Date.now();
    vi.setSystemTime(new Date(baseTime));

    component.data.expiresAt = new Date(baseTime + 124000);

    (component as any).updateTimeRemaining();

    expect(component.timeRemaining).toBe('2:04');

    vi.useRealTimers();
  });

  it('should stop countdown when component is destroyed', () => {
    // Create a mock subscription
    const mockSubscription = { unsubscribe: vi.fn() };
    (component as any).countdownSubscription = mockSubscription;

    component.ngOnDestroy();

    expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    expect((component as any).countdownSubscription).toBeNull();
  });
});
