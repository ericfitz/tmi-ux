import '@angular/compiler';

import { describe, it, expect, vi } from 'vitest';
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { GroupMembersDialogComponent } from './group-members-dialog.component';
import { AdminGroup } from '@app/types/group.types';
import { AdminUser } from '@app/types/user.types';

describe('GroupMembersDialogComponent', () => {
  describe('addMember', () => {
    function createComponent(group: Partial<AdminGroup>): {
      component: GroupMembersDialogComponent;
      mockGroupAdminService: {
        listMembers: ReturnType<typeof vi.fn>;
        addMember: ReturnType<typeof vi.fn>;
      };
      mockLogger: {
        info: ReturnType<typeof vi.fn>;
        error: ReturnType<typeof vi.fn>;
        debug: ReturnType<typeof vi.fn>;
      };
    } {
      const mockDialogRef = { close: vi.fn() };
      const mockGroupAdminService = {
        listMembers: vi.fn().mockReturnValue(of({ members: [], total: 0 })),
        addMember: vi.fn().mockReturnValue(of({})),
      };
      const mockUserAdminService = {
        list: vi.fn().mockReturnValue(of({ users: [], total: 0 })),
      };
      const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      };
      const mockAuthService = {
        getAvailableProviders: vi.fn().mockReturnValue(of([])),
      };
      const mockTranslocoService = {
        translate: vi.fn().mockImplementation((key: string) => key),
      };

      const fullGroup: AdminGroup = {
        internal_uuid: 'group-uuid-123',
        provider: 'tmi',
        group_name: 'some-group',
        name: 'Some Group',
        first_used: '2024-01-01T00:00:00Z',
        last_used: '2024-01-01T00:00:00Z',
        usage_count: 1,
        ...group,
      };

      const mockDestroyRef = { onDestroy: vi.fn() };
      const injector = Injector.create({
        providers: [{ provide: DestroyRef, useValue: mockDestroyRef }],
      });

      const component = runInInjectionContext(injector, () => {
        return new GroupMembersDialogComponent(
          mockDialogRef as unknown as MatDialogRef<GroupMembersDialogComponent>,
          { group: fullGroup },
          mockGroupAdminService as never,
          mockUserAdminService as never,
          mockLogger as never,
          mockAuthService as never,
          mockTranslocoService as never,
        );
      });

      return { component, mockGroupAdminService, mockLogger };
    }

    function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
      return {
        internal_uuid: 'user-uuid-456',
        provider: 'tmi',
        provider_user_id: 'test',
        email: 'bot@tmi.local',
        name: 'test-bot',
        email_verified: true,
        created_at: '2024-01-01T00:00:00Z',
        modified_at: '2024-01-01T00:00:00Z',
        ...overrides,
      } as AdminUser;
    }

    it('should block adding an automation user to the administrators group', () => {
      const { component, mockGroupAdminService } = createComponent({
        group_name: 'administrators',
        name: 'Administrators',
      });
      const automationUser = makeUser({ automation: true });

      component.addMember(automationUser);

      expect(mockGroupAdminService.addMember).not.toHaveBeenCalled();
      expect(component.errorMessage).toBe('admin.groups.membersDialog.automationAdminBlocked');
      expect(component.addingMember).toBe(false);
    });

    it('should allow adding a non-automation user to the administrators group', () => {
      const { component, mockGroupAdminService } = createComponent({
        group_name: 'administrators',
        name: 'Administrators',
      });
      const regularUser = makeUser({ automation: false });

      component.addMember(regularUser);

      expect(mockGroupAdminService.addMember).toHaveBeenCalledTimes(1);
      expect(component.errorMessage).toBe('');
    });

    it('should allow adding an automation user to a non-administrators group', () => {
      const { component, mockGroupAdminService } = createComponent({
        group_name: 'engineering',
        name: 'Engineering',
      });
      const automationUser = makeUser({ automation: true });

      component.addMember(automationUser);

      expect(mockGroupAdminService.addMember).toHaveBeenCalledTimes(1);
      expect(component.errorMessage).toBe('');
    });
  });
});
