---
name: update-json-localization-file
description: Use when modifying a JSON i18n file with additions, updates, or deletions while preserving formatting and writing atomically.
---

# Update JSON Localization File

Safely add, update, or remove keys in a JSON i18n file while preserving formatting and writing atomically.

## Inputs

- **file_path**: Path to the JSON file.
- **additions**: Object of `{ "dot.notation.key": value }` pairs to add or update.
- **deletions**: Array of dot-notation keys to remove.
- **preserve_formatting** (default `true`): Keep existing key order vs. sort alphabetically.

## Output

```json
{
  "file_path": "<path>",
  "keys_added": 5,
  "keys_updated": 3,
  "keys_deleted": 2,
  "total_keys": 450
}
```

## Process

### 1. Read current file

- File not found → start from `{}` (create on write).
- Permission denied → error out without modifying.
- Invalid JSON → error with line info if available.

### 2. Parse JSON

Preserve nested structure. Track existing keys so adds vs. updates can be distinguished.

### 3. Apply deletions

For each key in `deletions`:
- Support dot-notation for nested keys.
- Idempotent — skip silently if the key is absent.
- Leave empty parent objects in place after removing a child; do not auto-prune.

Example: deleting `about.opensource.paragraph3` removes only that leaf.

### 4. Apply additions

For each entry in `additions`:
- Support dot-notation; create intermediate objects as needed.
- If the key exists, replace the value and count as `updated`.
- If new, count as `added`.

### 5. Sort (optional)

`preserve_formatting: false` → recursive case-sensitive alphabetical sort at every nesting level.

`preserve_formatting: true` → keep existing keys' relative order; place new keys at the end of their respective objects.

### 6. Write file atomically

Formatting requirements:
- 2-space indentation
- UTF-8
- Final newline
- No trailing whitespace
- Unix line endings (`\n`)

Safe write:
1. Copy current file to `<file_path>.bak` (if it exists).
2. Write new content to `<file_path>.tmp`.
3. `rename(<tmp>, <file_path>)` for atomic replacement.
4. Preserve original permissions.

## Error Handling

| Error | Behavior |
|-------|----------|
| File not found | Create new file with additions. |
| Permission denied | Error, do not modify. |
| Disk full | Error, backup preserved. |
| Invalid JSON in source | Error with detail. |
| Delete key that doesn't exist | Skip silently (idempotent). |
| Invalid dot-notation key | Error. |
| Same key in both `additions` and `deletions` | Delete first, then add. |

## Examples

### Add new translations
```
file_path: "<locales_dir>/es-ES.json"
additions: {
  "common.save":    "Guardar",
  "common.cancel":  "Cancelar",
  "errors.network": "Error de red"
}
deletions: []
→ {keys_added: 3, keys_updated: 0, keys_deleted: 0, total_keys: 453}
```

### Update existing translation
```
additions: { "common.save": "Sauvegarder" }
deletions: []
→ {keys_added: 0, keys_updated: 1, keys_deleted: 0, total_keys: 450}
```

### Remove obsolete keys
```
additions: {}
deletions: ["deprecated.oldFeature", "legacy.button"]
→ {keys_added: 0, keys_updated: 0, keys_deleted: 2, total_keys: 448}
```

### Mixed
```
additions: { "new.feature.title": "新機能", "common.ok": "はい" }
deletions: ["old.feature.title"]
→ {keys_added: 1, keys_updated: 1, keys_deleted: 1, total_keys: 450}
```

## Implementation Notes

1. **Atomic writes**: temp + rename, always. Prevents corruption on crash.
2. **Backup retention**: one `.bak`. Use timestamped backups only when explicitly required.
3. **Key counting**: leaf keys only (string values). `about` (object) is not counted; `about.title` (string) is.
4. **Dot-notation limits**: literal dots in key names are not supported — use nested structure instead. Empty segments (`a..b`) and leading/trailing dots are invalid.
5. **Concurrent access**: this skill is not multi-writer safe. Use external locking if multiple processes may write.
6. **Validation**: after writing, optionally re-read and re-parse to confirm valid JSON.
7. **Large files** (>1MB): consider a streaming parser; typical i18n files are well under this.
