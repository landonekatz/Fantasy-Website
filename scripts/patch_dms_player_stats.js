import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const FIREBASE_DB_URL = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
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

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const teamDefMap = {
  'steelers': 'pit', 'texans': 'hou', 'rams': 'lar', 'cardinals': 'ari',
  'raiders': 'lv', 'ravens': 'bal', 'panthers': 'car', 'seahawks': 'sea',
  'vikings': 'min', 'broncos': 'den', 'bills': 'buf', 'buccaneers': 'tb',
  'packers': 'gb', 'chiefs': 'kc', 'giants': 'nyg', 'patriots': 'ne',
  'jaguars': 'jax', 'lions': 'det', 'dolphins': 'mia', 'eagles': 'phi',
  'colts': 'ind', 'saints': 'no', 'falcons': 'atl', 'browns': 'cle',
  'jets': 'nyj', 'commanders': 'was', 'washington': 'was', 'bears': 'chi',
  'bengals': 'cin', 'titans': 'ten', 'chargers': 'lac', 'cowboys': 'dal',
  '49ers': 'sf'
};

async function patchPlayerStats() {
  console.log('Fetching Sleeper NFL players directory...');
  const sleeperPlayers = await fetchJson('https://api.sleeper.app/v1/players/nfl');
  const sleeperMap = {};
  Object.values(sleeperPlayers).forEach(p => {
    const full = (p.first_name || '') + ' ' + (p.last_name || '');
    const norm = normalizeName(full);
    if (norm) sleeperMap[norm] = p.player_id;
  });
  console.log(`Mapped ${Object.keys(sleeperMap).length} Sleeper players.`);

  function getHeadshot(name, pos) {
    if (pos === 'DEF' || pos === 'D/ST') {
      const norm = normalizeName(name);
      for (const [k, abbr] of Object.entries(teamDefMap)) {
        if (norm.includes(k)) return `https://sleepercdn.com/images/team_logos/nfl/${abbr}.png`;
      }
    }
    const norm = normalizeName(name);
    if (sleeperMap[norm]) {
      return `https://sleepercdn.com/content/nfl/players/thumb/${sleeperMap[norm]}.jpg`;
    }
    return '';
  }

  const rawStatsPath = path.join(rootDir, 'dmsfantasy', 'data', 'weekly_player_stats.json');
  console.log('Reading local weekly_player_stats.json...');
  const localStats = JSON.parse(fs.readFileSync(rawStatsPath, 'utf8'));

  const managersJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'managers.json'), 'utf8'));
  const mgrIdToName = new Map();
  (managersJson.managers || []).forEach(m => {
    if (m.id) {
      mgrIdToName.set(m.id, m.name || m.manager_name || m.id);
    }
  });

  console.log(`Standardizing ${localStats.length} records with nfl_stat_line, nfl_game_result, and headshot_url...`);
  const standardizedStats = localStats.map(st => {
    const yr = Number(st.season || st.year);
    const pos = st.position || st.roster_slot || '';
    const headshot = getHeadshot(st.player_name, pos);

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

  const withHeadshot = standardizedStats.filter(s => s.headshot_url).length;
  const withStats = standardizedStats.filter(s => s.nfl_stat_line).length;
  const withGameRes = standardizedStats.filter(s => s.nfl_game_result).length;
  console.log(`Summary:
  - Total records: ${standardizedStats.length}
  - With headshot_url: ${withHeadshot} (${(withHeadshot/standardizedStats.length*100).toFixed(1)}%)
  - With nfl_stat_line: ${withStats}
  - With nfl_game_result: ${withGameRes}`);

  console.log('Uploading to Firebase RTDB at leagues/dmsfantasy/weekly_player_stats...');
  await putToFirebase('leagues/dmsfantasy/weekly_player_stats', standardizedStats);
  console.log('Patch successfully uploaded to Firebase RTDB!');
}

patchPlayerStats().catch(err => {
  console.error('Fatal error patching stats:', err);
  process.exit(1);
});
