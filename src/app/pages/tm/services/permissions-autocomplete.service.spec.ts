import '@angular/compiler';

import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
  PermissionsAutocompleteService,
  AutocompleteSuggestion,
} from './permissions-autocomplete.service';
import type { AuthService } from '@app/auth/services/auth.service';
import type { UserAdminService } from '@app/core/services/user-admin.service';
import type { GroupAdminService } from '@app/core/services/group-admin.service';
import type { LoggerService } from '@app/core/services/logger.service';
import type { AdminUser } from '@app/types/user.types';
import type { AdminGroup } from '@app/types/group.types';

describe('PermissionsAutocompleteService', () => {
  let service: PermissionsAutocompleteService;
  let mockAuthService: { isAdmin: boolean };
  let mockUserAdminService: { list: ReturnType<typeof vi.fn> };
  let mockGroupAdminService: { list: ReturnType<typeof vi.fn> };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  const mockUsers: AdminUser[] = [
    {
      internal_uuid: 'uuid-1',
      provider: 'tmi',
      provider_user_id: 'alice-pid',
      email: 'alice@example.com',
      name: 'Alice Smith',
      email_verified: true,
      created_at: '2026-01-01T00:00:00Z',
      modified_at: '2026-01-01T00:00:00Z',
    } as AdminUser,
    {
      internal_uuid: 'uuid-2',
      provider: 'tmi',
      provider_user_id: 'bob-pid',
      email: 'bob@example.com',
      name: 'Bob Jones',
      email_verified: true,
      created_at: '2026-01-01T00:00:00Z',
      modified_at: '2026-01-01T00:00:00Z',
    } as AdminUser,
  ];

  const mockGroups: AdminGroup[] = [
    {
      internal_uuid: 'group-uuid-1',
      provider: 'tmi',
      group_name: 'everyone',
      first_used: '2026-01-01T00:00:00Z',
      last_used: '2026-01-01T00:00:00Z',
      usage_count: 5,
    },
    {
      internal_uuid: 'group-uuid-2',
      provider: 'tmi',
      group_name: 'security-team',
      first_used: '2026-01-01T00:00:00Z',
      last_used: '2026-01-01T00:00:00Z',
      usage_count: 3,
    },
  ];

  beforeEach(() => {
    mockAuthService = { isAdmin: true };
    mockUserAdminService = {
      list: vi.fn().mockReturnValue(of({ users: mockUsers, total: 2, limit: 10, offset: 0 })),
    };
    mockGroupAdminService = {
      list: vi.fn().mockReturnValue(of({ groups: mockGroups, total: 2, limit: 10, offset: 0 })),
    };
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
    };

    service = new PermissionsAutocompleteService(
      mockAuthService as unknown as AuthService,
      mockUserAdminService as unknown as UserAdminService,
      mockGroupAdminService as unknown as GroupAdminService,
      mockLogger as unknown as LoggerService,
    );
  });

  describe('search (user principal type)', () => {
    it('should call UserAdminService with tmi provider and name filter', () => {
      service.search('ali', 'user').subscribe();

      expect(mockUserAdminService.list).toHaveBeenCalledWith({
        provider: 'tmi',
        name: 'ali',
        limit: 10,
      });
    });

    it('should map users to AutocompleteSuggestion with displayLabel and value', () => {
      let results: AutocompleteSuggestion[] = [];
      service.search('ali', 'user').subscribe(r => (results = r));

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        displayLabel: 'Alice Smith (alice@example.com)',
        value: 'alice-pid',
      });
      expect(results[1]).toEqual({
        displayLabel: 'Bob Jones (bob@example.com)',
        value: 'bob-pid',
      });
    });
  });

  describe('search (group principal type)', () => {
    it('should call GroupAdminService with tmi provider and group_name filter', () => {
      service.search('every', 'group').subscribe();

      expect(mockGroupAdminService.list).toHaveBeenCalledWith({
        provider: 'tmi',
        group_name: 'every',
        limit: 10,
      });
    });

    it('should map groups to AutocompleteSuggestion with group_name as both fields', () => {
      let results: AutocompleteSuggestion[] = [];
      service.search('every', 'group').subscribe(r => (results = r));

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        displayLabel: 'everyone',
        value: 'everyone',
      });
      expect(results[1]).toEqual({
        displayLabel: 'security-team',
        value: 'security-team',
      });
    });
  });

  describe('admin gate', () => {
    it('should return empty results without API call when not admin', () => {
      mockAuthService.isAdmin = false;

      let results: AutocompleteSuggestion[] = [];
      service.search('ali', 'user').subscribe(r => (results = r));

      expect(results).toEqual([]);
      expect(mockUserAdminService.list).not.toHaveBeenCalled();
      expect(mockGroupAdminService.list).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should return empty results on 401 error', () => {
      mockUserAdminService.list.mockReturnValue(throwError(() => ({ status: 401 })));

      let results: AutocompleteSuggestion[] = [];
      service.search('ali', 'user').subscribe(r => (results = r));

      expect(results).toEqual([]);
    });

    it('should return empty results on 403 error', () => {
      mockUserAdminService.list.mockReturnValue(throwError(() => ({ status: 403 })));

      let results: AutocompleteSuggestion[] = [];
      service.search('ali', 'user').subscribe(r => (results = r));

      expect(results).toEqual([]);
    });

    it('should return empty results on other errors', () => {
      mockGroupAdminService.list.mockReturnValue(throwError(() => new Error('network error')));

      let results: AutocompleteSuggestion[] = [];
      service.search('sec', 'group').subscribe(r => (results = r));

      expect(results).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('should return empty results for empty search term', () => {
      let results: AutocompleteSuggestion[] = [];
      service.search('', 'user').subscribe(r => (results = r));

      expect(results).toEqual([]);
      expect(mockUserAdminService.list).not.toHaveBeenCalled();
    });

    it('should return empty results for single character search term', () => {
      let results: AutocompleteSuggestion[] = [];
      service.search('a', 'user').subscribe(r => (results = r));

      expect(results).toEqual([]);
      expect(mockUserAdminService.list).not.toHaveBeenCalled();
    });

    it('should search when term is 2 or more characters', () => {
      service.search('al', 'user').subscribe();

      expect(mockUserAdminService.list).toHaveBeenCalled();
    });
  });
});
