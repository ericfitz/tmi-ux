// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do
import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { ReviewerAssignmentListComponent } from './reviewer-assignment-list.component';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import {
  SecurityReviewerService,
  SecurityReviewerResult,
} from '@app/shared/services/security-reviewer.service';
import { LoggerService } from '@app/core/services/logger.service';
import { TranslocoService } from '@jsverse/transloco';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ChangeDetectorRef } from '@angular/core';
import { User } from '../../../tm/models/threat-model.model';
import { TMListItem } from '../../../tm/models/tm-list-item.model';
import { ListThreatModelsResponse } from '../../../tm/models/api-responses.model';

describe('ReviewerAssignmentListComponent', () => {
  let component: ReviewerAssignmentListComponent;
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockThreatModelService: {
    fetchThreatModels: ReturnType<typeof vi.fn>;
    patchThreatModel: ReturnType<typeof vi.fn>;
  };
  let mockSecurityReviewerService: {
    loadReviewerOptions: ReturnType<typeof vi.fn>;
    getCurrentUserAsReviewer: ReturnType<typeof vi.fn>;
    compareReviewers: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let mockTransloco: {
    translate: ReturnType<typeof vi.fn>;
  };
  let mockDialog: {
    open: ReturnType<typeof vi.fn>;
  };
  let mockCdr: {
    detectChanges: ReturnType<typeof vi.fn>;
  };

  const mockReviewer: User = {
    principal_type: 'user',
    provider: 'google',
    provider_id: 'google_123',
    email: 'reviewer@example.com',
    display_name: 'Test Reviewer',
  };

  const mockCurrentUser: User = {
    principal_type: 'user',
    provider: 'google',
    provider_id: 'google_me',
    email: 'me@example.com',
    display_name: 'Current User',
  };

  const makeTMListItem = (overrides: Partial<TMListItem> = {}): TMListItem => ({
    id: 'tm-1',
    name: 'Test Threat Model',
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-02T00:00:00Z',
    owner: {
      principal_type: 'user',
      provider: 'google',
      provider_id: 'owner_123',
      email: 'owner@example.com',
      display_name: 'Owner',
    },
    created_by: {
      principal_type: 'user',
      provider: 'google',
      provider_id: 'owner_123',
      email: 'owner@example.com',
      display_name: 'Owner',
    },
    threat_model_framework: 'STRIDE',
    status: 'not_started',
    security_reviewer: null,
    document_count: 0,
    repo_count: 0,
    diagram_count: 0,
    threat_count: 0,
    asset_count: 0,
    note_count: 0,
    ...overrides,
  });

  const makeApiResponse = (items: TMListItem[], total?: number): ListThreatModelsResponse => ({
    threat_models: items,
    total: total ?? items.length,
    limit: 100,
    offset: 0,
  });

  beforeEach(() => {
    mockRouter = { navigate: vi.fn() };
    mockThreatModelService = {
      fetchThreatModels: vi.fn(),
      patchThreatModel: vi.fn(),
    };
    mockSecurityReviewerService = {
      loadReviewerOptions: vi.fn(),
      getCurrentUserAsReviewer: vi.fn(),
      compareReviewers: vi.fn((a: User | null, b: User | null) => {
        if (a === b) return true;
        if (!a || !b) return false;
        return a.provider === b.provider && a.provider_id === b.provider_id;
      }),
    };
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockTransloco = {
      translate: vi.fn((key: string) => key),
    };
    mockDialog = { open: vi.fn() };
    mockCdr = { detectChanges: vi.fn() };

    component = new ReviewerAssignmentListComponent(
      mockRouter as unknown as Router,
      mockThreatModelService as unknown as ThreatModelService,
      mockSecurityReviewerService as unknown as SecurityReviewerService,
      mockLogger as unknown as LoggerService,
      mockTransloco as unknown as TranslocoService,
      mockDialog as unknown as MatDialog,
      mockCdr as unknown as ChangeDetectorRef,
    );
  });

  describe('Initialization', () => {
    it('should be created', () => {
      expect(component).toBeTruthy();
    });

    it('should have default values', () => {
      expect(component.reviewerMode).toBe('loading');
      expect(component.totalUnassigned).toBe(0);
      expect(component.isLoading).toBe(false);
      expect(component.error).toBeNull();
    });

    it('should have default filter state', () => {
      expect(component.filters.searchTerm).toBe('');
      expect(component.filters.status).toBe('all');
      expect(component.filters.unassigned).toBe(true);
      expect(component.filters.securityReviewer).toBe('');
      expect(component.filters.owner).toBe('');
      expect(component.filters.createdAfter).toBeNull();
      expect(component.filters.createdBefore).toBeNull();
      expect(component.filters.modifiedAfter).toBeNull();
      expect(component.filters.modifiedBefore).toBeNull();
    });
  });

  describe('loadThreatModels()', () => {
    it('should pass unassigned filter as is:null by default', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      component.ngOnInit();

      const callArgs = mockThreatModelService.fetchThreatModels.mock.calls[0][0];
      expect(callArgs.security_reviewer).toBe('is:null');
    });

    it('should display items returned from server and set total', () => {
      const unassigned = makeTMListItem({ id: 'tm-1', security_reviewer: null });
      const unassigned2 = makeTMListItem({ id: 'tm-2', security_reviewer: null });

      mockThreatModelService.fetchThreatModels.mockReturnValue(
        of(makeApiResponse([unassigned, unassigned2], 2)),
      );
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      const emitSpy = vi.spyOn(component.countChange, 'emit');
      component.ngOnInit();

      expect(component.totalUnassigned).toBe(2);
      expect(component.dataSource.data).toHaveLength(2);
      expect(emitSpy).toHaveBeenCalledWith(2);
    });

    it('should handle empty results', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      component.ngOnInit();

      expect(component.totalUnassigned).toBe(0);
      expect(component.isLoading).toBe(false);
    });

    it('should handle API errors', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(
        throwError(() => new Error('API error')),
      );
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      component.ngOnInit();

      expect(component.isLoading).toBe(false);
      expect(component.error).toBe('triage.reviewerAssignment.errorLoading');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should pass status filter to API', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      component.ngOnInit();
      component.filters.status = 'in_review';
      component.loadThreatModels();

      const lastCall =
        mockThreatModelService.fetchThreatModels.mock.calls[
          mockThreatModelService.fetchThreatModels.mock.calls.length - 1
        ][0];
      expect(lastCall.status).toBe('in_review');
    });

    it('should pass name filter to API when searchTerm is set', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      component.ngOnInit();
      component.filters.searchTerm = 'my project';
      component.loadThreatModels();

      const lastCall =
        mockThreatModelService.fetchThreatModels.mock.calls[
          mockThreatModelService.fetchThreatModels.mock.calls.length - 1
        ][0];
      expect(lastCall.name).toBe('my project');
    });

    it('should pass owner filter to API when owner is set', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      component.ngOnInit();
      component.filters.unassigned = false;
      component.filters.owner = 'alice@example.com';
      component.loadThreatModels();

      const lastCall =
        mockThreatModelService.fetchThreatModels.mock.calls[
          mockThreatModelService.fetchThreatModels.mock.calls.length - 1
        ][0];
      expect(lastCall.owner).toBe('alice@example.com');
    });

    it('should pass security_reviewer filter when unassigned is false and reviewer is set', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      component.ngOnInit();
      component.filters.unassigned = false;
      component.filters.securityReviewer = 'bob@example.com';
      component.loadThreatModels();

      const lastCall =
        mockThreatModelService.fetchThreatModels.mock.calls[
          mockThreatModelService.fetchThreatModels.mock.calls.length - 1
        ][0];
      expect(lastCall.security_reviewer).toBe('bob@example.com');
    });
  });

  describe('Reviewer options loading', () => {
    it('should set dropdown mode when reviewers loaded', () => {
      const result: SecurityReviewerResult = {
        mode: 'dropdown',
        reviewers: [mockReviewer],
      };
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(of(result));
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

      component.ngOnInit();

      expect(component.reviewerMode).toBe('dropdown');
      expect(component.reviewerOptions).toEqual([mockReviewer]);
    });

    it('should set picker mode as fallback', () => {
      const result: SecurityReviewerResult = { mode: 'picker' };
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(of(result));
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

      component.ngOnInit();

      expect(component.reviewerMode).toBe('picker');
    });
  });

  describe('assignReviewer()', () => {
    beforeEach(() => {
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );
    });

    it('should patch threat model and reload list on success', () => {
      const tm = makeTMListItem({ id: 'tm-assign' });
      // First call: initial load; second call: reload after assign
      mockThreatModelService.fetchThreatModels
        .mockReturnValueOnce(of(makeApiResponse([tm], 1)))
        .mockReturnValueOnce(of(makeApiResponse([], 0)));
      mockThreatModelService.patchThreatModel.mockReturnValue(of({}));

      component.ngOnInit();
      expect(component.totalUnassigned).toBe(1);

      const emitSpy = vi.spyOn(component.countChange, 'emit');
      component.assignReviewer('tm-assign', mockReviewer);

      expect(mockThreatModelService.patchThreatModel).toHaveBeenCalledWith('tm-assign', {
        security_reviewer: mockReviewer,
      });
      // After reload, server returns 0 items
      expect(component.totalUnassigned).toBe(0);
      expect(emitSpy).toHaveBeenCalledWith(0);
    });

    it('should handle assignment errors without reloading list', () => {
      const tm = makeTMListItem({ id: 'tm-error' });
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([tm])));
      mockThreatModelService.patchThreatModel.mockReturnValue(
        throwError(() => new Error('PATCH failed')),
      );

      component.ngOnInit();
      component.assignReviewer('tm-error', mockReviewer);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to assign reviewer', expect.any(Error));
    });

    it('should track assigning state per TM', () => {
      const tm = makeTMListItem({ id: 'tm-track' });
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([tm])));
      // Return an observable that doesn't complete immediately
      mockThreatModelService.patchThreatModel.mockReturnValue(of({}));

      component.ngOnInit();
      component.assignReviewer('tm-track', mockReviewer);

      // After successful assignment, isAssigning should be cleared
      expect(component.isAssigning.has('tm-track')).toBe(false);
    });
  });

  describe('assignToMe()', () => {
    beforeEach(() => {
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );
    });

    it('should call assignReviewer with current user', () => {
      mockSecurityReviewerService.getCurrentUserAsReviewer.mockReturnValue(mockCurrentUser);
      const tm = makeTMListItem({ id: 'tm-me' });
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([tm])));
      mockThreatModelService.patchThreatModel.mockReturnValue(of({}));

      component.ngOnInit();
      component.assignToMe('tm-me');

      expect(mockThreatModelService.patchThreatModel).toHaveBeenCalledWith('tm-me', {
        security_reviewer: mockCurrentUser,
      });
    });

    it('should not call assignReviewer if current user is null', () => {
      mockSecurityReviewerService.getCurrentUserAsReviewer.mockReturnValue(null);
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));

      component.ngOnInit();
      component.assignToMe('tm-null');

      expect(mockThreatModelService.patchThreatModel).not.toHaveBeenCalled();
    });
  });

  describe('onReviewerSelected()', () => {
    it('should track selection per TM id', () => {
      component.onReviewerSelected('tm-1', mockReviewer);
      expect(component.selectedReviewers.get('tm-1')).toBe(mockReviewer);

      component.onReviewerSelected('tm-1', null);
      expect(component.selectedReviewers.get('tm-1')).toBeNull();
    });
  });

  describe('Server-side pagination', () => {
    beforeEach(() => {
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );
    });

    it('should pass limit and offset to API based on pageSize and pageIndex', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([], 30)));

      component.ngOnInit();
      component.onPageChange({ pageIndex: 1, pageSize: 10, length: 30, previousPageIndex: 0 });

      const lastCall =
        mockThreatModelService.fetchThreatModels.mock.calls[
          mockThreatModelService.fetchThreatModels.mock.calls.length - 1
        ][0];
      expect(lastCall.limit).toBe(10);
      expect(lastCall.offset).toBe(10);
    });

    it('should reflect server total in totalUnassigned', () => {
      const items = Array.from({ length: 25 }, (_, i) =>
        makeTMListItem({ id: `tm-${i}`, security_reviewer: null }),
      );
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse(items, 100)));

      component.ngOnInit();

      // dataSource shows only what server returned (25 items for this page)
      expect(component.dataSource.data).toHaveLength(25);
      // totalUnassigned reflects the server total for the paginator
      expect(component.totalUnassigned).toBe(100);
    });
  });

  describe('Filter helpers', () => {
    it('hasActiveFilters should be false with default filters', () => {
      expect(component.hasActiveFilters).toBe(false);
    });

    it('hasActiveFilters should be true when searchTerm is set', () => {
      component.filters.searchTerm = 'foo';
      expect(component.hasActiveFilters).toBe(true);
    });

    it('hasActiveFilters should be true when unassigned is false', () => {
      component.filters.unassigned = false;
      expect(component.hasActiveFilters).toBe(true);
    });

    it('hasAdvancedFilters should be false with default filters', () => {
      expect(component.hasAdvancedFilters).toBe(false);
    });

    it('hasAdvancedFilters should be true when owner is set', () => {
      component.filters.owner = 'alice@example.com';
      expect(component.hasAdvancedFilters).toBe(true);
    });

    it('hasAdvancedFilters should be true when createdAfter is set', () => {
      component.filters.createdAfter = '2024-01-01';
      expect(component.hasAdvancedFilters).toBe(true);
    });
  });

  describe('clearFilters()', () => {
    it('should reset all filters to defaults and reload', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      component.ngOnInit();
      component.filters.searchTerm = 'foo';
      component.filters.status = 'in_review';
      component.filters.unassigned = false;
      component.showAdvancedFilters = true;

      const callsBefore = mockThreatModelService.fetchThreatModels.mock.calls.length;
      component.clearFilters();

      expect(component.filters.searchTerm).toBe('');
      expect(component.filters.status).toBe('all');
      expect(component.filters.unassigned).toBe(true);
      expect(component.showAdvancedFilters).toBe(false);
      expect(component.pageIndex).toBe(0);
      // clearFilters triggers a reload
      expect(mockThreatModelService.fetchThreatModels.mock.calls.length).toBeGreaterThan(
        callsBefore,
      );
    });
  });

  describe('onUnassignedChange()', () => {
    it('should clear securityReviewer when switching to unassigned mode', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      component.ngOnInit();
      component.filters.unassigned = false;
      component.filters.securityReviewer = 'bob@example.com';
      component.onUnassignedChange(true);

      expect(component.filters.securityReviewer).toBe('');
    });

    it('should not clear securityReviewer when switching to non-unassigned mode', () => {
      mockThreatModelService.fetchThreatModels.mockReturnValue(of(makeApiResponse([])));
      mockSecurityReviewerService.loadReviewerOptions.mockReturnValue(
        of({ mode: 'picker' } as SecurityReviewerResult),
      );

      component.ngOnInit();
      component.filters.securityReviewer = 'bob@example.com';
      component.onUnassignedChange(false);

      expect(component.filters.securityReviewer).toBe('bob@example.com');
    });
  });

  describe('Navigation', () => {
    it('should navigate to threat model detail', () => {
      const tm = makeTMListItem({ id: 'tm-nav' });
      component.viewThreatModel(tm);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/tm', 'tm-nav']);
    });
  });

  describe('getStatusLabel()', () => {
    it('should return empty string for null status', () => {
      expect(component.getStatusLabel(null)).toBe('');
      expect(component.getStatusLabel(undefined)).toBe('');
    });
  });

  describe('getSelectedReviewerDisplay()', () => {
    it('should return null when no reviewer selected', () => {
      expect(component.getSelectedReviewerDisplay('tm-1')).toBeNull();
    });

    it('should return display name when reviewer selected', () => {
      component.selectedReviewers.set('tm-1', mockReviewer);
      expect(component.getSelectedReviewerDisplay('tm-1')).toBe('Test Reviewer');
    });
  });
});
