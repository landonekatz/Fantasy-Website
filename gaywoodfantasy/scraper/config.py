"""
Configuration for Dad's ESPN Fantasy Football League Scraper.
League ID: 262404 | Active since: 2015
"""
from pathlib import Path

# ── League Identity ───────────────────────────────────────────────────────────
LEAGUE_ID = 262404

# All seasons (year = year the first NFL game of that season was played)
ALL_SEASONS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]

# Seasons with full player-level boxscore data (2018+)
BOXSCORE_SEASONS = [y for y in ALL_SEASONS if y >= 2018]

# Seasons where we only have team-level scores (2015-2017)
TEAM_SCORE_ONLY_SEASONS = [y for y in ALL_SEASONS if y < 2018]

# ── ESPN API Base URLs ────────────────────────────────────────────────────────
# leagueHistory: best for past seasons (returns list wrapper)
HISTORY_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/{league_id}"
# seasons: needed for boxscores (current-style endpoint)
SEASON_BASE  = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/segments/0/leagues/{league_id}"
# Player info lookup
PLAYER_BASE  = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{year}/players"

# ── File System Paths ─────────────────────────────────────────────────────────
SCRAPER_ROOT    = Path(__file__).resolve().parent
PROJECT_ROOT    = SCRAPER_ROOT.parent
RAW_DATA_DIR    = SCRAPER_ROOT / "raw_data"
PROCESSED_DATA_DIR = PROJECT_ROOT / "data"

# ── Output JSON Files ─────────────────────────────────────────────────────────
MANAGERS_JSON           = PROCESSED_DATA_DIR / "managers.json"
MATCHUPS_JSON           = PROCESSED_DATA_DIR / "matchups.json"
LEAGUE_STANDINGS_JSON   = PROCESSED_DATA_DIR / "league_standings.json"
TEAM_STATS_JSON         = PROCESSED_DATA_DIR / "team_stats.json"
DRAFT_RESULTS_JSON      = PROCESSED_DATA_DIR / "draft_results.json"
WEEKLY_TEAM_SCORES_JSON = PROCESSED_DATA_DIR / "weekly_team_scores.json"
WEEKLY_PLAYER_STATS_JSON = PROCESSED_DATA_DIR / "weekly_player_stats.json"

# ── Lineup Slot ID → Position Name ────────────────────────────────────────────
SLOT_MAP = {
    0:  "QB",
    1:  "TQB",
    2:  "RB",
    3:  "RB/WR",
    4:  "WR",
    5:  "WR/TE",
    6:  "TE",
    7:  "OP",
    8:  "DT",
    9:  "DE",
    10: "LB",
    11: "DL",
    12: "CB",
    13: "S",
    14: "DB",
    15: "DP",
    16: "D/ST",
    17: "K",
    18: "P",
    19: "HC",
    20: "Bench",
    21: "IR",
    22: "FLEX",
    23: "FLEX",
}

STARTER_SLOTS = {0, 2, 3, 4, 5, 6, 7, 16, 17, 22, 23}  # Non-bench, non-IR

# ── Pro Team ID → NFL Team Abbreviation ───────────────────────────────────────
PRO_TEAM_MAP = {
    0: "None", 1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE",
    6: "DAL", 7: "DEN", 8: "DET", 9: "GB", 10: "TEN", 11: "IND",
    12: "KC", 13: "LV", 14: "LAR", 15: "MIA", 16: "MIN", 17: "NE",
    18: "NO", 19: "NYG", 20: "NYJ", 21: "PHI", 22: "ARI", 23: "PIT",
    24: "LAC", 25: "SF", 26: "SEA", 27: "TB", 28: "WSH", 29: "CAR",
    30: "JAX", 33: "BAL", 34: "HOU",
}

# ── Create Required Directories ───────────────────────────────────────────────
RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
