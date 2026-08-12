import sys
sys.path.append("/Users/Landon/Documents/Fantasy-Website/dad-league/scraper")
from espn_client import ESPNClient
import json

client = ESPNClient()
data_teams = client.fetch_teams_and_members(2023)
data_matchups = client.fetch_matchups(2023)
data_settings = client.fetch_settings(2023)

sched_settings = data_settings.get("settings", {}).get("scheduleSettings", {})
reg_season_weeks = sched_settings.get("matchupPeriodCount", 14) # note 2023 was 14 weeks
playoff_teams_count = sched_settings.get("playoffTeamCount", 6)
playoff_length = sched_settings.get("playoffMatchupPeriodLength", 1)

seeds = {}
for t in data_teams.get("teams", []):
    seeds[t.get("id")] = t.get("playoffSeed", 99)

contenders = set(tid for tid, s in seeds.items() if s <= playoff_teams_count)

schedule = data_matchups.get("schedule", [])
# Group by week
by_week = {}
for s in schedule:
    w = s.get("matchupPeriodId")
    if w not in by_week: by_week[w] = []
    by_week[w].append(s)

for w in sorted(by_week.keys()):
    if w <= reg_season_weeks: continue
    print(f"--- WEEK {w} ---")
    knockouts = set()
    for s in by_week[w]:
        h = s.get("home", {}).get("teamId")
        a = s.get("away", {}).get("teamId")
        if h in contenders and a in contenders:
            winner = s.get("winner")
            loser = None
            if winner == "HOME": loser = a
            elif winner == "AWAY": loser = h
            elif s.get("home", {}).get("totalPoints") > s.get("away", {}).get("totalPoints"): loser = a
            else: loser = h
            print(f"Championship Playoff: {h} vs {a} -> Loser: {loser}")
            if loser: knockouts.add(loser)
        elif h in contenders or a in contenders:
            print(f"Consolation/Bye: {h} vs {a}")
    contenders -= knockouts
