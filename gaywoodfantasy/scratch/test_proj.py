import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json") as f:
    stats = json.load(f)

# Sum projected points for year=2023, week=1, team_id=8 (from previous dump)
pts = sum(p.get("projected_points", 0) for p in stats if p["year"] == 2023 and p["week"] == 1 and p["team_id"] == 8 and p.get("is_starter"))
print("Team 8 Projected 2023 W1:", pts)
