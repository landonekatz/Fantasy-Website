import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/matchups.json") as f:
    matchups = json.load(f)

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json") as f:
    stats = json.load(f)

print("Matchups managers:", set(m.get("home_manager_id") for m in matchups[:5]))
print("Stats managers:", set(s.get("manager_id") for s in stats[:5]))
