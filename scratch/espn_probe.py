"""
ESPN API Probe Script
Explores what data is available for league 262404 across all seasons (2015-2025).
"""
import json
import requests

LEAGUE_ID = 262404
ESPN_S2 = "AECsRJF9MDAbV7r%2B5QYwFlgdJDwOAPW6JwXQUr4HySnQb7oVTczxLHYP8Nd5cLfzXXfA%2BP2jOWqKJMoLUy4iNBMFiyk90uEDwWQyXZTCEdakgOxk0M8sP8dBc0WECa%2FUgc0t2zZWtNlAn%2BVBBbH%2FAr0YfegBKZBnSD8hQsbDKgjdYBGcrykrtSJVO5wO3dME9HjP%2FO7rMocn%2BjWGumm2H%2FwK8P2ZgBYhnXIOD%2F0Uk20HyHwHH0vgZjKub2QgzY9%2FMFY2yR8jGjhNGXqx33%2BBnjwX66dTQ6CgRDj3Uj0OjPWAIQ%3D%3D"
SWID = "{BFD6F1F8-D676-4D12-9030-3F76A4B7F468}"

COOKIES = {"espn_s2": ESPN_S2, "SWID": SWID}
HEADERS = {"Accept": "application/json"}

SEASONS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]

# ESPN has two base URLs - leagueHistory for old seasons, seasons for current/recent
HISTORY_URL = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{LEAGUE_ID}"
SEASON_URL  = f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{{year}}/segments/0/leagues/{LEAGUE_ID}"

def probe_season(year):
    """Try both endpoints and report what's available."""
    result = {"year": year, "history_ok": False, "season_ok": False, "teams": 0,
              "has_matchups": False, "has_draft": False, "has_scores": False,
              "current_week": None, "error": None}

    # 1. Try leagueHistory endpoint (works for all years)
    try:
        r = requests.get(
            HISTORY_URL,
            params={"seasonId": year, "view": ["mTeam", "mMatchup", "mSettings", "mStandings"]},
            cookies=COOKIES,
            headers=HEADERS,
            timeout=15
        )
        if r.status_code == 200:
            data = r.json()
            # leagueHistory returns a list
            if isinstance(data, list) and len(data) > 0:
                d = data[0]
            else:
                d = data
            result["history_ok"] = True
            teams = d.get("teams", [])
            result["teams"] = len(teams)
            schedule = d.get("schedule", [])
            result["has_matchups"] = len(schedule) > 0
            # Check if scores exist (not all zero)
            if schedule:
                first = schedule[0]
                h_score = first.get("home", {}).get("totalPoints", 0)
                a_score = first.get("away", {}).get("totalPoints", 0)
                result["has_scores"] = (h_score != 0 or a_score != 0)
            settings = d.get("settings", {})
            result["current_week"] = d.get("status", {}).get("currentMatchupPeriod")
        else:
            result["error"] = f"history HTTP {r.status_code}"
    except Exception as e:
        result["error"] = str(e)

    # 2. Try direct season endpoint (also useful for rosters/boxscores)
    try:
        r2 = requests.get(
            SEASON_URL.format(year=year),
            params={"view": ["mTeam", "mSettings"]},
            cookies=COOKIES,
            headers=HEADERS,
            timeout=15
        )
        result["season_ok"] = (r2.status_code == 200)
    except Exception:
        pass

    return result


def probe_draft(year):
    """Check if draft data is available."""
    try:
        r = requests.get(
            HISTORY_URL,
            params={"seasonId": year, "view": "mDraftDetail"},
            cookies=COOKIES,
            headers=HEADERS,
            timeout=15
        )
        if r.status_code == 200:
            data = r.json()
            d = data[0] if isinstance(data, list) and len(data) > 0 else data
            draft = d.get("draftDetail", {})
            picks = draft.get("picks", [])
            return len(picks)
    except Exception:
        pass
    return 0


def probe_boxscore(year, matchup_id=1):
    """Check if detailed player boxscore is available for a matchup."""
    try:
        r = requests.get(
            SEASON_URL.format(year=year),
            params={"view": "mBoxscore", "scoringPeriodId": 1},
            cookies=COOKIES,
            headers=HEADERS,
            timeout=15
        )
        if r.status_code == 200:
            data = r.json()
            schedule = data.get("schedule", [])
            if schedule:
                first = schedule[0]
                home_roster = first.get("home", {}).get("rosterForCurrentScoringPeriod", {})
                entries = home_roster.get("entries", [])
                return len(entries)
    except Exception:
        pass
    return 0


print("=" * 65)
print(f"ESPN API PROBE — League {LEAGUE_ID}")
print("=" * 65)

summary = []
for year in SEASONS:
    print(f"\n[{year}] Probing...", end=" ", flush=True)
    r = probe_season(year)

    if r["history_ok"]:
        draft_picks = probe_draft(year)
        r["draft_picks"] = draft_picks
        r["has_draft"] = draft_picks > 0

        boxscore_entries = probe_boxscore(year)
        r["boxscore_entries"] = boxscore_entries
    else:
        r["draft_picks"] = 0
        r["boxscore_entries"] = 0

    summary.append(r)

    status = "✅" if r["history_ok"] else "❌"
    print(f"{status} | Teams: {r['teams']} | Matchups: {r['has_matchups']} | "
          f"Scores: {r['has_scores']} | Draft picks: {r.get('draft_picks',0)} | "
          f"Boxscore entries: {r.get('boxscore_entries',0)}"
          + (f" | ERR: {r['error']}" if r['error'] else ""))

print("\n" + "=" * 65)
print("SUMMARY TABLE")
print("=" * 65)
print(f"{'Year':<6} {'API OK':<8} {'Teams':<7} {'Matchups':<10} {'Scores':<8} {'Draft':<8} {'Boxscore'}")
print("-" * 65)
for r in summary:
    print(f"{r['year']:<6} {'✅' if r['history_ok'] else '❌':<8} {r['teams']:<7} "
          f"{'✅' if r['has_matchups'] else '❌':<10} {'✅' if r['has_scores'] else '❌':<8} "
          f"{'✅' if r['has_draft'] else '❌':<8} "
          f"{'✅' if r.get('boxscore_entries',0) > 0 else '❌'} ({r.get('boxscore_entries',0)} entries)")

# Save raw probe results
with open("/tmp/espn_probe_results.json", "w") as f:
    json.dump(summary, f, indent=2)
print("\nFull results saved to /tmp/espn_probe_results.json")
