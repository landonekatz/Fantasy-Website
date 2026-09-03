#!/bin/bash

# Dumbarton Fantasy Football League HQ
# Weekly Scraper & GitHub Pages Update Automation
# ------------------------------------------------------------------
# This script is intended to be run locally via macOS crontab or launchd.
# It ensures the current year's data is freshly scraped, processed, and
# automatically pushed to GitHub Pages.
# ------------------------------------------------------------------

# Exit on any error
set -e

# Ensure standard binaries and Homebrew tools are on PATH when run by launchd
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

# 1. Define Paths (Absolute paths ensure cron runs correctly)
PROJECT_DIR="/Users/Landon/Documents/Fantasy-Website"
CURRENT_YEAR=2027
VENV_ACTIVATE="${PROJECT_DIR}/venv/bin/activate"

# 2. Navigate to project root
cd "$PROJECT_DIR"
echo "[1/6] Navigated to Project Directory: $(pwd)"

# 2.5 Sync with remote to prevent conflicts
echo "[1.5/6] Pulling latest changes from remote..."
git pull origin main --rebase --autostash

# 3. Activate Python Virtual Environment
if [ -f "$VENV_ACTIVATE" ]; then
    source "$VENV_ACTIVATE"
    echo "[2/6] Activated Python Virtual Environment."
else
    echo "ERROR: Virtual environment not found at $VENV_ACTIVATE"
    exit 1
fi

# 4. Clear current standings and transactions to force fresh pull
echo "[3/6] Clearing cache for ${CURRENT_YEAR} standings and transactions..."
rm -f "${PROJECT_DIR}/scraper/raw_data/${CURRENT_YEAR}/league_info/standings.html"
rm -rf "${PROJECT_DIR}/scraper/raw_data/${CURRENT_YEAR}/transactions"
echo "      Cache cleared (played matchups remain cached!)."

# 5. Run the Scraper for the Current Year
echo "[4/6] Running Playwright Scraper for ${CURRENT_YEAR}..."
python3 -m scraper.yahoo_scraper --year $CURRENT_YEAR --headless

# 6. Run Data Processing Pipeline (Recompiles all weeks & updates manager mappings)
echo "[5/6] Auto-updating Team Name Mappings..."
python3 scraper/parse_teams.py

echo "[5.25/6] Running Pandas Data Pipeline..."
python3 -m scraper.pipeline

echo "[5.5/6] Running Power Rankings Parser..."
python3 scraper/parse_power_rankings.py

echo "[5.75/6] Re-bundling Offline Data..."
python3 scraper/parser.py

# 7. Commit to Git & Push to GitHub
echo "[6/6] Committing updates to GitHub..."
git add dmsfantasy/data/
git add scraper/raw_data/${CURRENT_YEAR}/ || true

# If there are changes, commit them
if ! git diff --cached --quiet; then
    git commit -m "Automated Weekly Update: Week's Data & Standings for ${CURRENT_YEAR}"
else
    echo "      No new changes to commit. Data is up to date."
fi

# Always pull and push to ensure local and remote are synced
echo "      Syncing with remote GitHub repository..."
git pull origin main --rebase --autostash
git push origin main
echo "      Successfully synced with GitHub! GitHub Pages will auto-rebuild."

echo "========================================================"
echo "    WEEKLY AUTOMATION SUCCESSFUL!"
echo "========================================================"
