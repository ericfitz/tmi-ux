import '@angular/compiler';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { DfdCommandService } from './dfd-command.service';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { AppExportService } from '../../application/services/app-export.service';
import { InfraX6GraphAdapter } from '../../infrastructure/adapters/infra-x6-graph.adapter';
import { createTypedMockLoggerService, type MockLoggerService } from '@testing/mocks';
import { partialMock } from '@testing/partial-mock';

describe('DfdCommandService', () => {
  let service: DfdCommandService;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let logger: MockLoggerService;
  let threatModelService: { createThreat: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    router = { navigate: vi.fn().mockResolvedValue(true) };
    logger = createTypedMockLoggerService();
    threatModelService = { createThreat: vi.fn().mockReturnValue(of({ id: 'threat-1' })) };
    // Partial Router/ThreatModelService: only the methods the service calls are stubbed
    service = new DfdCommandService(
      partialMock<Router>(router),
      logger,
      partialMock<ThreatModelService>(threatModelService),
    );
  });

  describe('navigateAway', () => {
    it('navigates to the threat model with a refresh query param when a tm id is given', () => {
      service.navigateAway('tm-123');
      expect(router.navigate).toHaveBeenCalledWith(['/tm', 'tm-123'], {
        queryParams: { refresh: 'true' },
      });
    });

    it('navigates to the dashboard when no tm id is given', () => {
      service.navigateAway(null);
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    });
  });

  describe('createThreat', () => {
    it('maps the threat editor result to the API payload and calls the service', () => {
      const result = {
        name: 'Spoofing',
        description: 'desc',
        diagram_id: 'd-1',
        cell_id: 'c-1',
        severity: 'High',
        score: 7,
        priority: 'High',
        mitigated: false,
        status: 'Open',
        threat_type: 'Spoofing',
        asset_id: 'a-1',
        issue_uri: 'http://issue',
      };

      service.createThreat('tm-123', result);

      expect(threatModelService.createThreat).toHaveBeenCalledWith('tm-123', {
        name: 'Spoofing',
        description: 'desc',
        diagram_id: 'd-1',
        cell_id: 'c-1',
        severity: 'High',
        score: 7,
        priority: 'High',
        mitigated: false,
        status: 'Open',
        threat_type: 'Spoofing',
        asset_id: 'a-1',
        issue_uri: 'http://issue',
      });
    });

    it('logs an error and does not call the service when no tm id is given', () => {
      service.createThreat('', { name: 'x' });

      expect(threatModelService.createThreat).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it('logs an error when the create request fails', () => {
      threatModelService.createThreat.mockReturnValue(throwError(() => new Error('boom')));

      service.createThreat('tm-123', { name: 'x' });

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('captureDiagramSvgThumbnail', () => {
    it('resolves null when the graph adapter is not initialized', async () => {
      const graphAdapter = { isInitialized: vi.fn().mockReturnValue(false), getGraph: vi.fn() };
      const exportService = { prepareImageExport: vi.fn(), processSvg: vi.fn() };

      const result = await service.captureDiagramSvgThumbnail(
        partialMock<InfraX6GraphAdapter>(graphAdapter),
        partialMock<AppExportService>(exportService),
        vi.fn(),
      );

      expect(result).toBeNull();
    });

    it('resolves null when the graph adapter returns a null graph', async () => {
      const graphAdapter = {
        isInitialized: vi.fn().mockReturnValue(true),
        getGraph: vi.fn().mockReturnValue(null),
      };
      const exportService = { prepareImageExport: vi.fn(), processSvg: vi.fn() };

      const result = await service.captureDiagramSvgThumbnail(
        partialMock<InfraX6GraphAdapter>(graphAdapter),
        partialMock<AppExportService>(exportService),
        vi.fn(),
      );

      expect(result).toBeNull();
      expect(exportService.prepareImageExport).not.toHaveBeenCalled();
    });

    it('resolves null when prepareImageExport returns null', async () => {
      const fakeGraph = { toSVG: vi.fn() };
      const graphAdapter = {
        isInitialized: vi.fn().mockReturnValue(true),
        getGraph: vi.fn().mockReturnValue(fakeGraph),
      };
      const exportService = {
        prepareImageExport: vi.fn().mockReturnValue(null),
        processSvg: vi.fn(),
      };

      const result = await service.captureDiagramSvgThumbnail(
        partialMock<InfraX6GraphAdapter>(graphAdapter),
        partialMock<AppExportService>(exportService),
        vi.fn(),
      );

      expect(result).toBeNull();
      expect(fakeGraph.toSVG).not.toHaveBeenCalled();
    });

    it('catches a processSvg failure, logs the error, and resolves null', async () => {
      const fakeGraph = {
        toSVG: (cb: (svg: string) => void) => cb('<svg></svg>'),
      };
      const graphAdapter = {
        isInitialized: vi.fn().mockReturnValue(true),
        getGraph: vi.fn().mockReturnValue(fakeGraph),
      };
      const exportService = {
        prepareImageExport: vi.fn().mockReturnValue({ viewBox: '0 0 10 10', exportOptions: {} }),
        processSvg: vi.fn().mockImplementation(() => {
          throw new Error('processSvg boom');
        }),
      };

      const result = await service.captureDiagramSvgThumbnail(
        partialMock<InfraX6GraphAdapter>(graphAdapter),
        partialMock<AppExportService>(exportService),
        vi.fn(),
      );

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Error encoding SVG to base64', expect.any(Error));
    });

    it('captures and processes the SVG when the graph is ready', async () => {
      const fakeGraph = {
        toSVG: (cb: (svg: string) => void) => cb('<svg></svg>'),
      };
      const graphAdapter = {
        isInitialized: vi.fn().mockReturnValue(true),
        getGraph: vi.fn().mockReturnValue(fakeGraph),
      };
      const exportService = {
        prepareImageExport: vi.fn().mockReturnValue({ viewBox: '0 0 10 10', exportOptions: {} }),
        processSvg: vi.fn().mockReturnValue('base64svg'),
      };
      const clearSelection = vi.fn();

      const result = await service.captureDiagramSvgThumbnail(
        partialMock<InfraX6GraphAdapter>(graphAdapter),
        partialMock<AppExportService>(exportService),
        clearSelection,
      );

      expect(clearSelection).toHaveBeenCalled();
      expect(result).toBe('base64svg');
    });
  });
});
