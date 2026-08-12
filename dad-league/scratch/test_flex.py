import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json") as f:
    stats = json.load(f)

ids = set()
for p in stats:
    if p.get("is_starter"):
        ids.add(p.get("lineup_slot_id"))

print("Starter slots:", sorted(list(ids)))
