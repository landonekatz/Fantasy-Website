import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json") as f:
    stats = json.load(f)

for p in stats[:3]:
    print("year:", p.get("year"), "week:", p.get("week"), "matchup_week:", p.get("matchup_week"))

