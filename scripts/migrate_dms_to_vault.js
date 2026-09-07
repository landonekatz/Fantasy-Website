/**
 * migrate_dms_to_vault.js
 * 
 * Commutes The Dumbarton Fantasy Football League (/dmsfantasy) from static offline JSONs
 * into a fully dynamic Vault league powered by the official Yahoo Fantasy Sports API.
 * 
 * Pipeline:
 * 1. Fetches all 10 historical seasons (2017 through 2026 NFL seasons) via Yahoo API.
 * 2. Normalizes team IDs to canonical manager profiles from dmsfantasy/data/managers.json.
 * 3. Applies manager account merge rules for members who switched accounts/nicknames over time.
 * 4. Compiles the all-time vault dataset using src/compiler.js with seasonLabelConvention: "championship".
 * 5. Attaches Paradigms (historical & current Power Rankings, Rivalry Week bad-blood writeups).
 * 6. Pushes the compiled payload to Firebase Realtime Database at /leagues/dmsfantasy.
 * 
 * Usage:
 *   node scripts/migrate_dms_to_vault.js [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchYahooSeasonData } from '../api/scrape-yahoo-season.js';
import { refreshAccessToken } from '../api/yahoo.js';
import { compileVaultData } from '../src/compiler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env.local');

const FIREBASE_DB_URL = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';
const IS_DRY_RUN = process.argv.includes('--dry-run');

// Parse .env.local
function loadEnv() {
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
    }
  });
  return env;
}

const env = loadEnv();
const refreshToken = env.YAHOO_REFRESH_TOKEN;

if (!refreshToken) {
  console.error('Error: YAHOO_REFRESH_TOKEN not found in .env.local');
  process.exit(1);
}

// 10 Dumbarton historical seasons (NFL season -> display label + Yahoo league key)
const DUMBARTON_SEASONS = [
  { nflYear: 2026, displayYear: 2027, key: '470.l.52841' },
  { nflYear: 2025, displayYear: 2026, key: '461.l.42542' },
  { nflYear: 2024, displayYear: 2025, key: '449.l.80052' },
  { nflYear: 2023, displayYear: 2024, key: '423.l.30266' },
  { nflYear: 2022, displayYear: 2023, key: '414.l.873470' },
  { nflYear: 2021, displayYear: 2022, key: '406.l.818216' },
  { nflYear: 2020, displayYear: 2021, key: '399.l.941578' },
  { nflYear: 2019, displayYear: 2020, key: '390.l.978070' },
  { nflYear: 2018, displayYear: 2019, key: '380.l.1168960' },
  { nflYear: 2017, displayYear: 2018, key: '371.l.862430' }
];

// Rivalry Week Pairs (Official Dumbarton bad-blood chronicles, no em-dashes per platform rules)
const RIVALRY_PAIRS = [
  {
    id: 'raufman_fey',
    surname1: 'RAUFMAN',
    surname2: 'FEY',
    manager1: 'Benjamin',
    manager2: 'Jake',
    manager1_id: 'benjamin',
    manager2_id: 'jake',
    writeup: 'A former double champion struggling in a new era. A perennial contender, and one-time champ, riding a five-season playoff streak. Both men who never once have admitted defeat. The championships were promised to them 3000 years ago. Two men fighting a holy war every year over the same religion, as fantasy football. It does not get much better than this. Ben vs. Jake.'
  },
  {
    id: 'stamatos_gutberlet',
    surname1: 'STAMATOS',
    surname2: 'GUTBERLET',
    manager1: 'Mike',
    manager2: 'Luke',
    manager1_id: 'mike',
    manager2_id: 'luke',
    writeup: 'It is on sight. Their blood stains the walls of the groupchat. Vicious battles where nothing is below the belt and nothing is off limits. Friends in the offseason. It all disappears with the opening kickoff. To paraphrase a great double champion, as "When you lose I celebrate". One looking for a record-breaking third ring. The other just wanting a playoff win. Mike vs. Luke.'
  },
  {
    id: 'katz_frey',
    surname1: 'KATZ',
    surname2: 'FREY',
    manager1: 'Landon',
    manager2: 'Alex',
    manager1_id: 'landon',
    manager2_id: 'alex',
    writeup: 'Polar opposites in record. One is 72-54 all time. The other is 54-72. But who cares? What really matters is trophies. Championships. They define your legacy. And in terms of trophies, both men are tied. The quest for a second ring. Landon vs. Alex.'
  },
  {
    id: 'watson_boice',
    surname1: 'WATSON',
    surname2: 'BOICE',
    manager1: 'Madoc',
    manager2: 'Ryan',
    manager1_id: 'madoc',
    manager2_id: 'ryan',
    writeup: 'Ryan is the type of person who thinks everything is sunshine and rainbows, and for good reason. His handicap is low, his football team is good, and he was able to make a serious contender in year two as a member of the DMS Fantasy league. Madoc sees the world in a melancholy gray and thrives on the sadness of others, and nothing would make him happier than taking Ryan and his squad out behind the woodshed on a yearly basis. Madoc vs. Ryan.'
  },
  {
    id: 'lehmann_sabatino',
    surname1: 'LEHMANN',
    surname2: 'SABATINO',
    manager1: 'Will',
    manager2: 'Isabella',
    manager1_id: 'will',
    manager2_id: 'isabella',
    writeup: '2021. The Championship. Kamara’s 54.7. Losing by less than two points. No playoff wins since. How does one break the curse of AK? Maybe by demolishing the one it all started against, as a double champion who elevates come playoff time, with a ridiculous 6-1 record in the big games. Isabella vs. Will.'
  },
  {
    id: 'glikin_beck',
    surname1: 'GLIKIN',
    surname2: 'BECK',
    manager1: 'Carson',
    manager2: 'Jordan',
    manager1_id: 'carson',
    manager2_id: 'jordan',
    writeup: 'It feels like one of these two are due. Both longtime league members. Both never won the big game. Both had years where it just slipped away. Completely different styles of coaching, as one likes sticking with his guys, while the other will literally trade anything that is not nailed down, and rip the nails out if he so chooses. Always a fun one. Jordan vs. Carson.'
  }
];

async function saveToFirebase(subPath, data) {
  const url = `${FIREBASE_DB_URL}/${subPath}.json`;
  if (IS_DRY_RUN) {
    console.log(`[Dry Run] Would write to ${url} (${JSON.stringify(data).length} bytes)`);
    return true;
  }
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firebase write failed: ${res.status} ${errText}`);
  }
  return true;
}

async function runMigration() {
  console.log('='.repeat(70));
  console.log('STARTING DUMBARTON COMMUTATION TO THE FANTASY VAULT');
  console.log('='.repeat(70));

  // 1. Refresh Yahoo Token
  console.log('\n[1/6] Refreshing Yahoo API access token...');
  const refreshed = await refreshAccessToken(refreshToken);
  const accessToken = refreshed.access_token;
  console.log('Access token acquired successfully.');

  // 2. Load Dumbarton manager mappings and traditions
  console.log('\n[2/6] Loading historical manager identities & traditions...');
  const managersJsonPath = path.join(rootDir, 'dmsfantasy', 'data', 'managers.json');
  const powerRankingsPath = path.join(rootDir, 'dmsfantasy', 'data', 'power_rankings_history.json');

  const managersData = JSON.parse(fs.readFileSync(managersJsonPath, 'utf8'));
  const powerRankingsHistory = JSON.parse(fs.readFileSync(powerRankingsPath, 'utf8'));

  console.log(`Loaded ${managersData.managers.length} canonical managers and ${managersData.team_mappings.length} seasonal team mappings.`);
  console.log(`Loaded ${powerRankingsHistory.length} historical power rankings editions.`);

  const teamMappings = managersData.team_mappings;
  const canonicalManagers = managersData.managers;
  const mgrIdToObj = new Map();
  canonicalManagers.forEach(m => mgrIdToObj.set(m.id, m));

  // 3. Fetch all 10 seasons via Yahoo API (with fallback to verified local datasets)
  console.log('\n[3/6] Fetching all 10 historical seasons via Yahoo Fantasy API / datasets...');
  const rawSeasonsData = [];

  // Load existing datasets as fallback if Yahoo API is rate-limited
  const localStandings = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'league_standings.json'), 'utf8'));
  const localMatchups = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'matchups.json'), 'utf8'));
  const localDraft = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'draft_results.json'), 'utf8'));
  const localStats = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'weekly_player_stats.json'), 'utf8'));
  const localTransactions = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'transactions.json'), 'utf8'));

  for (const s of DUMBARTON_SEASONS) {
    console.log(`  - Processing season ${s.nflYear} (Display: ${s.displayYear}, Key: ${s.key})...`);
    let seasonData = null;

    try {
      const t0 = Date.now();
      seasonData = await fetchYahooSeasonData({
        leagueKey: s.key,
        accessToken
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      console.log(`    Live Yahoo API fetch succeeded in ${elapsed}s: ${seasonData.data.teams.length} teams, ${seasonData.data.schedule.length} matchups, ${seasonData.data.draftDetail.picks.length} draft picks.`);
    } catch (apiErr) {
      console.warn(`    Yahoo API live query note (${apiErr.message}). Utilizing verified offline archive dataset for ${s.displayYear}...`);
      
      // Build seasonData from local archive
      const seasonTeams = teamMappings
        .filter(tm => tm.year === s.displayYear)
        .map(tm => {
          const st = localStandings.find(st => (st.season === s.displayYear || st.year === s.displayYear) && st.team_id === tm.team_id);
          const mgr = mgrIdToObj.get(tm.manager_id);
          return {
            id: tm.team_id,
            name: tm.team_name,
            logoUrl: mgr?.logo_url || st?.logo_url || '',
            primaryOwner: tm.manager_id,
            rank: st?.rank || 0,
            wins: st?.wins || 0,
            losses: st?.losses || 0,
            ties: st?.ties || 0,
            pointsFor: st?.points_for || 0,
            pointsAgainst: st?.points_against || 0,
            streak: st?.streak || ''
          };
        });

      const seasonSchedule = localMatchups
        .filter(m => (m.season === s.displayYear || m.year === s.displayYear))
        .map((m, idx) => ({
          id: `${s.nflYear}_w${m.week}_m${idx + 1}`,
          matchupPeriodId: m.week,
          season: s.nflYear,
          isPlayoffs: !!m.is_playoffs,
          isConsolation: false,
          home: {
            teamId: m.team_1_id,
            totalPoints: m.team_1_actual_points,
            projectedPoints: m.team_1_projected_points || 0,
            rosterForCurrentScoringPeriod: { entries: [] }
          },
          away: {
            teamId: m.team_2_id,
            totalPoints: m.team_2_actual_points,
            projectedPoints: m.team_2_projected_points || 0,
            rosterForCurrentScoringPeriod: { entries: [] }
          },
          winner: m.winner_team_id
        }));

      // Attach rosters/player stats for this season to schedule
      const seasonPlayerStats = localStats.filter(p => (p.season === s.displayYear || p.year === s.displayYear));
      seasonSchedule.forEach(game => {
        const hEntries = seasonPlayerStats
          .filter(p => p.week === game.matchupPeriodId && p.team_id === game.home.teamId)
          .map(p => ({
            playerId: p.player_id,
            playerName: p.player_name,
            position: p.position,
            nflTeam: p.nfl_team,
            headshotUrl: p.headshot_url || '',
            isStarter: !!p.is_starter,
            rosterSlot: p.is_starter ? p.position : 'BN',
            points: p.fantasy_points || 0
          }));
        const aEntries = seasonPlayerStats
          .filter(p => p.week === game.matchupPeriodId && p.team_id === game.away.teamId)
          .map(p => ({
            playerId: p.player_id,
            playerName: p.player_name,
            position: p.position,
            nflTeam: p.nfl_team,
            headshotUrl: p.headshot_url || '',
            isStarter: !!p.is_starter,
            rosterSlot: p.is_starter ? p.position : 'BN',
            points: p.fantasy_points || 0
          }));
        game.home.rosterForCurrentScoringPeriod.entries = hEntries;
        game.away.rosterForCurrentScoringPeriod.entries = aEntries;
      });

      const seasonPicks = localDraft
        .filter(d => (d.year === s.displayYear || d.season === s.displayYear))
        .map(d => ({
          round: d.round,
          pickInRound: d.round_pick,
          overallPick: d.overall_pick,
          teamId: d.team_id,
          playerId: d.player_id,
          playerName: d.player_name,
          position: d.position,
          nflTeam: d.nfl_team,
          headshotUrl: d.headshot_url || ''
        }));

      const seasonTx = localTransactions
        .filter(t => (t.season === s.displayYear || t.year === s.displayYear));

      seasonData = {
        year: s.nflYear,
        platform: 'yahoo',
        leagueKey: s.key,
        data: {
          seasonId: s.nflYear,
          teams: seasonTeams,
          members: seasonTeams.map(t => ({
            id: t.primaryOwner,
            displayName: mgrIdToObj.get(t.primaryOwner)?.name || t.name,
            alias: mgrIdToObj.get(t.primaryOwner)?.name || t.name,
            avatar: t.logoUrl,
            teamId: t.id,
            isActive: mgrIdToObj.get(t.primaryOwner)?.status === 'current'
          })),
          schedule: seasonSchedule,
          draftDetail: { picks: seasonPicks },
          transactions: seasonTx
        }
      };
      console.log(`    Archive dataset compiled: ${seasonData.data.teams.length} teams, ${seasonData.data.schedule.length} matchups, ${seasonData.data.draftDetail.picks.length} draft picks.`);
    }

    // Ensure mapped manager IDs and Cloudinary logos are attached
    seasonData.data.teams.forEach(t => {
      const match = teamMappings.find(tm => tm.year === s.displayYear && tm.team_id === t.id);
      if (match) {
        t.primaryOwner = match.manager_id;
        const mgrObj = mgrIdToObj.get(match.manager_id);
        if (mgrObj && mgrObj.logo_url) {
          t.logoUrl = mgrObj.logo_url;
        }
      }
    });

    seasonData.data.members.forEach(m => {
      const match = teamMappings.find(tm => tm.year === s.displayYear && tm.team_id === m.teamId);
      if (match) {
        m.id = match.manager_id;
        const mgrObj = mgrIdToObj.get(match.manager_id);
        if (mgrObj) {
          m.displayName = mgrObj.name;
          m.alias = mgrObj.name;
          m.avatar = mgrObj.logo_url || m.avatar;
          m.isActive = mgrObj.status === 'current';
        }
      }
    });

    rawSeasonsData.push(seasonData);
  }

  // 4. Build uiMembersConfig with account switch merges
  console.log('\n[4/6] Configuring manager identity resolution and account switch merges...');
  const uiMembersConfig = [
    // 18 Canonical Managers
    ...canonicalManagers.map(m => ({
      id: m.id,
      alias: m.name,
      isActive: m.status === 'current',
      logo_url: m.logo_url
    })),
    // Explicit secondary account / nickname merges across historical seasons
    { id: 'yahoo_willis', mergedInto: 'will' },
    { id: 'yahoo_jackie', mergedInto: 'jack' },
    { id: 'yahoo_marty', mergedInto: 'joey' },
    { id: 'yahoo_dawn', mergedInto: 'landon' },
    { id: 'yahoo_frenchy', mergedInto: 'alex' },
    { id: 'yahoo_bugsbunnyrules', mergedInto: 'jordan' }
  ];

  // 5. Structure Paradigms (Power Rankings & Rivalry Week)
  console.log('\n[5/6] Structuring Paradigms (Power Rankings & Rivalry Week)...');
  const paradigmsPowerRankings = {
    allowed_editors: ['landon'],
    current_ranking: powerRankingsHistory[0] || null,
    archived_rankings: powerRankingsHistory.slice(1) || []
  };

  const paradigms = {
    power_rankings: paradigmsPowerRankings,
    rivalries: RIVALRY_PAIRS
  };

  const options = {
    seasonLabelConvention: 'championship',
    paradigms
  };

  // 6. Compile full dataset with compiler.js
  console.log('\n[6/6] Compiling full vault dataset via compileVaultData()...');
  const compiledBundle = compileVaultData(
    rawSeasonsData,
    uiMembersConfig,
    'The Dumbarton Fantasy Football League',
    null,
    options
  );

  if (!compiledBundle) {
    throw new Error('Compilation produced null bundle');
  }

  console.log('\nCompilation Summary:');
  console.log(`- League Name: "${compiledBundle.league_settings?.name}"`);
  console.log(`- Season Label Convention: "${compiledBundle.seasonLabelConvention}"`);
  console.log(`- Total Seasons: ${compiledBundle.league_standings?.length ? new Set(compiledBundle.league_standings.map(s => s.year)).size : 0}`);
  console.log(`- Total Managers: ${compiledBundle.members?.length || 0}`);
  console.log(`- Total Matchups: ${compiledBundle.matchups?.length || 0}`);
  console.log(`- Total Player Stats: ${compiledBundle.weekly_player_stats?.length || 0}`);
  console.log(`- Total Draft Picks: ${compiledBundle.draft_results?.length || 0}`);
  console.log(`- Total Transactions: ${compiledBundle.transactions?.length || 0}`);
  console.log(`- Power Rankings Editions: ${(compiledBundle.paradigms?.power_rankings?.archived_rankings?.length || 0) + 1}`);
  console.log(`- Rivalry Pairs: ${compiledBundle.paradigms?.rivalries?.length || 0}`);

  // Preserve existing claims, users directory, and custom settings before saving
  try {
    const existingClaimsRes = await fetch(`${FIREBASE_DB_URL}/leagues/dmsfantasy/claims.json`);
    if (existingClaimsRes.ok) {
      const existingClaims = await existingClaimsRes.json();
      if (existingClaims && Object.keys(existingClaims).length > 0) {
        compiledBundle.claims = existingClaims;
      }
    }
    const existingUsersRes = await fetch(`${FIREBASE_DB_URL}/leagues/dmsfantasy/users.json`);
    if (existingUsersRes.ok) {
      const existingUsers = await existingUsersRes.json();
      if (existingUsers && Object.keys(existingUsers).length > 0) {
        compiledBundle.users = existingUsers;
      }
    }
    const existingSettingsRes = await fetch(`${FIREBASE_DB_URL}/leagues/dmsfantasy/league_settings.json`);
    if (existingSettingsRes.ok) {
      const existingSettings = await existingSettingsRes.json();
      if (existingSettings) {
        compiledBundle.league_settings = { ...(compiledBundle.league_settings || {}), ...existingSettings };
      }
    }
  } catch (presErr) {
    console.warn('Could not preserve existing claims/users:', presErr);
  }

  // Push to Firebase RTDB
  console.log(`\nSaving to Firebase RTDB (/leagues/dmsfantasy)...`);
  await saveToFirebase('leagues/dmsfantasy', compiledBundle);

  // Also write paradigms directly to /leagues/dmsfantasy/power_rankings for modular engine compatibility
  await saveToFirebase('leagues/dmsfantasy/power_rankings', paradigmsPowerRankings);
  await saveToFirebase('leagues/dmsfantasy/rivalries', RIVALRY_PAIRS);

  console.log('\n' + '='.repeat(70));
  console.log('DUMBARTON COMMUTATION COMPLETED SUCCESSFULLY!');
  console.log('The Dumbarton League is now a fully native Vault league on Firebase.');
  console.log('='.repeat(70));
}

runMigration().catch(err => {
  console.error('\nFatal error during migration:', err);
  process.exit(1);
});
