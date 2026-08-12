import json
with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json") as f:
    stats = json.load(f)

for p in stats:
    if p["year"] == 2023 and p["week"] == 1 and p["team_id"] == 8 and p.get("is_starter"):
        print(p["player_name"], p.get("projected_points"), p.get("fantasy_points"))
