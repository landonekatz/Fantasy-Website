import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/matchups.json") as f:
    matchups = json.load(f)

weeks_by_year = {}
for m in matchups:
    y = m.get("year")
    w = m.get("week")
    gt = (m.get("game_type", "")).lower()
    if not m.get("is_playoff") and not m.get("is_consolation") and "consolation" not in gt and "3rd" not in gt:
        if y not in weeks_by_year:
            weeks_by_year[y] = set()
        weeks_by_year[y].add(w)

for y in sorted(weeks_by_year.keys()):
    print(f"{y}: {sorted(list(weeks_by_year[y]))}")
