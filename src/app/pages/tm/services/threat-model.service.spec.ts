import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ThreatModelService } from './threat-model.service';
import { LoggerService } from '../../../core/services/logger.service';
import { MockDataService } from '../../../mocks/mock-data.service';
import { BehaviorSubject } from 'rxjs';

// Import mock data directly from the mocks directory
import { mockThreatModel1 } from '../../../mocks/instances/threat-model-1';
import { mockThreatModel2 } from '../../../mocks/instances/threat-model-2';
import { mockThreatModel3 } from '../../../mocks/instances/threat-model-3';
import { createMockThreatModel } from '../../../mocks/factories/threat-model.factory';

describe('ThreatModelService', () => {
  let service: ThreatModelService;
  let mockDataService: jasmine.SpyObj<MockDataService>;
  let loggerService: jasmine.SpyObj<LoggerService>;

  beforeEach(() => {
    // Create spy objects for the dependencies
    const mockDataServiceSpy = jasmine.createSpyObj('MockDataService', [
      'getMockThreatModels',
      'getMockThreatModelById',
      'getMockDiagramsForThreatModel',
      'getMockDiagramById',
      'createThreatModel',
    ]);

    // Set up the useMockData$ observable
    mockDataServiceSpy.useMockData$ = new BehaviorSubject<boolean>(true);

    const loggerServiceSpy = jasmine.createSpyObj('LoggerService', [
      'debug',
      'info',
      'warn',
      'error',
    ]);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ThreatModelService,
        { provide: MockDataService, useValue: mockDataServiceSpy },
        { provide: LoggerService, useValue: loggerServiceSpy },
      ],
    });

    service = TestBed.inject(ThreatModelService);
    mockDataService = TestBed.inject(MockDataService) as jasmine.SpyObj<MockDataService>;
    loggerService = TestBed.inject(LoggerService) as jasmine.SpyObj<LoggerService>;

    // Set up the mock data
    mockDataService.getMockThreatModels.and.returnValue([
      mockThreatModel1,
      mockThreatModel2,
      mockThreatModel3,
    ]);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('with mock data enabled', () => {
    beforeEach(() => {
      // Ensure mock data is enabled
      (mockDataService.useMockData$ as BehaviorSubject<boolean>).next(true);
    });

    it('should return mock threat models', done => {
      service.getThreatModels().subscribe(threatModels => {
        expect(threatModels.length).toBe(3);
        expect(threatModels).toContain(mockThreatModel1);
        expect(threatModels).toContain(mockThreatModel2);
        expect(threatModels).toContain(mockThreatModel3);
        done();
      });
    });

    it('should return a specific mock threat model by ID', done => {
      mockDataService.getMockThreatModelById.and.returnValue(mockThreatModel1);

      service.getThreatModelById(mockThreatModel1.id).subscribe(threatModel => {
        expect(threatModel).toBe(mockThreatModel1);
        expect(mockDataService.getMockThreatModelById).toHaveBeenCalledWith(mockThreatModel1.id);
        done();
      });
    });

    it('should create a new mock threat model', done => {
      const newThreatModel = createMockThreatModel({
        name: 'New Test Threat Model',
        description: 'Created for testing',
      });

      mockDataService.createThreatModel.and.returnValue(newThreatModel);

      service
        .createThreatModel('New Test Threat Model', 'Created for testing')
        .subscribe(result => {
          expect(result).toBe(newThreatModel);
          expect(mockDataService.createThreatModel).toHaveBeenCalled();
          done();
        });
    });
  });

  describe('with mock data disabled', () => {
    beforeEach(() => {
      // Disable mock data
      (mockDataService.useMockData$ as BehaviorSubject<boolean>).next(false);
    });

    // These tests would use HttpTestingController to mock API responses
    // For brevity, we're not implementing them in this example
  });
});
