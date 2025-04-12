import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';

import { LoggerService } from '../../../../core/services/logger.service';
import { DiagramTheme, ThemeInfo } from '../../models/diagram-theme.model';

@Injectable({
  providedIn: 'root',
})
export class DiagramThemeService {
  // Theme tracking
  private _themeLoaded = new BehaviorSubject<boolean>(false);
  private _currentTheme: DiagramTheme | null = null;
  private _currentThemeId: string | null = null;

  // Reference to graph instance - will be set by DiagramRendererService
  private graph: any = null;

  // Public observables
  public themeLoaded$ = this._themeLoaded.asObservable();

  constructor(
    private logger: LoggerService,
    private http: HttpClient,
  ) {
    this.logger.info('DiagramThemeService initialized');
  }

  /**
   * Set the graph instance to be themed
   */
  setGraph(graph: any): void {
    this.graph = graph;
  }

  /**
   * Get available themes from the registry
   */
  getAvailableThemes(): Observable<ThemeInfo[]> {
    return this.http.get<ThemeInfo[]>('/assets/themes/theme-registry.json');
  }

  /**
   * Get the currently loaded theme ID
   */
  getCurrentThemeId(): string | null {
    return this._currentThemeId;
  }

  /**
   * Load a theme by ID
   */
  loadTheme(themeId: string): Promise<DiagramTheme> {
    this.logger.info(`Loading theme: ${themeId}`);

    if (!themeId) {
      return Promise.reject(new Error('Theme ID is required'));
    }

    return new Promise<DiagramTheme>((resolve, reject) => {
      this.http.get<DiagramTheme>(`/assets/themes/${themeId}.json`).subscribe({
        next: theme => {
          this.logger.debug(`Theme loaded successfully: ${themeId}`, theme);
          this._currentTheme = theme;
          this._currentThemeId = themeId;
          this._themeLoaded.next(true);
          resolve(theme);
        },
        error: error => {
          this.logger.error(`Failed to load theme: ${themeId}`, error);
          reject(new Error(`Failed to load theme: ${error}`));
        },
      });
    });
  }

  /**
   * Switch to a theme by ID
   */
  async switchTheme(themeId: string): Promise<void> {
    if (!this.graph) {
      this.logger.error('Cannot apply theme: Graph instance not set');
      throw new Error('Graph instance must be set before switching themes');
    }

    try {
      const theme = await this.loadTheme(themeId);
      this.applyTheme(theme);
    } catch (error) {
      this.logger.error(`Failed to switch theme: ${themeId}`, error);
      throw error;
    }
  }

  /**
   * Configure grid settings based on theme
   */
  configureGrid(theme: DiagramTheme | null = null): void {
    if (!this.graph) {
      this.logger.error('Cannot configure grid: Graph instance not set');
      return;
    }

    const themeToUse = theme || this._currentTheme;
    if (!themeToUse) {
      this.logger.warn('No theme available for grid configuration');
      return;
    }

    try {
      // Set grid size and enable/disable based on theme
      if (themeToUse.gridSize) {
        this.graph.gridSize = themeToUse.gridSize;
      }

      this.graph.setGridEnabled(themeToUse.gridEnabled);

      this.logger.debug(
        `Grid configured: size=${themeToUse.gridSize}, enabled=${themeToUse.gridEnabled}`,
      );
    } catch (error) {
      this.logger.error('Error configuring grid', error);
    }
  }

  /**
   * Toggle grid visibility
   */
  toggleGridVisibility(): boolean {
    if (!this.graph) {
      this.logger.error('Cannot toggle grid: Graph instance not set');
      return false;
    }

    try {
      const currentState = this.graph.isGridEnabled();
      this.graph.setGridEnabled(!currentState);
      this.logger.debug(`Grid visibility toggled: ${!currentState}`);
      return !currentState;
    } catch (error) {
      this.logger.error('Error toggling grid visibility', error);
      return false;
    }
  }

  /**
   * Check if grid is enabled
   */
  isGridEnabled(): boolean {
    if (!this.graph) {
      return false;
    }

    return this.graph.isGridEnabled();
  }

  /**
   * Apply the loaded theme to the graph
   */
  private applyTheme(theme: DiagramTheme): void {
    if (!this.graph) {
      this.logger.error('Cannot apply theme: Graph instance not set');
      return;
    }

    try {
      this.logger.debug('Applying theme to graph', theme);

      const stylesheet = this.graph.getStylesheet();

      // Apply default vertex style
      const defaultVertexStyle = stylesheet.getDefaultVertexStyle();
      Object.assign(defaultVertexStyle, theme.defaultVertexStyle);

      // Apply default edge style
      const defaultEdgeStyle = stylesheet.getDefaultEdgeStyle();
      Object.assign(defaultEdgeStyle, theme.defaultEdgeStyle);

      // Apply custom styles
      for (const [styleName, styleDefinition] of Object.entries(theme.styles)) {
        stylesheet.putCellStyle(styleName, styleDefinition);
      }

      // Apply other theme settings
      if (this.graph.container && theme.backgroundColor) {
        this.graph.container.style.backgroundColor = theme.backgroundColor;
      }

      // Update marker colors if available
      // Note: In MaxGraph, constants are read-only so we can't modify them directly
      // We'll use the theme values in our own code instead
      if (theme.marker) {
        this.logger.debug('Using theme marker colors for visualization');
        // MaxGraph has different constants API, so we'll store these values locally
        // and use them in our visualization code
      }

      // Force refresh
      this.graph.refresh();

      // Emit theme loaded event
      this._themeLoaded.next(true);

      this.logger.info('Theme applied successfully');
    } catch (error) {
      this.logger.error('Error applying theme', error);
      throw error;
    }
  }
}
