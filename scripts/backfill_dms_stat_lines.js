import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const FIREBASE_DB_URL = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }
  return await res.json();
}

function putToFirebase(dbPath, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${FIREBASE_DB_URL}/${dbPath}.json`);
    const body = JSON.stringify(data);

    const req = https.request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let respBody = '';
      res.on('data', c => respBody += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(respBody);
        } else {
          reject(new Error(`Firebase PUT ${dbPath} failed with HTTP ${res.statusCode}: ${respBody.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const NICKNAME_TO_ABBR = {
  '49ers': 'SF', 'bears': 'CHI', 'bengals': 'CIN', 'bills': 'BUF',
  'broncos': 'DEN', 'browns': 'CLE', 'buccaneers': 'TB', 'cardinals': 'ARI',
  'chargers': 'LAC', 'chiefs': 'KC', 'colts': 'IND', 'commanders': 'WAS',
  'cowboys': 'DAL', 'dolphins': 'MIA', 'eagles': 'PHI', 'falcons': 'ATL',
  'giants': 'NYG', 'jaguars': 'JAX', 'jets': 'NYJ', 'lions': 'DET',
  'packers': 'GB', 'panthers': 'CAR', 'patriots': 'NE', 'raiders': 'OAK',
  'rams': 'LAR', 'ravens': 'BAL', 'saints': 'NO', 'seahawks': 'SEA',
  'steelers': 'PIT', 'texans': 'HOU', 'titans': 'TEN', 'vikings': 'MIN',
  'redskins': 'WAS', 'washington': 'WAS', 'new england': 'NE', 'green bay': 'GB',
  'kansas city': 'KC', 'new orleans': 'NO', 'tampa bay': 'TB',
  'los angeles rams': 'LAR', 'los angeles chargers': 'LAC'
};

const ALIASES = {
  'will fuller v': 'will fuller',
  'robbie chosen': 'robby anderson',
  'chosen anderson': 'robby anderson',
  'mitch trubisky': 'mitchell trubisky',
  'gabriel davis': 'gabe davis',
  'josh palmer': 'joshua palmer',
  'chigoziem okonkwo': 'chig okonkwo',
  'ken walker': 'kenneth walker',
  'kenneth walker iii': 'kenneth walker',
  'deandre swift': 'dandre swift',
  'cameron akers': 'cam akers',
  'matt stafford': 'matthew stafford',
  'christopher godwin': 'chris godwin',
  'william fuller': 'will fuller',
  'kenneth gainwell': 'kenny gainwell',
  'jeffrey wilson': 'jeff wilson',
  'ben watson': 'benjamin watson',
  'eli mitchell': 'elijah mitchell',
  'nyheim millerhines': 'nyheim hines',
  'travis etienne jr': 'travis etienne',
  'brian robinson jr': 'brian robinson',
  'michael pittman jr': 'michael pittman',
  'marvin harrison jr': 'marvin harrison'
};

function clean(n) {
  if (!n) return '';
  let s = String(n)
    .toLowerCase()
    .replace(/\b(defense|dst|d\/st)\b/g, '')
    .replace(/\./g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES[s] || s;
}

function cleanCompact(n) {
  return clean(n).replace(/\s+/g, '');
}

function formatSleeperStats(stats, pos) {
  if (!stats) return '';
  let out = [];

  // DEFENSE / SPECIAL TEAMS
  if (pos === 'D/ST' || pos === 'DEF') {
    const ptsAllowed = stats.pts_allow;
    const sacks = Math.round(stats.sack || 0);
    const ints = Math.round(stats.int || 0);
    const fumRec = Math.round(stats.fum_rec || 0);
    const safeties = Math.round(stats.safety || 0);
    const blocks = Math.round(stats.blk_kick || 0);
    const defTD = Math.round((stats.def_td || 0) + (stats.st_td || 0));

    if (defTD > 0) out.push(`${defTD} TD`);
    if (ptsAllowed != null) {
      if (ptsAllowed >= 35) out.push('Pts Allow 35+');
      else if (ptsAllowed >= 28) out.push('Pts Allow 28-34');
      else if (ptsAllowed === 0) out.push('Pts Allow 0');
      else out.push(`PA: ${ptsAllowed}`);
    }
    if (sacks > 0) out.push(`${sacks} Sack${sacks > 1 ? 's' : ''}`);
    if (ints > 0) out.push(`${ints} Int`);
    if (fumRec > 0) out.push(`${fumRec} Fum Rec`);
    if (safeties > 0) out.push(`${safeties} Safety`);
    if (blocks > 0) out.push(`${blocks} Blk`);
    return out.join(', ');
  }

  // KICKER
  if (pos === 'K') {
    const fgMade = Math.round(stats.fgm || 0);
    const fgAtt = Math.round(stats.fga || 0);
    const patMade = Math.round(stats.xpm || 0);
    const patAtt = Math.round(stats.xpa || 0);
    const fg50 = Math.round(stats.fgm_50p || 0);
    
    if (fgMade > 0 || fgAtt > 0) {
      let fgStr = `${fgMade}/${Math.max(fgMade, fgAtt)} FG`;
      if (fg50 > 0) fgStr += ` (${fg50} 50+)`;
      out.push(fgStr);
    }
    if (patMade > 0 || patAtt > 0) {
      out.push(`${patMade}/${Math.max(patMade, patAtt)} PAT`);
    }
    return out.join(', ');
  }

  // OFFENSE: QB, RB, WR, TE
  const passYd = Math.round(stats.pass_yd || 0);
  const passTd = Math.round(stats.pass_td || 0);
  const passInt = Math.round(stats.pass_int || 0);
  const passAtt = Math.round(stats.pass_att || 0);

  if (passYd !== 0 || passTd > 0 || passAtt > 0) {
    if (passYd !== 0) out.push(`${passYd} Pass Yds`);
    if (passTd > 0) out.push(`${passTd} Pass TD`);
    if (passInt > 0) out.push(`${passInt} INT`);
  }

  const rushYd = Math.round(stats.rush_yd || 0);
  const rushAtt = Math.round(stats.rush_att || 0);
  const rushTd = Math.round(stats.rush_td || 0);
  if (rushYd !== 0) out.push(`${rushYd} Rush Yds`);
  if (rushTd > 0) out.push(`${rushTd} Rush TD`);
  if (rushAtt > 0 && pos === 'RB') out.push(`${rushAtt} Att`);

  const recYd = Math.round(stats.rec_yd || 0);
  const recs = Math.round(stats.rec || 0);
  const recTd = Math.round(stats.rec_td || 0);
  if (recYd !== 0) out.push(`${recYd} Rec Yds`);
  if (recs > 0) out.push(`${recs} Rec`);
  if (recTd > 0) out.push(`${recTd} Rec TD`);

  const fumLost = Math.round(stats.fum_lost || 0);
  if (fumLost > 0) {
    out.push(`${fumLost} Fum`);
  }

  return out.join(', ');
}

async function main() {
  console.log('Starting comprehensive backfill of DMS player stats (2018-2022 seasons)...');

  // 1. Fetch Sleeper players directory
  console.log('Fetching Sleeper players directory...');
  const sleeperPlayers = await fetchJson('https://api.sleeper.app/v1/players/nfl');
  const nameToSleeperPlayers = {};
  const compactToSleeperPlayers = {};

  for (const [id, p] of Object.entries(sleeperPlayers)) {
    const full = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    const c = clean(full);
    const compact = cleanCompact(full);
    const item = { player_id: id, name: full, pos: p.position, team: p.team };

    if (!nameToSleeperPlayers[c]) nameToSleeperPlayers[c] = [];
    nameToSleeperPlayers[c].push(item);

    if (!compactToSleeperPlayers[compact]) compactToSleeperPlayers[compact] = [];
    compactToSleeperPlayers[compact].push(item);
  }
  console.log(`Loaded ${Object.keys(nameToSleeperPlayers).length} unique names from Sleeper directory.`);

  // 2. Load historical teams data (2015-2027)
  const histTeamsPath = path.join(rootDir, 'src', 'nfl_historical_teams_data.json');
  const histTeamsData = JSON.parse(fs.readFileSync(histTeamsPath, 'utf8'));
  const histNorm = {}; // yr -> compactName -> team
  for (const [yr, map] of Object.entries(histTeamsData)) {
    histNorm[yr] = {};
    for (const [rawName, team] of Object.entries(map)) {
      histNorm[yr][cleanCompact(rawName)] = team;
      histNorm[yr][clean(rawName)] = team;
    }
  }

  // 3. Load Gaywood player stats for secondary team/opponent mapping
  const gwStats = JSON.parse(fs.readFileSync(path.join(rootDir, 'gaywoodfantasy', 'data', 'weekly_player_stats.json'), 'utf8'));
  const gwMap = new Map();
  gwStats.forEach(s => {
    const k = `${s.year}_${s.week}_${clean(s.player_name)}`;
    if (!gwMap.has(k) && s.nfl_team) {
      gwMap.set(k, { team: s.nfl_team, opp: s.nfl_opponent, gameResult: s.nfl_game_result });
    }
  });

  // 4. Cache Sleeper weekly stats and ESPN weekly scoreboards for NFL 2017 to 2021
  const sleeperStatsCache = {}; // `${nflYear}_${week}` -> statsObj
  const espnScoreboardCache = {}; // `${nflYear}_${week}` -> { [team]: { opp, res } }

  for (let nflYear = 2017; nflYear <= 2021; nflYear++) {
    const maxWeeks = nflYear >= 2021 ? 18 : 17;
    console.log(`Fetching Sleeper and ESPN data for NFL ${nflYear} (Weeks 1-${maxWeeks})...`);

    for (let wk = 1; wk <= maxWeeks; wk++) {
      // Sleeper weekly stats
      try {
        const sData = await fetchJson(`https://api.sleeper.app/v1/stats/nfl/regular/${nflYear}/${wk}`);
        sleeperStatsCache[`${nflYear}_${wk}`] = sData || {};
      } catch (err) {
        console.warn(`Sleeper fetch failed for ${nflYear} W${wk}:`, err.message);
        sleeperStatsCache[`${nflYear}_${wk}`] = {};
      }

      // ESPN scoreboard with 100ms throttle
      try {
        const eData = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${wk}&dates=${nflYear}`);
        const map = {};
        if (eData && eData.events) {
          eData.events.forEach(e => {
            const comp = e.competitions && e.competitions[0];
            if (!comp || !comp.competitors) return;
            const home = comp.competitors.find(c => c.homeAway === 'home');
            const away = comp.competitors.find(c => c.homeAway === 'away');
            if (!home || !away) return;
            let hTeam = home.team.abbreviation;
            let aTeam = away.team.abbreviation;
            if (hTeam === 'WSH') hTeam = 'WAS';
            if (aTeam === 'WSH') aTeam = 'WAS';
            if (hTeam === 'JAC') hTeam = 'JAX';
            if (aTeam === 'JAC') aTeam = 'JAX';
            if (hTeam === 'LA') hTeam = 'LAR';
            if (aTeam === 'LA') aTeam = 'LAR';

            const hScore = Number(home.score) || 0;
            const aScore = Number(away.score) || 0;
            const hWin = hScore > aScore ? 'W' : (hScore < aScore ? 'L' : 'T');
            const aWin = aScore > hScore ? 'W' : (aScore < hScore ? 'L' : 'T');
            map[hTeam] = { opp: aTeam, res: `Final ${hWin} ${hScore}-${aScore}            vs` };
            map[aTeam] = { opp: hTeam, res: `Final ${aWin} ${aScore}-${hScore}            @` };
          });
        }
        espnScoreboardCache[`${nflYear}_${wk}`] = map;
      } catch (err) {
        console.warn(`ESPN scoreboard fetch failed for ${nflYear} W${wk}:`, err.message);
        espnScoreboardCache[`${nflYear}_${wk}`] = {};
      }

      await new Promise(r => setTimeout(r, 100));
    }
  }

  // 5. Load local weekly player stats
  const localStatsPath = path.join(rootDir, 'dmsfantasy', 'data', 'weekly_player_stats.json');
  const statsList = JSON.parse(fs.readFileSync(localStatsPath, 'utf8'));
  console.log(`Loaded ${statsList.length} local records.`);

  let updatedStatLines = 0;
  let updatedOpponents = 0;

  for (let i = 0; i < statsList.length; i++) {
    const st = statsList[i];
    const yr = Number(st.season || st.year);
    if (yr > 2022) continue; // Keep 2023-2026 untouched

    const nflYear = yr - 1; // 2018 -> NFL 2017, 2019 -> NFL 2018, etc.
    const wk = Number(st.week);
    const sleeperWeekStats = sleeperStatsCache[`${nflYear}_${wk}`] || {};
    const espnWeekMap = espnScoreboardCache[`${nflYear}_${wk}`] || {};

    const pos = st.position || st.roster_slot || '';
    const isDef = pos === 'DEF' || pos === 'D/ST' || (st.player_name || '').toLowerCase().includes('defense');

    let playerTeam = '';
    let statObj = null;

    if (isDef) {
      const nick = clean(st.player_name);
      playerTeam = NICKNAME_TO_ABBR[nick] || NICKNAME_TO_ABBR[nick.replace('defense', '').trim()] || '';
      if (nflYear >= 2020 && playerTeam === 'OAK') playerTeam = 'LV';
      statObj = playerTeam ? sleeperWeekStats[playerTeam] : null;
    } else {
      const c = clean(st.player_name);
      const compact = cleanCompact(st.player_name);

      // Resolve player's team for this NFL year
      const yrMap = histNorm[String(nflYear)] || {};
      playerTeam = yrMap[compact] || yrMap[c] || '';

      // Find player in Sleeper
      const cands = nameToSleeperPlayers[c] || compactToSleeperPlayers[compact] || [];
      const match = cands.find(cand => cand.player_id && sleeperWeekStats[cand.player_id]) || cands[0];
      if (match) {
        statObj = sleeperWeekStats[match.player_id];
        if (!playerTeam && match.team) playerTeam = match.team;
      }

      if (!playerTeam) {
        const gwEntry = gwMap.get(`${nflYear}_${wk}_${c}`);
        if (gwEntry?.team) playerTeam = gwEntry.team;
      }
    }

    // Format stat line
    const statLine = formatSleeperStats(statObj, pos);
    if (statLine) {
      st.nfl_stat_line = statLine;
      updatedStatLines++;
    }

    // Resolve opponent and game result from player's NFL team
    if (playerTeam) {
      const gameInfo = espnWeekMap[playerTeam];
      if (gameInfo) {
        st.nfl_team = gameInfo.opp;
        st.nfl_game_result = gameInfo.res;
        updatedOpponents++;
      } else {
        const gwEntry = gwMap.get(`${nflYear}_${wk}_${clean(st.player_name)}`);
        if (gwEntry) {
          if (gwEntry.opp) st.nfl_team = gwEntry.opp;
          if (gwEntry.gameResult) st.nfl_game_result = gwEntry.gameResult;
          if (gwEntry.opp || gwEntry.gameResult) updatedOpponents++;
        }
      }
    }
  }

  console.log(`Successfully backfilled ${updatedStatLines} player stat lines and ${updatedOpponents} opponent/results!`);

  // Write updated weekly_player_stats.json to disk
  fs.writeFileSync(localStatsPath, JSON.stringify(statsList, null, 2), 'utf8');
  console.log(`Saved updated stats to ${localStatsPath}.`);

  // 6. Re-generate dmsfantasy/data/data_bundle.js
  const dmsDataDir = path.join(rootDir, 'dmsfantasy', 'data');
  const bundleFiles = ['league_standings.json', 'matchups.json', 'weekly_player_stats.json', 'draft_results.json', 'transactions.json'];
  const bundleData = {};
  bundleFiles.forEach(f => {
    const p = path.join(dmsDataDir, f);
    if (fs.existsSync(p)) {
      const key = f.replace('.json', '');
      bundleData[key] = JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  });
  const bundleOut = path.join(dmsDataDir, 'data_bundle.js');
  fs.writeFileSync(bundleOut, `window.FANTASY_DATA = ${JSON.stringify(bundleData)};\n`, 'utf8');
  console.log(`Rebuilt ${bundleOut}`);

  // 7. Upload to Firebase RTDB
  console.log('Uploading updated weekly_player_stats to Firebase RTDB...');
  const managersJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'managers.json'), 'utf8'));
  const mgrIdToName = new Map();
  (managersJson.managers || []).forEach(m => {
    if (m.id) mgrIdToName.set(m.id, m.name || m.manager_name || m.id);
  });

  const standardized = statsList.map(st => {
    const yr = Number(st.season || st.year);
    const pos = st.position || st.roster_slot || '';
    let headshot = st.headshot_url || '';
    if (!headshot) {
      const norm = clean(st.player_name);
      const compact = cleanCompact(st.player_name);
      if (pos === 'DEF' || pos === 'D/ST') {
        const abbr = NICKNAME_TO_ABBR[norm] || '';
        if (abbr) headshot = `https://sleepercdn.com/images/team_logos/nfl/${abbr.toLowerCase()}.png`;
      } else {
        const cands = nameToSleeperPlayers[norm] || compactToSleeperPlayers[compact] || [];
        if (cands.length > 0 && cands[0].player_id) {
          headshot = `https://sleepercdn.com/content/nfl/players/thumb/${cands[0].player_id}.jpg`;
        }
      }
    }

    return {
      year: yr,
      season: yr,
      week: Number(st.week),
      player_name: st.player_name,
      player_id: st.player_id || 0,
      position: pos,
      roster_slot: st.roster_slot || pos,
      is_starter: !!st.is_starter,
      fantasy_points: Number(st.fantasy_points) || 0,
      projected_points: Number(st.projected_points) || 0,
      manager_id: st.manager_id || '',
      manager_name: mgrIdToName.get(st.manager_id) || st.manager_name || '',
      team_id: st.team_id || 1,
      team_name: st.team_name || '',
      opponent_team_id: st.opponent_team_id || null,
      opponent_team_name: st.opponent_team_name || '',
      opponent_manager_id: st.opponent_manager_id || '',
      opponent_manager_name: st.opponent_manager_name || '',
      nfl_team: st.nfl_team || '',
      nfl_game_result: st.nfl_game_result || '',
      nfl_stat_line: st.nfl_stat_line || '',
      injury_status: st.injury_status || null,
      headshot_url: headshot,
      game_type: st.game_type || 'regular_season',
      is_playoff: Boolean(st.is_playoffs),
      is_consolation: false
    };
  });

  await putToFirebase('leagues/dmsfantasy/weekly_player_stats', standardized);
  console.log('Firebase RTDB successfully updated with complete historical player stats!');
}

main().catch(err => {
  console.error('Fatal error in backfill:', err);
  process.exit(1);
});
