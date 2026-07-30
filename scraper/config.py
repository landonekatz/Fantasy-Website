"""
Configuration settings for Dumbarton Fantasy Football League HQ Scraper & Pipeline.
"""
from pathlib import Path

# Historical Yahoo Fantasy League URLs mapped by League Season Name
# Note: Yahoo archive URLs use the NFL season year (e.g. /2025/f1/42542 for our 2026 season)
SEASON_URLS = {
    2027: "https://football.fantasysports.yahoo.com/f1/52841",     # Current upcoming year
    2026: "https://football.fantasysports.yahoo.com/2025/f1/42542",
    2025: "https://football.fantasysports.yahoo.com/2024/f1/80052",
    2024: "https://football.fantasysports.yahoo.com/2023/f1/30266",
    2023: "https://football.fantasysports.yahoo.com/2022/f1/873470",
    2022: "https://football.fantasysports.yahoo.com/2021/f1/818216",
    2021: "https://football.fantasysports.yahoo.com/2020/f1/941578",
    2020: "https://football.fantasysports.yahoo.com/2019/f1/978070",
    2019: "https://football.fantasysports.yahoo.com/2018/f1/1168960",
    2018: "https://football.fantasysports.yahoo.com/2017/f1/862430",
}

# Seasons to scrape (2018 through 2027)
SEASONS_TO_SCRAPE = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027]

# File system paths
SCRAPER_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = SCRAPER_ROOT.parent
RAW_DATA_DIR = SCRAPER_ROOT / "raw_data"
PROCESSED_DATA_DIR = PROJECT_ROOT / "data"

# Browser authentication persistent context
USER_DATA_DIR = SCRAPER_ROOT / ".browser_context"

# Mapping files
MANAGERS_JSON_PATH = PROCESSED_DATA_DIR / "managers.json"

# Output JSON files
LEAGUE_STANDINGS_JSON = PROCESSED_DATA_DIR / "league_standings.json"
MATCHUPS_JSON = PROCESSED_DATA_DIR / "matchups.json"
TEAM_STATS_JSON = PROCESSED_DATA_DIR / "team_stats.json"
DRAFT_RESULTS_JSON = PROCESSED_DATA_DIR / "draft_results.json"
WEEKLY_TEAM_SCORES_JSON = PROCESSED_DATA_DIR / "weekly_team_scores.json"
WEEKLY_PLAYER_STATS_JSON = PROCESSED_DATA_DIR / "weekly_player_stats.json"

# Create required directories if they don't exist
RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)
