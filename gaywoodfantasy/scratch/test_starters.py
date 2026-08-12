import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json") as f:
    stats = json.load(f)

starters = 0
for p in stats:
    if p.get("is_starter"):
        starters += 1

print("Total starters:", starters)
print("Total players:", len(stats))
