import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import { LoggerService } from '../../../../core/services/logger.service';
import { Theme, ThemeMetadata, ThemeFile } from './theme.interface';

/**
 * Service for loading theme files from the file system
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeLoaderService {
  private readonly themesPath = 'assets/themes';

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
  ) {
    this.logger.info('ThemeLoaderService initialized');
  }

  /**
   * Load theme index file
   * Contains metadata about available themes
   */
  loadThemeIndex(): Observable<ThemeMetadata[]> {
    return this.http.get<ThemeMetadata[]>(`${this.themesPath}/index.json`).pipe(
      tap(themes => {
        this.logger.info(`Loaded ${themes.length} theme metadata entries`);
      }),
      catchError(error => {
        this.logger.error('Error loading theme index', error);
        return of([]);
      }),
    );
  }

  /**
   * Load a theme by ID
   * @param themeId The ID of the theme to load
   */
  loadTheme(themeId: string): Observable<Theme | null> {
    return this.http.get<Theme>(`${this.themesPath}/${themeId}/theme.json`).pipe(
      tap(theme => {
        this.logger.info(`Theme '${themeId}' loaded successfully`);
      }),
      catchError(error => {
        this.logger.error(`Error loading theme '${themeId}'`, error);
        return of(null);
      }),
    );
  }

  /**
   * Load a CSS file for a theme
   * @param themeId The ID of the theme
   * @param fileName The name of the CSS file
   */
  loadCssFile(themeId: string, fileName: string): Observable<string | null> {
    return this.http
      .get(`${this.themesPath}/${themeId}/${fileName}`, { responseType: 'text' })
      .pipe(
        tap(() => {
          this.logger.info(`CSS file '${fileName}' for theme '${themeId}' loaded successfully`);
        }),
        catchError(error => {
          this.logger.error(`Error loading CSS file '${fileName}' for theme '${themeId}'`, error);
          return of(null);
        }),
      );
  }

  /**
   * Load all theme files for a theme
   * @param themeId The ID of the theme
   */
  loadAllThemeFiles(themeId: string): Observable<ThemeFile[]> {
    // First load the theme manifest to get the list of files
    return this.http.get<{ files: string[] }>(`${this.themesPath}/${themeId}/manifest.json`).pipe(
      switchMap(manifest => {
        if (!manifest.files || manifest.files.length === 0) {
          return of([] as ThemeFile[]);
        }

        // Create an array of observables for each file
        const fileObservables = manifest.files.map(file =>
          this.http.get(`${this.themesPath}/${themeId}/${file}`, { responseType: 'text' }).pipe(
            map(content => ({ path: file, content }) as ThemeFile),
            catchError(error => {
              this.logger.error(`Error loading file '${file}' for theme '${themeId}'`, error);
              return of({ path: file, content: '' } as ThemeFile);
            }),
          ),
        );

        // Use forkJoin to load all files in parallel
        return forkJoin(fileObservables);
      }),
      catchError(error => {
        this.logger.error(`Error loading manifest for theme '${themeId}'`, error);
        return of([] as ThemeFile[]);
      }),
    );
  }

  /**
   * Refresh the theme index
   * Forces a reload of the theme index file
   */
  refreshThemeIndex(): Observable<ThemeMetadata[]> {
    // Add a cache-busting parameter to force a reload
    const timestamp = new Date().getTime();
    return this.http.get<ThemeMetadata[]>(`${this.themesPath}/index.json?_=${timestamp}`).pipe(
      tap(themes => {
        this.logger.info(`Refreshed theme index, found ${themes.length} themes`);
      }),
      catchError(error => {
        this.logger.error('Error refreshing theme index', error);
        return of([]);
      }),
    );
  }

  /**
   * Validate a theme file
   * @param theme The theme to validate
   */
  validateTheme(theme: Theme): boolean {
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
}
