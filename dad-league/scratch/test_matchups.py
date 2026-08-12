import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/matchups.json") as f:
    matchups = json.load(f)

reg_games = 0
for m in matchups:
    gt = (m.get("game_type", "")).lower()
    if not m.get("is_playoff") and not m.get("is_consolation") and "consolation" not in gt and "3rd" not in gt:
        reg_games += 1

print("Total regular season matchups:", reg_games)
