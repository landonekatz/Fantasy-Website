/**
 * update_vault_leagues.js
 * Automated synchronization script for all leagues hosted on The Fantasy Vault.
 *
 * Capabilities:
 * 1. Queries Firebase Realtime Database for all registered Vault leagues.
 * 2. Pulls active season data, roster moves, matchups, and new draft results.
 * 3. Detects newly drafted seasons and executes year-to-year rollover.
 * 4. Ingests live NFL game scores via ESPN Scoreboard API (replacing static CSV).
 * 5. Ingests player stats and games played from Sleeper NFL API.
 * 6. Recompiles clean datasets with uniform in-season team names and logos.
 * 7. Pushes the compiled payload back to Firebase RTDB.
 *
 * Usage:
 *   node scripts/update_vault_leagues.js [--dry-run] [--league=<slug>] [--verbose]
 */

import { fetchEspnSeasonData } from '../api/scrape-season.js';
import { compileVaultData } from '../src/compiler.js';
import { nflGamesService } from '../src/nfl_games.js';

const FIREBASE_DB_URL = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';

// Parse command line flags
const args = process.argv.slice(2);
const IS_DRY_RUN = args.includes('--dry-run');
const IS_VERBOSE = args.includes('--verbose');
const LEAGUE_FLAG = args.find(a => a.startsWith('--league='));
const TARGET_LEAGUE = LEAGUE_FLAG ? LEAGUE_FLAG.split('=')[1].trim() : null;

// Leagues that have dedicated local scrapers (DMS has Yahoo scraper, Gaywood has local scraper)
const EXCLUDED_LEAGUES = new Set(['dmsfantasy']);

function log(msg, ...rest) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[${timestamp}] ${msg}`, ...rest);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFromFirebase(path) {
  const [cleanPath, query] = path.split('?');
  const url = `${FIREBASE_DB_URL}/${cleanPath}.json${query ? '?' + query : ''}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function saveToFirebase(path, data) {
  const [cleanPath, query] = path.split('?');
  const url = `${FIREBASE_DB_URL}/${cleanPath}.json${query ? '?' + query : ''}`;
  if (IS_DRY_RUN) {
    log(`  [Dry Run] Would write to ${url}`);
    return true;
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.ok;
}

/**
 * Fetch Sleeper NFL current state to identify the active NFL season and week.
 */
async function getNflState() {
  try {
    const res = await fetch('https://api.sleeper.app/v1/state/nfl');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    log(`  [Warning] Sleeper state fetch failed: ${e.message}`);
  }
  const year = new Date().getFullYear();
  return { season: String(year), week: 1, season_type: 'regular' };
}

/**
 * Synchronize a single Vault league.
 */
async function syncLeague(slug) {
  log(`\n======================================================`);
  log(`Processing League: /${slug}`);
  log(`======================================================`);

  // 1. Fetch current settings and credentials from Firebase
  const settings = await fetchFromFirebase(`leagues/${slug}/league_settings`);
  const credentials = await fetchFromFirebase(`leagues/${slug}/credentials`) || {};
  const existingMembers = await fetchFromFirebase(`leagues/${slug}/members`) || [];
  const existingStandings = await fetchFromFirebase(`leagues/${slug}/league_standings`) || [];
  const existingClaims = await fetchFromFirebase(`leagues/${slug}/claims`);
  const existingNotes = await fetchFromFirebase(`leagues/${slug}/commissioner_notes`);
  const existingRankings = await fetchFromFirebase(`leagues/${slug}/power_rankings`);

  if (!settings && !credentials.leagueId) {
    log(`  [Skip] League /${slug} has no settings or league ID in database.`);
    return;
  }

  const leagueName = settings?.name || slug;
  const leagueId = credentials.leagueId || settings?.id;
  const platform = (credentials.platform || settings?.platform || 'espn').toLowerCase();
  const s2 = credentials.s2 || '';
  const swid = credentials.swid || '';

  log(`  League Name : ${leagueName}`);
  log(`  Platform    : ${platform.toUpperCase()}`);
  log(`  League ID   : ${leagueId}`);
  log(`  Stored Years: ${settings?.firstYear || '?'} - ${settings?.lastYear || '?'}`);

  if (platform !== 'espn') {
    log(`  [Notice] Automated synchronization currently targets ESPN and Sleeper API platforms.`);
    return;
  }

  // 2. Discover active & new seasons
  const nflState = await getNflState();
  const currentYear = parseInt(nflState.season, 10) || new Date().getFullYear();
  const lastRecordedYear = settings?.lastYear ? Number(settings.lastYear) : currentYear;

  log(`  Current NFL Season: ${currentYear} (Week ${nflState.week})`);

  // Check if currentYear is available on the provider
  const yearsToCheck = [...new Set([currentYear, lastRecordedYear].filter(Boolean))];

  const seasonsData = [];

  for (const yr of yearsToCheck) {
    log(`  Checking season ${yr} on ESPN...`);
    try {
      const seasonRes = await fetchEspnSeasonData({
        leagueId,
        year: yr,
        s2,
        swid,
        checkOnly: false
      });

      if (seasonRes && seasonRes.data) {
        const hasPicks = (seasonRes.data.draftDetail?.drafted === true) || (seasonRes.data.draftDetail?.picks || []).some(p => p.playerId > 0);
        const schedule = seasonRes.data.schedule || [];
        const hasGames = schedule.some(s => s.winner !== 'UNDECIDED' || (s.home && s.home.totalPoints > 0));

        if (hasGames || hasPicks) {
          log(`    -> Found ${yr}: ${hasGames ? 'In-Season / Completed Games' : 'Draft Completed (Pre-Season)'}`);
          seasonsData.push(seasonRes);
        } else {
          log(`    -> Found ${yr} on ESPN: Scheduled / Pre-Draft order set, but draft has not occurred yet. Skipping.`);
        }
      } else {
        log(`    -> Season ${yr} not found or inaccessible on ESPN.`);
      }
    } catch (err) {
      log(`    -> Error fetching ${yr}: ${err.message}`);
    }

    // Rate-limit pause
    await sleep(500);
  }

  if (seasonsData.length === 0) {
    log(`  [Notice] No active seasons could be fetched from ESPN for /${slug}. Stored data preserved.`);
    return;
  }

  // 3. Pre-fetch live NFL games from ESPN Scoreboard
  log(`  Fetching live NFL game scores for ${currentYear}...`);
  await nflGamesService.fetchSeasonGames(currentYear, Math.min(nflState.week || 1, 18));

  // 4. Ingest Historical Seasons from Firebase to avoid re-scraping past decades
  const historicalSeasonsFromDb = [];
  const storedYears = [...new Set(existingStandings.map(s => Number(s.year || s.season)).filter(Boolean))];
  const fetchedYears = new Set(seasonsData.map(s => s.year));

  log(`  Loaded ${storedYears.length} historical seasons already preserved in database.`);

  // 5. Compile the updated payload
  log(`  Compiling Vault payload with draft rollover and live scores...`);
  const compiledPayload = compileVaultData(
    seasonsData,
    existingMembers,
    settings?.name || leagueName
  );

  if (!compiledPayload) {
    log(`  [Error] Failed to compile payload for /${slug}.`);
    return;
  }

  // Preserve and merge historical draft picks, standings, matchups, and player stats for older seasons
  const fetchedYearsSet = new Set(seasonsData.map(s => s.year));
  const existingDraft = await fetchFromFirebase(`leagues/${slug}/draft_results`) || [];
  const existingMatchups = await fetchFromFirebase(`leagues/${slug}/matchups`) || [];
  const existingStats = await fetchFromFirebase(`leagues/${slug}/weekly_player_stats`) || [];
  const existingTeamStats = await fetchFromFirebase(`leagues/${slug}/team_stats`) || [];

  const oldDraft = existingDraft.filter(p => !fetchedYearsSet.has(Number(p.year || p.season)));
  const draftMap = new Map();
  for (const p of [...oldDraft, ...(compiledPayload.draft_results || [])]) {
    draftMap.set(`${p.year}-${p.overall_pick}`, p);
  }
  compiledPayload.draft_results = Array.from(draftMap.values()).sort((a, b) => (b.year - a.year) || (a.overall_pick - b.overall_pick));

  const oldStandings = existingStandings.filter(s => !fetchedYearsSet.has(Number(s.year || s.season)));
  compiledPayload.league_standings = [...(compiledPayload.league_standings || []), ...oldStandings];

  const oldMatchups = existingMatchups.filter(m => !fetchedYearsSet.has(Number(m.year || m.season)));
  compiledPayload.matchups = [...(compiledPayload.matchups || []), ...oldMatchups];

  const oldStats = existingStats.filter(st => !fetchedYearsSet.has(Number(st.year || st.season)));
  compiledPayload.weekly_player_stats = [...(compiledPayload.weekly_player_stats || []), ...oldStats];

  const oldTeamStats = existingTeamStats.filter(ts => !fetchedYearsSet.has(Number(ts.year || ts.season)));
  compiledPayload.team_stats = [...(compiledPayload.team_stats || []), ...oldTeamStats];

  compiledPayload.league_standings.sort((a, b) => (b.year || 0) - (a.year || 0) || (a.final_rank || 99) - (b.final_rank || 99));

  // Recalculate start and end years
  const allYears = [...new Set(compiledPayload.league_standings.map(s => Number(s.year || s.season)).filter(Boolean))].sort((a, b) => a - b);
  if (allYears.length > 0) {
    compiledPayload.league_settings.firstYear = allYears[0];
    compiledPayload.league_settings.lastYear = allYears[allYears.length - 1];
    compiledPayload.league_settings.totalSeasons = allYears.length;
  }

  // 6. Preserve and attach updated credentials and sync metadata
  compiledPayload.credentials = {
    platform,
    leagueId: String(leagueId),
    s2,
    swid,
    last_synced: new Date().toISOString()
  };
  compiledPayload.league_settings.platform = platform;
  compiledPayload.league_settings.last_synced = new Date().toISOString();

  if (settings?.admin_email) {
    compiledPayload.league_settings.admin_email = settings.admin_email;
  }
  if (settings?.join_code) {
    compiledPayload.league_settings.join_code = settings.join_code;
  }
  if (settings?.loser_conditions) {
    compiledPayload.league_settings.loser_conditions = settings.loser_conditions;
  }

  // Preserve claims, commissioner notes, and power rankings
  if (existingClaims) {
    compiledPayload.claims = existingClaims;
  }
  if (existingNotes) {
    compiledPayload.commissioner_notes = existingNotes;
  }
  if (existingRankings) {
    compiledPayload.power_rankings = existingRankings;
  }

  // 7. Save to Firebase RTDB
  log(`  Writing updated payload to Firebase RTDB (/leagues/${slug})...`);
  const ok = await saveToFirebase(`leagues/${slug}`, compiledPayload);

  if (ok) {
    log(`  [SUCCESS] Successfully synchronized /${slug}!`);
    log(`    Active Year  : ${compiledPayload.league_settings.lastYear}`);
    log(`    Total Seasons: ${compiledPayload.league_settings.totalSeasons}`);
    log(`    Draft Picks  : ${compiledPayload.draft_results?.length || 0}`);
    log(`    Matchups     : ${compiledPayload.matchups?.length || 0}`);
  } else {
    log(`  [ERROR] Failed to save updated payload to Firebase RTDB for /${slug}.`);
  }
}

/**
 * Main Runner.
 */
async function main() {
  log('======================================================================');
  log('THE FANTASY VAULT - MULTI-LEAGUE AUTOMATED SYNCHRONIZATION PIPELINE');
  log('======================================================================');
  if (IS_DRY_RUN) log('MODE: Dry Run (No database writes)\n');

  // Fetch all league slugs from Firebase
  let leagueSlugs = [];
  if (TARGET_LEAGUE) {
    leagueSlugs = [TARGET_LEAGUE];
    log(`Targeting single league: /${TARGET_LEAGUE}`);
  } else {
    log('Fetching all registered leagues from Firebase Realtime Database...');
    const shallowLeagues = await fetchFromFirebase('leagues?shallow=true');
    if (!shallowLeagues) {
      log('[Error] Unable to reach Firebase Realtime Database.');
      process.exit(1);
    }
    leagueSlugs = Object.keys(shallowLeagues).filter(s => !EXCLUDED_LEAGUES.has(s));
    log(`Discovered ${leagueSlugs.length} Vault league(s) to process: ${leagueSlugs.join(', ')}`);
  }

  // Process leagues with controlled concurrency (max 2 leagues parallel)
  const CONCURRENCY = 2;
  for (let i = 0; i < leagueSlugs.length; i += CONCURRENCY) {
    const batch = leagueSlugs.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(slug => syncLeague(slug)));
    if (i + CONCURRENCY < leagueSlugs.length) {
      await sleep(1000); // 1s cooldown between batches
    }
  }

  log('\n======================================================================');
  log('ALL VAULT LEAGUES SYNCHRONIZATION COMPLETE!');
  log('======================================================================');
}

main().catch(err => {
  console.error('[FATAL] Script failed with error:', err);
  process.exit(1);
});
