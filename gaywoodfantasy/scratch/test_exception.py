import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json") as f:
    stats = json.load(f)

for p in stats:
    if "fantasy_points" not in p:
        print("Missing fantasy_points")
        break
print("Done")
