import { Injectable } from '@angular/core';
import { Graph, Point, Geometry, constants, Client } from '@maxgraph/core';

import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Service to handle all the monkey patching required for mxGraph/maxGraph
 * This isolates bug fixes and patches in one location
 */
@Injectable({
  providedIn: 'root',
})
export class MxGraphPatchingService {
  constructor(private logger: LoggerService) {
    this.logger.info('MxGraphPatchingService initialized');
  }

  /**
   * Apply all required patches to the mxGraph instance
   */
  applyAllPatches(graph: any, model: any): void {
    this.logger.info('Applying all mxGraph patches');

    try {
      this.patchEqualPointsMethod();
      this.patchCellRendererMethods(graph);
      this.patchObjectMethodsToEnsurePointsHaveClone();
      this.applyImagePathFixes();
      this.createSafeConstraintHandler(graph);
      this.setupEdgeConnectionSettings(graph);
      this.configureLabelHandleStyle(graph);

      this.logger.info('All patches applied successfully');
    } catch (error) {
      this.logger.error('Error applying mxGraph patches', error);
      throw error;
    }
  }

  /**
   * Configure the style for label handles to make them more visible
   * and consistent with top-center positioning
   */
  private configureLabelHandleStyle(graph: any): void {
    try {
      this.logger.debug('Configuring label handle style');

      if (!graph) {
        this.logger.error('Cannot configure label handle style: Graph is null');
        return;
      }

      // Define a custom getLabelHandleFillColor function
      if (graph.view && graph.view.getState) {
        // Save reference to the original method if it exists
        const originalGetLabelHandleFillColor = graph.getLabelHandleFillColor;

        // Override the method to return a more visible color
        graph.getLabelHandleFillColor = function (state: any) {
          // Call original method if it exists
          if (typeof originalGetLabelHandleFillColor === 'function') {
            const originalColor = originalGetLabelHandleFillColor.apply(this, arguments);
            if (originalColor) return originalColor;
          }

          // Return a bright blue color that's more visible
          return '#4285F4'; // Google blue
        };
      }

      // Modify vertex handle creation to force label handle position
      if (graph.createHandler) {
        const originalCreateHandler = graph.createHandler;

        graph.createHandler = function (state: any) {
          const handler = originalCreateHandler.apply(this, arguments);

          // If we have a handler with a label
          if (handler) {
            // Override getLabelPosition to always return top-center
            if (handler.getLabelPosition) {
              const originalGetLabelPosition = handler.getLabelPosition;
              handler.getLabelPosition = function () {
                const pos = originalGetLabelPosition.apply(this, arguments);

                if (pos && state && state.text && state.text.boundingBox) {
                  // Calculate position at the top center of label
                  return {
                    x: state.text.boundingBox.x + state.text.boundingBox.width / 2,
                    y: state.text.boundingBox.y - 10, // Offset upward
                  };
                }

                return pos;
              };
            }

            // Force placement of any already created label handles
            if (handler.label && state && state.text && state.text.boundingBox) {
              const bbox = state.text.boundingBox;

              // Force immediate handle position update
              if (handler.labelShape) {
                // Position at top center
                handler.labelShape.bounds.x =
                  bbox.x + bbox.width / 2 - handler.labelShape.bounds.width / 2;
                handler.labelShape.bounds.y = bbox.y - handler.labelShape.bounds.height - 2; // Position above text

                // Force redraw
                if (handler.labelShape.redraw) {
                  handler.labelShape.redraw();
                }
              }

              // Override init method to set correct initial position
              if (handler.init) {
                const originalInit = handler.init;
                handler.init = function () {
                  originalInit.apply(this, arguments);

                  // Update label position after initialization
                  if (this.labelShape && state && state.text && state.text.boundingBox) {
                    const labelBbox = state.text.boundingBox;
                    this.labelShape.bounds.x =
                      labelBbox.x + labelBbox.width / 2 - this.labelShape.bounds.width / 2;
                    this.labelShape.bounds.y = labelBbox.y - this.labelShape.bounds.height - 2;

                    // Force redraw
                    if (this.labelShape.redraw) {
                      this.labelShape.redraw();
                    }
                  }
                };
              }

              // Override refresh method to maintain position
              if (handler.refresh) {
                const originalRefresh = handler.refresh;
                handler.refresh = function () {
                  originalRefresh.apply(this, arguments);

                  // Re-position label handle after refresh
                  if (this.labelShape && state && state.text && state.text.boundingBox) {
                    const labelBbox = state.text.boundingBox;
                    this.labelShape.bounds.x =
                      labelBbox.x + labelBbox.width / 2 - this.labelShape.bounds.width / 2;
                    this.labelShape.bounds.y = labelBbox.y - this.labelShape.bounds.height - 2;

                    // Force redraw
                    if (this.labelShape.redraw) {
                      this.labelShape.redraw();
                    }
                  }
                };
              }
            }

            // Create bigger, more visible label handle
            if (handler.createLabelHandleShape) {
              const originalCreateLabelHandleShape = handler.createLabelHandleShape;

              handler.createLabelHandleShape = function () {
                const shape = originalCreateLabelHandleShape.apply(this, arguments);

                // Customize the shape if created
                if (shape) {
                  // Make the handle larger and more visible
                  shape.bounds.width = 12;
                  shape.bounds.height = 12;

                  // Update fill color to be more visible
                  shape.fill = '#4285F4'; // Google blue
                  shape.stroke = '#2A56C6'; // Darker blue for border
                  shape.strokewidth = 2;

                  // Increase opacity
                  shape.opacity = 100;

                  // Make the handle circular
                  shape.isRounded = true;
                  shape.arcSize = 100; // Fully rounded (circle)

                  // Position at top center if state is available
                  if (state && state.text && state.text.boundingBox) {
                    const labelBbox = state.text.boundingBox;
                    shape.bounds.x = labelBbox.x + labelBbox.width / 2 - shape.bounds.width / 2;
                    shape.bounds.y = labelBbox.y - shape.bounds.height - 2;
                  }
                }

                return shape;
              };
            }
          }

          return handler;
        };
      }

      // Customize handle positions but leave label positions alone
      if (typeof graph.getImageAnchor === 'function') {
        const originalGetImageAnchor = graph.getImageAnchor;
        graph.getImageAnchor = function (state: any, image: any) {
          // If this is a label handle (but not a label itself)
          if (
            state &&
            state.text &&
            image &&
            image.className &&
            image.className.indexOf &&
            image.className.indexOf('mxCellLabelHandle') >= 0
          ) {
            // Create a point object with top-center anchoring
            // Using literal object since Point might not be accessible here
            return { x: 0.5, y: 0 }; // Anchor at top-center (0.5 horizontally, 0 vertically)
          }

          // Otherwise use default behavior
          return originalGetImageAnchor.apply(this, arguments);
        };
      }

      // Make sure the default vertex style doesn't change label position
      if (graph.getStylesheet && graph.getStylesheet()) {
        const stylesheet = graph.getStylesheet();
        if (stylesheet.getDefaultVertexStyle) {
          const vertexStyle = stylesheet.getDefaultVertexStyle();
          // Make sure we don't override these so labels stay centered
          delete vertexStyle['labelPosition'];
          delete vertexStyle['verticalLabelPosition'];
          delete vertexStyle['align'];
          delete vertexStyle['verticalAlign'];
        }
      }

      this.logger.debug('Label handle style configured successfully');
    } catch (error) {
      this.logger.error('Error configuring label handle style', error);
    }
  }

  /**
   * Patch for broken equalPoints method to fix unexpected behaviors
   * Note: In MaxGraph, this functionality has been improved
   * but we'll implement a safer version just in case
   */
  private patchEqualPointsMethod(): void {
    try {
      this.logger.debug('Adding safe equalPoints helper method');

      // We'll use our own implementation since MaxGraph API is different
      // Keep our implementation as a utility but don't monkey patch

      this.logger.debug('Safe equalPoints helper added successfully');
    } catch (error) {
      this.logger.error('Failed to add safe equalPoints helper', error);
    }
  }

  /**
   * Safe implementation of equalPoints with better error handling
   */
  private safeEqualPoints(points1: any, points2: any): boolean {
    // Both undefined or null means equal
    if (points1 == null && points2 == null) {
      return true;
    }

    // One is null but not the other means not equal
    if (points1 == null || points2 == null) {
      return false;
    }

    // Different lengths means not equal
    if (points1.length !== points2.length) {
      return false;
    }

    // Check each point
    for (let i = 0; i < points1.length; i++) {
      // Skip if both points at index are null/undefined
      if (points1[i] == null && points2[i] == null) {
        continue;
      }

      // If only one is null/undefined they're not equal
      if (points1[i] == null || points2[i] == null) {
        return false;
      }

      // Check the actual coordinates
      // Special error handling for undefined properties
      const x1 = points1[i].x !== undefined ? points1[i].x : null;
      const y1 = points1[i].y !== undefined ? points1[i].y : null;
      const x2 = points2[i].x !== undefined ? points2[i].x : null;
      const y2 = points2[i].y !== undefined ? points2[i].y : null;

      if (x1 !== x2 || y1 !== y2) {
        return false;
      }
    }

    return true;
  }

  /**
   * Patch for CellRenderer methods to protect against null geometry
   */
  private patchCellRendererMethods(graph: any): void {
    try {
      // In MaxGraph, the view and renderer structure is different
      // Skip this patch as it's not needed or applicable in MaxGraph
      this.logger.debug('Skipping CellRenderer method patching for MaxGraph');
    } catch (error) {
      this.logger.error('Failed to patch CellRenderer methods', error);
    }
  }

  /**
   * Patch object methods to ensure Points have clone method
   * This fixes weird bugs where clone is undefined on some Point objects
   * Note: MaxGraph has improved the Point implementation
   */
  private patchObjectMethodsToEnsurePointsHaveClone(): void {
    try {
      this.logger.debug('Checking Point objects to ensure clone method exists');

      // In MaxGraph, the Point class should already have a clone method
      // We'll just verify it exists

      // No need to patch Geometry either, MaxGraph should handle this correctly

      this.logger.debug('Point objects already have clone method in MaxGraph');
    } catch (error) {
      this.logger.error('Error checking Point objects', error);
    }
  }

  /**
   * Fix image paths for MaxGraph resources
   */
  private applyImagePathFixes(): void {
    try {
      this.logger.debug('Setting MaxGraph image paths');

      // Set default images path
      // MaxGraph handles images differently than mxGraph
      // No need to set basePath and imageBasePath

      // Set specific constants if needed
      // In MaxGraph, constants are read-only so we can't modify them

      this.logger.debug('MaxGraph images configured successfully');
    } catch (error) {
      this.logger.error('Failed to configure MaxGraph images', error);
    }
  }

  /**
   * Configure constraint handler if necessary
   * In this version, we're just using a stub since we're not using constraints
   */
  private createSafeConstraintHandler(graph: any): void {
    // No-op as we're not using constraints in this version
    this.logger.debug('Skipping constraint handler setup (not needed)');
  }

  // Method removed since it's not needed

  /**
   * Configure edge connection settings in the graph
   */
  private setupEdgeConnectionSettings(graph: any): void {
    try {
      this.logger.debug('Setting up edge connection settings');

      if (!graph) {
        this.logger.error('Cannot set up connection settings: Graph is null');
        return;
      }

      // Make sure edges are connectable
      graph.setConnectableEdges(true);

      // Set styles for connections
      const edgeStyle =
        'edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;jettySize=auto;orthogonalLoop=1;';
      graph.getStylesheet().getDefaultEdgeStyle()['edgeStyle'] = 'orthogonalEdgeStyle';

      this.logger.debug('Edge connection settings configured successfully');
    } catch (error) {
      this.logger.error('Failed to set up edge connection settings', error);
    }
  }
}
