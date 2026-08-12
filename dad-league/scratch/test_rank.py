import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/league_standings.json") as f:
    data = json.load(f)
for row in data:
    if row.get("final_rank") is None:
        print(f"Missing final_rank for {row.get('manager_id')} in {row.get('year')}")
