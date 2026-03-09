// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { AuditTrailService } from './audit-trail.service';
import { ApiService } from '../../../core/services/api.service';
import { LoggerService } from '../../../core/services/logger.service';
import { createMockLoggerService } from '../../../../testing/mocks';
import {
  AuditEntry,
  AuditObjectType,
  AuditTrailListParams,
  ListAuditTrailResponse,
} from '../models/audit-trail.model';

describe('AuditTrailService', () => {
  let service: AuditTrailService;
  let apiService: ApiService;
  let loggerService: LoggerService;

  const mockAuditEntry: AuditEntry = {
    id: 'entry-1',
    threat_model_id: 'tm-1',
    object_type: 'threat',
    object_id: 'threat-1',
    version: 3,
    change_type: 'updated',
    actor: {
      email: 'user@example.com',
      provider: 'test',
      provider_id: 'user-1',
      display_name: 'Test User',
    },
    change_summary: 'Updated threat name',
    created_at: '2024-06-01T10:00:00Z',
  };

  const mockResponse: ListAuditTrailResponse = {
    audit_entries: [mockAuditEntry],
    total: 1,
    limit: 20,
    offset: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    loggerService = createMockLoggerService() as unknown as LoggerService;

    apiService = {
      get: vi.fn().mockReturnValue(of(mockResponse)),
      post: vi.fn().mockReturnValue(of(mockAuditEntry)),
      put: vi.fn().mockReturnValue(of({})),
      delete: vi.fn().mockReturnValue(of(true)),
    } as unknown as ApiService;

    service = new AuditTrailService(apiService, loggerService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('getAuditTrail', () => {
    it('should call API with correct endpoint and no query params', () => {
      service.getAuditTrail('tm-1').subscribe(response => {
        expect(response).toEqual(mockResponse);
      });

      expect(apiService.get).toHaveBeenCalledWith('threat_models/tm-1/audit_trail', {});
    });

    it('should pass query params when provided', () => {
      const params: AuditTrailListParams = {
        limit: 10,
        offset: 20,
        object_type: 'threat',
        change_type: 'updated',
        actor_email: 'user@example.com',
        after: '2024-01-01T00:00:00Z',
        before: '2024-12-31T23:59:59Z',
      };

      service.getAuditTrail('tm-1', params).subscribe();

      expect(apiService.get).toHaveBeenCalledWith('threat_models/tm-1/audit_trail', {
        limit: '10',
        offset: '20',
        object_type: 'threat',
        change_type: 'updated',
        actor_email: 'user@example.com',
        after: '2024-01-01T00:00:00Z',
        before: '2024-12-31T23:59:59Z',
      });
    });

    it('should only include defined params in query', () => {
      const params: AuditTrailListParams = {
        limit: 10,
      };

      service.getAuditTrail('tm-1', params).subscribe();

      expect(apiService.get).toHaveBeenCalledWith('threat_models/tm-1/audit_trail', {
        limit: '10',
      });
    });

    it('should return empty response on error', () => {
      (apiService.get as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      service.getAuditTrail('tm-1').subscribe(response => {
        expect(response).toEqual({ audit_entries: [], total: 0, limit: 0, offset: 0 });
      });

      expect(loggerService.error).toHaveBeenCalledWith(
        'Error fetching audit trail for threat model: tm-1',
        expect.any(Error),
      );
    });

    it('should return empty response when API returns null body', () => {
      (apiService.get as ReturnType<typeof vi.fn>).mockReturnValue(of(null));

      service.getAuditTrail('tm-1').subscribe(response => {
        expect(response).toEqual({ audit_entries: [], total: 0, limit: 0, offset: 0 });
      });
    });
  });

  describe('getEntityAuditTrail', () => {
    const entityEndpointTests: { type: AuditObjectType; path: string }[] = [
      { type: 'diagram', path: 'diagrams' },
      { type: 'threat', path: 'threats' },
      { type: 'asset', path: 'assets' },
      { type: 'document', path: 'documents' },
      { type: 'note', path: 'notes' },
      { type: 'repository', path: 'repositories' },
    ];

    entityEndpointTests.forEach(({ type, path }) => {
      it(`should build correct endpoint for ${type}`, () => {
        service.getEntityAuditTrail('tm-1', type, 'entity-1').subscribe();

        expect(apiService.get).toHaveBeenCalledWith(
          `threat_models/tm-1/${path}/entity-1/audit_trail`,
          {},
        );
      });
    });

    it('should pass query params when provided', () => {
      const params: AuditTrailListParams = {
        limit: 5,
        offset: 10,
        change_type: 'created',
      };

      service.getEntityAuditTrail('tm-1', 'threat', 'threat-1', params).subscribe();

      expect(apiService.get).toHaveBeenCalledWith(
        'threat_models/tm-1/threats/threat-1/audit_trail',
        {
          limit: '5',
          offset: '10',
          change_type: 'created',
        },
      );
    });

    it('should return empty response on error', () => {
      (apiService.get as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new Error('Not found')),
      );

      service.getEntityAuditTrail('tm-1', 'diagram', 'diag-1').subscribe(response => {
        expect(response).toEqual({ audit_entries: [], total: 0, limit: 0, offset: 0 });
      });

      expect(loggerService.error).toHaveBeenCalledWith(
        'Error fetching audit trail for diagram diag-1',
        expect.any(Error),
      );
    });

    it('should return empty response when API returns null body', () => {
      (apiService.get as ReturnType<typeof vi.fn>).mockReturnValue(of(null));

      service.getEntityAuditTrail('tm-1', 'diagram', 'diag-1').subscribe(response => {
        expect(response).toEqual({ audit_entries: [], total: 0, limit: 0, offset: 0 });
      });
    });
  });

  describe('getAuditEntry', () => {
    it('should call API with correct endpoint', () => {
      (apiService.get as ReturnType<typeof vi.fn>).mockReturnValue(of(mockAuditEntry));

      service.getAuditEntry('tm-1', 'entry-1').subscribe(entry => {
        expect(entry).toEqual(mockAuditEntry);
      });

      expect(apiService.get).toHaveBeenCalledWith('threat_models/tm-1/audit_trail/entry-1');
    });

    it('should return undefined on error', () => {
      (apiService.get as ReturnType<typeof vi.fn>).mockReturnValue(
        throwError(() => new Error('Not found')),
      );

      service.getAuditEntry('tm-1', 'entry-1').subscribe(entry => {
        expect(entry).toBeUndefined();
      });

      expect(loggerService.error).toHaveBeenCalledWith(
        'Error fetching audit entry: entry-1',
        expect.any(Error),
      );
    });
  });

  describe('rollback', () => {
    it('should call API POST with correct endpoint and empty body', () => {
      service.rollback('tm-1', 'entry-1').subscribe(result => {
        expect(result).toEqual(mockAuditEntry);
      });

      expect(apiService.post).toHaveBeenCalledWith(
        'threat_models/tm-1/audit_trail/entry-1/rollback',
        {},
      );
    });

    it('should propagate errors without catching', () => {
      const error = new Error('Rollback failed');
      (apiService.post as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => error));

      service.rollback('tm-1', 'entry-1').subscribe({
        error: err => {
          expect(err).toBe(error);
        },
      });
    });
  });
});
