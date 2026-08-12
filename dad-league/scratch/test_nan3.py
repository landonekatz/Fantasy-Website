import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json") as f:
    stats = json.load(f)

for p in stats:
    if not isinstance(p.get("week"), int):
        print(f"Weird week in player stats: {p.get('week')}")
