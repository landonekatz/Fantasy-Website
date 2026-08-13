export default async function handler(req, res) {
  const { leagueId, s2, swid } = req.query;

  if (!leagueId) {
    return res.status(400).json({ error: 'Missing leagueId parameter' });
  }

  // Use recent season to fetch league info
  const season = new Date().getFullYear();
  const espnUrl = `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mTeam`;

  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  };

  if (s2 && swid) {
    headers['Cookie'] = `espn_s2=${s2}; swid=${swid};`;
  }

  try {
    const response = await fetch(espnUrl, { headers });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 404) {
        return res.status(response.status).json({ error: 'Invalid League ID or unauthorized. Check your cookies if the league is private.' });
      }
      return res.status(response.status).json({ error: `ESPN API returned status ${response.status}` });
    }

    const data = await response.json();

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
    return res.status(500).json({ error: 'Internal Server Error while fetching from ESPN' });
  }
}
