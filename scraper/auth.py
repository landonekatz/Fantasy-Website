"""
Playwright Persistent Context Authentication Module.

Run this module as a script to open a headed browser window and log in to Yahoo Fantasy manually:
    python3 -m scraper.auth

Once authenticated, the browser session is saved in `.browser_context` and reused by `yahoo_scraper.py`.
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

try:
    from .config import USER_DATA_DIR, SEASON_URLS
except ImportError:
    from config import USER_DATA_DIR, SEASON_URLS


def run_interactive_auth():
    print("=" * 70)
    print("YAHOO FANTASY FOOTBALL - INTERACTIVE AUTHENTICATION SETUP")
    print("=" * 70)
    print(f"Browser profile directory: {USER_DATA_DIR}")
    print("Opening Chromium in headed mode... Please log into your Yahoo Fantasy account.")
    print("Once you are logged in and can see your league page, close the browser window.")
    print("=" * 70)

    start_url = SEASON_URLS.get(2026, "https://football.fantasysports.yahoo.com")

    with sync_playwright() as p:
        # Launch persistent context
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(USER_DATA_DIR),
            headless=False,
            viewport={"width": 1280, "height": 800},
            args=["--disable-blink-features=AutomationControlled"]
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(start_url)

        print("Waiting for browser to be closed by user...")
        try:
            page.wait_for_timeout(600000)  # Wait up to 10 minutes for manual login
        except Exception:
            pass

        try:
            context.close()
        except Exception:
            pass

    print("Session closed. Your Yahoo login cookies are now saved in the persistent browser context!")


if __name__ == "__main__":
    run_interactive_auth()
