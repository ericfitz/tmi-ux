import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { Graph } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { Theme, ThemeMetadata, NodeShapeDefinition, EdgeStyleDefinition } from './theme.interface';

/**
 * Service for managing diagram editor themes
 * Handles theme loading, validation, and application
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly themesPath = 'assets/themes';
  private readonly defaultThemeId = 'tmi';

  private availableThemesSubject = new BehaviorSubject<ThemeMetadata[]>([]);
  private currentThemeSubject = new BehaviorSubject<Theme | null>(null);

  readonly availableThemes$ = this.availableThemesSubject.asObservable();
  readonly currentTheme$ = this.currentThemeSubject.asObservable();

  private loadedThemes: Map<string, Theme> = new Map();
  private styleElement: HTMLStyleElement | null = null;

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
  ) {
    this.logger.info('ThemeService initialized');
    this.initializeStyleElement();
  }

  /**
   * Initialize the style element for theme CSS
   */
  private initializeStyleElement(): void {
    this.styleElement = document.createElement('style');
    this.styleElement.id = 'diagram-editor-theme';
    document.head.appendChild(this.styleElement);
  }

  /**
   * Initialize the theme service
   * Discovers available themes and loads the default theme
   */
  initialize(): Observable<boolean> {
    return this.discoverThemes().pipe(
      switchMap(() => this.loadTheme(this.defaultThemeId)),
      map(success => {
        if (success) {
          this.logger.info(`Default theme '${this.defaultThemeId}' loaded successfully`);
          // Register node shapes after theme is loaded
          this.registerNodeShapes();
        } else {
          this.logger.error(`Failed to load default theme '${this.defaultThemeId}'`);
        }
        return success;
      }),
      catchError(error => {
        this.logger.error('Error initializing theme service', error);
        return of(false);
      }),
    );
  }

  /**
   * Discover available themes
   * Reads the themes directory and loads theme metadata
   */
  discoverThemes(): Observable<ThemeMetadata[]> {
    return this.http.get<ThemeMetadata[]>(`${this.themesPath}/index.json`).pipe(
      tap(themes => {
        this.availableThemesSubject.next(themes);
        this.logger.info(`Discovered ${themes.length} themes`);
      }),
      catchError(error => {
        this.logger.error('Error discovering themes', error);
        // Return empty array if there's an error
        this.availableThemesSubject.next([]);
        return of([]);
      }),
    );
  }

  /**
   * Load a theme by ID
   * @param themeId The ID of the theme to load
   */
  loadTheme(themeId: string): Observable<boolean> {
    // Check if theme is already loaded
    if (this.loadedThemes.has(themeId)) {
      const theme = this.loadedThemes.get(themeId)!;
      this.applyTheme(theme);
      return of(true);
    }

    // Load theme from file
    return this.http.get<Theme>(`${this.themesPath}/${themeId}/theme.json`).pipe(
      tap(theme => {
        if (this.validateTheme(theme)) {
          this.loadedThemes.set(themeId, theme);
          this.applyTheme(theme);
        } else {
          throw new Error(`Invalid theme: ${themeId}`);
        }
      }),
      map(() => true),
      catchError(error => {
        this.logger.error(`Error loading theme '${themeId}'`, error);
        return of(false);
      }),
    );
  }

  /**
   * Validate a theme
   * @param theme The theme to validate
   */
  private validateTheme(theme: Theme): boolean {
    try {
      // Check required fields
      if (!theme.metadata || !theme.metadata.id || !theme.metadata.name) {
        this.logger.error('Theme validation failed: Missing metadata');
        return false;
      }

      if (!theme.nodeShapes || Object.keys(theme.nodeShapes).length === 0) {
        this.logger.error('Theme validation failed: No node shapes defined');
        return false;
      }

      if (!theme.edgeStyle) {
        this.logger.error('Theme validation failed: No edge style defined');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error validating theme', error);
      return false;
    }
  }

  /**
   * Apply a theme to the diagram editor
   * @param theme The theme to apply
   */
  private applyTheme(theme: Theme): void {
    try {
      this.currentThemeSubject.next(theme);
      this.applyCssStyles(theme);
      this.logger.info(`Theme '${theme.metadata.name}' applied successfully`);
    } catch (error) {
      this.logger.error('Error applying theme', error);
    }
  }

  /**
   * Apply CSS styles from the theme
   * @param theme The theme containing CSS styles
   */
  private applyCssStyles(theme: Theme): void {
    if (!this.styleElement) {
      this.initializeStyleElement();
    }

    if (!theme.cssStyles || theme.cssStyles.length === 0) {
      return;
    }

    // Build CSS string
    const cssString = theme.cssStyles
      .map(style => {
        const properties = Object.entries(style.properties)
          .map(([key, value]) => `${key}: ${value};`)
          .join(' ');

        return `${style.selector} { ${properties} }`;
      })
      .join('\n');

    // Apply CSS
    if (this.styleElement) {
      this.styleElement.textContent = cssString;
    }
  }

  /**
   * Register node shapes from the current theme
   */
  registerNodeShapes(): void {
    const theme = this.currentThemeSubject.value;
    if (!theme) {
      this.logger.warn('Cannot register node shapes: No theme loaded');
      return;
    }

    try {
      // Register each node shape
      Object.entries(theme.nodeShapes).forEach(([type, shape]) => {
        Graph.registerNode(type, {
          width: shape.width,
          height: shape.height,
          markup: shape.markup,
          attrs: shape.attrs,
          zIndex: shape.zIndex,
        });
      });

      this.logger.info('Node shapes registered successfully');
    } catch (error) {
      this.logger.error('Error registering node shapes', error);
    }
  }

  /**
   * Get edge style from the current theme
   */
  getEdgeStyle(): EdgeStyleDefinition | null {
    const theme = this.currentThemeSubject.value;
    if (!theme) {
      return null;
    }

    return theme.edgeStyle;
  }

  /**
   * Get node shape definition from the current theme
   * @param type The type of node shape
   */
  getNodeShape(type: string): NodeShapeDefinition | null {
    const theme = this.currentThemeSubject.value;
    if (!theme || !theme.nodeShapes[type]) {
      return null;
    }

    return theme.nodeShapes[type];
  }

  /**
   * Get graph options from the current theme
   */
  getGraphOptions(): Record<string, any> | null {
    const theme = this.currentThemeSubject.value;
    if (!theme || !theme.graphOptions) {
      return null;
    }

    return theme.graphOptions;
  }

  /**
   * Get the current theme
   */
  getCurrentTheme(): Theme | null {
    return this.currentThemeSubject.value;
  }

  /**
   * Get available themes
   */
  getAvailableThemes(): ThemeMetadata[] {
    return this.availableThemesSubject.value;
  }
}
