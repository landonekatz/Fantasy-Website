# Repository Guide & Multi-League Directory Map

Welcome! This repository hosts **The Fantasy Vault** multi-tenant platform and historical archives for hosted fantasy football leagues.

---

## 📁 Repository Directory Structure

```
Fantasy-Website/
├── .agents/rules/
│   └── league_distinction.md     # Persistent rule for multi-league awareness
├── index.html                     # The Fantasy Vault Landing Hub (thefantasyvault.com)
├── src/                           # Landing Hub JS & CSS (hub.js, hub.css)
├── dmsfantasy/                    # THE DUMBARTON LEAGUE (/dmsfantasy)
│   ├── index.html                 # Dumbarton web portal
│   ├── src/                       # Dumbarton JS (app.js, records.js, rivalry.js)
│   └── data/                      # Dumbarton JSON datasets (Yahoo platform)
├── gaywoodfantasy/                # DEPRECATED LOCAL PORTAL (Historical data archive for LDI)
│   ├── index.html                 # Redirect to /gaywoodfantasyfootball
│   └── data/                      # Historical datasets (ESPN platform, 2015-2025)
├── vercel.json                    # Vercel deployment & rewrite/redirect rules
├── netlify.toml                   # Netlify deployment fallback & redirect rules
└── vite.config.js                 # Multi-page Vite build configuration
```

---

## 🏆 League Profiles

### 1. The Fantasy Vault Hub
- **Location**: Root directory (`/`)
- **Domain**: `thefantasyvault.com`
- **Role**: Platform landing hub, SaaS onboarding demo, league switcher.

### 2. The Dumbarton Fantasy Football League HQ
- **Location**: `dmsfantasy/` folder
- **URL Path**: `/dmsfantasy`
- **Platform**: Yahoo Fantasy
- **Years**: 2018-2026

### 3. Gaywood / Katz Fantasy Football League HQ ("Dad League")
- **Status**: Standalone portal (`/gaywoodfantasy`) is deprecated entirely. Hosted dynamically on The Fantasy Vault.
- **URL Path**: `/gaywoodfantasyfootball`
- **Platform**: ESPN Fantasy (League ID `262404`)
- **Years**: 2015-2026
- **Historical Data Archive**: `gaywoodfantasy/data/` (retained for LDI dataset compilation)

---

## 📜 Core Platform Rules & Operational Guidelines

### 1. Emoji Policy
- 🏆 (Trophy) and 🚽 (Toilet) are permitted in the **Record Book** tab ONLY (where wins, championships, and toilet bowl / last place losses are tracked).
- **NO emojis anywhere else across the entire platform** (landing hub, headers, cards, modals, tabs, etc.). Always use clean typography or SVGs.

### 2. Browser Subagent & Testing Protocol
- **Do NOT launch browser subagents or open automated Chrome tabs to test pages.**
- The user tests everything directly on `localhost`. Rely on static code inspection, unit logic verification, and `npx vite build` to validate changes before reporting completion.

### 3. Em-Dash Policy
- Anytime you want to use an em-dash (`—`), use `, as` (comma as) instead. Never use em-dash characters across platform code, UI copy, and documentation.

### 4. Cross-Platform Parity Rule
- All platform features, fixes, scoring logic, draft calculations, and design polish must be applied consistently across all hosted experiences: The Fantasy Vault Engine (`/` & `vault.html`, including `/gaywoodfantasyfootball`) and Dumbarton League (`/dmsfantasy`). Never leave existing leagues on outdated logic.

### 5. Standardized NFL Stats & Positional Scoring Policy
- Standardized NFL data from Sleeper API (`src/nfl_stats.js`) must be used for official regular season games played (`gp`), missed games / injury badges, and format-specific positional finishes across all leagues.
- Format-specific finishes must match each league's scoring system:
  - DMS League: Explicitly Half-PPR (`0.5`) for all years (2018-2026).
  - Gaywood / Katz: Half-PPR (`0.5`).
### 6. Landon Draft Index (LDI) Single Source of Truth
- Any work on LDI, including scoring calculations, games-missed proration, adjusted expectations, Winsorization, VORP, and diagnostic pills, must refer first and foremost to `landon_draft_index_framework.md` as the absolute bible for the system.

### 7. Default Scope Policy
- All proposed changes, new features, and bug fixes are for the Dumbarton League (`dmsfantasy/`) and for The Fantasy Vault engine (`src/` & `vault.html`), unless obvious or otherwise specified.

