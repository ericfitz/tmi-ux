# Font Caching: Migrate to Google Fonts CDN

**Issue:** [#567 — perf: improve font file caching](https://github.com/ericfitz/tmi-ux/issues/567)
**Date:** 2026-04-09

## Problem

Font files (52MB of TTFs) are self-hosted under `src/assets/fonts/` with absolute URLs in `@font-face` declarations. The Angular/Vite bundler treats absolute URLs as public paths — no fingerprinting, no content hashing. The Express server serves them with default cache headers, so browsers re-download fonts on each visit.

Additional issues discovered during analysis:

- `fonts.scss` references `roboto/Roboto-VariableFont.ttf` but this file does not exist — the `@font-face` declaration is broken.
- All Noto Sans language variants are declared via `@font-face` with `unicode-range` but are never referenced in any `font-family` CSS rule — they are dead CSS.
- `NotoSansSymbols` is unused by both CSS and the PDF report generator.

## Decision

Migrate browser-rendered fonts (Roboto Condensed, Roboto Mono, Material Symbols Outlined) to Google Fonts CDN. Keep Noto Sans TTF files self-hosted because the PDF report generator (`pdf-font-manager.ts`) fetches raw font bytes at runtime to embed in PDFs via `pdf-lib`.

### Why Google Fonts CDN

- All fonts are Google Fonts; the CSP already whitelists `fonts.googleapis.com` and `fonts.gstatic.com`.
- Google CDN handles WOFF2 delivery, browser-optimized subsetting, and long-lived cache headers.
- Removes ~10.6MB of font files from the repository (browser-only fonts).
- Eliminates the broken Roboto font reference.

### Why Keep Noto Sans Self-Hosted

- `pdf-font-manager.ts` uses `fetch()` to download TTF files and `PDFDocument.embedFont()` to embed them in generated PDFs. This requires actual font file bytes accessible at a URL — Google Fonts CSS `<link>` tags cannot serve this purpose.

## Changes

### 1. Add Google Fonts `<link>` Tags to `index.html`

Add preconnect hints and stylesheet links to `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@100..900&family=Roboto+Mono:wght@100..700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap" rel="stylesheet">
```

- **Roboto (plain)** is dropped — the font file was already missing and nothing references `font-family: Roboto` except the dead `@font-face` declaration.
- **Material Symbols Outlined** is requested at exact variation settings (FILL=0, wght=400, GRAD=0, opsz=24) rather than the full variable range, reducing download size from 9.7MB to a fraction of that.

### 2. Delete `fonts.scss`

All `@font-face` declarations become unnecessary:

- Browser fonts are handled by Google Fonts CSS.
- Noto Sans `@font-face` declarations were dead CSS (never referenced in any `font-family` rule).

Remove `@use 'styles/fonts'` from `styles.scss`. Delete `src/styles/fonts.scss`.

### 3. Delete Browser-Only Font Files

Remove:

- `src/assets/fonts/roboto-condensed/` (362KB)
- `src/assets/fonts/roboto-mono/` (177KB)
- `src/assets/fonts/material-symbols/` (9.7MB)
- `src/assets/fonts/ttf/NotoSansSymbols-VariableFont_wght.ttf` (366KB, unused by CSS and PDF)

Keep all other files in `src/assets/fonts/ttf/` (Noto Sans base + 7 language variants for PDF generation).

### 4. Add Cache Headers for Remaining Font Assets (`server.js`)

Add static middleware for font files with long-lived cache headers, before the general `express.static` call:

```js
app.use('/assets/fonts', express.static(
  path.join(__dirname, 'dist/tmi-ux/browser/assets/fonts'),
  { maxAge: '1y', immutable: true }
));
```

Font filenames include version identifiers (e.g., `NotoSans-VariableFont_wdth,wght.ttf`), so long-lived immutable caching is safe. Font file changes would require a deployment, which replaces the container image.

### 5. Update About Page

Keep the Noto Sans attribution in `about.component.ts` (the fonts are still shipped for PDF reports). No changes needed to the fonts array.

### 6. No CSP Changes

The Content Security Policy in `security-config.service.ts` already includes:

- `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
- `font-src 'self' https://fonts.gstatic.com data:`

### 7. No `angular.json` Changes

The existing asset configuration (`src/assets → assets`) handles the remaining font files. No font-specific config exists.

## Files Changed

| File | Action |
|------|--------|
| `src/index.html` | Add Google Fonts `<link>` tags and preconnect hints |
| `src/styles.scss` | Remove `@use 'styles/fonts'` |
| `src/styles/fonts.scss` | Delete |
| `src/assets/fonts/roboto-condensed/` | Delete directory |
| `src/assets/fonts/roboto-mono/` | Delete directory |
| `src/assets/fonts/material-symbols/` | Delete directory |
| `src/assets/fonts/ttf/NotoSansSymbols-VariableFont_wght.ttf` | Delete file |
| `server.js` | Add font cache headers middleware |

## Out of Scope

- Converting remaining Noto Sans TTFs to WOFF2 (pdf-lib requires TTF/OTF format)
- Adding Noto Sans to the browser font-family fallback chain for i18n support (separate feature)
- Subresource Integrity (SRI) for Google Fonts links (Google Fonts CSS responses are dynamic per browser, so SRI hashes would break)
