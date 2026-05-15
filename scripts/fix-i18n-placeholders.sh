#!/usr/bin/env bash
# Fix Transloco placeholders whose internal/leading casing was corrupted by
# scripts/i18n_style/sentence_case.py's mechanical sentence-case pass
# (commit 5e08187). Transloco param interpolation is case-sensitive, so the
# corrupted placeholders never get substituted at render time.
#
# Surgical jq pass: rewrites only the listed broken placeholder names inside
# string values; preserves key order, indentation, and escape sequences.

set -euo pipefail

cd "$(dirname "$0")/.."

JQ_FILTER='walk(if type == "string" then
  gsub("\\{\\{Count\\}\\}"; "{{count}}") |
  gsub("\\{\\{Current\\}\\}"; "{{current}}") |
  gsub("\\{\\{Minutes\\}\\}"; "{{minutes}}") |
  gsub("\\{\\{Seconds\\}\\}"; "{{seconds}}") |
  gsub("\\{\\{Sourcesloaded\\}\\}"; "{{sourcesLoaded}}") |
  gsub("\\{\\{Startindex\\}\\}"; "{{startIndex}}") |
  gsub("\\{\\{User\\}\\}"; "{{user}}") |
  gsub("\\{\\{chunksembedded\\}\\}"; "{{chunksEmbedded}}") |
  gsub("\\{\\{confirmvalue\\}\\}"; "{{confirmValue}}") |
  gsub("\\{\\{endindex\\}\\}"; "{{endIndex}}") |
  gsub("\\{\\{entityname\\}\\}"; "{{entityName}}") |
  gsub("\\{\\{entitytype\\}\\}"; "{{entityType}}") |
  gsub("\\{\\{errormessage\\}\\}"; "{{errorMessage}}") |
  gsub("\\{\\{maxsize\\}\\}"; "{{maxSize}}") |
  gsub("\\{\\{objecttype\\}\\}"; "{{objectType}}") |
  gsub("\\{\\{responsecount\\}\\}"; "{{responseCount}}") |
  gsub("\\{\\{tmcount\\}\\}"; "{{tmCount}}") |
  gsub("\\{\\{username\\}\\}"; "{{userName}}")
else . end)'

for file in src/assets/i18n/*.json; do
  # Skip allowlist, usage, and any other non-locale auxiliary JSON
  base="$(basename "$file")"
  if [[ "$base" == i18n-allowlist.json || "$base" == *.usage.json ]]; then
    continue
  fi
  echo "Processing $file"
  tmp="$file.tmp"
  jq "$JQ_FILTER" "$file" > "$tmp"
  mv "$tmp" "$file"
done

echo "Done."
