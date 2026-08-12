# Workspace Rule: Multi-League Identification System

This workspace contains two distinct Fantasy Football League codebases. Always determine which league the user's request pertains to before inspecting or modifying code.

---

## 1. Repository Root: The Dumbarton Fantasy Football League HQ
- **Path**: `/Users/Landon/Documents/Fantasy-Website/` (`src/`, `data/`, `index.html`, `vite.config.js`)
- **League Name**: The Dumbarton Fantasy Football League HQ ("Landon's League")
- **Platform**: Yahoo Fantasy Football
- **Seasons Logged**: 2018–2026 (9 Seasons)
- **Key Schema Properties**:
  - `season` (e.g. `2018`, `2025`)
  - `is_playoffs` (boolean)
  - `team_1_id`, `team_2_id`, `team_1_actual_points`, `team_2_actual_points`
  - Standings property: `rank`, `made_playoffs`

---

## 2. Subdirectory: Gaywood / Katz Fantasy Football League HQ ("Dad League")
- **Path**: `/Users/Landon/Documents/Fantasy-Website/dad-league/` (`dad-league/src/`, `dad-league/data/`, `dad-league/index.html`)
- **League Name**: Gaywood / Katz Fantasy Football League HQ ("Dad League")
- **Platform**: ESPN Fantasy Football (League ID: `262404`)
- **Seasons Logged**: 2015–2025 (11 Seasons)
- **Key Schema Properties**:
  - `year` (e.g. `2015`, `2025`)
  - `is_playoff` (boolean)
  - `home_team_id`, `away_team_id`, `home_score`, `away_score`
  - Standings property: `final_rank`, `playoff_seed`

---

## Directives for AI Assistant
1. Unless explicitly stated otherwise, if the user mentions **"dad league"** or **"dad-league"**, ALL operations (file reads, code edits, script runs, data updates) MUST be performed inside `/Users/Landon/Documents/Fantasy-Website/dad-league/`.
2. Normalize data ingest in JavaScript code so both schema dialects (`year`/`season`, `is_playoff`/`is_playoffs`, `home_team_id`/`team_1_id`) work seamlessly.
