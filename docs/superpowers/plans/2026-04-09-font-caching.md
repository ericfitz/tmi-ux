# Font Caching Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate browser-rendered fonts to Google Fonts CDN, delete unused font files, fix the broken Roboto reference, and add cache headers for remaining self-hosted PDF fonts.

**Architecture:** Replace self-hosted `@font-face` declarations with Google Fonts `<link>` tags in `index.html`. Keep Noto Sans TTFs for PDF report generation. Add Express middleware for font caching.

**Tech Stack:** Angular 21, Express 5, Google Fonts CSS API v2

**Spec:** `docs/superpowers/specs/2026-04-09-font-caching-design.md`

---

### Task 1: Add Google Fonts `<link>` Tags to `index.html`

**Files:**
- Modify: `src/index.html`

- [ ] **Step 1: Add preconnect hints and Google Fonts stylesheet link**

In `src/index.html`, add three new `<link>` tags after the existing FontAwesome link (line 21) and before the closing `</head>`:

```html
    <!-- Google Fonts: Roboto Condensed, Roboto Mono, Material Symbols Outlined -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@100..900&family=Roboto+Mono:wght@100..700&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
      rel="stylesheet"
    />
```

- [ ] **Step 2: Verify the file looks correct**

Run: `head -30 src/index.html`

Expected: The `<head>` section contains the FontAwesome link followed by the three new Google Fonts links, then `</head>`.

- [ ] **Step 3: Commit**

```bash
git add src/index.html
git commit -m "feat: add Google Fonts CDN links for Roboto Condensed, Roboto Mono, Material Symbols"
```

---

### Task 2: Remove `fonts.scss` and Its Import

**Files:**
- Delete: `src/styles/fonts.scss`
- Modify: `src/styles.scss`

- [ ] **Step 1: Remove the `@use 'styles/fonts'` import from `styles.scss`**

In `src/styles.scss`, delete line 6:

```scss
@use 'styles/fonts';
```

The remaining `@use` statements stay as-is — they are unrelated to font loading.

- [ ] **Step 2: Delete `src/styles/fonts.scss`**

```bash
rm src/styles/fonts.scss
```

- [ ] **Step 3: Verify the build compiles**

Run: `pnpm run build`

Expected: Build succeeds. The `@font-face` declarations are no longer in the bundle — Google Fonts CSS provides them instead.

- [ ] **Step 4: Commit**

```bash
git add src/styles.scss
git rm src/styles/fonts.scss
git commit -m "refactor: remove self-hosted @font-face declarations, now served by Google Fonts CDN"
```

---

### Task 3: Delete Browser-Only Font Files

**Files:**
- Delete: `src/assets/fonts/roboto-condensed/` (entire directory)
- Delete: `src/assets/fonts/roboto-mono/` (entire directory)
- Delete: `src/assets/fonts/material-symbols/` (entire directory)
- Delete: `src/assets/fonts/ttf/NotoSansSymbols-VariableFont_wght.ttf`

- [ ] **Step 1: Delete the font directories and the unused NotoSansSymbols file**

```bash
rm -rf src/assets/fonts/roboto-condensed/
rm -rf src/assets/fonts/roboto-mono/
rm -rf src/assets/fonts/material-symbols/
rm src/assets/fonts/ttf/NotoSansSymbols-VariableFont_wght.ttf
```

- [ ] **Step 2: Verify only Noto Sans TTFs remain**

Run: `ls -la src/assets/fonts/ttf/`

Expected: 8 files remain:
- `NotoSans-Italic-VariableFont_wdth,wght.ttf`
- `NotoSans-VariableFont_wdth,wght.ttf`
- `NotoSansArabic-VariableFont_wdth,wght.ttf`
- `NotoSansHebrew-VariableFont_wdth,wght.ttf`
- `NotoSansJP-VariableFont_wght.ttf`
- `NotoSansKR-VariableFont_wght.ttf`
- `NotoSansSC-VariableFont_wght.ttf`
- `NotoSansThai-VariableFont_wdth,wght.ttf`

Run: `ls src/assets/fonts/`

Expected: Only the `ttf/` directory remains.

- [ ] **Step 3: Verify the build still succeeds**

Run: `pnpm run build`

Expected: Build succeeds. The deleted fonts are no longer referenced by any source file.

- [ ] **Step 4: Commit**

```bash
git rm -rf src/assets/fonts/roboto-condensed/
git rm -rf src/assets/fonts/roboto-mono/
git rm -rf src/assets/fonts/material-symbols/
git rm "src/assets/fonts/ttf/NotoSansSymbols-VariableFont_wght.ttf"
git commit -m "perf: remove browser-only font files now served by Google Fonts CDN

Removes ~10.6MB: Roboto Condensed (362KB), Roboto Mono (177KB),
Material Symbols Outlined (9.7MB), NotoSansSymbols (366KB, unused).

Noto Sans TTFs retained for PDF report generation (pdf-font-manager.ts)."
```

---

### Task 4: Add Font Cache Headers in `server.js`

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add font-specific static middleware before the general static middleware**

In `server.js`, add the following **before** the existing `app.use(express.static(...))` line (currently line 88):

```js
// Long-lived cache for self-hosted font files (used by PDF report generation).
// Font filenames contain version identifiers; cache is busted by redeployment.
app.use(
  '/assets/fonts',
  express.static(path.join(__dirname, 'dist/tmi-ux/browser/assets/fonts'), {
    maxAge: '1y',
    immutable: true,
  })
);
```

- [ ] **Step 2: Verify server starts without errors**

Run: `node server.js &` then `curl -s -I http://localhost:8080/assets/fonts/ttf/NotoSans-VariableFont_wdth,wght.ttf | head -10` then kill the server.

Expected: The response includes `Cache-Control: public, max-age=31536000, immutable`.

Note: This requires a prior `pnpm run build` so `dist/` exists. If testing locally, the font file must exist in `dist/tmi-ux/browser/assets/fonts/ttf/`.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "perf: add immutable cache headers for self-hosted PDF font files"
```

---

### Task 5: Lint, Build, and Test

**Files:** None (verification only)

- [ ] **Step 1: Run linter**

Run: `pnpm run lint:all`

Expected: No lint errors.

- [ ] **Step 2: Run full build**

Run: `pnpm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 3: Run tests**

Run: `pnpm test`

Expected: All tests pass. No font-related tests exist that would break, but PDF report tests reference font paths indirectly — confirm no regressions.

- [ ] **Step 4: Fix any issues found in steps 1-3, commit fixes if needed**
