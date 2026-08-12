import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/scraper/raw_data/season_2024_matchups.json") as f:
    matchups = json.load(f)
    
for s in matchups.get("schedule", [])[:5]:
    h = s.get("home", {})
    print(h.get("totalPoints"), h.get("totalProjectedPoints"))
    
