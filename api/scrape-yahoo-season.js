import { fetchYahooApi, refreshAccessToken } from './yahoo.js';

/**
 * Normalizes Yahoo Fantasy API seasonal data into the standardized The Fantasy Vault schema.
 * Fetches: Settings, Standings, Scoreboard (all weeks), Team Rosters & Player Stats, Draft Results, Transactions.
 */
export async function fetchYahooSeasonData({ leagueKey, accessToken, refreshToken }) {
  if (!leagueKey) {
    throw new Error('Missing leagueKey parameter (e.g. 449.l.80052)');
  }

  let token = accessToken;
  if (!token && refreshToken) {
    const refreshed = await refreshAccessToken(refreshToken);
    token = refreshed.access_token;
  }

  if (!token) {
    throw new Error('No Yahoo access token provided.');
  }

  // 1. Fetch League Settings, Standings, and Teams
  const [settingsRes, standingsRes, teamsRes] = await Promise.all([
    fetchYahooApi(`league/${leagueKey}/settings`, token),
    fetchYahooApi(`league/${leagueKey}/standings`, token),
    fetchYahooApi(`league/${leagueKey}/teams`, token)
  ]);

  const leagueInfo = settingsRes?.fantasy_content?.league?.[0];
  const settingsObj = settingsRes?.fantasy_content?.league?.[1]?.settings?.[0];
  const seasonYear = parseInt(leagueInfo?.season || 2026);
  const totalWeeks = parseInt(settingsObj?.end_week || 17);
  const regularSeasonWeeks = parseInt(settingsObj?.playoff_start_week ? settingsObj.playoff_start_week - 1 : 14);

  // Teams & Managers extraction
  const teamsData = teamsRes?.fantasy_content?.league?.[1]?.teams;
  const standingsData = standingsRes?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;
  const numTeams = teamsData?.count || 12;

  const teams = [];
  const members = [];
  const teamKeyToId = new Map();

  for (let i = 0; i < numTeams; i++) {
    const tArr = teamsData?.[i]?.team?.[0];
    if (!tArr) continue;
    const teamKey = tArr.find(x => x && x.team_key)?.team_key;
    const teamId = parseInt(tArr.find(x => x && x.team_id)?.team_id || (i + 1));
    const teamName = tArr.find(x => x && x.name)?.name || `Team ${teamId}`;
    const teamLogos = tArr.find(x => x && x.team_logos)?.team_logos;
    const logoUrl = teamLogos?.[0]?.team_logo?.url || '';
    const mgrArr = tArr.find(x => x && x.managers)?.managers;
    const mgr = mgrArr?.[0]?.manager;

    teamKeyToId.set(teamKey, teamId);

    // Get standing record if available
    const standingTeamObj = standingsData?.[i]?.team;
    let standingRecord = {};
    if (standingTeamObj) {
      const sArr = standingTeamObj[2];
      if (sArr) {
        standingRecord = {
          rank: parseInt(sArr.team_standings?.rank || 0),
          wins: parseInt(sArr.team_standings?.outcome_totals?.wins || 0),
          losses: parseInt(sArr.team_standings?.outcome_totals?.losses || 0),
          ties: parseInt(sArr.team_standings?.outcome_totals?.ties || 0),
          pointsFor: parseFloat(sArr.team_standings?.points_for || 0),
          pointsAgainst: parseFloat(sArr.team_standings?.points_against || 0),
          streak: sArr.team_standings?.streak ? `${sArr.team_standings.streak.type}-${sArr.team_standings.streak.value}` : ''
        };
      }
    }

    const validGuid = (mgr?.guid && mgr.guid !== '--hidden--') ? mgr.guid : null;
    const cleanNick = mgr?.nickname ? mgr.nickname.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    const memberId = validGuid || (cleanNick ? `yahoo_${cleanNick}` : `yahoo_team_${teamId}`);
    const memberName = mgr?.nickname || teamName;

    members.push({
      id: memberId,
      guid: mgr?.guid || '',
      displayName: memberName,
      alias: memberName,
      avatar: mgr?.image_url || '',
      teamId: teamId,
      isActive: true
    });

    teams.push({
      id: teamId,
      teamKey,
      name: teamName,
      logoUrl,
      primaryOwner: memberId,
      ...standingRecord
    });
  }

  // 2. Fetch Scoreboard across all weeks
  const weekNums = Array.from({ length: totalWeeks }, (_, i) => i + 1);
  const scoreboardPromises = weekNums.map(w => 
    fetchYahooApi(`league/${leagueKey}/scoreboard;week=${w}`, token)
      .catch(e => {
        console.warn(`Failed to fetch scoreboard week ${w}:`, e.message);
        return null;
      })
  );

  const scoreboardResults = await Promise.all(scoreboardPromises);
  const schedule = [];

  scoreboardResults.forEach((sbData, idx) => {
    if (!sbData) return;
    const week = idx + 1;
    const matchupsObj = sbData?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
    if (!matchupsObj) return;

    const mCount = matchupsObj.count || 0;
    for (let m = 0; m < mCount; m++) {
      const match = matchupsObj[m]?.matchup;
      if (!match) continue;

      const isPlayoffs = match.is_playoffs === '1' || match.is_playoffs === 1;
      const isConsolation = match.is_consolation === '1' || match.is_consolation === 1;
      const t1Data = match[0]?.teams?.[0]?.team;
      const t2Data = match[0]?.teams?.[1]?.team;

      if (!t1Data || !t2Data) continue;

      const t1Key = t1Data[0]?.find(x => x && x.team_key)?.team_key;
      const t2Key = t2Data[0]?.find(x => x && x.team_key)?.team_key;
      const t1Id = teamKeyToId.get(t1Key) || 1;
      const t2Id = teamKeyToId.get(t2Key) || 2;

      const t1Pts = parseFloat(t1Data[1]?.team_points?.total || 0);
      const t2Pts = parseFloat(t2Data[1]?.team_points?.total || 0);
      const t1Proj = parseFloat(t1Data[1]?.team_projected_points?.total || 0);
      const t2Proj = parseFloat(t2Data[1]?.team_projected_points?.total || 0);

      const winnerKey = match.winner_team_key;
      const winnerId = winnerKey ? teamKeyToId.get(winnerKey) : (t1Pts > t2Pts ? t1Id : (t2Pts > t1Pts ? t2Id : 0));

      schedule.push({
        id: `${seasonYear}_w${week}_m${m + 1}`,
        matchupPeriodId: week,
        season: seasonYear,
        isPlayoffs,
        isConsolation,
        home: {
          teamId: t1Id,
          totalPoints: t1Pts,
          projectedPoints: t1Proj,
          rosterForCurrentScoringPeriod: { entries: [] }
        },
        away: {
          teamId: t2Id,
          totalPoints: t2Pts,
          projectedPoints: t2Proj,
          rosterForCurrentScoringPeriod: { entries: [] }
        },
        winner: winnerId
      });
    }
  });

  // 3. Fetch Team Rosters & Granular Player Boxscores for all weeks
  // Fetch by week across all teams to stay within rate limits
  const allTeamKeys = [];
  for (let tId = 1; tId <= numTeams; tId++) {
    allTeamKeys.push(`${leagueKey}.t.${tId}`);
  }
  const teamKeysParam = allTeamKeys.join(',');
  const rosterResults = [];

  for (let w = 1; w <= totalWeeks; w++) {
    try {
      const res = await fetchYahooApi(`teams;team_keys=${teamKeysParam}/roster;week=${w}/players/stats`, token);
      const teamsObj = res?.fantasy_content?.teams;
      const count = teamsObj?.count || 0;
      for (let i = 0; i < count; i++) {
        const teamData = teamsObj[i]?.team;
        if (!teamData) continue;
        const tMeta = teamData[0];
        const tKey = tMeta?.find(x => x && x.team_key)?.team_key;
        const tId = teamKeyToId.get(tKey) || (i + 1);
        rosterResults.push({ teamId: tId, week: w, rData: { fantasy_content: { team: teamData } } });
      }
    } catch (e) {
      // Graceful fallback: batch individual teams with pacing
      for (let tId = 1; tId <= numTeams; tId++) {
        try {
          const rData = await fetchYahooApi(`team/${leagueKey}.t.${tId}/roster;week=${w}/players/stats`, token);
          rosterResults.push({ teamId: tId, week: w, rData });
        } catch (err) {}
      }
    }
    if (w < totalWeeks) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  const playerStatsMap = new Map(); // `${year}_${week}_${teamId}` -> entries
  const playerMetaMap = new Map(); // playerKey -> { playerId, playerName, position, nflTeam, headshotUrl }

  rosterResults.forEach(item => {
    if (!item || !item.rData) return;
    const { teamId, week, rData } = item;
    const playersObj = rData?.fantasy_content?.team?.[1]?.roster?.[0]?.players;
    if (!playersObj) return;

    const pCount = playersObj.count || 0;
    const entries = [];

    for (let p = 0; p < pCount; p++) {
      const pArr = playersObj[p]?.player;
      if (!pArr) continue;

      const pMeta = pArr[0];
      const pKey = pMeta?.find(x => x && x.player_key)?.player_key;
      const pId = pMeta?.find(x => x && x.player_id)?.player_id;
      const nameObj = pMeta?.find(x => x && x.name)?.name;
      const fullName = nameObj?.full || 'Unknown Player';
      const pos = pMeta?.find(x => x && x.display_position)?.display_position || 'FLEX';
      const nflTeam = pMeta?.find(x => x && x.editorial_team_abbr)?.editorial_team_abbr || '';
      const headshot = pMeta?.find(x => x && x.headshot)?.headshot?.url || '';
      const status = pMeta?.find(x => x && x.status)?.status || null;

      if (pKey && !playerMetaMap.has(pKey)) {
        playerMetaMap.set(pKey, {
          playerId: pId,
          playerName: fullName,
          position: pos,
          nflTeam,
          headshotUrl: headshot
        });
      }

      const slotObj = pArr[1]?.selected_position?.[1]?.position || 'BN';
      const isStarter = slotObj !== 'BN' && slotObj !== 'IR';

      const points = parseFloat(pArr[3]?.player_points?.total || 0);
      const rawStats = pArr[3]?.player_stats?.stats || [];

      entries.push({
        playerId: pId,
        playerKey: pKey,
        playerName: fullName,
        position: pos,
        nflTeam,
        headshotUrl: headshot,
        injuryStatus: status,
        rosterSlot: slotObj,
        isStarter,
        points,
        rawStats
      });
    }

    // Attach to schedule game
    const game = schedule.find(g => g.matchupPeriodId === week && (g.home.teamId === teamId || g.away.teamId === teamId));
    if (game) {
      if (game.home.teamId === teamId) {
        game.home.rosterForCurrentScoringPeriod.entries = entries;
      } else if (game.away.teamId === teamId) {
        game.away.rosterForCurrentScoringPeriod.entries = entries;
      }
    }
  });

  // 4. Fetch Draft Results
  let draftDetail = { picks: [] };
  try {
    const draftRes = await fetchYahooApi(`league/${leagueKey}/draftresults`, token);
    const draftPicksObj = draftRes?.fantasy_content?.league?.[1]?.draft_results;
    if (draftPicksObj) {
      const dCount = draftPicksObj.count || 0;
      const missingPlayerKeys = new Set();

      for (let d = 0; d < dCount; d++) {
        const pickObj = draftPicksObj[d]?.draft_result;
        if (!pickObj) continue;
        const pTeamId = teamKeyToId.get(pickObj.team_key) || 1;
        const pKey = pickObj.player_key;
        if (pKey && !playerMetaMap.has(pKey)) {
          missingPlayerKeys.add(pKey);
        }

        draftDetail.picks.push({
          round: parseInt(pickObj.round),
          pickInRound: parseInt(pickObj.pick),
          overallPick: (parseInt(pickObj.round) - 1) * numTeams + parseInt(pickObj.pick),
          teamId: pTeamId,
          playerKey: pKey
        });
      }

      // Batch query any draft picks not already found in weekly rosters (chunks of 25)
      const missingKeysArr = Array.from(missingPlayerKeys);
      for (let i = 0; i < missingKeysArr.length; i += 25) {
        const chunk = missingKeysArr.slice(i, i + 25);
        try {
          const playersRes = await fetchYahooApi(`players;player_keys=${chunk.join(',')}`, token);
          const pList = playersRes?.fantasy_content?.players;
          const count = pList?.count || 0;
          for (let pIdx = 0; pIdx < count; pIdx++) {
            const pArr = pList[pIdx]?.player?.[0];
            if (!pArr) continue;
            const pK = pArr.find(x => x && x.player_key)?.player_key;
            const pId = pArr.find(x => x && x.player_id)?.player_id;
            const pName = pArr.find(x => x && x.name)?.name?.full || '';
            const pPos = pArr.find(x => x && x.display_position)?.display_position || '';
            const nflTeam = pArr.find(x => x && x.editorial_team_abbr)?.editorial_team_abbr || '';
            const headshot = pArr.find(x => x && x.headshot)?.headshot?.url || '';

            if (pK) {
              playerMetaMap.set(pK, {
                playerId: pId,
                playerName: pName,
                position: pPos,
                nflTeam,
                headshotUrl: headshot
              });
            }
          }
        } catch (err) {
          console.warn('Batch player metadata fetch warning:', err.message);
        }
      }

      // Fill in metadata for all picks
      draftDetail.picks.forEach(pick => {
        const meta = playerMetaMap.get(pick.playerKey);
        if (meta) {
          pick.playerId = meta.playerId;
          pick.playerName = meta.playerName;
          pick.position = meta.position;
          pick.nflTeam = meta.nflTeam;
          pick.headshotUrl = meta.headshotUrl;
        }
      });
    }
  } catch (e) {
    console.warn('Draft results fetch note:', e.message);
  }

  // 5. Fetch Transactions
  let transactions = [];
  try {
    const transRes = await fetchYahooApi(`league/${leagueKey}/transactions`, token);
    const transObj = transRes?.fantasy_content?.league?.[1]?.transactions;
    if (transObj) {
      const tCount = transObj.count || 0;
      for (let t = 0; t < tCount; t++) {
        const tr = transObj[t]?.transaction;
        if (!tr) continue;
        const meta = tr[0];
        const playersBlock = tr[1]?.players;

        const transItem = {
          id: meta.transaction_id,
          type: meta.type,
          timestamp: parseInt(meta.timestamp) * 1000, // milliseconds
          faabBid: parseInt(meta.faab_bid || 0),
          status: meta.status,
          players: []
        };

        if (playersBlock) {
          const pCount = playersBlock.count || 0;
          for (let p = 0; p < pCount; p++) {
            const pData = playersBlock[p]?.player;
            if (!pData) continue;
            const pMeta = pData[0];
            const pAction = pData[1]?.transaction_data;
            const actionType = Array.isArray(pAction) ? pAction[0]?.type : pAction?.type;
            const pName = pMeta?.find(x => x && x.name)?.name?.full || '';
            const pPos = pMeta?.find(x => x && x.display_position)?.display_position || '';

            transItem.players.push({
              name: pName,
              position: pPos,
              action: actionType
            });
          }
        }

        transactions.push(transItem);
      }
    }
  } catch (e) {
    console.warn('Transactions fetch note:', e.message);
  }

  return {
    year: seasonYear,
    platform: 'yahoo',
    leagueKey,
    data: {
      seasonId: seasonYear,
      settings: {
        scoringSettings: settingsObj?.stat_modifiers || {},
        rosterSettings: settingsObj?.roster_positions || [],
        scheduleSettings: {
          matchupPeriodCount: totalWeeks,
          regularSeasonMatchupPeriodCount: regularSeasonWeeks
        }
      },
      teams,
      members,
      schedule,
      draftDetail,
      transactions
    }
  };
}

export default async function handler(req, res) {
  const { leagueKey, accessToken, refreshToken } = req.query;
  if (!leagueKey) {
    return res.status(400).json({ error: 'Missing leagueKey parameter' });
  }

  try {
    const seasonData = await fetchYahooSeasonData({ leagueKey, accessToken, refreshToken });
    return res.status(200).json(seasonData);
  } catch (err) {
    console.error('Yahoo Season Scraper Error:', err);
    return res.status(500).json({ error: err.message || 'Scrape failed' });
  }
}
