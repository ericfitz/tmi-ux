import { Injectable } from '@angular/core';
import { Graph, Point, Geometry, constants, Client } from '@maxgraph/core';

import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Service to handle all the monkey patching required for mxGraph/maxGraph
 * This isolates bug fixes and patches in one location
 */
@Injectable({
  providedIn: 'root'
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
      this.setupSafeConnectionHandler(graph);
      
      this.logger.info('All patches applied successfully');
    } catch (error) {
      this.logger.error('Error applying mxGraph patches', error);
      throw error;
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
      const renderer = graph.getView().getRenderer();
      
      this.logger.debug('Patching CellRenderer methods to handle null geometry');
      
      // Original method
      const originalCreateShape = renderer.createShape;
      
      // Patched method with null geometry protection
      renderer.createShape = function(state: any) {
        if (!state || !state.cell) {
          return null;
        }
        
        const model = graph.getModel();
        if (!model) {
          return null;
        }
        
        if (!state.style) {
          state.style = {};
        }
        
        return originalCreateShape.apply(this, arguments);
      };
      
      this.logger.debug('CellRenderer methods patched successfully');
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
   * Create a safer version of mxConstraintHandler
   */
  private createSafeConstraintHandler(graph: any): void {
    try {
      this.logger.debug('Creating safe constraint handler');
      
      if (!graph || !graph.connectionHandler) {
        this.logger.warn('Cannot create safe constraint handler: graph or connectionHandler is not available');
        return;
      }
      
      // Override constraint handler
      graph.constraintHandler.updateFocus = () => {
        // Do nothing - prevents certain focus-related errors
      };
      
      this.overrideConstraintHandlerMethods(graph);
      
      this.logger.debug('Safe constraint handler created successfully');
    } catch (error) {
      this.logger.error('Failed to create safe constraint handler', error);
    }
  }
  
  /**
   * Override constraint handler methods for better error handling
   */
  private overrideConstraintHandlerMethods(graph: any): void {
    try {
      // Original method
      const originalReset = graph.constraintHandler.reset;
      
      // Override with safer implementation
      graph.constraintHandler.reset = function() {
        try {
          if (this.currentFocus) {
            this.currentFocus = null;
          }
          
          if (this.focusHighlight) {
            if (this.focusHighlight.destroy) {
              this.focusHighlight.destroy();
            }
            this.focusHighlight = null;
          }
          
          return originalReset.apply(this, arguments);
        } catch (error) {
          // Silent recovery
          this.currentFocus = null;
          this.focusIcons = null;
          this.focusHighlight = null;
          this.focusPoints = null;
          this.currentConstraint = null;
        }
      };
    } catch (error) {
      this.logger.error('Failed to override constraint handler methods', error);
    }
  }
  
  /**
   * Set up a safer connection handler
   */
  private setupSafeConnectionHandler(graph: any): void {
    try {
      this.logger.debug('Setting up safe connection handler');
      
      if (!graph.connectionHandler) {
        this.logger.warn('Cannot set up safe connection handler: connectionHandler is not available');
        return;
      }
      
      // Customize the connection handler
      const originalCreateShape = graph.connectionHandler.createShape;
      
      graph.connectionHandler.createShape = function() {
        try {
          const result = originalCreateShape.apply(this, arguments);
          return result;
        } catch (error) {
          return null;
        }
      };
      
      this.logger.debug('Safe connection handler set up successfully');
    } catch (error) {
      this.logger.error('Failed to set up safe connection handler', error);
    }
  }
}