"""
One-time manager canonicalization script.
Reads the current managers.json (which has correct ESPN IDs from the API),
applies canonical naming rules, and rewrites it.

The pipeline's update_managers_registry builds slugs from the owner's ESPN-supplied
firstName+lastName. This script overrides those with the agreed canonical names.

Run: python fix_managers.py
Then: python pipeline.py  (uses cached API data, fast)
"""
import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MANAGERS_JSON = DATA_DIR / "managers.json"

# ── Canonical rules keyed on display_name (most stable ESPN identifier) ───────
# display_name -> (new_slug, canonical_name, full_name, status)
BY_DISPLAY_NAME = {
    "dwhulbert":      ("daniel",  "Daniel",                   "Daniel Hulbert",   "retired"),
    "47Lucy1001":     ("peter",   "Peter",                    "Peter Sheehan",    "retired"),
    "shoch0011":      ("steve",   "Steve",                    "Steve Hochstein",  "retired"),
    "abeck71":        ("adam_b",  "Adam B",                   "Adam Beck",        "active"),
    "wbaisy1688281":  ("ethan",   "Ethan",                    "Ethan",            "active"),
    "bradylocher":    ("brady",   "Brady",                    "Brady Locher",     "active"),
    "Brendan955158":  ("brendan", "Brendan",                  "Brendan Moag",     "retired"),
    "irabka5685803":  ("ira",     "Ira",                      "Ira Katz",         "active"),
    "Maximus5252":    ("scott",   "Scott",                    "Scott Fritze",     "active"),
    "Pea_Shooter":    ("jason",   "Jason",                    "Jason Cullum",     "active"),
    "snowman4455":    ("seth",    "Seth",                     "Seth Vannatta",    "retired"),
    "tharrison31":    ("tyler",   "Tyler",                    "Tyler Harrison",   "active"),
    "jakero3452398":  ("simon",   "Simon LaBond (Jake Ro-?)", "Simon LaBond",     "retired"),
    "Roland67":       ("roland",  "Roland",                   "Roland Williams",  "retired"),
    "nngold":         ("nick",    "Nick",                     "Nick Gold",        "active"),
    "Ricky Huber Jr.":("mike",    "Mike",                     "Mike Huber",       "active"),
    "Nattybro4sho":   ("lee",     "Lee",                      "Lee Gustafson",    "active"),
    "hopkins28":      ("john",    "John",                     "John Baker",       "active"),
    "espn13861028":   ("adam_c",  "Adam C",                   "Adam Callaway",    "active"),
    "lbatll1":        ("luis",    "Luis",                     "Luis Batlle",      "active"),
    "BigDaddyGus":    ("greg",    "Greg",                     "Greg Weinhold",    "active"),
}

def run():
    with open(MANAGERS_JSON, "r") as f:
        data = json.load(f)

    old = data.get("managers", [])
    new_managers = []
    seen_slugs = set()

    for m in old:
        display = m.get("display_name", "")
        rule = BY_DISPLAY_NAME.get(display)

        if not rule:
            print(f"  ⚠ No rule for display_name='{display}' (name='{m.get('name')}') — keeping slug '{m['id']}'")
            if m["id"] not in seen_slugs:
                new_managers.append(m)
                seen_slugs.add(m["id"])
            continue

        new_slug, canonical_name, full_name, status = rule

        if new_slug in seen_slugs:
            print(f"  🔀 Merged: display='{display}' → slug '{new_slug}' already exists (duplicate ESPN account?)")
            continue

        seen_slugs.add(new_slug)
        new_entry = {
            "id": new_slug,
            "name": canonical_name,
            "full_name": full_name,
            "espn_id": m.get("espn_id", ""),
            "display_name": display,
            "status": status,
        }
        new_managers.append(new_entry)
        old_slug = m["id"]
        marker = " ✓" if old_slug == new_slug else f" (was '{old_slug}')"
        print(f"  {new_slug}: {canonical_name}{marker}")

    data["managers"] = new_managers
    with open(MANAGERS_JSON, "w") as f:
        json.dump(data, f, indent=2)

    print(f"\n✅ managers.json updated — {len(new_managers)} canonical managers.")
    print("Now run: python pipeline.py  (will use cached API data)")

if __name__ == "__main__":
    run()
