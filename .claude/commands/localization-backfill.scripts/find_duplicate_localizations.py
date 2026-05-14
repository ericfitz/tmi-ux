#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "pyyaml",
# ]
# ///

"""Find duplicate values in an i18n master locale and emit a de-dup plan.

What it does
------------
Scans the master locale JSON for leaf string values that appear under more
than one key path, then writes a plan describing how to consolidate them.

Two output modes:

  * **Reference mode** (``--reference``): keep the best key, rewrite the
    other duplicate keys' values to ``"{{keeper.key.path}}"`` so they
    resolve transitively at lookup time. Non-destructive — preserves
    every dotted key but de-duplicates the underlying value.
  * **Legacy mode** (default): pick a canonical key (possibly moving it
    into a ``common.*`` section), and ask the caller to delete the
    duplicate keys and refactor references at callsites.

The "best" key for a duplicate group is chosen by:
  1. Whether it lives under ``common.*`` (preferred).
  2. Whether the leaf name is already proper ``camelCase``.
  3. Total path length (shorter wins).

Configuration discovery
-----------------------
When invoked without an explicit master file argument, this script walks
up from the current working directory looking for
``.claude/i18n.config.json`` (see `find_i18n_config`). It derives the
master file path from:

  - ``locales_dir`` (required)
  - ``master_locale`` (required)
  - ``file_extension`` (default ``"json"``)

A positional file argument always overrides config-derived paths so that
existing ``pnpm run loc-dedupe`` invocations remain backward compatible.

Dependencies
------------
Standard library plus ``pyyaml`` (declared in the PEP 723 inline metadata
above) for optional YAML output. ``uv run`` installs ``pyyaml`` in an
isolated environment automatically.

Usage examples
--------------
  # Backward-compatible explicit invocation (uses config-derived path now):
  uv run find_duplicate_localizations.py --skippolicy --reference

  # Explicit master locale file:
  uv run find_duplicate_localizations.py --file path/to/en-US.json --reference

  # YAML output:
  uv run find_duplicate_localizations.py --reference --format yaml
"""

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import yaml  # type: ignore[import-not-found]  # noqa: F401 - managed by uv


CONFIG_FILENAME = ".claude/i18n.config.json"


def find_i18n_config(start: Optional[Path] = None, override: Optional[str] = None):
    """Locate an i18n config file by walking up the directory tree."""
    if override:
        path = Path(override).expanduser()
        return path if path.is_file() else None
    start = (start or Path.cwd()).resolve()
    for d in [start, *start.parents]:
        candidate = d / CONFIG_FILENAME
        if candidate.is_file():
            return candidate
    return None


def load_i18n_config(config_path: Path) -> Dict[str, Any]:
    """Load and minimally validate an i18n config file."""
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    for required in ("locales_dir", "master_locale"):
        if required not in config:
            raise ValueError(
                f"i18n config {config_path} is missing required field: {required!r}"
            )
    config.setdefault("file_extension", "json")
    return config


def derive_master_from_config(config_path: Path, config: Dict[str, Any]) -> str:
    """Return the master locale file path from a config + its directory."""
    base = config_path.parent.parent  # parent of .claude/
    locales_dir = (base / config["locales_dir"]).resolve()
    return str(locales_dir / f"{config['master_locale']}.{config['file_extension']}")


class LocalizationDeDuplicator:
    """Find duplicate string values in an i18n master file and emit a plan."""

    def __init__(self, locale_file_path: str, skip_policy: bool = False, reference_mode: bool = False):
        self.locale_file_path = Path(locale_file_path)
        self.skip_policy = skip_policy
        self.reference_mode = reference_mode
        self.localization_data: Dict[str, Any] = {}
        self.key_value_map: Dict[str, Any] = {}        # full path key -> value
        self.value_to_keys: Dict[Any, List[str]] = defaultdict(list)  # value -> [keys]
        self.dedup_plan: List[Dict[str, Any]] = []

    def load_localization_file(self):
        with open(self.locale_file_path, "r", encoding="utf-8") as f:
            self.localization_data = json.load(f)

    def should_skip_key(self, key: str) -> bool:
        """Decide whether a key should be excluded from duplicate detection."""
        # Translator notes — never count these as duplicates of each other.
        if key.endswith(".comment"):
            return True
        # Enum-like keys whose values legitimately repeat across enums.
        if key.startswith("threatEditor.threatStatus.") or key.startswith("threatModels.status."):
            return True
        if self.skip_policy:
            top_section = key.split(".")[0]
            return top_section in ["privacy", "tos"]
        return False

    def is_key_reference(self, value: str) -> bool:
        """Return True if the value is purely a key reference like ``"{{section.keyname}}"``."""
        return bool(re.fullmatch(r"\{\{[\w.]+\}\}", value))

    def extract_key_value_pairs(self, data: Dict[str, Any], prefix: str = "") -> None:
        """Recursively flatten key-value pairs while skipping references and excluded sections."""
        for key, value in data.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if self.should_skip_key(full_key):
                continue
            if isinstance(value, dict):
                self.extract_key_value_pairs(value, full_key)
            elif isinstance(value, str):
                if self.is_key_reference(value):
                    continue
                self.key_value_map[full_key] = value
                self.value_to_keys[value].append(full_key)

    def score_key(self, key: str) -> Tuple[int, int, int]:
        """Lower score = better keeper candidate. Tuple: (section, casing, length)."""
        parts = key.split(".")
        # Prefer keys already in the shared ``common`` section.
        section_score = 0 if parts[0] == "common" else 1

        last_part = parts[-1]
        casing_score = 0
        if last_part and last_part[0].isupper():
            casing_score = 1
        if any(c.isupper() for c in last_part[1:]):
            # Mixed/inconsistent casing within the tail is worse than pure lower/camel.
            if not all(c.isupper() or not c.isalpha() for c in last_part[1:]):
                casing_score += 1

        length_score = len(".".join(parts))
        return (section_score, casing_score, length_score)

    def choose_keeper(self, keys: List[str]) -> str:
        return sorted((self.score_key(k), k) for k in keys)[0][1]

    def make_target_key(self, keeper_key: str, value: str) -> str:
        """Compute the canonical key path the keeper should end up at.

        May rename the leaf to camelCase or hoist the key into ``common.*``
        when 3+ duplicates exist or duplicates cross top-level sections.
        """
        parts = keeper_key.split(".")
        last_part = parts[-1]

        if last_part and last_part[0].isupper():
            last_part = last_part[0].lower() + last_part[1:]

        if any(c.isupper() for c in last_part[1:]):
            result = []
            for i, c in enumerate(last_part):
                if i == 0:
                    result.append(c.lower())
                elif c.isupper() and i > 0 and i < len(last_part) - 1:
                    if last_part[i - 1].islower() or (i < len(last_part) - 1 and last_part[i + 1].islower()):
                        result.append(c)
                    else:
                        result.append(c.lower())
                else:
                    result.append(c)
            last_part = "".join(result)

        if parts[0] == "common":
            return ".".join(parts[:-1] + [last_part])

        all_keys = self.value_to_keys[value]
        sections = set(k.split(".")[0] for k in all_keys)

        if len(all_keys) >= 3 or len(sections) > 1:
            if "objectTypes" in keeper_key:
                return f"common.objectTypes.{last_part}"
            elif "validation" in keeper_key:
                return f"common.validation.{last_part}"
            elif "roles" in keeper_key:
                return f"common.roles.{last_part}"
            else:
                return f"common.{last_part}"

        return ".".join(parts[:-1] + [last_part])

    def create_dedup_plan(self):
        for value, keys in self.value_to_keys.items():
            if len(keys) < 2:
                continue
            keys.sort()
            keeper = self.choose_keeper(keys)
            target_key = self.make_target_key(keeper, value)

            plan_entry: Dict[str, Any] = {"value": value, "keys": []}

            if self.reference_mode:
                # Reference mode: keep keeper key path intact, rewrite others to {{keeper}}.
                for key in keys:
                    if key == keeper:
                        action, instruction = "KEEP", f"KEEP {key}"
                    else:
                        action, instruction = "REFER", f"REFER {key} TO {{{{{keeper}}}}}"
                    plan_entry["keys"].append({
                        "key": key, "action": action, "instruction": instruction,
                    })
            else:
                # Legacy mode: delete duplicates; rename keeper if moving to common.
                for key in keys:
                    if key == keeper:
                        if key == target_key:
                            action = "KEEP"
                            instruction = f"KEEP {key}"
                            refactor = f"REFACTOR no changes needed for {key}"
                        else:
                            action = "MOVE"
                            instruction = f"MOVE {key} TO {target_key}"
                            refactor = f"REFACTOR rename {key} to {target_key}"
                    else:
                        action = "DELETE"
                        instruction = f"DELETE {key}"
                        refactor = f"REFACTOR rename {key} to {target_key}"
                    plan_entry["keys"].append({
                        "key": key, "action": action, "instruction": instruction, "refactor": refactor,
                    })

            self.dedup_plan.append(plan_entry)

    def save_plan(self, output_file: str = "localization_dedup_plan.txt", output_format: str = "txt"):
        output_path = Path(output_file)

        if output_format == "yaml":
            yaml_data = []
            for entry in self.dedup_plan:
                yaml_entry: Dict[str, Any] = {"value": entry["value"], "duplicates": []}
                for key_info in entry["keys"]:
                    entry_data = {"instruction": key_info["instruction"]}
                    if "refactor" in key_info:
                        entry_data["refactor"] = key_info["refactor"]
                    yaml_entry["duplicates"].append(entry_data)
                yaml_data.append(yaml_entry)
            with open(output_path, "w", encoding="utf-8") as f:
                yaml.dump(yaml_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        else:
            with open(output_path, "w", encoding="utf-8") as f:
                mode_name = "Reference" if self.reference_mode else "Legacy"
                f.write(f"Localization De-duplication Plan ({mode_name} Mode)\n")
                f.write("=" * 70 + "\n\n")

                total_keys = len(self.key_value_map)
                duplicate_groups = len(self.dedup_plan)
                keys_to_keep = sum(
                    1 for entry in self.dedup_plan for key_info in entry["keys"]
                    if key_info["action"] == "KEEP"
                )

                f.write(f"Total keys analyzed: {total_keys}\n")
                f.write(f"Duplicate groups found: {duplicate_groups}\n")

                if self.reference_mode:
                    keys_to_refer = sum(
                        1 for entry in self.dedup_plan for key_info in entry["keys"]
                        if key_info["action"] == "REFER"
                    )
                    f.write(f"Keys to convert to references: {keys_to_refer}\n")
                    f.write(f"Keys to keep: {keys_to_keep}\n")
                else:
                    keys_to_delete = sum(
                        1 for entry in self.dedup_plan for key_info in entry["keys"]
                        if key_info["action"] == "DELETE"
                    )
                    keys_to_move = sum(
                        1 for entry in self.dedup_plan for key_info in entry["keys"]
                        if key_info["action"] == "MOVE"
                    )
                    f.write(f"Keys to delete: {keys_to_delete}\n")
                    f.write(f"Keys to move: {keys_to_move}\n")
                    f.write(f"Keys to keep: {keys_to_keep}\n")

                f.write("\n" + "=" * 70 + "\n\n")

                for entry in self.dedup_plan:
                    f.write(f'Value: "{entry["value"]}"\n')
                    for key_info in entry["keys"]:
                        f.write(f"  {key_info['instruction']}\n")
                        if "refactor" in key_info:
                            f.write(f"  {key_info['refactor']}\n")
                    f.write("\n")

        print(f"De-duplication plan saved to: {output_path}")

    def run(self, output_file: str = "localization_dedup_plan.txt", output_format: str = "txt"):
        print("Loading localization file...")
        self.load_localization_file()
        print("Extracting key-value pairs...")
        self.extract_key_value_pairs(self.localization_data)
        print(f"Found {len(self.key_value_map)} total keys")
        duplicate_count = sum(1 for keys in self.value_to_keys.values() if len(keys) > 1)
        print(f"Found {duplicate_count} groups of duplicate values")
        print("Creating de-duplication plan...")
        self.create_dedup_plan()
        print("Saving plan...")
        self.save_plan(output_file, output_format)
        print("\nDone!")


def main():
    parser = argparse.ArgumentParser(
        description="Find duplicate localization strings and generate a de-duplication plan."
    )
    parser.add_argument(
        "--file",
        help="Path to master locale JSON. If omitted, derived from --config or .claude/i18n.config.json.",
    )
    parser.add_argument(
        "--config",
        help="Path to i18n config file (defaults to walking up for .claude/i18n.config.json).",
    )
    parser.add_argument(
        "--skippolicy", action="store_true",
        help="Skip privacy and tos sections in duplicate detection.",
    )
    parser.add_argument(
        "--reference", action="store_true",
        help="Use reference mode: convert duplicates to key references instead of deleting.",
    )
    parser.add_argument(
        "--output", "-o", default="localization_dedup_plan.txt",
        help="Output file name (default: localization_dedup_plan.txt).",
    )
    parser.add_argument(
        "--format", "-f", choices=["txt", "yaml"], default="txt",
        help="Output format (default: txt).",
    )
    args = parser.parse_args()

    locale_file = args.file
    if not locale_file:
        config_path = find_i18n_config(override=args.config)
        if not config_path:
            print(
                "Error: no --file argument provided and no .claude/i18n.config.json found "
                "by walking up from the current directory. Pass --file or --config.",
                file=sys.stderr,
            )
            sys.exit(2)
        config = load_i18n_config(config_path)
        locale_file = derive_master_from_config(config_path, config)
        print(f"Using i18n config: {config_path}")
        print(f"Master file:       {locale_file}")

    output_file: str = args.output
    if args.format == "yaml" and not output_file.endswith((".yaml", ".yml")):
        output_file = str(Path(output_file).with_suffix(".yaml"))

    deduplicator = LocalizationDeDuplicator(
        locale_file,
        skip_policy=args.skippolicy,
        reference_mode=args.reference,
    )
    deduplicator.run(output_file, args.format)


if __name__ == "__main__":
    main()
