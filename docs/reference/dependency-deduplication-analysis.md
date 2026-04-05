# Dependency Deduplication Analysis

Date: 2026-03-28
Tool: [@e18e/cli](https://github.com/AriPerkkio/e18e) v0.5.0
Branch: dev/1.4.0
Commit: 29dc9423

## Context

e18e reported 128 duplicate dependencies in the tmi-ux project. This document records the investigation of all duplicates that affect production (non-development) dependency chains, the breaking change analysis for each potential override, and the resulting actions taken.

## Methodology

For each duplicate, we:

1. Traced the full dependency tree using `pnpm why <package>` to determine whether the duplicate flows through production or dev-only paths
2. Checked whether the upstream consuming package is at its latest version (i.e., whether upgrading it would resolve the duplicate)
3. Researched breaking changes between the duplicate versions using upstream changelogs, release notes, and source code
4. Assessed whether a pnpm override could safely force deduplication

## Production Duplicates Investigated

### 1. tslib (1.14.1 + 2.8.1) -- RESOLVED

**Consumers:**
- tslib@2.8.1: Angular, rxjs, and 60+ other packages
- tslib@1.14.1: pdf-lib@1.17.1 (`^1.11.1`), tsyringe@4.10.0 (`^1.9.3`)

**Breaking changes in 2.x:**
- `__exportStar`/`__importStar` changed to use `__createBinding` (getter-based vs direct assignment)
- Only affects code compiled with TypeScript <=3.8 that does complex `export *` re-export patterns
- All helper functions from 1.x preserved; 2.x is a strict superset (adds 9 new helpers)

**Assessment:** Low risk. Neither pdf-lib nor tsyringe uses the affected `__exportStar` code paths. Both use only basic helpers (`__extends`, `__assign`, `__awaiter`, `__decorate`, etc.) which are identical in both versions.

**Action:** Added override `"tslib": "^2.8.1"`

**Upstream status:** pdf-lib@1.17.1 and tsyringe@4.10.0 are both the latest releases and appear unmaintained. Neither will update their tslib pin.

---

### 2. marked (16.4.2 + 17.0.5) -- RESOLVED

**Consumers:**
- marked@17.0.5: our direct dep, ngx-markdown@21.1.0
- marked@16.4.2: mermaid@11.13.0 (`^16.3.0`)

**Breaking changes in 17.0.0 (single PR #3755):**
1. `parser.parse()` `top` parameter removed
2. Consecutive text token handling in lists removed from parser (moved to tokenizer)
3. `listItem` renderer simplified -- checkbox HTML no longer injected inline
4. `Checkbox` token gained `type` and `raw` properties, added to `MarkedToken` union
5. Loose list text tokens converted to `paragraph` type in tokenizer instead of parser

**Assessment:** Low risk. Mermaid only calls `marked.lexer()` (in `handle-markdown-text.ts`) and manually walks paragraph/text/inline tokens. It never uses the parser, renderer, list handling, or checkbox handling -- all five breaking changes are in code paths mermaid doesn't touch.

**Action:** Added override `"marked": "^17.0.5"`

**Upstream status:** mermaid@11.13.0 is the latest release. Must wait for mermaid to bump its marked peer dependency.

---

### 3. uuid (8.3.2 + 11.1.0 + 13.0.0) -- NOT RESOLVED

**Consumers:**
- uuid@13.0.0: our direct dep
- uuid@11.1.0: mermaid@11.13.0 (`^11.1.0`) -- production
- uuid@8.3.2: sockjs@0.3.24 (`^8.3.2`) -- dev only (via webpack-dev-server)

**Breaking changes:**
- v12.0.0: **CJS removed entirely.** `require('uuid')` throws `ERR_REQUIRE_ESM`
- v13.0.0: Fixed export map ordering (browser build as default)

**Assessment:**
- Mermaid: **No risk** -- mermaid bundles uuid@11.1.0 inline in its dist files. A pnpm override would have zero effect on the actual code that runs.
- sockjs: **High risk** -- uses `require('uuid').v4` (CJS). Forcing uuid@13 would crash `pnpm run dev` with `ERR_REQUIRE_ESM`.

**Action:** No override. Mermaid override is pointless (uuid already bundled). sockjs override would break the dev server. A scoped override (`"sockjs>uuid": "^8.3.2"` + global `"uuid": "^13.0.0"`) is possible but provides no net benefit since mermaid's copy is baked in.

**Upstream status:** sockjs@0.3.24 is ancient and unmaintained, bundled via webpack-dev-server. mermaid@11.13.0 is latest.

---

### 4. pako (0.2.9 + 1.0.11) -- RESOLVED

**Consumers:**
- pako@1.0.11: pdf-lib@1.17.1 and sub-packages (`^1.0.4`)
- pako@0.2.9: unicode-trie@2.0.0 via fontkit@2.0.4 (`~0.2.8`)

**Breaking changes in 1.0.0:**
- None. The 1.0.0 release was explicitly described as a "maintenance release (semver, coding style)." The public API is identical.
- v0.2.9 was actually a backport of the v1.0.2 bug fix -- the two versions are functionally equivalent.

**Assessment:** Low risk. Furthermore, unicode-trie doesn't even use pako at runtime -- it uses `tiny-inflate` for decompression. Pako is only referenced in unicode-trie's `builder.js` (a codegen tool, not shipped code).

**Action:** Added override `"pako": "^1.0.11"`

**Upstream status:** fontkit@2.0.4 is the latest. The `~0.2.8` pin in unicode-trie is a historical artifact.

---

### 5. iconv-lite (0.6.3 + 0.7.2) -- RESOLVED

**Consumers:**
- iconv-lite@0.7.2: express body-parser (via raw-body)
- iconv-lite@0.6.3: d3-dsv@3.0.1 via mermaid -> d3 (`"iconv-lite": "0.6"`)

**Breaking changes in 0.7.0:**
- Dropped Node.js <18 support (removed `safe-buffer` and `object-assign` polyfills)
- Core `decode()`/`encode()` API unchanged
- Project moved from `ashtuchkin/iconv-lite` to `pillarjs/iconv-lite`

**Assessment:** Low risk. d3-dsv only uses iconv-lite in its CLI bin scripts (`bin/dsv2dsv.js`, etc.), never in the library code that gets imported at runtime by mermaid or our Angular app.

**Action:** Added override `"iconv-lite": "^0.7.2"`

**Upstream status:** d3-dsv@3.0.1 is the latest. The `0.6` pin predates the 0.7 release.

---

### 6. cosmiconfig (8.3.6 + 9.0.1) -- RESOLVED

**Consumers:**
- cosmiconfig@9.0.1: postcss-loader, stylelint
- cosmiconfig@8.3.6: @jsverse/transloco-utils@8.2.1 (`^8.1.3`)

**Breaking changes in 9.0.0:**
1. Default `searchStrategy` changed from upward traversal to `'none'` (current directory only)
2. Meta config file lookup location moved to `.config` subfolder
3. `searchPlaces` merging behavior changed in meta config

**Assessment:** Low risk. transloco-utils calls `cosmiconfigSync('transloco')` with an explicit path argument (resolved against `process.cwd()`). Since transloco config files live at the project root where `cwd()` points, the search-strategy change has no effect. Meta config and searchPlaces changes are irrelevant (transloco-utils uses neither).

**Edge case:** A user who places `transloco.config.js` in a parent directory and relies on upward traversal would be affected. This is an unusual and undocumented usage pattern.

**Action:** Added override `"cosmiconfig": "^9.0.1"`

**Upstream status:** @jsverse/transloco-utils@8.2.1 is the latest release.

## Dev-Only Duplicates (Not Investigated)

The remaining ~123 duplicates are in dev-only dependency chains (webpack, babel, eslint, Angular CLI tooling, etc.). These do not affect the production bundle and are caused by upstream packages pinning older versions. Notable examples:

| Duplicate | Cause |
|-----------|-------|
| express 4.22.1 + 5.2.1 | webpack-dev-server pins express `^4.22.1` |
| vite 7.3.1 + 8.0.3 | @angular/build hard-pins vite 7.3.1 |
| glob 7.2.3 + 13.0.6 | e18e's own dep tree pulls glob 7 via rimraf@2.6.3 |
| rolldown rc.4 + rc.12 | @angular/build vs vite 8 use different rolldown versions |
| semver 5.7.2 + 6.3.1 + 7.7.4 | babel pins 6.x, make-dir pins 5.x |
| chokidar 3.6.0 + 4.0.3 + 5.0.0 | webpack-dev-server, sass, Angular use different majors |

## Summary of Changes

**pnpm overrides added in package.json:**

```json
"tslib": "^2.8.1",
"marked": "^17.0.5",
"pako": "^1.0.11",
"iconv-lite": "^0.7.2",
"cosmiconfig": "^9.0.1"
```

**Result:** e18e duplicate dependency count reduced from 128 to 123.

## When to Revisit

- **uuid:** When webpack-dev-server drops sockjs or sockjs updates to ESM-compatible uuid
- **express:** When webpack-dev-server supports Express 5
- **vite:** When @angular/build targets vite 8
- **marked:** Override can be removed when mermaid bumps to `^17.0.0`
- **tslib:** Override can be removed if pdf-lib or tsyringe release updates targeting tslib 2.x (unlikely -- both appear unmaintained)
- **pako:** Override can be removed when unicode-trie updates its pin (unlikely -- historical artifact)
- **iconv-lite:** Override can be removed when d3-dsv updates its pin
- **cosmiconfig:** Override can be removed when @jsverse/transloco-utils updates its pin
