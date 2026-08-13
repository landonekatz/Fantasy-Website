export default async function handler(req, res) {
  const { leagueId, year, s2, swid } = req.query;

  if (!leagueId || !year) {
    return res.status(400).json({ error: 'Missing leagueId or year parameter' });
  }

  const currentSeason = new Date().getFullYear();
  const isCurrent = parseInt(year) === currentSeason;
  
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  };

  if (s2 && swid) {
    headers['Cookie'] = `espn_s2=${s2}; swid=${swid};`;
  }

  let espnUrl = '';
  if (isCurrent) {
    espnUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=mTeam&view=mRoster&view=mMatchup&view=mSettings&view=mStandings&view=mDraftDetail`;
  } else {
    espnUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}?seasonId=${year}&view=mTeam&view=mRoster&view=mMatchup&view=mSettings&view=mStandings&view=mDraftDetail`;
  }

  try {
    const response = await fetch(espnUrl, { headers, redirect: 'manual' });
    if (!response.ok) {
        return res.status(response.status).json({ error: `ESPN API responded with status: ${response.status}` });
    }
    
    const data = await response.json();
    
    // ESPN historical API wraps the season data in an array
    const seasonData = Array.isArray(data) ? data[0] : data;
    
    return res.status(200).json({ year: parseInt(year), data: seasonData });
  } catch (error) {
    console.error('Fetch error:', error);
    return res.status(500).json({ error: 'Failed to proxy ESPN request' });
  }
}
