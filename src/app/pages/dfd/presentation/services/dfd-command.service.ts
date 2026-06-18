import { Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { LoggerService } from '../../../../core/services/logger.service';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import { AppExportService } from '../../application/services/app-export.service';
import { InfraX6GraphAdapter } from '../../infrastructure/adapters/infra-x6-graph.adapter';

/**
 * Post-dialog orchestration for the DFD page that does NOT need the live X6
 * graph or `ChangeDetectorRef`. This service handles router navigation, threat
 * creation via the API, and SVG-thumbnail capture.
 *
 * The component retains all graph-dependent work (operation dispatch, change
 * detection, selection reads). `captureDiagramSvgThumbnail` stays graph-agnostic
 * by accepting the graph adapter, export service, and a selection-clearing
 * callback as method parameters rather than injecting the orchestrator.
 */
@Injectable({ providedIn: 'root' })
// SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: orchestrate post-dialog DFD commands: navigation, threat creation, and SVG thumbnail capture
export class DfdCommandService {
  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: inject router, logger, and threat model service dependencies (pure)
  constructor(
    private router: Router,
    private logger: LoggerService,
    private threatModelService: ThreatModelService,
  ) {}

  /**
   * Navigate back to the owning threat model, falling back to the dashboard if
   * navigation fails or no threat model id is available.
   */
  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: route to the owning threat model, falling back to the dashboard on failure (mutates shared state)
  navigateAway(threatModelId: string | null): void {
    if (threatModelId) {
      this.logger.info('Navigating back to threat model', { threatModelId });
      this.router
        .navigate(['/tm', threatModelId], { queryParams: { refresh: 'true' } })
        .catch(error => {
          this.logger.error('Failed to navigate back to threat model', { error });
          // Fallback: navigate to TM list
          this.router.navigate(['/dashboard']).catch(fallbackError => {
            this.logger.error('Failed to navigate to TM list as fallback', { fallbackError });
          });
        });
    } else {
      this.logger.warn('Cannot navigate: No threat model ID available, navigating to TM list');
      this.router.navigate(['/dashboard']).catch(error => {
        this.logger.error('Failed to navigate to TM list', { error });
      });
    }
  }

  /**
   * Create a new threat in the threat model from a threat editor dialog result.
   */
  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: store a new threat in the threat model via the API (reads DB)
  createThreat(threatModelId: string, threatData: any): void {
    if (!threatModelId) {
      this.logger.error('Cannot create threat: No threat model ID available');
      return;
    }

    // Build the threat data for the API (server assigns id, timestamps)
    const newThreatData = {
      name: threatData.name,
      description: threatData.description,
      diagram_id: threatData.diagram_id,
      cell_id: threatData.cell_id,
      severity: threatData.severity,
      score: threatData.score,
      priority: threatData.priority,
      mitigated: threatData.mitigated,
      status: threatData.status,
      threat_type: threatData.threat_type,
      asset_id: threatData.asset_id,
      issue_uri: threatData.issue_uri,
    };

    // Use the dedicated createThreat endpoint
    this.threatModelService.createThreat(threatModelId, newThreatData).subscribe({
      next: newThreat => {
        this.logger.info('Threat created successfully', { threatId: newThreat.id });
      },
      error: error => {
        this.logger.error('Failed to create threat', error);
      },
    });
  }

  /**
   * Capture SVG from the current graph and return it as a base64 encoded string
   * (for diagram thumbnails).
   *
   * Stays graph-agnostic: the caller supplies the graph adapter, export service,
   * and a `clearSelection` callback (so selected cells are not highlighted in the
   * captured thumbnail) rather than this service depending on the orchestrator.
   */
  // SEM@03c3db50d6e8e16f64af4f7a81d1e2e834b6231d: export the diagram graph as a base64-encoded SVG thumbnail string (pure)
  captureDiagramSvgThumbnail(
    graphAdapter: InfraX6GraphAdapter,
    exportService: AppExportService,
    clearSelection: () => void,
  ): Promise<string | null> {
    return new Promise(resolve => {
      if (!graphAdapter || !graphAdapter.isInitialized()) {
        this.logger.warn('Cannot capture SVG - graph not initialized');
        resolve(null);
        return;
      }

      const graph = graphAdapter.getGraph();
      if (!graph) {
        this.logger.warn('Cannot capture SVG - graph is null');
        resolve(null);
        return;
      }

      const exportPrep = exportService.prepareImageExport(graph);
      if (!exportPrep) {
        resolve(null);
        return; // prepareImageExport handles logging
      }

      // Clear selection before capturing thumbnail to avoid highlighting selected cells
      clearSelection();

      // Cast graph to access export methods added by the X6 export plugin
      const exportGraph = graph as {
        toSVG: (
          callback: (svgString: string) => void,
          options?: {
            padding?: number;
            viewBox?: string;
            preserveAspectRatio?: string;
            copyStyles?: boolean;
          },
        ) => void;
      };

      try {
        exportGraph.toSVG((svgString: string) => {
          try {
            const base64Svg = exportService.processSvg(svgString, true, exportPrep.viewBox);
            this.logger.debugComponent(
              'DfdCommandService',
              'Successfully captured and cleaned diagram SVG thumbnail',
              {
                originalLength: svgString.length,
                base64Length: base64Svg.length,
              },
            );
            resolve(base64Svg);
          } catch (error: unknown) {
            this.logger.error('Error encoding SVG to base64', error);
            resolve(null);
          }
        }, exportPrep.exportOptions);
      } catch (error: unknown) {
        this.logger.error('Error capturing SVG', error);
        resolve(null);
      }
    });
  }
}
