#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "pyyaml",
# ]
# ///

"""
Tool to find duplicate localized string values and generate a de-duplication plan.
"""

import argparse
import json
import re
import yaml  # type: ignore[import-not-found]  # noqa: F401 - managed by uv
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Tuple, Any


class LocalizationDeDuplicator:
    def __init__(self, locale_file_path: str, skip_policy: bool = False, reference_mode: bool = False):
        self.locale_file_path = Path(locale_file_path)
        self.skip_policy = skip_policy
        self.reference_mode = reference_mode
        self.localization_data = {}
        self.key_value_map = {}  # Full path key -> value
        self.value_to_keys = defaultdict(list)  # Value -> list of full path keys
        self.dedup_plan = []
        
    def load_localization_file(self):
        """Load the localization JSON file."""
        with open(self.locale_file_path, 'r', encoding='utf-8') as f:
            self.localization_data = json.load(f)
    
    def should_skip_key(self, key: str) -> bool:
        """Check if a key should be skipped based on policy settings."""
        # Skip comment keys (these are translator notes, not actual translations)
        if key.endswith('.comment'):
            return True

        # Skip enum value patterns (these are not duplicates)
        if key.startswith('threatEditor.threatStatus.') or key.startswith('threatModels.status.'):
            return True

        if self.skip_policy:
            top_section = key.split('.')[0]
            return top_section in ['privacy', 'tos']
        return False

    def is_key_reference(self, value: str) -> bool:
        """Check if a value is a reference to another key (e.g., '{{section.keyname}}')."""
        # Match values that are purely key references like "{{section.keyname}}"
        return bool(re.fullmatch(r'\{\{[\w.]+\}\}', value))

    def extract_key_value_pairs(self, data: Dict[str, Any], prefix: str = '') -> None:
        """Recursively extract all key-value pairs with their full paths."""
        for key, value in data.items():
            full_key = f"{prefix}.{key}" if prefix else key
            
            # Skip if policy sections should be excluded
            if self.should_skip_key(full_key):
                continue
            
            if isinstance(value, dict):
                # Recurse into nested objects
                self.extract_key_value_pairs(value, full_key)
            elif isinstance(value, str):
                # Skip key references (e.g., "{{section.keyname}}")
                if self.is_key_reference(value):
                    continue
                # Store the key-value mapping
                self.key_value_map[full_key] = value
                self.value_to_keys[value].append(full_key)
    
    def score_key(self, key: str) -> Tuple[int, int, int]:
        """
        Score a key for preference. Lower scores are better.
        Returns (section_score, camelcase_score, length_score)
        """
        parts = key.split('.')
        
        # Section score: common=0, others=1
        section_score = 0 if parts[0] == 'common' else 1
        
        # CamelCase score: proper camelCase=0, improper=1
        last_part = parts[-1]
        camelcase_score = 0
        if last_part and last_part[0].isupper():
            camelcase_score = 1
        # Check for inconsistent casing like "ThreatID" vs "threatId"
        if any(c.isupper() for c in last_part[1:]):
            # Prefer consistent camelCase over mixed
            if not all(c.isupper() or not c.isalpha() for c in last_part[1:]):
                camelcase_score += 1
        
        # Length score: shorter paths are better
        length_score = len('.'.join(parts))
        
        return (section_score, camelcase_score, length_score)
    
    def choose_keeper(self, keys: List[str]) -> str:
        """Choose which key to keep based on preference rules."""
        # Sort keys by score (lower is better)
        scored_keys = [(self.score_key(key), key) for key in keys]
        scored_keys.sort()
        return scored_keys[0][1]
    
    def make_target_key(self, keeper_key: str, value: str) -> str:
        """
        Determine the target key name for a keeper.
        This may involve moving to common section or fixing casing.
        """
        parts = keeper_key.split('.')
        last_part = parts[-1]
        
        # Fix casing if needed
        if last_part and last_part[0].isupper():
            last_part = last_part[0].lower() + last_part[1:]
        
        # For keys with inconsistent casing, normalize to camelCase
        # e.g., "ThreatID" -> "threatId", "Repository" -> "repository"
        if any(c.isupper() for c in last_part[1:]):
            # Convert to proper camelCase
            result = []
            for i, c in enumerate(last_part):
                if i == 0:
                    result.append(c.lower())
                elif c.isupper() and i > 0 and i < len(last_part) - 1:
                    # Check if this is part of an acronym or a new word
                    if last_part[i-1].islower() or (i < len(last_part) - 1 and last_part[i+1].islower()):
                        result.append(c)
                    else:
                        result.append(c.lower())
                else:
                    result.append(c)
            last_part = ''.join(result)
        
        # If we're in common section, use the fixed key
        if parts[0] == 'common':
            return '.'.join(parts[:-1] + [last_part])
        
        # For non-common keys, consider if they should move to common
        # This happens when there are 3+ duplicates or cross-section duplicates
        all_keys = self.value_to_keys[value]
        sections = set(k.split('.')[0] for k in all_keys)
        
        if len(all_keys) >= 3 or len(sections) > 1:
            # Move to common section
            # Determine appropriate subsection
            if 'objectTypes' in keeper_key:
                return f"common.objectTypes.{last_part}"
            elif 'validation' in keeper_key:
                return f"common.validation.{last_part}"
            elif 'roles' in keeper_key:
                return f"common.roles.{last_part}"
            else:
                return f"common.{last_part}"
        
        # Keep in same section but fix casing
        return '.'.join(parts[:-1] + [last_part])
    
    def create_dedup_plan(self):
        """Create a de-duplication plan for all duplicate values."""
        for value, keys in self.value_to_keys.items():
            if len(keys) < 2:
                continue  # Not a duplicate

            # Sort keys for consistent output
            keys.sort()

            # Choose which key to keep
            keeper = self.choose_keeper(keys)
            target_key = self.make_target_key(keeper, value)

            # Create plan entries
            plan_entry = {
                'value': value,
                'keys': []
            }

            if self.reference_mode:
                # Reference mode: keep the actual keeper key, change duplicates to references
                # In reference mode, we use the keeper key as-is (no renaming/moving)
                for key in keys:
                    if key == keeper:
                        action = 'KEEP'
                        instruction = f"KEEP {key}"
                    else:
                        action = 'REFER'
                        instruction = f"REFER {key} TO {{{{{keeper}}}}}"

                    plan_entry['keys'].append({
                        'key': key,
                        'action': action,
                        'instruction': instruction,
                    })
            else:
                # Legacy mode: delete duplicates and rename references
                for key in keys:
                    if key == keeper:
                        if key == target_key:
                            action = 'KEEP'
                            instruction = f"KEEP {key}"
                            refactor = f"REFACTOR no changes needed for {key}"
                        else:
                            action = 'MOVE'
                            instruction = f"MOVE {key} TO {target_key}"
                            refactor = f"REFACTOR rename {key} to {target_key}"
                    else:
                        action = 'DELETE'
                        instruction = f"DELETE {key}"
                        refactor = f"REFACTOR rename {key} to {target_key}"

                    plan_entry['keys'].append({
                        'key': key,
                        'action': action,
                        'instruction': instruction,
                        'refactor': refactor
                    })

            self.dedup_plan.append(plan_entry)
    
    def save_plan(self, output_file: str = 'localization_dedup_plan.txt', output_format: str = 'txt'):
        """Save the de-duplication plan to a file."""
        output_path = Path(output_file)

        if output_format == 'yaml':
            # Save as YAML
            yaml_data = []
            for entry in self.dedup_plan:
                yaml_entry = {
                    'value': entry['value'],
                    'duplicates': []
                }
                for key_info in entry['keys']:
                    entry_data = {'instruction': key_info['instruction']}
                    if 'refactor' in key_info:
                        entry_data['refactor'] = key_info['refactor']
                    yaml_entry['duplicates'].append(entry_data)
                yaml_data.append(yaml_entry)

            with open(output_path, 'w', encoding='utf-8') as f:
                yaml.dump(yaml_data, f, default_flow_style=False, allow_unicode=True, sort_keys=False)
        else:
            # Save as plain text
            with open(output_path, 'w', encoding='utf-8') as f:
                # Write header
                mode_name = "Reference" if self.reference_mode else "Legacy"
                f.write(f"Localization De-duplication Plan ({mode_name} Mode)\n")
                f.write("=" * 70 + "\n\n")

                # Summary statistics
                total_keys = len(self.key_value_map)
                duplicate_groups = len(self.dedup_plan)
                keys_to_keep = sum(1 for entry in self.dedup_plan
                                   for key_info in entry['keys']
                                   if key_info['action'] == 'KEEP')

                f.write(f"Total keys analyzed: {total_keys}\n")
                f.write(f"Duplicate groups found: {duplicate_groups}\n")

                if self.reference_mode:
                    keys_to_refer = sum(1 for entry in self.dedup_plan
                                        for key_info in entry['keys']
                                        if key_info['action'] == 'REFER')
                    f.write(f"Keys to convert to references: {keys_to_refer}\n")
                    f.write(f"Keys to keep: {keys_to_keep}\n")
                else:
                    keys_to_delete = sum(1 for entry in self.dedup_plan
                                         for key_info in entry['keys']
                                         if key_info['action'] == 'DELETE')
                    keys_to_move = sum(1 for entry in self.dedup_plan
                                       for key_info in entry['keys']
                                       if key_info['action'] == 'MOVE')
                    f.write(f"Keys to delete: {keys_to_delete}\n")
                    f.write(f"Keys to move: {keys_to_move}\n")
                    f.write(f"Keys to keep: {keys_to_keep}\n")

                f.write("\n" + "=" * 70 + "\n\n")

                # Write duplicate groups
                for entry in self.dedup_plan:
                    f.write(f'Value: "{entry["value"]}"\n')
                    for key_info in entry['keys']:
                        f.write(f"  {key_info['instruction']}\n")
                        if 'refactor' in key_info:
                            f.write(f"  {key_info['refactor']}\n")
                    f.write("\n")

        print(f"De-duplication plan saved to: {output_path}")
    
    def run(self, output_file: str = 'localization_dedup_plan.txt', output_format: str = 'txt'):
        """Run the complete de-duplication analysis."""
        print("Loading localization file...")
        self.load_localization_file()
        
        print("Extracting key-value pairs...")
        self.extract_key_value_pairs(self.localization_data)
        
        print(f"Found {len(self.key_value_map)} total keys")
        
        # Count duplicates
        duplicate_count = sum(1 for keys in self.value_to_keys.values() if len(keys) > 1)
        print(f"Found {duplicate_count} groups of duplicate values")
        
        print("Creating de-duplication plan...")
        self.create_dedup_plan()
        
        print("Saving plan...")
        self.save_plan(output_file, output_format)
        
        print("\nDone!")


def main():
    parser = argparse.ArgumentParser(description='Find duplicate localization strings and generate de-duplication plan')
    parser.add_argument('--skippolicy', action='store_true',
                        help='Skip privacy and tos sections in duplicate detection')
    parser.add_argument('--reference', action='store_true',
                        help='Use reference mode: convert duplicates to key references instead of deleting')
    parser.add_argument('--output', '-o', default='localization_dedup_plan.txt',
                        help='Output file name (default: localization_dedup_plan.txt)')
    parser.add_argument('--format', '-f', choices=['txt', 'yaml'], default='txt',
                        help='Output format (default: txt)')

    args = parser.parse_args()

    # Path to the en-US.json file
    locale_file = "src/assets/i18n/en-US.json"

    # Determine output file extension based on format
    output_file: str = args.output
    if args.format == 'yaml' and not output_file.endswith('.yaml') and not output_file.endswith('.yml'):
        output_file = str(Path(output_file).with_suffix('.yaml'))

    # Create and run the de-duplicator
    deduplicator = LocalizationDeDuplicator(
        locale_file,
        skip_policy=args.skippolicy,
        reference_mode=args.reference
    )
    deduplicator.run(output_file, args.format)


if __name__ == "__main__":
    main()