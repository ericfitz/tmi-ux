import { Injectable } from '@angular/core';
import { HighlighterConfig } from '../models/highlighter-config.interface';

/**
 * Service for managing highlighters in the DFD component
 */
@Injectable({
  providedIn: 'root',
})
export class DfdHighlighterService {
  /**
   * Creates the magnet availability highlighter configuration
   * @returns The highlighter configuration object
   */
  createMagnetAvailabilityHighlighter(): HighlighterConfig {
    return {
      name: 'stroke',
      args: {
        attrs: {
          fill: '#fff',
          stroke: '#47C769',
        },
      },
    };
  }

  /**
   * Creates the node highlighter configuration for hover effects
   * @returns The highlighter configuration object
   */
  createNodeHighlighter(): HighlighterConfig {
    return {
      name: 'stroke',
      args: {
        attrs: {
          // No fill - transparent
          stroke: '#47C769', // Green stroke matching port highlighter
        },
      },
    };
  }

  /**
   * Creates the edge highlighter configuration for hover effects
   * @returns The highlighter configuration object
   */
  createEdgeHighlighter(): HighlighterConfig {
    return {
      name: 'stroke',
      args: {
        attrs: {
          stroke: '#47C769', // Green stroke matching port highlighter
          strokeWidth: 3, // Make the stroke wider for emphasis
        },
      },
    };
  }

  /**
   * Creates the node selection highlighter configuration
   * @returns The highlighter configuration object
   */
  createSelectionHighlighter(): HighlighterConfig {
    return {
      name: 'stroke',
      args: {
        attrs: {
          stroke: '#47C769',
          strokeWidth: 2,
        },
      },
    };
  }
}
