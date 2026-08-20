import '@angular/compiler';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { of, EMPTY } from 'rxjs';

import { AdminGroupsComponent } from './admin-groups.component';
import { AdminGroup } from '@app/types/group.types';

function makeGroup(overrides: Partial<AdminGroup> = {}): AdminGroup {
  return {
    internal_uuid: 'uuid-1',
    provider: 'tmi',
    group_name: 'everyone',
    first_used: '2026-01-01T00:00:00Z',
    last_used: '2026-01-01T00:00:00Z',
    usage_count: 1,
    ...overrides,
  };
}

describe('AdminGroupsComponent', () => {
  let component: AdminGroupsComponent;
  let mockGroupAdminService: { list: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockGroupAdminService = {
      list: vi.fn().mockReturnValue(of({ groups: [], total: 0, limit: 25, offset: 0 })),
      delete: vi.fn(),
    };
    mockRouter = { navigate: vi.fn().mockResolvedValue(true) };
    const mockRoute = { queryParams: EMPTY };
    const mockDialog = { open: vi.fn() };
    const mockLogger = { info: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const mockAuthService = { getAvailableProviders: vi.fn().mockReturnValue(of([])) };
    const mockClipboard = { copy: vi.fn().mockReturnValue(true) };

    const mockDestroyRef = { onDestroy: vi.fn() };
    const injector = Injector.create({
      providers: [{ provide: DestroyRef, useValue: mockDestroyRef }],
    });

    component = runInInjectionContext(injector, () => {
      return new AdminGroupsComponent(
        mockGroupAdminService as never,
        mockRouter as never,
        mockRoute as never,
        mockDialog as never,
        mockLogger as never,
        mockAuthService as never,
        mockClipboard as never,
      );
    });
  });

  describe('isBuiltInGroup', () => {
    it('returns true for a seeded group name with the tmi provider', () => {
      expect(component.isBuiltInGroup(makeGroup({ group_name: 'administrators' }))).toBe(true);
      expect(component.isBuiltInGroup(makeGroup({ group_name: 'everyone' }))).toBe(true);
    });

    it('returns true for the legacy wildcard provider form', () => {
      expect(component.isBuiltInGroup(makeGroup({ provider: '*', group_name: 'everyone' }))).toBe(
        true,
      );
    });

    it('returns false for an admin-created group, which also gets the tmi provider', () => {
      expect(component.isBuiltInGroup(makeGroup({ group_name: 'my-custom-group' }))).toBe(false);
    });

    it('returns false for an IdP group that happens to reuse a seeded name', () => {
      expect(
        component.isBuiltInGroup(makeGroup({ provider: 'google', group_name: 'administrators' })),
      ).toBe(false);
    });
  });

  describe('onTmiFilterChange', () => {
    it('resets to the first page and filters server-side by the tmi provider', () => {
      component.pageIndex = 3;
      component.onTmiFilterChange(true);

      expect(component.pageIndex).toBe(0);
      expect(mockGroupAdminService.list).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'tmi', offset: 0 }),
      );
    });

    it('drops the provider filter when toggled off', () => {
      component.onTmiFilterChange(false);

      const params = mockGroupAdminService.list.mock.calls.at(-1)?.[0] as Record<string, unknown>;
      expect(params).not.toHaveProperty('provider');
    });
  });
});
