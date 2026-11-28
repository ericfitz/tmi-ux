"""CLDR plural groups in Transloco locale files (ADR 0007).

A plural group is an object whose keys are all CLDR plural categories and
include ``other``, for example ``{"one": "{{count}} note", "other": "{{count}} notes"}``.
Each locale defines the categories its language uses, so the category keys
differ between locales; tools treat the group's own key as the translatable
unit when comparing locales or finding usages.
"""

PLURAL_CATEGORIES = ("zero", "one", "two", "few", "many", "other")


def is_plural_group(value) -> bool:
    """Return True if ``value`` is a plural group."""
    if not isinstance(value, dict) or "other" not in value:
        return False
    return all(key in PLURAL_CATEGORIES for key in value)
