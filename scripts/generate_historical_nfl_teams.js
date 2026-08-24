import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const DEFENSE_MAP = {
  'patriots': 'NE', 'new england patriots': 'NE', 'patriots dst': 'NE', 'new england patriots dst': 'NE', 'patriots d/st': 'NE',
  'broncos': 'DEN', 'denver broncos': 'DEN', 'broncos dst': 'DEN', 'denver broncos dst': 'DEN', 'broncos d/st': 'DEN',
  'chiefs': 'KC', 'kansas city chiefs': 'KC', 'chiefs dst': 'KC', 'kansas city chiefs dst': 'KC', 'chiefs d/st': 'KC',
  'seahawks': 'SEA', 'seattle seahawks': 'SEA', 'seahawks dst': 'SEA', 'seattle seahawks dst': 'SEA', 'seahawks d/st': 'SEA',
  'texans': 'HOU', 'houston texans': 'HOU', 'texans dst': 'HOU', 'houston texans dst': 'HOU', 'texans d/st': 'HOU',
  'ravens': 'BAL', 'baltimore ravens': 'BAL', 'ravens dst': 'BAL', 'baltimore ravens dst': 'BAL', 'ravens d/st': 'BAL',
  'steelers': 'PIT', 'pittsburgh steelers': 'PIT', 'steelers dst': 'PIT', 'pittsburgh steelers dst': 'PIT', 'steelers d/st': 'PIT',
  'rams': 'LAR', 'los angeles rams': 'LAR', 'st louis rams': 'LAR', 'rams dst': 'LAR', 'los angeles rams dst': 'LAR', 'rams d/st': 'LAR',
  'chargers': 'LAC', 'los angeles chargers': 'LAC', 'san diego chargers': 'LAC', 'chargers dst': 'LAC', 'los angeles chargers dst': 'LAC', 'chargers d/st': 'LAC',
  'eagles': 'PHI', 'philadelphia eagles': 'PHI', 'eagles dst': 'PHI', 'philadelphia eagles dst': 'PHI', 'eagles d/st': 'PHI',
  'cowboys': 'DAL', 'dallas cowboys': 'DAL', 'cowboys dst': 'DAL', 'dallas cowboys dst': 'DAL', 'cowboys d/st': 'DAL',
  '49ers': 'SF', 'san francisco 49ers': 'SF', '49ers dst': 'SF', 'san francisco 49ers dst': 'SF', '49ers d/st': 'SF',
  'bills': 'BUF', 'buffalo bills': 'BUF', 'bills dst': 'BUF', 'buffalo bills dst': 'BUF', 'bills d/st': 'BUF',
  'dolphins': 'MIA', 'miami dolphins': 'MIA', 'dolphins dst': 'MIA', 'miami dolphins dst': 'MIA', 'dolphins d/st': 'MIA',
  'jets': 'NYJ', 'new york jets': 'NYJ', 'jets dst': 'NYJ', 'new york jets dst': 'NYJ', 'jets d/st': 'NYJ',
  'giants': 'NYG', 'new york giants': 'NYG', 'giants dst': 'NYG', 'new york giants dst': 'NYG', 'giants d/st': 'NYG',
  'commanders': 'WAS', 'washington commanders': 'WAS', 'washington football team': 'WAS', 'redskins': 'WAS', 'washington redskins': 'WAS', 'commanders dst': 'WAS', 'washington dst': 'WAS', 'commanders d/st': 'WAS',
  'vikings': 'MIN', 'minnesota vikings': 'MIN', 'vikings dst': 'MIN', 'minnesota vikings dst': 'MIN', 'vikings d/st': 'MIN',
  'packers': 'GB', 'green bay packers': 'GB', 'packers dst': 'GB', 'green bay packers dst': 'GB', 'packers d/st': 'GB',
  'bears': 'CHI', 'chicago bears': 'CHI', 'bears dst': 'CHI', 'chicago bears dst': 'CHI', 'bears d/st': 'CHI',
  'lions': 'DET', 'detroit lions': 'DET', 'lions dst': 'DET', 'detroit lions dst': 'DET', 'lions d/st': 'DET',
  'saints': 'NO', 'new orleans saints': 'NO', 'saints dst': 'NO', 'new orleans saints dst': 'NO', 'saints d/st': 'NO',
  'buccaneers': 'TB', 'tampa bay buccaneers': 'TB', 'buccaneers dst': 'TB', 'tampa bay buccaneers dst': 'TB', 'buccaneers d/st': 'TB',
  'falcons': 'ATL', 'atlanta falcons': 'ATL', 'falcons dst': 'ATL', 'atlanta falcons dst': 'ATL', 'falcons d/st': 'ATL',
  'panthers': 'CAR', 'carolina panthers': 'CAR', 'panthers dst': 'CAR', 'carolina panthers dst': 'CAR', 'panthers d/st': 'CAR',
  'cardinals': 'ARI', 'arizona cardinals': 'ARI', 'cardinals dst': 'ARI', 'arizona cardinals dst': 'ARI', 'cardinals d/st': 'ARI',
  'jaguars': 'JAX', 'jacksonville jaguars': 'JAX', 'jaguars dst': 'JAX', 'jacksonville jaguars dst': 'JAX', 'jaguars d/st': 'JAX',
  'titans': 'TEN', 'tennessee titans': 'TEN', 'titans dst': 'TEN', 'tennessee titans dst': 'TEN', 'titans d/st': 'TEN',
  'colts': 'IND', 'indianapolis colts': 'IND', 'colts dst': 'IND', 'indianapolis colts dst': 'IND', 'colts d/st': 'IND',
  'browns': 'CLE', 'cleveland browns': 'CLE', 'browns dst': 'CLE', 'cleveland browns dst': 'CLE', 'browns d/st': 'CLE',
  'bengals': 'CIN', 'cincinnati bengals': 'CIN', 'bengals dst': 'CIN', 'cincinnati bengals dst': 'CIN', 'bengals d/st': 'CIN',
  'raiders': 'LV', 'las vegas raiders': 'LV', 'oakland raiders': 'LV', 'raiders dst': 'LV', 'oakland raiders dst': 'LV', 'raiders d/st': 'LV'
};

const ALIASES = {
  'hollywood brown': 'marquise brown',
  'robby anderson': 'robbie chosen',
  'chosen anderson': 'robbie chosen',
  'mitch trubisky': 'mitchell trubisky',
  'gabriel davis': 'gabe davis',
  'josh palmer': 'joshua palmer',
  'chigoziem okonkwo': 'chig okonkwo',
  'ken walker': 'kenneth walker',
  'deandre swift': 'dandre swift',
  'cameron akers': 'cam akers',
  'matt stafford': 'matthew stafford',
  'christopher godwin': 'chris godwin',
  'will fuller': 'william fuller',
  'kenneth gainwell': 'kenny gainwell',
  'jeffrey wilson': 'jeff wilson',
  'ben watson': 'benjamin watson',
  'eli mitchell': 'elijah mitchell',
  'nyheim millerhines': 'nyheim hines'
};

// Explicit draft-time team overrides for edge-case players (e.g. Free Agents / Pre-Season cuts / Draft Trades)
const DRAFT_TIME_OVERRIDES = {
  '2018_dez bryant': 'DAL',
  '2018_dez bryant_wr': 'DAL',
  '2018_amari cooper': 'LV',
  '2018_amari cooper_wr': 'LV',
  '2018_leveon bell': 'PIT',
  '2018_leveon bell_rb': 'PIT',
  '2019_antonio brown': 'OAK',
  '2019_antonio brown_wr': 'OAK',
  '2022_christian mccaffrey': 'CAR',
  '2022_christian mccaffrey_rb': 'CAR',
  '2024_davante adams': 'LV',
  '2024_davante adams_wr': 'LV',
  '2024_amari cooper': 'CLE',
  '2024_amari cooper_wr': 'CLE'
};

function cleanName(name) {
  if (!name) return '';
  const norm = String(name)
    .toLowerCase()
    .replace(/\b(dst|d\/st|defense)\b/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v|\.|\')\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return ALIASES[norm] || norm;
}

async function buildHistoricalDataset() {
  console.log('=== Building Historical NFL Teams Dataset (2015-2027) ===');

  const teamLookup = {}; // year -> { normName: team, normName_pos: team }
  const years = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

  for (const yr of years) {
    teamLookup[yr] = {};
    const res = await fetch(`https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_${yr}.csv`);
    if (!res.ok) {
      console.warn(`Failed to fetch roster for ${yr}`);
      continue;
    }
    const text = await res.text();
    const rows = text.split('\n');
    const headers = rows[0].split(',').map(h => h.trim());
    const teamIdx = headers.indexOf('team');
    const nameIdx = headers.indexOf('full_name');
    const firstIdx = headers.indexOf('first_name');
    const lastIdx = headers.indexOf('last_name');
    const posIdx = headers.indexOf('position');
    const weekIdx = headers.indexOf('week');

    for (let i = 1; i < rows.length; i++) {
      if (!rows[i].trim()) continue;
      const cols = rows[i].split(',');
      let team = cols[teamIdx]?.trim();
      if (!team) continue;
      if (team === 'OAK') team = 'LV';
      if (team === 'WSH') team = 'WAS';
      if (team === 'SD') team = 'LAC';
      if (team === 'STL') team = 'LAR';

      const fullName = cols[nameIdx]?.replace(/\"/g, '').trim();
      const firstName = cols[firstIdx]?.replace(/\"/g, '').trim();
      const lastName = cols[lastIdx]?.replace(/\"/g, '').trim();
      const pos = cols[posIdx]?.trim();
      const week = Number(cols[weekIdx]) || 1;

      const cFull = cleanName(fullName);
      const cAlt = cleanName(firstName + ' ' + lastName);

      [cFull, cAlt].forEach(n => {
        if (n && team) {
          if (!teamLookup[yr][n] || week === 1) {
            teamLookup[yr][n] = team;
          }
          if (pos && (!teamLookup[yr][n + '_' + pos.toLowerCase()] || week === 1)) {
            teamLookup[yr][n + '_' + pos.toLowerCase()] = team;
          }
        }
      });
    }
  }

  // 2026 / 2027 from FantasyPros ADP
  teamLookup[2026] = {};
  const fp2026Path = path.join(rootDir, 'FantasyPros_2026_Overall_ADP_Rankings.csv');
  if (fs.existsSync(fp2026Path)) {
    const fp2026 = fs.readFileSync(fp2026Path, 'utf8').split('\n');
    fp2026.slice(1).forEach(l => {
      const match = l.match(/^\d+,\"?([^\"]+?)\s+([A-Z]{2,3})\s*\(\d+\)\"?,([A-Z]+)/);
      if (match) {
        const pName = match[1].trim();
        const pTeam = match[2].trim();
        const pPos = match[3].replace(/\d+$/, '').trim();
        const cName = cleanName(pName);
        teamLookup[2026][cName] = pTeam;
        teamLookup[2026][cName + '_' + pPos.toLowerCase()] = pTeam;
      }
    });
  }
  teamLookup[2027] = { ...teamLookup[2026] };

  // Apply explicit draft-time overrides
  Object.entries(DRAFT_TIME_OVERRIDES).forEach(([key, team]) => {
    const [yr, ...nameParts] = key.split('_');
    const pKey = nameParts.join('_');
    if (teamLookup[yr]) {
      teamLookup[yr][pKey] = team;
    }
  });

  // Save to src/nfl_historical_teams_data.json
  const outJsonPath = path.join(rootDir, 'src', 'nfl_historical_teams_data.json');
  fs.writeFileSync(outJsonPath, JSON.stringify(teamLookup, null, 2), 'utf8');
  console.log(`Saved team lookup to ${outJsonPath}`);

  // Helper resolver function
  function resolveTeam(playerName, year, position) {
    if (!playerName || playerName.includes('Player #-1') || playerName.includes('Pass / Empty Slot')) {
      return '';
    }
    const yr = Number(year);
    const pos = String(position || '').toUpperCase();
    const cName = cleanName(playerName);

    // 1. Defenses
    if (pos === 'DEF' || pos === 'D/ST' || DEFENSE_MAP[cName] || DEFENSE_MAP[playerName.toLowerCase()]) {
      const dTeam = DEFENSE_MAP[cName] || DEFENSE_MAP[playerName.toLowerCase()];
      if (dTeam) return dTeam;
    }

    // 2. Draft-time overrides
    const overrideKey = `${yr}_${cName}${pos ? '_' + pos.toLowerCase() : ''}`;
    if (DRAFT_TIME_OVERRIDES[overrideKey]) {
      return DRAFT_TIME_OVERRIDES[overrideKey];
    }
    if (DRAFT_TIME_OVERRIDES[`${yr}_${cName}`]) {
      return DRAFT_TIME_OVERRIDES[`${yr}_${cName}`];
    }

    // 3. Exact year match
    let team = teamLookup[yr]?.[cName + (pos ? '_' + pos.toLowerCase() : '')] || teamLookup[yr]?.[cName];
    if (team) return team;

    // 4. Fallback to previous seasons (last active NFL team before retirement / draft)
    for (let prevYr = yr - 1; prevYr >= 2015; prevYr--) {
      const prevTeam = teamLookup[prevYr]?.[cName + (pos ? '_' + pos.toLowerCase() : '')] || teamLookup[prevYr]?.[cName];
      if (prevTeam) return prevTeam;
    }

    // 5. Fallback to subsequent seasons (rookie drafted before final roster cut)
    for (let nextYr = yr + 1; nextYr <= 2027; nextYr++) {
      const nextTeam = teamLookup[nextYr]?.[cName + (pos ? '_' + pos.toLowerCase() : '')] || teamLookup[nextYr]?.[cName];
      if (nextTeam) return nextTeam;
    }

    return '';
  }

  // Update dmsfantasy/data/draft_results.json
  const dmsDraftPath = path.join(rootDir, 'dmsfantasy', 'data', 'draft_results.json');
  if (fs.existsSync(dmsDraftPath)) {
    const dmsPicks = JSON.parse(fs.readFileSync(dmsDraftPath, 'utf8'));
    let updatedCount = 0;
    dmsPicks.forEach(p => {
      const accurateTeam = resolveTeam(p.player_name, p.season, p.position);
      if (accurateTeam) {
        p.nfl_team = accurateTeam;
        updatedCount++;
      }
    });
    fs.writeFileSync(dmsDraftPath, JSON.stringify(dmsPicks, null, 2), 'utf8');
    console.log(`Updated ${updatedCount} picks in ${dmsDraftPath}`);
  }

  // Update gaywoodfantasy/data/draft_results.json
  const gwDraftPath = path.join(rootDir, 'gaywoodfantasy', 'data', 'draft_results.json');
  if (fs.existsSync(gwDraftPath)) {
    const gwPicks = JSON.parse(fs.readFileSync(gwDraftPath, 'utf8'));
    let updatedCount = 0;
    gwPicks.forEach(p => {
      const yr = p.season || p.year;
      const accurateTeam = resolveTeam(p.player_name || p.playerName, yr, p.position);
      if (accurateTeam) {
        p.nfl_team = accurateTeam;
        p.nflTeam = accurateTeam;
        updatedCount++;
      }
    });
    fs.writeFileSync(gwDraftPath, JSON.stringify(gwPicks, null, 2), 'utf8');
    console.log(`Updated ${updatedCount} picks in ${gwDraftPath}`);
  }

  // Re-generate dmsfantasy/data/data_bundle.js
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

  console.log('=== Historical NFL Teams Generation Complete! ===');
}

buildHistoricalDataset().catch(e => {
  console.error('Error generating historical teams:', e);
  process.exit(1);
});
