"""
Investigate ESPN player name lookup options for draft resolution.
"""
import requests
import json

LEAGUE_ID = 262404
ESPN_S2 = "AECsRJF9MDAbV7r%2B5QYwFlgdJDwOAPW6JwXQUr4HySnQb7oVTczxLHYP8Nd5cLfzXXfA%2BP2jOWqKJMoLUy4iNBMFiyk90uEDwWQyXZTCEdakgOxk0M8sP8dBc0WECa%2FUgc0t2zZWtNlAn%2BVBBbH%2FAr0YfegBKZBnSD8hQsbDKgjdYBGcrykrtSJVO5wO3dME9HjP%2FO7rMocn%2BjWGumm2H%2FwK8P2ZgBYhnXIOD%2F0Uk20HyHwHH0vgZjKub2QgzY9%2FMFY2yR8jGjhNGXqx33%2BBnjwX66dTQ6CgRDj3Uj0OjPWAIQ%3D%3D"
SWID = "{BFD6F1F8-D676-4D12-9030-3F76A4B7F468}"
COOKIES = {"espn_s2": ESPN_S2, "SWID": SWID}
HEADERS = {"Accept": "application/json"}

year = 2024

# Known player IDs from 2024 draft round 1
test_ids = [4241389, 4262921, 4362628, 3929630, 4429795]

# Try the mRoster view on a per-season endpoint (has player names embedded)
print("=== Approach 1: mRoster view ===")
r = requests.get(
    f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{LEAGUE_ID}",
    params={"view": "mRoster"},
    cookies=COOKIES, headers=HEADERS, timeout=20
)
print(f"Status: {r.status_code}")
if r.status_code == 200:
    data = r.json()
    teams = data.get("teams", [])
    if teams:
        entries = teams[0].get("roster", {}).get("entries", [])
        print(f"Team 0 roster entries: {len(entries)}")
        if entries:
            e = entries[0]
            print(f"Entry keys: {list(e.keys())}")
            pp = e.get("playerPoolEntry", {})
            print(f"playerPoolEntry keys: {list(pp.keys())}")
            p = pp.get("player", {})
            print(f"player keys: {list(p.keys())}")
            print(f"fullName: {p.get('fullName')}")

# Approach 2: mDraftDetail with view=mRoster on history endpoint
print("\n=== Approach 2: mDraftDetail includes player info on history ===")
r2 = requests.get(
    f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{LEAGUE_ID}",
    params={"seasonId": year, "view": ["mDraftDetail", "mSettings"]},
    cookies=COOKIES, headers=HEADERS, timeout=20
)
if r2.status_code == 200:
    d = r2.json()
    d = d[0] if isinstance(d, list) else d
    picks = d.get("draftDetail", {}).get("picks", [])
    if picks:
        p0 = picks[0]
        print(f"Pick keys: {list(p0.keys())}")
        # Check if playerInfo is embedded
        print(f"Has 'playerInfo'? {'playerInfo' in p0}")

# Approach 3: players endpoint with specific player IDs
print("\n=== Approach 3: players endpoint with view=mList ===")
player_ids_str = ",".join(str(i) for i in test_ids)
r3 = requests.get(
    f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/players",
    params={"view": "mList", "filterIds": {"value": test_ids}},
    cookies=COOKIES, headers=HEADERS, timeout=20
)
print(f"Status: {r3.status_code}")
if r3.status_code == 200:
    data3 = r3.json()
    print(f"Type: {type(data3)}, len: {len(data3) if isinstance(data3, list) else 'n/a'}")
    if isinstance(data3, list) and data3:
        print(f"First item keys: {list(data3[0].keys())}")
        print(f"Sample: {data3[0]}")

# Approach 4: kona_player_info endpoint (used by many ESPN scrapers)
print("\n=== Approach 4: kona_player_info ===")
import urllib.parse
filter_json = json.dumps({"players": {"filterIds": {"value": test_ids}}})
r4 = requests.get(
    f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/players",
    params={"view": "kona_player_info", "scoringPeriodId": 1},
    headers={**HEADERS, "x-fantasy-filter": filter_json},
    cookies=COOKIES,
    timeout=20
)
print(f"Status: {r4.status_code}")
if r4.status_code == 200:
    data4 = r4.json()
    print(f"Type: {type(data4)}")
    if isinstance(data4, list):
        print(f"Count: {len(data4)}")
        if data4:
            print(f"Keys: {list(data4[0].keys())}")
            print(f"Sample name: {data4[0].get('fullName') or data4[0].get('onTeamId')}")

# Approach 5: mBoxscore for week 1 - grab player names from there and build map
print("\n=== Approach 5: Build player map from boxscores ===")
r5 = requests.get(
    f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{LEAGUE_ID}",
    params={"view": "mBoxscore", "scoringPeriodId": 1},
    cookies=COOKIES, headers=HEADERS, timeout=20
)
player_map = {}
if r5.status_code == 200:
    data5 = r5.json()
    for matchup in data5.get("schedule", []):
        for side in ["home", "away"]:
            roster = matchup.get(side, {}).get("rosterForCurrentScoringPeriod",
                     matchup.get(side, {}).get("rosterForMatchupPeriod", {}))
            for entry in roster.get("entries", []):
                pid = entry.get("playerId")
                pp = entry.get("playerPoolEntry", {})
                name = pp.get("player", {}).get("fullName")
                if pid and name:
                    player_map[pid] = name

print(f"Players found in week 1 boxscore: {len(player_map)}")
# Check if our draft picks are covered
for pid in test_ids:
    print(f"  {pid}: {player_map.get(pid, 'NOT IN BOXSCORE')}")
