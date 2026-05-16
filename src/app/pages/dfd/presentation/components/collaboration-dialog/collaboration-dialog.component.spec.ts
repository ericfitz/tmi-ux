// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.
//
// Scope: this spec covers the dialog's pure predicate/getter surface and
// closeDialog. The ngOnInit service-sync wiring and periodic refresh are
// integration-level and out of scope, so ngOnInit is not invoked here.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import type { TranslocoService } from '@jsverse/transloco';

import { CollaborationDialogComponent } from './collaboration-dialog.component';

describe('CollaborationDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let mockCdr: { detectChanges: ReturnType<typeof vi.fn>; markForCheck: ReturnType<typeof vi.fn> };
  let mockCollaborationService: Record<string, unknown>;
  let mockNotificationService: Record<string, ReturnType<typeof vi.fn>>;
  let mockWebSocketAdapter: { isConnected: boolean };
  let mockTransloco: TranslocoService;
  let component: CollaborationDialogComponent;

  function build(): CollaborationDialogComponent {
    return new CollaborationDialogComponent(
      mockDialogRef as never,
      {},
      mockLogger as never,
      mockCdr as never,
      mockCollaborationService as never,
      mockNotificationService as never,
      mockWebSocketAdapter as never,
      mockTransloco,
      {} as never,
    );
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockCdr = { detectChanges: vi.fn(), markForCheck: vi.fn() };
    mockCollaborationService = {
      hasPermission: vi.fn(() => true),
      isCurrentUser: vi.fn(() => false),
      isCurrentUserPresenter: vi.fn(() => false),
      currentWebSocketUrl: 'wss://example/ws',
      toggleCollaboration: vi.fn(() => of(true)),
      removeUser: vi.fn(() => of(true)),
      updateUserPermission: vi.fn(() => of(true)),
      requestPresenterPrivileges: vi.fn(() => of(undefined)),
      approvePresenterRequest: vi.fn(() => of(undefined)),
      denyPresenterRequest: vi.fn(() => of(undefined)),
      takeBackPresenterPrivileges: vi.fn(() => of(undefined)),
      setPresenter: vi.fn(() => of(undefined)),
    };
    mockNotificationService = {
      showInfo: vi.fn(() => of(undefined)),
      showError: vi.fn(() => of(undefined)),
      showSuccess: vi.fn(() => of(undefined)),
    };
    mockWebSocketAdapter = { isConnected: false };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
    component = build();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('hasPermission', () => {
    it('delegates to the collaboration service', () => {
      expect(component.hasPermission('edit')).toBe(true);
      expect(mockCollaborationService['hasPermission']).toHaveBeenCalledWith('edit');
    });
  });

  describe('getCollaborationButtonColor', () => {
    it('returns primary while collaborating', () => {
      component.isCollaborating = true;

      expect(component.getCollaborationButtonColor()).toBe('primary');
    });

    it('returns accent when an existing session is available but not joined', () => {
      component.isCollaborating = false;
      component.existingSessionAvailable = { session_id: 's1' } as never;

      expect(component.getCollaborationButtonColor()).toBe('accent');
    });

    it('returns primary with no session', () => {
      component.isCollaborating = false;
      component.existingSessionAvailable = null;

      expect(component.getCollaborationButtonColor()).toBe('primary');
    });
  });

  describe('getStatusColor', () => {
    it('maps each known status to its CSS class', () => {
      expect(component.getStatusColor('active')).toBe('status-active');
      expect(component.getStatusColor('idle')).toBe('status-idle');
      expect(component.getStatusColor('disconnected')).toBe('status-disconnected');
    });
  });

  describe('WebSocket status helpers', () => {
    it('reports a not-configured icon/class when not collaborating', () => {
      component.isCollaborating = false;

      expect(component.getWebSocketStatusIcon()).toBe('sensors');
      expect(component.getWebSocketStatusIconClass()).toBe('websocket-status-not-configured');
    });

    it('reports a connected icon/class when collaborating and connected', () => {
      component.isCollaborating = true;
      mockWebSocketAdapter.isConnected = true;

      expect(component.getWebSocketStatusIcon()).toBe('sensors');
      expect(component.getWebSocketStatusIconClass()).toBe('websocket-status-connected');
    });

    it('reports a disconnected icon/class when collaborating but not connected', () => {
      component.isCollaborating = true;
      mockWebSocketAdapter.isConnected = false;

      expect(component.getWebSocketStatusIcon()).toBe('sensors_off');
      expect(component.getWebSocketStatusIconClass()).toBe('websocket-status-error');
    });
  });

  describe('getPresenterName', () => {
    it('returns an empty string when there is no presenter', () => {
      component.currentPresenterEmail = null;

      expect(component.getPresenterName()).toBe('');
    });

    it('resolves the presenter display name from the user list', () => {
      component.currentPresenterEmail = 'pres@x.com';
      component.collaborationUsers = [{ email: 'pres@x.com', name: 'Presenter' }] as never;

      expect(component.getPresenterName()).toBe('Presenter');
    });

    it('falls back to the email when the presenter is not in the user list', () => {
      component.currentPresenterEmail = 'ghost@x.com';
      component.collaborationUsers = [];

      expect(component.getPresenterName()).toBe('ghost@x.com');
    });
  });

  describe('getRequestUserName', () => {
    it('resolves a user name, falling back to the email', () => {
      component.collaborationUsers = [{ email: 'u@x.com', name: 'User' }] as never;

      expect(component.getRequestUserName('u@x.com')).toBe('User');
      expect(component.getRequestUserName('missing@x.com')).toBe('missing@x.com');
    });
  });

  describe('hasPresenterRequest', () => {
    it('is true when the user has a pending presenter request', () => {
      component.pendingPresenterRequests = ['a@x.com', 'b@x.com'];

      expect(component.hasPresenterRequest('a@x.com')).toBe(true);
      expect(component.hasPresenterRequest('c@x.com')).toBe(false);
    });
  });

  describe('trackByPrincipalKey', () => {
    it('builds a provider:provider_id composite key', () => {
      const user = { provider: 'google', provider_id: 'u123' } as never;

      expect(component.trackByPrincipalKey(0, user)).toBe('google:u123');
    });
  });

  describe('isCurrentUser / isCurrentUserPresenter', () => {
    it('delegate to the collaboration service', () => {
      component.isCurrentUser('u@x.com');
      expect(mockCollaborationService['isCurrentUser']).toHaveBeenCalledWith('u@x.com');

      component.isCurrentUserPresenter();
      expect(mockCollaborationService['isCurrentUserPresenter']).toHaveBeenCalled();
    });
  });

  describe('toggleCollaboration', () => {
    it('delegates to the collaboration service', () => {
      component.toggleCollaboration();

      expect(mockCollaborationService['toggleCollaboration']).toHaveBeenCalled();
    });

    it('shows a user-facing error when the context is not ready', () => {
      mockCollaborationService['toggleCollaboration'] = vi.fn(() =>
        throwError(() => new Error('collaboration context not ready')),
      );

      component.toggleCollaboration();

      expect(mockNotificationService['showError']).toHaveBeenCalled();
    });

    it('does not show a notification for other errors', () => {
      mockCollaborationService['toggleCollaboration'] = vi.fn(() =>
        throwError(() => new Error('some other failure')),
      );

      component.toggleCollaboration();

      expect(mockNotificationService['showError']).not.toHaveBeenCalled();
    });
  });

  describe('removeUser', () => {
    it('forwards the user identity fields to the collaboration service', () => {
      component.removeUser({
        provider_id: 'p1',
        email: 'u@x.com',
        name: 'User',
        provider: 'google',
      } as never);

      expect(mockCollaborationService['removeUser']).toHaveBeenCalledWith({
        provider_id: 'p1',
        email: 'u@x.com',
        name: 'User',
        provider: 'google',
      });
    });
  });

  describe('updateUserPermission', () => {
    it('delegates the email and permission to the collaboration service', () => {
      component.updateUserPermission('u@x.com', 'writer');

      expect(mockCollaborationService['updateUserPermission']).toHaveBeenCalledWith(
        'u@x.com',
        'writer',
      );
    });
  });

  describe('presenter request delegation', () => {
    it('requestPresenterPrivileges delegates to the service', () => {
      component.requestPresenterPrivileges();
      expect(mockCollaborationService['requestPresenterPrivileges']).toHaveBeenCalled();
    });

    it('approvePresenterRequest forwards the user email', () => {
      component.approvePresenterRequest('u@x.com');
      expect(mockCollaborationService['approvePresenterRequest']).toHaveBeenCalledWith('u@x.com');
    });

    it('denyPresenterRequest forwards the user email', () => {
      component.denyPresenterRequest('u@x.com');
      expect(mockCollaborationService['denyPresenterRequest']).toHaveBeenCalledWith('u@x.com');
    });

    it('takeBackPresenterPrivileges delegates to the service', () => {
      component.takeBackPresenterPrivileges();
      expect(mockCollaborationService['takeBackPresenterPrivileges']).toHaveBeenCalled();
    });

    it('clearPresenter sets the presenter to null', () => {
      component.clearPresenter();
      expect(mockCollaborationService['setPresenter']).toHaveBeenCalledWith(null);
    });
  });

  describe('closeDialog', () => {
    it('closes the dialog', () => {
      component.closeDialog();

      expect(mockDialogRef.close).toHaveBeenCalled();
    });
  });
});
