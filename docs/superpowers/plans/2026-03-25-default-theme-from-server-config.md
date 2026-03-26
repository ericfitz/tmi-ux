# Default Theme from Server Config — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `ui.default_theme` from server config through to `UserPreferencesService` so new users get the server-configured default theme instead of hardcoded `'automatic'`.

**Architecture:** `BrandingConfigService` exposes a validated `defaultTheme` getter. `app.config.ts` sequences branding init before user preferences init. `UserPreferencesService` injects `BrandingConfigService` and consults `defaultTheme` when no user preference exists.

**Tech Stack:** Angular 19, TypeScript, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/core/services/branding-config.service.ts` | Modify | Add `defaultTheme` getter with validation/mapping |
| `src/app/core/services/branding-config.service.spec.ts` | Modify | Add tests for `defaultTheme` getter |
| `src/app/core/services/user-preferences.service.ts` | Modify | Inject `BrandingConfigService`, use `defaultTheme` for new users |
| `src/app/core/services/user-preferences.service.spec.ts` | Modify | Add tests for server default theme fallback |
| `src/app/app.config.ts` | Modify | Add `BrandingConfigService` dep to `initializeUserPreferences` |

---

### Task 1: Add `defaultTheme` getter to `BrandingConfigService`

**Files:**
- Modify: `src/app/core/services/branding-config.service.ts:77-104`
- Test: `src/app/core/services/branding-config.service.spec.ts`

- [ ] **Step 1: Write failing tests for `defaultTheme` getter**

Add a new `describe` block at the end of the `BrandingConfigService` test suite (before the closing `});`):

```typescript
  describe('defaultTheme', () => {
    it('should return null before initialization', () => {
      expect(service.defaultTheme).toBeNull();
    });

    it('should return "automatic" when server sends "auto"', async () => {
      const configWithTheme = { ui: { default_theme: 'auto' } };
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(configWithTheme))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      expect(service.defaultTheme).toBe('automatic');
    });

    it('should return "light" when server sends "light"', async () => {
      const configWithTheme = { ui: { default_theme: 'light' } };
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(configWithTheme))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      expect(service.defaultTheme).toBe('light');
    });

    it('should return "dark" when server sends "dark"', async () => {
      const configWithTheme = { ui: { default_theme: 'dark' } };
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(configWithTheme))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      expect(service.defaultTheme).toBe('dark');
    });

    it('should return null when server sends invalid value', async () => {
      const configWithBadTheme = { ui: { default_theme: 'neon' } };
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(configWithBadTheme))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      expect(service.defaultTheme).toBeNull();
    });

    it('should return null when server config has no default_theme', async () => {
      const configNoTheme = { ui: { organization_name: 'Test' } };
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse(configNoTheme))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      expect(service.defaultTheme).toBeNull();
    });

    it('should return null when server config has no ui section', async () => {
      fetchSpy
        .mockResolvedValueOnce(createConfigResponse({ features: {} }))
        .mockResolvedValueOnce(createPngResponse());

      await service.initialize();

      expect(service.defaultTheme).toBeNull();
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm run test src/app/core/services/branding-config.service.spec.ts`
Expected: FAIL — `service.defaultTheme` is not a property

- [ ] **Step 3: Implement `defaultTheme` getter**

In `src/app/core/services/branding-config.service.ts`, add this import at the top (after the existing imports):

```typescript
import type { ThemeMode } from './theme.service';
```

Then add the following getter alongside the other synchronous getters (after the `userHyperlinkProvider` getter around line 104):

```typescript
  /** Server-configured default theme, mapped to client ThemeMode. Null if not set or invalid. */
  get defaultTheme(): ThemeMode | null {
    const raw = this.config$.value?.ui?.default_theme;
    if (!raw) return null;
    if (raw === 'auto') return 'automatic';
    if (raw === 'light' || raw === 'dark') return raw;
    return null;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test src/app/core/services/branding-config.service.spec.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/branding-config.service.ts src/app/core/services/branding-config.service.spec.ts
git commit -m "feat: expose defaultTheme getter on BrandingConfigService

Maps server ui.default_theme ('auto'|'light'|'dark') to client
ThemeMode ('automatic'|'light'|'dark'). Returns null if absent or invalid.

Refs #528"
```

---

### Task 2: Wire `BrandingConfigService` into `UserPreferencesService` for new-user default

**Files:**
- Modify: `src/app/core/services/user-preferences.service.ts:1-7,91-154`
- Test: `src/app/core/services/user-preferences.service.spec.ts`

- [ ] **Step 1: Write failing tests for server default theme behavior**

In `src/app/core/services/user-preferences.service.spec.ts`, add the `BrandingConfigService` import:

```typescript
import { BrandingConfigService } from './branding-config.service';
```

Add `mockBrandingConfigService` to the test setup. In the variables section (around line 33):

```typescript
  let mockBrandingConfigService: {
    defaultTheme: ReturnType<typeof vi.fn>;
  };
```

In `beforeEach`, before the `envInjector = createEnvironmentInjector(...)` call, add:

```typescript
    mockBrandingConfigService = {
      defaultTheme: vi.fn().mockReturnValue(null),
    };
```

Note: since `defaultTheme` is a getter on the real service, and we're providing it as a mock value, we need to define it as a property. Update the mock to use `Object.defineProperty`:

```typescript
    mockBrandingConfigService = {} as any;
    Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
      get: vi.fn().mockReturnValue(null),
      configurable: true,
    });
```

Add `BrandingConfigService` to the `envInjector` providers array:

```typescript
        { provide: BrandingConfigService, useValue: mockBrandingConfigService },
```

Add a new `describe` block after the `initialize` describe block:

```typescript
  describe('server default theme', () => {
    it('should use server default theme for new user with no localStorage and no server prefs', async () => {
      Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
        get: vi.fn().mockReturnValue('dark'),
        configurable: true,
      });

      await service.initialize();

      expect(service.getPreferences().themeMode).toBe('dark');
    });

    it('should use "automatic" when server default theme is null', async () => {
      Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
        get: vi.fn().mockReturnValue(null),
        configurable: true,
      });

      await service.initialize();

      expect(service.getPreferences().themeMode).toBe('automatic');
    });

    it('should not override existing localStorage preferences with server default', async () => {
      Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
        get: vi.fn().mockReturnValue('dark'),
        configurable: true,
      });
      localStorage.setItem(
        'tmi_preferences_v2',
        JSON.stringify({ themeMode: 'light' }),
      );

      await service.initialize();

      expect(service.getPreferences().themeMode).toBe('light');
    });

    it('should not override server user preferences with server default theme', async () => {
      Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
        get: vi.fn().mockReturnValue('dark'),
        configurable: true,
      });
      mockAuthService.isAuthenticated = true;
      mockApiService.get.mockReturnValue(
        of({ 'tmi-ux': { ...DEFAULT_PREFERENCES, themeMode: 'light' } }),
      );

      await service.initialize();

      expect(service.getPreferences().themeMode).toBe('light');
    });
  });
```

- [ ] **Step 2: Run tests to verify new tests fail**

Run: `pnpm run test src/app/core/services/user-preferences.service.spec.ts`
Expected: The "should use server default theme for new user" test FAILS (gets `'automatic'` instead of `'dark'`)

- [ ] **Step 3: Implement server default theme in `UserPreferencesService`**

In `src/app/core/services/user-preferences.service.ts`:

Add the import at the top (after the `LoggerService` import):

```typescript
import { BrandingConfigService } from './branding-config.service';
```

Add the injection in the class body (after the `logger` injection, around line 97):

```typescript
  private readonly brandingConfigService = inject(BrandingConfigService);
```

Modify the `loadFromLocalStorage()` method. Change the final return statement (line 215) from:

```typescript
    return DEFAULT_PREFERENCES;
```

to:

```typescript
    return this.applyServerDefaultTheme(DEFAULT_PREFERENCES);
```

Add the helper method after `loadFromLocalStorage()`:

```typescript
  /**
   * Apply server-configured default theme when user has no saved preference.
   * Only modifies the themeMode field; all other defaults remain unchanged.
   */
  private applyServerDefaultTheme(defaults: UserPreferencesData): UserPreferencesData {
    const serverTheme = this.brandingConfigService.defaultTheme;
    if (!serverTheme) {
      return defaults;
    }
    return { ...defaults, themeMode: serverTheme };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm run test src/app/core/services/user-preferences.service.spec.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/services/user-preferences.service.ts src/app/core/services/user-preferences.service.spec.ts
git commit -m "feat: use server default theme for new users in UserPreferencesService

When no saved preferences exist (no localStorage, no server prefs),
consults BrandingConfigService.defaultTheme instead of hardcoding
'automatic'. Existing users are unaffected.

Refs #528"
```

---

### Task 3: Sequence `BrandingConfigService` before `UserPreferencesService` in `app.config.ts`

**Files:**
- Modify: `src/app/app.config.ts:100-104,232-237`

- [ ] **Step 1: Update `initializeUserPreferences` factory function**

In `src/app/app.config.ts`, change the `initializeUserPreferences` function (around line 100) from:

```typescript
function initializeUserPreferences(
  userPreferencesService: UserPreferencesService,
): () => Promise<void> {
  return () => userPreferencesService.initialize();
}
```

to:

```typescript
function initializeUserPreferences(
  userPreferencesService: UserPreferencesService,
  _brandingConfigService: BrandingConfigService,
): () => Promise<void> {
  // BrandingConfigService is listed as a dependency to ensure its APP_INITIALIZER
  // completes before this one runs (Angular resolves initializer deps sequentially).
  return () => userPreferencesService.initialize();
}
```

Note: `_brandingConfigService` is used for dependency ordering only — Angular ensures its initializer completes first. However, per project conventions, we should not prefix unused params with `_`. Since the param IS used (for DI ordering), but not referenced in the function body, add a brief eslint disable if needed. Actually, the parameter IS serving a purpose (ordering), but TypeScript will warn about unused params. The simplest approach: reference it to satisfy the linter:

```typescript
function initializeUserPreferences(
  userPreferencesService: UserPreferencesService,
  brandingConfigService: BrandingConfigService,
): () => Promise<void> {
  // BrandingConfigService dep ensures its APP_INITIALIZER completes first,
  // so defaultTheme is available when UserPreferencesService initializes.
  void brandingConfigService;
  return () => userPreferencesService.initialize();
}
```

- [ ] **Step 2: Update the APP_INITIALIZER provider to include `BrandingConfigService` as a dependency**

Change the user preferences APP_INITIALIZER registration (around line 232-237) from:

```typescript
    {
      provide: APP_INITIALIZER,
      useFactory: initializeUserPreferences,
      deps: [UserPreferencesService],
      multi: true,
    },
```

to:

```typescript
    {
      provide: APP_INITIALIZER,
      useFactory: initializeUserPreferences,
      deps: [UserPreferencesService, BrandingConfigService],
      multi: true,
    },
```

- [ ] **Step 3: Verify `BrandingConfigService` is already imported**

Check if `BrandingConfigService` is already imported in `app.config.ts`. It should be (since `initializeBrandingConfig` already uses it). If not, add:

```typescript
import { BrandingConfigService } from './core/services/branding-config.service';
```

- [ ] **Step 4: Run build to verify no compilation errors**

Run: `pnpm run build`
Expected: Build succeeds

- [ ] **Step 5: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass

- [ ] **Step 6: Run lint**

Run: `pnpm run lint:all`
Expected: No lint errors

- [ ] **Step 7: Commit**

```bash
git add src/app/app.config.ts
git commit -m "feat: sequence branding config init before user preferences init

Adds BrandingConfigService as a dependency of the UserPreferencesService
APP_INITIALIZER so that server default_theme is available when preferences
initialize.

Closes #528"
```
