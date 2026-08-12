import json
with open("/Users/Landon/Documents/Fantasy-Website/dad-league/scraper/raw_data/season_2024_matchups_w1.json") as f:
    box = json.load(f)

for m in box.get("schedule", []):
    for entry in m.get("home", {}).get("rosterForCurrentScoringPeriod", {}).get("entries", []):
        p = entry.get("playerPoolEntry", {}).get("player", {})
        print("Player:", p.get("fullName"))
        print("proTeamId:", p.get("proTeamId"))
        for s in p.get("stats", []):
            if s.get("statSourceId") == 0:
                print("stats:", list(s.keys()))
                print("proOpponentId:", s.get("proOpponentId", "N/A"))
        break
    break

