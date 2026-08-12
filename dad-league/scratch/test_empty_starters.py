import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json") as f:
    stats = json.load(f)

week_team_starters = {}

for p in stats:
    key = f"{p['year']}_{p['matchup_week']}_{p['team_id']}"
    if key not in week_team_starters:
        week_team_starters[key] = 0
    if p.get("is_starter"):
        week_team_starters[key] += 1

empty_count = 0
for k, v in week_team_starters.items():
    if v == 0:
        print(f"Empty starters for {k}")
        empty_count += 1

print(f"Total empty starter teams: {empty_count} out of {len(week_team_starters)}")
