export default async function handler(req, res) {
  const { leagueId, s2, swid } = req.query;

  if (!leagueId) {
    return res.status(400).json({ error: 'Missing leagueId parameter' });
  }

  // Use recent season to fetch league info
  const currentSeason = new Date().getFullYear();
  let season = currentSeason;
  
  let response;
  let success = false;
  
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  };

  if (s2 && swid) {
    headers['Cookie'] = `espn_s2=${s2}; swid=${swid};`;
  }
  
  // Try current season first, then fallback to previous season
  for (let s of [currentSeason, currentSeason - 1]) {
    season = s;
    const espnUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mTeam`;
    try {
      response = await fetch(espnUrl, { 
        headers,
        redirect: 'manual' // Prevent fetch from following ESPN's 302 redirect
      });
      
      // If we get a 200 OK, break out of loop!
      if (response.ok) {
        success = true;
        break;
      }
    } catch (e) {
      console.error(`Fetch failed for season ${season}:`, e);
    }
  }

  try {
    if (!success) {
      // If both failed, we likely have an auth issue or invalid league ID
      if (response && (response.status === 302 || response.status === 401 || response.status === 404)) {
        return res.status(401).json({ error: 'Unauthorized or League Not Found. Please check your League ID and ensure your s2 and swid cookies are correct and not expired.' });
      }
      return res.status(response ? response.status : 500).json({ error: `ESPN API returned status ${response ? response.status : 'unknown'}` });
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      return res.status(500).json({ error: 'Received invalid data format from ESPN. The league might not be active for the current season.' });
    }

    // Extract minimal necessary data to prevent sending massive JSON payloads to the frontend
    const teams = data.teams ? data.teams.map(t => ({
      id: t.id,
      name: t.name || `${t.location || ''} ${t.nickname || ''}`.trim(),
      abbrev: t.abbrev,
      primaryOwner: t.primaryOwner
    })) : [];

    const members = data.members ? data.members.map(m => ({
      id: m.id,
      displayName: m.displayName,
      firstName: m.firstName,
      lastName: m.lastName
    })) : [];

    return res.status(200).json({ teams, members, season });
  } catch (err) {
    console.error('ESPN API Fetch Error:', err);
    return res.status(500).json({ error: 'Internal Server Error while connecting to ESPN. Please try again.' });
  }
}
