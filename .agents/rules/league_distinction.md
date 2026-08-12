# Multi-League Distinction Rule

When working on this repository, you MUST maintain the structural separation between the platform hub and distinct hosted leagues:

1. **Platform Hub (`/`)**:
   - Files: `index.html`, `src/hub.js`, `src/hub.css`, `netlify.toml`, `vite.config.js`
   - Purpose: **The Fantasy Ledger** landing portal, SaaS waitlist/registration demo, and dynamic league router.

2. **The Dumbarton Fantasy Football League (`/dmsfantasy`)**:
   - Location: `dmsfantasy/`
   - Platform: Yahoo Fantasy (2018–2026)
   - Scope: Dumbarton-specific record books, rivalry week, power rankings, and data (`dmsfantasy/data/`).

3. **Gaywood / Katz Fantasy Football League ("Dad League") (`/gaywoodfantasy`)**:
   - Location: `gaywoodfantasy/`
   - Platform: ESPN Fantasy (League ID `262404`, 2015–2025)
   - Scope: Gaywood-specific record books, ESPN scraper, and data (`gaywoodfantasy/data/`).

Always respect these boundaries. Do NOT mix dataset files or cross-contaminate app logic between `/dmsfantasy` and `/gaywoodfantasy`.
