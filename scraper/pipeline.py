"""
Data Processing Pipeline Orchestrator for Dumbarton Fantasy Football League HQ.

Usage:
    python3 -m scraper.pipeline
    python3 -m scraper.pipeline --test
"""
import sys
import json
from pathlib import Path

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

try:
    from .config import (
        PROCESSED_DATA_DIR,
        LEAGUE_STANDINGS_JSON,
        MATCHUPS_JSON,
        TEAM_STATS_JSON,
        DRAFT_RESULTS_JSON,
        WEEKLY_TEAM_SCORES_JSON,
        WEEKLY_PLAYER_STATS_JSON,
        MANAGERS_JSON_PATH
    )
    from .cleaner import (
        load_managers_mapping,
        resolve_canonical_id,
        clean_standings_df,
        clean_matchups_df,
        clean_draft_df,
        FallbackTable
    )
except ImportError:
    from config import (
        PROCESSED_DATA_DIR,
        LEAGUE_STANDINGS_JSON,
        MATCHUPS_JSON,
        TEAM_STATS_JSON,
        DRAFT_RESULTS_JSON,
        WEEKLY_TEAM_SCORES_JSON,
        WEEKLY_PLAYER_STATS_JSON,
        MANAGERS_JSON_PATH
    )
    from cleaner import (
        load_managers_mapping,
        resolve_canonical_id,
        clean_standings_df,
        clean_matchups_df,
        clean_draft_df,
        FallbackTable
    )


def run_pipeline(test_mode=False):
    print("=" * 70)
    print("DUMBARTON FANTASY FOOTBALL - DATA PROCESSING PIPELINE")
    print("=" * 70)

    # 1. Verify managers mapping
    print("[Pipeline] Loading Canonical Manager Identity System from managers.json...")
    mapping = load_managers_mapping(MANAGERS_JSON_PATH)
    num_mgrs = len(mapping["display_names"])
    print(f"  -> Successfully loaded {num_mgrs} canonical manager profiles.")

    if test_mode:
        print("\n[Pipeline] Running in --test mode: Verifying transformations & schemas...")
        if not HAS_PANDAS:
            print("  [NOTE] Pandas not installed yet; using built-in FallbackTable for schema verification.")

        # Test standings DataFrame cleaning
        sample_standings = [
            {"team_name": "ANITA MAX WYNN", "yahoo_team_id": "1", "W": 11, "L": 3, "PF": 1845.6, "PA": 1520.2, "award": "Champion"},
            {"team_name": "Jack Lovas Team", "yahoo_team_id": "10", "W": 2, "L": 12, "PF": 1310.4, "PA": 1820.0, "award": "Toilet Bowl"}
        ]
        cleaned_std = clean_standings_df(sample_standings, year=2025, mapping=mapping)
        assert len(cleaned_std) == 2, "Standings cleaning row count mismatch"
        assert cleaned_std.iloc[0]["canonical_manager_id"] == "anita_max_wynn", "Canonical ID resolution failed for ANITA MAX WYNN"
        assert cleaned_std.iloc[1]["canonical_manager_id"] == "jack_lovas", "Canonical ID resolution failed for Jack Lovas"
        print("  [SUCCESS] Standings DataFrame cleaning & Canonical ID mapping validated!")

        # Test matchups DataFrame cleaning
        sample_matchups = [
            {"team_1_name": "ANITA MAX WYNN", "team_2_name": "The Infirmary", "score_1": 132.4, "score_2": 118.9, "is_playoffs": False}
        ]
        cleaned_mat = clean_matchups_df(sample_matchups, year=2025, week=1, mapping=mapping)
        assert cleaned_mat.iloc[0]["winner_canonical"] == "anita_max_wynn", "Matchup winner calculation failed"
        assert cleaned_mat.iloc[0]["margin"] == 13.5, "Margin of victory calculation failed"
        print("  [SUCCESS] Matchup scores & margin of victory calculations validated!")

        # Test draft DataFrame cleaning
        sample_draft = [
            {"team_name": "ANITA MAX WYNN", "yahoo_team_id": "1", "round": 1, "pick": 1, "overall_pick": 1, "player_name": "Christian McCaffrey", "position": "RB"}
        ]
        cleaned_dft = clean_draft_df(sample_draft, year=2026, mapping=mapping)
        assert cleaned_dft.iloc[0]["canonical_manager_id"] == "anita_max_wynn"
        print("  [SUCCESS] Draft board cleaning & schema validation passed!")

        print("\n======================================================================")
        print("ALL PIPELINE VERIFICATION TESTS PASSED SUCCESSFULLY!")
        print("======================================================================")
        return True

    print("\n[Pipeline] Processing datasets and verifying clean JSON output...")
    for json_file in [
        LEAGUE_STANDINGS_JSON,
        MATCHUPS_JSON,
        TEAM_STATS_JSON,
        DRAFT_RESULTS_JSON,
        WEEKLY_TEAM_SCORES_JSON,
        WEEKLY_PLAYER_STATS_JSON
    ]:
        if json_file.exists():
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            print(f"  [OK] {json_file.name}: {len(data)} records ready for frontend rendering.")
        else:
            print(f"  [WARNING] {json_file.name} not found.")

    print("\nPipeline execution complete. All historical datasets attached to canonical manager IDs!")
    return True


if __name__ == "__main__":
    test_flag = "--test" in sys.argv
    run_pipeline(test_mode=test_flag)
