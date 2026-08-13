// Fantasy Vault Data Compiler
// Replicates the core functionality of the Python scraper/parser for client-side execution.

export function compileVaultData(seasonsData) {
  // 1. Sort seasons descending
  seasonsData.sort((a, b) => b.year - a.year);

  const activeSeason = seasonsData[0];
  const activeYear = activeSeason.year;
  const activeMemberIds = new Set((activeSeason.data.members || []).map(m => m.id));

  // 2. Build Managers
  const managersMap = new Map();
  for (const season of seasonsData) {
    for (const m of (season.data.members || [])) {
      if (!managersMap.has(m.id)) {
        managersMap.set(m.id, {
          id: m.id,
          name: m.displayName || `${m.firstName || ''} ${m.lastName || ''}`.trim(),
          firstName: m.firstName || '',
          lastName: m.lastName || '',
          isActive: activeMemberIds.has(m.id),
          lastSeenYear: season.year
        });
      } else {
        const existing = managersMap.get(m.id);
        if (season.year > existing.lastSeenYear) {
          existing.lastSeenYear = season.year;
        }
      }
    }
  }

  const members = Array.from(managersMap.values());

  // 3. Build Teams Map per season
  const teamMap = {}; // { year: { teamId: { ... } } }
  for (const season of seasonsData) {
    teamMap[season.year] = {};
    for (const t of (season.data.teams || [])) {
      const ownerId = t.primaryOwner;
      const ownerInfo = managersMap.get(ownerId);
      teamMap[season.year][t.id] = {
        id: t.id,
        name: t.name || `${t.location || ''} ${t.nickname || ''}`.trim(),
        abbrev: t.abbrev,
        ownerId: ownerId,
        ownerName: ownerInfo ? ownerInfo.name : 'Unknown',
        playoffSeed: t.playoffSeed || 99,
        finalRank: t.rankCalculatedFinal || t.rankFinal || 99,
      };
    }
  }

  // 4. Build Standings
  const standings = [];
  for (const season of seasonsData) {
    const teams = season.data.teams || [];
    for (const t of teams) {
      if (!t.record) continue;
      
      const overall = t.record.overall || { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };
      const teamInfo = teamMap[season.year][t.id];
      
      if (!teamInfo || !teamInfo.ownerId) continue;
      
      standings.push({
        year: season.year,
        team_id: t.id,
        team_name: teamInfo.name,
        manager_id: teamInfo.ownerId,
        manager_name: teamInfo.ownerName,
        wins: overall.wins || 0,
        losses: overall.losses || 0,
        ties: overall.ties || 0,
        points_for: Math.round((overall.pointsFor || 0) * 100) / 100,
        points_against: Math.round((overall.pointsAgainst || 0) * 100) / 100,
        final_rank: teamInfo.finalRank,
        playoff_seed: teamInfo.playoffSeed
      });
    }
  }
  
  standings.sort((a, b) => (a.final_rank || 99) - (b.final_rank || 99));

  // 5. Build Matchups & Weekly Team Scores
  const matchups = [];
  const weekly_team_scores = [];
  const teamWins = {};
  const teamLosses = {};
  const teamPF = {};
  const teamPA = {};
  const teamScoreLists = {};

  for (const season of seasonsData) {
    const year = season.year;
    const schedule = season.data.schedule || [];
    const settings = season.data.settings || {};
    const schedSettings = settings.scheduleSettings || {};
    const regSeasonWeeks = schedSettings.matchupPeriodCount || 13;
    const playoffTeamsCount = schedSettings.playoffTeamCount || 6;
    
    let contenders = new Set();
    Object.values(teamMap[year] || {}).forEach(t => {
      if (t.playoffSeed <= playoffTeamsCount) contenders.add(t.id);
    });
    
    const byWeek = {};
    for (const s of schedule) {
      const w = s.matchupPeriodId;
      if (!w) continue;
      if (!byWeek[w]) byWeek[w] = [];
      byWeek[w].push(s);
    }
    
    const truePlayoffIds = new Set();
    const thirdPlaceIds = new Set();
    let prevKnockouts = new Set();
    
    const sortedWeeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);
    
    for (const w of sortedWeeks) {
      if (w <= regSeasonWeeks) continue;
      const knockouts = new Set();
      for (const s of byWeek[w]) {
        const h = s.home?.teamId;
        const a = s.away?.teamId;
        if (contenders.has(h) && contenders.has(a)) {
          truePlayoffIds.add(s.id);
          const winner = s.winner;
          let loser = null;
          if (winner === "HOME") loser = a;
          else if (winner === "AWAY") loser = h;
          else if ((s.home?.totalPoints || 0) > (s.away?.totalPoints || 0)) loser = a;
          else loser = h;
          if (loser) knockouts.add(loser);
        } else if (prevKnockouts.has(h) && prevKnockouts.has(a)) {
          thirdPlaceIds.add(s.id);
        }
      }
      for (const k of knockouts) contenders.delete(k);
      prevKnockouts = knockouts;
    }

    for (const s of schedule) {
      const week = s.matchupPeriodId;
      if (!week) continue;

      const home = s.home || {};
      const away = s.away || {};
      const h_id = home.teamId;
      const a_id = away.teamId;

      if (!h_id || !a_id) continue;

      const h_info = teamMap[year][h_id] || {};
      const a_info = teamMap[year][a_id] || {};

      const isTruePlayoff = truePlayoffIds.has(s.id);
      const isThirdPlace = thirdPlaceIds.has(s.id);
      const isConsolation = week > regSeasonWeeks && !isTruePlayoff && !isThirdPlace;

      let gameType = "Regular Season";
      if (isTruePlayoff) gameType = "Championship";
      else if (isThirdPlace) gameType = "3rd Place";
      else if (isConsolation) gameType = "Consolation";
      
      const isPlayoff = week > regSeasonWeeks;

      const h_score = Math.round((home.totalPoints || 0) * 100) / 100;
      const a_score = Math.round((away.totalPoints || 0) * 100) / 100;
      const winner = s.winner || "UNDECIDED";

      matchups.push({
        year,
        week,
        matchup_id: s.id,
        game_type: gameType,
        is_playoff: isTruePlayoff,
        is_consolation: isConsolation,
        home_team_id: h_id,
        home_team_name: h_info.name || "",
        home_manager_id: h_info.ownerId,
        home_manager_name: h_info.ownerName || "",
        home_score: h_score,
        away_team_id: a_id,
        away_team_name: a_info.name || "",
        away_manager_id: a_info.ownerId,
        away_manager_name: a_info.ownerName || "",
        away_score: a_score,
        winner
      });

      const addScores = (sideData, tid, tinfo) => {
        const pbsp = sideData.pointsByScoringPeriod;
        if (pbsp && Object.keys(pbsp).length > 0) {
          for (const [wStr, pts] of Object.entries(pbsp)) {
             weekly_team_scores.push({
               year, week: parseInt(wStr), matchup_week: week,
               team_id: tid, team_name: tinfo.name || "",
               manager_id: tinfo.ownerId, manager_name: tinfo.ownerName || "",
               score: Math.round(pts * 100) / 100, is_playoff: isPlayoff
             });
          }
        } else {
           weekly_team_scores.push({
             year, week, matchup_week: week,
             team_id: tid, team_name: tinfo.name || "",
             manager_id: tinfo.ownerId, manager_name: tinfo.ownerName || "",
             score: Math.round((sideData.totalPoints || 0) * 100) / 100, is_playoff: isPlayoff
           });
        }
      };

      addScores(home, h_id, h_info);
      addScores(away, a_id, a_info);

      if (!isPlayoff) {
        if (!teamWins[year]) teamWins[year] = {};
        if (!teamLosses[year]) teamLosses[year] = {};
        if (!teamPF[year]) teamPF[year] = {};
        if (!teamPA[year]) teamPA[year] = {};
        if (!teamScoreLists[year]) teamScoreLists[year] = {};
        
        [h_id, a_id].forEach(id => {
          if (!teamWins[year][id]) teamWins[year][id] = 0;
          if (!teamLosses[year][id]) teamLosses[year][id] = 0;
          if (!teamPF[year][id]) teamPF[year][id] = 0;
          if (!teamPA[year][id]) teamPA[year][id] = 0;
          if (!teamScoreLists[year][id]) teamScoreLists[year][id] = [];
        });

        teamPF[year][h_id] += h_score;
        teamPA[year][h_id] += a_score;
        teamPF[year][a_id] += a_score;
        teamPA[year][a_id] += h_score;

        teamScoreLists[year][h_id].push({ w: week, s: h_score });
        teamScoreLists[year][a_id].push({ w: week, s: a_score });

        if (winner === "HOME") { teamWins[year][h_id]++; teamLosses[year][a_id]++; }
        else if (winner === "AWAY") { teamWins[year][a_id]++; teamLosses[year][h_id]++; }
      }
    }
  }

  // 6. Team Stats Aggregation
  const team_stats = [];
  for (const season of seasonsData) {
    const year = season.year;
    for (const [tid, scores] of Object.entries(teamScoreLists[year] || {})) {
      if (scores.length === 0) continue;
      
      const tinfo = teamMap[year][tid] || {};
      const maxObj = scores.reduce((prev, curr) => (curr.s > prev.s) ? curr : prev, scores[0]);
      const minObj = scores.reduce((prev, curr) => (curr.s < prev.s) ? curr : prev, scores[0]);
      
      const pf = teamPF[year][tid] || 0;
      
      team_stats.push({
        year,
        team_id: tid,
        team_name: tinfo.name || "",
        manager_id: tinfo.ownerId,
        manager_name: tinfo.ownerName || "",
        wins: teamWins[year][tid] || 0,
        losses: teamLosses[year][tid] || 0,
        points_for: Math.round(pf * 100) / 100,
        points_against: Math.round((teamPA[year][tid] || 0) * 100) / 100,
        avg_score: Math.round((pf / scores.length) * 100) / 100,
        high_score: Math.round(maxObj.s * 100) / 100,
        high_score_week: maxObj.w,
        low_score: Math.round(minObj.s * 100) / 100,
        low_score_week: minObj.w,
        made_playoffs: tinfo.playoffSeed <= 6,
        final_rank: tinfo.finalRank,
        playoff_seed: tinfo.playoffSeed
      });
    }
  }
  team_stats.sort((a, b) => b.year - a.year || b.points_for - a.points_for);

  // 7. Draft Results
  const draft_results = [];
  for (const season of seasonsData) {
    const year = season.year;
    const picks = season.data.draftDetail?.picks || [];
    for (const pick of picks) {
      const tid = pick.teamId;
      const tinfo = teamMap[year][tid] || {};
      draft_results.push({
        year,
        overall_pick: pick.overallPickNumber,
        round: pick.roundId,
        round_pick: pick.roundPickNumber,
        team_id: tid,
        team_name: tinfo.name || "",
        manager_id: tinfo.ownerId,
        manager_name: tinfo.ownerName || "",
        player_id: pick.playerId,
        player_name: `Player ID ${pick.playerId}`,
        is_keeper: pick.keeper || false,
        bid_amount: pick.bidAmount || 0
      });
    }
  }

  const deduped_weekly = [];
  const weekly_keys = new Set();
  for (const w of weekly_team_scores) {
     const k = `${w.year}-${w.week}-${w.team_id}`;
     if (!weekly_keys.has(k)) {
        weekly_keys.add(k);
        deduped_weekly.push(w);
     }
  }
  deduped_weekly.sort((a, b) => a.week - b.week || a.team_id - b.team_id);

  const league_settings = {
    name: activeSeason.data.settings?.name || "Fantasy League",
    id: activeSeason.data.id || "",
    firstYear: seasonsData[seasonsData.length - 1].year,
    lastYear: activeYear,
    totalSeasons: seasonsData.length
  };

  // Return exactly the payload that `vault.js` expects
  return {
    members: members,
    league_standings: standings,
    team_stats: team_stats,
    matchups: matchups,
    draft_results: draft_results,
    weekly_team_scores: deduped_weekly,
    weekly_player_stats: [], // Skipped due to API limits
    league_settings: league_settings
  };
}
