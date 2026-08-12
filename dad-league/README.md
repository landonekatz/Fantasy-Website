# Dad's ESPN Fantasy League Data

ESPN Fantasy Football scraper for league 262404.
Fetches historical data from 2015–present via ESPN's unofficial API.

## Setup

```bash
cd dad-league/scraper
pip install -r requirements.txt
```

Credentials are stored in `scraper/.env` (never commit this file).

## Running the Pipeline

```bash
# Full run — all seasons, all data (slow first time due to boxscore fetching)
python pipeline.py

# Quick run — standings, matchups, draft only (no player boxscores)
python pipeline.py --skip-players

# Specific years only
python pipeline.py --years 2022 2023 2024

# Force re-fetch from API (bypass local cache)
python pipeline.py --force

# Only rebuild managers.json
python pipeline.py --managers-only
```

## Data Availability

| Year | Matchups | Scores | Draft | Player Boxscores |
|------|----------|--------|-------|-----------------|
| 2015 | ✅ | ✅ | ✅ | ❌ team totals only |
| 2016 | ✅ | ✅ | ✅ | ❌ team totals only |
| 2017 | ✅ | ✅ | ✅ | ❌ team totals only |
| 2018 | ✅ | ✅ | ✅ | ✅ |
| 2019–2025 | ✅ | ✅ | ✅ | ✅ |

## Output Files (in `data/`)

| File | Contents |
|------|----------|
| `managers.json` | Canonical manager identities across all seasons |
| `league_standings.json` | Final standings per season |
| `matchups.json` | All head-to-head results, every week |
| `weekly_team_scores.json` | Per-team per-week scores |
| `weekly_player_stats.json` | Individual player scores (2018+ only) |
| `draft_results.json` | All draft picks with player names |
| `team_stats.json` | Aggregated season stats per team |

## Caching

Raw API responses are cached in `scraper/raw_data/` as JSON files.
Format: `{year}_{view}.json` (e.g. `2022_mTeam.json`).
Re-running the pipeline reuses cached files unless `--force` is passed.
