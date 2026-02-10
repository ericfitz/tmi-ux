import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ITheme } from 'survey-core';
import { ThemeService, ThemeConfig } from '@app/core/services/theme.service';

/**
 * Shared CSS variables common to all TMI SurveyJS themes.
 * Font, corner radius, base unit, and article font settings.
 */
const SHARED_CSS_VARIABLES: Record<string, string> = {
  '--sjs-font-family': "'Roboto Condensed', arial, sans-serif",
  '--sjs-corner-radius': '8px',
  '--sjs-base-unit': '8px',
  // Article font settings (from borderless-panelless base)
  '--sjs-article-font-xx-large-textDecoration': 'none',
  '--sjs-article-font-xx-large-fontWeight': '700',
  '--sjs-article-font-xx-large-fontStyle': 'normal',
  '--sjs-article-font-xx-large-fontStretch': 'normal',
  '--sjs-article-font-xx-large-letterSpacing': '0',
  '--sjs-article-font-xx-large-lineHeight': '64px',
  '--sjs-article-font-xx-large-paragraphIndent': '0px',
  '--sjs-article-font-xx-large-textCase': 'none',
  '--sjs-article-font-x-large-textDecoration': 'none',
  '--sjs-article-font-x-large-fontWeight': '700',
  '--sjs-article-font-x-large-fontStyle': 'normal',
  '--sjs-article-font-x-large-fontStretch': 'normal',
  '--sjs-article-font-x-large-letterSpacing': '0',
  '--sjs-article-font-x-large-lineHeight': '56px',
  '--sjs-article-font-x-large-paragraphIndent': '0px',
  '--sjs-article-font-x-large-textCase': 'none',
  '--sjs-article-font-large-textDecoration': 'none',
  '--sjs-article-font-large-fontWeight': '700',
  '--sjs-article-font-large-fontStyle': 'normal',
  '--sjs-article-font-large-fontStretch': 'normal',
  '--sjs-article-font-large-letterSpacing': '0',
  '--sjs-article-font-large-lineHeight': '40px',
  '--sjs-article-font-large-paragraphIndent': '0px',
  '--sjs-article-font-large-textCase': 'none',
  '--sjs-article-font-medium-textDecoration': 'none',
  '--sjs-article-font-medium-fontWeight': '700',
  '--sjs-article-font-medium-fontStyle': 'normal',
  '--sjs-article-font-medium-fontStretch': 'normal',
  '--sjs-article-font-medium-letterSpacing': '0',
  '--sjs-article-font-medium-lineHeight': '32px',
  '--sjs-article-font-medium-paragraphIndent': '0px',
  '--sjs-article-font-medium-textCase': 'none',
  '--sjs-article-font-default-textDecoration': 'none',
  '--sjs-article-font-default-fontWeight': '400',
  '--sjs-article-font-default-fontStyle': 'normal',
  '--sjs-article-font-default-fontStretch': 'normal',
  '--sjs-article-font-default-letterSpacing': '0',
  '--sjs-article-font-default-lineHeight': '28px',
  '--sjs-article-font-default-paragraphIndent': '0px',
  '--sjs-article-font-default-textCase': 'none',
};

/**
 * Light + Normal palette theme.
 * Primary: Material Blue 700 (#1976d2), status colors from TMI's normal palette.
 */
const LIGHT_NORMAL_THEME: ITheme = {
  themeName: 'borderless',
  colorPalette: 'light',
  isPanelless: true,
  cssVariables: {
    ...SHARED_CSS_VARIABLES,
    // Primary — Material Blue 700
    '--sjs-primary-backcolor': 'rgba(25, 118, 210, 1)',
    '--sjs-primary-backcolor-light': 'rgba(25, 118, 210, 0.1)',
    '--sjs-primary-backcolor-dark': 'rgba(21, 101, 192, 1)',
    '--sjs-primary-forecolor': 'rgba(255, 255, 255, 1)',
    '--sjs-primary-forecolor-light': 'rgba(255, 255, 255, 0.25)',
    // Backgrounds — TMI light surfaces
    '--sjs-general-backcolor': 'rgba(245, 245, 245, 1)',
    '--sjs-general-backcolor-dark': 'rgba(224, 224, 224, 1)',
    '--sjs-general-backcolor-dim': 'rgba(245, 245, 245, 1)',
    '--sjs-general-backcolor-dim-light': 'rgba(255, 255, 255, 1)',
    '--sjs-general-backcolor-dim-dark': 'rgba(224, 224, 224, 1)',
    // Foreground — TMI text colors
    '--sjs-general-forecolor': 'rgba(33, 33, 33, 0.91)',
    '--sjs-general-forecolor-light': 'rgba(117, 117, 117, 1)',
    '--sjs-general-dim-forecolor': 'rgba(33, 33, 33, 0.91)',
    '--sjs-general-dim-forecolor-light': 'rgba(117, 117, 117, 1)',
    // Secondary — warning orange
    '--sjs-secondary-backcolor': 'rgba(255, 152, 0, 1)',
    '--sjs-secondary-backcolor-light': 'rgba(255, 152, 0, 0.1)',
    '--sjs-secondary-backcolor-semi-light': 'rgba(255, 152, 0, 0.25)',
    '--sjs-secondary-forecolor': 'rgba(255, 255, 255, 1)',
    '--sjs-secondary-forecolor-light': 'rgba(255, 255, 255, 0.25)',
    // Shadows — borderless (minimal)
    '--sjs-shadow-small': '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs-shadow-small-reset': '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs-shadow-medium': '0px 2px 6px 0px rgba(0, 0, 0, 0.1)',
    '--sjs-shadow-large': '0px 8px 16px 0px rgba(0, 0, 0, 0.1)',
    '--sjs-shadow-inner': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs-shadow-inner-reset': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    // Borders — TMI divider color
    '--sjs-border-light': 'rgba(0, 0, 0, 0.12)',
    '--sjs-border-default': 'rgba(0, 0, 0, 0.12)',
    '--sjs-border-inside': 'rgba(0, 0, 0, 0.16)',
    // Status colors — TMI normal palette
    '--sjs-special-red': 'rgba(244, 67, 54, 1)',
    '--sjs-special-red-light': 'rgba(244, 67, 54, 0.1)',
    '--sjs-special-red-forecolor': 'rgba(255, 255, 255, 1)',
    '--sjs-special-green': 'rgba(76, 175, 80, 1)',
    '--sjs-special-green-light': 'rgba(76, 175, 80, 0.1)',
    '--sjs-special-green-forecolor': 'rgba(255, 255, 255, 1)',
    '--sjs-special-blue': 'rgba(25, 118, 210, 1)',
    '--sjs-special-blue-light': 'rgba(25, 118, 210, 0.1)',
    '--sjs-special-blue-forecolor': 'rgba(255, 255, 255, 1)',
    '--sjs-special-yellow': 'rgba(255, 152, 0, 1)',
    '--sjs-special-yellow-light': 'rgba(255, 152, 0, 0.1)',
    '--sjs-special-yellow-forecolor': 'rgba(255, 255, 255, 1)',
  },
};

/**
 * Light + Colorblind palette theme.
 * Primary: Okabe-Ito Blue (#0072B2), status colors from TMI's Okabe-Ito palette.
 */
const LIGHT_COLORBLIND_THEME: ITheme = {
  themeName: 'borderless',
  colorPalette: 'light',
  isPanelless: true,
  cssVariables: {
    ...SHARED_CSS_VARIABLES,
    // Primary — Okabe-Ito Blue
    '--sjs-primary-backcolor': 'rgba(0, 114, 178, 1)',
    '--sjs-primary-backcolor-light': 'rgba(0, 114, 178, 0.1)',
    '--sjs-primary-backcolor-dark': 'rgba(0, 95, 162, 1)',
    '--sjs-primary-forecolor': 'rgba(255, 255, 255, 1)',
    '--sjs-primary-forecolor-light': 'rgba(255, 255, 255, 0.25)',
    // Backgrounds — same as light normal
    '--sjs-general-backcolor': 'rgba(245, 245, 245, 1)',
    '--sjs-general-backcolor-dark': 'rgba(224, 224, 224, 1)',
    '--sjs-general-backcolor-dim': 'rgba(245, 245, 245, 1)',
    '--sjs-general-backcolor-dim-light': 'rgba(255, 255, 255, 1)',
    '--sjs-general-backcolor-dim-dark': 'rgba(224, 224, 224, 1)',
    // Foreground — same as light normal
    '--sjs-general-forecolor': 'rgba(33, 33, 33, 0.91)',
    '--sjs-general-forecolor-light': 'rgba(117, 117, 117, 1)',
    '--sjs-general-dim-forecolor': 'rgba(33, 33, 33, 0.91)',
    '--sjs-general-dim-forecolor-light': 'rgba(117, 117, 117, 1)',
    // Secondary — Okabe-Ito Orange
    '--sjs-secondary-backcolor': 'rgba(230, 159, 0, 1)',
    '--sjs-secondary-backcolor-light': 'rgba(230, 159, 0, 0.1)',
    '--sjs-secondary-backcolor-semi-light': 'rgba(230, 159, 0, 0.25)',
    '--sjs-secondary-forecolor': 'rgba(255, 255, 255, 1)',
    '--sjs-secondary-forecolor-light': 'rgba(255, 255, 255, 0.25)',
    // Shadows — borderless
    '--sjs-shadow-small': '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs-shadow-small-reset': '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs-shadow-medium': '0px 2px 6px 0px rgba(0, 0, 0, 0.1)',
    '--sjs-shadow-large': '0px 8px 16px 0px rgba(0, 0, 0, 0.1)',
    '--sjs-shadow-inner': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs-shadow-inner-reset': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    // Borders — TMI divider
    '--sjs-border-light': 'rgba(0, 0, 0, 0.12)',
    '--sjs-border-default': 'rgba(0, 0, 0, 0.12)',
    '--sjs-border-inside': 'rgba(0, 0, 0, 0.16)',
    // Status colors — Okabe-Ito palette
    '--sjs-special-red': 'rgba(213, 94, 0, 1)',
    '--sjs-special-red-light': 'rgba(213, 94, 0, 0.1)',
    '--sjs-special-red-forecolor': 'rgba(255, 255, 255, 1)',
    '--sjs-special-green': 'rgba(0, 158, 115, 1)',
    '--sjs-special-green-light': 'rgba(0, 158, 115, 0.1)',
    '--sjs-special-green-forecolor': 'rgba(255, 255, 255, 1)',
    '--sjs-special-blue': 'rgba(0, 114, 178, 1)',
    '--sjs-special-blue-light': 'rgba(0, 114, 178, 0.1)',
    '--sjs-special-blue-forecolor': 'rgba(255, 255, 255, 1)',
    '--sjs-special-yellow': 'rgba(230, 159, 0, 1)',
    '--sjs-special-yellow-light': 'rgba(230, 159, 0, 0.1)',
    '--sjs-special-yellow-forecolor': 'rgba(255, 255, 255, 1)',
  },
};

/**
 * Dark + Normal palette theme.
 * Primary lightened to Material Blue 200 (#90caf9) for contrast on dark backgrounds.
 */
const DARK_NORMAL_THEME: ITheme = {
  themeName: 'borderless',
  colorPalette: 'dark',
  isPanelless: true,
  cssVariables: {
    ...SHARED_CSS_VARIABLES,
    // Primary — Material Blue 200 (lightened for dark backgrounds)
    '--sjs-primary-backcolor': 'rgba(144, 202, 249, 1)',
    '--sjs-primary-backcolor-light': 'rgba(144, 202, 249, 0.1)',
    '--sjs-primary-backcolor-dark': 'rgba(66, 165, 245, 1)',
    '--sjs-primary-forecolor': 'rgba(33, 33, 33, 1)',
    '--sjs-primary-forecolor-light': 'rgba(33, 33, 33, 0.25)',
    // Backgrounds — TMI dark surfaces
    '--sjs-general-backcolor': 'rgba(66, 66, 66, 1)',
    '--sjs-general-backcolor-dark': 'rgba(55, 55, 55, 1)',
    '--sjs-general-backcolor-dim': 'rgba(66, 66, 66, 1)',
    '--sjs-general-backcolor-dim-light': 'rgba(48, 48, 48, 1)',
    '--sjs-general-backcolor-dim-dark': 'rgba(55, 55, 55, 1)',
    // Foreground — TMI dark theme text
    '--sjs-general-forecolor': 'rgba(255, 255, 255, 0.87)',
    '--sjs-general-forecolor-light': 'rgba(255, 255, 255, 0.7)',
    '--sjs-general-dim-forecolor': 'rgba(255, 255, 255, 0.87)',
    '--sjs-general-dim-forecolor-light': 'rgba(255, 255, 255, 0.7)',
    // Secondary — warning orange
    '--sjs-secondary-backcolor': 'rgba(255, 152, 0, 1)',
    '--sjs-secondary-backcolor-light': 'rgba(255, 152, 0, 0.1)',
    '--sjs-secondary-backcolor-semi-light': 'rgba(255, 152, 0, 0.25)',
    '--sjs-secondary-forecolor': 'rgba(48, 48, 48, 1)',
    '--sjs-secondary-forecolor-light': 'rgba(48, 48, 48, 0.25)',
    // Shadows — darker for dark theme
    '--sjs-shadow-small': '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs-shadow-small-reset': '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs-shadow-medium': '0px 2px 6px 0px rgba(0, 0, 0, 0.2)',
    '--sjs-shadow-large': '0px 8px 16px 0px rgba(0, 0, 0, 0.2)',
    '--sjs-shadow-inner': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs-shadow-inner-reset': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    // Borders — TMI dark divider
    '--sjs-border-light': 'rgba(255, 255, 255, 0.12)',
    '--sjs-border-default': 'rgba(255, 255, 255, 0.12)',
    '--sjs-border-inside': 'rgba(255, 255, 255, 0.08)',
    // Status colors — lightened for dark background
    '--sjs-special-red': 'rgba(239, 83, 80, 1)',
    '--sjs-special-red-light': 'rgba(239, 83, 80, 0.1)',
    '--sjs-special-red-forecolor': 'rgba(48, 48, 48, 1)',
    '--sjs-special-green': 'rgba(102, 187, 106, 1)',
    '--sjs-special-green-light': 'rgba(102, 187, 106, 0.1)',
    '--sjs-special-green-forecolor': 'rgba(48, 48, 48, 1)',
    '--sjs-special-blue': 'rgba(144, 202, 249, 1)',
    '--sjs-special-blue-light': 'rgba(144, 202, 249, 0.1)',
    '--sjs-special-blue-forecolor': 'rgba(48, 48, 48, 1)',
    '--sjs-special-yellow': 'rgba(255, 152, 0, 1)',
    '--sjs-special-yellow-light': 'rgba(255, 152, 0, 0.1)',
    '--sjs-special-yellow-forecolor': 'rgba(48, 48, 48, 1)',
  },
};

/**
 * Dark + Colorblind palette theme.
 * Primary: Okabe-Ito Sky Blue (#56B4E9) for contrast on dark backgrounds.
 */
const DARK_COLORBLIND_THEME: ITheme = {
  themeName: 'borderless',
  colorPalette: 'dark',
  isPanelless: true,
  cssVariables: {
    ...SHARED_CSS_VARIABLES,
    // Primary — Okabe-Ito Sky Blue (lighter variant for dark backgrounds)
    '--sjs-primary-backcolor': 'rgba(86, 180, 233, 1)',
    '--sjs-primary-backcolor-light': 'rgba(86, 180, 233, 0.1)',
    '--sjs-primary-backcolor-dark': 'rgba(0, 114, 178, 1)',
    '--sjs-primary-forecolor': 'rgba(33, 33, 33, 1)',
    '--sjs-primary-forecolor-light': 'rgba(33, 33, 33, 0.25)',
    // Backgrounds — TMI dark surfaces
    '--sjs-general-backcolor': 'rgba(66, 66, 66, 1)',
    '--sjs-general-backcolor-dark': 'rgba(55, 55, 55, 1)',
    '--sjs-general-backcolor-dim': 'rgba(66, 66, 66, 1)',
    '--sjs-general-backcolor-dim-light': 'rgba(48, 48, 48, 1)',
    '--sjs-general-backcolor-dim-dark': 'rgba(55, 55, 55, 1)',
    // Foreground — TMI dark theme text
    '--sjs-general-forecolor': 'rgba(255, 255, 255, 0.87)',
    '--sjs-general-forecolor-light': 'rgba(255, 255, 255, 0.7)',
    '--sjs-general-dim-forecolor': 'rgba(255, 255, 255, 0.87)',
    '--sjs-general-dim-forecolor-light': 'rgba(255, 255, 255, 0.7)',
    // Secondary — Okabe-Ito Orange
    '--sjs-secondary-backcolor': 'rgba(230, 159, 0, 1)',
    '--sjs-secondary-backcolor-light': 'rgba(230, 159, 0, 0.1)',
    '--sjs-secondary-backcolor-semi-light': 'rgba(230, 159, 0, 0.25)',
    '--sjs-secondary-forecolor': 'rgba(48, 48, 48, 1)',
    '--sjs-secondary-forecolor-light': 'rgba(48, 48, 48, 0.25)',
    // Shadows — darker for dark theme
    '--sjs-shadow-small': '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs-shadow-small-reset': '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs-shadow-medium': '0px 2px 6px 0px rgba(0, 0, 0, 0.2)',
    '--sjs-shadow-large': '0px 8px 16px 0px rgba(0, 0, 0, 0.2)',
    '--sjs-shadow-inner': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs-shadow-inner-reset': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    // Borders — TMI dark divider
    '--sjs-border-light': 'rgba(255, 255, 255, 0.12)',
    '--sjs-border-default': 'rgba(255, 255, 255, 0.12)',
    '--sjs-border-inside': 'rgba(255, 255, 255, 0.08)',
    // Status colors — Okabe-Ito palette (same in dark since they already have good contrast)
    '--sjs-special-red': 'rgba(213, 94, 0, 1)',
    '--sjs-special-red-light': 'rgba(213, 94, 0, 0.1)',
    '--sjs-special-red-forecolor': 'rgba(48, 48, 48, 1)',
    '--sjs-special-green': 'rgba(0, 158, 115, 1)',
    '--sjs-special-green-light': 'rgba(0, 158, 115, 0.1)',
    '--sjs-special-green-forecolor': 'rgba(48, 48, 48, 1)',
    '--sjs-special-blue': 'rgba(86, 180, 233, 1)',
    '--sjs-special-blue-light': 'rgba(86, 180, 233, 0.1)',
    '--sjs-special-blue-forecolor': 'rgba(48, 48, 48, 1)',
    '--sjs-special-yellow': 'rgba(230, 159, 0, 1)',
    '--sjs-special-yellow-light': 'rgba(230, 159, 0, 0.1)',
    '--sjs-special-yellow-forecolor': 'rgba(48, 48, 48, 1)',
  },
};

/**
 * SurveyJS Theme Service
 *
 * Maps TMI's theme configuration (light/dark, normal/colorblind) to SurveyJS ITheme
 * objects based on the borderless-panelless base theme. Provides both synchronous
 * theme lookup and reactive theme observable for live theme switching.
 */
@Injectable({
  providedIn: 'root',
})
export class SurveyThemeService {
  /**
   * Observable that emits the appropriate SurveyJS ITheme whenever
   * the TMI theme changes (light/dark or normal/colorblind toggle).
   */
  readonly theme$: Observable<ITheme>;

  constructor(private themeService: ThemeService) {
    this.theme$ = this.themeService.observeTheme().pipe(map(config => this.getTheme(config)));
  }

  /**
   * Returns the SurveyJS ITheme for the given TMI theme configuration.
   */
  getTheme(config: ThemeConfig): ITheme {
    if (config.colorScheme === 'dark') {
      return config.palette === 'colorblind' ? DARK_COLORBLIND_THEME : DARK_NORMAL_THEME;
    }
    return config.palette === 'colorblind' ? LIGHT_COLORBLIND_THEME : LIGHT_NORMAL_THEME;
  }
}
