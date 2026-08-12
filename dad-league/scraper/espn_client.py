"""
ESPN Fantasy Football API Client.

Wraps all raw HTTP calls to the ESPN unofficial API with:
- Automatic authentication via cookies
- Raw JSON response caching (one file per season per view)
- Graceful error handling for missing/partial data
- Support for both leagueHistory (past) and seasons (current) endpoints
- Player name resolution via mRoster (2018+) or kona_player_info (pre-2018)
"""
import json
import time
import logging
from pathlib import Path

import requests

try:
    from .config import (
        LEAGUE_ID, HISTORY_BASE, SEASON_BASE, PLAYER_BASE,
        RAW_DATA_DIR, ALL_SEASONS
    )
    from .auth import get_cookies, get_headers
except ImportError:
    from config import (
        LEAGUE_ID, HISTORY_BASE, SEASON_BASE, PLAYER_BASE,
        RAW_DATA_DIR, ALL_SEASONS
    )
    from auth import get_cookies, get_headers

logger = logging.getLogger(__name__)


class ESPNClient:
    """Thin client for ESPN Fantasy Football v3 API."""

    TIMEOUT = 20
    RETRY_DELAY = 2  # seconds between retries
    MAX_RETRIES = 3

    def __init__(self):
        self.cookies = get_cookies()
        self.headers = get_headers()
        self.session = requests.Session()
        self.session.cookies.update(self.cookies)
        self.session.headers.update(self.headers)

    # ─────────────────────────────────────────────────────────────────
    # Core request method
    # ─────────────────────────────────────────────────────────────────
    def _get(self, url: str, params: dict) -> dict | list:
        """Make an authenticated GET request with retry logic."""
        for attempt in range(self.MAX_RETRIES):
            try:
                r = self.session.get(url, params=params, timeout=self.TIMEOUT)
                r.raise_for_status()
                return r.json()
            except requests.exceptions.HTTPError as e:
                if r.status_code == 404:
                    logger.warning(f"404 Not Found: {url} params={params}")
                    return {}
                if r.status_code in (429, 503) and attempt < self.MAX_RETRIES - 1:
                    logger.warning(f"Rate limited ({r.status_code}), retrying in {self.RETRY_DELAY}s...")
                    time.sleep(self.RETRY_DELAY)
                    continue
                raise
            except requests.exceptions.Timeout:
                if attempt < self.MAX_RETRIES - 1:
                    logger.warning(f"Timeout on attempt {attempt+1}, retrying...")
                    time.sleep(self.RETRY_DELAY)
                    continue
                raise
        return {}

    # ─────────────────────────────────────────────────────────────────
    # Cache helpers
    # ─────────────────────────────────────────────────────────────────
    def _cache_path(self, year: int, view: str) -> Path:
        return RAW_DATA_DIR / f"{year}_{view}.json"

    def _load_cache(self, year: int, view: str) -> dict | list | None:
        path = self._cache_path(year, view)
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def _save_cache(self, year: int, view: str, data):
        path = self._cache_path(year, view)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    # ─────────────────────────────────────────────────────────────────
    # Season data unwrapper
    # leagueHistory returns a list; seasons returns a dict
    # ─────────────────────────────────────────────────────────────────
    def _unwrap(self, data) -> dict:
        if isinstance(data, list):
            return data[0] if data else {}
        return data or {}

    # ─────────────────────────────────────────────────────────────────
    # Fetch methods (with caching)
    # ─────────────────────────────────────────────────────────────────
    def fetch_season(self, year: int, views: list[str], force: bool = False) -> dict:
        """
        Fetch combined season data for the given views.
        Uses leagueHistory for all years (most reliable for historical data).
        Falls back to the seasons endpoint for boxscores (2018+).
        """
        cache_key = "_".join(sorted(views))
        cached = self._load_cache(year, cache_key)
        if cached is not None and not force:
            logger.debug(f"[{year}] Loaded from cache: {cache_key}")
            return self._unwrap(cached)

        url = HISTORY_BASE.format(league_id=LEAGUE_ID)
        data = self._get(url, {"seasonId": year, "view": views})
        self._save_cache(year, cache_key, data)
        return self._unwrap(data)

    def fetch_boxscores(self, year: int, week: int, force: bool = False) -> dict:
        """
        Fetch player-level boxscore for a specific scoring period.
        Only works reliably for 2018+. Uses the seasons endpoint.
        """
        cache_key = f"boxscore_w{week}"
        cached = self._load_cache(year, cache_key)
        if cached is not None and not force:
            logger.debug(f"[{year}] Loaded boxscore week {week} from cache")
            return cached

        url = SEASON_BASE.format(year=year, league_id=LEAGUE_ID)
        data = self._get(url, {"view": "mBoxscore", "scoringPeriodId": week})
        self._save_cache(year, cache_key, data)
        return data or {}

    def fetch_players(self, year: int, force: bool = False) -> list:
        """
        Fetch the player universe for a season (for draft name lookups).
        Returns list of player objects.
        """
        cache_key = "players"
        cached = self._load_cache(year, cache_key)
        if cached is not None and not force:
            return cached

        url = PLAYER_BASE.format(year=year)
        # This endpoint needs a scoringPeriodId and filterActive to not blow up
        data = self._get(url, {
            "scoringPeriodId": 0,
            "view": "players_wl",
        })
        players = data if isinstance(data, list) else data.get("players", [])
        self._save_cache(year, cache_key, players)
        return players

    # ─────────────────────────────────────────────────────────────────
    # Convenience bulk fetchers
    # ─────────────────────────────────────────────────────────────────
    def fetch_teams_and_members(self, year: int, force: bool = False) -> dict:
        """Returns season data with mTeam view (teams + members)."""
        return self.fetch_season(year, ["mTeam"], force=force)

    def fetch_matchups(self, year: int, force: bool = False) -> dict:
        """Returns season data with mMatchup view."""
        return self.fetch_season(year, ["mMatchup"], force=force)

    def fetch_standings(self, year: int, force: bool = False) -> dict:
        """Returns season data with mStandings view."""
        return self.fetch_season(year, ["mStandings"], force=force)

    def fetch_draft(self, year: int, force: bool = False) -> dict:
        """Returns season data with mDraftDetail view."""
        return self.fetch_season(year, ["mDraftDetail"], force=force)

    def fetch_settings(self, year: int, force: bool = False) -> dict:
        """Returns season data with mSettings view."""
        return self.fetch_season(year, ["mSettings"], force=force)

    def build_player_map(self, year: int, force: bool = False) -> dict:
        """
        Returns {playerId: playerName} for draft pick name resolution.

        Strategy by era:
          2018+: mRoster view (single fast call) + boxscore scan for dropped players
          2015-2017: kona_player_info endpoint with x-fantasy-filter on draft pick IDs
        """
        cache_key = "player_map"
        cached = self._load_cache(year, cache_key)
        if cached is not None and not force:
            return cached

        player_map = {}

        try:
            url = PLAYER_BASE.format(year=year)
            # We need x-fantasy-filter with filterActive to get all players, bypassing the 50-player limit
            headers = {**self.headers, "x-fantasy-filter": '{"filterActive":{"value":true}}'}
            r = self.session.get(url, params={"view": "players_wl", "scoringPeriodId": 0}, headers=headers, timeout=self.TIMEOUT)
            if r.status_code == 200:
                data = r.json()
                players = data if isinstance(data, list) else data.get("players", [])
                
                for p in players:
                    pid = p.get("id")
                    name = p.get("fullName")
                    if pid and name:
                        player_map[pid] = name
                        
            logger.debug(f"[{year}] players_wl: {len(player_map)} players")
        except Exception as e:
            logger.warning(f"[{year}] players_wl lookup failed: {e}")

        self._save_cache(year, cache_key, player_map)
        logger.info(f"[{year}] Player map: {len(player_map)} players resolved")
        return player_map

    def get_season_week_count(self, year: int) -> tuple[int, int]:
        """
        Returns (regular_season_weeks, total_weeks) for the given year.
        Reads from settings.
        """
        data = self.fetch_settings(year)
        settings = data.get("settings", {})
        sched = settings.get("scheduleSettings", {})
        matchup_count = sched.get("matchupPeriodCount", 13)
        final_period = data.get("status", {}).get("finalScoringPeriod", matchup_count + 3)
        return matchup_count, final_period
