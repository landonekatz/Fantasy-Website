# Dumbarton Fantasy Football League HQ - Python Scraper & Data Pipeline

This folder contains the Playwright web scraper and Pandas data processing pipeline designed to scrape historical Yahoo Fantasy Football data and attach all team/player records to persistent **Canonical Manager IDs** defined in `../data/managers.json`.

---

## macOS Terminal Setup Instructions

Run the following commands in your macOS terminal to set up the Python virtual environment and install all required dependencies (Playwright, Pandas, lxml, BeautifulSoup4):

### 1. Open Terminal & Navigate to Project Root
```bash
cd /Users/Landon/Documents/Fantasy-Website
```

### 2. Create and Activate Python 3 Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install Python Dependencies
```bash
pip install --upgrade pip
pip install -r scraper/requirements.txt
```

### 4. Install Playwright Chromium Browser
```bash
playwright install chromium
```

---

## Interactive Yahoo Authentication (Persistent Context)

Because private Yahoo Fantasy League history requires authentication, the scraper uses Playwright's persistent browser session context (`./scraper/.browser_context`).

Run the interactive authentication script once:
```bash
python3 -m scraper.auth
```
1. A Chromium browser window will open.
2. Log in to your Yahoo account manually.
3. Once logged in and viewing your fantasy leagues, close the browser window.
4. Your login cookies are now saved locally and will be automatically reused by headless scraping runs!

---

## Running the Scraper & Processing Pipeline

### Run the Scraper (Historical Seasons)
```bash
python3 -m scraper.yahoo_scraper
```

### Run the Pandas Processing Pipeline
To clean raw HTML/JSON snapshots and export clean structured JSON datasets to `../data/*.json`:
```bash
python3 -m scraper.pipeline
```

### Run Pipeline Verification Tests
To test the Pandas DataFrame transformations and Canonical Manager ID resolutions:
```bash
python3 -m scraper.pipeline --test
```
