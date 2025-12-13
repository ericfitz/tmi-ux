/**
 * Unit tests for FrameworkService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/shared/services/framework.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of, throwError, lastValueFrom } from 'rxjs';
import { FrameworkService } from './framework.service';
import { Framework } from '../models/framework.model';

describe('FrameworkService', () => {
  let service: FrameworkService;
  let mockHttp: {
    get: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };

  const mockStrideFramework: Framework = {
    'framework-name': 'STRIDE',
    'threat-types': [
      { name: 'Spoofing', 'applies-to': ['process', 'data-store'] },
      { name: 'Tampering', 'applies-to': ['process', 'data-flow'] },
      { name: 'Repudiation', 'applies-to': ['process'] },
    ],
  };

  const mockLinddunFramework: Framework = {
    'framework-name': 'LINDDUN',
    'threat-types': [
      { name: 'Linkability', 'applies-to': ['data-flow'] },
      { name: 'Identifiability', 'applies-to': ['process'] },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockHttp = {
      get: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
    };

    service = new FrameworkService(mockHttp as any, mockLogger as any);
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });
  });

  describe('loadAllFrameworks()', () => {
    it('should load all framework files', async () => {
      // Mock HTTP responses for all framework files
      mockHttp.get.mockImplementation((url: string) => {
        if (url.includes('stride.json')) {
          return of(mockStrideFramework);
        } else if (url.includes('linddun.json')) {
          return of(mockLinddunFramework);
        } else {
          return of({
            'framework-name': 'Test',
            'threat-types': [],
          });
        }
      });

      const frameworks = await lastValueFrom(service.loadAllFrameworks());

      expect(frameworks).toHaveLength(5); // stride, linddun, cia, die, plot4ai
      expect(frameworks[0]).toHaveProperty('name');
      expect(frameworks[0]).toHaveProperty('threatTypes');
      expect(mockHttp.get).toHaveBeenCalledTimes(5);
    });

    it('should convert Framework to FrameworkModel correctly', async () => {
      mockHttp.get.mockReturnValue(of(mockStrideFramework));

      const frameworks = await lastValueFrom(service.loadAllFrameworks());
      const strideModel = frameworks[0];

      expect(strideModel.name).toBe('STRIDE');
      expect(strideModel.threatTypes).toHaveLength(3);
      expect(strideModel.threatTypes[0]).toEqual({
        name: 'Spoofing',
        appliesTo: ['process', 'data-store'],
      });
    });

    it('should request correct asset paths', async () => {
      mockHttp.get.mockReturnValue(
        of({
          'framework-name': 'Test',
          'threat-types': [],
        }),
      );

      await lastValueFrom(service.loadAllFrameworks());

      expect(mockHttp.get).toHaveBeenCalledWith('/assets/frameworks/stride.json');
      expect(mockHttp.get).toHaveBeenCalledWith('/assets/frameworks/linddun.json');
      expect(mockHttp.get).toHaveBeenCalledWith('/assets/frameworks/cia.json');
      expect(mockHttp.get).toHaveBeenCalledWith('/assets/frameworks/die.json');
      expect(mockHttp.get).toHaveBeenCalledWith('/assets/frameworks/plot4ai.json');
    });
  });

  describe('loadFramework()', () => {
    it('should load STRIDE framework', async () => {
      mockHttp.get.mockReturnValue(of(mockStrideFramework));

      const framework = await lastValueFrom(service.loadFramework('STRIDE'));

      expect(framework).toBeDefined();
      expect(framework?.name).toBe('STRIDE');
      expect(framework?.threatTypes).toHaveLength(3);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Successfully loaded framework',
        expect.objectContaining({
          frameworkName: 'STRIDE',
        }),
      );
    });

    it('should load LINDDUN framework', async () => {
      mockHttp.get.mockReturnValue(of(mockLinddunFramework));

      const framework = await lastValueFrom(service.loadFramework('LINDDUN'));

      expect(framework).toBeDefined();
      expect(framework?.name).toBe('LINDDUN');
      expect(mockHttp.get).toHaveBeenCalledWith('/assets/frameworks/linddun.json');
    });

    it('should load CIA framework', async () => {
      mockHttp.get.mockReturnValue(
        of({
          'framework-name': 'CIA',
          'threat-types': [],
        }),
      );

      const framework = await lastValueFrom(service.loadFramework('CIA'));

      expect(framework?.name).toBe('CIA');
      expect(mockHttp.get).toHaveBeenCalledWith('/assets/frameworks/cia.json');
    });

    it('should load DIE framework', async () => {
      mockHttp.get.mockReturnValue(
        of({
          'framework-name': 'DIE',
          'threat-types': [],
        }),
      );

      const framework = await lastValueFrom(service.loadFramework('DIE'));

      expect(framework?.name).toBe('DIE');
      expect(mockHttp.get).toHaveBeenCalledWith('/assets/frameworks/die.json');
    });

    it('should load PLOT4AI framework', async () => {
      mockHttp.get.mockReturnValue(
        of({
          'framework-name': 'PLOT4AI',
          'threat-types': [],
        }),
      );

      const framework = await lastValueFrom(service.loadFramework('PLOT4AI'));

      expect(framework?.name).toBe('PLOT4AI');
      expect(mockHttp.get).toHaveBeenCalledWith('/assets/frameworks/plot4ai.json');
    });

    it('should be case-insensitive', async () => {
      mockHttp.get.mockReturnValue(of(mockStrideFramework));

      const framework = await lastValueFrom(service.loadFramework('stride'));

      expect(framework).toBeDefined();
      expect(framework?.name).toBe('STRIDE');
    });

    it('should return null for unknown framework', async () => {
      const framework = await lastValueFrom(service.loadFramework('UNKNOWN'));

      expect(framework).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Unknown framework name',
        expect.objectContaining({
          frameworkName: 'UNKNOWN',
        }),
      );
      expect(mockHttp.get).not.toHaveBeenCalled();
    });

    it('should convert threat types correctly', async () => {
      const frameworkWithComplexTypes: Framework = {
        'framework-name': 'Test Framework',
        'threat-types': [
          {
            name: 'Type 1',
            'applies-to': ['process', 'data-store', 'data-flow'],
          },
          {
            name: 'Type 2',
            'applies-to': ['external-entity'],
          },
        ],
      };

      mockHttp.get.mockReturnValue(of(frameworkWithComplexTypes));

      const framework = await lastValueFrom(service.loadFramework('STRIDE'));

      expect(framework?.threatTypes).toHaveLength(2);
      expect(framework?.threatTypes[0].appliesTo).toEqual(['process', 'data-store', 'data-flow']);
      expect(framework?.threatTypes[1].appliesTo).toEqual(['external-entity']);
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP errors when loading all frameworks', async () => {
      mockHttp.get.mockReturnValue(throwError(() => new Error('Network error')));

      await expect(lastValueFrom(service.loadAllFrameworks())).rejects.toThrow('Network error');
    });

    it('should handle HTTP errors when loading single framework', async () => {
      mockHttp.get.mockReturnValue(throwError(() => new Error('File not found')));

      await expect(lastValueFrom(service.loadFramework('STRIDE'))).rejects.toThrow(
        'File not found',
      );
    });
  });

  describe('Framework Model Conversion', () => {
    it('should preserve all threat types during conversion', async () => {
      const frameworkWithManyTypes: Framework = {
        'framework-name': 'Test',
        'threat-types': Array(10)
          .fill(null)
          .map((_, i) => ({
            name: `Type ${i}`,
            'applies-to': ['process'],
          })),
      };

      mockHttp.get.mockReturnValue(of(frameworkWithManyTypes));

      const framework = await lastValueFrom(service.loadFramework('LINDDUN'));

      expect(framework?.threatTypes).toHaveLength(10);
    });

    it('should handle empty threat types array', async () => {
      const frameworkWithNoTypes: Framework = {
        'framework-name': 'Empty Framework',
        'threat-types': [],
      };

      mockHttp.get.mockReturnValue(of(frameworkWithNoTypes));

      const framework = await lastValueFrom(service.loadFramework('CIA'));

      expect(framework?.threatTypes).toEqual([]);
    });

    it('should convert framework-name to name property', async () => {
      mockHttp.get.mockReturnValue(of(mockStrideFramework));

      const framework = await lastValueFrom(service.loadFramework('STRIDE'));

      expect(framework).toHaveProperty('name');
      expect(framework).not.toHaveProperty('framework-name');
      expect(framework?.name).toBe('STRIDE');
    });

    it('should convert applies-to to appliesTo property', async () => {
      mockHttp.get.mockReturnValue(of(mockStrideFramework));

      const framework = await lastValueFrom(service.loadFramework('STRIDE'));

      expect(framework?.threatTypes[0]).toHaveProperty('appliesTo');
      expect(framework?.threatTypes[0]).not.toHaveProperty('applies-to');
    });
  });
});
