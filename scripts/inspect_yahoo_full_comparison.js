import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env.local');

function loadEnv() {
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
const CLIENT_ID = env.YAHOO_CLIENT_ID;
const CLIENT_SECRET = env.YAHOO_CLIENT_SECRET;
let token = env.YAHOO_ACCESS_TOKEN;
const refreshToken = env.YAHOO_REFRESH_TOKEN;

async function getAccessToken() {
  const testRes = await fetch('https://fantasysports.yahooapis.com/fantasy/v2/game/nfl?format=json', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (testRes.ok) return token;

  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      redirect_uri: env.YAHOO_REDIRECT_URI,
      refresh_token: refreshToken
    }).toString()
  });
  const data = await res.json();
  token = data.access_token;
  return token;
}

async function api(path) {
  const t = await getAccessToken();
  const sep = path.includes('?') ? '&' : '?';
  const url = `https://fantasysports.yahooapis.com/fantasy/v2/${path}${sep}format=json`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${t}`, 'Accept': 'application/json' }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API error ${res.status} for ${path}: ${txt}`);
  }
  return await res.json();
}

async function run() {
  console.log('--- 1. Mapping NFL Game Keys to Seasons ---');
  const gamesData = await api('games;game_codes=nfl');
  const games = gamesData.fantasy_content.games;
  const gameMap = {};
  const count = games.count || Object.keys(games).length;
  for (let i = 0; i < count; i++) {
    const g = games[i]?.game?.[0];
    if (g) {
      gameMap[g.season] = g.game_key;
    }
  }
  console.log('Recent seasons game keys:');
  [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026].forEach(yr => {
    console.log(`  ${yr}: ${gameMap[yr]}`);
  });

  // Config mapping from scraper/config.py
  // Note: Yahoo URLs: /2024/f1/80052 means season 2024!
  const dumbartonSeasons = [
    { nameSeason: 2027, nflSeason: 2026, leagueId: '52841' },
    { nameSeason: 2026, nflSeason: 2025, leagueId: '42542' },
    { nameSeason: 2025, nflSeason: 2024, leagueId: '80052' },
    { nameSeason: 2024, nflSeason: 2023, leagueId: '30266' },
    { nameSeason: 2023, nflSeason: 2022, leagueId: '873470' },
    { nameSeason: 2022, nflSeason: 2021, leagueId: '818216' },
    { nameSeason: 2021, nflSeason: 2020, leagueId: '941578' },
    { nameSeason: 2020, nflSeason: 2019, leagueId: '978070' },
    { nameSeason: 2019, nflSeason: 2018, leagueId: '1168960' },
    { nameSeason: 2018, nflSeason: 2017, leagueId: '862430' }
  ];

  console.log('\n--- 2. Testing Access to Every Single Dumbarton Historical Season ---');
  for (const s of dumbartonSeasons) {
    const gk = gameMap[s.nflSeason];
    const lKey = `${gk}.l.${s.leagueId}`;
    try {
      const lData = await api(`league/${lKey}/standings`);
      const league = lData.fantasy_content.league[0];
      const teams = lData.fantasy_content.league[1].standings[0].teams;
      console.log(`✓ [${s.nameSeason} Season (NFL ${s.nflSeason})] Key: ${lKey} -> "${league.name}" (${teams.count || Object.keys(teams).length} Teams)`);
    } catch (e) {
      console.log(`✗ [${s.nameSeason} Season (NFL ${s.nflSeason})] Key: ${lKey} -> ERROR: ${e.message}`);
    }
  }

  console.log('\n--- 3. Querying All User Leagues Across All Game Keys ---');
  const allGameKeys = Object.values(gameMap).filter(k => parseInt(k) >= 371).join(',');
  const allUserLeagues = await api(`users;use_login=1/games;game_keys=${allGameKeys}/leagues`);
  const userGames = allUserLeagues.fantasy_content.users[0].user[1].games;
  const ugCount = userGames.count || 0;
  console.log(`Discovered user games across history: ${ugCount}`);
  for (let i = 0; i < ugCount; i++) {
    const g = userGames[i]?.game;
    if (!g) continue;
    const season = g[0].season;
    const leagues = g[1]?.leagues;
    if (leagues) {
      const lCount = leagues.count || 0;
      for (let j = 0; j < lCount; j++) {
        const l = leagues[j]?.league?.[0];
        if (l) {
          console.log(`  NFL ${season}: "${l.name}" (Key: ${l.league_key}, ID: ${l.league_id})`);
        }
      }
    }
  }
}
run();
