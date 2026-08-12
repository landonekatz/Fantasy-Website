from espn_client import ESPNClient
client = ESPNClient()
box = client.fetch_boxscores(2024, 1)

for m in box.get("schedule", []):
    for entry in m.get("home", {}).get("rosterForCurrentScoringPeriod", {}).get("entries", []):
        p = entry.get("playerPoolEntry", {}).get("player", {})
        for s in p.get("stats", []):
            if s.get("statSourceId") == 0:
                print("stats keys:", s.keys())
        break
    break
