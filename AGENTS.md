# Repository Guide & Multi-League Directory Map

Welcome! This repository hosts the fantasy football archives for two distinct leagues.

---

## 📁 Repository Directory Structure

```
Fantasy-Website/
├── .agents/rules/
│   └── league_distinction.md     # Persistent rule for multi-league awareness
├── src/                           # The Dumbarton League (Landon's League) JS
├── data/                          # The Dumbarton League JSON datasets
├── index.html                     # The Dumbarton League web portal
├── vite.config.js                 # Dev server for Dumbarton League
└── dad-league/                    # GAYWOOD / KATZ LEAGUE ("DAD LEAGUE")
    ├── src/                       # Dad League JS (app.js, records.js, styles.css)
    ├── data/                      # Dad League JSON datasets (ESPN platform)
    ├── scraper/                   # Dad League ESPN API scraper
    ├── index.html                 # Dad League web portal
    └── vite.config.js             # Dev server for Dad League
```

---

## 🏆 League Profiles

### 1. The Dumbarton Fantasy Football League HQ
- **Location**: Root directory (`/`)
- **Platform**: Yahoo Fantasy
- **Years**: 2018–2026

### 2. Gaywood / Katz Fantasy Football League HQ ("Dad League")
- **Location**: `dad-league/` folder
- **Platform**: ESPN Fantasy (League ID `262404`)
- **Years**: 2015–2025
