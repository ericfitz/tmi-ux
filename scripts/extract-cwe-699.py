# /// script
# requires-python = ">=3.10"
# dependencies = ["requests", "defusedxml"]
# ///
"""
Extract CWE-699 (Software Development) view weaknesses from MITRE's CWE XML.

Downloads the latest CWE XML, walks the CWE-699 view tree, and extracts
Base-level weaknesses with their descriptions. Output is written to
src/assets/cwe/cwe-699.json for use by the CWE picker dialog.

Usage:
    uv run scripts/extract-cwe-699.py
"""

import io
import json
import zipfile
from pathlib import Path
from xml.etree.ElementTree import Element

import requests  # ty:ignore[unresolved-import]
from defusedxml import (  # pyright: ignore[reportMissingModuleSource]  # ty:ignore[unresolved-import]
    ElementTree as ET,  # pyright: ignore[reportMissingModuleSource] # ty:ignore[unresolved-import]
)

CWE_XML_URL = "https://cwe.mitre.org/data/xml/cwec_latest.xml.zip"
OUTPUT_PATH = (
    Path(__file__).resolve().parent.parent / "src" / "assets" / "cwe" / "cwe-699.json"
)
VIEW_ID = "699"


def download_and_parse_xml() -> Element:
    """Download the CWE XML zip and parse the XML content."""
    print(f"Downloading CWE XML from {CWE_XML_URL}...")
    response = requests.get(CWE_XML_URL, timeout=60)
    response.raise_for_status()

    with zipfile.ZipFile(io.BytesIO(response.content)) as zf:
        xml_files = [f for f in zf.namelist() if f.endswith(".xml")]
        if not xml_files:
            raise RuntimeError("No XML file found in zip archive")
        print(f"Parsing {xml_files[0]}...")
        with zf.open(xml_files[0]) as xml_file:
            root = ET.parse(xml_file).getroot()
            if root is None:
                raise RuntimeError("Failed to parse XML root element")
            return root


def get_namespace(root: Element) -> str:
    """Extract the XML namespace from the root element."""
    tag = root.tag
    if tag.startswith("{"):
        return tag[1 : tag.index("}")]
    return ""


def collect_view_members(root: Element, ns: str, view_id: str) -> set[str]:
    """Collect all weakness IDs that are members of the given view, recursively through categories."""
    weakness_ids: set[str] = set()
    category_ids: set[str] = set()

    # Find the view and its direct members
    for view in root.findall(f".//{{{ns}}}View"):
        if view.get("ID") == view_id:
            for member in view.findall(f".//{{{ns}}}Has_Member"):
                cwe_id = member.get("CWE_ID", "")
                # Members can be weaknesses or categories
                if cwe_id:
                    # We'll determine if it's a weakness or category below
                    weakness_ids.add(cwe_id)
                    category_ids.add(cwe_id)
            break

    # Build category -> members mapping
    category_members: dict[str, set[str]] = {}
    for category in root.findall(f".//{{{ns}}}Category"):
        cat_id = category.get("ID", "")
        members: set[str] = set()
        for rel in category.findall(f".//{{{ns}}}Has_Member"):
            member_id = rel.get("CWE_ID", "")
            if member_id:
                members.add(member_id)
        category_members[cat_id] = members

    # Build set of actual weakness IDs
    actual_weakness_ids: set[str] = set()
    for weakness in root.findall(f".//{{{ns}}}Weakness"):
        actual_weakness_ids.add(weakness.get("ID", ""))

    # Recursively expand categories to find all weakness IDs
    expanded: set[str] = set()
    to_process = set(weakness_ids)
    visited: set[str] = set()

    while to_process:
        current = to_process.pop()
        if current in visited:
            continue
        visited.add(current)

        if current in actual_weakness_ids:
            expanded.add(current)
        if current in category_members:
            to_process.update(category_members[current])

    return expanded


def extract_text(element: Element | None, ns: str) -> str:
    """Extract text content from an element, handling mixed content and nested tags."""
    if element is None:
        return ""
    # Get all text including tail text from child elements
    parts: list[str] = []
    if element.text:
        parts.append(element.text.strip())
    for child in element:
        if child.text:
            parts.append(child.text.strip())
        if child.tail:
            parts.append(child.tail.strip())
    return " ".join(parts).strip()


def get_parent_id(weakness: Element, ns: str) -> str:
    """Get the parent CWE ID from ChildOf or MemberOf relationships."""
    # Try ChildOf first
    for rel in weakness.findall(f".//{{{ns}}}Related_Weakness"):
        nature = rel.get("Nature", "")
        if nature == "ChildOf":
            return f"CWE-{rel.get('CWE_ID', '')}"
    # Fall back to MemberOf
    for rel in weakness.findall(f".//{{{ns}}}Related_Weakness"):
        nature = rel.get("Nature", "")
        if nature == "MemberOf":
            return f"CWE-{rel.get('CWE_ID', '')}"
    return ""


def extract_weaknesses(root: Element, ns: str, member_ids: set[str]) -> list[dict]:
    """Extract weakness data for all members, filtered to Base abstraction."""
    weaknesses: list[dict] = []

    for weakness in root.findall(f".//{{{ns}}}Weakness"):
        wid = weakness.get("ID", "")
        if wid not in member_ids:
            continue

        abstraction = weakness.get("Abstraction", "")
        if abstraction != "Base":
            continue

        name = weakness.get("Name", "")
        description = extract_text(weakness.find(f"{{{ns}}}Description"), ns)
        extended_desc = extract_text(weakness.find(f"{{{ns}}}Extended_Description"), ns)
        parent_id = get_parent_id(weakness, ns)

        weaknesses.append(
            {
                "cwe_id": f"CWE-{wid}",
                "name": name,
                "description": description,
                "extended_description": extended_desc,
                "parent_id": parent_id,
            }
        )

    # Sort by numeric CWE ID
    weaknesses.sort(key=lambda w: int(w["cwe_id"].replace("CWE-", "")))
    return weaknesses


def main() -> None:
    root = download_and_parse_xml()
    ns = get_namespace(root)
    print(f"XML namespace: {ns}")

    member_ids = collect_view_members(root, ns, VIEW_ID)
    print(
        f"Found {len(member_ids)} members in CWE-{VIEW_ID} view (including categories)"
    )

    weaknesses = extract_weaknesses(root, ns, member_ids)
    print(f"Extracted {len(weaknesses)} Base-level weaknesses")

    output = {
        "view_id": f"CWE-{VIEW_ID}",
        "view_name": "Software Development",
        "weaknesses": weaknesses,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"Written to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
