# Design: Consume `ui.default_theme` from Server Config

**Issue:** [#528](https://github.com/ericfitz/tmi-ux/issues/528)
**Date:** 2026-03-25

## Problem

The TMI server exposes `ui.default_theme` via `GET /config` (values: `auto`, `light`, `dark`). The `ServerConfig` interface includes this field, but no client code reads or acts on it. New users always get the hardcoded default of `automatic` regardless of server configuration.

## Solution

Wire the existing `ui.default_theme` value through from `BrandingConfigService` to `UserPreferencesService` so that new users (no saved preferences) get the server-configured default theme.

### Changes

#### 1. `BrandingConfigService` — expose `defaultTheme`

Add a synchronous getter and observable:

- `get defaultTheme(): ThemeMode | null` — returns the validated `ui.default_theme` value, or `null` if not set or invalid
- Validation: value must map to a valid `ThemeMode`. The server sends `auto`, `light`, or `dark`; map `auto` to `automatic` to match the client-side `ThemeMode` type.

#### 2. `app.config.ts` — sequencing

Add `BrandingConfigService` as a dependency of `initializeUserPreferences` so that branding config is guaranteed to be loaded before user preferences initialization runs. This ensures `defaultTheme` is available when `UserPreferencesService` needs it.

#### 3. `UserPreferencesService` — use server default for new users

- Inject `BrandingConfigService`
- In `initialize()`, after determining that no user preference exists (no localStorage cache, no server prefs), consult `brandingConfigService.defaultTheme` as the `themeMode` instead of the hardcoded `'automatic'`
- If `defaultTheme` is `null`, fall back to `'automatic'` as before
- Existing users with saved preferences are unaffected

### What doesn't change

- **`ThemeService`** — no modifications; it already reads from `UserPreferencesService`
- **Saved preferences** — users who have previously set a theme keep their choice
- **`'automatic'` fallback** — still the ultimate default if server config doesn't specify `default_theme`

### Validation

The server's `default_theme` field accepts `auto`, `light`, `dark`. The client `ThemeMode` type is `'automatic' | 'light' | 'dark'`. Mapping:

| Server value | Client `ThemeMode` |
|---|---|
| `auto` | `automatic` |
| `light` | `light` |
| `dark` | `dark` |
| anything else | `null` (ignored) |

### Tests

- **`BrandingConfigService` spec:** verify `defaultTheme` getter returns mapped value when present, `null` when absent or invalid
- **`UserPreferencesService` spec:** verify server default theme is applied for new users (no localStorage, no server prefs); verify existing prefs are not overridden
- **`ThemeService` spec:** no changes expected

### Initialization sequence (after change)

1. `BrandingConfigService.initialize()` — fetches `/config`, stores `default_theme`
2. `UserPreferencesService.initialize()` — loads prefs; for new users, consults `BrandingConfigService.defaultTheme`
3. `ThemeService` constructor — reads from `UserPreferencesService` (unchanged)
