from espn_client import ESPNClient
import os

client = ESPNClient()
box = client.fetch_boxscores(2024, 1)

for m in box.get("schedule", []):
    for entry in m.get("home", {}).get("rosterForCurrentScoringPeriod", {}).get("entries", []):
        p = entry.get("playerPoolEntry", {}).get("player", {})
        print("Player:", p.get("fullName"))
        print("proTeamId:", p.get("proTeamId"))
        for s in p.get("stats", []):
            if s.get("statSourceId") == 0:
                print("proOpponentId:", s.get("proOpponentId", "N/A"))
        break
    break
