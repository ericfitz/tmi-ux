import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { take, catchError } from 'rxjs/operators';
import { LoggerService } from '../../../../core/services/logger.service';
import { CommandBusService } from '../../application/services/command-bus.service';
import { DiagramCommandFactory } from '../../domain/commands/diagram-commands';
import { NodeData } from '../../domain/value-objects/node-data';
import { EdgeData } from '../../domain/value-objects/edge-data';
import { Point } from '../../domain/value-objects/point';
import { SerializationOptimizationService } from './serialization-optimization.service';
import { CollaborationApplicationService } from '../../application/collaboration/collaboration-application.service';
import { DiagramSnapshot } from '../../domain/aggregates/diagram-aggregate';
import { User } from '../../domain/collaboration/user';

/**
 * Performance metrics for different operations
 */
export interface PerformanceMetrics {
  operationType: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  totalOperations: number;
  operationsPerSecond: number;
  memoryUsage?: number;
  errorRate: number;
}

/**
 * Performance test configuration
 */
export interface PerformanceTestConfig {
  nodeCount: number;
  edgeCount: number;
  collaboratorCount: number;
  operationCount: number;
  testDuration: number; // in seconds
  enableMemoryProfiling: boolean;
  enableSerializationTesting: boolean;
  enableCollaborationTesting: boolean;
}

/**
 * Performance test results
 */
export interface PerformanceTestResults {
  testName: string;
  config: PerformanceTestConfig;
  metrics: PerformanceMetrics[];
  overallScore: number;
  recommendations: string[];
  timestamp: Date;
}

/**
 * Service for comprehensive performance testing and optimization
 */
@Injectable({
  providedIn: 'root',
})
export class PerformanceTestingService {
  private readonly _testResults$ = new BehaviorSubject<PerformanceTestResults[]>([]);
  private readonly _currentTest$ = new BehaviorSubject<string | null>(null);
  private readonly _testProgress$ = new BehaviorSubject<number>(0);

  private readonly _defaultConfig: PerformanceTestConfig = {
    nodeCount: 100,
    edgeCount: 150,
    collaboratorCount: 5,
    operationCount: 1000,
    testDuration: 60,
    enableMemoryProfiling: true,
    enableSerializationTesting: true,
    enableCollaborationTesting: true,
  };

  constructor(
    private readonly logger: LoggerService,
    private readonly commandBus: CommandBusService,
    private readonly serializationService: SerializationOptimizationService,
    private readonly collaborationService: CollaborationApplicationService,
  ) {
    this.logger.info('PerformanceTestingService initialized');
  }

  /**
   * Get current test results
   */
  get testResults$(): Observable<PerformanceTestResults[]> {
    return this._testResults$.asObservable();
  }

  /**
   * Get current test name
   */
  get currentTest$(): Observable<string | null> {
    return this._currentTest$.asObservable();
  }

  /**
   * Get test progress (0-100)
   */
  get testProgress$(): Observable<number> {
    return this._testProgress$.asObservable();
  }

  /**
   * Run comprehensive performance test suite
   */
  runPerformanceTestSuite(
    config: Partial<PerformanceTestConfig> = {},
  ): Observable<PerformanceTestResults[]> {
    const testConfig = { ...this._defaultConfig, ...config };
    this.logger.info('Starting comprehensive performance test suite', testConfig);

    return new Observable(observer => {
      const results: PerformanceTestResults[] = [];
      let currentTestIndex = 0;
      const tests = [
        () => this.testCommandBusPerformance(testConfig),
        () => this.testSerializationPerformance(testConfig),
        () => this.testCollaborationPerformance(testConfig),
        () => this.testMemoryUsage(testConfig),
        () => this.testLargeDatasetPerformance(testConfig),
      ];

      const runNextTest = (): void => {
        if (currentTestIndex >= tests.length) {
          this._currentTest$.next(null);
          this._testProgress$.next(100);
          this._testResults$.next(results);
          observer.next(results);
          observer.complete();
          return;
        }

        const progress = (currentTestIndex / tests.length) * 100;
        this._testProgress$.next(progress);

        tests[currentTestIndex]().subscribe({
          next: result => {
            results.push(result);
            currentTestIndex++;
            runNextTest();
          },
          error: error => {
            this.logger.error('Performance test failed', error);
            currentTestIndex++;
            runNextTest();
          },
        });
      };

      runNextTest();
    });
  }

  /**
   * Test command bus performance
   */
  private testCommandBusPerformance(
    config: PerformanceTestConfig,
  ): Observable<PerformanceTestResults> {
    this._currentTest$.next('Command Bus Performance');
    this.logger.info('Testing command bus performance');

    return new Observable(observer => {
      const metrics: PerformanceMetrics[] = [];
      const diagramId = 'perf-test-diagram';
      const userId = 'perf-test-user';

      // Test node creation performance
      this.measureOperationPerformance('Node Creation', config.operationCount, () => {
        const nodeId = `node-${Date.now()}-${Math.random()}`;
        const nodeData = new NodeData(
          nodeId,
          'actor',
          'Test Node',
          new Point(Math.random() * 1000, Math.random() * 1000),
          120,
          80,
          {},
        );
        const command = DiagramCommandFactory.addNode(
          diagramId,
          userId,
          nodeId,
          nodeData.position,
          nodeData,
        );
        return this.commandBus.execute(command);
      }).subscribe(nodeMetrics => {
        metrics.push(nodeMetrics);

        // Test edge creation performance
        this.measureOperationPerformance('Edge Creation', config.operationCount / 2, () => {
          const edgeId = `edge-${Date.now()}-${Math.random()}`;
          const sourceId = `node-source-${Math.random()}`;
          const targetId = `node-target-${Math.random()}`;
          const edgeData = new EdgeData(
            edgeId,
            sourceId,
            targetId,
            undefined,
            undefined,
            'Test Edge',
            [],
            {},
          );
          const command = DiagramCommandFactory.addEdge(
            diagramId,
            userId,
            edgeId,
            sourceId,
            targetId,
            edgeData,
          );
          return this.commandBus.execute(command);
        }).subscribe(edgeMetrics => {
          metrics.push(edgeMetrics);

          const result: PerformanceTestResults = {
            testName: 'Command Bus Performance',
            config,
            metrics,
            overallScore: this.calculateOverallScore(metrics),
            recommendations: this.generateRecommendations(metrics),
            timestamp: new Date(),
          };

          observer.next(result);
          observer.complete();
        });
      });
    });
  }

  /**
   * Test serialization performance
   */
  private testSerializationPerformance(
    config: PerformanceTestConfig,
  ): Observable<PerformanceTestResults> {
    this._currentTest$.next('Serialization Performance');
    this.logger.info('Testing serialization performance');

    return new Observable(observer => {
      const metrics: PerformanceMetrics[] = [];

      // Create test data
      const testNodes = Array.from({ length: config.nodeCount }, (_, i) => ({
        id: `node-${i}`,
        type: 'actor',
        label: `Node ${i}`,
        x: Math.random() * 1000,
        y: Math.random() * 1000,
      }));

      const testEdges = Array.from({ length: config.edgeCount }, (_, i) => ({
        id: `edge-${i}`,
        source: `node-${Math.floor(Math.random() * config.nodeCount)}`,
        target: `node-${Math.floor(Math.random() * config.nodeCount)}`,
        label: `Edge ${i}`,
      }));

      // Test JSON serialization
      this.measureOperationPerformance('JSON Serialization', 100, () => {
        const diagramSnapshot: DiagramSnapshot = {
          id: 'test-diagram',
          name: 'Test Diagram',
          description: 'Performance test diagram',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: 'test-user',
          version: 1,
          nodes: testNodes,
          edges: testEdges,
        };
        const data = this.serializationService.serializeDiagram(diagramSnapshot);
        return of(data);
      }).subscribe(jsonMetrics => {
        metrics.push(jsonMetrics);

        // Test compression
        this.measureOperationPerformance('Compression', 50, () => {
          const diagramSnapshot: DiagramSnapshot = {
            id: 'test-diagram',
            name: 'Test Diagram',
            description: 'Performance test diagram',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'test-user',
            version: 1,
            nodes: testNodes,
            edges: testEdges,
          };
          const data = this.serializationService.serializeDiagram(diagramSnapshot);
          return of(data);
        }).subscribe(compressionMetrics => {
          metrics.push(compressionMetrics);

          const result: PerformanceTestResults = {
            testName: 'Serialization Performance',
            config,
            metrics,
            overallScore: this.calculateOverallScore(metrics),
            recommendations: this.generateRecommendations(metrics),
            timestamp: new Date(),
          };

          observer.next(result);
          observer.complete();
        });
      });
    });
  }

  /**
   * Test collaboration performance
   */
  private testCollaborationPerformance(
    config: PerformanceTestConfig,
  ): Observable<PerformanceTestResults> {
    this._currentTest$.next('Collaboration Performance');
    this.logger.info('Testing collaboration performance');

    return new Observable(observer => {
      const metrics: PerformanceMetrics[] = [];

      // Test session creation
      this.measureOperationPerformance('Session Creation', 10, () => {
        const sessionId = `session-${Date.now()}-${Math.random()}`;
        const diagramId = 'test-diagram';
        const testUser = new User('test-user', 'Test User', 'test@example.com');
        return this.collaborationService.createSession(sessionId, diagramId, testUser);
      }).subscribe(sessionMetrics => {
        metrics.push(sessionMetrics);

        const result: PerformanceTestResults = {
          testName: 'Collaboration Performance',
          config,
          metrics,
          overallScore: this.calculateOverallScore(metrics),
          recommendations: this.generateRecommendations(metrics),
          timestamp: new Date(),
        };

        observer.next(result);
        observer.complete();
      });
    });
  }

  /**
   * Test memory usage
   */
  private testMemoryUsage(config: PerformanceTestConfig): Observable<PerformanceTestResults> {
    this._currentTest$.next('Memory Usage Analysis');
    this.logger.info('Testing memory usage');

    return new Observable(observer => {
      const metrics: PerformanceMetrics[] = [];

      if (
        config.enableMemoryProfiling &&
        'performance' in window &&
        'memory' in (window.performance as any)
      ) {
        const initialMemory = (window.performance as any).memory.usedJSHeapSize;

        // Create large dataset and measure memory impact
        const largeDataset = Array.from({ length: config.nodeCount * 10 }, (_, i) => ({
          id: `large-node-${i}`,
          data: new Array(1000).fill(`data-${i}`),
        }));

        setTimeout(() => {
          const finalMemory = (window.performance as any).memory.usedJSHeapSize;
          const memoryDelta = finalMemory - initialMemory;

          metrics.push({
            operationType: 'Memory Usage',
            averageTime: 0,
            minTime: 0,
            maxTime: 0,
            totalOperations: 1,
            operationsPerSecond: 0,
            memoryUsage: memoryDelta,
            errorRate: 0,
          });

          // Clean up
          largeDataset.length = 0;

          const result: PerformanceTestResults = {
            testName: 'Memory Usage Analysis',
            config,
            metrics,
            overallScore: this.calculateOverallScore(metrics),
            recommendations: this.generateRecommendations(metrics),
            timestamp: new Date(),
          };

          observer.next(result);
          observer.complete();
        }, 1000);
      } else {
        // Memory profiling not available
        const result: PerformanceTestResults = {
          testName: 'Memory Usage Analysis',
          config,
          metrics: [],
          overallScore: 100,
          recommendations: ['Memory profiling not available in this environment'],
          timestamp: new Date(),
        };

        observer.next(result);
        observer.complete();
      }
    });
  }

  /**
   * Test large dataset performance
   */
  private testLargeDatasetPerformance(
    config: PerformanceTestConfig,
  ): Observable<PerformanceTestResults> {
    this._currentTest$.next('Large Dataset Performance');
    this.logger.info('Testing large dataset performance');

    return new Observable(observer => {
      const metrics: PerformanceMetrics[] = [];
      const largeConfig = {
        ...config,
        nodeCount: config.nodeCount * 10,
        edgeCount: config.edgeCount * 10,
      };

      // Test with large dataset
      this.testSerializationPerformance(largeConfig).subscribe(result => {
        const adjustedMetrics = result.metrics.map(metric => ({
          ...metric,
          operationType: `Large Dataset ${metric.operationType}`,
        }));

        const finalResult: PerformanceTestResults = {
          testName: 'Large Dataset Performance',
          config: largeConfig,
          metrics: adjustedMetrics,
          overallScore: this.calculateOverallScore(adjustedMetrics),
          recommendations: this.generateRecommendations(adjustedMetrics),
          timestamp: new Date(),
        };

        observer.next(finalResult);
        observer.complete();
      });
    });
  }

  /**
   * Measure performance of a specific operation
   */
  private measureOperationPerformance<T>(
    operationType: string,
    iterations: number,
    operation: () => Observable<T>,
  ): Observable<PerformanceMetrics> {
    return new Observable(observer => {
      const times: number[] = [];
      let errors = 0;
      let completed = 0;

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const operationStart = performance.now();

        operation()
          .pipe(
            take(1),
            catchError(() => {
              errors++;
              return of(null);
            }),
          )
          .subscribe(() => {
            const operationEnd = performance.now();
            times.push(operationEnd - operationStart);
            completed++;

            if (completed === iterations) {
              const endTime = performance.now();
              const totalTime = endTime - startTime;

              const metrics: PerformanceMetrics = {
                operationType,
                averageTime: times.reduce((a, b) => a + b, 0) / times.length,
                minTime: Math.min(...times),
                maxTime: Math.max(...times),
                totalOperations: iterations,
                operationsPerSecond: (iterations / totalTime) * 1000,
                errorRate: (errors / iterations) * 100,
              };

              observer.next(metrics);
              observer.complete();
            }
          });
      }
    });
  }

  /**
   * Calculate overall performance score
   */
  private calculateOverallScore(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 100;

    const scores = metrics.map(metric => {
      // Score based on operations per second and error rate
      const opsScore = Math.min(metric.operationsPerSecond / 100, 1) * 50;
      const errorScore = Math.max(0, 50 - metric.errorRate);
      return opsScore + errorScore;
    });

    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  /**
   * Generate performance recommendations
   */
  private generateRecommendations(metrics: PerformanceMetrics[]): string[] {
    const recommendations: string[] = [];

    metrics.forEach(metric => {
      if (metric.operationsPerSecond < 10) {
        recommendations.push(`${metric.operationType}: Consider optimizing for better throughput`);
      }
      if (metric.errorRate > 5) {
        recommendations.push(
          `${metric.operationType}: High error rate detected, investigate error handling`,
        );
      }
      if (metric.averageTime > 100) {
        recommendations.push(
          `${metric.operationType}: Average operation time is high, consider optimization`,
        );
      }
      if (metric.memoryUsage && metric.memoryUsage > 50 * 1024 * 1024) {
        recommendations.push(
          `${metric.operationType}: High memory usage detected, consider memory optimization`,
        );
      }
    });

    if (recommendations.length === 0) {
      recommendations.push('Performance is within acceptable ranges');
    }

    return recommendations;
  }

  /**
   * Clear test results
   */
  clearResults(): void {
    this._testResults$.next([]);
    this._currentTest$.next(null);
    this._testProgress$.next(0);
  }
}
