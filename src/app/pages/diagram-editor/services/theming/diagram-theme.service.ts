import { Injectable } from '@angular/core';
import { LoggerService } from '../../../../core/services/logger.service';
import { BehaviorSubject } from '../../../../core/rxjs-imports';
import { constants } from '@maxgraph/core';

/**
 * Service for managing diagram themes and stylesheets
 * Based on maxGraph styling patterns
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramThemeService {
  // Current theme name
  private _currentTheme = 'tmi-default';

  // Observable for theme changes
  private _themeChanged = new BehaviorSubject<string>(this._currentTheme);
  public themeChanged$ = this._themeChanged.asObservable();

  // Store registered stylesheets
  private _stylesheets: Record<string, any> = {};

  constructor(private logger: LoggerService) {
    this.logger.info('DiagramThemeService initialized');
    this.initializeDefaultStylesheets();
  }

  /**
   * Initialize default stylesheets
   */
  private initializeDefaultStylesheets(): void {
    // Register the default TMI stylesheet
    this.registerStylesheet('tmi-default', {
      // Default vertex style
      defaultVertex: {
        shape: 'rectangle',
        strokeColor: '#666666',
        strokeWidth: 1,
        fillColor: '#ffffff',
        fontColor: '#333333',
        fontSize: 12,
        fontFamily: 'Arial',
        align: 'center',
        verticalAlign: 'middle',
        rounded: true,
        shadow: false,
      },

      // Default edge style
      defaultEdge: {
        shape: 'connector',
        strokeColor: '#666666',
        strokeWidth: 1,
        fontColor: '#333333',
        fontSize: 10,
        fontFamily: 'Arial',
        align: 'center',
        verticalAlign: 'middle',
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        endArrow: 'classic',
      },

      // Process shape style
      process: {
        shape: 'rectangle',
        strokeColor: '#0D47A1',
        fillColor: '#2196F3',
        fontColor: '#ffffff',
        rounded: true,
      },

      // Store shape style (using cylinder)
      cylinder: {
        shape: 'cylinder',
        fillColor: '#ffffff',
        strokeColor: '#000000',
        strokeWidth: 2,
        fontColor: '#000000',
        gradientColor: '#aaaaaa',
        gradientDirection: 'north',
        cylinder3d: true,
        shadow: true,
      },

      // Actor shape style
      actor: {
        shape: 'actor',
        strokeColor: '#4A148C',
        fillColor: '#9C27B0',
        fontColor: '#ffffff',
      },

      // Flow edge style
      flow: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#666666',
        endArrow: 'classic',
      },

      // Association edge style
      association: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#2196F3',
        endArrow: 'none',
        dashed: true,
      },

      // Dependency edge style
      dependency: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#F44336',
        endArrow: 'open',
        dashed: true,
      },

      // Edge style
      edge: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#616161',
        endArrow: 'classic',
      },
    });

    // Register a dark theme
    this.registerStylesheet('tmi-dark', {
      // Default vertex style
      defaultVertex: {
        shape: 'rectangle',
        strokeColor: '#BBBBBB',
        strokeWidth: 1,
        fillColor: '#333333',
        fontColor: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Arial',
        align: 'center',
        verticalAlign: 'middle',
        rounded: true,
        shadow: true,
        shadowColor: '#000000',
      },

      // Default edge style
      defaultEdge: {
        shape: 'connector',
        strokeColor: '#AAAAAA',
        strokeWidth: 1,
        fontColor: '#FFFFFF',
        fontSize: 10,
        fontFamily: 'Arial',
        align: 'center',
        verticalAlign: 'middle',
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        endArrow: 'classic',
      },

      // Process shape style
      process: {
        shape: 'rectangle',
        strokeColor: '#1565C0',
        fillColor: '#0D47A1',
        fontColor: '#FFFFFF',
        rounded: true,
      },

      // Store shape style (using cylinder)
      cylinder: {
        shape: 'cylinder',
        fillColor: '#333333',
        strokeColor: '#666666',
        strokeWidth: 2,
        fontColor: '#FFFFFF',
        gradientColor: '#222222',
        gradientDirection: 'north',
        cylinder3d: true,
        shadow: true,
      },

      // Actor shape style
      actor: {
        shape: 'actor',
        strokeColor: '#6A1B9A',
        fillColor: '#4A148C',
        fontColor: '#FFFFFF',
      },

      // Flow edge style
      flow: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#AAAAAA',
        endArrow: 'classic',
      },

      // Association edge style
      association: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#1565C0',
        endArrow: 'none',
        dashed: true,
      },

      // Dependency edge style
      dependency: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#C62828',
        endArrow: 'open',
        dashed: true,
      },

      // Edge style
      edge: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#9E9E9E',
        endArrow: 'classic',
      },
    });

    // Register a colorful theme
    this.registerStylesheet('tmi-colorful', {
      // Default vertex style
      defaultVertex: {
        shape: 'rectangle',
        strokeColor: '#FF6D00',
        strokeWidth: 2,
        fillColor: '#FFECB3',
        fontColor: '#5D4037',
        fontSize: 12,
        fontFamily: 'Arial',
        align: 'center',
        verticalAlign: 'middle',
        rounded: true,
        shadow: true,
        shadowColor: '#FFA000',
      },

      // Default edge style
      defaultEdge: {
        shape: 'connector',
        strokeColor: '#FF6D00',
        strokeWidth: 2,
        fontColor: '#5D4037',
        fontSize: 10,
        fontFamily: 'Arial',
        align: 'center',
        verticalAlign: 'middle',
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        endArrow: 'classic',
      },

      // Process shape style
      process: {
        shape: 'rectangle',
        strokeColor: '#D81B60',
        fillColor: '#F8BBD0',
        fontColor: '#880E4F',
        rounded: true,
      },

      // Store shape style (using cylinder)
      cylinder: {
        shape: 'cylinder',
        fillColor: '#E0F7FA',
        strokeColor: '#00ACC1',
        strokeWidth: 2,
        fontColor: '#006064',
        gradientColor: '#B2EBF2',
        gradientDirection: 'north',
        cylinder3d: true,
        shadow: true,
      },

      // Actor shape style
      actor: {
        shape: 'actor',
        strokeColor: '#5E35B1',
        fillColor: '#D1C4E9',
        fontColor: '#311B92',
      },

      // Flow edge style
      flow: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#FF6D00',
        endArrow: 'classic',
      },

      // Association edge style
      association: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#1E88E5',
        endArrow: 'none',
        dashed: true,
      },

      // Dependency edge style
      dependency: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#D32F2F',
        endArrow: 'open',
        dashed: true,
      },

      // Edge style
      edge: {
        edgeStyle: 'orthogonalEdgeStyle',
        rounded: true,
        strokeColor: '#FF6D00',
        endArrow: 'classic',
      },
    });
  }

  /**
   * Register a new stylesheet
   * @param name The name of the stylesheet
   * @param styles The styles to register
   */
  registerStylesheet(name: string, styles: Record<string, any>): void {
    this._stylesheets[name] = styles;
    this.logger.debug(`Registered stylesheet: ${name}`);
  }

  /**
   * Get a stylesheet by name
   * @param name The name of the stylesheet
   * @returns The stylesheet or null if not found
   */
  getStylesheet(name: string): Record<string, any> | null {
    return this._stylesheets[name] || null;
  }

  /**
   * Get the current stylesheet
   * @returns The current stylesheet
   */
  getCurrentStylesheet(): Record<string, any> {
    return this._stylesheets[this._currentTheme] || this._stylesheets['tmi-default'];
  }

  /**
   * Set the current theme
   * @param name The name of the theme to set
   */
  setCurrentTheme(name: string): void {
    if (this._stylesheets[name]) {
      this._currentTheme = name;
      this._themeChanged.next(name);
      this.logger.info(`Set current theme to: ${name}`);
    } else {
      this.logger.warn(`Theme not found: ${name}, using default`);
      this._currentTheme = 'tmi-default';
      this._themeChanged.next('tmi-default');
    }
  }

  /**
   * Get the current theme name
   * @returns The current theme name
   */
  getCurrentTheme(): string {
    return this._currentTheme;
  }

  /**
   * Get all available theme names
   * @returns Array of theme names
   */
  getAvailableThemes(): string[] {
    return Object.keys(this._stylesheets);
  }

  /**
   * Apply the current stylesheet to a graph
   * @param graph The graph to apply the stylesheet to
   */
  applyStylesheetToGraph(graph: any): void {
    if (!graph) {
      this.logger.error('Cannot apply stylesheet: Graph not provided');
      return;
    }

    try {
      const stylesheet = this.getCurrentStylesheet();
      if (!stylesheet) {
        this.logger.error('Cannot apply stylesheet: No stylesheet found');
        return;
      }

      // Clear existing styles
      const graphStylesheet = graph.getStylesheet();

      // Apply default vertex style
      if (stylesheet['defaultVertex']) {
        graphStylesheet.putDefaultVertexStyle(stylesheet['defaultVertex']);
      }

      // Apply default edge style
      if (stylesheet['defaultEdge']) {
        graphStylesheet.putDefaultEdgeStyle(stylesheet['defaultEdge']);
      }

      // Register named styles
      for (const [name, style] of Object.entries(stylesheet)) {
        if (name !== 'defaultVertex' && name !== 'defaultEdge') {
          graphStylesheet.putCellStyle(name, style);
        }
      }

      // Enable dynamic style updates
      graph.getView().updateStyle = true;

      // Refresh the view to apply changes to all cells
      graph.refresh();

      this.logger.debug(`Applied stylesheet to graph: ${this._currentTheme}`);
    } catch (error) {
      this.logger.error('Error applying stylesheet to graph', error);
    }
  }
}
