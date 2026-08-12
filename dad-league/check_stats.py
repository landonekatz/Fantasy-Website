import json
with open("scraper/raw_data/2023_boxscore_w1.json") as f:
    data = json.load(f)

for m in data.get("schedule", []):
    for side in ["home", "away"]:
        for e in m.get(side, {}).get("rosterForCurrentScoringPeriod", {}).get("entries", []):
            p = e.get("playerPoolEntry", {}).get("player", {})
            if p.get("defaultPositionId") == 1:
                for s in p.get("stats", []):
                    if s.get("statSourceId") == 0:
                        print(p.get("fullName"), s.get("stats"))
                        exit()
