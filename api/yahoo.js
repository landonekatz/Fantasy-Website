import fs from 'fs';
import path from 'path';

// Helper to get Yahoo credentials from process.env or .env.local
function getEnv() {
  const env = {
    YAHOO_APP_ID: process.env.YAHOO_APP_ID || '',
    YAHOO_CLIENT_ID: process.env.YAHOO_CLIENT_ID || '',
    YAHOO_CLIENT_SECRET: process.env.YAHOO_CLIENT_SECRET || '',
    YAHOO_REDIRECT_URI: process.env.YAHOO_REDIRECT_URI || 'https://fantasyvault.vercel.app/api/yahoo/callback',
    YAHOO_REFRESH_TOKEN: process.env.YAHOO_REFRESH_TOKEN || ''
  };

  // If local and process.env is not populated, attempt to read .env.local
  if (!env.YAHOO_CLIENT_ID) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const idx = trimmed.indexOf('=');
          if (idx !== -1) {
            const k = trimmed.substring(0, idx).trim();
            const v = trimmed.substring(idx + 1).trim();
            if (env[k] !== undefined) env[k] = v;
          }
        });
      }
    } catch (e) {}
  }

  return env;
}

/**
 * Exchanges an OAuth 2.0 authorization code for access and refresh tokens.
 */
export async function exchangeCodeForTokens(code, redirectUri) {
  const env = getEnv();
  const basicAuth = Buffer.from(`${env.YAHOO_CLIENT_ID}:${env.YAHOO_CLIENT_SECRET}`).toString('base64');
  const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    redirect_uri: redirectUri || env.YAHOO_REDIRECT_URI,
    code: code
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

  return await res.json();
}

/**
 * Gets a valid access token using a refresh token.
 */
export async function refreshAccessToken(customRefreshToken) {
  const env = getEnv();
  const tokenToUse = customRefreshToken || env.YAHOO_REFRESH_TOKEN;
  if (!tokenToUse) {
    throw new Error('No Yahoo refresh token available.');
  }

  const basicAuth = Buffer.from(`${env.YAHOO_CLIENT_ID}:${env.YAHOO_CLIENT_SECRET}`).toString('base64');
  const tokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    redirect_uri: env.YAHOO_REDIRECT_URI,
    refresh_token: tokenToUse
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
    throw new Error(`Token refresh failed (HTTP ${res.status}): ${errText}`);
  }

  return await res.json();
}

/**
 * Generic Yahoo Fantasy API fetch helper.
 */
export async function fetchYahooApi(endpointPath, accessToken, maxRetries = 2) {
  const sep = endpointPath.includes('?') ? '&' : '?';
  const url = `https://fantasysports.yahooapis.com/fantasy/v2/${endpointPath}${sep}format=json`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 TheFantasyVault/1.0'
        }
      });

      if (res.ok) {
        return await res.json();
      }

      if ((res.status === 999 || res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      const errText = await res.text();
      throw new Error(`Yahoo API error (HTTP ${res.status}): ${errText}`);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.pow(2, attempt + 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Serverless API handler for /api/yahoo
 */
export default async function handler(req, res) {
  const { action, code, redirectUri, refreshToken: customRefreshToken, leagueKey } = req.query;
  const env = getEnv();

  try {
    // 1. Get OAuth Authorization URL
    if (action === 'auth-url') {
      const targetRedirect = redirectUri || env.YAHOO_REDIRECT_URI;
      const authUrl = 'https://api.login.yahoo.com/oauth2/request_auth?' + new URLSearchParams({
        client_id: env.YAHOO_CLIENT_ID,
        redirect_uri: targetRedirect,
        response_type: 'code',
        language: 'en-us'
      }).toString();

      return res.status(200).json({ authUrl, redirectUri: targetRedirect });
    }

    // 2. Exchange authorization code for tokens
    if (action === 'exchange-code') {
      if (!code) return res.status(400).json({ error: 'Missing code parameter' });
      const tokenData = await exchangeCodeForTokens(code, redirectUri);
      return res.status(200).json(tokenData);
    }

    // 3. Refresh Access Token
    if (action === 'refresh-token') {
      const tokenData = await refreshAccessToken(customRefreshToken);
      return res.status(200).json(tokenData);
    }

    // 4. Discover all leagues for authenticated user
    if (action === 'discover-leagues') {
      let tokenToUse = req.headers.authorization?.replace('Bearer ', '');
      if (!tokenToUse) {
        const refreshed = await refreshAccessToken(customRefreshToken);
        tokenToUse = refreshed.access_token;
      }

      // Fetch all NFL game keys
      const gamesData = await fetchYahooApi('games;game_codes=nfl', tokenToUse);
      const games = gamesData?.fantasy_content?.games;
      const gameKeys = [];
      if (games) {
        const count = games.count || Object.keys(games).length;
        for (let i = 0; i < count; i++) {
          const g = games[i]?.game?.[0];
          if (g && parseInt(g.season) >= 2015) {
            gameKeys.push(g.game_key);
          }
        }
      }

      const keysStr = gameKeys.join(',');
      const leaguesData = await fetchYahooApi(`users;use_login=1/games;game_keys=${keysStr}/leagues`, tokenToUse);
      const userGames = leaguesData?.fantasy_content?.users?.[0]?.user?.[1]?.games;
      const discovered = [];

      if (userGames) {
        const gCount = userGames.count || 0;
        for (let i = 0; i < gCount; i++) {
          const g = userGames[i]?.game;
          if (!g) continue;
          const season = g[0].season;
          const lBlock = g[1]?.leagues;
          if (!lBlock) continue;
          const lCount = lBlock.count || 0;
          for (let j = 0; j < lCount; j++) {
            const l = lBlock[j]?.league?.[0];
            if (l) {
              discovered.push({
                season: parseInt(season),
                name: l.name,
                leagueKey: l.league_key,
                leagueId: l.league_id,
                numTeams: l.num_teams,
                isPrivate: !l.is_public
              });
            }
          }
        }
      }

      return res.status(200).json({ leagues: discovered });
    }

    // 5. League Metadata & Members preview (equivalent to /api/espn)
    if (action === 'league-meta' || !action) {
      const targetKey = leagueKey || req.query.leagueId;
      if (!targetKey) return res.status(400).json({ error: 'Missing leagueKey or leagueId parameter' });

      let tokenToUse = req.headers.authorization?.replace('Bearer ', '');
      if (!tokenToUse) {
        const refreshed = await refreshAccessToken(customRefreshToken);
        tokenToUse = refreshed.access_token;
      }

      // Fetch League Settings & Teams
      const [metaData, teamsData] = await Promise.all([
        fetchYahooApi(`league/${targetKey}/settings`, tokenToUse),
        fetchYahooApi(`league/${targetKey}/teams`, tokenToUse)
      ]);

      const leagueInfo = metaData?.fantasy_content?.league?.[0];
      const settings = metaData?.fantasy_content?.league?.[1]?.settings?.[0];
      const teamsObj = teamsData?.fantasy_content?.league?.[1]?.teams;

      const members = [];
      const teams = [];

      if (teamsObj) {
        const tCount = teamsObj.count || 0;
        for (let i = 0; i < tCount; i++) {
          const tArr = teamsObj[i]?.team?.[0];
          if (!tArr) continue;
          const tId = tArr.find(x => x && x.team_id)?.team_id;
          const tName = tArr.find(x => x && x.name)?.name;
          const tLogos = tArr.find(x => x && x.team_logos)?.team_logos;
          const logoUrl = tLogos?.[0]?.team_logo?.url || '';
          const mgrArr = tArr.find(x => x && x.managers)?.managers;
          const mgr = mgrArr?.[0]?.manager;

          teams.push({
            id: tId,
            name: tName,
            logoUrl
          });

          if (mgr) {
            members.push({
              id: mgr.guid || `yahoo_${mgr.manager_id}`,
              displayName: mgr.nickname || tName,
              alias: mgr.nickname || tName,
              avatar: mgr.image_url || '',
              teamId: tId,
              isActive: true
            });
          }
        }
      }

      return res.status(200).json({
        leagueName: leagueInfo?.name || 'Yahoo League',
        season: parseInt(leagueInfo?.season || 2026),
        numTeams: leagueInfo?.num_teams || teams.length,
        scoringType: settings?.scoring_type || 'head',
        teams,
        members
      });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    console.error('Yahoo API Handler Error:', err);
    return res.status(500).json({ error: err.message || 'Yahoo API request failed' });
  }
}
