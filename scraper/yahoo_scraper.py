"""
Yahoo Fantasy Football Historical Data Scraper using Playwright.
Uses persistent browser context to authenticate and scrape historical league pages.
Uses season-specific Yahoo Archive base URLs configured in config.py.

Key Built-in Features:
  1. Smart Cache Resumption (Instant Skip for Existing Files > 1KB):
     - Checks if an HTML file is already saved in `/scraper/raw_data/`.
     - Automatically re-scrapes `standings.html` if it was not retrieved using `?lhst=stand#leaguehomestandings`.
     - Reads from disk when needed for pagination or matchup deduplication without hitting Yahoo.
  2. Rate-Limit / 'Request Denied' Auto-Recovery:
     - Case-insensitive detection of Yahoo Error 999 ('Request denied') and tiny error responses (<500 bytes).
     - Automatically pauses for 1.5 minutes (90s), reloads twice, and explicitly re-enters the target URL.
  3. Dynamic NFL Season Length & Playoff Adaptation (16 vs 17 Weeks, Error #768 Detection):
     - Automatically detects when a season ends by checking for Yahoo's 'You must enter a valid week. (Error #768)'.
     - Deletes any invalid week file and cleanly terminates week iteration.
  4. Current/Upcoming Season (2027) Dynamic Termination:
     - Cancels saving `draftresults.html` if it detects `--empty--` strings (pre-draft state).
     - Cancels iterating matchup weeks the moment it encounters `(Empty)` (un-played / un-scheduled week).
  5. Weekly Matchup Deduplication:
     - Scrapes only unique head-to-head matchup box scores per week (6 unique matchups per week in 12-team leagues).
     - Skips duplicate box score requests from the opponent's perspective.
  6. Foolproof Transaction Pagination:
     - First 25 uses `/transactions` (clean URL); subsequent pages use `?transactionsfilter=all&count={25, 50...}`.
     - Verifies `Next 25` is an actual `<a>` hyperlink to `count={count+25}` before continuing.
  7. Zero-Redundancy Architecture:
     - End-of-season rosters and players database scrapes removed (rosters and points are in weekly boxscores).
"""
import os
import re
import json
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

try:
    from .config import SEASON_URLS, RAW_DATA_DIR, USER_DATA_DIR, SEASONS_TO_SCRAPE
except ImportError:
    from config import SEASON_URLS, RAW_DATA_DIR, USER_DATA_DIR, SEASONS_TO_SCRAPE


class YahooFantasyScraper:
    def __init__(self, headless=True, delay=1.0):
        self.headless = headless
        self.delay = delay
        self.playwright = None
        self.context = None
        self.page = None

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def start(self):
        self.playwright = sync_playwright().start()
        self.context = self.playwright.chromium.launch_persistent_context(
            user_data_dir=str(USER_DATA_DIR),
            headless=self.headless,
            viewport={"width": 1280, "height": 900},
            args=["--disable-blink-features=AutomationControlled"]
        )
        self.page = self.context.pages[0] if self.context.pages else self.context.new_page()
        print(f"[Scraper] Started browser with profile: {USER_DATA_DIR}")

    def close(self):
        if self.context:
            try:
                self.context.close()
            except Exception:
                pass
        if self.playwright:
            try:
                self.playwright.stop()
            except Exception:
                pass
        print("[Scraper] Closed browser session.")

    def _get_base_url(self, year):
        """Returns the specific Yahoo Fantasy base URL for a given season year."""
        year = int(year)
        if year not in SEASON_URLS:
            raise ValueError(f"Season year {year} not found in SEASON_URLS configuration.")
        url = SEASON_URLS[year]
        parts = url.rstrip("/").split("/")
        if len(parts) > 0 and parts[-1].isdigit() and len(parts[-1]) <= 2:
            url = "/".join(parts[:-1])
        return url

    def _save_raw_file(self, year, category, filename, content):
        out_dir = RAW_DATA_DIR / str(year) / category
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / filename
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"    -> Saved: {out_path.relative_to(RAW_DATA_DIR)}")
        return out_path

    def _is_request_denied(self, html):
        """
        Foolproof case-insensitive check for Yahoo 'Request Denied' / Error 999.
        Yahoo returns a 54-byte page: '<html>...<body>Request denied</body></html>'.
        """
        if not html:
            return True
        html_lower = html.lower()
        if "request denied" in html_lower or "error 999" in html_lower:
            return True
        if len(html.strip()) < 500:
            return True
        return False

    def _is_invalid_week(self, html):
        """
        Checks if Yahoo returned 'You must enter a valid week. (Error #768)'.
        Indicates that we have exceeded the final week of the fantasy season.
        """
        if not html:
            return False
        html_lower = html.lower()
        if "you must enter a valid week" in html_lower or "error #768" in html_lower:
            return True
        return False

    def _has_next_transactions_link(self, html, next_count):
        """
        Checks that 'Next 25' is an actual <a> hyperlink pointing to count={next_count}.
        Prevents infinite loops when 'Next 25' text is present on the page without a hyperlink.
        """
        pattern = r'<a[^>]+href="[^"]*count=' + str(next_count) + r'[^"]*"[^>]*>Next 25</a>'
        return bool(re.search(pattern, html, re.IGNORECASE))

    def _fetch_page(self, url, year, category, filename, max_retries=3):
        """
        Smart cache check first: if valid file exists on disk (>1KB), skips HTTP request.
        For standings.html, verifies that the cached file contains lhst=stand / leaguehomestandings.
        Otherwise visits URL, waits for DOM, checks for Yahoo 'Request Denied' (Error 999),
        auto-recovers by pausing 1.5 minutes (90s), reloading twice, and explicitly re-entering URL.
        """
        out_dir = RAW_DATA_DIR / str(year) / category
        out_path = out_dir / filename

        # Smart Cache Hit Check
        if out_path.exists() and out_path.stat().st_size > 1000:
            if filename == "standings.html":
                with open(out_path, "r", encoding="utf-8", errors="ignore") as f:
                    cached_html = f.read()
                if "lhst=stand" in cached_html or "leaguehomestandings" in cached_html:
                    print(f"    [Cache Hit] Skipping {url} -> Existing file: {out_path.relative_to(RAW_DATA_DIR)}")
                    return out_path
                else:
                    print(f"    [Re-scrape] Cached standings.html was not from ?lhst=stand. Re-fetching...")
            else:
                print(f"    [Cache Hit] Skipping {url} -> Existing file: {out_path.relative_to(RAW_DATA_DIR)}")
                return out_path

        print(f"  [Fetch] {url}")
        self.page.goto(url, wait_until="domcontentloaded")
        time.sleep(self.delay)
        html = self.page.content()

        # Rate Limit / Request Denied Auto-Recovery Loop
        retries = 0
        while retries < max_retries and self._is_request_denied(html):
            retries += 1
            print(f"    [RATE LIMIT] Yahoo 'Request Denied' detected! Pausing 90 seconds (1.5 mins)... (Attempt {retries}/{max_retries})")
            time.sleep(90)
            print("    [RATE LIMIT] Reloading page (first reload)...")
            self.page.reload(wait_until="domcontentloaded")
            time.sleep(4)
            print("    [RATE LIMIT] Reloading page (second reload)...")
            self.page.reload(wait_until="domcontentloaded")
            time.sleep(4)
            print(f"    [RATE LIMIT] Re-entering target URL explicitly: {url}")
            self.page.goto(url, wait_until="domcontentloaded")
            time.sleep(self.delay)
            html = self.page.content()

        if self._is_request_denied(html):
            print(f"    [ERROR] Could not bypass 'Request Denied' after {max_retries} retries for {url}. Skipping.")
            return None

        return self._save_raw_file(year, category, filename, html)

    # =========================================================================
    # 1. Base League Info (Home, Settings, Standings, Teams, Record Book)
    # =========================================================================
    def scrape_league_info(self, year):
        base_url = self._get_base_url(year)
        print(f"\n--- [1/4] Scraping League Info & Settings ({year}) ---")
        endpoints = {
            "home.html": "",
            "settings.html": "/settings",
            "standings.html": "?lhst=stand#leaguehomestandings",
            "teams.html": "/teams",
            "recordbook.html": "/recordbook"
        }
        for fname, endpoint in endpoints.items():
            try:
                out_path = self._fetch_page(f"{base_url}{endpoint}", year, "league_info", fname)
                # If we just fetched recordbook.html, archive it immediately so it doesn't stay in league_info
                if fname == "recordbook.html" and out_path and out_path.exists():
                    archive_dir = RAW_DATA_DIR / str(year) / "archive"
                    archive_dir.mkdir(parents=True, exist_ok=True)
                    target = archive_dir / "recordbook.html"
                    if target.exists():
                        target.unlink()
                    out_path.rename(target)
                    print(f"    -> Archived recordbook.html to {target.relative_to(RAW_DATA_DIR)}")
            except Exception as e:
                print(f"    [WARN] Failed {fname}: {e}")

    # =========================================================================
    # 2. Draft Results (Cancels if '--empty--' strings detected in pre-draft state)
    # =========================================================================
    def scrape_draft(self, year):
        base_url = self._get_base_url(year)
        print(f"\n--- [2/4] Scraping Draft Results ({year}) ---")
        try:
            out_path = self._fetch_page(f"{base_url}/draftresults", year, "draft", "draftresults.html")
            if out_path and out_path.exists():
                with open(out_path, "r", encoding="utf-8", errors="ignore") as f:
                    html = f.read()
                if "--empty--" in html:
                    print(f"    [Draft] Draft has not occurred yet ('--empty--' detected in draft results). Removing un-drafted draftresults.html.")
                    out_path.unlink()
        except Exception as e:
            print(f"    [WARN] Failed draftresults: {e}")

    # =========================================================================
    # 3. Transactions & Roster Moves (Robust Pagination via transactionsfilter=all)
    # =========================================================================
    def scrape_transactions(self, year, max_pages=100):
        """
        Scrapes all transactions.
        count=0 uses `/transactions` (clean base url).
        count=25+ uses `/transactions?transactionsfilter=all&count={offset}`.
        Stops automatically when 'Next 25' is no longer a clickable hyperlink to count={count+25}.
        Resumes seamlessly from cache.
        """
        base_url = self._get_base_url(year)
        print(f"\n--- [3/4] Scraping All Transactions & Roster Moves ({year}) ---")
        for page_idx in range(max_pages):
            count = page_idx * 25
            url = f"{base_url}/transactions" if count == 0 else f"{base_url}/transactions?transactionsfilter=all&count={count}"
            try:
                out_path = self._fetch_page(url, year, "transactions", f"transactions_all_count{count}.html")
                if not out_path:
                    break

                # Read HTML from disk (whether cache hit or newly fetched) to check pagination link
                with open(out_path, "r", encoding="utf-8", errors="ignore") as f:
                    html = f.read()

                if not self._has_next_transactions_link(html, count + 25):
                    print(f"    [Transactions] Reached last page of transactions at count={count} (No hyperlink to count={count+25}).")
                    break
            except Exception as e:
                print(f"    [WARN] Failed transactions count {count}: {e}")
                break

    # =========================================================================
    # 4. Weekly Matchups & Box Scores (Deduplicated, Dynamic NFL Week Cap, (Empty) Detection)
    # =========================================================================
    def scrape_weekly_matchups(self, year, max_weeks=18, max_teams=12):
        """
        Scrapes weekly scoreboard overview and unique head-to-head boxscores.
        Automatically detects when the season ends by detecting Error #768 ('You must enter a valid week').
        Cancels week iteration if '(Empty)' strings are found (un-played / un-scheduled weeks in current/upcoming season).
        Skips duplicate box score requests from the opponent's perspective.
        Resumes seamlessly from cache.
        """
        base_url = self._get_base_url(year)
        print(f"\n--- [4/4] Scraping Weekly Scoreboards & Unique Matchup Box Scores ({year}) ---")
        for wk in range(1, max_weeks + 1):
            try:
                url = f"{base_url}?matchup_week={wk}"
                out_path = self._fetch_page(url, year, "matchups", f"scoreboard_wk{wk}.html")
                if not out_path:
                    break

                with open(out_path, "r", encoding="utf-8", errors="ignore") as f:
                    html = f.read()

                # Check if Yahoo returned Error #768 / 'You must enter a valid week'
                if self._is_invalid_week(html):
                    print(f"    [Matchups] Reached end of season at Week {wk} ('You must enter a valid week. (Error #768)' detected).")
                    if out_path.exists():
                        out_path.unlink()
                    break

                # Check if Week has not been played / scheduled yet ('(Empty)' detected)
                if "(Empty)" in html:
                    print(f"    [Matchups] Week {wk} has not been played / scheduled yet ('(Empty)' detected). Terminating matchup scrape for {year}.")
                    if out_path.exists():
                        out_path.unlink()
                    break

                # Also check if Yahoo redirected to an earlier week
                if self.page and "matchup_week=" in self.page.url:
                    m = re.search(r'matchup_week=(\d+)', self.page.url)
                    if m and int(m.group(1)) != wk:
                        print(f"    [Matchups] Week {wk} redirected to Week {m.group(1)}. Season {year} ended at Week {wk - 1}.")
                        if out_path.exists():
                            out_path.unlink()
                        break

            except Exception as e:
                print(f"    [WARN] Failed scoreboard week {wk}: {e}")
                break

            visited_teams = set()
            for team_id in range(1, max_teams + 1):
                if team_id in visited_teams:
                    print(f"    [Skip] Team {team_id} boxscore already scraped as opponent in Week {wk}.")
                    continue

                try:
                    url = f"{base_url}/matchup?week={wk}&module=matchup&mid1={team_id}"
                    out_path = self._fetch_page(url, year, "matchups", f"boxscore_wk{wk}_team{team_id}.html")
                    if out_path:
                        with open(out_path, "r", encoding="utf-8", errors="ignore") as f:
                            html = f.read()

                        if self._is_invalid_week(html):
                            print(f"    [Matchups] Reached end of season at Week {wk} (Error #768 detected in boxscore).")
                            if out_path.exists():
                                out_path.unlink()
                            break

                        if "(Empty)" in html:
                            print(f"    [Matchups] Week {wk} boxscore has not been played yet ('(Empty)' detected). Removing file.")
                            if out_path.exists():
                                out_path.unlink()
                            break

                        match = re.search(r'mid1=(\d+)&(?:amp;)?mid2=(\d+)', html)
                        if match:
                            id1, id2 = int(match.group(1)), int(match.group(2))
                            visited_teams.add(id1)
                            visited_teams.add(id2)
                        else:
                            visited_teams.add(team_id)

                    if len(visited_teams) >= max_teams:
                        print(f"    [Matchups] Captured all 6 unique matchups for Week {wk} (no duplicates).")
                        break
                except Exception as e:
                    print(f"    [WARN] Failed boxscore wk{wk} team{team_id}: {e}")

    # =========================================================================
    # Full Season Orchestration
    # =========================================================================
    def scrape_season(self, year, max_weeks=18, max_teams=12):
        """
        Scrapes only essential, non-redundant data for a season:
        1. League Info (Home, Settings, Standings, Teams, Recordbook) -> auto archives recordbook.html
        2. Draft Results -> cancels/removes file if '--empty--' detected
        3. All Transactions (paginated)
        4. Weekly Scoreboards & Unique Matchup Box Scores -> cancels/removes file if '(Empty)' detected
        """
        print(f"\n========================================================")
        print(f"  STARTING ZERO-REDUNDANCY SEASON SCRAPE FOR {year}")
        print(f"========================================================")
        self.scrape_league_info(year)
        self.scrape_draft(year)
        self.scrape_transactions(year)
        self.scrape_weekly_matchups(year, max_weeks=max_weeks, max_teams=max_teams)
        print(f"--- Completed Scrape for {year} ---\n")

    def scrape_all_seasons(self, seasons=None):
        if seasons is None:
            seasons = SEASONS_TO_SCRAPE
        for yr in seasons:
            self.scrape_season(yr)


if __name__ == "__main__":
    print("=" * 70)
    print("YAHOO FANTASY FOOTBALL - HISTORICAL DATA SCRAPER (2018-2027)")
    print("=" * 70)
    print("Starting smart-cached, zero-redundancy scrape across all historical & upcoming seasons...")
    with YahooFantasyScraper(headless=False, delay=1.0) as scraper:
        scraper.scrape_all_seasons()
    print("=" * 70)
    print("ALL HISTORICAL SEASONS SCRAPED AND CACHED IN /scraper/raw_data/ !")
    print("=" * 70)
