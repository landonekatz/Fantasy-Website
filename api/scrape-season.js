export default async function handler(req, res) {
  const { leagueId, year, s2, swid, checkOnly } = req.query;

  if (!leagueId || !year) {
    return res.status(400).json({ error: 'Missing leagueId or year parameter' });
  }

  const yr = parseInt(year);
  
  const headers = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  };

  if (s2 && swid) {
    headers['Cookie'] = `espn_s2=${s2}; swid=${swid};`;
  }

  // 1. Check-only mode for year discovery
  if (checkOnly === 'true') {
    const urlsToTry = [
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=mStatus`,
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}?seasonId=${year}&view=mStatus`
    ];
    for (const u of urlsToTry) {
      try {
        const r = await fetch(u, { headers, redirect: 'manual' });
        if (r.ok) {
          const d = await r.json();
          return res.status(200).json({ year: yr, data: Array.isArray(d) ? d[0] : d });
        }
      } catch (e) {}
    }
    return res.status(404).json({ error: `Season ${year} not found` });
  }

  // 2. Full season scrape (Teams, Rosters, Matchups, Settings, Standings, Draft, Transactions)
  const views = '?view=mTeam&view=mRoster&view=mMatchup&view=mSettings&view=mStandings&view=mDraftDetail&view=mTransactions2';
  const urlsToTry = [
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}${views}`,
    `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/leagueHistory/${leagueId}?seasonId=${year}&${views.substring(1)}`
  ];

  let seasonData = null;
  for (const u of urlsToTry) {
    try {
      const r = await fetch(u, { headers, redirect: 'manual' });
      if (r.ok) {
        const d = await r.json();
        seasonData = Array.isArray(d) ? d[0] : d;
        if (seasonData) break;
      }
    } catch (e) {}
  }

  if (!seasonData) {
    return res.status(404).json({ error: `Failed to fetch season data for ${year}` });
  }

  // 3. For 2018+, fetch weekly player-level boxscores to capture starting lineups, bench, projections, and stat lines
  if (yr >= 2018 && seasonData.schedule && seasonData.schedule.length > 0) {
    const periodCount = seasonData.settings?.scheduleSettings?.matchupPeriodCount || 17;
    const maxWeeks = Math.min(Math.max(periodCount, 14), 18);
    const weekNums = Array.from({ length: maxWeeks }, (_, i) => i + 1);

    const boxPromises = weekNums.map(async (w) => {
      const boxUrl = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${year}/segments/0/leagues/${leagueId}?view=mBoxscore&scoringPeriodId=${w}`;
      try {
        const boxRes = await fetch(boxUrl, { headers, redirect: 'manual' });
        if (boxRes.ok) {
          const bData = await boxRes.json();
          return { week: w, data: bData };
        }
      } catch (e) {}
      return null;
    });

    const boxResults = await Promise.all(boxPromises);

    for (const bRes of boxResults) {
      if (!bRes || !bRes.data || !Array.isArray(bRes.data.schedule)) continue;
      const bSched = bRes.data.schedule;
      
      if (!seasonData.settings?.scoringSettings && bRes.data.settings?.scoringSettings) {
        seasonData.settings = bRes.data.settings;
      }

      for (const bGame of bSched) {
        if (!bGame.home?.rosterForCurrentScoringPeriod?.entries && !bGame.away?.rosterForCurrentScoringPeriod?.entries) continue;
        
        const targetGame = seasonData.schedule.find(g => 
          (g.id && bGame.id && g.id === bGame.id) ||
          (g.matchupPeriodId === bGame.matchupPeriodId && 
           g.home?.teamId === bGame.home?.teamId && 
           g.away?.teamId === bGame.away?.teamId)
        );

        if (targetGame) {
          if (bGame.home?.rosterForCurrentScoringPeriod) targetGame.home.rosterForCurrentScoringPeriod = bGame.home.rosterForCurrentScoringPeriod;
          if (bGame.away?.rosterForCurrentScoringPeriod) targetGame.away.rosterForCurrentScoringPeriod = bGame.away.rosterForCurrentScoringPeriod;
          if (bGame.home?.rosterForMatchupPeriod) targetGame.home.rosterForMatchupPeriod = bGame.home.rosterForMatchupPeriod;
          if (bGame.away?.rosterForMatchupPeriod) targetGame.away.rosterForMatchupPeriod = bGame.away.rosterForMatchupPeriod;
        }
      }
    }
  }

  return res.status(200).json({ year: yr, data: seasonData });
}
