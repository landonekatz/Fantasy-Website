"""
Data Cleaning and Transformation Library for Yahoo Fantasy Data.
Uses Pandas DataFrames when available, with a built-in lightweight fallback Table
so the schema and pipeline can be verified even before pip dependencies are installed.
Enforces the Canonical Manager Identity System across all historical datasets.
"""
import json
import re
from pathlib import Path

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

try:
    from .config import MANAGERS_JSON_PATH
except ImportError:
    from config import MANAGERS_JSON_PATH


class FallbackTable:
    """Lightweight fallback table wrapper around a list of dicts when pandas is not yet installed."""
    def __init__(self, rows):
        self.rows = rows
        self.iloc = self

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, idx):
        return self.rows[idx]

    def iterrows(self):
        for idx, row in enumerate(self.rows):
            yield idx, row

    def to_dict(self, orient="records"):
        return self.rows


def to_table(rows):
    if HAS_PANDAS:
        return pd.DataFrame(rows)
    return FallbackTable(rows)


def slugify(text):
    """Simple slugify for fallback canonical IDs."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "_", text)
    return text.strip("_")


def load_managers_mapping(filepath=MANAGERS_JSON_PATH):
    """
    Loads managers.json and builds lookup dictionaries:
      - by_id: (year, yahoo_team_id) -> canonical_manager_id
      - by_name: (year, lowercase_team_name) -> canonical_manager_id
      - display_names: canonical_manager_id -> display_name
    """
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    by_id = {}
    by_name = {}
    display_names = {}

    for mgr in data.get("canonical_managers", []):
        cid = mgr["canonical_manager_id"]
        display_names[cid] = mgr.get("display_name", cid)
        for s in mgr.get("seasons", []):
            year = int(s["year"])
            tid = str(s.get("yahoo_team_id", ""))
            tname = s.get("team_name", "").lower().strip()
            if tid:
                by_id[(year, tid)] = cid
            if tname:
                by_name[(year, tname)] = cid

    for mgr in data.get("managers", []):
        cid = mgr.get("id")
        if cid:
            display_names[cid] = mgr.get("name", cid)

    for mapping in data.get("team_mappings", []):
        year = int(mapping.get("year", 0))
        tid = str(mapping.get("team_id", ""))
        tname = mapping.get("team_name", "").lower().strip()
        cid = mapping.get("manager_id", "")
        if cid:
            if tid:
                by_id[(year, tid)] = cid
            if tname:
                by_name[(year, tname)] = cid

    return {
        "by_id": by_id,
        "by_name": by_name,
        "display_names": display_names
    }


def resolve_canonical_id(year, yahoo_team_id=None, team_name=None, mapping=None):
    """
    Resolves a team representation to its persistent canonical_manager_id.
    First checks year + yahoo_team_id, then year + team_name.
    Fallback: slugified team_name.
    """
    if mapping is None:
        mapping = load_managers_mapping()

    year = int(year)
    by_id = mapping["by_id"]
    by_name = mapping["by_name"]

    if yahoo_team_id:
        tid = str(yahoo_team_id).strip()
        if (year, tid) in by_id:
            return by_id[(year, tid)]

    if team_name:
        tname_clean = team_name.lower().strip()
        if (year, tname_clean) in by_name:
            return by_name[(year, tname_clean)]
        return slugify(team_name)

    return "unknown_manager"


def clean_standings_df(data_input, year, mapping=None):
    """
    Cleans raw standings DataFrame or list of dicts:
      - Normalizes numeric points_for, points_against, wins, losses, ties
      - Attaches canonical_manager_id
    """
    if mapping is None:
        mapping = load_managers_mapping()

    rows = data_input.to_dict(orient="records") if hasattr(data_input, "to_dict") else data_input
    cleaned_rows = []
    for idx, row in enumerate(rows):
        team_name = str(row.get("team_name", row.get("Team", f"Team {idx+1}"))).strip()
        yahoo_id = str(row.get("yahoo_team_id", row.get("id", idx+1)))
        cid = resolve_canonical_id(year, yahoo_team_id=yahoo_id, team_name=team_name, mapping=mapping)

        wins = int(row.get("wins", row.get("W", 0)))
        losses = int(row.get("losses", row.get("L", 0)))
        ties = int(row.get("ties", row.get("T", 0)))
        pf = float(row.get("points_for", row.get("PF", 0.0)))
        pa = float(row.get("points_against", row.get("PA", 0.0)))

        cleaned_rows.append({
            "season": int(year),
            "canonical_manager_id": cid,
            "rank": int(row.get("rank", idx + 1)),
            "wins": wins,
            "losses": losses,
            "ties": ties,
            "points_for": round(pf, 2),
            "points_against": round(pa, 2),
            "award": str(row.get("award", "None"))
        })

    return to_table(cleaned_rows)


def clean_matchups_df(data_input, year, week, mapping=None):
    """
    Cleans weekly matchup records, resolves canonical IDs, and computes margin of victory.
    """
    if mapping is None:
        mapping = load_managers_mapping()

    rows = data_input.to_dict(orient="records") if hasattr(data_input, "to_dict") else data_input
    cleaned_rows = []
    for _, row in enumerate(rows):
        m1 = str(row.get("team_1_name", row.get("Team 1", "")))
        m2 = str(row.get("team_2_name", row.get("Team 2", "")))
        s1 = float(row.get("score_1", row.get("Score 1", 0.0)))
        s2 = float(row.get("score_2", row.get("Score 2", 0.0)))

        cid1 = resolve_canonical_id(year, team_name=m1, mapping=mapping)
        cid2 = resolve_canonical_id(year, team_name=m2, mapping=mapping)

        winner = cid1 if s1 > s2 else (cid2 if s2 > s1 else "TIE")
        margin = round(abs(s1 - s2), 2)

        cleaned_rows.append({
            "season": int(year),
            "week": int(week),
            "team_1_canonical": cid1,
            "team_2_canonical": cid2,
            "score_1": round(s1, 2),
            "score_2": round(s2, 2),
            "winner_canonical": winner,
            "margin": margin,
            "is_playoffs": bool(row.get("is_playoffs", False))
        })

    return to_table(cleaned_rows)


def clean_draft_df(data_input, year, mapping=None):
    """
    Cleans year-by-year draft boards and attaches canonical_manager_id.
    """
    if mapping is None:
        mapping = load_managers_mapping()

    rows = data_input.to_dict(orient="records") if hasattr(data_input, "to_dict") else data_input
    cleaned_rows = []
    for _, row in enumerate(rows):
        tname = str(row.get("team_name", row.get("Manager", "")))
        tid = str(row.get("yahoo_team_id", ""))
        cid = resolve_canonical_id(year, yahoo_team_id=tid, team_name=tname, mapping=mapping)

        cleaned_rows.append({
            "year": int(year),
            "round": int(row.get("round", 1)),
            "pick": int(row.get("pick", 1)),
            "overall_pick": int(row.get("overall_pick", 1)),
            "canonical_manager_id": cid,
            "player_name": str(row.get("player_name", "Unknown")),
            "nfl_team": str(row.get("nfl_team", "FA")),
            "position": str(row.get("position", "BN"))
        })

    return to_table(cleaned_rows)
