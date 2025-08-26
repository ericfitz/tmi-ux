// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';
import { of, Subject } from 'rxjs';
import { describe, it, beforeEach, expect, vi } from 'vitest';

import { DfdCollaborationService } from './dfd-collaboration.service';

// Mock the environment module
vi.mock('../../../../environments/environment', () => ({
  environment: {
    production: false,
    logLevel: 'DEBUG',
    apiUrl: 'http://localhost:8080',
    authTokenExpiryMinutes: 60,
    operatorName: 'TMI Operator (Test)',
    operatorContact: 'test@example.com',
  },
}));

describe('DfdCollaborationService WebSocket URL handling', () => {
  let service: DfdCollaborationService;
  let mockLoggerService: any;
  let mockAuthService: any;
  let mockThreatModelService: any;
  let mockWebSocketAdapter: any;
  let mockNotificationService: any;
  let mockRouter: any;

  beforeEach(() => {
    // Create mocks
    mockLoggerService = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockAuthService = {
      userEmail: 'test@example.com',
      getStoredToken: vi.fn().mockReturnValue({
        token: 'mock-jwt-token-12345',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600000),
      }),
    };

    mockThreatModelService = {
      startDiagramCollaborationSession: vi.fn(),
      endDiagramCollaborationSession: vi.fn(),
    };

    mockWebSocketAdapter = {
      connect: vi.fn().mockReturnValue(of(undefined)),
      disconnect: vi.fn(),
      connectionState$: new Subject(),
      errors$: new Subject(),
      messages$: new Subject(),
      getMessagesOfType: vi.fn().mockReturnValue(of({})),
      getTMIMessagesOfType: vi.fn().mockReturnValue(of({})),
      sendMessage: vi.fn(),
      sendTMIMessage: vi.fn().mockReturnValue(of(undefined)),
    };

    mockNotificationService = {
      showSessionEvent: vi.fn().mockReturnValue(of(undefined)),
      showWebSocketConnectionStatus: vi.fn().mockReturnValue(of(undefined)),
      showWebSocketStatus: vi.fn().mockReturnValue(of(undefined)),
      showWebSocketError: vi.fn().mockReturnValue(of(undefined)),
      showPresenterEvent: vi.fn().mockReturnValue(of(undefined)),
      showOperationError: vi.fn().mockReturnValue(of(undefined)),
      showError: vi.fn(),
      showWarning: vi.fn(),
      showInfo: vi.fn(),
      showSuccess: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    // Create service instance directly
    service = new DfdCollaborationService(
      mockLoggerService,
      mockAuthService,
      mockThreatModelService,
      mockWebSocketAdapter,
      mockNotificationService,
      mockRouter,
    );

    // Set up diagram context
    service.setDiagramContext('test-tm-id', 'test-diagram-id');
  });

  it('should handle full WebSocket URLs (ws://)', () => {
    const fullUrl = 'ws://api.example.com/threat_models/123/diagrams/456/ws';
    const mockSession = {
      session_id: 'session-123',
      threat_model_id: 'test-tm-id',
      diagram_id: 'test-diagram-id',
      participants: [
        { user_id: 'test@example.com', joined_at: '2023-01-01T00:00:00Z', permissions: 'writer' },
      ],
      websocket_url: fullUrl,
      session_manager: 'test@example.com',
    };

    mockThreatModelService.startDiagramCollaborationSession.mockReturnValue(of(mockSession));

    service.startCollaboration().subscribe();

    expect(mockWebSocketAdapter.connect).toHaveBeenCalledWith(
      `${fullUrl}?token=mock-jwt-token-12345`,
    );
  });

  it('should handle full WebSocket URLs (wss://)', () => {
    const fullUrl = 'wss://api.example.com/threat_models/123/diagrams/456/ws';
    const mockSession = {
      session_id: 'session-123',
      threat_model_id: 'test-tm-id',
      diagram_id: 'test-diagram-id',
      participants: [
        { user_id: 'test@example.com', joined_at: '2023-01-01T00:00:00Z', permissions: 'writer' },
      ],
      websocket_url: fullUrl,
      session_manager: 'test@example.com',
    };

    mockThreatModelService.startDiagramCollaborationSession.mockReturnValue(of(mockSession));

    service.startCollaboration().subscribe();

    expect(mockWebSocketAdapter.connect).toHaveBeenCalledWith(
      `${fullUrl}?token=mock-jwt-token-12345`,
    );
  });

  it('should convert relative URLs to absolute URLs using API server', () => {
    const relativeUrl = '/threat_models/123/diagrams/456/ws';
    const mockSession = {
      session_id: 'session-123',
      threat_model_id: 'test-tm-id',
      diagram_id: 'test-diagram-id',
      participants: [
        { user_id: 'test@example.com', joined_at: '2023-01-01T00:00:00Z', permissions: 'writer' },
      ],
      websocket_url: relativeUrl,
      session_manager: 'test@example.com',
    };

    mockThreatModelService.startDiagramCollaborationSession.mockReturnValue(of(mockSession));

    service.startCollaboration().subscribe();

    // Should convert http://localhost:8080 -> ws://localhost:8080 + relative path + token
    expect(mockWebSocketAdapter.connect).toHaveBeenCalledWith(
      'ws://localhost:8080/threat_models/123/diagrams/456/ws?token=mock-jwt-token-12345',
    );
  });

  it('should handle relative URLs without leading slash', () => {
    const relativeUrl = 'threat_models/123/diagrams/456/ws';
    const mockSession = {
      session_id: 'session-123',
      threat_model_id: 'test-tm-id',
      diagram_id: 'test-diagram-id',
      participants: [
        { user_id: 'test@example.com', joined_at: '2023-01-01T00:00:00Z', permissions: 'writer' },
      ],
      websocket_url: relativeUrl,
      session_manager: 'test@example.com',
    };

    mockThreatModelService.startDiagramCollaborationSession.mockReturnValue(of(mockSession));

    service.startCollaboration().subscribe();

    // Should add leading slash and convert to absolute URL + token
    expect(mockWebSocketAdapter.connect).toHaveBeenCalledWith(
      'ws://localhost:8080/threat_models/123/diagrams/456/ws?token=mock-jwt-token-12345',
    );
  });

  it('should handle missing JWT token gracefully', () => {
    // Override the mock to return null (no token)
    mockAuthService.getStoredToken.mockReturnValue(null);

    const relativeUrl = '/threat_models/123/diagrams/456/ws';
    const mockSession = {
      session_id: 'session-123',
      threat_model_id: 'test-tm-id',
      diagram_id: 'test-diagram-id',
      participants: [
        { user_id: 'test@example.com', joined_at: '2023-01-01T00:00:00Z', permissions: 'writer' },
      ],
      websocket_url: relativeUrl,
      session_manager: 'test@example.com',
    };

    mockThreatModelService.startDiagramCollaborationSession.mockReturnValue(of(mockSession));

    service.startCollaboration().subscribe();

    // Should still attempt connection but without token, and log warning
    expect(mockWebSocketAdapter.connect).toHaveBeenCalledWith(
      'ws://localhost:8080/threat_models/123/diagrams/456/ws',
    );
    expect(mockLoggerService.warn).toHaveBeenCalledWith(
      'No JWT token available for WebSocket authentication',
    );
  });
});
