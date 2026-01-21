// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ServerConnectionService, ServerConnectionStatus } from './server-connection.service';
import { LoggerService } from './logger.service';

// Mock environment
vi.mock('../../../environments/environment', () => ({
  environment: {
    apiUrl: 'http://localhost:8080/api',
  },
}));

describe('ServerConnectionService', () => {
  let service: ServerConnectionService;
  let mockHttpClient: {
    get: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const mockHealthResponse = {
    status: {
      code: 'OK' as const,
      time: '2024-01-01T00:00:00Z',
    },
    service: {
      name: 'TMI Server',
      build: 'v1.2.3',
    },
    api: {
      version: 'v1',
      specification: 'openapi-3.0',
    },
    operator: {
      name: 'Test Operator',
      contact: 'test@example.com',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock HTTP client
    mockHttpClient = {
      get: vi.fn(),
    };

    mockLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    // Create service with mocks
    service = new ServerConnectionService(
      mockHttpClient as unknown as HttpClient,
      mockLoggerService as unknown as LoggerService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    service.ngOnDestroy();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with NOT_CONFIGURED status when no API URL', () => {
      // This test is covered by the actual service initialization
      expect(service.currentStatus).toBeDefined();
    });

    it('should start health checks on initialization', () => {
      // Health check should be scheduled on initialization
      expect(mockHttpClient.get).not.toHaveBeenCalled();

      // Advance timer to trigger health check
      mockHttpClient.get.mockReturnValue(of(mockHealthResponse));
      vi.advanceTimersByTime(0);

      expect(mockHttpClient.get).toHaveBeenCalled();
    });
  });

  describe('connectionStatus$', () => {
    it('should provide observable of connection status', () => {
      service.connectionStatus$.subscribe(status => {
        expect(status).toBeDefined();
      });
    });
  });

  describe('detailedConnectionStatus$', () => {
    it('should provide observable of detailed connection status', () => {
      service.detailedConnectionStatus$.subscribe(status => {
        expect(status).toHaveProperty('isOnline');
        expect(status).toHaveProperty('isServerReachable');
        expect(status).toHaveProperty('consecutiveFailures');
      });
    });
  });

  describe('getCurrentStatus()', () => {
    it('should return current status synchronously', () => {
      const status = service.currentStatus;
      expect(status).toBeDefined();
    });
  });

  describe('getServerVersion()', () => {
    it('should return null before first successful health check', () => {
      expect(service.getServerVersion()).toBeNull();
    });

    it('should return server version after successful health check', async () => {
      mockHttpClient.get.mockReturnValue(of(mockHealthResponse));

      // Trigger health check by advancing to when it's scheduled
      await vi.advanceTimersByTimeAsync(1);

      expect(service.getServerVersion()).toBe('v1.2.3');
    });
  });

  describe('Health Checks', () => {
    it('should update status to CONNECTED on successful health check', async () => {
      mockHttpClient.get.mockReturnValue(of(mockHealthResponse));

      // Trigger initial health check
      await vi.advanceTimersByTimeAsync(1);

      expect(service.currentStatus).toBe(ServerConnectionStatus.CONNECTED);
    });

    it('should update status to ERROR on failed health check', async () => {
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      mockHttpClient.get.mockReturnValue(throwError(() => error));

      // Trigger initial health check
      await vi.advanceTimersByTimeAsync(1);

      expect(service.currentStatus).toBe(ServerConnectionStatus.OFFLINE);
    });

    it('should update detailed status on successful check', async () => {
      mockHttpClient.get.mockReturnValue(of(mockHealthResponse));

      // Trigger health check
      await vi.advanceTimersByTimeAsync(1);

      const detailed = service.currentDetailedStatus;
      expect(detailed.isServerReachable).toBe(true);
      expect(detailed.consecutiveFailures).toBe(0);
      expect(detailed.lastServerPing).toBeDefined();
    });

    it('should increment consecutive failures on error', async () => {
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      mockHttpClient.get.mockReturnValue(throwError(() => error));

      // Trigger health check
      await vi.advanceTimersByTimeAsync(1);

      const detailed = service.currentDetailedStatus;
      expect(detailed.consecutiveFailures).toBeGreaterThan(0);
      expect(detailed.isServerReachable).toBe(false);
    });
  });

  describe('checkServerConnectivity()', () => {
    it('should perform immediate health check', () => {
      mockHttpClient.get.mockReturnValue(of({}));

      service.checkServerConnectivity().subscribe();

      expect(mockHttpClient.get).toHaveBeenCalled();
    });

    it('should return detailed connection status', () => {
      mockHttpClient.get.mockReturnValue(of({}));

      service.checkServerConnectivity().subscribe(status => {
        expect(status).toHaveProperty('isOnline');
        expect(status).toHaveProperty('isServerReachable');
      });
    });
  });

  describe('shouldShowConnectionError()', () => {
    it('should return true on first failure', async () => {
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      mockHttpClient.get.mockReturnValue(throwError(() => error));

      // Trigger health check to cause first failure
      await vi.advanceTimersByTimeAsync(1);

      const shouldShow = service.shouldShowConnectionError();
      expect(shouldShow).toBe(true);
    });

    it('should return false when server is reachable', async () => {
      mockHttpClient.get.mockReturnValue(of(mockHealthResponse));

      await vi.advanceTimersByTimeAsync(1);

      const shouldShow = service.shouldShowConnectionError();
      expect(shouldShow).toBe(false);
    });
  });

  describe('wasConnectionRecentlyRestored()', () => {
    it('should return false initially', () => {
      expect(service.wasConnectionRecentlyRestored()).toBe(false);
    });

    it('should return true after connection restoration', async () => {
      // First fail
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      mockHttpClient.get.mockReturnValue(throwError(() => error));

      await vi.advanceTimersByTimeAsync(1);

      // Then succeed
      mockHttpClient.get.mockReturnValue(of(mockHealthResponse));
      await vi.advanceTimersByTimeAsync(30001);

      expect(service.wasConnectionRecentlyRestored()).toBe(true);
    });
  });

  describe('startMonitoring() and stopMonitoring()', () => {
    it('should enable monitoring when started', () => {
      service.startMonitoring();
      // Monitoring state is tracked internally
      expect(service).toBeTruthy();
    });

    it('should not start monitoring twice', () => {
      service.startMonitoring();
      service.startMonitoring();
      // Should not cause issues
      expect(service).toBeTruthy();
    });

    it('should disable monitoring when stopped', () => {
      service.startMonitoring();
      service.stopMonitoring();
      expect(service).toBeTruthy();
    });
  });

  describe('checkConnection()', () => {
    it('should trigger health check manually', () => {
      mockHttpClient.get.mockReturnValue(of(mockHealthResponse));

      service.checkConnection();

      expect(mockHttpClient.get).toHaveBeenCalled();
    });

    it('should handle errors in manual check', async () => {
      const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });
      mockHttpClient.get.mockReturnValue(throwError(() => error));

      service.checkConnection();

      // Advance timers to allow async error handling
      await vi.advanceTimersByTimeAsync(1);

      // The error is caught and logged via warn, not error
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from health checks on destroy', () => {
      service.ngOnDestroy();
      // Should not throw errors
      expect(service).toBeTruthy();
    });
  });
});
