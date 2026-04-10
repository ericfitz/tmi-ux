# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx"]
# ///
"""
Validate field-definitions.json against the TMI OpenAPI spec.

Reports:
  - STALE: Field definition references an API field that doesn't exist (error, exit 1)
  - MISSING: API field exists but has no field definition (warning)

Usage:
  uv run e2e/schema/validate-fields.py [--spec PATH_OR_URL]
"""

import argparse
import json
import sys
from pathlib import Path

import httpx

DEFAULT_SPEC_URL = (
    "https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/main/api-schema/tmi-openapi.json"
)
FIELD_DEFS_PATH = Path(__file__).parent / "field-definitions.json"

# Map from field-definitions.json entity key to OpenAPI schema name(s).
# Some entities use allOf composition with a Base schema.
ENTITY_SCHEMA_MAP = {
    "threat_model": ["ThreatModelBase", "ThreatModel"],
    "threat": ["ThreatBase", "Threat"],
    "asset": ["AssetBase", "Asset"],
    "document": ["DocumentBase", "Document"],
    "repository": ["RepositoryBase", "Repository"],
    "note": ["NoteBase", "Note"],
    "team": ["TeamBase", "Team"],
    "project": ["ProjectBase", "Project"],
}

# Fields that are read-only / system-managed and intentionally excluded from UI
IGNORED_API_FIELDS = {
    "id",
    "created_at",
    "modified_at",
    "deleted_at",
    "created_by",
    "modified_by",
    "reviewed_by",
    "reviewed_at",
    "threat_model_id",
    "access_status",
    "content_source",
    # Child entity arrays (managed via their own CRUD, not inline fields)
    "threats",
    "assets",
    "documents",
    "repositories",
    "diagrams",
    "notes",
    "authorization",
    "status_updated",
    # Fields managed via special UI (not inline form fields)
    "diagram_id",
    "cell_id",
    "asset_id",
    "timmy_enabled",
    "parameters",
    # Read-only resolved/expanded object fields (server-resolved references)
    "team",
    # Read-only metadata on asset/document/repository/note (readOnly in API spec).
    # Entities that do expose metadata (threat_model, threat, team, project) already
    # have metadata in their field definitions, so this does not suppress valid coverage.
    "metadata",
}


def load_spec(spec_path: str) -> dict:
    """Load the OpenAPI spec from a local file or URL."""
    path = Path(spec_path)
    if path.exists():
        with open(path) as f:
            return json.load(f)
    # Try as URL
    resp = httpx.get(spec_path, follow_redirects=True, timeout=30)
    resp.raise_for_status()
    return resp.json()


def resolve_ref(spec: dict, ref: str) -> dict:
    """Resolve a $ref pointer within the spec."""
    parts = ref.lstrip("#/").split("/")
    obj = spec
    for p in parts:
        obj = obj[p]
    return obj


def collect_api_fields(spec: dict, schema_names: list[str]) -> set[str]:
    """Collect all property names from the given schema(s), resolving allOf."""
    schemas = spec.get("components", {}).get("schemas", {})
    fields: set[str] = set()

    for name in schema_names:
        schema = schemas.get(name, {})

        # Direct properties
        fields.update(schema.get("properties", {}).keys())

        # allOf composition
        for item in schema.get("allOf", []):
            if "$ref" in item:
                ref_schema = resolve_ref(spec, item["$ref"])
                fields.update(ref_schema.get("properties", {}).keys())
            else:
                fields.update(item.get("properties", {}).keys())

    return fields


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate field definitions against OpenAPI spec")
    parser.add_argument(
        "--spec",
        default=DEFAULT_SPEC_URL,
        help="Path or URL to the TMI OpenAPI spec JSON",
    )
    args = parser.parse_args()

    # Load inputs
    spec = load_spec(args.spec)
    with open(FIELD_DEFS_PATH) as f:
        field_defs = json.load(f)

    stale_count = 0
    missing_count = 0

    for entity_key, schema_names in ENTITY_SCHEMA_MAP.items():
        defs = field_defs.get("entities", {}).get(entity_key, [])
        def_field_names = {d["apiName"] for d in defs}
        api_fields = collect_api_fields(spec, schema_names)

        # Check for stale definitions (error)
        stale = def_field_names - api_fields
        for field in sorted(stale):
            print(f"  ERROR  [{entity_key}] STALE: '{field}' in field-definitions but not in API schema")
            stale_count += 1

        # Check for missing definitions (warning)
        missing = api_fields - def_field_names - IGNORED_API_FIELDS
        for field in sorted(missing):
            print(f"  WARN   [{entity_key}] MISSING: '{field}' in API schema but not in field-definitions")
            missing_count += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"Entities checked: {len(ENTITY_SCHEMA_MAP)}")
    print(f"Stale definitions (errors): {stale_count}")
    print(f"Missing definitions (warnings): {missing_count}")

    if stale_count > 0:
        print("\nFAILED: Remove stale field definitions that reference nonexistent API fields.")
        return 1

    print("\nPASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
