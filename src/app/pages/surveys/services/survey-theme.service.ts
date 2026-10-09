import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ITheme } from 'survey-core';
import { ThemeService, ThemeConfig } from '@app/core/services/theme.service';

/**
 * Shared CSS variables common to all TMI SurveyJS themes.
 * Font, corner radius, base unit, and article font settings. The article font
 * variables keep their `--sjs-article-*` names because survey-core 3 stylesheets still read them.
 */
const SHARED_CSS_VARIABLES: Record<string, string> = {
  '--sjs2-typography-font-family-text': "'Roboto Condensed', arial, sans-serif",
  '--sjs2-base-unit-radius': '8px',
  '--sjs2-radius-component-panel': '8px',
  '--sjs2-radius-component-formbox': '8px',
  '--sjs2-radius-component-action': '8px',
  '--sjs2-base-unit-size': '8px',
  '--sjs2-base-unit-spacing': '8px',
  // Article font settings (from borderless-panelless base); not renamed in survey-core 3
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
    '--sjs2-color-project-brand-600': 'rgba(25, 118, 210, 1)',
    '--sjs2-color-component-tagbox-item-default-bg': 'rgba(25, 118, 210, 1)',
    '--sjs2-color-component-tagbox-item-hovered-bg': 'rgba(25, 118, 210, 1)',
    '--sjs2-color-bg-brand-secondary': 'rgba(25, 118, 210, 0.1)',
    '--sjs2-color-bg-brand-primary-dim': 'rgba(21, 101, 192, 1)',
    '--sjs2-color-fg-brand-on-primary': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-tagbox-item-default-label': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-tagbox-item-hovered-label': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-tagbox-item-action-hovered-icon': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-tagbox-item-action-pressed-icon': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-tagbox-item-action-default-icon': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-fg-brand-primary-disabled': 'rgba(255, 255, 255, 0.25)',
    '--sjs2-color-component-tagbox-item-action-hovered-bg': 'rgba(255, 255, 255, 0.25)',
    // Backgrounds — TMI light surfaces
    '--sjs2-color-bg-basic-primary': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-utility-property-grid': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-utility-tabs': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-utility-toolbox': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-alert-quaternary-surface-default-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-alert-quaternary-surface-hovered-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-brand-quaternary-surface-default-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-brand-quaternary-surface-hovered-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-neutral-quaternary-surface-default-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-neutral-quaternary-surface-hovered-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-bg-basic-primary-dim': 'rgba(224, 224, 224, 1)',
    '--sjs2-color-utility-surface-survey': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-bg-neutral-tertiary-dim': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-utility-sheet': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-brand-tertiary-surface-default-bg': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-bg-basic-secondary': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-action-brand-tertiary-surface-hovered-bg': 'rgba(224, 224, 224, 1)',
    '--sjs2-color-bg-basic-secondary-dim': 'rgba(224, 224, 224, 1)',
    // Foreground — TMI text colors
    '--sjs2-color-fg-basic-primary': 'rgba(33, 33, 33, 0.91)',
    '--sjs2-color-fg-basic-secondary': 'rgba(117, 117, 117, 1)',
    '--sjs2-color-component-action-alert-quaternary-surface-default-icon': 'rgba(117, 117, 117, 1)',
    '--sjs2-color-component-action-brand-quaternary-surface-default-icon': 'rgba(117, 117, 117, 1)',
    '--sjs2-color-component-action-neutral-quaternary-surface-default-icon':
      'rgba(117, 117, 117, 1)',
    // Shadows — borderless (minimal)
    '--sjs2-border-effect-surface-default': '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-panel-default': '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-default':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-hovered':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-disabled':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-primary-default':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-primary-hovered':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-primary-disabled':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-floating-default':
      '0px 2px 6px 0px rgba(0, 0, 0, 0.1),0px 8px 16px 0px rgba(0, 0, 0, 0.1)',
    '--sjs2-border-effect-component-formbox-default': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-formbox-hovered': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-checkbox-true-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-checkbox-false-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-radio-true-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-radio-false-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    // Borders — TMI divider color
    '--sjs2-color-border-basic-secondary': 'rgba(0, 0, 0, 0.12)',
    '--sjs2-color-component-input-default-line': 'rgba(0, 0, 0, 0.12)',
    '--sjs2-color-border-basic-secondary-overlay': 'rgba(0, 0, 0, 0.16)',
    // Status colors — TMI normal palette
    '--sjs2-color-bg-alert-primary': 'rgba(244, 67, 54, 1)',
    '--sjs2-color-bg-alert-secondary': 'rgba(244, 67, 54, 0.1)',
    '--sjs2-color-fg-alert-on-primary': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-bg-positive-primary': 'rgba(76, 175, 80, 1)',
    '--sjs2-color-bg-positive-secondary': 'rgba(76, 175, 80, 0.1)',
    '--sjs2-color-fg-positive-on-primary': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-bg-note-primary': 'rgba(25, 118, 210, 1)',
    '--sjs2-color-bg-note-secondary': 'rgba(25, 118, 210, 0.1)',
    '--sjs2-color-fg-note-on-primary': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-bg-warning-primary': 'rgba(255, 152, 0, 1)',
    '--sjs2-color-bg-warning-secondary': 'rgba(255, 152, 0, 0.1)',
    '--sjs2-color-fg-warning-on-primary': 'rgba(255, 255, 255, 1)',
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
    '--sjs2-color-project-brand-600': 'rgba(0, 114, 178, 1)',
    '--sjs2-color-component-tagbox-item-default-bg': 'rgba(0, 114, 178, 1)',
    '--sjs2-color-component-tagbox-item-hovered-bg': 'rgba(0, 114, 178, 1)',
    '--sjs2-color-bg-brand-secondary': 'rgba(0, 114, 178, 0.1)',
    '--sjs2-color-bg-brand-primary-dim': 'rgba(0, 95, 162, 1)',
    '--sjs2-color-fg-brand-on-primary': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-tagbox-item-default-label': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-tagbox-item-hovered-label': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-tagbox-item-action-hovered-icon': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-tagbox-item-action-pressed-icon': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-tagbox-item-action-default-icon': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-fg-brand-primary-disabled': 'rgba(255, 255, 255, 0.25)',
    '--sjs2-color-component-tagbox-item-action-hovered-bg': 'rgba(255, 255, 255, 0.25)',
    // Backgrounds — same as light normal
    '--sjs2-color-bg-basic-primary': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-utility-property-grid': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-utility-tabs': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-utility-toolbox': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-alert-quaternary-surface-default-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-alert-quaternary-surface-hovered-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-brand-quaternary-surface-default-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-brand-quaternary-surface-hovered-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-neutral-quaternary-surface-default-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-neutral-quaternary-surface-hovered-bg': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-bg-basic-primary-dim': 'rgba(224, 224, 224, 1)',
    '--sjs2-color-utility-surface-survey': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-bg-neutral-tertiary-dim': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-utility-sheet': 'rgba(245, 245, 245, 1)',
    '--sjs2-color-component-action-brand-tertiary-surface-default-bg': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-bg-basic-secondary': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-component-action-brand-tertiary-surface-hovered-bg': 'rgba(224, 224, 224, 1)',
    '--sjs2-color-bg-basic-secondary-dim': 'rgba(224, 224, 224, 1)',
    // Foreground — same as light normal
    '--sjs2-color-fg-basic-primary': 'rgba(33, 33, 33, 0.91)',
    '--sjs2-color-fg-basic-secondary': 'rgba(117, 117, 117, 1)',
    '--sjs2-color-component-action-alert-quaternary-surface-default-icon': 'rgba(117, 117, 117, 1)',
    '--sjs2-color-component-action-brand-quaternary-surface-default-icon': 'rgba(117, 117, 117, 1)',
    '--sjs2-color-component-action-neutral-quaternary-surface-default-icon':
      'rgba(117, 117, 117, 1)',
    // Shadows — borderless
    '--sjs2-border-effect-surface-default': '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-panel-default': '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-default':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-hovered':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-disabled':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-primary-default':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-primary-hovered':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-action-brand-primary-disabled':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-floating-default':
      '0px 2px 6px 0px rgba(0, 0, 0, 0.1),0px 8px 16px 0px rgba(0, 0, 0, 0.1)',
    '--sjs2-border-effect-component-formbox-default': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-formbox-hovered': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-checkbox-true-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-checkbox-false-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-radio-true-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    '--sjs2-border-effect-component-radio-false-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.15)',
    // Borders — TMI divider
    '--sjs2-color-border-basic-secondary': 'rgba(0, 0, 0, 0.12)',
    '--sjs2-color-component-input-default-line': 'rgba(0, 0, 0, 0.12)',
    '--sjs2-color-border-basic-secondary-overlay': 'rgba(0, 0, 0, 0.16)',
    // Status colors — Okabe-Ito palette
    '--sjs2-color-bg-alert-primary': 'rgba(213, 94, 0, 1)',
    '--sjs2-color-bg-alert-secondary': 'rgba(213, 94, 0, 0.1)',
    '--sjs2-color-fg-alert-on-primary': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-bg-positive-primary': 'rgba(0, 158, 115, 1)',
    '--sjs2-color-bg-positive-secondary': 'rgba(0, 158, 115, 0.1)',
    '--sjs2-color-fg-positive-on-primary': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-bg-note-primary': 'rgba(0, 114, 178, 1)',
    '--sjs2-color-bg-note-secondary': 'rgba(0, 114, 178, 0.1)',
    '--sjs2-color-fg-note-on-primary': 'rgba(255, 255, 255, 1)',
    '--sjs2-color-bg-warning-primary': 'rgba(230, 159, 0, 1)',
    '--sjs2-color-bg-warning-secondary': 'rgba(230, 159, 0, 0.1)',
    '--sjs2-color-fg-warning-on-primary': 'rgba(255, 255, 255, 1)',
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
    '--sjs2-color-project-brand-600': 'rgba(144, 202, 249, 1)',
    '--sjs2-color-component-tagbox-item-default-bg': 'rgba(144, 202, 249, 1)',
    '--sjs2-color-component-tagbox-item-hovered-bg': 'rgba(144, 202, 249, 1)',
    '--sjs2-color-bg-brand-secondary': 'rgba(144, 202, 249, 0.1)',
    '--sjs2-color-bg-brand-primary-dim': 'rgba(66, 165, 245, 1)',
    '--sjs2-color-fg-brand-on-primary': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-component-tagbox-item-default-label': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-component-tagbox-item-hovered-label': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-component-tagbox-item-action-hovered-icon': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-component-tagbox-item-action-pressed-icon': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-component-tagbox-item-action-default-icon': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-fg-brand-primary-disabled': 'rgba(33, 33, 33, 0.25)',
    '--sjs2-color-component-tagbox-item-action-hovered-bg': 'rgba(33, 33, 33, 0.25)',
    // Backgrounds — TMI dark surfaces
    '--sjs2-color-bg-basic-primary': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-utility-property-grid': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-utility-tabs': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-utility-toolbox': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-alert-quaternary-surface-default-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-alert-quaternary-surface-hovered-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-brand-quaternary-surface-default-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-brand-quaternary-surface-hovered-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-neutral-quaternary-surface-default-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-neutral-quaternary-surface-hovered-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-bg-basic-primary-dim': 'rgba(55, 55, 55, 1)',
    '--sjs2-color-utility-surface-survey': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-bg-neutral-tertiary-dim': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-utility-sheet': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-brand-tertiary-surface-default-bg': 'rgba(48, 48, 48, 1)',
    '--sjs2-color-bg-basic-secondary': 'rgba(48, 48, 48, 1)',
    '--sjs2-color-component-action-brand-tertiary-surface-hovered-bg': 'rgba(55, 55, 55, 1)',
    '--sjs2-color-bg-basic-secondary-dim': 'rgba(55, 55, 55, 1)',
    // Foreground — TMI dark theme text
    '--sjs2-color-fg-basic-primary': 'rgba(255, 255, 255, 0.87)',
    '--sjs2-color-fg-basic-secondary': 'rgba(255, 255, 255, 0.7)',
    '--sjs2-color-component-action-alert-quaternary-surface-default-icon':
      'rgba(255, 255, 255, 0.7)',
    '--sjs2-color-component-action-brand-quaternary-surface-default-icon':
      'rgba(255, 255, 255, 0.7)',
    '--sjs2-color-component-action-neutral-quaternary-surface-default-icon':
      'rgba(255, 255, 255, 0.7)',
    // Shadows — darker for dark theme
    '--sjs2-border-effect-surface-default': '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-panel-default': '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-default':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-hovered':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-disabled':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-primary-default':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-primary-hovered':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-primary-disabled':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-floating-default':
      '0px 2px 6px 0px rgba(0, 0, 0, 0.2),0px 8px 16px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-formbox-default': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-formbox-hovered': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-checkbox-true-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-checkbox-false-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-radio-true-default': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-radio-false-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    // Borders — TMI dark divider
    '--sjs2-color-border-basic-secondary': 'rgba(255, 255, 255, 0.12)',
    '--sjs2-color-component-input-default-line': 'rgba(255, 255, 255, 0.12)',
    '--sjs2-color-border-basic-secondary-overlay': 'rgba(255, 255, 255, 0.08)',
    // Status colors — lightened for dark background
    '--sjs2-color-bg-alert-primary': 'rgba(239, 83, 80, 1)',
    '--sjs2-color-bg-alert-secondary': 'rgba(239, 83, 80, 0.1)',
    '--sjs2-color-fg-alert-on-primary': 'rgba(48, 48, 48, 1)',
    '--sjs2-color-bg-positive-primary': 'rgba(102, 187, 106, 1)',
    '--sjs2-color-bg-positive-secondary': 'rgba(102, 187, 106, 0.1)',
    '--sjs2-color-fg-positive-on-primary': 'rgba(48, 48, 48, 1)',
    '--sjs2-color-bg-note-primary': 'rgba(144, 202, 249, 1)',
    '--sjs2-color-bg-note-secondary': 'rgba(144, 202, 249, 0.1)',
    '--sjs2-color-fg-note-on-primary': 'rgba(48, 48, 48, 1)',
    '--sjs2-color-bg-warning-primary': 'rgba(255, 152, 0, 1)',
    '--sjs2-color-bg-warning-secondary': 'rgba(255, 152, 0, 0.1)',
    '--sjs2-color-fg-warning-on-primary': 'rgba(48, 48, 48, 1)',
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
    '--sjs2-color-project-brand-600': 'rgba(86, 180, 233, 1)',
    '--sjs2-color-component-tagbox-item-default-bg': 'rgba(86, 180, 233, 1)',
    '--sjs2-color-component-tagbox-item-hovered-bg': 'rgba(86, 180, 233, 1)',
    '--sjs2-color-bg-brand-secondary': 'rgba(86, 180, 233, 0.1)',
    '--sjs2-color-bg-brand-primary-dim': 'rgba(0, 114, 178, 1)',
    '--sjs2-color-fg-brand-on-primary': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-component-tagbox-item-default-label': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-component-tagbox-item-hovered-label': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-component-tagbox-item-action-hovered-icon': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-component-tagbox-item-action-pressed-icon': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-component-tagbox-item-action-default-icon': 'rgba(33, 33, 33, 1)',
    '--sjs2-color-fg-brand-primary-disabled': 'rgba(33, 33, 33, 0.25)',
    '--sjs2-color-component-tagbox-item-action-hovered-bg': 'rgba(33, 33, 33, 0.25)',
    // Backgrounds — TMI dark surfaces
    '--sjs2-color-bg-basic-primary': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-utility-property-grid': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-utility-tabs': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-utility-toolbox': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-alert-quaternary-surface-default-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-alert-quaternary-surface-hovered-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-brand-quaternary-surface-default-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-brand-quaternary-surface-hovered-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-neutral-quaternary-surface-default-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-neutral-quaternary-surface-hovered-bg': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-bg-basic-primary-dim': 'rgba(55, 55, 55, 1)',
    '--sjs2-color-utility-surface-survey': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-bg-neutral-tertiary-dim': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-utility-sheet': 'rgba(66, 66, 66, 1)',
    '--sjs2-color-component-action-brand-tertiary-surface-default-bg': 'rgba(48, 48, 48, 1)',
    '--sjs2-color-bg-basic-secondary': 'rgba(48, 48, 48, 1)',
    '--sjs2-color-component-action-brand-tertiary-surface-hovered-bg': 'rgba(55, 55, 55, 1)',
    '--sjs2-color-bg-basic-secondary-dim': 'rgba(55, 55, 55, 1)',
    // Foreground — TMI dark theme text
    '--sjs2-color-fg-basic-primary': 'rgba(255, 255, 255, 0.87)',
    '--sjs2-color-fg-basic-secondary': 'rgba(255, 255, 255, 0.7)',
    '--sjs2-color-component-action-alert-quaternary-surface-default-icon':
      'rgba(255, 255, 255, 0.7)',
    '--sjs2-color-component-action-brand-quaternary-surface-default-icon':
      'rgba(255, 255, 255, 0.7)',
    '--sjs2-color-component-action-neutral-quaternary-surface-default-icon':
      'rgba(255, 255, 255, 0.7)',
    // Shadows — darker for dark theme
    '--sjs2-border-effect-surface-default': '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-panel-default': '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-default':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-hovered':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-tertiary-surface-disabled':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-primary-default':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-primary-hovered':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-component-action-brand-primary-disabled':
      '0px 0px 0px 0px rgba(0, 0, 0, 0.35)',
    '--sjs2-border-effect-floating-default':
      '0px 2px 6px 0px rgba(0, 0, 0, 0.2),0px 8px 16px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-formbox-default': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-formbox-hovered': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-checkbox-true-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-checkbox-false-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-radio-true-default': 'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    '--sjs2-border-effect-component-radio-false-default':
      'inset 0px 0px 0px 0px rgba(0, 0, 0, 0.2)',
    // Borders — TMI dark divider
    '--sjs2-color-border-basic-secondary': 'rgba(255, 255, 255, 0.12)',
    '--sjs2-color-component-input-default-line': 'rgba(255, 255, 255, 0.12)',
    '--sjs2-color-border-basic-secondary-overlay': 'rgba(255, 255, 255, 0.08)',
    // Status colors — Okabe-Ito palette (same in dark since they already have good contrast)
    '--sjs2-color-bg-alert-primary': 'rgba(213, 94, 0, 1)',
    '--sjs2-color-bg-alert-secondary': 'rgba(213, 94, 0, 0.1)',
    '--sjs2-color-fg-alert-on-primary': 'rgba(48, 48, 48, 1)',
    '--sjs2-color-bg-positive-primary': 'rgba(0, 158, 115, 1)',
    '--sjs2-color-bg-positive-secondary': 'rgba(0, 158, 115, 0.1)',
    '--sjs2-color-fg-positive-on-primary': 'rgba(48, 48, 48, 1)',
    '--sjs2-color-bg-note-primary': 'rgba(86, 180, 233, 1)',
    '--sjs2-color-bg-note-secondary': 'rgba(86, 180, 233, 0.1)',
    '--sjs2-color-fg-note-on-primary': 'rgba(48, 48, 48, 1)',
    '--sjs2-color-bg-warning-primary': 'rgba(230, 159, 0, 1)',
    '--sjs2-color-bg-warning-secondary': 'rgba(230, 159, 0, 0.1)',
    '--sjs2-color-fg-warning-on-primary': 'rgba(48, 48, 48, 1)',
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
// SEM@dfd1e58a42f93148397e28d790ce39f064d27194: map the app theme configuration to the matching SurveyJS ITheme reactively (pure)
export class SurveyThemeService {
  /**
   * Observable that emits the appropriate SurveyJS ITheme whenever
   * the TMI theme changes (light/dark or normal/colorblind toggle).
   */
  readonly theme$: Observable<ITheme>;

  // SEM@dfd1e58a42f93148397e28d790ce39f064d27194: subscribe to theme changes and build the reactive SurveyJS theme observable (pure)
  constructor(private themeService: ThemeService) {
    this.theme$ = this.themeService.observeTheme().pipe(map(config => this.getTheme(config)));
  }

  /**
   * Returns the SurveyJS ITheme for the given TMI theme configuration.
   */
  // SEM@dfd1e58a42f93148397e28d790ce39f064d27194: convert a theme configuration to the corresponding SurveyJS ITheme (pure)
  getTheme(config: ThemeConfig): ITheme {
    if (config.colorScheme === 'dark') {
      return config.palette === 'colorblind' ? DARK_COLORBLIND_THEME : DARK_NORMAL_THEME;
    }
    return config.palette === 'colorblind' ? LIGHT_COLORBLIND_THEME : LIGHT_NORMAL_THEME;
  }
}
