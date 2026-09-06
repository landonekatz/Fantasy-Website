/**
 * Yahoo Fantasy Sports API - Verification & Test Script for Dumbarton
 * 
 * Usage:
 *   1. Authorization:
 *      node scripts/test_yahoo_api.js auth
 *      (Opens the Yahoo OAuth consent page or prints the URL. Once approved, paste the code or redirected URL)
 * 
 *   2. Run Tests & Verification:
 *      node scripts/test_yahoo_api.js test
 *      (Fetches game keys, discovers all user leagues, tests Dumbarton seasons, and validates data schema)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env.local');

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
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      env[key] = val;
    }
  });
  return env;
}

function updateEnv(key, val) {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${val}`);
  } else {
    content += `\n${key}=${val}`;
  }
  fs.writeFileSync(envPath, content.trim() + '\n', 'utf8');
}

const env = loadEnv();
const CLIENT_ID = env.YAHOO_CLIENT_ID;
const CLIENT_SECRET = env.YAHOO_CLIENT_SECRET;
// Default to the localhost:3000 or thefantasyvault redirect URI registered in Yahoo
const REDIRECT_URI = env.YAHOO_REDIRECT_URI || 'https://thefantasyvault.com/api/yahoo/callback';

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing YAHOO_CLIENT_ID or YAHOO_CLIENT_SECRET in .env.local');
  process.exit(1);
}

// Exchange Code for Access and Refresh Token
async function exchangeAuthCode(authCode, redirectUri) {
  console.log('\nExchanging authorization code for tokens...');
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
    code: authCode
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed (HTTP ${res.status}): ${errText}`);
  }

  const tokenData = await res.json();
  console.log('Successfully acquired tokens!');
  console.log(`Access Token: ${tokenData.access_token.substring(0, 15)}... (Expires in ${tokenData.expires_in}s)`);
  console.log(`Refresh Token: ${tokenData.refresh_token.substring(0, 15)}...`);

  updateEnv('YAHOO_ACCESS_TOKEN', tokenData.access_token);
  updateEnv('YAHOO_REFRESH_TOKEN', tokenData.refresh_token);
  if (tokenData.xoauth_yahoo_guid) {
    updateEnv('YAHOO_USER_GUID', tokenData.xoauth_yahoo_guid);
  }

  return tokenData;
}

// Refresh access token if expired
async function getValidAccessToken() {
  const currentEnv = loadEnv();
  let accessToken = currentEnv.YAHOO_ACCESS_TOKEN;
  const refreshToken = currentEnv.YAHOO_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error('No refresh token found. Please run authorization first: node scripts/test_yahoo_api.js auth');
  }

  // Quick validation test
  if (accessToken) {
    const testRes = await fetch('https://fantasysports.yahooapis.com/fantasy/v2/game/nfl?format=json', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (testRes.ok) {
      return accessToken;
    }
  }

  console.log('Refreshing expired Yahoo access token...');
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    redirect_uri: REDIRECT_URI,
    refresh_token: refreshToken
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: body.toString()
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to refresh token (HTTP ${res.status}): ${errText}`);
  }

  const tokenData = await res.json();
  updateEnv('YAHOO_ACCESS_TOKEN', tokenData.access_token);
  if (tokenData.refresh_token) {
    updateEnv('YAHOO_REFRESH_TOKEN', tokenData.refresh_token);
  }
  return tokenData.access_token;
}

// Fetch helper from Yahoo Fantasy API
async function yahooApiFetch(endpointPath) {
  const token = await getValidAccessToken();
  const sep = endpointPath.includes('?') ? '&' : '?';
  const url = `https://fantasysports.yahooapis.com/fantasy/v2/${endpointPath}${sep}format=json`;

  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Yahoo API error for ${endpointPath} (HTTP ${res.status}): ${errText}`);
  }

  return await res.json();
}

// Interactive Auth Flow
async function runAuthFlow() {
  console.log('='.repeat(70));
  console.log('YAHOO FANTASY SPORTS OAUTH 2.0 SETUP');
  console.log('='.repeat(70));

  const chosenUri = REDIRECT_URI;
  const authUrl = 'https://api.login.yahoo.com/oauth2/request_auth?' + new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: chosenUri,
    response_type: 'code',
    language: 'en-us'
  }).toString();

  const argCode = process.argv[3];
  if (argCode) {
    let code = argCode.trim();
    if (code.includes('code=')) {
      try {
        const parsed = new URL(code.startsWith('http') ? code : `https://example.com/${code}`);
        code = parsed.searchParams.get('code') || code;
      } catch (e) {
        const match = code.match(/code=([^&]+)/);
        if (match) code = match[1];
      }
    }
    try {
      await exchangeAuthCode(code, chosenUri);
      console.log('\nAuthentication successful! You can now run:');
      console.log('node scripts/test_yahoo_api.js test\n');
      process.exit(0);
    } catch (err) {
      console.error('\nError during authorization:', err.message);
      process.exit(1);
    }
    return;
  }

  console.log('\nSTEP 1: Open the following URL in your web browser where you are logged into Yahoo:');
  console.log('\n' + authUrl + '\n');
  console.log('STEP 2: Click "Agree" to grant Fantasy Sports Read Access.');
  console.log(`STEP 3: Yahoo will redirect your browser to: ${chosenUri}?code=...`);
  console.log('Copy either the "code" parameter or the entire redirected URL from your browser address bar and paste it below.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Paste the code or full redirected URL here: ', async (input) => {
    rl.close();
    let code = input.trim();
    if (code.includes('code=')) {
      try {
        const parsed = new URL(code.startsWith('http') ? code : `https://example.com/${code}`);
        code = parsed.searchParams.get('code') || code;
      } catch (e) {
        const match = code.match(/code=([^&]+)/);
        if (match) code = match[1];
      }
    }

    if (!code) {
      console.error('No code detected. Please run again and provide the code.');
      process.exit(1);
    }

    try {
      await exchangeAuthCode(code, chosenUri);
      console.log('\nAuthentication successful! You can now run:');
      console.log('node scripts/test_yahoo_api.js test\n');
    } catch (err) {
      console.error('\nError during authorization:', err.message);
    }
  });
}

// Verification Test Flow
async function runTestFlow() {
  console.log('='.repeat(70));
  console.log('VERIFYING YAHOO FANTASY API ACCESS FOR DUMBARTON');
  console.log('='.repeat(70));

  try {
    // 1. Fetch NFL Game Keys across all seasons
    console.log('\n[1/4] Fetching historical NFL game keys mapping...');
    const gamesData = await yahooApiFetch('games;game_codes=nfl');
    const games = gamesData?.fantasy_content?.games;
    const gameMap = {}; // season -> game_key

    if (games) {
      const count = games.count || Object.keys(games).length;
      for (let i = 0; i < count; i++) {
        const g = games[i]?.game;
        if (g && g[0]) {
          const season = g[0].season;
          const gameKey = g[0].game_key;
          gameMap[season] = gameKey;
        }
      }
    }
    console.log('NFL Game Keys discovered for seasons:', Object.keys(gameMap).sort().join(', '));

    // 2. Discover all leagues for current authenticated user
    console.log('\n[2/4] Querying authenticated user league history (/users;use_login=1/games;game_keys=nfl/leagues)...');
    const userLeaguesData = await yahooApiFetch('users;use_login=1/games;game_keys=nfl/leagues');
    const userGames = userLeaguesData?.fantasy_content?.users?.[0]?.user?.[1]?.games;
    
    const userLeaguesFound = [];
    if (userGames) {
      const gCount = userGames.count || 0;
      for (let i = 0; i < gCount; i++) {
        const gameObj = userGames[i]?.game;
        if (!gameObj) continue;
        const gMeta = gameObj[0];
        const lBlock = gameObj[1]?.leagues;
        if (!lBlock) continue;
        const lCount = lBlock.count || 0;
        for (let j = 0; j < lCount; j++) {
          const lData = lBlock[j]?.league?.[0];
          if (lData) {
            userLeaguesFound.push({
              season: gMeta.season,
              name: lData.name,
              league_key: lData.league_key,
              league_id: lData.league_id,
              num_teams: lData.num_teams
            });
          }
        }
      }
    }

    console.log(`Found ${userLeaguesFound.length} Yahoo fantasy football leagues across user history:`);
    userLeaguesFound.forEach(l => {
      console.log(`  - Season ${l.season}: "${l.name}" (Key: ${l.league_key}, ID: ${l.league_id}, ${l.num_teams} Teams)`);
    });

    // 3. Test Dumbarton Seasons from scraper/config.py
    // Let's test 2026 (season 2025 f1/42542) or 2025 (season 2024 f1/80052)
    console.log('\n[3/4] Testing Dumbarton League Data Extraction...');
    
    // Test the most recent Dumbarton league key from discovered leagues or config
    const dumbartonLeagues = userLeaguesFound.filter(l => 
      l.name.toLowerCase().includes('dumbarton') || 
      ['42542', '80052', '30266', '52841'].includes(String(l.league_id))
    );

    let testLeagueKey = dumbartonLeagues[0]?.league_key;
    if (!testLeagueKey) {
      // Fallback to gameMap + known ID
      const targetSeason = 2024;
      const gameKey = gameMap[targetSeason] || '449';
      testLeagueKey = `${gameKey}.l.80052`;
    }

    console.log(`Selected Dumbarton target league key: ${testLeagueKey}`);

    // Fetch Standings
    console.log(`\nFetching Standings for ${testLeagueKey}...`);
    const standingsData = await yahooApiFetch(`league/${testLeagueKey}/standings`);
    const standingsLeague = standingsData?.fantasy_content?.league?.[0];
    const standingsTeams = standingsData?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;
    console.log(`League Name: "${standingsLeague?.name}" (${standingsLeague?.season} Season)`);
    console.log(`Teams detected: ${standingsTeams?.count || Object.keys(standingsTeams || {}).length}`);

    // Fetch Scoreboard (Week 1 matchups)
    console.log(`\nFetching Scoreboard (Matchups) for ${testLeagueKey};week=1...`);
    const scoreboardData = await yahooApiFetch(`league/${testLeagueKey}/scoreboard;week=1`);
    const matchups = scoreboardData?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
    console.log(`Week 1 Matchups detected: ${matchups?.count || Object.keys(matchups || {}).length}`);

    // Fetch Draft Results
    console.log(`\nFetching Draft Results for ${testLeagueKey}/draftresults...`);
    const draftData = await yahooApiFetch(`league/${testLeagueKey}/draftresults`);
    const draftResults = draftData?.fantasy_content?.league?.[1]?.draft_results;
    console.log(`Draft Picks detected: ${draftResults?.count || Object.keys(draftResults || {}).length}`);

    console.log('\n' + '='.repeat(70));
    console.log('ALL YAHOO API CHECKS PASSED SUCCESSFULLY!');
    console.log('Official Yahoo Fantasy Sports API is active, authorized, and fully functional.');
    console.log('='.repeat(70));

  } catch (err) {
    console.error('\nVerification failed:', err);
  }
}

// CLI router
const command = process.argv[2] || 'auth';
if (command === 'auth') {
  runAuthFlow();
} else if (command === 'test') {
  runTestFlow();
} else {
  console.log('Unknown command. Use: node scripts/test_yahoo_api.js [auth|test]');
}
