// api/sleeper.js
// Sleeper League Discovery & Canonical Through-Line Inspector

export default async function handler(req, res) {
  const { action = 'user_leagues', username, userId, leagueId } = req.query;

  try {
    if (action === 'league_preview') {
      if (!leagueId) {
        return res.status(400).json({ error: 'Missing leagueId parameter' });
      }

      const [league, users, rosters, drafts] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/league/${leagueId}`).then(r => r.ok ? r.json() : null),
        fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r => r.ok ? r.json() : []),
        fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r => r.ok ? r.json() : []),
        fetch(`https://api.sleeper.app/v1/league/${leagueId}/drafts`).then(r => r.ok ? r.json() : [])
      ]);

      if (!league) {
        return res.status(404).json({ error: 'Sleeper league not found' });
      }

      const members = (users || []).map(u => {
        const roster = (rosters || []).find(r => r.owner_id === u.user_id);
        const avatarUrl = u.avatar ? (u.avatar.startsWith('http') ? u.avatar : `https://sleepercdn.com/avatars/thumbs/${u.avatar}`) : '';
        return {
          id: u.user_id,
          displayName: u.display_name || u.username,
          username: u.username,
          avatar: avatarUrl,
          teamName: u.metadata?.team_name || (u.display_name ? `${u.display_name}'s Team` : 'Team'),
          rosterId: roster ? roster.roster_id : null,
          isActive: true
        };
      });

      return res.status(200).json({
        leagueId: league.league_id,
        name: league.name,
        season: league.season,
        status: league.status,
        totalRosters: league.total_rosters,
        previousLeagueId: league.previous_league_id || null,
        draftStatus: drafts[0]?.status || 'none',
        members
      });
    }

    if (action === 'user_leagues') {
      let resolvedUserId = userId;
      let userData = null;

      if (!resolvedUserId && username) {
        const cleanUser = username.replace(/^@/, '').trim();
        // Try exact match, lowercase, etc.
        const userRes = await fetch(`https://api.sleeper.app/v1/user/${cleanUser}`);
        if (userRes.ok) {
          userData = await userRes.json();
          if (userData && userData.user_id) {
            resolvedUserId = userData.user_id;
          }
        }
        if (!resolvedUserId && cleanUser.toLowerCase() !== cleanUser) {
          const lowerRes = await fetch(`https://api.sleeper.app/v1/user/${cleanUser.toLowerCase()}`);
          if (lowerRes.ok) {
            userData = await lowerRes.json();
            if (userData && userData.user_id) {
              resolvedUserId = userData.user_id;
            }
          }
        }
      }

      if (!resolvedUserId) {
        return res.status(404).json({ error: `Sleeper user "${username}" not found. Please verify spelling.` });
      }

      if (!userData) {
        userData = await fetch(`https://api.sleeper.app/v1/user/${resolvedUserId}`).then(r => r.ok ? r.json() : null);
      }

      const currentYear = new Date().getFullYear();
      const nflYears = Array.from({ length: 7 }, (_, i) => currentYear - i); // last 7 years

      // Scan all seasons for this user
      const seasonFetches = nflYears.map(yr => 
        fetch(`https://api.sleeper.app/v1/user/${resolvedUserId}/leagues/nfl/${yr}`)
          .then(r => r.ok ? r.json() : [])
          .then(leagues => ({ year: yr, leagues: Array.isArray(leagues) ? leagues : [] }))
          .catch(() => ({ year: yr, leagues: [] }))
      );

      const seasonsResult = await Promise.all(seasonFetches);
      const allFoundLeagues = [];

      for (const s of seasonsResult) {
        for (const l of s.leagues) {
          allFoundLeagues.push({ year: s.year, league: l });
        }
      }

      // Concurrently inspect each candidate league
      const inspectedLeagues = await Promise.all(
        allFoundLeagues.map(async ({ year, league }) => {
          const lId = league.league_id;
          try {
            const [users, rosters, drafts] = await Promise.all([
              fetch(`https://api.sleeper.app/v1/league/${lId}/users`).then(r => r.ok ? r.json() : []).catch(() => []),
              fetch(`https://api.sleeper.app/v1/league/${lId}/rosters`).then(r => r.ok ? r.json() : []).catch(() => []),
              fetch(`https://api.sleeper.app/v1/league/${lId}/drafts`).then(r => r.ok ? r.json() : []).catch(() => [])
            ]);

            const myRoster = (rosters || []).find(r => r.owner_id === resolvedUserId);
            const myUser = (users || []).find(u => u.user_id === resolvedUserId);
            const targetDraft = drafts[0] || {};

            const wins = myRoster?.settings?.wins || 0;
            const losses = myRoster?.settings?.losses || 0;
            const ties = myRoster?.settings?.ties || 0;
            const fpts = ((myRoster?.settings?.fpts || 0) + (myRoster?.settings?.fpts_decimal || 0) / 100);

            let totalMoves = 0;
            let totalLeaguePoints = 0;
            for (const r of (rosters || [])) {
              totalMoves += (r.settings?.total_moves || 0) + (r.settings?.waiver_adjusted || 0);
              totalLeaguePoints += (r.settings?.fpts || 0);
            }

            const draftStatus = targetDraft.status || 'none';
            const draftType = targetDraft.type || 'snake';

            // Identify ghost leagues (auto-renewed leagues that were never actually drafted or played)
            const isGhost = (draftStatus === 'pre_draft' || draftStatus === 'none') &&
              wins === 0 && losses === 0 && ties === 0 && fpts === 0 && totalMoves === 0 && totalLeaguePoints === 0;

            const myTeamName = myUser?.metadata?.team_name || (myUser?.display_name ? `${myUser.display_name}'s Team` : 'My Team');

            return {
              leagueId: String(lId),
              name: league.name || `League ${year}`,
              year: year,
              status: league.status,
              totalRosters: league.total_rosters || 12,
              filledRosters: rosters?.length || 0,
              usersCount: users?.length || 0,
              userMemberIds: (users || []).map(u => u.user_id),
              previousLeagueId: league.previous_league_id || null,
              draftStatus,
              draftType,
              totalMoves,
              myTeamName,
              myRecord: `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`,
              myPoints: Math.round(fpts * 100) / 100,
              isGhost,
              scoringRec: league.scoring_settings?.rec || 0
            };
          } catch (err) {
            return {
              leagueId: String(lId),
              name: league.name || `League ${year}`,
              year: year,
              isGhost: true,
              userMemberIds: []
            };
          }
        })
      );

      // Identify the anchor active league in current year (or latest year with non-ghost leagues)
      const nonGhostLeagues = inspectedLeagues.filter(l => !l.isGhost);
      const latestYear = nonGhostLeagues.length > 0 ? Math.max(...nonGhostLeagues.map(l => l.year)) : currentYear;

      let anchorLeague = null;
      if (req.query.activeLeagueId) {
        anchorLeague = inspectedLeagues.find(l => l.leagueId === req.query.activeLeagueId);
      }
      if (!anchorLeague) {
        const anchorLeagues = nonGhostLeagues.filter(l => l.year === latestYear);
        anchorLeague = anchorLeagues.find(l => l.name.toLowerCase().includes('lamarkable')) || anchorLeagues[0];
      }
      const anchorMemberIds = new Set(anchorLeague?.userMemberIds || []);

      // Calculate member overlap percentages
      for (const l of inspectedLeagues) {
        if (anchorMemberIds.size > 0 && l.userMemberIds?.length > 0) {
          const overlapCount = l.userMemberIds.filter(id => anchorMemberIds.has(id)).length;
          l.memberOverlapPct = Math.round((overlapCount / Math.max(l.userMemberIds.length, anchorMemberIds.size)) * 100);
        } else {
          l.memberOverlapPct = l.year === latestYear ? 100 : 0;
        }
      }

      // Group by year descending
      const yearsMap = new Map();
      for (const l of inspectedLeagues) {
        if (!yearsMap.has(l.year)) yearsMap.set(l.year, []);
        yearsMap.get(l.year).push(l);
      }

      const groupedYears = Array.from(yearsMap.entries())
        .sort((a, b) => b[0] - a[0])
        .filter(([yr, leagues]) => leagues.length > 0)
        .map(([yr, leagues]) => {
          // Sort leagues in this year: non-ghost first, then highest overlap, then most moves
          leagues.sort((a, b) => {
            if (!a.isGhost && b.isGhost) return -1;
            if (a.isGhost && !b.isGhost) return 1;
            if ((b.memberOverlapPct || 0) !== (a.memberOverlapPct || 0)) {
              return (b.memberOverlapPct || 0) - (a.memberOverlapPct || 0);
            }
            return (b.totalMoves || 0) - (a.totalMoves || 0);
          });

          // Mark highest-ranked non-ghost league as recommended
          const best = leagues.find(l => !l.isGhost);
          if (best) best.isRecommended = true;

          return {
            year: yr,
            leagues
          };
        });

      return res.status(200).json({
        user: {
          userId: userData.user_id,
          username: userData.username,
          displayName: userData.display_name,
          avatar: userData.avatar ? (userData.avatar.startsWith('http') ? userData.avatar : `https://sleepercdn.com/avatars/thumbs/${userData.avatar}`) : ''
        },
        years: groupedYears
      });
    }

    return res.status(400).json({ error: `Unknown action "${action}"` });
  } catch (err) {
    console.error('Sleeper API Route Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
