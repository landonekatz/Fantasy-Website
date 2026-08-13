// Fantasy Vault Data Compiler
// Replicates the core functionality of the Python scraper/parser for client-side execution.

export function compileVaultData(rawSeasonsData, uiMembersConfig = [], customName = null, nflCsvData = null) {
  if (!rawSeasonsData || rawSeasonsData.length === 0) return null;
  
  const ESPN_STAT_MAP = {
    3: ["Passing", "Passing Yards"],
    4: ["Passing", "TD Pass"],
    7: ["Passing", "Every 20 passing yards"],
    17: ["Passing", "300-399 yard passing game"],
    18: ["Passing", "400+ yard passing game"],
    19: ["Passing", "2pt Passing Conversion"],
    20: ["Passing", "Interceptions Thrown"],
    24: ["Rushing", "Rushing Yards"],
    25: ["Rushing", "TD Rush"],
    26: ["Rushing", "2pt Rushing Conversion"],
    28: ["Rushing", "Every 10 rushing yards"],
    37: ["Rushing", "100-199 yard rushing game"],
    38: ["Rushing", "200+ yard rushing game"],
    42: ["Receiving", "Receiving Yards"],
    43: ["Receiving", "TD Reception"],
    44: ["Receiving", "2pt Receiving Conversion"],
    48: ["Receiving", "Every 10 receiving yards"],
    53: ["Receiving", "Each reception"],
    56: ["Receiving", "100-199 yard receiving game"],
    57: ["Receiving", "200+ yard receiving game"],
    198: ["Kicking", "Each PAT Made"],
    199: ["Kicking", "Extra Point Missed"],
    200: ["Kicking", "FG Made (0-39 yards)"],
    201: ["Kicking", "FG Made (40-49 yards)"],
    202: ["Kicking", "FG Made (50-59 yards)"],
    203: ["Kicking", "FG Made (60+ yards)"],
    204: ["Kicking", "FG Missed (0-39 yards)"],
    205: ["Kicking", "FG Missed (40-49 yards)"],
    206: ["Kicking", "FG Missed (50+ yards)"],
    73: ["Team Defense and Special Teams", "Each Sack"],
    74: ["Team Defense and Special Teams", "Each Interception"],
    75: ["Team Defense and Special Teams", "Each Fumble Recovered"],
    77: ["Team Defense and Special Teams", "Interception Return TD"],
    80: ["Team Defense and Special Teams", "Fumble Return TD"],
    82: ["Team Defense and Special Teams", "Kickoff Return TD"],
    83: ["Team Defense and Special Teams", "Punt Return TD"],
    86: ["Team Defense and Special Teams", "Blocked Punt, PAT or FG"],
    89: ["Team Defense and Special Teams", "0 points allowed"],
    90: ["Team Defense and Special Teams", "1-6 points allowed"],
    91: ["Team Defense and Special Teams", "7-13 points allowed"],
    92: ["Team Defense and Special Teams", "14-17 points allowed"],
    93: ["Team Defense and Special Teams", "Blocked Punt or FG return for TD"],
    95: ["Team Defense and Special Teams", "Each Safety"],
    123: ["Team Defense and Special Teams", "28-34 points allowed"],
    124: ["Team Defense and Special Teams", "35-45 points allowed"],
    125: ["Team Defense and Special Teams", "46+ points allowed"],
    128: ["Team Defense and Special Teams", "Less than 100 total yards allowed"],
    129: ["Team Defense and Special Teams", "100-199 total yards allowed"],
    130: ["Team Defense and Special Teams", "200-299 total yards allowed"],
    132: ["Team Defense and Special Teams", "350-399 total yards allowed"],
    133: ["Team Defense and Special Teams", "400-449 total yards allowed"],
    134: ["Team Defense and Special Teams", "450-499 total yards allowed"],
    135: ["Team Defense and Special Teams", "500-549 total yards allowed"],
    136: ["Team Defense and Special Teams", "550+ total yards allowed"],
    72: ["Miscellaneous", "Total Fumbles Lost"]
  };

  const NFL_TEAMS = {
    0: 'FA', 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GB',
    10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG',
    20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR',
    30: 'JAX', 33: 'BAL', 34: 'HOU'
  };

  const nflGames = [];
  if (nflCsvData) {
     const lines = nflCsvData.split('\n');
     for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 8) {
           nflGames.push({
               season: parseInt(parts[1]),
               week: parseInt(parts[2]),
               home: parts[4],
               home_score: parseInt(parts[5]),
               away: parts[6],
               away_score: parseInt(parts[7])
           });
        }
     }
  }

  const getNflGameResult = (season, week, team) => {
      const g = nflGames.find(x => x.season === season && x.week === week && (x.home === team || x.away === team));
      if (!g) return null;
      const isHome = g.home === team;
      const tScore = isHome ? g.home_score : g.away_score;
      const oScore = isHome ? g.away_score : g.home_score;
      const opp = isHome ? g.away : g.home;
      if (tScore > oScore) return `W ${tScore}-${oScore} vs ${opp}`;
      if (tScore < oScore) return `L ${tScore}-${oScore} vs ${opp}`;
      return `T ${tScore}-${oScore} vs ${opp}`;
  };

  const playerIdToName = new Map();

  // 0. Filter out unplayed seasons (where no games have been played)
  let seasonsData = rawSeasonsData.filter(season => {
    const schedule = season.data.schedule || [];
    // If there's at least one finished game, keep the season
    return schedule.some(s => s.winner !== 'UNDECIDED' || (s.home && s.home.totalPoints > 0));
  });

  if (seasonsData.length === 0) {
    // If all seasons are unplayed (or empty), just fallback so it doesn't crash
    seasonsData = rawSeasonsData;
  }

  // 1. Sort seasons descending
  seasonsData.sort((a, b) => b.year - a.year);

  const activeSeason = seasonsData[0];
  const activeYear = activeSeason.year;
  
  // 2. Build mapping and managers from raw data and uiMembersConfig
  const originalToCanonicalMap = new Map(); // m.id -> manager_id
  const managersMap = new Map();

  // First, map everyone to themselves
  for (const season of seasonsData) {
    for (const m of (season.data.members || [])) {
      if (!managersMap.has(m.id)) {
        const first = m.firstName ? m.firstName.trim() : '';
        const last = m.lastName ? m.lastName.trim() : '';
        let canonicalName = `${first} ${last}`.trim();
        if (!canonicalName) canonicalName = m.displayName || m.id;
        
        managersMap.set(m.id, {
          id: m.id,
          name: canonicalName,
          firstName: first,
          lastName: last,
          espn_ids: [m.id],
          lastSeenYear: season.year,
          isActive: false
        });
        originalToCanonicalMap.set(m.id, m.id);
      } else {
        const existing = managersMap.get(m.id);
        if (!existing.espn_ids.includes(m.id)) {
            existing.espn_ids.push(m.id);
        }
        if (season.year > existing.lastSeenYear) {
          existing.lastSeenYear = season.year;
        }
      }
    }
  }

  // Now apply uiMembersConfig
  // First pass: apply aliases and active status
  for (const config of uiMembersConfig) {
      if (managersMap.has(config.id)) {
          const target = managersMap.get(config.id);
          if (config.alias) target.name = config.alias;
          if (config.isActive !== undefined) target.isActive = config.isActive;
      }
  }

  // Second pass: handle merges
  for (const config of uiMembersConfig) {
      if (config.mergedInto && config.mergedInto !== config.id) {
          const primaryId = config.mergedInto;
          // Redirect the original id to the primary id
          originalToCanonicalMap.set(config.id, primaryId);
          // Also redirect any other espn_ids that were mapped to this config.id just in case
          for (const [orig, canon] of originalToCanonicalMap.entries()) {
              if (canon === config.id) originalToCanonicalMap.set(orig, primaryId);
          }
          
          if (managersMap.has(primaryId) && managersMap.has(config.id)) {
              const target = managersMap.get(primaryId);
              const source = managersMap.get(config.id);
              
              // Merge espn_ids without duplicates
              for (const eid of source.espn_ids) {
                  if (!target.espn_ids.includes(eid)) target.espn_ids.push(eid);
              }
              
              if (source.lastSeenYear > target.lastSeenYear) {
                  target.lastSeenYear = source.lastSeenYear;
              }
              if (source.isActive) target.isActive = true;
              
              managersMap.delete(config.id);
          }
      }
  }

  // Determine active/retired (fallback if uiMembersConfig wasn't provided)
  if (uiMembersConfig.length === 0) {
    const activeMemberCanonicalIds = new Set();
    for (const m of (activeSeason.data.members || [])) {
        const mappedId = originalToCanonicalMap.get(m.id);
        if (mappedId) activeMemberCanonicalIds.add(mappedId);
    }
    for (const m of managersMap.values()) {
        m.isActive = activeMemberCanonicalIds.has(m.id);
    }
  }

  const members = Array.from(managersMap.values()).map(m => {
      m.status = m.isActive ? 'Active' : 'Retired';
      return m;
  });

  // 3. Build Teams Map per season
  const teamMap = {}; // { year: { teamId: { ... } } }
  for (const season of seasonsData) {
    teamMap[season.year] = {};
    for (const t of (season.data.teams || [])) {
      const originalOwnerId = t.primaryOwner;
      const canonicalOwnerId = originalToCanonicalMap.get(originalOwnerId) || originalOwnerId;
      const ownerInfo = managersMap.get(canonicalOwnerId);
      
      teamMap[season.year][t.id] = {
        id: t.id,
        name: t.name || `${t.location || ''} ${t.nickname || ''}`.trim(),
        abbrev: t.abbrev,
        ownerId: canonicalOwnerId,
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
      
      const moves = t.transactionCounter ? ((t.transactionCounter.acquisitions || 0) + (t.transactionCounter.trades || 0)) : 0;
      
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
        playoff_seed: teamInfo.playoffSeed,
        transactions: moves
      });
    }
  }
  
  standings.sort((a, b) => (a.final_rank || 99) - (b.final_rank || 99));

  // 5. Build Matchups & Weekly Team Scores
  const matchups = [];
  const weekly_team_scores = [];
  const weekly_player_stats = [];
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

      const extractPlayerStats = (sideData, tid, tinfo, oppId, oppName) => {
        const roster = sideData.rosterForCurrentScoringPeriod || sideData.rosterForMatchupPeriod;
        if (!roster || !roster.entries) return;
        for (const entry of roster.entries) {
           const pp = entry.playerPoolEntry;
           if (!pp || !pp.player) continue;
           let actualScore = pp.appliedStatTotal || 0;
           let projScore = 0;
           let statLine = {};

           if (pp.player.stats) {
               const actual = pp.player.stats.find(s => s.statSourceId === 0 && (s.scoringPeriodId === week || s.statSplitTypeId === 1));
               const proj = pp.player.stats.find(s => s.statSourceId === 1 && (s.scoringPeriodId === week || s.statSplitTypeId === 1));
               if (actual) {
                   actualScore = actual.appliedTotal !== undefined ? actual.appliedTotal : actualScore;
                   statLine = actual.stats || statLine;
               }
               if (proj) {
                   projScore = proj.appliedTotal || 0;
               }
           }

           const nflTeam = NFL_TEAMS[pp.player.proTeamId] || '';
           const nflResult = nflTeam ? getNflGameResult(year, week, nflTeam) : '';
           const POS_MAP = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
           const posStr = POS_MAP[pp.player.defaultPositionId] || 'FLEX';
           const isStarter = entry.lineupSlotId !== 20 && entry.lineupSlotId !== 21 && entry.lineupSlotId !== 24;

           weekly_player_stats.push({
              year,
              week,
              team_id: tid,
              team_name: tinfo.name || "",
              manager_id: tinfo.ownerId,
              manager_name: tinfo.ownerName || "",
              opponent_team_id: oppId,
              opponent_team_name: oppName || "",
              player_id: pp.player.id,
              player_name: pp.player.fullName,
              position: posStr,
              lineup_slot_id: entry.lineupSlotId,
              is_starter: isStarter,
              projected_points: Math.round(projScore * 100) / 100,
              fantasy_points: Math.round(actualScore * 100) / 100,
              stat_line: statLine,
              nfl_team: nflTeam,
              nfl_game_result: nflResult,
              is_playoff: isPlayoff,
              is_consolation: isConsolation,
              game_type: gameType,
              ...(playerIdToName.set(pp.player.id, pp.player.fullName) && {})
           });
        }
      };

      extractPlayerStats(home, h_id, h_info, a_id, a_info.name);
      extractPlayerStats(away, a_id, a_info, h_id, h_info.name);

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
        player_name: playerIdToName.get(pick.playerId) || `Player ID ${pick.playerId}`,
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

  // 8. Transactions
  const transactions = [];
  for (const season of seasonsData) {
    const year = season.year;
    for (const t of (season.data.transactions || [])) {
      if (t.status !== 'EXECUTED') continue;
      let processedItems = [];
      if (t.items) {
        for (const item of t.items) {
          processedItems.push({
            player_id: item.playerId,
            player_name: playerIdToName.get(item.playerId) || `Player ID ${item.playerId}`,
            type: item.type, // ADD, DROP, LINEUP
            from_team: item.fromTeamId,
            to_team: item.toTeamId
          });
        }
      }
      // Filter out boring ROSTER moves to keep it clean, unless you want them
      if (t.type === 'ROSTER') continue;
      
      transactions.push({
         year,
         date: t.executionDate || t.proposedDate,
         action_type: t.type, // FREEAGENT, WAIVER, TRADE
         items: processedItems
      });
    }
  }

  const league_settings = {
    name: customName || activeSeason.data.settings?.name || "Fantasy League",
    id: activeSeason.data.id || "",
    firstYear: seasonsData[seasonsData.length - 1].year,
    lastYear: activeYear,
    totalSeasons: seasonsData.length,
    scoringRules: {}
  };

  const scoring_settings = {};

  for (const season of seasonsData) {
    const yr = season.year;
    const scoringItems = season.data.settings?.scoringSettings?.scoringItems || [];
    const yearRules = {};

    for (const item of scoringItems) {
      const sid = item.statId;
      let pts = item.points || 0.0;
      const overrides = item.pointsOverrides || {};
      
      // ESPN overrides D/ST (16) and K (17)
      if (overrides["16"] !== undefined) pts = overrides["16"];
      else if (overrides["17"] !== undefined) pts = overrides["17"];
      else if (overrides["0"] !== undefined) pts = overrides["0"];
      
      if (pts === 0) continue;
      
      if (ESPN_STAT_MAP[sid]) {
        let [category, name] = ESPN_STAT_MAP[sid];
        category = category.replace(/[.#$\[\]]/g, '').replace(/\//g, ' and ').trim();
        let cleanName = name.replace(/\s*\([A-Z0-9+]{2,7}\)$/, "").trim();
        if (!yearRules[category]) {
          yearRules[category] = [];
        }
        yearRules[category].push({ name: cleanName, points: pts, stat_id: sid });
      }
    }

    if (Object.keys(yearRules).length > 0) {
      scoring_settings[yr] = yearRules;
    }
  }

  // Also populate default league_settings.scoringRules from active/latest season
  if (scoring_settings[activeYear]) {
    league_settings.scoringRules = scoring_settings[activeYear];
  } else if (Object.keys(scoring_settings).length > 0) {
    league_settings.scoringRules = Object.values(scoring_settings)[0];
  }

  // Return exactly the payload that `vault.js` expects
  return {
    members: members,
    league_standings: standings,
    team_stats: team_stats,
    matchups: matchups,
    draft_results: draft_results,
    weekly_team_scores: deduped_weekly,
    weekly_player_stats: weekly_player_stats,
    transactions: transactions,
    league_settings: league_settings,
    scoring_settings: scoring_settings
  };
}
