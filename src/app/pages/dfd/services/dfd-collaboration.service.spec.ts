// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';
import { of } from 'rxjs';
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

  beforeEach(() => {
    // Create mocks
    mockLoggerService = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    mockAuthService = {
      userEmail: 'test@example.com',
    };

    mockThreatModelService = {
      startDiagramCollaborationSession: vi.fn(),
      endDiagramCollaborationSession: vi.fn(),
    };

    mockWebSocketAdapter = {
      connect: vi.fn().mockReturnValue(of(undefined)),
      disconnect: vi.fn(),
    };

    // Create service instance directly
    service = new DfdCollaborationService(
      mockLoggerService,
      mockAuthService,
      mockThreatModelService,
      mockWebSocketAdapter,
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
      participants: [{ user_id: 'test@example.com', joined_at: '2023-01-01T00:00:00Z' }],
      websocket_url: fullUrl,
    };

    mockThreatModelService.startDiagramCollaborationSession.mockReturnValue(of(mockSession));

    service.startCollaboration().subscribe();

    expect(mockWebSocketAdapter.connect).toHaveBeenCalledWith(fullUrl);
  });

  it('should handle full WebSocket URLs (wss://)', () => {
    const fullUrl = 'wss://api.example.com/threat_models/123/diagrams/456/ws';
    const mockSession = {
      session_id: 'session-123',
      threat_model_id: 'test-tm-id',
      diagram_id: 'test-diagram-id',
      participants: [{ user_id: 'test@example.com', joined_at: '2023-01-01T00:00:00Z' }],
      websocket_url: fullUrl,
    };

    mockThreatModelService.startDiagramCollaborationSession.mockReturnValue(of(mockSession));

    service.startCollaboration().subscribe();

    expect(mockWebSocketAdapter.connect).toHaveBeenCalledWith(fullUrl);
  });

  it('should convert relative URLs to absolute URLs using API server', () => {
    const relativeUrl = '/threat_models/123/diagrams/456/ws';
    const mockSession = {
      session_id: 'session-123',
      threat_model_id: 'test-tm-id',
      diagram_id: 'test-diagram-id',
      participants: [{ user_id: 'test@example.com', joined_at: '2023-01-01T00:00:00Z' }],
      websocket_url: relativeUrl,
    };

    mockThreatModelService.startDiagramCollaborationSession.mockReturnValue(of(mockSession));

    service.startCollaboration().subscribe();

    // Should convert http://localhost:8080 -> ws://localhost:8080 + relative path
    expect(mockWebSocketAdapter.connect).toHaveBeenCalledWith('ws://localhost:8080/threat_models/123/diagrams/456/ws');
  });

  it('should handle relative URLs without leading slash', () => {
    const relativeUrl = 'threat_models/123/diagrams/456/ws';
    const mockSession = {
      session_id: 'session-123',
      threat_model_id: 'test-tm-id',
      diagram_id: 'test-diagram-id',
      participants: [{ user_id: 'test@example.com', joined_at: '2023-01-01T00:00:00Z' }],
      websocket_url: relativeUrl,
    };

    mockThreatModelService.startDiagramCollaborationSession.mockReturnValue(of(mockSession));

    service.startCollaboration().subscribe();

    // Should add leading slash and convert to absolute URL
    expect(mockWebSocketAdapter.connect).toHaveBeenCalledWith('ws://localhost:8080/threat_models/123/diagrams/456/ws');
  });

});