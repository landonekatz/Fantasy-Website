"""
ESPN Fantasy Football Data Pipeline.

Orchestrates the full scrape → parse → save workflow across all seasons.

Usage:
    python pipeline.py                  # Full run (all seasons, all data)
    python pipeline.py --years 2022 2023  # Specific years only
    python pipeline.py --force          # Bypass cache (re-fetch from API)
    python pipeline.py --skip-players   # Skip slow player boxscore fetching
"""
import argparse
import json
import logging
import sys
from pathlib import Path

# Allow running as a script directly
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (
    ALL_SEASONS, BOXSCORE_SEASONS,
    MATCHUPS_JSON, LEAGUE_STANDINGS_JSON, TEAM_STATS_JSON,
    DRAFT_RESULTS_JSON, WEEKLY_TEAM_SCORES_JSON, WEEKLY_PLAYER_STATS_JSON,
)
from espn_client import ESPNClient
from parser import (
    update_managers_registry, load_managers, save_json,
    parse_standings, parse_matchups, parse_weekly_team_scores,
    parse_weekly_player_stats, parse_draft, parse_team_stats,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def run_pipeline(years: list[int], force: bool = False, skip_players: bool = False):
    """Full data pipeline: fetch → parse → save for all requested years."""
    logger.info("=" * 60)
    logger.info("ESPN Fantasy Football Pipeline — Dad's League (262404)")
    logger.info(f"Years: {years}")
    logger.info(f"Force re-fetch: {force} | Skip players: {skip_players}")
    logger.info("=" * 60)

    client = ESPNClient()

    # ── Step 1: Build/Update Managers Registry ────────────────────────────────
    logger.info("\n[STEP 1] Building manager registry...")
    managers = update_managers_registry(client)
    logger.info(f"  {len(managers['managers'])} unique managers found.")

    # ── Accumulators ──────────────────────────────────────────────────────────
    all_matchups        = []
    all_standings       = []
    all_weekly_scores   = []
    all_player_stats    = []
    all_draft_picks     = []
    all_team_stats      = []

    # ── Step 2: Per-Season Data ───────────────────────────────────────────────
    for year in years:
        logger.info(f"\n{'─'*50}")
        logger.info(f"[{year}] Processing season...")

        has_boxscores = year >= 2018

        # Standings
        logger.info(f"  [{year}] Parsing standings...")
        standings = parse_standings(year, client, managers)
        all_standings.extend(standings)

        # Matchups
        logger.info(f"  [{year}] Parsing matchups...")
        matchups = parse_matchups(year, client, managers)
        all_matchups.extend(matchups)
        logger.info(f"    → {len(matchups)} matchups")

        # Weekly team scores
        logger.info(f"  [{year}] Parsing weekly team scores...")
        weekly_scores = parse_weekly_team_scores(year, client, managers)
        all_weekly_scores.extend(weekly_scores)
        logger.info(f"    → {len(weekly_scores)} team-week records")

        # Draft
        logger.info(f"  [{year}] Parsing draft...")
        draft = parse_draft(year, client, managers)
        all_draft_picks.extend(draft)
        logger.info(f"    → {len(draft)} picks")

        # Player-level boxscores (2018+ only)
        if has_boxscores and not skip_players:
            reg_weeks, total_weeks = client.get_season_week_count(year)
            logger.info(f"  [{year}] Parsing player stats ({total_weeks} weeks)...")
            player_stats = parse_weekly_player_stats(year, client, managers, total_weeks)
            all_player_stats.extend(player_stats)
            logger.info(f"    → {len(player_stats)} player-week records")
        elif year < 2018:
            logger.info(f"  [{year}] ⚠️  Player stats not available (pre-2018 gap — team totals only)")
        else:
            logger.info(f"  [{year}] Player stats skipped (--skip-players flag)")

        # Team stats (derived from matchups + standings)
        team_stats = parse_team_stats(year, matchups, standings)
        all_team_stats.extend(team_stats)

    # ── Step 3: Write Output Files ────────────────────────────────────────────
    logger.info(f"\n{'─'*50}")
    logger.info("[STEP 3] Writing output JSON files...")

    save_json(LEAGUE_STANDINGS_JSON,    all_standings)
    save_json(MATCHUPS_JSON,            all_matchups)
    save_json(WEEKLY_TEAM_SCORES_JSON,  all_weekly_scores)
    save_json(DRAFT_RESULTS_JSON,       all_draft_picks)
    save_json(TEAM_STATS_JSON,          all_team_stats)

    if all_player_stats:
        save_json(WEEKLY_PLAYER_STATS_JSON, all_player_stats)
    else:
        logger.info("  (No player stats to write)")

    # ── Step 4: Summary Report ────────────────────────────────────────────────
    logger.info(f"\n{'='*60}")
    logger.info("PIPELINE COMPLETE — Summary")
    logger.info(f"{'='*60}")
    logger.info(f"  Seasons processed:     {len(years)}")
    logger.info(f"  Total matchups:        {len(all_matchups)}")
    logger.info(f"  Total team-week rows:  {len(all_weekly_scores)}")
    logger.info(f"  Total draft picks:     {len(all_draft_picks)}")
    logger.info(f"  Total player-week rows:{len(all_player_stats)}")
    if any(y < 2018 for y in years):
        logger.info("")
        logger.info("  ⚠️  DATA GAP NOTICE:")
        logger.info("  Years 2015-2017 have team-level scores only.")
        logger.info("  Individual player scores for those seasons are not")
        logger.info("  available from the ESPN API.")
    logger.info(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="ESPN Fantasy Football Data Pipeline")
    parser.add_argument(
        "--years", nargs="+", type=int, default=None,
        help="Specific years to process (e.g. --years 2022 2023). Default: all seasons."
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Bypass cache and re-fetch all data from the ESPN API."
    )
    parser.add_argument(
        "--skip-players", action="store_true",
        help="Skip fetching player-level boxscores (much faster, but no weekly_player_stats.json)."
    )
    parser.add_argument(
        "--managers-only", action="store_true",
        help="Only update managers.json, do not process any season data."
    )
    args = parser.parse_args()

    if args.managers_only:
        client = ESPNClient()
        update_managers_registry(client)
        return

    years = args.years if args.years else ALL_SEASONS
    # Validate
    invalid = [y for y in years if y not in ALL_SEASONS]
    if invalid:
        logger.error(f"Invalid years: {invalid}. Valid range: {ALL_SEASONS}")
        sys.exit(1)

    run_pipeline(years, force=args.force, skip_players=args.skip_players)


if __name__ == "__main__":
    main()
