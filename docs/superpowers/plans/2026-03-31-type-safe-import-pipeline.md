# Type-Safe Import Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all `as unknown as` casts in the import pipeline by making filter and rewriter methods return typed API objects.

**Architecture:** Change `ReadonlyFieldFilterService` from block-list filtering (returns `Record<string, unknown>`) to allow-list construction (returns typed API input types). Update `ReferenceRewriterService` to accept/return the same typed inputs. Remove all 8 `as unknown as` casts in `ImportOrchestratorService`. The diagram update payload in the orchestrator also gets typed construction.

**Tech Stack:** Angular, TypeScript, openapi-typescript generated types, Vitest

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/pages/tm/services/import/readonly-field-filter.service.ts` | Modify | Change filter methods to return typed API objects via allow-list construction |
| `src/app/pages/tm/services/import/readonly-field-filter.service.spec.ts` | Modify | Update test assertions for new return types |
| `src/app/pages/tm/services/import/reference-rewriter.service.ts` | Modify | Change method signatures to accept/return typed API objects |
| `src/app/pages/tm/services/import/reference-rewriter.service.spec.ts` | Modify | Update test data to use typed inputs |
| `src/app/pages/tm/services/import/import-orchestrator.service.ts` | Modify | Remove `as unknown as` casts, type diagram update payload |
| `src/app/pages/tm/services/import/import-orchestrator.service.spec.ts` | Modify | Update mock return types for filter/rewriter |

---

## Type Reference

These are the generated API input types from `src/app/generated/api-types.d.ts` (via `api-type-helpers.ts`):

**ApiThreatModelInput** fields: `name`, `description?`, `threat_model_framework?`, `authorization?`, `metadata?`, `issue_uri?`, `is_confidential`

**ApiThreatInput** (= ThreatBase) fields: `name`, `description?`, `mitigation?`, `diagram_id?`, `cell_id?`, `severity?`, `score?`, `priority?`, `mitigated?`, `status?`, `threat_type`, `metadata?`, `issue_uri?`, `asset_id?`, `cwe_id?`, `cvss?`, `include_in_report`, `timmy_enabled`

**ApiAssetInput** (= AssetBase) fields: `name`, `description?`, `type`, `criticality?`, `classification?`, `sensitivity?`, `include_in_report`, `timmy_enabled`

**ApiNoteInput** (= NoteBase) fields: `name`, `content`, `description?`, `include_in_report`, `timmy_enabled`

**ApiDocumentInput** (= DocumentBase) fields: `name`, `description?`, `uri`, `include_in_report`, `timmy_enabled`

**ApiRepositoryInput** (= RepositoryBase) fields: `name?`, `description?`, `type?`, `parameters?`, `uri`, `include_in_report`, `timmy_enabled`

**ApiCreateDiagramRequest** fields: `name`, `type` (already uses allow-list, no change needed)

**ApiDfdDiagramInput** fields: `name`, `type`, `cells`, `metadata?`, `image?`, `description?`, `include_in_report`, `timmy_enabled`, `color_palette?`

---

### Task 1: ReadonlyFieldFilterService — switch to typed allow-list returns

**Files:**
- Modify: `src/app/pages/tm/services/import/readonly-field-filter.service.ts`
- Test: `src/app/pages/tm/services/import/readonly-field-filter.service.spec.ts`

The core change: each `filter*` method constructs a typed object by picking only the fields defined in the corresponding API type, instead of removing fields from a `Record<string, unknown>`. The `_filterFields` block-list helper and per-entity readonly field arrays become unnecessary for entity types that switch to allow-list. The `_pickFields` helper and `_diagramCreateAllowedFields` stay (already used by `filterDiagram`). The `filterAuthorization`, `filterAuthorizations`, `filterCell`, and `filterCells` methods are out of scope — they don't participate in the `as unknown as` cast chain.

**Design decision:** For optional fields, only include them in the output if they are present and non-undefined in the input. This avoids sending `undefined` values to the API and preserves existing behavior where absent fields are simply not included. Required fields with defaults (`include_in_report`, `timmy_enabled`, `threat_type`, `is_confidential`) use fallback values when missing from input.

**Important:** `metadata` exists as an optional field on `ApiThreatModelInput` and `ApiThreatInput`, but the import pipeline handles it separately via metadata endpoints. We omit it from the constructed object (it's optional, so the type is satisfied) and continue returning it as a separate property. For other entity types (`NoteInput`, `AssetInput`, etc.), `metadata` is not part of the API input type at all.

- [ ] **Step 1: Update imports and add typed allow-list builder for filterThreatModel**

In `src/app/pages/tm/services/import/readonly-field-filter.service.ts`, add the API type imports and rewrite `filterThreatModel`:

```typescript
// Add at top, after existing imports:
import type {
  ApiThreatModelInput,
  ApiThreatInput,
  ApiAssetInput,
  ApiNoteInput,
  ApiDocumentInput,
  ApiRepositoryInput,
} from '@app/generated/api-type-helpers';
```

Replace `filterThreatModel` method (lines 119-126):

```typescript
  filterThreatModel(data: Record<string, unknown>): {
    filtered: ApiThreatModelInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiThreatModelInput = {
      name: data['name'] as string,
      is_confidential: (data['is_confidential'] as boolean) ?? false,
    };

    if (data['description'] != null) filtered.description = data['description'] as string;
    if (data['threat_model_framework'] != null)
      filtered.threat_model_framework = data['threat_model_framework'] as string;
    if (data['authorization'] != null)
      filtered.authorization = data['authorization'] as ApiThreatModelInput['authorization'];
    if (data['issue_uri'] != null) filtered.issue_uri = data['issue_uri'] as string;

    return { filtered, metadata };
  }
```

- [ ] **Step 2: Rewrite filterThreat**

Replace `filterThreat` method (lines 132-139):

```typescript
  filterThreat(data: Record<string, unknown>): {
    filtered: ApiThreatInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiThreatInput = {
      name: data['name'] as string,
      threat_type: (data['threat_type'] as string[]) ?? [],
      include_in_report: (data['include_in_report'] as boolean) ?? true,
      timmy_enabled: (data['timmy_enabled'] as boolean) ?? true,
    };

    if (data['description'] != null) filtered.description = data['description'] as string;
    if (data['mitigation'] != null) filtered.mitigation = data['mitigation'] as string;
    if (data['diagram_id'] != null) filtered.diagram_id = data['diagram_id'] as string;
    if (data['cell_id'] != null) filtered.cell_id = data['cell_id'] as string;
    if (data['severity'] != null) filtered.severity = data['severity'] as string;
    if (data['score'] != null) filtered.score = data['score'] as number;
    if (data['priority'] != null) filtered.priority = data['priority'] as string;
    if (data['mitigated'] != null) filtered.mitigated = data['mitigated'] as boolean;
    if (data['status'] != null) filtered.status = data['status'] as string;
    if (data['issue_uri'] != null) filtered.issue_uri = data['issue_uri'] as string;
    if (data['asset_id'] != null) filtered.asset_id = data['asset_id'] as string;
    if (data['cwe_id'] != null) filtered.cwe_id = data['cwe_id'] as string[];
    if (data['cvss'] != null) filtered.cvss = data['cvss'] as ApiThreatInput['cvss'];

    return { filtered, metadata };
  }
```

- [ ] **Step 3: Rewrite filterAsset**

Replace `filterAsset` method (lines 197-204):

```typescript
  filterAsset(data: Record<string, unknown>): {
    filtered: ApiAssetInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiAssetInput = {
      name: data['name'] as string,
      type: (data['type'] as ApiAssetInput['type']) ?? 'data',
      include_in_report: (data['include_in_report'] as boolean) ?? true,
      timmy_enabled: (data['timmy_enabled'] as boolean) ?? true,
    };

    if (data['description'] != null) filtered.description = data['description'] as string;
    if (data['criticality'] != null) filtered.criticality = data['criticality'] as string;
    if (data['classification'] != null)
      filtered.classification = data['classification'] as string[];
    if (data['sensitivity'] != null) filtered.sensitivity = data['sensitivity'] as string;

    return { filtered, metadata };
  }
```

- [ ] **Step 4: Rewrite filterNote**

Replace `filterNote` method (lines 184-191):

```typescript
  filterNote(data: Record<string, unknown>): {
    filtered: ApiNoteInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiNoteInput = {
      name: data['name'] as string,
      content: (data['content'] as string) ?? '',
      include_in_report: (data['include_in_report'] as boolean) ?? true,
      timmy_enabled: (data['timmy_enabled'] as boolean) ?? true,
    };

    if (data['description'] != null) filtered.description = data['description'] as string;

    return { filtered, metadata };
  }
```

- [ ] **Step 5: Rewrite filterDocument**

Replace `filterDocument` method (lines 210-217):

```typescript
  filterDocument(data: Record<string, unknown>): {
    filtered: ApiDocumentInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiDocumentInput = {
      name: data['name'] as string,
      uri: (data['uri'] as string) ?? '',
      include_in_report: (data['include_in_report'] as boolean) ?? true,
      timmy_enabled: (data['timmy_enabled'] as boolean) ?? true,
    };

    if (data['description'] != null) filtered.description = data['description'] as string;

    return { filtered, metadata };
  }
```

- [ ] **Step 6: Rewrite filterRepository**

Replace `filterRepository` method (lines 223-230):

```typescript
  filterRepository(data: Record<string, unknown>): {
    filtered: ApiRepositoryInput;
    metadata: Metadata[] | undefined;
  } {
    const metadata = data['metadata'] as Metadata[] | undefined;

    const filtered: ApiRepositoryInput = {
      uri: (data['uri'] as string) ?? '',
      include_in_report: (data['include_in_report'] as boolean) ?? true,
      timmy_enabled: (data['timmy_enabled'] as boolean) ?? true,
    };

    if (data['name'] != null) filtered.name = data['name'] as string;
    if (data['description'] != null) filtered.description = data['description'] as string;
    if (data['type'] != null) filtered.type = data['type'] as ApiRepositoryInput['type'];
    if (data['parameters'] != null)
      filtered.parameters = data['parameters'] as ApiRepositoryInput['parameters'];

    return { filtered, metadata };
  }
```

- [ ] **Step 7: Update filterDiagram return type**

The diagram create filter already uses allow-list via `_pickFields`. Change the return type of `filtered` from `Record<string, unknown>` to `ApiCreateDiagramRequest`:

```typescript
  filterDiagram(data: Record<string, unknown>): {
    filtered: ApiCreateDiagramRequest;
    metadata: Metadata[] | undefined;
    cells: unknown[] | undefined;
    description: string | undefined;
    includeInReport: boolean | undefined;
    image: Record<string, unknown> | undefined;
    colorPalette: unknown[] | undefined;
    timmyEnabled: boolean | undefined;
  } {
    // ... existing extraction logic stays the same ...

    // Allow-list: only pass fields accepted by CreateDiagramRequest
    const picked = this._pickFields(data, this._diagramCreateAllowedFields);
    const filtered: ApiCreateDiagramRequest = {
      name: picked['name'] as string,
      type: (picked['type'] as ApiCreateDiagramRequest['type']) ?? 'DFD-1.0.0',
    };

    return {
      filtered,
      metadata,
      cells,
      description,
      includeInReport,
      image,
      colorPalette,
      timmyEnabled,
    };
  }
```

- [ ] **Step 8: Remove unused block-list readonly field arrays**

Delete the following private readonly arrays that are no longer used (the block-list approach is replaced by allow-list construction):

- `_threatModelReadOnlyFields` (lines 26-39)
- `_threatReadOnlyFields` (lines 46-51)
- `_noteReadOnlyFields` (line 66)
- `_assetReadOnlyFields` (lines 74-80)
- `_documentReadOnlyFields` (lines 88-93)
- `_repositoryReadOnlyFields` (lines 101-106)

Keep `_diagramCreateAllowedFields` (still used by `_pickFields` if needed, or remove if `filterDiagram` no longer calls `_pickFields`). Keep `_authorizationReadOnlyFields` (used by `filterAuthorization`, out of scope).

If `_filterFields` is only used by `filterAuthorization`, keep it. Check if `_pickFields` is still used; if not, remove it too.

- [ ] **Step 9: Update filter service tests**

In `src/app/pages/tm/services/import/readonly-field-filter.service.spec.ts`, update tests that check `filtered` properties. The main changes:

1. **filterThreatModel tests:** The `filtered` object now only includes fields from `ApiThreatModelInput`. The test at line 55 expects `{ name: 'My Threat Model', description: 'Test description' }` — this should still pass since the allow-list picks those fields. However, the test at line 74 expects `metadata` to be inside `filtered` — this needs to change. With the new approach, `metadata` is omitted from `filtered` (handled separately). Update:

```typescript
    it('should extract metadata separately and omit from filtered', () => {
      const mockMetadata: Metadata[] = [{ key: 'custom-key', value: 'custom-value' }];

      const data = {
        id: 'tm-123',
        name: 'My Threat Model',
        metadata: mockMetadata,
      };

      const { filtered, metadata } = service.filterThreatModel(data);

      // metadata is extracted and NOT included in filtered (handled via separate endpoint)
      expect(filtered).toEqual({
        name: 'My Threat Model',
        is_confidential: false,
      });
      expect(metadata).toEqual(mockMetadata);
    });
```

2. **filterThreatModel "preserve non-readonly fields" test** (line 81): The `filtered` object will now include `is_confidential: false` as a default. Also, `filtered.id` is no longer relevant to test (it won't exist because it's not in the allow-list). Update:

```typescript
    it('should preserve non-readonly fields', () => {
      const data = {
        name: 'My Threat Model',
        description: 'Test',
        threat_model_framework: 'STRIDE',
        id: 'tm-123',
      };

      const { filtered } = service.filterThreatModel(data);

      expect(filtered.name).toBe('My Threat Model');
      expect(filtered.description).toBe('Test');
      expect(filtered.threat_model_framework).toBe('STRIDE');
      expect((filtered as Record<string, unknown>)['id']).toBeUndefined();
    });
```

3. **filterThreat "extract metadata" test** (line 118): Same pattern — `metadata` should NOT be in `filtered`:

```typescript
    it('should extract metadata separately', () => {
      const mockMetadata: Metadata[] = [{ key: 'jira-ticket', value: 'SEC-123' }];

      const data = {
        name: 'SQL Injection',
        metadata: mockMetadata,
        id: 'threat-123',
      };

      const { filtered, metadata } = service.filterThreat(data);

      expect(filtered.name).toBe('SQL Injection');
      expect((filtered as Record<string, unknown>)['metadata']).toBeUndefined();
      expect(metadata).toEqual(mockMetadata);
    });
```

4. **filterThreat basic test** (line 99): Now includes default required fields:

```typescript
    it('should filter read-only fields from threat', () => {
      const data = {
        id: 'threat-123',
        threat_model_id: 'tm-123',
        name: 'SQL Injection',
        severity: 'high',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
      };

      const { filtered, metadata } = service.filterThreat(data);

      expect(filtered.name).toBe('SQL Injection');
      expect(filtered.severity).toBe('high');
      expect(filtered.threat_type).toEqual([]);
      expect(filtered.include_in_report).toBe(true);
      expect(filtered.timmy_enabled).toBe(true);
      expect((filtered as Record<string, unknown>)['id']).toBeUndefined();
      expect((filtered as Record<string, unknown>)['threat_model_id']).toBeUndefined();
      expect((filtered as Record<string, unknown>)['created_at']).toBeUndefined();
      expect(metadata).toBeUndefined();
    });
```

5. **filterNote test** (line 248): `text` is not a field in `ApiNoteInput` (the field is `content`). The test has `text: 'This is the note content'` — with allow-list this won't appear in output. The test should use `content` instead of `text`:

```typescript
    it('should filter read-only fields from note', () => {
      const data = {
        id: 'note-123',
        name: 'Important Note',
        content: 'This is the note content',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
        metadata: [],
      };

      const { filtered, metadata } = service.filterNote(data);

      expect(filtered.name).toBe('Important Note');
      expect(filtered.content).toBe('This is the note content');
      expect(filtered.include_in_report).toBe(true);
      expect(filtered.timmy_enabled).toBe(true);
      expect(metadata).toEqual([]);
    });
```

6. **filterAsset test** (line 285): `asset_type` is not a field in `ApiAssetInput` (the field is `type`). Update test data accordingly:

```typescript
    it('should filter read-only fields from asset', () => {
      const data = {
        id: 'asset-123',
        threat_model_id: 'tm-123',
        name: 'Database',
        type: 'data',
        created_at: '2024-01-01',
        modified_at: '2024-01-02',
        metadata: [],
      };

      const { filtered, metadata } = service.filterAsset(data);

      expect(filtered.name).toBe('Database');
      expect(filtered.type).toBe('data');
      expect(filtered.include_in_report).toBe(true);
      expect(filtered.timmy_enabled).toBe(true);
      expect(metadata).toEqual([]);
    });
```

7. **filterDocument and filterRepository tests**: Update to include default required fields in expectations (`include_in_report`, `timmy_enabled`).

8. **Edge case tests** (line 671): The "handle objects with no fields to filter" test will need updating since the allow-list adds defaults for required fields. The "handle objects with all readonly fields" test will now return an object with required defaults. The "handle empty objects" test similarly.

- [ ] **Step 10: Run filter service tests**

Run: `pnpm run test src/app/pages/tm/services/import/readonly-field-filter.service.spec.ts`
Expected: All tests pass

- [ ] **Step 11: Commit**

```bash
git add src/app/pages/tm/services/import/readonly-field-filter.service.ts src/app/pages/tm/services/import/readonly-field-filter.service.spec.ts
git commit -m "refactor: switch ReadonlyFieldFilterService to typed allow-list returns"
```

---

### Task 2: ReferenceRewriterService — typed method signatures

**Files:**
- Modify: `src/app/pages/tm/services/import/reference-rewriter.service.ts`
- Test: `src/app/pages/tm/services/import/reference-rewriter.service.spec.ts`

Change method signatures to accept and return the API input types. For the no-op methods (note, asset, document, repository), the implementation stays the same (spread copy). For threats, the rewrite logic stays the same but now operates on typed fields.

The diagram rewriter (`rewriteDiagramReferences`) is NOT part of this change — it's called on the `CreateDiagramRequest` return value which only has `name` and `type` (no cells to rewrite). Cell data asset rewriting happens separately in the orchestrator. So `rewriteDiagramReferences` keeps its `Record<string, unknown>` signature since it's called with the create payload.

- [ ] **Step 1: Update rewriter imports and method signatures**

In `src/app/pages/tm/services/import/reference-rewriter.service.ts`, add imports and update signatures:

```typescript
import type {
  ApiThreatInput,
  ApiAssetInput,
  ApiNoteInput,
  ApiDocumentInput,
  ApiRepositoryInput,
} from '@app/generated/api-type-helpers';
```

Update each method:

```typescript
  rewriteThreatReferences(threat: ApiThreatInput): ApiThreatInput {
    const rewritten = { ...threat };

    // Rewrite diagram_id if present
    if (typeof rewritten.diagram_id === 'string' && rewritten.diagram_id) {
      const newDiagramId = this._idTranslation.getDiagramId(rewritten.diagram_id);
      if (newDiagramId) {
        rewritten.diagram_id = newDiagramId;
      } else {
        console.warn(
          `Threat references unknown diagram_id: ${rewritten.diagram_id}. Reference will be cleared.`,
        );
        delete rewritten.diagram_id;
      }
    }

    // Rewrite asset_id if present
    if (typeof rewritten.asset_id === 'string' && rewritten.asset_id) {
      const newAssetId = this._idTranslation.getAssetId(rewritten.asset_id);
      if (newAssetId) {
        rewritten.asset_id = newAssetId;
      } else {
        console.warn(
          `Threat references unknown asset_id: ${rewritten.asset_id}. Reference will be cleared.`,
        );
        delete rewritten.asset_id;
      }
    }

    return rewritten;
  }

  rewriteDiagramReferences(diagram: Record<string, unknown>): Record<string, unknown> {
    // Keep existing implementation unchanged — operates on CreateDiagramRequest payload
    // ... existing code ...
  }

  rewriteNoteReferences(note: ApiNoteInput): ApiNoteInput {
    return { ...note };
  }

  rewriteAssetReferences(asset: ApiAssetInput): ApiAssetInput {
    return { ...asset };
  }

  rewriteDocumentReferences(document: ApiDocumentInput): ApiDocumentInput {
    return { ...document };
  }

  rewriteRepositoryReferences(repository: ApiRepositoryInput): ApiRepositoryInput {
    return { ...repository };
  }
```

- [ ] **Step 2: Update rewriter tests**

In `src/app/pages/tm/services/import/reference-rewriter.service.spec.ts`, the test data for `rewriteThreatReferences` currently includes fields like `id` that aren't in `ApiThreatInput`. Since the method now accepts `ApiThreatInput`, update the test data to match. However, since these tests use mock objects and TypeScript won't enforce at runtime, the tests can keep extra fields — but for correctness, update the test data to reflect realistic typed inputs.

For the no-op methods (`rewriteNoteReferences`, `rewriteAssetReferences`, etc.), test data should match their respective API input types.

No behavioral changes expected — all tests should still pass after signature updates.

- [ ] **Step 3: Run rewriter tests**

Run: `pnpm run test src/app/pages/tm/services/import/reference-rewriter.service.spec.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/services/import/reference-rewriter.service.ts src/app/pages/tm/services/import/reference-rewriter.service.spec.ts
git commit -m "refactor: type ReferenceRewriterService signatures with API input types"
```

---

### Task 3: ImportOrchestratorService — remove casts and type diagram update

**Files:**
- Modify: `src/app/pages/tm/services/import/import-orchestrator.service.ts`
- Test: `src/app/pages/tm/services/import/import-orchestrator.service.spec.ts`

With filter returning typed objects and rewriter accepting/returning the same types, all 8 `as unknown as` casts can be removed. The diagram update payload construction (lines 664-704) also gets typed as `ApiDfdDiagramInput`.

- [ ] **Step 1: Remove casts in orchestrator**

In `src/app/pages/tm/services/import/import-orchestrator.service.ts`:

1. **Line 201:** Change `filtered as unknown as ApiThreatModelInput` to just `filtered`
2. **Line 314:** Change `rewritten as unknown as ApiAssetInput` to just `rewritten`
3. **Line 396:** Change `rewritten as unknown as ApiNoteInput` to just `rewritten`
4. **Line 473:** Change `rewritten as unknown as ApiDocumentInput` to just `rewritten`
5. **Line 552:** Change `rewritten as unknown as ApiRepositoryInput` to just `rewritten`
6. **Line 638:** Change `rewritten as unknown as ApiCreateDiagramRequest` to just `rewritten` (filterDiagram now returns `ApiCreateDiagramRequest`, and `rewriteDiagramReferences` still takes/returns `Record<string, unknown>` — so this needs a cast still, OR change `rewriteDiagramReferences` to accept `ApiCreateDiagramRequest`). Actually, since `filterDiagram` now returns `ApiCreateDiagramRequest` and `rewriteDiagramReferences` still uses `Record<string, unknown>`, we need to either: (a) pass `filtered` directly to `createDiagram` without going through the rewriter (the rewriter does nothing useful for `CreateDiagramRequest` since it only has `name` and `type`), or (b) update `rewriteDiagramReferences` to accept `ApiCreateDiagramRequest`. Option (a) is simpler — remove the `rewriteDiagramReferences` call for diagram create since there's nothing to rewrite in `{name, type}`.
7. **Line 710:** Change `diagramUpdate as unknown as ApiDfdDiagramInput` — type the `diagramUpdate` variable as `ApiDfdDiagramInput` directly.
8. **Line 808:** Change `rewritten as unknown as ApiThreatInput` to just `rewritten`

For the diagram update payload (lines 664-710), replace the `Record<string, unknown>` construction with typed `ApiDfdDiagramInput`:

```typescript
          const diagramUpdate: ApiDfdDiagramInput = {
            name: created.name,
            type: 'DFD-1.0.0',
            cells: [],
            include_in_report: created.include_in_report ?? true,
            timmy_enabled: created.timmy_enabled ?? true,
          };

          if (hasCells) {
            const filteredCells = this._fieldFilter.filterCells(cells) as Record<string, unknown>[];
            diagramUpdate.cells = filteredCells.map(cell => {
              if (cell['data'] && typeof cell['data'] === 'object') {
                return {
                  ...cell,
                  data: this._referenceRewriter.rewriteCellDataAssetReferences(
                    cell['data'] as Record<string, unknown>,
                  ),
                };
              }
              return cell;
            }) as ApiDfdDiagramInput['cells'];
          }

          if (hasDescription) {
            diagramUpdate.description = description;
          }

          if (hasIncludeInReport) {
            diagramUpdate.include_in_report = includeInReport;
          }

          if (hasImage) {
            diagramUpdate.image = image as ApiDfdDiagramInput['image'];
          }

          if (hasColorPalette) {
            diagramUpdate.color_palette = colorPalette as ApiDfdDiagramInput['color_palette'];
          }

          if (hasTimmyEnabled) {
            diagramUpdate.timmy_enabled = timmyEnabled;
          }
```

- [ ] **Step 2: Remove the rewriteDiagramReferences call for diagram create**

In `_importDiagram`, the line `const rewritten = this._referenceRewriter.rewriteDiagramReferences(filtered);` and then `rewritten as unknown as ApiCreateDiagramRequest` can be replaced with passing `filtered` directly to `createDiagram`. The `CreateDiagramRequest` only has `name` and `type` — there are no references to rewrite.

Change:
```typescript
    const rewritten = this._referenceRewriter.rewriteDiagramReferences(filtered);

    return deps.createDiagram(threatModelId, rewritten as unknown as ApiCreateDiagramRequest).pipe(
```

To:
```typescript
    return deps.createDiagram(threatModelId, filtered).pipe(
```

- [ ] **Step 3: Handle the note content default**

In `_importNote` (line 392-394), the code currently mutates `rewritten['content']`. Since `rewritten` is now typed as `ApiNoteInput`, change from bracket notation to dot notation:

```typescript
    if (!rewritten.content) {
      rewritten.content = '(imported note)';
    }
```

- [ ] **Step 4: Remove unused ApiCreateDiagramRequest import if rewriteDiagramReferences no longer returns it**

Check if `ApiCreateDiagramRequest` is still needed in the orchestrator imports (it is — used by `ImportDependencies.createDiagram`). Keep the import.

- [ ] **Step 5: Update orchestrator test mock types**

In `src/app/pages/tm/services/import/import-orchestrator.service.spec.ts`, update the `defaultFilterResult` and `filterResultWithMetadata` helper functions to use typed returns instead of `Record<string, unknown>`:

```typescript
  function defaultFilterResult(
    data: Record<string, unknown> = {},
  ): {
    filtered: Record<string, unknown>;
    metadata: undefined;
  } {
    return { filtered: data, metadata: undefined };
  }
```

These helpers are used with mocks that return via `mockReturnValue`, so the actual type doesn't matter at runtime. But if the compiler complains, the mock filter methods just need their return values to have typed `filtered` properties. Since the mocks bypass the real service, the existing pattern should still work — the mock returns whatever we tell it to.

The key test to verify is `'should provide default content when note has no content field'` (line 594) — the mock returns `{ name: 'Note Without Content' }` as `filtered`, which the orchestrator then mutates to add `content`. With the typed `ApiNoteInput`, this mock value won't match the type at compile time but will work at runtime since it's a mock. No runtime changes needed.

- [ ] **Step 6: Run all import pipeline tests**

Run: `pnpm run test src/app/pages/tm/services/import/`
Expected: All tests pass

- [ ] **Step 7: Run full build**

Run: `pnpm run build`
Expected: Build succeeds with no type errors

- [ ] **Step 8: Run lint**

Run: `pnpm run lint:all`
Expected: No lint errors

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/tm/services/import/import-orchestrator.service.ts src/app/pages/tm/services/import/import-orchestrator.service.spec.ts
git commit -m "refactor: remove 'as unknown as' casts from import pipeline

Closes #543"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run full test suite**

Run: `pnpm run test`
Expected: All tests pass

- [ ] **Step 2: Verify no remaining `as unknown as` casts in import pipeline**

Run: `grep -n 'as unknown as' src/app/pages/tm/services/import/import-orchestrator.service.ts`
Expected: No matches (zero results)

Run: `grep -n 'as unknown as' src/app/pages/tm/services/import/readonly-field-filter.service.ts`
Expected: No matches

Run: `grep -n 'as unknown as' src/app/pages/tm/services/import/reference-rewriter.service.ts`
Expected: No matches

- [ ] **Step 3: Verify no `Record<string, unknown>` in filter return types**

Run: `grep -n 'Record<string, unknown>' src/app/pages/tm/services/import/readonly-field-filter.service.ts`
Expected: Only appears in method parameters (input type), `filterAuthorization` returns, `filterCell` returns, and private helpers — NOT in the `filter{Entity}` return types.
