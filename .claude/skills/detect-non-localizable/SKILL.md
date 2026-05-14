---
name: detect-non-localizable
description: Use when filtering localization keys, validating translation files, or deciding whether a string value should be translated or left as-is. Returns a boolean and the matched pattern.
---

# Detect Non-Localizable Strings

Analyze a string value to determine if it should be translated or left unchanged.

## Input

- **value**: The string to check.

## Output

A boolean plus, when `true`, the name of the pattern that matched:

- **true**: String should NOT be translated (non-localizable).
- **false**: String should be translated (localizable).

## Detection Patterns

Check patterns in this order. Return `true` if any pattern matches; otherwise return `false`.

### 1. Empty or Whitespace Only
`/^\s*$/` — `""`, `"   "`, `"\n\t"`

### 2. Pure Numbers
`/^-?\d+([.,]\d+)?%?$/` — `"42"`, `"3.14"`, `"-100"`, `"50%"`, `"1,234"`

### 3. Single Special Characters
`/^[^\w\s]$/` — `":"`, `"-"`, `"•"`, `"→"`, `"|"`

### 4. URLs
`/^(https?:\/\/|www\.)|(\.(com|org|net|io|dev|edu|gov|co|app)\b)/i` — `"https://example.com"`, `"www.example.com"`

### 5. Email Addresses
`/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — `"user@example.com"`

### 6. File Paths and Extensions
`/^[.\/\\]|[\/\\][\w.-]+[\/\\]|\.(?:json|xml|ts|js|html|css|scss|png|jpg|svg|pdf|md|txt|yaml|yml)$/i` — `"/path/to/file"`, `"./relative/path"`, `"C:\\Windows\\path"`, `"config.json"`

### 7. Version Numbers
`/^v?\d+\.\d+(\.\d+)?(-[\w.]+)?(\+[\w.]+)?$/i` — `"1.2.3"`, `"v2.0"`, `"1.0.0-beta"`

### 8. API Endpoints
`/^\/(?:api|v\d+|rest|graphql)\//i` — `"/api/users"`, `"/v1/auth/login"`

### 9. UUIDs
`/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`

### 10. Hash-like Strings
`/^[0-9a-f]{32,}$/i` — 32+ hex chars (MD5/SHA)

### 11. Configuration Keys (SCREAMING_SNAKE_CASE)
`/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/` — must include at least one underscore. `"API_KEY"`, `"MAX_RETRY_COUNT"`

### 12. Template Variables Only
`/^\{\{[\w.]+\}\}$/` — entire value is a template reference. `"{{common.name}}"`

### 13. Icon Identifiers
`/^(material-symbols|fa|mdi|icon)[-:][\w-]+$/i` — `"material-symbols:security"`, `"fa-regular fa-user"`

### 14. CSS/Style Values
`/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\(|\d+px|\d+em|\d+rem|\d+%)$/i` — `"#fff"`, `"rgba(0,0,0,0.5)"`, `"16px"`

## Always Localizable (return false)

- Readable words mixed with numbers: `"Step 1"`, `"Version 2 Released"`
- Strings with embedded template variables: `"Hello {{name}}"`
- Bare acronyms: `"API"`, `"URL"` — may appear in sentences
- Short labels: `"OK"`, `"N/A"`

## Implementation Notes

1. **Be conservative**: When in doubt, return `false`. It is cheaper for a translator to skip an obvious non-translatable than for a string to silently go untranslated.
2. **Order matters**: Check most specific patterns first.
3. **Logging**: When returning `true`, identify the matched pattern, e.g. `Non-localizable: "https://example.com" (matched: URL pattern)`.
4. **Mixed content**: `"Visit https://example.com"` is `false` — the surrounding text needs translation.
5. **Interpolated text**: `"{{count}} items"` is `false` — the suffix needs translation.

## Examples

```
Input: "https://github.com/example/repo"          → true (URL)
Input: "Delete"                                   → false
Input: "{{common.name}}"                          → true (template-only)
Input: "Hello {{name}}, welcome!"                 → false
Input: "API_ENDPOINT_URL"                         → true (config key)
Input: "1.2.3"                                    → true (version)
Input: "Step 1"                                   → false
```
