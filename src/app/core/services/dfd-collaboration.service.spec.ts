// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { HttpClient } from '@angular/common/http';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { DfdCollaborationService, CollaborationSession } from './dfd-collaboration.service';
import { LoggerService } from './logger.service';
import { WebSocketAdapter, WebSocketState } from './websocket.adapter';
import {
  IAuthService,
  IThreatModelService,
  ICollaborationNotificationService,
} from '../interfaces';

describe('DfdCollaborationService', () => {
  let service: DfdCollaborationService;
  let mockHttpClient: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    getCurrentUser: ReturnType<typeof vi.fn>;
    ensureValidSession: ReturnType<typeof vi.fn>;
  };
  let mockThreatModelService: {
    getDiagramPermissions: ReturnType<typeof vi.fn>;
  };
  let mockWebSocketAdapter: {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    sendTMIMessage: ReturnType<typeof vi.fn>;
    getTMIMessagesOfType: ReturnType<typeof vi.fn>;
    connectionState$: BehaviorSubject<WebSocketState>;
    errors$: ReturnType<typeof of>;
    isConnected: boolean;
  };
  let mockNotificationService: {
    showNotification: ReturnType<typeof vi.fn>;
    showPresenterRequestReceived: ReturnType<typeof vi.fn>;
    showPresenterEvent: ReturnType<typeof vi.fn>;
    showSessionEvent: ReturnType<typeof vi.fn>;
    showSoloTransition: ReturnType<typeof vi.fn>;
    showOperationError: ReturnType<typeof vi.fn>;
    showWebSocketStatus: ReturnType<typeof vi.fn>;
    showWebSocketError: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let mockTransloco: {
    translate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockHttpClient = {
      get: vi.fn().mockReturnValue(of({})),
      post: vi.fn().mockReturnValue(of({})),
      put: vi.fn().mockReturnValue(of({})),
      delete: vi.fn().mockReturnValue(of({})),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    mockAuthService = {
      getCurrentUser: vi.fn().mockReturnValue({
        email: 'user@example.com',
        provider: 'google',
        provider_id: 'google-123',
        display_name: 'Test User',
      }),
      ensureValidSession: vi.fn().mockReturnValue(of({ token: 'valid-token' })),
      userEmail: 'user@example.com',
      userIdp: 'google',
      providerId: 'google-123',
      userProfile: {
        display_name: 'Test User',
        provider_id: 'google-123',
      },
    } as unknown as IAuthService;

    mockThreatModelService = {
      getDiagramPermissions: vi.fn(),
      endDiagramCollaborationSession: vi.fn().mockReturnValue(of(undefined)),
    };

    mockWebSocketAdapter = {
      connect: vi.fn().mockReturnValue(of(undefined)),
      disconnect: vi.fn(),
      sendTMIMessage: vi.fn().mockReturnValue(of(undefined)),
      getTMIMessagesOfType: vi.fn().mockReturnValue(of()),
      connectionState$: new BehaviorSubject<WebSocketState>(WebSocketState.DISCONNECTED),
      errors$: of(),
      isConnected: false,
    };

    mockNotificationService = {
      showNotification: vi.fn(),
      showPresenterRequestReceived: vi.fn().mockReturnValue(of(null)),
      showPresenterEvent: vi.fn().mockReturnValue(of(undefined)),
      showSessionEvent: vi.fn().mockReturnValue(of(undefined)),
      showSoloTransition: vi.fn().mockReturnValue(of(undefined)),
      showOperationError: vi.fn().mockReturnValue(of(undefined)),
      showWebSocketStatus: vi.fn().mockReturnValue(of(undefined)),
      showWebSocketError: vi.fn().mockReturnValue(of(undefined)),
      showError: vi.fn().mockReturnValue(of(undefined)),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockTransloco = {
      translate: vi.fn().mockImplementation((key: string) => key),
    };

    service = new DfdCollaborationService(
      mockHttpClient as unknown as HttpClient,
      mockLogger as unknown as LoggerService,
      mockAuthService as unknown as IAuthService,
      mockThreatModelService as unknown as IThreatModelService,
      mockWebSocketAdapter as unknown as WebSocketAdapter,
      mockNotificationService as unknown as ICollaborationNotificationService,
      mockRouter as unknown as Router,
      mockTransloco as unknown as TranslocoService,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with default collaboration state', () => {
      const state = service.getCurrentState();

      expect(state.isActive).toBe(false);
      expect(state.users).toEqual([]);
      expect(state.currentPresenterEmail).toBeNull();
      expect(state.pendingPresenterRequests).toEqual([]);
      expect(state.sessionInfo).toBeNull();
      expect(state.existingSessionAvailable).toBeNull();
      expect(state.isPresenterModeActive).toBe(false);
      expect(state.isDiagramContextReady).toBe(false);
    });
  });

  describe('collaborationState$', () => {
    it('should emit current collaboration state', () => {
      service.collaborationState$.subscribe(state => {
        expect(state).toHaveProperty('isActive');
        expect(state).toHaveProperty('users');
        expect(state).toHaveProperty('currentPresenterEmail');
      });
    });
  });

  describe('isCollaborating$', () => {
    it('should derive from collaboration state isActive property', () => {
      service.isCollaborating$.subscribe(isCollaborating => {
        expect(typeof isCollaborating).toBe('boolean');
      });
    });
  });

  describe('getCurrentState()', () => {
    it('should return current collaboration state synchronously', () => {
      const state = service.getCurrentState();

      expect(state).toBeDefined();
      expect(typeof state.isActive).toBe('boolean');
      expect(Array.isArray(state.users)).toBe(true);
    });
  });

  describe('isCollaborating()', () => {
    it('should return false when not in collaboration', () => {
      expect(service.isCollaborating()).toBe(false);
    });
  });

  describe('hasLoadedUsers()', () => {
    it('should return false when no users are loaded', () => {
      expect(service.hasLoadedUsers()).toBe(false);
    });
  });

  describe('getCurrentUserEmail()', () => {
    it('should return current user email from auth service', () => {
      const email = service.getCurrentUserEmail();
      expect(email).toBe('user@example.com');
    });

    it('should return null when auth service has no user', () => {
      (mockAuthService as { userEmail: string | null }).userEmail = null;
      const email = service.getCurrentUserEmail();
      expect(email).toBeNull();
    });
  });

  describe('getCurrentProviderId()', () => {
    it('should return provider_id from user profile', () => {
      const providerId = service.getCurrentProviderId();
      expect(providerId).toBe('google-123');
    });

    it('should return null when no user profile', () => {
      (mockAuthService as { userProfile: { display_name: string } | null }).userProfile = null;
      const providerId = service.getCurrentProviderId();
      expect(providerId).toBeNull();
    });
  });

  describe('isCurrentUser()', () => {
    it('should return true for current user provider_id', () => {
      const result = service.isCurrentUser('google-123');
      expect(result).toBe(true);
    });

    it('should return false for different user ID', () => {
      const result = service.isCurrentUser('github-456');
      expect(result).toBe(false);
    });
  });

  describe('getCurrentPresenterEmail()', () => {
    it('should return null when no presenter is set', () => {
      const email = service.getCurrentPresenterEmail();
      expect(email).toBeNull();
    });
  });

  describe('isCurrentUserPresenterModeActive()', () => {
    it('should return false when presenter mode is not active', () => {
      const result = service.isCurrentUserPresenterModeActive();
      expect(result).toBe(false);
    });
  });

  describe('togglePresenterMode()', () => {
    it('should toggle presenter mode when current user is presenter', () => {
      // Set current user as presenter
      service.updatePresenterEmail('user@example.com');

      const initialState = service.isCurrentUserPresenterModeActive();
      const newState = service.togglePresenterMode();

      expect(newState).toBe(!initialState);
    });

    it('should not toggle when current user is not presenter', () => {
      // Set different user as presenter
      service.updatePresenterEmail('other@example.com');

      const initialState = service.isCurrentUserPresenterModeActive();
      const newState = service.togglePresenterMode();

      // Should return unchanged state
      expect(newState).toBe(initialState);
    });
  });

  describe('updatePresenterEmail()', () => {
    it('should update presenter email in state', () => {
      service.updatePresenterEmail('presenter@example.com');

      const state = service.getCurrentState();
      expect(state.currentPresenterEmail).toBe('presenter@example.com');
    });

    it('should clear presenter email when set to null', () => {
      service.updatePresenterEmail('presenter@example.com');
      service.updatePresenterEmail(null);

      const state = service.getCurrentState();
      expect(state.currentPresenterEmail).toBeNull();
    });
  });

  describe('addPresenterRequest()', () => {
    it('should add presenter request to pending requests', () => {
      service.addPresenterRequest('requester@example.com');

      const state = service.getCurrentState();
      expect(state.pendingPresenterRequests).toContain('requester@example.com');
    });

    it('should not duplicate presenter requests', () => {
      service.addPresenterRequest('requester@example.com');
      service.addPresenterRequest('requester@example.com');

      const state = service.getCurrentState();
      const requestCount = state.pendingPresenterRequests.filter(
        r => r === 'requester@example.com',
      ).length;
      expect(requestCount).toBe(1);
    });
  });

  describe('hasPermission()', () => {
    it('should return false when not collaborating', () => {
      const result = service.hasPermission('edit');
      expect(result).toBe(false);
    });
  });

  describe('isCurrentUserHost()', () => {
    it('should return false when not collaborating', () => {
      const result = service.isCurrentUserHost();
      expect(result).toBe(false);
    });
  });

  describe('toggleCollaboration()', () => {
    it('should error when diagram context is not set', () => {
      let error: Error | undefined;
      service.toggleCollaboration().subscribe({
        error: (err: Error) => {
          error = err;
        },
      });
      expect(error).toBeDefined();
      expect(error!.message).toContain('context not ready');
    });

    it('should call startOrJoinCollaboration when not collaborating and context is set', () => {
      // Set diagram context so isDiagramContextSet() returns true
      service.setDiagramContext('tm-1', 'dg-1');

      const startSpy = vi.spyOn(service, 'startOrJoinCollaboration').mockReturnValue(of(true));

      let result: boolean | undefined;
      service.toggleCollaboration().subscribe(val => {
        result = val;
      });

      expect(startSpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('denyPresenterRequest()', () => {
    it('should send presenter_denied_request with denied_user field', () => {
      // Set up collaboration state with host and a requesting user
      service.updateAllParticipants(
        [
          {
            user: {
              principal_type: 'user',
              provider: 'google',
              provider_id: 'google-123',
              email: 'user@example.com',
              name: 'Test User',
            },
            permissions: 'writer',
            last_activity: new Date().toISOString(),
          },
          {
            user: {
              principal_type: 'user',
              provider: 'github',
              provider_id: 'github-456',
              email: 'requester@example.com',
              name: 'Requester',
            },
            permissions: 'writer',
            last_activity: new Date().toISOString(),
          },
        ],
        {
          principal_type: 'user',
          provider: 'google',
          provider_id: 'google-123',
          email: 'user@example.com',
          display_name: 'Test User',
        },
      );

      // Add a pending request
      service.addPresenterRequest('requester@example.com');

      let result: boolean | undefined;
      service.denyPresenterRequest('requester@example.com').subscribe(val => {
        result = val;
      });

      expect(result).toBe(true);

      // Verify the message sent has the correct structure
      const sentMessage = mockWebSocketAdapter.sendTMIMessage.mock.calls[0][0];
      expect(sentMessage.message_type).toBe('presenter_denied_request');
      expect(sentMessage.denied_user).toBeDefined();
      expect(sentMessage.denied_user.email).toBe('requester@example.com');
      expect(sentMessage.denied_user.principal_type).toBe('user');
      // Should NOT have current_presenter field (old format)
      expect(sentMessage.current_presenter).toBeUndefined();
    });

    it('should error when denied user not found in session', () => {
      // Set up as host but without the target user
      service.updateAllParticipants(
        [
          {
            user: {
              principal_type: 'user',
              provider: 'google',
              provider_id: 'google-123',
              email: 'user@example.com',
              name: 'Test User',
            },
            permissions: 'writer',
            last_activity: new Date().toISOString(),
          },
        ],
        {
          principal_type: 'user',
          provider: 'google',
          provider_id: 'google-123',
          email: 'user@example.com',
          display_name: 'Test User',
        },
      );

      let error: Error | undefined;
      service.denyPresenterRequest('nonexistent@example.com').subscribe({
        error: (err: Error) => {
          error = err;
        },
      });

      expect(error).toBeDefined();
      expect(error!.message).toContain('not found');
    });
  });

  describe('updateAllParticipants() presenter notifications', () => {
    it('should show presenter assigned notification when presenter changes', () => {
      const newPresenter = {
        principal_type: 'user' as const,
        provider: 'github',
        provider_id: 'github-456',
        email: 'presenter@example.com',
        display_name: 'New Presenter',
      };

      service.updateAllParticipants(
        [
          {
            user: {
              principal_type: 'user',
              provider: 'github',
              provider_id: 'github-456',
              email: 'presenter@example.com',
              name: 'New Presenter',
            },
            permissions: 'writer',
            last_activity: new Date().toISOString(),
          },
        ],
        undefined,
        newPresenter,
      );

      expect(mockNotificationService.showPresenterEvent).toHaveBeenCalledWith(
        'assigned',
        'New Presenter',
      );
    });

    it('should show cleared notification when presenter is removed', () => {
      // First set a presenter
      service.updateAllParticipants(
        [
          {
            user: {
              principal_type: 'user',
              provider: 'github',
              provider_id: 'github-456',
              email: 'presenter@example.com',
              name: 'Presenter',
            },
            permissions: 'writer',
            last_activity: new Date().toISOString(),
          },
        ],
        undefined,
        {
          principal_type: 'user',
          provider: 'github',
          provider_id: 'github-456',
          email: 'presenter@example.com',
          display_name: 'Presenter',
        },
      );

      mockNotificationService.showPresenterEvent.mockClear();

      // Now clear the presenter
      service.updateAllParticipants(
        [
          {
            user: {
              principal_type: 'user',
              provider: 'github',
              provider_id: 'github-456',
              email: 'presenter@example.com',
              name: 'Presenter',
            },
            permissions: 'writer',
            last_activity: new Date().toISOString(),
          },
        ],
        undefined,
        null,
      );

      expect(mockNotificationService.showPresenterEvent).toHaveBeenCalledWith('cleared');
    });
  });

  describe('graceful session exit (#274) - no navigation', () => {
    /** Minimal session fixture where the current user is a participant (not host) */
    const makeParticipantSession = (): CollaborationSession => ({
      session_id: 'sess-1',
      threat_model_id: 'tm-1',
      threat_model_name: 'Test TM',
      diagram_id: 'dg-1',
      diagram_name: 'Test Diagram',
      participants: [],
      websocket_url: 'wss://example.com/ws',
      host: {
        principal_type: 'user',
        provider: 'github',
        provider_id: 'github-999',
        display_name: 'Host User',
        email: 'host@example.com',
      },
    });

    /** Minimal session fixture where the current user is the host */
    const makeHostSession = (): CollaborationSession => ({
      session_id: 'sess-2',
      threat_model_id: 'tm-1',
      threat_model_name: 'Test TM',
      diagram_id: 'dg-1',
      diagram_name: 'Test Diagram',
      participants: [],
      websocket_url: 'wss://example.com/ws',
      host: {
        principal_type: 'user',
        provider: 'google',
        provider_id: 'google-123',
        display_name: 'Test User',
        email: 'user@example.com',
      },
    });

    type ServiceInternals = {
      _currentSession: CollaborationSession;
      _threatModelId: string;
      _diagramId: string;
      _collaborationState$: { next: (v: unknown) => void; value: Record<string, unknown> };
      _setupWebSocketListeners: () => void;
    };

    /** Set up the service as if a participant has joined a session */
    function arrangeParticipantSession(): void {
      const svc = service as unknown as ServiceInternals;
      svc._currentSession = makeParticipantSession();
      svc._threatModelId = 'tm-1';
      svc._diagramId = 'dg-1';
      svc._collaborationState$.next({ ...svc._collaborationState$.value, isActive: true });
      svc._setupWebSocketListeners();
    }

    /** Set up the service as if a host has joined a session */
    function arrangeHostSession(): void {
      const svc = service as unknown as ServiceInternals;
      svc._currentSession = makeHostSession();
      svc._threatModelId = 'tm-1';
      svc._diagramId = 'dg-1';
      svc._collaborationState$.next({ ...svc._collaborationState$.value, isActive: true });
      svc._setupWebSocketListeners();
    }

    it('leaveSession stays on the page and shows the left message', () => {
      arrangeParticipantSession();
      service.leaveSession().subscribe();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('left');
    });

    it('endCollaboration stays on the page and shows the ended-by-you message', () => {
      arrangeHostSession();
      service.endCollaboration().subscribe();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('ended_by_you');
    });

    it('endCollaboration cleans up and messages even when the REST call fails', () => {
      arrangeHostSession();
      (
        mockThreatModelService as { endDiagramCollaborationSession: ReturnType<typeof vi.fn> }
      ).endDiagramCollaborationSession.mockReturnValue(throwError(() => new Error('server error')));
      let errored = false;
      service.endCollaboration().subscribe({ error: () => (errored = true) });
      expect(errored).toBe(true);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('ended_by_you');
    });

    it('unexpected disconnect stays on the page and shows the disconnected message', () => {
      arrangeParticipantSession();
      // Emit an unexpected disconnection (intentionalDisconnection flag is false)
      mockWebSocketAdapter.connectionState$.next(WebSocketState.DISCONNECTED);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('disconnected');
    });

    it('websocket ERROR stays on the page and shows the error message', () => {
      arrangeParticipantSession();
      mockWebSocketAdapter.connectionState$.next(WebSocketState.ERROR);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('error');
    });

    it('fatal websocket error stays on the page and shows the error message', () => {
      arrangeParticipantSession();
      // Call the private method directly with a fatal error code
      (
        service as unknown as {
          _handleWebSocketError: (msg: { error: string; message: string }) => void;
        }
      )._handleWebSocketError({ error: 'session_not_found', message: 'Session does not exist' });
      expect(mockRouter.navigate).not.toHaveBeenCalled();
      expect(mockNotificationService.showSoloTransition).toHaveBeenCalledWith('error');
    });
  });

  describe('Cleanup', () => {
    it('should clean up subscriptions on destroy', () => {
      service.ngOnDestroy();
      expect(service).toBeTruthy();
    });
  });
});
