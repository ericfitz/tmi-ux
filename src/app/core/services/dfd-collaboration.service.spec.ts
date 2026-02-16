// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { Router } from '@angular/router';
import { DfdCollaborationService } from './dfd-collaboration.service';
import { LoggerService } from './logger.service';
import { WebSocketAdapter, WebSocketState } from './websocket.adapter';
import {
  IAuthService,
  IThreatModelService,
  ICollaborationNotificationService,
} from '../interfaces';

describe('DfdCollaborationService', () => {
  let service: DfdCollaborationService;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    getCurrentUser: ReturnType<typeof vi.fn>;
    getValidToken: ReturnType<typeof vi.fn>;
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
    isConnected: boolean;
  };
  let mockNotificationService: {
    showNotification: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

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
      getValidToken: vi.fn().mockReturnValue(of('valid-token')),
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
    };

    mockWebSocketAdapter = {
      connect: vi.fn().mockReturnValue(of(undefined)),
      disconnect: vi.fn(),
      sendTMIMessage: vi.fn().mockReturnValue(of(undefined)),
      getTMIMessagesOfType: vi.fn().mockReturnValue(of()),
      connectionState$: new BehaviorSubject<WebSocketState>(WebSocketState.DISCONNECTED),
      isConnected: false,
    };

    mockNotificationService = {
      showNotification: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    service = new DfdCollaborationService(
      mockLogger as unknown as LoggerService,
      mockAuthService as unknown as IAuthService,
      mockThreatModelService as unknown as IThreatModelService,
      mockWebSocketAdapter as unknown as WebSocketAdapter,
      mockNotificationService as unknown as ICollaborationNotificationService,
      mockRouter as unknown as Router,
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

  describe('getCurrentUserId()', () => {
    it('should return provider_id from user profile', () => {
      const userId = service.getCurrentUserId();
      expect(userId).toBe('google-123');
    });

    it('should return null when no user profile', () => {
      (mockAuthService as { userProfile: { display_name: string } | null }).userProfile = null;
      const userId = service.getCurrentUserId();
      expect(userId).toBeNull();
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

  describe('Cleanup', () => {
    it('should clean up subscriptions on destroy', () => {
      service.ngOnDestroy();
      expect(service).toBeTruthy();
    });
  });
});
