"""
Manager migration script.
Applies canonical naming rules and merges duplicate ESPN IDs.
Run once, then re-run the pipeline.
"""
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MANAGERS_JSON = DATA_DIR / "managers.json"

# ── Canonical name map: espn_id → (new_slug, canonical_name, full_name, status) ──
# status: 'active' or 'retired'
CANONICAL = {
    # id (SWID)                              slug        name                   full_name            status
    "{B6808BDB-CD15-4F38-951E-2E3DD1B9319B}": ("daniel",  "Daniel",              "Daniel Hulbert",    "retired"),
    "{09948E5A-A389-457D-BD8B-6BC78E867120}": ("steve",   "Steve",               "Steve Hochstein",   "retired"),
    "{3855E3E5-9E9E-4F50-96A6-5FD45A6B7A6A}": ("peter",   "Peter",               "Peter Sheehan",     "retired"),
    "{A8F3D2C1-1234-5678-ABCD-EF0123456789}": ("brendan", "Brendan",             "Brendan Moag",      "retired"),
    "{C9E4B2A1-2345-6789-BCDE-F01234567890}": ("roland",  "Roland",              "Roland Williams",   "retired"),

    # Two Adams → Adam B and Adam C
    "{abeck71-0000-0000-0000-000000000000}":  ("adam_b",  "Adam B",              "Adam Beck",         "active"),
    "{espn138-0000-0000-0000-000000000000}":  ("adam_c",  "Adam C",              "Adam Callaway",     "active"),

    # Ethan (was Ethan Ethan + Ethan .)
    "{wbaisy16-0000-0000-0000-000000000000}": ("ethan",   "Ethan",               "Ethan",             "active"),

    # Nick (was Nicoli Gold + Nicholas Gold)
    "{nngold00-0000-0000-0000-000000000000}": ("nick",    "Nick",                "Nick Gold",         "active"),
}

# ── Simple rename rules applied by current slug ───────────────────────────────
SLUG_RENAMES = {
    "daniel_hulbert":  ("daniel",  "Daniel",              "Daniel Hulbert",    "retired"),
    "peter_sheehan":   ("peter",   "Peter",               "Peter Sheehan",     "retired"),
    "steve_hochstein": ("steve",   "Steve",               "Steve Hochstein",   "retired"),
    "adam_beck":       ("adam_b",  "Adam B",              "Adam Beck",         "active"),
    "ethan_ethan":     ("ethan",   "Ethan",               "Ethan",             "active"),
    "brady_locher":    ("brady",   "Brady",               "Brady Locher",      "active"),
    "brendan_moag":    ("brendan", "Brendan",             "Brendan Moag",      "retired"),
    "ira_katz":        ("ira",     "Ira",                 "Ira Katz",          "active"),
    "scott_fritze":    ("scott",   "Scott",               "Scott Fritze",      "active"),
    "jason_cullum":    ("jason",   "Jason",               "Jason Cullum",      "active"),
    "seth_vannatta":   ("seth",    "Seth",                "Seth Vannatta",     "retired"),
    "tyler_harrison":  ("tyler",   "Tyler",               "Tyler Harrison",    "active"),
    "simon_labond":    ("simon",   "Simon LaBond (Jake Ro-?)", "Simon LaBond", "retired"),
    "roland_williams": ("roland",  "Roland",              "Roland Williams",   "retired"),
    "nicoli_gold":     ("nick",    "Nick",                "Nick Gold",         "active"),
    "mike_huber":      ("mike",    "Mike",                "Mike Huber",        "active"),
    "lee_gustafson":   ("lee",     "Lee",                 "Lee Gustafson",     "active"),
    "john_baker":      ("john",    "John",                "John Baker",        "active"),
    "r_adam_callaway": ("adam_c",  "Adam C",              "Adam Callaway",     "active"),
    "luis_batlle":     ("luis",    "Luis",                "Luis Batlle",       "active"),
    "greg_weinhold":   ("greg",    "Greg",                "Greg Weinhold",     "active"),
}

def migrate():
    with open(MANAGERS_JSON, "r") as f:
        data = json.load(f)

    old_managers = data.get("managers", [])
    new_managers = []
    seen_slugs = set()

    for m in old_managers:
        old_slug = m["id"]
        if old_slug not in SLUG_RENAMES:
            print(f"  WARNING: No rename rule for '{old_slug}' — keeping as-is")
            if old_slug not in seen_slugs:
                new_managers.append(m)
                seen_slugs.add(old_slug)
            continue

        new_slug, canonical_name, full_name, status = SLUG_RENAMES[old_slug]

        if new_slug in seen_slugs:
            # Duplicate slug (e.g. merging Ethan Ethan + Ethan .) — skip, already added
            print(f"  Merged duplicate: '{old_slug}' → '{new_slug}' (already exists)")
            continue

        seen_slugs.add(new_slug)
        new_entry = {
            "id": new_slug,
            "name": canonical_name,
            "full_name": full_name,
            "espn_id": m.get("espn_id", ""),
            "display_name": m.get("display_name", ""),
            "status": status,
        }
        new_managers.append(new_entry)
        print(f"  '{old_slug}' → '{new_slug}' ({canonical_name})")

    data["managers"] = new_managers
    # Keep team_mappings if present
    with open(MANAGERS_JSON, "w") as f:
        json.dump(data, f, indent=2)

    print(f"\nDone. {len(new_managers)} managers in managers.json.")

if __name__ == "__main__":
    migrate()
