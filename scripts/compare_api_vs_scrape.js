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
    if (eqIdx !== -1) env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
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
    headers: { 'Authorization': `Basic ${basicAuth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
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

async function api(p) {
  const t = await getAccessToken();
  const sep = p.includes('?') ? '&' : '?';
  const url = `https://fantasysports.yahooapis.com/fantasy/v2/${p}${sep}format=json`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${t}`, 'Accept': 'application/json' }
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return await res.json();
}

async function inspectSeason(leagueKey) {
  console.log(`\n================ INSPECTING LEAGUE KEY: ${leagueKey} ================`);

  // 1. Settings & Scoring
  console.log('\n--- 1. League Settings & Scoring Rules ---');
  const settingsData = await api(`league/${leagueKey}/settings`);
  const settings = settingsData.fantasy_content.league[1].settings[0];
  console.log('Keys in settings:', Object.keys(settings));
  console.log('Roster positions:', JSON.stringify(settings.roster_positions, null, 2));
  console.log('Stat categories count:', settings.stat_categories?.stats?.length);
  console.log('Sample stat modifiers:', JSON.stringify(settings.stat_modifiers?.stats?.slice(0, 5), null, 2));

  // 2. Teams & Managers
  console.log('\n--- 2. Teams & Managers ---');
  const teamsData = await api(`league/${leagueKey}/teams`);
  const teamsObj = teamsData.fantasy_content.league[1].teams;
  const tCount = teamsObj.count;
  const sampleTeam = teamsObj[0].team;
  console.log(`Teams count: ${tCount}`);
  console.log('Sample team structure:', JSON.stringify(sampleTeam, null, 2));

  // 3. Standings
  console.log('\n--- 3. Standings ---');
  const standingsData = await api(`league/${leagueKey}/standings`);
  const sampleStanding = standingsData.fantasy_content.league[1].standings[0].teams[0].team;
  console.log('Sample team standing keys:', Object.keys(sampleStanding));
  console.log('Sample team standing data:', JSON.stringify(sampleStanding[2], null, 2));

  // 4. Scoreboard / Matchups
  console.log('\n--- 4. Scoreboard / Matchups (Week 1) ---');
  const scoreboardData = await api(`league/${leagueKey}/scoreboard;week=1`);
  const matchups = scoreboardData.fantasy_content.league[1].scoreboard[0].matchups;
  console.log(`Week 1 Matchups count: ${matchups.count}`);
  const sampleMatchup = matchups[0].matchup;
  console.log('Sample matchup structure:', JSON.stringify(sampleMatchup, null, 2));

  // 5. Weekly Boxscore / Team Rosters
  console.log('\n--- 5. Team Weekly Roster & Player Stats (Week 1, Team 1) ---');
  const sampleTeamKey = `${leagueKey}.t.1`;
  const rosterData = await api(`team/${sampleTeamKey}/roster;week=1/players/stats`);
  const rosterPlayers = rosterData.fantasy_content.team[1].roster[0].players;
  console.log(`Team 1 Week 1 roster players count: ${rosterPlayers.count}`);
  const samplePlayer = rosterPlayers[0].player;
  console.log('Sample player structure:', JSON.stringify(samplePlayer, null, 2));

  // 6. Draft Results
  console.log('\n--- 6. Draft Results ---');
  const draftData = await api(`league/${leagueKey}/draftresults`);
  const draftResults = draftData.fantasy_content.league[1].draft_results;
  console.log(`Draft results count: ${draftResults.count}`);
  console.log('Sample pick:', JSON.stringify(draftResults[0].draft_result, null, 2));

  // 7. Transactions
  console.log('\n--- 7. Transactions ---');
  const transData = await api(`league/${leagueKey}/transactions`);
  const trans = transData.fantasy_content.league[1].transactions;
  console.log(`Transactions count: ${trans.count}`);
  if (trans.count > 0) {
    console.log('Sample transaction:', JSON.stringify(trans[0].transaction, null, 2));
  }
}

// Inspect 2025 season (NFL 2024, 449.l.80052)
inspectSeason('449.l.80052');
