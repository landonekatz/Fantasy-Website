import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/matchups.json") as f:
    matchups = json.load(f)
with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/league_standings.json") as f:
    standings = json.load(f)

m = next((x for x in matchups if x["year"] == 2015 and x.get("home_manager_id")), None)
print("Matchup home_manager_id:", m["home_manager_id"])

s = next((row for row in standings if row["year"] == 2015 and row["manager_id"] == m["home_manager_id"]), None)
print("Found standing:", s["final_rank"] if s else "NOT FOUND")

print("All standings for 2015 managers:", [r["manager_id"] for r in standings if r["year"] == 2015])
