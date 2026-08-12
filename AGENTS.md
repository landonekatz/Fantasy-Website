# Repository Guide & Multi-League Directory Map

Welcome! This repository hosts **The Fantasy Ledger** multi-tenant platform and historical archives for hosted fantasy football leagues.

---

## 📁 Repository Directory Structure

```
Fantasy-Website/
├── .agents/rules/
│   └── league_distinction.md     # Persistent rule for multi-league awareness
├── index.html                     # The Fantasy Ledger Landing Hub (thefantasyledger.com)
├── src/                           # Landing Hub JS & CSS (hub.js, hub.css)
├── dmsfantasy/                    # THE DUMBARTON LEAGUE (/dmsfantasy)
│   ├── index.html                 # Dumbarton web portal
│   ├── src/                       # Dumbarton JS (app.js, records.js, rivalry.js)
│   └── data/                      # Dumbarton JSON datasets (Yahoo platform)
├── gaywoodfantasy/                # GAYWOOD / KATZ LEAGUE ("DAD LEAGUE") (/gaywoodfantasy)
│   ├── index.html                 # Dad League web portal
│   ├── src/                       # Dad League JS (app.js, records.js, styles.css)
│   ├── data/                      # Dad League JSON datasets (ESPN platform)
│   └── scraper/                   # Dad League ESPN API scraper
├── netlify.toml                   # Netlify Free Tier deployment & redirect rules
└── vite.config.js                 # Multi-page Vite build configuration
```

---

## 🏆 League Profiles

### 1. The Fantasy Ledger Hub
- **Location**: Root directory (`/`)
- **Domain**: `thefantasyledger.com`
- **Role**: Platform landing hub, SaaS onboarding demo, league switcher.

### 2. The Dumbarton Fantasy Football League HQ
- **Location**: `dmsfantasy/` folder
- **URL Path**: `/dmsfantasy`
- **Platform**: Yahoo Fantasy
- **Years**: 2018–2026

### 3. Gaywood / Katz Fantasy Football League HQ ("Dad League")
- **Location**: `gaywoodfantasy/` folder
- **URL Path**: `/gaywoodfantasy`
- **Platform**: ESPN Fantasy (League ID `262404`)
- **Years**: 2015–2025
