// This project uses vitest for all unit tests, with native vitest syntax
// Execute all tests using: "pnpm run test"
// Execute this test only using: "pnpm run test" followed by the relative path to this test file from the project root.

import '@angular/compiler';

import { ActivityTrackerService } from './activity-tracker.service';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';

describe('ActivityTrackerService', () => {
  let service: ActivityTrackerService;
  let mockLogger: any;
  let mockNgZone: any;

  beforeEach(() => {
    mockLogger = {
      debugComponent: vi.fn(),
    };

    mockNgZone = {
      run: vi.fn((callback: () => any) => callback()),
      runOutsideAngular: vi.fn((callback: () => any) => callback()),
    };

    service = new ActivityTrackerService(mockLogger, mockNgZone);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should mark user as active initially', () => {
    expect(service.isUserActive()).toBe(true);
  });

  it('should detect user activity on mouse move', () => {
    const mouseMoveEvent = new MouseEvent('mousemove');
    document.dispatchEvent(mouseMoveEvent);

    expect(service.isUserActive()).toBe(true);
  });

  it('should detect user activity on keydown', () => {
    const keydownEvent = new KeyboardEvent('keydown');
    document.dispatchEvent(keydownEvent);

    expect(service.isUserActive()).toBe(true);
  });

  it('should detect user activity on click', () => {
    const clickEvent = new MouseEvent('click');
    document.dispatchEvent(clickEvent);

    expect(service.isUserActive()).toBe(true);
  });

  it('should return time since last activity', () => {
    const initialTimeSince = service.getTimeSinceLastActivity();
    expect(initialTimeSince).toBeLessThan(100); // Should be very recent
  });

  it('should allow manually marking user as active', () => {
    // Manually mark as active
    service.markActive();

    expect(service.isUserActive()).toBe(true);
  });

  it('should update lastActivity$ observable on activity', done => {
    const initialTime = new Date();

    service.lastActivity$.subscribe(activityTime => {
      expect(activityTime).toBeDefined();
      expect(activityTime instanceof Date).toBe(true);
      expect(activityTime.getTime()).toBeGreaterThanOrEqual(initialTime.getTime());
      done();
    });

    // Manually trigger activity
    service.markActive();
  });
});
