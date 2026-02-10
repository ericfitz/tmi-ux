// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, describe, it } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { ITheme } from 'survey-core';
import { SurveyThemeService } from './survey-theme.service';
import { ThemeConfig } from '@app/core/services/theme.service';

describe('SurveyThemeService', () => {
  let service: SurveyThemeService;
  let themeSubject: BehaviorSubject<ThemeConfig>;
  let mockThemeService: {
    observeTheme: ReturnType<typeof vi.fn>;
    getCurrentTheme: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    themeSubject = new BehaviorSubject<ThemeConfig>({
      colorScheme: 'light',
      palette: 'normal',
    });

    mockThemeService = {
      observeTheme: vi.fn().mockReturnValue(themeSubject.asObservable()),
      getCurrentTheme: vi.fn().mockReturnValue({
        colorScheme: 'light',
        palette: 'normal',
      }),
    };

    service = new SurveyThemeService(mockThemeService as any);
  });

  describe('getTheme', () => {
    it('should return a theme with borderless name and panelless for all configs', () => {
      const configs: ThemeConfig[] = [
        { colorScheme: 'light', palette: 'normal' },
        { colorScheme: 'light', palette: 'colorblind' },
        { colorScheme: 'dark', palette: 'normal' },
        { colorScheme: 'dark', palette: 'colorblind' },
      ];

      for (const config of configs) {
        const theme = service.getTheme(config);
        expect(theme.themeName).toBe('borderless');
        expect(theme.isPanelless).toBe(true);
      }
    });

    it('should return light colorPalette for light themes', () => {
      const lightNormal = service.getTheme({
        colorScheme: 'light',
        palette: 'normal',
      });
      const lightColorblind = service.getTheme({
        colorScheme: 'light',
        palette: 'colorblind',
      });

      expect(lightNormal.colorPalette).toBe('light');
      expect(lightColorblind.colorPalette).toBe('light');
    });

    it('should return dark colorPalette for dark themes', () => {
      const darkNormal = service.getTheme({
        colorScheme: 'dark',
        palette: 'normal',
      });
      const darkColorblind = service.getTheme({
        colorScheme: 'dark',
        palette: 'colorblind',
      });

      expect(darkNormal.colorPalette).toBe('dark');
      expect(darkColorblind.colorPalette).toBe('dark');
    });

    it('should include Roboto Condensed font family in all themes', () => {
      const configs: ThemeConfig[] = [
        { colorScheme: 'light', palette: 'normal' },
        { colorScheme: 'light', palette: 'colorblind' },
        { colorScheme: 'dark', palette: 'normal' },
        { colorScheme: 'dark', palette: 'colorblind' },
      ];

      for (const config of configs) {
        const theme = service.getTheme(config);
        expect(theme.cssVariables?.['--sjs-font-family']).toContain('Roboto Condensed');
      }
    });

    it('should set 8px corner radius in all themes', () => {
      const configs: ThemeConfig[] = [
        { colorScheme: 'light', palette: 'normal' },
        { colorScheme: 'light', palette: 'colorblind' },
        { colorScheme: 'dark', palette: 'normal' },
        { colorScheme: 'dark', palette: 'colorblind' },
      ];

      for (const config of configs) {
        const theme = service.getTheme(config);
        expect(theme.cssVariables?.['--sjs-corner-radius']).toBe('8px');
      }
    });

    it('should use Material Blue primary for light + normal', () => {
      const theme = service.getTheme({
        colorScheme: 'light',
        palette: 'normal',
      });
      // #1976d2 = rgba(25, 118, 210, 1)
      expect(theme.cssVariables?.['--sjs-primary-backcolor']).toBe('rgba(25, 118, 210, 1)');
    });

    it('should use Okabe-Ito Blue primary for light + colorblind', () => {
      const theme = service.getTheme({
        colorScheme: 'light',
        palette: 'colorblind',
      });
      // #0072B2 = rgba(0, 114, 178, 1)
      expect(theme.cssVariables?.['--sjs-primary-backcolor']).toBe('rgba(0, 114, 178, 1)');
    });

    it('should use lightened primary for dark + normal', () => {
      const theme = service.getTheme({
        colorScheme: 'dark',
        palette: 'normal',
      });
      // Material Blue 200 = rgba(144, 202, 249, 1)
      expect(theme.cssVariables?.['--sjs-primary-backcolor']).toBe('rgba(144, 202, 249, 1)');
    });

    it('should use Okabe-Ito Sky Blue for dark + colorblind', () => {
      const theme = service.getTheme({
        colorScheme: 'dark',
        palette: 'colorblind',
      });
      // #56B4E9 = rgba(86, 180, 233, 1)
      expect(theme.cssVariables?.['--sjs-primary-backcolor']).toBe('rgba(86, 180, 233, 1)');
    });

    it('should use light backgrounds for light themes', () => {
      const theme = service.getTheme({
        colorScheme: 'light',
        palette: 'normal',
      });
      // TMI light surface: #f5f5f5 = rgba(245, 245, 245, 1)
      expect(theme.cssVariables?.['--sjs-general-backcolor']).toBe('rgba(245, 245, 245, 1)');
      // TMI light card: #fff = rgba(255, 255, 255, 1)
      expect(theme.cssVariables?.['--sjs-general-backcolor-dim-light']).toBe(
        'rgba(255, 255, 255, 1)',
      );
    });

    it('should use dark backgrounds for dark themes', () => {
      const theme = service.getTheme({
        colorScheme: 'dark',
        palette: 'normal',
      });
      // TMI dark surface: #424242 = rgba(66, 66, 66, 1)
      expect(theme.cssVariables?.['--sjs-general-backcolor']).toBe('rgba(66, 66, 66, 1)');
      // TMI dark background: #303030 = rgba(48, 48, 48, 1)
      expect(theme.cssVariables?.['--sjs-general-backcolor-dim-light']).toBe('rgba(48, 48, 48, 1)');
    });

    it('should use Okabe-Ito status colors for colorblind palette', () => {
      const theme = service.getTheme({
        colorScheme: 'light',
        palette: 'colorblind',
      });
      // Vermilion for error: #D55E00 = rgba(213, 94, 0, 1)
      expect(theme.cssVariables?.['--sjs-special-red']).toBe('rgba(213, 94, 0, 1)');
      // Bluish Green for success: #009E73 = rgba(0, 158, 115, 1)
      expect(theme.cssVariables?.['--sjs-special-green']).toBe('rgba(0, 158, 115, 1)');
    });

    it('should use Material status colors for normal palette', () => {
      const theme = service.getTheme({
        colorScheme: 'light',
        palette: 'normal',
      });
      // #f44336 = rgba(244, 67, 54, 1)
      expect(theme.cssVariables?.['--sjs-special-red']).toBe('rgba(244, 67, 54, 1)');
      // #4caf50 = rgba(76, 175, 80, 1)
      expect(theme.cssVariables?.['--sjs-special-green']).toBe('rgba(76, 175, 80, 1)');
    });

    it('should include all required CSS variable keys', () => {
      const requiredKeys = [
        '--sjs-font-family',
        '--sjs-corner-radius',
        '--sjs-base-unit',
        '--sjs-primary-backcolor',
        '--sjs-primary-backcolor-light',
        '--sjs-primary-backcolor-dark',
        '--sjs-primary-forecolor',
        '--sjs-general-backcolor',
        '--sjs-general-forecolor',
        '--sjs-border-default',
        '--sjs-special-red',
        '--sjs-special-green',
        '--sjs-special-blue',
        '--sjs-special-yellow',
        '--sjs-shadow-small',
        '--sjs-secondary-backcolor',
      ];

      const configs: ThemeConfig[] = [
        { colorScheme: 'light', palette: 'normal' },
        { colorScheme: 'light', palette: 'colorblind' },
        { colorScheme: 'dark', palette: 'normal' },
        { colorScheme: 'dark', palette: 'colorblind' },
      ];

      for (const config of configs) {
        const theme = service.getTheme(config);
        for (const key of requiredKeys) {
          expect(
            theme.cssVariables?.[key],
            `Missing ${key} in ${config.colorScheme}+${config.palette}`,
          ).toBeDefined();
        }
      }
    });
  });

  describe('theme$', () => {
    it('should emit the initial theme based on ThemeService state', () => {
      const themes: ITheme[] = [];
      service.theme$.subscribe(theme => themes.push(theme));

      expect(themes).toHaveLength(1);
      expect(themes[0].colorPalette).toBe('light');
      expect(themes[0].cssVariables?.['--sjs-primary-backcolor']).toBe('rgba(25, 118, 210, 1)');
    });

    it('should emit updated theme when ThemeService changes to dark', () => {
      const themes: ITheme[] = [];
      service.theme$.subscribe(theme => themes.push(theme));

      themeSubject.next({ colorScheme: 'dark', palette: 'normal' });

      expect(themes).toHaveLength(2);
      expect(themes[1].colorPalette).toBe('dark');
      expect(themes[1].cssVariables?.['--sjs-primary-backcolor']).toBe('rgba(144, 202, 249, 1)');
    });

    it('should emit updated theme when palette changes to colorblind', () => {
      const themes: ITheme[] = [];
      service.theme$.subscribe(theme => themes.push(theme));

      themeSubject.next({ colorScheme: 'light', palette: 'colorblind' });

      expect(themes).toHaveLength(2);
      expect(themes[1].cssVariables?.['--sjs-primary-backcolor']).toBe('rgba(0, 114, 178, 1)');
    });

    it('should emit correct theme for dark + colorblind combination', () => {
      const themes: ITheme[] = [];
      service.theme$.subscribe(theme => themes.push(theme));

      themeSubject.next({ colorScheme: 'dark', palette: 'colorblind' });

      expect(themes).toHaveLength(2);
      expect(themes[1].colorPalette).toBe('dark');
      expect(themes[1].cssVariables?.['--sjs-primary-backcolor']).toBe('rgba(86, 180, 233, 1)');
    });
  });
});
