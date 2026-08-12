"""
ESPN Fantasy Football Data Parser.

Transforms raw ESPN API responses into clean, relational JSON datasets
matching the output schema used by the existing Yahoo Fantasy site.

Output files:
  - managers.json          → canonical manager identities
  - league_standings.json  → per-season standings
  - matchups.json          → all head-to-head matchup results
  - weekly_team_scores.json→ team score per week (all seasons)
  - weekly_player_stats.json → individual player scores (2018+ only)
  - draft_results.json     → draft picks with player names
  - team_stats.json        → aggregated seasonal team stats

DATA GAPS (noted inline):
  - 2015-2017: No player-level boxscores. Team totals + week scores only.
"""
import json
import logging
import os
from pathlib import Path

try:
    from .config import (
        PROCESSED_DATA_DIR, MANAGERS_JSON, MATCHUPS_JSON,
        LEAGUE_STANDINGS_JSON, TEAM_STATS_JSON, DRAFT_RESULTS_JSON,
        WEEKLY_TEAM_SCORES_JSON, WEEKLY_PLAYER_STATS_JSON,
        SLOT_MAP, STARTER_SLOTS, PRO_TEAM_MAP,
        BOXSCORE_SEASONS, TEAM_SCORE_ONLY_SEASONS, ALL_SEASONS
    )
    from .espn_client import ESPNClient
    from . import nfl_schedule
except ImportError:
    from config import (
        PROCESSED_DATA_DIR, MANAGERS_JSON, MATCHUPS_JSON,
        LEAGUE_STANDINGS_JSON, TEAM_STATS_JSON, DRAFT_RESULTS_JSON,
        WEEKLY_TEAM_SCORES_JSON, WEEKLY_PLAYER_STATS_JSON,
        SLOT_MAP, STARTER_SLOTS, PRO_TEAM_MAP,
        BOXSCORE_SEASONS, TEAM_SCORE_ONLY_SEASONS, ALL_SEASONS
    )
    from espn_client import ESPNClient
    import nfl_schedule

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Managers
# ─────────────────────────────────────────────────────────────────────────────

def load_managers() -> dict:
    """Load managers.json if it exists, else return empty scaffold."""
    if MANAGERS_JSON.exists():
        with open(MANAGERS_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"managers": [], "team_mappings": []}


def save_managers(data: dict):
    with open(MANAGERS_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def build_member_map(season_data: dict) -> dict:
    """
    Returns {member_id: {displayName, firstName, lastName}} from season data.
    Member IDs look like '{BFD6F1F8-D676-4D12-9030-3F76A4B7F468}'
    """
    members = season_data.get("members", [])
    return {
        m["id"]: {
            "displayName": m.get("displayName", ""),
            "firstName": m.get("firstName", ""),
            "lastName": m.get("lastName", ""),
        }
        for m in members
        if "id" in m
    }


def build_team_map(season_data: dict, member_map: dict, managers: dict = None) -> dict:
    """
    Returns {team_id: {name, abbrev, primaryOwner, ownerName, ownerId, canonical_name}} for a season.
    canonical_name: from managers.json (e.g. 'Nick') — falls back to raw ESPN name.
    """
    teams = season_data.get("teams", [])
    result = {}
    for t in teams:
        tid = t.get("id")
        if tid is None:
            continue
        owner_id = t.get("primaryOwner", "")
        owner_info = member_map.get(owner_id, {})
        raw_name = (
            f"{owner_info.get('firstName', '')} {owner_info.get('lastName', '')}".strip()
            or owner_info.get("displayName", "Unknown")
        )
        # Use canonical name from managers.json if available
        canonical = ""
        if managers:
            manager_slug = get_manager_slug(owner_id, managers, t.get("display_name", ""))
            canonical = get_canonical_name(owner_id, managers)
        result[tid] = {
            "team_id": tid,
            "team_name": t.get("name", ""),
            "abbrev": t.get("abbrev", ""),
            "owner_id": owner_id,
            "owner_name": canonical or raw_name,
            "display_name": owner_info.get("displayName", ""),
        }
    return result


def get_canonical_name(owner_id: str, managers_data: dict) -> str:
    """Returns canonical display name for an ESPN owner_id."""
    for m in managers_data.get("managers", []):
        if m.get("espn_id") == owner_id:
            return m["name"]
    return ""


def update_managers_registry(client: ESPNClient):
    """
    Ensure all historical managers are documented.
    We just copy managers_canonical.json to data/managers.json 
    to ensure the canonical IDs and statuses are used across the app.
    """
    canonical_path = os.path.join(os.path.dirname(__file__), "managers_canonical.json")
    existing_path = os.path.join(os.path.dirname(__file__), "../data/managers.json")
    
    try:
        with open(canonical_path, "r") as f:
            canonical_data = json.load(f)
            
        with open(existing_path, "w") as f:
            json.dump(canonical_data, f, indent=2)
            
        logger.info(f"managers.json updated with {len(canonical_data.get('managers', []))} canonical managers.")
        return canonical_data
    except Exception as e:
        logger.error(f"Failed to update managers registry from canonical: {e}")
        return {"managers": []}


def get_manager_slug(owner_id: str, managers_data: dict, display_name: str = "") -> str:
    """Resolve an ESPN owner_id to a canonical manager slug."""
    for m in managers_data.get("managers", []):
        if m.get("espn_id") == owner_id:
            return m["id"]
        # Fallback to display_name matching if ESPN IDs got shifted
        if display_name and m.get("display_name") and m.get("display_name").lower() == display_name.lower():
            return m["id"]
    return owner_id  # fallback to raw ID


# ─────────────────────────────────────────────────────────────────────────────
# League Standings
# ─────────────────────────────────────────────────────────────────────────────

def parse_standings(year: int, client: ESPNClient, managers: dict) -> list:
    """
    Returns list of team standings for the given year.
    Schema: {year, team_id, team_name, manager_id, manager_name, wins, losses, ties,
             points_for, points_against, playoff_seed, final_rank}
    """
    data = client.fetch_teams_and_members(year)
    member_map = build_member_map(data)
    team_map = build_team_map(data, member_map, managers)

    standings = []
    for t in data.get("teams", []):
        tid = t.get("id")
        tinfo = team_map.get(tid, {})
        record = t.get("record", {}).get("overall", {})
        standings.append({
            "year": year,
            "team_id": tid,
            "team_name": tinfo.get("team_name", ""),
            "manager_id": get_manager_slug(tinfo.get("owner_id", ""), managers, tinfo.get("display_name", "")),
            "manager_name": tinfo.get("owner_name", ""),
            "wins": record.get("wins", 0),
            "losses": record.get("losses", 0),
            "ties": record.get("ties", 0),
            "points_for": round(record.get("pointsFor", 0.0), 2),
            "points_against": round(record.get("pointsAgainst", 0.0), 2),
            "playoff_seed": t.get("playoffSeed"),
            "final_rank": t.get("rankCalculatedFinal") or t.get("rankFinal"),
        })

    # Sort by final rank if available, else by wins desc
    standings.sort(key=lambda x: (x["final_rank"] or 99, -x["wins"]))
    return standings


# ─────────────────────────────────────────────────────────────────────────────
# Matchups
# ─────────────────────────────────────────────────────────────────────────────

def parse_matchups(year: int, client: ESPNClient, managers: dict) -> list:
    """
    Returns all matchups for the given year.
    Schema: {year, week, matchup_id, home_team_id, home_manager_id, home_team_name,
             home_score, away_team_id, away_manager_id, away_team_name, away_score,
             winner, is_playoff}
    """
    data_teams = client.fetch_teams_and_members(year)
    data_matchups = client.fetch_matchups(year)
    data_settings = client.fetch_settings(year)
    member_map = build_member_map(data_teams)
    team_map = build_team_map(data_teams, member_map, managers)

    # Determine regular season week count
    sched_settings = data_settings.get("settings", {}).get("scheduleSettings", {})
    reg_season_weeks = sched_settings.get("matchupPeriodCount", 13)

    schedule = data_matchups.get("schedule", [])
    
    # Bracket Tracing to determine true championship games
    playoff_teams_count = sched_settings.get("playoffTeamCount", 6)
    seeds = {t.get("id"): t.get("playoffSeed", 99) for t in data_teams.get("teams", [])}
    contenders = set(tid for tid, s in seeds.items() if s <= playoff_teams_count)
    
    # Group schedule by week to process chronologically
    by_week = {}
    for s in schedule:
        w = s.get("matchupPeriodId")
        if w is None: continue
        by_week.setdefault(w, []).append(s)

    true_playoff_game_ids = set()
    third_place_game_ids = set()
    previous_knockouts = set()
    for w in sorted(by_week.keys()):
        if w <= reg_season_weeks: continue
        knockouts = set()
        for s in by_week[w]:
            h = s.get("home", {}).get("teamId")
            a = s.get("away", {}).get("teamId")
            if h in contenders and a in contenders:
                true_playoff_game_ids.add(s.get("id"))
                winner = s.get("winner")
                loser = None
                if winner == "HOME": loser = a
                elif winner == "AWAY": loser = h
                elif s.get("home", {}).get("totalPoints", 0) > s.get("away", {}).get("totalPoints", 0): loser = a
                else: loser = h
                if loser: knockouts.add(loser)
            elif h in previous_knockouts and a in previous_knockouts:
                third_place_game_ids.add(s.get("id"))
        contenders -= knockouts
        previous_knockouts = knockouts

    matchups = []

    for s in schedule:
        week = s.get("matchupPeriodId")
        if week is None:
            continue

        home = s.get("home", {})
        away = s.get("away", {})
        home_id = home.get("teamId")
        away_id = away.get("teamId")

        if not home_id or not away_id:
            continue  # bye week or malformed

        home_info = team_map.get(home_id, {})
        away_info = team_map.get(away_id, {})

        is_true_playoff = s.get("id") in true_playoff_game_ids
        is_third_place = s.get("id") in third_place_game_ids
        is_consolation = week > reg_season_weeks and not is_true_playoff and not is_third_place

        game_type = "Regular Season"
        if is_true_playoff:
            game_type = "Championship"
        elif is_third_place:
            game_type = "3rd Place"
        elif is_consolation:
            game_type = "Consolation"

        matchups.append({
            "year": year,
            "week": week,
            "matchup_id": s.get("id"),
            "game_type": game_type,
            "is_playoff": is_true_playoff,
            "is_consolation": is_consolation,
            "home_team_id": home_id,
            "home_team_name": home_info.get("team_name", ""),
            "home_manager_id": get_manager_slug(home_info.get("owner_id", ""), managers, home_info.get("display_name", "")),
            "home_manager_name": home_info.get("owner_name", ""),
            "home_score": round(home.get("totalPoints", 0.0), 2),
            "away_team_id": away_id,
            "away_team_name": away_info.get("team_name", ""),
            "away_manager_id": get_manager_slug(away_info.get("owner_id", ""), managers, away_info.get("display_name", "")),
            "away_manager_name": away_info.get("owner_name", ""),
            "away_score": round(away.get("totalPoints", 0.0), 2),
            "winner": s.get("winner", "UNDECIDED"),  # HOME, AWAY, UNDECIDED, or None
        })

    matchups.sort(key=lambda x: (x["week"], x["matchup_id"] or 0))
    return matchups


# ─────────────────────────────────────────────────────────────────────────────
# Weekly Team Scores
# ─────────────────────────────────────────────────────────────────────────────

def parse_weekly_team_scores(year: int, client: ESPNClient, managers: dict) -> list:
    """
    Returns per-team per-week score breakdown (available for all years).
    Uses pointsByScoringPeriod from matchup data — more granular than totalPoints.

    Schema: {year, week, team_id, team_name, manager_id, manager_name, score, is_playoff}
    """
    data_teams = client.fetch_teams_and_members(year)
    data_matchups = client.fetch_matchups(year)
    data_settings = client.fetch_settings(year)
    member_map = build_member_map(data_teams)
    team_map = build_team_map(data_teams, member_map, managers)

    sched_settings = data_settings.get("settings", {}).get("scheduleSettings", {})
    reg_season_weeks = sched_settings.get("matchupPeriodCount", 13)

    rows = []
    seen = set()  # (year, week, team_id) dedup

    for s in data_matchups.get("schedule", []):
        matchup_week = s.get("matchupPeriodId")
        if matchup_week is None:
            continue
        is_playoff = matchup_week > reg_season_weeks

        for side in ["home", "away"]:
            side_data = s.get(side, {})
            tid = side_data.get("teamId")
            if not tid:
                continue
            tinfo = team_map.get(tid, {})

            # pointsByScoringPeriod gives individual week scores within a matchup
            # (useful for 2-week playoff matchups)
            pbsp = side_data.get("pointsByScoringPeriod", {})
            if pbsp:
                for scoring_period_str, score in pbsp.items():
                    week = int(scoring_period_str)
                    key = (year, week, tid)
                    if key in seen:
                        continue
                    seen.add(key)
                    rows.append({
                        "year": year,
                        "week": week,
                        "matchup_week": matchup_week,
                        "team_id": tid,
                        "team_name": tinfo.get("team_name", ""),
                        "manager_id": get_manager_slug(tinfo.get("owner_id", ""), managers, tinfo.get("display_name", "")),
                        "manager_name": tinfo.get("owner_name", ""),
                        "score": round(score, 2),
                        "is_playoff": is_playoff,
                    })
            else:
                # Fallback: use totalPoints for the matchup week
                key = (year, matchup_week, tid)
                if key not in seen:
                    seen.add(key)
                    rows.append({
                        "year": year,
                        "week": matchup_week,
                        "matchup_week": matchup_week,
                        "team_id": tid,
                        "team_name": tinfo.get("team_name", ""),
                        "manager_id": get_manager_slug(tinfo.get("owner_id", ""), managers, tinfo.get("display_name", "")),
                        "manager_name": tinfo.get("owner_name", ""),
                        "score": round(side_data.get("totalPoints", 0.0), 2),
                        "is_playoff": is_playoff,
                    })

    rows.sort(key=lambda x: (x["week"], x["team_id"]))
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Player-Level Boxscores (2018+ only)
# ─────────────────────────────────────────────────────────────────────────────

def parse_weekly_player_stats(year: int, client: ESPNClient, managers: dict,
                               num_weeks: int) -> list:
    """
    Returns player-level boxscores for all weeks of the season.
    ONLY available for 2018+. Returns empty list for earlier years.

    Schema: {year, week, team_id, manager_id, player_id, player_name,
             nfl_team, position_slot, is_starter, fantasy_points}
    """
    if year < 2018:
        logger.info(f"[{year}] Skipping player stats — not available pre-2018.")
        return []

    data_teams = client.fetch_teams_and_members(year)
    member_map = build_member_map(data_teams)
    team_map = build_team_map(data_teams, member_map, managers)

    all_rows = []

    for week in range(1, num_weeks + 1):
        logger.info(f"  [{year}] Fetching boxscore week {week}...")
        boxscore_data = client.fetch_boxscores(year, week)
        schedule = boxscore_data.get("schedule", [])

        for matchup in schedule:
            matchup_week = matchup.get("matchupPeriodId")
            for side in ["home", "away"]:
                side_data = matchup.get(side, {})
                tid = side_data.get("teamId")
                if not tid:
                    continue
                tinfo = team_map.get(tid, {})
                manager_id = get_manager_slug(tinfo.get("owner_id", ""), managers, tinfo.get("display_name", ""))

                roster = side_data.get(
                    "rosterForCurrentScoringPeriod",
                    side_data.get("rosterForMatchupPeriod", {})
                )
                entries = roster.get("entries", [])

                for entry in entries:
                    slot_id = entry.get("lineupSlotId", 20)
                    player_pool = entry.get("playerPoolEntry", {})
                    player = player_pool.get("player", {})
                    player_id = entry.get("playerId") or player_pool.get("id")
                    player_name = player.get("fullName", "Unknown")
                    nfl_team_id = player.get("proTeamId", 0)
                    fantasy_pts = player_pool.get("appliedStatTotal", 0.0)

                    # Extract projected points and detailed stats
                    projected_pts = 0.0
                    stat_line = {}
                    
                    for stat_block in player.get("stats", []):
                        # Projected stats
                        if stat_block.get("statSourceId") == 1 and stat_block.get("scoringPeriodId") == week:
                            # Usually in appliedTotal, but sometimes just 0.0 if not fully calculated
                            # But ESPN often zeroes this out historically. We'll grab it if it's there.
                            projected_pts = stat_block.get("appliedTotal", 0.0)
                        # Actual stats
                        elif stat_block.get("statSourceId") == 0 and stat_block.get("scoringPeriodId") == week:
                            stat_line = stat_block.get("stats", {})

                    nfl_team_str = PRO_TEAM_MAP.get(nfl_team_id, str(nfl_team_id))
                    opponent_abbr, game_result = None, None
                    if nfl_team_str != "None" and nfl_team_str != "0":
                        opponent_abbr, game_result = nfl_schedule.get_nfl_game(year, week, nfl_team_str)

                    # Filter to only the requested scoring week
                    # (boxscore endpoint returns all players on roster, any week)
                    all_rows.append({
                        "year": year,
                        "week": week,
                        "matchup_week": matchup_week,
                        "team_id": tid,
                        "team_name": tinfo.get("team_name", ""),
                        "manager_id": manager_id,
                        "manager_name": tinfo.get("owner_name", ""),
                        "player_id": player_id,
                        "player_name": player_name,
                        "nfl_team": nfl_team_str,
                        "nfl_opponent": opponent_abbr,
                        "nfl_game_result": game_result,
                        "lineup_slot_id": slot_id,
                        "position": SLOT_MAP.get(slot_id, "?"),
                        "is_starter": slot_id in STARTER_SLOTS,
                        "fantasy_points": round(fantasy_pts or 0.0, 2),
                        "projected_points": round(projected_pts, 2),
                        "stat_line": stat_line,
                        "data_available": True,
                    })

    return all_rows


# ─────────────────────────────────────────────────────────────────────────────
# Draft Results
# ─────────────────────────────────────────────────────────────────────────────

def parse_draft(year: int, client: ESPNClient, managers: dict) -> list:
    """
    Returns all draft picks for the given year with player names resolved.

    Schema: {year, overall_pick, round, round_pick, team_id, team_name,
             manager_id, manager_name, player_id, player_name, is_keeper, bid_amount}
    """
    data_teams = client.fetch_teams_and_members(year)
    data_draft = client.fetch_draft(year)
    member_map = build_member_map(data_teams)
    team_map = build_team_map(data_teams, member_map, managers)

    # Build player name map for this season
    # Attempt from the players endpoint; fall back to IDs from the draft picks themselves
    logger.info(f"  [{year}] Building player name map...")
    player_map = client.build_player_map(year)

    picks = data_draft.get("draftDetail", {}).get("picks", [])
    rows = []

    for pick in picks:
        tid = pick.get("teamId")
        tinfo = team_map.get(tid, {})
        player_id = pick.get("playerId")
        player_name = player_map.get(player_id, f"Player #{player_id}")

        rows.append({
            "year": year,
            "overall_pick": pick.get("overallPickNumber"),
            "round": pick.get("roundId"),
            "round_pick": pick.get("roundPickNumber"),
            "team_id": tid,
            "team_name": tinfo.get("team_name", ""),
            "manager_id": get_manager_slug(tinfo.get("owner_id", ""), managers, tinfo.get("display_name", "")),
            "manager_name": tinfo.get("owner_name", ""),
            "player_id": player_id,
            "player_name": player_name,
            "is_keeper": pick.get("keeper", False),
            "bid_amount": pick.get("bidAmount", 0),
        })

    rows.sort(key=lambda x: x["overall_pick"] or 0)
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Team Stats (seasonal aggregates)
# ─────────────────────────────────────────────────────────────────────────────

def parse_team_stats(year: int, matchups: list, standings: list) -> list:
    """
    Derives aggregated team stats from matchup results.
    Calculates: high score week, low score week, win/loss streaks, etc.

    Schema: {year, team_id, manager_id, team_name, manager_name,
             wins, losses, points_for, points_against, avg_score,
             high_score, high_score_week, low_score, low_score_week,
             made_playoffs}
    """
    from collections import defaultdict

    # Build per-team score lists from weekly_team_scores (passed as matchups for now)
    reg_matchups = [m for m in matchups if not m.get("is_playoff")]

    team_scores = defaultdict(list)
    team_meta = {}
    team_wins = defaultdict(int)
    team_losses = defaultdict(int)
    team_pf = defaultdict(float)
    team_pa = defaultdict(float)

    for m in reg_matchups:
        for side, opp in [("home", "away"), ("away", "home")]:
            tid = m[f"{side}_team_id"]
            opp_tid = m[f"{opp}_team_id"]
            score = m[f"{side}_score"]
            opp_score = m[f"{opp}_score"]
            team_scores[tid].append((m["week"], score))
            team_pf[tid] += score
            team_pa[tid] += opp_score
            team_meta[tid] = {
                "team_name": m[f"{side}_team_name"],
                "manager_id": m[f"{side}_manager_id"],
                "manager_name": m[f"{side}_manager_name"],
            }
            winner = m.get("winner", "").upper()
            if winner == side.upper():
                team_wins[tid] += 1
            elif winner == opp.upper():
                team_losses[tid] += 1

    # Pull final rank from standings
    rank_map = {s["team_id"]: s for s in standings}

    rows = []
    for tid, scores in team_scores.items():
        if not scores:
            continue
        weeks, pts = zip(*scores)
        high_idx = pts.index(max(pts))
        low_idx = pts.index(min(pts))

        standing = rank_map.get(tid, {})
        made_playoffs = (standing.get("playoff_seed") is not None and
                         standing.get("playoff_seed", 99) <= 6)

        rows.append({
            "year": year,
            "team_id": tid,
            "team_name": team_meta[tid]["team_name"],
            "manager_id": team_meta[tid]["manager_id"],
            "manager_name": team_meta[tid]["manager_name"],
            "wins": team_wins[tid],
            "losses": team_losses[tid],
            "points_for": round(team_pf[tid], 2),
            "points_against": round(team_pa[tid], 2),
            "avg_score": round(team_pf[tid] / len(scores), 2) if scores else 0,
            "high_score": round(max(pts), 2),
            "high_score_week": weeks[high_idx],
            "low_score": round(min(pts), 2),
            "low_score_week": weeks[low_idx],
            "made_playoffs": made_playoffs,
            "final_rank": standing.get("final_rank"),
            "playoff_seed": standing.get("playoff_seed"),
        })

    rows.sort(key=lambda x: (x["year"], -(x["points_for"] or 0)))
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Save helpers
# ─────────────────────────────────────────────────────────────────────────────

def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    logger.info(f"Saved {len(data)} records → {path.name}")
