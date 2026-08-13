export default async function handler(req, res) {
  const { leagueId, s2, swid } = req.query;

  if (!leagueId) {
    return res.status(400).json({ error: 'Missing leagueId parameter' });
  }

  const currentSeason = new Date().getFullYear();
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  };

  if (s2 && swid) {
    headers['Cookie'] = `espn_s2=${s2}; swid=${swid};`;
  }

  // We want to fetch all seasons back to roughly 2008 (ESPN's historical limit is often around there)
  // But to be safe and fast, let's grab the last 15 years.
  const years = Array.from({ length: 15 }, (_, i) => currentSeason - i);
  
  try {
    const fetchPromises = years.map(year => {
      const espnUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=mTeam`;
      return fetch(espnUrl, { headers, redirect: 'manual' })
        .then(async response => {
          if (!response.ok) {
            return { year, ok: false, status: response.status };
          }
          const data = await response.json();
          return { year, ok: true, data };
        })
        .catch(err => ({ year, ok: false, error: err }));
    });

    const results = await Promise.allSettled(fetchPromises);
    
    const successfulSeasons = results
      .filter(r => r.status === 'fulfilled' && r.value.ok)
      .map(r => r.value)
      .sort((a, b) => b.year - a.year); // Sort descending

    if (successfulSeasons.length === 0) {
      // Check if any failed with 401/404/302 (Auth or not found)
      const authFailed = results.some(r => r.status === 'fulfilled' && !r.value.ok && [302, 401, 404].includes(r.value.status));
      if (authFailed) {
        return res.status(401).json({ error: 'Unauthorized or League Not Found. Please check your League ID and ensure your s2 and swid cookies are correct and not expired.' });
      }
      return res.status(500).json({ error: 'Failed to fetch any historical seasons from ESPN.' });
    }

    // The most recent successful season defines our "Active" members
    const mostRecentSeason = successfulSeasons[0];
    const activeMemberIds = new Set(
      mostRecentSeason.data.members ? mostRecentSeason.data.members.map(m => m.id) : []
    );

    // Aggregate all unique managers across all time
    const allMembersMap = new Map(); // id -> manager
    
    for (const seasonObj of successfulSeasons) {
      if (seasonObj.data.members) {
        for (const m of seasonObj.data.members) {
          const first = m.firstName ? m.firstName.trim() : '';
          const last = m.lastName ? m.lastName.trim() : '';
          
          let primaryId = m.id;
          if (!allMembersMap.has(primaryId)) {
            allMembersMap.set(primaryId, {
              id: primaryId,
              displayName: m.displayName || 'Unknown',
              firstName: first,
              lastName: last,
              isActive: activeMemberIds.has(m.id),
              lastSeenYear: seasonObj.year,
              espn_ids: [m.id]
            });
          } else {
            const existing = allMembersMap.get(primaryId);
            if (activeMemberIds.has(m.id)) {
                existing.isActive = true;
            }
            if (seasonObj.year > existing.lastSeenYear) {
              existing.lastSeenYear = seasonObj.year;
            }
          }
        }
      }
    }

    // Grab teams from the most recent season just in case the UI needs them
    const teams = mostRecentSeason.data.teams ? mostRecentSeason.data.teams.map(t => ({
      id: t.id,
      name: t.name || `${t.location || ''} ${t.nickname || ''}`.trim(),
      abbrev: t.abbrev,
      primaryOwner: t.primaryOwner
    })) : [];

    const members = Array.from(allMembersMap.values())
      .sort((a, b) => {
        // Sort active members first, then by lastSeenYear descending
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return b.lastSeenYear - a.lastSeenYear;
      });

    return res.status(200).json({ 
      teams, 
      members, 
      activeSeason: mostRecentSeason.year,
      totalSeasonsFound: successfulSeasons.length
    });

  } catch (err) {
    console.error('ESPN API Fetch Error:', err);
    return res.status(500).json({ error: 'Internal Server Error while connecting to ESPN. Please try again.' });
  }
}
