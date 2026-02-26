// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { SecurityReviewerService } from './security-reviewer.service';
import { AuthService } from '@app/auth/services/auth.service';
import { UserGroupService } from '@app/core/services/user-group.service';
import { GroupAdminService } from '@app/core/services/group-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { User } from '@app/pages/tm/models/threat-model.model';
import { GroupMember, ListGroupMembersResponse, ListGroupsResponse } from '@app/types/group.types';
import { UserProfile } from '@app/auth/models/auth.models';

describe('SecurityReviewerService', () => {
  let service: SecurityReviewerService;
  let mockAuthService: {
    userProfile: UserProfile | null;
  };
  let mockUserGroupService: {
    listMembers: ReturnType<typeof vi.fn>;
  };
  let mockGroupAdminService: {
    list: ReturnType<typeof vi.fn>;
    listMembers: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };

  const mockGroupMember: GroupMember = {
    id: 'member-1',
    group_internal_uuid: 'group-uuid-1',
    subject_type: 'user',
    user_internal_uuid: 'user-uuid-1',
    user_provider: 'google',
    user_provider_user_id: 'google_12345',
    user_email: 'reviewer@example.com',
    user_name: 'Test Reviewer',
    added_at: '2024-01-01T00:00:00Z',
  };

  const mockGroupMember2: GroupMember = {
    id: 'member-2',
    group_internal_uuid: 'group-uuid-1',
    subject_type: 'user',
    user_internal_uuid: 'user-uuid-2',
    user_provider: 'google',
    user_provider_user_id: 'google_67890',
    user_email: 'reviewer2@example.com',
    user_name: 'Another Reviewer',
    added_at: '2024-01-02T00:00:00Z',
  };

  const mockGroupTypeMember: GroupMember = {
    id: 'member-3',
    group_internal_uuid: 'group-uuid-1',
    subject_type: 'group',
    member_group_internal_uuid: 'nested-group-uuid',
    member_group_name: 'nested-group',
    added_at: '2024-01-03T00:00:00Z',
  };

  const mockMembersResponse: ListGroupMembersResponse = {
    members: [mockGroupMember, mockGroupMember2, mockGroupTypeMember],
    total: 3,
    limit: 50,
    offset: 0,
  };

  const reviewerProfile: UserProfile = {
    provider: 'google',
    provider_id: 'google_99999',
    display_name: 'Current User',
    email: 'current@example.com',
    groups: [
      {
        internal_uuid: 'sec-rev-uuid',
        group_name: 'security-reviewers',
        name: 'Security Reviewers',
      },
    ],
    jwt_groups: null,
    is_security_reviewer: true,
  };

  const adminProfile: UserProfile = {
    provider: 'google',
    provider_id: 'google_admin',
    display_name: 'Admin User',
    email: 'admin@example.com',
    groups: [],
    jwt_groups: null,
    is_admin: true,
  };

  const regularProfile: UserProfile = {
    provider: 'google',
    provider_id: 'google_regular',
    display_name: 'Regular User',
    email: 'regular@example.com',
    groups: [],
    jwt_groups: null,
  };

  beforeEach(() => {
    mockAuthService = {
      userProfile: reviewerProfile,
    };

    mockUserGroupService = {
      listMembers: vi.fn(),
    };

    mockGroupAdminService = {
      list: vi.fn(),
      listMembers: vi.fn(),
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    service = new SecurityReviewerService(
      mockAuthService as unknown as AuthService,
      mockUserGroupService as unknown as UserGroupService,
      mockGroupAdminService as unknown as GroupAdminService,
      mockLogger as unknown as LoggerService,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('loadReviewerOptions()', () => {
    describe('Tier 1: Security reviewer user with group membership', () => {
      it('should load reviewers via user group service', () => {
        mockUserGroupService.listMembers.mockReturnValue(of(mockMembersResponse));

        service.loadReviewerOptions().subscribe(result => {
          expect(result.mode).toBe('dropdown');
          if (result.mode === 'dropdown') {
            // Should only include user members (not group members)
            expect(result.reviewers).toHaveLength(2);
            expect(result.reviewers[0].email).toBe('reviewer@example.com');
            expect(result.reviewers[1].email).toBe('reviewer2@example.com');
          }
          expect(mockUserGroupService.listMembers).toHaveBeenCalledWith('sec-rev-uuid');
        });
      });

      it('should include current reviewer even if not in group', () => {
        mockUserGroupService.listMembers.mockReturnValue(of(mockMembersResponse));

        const currentReviewer: User = {
          principal_type: 'user',
          provider: 'github',
          provider_id: 'github_special',
          email: 'special@example.com',
          display_name: 'Special Reviewer',
        };

        service.loadReviewerOptions(currentReviewer).subscribe(result => {
          expect(result.mode).toBe('dropdown');
          if (result.mode === 'dropdown') {
            expect(result.reviewers).toHaveLength(3);
            // Current reviewer should be first
            expect(result.reviewers[0].email).toBe('special@example.com');
          }
        });
      });

      it('should not duplicate current reviewer if already in group', () => {
        mockUserGroupService.listMembers.mockReturnValue(of(mockMembersResponse));

        const currentReviewer: User = {
          principal_type: 'user',
          provider: 'google',
          provider_id: 'google_12345',
          email: 'reviewer@example.com',
          display_name: 'Test Reviewer',
        };

        service.loadReviewerOptions(currentReviewer).subscribe(result => {
          expect(result.mode).toBe('dropdown');
          if (result.mode === 'dropdown') {
            expect(result.reviewers).toHaveLength(2);
          }
        });
      });

      it('should fall back to admin API if user group service fails', () => {
        mockUserGroupService.listMembers.mockReturnValue(throwError(() => new Error('Forbidden')));

        const adminGroupsResponse: ListGroupsResponse = {
          groups: [
            {
              internal_uuid: 'admin-group-uuid',
              provider: '*',
              group_name: 'security-reviewers',
              first_used: '2024-01-01',
              last_used: '2024-01-01',
              usage_count: 1,
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        };
        mockGroupAdminService.list.mockReturnValue(of(adminGroupsResponse));
        mockGroupAdminService.listMembers.mockReturnValue(of(mockMembersResponse));

        service.loadReviewerOptions().subscribe(result => {
          expect(result.mode).toBe('dropdown');
          expect(mockLogger.warn).toHaveBeenCalled();
          expect(mockGroupAdminService.list).toHaveBeenCalledWith({
            group_name: 'security-reviewers',
          });
        });
      });
    });

    describe('Tier 2: Admin user', () => {
      beforeEach(() => {
        mockAuthService.userProfile = adminProfile;
      });

      it('should load reviewers via admin groups API', () => {
        const adminGroupsResponse: ListGroupsResponse = {
          groups: [
            {
              internal_uuid: 'admin-group-uuid',
              provider: '*',
              group_name: 'security-reviewers',
              first_used: '2024-01-01',
              last_used: '2024-01-01',
              usage_count: 1,
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        };
        mockGroupAdminService.list.mockReturnValue(of(adminGroupsResponse));
        mockGroupAdminService.listMembers.mockReturnValue(of(mockMembersResponse));

        service.loadReviewerOptions().subscribe(result => {
          expect(result.mode).toBe('dropdown');
          if (result.mode === 'dropdown') {
            expect(result.reviewers).toHaveLength(2);
          }
          expect(mockGroupAdminService.list).toHaveBeenCalledWith({
            group_name: 'security-reviewers',
          });
          expect(mockGroupAdminService.listMembers).toHaveBeenCalledWith('admin-group-uuid');
        });
      });

      it('should return picker mode if security-reviewers group not found', () => {
        const emptyGroupsResponse: ListGroupsResponse = {
          groups: [],
          total: 0,
          limit: 50,
          offset: 0,
        };
        mockGroupAdminService.list.mockReturnValue(of(emptyGroupsResponse));

        service.loadReviewerOptions().subscribe(result => {
          expect(result.mode).toBe('picker');
          expect(mockLogger.warn).toHaveBeenCalledWith(
            'Security reviewers group not found via admin API',
          );
        });
      });

      it('should return picker mode if admin API fails', () => {
        mockGroupAdminService.list.mockReturnValue(throwError(() => new Error('Admin API error')));

        service.loadReviewerOptions().subscribe(result => {
          expect(result.mode).toBe('picker');
          expect(mockLogger.warn).toHaveBeenCalled();
        });
      });
    });

    describe('Tier 3: Regular user (no group, no admin)', () => {
      beforeEach(() => {
        mockAuthService.userProfile = regularProfile;
      });

      it('should return picker mode', () => {
        service.loadReviewerOptions().subscribe(result => {
          expect(result.mode).toBe('picker');
          expect(mockUserGroupService.listMembers).not.toHaveBeenCalled();
          expect(mockGroupAdminService.list).not.toHaveBeenCalled();
        });
      });
    });

    describe('No profile', () => {
      beforeEach(() => {
        mockAuthService.userProfile = null;
      });

      it('should return picker mode when no profile is available', () => {
        service.loadReviewerOptions().subscribe(result => {
          expect(result.mode).toBe('picker');
        });
      });
    });
  });

  describe('getCurrentUserAsReviewer()', () => {
    it('should build User from auth profile', () => {
      const user = service.getCurrentUserAsReviewer();
      expect(user).toEqual({
        principal_type: 'user',
        provider: 'google',
        provider_id: 'google_99999',
        email: 'current@example.com',
        display_name: 'Current User',
      });
    });

    it('should return null when no profile is available', () => {
      mockAuthService.userProfile = null;
      expect(service.getCurrentUserAsReviewer()).toBeNull();
    });
  });

  describe('mapGroupMemberToUser()', () => {
    it('should map group member fields to User interface', () => {
      const user = service.mapGroupMemberToUser(mockGroupMember);
      expect(user).toEqual({
        principal_type: 'user',
        provider: 'google',
        provider_id: 'google_12345',
        email: 'reviewer@example.com',
        display_name: 'Test Reviewer',
      });
    });

    it('should handle null fields with defaults', () => {
      const memberWithNulls: GroupMember = {
        id: 'member-null',
        group_internal_uuid: 'group-uuid',
        subject_type: 'user',
        user_provider: null,
        user_provider_user_id: null,
        user_email: null,
        user_name: null,
        added_at: '2024-01-01T00:00:00Z',
      };
      const user = service.mapGroupMemberToUser(memberWithNulls);
      expect(user.provider).toBe('');
      expect(user.provider_id).toBe('');
      expect(user.email).toBe('');
      expect(user.display_name).toBe('');
    });

    it('should use email as display_name fallback when name is null', () => {
      const memberEmailOnly: GroupMember = {
        id: 'member-email',
        group_internal_uuid: 'group-uuid',
        subject_type: 'user',
        user_provider: 'google',
        user_provider_user_id: 'google_555',
        user_email: 'fallback@example.com',
        user_name: null,
        added_at: '2024-01-01T00:00:00Z',
      };
      const user = service.mapGroupMemberToUser(memberEmailOnly);
      expect(user.display_name).toBe('fallback@example.com');
    });
  });

  describe('compareReviewers()', () => {
    it('should return true for identical references', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        email: 'a@b.com',
        display_name: 'A',
      };
      expect(service.compareReviewers(user, user)).toBe(true);
    });

    it('should return true for same provider identity', () => {
      const a: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        email: 'a@b.com',
        display_name: 'A',
      };
      const b: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        email: 'different@b.com',
        display_name: 'Different',
      };
      expect(service.compareReviewers(a, b)).toBe(true);
    });

    it('should return false for different provider identities', () => {
      const a: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        email: 'a@b.com',
        display_name: 'A',
      };
      const b: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '456',
        email: 'a@b.com',
        display_name: 'A',
      };
      expect(service.compareReviewers(a, b)).toBe(false);
    });

    it('should return true for both null', () => {
      expect(service.compareReviewers(null, null)).toBe(true);
    });

    it('should return false when one is null', () => {
      const user: User = {
        principal_type: 'user',
        provider: 'google',
        provider_id: '123',
        email: 'a@b.com',
        display_name: 'A',
      };
      expect(service.compareReviewers(user, null)).toBe(false);
      expect(service.compareReviewers(null, user)).toBe(false);
    });
  });
});
