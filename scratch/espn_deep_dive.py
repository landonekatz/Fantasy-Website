"""
Deep dive into ESPN API data shapes:
1. What does a 2015 matchup look like (no boxscore)?
2. What does a 2018+ boxscore look like?
3. What team/manager fields are available?
4. What does draft data look like?
5. Check if 2015-2017 have player-level data via a different view
"""
import json
import requests
from urllib.parse import unquote

LEAGUE_ID = 262404
ESPN_S2 = "AECsRJF9MDAbV7r%2B5QYwFlgdJDwOAPW6JwXQUr4HySnQb7oVTczxLHYP8Nd5cLfzXXfA%2BP2jOWqKJMoLUy4iNBMFiyk90uEDwWQyXZTCEdakgOxk0M8sP8dBc0WECa%2FUgc0t2zZWtNlAn%2BVBBbH%2FAr0YfegBKZBnSD8hQsbDKgjdYBGcrykrtSJVO5wO3dME9HjP%2FO7rMocn%2BjWGumm2H%2FwK8P2ZgBYhnXIOD%2F0Uk20HyHwHH0vgZjKub2QgzY9%2FMFY2yR8jGjhNGXqx33%2BBnjwX66dTQ6CgRDj3Uj0OjPWAIQ%3D%3D"
SWID = "{BFD6F1F8-D676-4D12-9030-3F76A4B7F468}"
COOKIES = {"espn_s2": ESPN_S2, "SWID": SWID}
HEADERS = {"Accept": "application/json"}

HISTORY_URL = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{LEAGUE_ID}"
SEASON_URL  = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{{year}}/segments/0/leagues/{LEAGUE_ID}"

def fetch(url, params):
    r = requests.get(url, params=params, cookies=COOKIES, headers=HEADERS, timeout=15)
    r.raise_for_status()
    return r.json()

# ─────────────────────────────────────────────────
# 1. Team/Manager fields for 2015
# ─────────────────────────────────────────────────
print("\n" + "="*60)
print("1. TEAM FIELDS FOR 2015")
print("="*60)
data = fetch(HISTORY_URL, {"seasonId": 2015, "view": "mTeam"})
d = data[0] if isinstance(data, list) else data
teams = d.get("teams", [])
if teams:
    t = teams[0]
    print(f"Team keys: {list(t.keys())}")
    print(f"Sample team:")
    print(f"  id: {t.get('id')}")
    print(f"  name: {t.get('name')}")
    print(f"  abbrev: {t.get('abbrev')}")
    print(f"  location: {t.get('location')}")
    print(f"  nickname: {t.get('nickname')}")
    print(f"  primaryOwner: {t.get('primaryOwner')}")
    owners = t.get("owners", [])
    print(f"  owners: {owners}")
    record = t.get("record", {})
    print(f"  record keys: {list(record.keys()) if record else 'none'}")
    print(f"  record overall: {record.get('overall', {})}")

# Members (actual user info)
members = d.get("members", [])
print(f"\nMembers count: {len(members)}")
if members:
    m = members[0]
    print(f"Member keys: {list(m.keys())}")
    print(f"Sample member: id={m.get('id')} displayName={m.get('displayName')} firstName={m.get('firstName')} lastName={m.get('lastName')}")

# ─────────────────────────────────────────────────
# 2. Schedule/Matchup shape for 2015
# ─────────────────────────────────────────────────
print("\n" + "="*60)
print("2. MATCHUP SHAPE FOR 2015 (first 2 matchups)")
print("="*60)
data = fetch(HISTORY_URL, {"seasonId": 2015, "view": "mMatchup"})
d = data[0] if isinstance(data, list) else data
schedule = d.get("schedule", [])
print(f"Total matchups in schedule: {len(schedule)}")
if schedule:
    s = schedule[0]
    print(f"Matchup keys: {list(s.keys())}")
    print(f"matchupPeriodId: {s.get('matchupPeriodId')}")
    print(f"winner: {s.get('winner')}")
    home = s.get("home", {})
    away = s.get("away", {})
    print(f"home keys: {list(home.keys())}")
    print(f"home teamId: {home.get('teamId')}, totalPoints: {home.get('totalPoints')}")
    print(f"away teamId: {away.get('teamId')}, totalPoints: {away.get('totalPoints')}")
    # Check for roster
    home_roster = home.get("rosterForCurrentScoringPeriod", {})
    print(f"home rosterForCurrentScoringPeriod entries: {len(home_roster.get('entries', []))}")
    home_roster2 = home.get("rosterForMatchupPeriod", {})
    print(f"home rosterForMatchupPeriod entries: {len(home_roster2.get('entries', []))}")

# Try mMatchupScore view
print("\n--- Trying mMatchupScore view for 2015 ---")
try:
    data2 = fetch(HISTORY_URL, {"seasonId": 2015, "view": "mMatchupScore"})
    d2 = data2[0] if isinstance(data2, list) else data2
    sched2 = d2.get("schedule", [])
    if sched2:
        s2 = sched2[0]
        home2 = s2.get("home", {})
        print(f"mMatchupScore home keys: {list(home2.keys())}")
        roster = home2.get("rosterForCurrentScoringPeriod", home2.get("rosterForMatchupPeriod", {}))
        entries = roster.get("entries", [])
        print(f"mMatchupScore roster entries: {len(entries)}")
        if entries:
            e = entries[0]
            print(f"Entry keys: {list(e.keys())}")
            pi = e.get("playerPoolEntry", {})
            print(f"playerPoolEntry keys: {list(pi.keys())}")
            player = pi.get("player", {})
            print(f"player fullName: {player.get('fullName')}")
            stats = pi.get("appliedStatTotal", None)
            print(f"appliedStatTotal: {stats}")
except Exception as ex:
    print(f"mMatchupScore failed: {ex}")

# ─────────────────────────────────────────────────
# 3. Boxscore shape for 2018 (has entries)
# ─────────────────────────────────────────────────
print("\n" + "="*60)
print("3. BOXSCORE SHAPE FOR 2018 (week 1, first matchup)")
print("="*60)
data = fetch(SEASON_URL.format(year=2018), {"view": "mBoxscore", "scoringPeriodId": 1})
schedule = data.get("schedule", [])
if schedule:
    s = schedule[0]
    home = s.get("home", {})
    roster = home.get("rosterForCurrentScoringPeriod", home.get("rosterForMatchupPeriod", {}))
    entries = roster.get("entries", [])
    print(f"Total entries (players): {len(entries)}")
    if entries:
        e = entries[0]
        print(f"Entry keys: {list(e.keys())}")
        print(f"  lineupSlotId: {e.get('lineupSlotId')}")
        print(f"  playerPoolEntry keys: {list(e.get('playerPoolEntry', {}).keys())}")
        pi = e.get("playerPoolEntry", {})
        player = pi.get("player", {})
        print(f"  player fullName: {player.get('fullName')}")
        print(f"  player proTeamId: {player.get('proTeamId')}")
        print(f"  appliedStatTotal: {pi.get('appliedStatTotal')}")
        stats = pi.get("stats", [])
        print(f"  stats count: {len(stats)}")
        if stats:
            st = stats[0]
            print(f"  stats[0] keys: {list(st.keys())}")
            print(f"  stats[0] appliedTotal: {st.get('appliedTotal')}")
            print(f"  stats[0] scoringPeriodId: {st.get('scoringPeriodId')}")

# ─────────────────────────────────────────────────
# 4. Draft shape
# ─────────────────────────────────────────────────
print("\n" + "="*60)
print("4. DRAFT SHAPE FOR 2019 (first 3 picks)")
print("="*60)
data = fetch(HISTORY_URL, {"seasonId": 2019, "view": "mDraftDetail"})
d = data[0] if isinstance(data, list) else data
picks = d.get("draftDetail", {}).get("picks", [])
print(f"Total picks: {len(picks)}")
for pick in picks[:3]:
    print(f"  Pick keys: {list(pick.keys())}")
    print(f"  Round {pick.get('roundId')} Pick {pick.get('roundPickNumber')}: "
          f"playerId={pick.get('playerId')} teamId={pick.get('teamId')} "
          f"bidAmount={pick.get('bidAmount')} keeper={pick.get('keeper')}")
    break

# ─────────────────────────────────────────────────
# 5. Settings — scoring type, playoff weeks, etc.
# ─────────────────────────────────────────────────
print("\n" + "="*60)
print("5. SETTINGS FOR 2024")
print("="*60)
data = fetch(HISTORY_URL, {"seasonId": 2024, "view": "mSettings"})
d = data[0] if isinstance(data, list) else data
settings = d.get("settings", {})
sched_settings = settings.get("scheduleSettings", {})
print(f"numberOfPlayoffTeams: {sched_settings.get('playoffTeamCount')}")
print(f"matchupPeriodCount: {sched_settings.get('matchupPeriodCount')}")
print(f"playoffMatchupPeriodLength: {sched_settings.get('playoffMatchupPeriodLength')}")
print(f"matchupPeriods: {sched_settings.get('matchupPeriods', {})}")

status = d.get("status", {})
print(f"\nStatus keys: {list(status.keys())}")
print(f"currentMatchupPeriod: {status.get('currentMatchupPeriod')}")
print(f"finalScoringPeriod: {status.get('finalScoringPeriod')}")
print(f"latestScoringPeriod: {status.get('latestScoringPeriod')}")

print("\n\nDONE.")
