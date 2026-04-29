# API Breaking Changes (1.4.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the tmi-ux client to match TMI server 1.4.0 API breaking changes: webhook endpoint URL migration to `/admin/` prefix, and `dataAssetIds` → `data_asset_ids` property rename.

**Architecture:** The webhook service uses `AdminServiceBase` which takes an `endpoint` string in its config. Changing the endpoint config value propagates to all CRUD operations. The `test()` method also uses `this.config.endpoint` directly. The generated types file is auto-generated from the OpenAPI spec and needs regeneration. The `dataAssetIds` property only exists in the generated types — no application code references it directly.

**Tech Stack:** Angular, TypeScript, Vitest, openapi-typescript

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `src/app/core/services/webhook.service.ts` | Modify | Change endpoint from `webhooks/subscriptions` to `admin/webhooks/subscriptions` |
| `src/app/core/services/webhook.service.spec.ts` | Modify | Update all endpoint assertions to use `admin/webhooks/subscriptions` |
| `src/app/types/webhook.types.ts` | Modify | Update JSDoc comment referencing old path |
| `src/app/generated/api-types.d.ts` | Regenerate | Regenerate from local OpenAPI spec to get updated paths and `data_asset_ids` |

---

### Task 1: Update webhook service endpoint

**Files:**
- Modify: `src/app/core/services/webhook.service.ts:26`

- [ ] **Step 1: Update the endpoint config**

In `src/app/core/services/webhook.service.ts`, change the constructor's `endpoint` value:

```typescript
// Before:
    super(apiService, logger, {
      endpoint: 'webhooks/subscriptions',
      entityName: 'webhook',
    });

// After:
    super(apiService, logger, {
      endpoint: 'admin/webhooks/subscriptions',
      entityName: 'webhook',
    });
```

This single change propagates to `list()`, `get()`, `create()`, `update()`, `delete()`, and `test()` since they all use `this.config.endpoint`.

---

### Task 2: Update webhook service tests

**Files:**
- Modify: `src/app/core/services/webhook.service.spec.ts`

- [ ] **Step 1: Replace all endpoint strings in test assertions**

In `src/app/core/services/webhook.service.spec.ts`, replace every occurrence of `'webhooks/subscriptions` with `'admin/webhooks/subscriptions`:

| Line | Old | New |
|------|-----|-----|
| 105 | `'webhooks/subscriptions'` | `'admin/webhooks/subscriptions'` |
| 136 | `'webhooks/subscriptions'` | `'admin/webhooks/subscriptions'` |
| 151 | `'webhooks/subscriptions'` | `'admin/webhooks/subscriptions'` |
| 168 | `'webhooks/subscriptions'` | `'admin/webhooks/subscriptions'` |
| 184 | `'webhooks/subscriptions'` | `'admin/webhooks/subscriptions'` |
| 196 | `'webhooks/subscriptions'` | `'admin/webhooks/subscriptions'` |
| 220 | `'webhooks/subscriptions/webhook-123'` | `'admin/webhooks/subscriptions/webhook-123'` |
| 253 | `'webhooks/subscriptions'` | `'admin/webhooks/subscriptions'` |
| 276 | `'webhooks/subscriptions'` | `'admin/webhooks/subscriptions'` |
| 312 | `'webhooks/subscriptions/webhook-123'` | `'admin/webhooks/subscriptions/webhook-123'` |
| 336 | `'webhooks/subscriptions'` | `'admin/webhooks/subscriptions'` |
| 372 | `'webhooks/subscriptions/webhook-123'` | `'admin/webhooks/subscriptions/webhook-123'` |
| 389 | `'webhooks/subscriptions'` | `'admin/webhooks/subscriptions'` |
| 425 | `'webhooks/subscriptions/webhook-123/test'` | `'admin/webhooks/subscriptions/webhook-123/test'` |

Use find-and-replace for `'webhooks/subscriptions` → `'admin/webhooks/subscriptions` across the file.

- [ ] **Step 2: Run the webhook service tests**

Run: `pnpm run test src/app/core/services/webhook.service.spec.ts`
Expected: All tests PASS with the updated endpoint paths.

- [ ] **Step 3: Commit**

```bash
git add src/app/core/services/webhook.service.ts src/app/core/services/webhook.service.spec.ts
git commit -m "fix(api): move webhook endpoints to /admin/ prefix for server 1.4.0"
```

---

### Task 3: Update webhook types JSDoc comment

**Files:**
- Modify: `src/app/types/webhook.types.ts:3`

- [ ] **Step 1: Update the path reference in the comment**

```typescript
// Before:
 * Based on TMI API /webhooks/subscriptions endpoints

// After:
 * Based on TMI API /admin/webhooks/subscriptions endpoints
```

- [ ] **Step 2: Commit**

```bash
git add src/app/types/webhook.types.ts
git commit -m "docs: update webhook types JSDoc to reference new admin path"
```

---

### Task 4: Regenerate API types from local OpenAPI spec

**Files:**
- Regenerate: `src/app/generated/api-types.d.ts`

- [ ] **Step 1: Regenerate types from local schema**

Run: `OPENAPI_SPEC=/Users/efitz/Projects/tmi/api-schema/tmi-openapi.json pnpm run generate:api-types`

This updates the generated types to include:
- All webhook paths under `/admin/webhooks/...`
- `data_asset_ids` instead of `dataAssetIds` in `MinimalNode` and `MinimalEdge`
- Updated operationId casing (no client code impact)

- [ ] **Step 2: Verify `dataAssetIds` is gone and `data_asset_ids` is present**

Run: `grep -c 'dataAssetIds' src/app/generated/api-types.d.ts` — Expected: 0
Run: `grep -c 'data_asset_ids' src/app/generated/api-types.d.ts` — Expected: > 0

- [ ] **Step 3: Build**

Run: `pnpm run build`
Expected: Build succeeds. If any application code was referencing `dataAssetIds` from the generated types, the build will catch it. (Based on our search, no app code uses this field directly.)

- [ ] **Step 4: Run all tests**

Run: `pnpm run test`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/generated/api-types.d.ts
git commit -m "fix(api): regenerate types from TMI server 1.4.0 OpenAPI spec"
```

---

### Task 5: Final verification

- [ ] **Step 1: Lint**

Run: `pnpm run lint:all`
Expected: No lint errors.

- [ ] **Step 2: Full build**

Run: `pnpm run build`
Expected: Clean build.

- [ ] **Step 3: Full test suite**

Run: `pnpm run test`
Expected: All tests pass.
