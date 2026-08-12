import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/matchups.json") as f:
    matchups = json.load(f)

for m in matchups:
    if m.get("away_manager_id") is None:
        pass # print(f"Found None away_manager_id in {m['year']} week {m['week']}")
