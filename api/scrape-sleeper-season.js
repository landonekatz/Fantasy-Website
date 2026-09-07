// api/scrape-sleeper-season.js
// Normalizes Sleeper Fantasy seasonal data into the standardized The Fantasy Vault schema.

let cachedSleeperPlayers = null;
const cachedProjections = new Map();

/**
 * Fetch and cache the global Sleeper NFL players dictionary.
 */
async function getSleeperPlayers() {
  if (cachedSleeperPlayers) return cachedSleeperPlayers;
  try {
    const res = await fetch('https://api.sleeper.app/v1/players/nfl');
    if (res.ok) {
      cachedSleeperPlayers = await res.json();
      return cachedSleeperPlayers;
    }
  } catch (e) {
    console.warn('Failed to load Sleeper players directory:', e.message);
  }
  return {};
}

/**
 * Fetch and cache weekly NFL player projections.
 */
async function getWeeklyProjections(year, week) {
  const key = `${year}_${week}`;
  if (cachedProjections.has(key)) return cachedProjections.get(key);
  try {
    const res = await fetch(`https://api.sleeper.app/v1/projections/nfl/regular/${year}/${week}`);
    if (res.ok) {
      const data = await res.json();
      cachedProjections.set(key, data || {});
      return data || {};
    }
  } catch (e) {
    console.warn(`Failed to load Sleeper projections for ${year} week ${week}:`, e.message);
  }
  cachedProjections.set(key, {});
  return {};
}

/**
 * Fetches and normalizes a single season of a Sleeper league.
 */
export async function fetchSleeperSeasonData({ leagueId, year }) {
  if (!leagueId) {
    throw new Error('Missing leagueId parameter');
  }

  // 1. Fetch core league metadata, users, rosters, drafts, and brackets concurrently
  const [leagueRes, usersRes, rostersRes, draftsRes, winnersBracketRes, losersBracketRes, sleeperPlayers] = await Promise.all([
    fetch(`https://api.sleeper.app/v1/league/${leagueId}`).then(r => r.ok ? r.json() : null),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then(r => r.ok ? r.json() : []),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then(r => r.ok ? r.json() : []),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/drafts`).then(r => r.ok ? r.json() : []),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/winners_bracket`).then(r => r.ok ? r.json() : []),
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/losers_bracket`).then(r => r.ok ? r.json() : []),
    getSleeperPlayers()
  ]);

  if (!leagueRes) {
    throw new Error(`Sleeper league ${leagueId} not found`);
  }

  const seasonYear = parseInt(year || leagueRes.season || new Date().getFullYear(), 10);
  const totalRosters = leagueRes.total_rosters || rostersRes.length || 12;
  const playoffStartWeek = leagueRes.settings?.playoff_week_start || 15;
  const regularSeasonWeeks = playoffStartWeek - 1;
  const playoffTeamsCount = leagueRes.settings?.playoff_teams || 6;
  const totalWeeks = Math.min(Math.max(playoffStartWeek + 2, 14), 18);

  // 2. Map Users & Managers
  const usersMap = new Map();
  for (const u of (usersRes || [])) {
    usersMap.set(u.user_id, u);
  }

  // Determine if the season is actually complete via Sleeper's league status field.
  // Possible values: 'pre_draft', 'drafting', 'in_season', 'post_season', 'complete'.
  const leagueStatus = leagueRes.status || 'unknown';
  const isSeasonComplete = leagueStatus === 'complete';

  // Build playoff placements from bracket — ONLY when the championship game has a resolved winner.
  // Never fall back to sort-order index: that would fabricate a champion for an unplayed season.
  const teamPlacements = new Map(); // roster_id -> final_rank
  let bracketIsResolved = false;
  if (Array.isArray(winnersBracketRes)) {
    for (const m of winnersBracketRes) {
      if (m.p === 1) {
        // Championship game — only record if there's an actual winner
        if (m.w) { teamPlacements.set(m.w, 1); bracketIsResolved = true; }
        if (m.l) teamPlacements.set(m.l, 2);
      } else if (m.p === 3) {
        if (m.w) teamPlacements.set(m.w, 3);
        if (m.l) teamPlacements.set(m.l, 4);
      } else if (m.p === 5) {
        if (m.w) teamPlacements.set(m.w, 5);
        if (m.l) teamPlacements.set(m.l, 6);
      }
    }
  }

  const members = [];
  const teams = [];

  // Sort rosters by wins / points if not placed by bracket
  const sortedRosters = [...(rostersRes || [])].sort((a, b) => {
    const aWins = a.settings?.wins || 0;
    const bWins = b.settings?.wins || 0;
    if (bWins !== aWins) return bWins - aWins;
    const aPts = (a.settings?.fpts || 0) + (a.settings?.fpts_decimal || 0) / 100;
    const bPts = (b.settings?.fpts || 0) + (b.settings?.fpts_decimal || 0) / 100;
    return bPts - aPts;
  });

  sortedRosters.forEach((roster, idx) => {
    const rosterId = roster.roster_id;
    const ownerId = roster.owner_id;
    const user = usersMap.get(ownerId) || {};
    const teamMeta = user.metadata || {};

    let displayName = user.display_name || user.username || `Manager ${rosterId}`;
    let teamName = teamMeta.team_name || (user.display_name ? `${user.display_name}${user.display_name.endsWith('s') ? "'" : "'s"} Team` : `Team ${rosterId}`);
    
    // Avatar
    let avatarUrl = '';
    if (user.avatar) {
      avatarUrl = user.avatar.startsWith('http') ? user.avatar : `https://sleepercdn.com/avatars/thumbs/${user.avatar}`;
    }
    const logoUrl = teamMeta.avatar ? (teamMeta.avatar.startsWith('http') ? teamMeta.avatar : `https://sleepercdn.com/avatars/thumbs/${teamMeta.avatar}`) : avatarUrl;

    const wins = roster.settings?.wins || 0;
    const losses = roster.settings?.losses || 0;
    const ties = roster.settings?.ties || 0;
    const pointsFor = Math.round(((roster.settings?.fpts || 0) + (roster.settings?.fpts_decimal || 0) / 100) * 100) / 100;
    const pointsAgainst = Math.round(((roster.settings?.fpts_against || 0) + (roster.settings?.fpts_against_decimal || 0) / 100) * 100) / 100;
    const waiverBudgetUsed = roster.settings?.waiver_budget_used || 0;
    const totalMoves = roster.settings?.total_moves || 0;

    const memberId = ownerId ? String(ownerId) : `sleeper_roster_${rosterId}`;
    // Only assign a final rank when the bracket has a resolved champion.
    // For pre-season or in-progress leagues, leave rankFinal as null so no phantom
    // champion or loser is shown in the vault.
    const finalRank = bracketIsResolved ? (teamPlacements.get(rosterId) || null) : null;

    members.push({
      id: memberId,
      displayName: displayName,
      alias: displayName,
      avatar: avatarUrl,
      logo_url: logoUrl,
      teamId: rosterId,
      isActive: true
    });

    teams.push({
      id: rosterId,
      name: teamName,
      logoUrl: logoUrl,
      primaryOwner: memberId,
      playoffSeed: idx + 1,
      rankCalculatedFinal: finalRank,
      rankFinal: finalRank,
      record: {
        overall: {
          wins,
          losses,
          ties,
          pointsFor,
          pointsAgainst
        }
      },
      transactionCounter: {
        acquisitions: totalMoves,
        trades: 0
      },
      made_playoffs: (idx + 1) <= playoffTeamsCount || (finalRank <= playoffTeamsCount)
    });
  });

  // 3. Fetch Matchups and Projections across all weeks
  const weekNumbers = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const weekDataPromises = weekNumbers.map(w => 
    Promise.all([
      fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${w}`).then(r => r.ok ? r.json() : []),
      getWeeklyProjections(seasonYear, w)
    ]).catch(e => {
      console.warn(`Error fetching week ${w} for league ${leagueId}:`, e.message);
      return [[], {}];
    })
  );

  // Build the ordered list of non-BN starter slot labels from the league's roster_positions.
  // In Sleeper, starters[i] corresponds to rosterPositions[i] (BN/IR slots are excluded from starters).
  const leagueRosterPositions = leagueRes.roster_positions || [];
  const starterSlotLabels = leagueRosterPositions.filter(pos => pos !== 'BN' && pos !== 'IR' && pos !== 'TAXI');

  const weekResults = await Promise.all(weekDataPromises);
  const schedule = [];
  const isPpr = (leagueRes.scoring_settings?.rec || 0) >= 0.75;
  const isHalfPpr = !isPpr && (leagueRes.scoring_settings?.rec || 0) > 0.25;

  for (let idx = 0; idx < weekResults.length; idx++) {
    const week = idx + 1;
    const [matchupsList, projectionsObj] = weekResults[idx];
    if (!Array.isArray(matchupsList) || matchupsList.length === 0) continue;

    // Group matchups by matchup_id
    const matchupGroups = new Map();
    for (const m of matchupsList) {
      if (m.matchup_id === null || m.matchup_id === undefined) continue;
      if (!matchupGroups.has(m.matchup_id)) matchupGroups.set(m.matchup_id, []);
      matchupGroups.get(m.matchup_id).push(m);
    }

    let gameCounter = 1;
    for (const [mId, teamMatches] of matchupGroups.entries()) {
      if (teamMatches.length === 0) continue;

      const teamA = teamMatches[0];
      const teamB = teamMatches[1] || null;

      const t1Id = teamA.roster_id;
      const t2Id = teamB ? teamB.roster_id : null;
      const t1Pts = parseFloat(teamA.custom_points !== null && teamA.custom_points !== undefined ? teamA.custom_points : (teamA.points || 0));
      const t2Pts = teamB ? parseFloat(teamB.custom_points !== null && teamB.custom_points !== undefined ? teamB.custom_points : (teamB.points || 0)) : 0;

      // Helper to extract player entries with projections & stats
      const buildRosterEntries = (teamMatch) => {
        if (!teamMatch) return [];

        // Build a map: playerId -> lineup slot label (QB, RB, WR, TE, FLEX, K, DEF, etc.)
        // starters is ordered: starters[i] occupies starterSlotLabels[i]
        const starterSlotMap = {};
        (teamMatch.starters || []).forEach((pId, sIdx) => {
          if (pId && pId !== '0') {
            // Use the league's slot label at this index; fall back to 'FLEX' if out of range
            starterSlotMap[pId] = starterSlotLabels[sIdx] || 'FLEX';
          }
        });

        const startersSet = new Set(Object.keys(starterSlotMap));

        // starters_points is indexed by position in the starters array
        const starterPointsMap = {};
        (teamMatch.starters || []).forEach((pId, sIdx) => {
          if (pId && pId !== '0' && teamMatch.starters_points && teamMatch.starters_points[sIdx] !== undefined) {
            starterPointsMap[pId] = teamMatch.starters_points[sIdx];
          }
        });

        const playerPointsMap = teamMatch.players_points || {};
        const allPlayerIds = teamMatch.players || teamMatch.starters || [];
        const entries = [];

        for (const pId of allPlayerIds) {
          if (!pId || pId === '0') continue;
          const pInfo = sleeperPlayers[pId] || {};
          const isStarter = startersSet.has(pId);
          const actualScore = starterPointsMap[pId] !== undefined ? starterPointsMap[pId] : (playerPointsMap[pId] !== undefined ? playerPointsMap[pId] : 0);
          
          const projObj = projectionsObj[pId] || {};
          let projScore = 0;
          if (isPpr) {
            projScore = projObj.pts_ppr !== undefined ? projObj.pts_ppr : (projObj.pts_std || 0);
          } else if (isHalfPpr) {
            projScore = projObj.pts_half_ppr !== undefined ? projObj.pts_half_ppr : (projObj.pts_std || 0);
          } else {
            projScore = projObj.pts_std !== undefined ? projObj.pts_std : (projObj.pts_ppr || 0);
          }

          const fullName = pInfo.full_name || `${pInfo.first_name || ''} ${pInfo.last_name || ''}`.trim() || `Player ${pId}`;
          // Player's actual NFL position (TE, WR, QB, etc.) — used for headshot fallback and display
          const pos = pInfo.position || (pId.length <= 3 ? 'DEF' : 'FLEX');
          const teamAbbr = pInfo.team || '';

          // rosterSlot is the LINEUP SLOT the manager placed this player in:
          //   - For starters: the actual slot label from the league's roster_positions (QB, RB, WR, TE, FLEX, K, DEF)
          //   - For bench players: 'BN'
          const rosterSlot = isStarter ? (starterSlotMap[pId] || pos) : 'BN';

          entries.push({
            playerId: String(pId),
            playerName: fullName,
            position: pos,          // player's true NFL position
            nflTeam: teamAbbr,
            isStarter: isStarter,
            rosterSlot: rosterSlot, // actual lineup slot (QB, RB, WR, TE, FLEX, K, DEF, BN)
            points: Math.round(actualScore * 100) / 100,
            projectedPoints: Math.round(projScore * 100) / 100,
            headshotUrl: pId.length <= 3 
              ? `https://sleepercdn.com/images/team_logos/nfl/${pId.toLowerCase()}.png`
              : `https://sleepercdn.com/content/nfl/players/thumb/${pId}.jpg`,
            injuryStatus: pInfo.injury_status || null
          });
        }

        return entries;
      };

      const homeEntries = buildRosterEntries(teamA);
      const awayEntries = buildRosterEntries(teamB);

      const homeProj = homeEntries.filter(e => e.isStarter).reduce((sum, e) => sum + (e.projectedPoints || 0), 0);
      const awayProj = awayEntries.filter(e => e.isStarter).reduce((sum, e) => sum + (e.projectedPoints || 0), 0);

      const isPlayoffs = week >= playoffStartWeek;
      const winnerId = t1Pts > t2Pts ? t1Id : (t2Pts > t1Pts ? t2Id : (t1Pts > 0 ? t1Id : 'UNDECIDED'));

      schedule.push({
        id: `${seasonYear}_w${week}_m${gameCounter}`,
        matchupPeriodId: week,
        season: seasonYear,
        isPlayoffs: isPlayoffs,
        isConsolation: false,
        home: {
          teamId: t1Id,
          totalPoints: Math.round(t1Pts * 100) / 100,
          projectedPoints: Math.round(homeProj * 100) / 100,
          rosterForCurrentScoringPeriod: { entries: homeEntries }
        },
        away: t2Id ? {
          teamId: t2Id,
          totalPoints: Math.round(t2Pts * 100) / 100,
          projectedPoints: Math.round(awayProj * 100) / 100,
          rosterForCurrentScoringPeriod: { entries: awayEntries }
        } : null,
        winner: winnerId
      });

      gameCounter++;
    }
  }


  // 4. Fetch Draft Detail & Picks
  const draftDetail = {
    drafted: false,
    picks: []
  };

  if (Array.isArray(draftsRes) && draftsRes.length > 0) {
    const targetDraft = draftsRes[0];
    if (targetDraft && targetDraft.draft_id) {
      try {
        const picksRes = await fetch(`https://api.sleeper.app/v1/draft/${targetDraft.draft_id}/picks`).then(r => r.ok ? r.json() : []);
        if (Array.isArray(picksRes) && picksRes.length > 0) {
          draftDetail.drafted = targetDraft.status === 'complete' || picksRes.length > 0;
          for (const p of picksRes) {
            const pInfo = sleeperPlayers[p.player_id] || {};
            const fullName = `${p.metadata?.first_name || pInfo.first_name || ''} ${p.metadata?.last_name || pInfo.last_name || ''}`.trim() || `Player ${p.player_id}`;
            const pos = p.metadata?.position || pInfo.position || 'FLEX';
            const teamAbbr = p.metadata?.team || pInfo.team || '';
            const bid = p.metadata?.amount ? parseFloat(p.metadata.amount) : 0;

            draftDetail.picks.push({
              round: p.round,
              roundPickNumber: p.draft_slot,
              overallPickNumber: p.pick_no,
              teamId: p.roster_id,
              playerId: String(p.player_id),
              playerName: fullName,
              position: pos,
              nflTeam: teamAbbr,
              bidAmount: bid
            });
          }
        }
      } catch (e) {
        console.warn(`Failed to load draft picks for draft ${targetDraft.draft_id}:`, e.message);
      }
    }
  }

  // 5. Fetch Transactions across all weeks
  const transactions = [];
  const txPromises = weekNumbers.map(w => 
    fetch(`https://api.sleeper.app/v1/league/${leagueId}/transactions/${w}`)
      .then(r => r.ok ? r.json() : [])
      .catch(() => [])
  );
  const txResults = await Promise.all(txPromises);

  for (let idx = 0; idx < txResults.length; idx++) {
    const week = idx + 1;
    const weekTxs = txResults[idx];
    if (!Array.isArray(weekTxs)) continue;

    for (const tx of weekTxs) {
      if (tx.status !== 'complete') continue;

      const txType = tx.type; // 'trade', 'waiver', 'free_agent'
      const createdTime = tx.created || tx.status_updated;
      const rosterId = Array.isArray(tx.roster_ids) && tx.roster_ids.length > 0 ? tx.roster_ids[0] : 1;
      const targetTeam = teams.find(t => t.id === rosterId);

      const addedList = [];
      const droppedList = [];

      if (tx.adds) {
        for (const [pId, toRoster] of Object.entries(tx.adds)) {
          const pInfo = sleeperPlayers[pId] || {};
          const pName = `${pInfo.first_name || ''} ${pInfo.last_name || ''}`.trim() || `Player ${pId}`;
          addedList.push(pName);
        }
      }

      if (tx.drops) {
        for (const [pId, fromRoster] of Object.entries(tx.drops)) {
          const pInfo = sleeperPlayers[pId] || {};
          const pName = `${pInfo.first_name || ''} ${pInfo.last_name || ''}`.trim() || `Player ${pId}`;
          droppedList.push(pName);
        }
      }

      const faabBid = tx.settings?.waiver_bid || 0;

      transactions.push({
        id: tx.transaction_id || `${seasonYear}_tx_${transactions.length + 1}`,
        type: txType,
        teamId: rosterId,
        teamName: targetTeam?.name || `Team ${rosterId}`,
        timestamp: createdTime,
        faabBid: faabBid,
        players: [
          ...addedList.map(name => ({ action: 'add', name })),
          ...droppedList.map(name => ({ action: 'drop', name }))
        ]
      });
    }
  }

  // 6. Return standard season data structure
  return {
    year: seasonYear,
    data: {
      id: String(leagueId),
      members: members,
      teams: teams,
      schedule: schedule,
      draftDetail: draftDetail,
      transactions: transactions,
      settings: {
        name: leagueRes.name || `Sleeper League ${seasonYear}`,
        roster_positions: leagueRes.roster_positions || [],
        league_status: leagueStatus,       // 'pre_draft' | 'drafting' | 'in_season' | 'post_season' | 'complete'
        season_complete: isSeasonComplete, // true only when Sleeper marks the league as 'complete'
        scoringSettings: {
          sleeperRules: leagueRes.scoring_settings || {}
        },
        scheduleSettings: {
          matchupPeriodCount: regularSeasonWeeks,
          playoffTeamCount: playoffTeamsCount
        }
      }
    }
  };
}

/**
 * Default HTTP handler for local Vite and Vercel serverless functions.
 */
export default async function handler(req, res) {
  const { leagueId, year } = req.query;

  if (!leagueId) {
    return res.status(400).json({ error: 'Missing leagueId parameter' });
  }

  try {
    const result = await fetchSleeperSeasonData({ leagueId, year });
    return res.status(200).json(result);
  } catch (err) {
    console.error('Sleeper Season Scrape Error:', err);
    return res.status(500).json({ error: err.message || 'Scrape failed' });
  }
}
