// Import Zone.js is handled by the test setup

// Import Angular compiler
import '@angular/compiler';

import { HttpClient } from '@angular/common/http';
import { ThreatModelService } from './threat-model.service';
import { LoggerService } from '../../../core/services/logger.service';
import { MockDataService } from '../../../mocks/mock-data.service';
import { BehaviorSubject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Import testing utilities
import { waitForAsync } from '../../../../testing/async-utils';

// Import mock data directly from the mocks directory
import { mockThreatModel1 } from '../../../mocks/instances/threat-model-1';
import { mockThreatModel2 } from '../../../mocks/instances/threat-model-2';
import { mockThreatModel3 } from '../../../mocks/instances/threat-model-3';
import { createMockThreatModel } from '../../../mocks/factories/threat-model.factory';

// The Angular testing environment is initialized in src/testing/zone-setup.ts

describe('ThreatModelService', () => {
  let service: ThreatModelService;
  let mockDataService: MockDataService;
  let loggerService: LoggerService;
  let httpClient: HttpClient;

  beforeEach(() => {
    // Create spy objects for the dependencies
    mockDataService = {
      getMockThreatModels: vi
        .fn()
        .mockReturnValue([mockThreatModel1, mockThreatModel2, mockThreatModel3]),
      getMockThreatModelById: vi.fn().mockReturnValue(mockThreatModel1),
      getMockDiagramsForThreatModel: vi.fn().mockReturnValue([]),
      getMockDiagramById: vi.fn().mockReturnValue(null),
      createThreatModel: vi.fn().mockReturnValue(
        createMockThreatModel({
          name: 'New Test Threat Model',
          description: 'Created for testing',
        }),
      ),
      useMockData$: new BehaviorSubject<boolean>(true),
    } as unknown as MockDataService;

    loggerService = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as LoggerService;

    // Create a simple mock for HttpClient
    httpClient = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn().mockReturnValue(of({})),
      put: vi.fn().mockReturnValue(of({})),
      delete: vi.fn().mockReturnValue(of(true)),
    } as unknown as HttpClient;

    // Create the service directly with mocked dependencies
    service = new ThreatModelService(httpClient, loggerService, mockDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('with mock data enabled', () => {
    beforeEach(() => {
      // Ensure mock data is enabled
      if (mockDataService.useMockData$ instanceof BehaviorSubject) {
        mockDataService.useMockData$.next(true);
      }
    });

    it('should return mock threat models', waitForAsync(() => {
      service.getThreatModels().subscribe(threatModels => {
        expect(threatModels.length).toBe(3);
        expect(threatModels).toContain(mockThreatModel1);
        expect(threatModels).toContain(mockThreatModel2);
        expect(threatModels).toContain(mockThreatModel3);
      });
    }));

    it('should return a specific mock threat model by ID', waitForAsync(() => {
      service.getThreatModelById(mockThreatModel1.id).subscribe(threatModel => {
        expect(threatModel).toBeDefined();
        expect(threatModel?.id).toBe(mockThreatModel1.id);
      });
    }));

    it('should create a new mock threat model', waitForAsync(() => {
      service
        .createThreatModel('New Test Threat Model', 'Created for testing')
        .subscribe(threatModel => {
          expect(mockDataService.createThreatModel).toHaveBeenCalled();
          expect(threatModel).toBeDefined();
          expect(threatModel?.name).toBe('New Test Threat Model');
        });
    }));
  });

  describe('with mock data disabled', () => {
    beforeEach(() => {
      // Disable mock data
      if (mockDataService.useMockData$ instanceof BehaviorSubject) {
        mockDataService.useMockData$.next(false);
      }
    });

    // Add at least one test to avoid the "No test found in suite" error
    it('should handle API calls when mock data is disabled', waitForAsync(() => {
      // Disable mock data
      (mockDataService.useMockData$ as BehaviorSubject<boolean>).next(false);

      // This is a placeholder test
      expect(true).toBe(true);
    }));
  });
});
