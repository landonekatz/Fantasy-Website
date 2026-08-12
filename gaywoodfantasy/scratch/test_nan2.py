import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/matchups.json") as f:
    matchups = json.load(f)

for m in matchups:
    if not isinstance(m.get("week"), int):
        print(f"Weird week in matchup {m.get('matchup_id')}: {m.get('week')}")
