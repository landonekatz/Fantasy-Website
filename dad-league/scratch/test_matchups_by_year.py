import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/matchups.json") as f:
    matchups = json.load(f)

matchups_by_year = {}
for m in matchups:
    y = m.get("year")
    gt = (m.get("game_type", "")).lower()
    if not m.get("is_playoff") and not m.get("is_consolation") and "consolation" not in gt and "3rd" not in gt:
        matchups_by_year[y] = matchups_by_year.get(y, 0) + 1

for y in sorted(matchups_by_year.keys()):
    print(f"{y}: {matchups_by_year[y]} matchups")
