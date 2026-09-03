# Multi-League Distinction Rule

When working on this repository, you MUST maintain the structural separation between the platform hub and distinct hosted leagues:

1. **Platform Hub (`/`)**:
   - Files: `index.html`, `src/hub.js`, `src/hub.css`, `vercel.json`, `netlify.toml`, `vite.config.js`
   - Purpose: **The Fantasy Vault** landing portal, SaaS waitlist/registration demo, and dynamic league router (`thefantasyvault.com`).

2. **The Dumbarton Fantasy Football League (`/dmsfantasy`)**:
   - Location: `dmsfantasy/`
   - Platform: Yahoo Fantasy (2018–2026)
   - Scope: Dumbarton-specific record books, rivalry week, power rankings, and data (`dmsfantasy/data/`).

3. **Gaywood / Katz Fantasy Football League ("Dad League") (`/gaywoodfantasyfootball`)**:
   - Status: Standalone portal (`/gaywoodfantasy`) is deprecated entirely. Hosted as a Vault League.
   - URL Path: `/gaywoodfantasyfootball`
   - Platform: ESPN Fantasy (League ID `262404`, 2015-2026)
   - Scope: Hosted dynamically on The Fantasy Vault engine (`vault.html`), with historical data archive in `gaywoodfantasy/data/`.

Always respect these boundaries.

---

## 📜 Em-Dash Policy
Anytime you want to use an em-dash (`—`), use `, as` (comma as) instead. Never use em-dash characters across platform code, UI copy, and documentation.

---

## 📜 Cross-Platform Parity Rule
All platform features, fixes, scoring logic, draft calculations, and design polish must be applied consistently across hosted experiences: The Fantasy Vault Engine (`/` & `vault.html`, including `/gaywoodfantasyfootball`) and Dumbarton League (`/dmsfantasy`). Never leave existing leagues on outdated logic.

---

## 📜 Standardized NFL Stats & Positional Scoring Policy
Standardized NFL data from Sleeper API (`src/nfl_stats.js`) must be used for official regular season games played (`gp`), missed games / injury badges, and format-specific positional finishes across all leagues.
Format-specific finishes must match each league's scoring system:
- DMS League: Explicitly Half-PPR (`0.5`) for all years (2018–2026).
- Gaywood / Katz: Half-PPR (`0.5`).
---

## 📜 Default Scope Policy
All proposed changes, new features, and bug fixes are for the Dumbarton League (`dmsfantasy/`) and for The Fantasy Vault engine (`src/` & `vault.html`), unless obvious or otherwise specified.

