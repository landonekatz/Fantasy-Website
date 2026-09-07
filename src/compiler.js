// Fantasy Vault Data Compiler
// Replicates the core functionality of the Python scraper/parser for client-side execution.
import { nflHistoricalTeams } from './nfl_historical_teams.js';
import { nflGamesService } from './nfl_games.js';

export function generateRandomJoinCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function compileVaultData(rawSeasonsData, uiMembersConfig = [], customName = null, nflCsvData = null, options = {}) {
  if (!rawSeasonsData || rawSeasonsData.length === 0) return null;
  
  const ESPN_STAT_MAP = {
    // Passing
    3: ["Passing", "Passing Yards"],
    4: ["Passing", "TD Pass"],
    7: ["Passing", "Every 20 passing yards"],
    17: ["Passing", "300-399 yard passing game"],
    18: ["Passing", "400+ yard passing game"],
    19: ["Passing", "2pt Passing Conversion"],
    20: ["Passing", "Interceptions Thrown"],

    // Rushing
    24: ["Rushing", "Rushing Yards"],
    25: ["Rushing", "TD Rush"],
    26: ["Rushing", "2pt Rushing Conversion"],
    28: ["Rushing", "Every 10 rushing yards"],
    37: ["Rushing", "100-199 yard rushing game"],
    38: ["Rushing", "200+ yard rushing game"],

    // Receiving
    42: ["Receiving", "Receiving Yards"],
    43: ["Receiving", "TD Reception"],
    44: ["Receiving", "2pt Receiving Conversion"],
    48: ["Receiving", "Every 10 receiving yards"],
    53: ["Receiving", "Each reception"],
    56: ["Receiving", "100-199 yard receiving game"],
    57: ["Receiving", "200+ yard receiving game"],

    // Kicking
    86: ["Kicking", "Each PAT Made"],
    88: ["Kicking", "Extra Point Missed"],
    80: ["Kicking", "FG Made (0-39 yards)"],
    74: ["Kicking", "FG Made (50+ yards)"],
    77: ["Kicking", "FG Made (40-49 yards)"],
    198: ["Kicking", "FG Made (50-59 yards)"],
    201: ["Kicking", "FG Made (60+ yards)"],
    202: ["Kicking", "FG Made (40-49 yards)"],
    203: ["Kicking", "FG Made (50+ yards)"],
    82: ["Kicking", "FG Missed (0-39 yards)"],
    79: ["Kicking", "FG Missed (40-49 yards)"],
    83: ["Kicking", "FG Missed (50+ yards)"],
    204: ["Kicking", "FG Missed (0-39 yards)"],
    205: ["Kicking", "FG Missed (40-49 yards)"],
    206: ["Kicking", "FG Missed (50+ yards)"],

    // Team Defense and Special Teams
    99: ["Team Defense and Special Teams", "Each Sack"],
    95: ["Team Defense and Special Teams", "Each Interception"],
    96: ["Team Defense and Special Teams", "Each Fumble Recovered"],
    97: ["Team Defense and Special Teams", "Each Safety"],
    98: ["Team Defense and Special Teams", "Blocked Punt, PAT or FG"],
    93: ["Team Defense and Special Teams", "Blocked Punt or FG return for TD"],
    101: ["Team Defense and Special Teams", "Interception Return TD"],
    104: ["Team Defense and Special Teams", "Fumble Return TD"],
    102: ["Team Defense and Special Teams", "Kickoff Return TD"],
    103: ["Team Defense and Special Teams", "Punt Return TD"],

    // Defense Points Allowed (PA) - In Ascending Numerical Order
    89: ["Team Defense and Special Teams", "0 points allowed"],
    90: ["Team Defense and Special Teams", "1-6 points allowed"],
    91: ["Team Defense and Special Teams", "7-13 points allowed"],
    92: ["Team Defense and Special Teams", "14-17 points allowed"],
    121: ["Team Defense and Special Teams", "18-21 points allowed"],
    122: ["Team Defense and Special Teams", "22-27 points allowed"],
    123: ["Team Defense and Special Teams", "28-34 points allowed"],
    124: ["Team Defense and Special Teams", "35-45 points allowed"],
    125: ["Team Defense and Special Teams", "46+ points allowed"],

    // Defense Yards Allowed (YA)
    128: ["Team Defense and Special Teams", "Less than 100 total yards allowed"],
    129: ["Team Defense and Special Teams", "100-199 total yards allowed"],
    130: ["Team Defense and Special Teams", "200-299 total yards allowed"],
    131: ["Team Defense and Special Teams", "300-349 total yards allowed"],
    132: ["Team Defense and Special Teams", "350-399 total yards allowed"],
    133: ["Team Defense and Special Teams", "400-449 total yards allowed"],
    134: ["Team Defense and Special Teams", "450-499 total yards allowed"],
    135: ["Team Defense and Special Teams", "500-549 total yards allowed"],
    136: ["Team Defense and Special Teams", "550+ total yards allowed"],

    // Miscellaneous
    72: ["Miscellaneous", "Total Fumbles Lost"]
  };

  const YAHOO_STAT_MAP = {
    4: ["Passing", "Passing Yards"],
    5: ["Passing", "Passing Touchdowns"],
    6: ["Passing", "Interceptions Thrown"],
    8: ["Rushing", "Rushing Attempts"],
    9: ["Rushing", "Rushing Yards"],
    10: ["Rushing", "Rushing Touchdowns"],
    11: ["Receiving", "Receptions"],
    12: ["Receiving", "Receiving Yards"],
    13: ["Receiving", "Receiving Touchdowns"],
    15: ["Returning", "Return Touchdowns"],
    16: ["Miscellaneous", "2-Point Conversions"],
    18: ["Miscellaneous", "Fumbles Lost"],
    57: ["Miscellaneous", "Offensive Fumble Return TD"],
    78: ["Passing", "Pick Sixes Thrown"],
    // Defense / Special Teams
    31: ["Team Defense and Special Teams", "0 points allowed"],
    32: ["Team Defense and Special Teams", "1-6 points allowed"],
    33: ["Team Defense and Special Teams", "7-13 points allowed"],
    34: ["Team Defense and Special Teams", "14-20 points allowed"],
    35: ["Team Defense and Special Teams", "21-27 points allowed"],
    36: ["Team Defense and Special Teams", "28-34 points allowed"],
    37: ["Team Defense and Special Teams", "35+ points allowed"],
    49: ["Team Defense and Special Teams", "Each Sack"],
    50: ["Team Defense and Special Teams", "Each Interception"],
    51: ["Team Defense and Special Teams", "Each Fumble Recovered"],
    52: ["Team Defense and Special Teams", "Touchdown"],
    53: ["Team Defense and Special Teams", "Each Safety"],
    54: ["Team Defense and Special Teams", "Blocked Punt, PAT or FG"],
    // Kicking
    19: ["Kicking", "FG Made (0-19 yards)"],
    20: ["Kicking", "FG Made (20-29 yards)"],
    21: ["Kicking", "FG Made (30-39 yards)"],
    22: ["Kicking", "FG Made (40-49 yards)"],
    23: ["Kicking", "FG Made (50+ yards)"],
    24: ["Kicking", "Each PAT Made"],
    25: ["Kicking", "Extra Point Missed"]
  };

  const SLEEPER_STAT_MAP = {
    // Passing
    pass_yd: ["Passing", "Passing Yards (per yard)"],
    pass_td: ["Passing", "TD Pass"],
    pass_2pt: ["Passing", "2pt Passing Conversion"],
    pass_int: ["Passing", "Interceptions Thrown"],
    pass_int_td: ["Passing", "Pick Six Thrown"],
    pass_comp: ["Passing", "Pass Completion"],
    pass_inc: ["Passing", "Pass Incompletion"],
    pass_att: ["Passing", "Pass Attempt"],
    
    // Rushing
    rush_yd: ["Rushing", "Rushing Yards (per yard)"],
    rush_td: ["Rushing", "TD Rush"],
    rush_2pt: ["Rushing", "2pt Rushing Conversion"],
    rush_att: ["Rushing", "Rush Attempt"],
    
    // Receiving
    rec: ["Receiving", "Each Reception (PPR)"],
    rec_yd: ["Receiving", "Receiving Yards (per yard)"],
    rec_td: ["Receiving", "TD Reception"],
    rec_2pt: ["Receiving", "2pt Receiving Conversion"],
    
    // Miscellaneous
    fum_lost: ["Miscellaneous", "Total Fumbles Lost"],
    fum: ["Miscellaneous", "Fumbles"],
    fum_rec_td: ["Miscellaneous", "Fumble Recovery TD"],
    
    // Kicking
    fgm_0_19: ["Kicking", "FG Made (0-19 yards)"],
    fgm_20_29: ["Kicking", "FG Made (20-29 yards)"],
    fgm_30_39: ["Kicking", "FG Made (30-39 yards)"],
    fgm_40_49: ["Kicking", "FG Made (40-49 yards)"],
    fgm_50_59: ["Kicking", "FG Made (50-59 yards)"],
    fgm_50p: ["Kicking", "FG Made (50+ yards)"],
    fgm_60p: ["Kicking", "FG Made (60+ yards)"],
    xpm: ["Kicking", "Each PAT Made"],
    fgmiss: ["Kicking", "FG Missed"],
    xpmiss: ["Kicking", "Extra Point Missed"],
    
    // Defense / Special Teams
    sack: ["Team Defense and Special Teams", "Each Sack"],
    int: ["Team Defense and Special Teams", "Each Interception"],
    fum_rec: ["Team Defense and Special Teams", "Each Fumble Recovered"],
    safe: ["Team Defense and Special Teams", "Each Safety"],
    def_td: ["Team Defense and Special Teams", "Defensive TD"],
    st_td: ["Team Defense and Special Teams", "Special Teams TD"],
    blk_kick: ["Team Defense and Special Teams", "Blocked Kick"],
    pts_allow_0: ["Team Defense and Special Teams", "0 points allowed"],
    pts_allow_1_6: ["Team Defense and Special Teams", "1-6 points allowed"],
    pts_allow_7_13: ["Team Defense and Special Teams", "7-13 points allowed"],
    pts_allow_14_20: ["Team Defense and Special Teams", "14-20 points allowed"],
    pts_allow_21_27: ["Team Defense and Special Teams", "21-27 points allowed"],
    pts_allow_28_34: ["Team Defense and Special Teams", "28-34 points allowed"],
    pts_allow_35p: ["Team Defense and Special Teams", "35+ points allowed"]
  };

  const NFL_TEAMS = {
    0: 'FA', 1: 'ATL', 2: 'BUF', 3: 'CHI', 4: 'CIN', 5: 'CLE', 6: 'DAL', 7: 'DEN', 8: 'DET', 9: 'GB',
    10: 'TEN', 11: 'IND', 12: 'KC', 13: 'LV', 14: 'LAR', 15: 'MIA', 16: 'MIN', 17: 'NE', 18: 'NO', 19: 'NYG',
    20: 'NYJ', 21: 'PHI', 22: 'ARI', 23: 'PIT', 24: 'LAC', 25: 'SF', 26: 'SEA', 27: 'TB', 28: 'WAS', 29: 'CAR',
    30: 'JAX', 33: 'BAL', 34: 'HOU'
  };

  if (nflCsvData) {
    nflGamesService.loadCsvData(nflCsvData);
  }

  const getNflGameResult = (season, week, team) => {
    return nflGamesService.getGameResult(season, week, team);
  };

  const playerIdToName = new Map();
  const playerIdToPosition = new Map();

  // 0. Filter out unplayed seasons unless a draft has occurred
  let seasonsData = rawSeasonsData.filter(season => {
    const schedule = season.data?.schedule || [];
    const hasFinishedGames = schedule.some(s => s.winner !== 'UNDECIDED' || (s.home && s.home.totalPoints > 0));
    const hasDraftPicks = (season.data?.draftDetail?.drafted === true) || (season.data?.draftDetail?.picks || []).some(p => (p.playerId && p.playerId > 0) || p.playerKey);
    return hasFinishedGames || hasDraftPicks;
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
        if (!canonicalName) canonicalName = m.alias || m.displayName || m.id;
        
        managersMap.set(m.id, {
          id: m.id,
          name: canonicalName,
          firstName: first,
          lastName: last,
          guid: m.guid || '',
          avatar: m.avatar || '',
          platform_ids: [m.id],
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
        if (m.guid && !existing.guid) existing.guid = m.guid;
        if (m.avatar && !existing.avatar) existing.avatar = m.avatar;
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
              
              // Merge platform_ids and espn_ids without duplicates
              if (!target.platform_ids) target.platform_ids = [target.id];
              for (const pid of (source.platform_ids || [])) {
                  if (!target.platform_ids.includes(pid)) target.platform_ids.push(pid);
              }
              if (!target.espn_ids) target.espn_ids = [target.id];
              for (const eid of (source.espn_ids || [])) {
                  if (!target.espn_ids.includes(eid)) target.espn_ids.push(eid);
              }
              if (source.guid && !target.guid) target.guid = source.guid;
              if (source.avatar && !target.avatar) target.avatar = source.avatar;
              if (source.logo_url && !target.logo_url) target.logo_url = source.logo_url;
              
              if (source.lastSeenYear > target.lastSeenYear) {
                  target.lastSeenYear = source.lastSeenYear;
              }
              if (source.isActive) target.isActive = true;
              
              managersMap.delete(config.id);
          }
      }
  }

  // Transitive resolution for chained merges (e.g. Account1 -> Account2 -> Account3)
  for (const [orig, canon] of originalToCanonicalMap.entries()) {
      let current = canon;
      const visited = new Set([orig]);
      while (originalToCanonicalMap.has(current) && originalToCanonicalMap.get(current) !== current && !visited.has(current)) {
          visited.add(current);
          current = originalToCanonicalMap.get(current);
      }
      originalToCanonicalMap.set(orig, current);
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
        ownerName: (ownerInfo && ownerInfo.name) || (uiMembersConfig.find(m => m.id === canonicalOwnerId)?.alias || uiMembersConfig.find(m => m.id === canonicalOwnerId)?.name) || 'Unknown',
        playoffSeed: t.playoffSeed || 99,
        finalRank: t.rankCalculatedFinal || t.rankFinal || 99,
      };

      if (t.roster && Array.isArray(t.roster.entries)) {
        for (const entry of t.roster.entries) {
          const p = entry.playerPoolEntry?.player;
          if (p && p.id) {
            const name = p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim();
            if (name) playerIdToName.set(p.id, name);
            const posId = p.defaultPositionId;
            const posMap = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'DEF' };
            if (posMap[posId]) playerIdToPosition.set(p.id, posMap[posId]);
          }
        }
      }
    }
  }

  // 4. Build Standings
  const standings = [];
  for (const season of seasonsData) {
    const teams = season.data.teams || [];
    for (const t of teams) {
      const overall = t.record?.overall || { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };
      const teamInfo = teamMap[season.year] && teamMap[season.year][t.id];
      
      if (!teamInfo || !teamInfo.ownerId) continue;
      
      const moves = t.transactionCounter ? ((t.transactionCounter.acquisitions || 0) + (t.transactionCounter.trades || 0)) : 0;
      
      const schedSettings = season.data.settings?.scheduleSettings || {};
      const playoffTeamsCount = schedSettings.playoffTeamCount || 6;
      const isPlayoffMaker = (t.made_playoffs !== undefined) ? 
        (t.made_playoffs === true || String(t.made_playoffs).toLowerCase() === 'true') : 
        (teamInfo.playoffSeed <= playoffTeamsCount);

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
        made_playoffs: isPlayoffMaker,
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
           let pId = null;
           let pName = '';
           let posStr = 'FLEX';
           let nflTeam = '';
           let nflResult = '';
           let isStarter = true;
           let actualScore = 0;
           let projScore = 0;
           let statLine = {};
           let lineupSlotId = entry.lineupSlotId || 0;
           let headshotUrl = entry.headshotUrl || '';
           let injuryStatus = entry.injuryStatus || null;

           if (entry.playerPoolEntry && entry.playerPoolEntry.player) {
             // ESPN format
             const pp = entry.playerPoolEntry;
             pId = pp.player.id;
             pName = pp.player.fullName;
             actualScore = pp.appliedStatTotal || 0;

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

             nflTeam = NFL_TEAMS[pp.player.proTeamId] || '';
             nflResult = nflTeam ? getNflGameResult(year, week, nflTeam) : '';
             const POS_MAP = { 1: 'QB', 2: 'RB', 3: 'WR', 4: 'TE', 5: 'K', 16: 'D/ST' };
             posStr = POS_MAP[pp.player.defaultPositionId] || 'FLEX';
             isStarter = entry.lineupSlotId !== 20 && entry.lineupSlotId !== 21 && entry.lineupSlotId !== 24;
           } else if (entry.playerName || entry.playerId || entry.playerKey) {
             // Yahoo / Sleeper format
             pId = entry.playerId || entry.playerKey;
             pName = entry.playerName || `Player ${pId}`;
             posStr = entry.position || 'FLEX';
             nflTeam = entry.nflTeam || '';
             nflResult = nflTeam ? getNflGameResult(year, week, nflTeam) : '';
             isStarter = entry.isStarter !== undefined ? entry.isStarter : (entry.rosterSlot !== 'BN' && entry.rosterSlot !== 'IR');
             actualScore = entry.points || 0;
             projScore = entry.projectedPoints || 0;
             statLine = entry.rawStats || {};
             headshotUrl = entry.headshotUrl || '';
             injuryStatus = entry.injuryStatus || null;
             // Sleeper/Yahoo entries don't have ESPN lineup_slot_id. Default to -1 (no slot)
             // so the ESPN slot tests (e.g. lineup_slot_id === 0 = QB) never falsely match.
             lineupSlotId = (entry.lineupSlotId !== undefined && entry.lineupSlotId !== null) ? entry.lineupSlotId : -1;
           } else {
             continue;
           }

           weekly_player_stats.push({
              year,
              week,
              team_id: tid,
              team_name: tinfo.name || "",
              manager_id: tinfo.ownerId,
              manager_name: tinfo.ownerName || "",
              opponent_team_id: oppId,
              opponent_team_name: oppName || "",
              player_id: pId,
              player_name: pName,
              position: posStr,
              roster_slot: entry.rosterSlot || null,  // actual lineup slot for Yahoo/Sleeper; null for ESPN (uses lineup_slot_id)
              lineup_slot_id: lineupSlotId,
              is_starter: isStarter,
              projected_points: Math.round(projScore * 100) / 100,
              fantasy_points: Math.round(actualScore * 100) / 100,
              stat_line: statLine,
              nfl_team: nflTeam,
              nfl_game_result: nflResult,
              is_playoff: isPlayoff,
              is_consolation: isConsolation,
              game_type: gameType,
              headshot_url: headshotUrl,
              injury_status: injuryStatus,
              ...(pId && pName ? (playerIdToName.set(pId, pName) && {}) : {}),
              ...(pId && posStr ? (playerIdToPosition.set(pId, posStr) && {}) : {})
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

        const gamePlayed = h_score > 0 || a_score > 0 || (winner !== "UNDECIDED" && winner !== "");
        if (gamePlayed) {
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
      const pId = pick.playerId || pick.playerKey;
      if (!pId && !pick.playerName) continue;
      const tid = pick.teamId;
      const tinfo = (teamMap[year] && teamMap[year][tid]) || {};
      const pName = pick.playerName || (pId ? playerIdToName.get(pId) : null) || `Player ID ${pId}`;
      const pos = pick.position || (pId ? playerIdToPosition.get(pId) : '') || '';
      const histTeam = pick.nflTeam || nflHistoricalTeams.getTeam(pName, year, pos);
      draft_results.push({
        year,
        overall_pick: pick.overallPickNumber || pick.overallPick,
        round: pick.roundId || pick.round,
        round_pick: pick.roundPickNumber || pick.pickInRound,
        team_id: tid,
        team_name: tinfo.name || "",
        manager_id: tinfo.ownerId,
        manager_name: tinfo.ownerName || "",
        player_id: pId || 0,
        player_name: pName,
        position: pos,
        nfl_team: histTeam || "",
        headshot_url: pick.headshotUrl || pick.headshot_url || "",
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
      if (t.status && t.status !== 'EXECUTED' && t.status !== 'successful') continue;

      if (t.players && Array.isArray(t.players)) {
        // Yahoo normalized format
        const addedPlayers = t.players.filter(p => p.action === 'add').map(p => p.name);
        const droppedPlayers = t.players.filter(p => p.action === 'drop').map(p => p.name);
        const formattedTimestamp = t.timestamp ? new Date(t.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
        const parts = [];
        if (addedPlayers.length > 0) parts.push(`Added: ${addedPlayers.join(', ')}`);
        if (droppedPlayers.length > 0) parts.push(`Dropped: ${droppedPlayers.join(', ')}`);
        if (t.faabBid > 0) parts.push(`FAAB: $${t.faabBid}`);

        transactions.push({
          year,
          season: year,
          date: t.timestamp,
          timestamp: formattedTimestamp,
          action_type: t.type,
          type: t.type === 'trade' ? 'trade' : (t.faabBid > 0 ? 'waiver' : 'free_agent'),
          team_id: t.teamId || 1,
          team_name: t.teamName || '',
          manager_id: '',
          manager_name: '',
          added_players: addedPlayers,
          dropped_players: droppedPlayers,
          traded_players: [],
          faab_bid: t.faabBid || 0,
          details: parts.join(' · ') || t.type,
          items: []
        });
        continue;
      }

      let processedItems = [];
      const addedPlayers = [];
      const droppedPlayers = [];
      const tradedPlayers = [];
      let primaryTeamId = null;

      if (t.items) {
        for (const item of t.items) {
          const pName = playerIdToName.get(item.playerId) || `Player ID ${item.playerId}`;
          processedItems.push({
            player_id: item.playerId,
            player_name: pName,
            type: item.type, // ADD, DROP, LINEUP
            from_team: item.fromTeamId,
            to_team: item.toTeamId
          });
          if (item.type === 'ADD') {
            addedPlayers.push(pName);
            if (primaryTeamId === null && item.toTeamId) primaryTeamId = item.toTeamId;
          }
          if (item.type === 'DROP') {
            droppedPlayers.push(pName);
            if (primaryTeamId === null && item.fromTeamId) primaryTeamId = item.fromTeamId;
          }
          if (t.type === 'TRADE') {
            tradedPlayers.push(pName);
          }
        }
      }
      // Filter out boring ROSTER moves to keep it clean, unless you want them
      if (t.type === 'ROSTER') continue;
      
      const tInfo = (primaryTeamId !== null && teamMap[year] && teamMap[year][primaryTeamId]) || {};
      const execDate = t.executionDate || t.proposedDate;
      const formattedTimestamp = execDate ? new Date(execDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
      
      let details = '';
      if (t.type === 'TRADE') {
        details = `Trade: ${tradedPlayers.join(', ')}`;
      } else {
        const parts = [];
        if (addedPlayers.length > 0) parts.push(`Added: ${addedPlayers.join(', ')}`);
        if (droppedPlayers.length > 0) parts.push(`Dropped: ${droppedPlayers.join(', ')}`);
        if (t.bidAmount > 0) parts.push(`FAAB: $${t.bidAmount}`);
        details = parts.join(' · ');
      }

      transactions.push({
         year,
         season: year,
         date: execDate,
         timestamp: formattedTimestamp,
         action_type: t.type, // FREEAGENT, WAIVER, TRADE
         type: t.type === 'FREEAGENT' ? 'free_agent' : (t.type === 'TRADE' ? 'trade' : 'waiver'),
         team_id: primaryTeamId,
         team_name: tInfo.name || '',
         manager_id: tInfo.ownerId || '',
         manager_name: tInfo.ownerName || '',
         added_players: addedPlayers,
         dropped_players: droppedPlayers,
         traded_players: tradedPlayers,
         faab_bid: t.bidAmount || 0,
         details: details,
         items: processedItems
      });
    }
  }

  const league_settings = {
    name: customName || activeSeason.data.settings?.name || "Fantasy League",
    tagline: "In a league of our own",
    subtitle: "In a league of our own",
    id: activeSeason.data.id || "",
    firstYear: seasonsData[seasonsData.length - 1].year,
    lastYear: activeYear,
    totalSeasons: seasonsData.length,
    join_code: generateRandomJoinCode(),
    scoringRules: {},
    ...(options.seasonLabelConvention ? { seasonLabelConvention: options.seasonLabelConvention } : {}),
    ...(options.leagueSettingsOverrides || {})
  };

  const scoring_settings = {};

  for (const season of seasonsData) {
    const yr = season.year;
    const scoringItems = season.data.settings?.scoringSettings?.scoringItems || [];
    const yearRules = {};

    for (const item of scoringItems) {
      const sid = item.statId;
      if (ESPN_STAT_MAP[sid]) {
        let [category, name] = ESPN_STAT_MAP[sid];
        let pts = item.points !== undefined ? item.points : 0.0;
        const overrides = item.pointsOverrides || {};
        
        // Map overrides strictly according to the specific category
        if (category.includes('Defense') && overrides["16"] !== undefined) {
          pts = overrides["16"];
        } else if (category.includes('Kicking') && overrides["17"] !== undefined) {
          pts = overrides["17"];
        } else if (category.includes('Passing') && overrides["0"] !== undefined) {
          pts = overrides["0"];
        } else if (category.includes('Rushing') && overrides["2"] !== undefined) {
          pts = overrides["2"];
        } else if (category.includes('Receiving') && overrides["4"] !== undefined) {
          pts = overrides["4"];
        }
        
        if (pts === 0) continue;

        category = category.replace(/[.#$\[\]]/g, '').replace(/\//g, ' and ').trim();
        let cleanName = name.replace(/\s*\([A-Z0-9+]{2,7}\)$/, "").trim();
        if (!yearRules[category]) {
          yearRules[category] = [];
        }
        yearRules[category].push({ name: cleanName, points: pts, stat_id: sid });
      }
    }

    // Check Yahoo stat modifiers
    const yahooStatMods = season.data.settings?.scoringSettings?.stats || [];
    if (yahooStatMods.length > 0) {
      for (const item of yahooStatMods) {
        const sid = parseInt(item.stat?.stat_id || item.stat_id);
        const val = parseFloat(item.stat?.value !== undefined ? item.stat.value : (item.value !== undefined ? item.value : 0));
        if (YAHOO_STAT_MAP[sid] && val !== 0) {
          let [category, name] = YAHOO_STAT_MAP[sid];
          if (!yearRules[category]) yearRules[category] = [];
          yearRules[category].push({ name, points: val, stat_id: sid });
        }
      }
    }

    // Check Sleeper stat rules
    const sleeperRules = season.data.settings?.scoringSettings?.sleeperRules;
    if (sleeperRules && typeof sleeperRules === 'object') {
      for (const [key, val] of Object.entries(sleeperRules)) {
        const numVal = parseFloat(val);
        if (SLEEPER_STAT_MAP[key] && numVal !== 0) {
          let [category, name] = SLEEPER_STAT_MAP[key];
          if (!yearRules[category]) yearRules[category] = [];
          yearRules[category].push({ name, points: numVal, stat_id: key });
        }
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
    scoring_settings: scoring_settings,
    seasonLabelConvention: options.seasonLabelConvention || league_settings.seasonLabelConvention || 'kickoff',
    paradigms: options.paradigms || {}
  };
}

export function testScoringRulesRetrospective(compiledData) {
  if (!compiledData) return { passed: false, reason: "No data provided" };
  const weeklyStats = compiledData.weekly_player_stats || [];
  const scoringSettings = compiledData.scoring_settings || {};
  const leagueSettings = compiledData.league_settings || {};

  if (weeklyStats.length === 0) {
    return { passed: true, sampleCount: 0, message: "No weekly player stats found to test." };
  }

  const results = {
    totalTested: 0,
    passed: 0,
    failed: 0,
    samplesByPosition: {},
    discrepancies: []
  };

  const samplePool = [];
  const posBuckets = {};

  weeklyStats.forEach(st => {
    if (!st.stats || Object.keys(st.stats).length === 0) return;
    const pos = st.position || 'FLEX';
    if (!posBuckets[pos]) posBuckets[pos] = [];
    if (posBuckets[pos].length < 15) {
      posBuckets[pos].push(st);
      samplePool.push(st);
    }
  });

  samplePool.forEach(player => {
    const yr = player.season || player.year;
    const rules = (scoringSettings[yr] || scoringSettings[String(yr)] || leagueSettings.scoringRules || {});
    
    const statRuleMap = {};
    Object.values(rules).forEach(categoryItems => {
      if (Array.isArray(categoryItems)) {
        categoryItems.forEach(item => {
          if (item.stat_id !== undefined) {
            statRuleMap[item.stat_id] = Number(item.points);
          }
        });
      }
    });

    let computedPts = 0;
    Object.entries(player.stats).forEach(([statIdStr, rawVal]) => {
      const sid = Number(statIdStr);
      const val = Number(rawVal) || 0;
      if (statRuleMap[sid] !== undefined) {
        if (sid === 3) computedPts += (val / 25) * (statRuleMap[sid] || 1);
        else if (sid === 24) computedPts += (val / 10) * (statRuleMap[sid] || 1);
        else if (sid === 42) computedPts += (val / 10) * (statRuleMap[sid] || 1);
        else computedPts += val * statRuleMap[sid];
      }
    });

    const recordedPts = Number(player.fantasy_points !== undefined ? player.fantasy_points : player.fantasyPoints) || 0;
    const diff = Math.abs(computedPts - recordedPts);
    const passed = diff <= 0.15;

    results.totalTested++;
    const pos = player.position || 'OTHER';
    if (!results.samplesByPosition[pos]) results.samplesByPosition[pos] = { tested: 0, passed: 0, failed: 0 };
    results.samplesByPosition[pos].tested++;

    if (passed) {
      results.passed++;
      results.samplesByPosition[pos].passed++;
    } else {
      results.failed++;
      results.samplesByPosition[pos].failed++;
      if (results.discrepancies.length < 10) {
        results.discrepancies.push({
          player: player.player_name,
          position: pos,
          season: yr,
          week: player.week,
          recordedPts,
          computedPts: Math.round(computedPts * 100) / 100,
          diff: Math.round(diff * 100) / 100,
          rawStats: player.stats
        });
      }
    }
  });

  const overallPassed = results.failed === 0 || (results.passed / results.totalTested >= 0.90);
  console.log(`[Scoring Rules Retrospective Test] Tested ${results.totalTested} samples: ${results.passed} passed, ${results.failed} failed. Status: ${overallPassed ? 'PASSED' : 'FLAGGED'}`);
  return {
    ...results,
    passed: overallPassed
  };
}

/**
 * Returns a human-readable description of a loser condition rule configuration.
 */
export function getRuleDescription(ruleConfig = {}) {
  if (!ruleConfig) return '12th Place (Toilet Bowl / Consolation Bracket Loser)';
  if (ruleConfig.description) return ruleConfig.description;
  if (ruleConfig.mode === 'manual') return `Manual commissioner designation: ${ruleConfig.custom_reason || 'Custom League Punishment'}`;

  const scopeNames = {
    'full_season': 'End of Full Season (All Weeks through Playoffs)',
    'regular_season': 'End of Regular Season',
    'bracket_playoffs': 'Final Playoff / Consolation Bracket Standing'
  };
  const poolNames = {
    'all_teams': 'all 12 league members',
    'non_playoff_teams': 'non-playoff teams only',
    'bracket_consolation': 'consolation bracket participants'
  };
  const critNames = {
    'least_points': 'Least Points Scored',
    'worst_record': 'Worst Record (Win %)',
    'final_rank': '12th Place / Bracket Finish',
    'most_points_against': 'Most Points Against',
    'head_to_head': 'Head-to-Head Record'
  };

  const s = scopeNames[ruleConfig.scope] || scopeNames['bracket_playoffs'];
  const p = poolNames[ruleConfig.pool] || poolNames['all_teams'];
  const c1 = critNames[ruleConfig.criteria?.[0]?.type || ruleConfig.criteria?.[0]] || critNames['least_points'];
  const c2 = critNames[ruleConfig.criteria?.[1]?.type || ruleConfig.criteria?.[1]];

  let desc = `${c1} across ${p} at ${s}`;
  if (c2 && c2 !== 'None' && c2 !== undefined) {
    desc += `, tiebreaker by ${c2}`;
  }
  return desc;
}

/**
 * Evaluates standings and matchups according to a season's loser condition rule to determine the official loser.
 */
export function calculateSeasonLoser(year, standings = [], matchups = [], loserConditions = {}, leagueSettings = {}) {
  const yr = Number(year);
  const seasonStandings = (standings || []).filter(s => Number(s.year || s.season) === yr);
  if (seasonStandings.length === 0) return null;

  // Guard: if no games have been played yet (everyone at 0-0 with 0 points),
  // the season hasn't started — don't fabricate a loser.
  const totalGamesPlayed = seasonStandings.reduce((sum, s) => sum + (Number(s.wins) || 0) + (Number(s.losses) || 0) + (Number(s.ties) || 0), 0);
  const totalPointsScored = seasonStandings.reduce((sum, s) => sum + (Number(s.points_for) || 0), 0);
  if (totalGamesPlayed === 0 && totalPointsScored === 0) return null;

  const seasonMatchups = (matchups || []).filter(m => Number(m.year || m.season) === yr);

  const conditionsMap = loserConditions || leagueSettings?.loser_conditions || {};
  const ruleConfig = conditionsMap[yr] || conditionsMap[String(yr)] || conditionsMap['default'] || {
    mode: 'standard',
    scope: 'bracket_playoffs',
    pool: 'bracket_consolation',
    criteria: [{ type: 'final_rank', order: 'desc' }],
    description: 'Final Playoff / Consolation Bracket Rank (12th Place)'
  };

  // If manual override mode
  if (ruleConfig.mode === 'manual' && ruleConfig.designated_manager_id) {
    const targetStanding = seasonStandings.find(s => (s.manager_id || s.id) === ruleConfig.designated_manager_id);
    const mName = targetStanding ? (targetStanding.manager_name || targetStanding.name) : (ruleConfig.designated_manager_name || 'Designated Manager');
    return {
      manager_id: ruleConfig.designated_manager_id,
      manager_name: mName,
      team_name: targetStanding ? (targetStanding.team_name || '') : '',
      year: yr,
      rule_type: 'manual',
      rule_description: ruleConfig.description || `Manual commissioner designation: ${ruleConfig.custom_reason || 'Custom League Punishment'}`,
      stats_summary: ruleConfig.custom_reason || 'Manual Selection',
      raw_team: targetStanding || null,
      ranked_pool: seasonStandings
    };
  }

  // Compile team stats
  const teamStats = {};
  for (const s of seasonStandings) {
    const mid = s.manager_id || s.id;
    const tid = s.team_id || s.id;
    const madePlayoffs = s.made_playoffs !== undefined ?
      (s.made_playoffs === true || String(s.made_playoffs).toLowerCase() === 'true') :
      (s.playoff_seed ? s.playoff_seed <= 6 : false);

    teamStats[mid] = {
      manager_id: mid,
      manager_name: s.manager_name || s.name || 'Unknown',
      team_id: tid,
      team_name: s.team_name || '',
      final_rank: Number(s.final_rank || s.rank) || 99,
      playoff_seed: Number(s.playoff_seed) || 99,
      made_playoffs: madePlayoffs,
      reg_wins: Number(s.wins) || 0,
      reg_losses: Number(s.losses) || 0,
      reg_ties: Number(s.ties) || 0,
      reg_points_for: Number(s.points_for) || 0,
      reg_points_against: Number(s.points_against) || 0,
      reg_win_pct: (Number(s.wins) || 0) + (Number(s.losses) || 0) + (Number(s.ties) || 0) > 0 ?
        ((Number(s.wins) || 0) + 0.5 * (Number(s.ties) || 0)) / ((Number(s.wins) || 0) + (Number(s.losses) || 0) + (Number(s.ties) || 0)) : (Number(s.win_pct) || 0),
      full_points_for: Number(s.points_for) || 0,
      full_points_against: Number(s.points_against) || 0,
      full_wins: Number(s.wins) || 0,
      full_losses: Number(s.losses) || 0,
      full_ties: Number(s.ties) || 0,
      full_win_pct: 0,
      has_matchup_data: false
    };
  }

  // Accumulate matchup data for full-season calculations
  if (seasonMatchups.length > 0) {
    const matchupPF = {};
    const matchupPA = {};
    const matchupW = {};
    const matchupL = {};
    const matchupT = {};

    for (const m of seasonMatchups) {
      const hId = m.home_team_id !== undefined ? m.home_team_id : (m.team_1_id !== undefined ? m.team_1_id : m.home_manager_id);
      const aId = m.away_team_id !== undefined ? m.away_team_id : (m.team_2_id !== undefined ? m.team_2_id : m.away_manager_id);
      const hMid = m.home_manager_id || m.team_1_manager_id;
      const aMid = m.away_manager_id || m.team_2_manager_id;
      const hPts = Number(m.home_score !== undefined ? m.home_score : m.team_1_actual_points) || 0;
      const aPts = Number(m.away_score !== undefined ? m.away_score : m.team_2_actual_points) || 0;

      const targetH = hMid || Object.keys(teamStats).find(k => teamStats[k].team_id === hId);
      const targetA = aMid || Object.keys(teamStats).find(k => teamStats[k].team_id === aId);

      if (targetH) {
        matchupPF[targetH] = (matchupPF[targetH] || 0) + hPts;
        matchupPA[targetH] = (matchupPA[targetH] || 0) + aPts;
        if (hPts > aPts) matchupW[targetH] = (matchupW[targetH] || 0) + 1;
        else if (hPts < aPts) matchupL[targetH] = (matchupL[targetH] || 0) + 1;
        else matchupT[targetH] = (matchupT[targetH] || 0) + 1;
      }
      if (targetA) {
        matchupPF[targetA] = (matchupPF[targetA] || 0) + aPts;
        matchupPA[targetA] = (matchupPA[targetA] || 0) + hPts;
        if (aPts > hPts) matchupW[targetA] = (matchupW[targetA] || 0) + 1;
        else if (aPts < hPts) matchupL[targetA] = (matchupL[targetA] || 0) + 1;
        else matchupT[targetA] = (matchupT[targetA] || 0) + 1;
      }
    }

    for (const mid of Object.keys(teamStats)) {
      if (matchupPF[mid] !== undefined) {
        teamStats[mid].full_points_for = Math.round(matchupPF[mid] * 100) / 100;
        teamStats[mid].full_points_against = Math.round((matchupPA[mid] || 0) * 100) / 100;
        teamStats[mid].full_wins = matchupW[mid] || 0;
        teamStats[mid].full_losses = matchupL[mid] || 0;
        teamStats[mid].full_ties = matchupT[mid] || 0;
        const totalG = teamStats[mid].full_wins + teamStats[mid].full_losses + teamStats[mid].full_ties;
        teamStats[mid].full_win_pct = totalG > 0 ? (teamStats[mid].full_wins + 0.5 * teamStats[mid].full_ties) / totalG : 0;
        teamStats[mid].has_matchup_data = true;
      }
    }
  }

  let candidatePool = Object.values(teamStats);

  // Filter pool
  const pool = ruleConfig.pool || 'all_teams';
  if (pool === 'non_playoff_teams') {
    const nonPlayoff = candidatePool.filter(t => !t.made_playoffs);
    if (nonPlayoff.length > 0) candidatePool = nonPlayoff;
  }

  // Sort candidate pool by criteria chain
  const scope = ruleConfig.scope || (ruleConfig.type === 'least_points' ? 'full_season' : 'bracket_playoffs');
  const criteria = (ruleConfig.criteria && ruleConfig.criteria.length > 0) ? ruleConfig.criteria : [
    { type: ruleConfig.type || (scope === 'bracket_playoffs' ? 'final_rank' : 'least_points'), order: 'asc' }
  ];

  candidatePool.sort((a, b) => {
    for (const crit of criteria) {
      const critType = crit.type || crit;
      if (critType === 'least_points') {
        const ptsA = scope === 'regular_season' ? a.reg_points_for : a.full_points_for;
        const ptsB = scope === 'regular_season' ? b.reg_points_for : b.full_points_for;
        if (Math.abs(ptsA - ptsB) > 0.001) return ptsA - ptsB;
      } else if (critType === 'worst_record') {
        const pctA = scope === 'full_season' && a.has_matchup_data ? a.full_win_pct : a.reg_win_pct;
        const pctB = scope === 'full_season' && b.has_matchup_data ? b.full_win_pct : b.reg_win_pct;
        if (Math.abs(pctA - pctB) > 0.0001) return pctA - pctB;
        const winsA = scope === 'full_season' && a.has_matchup_data ? a.full_wins : a.reg_wins;
        const winsB = scope === 'full_season' && b.has_matchup_data ? b.full_wins : b.reg_wins;
        if (winsA !== winsB) return winsA - winsB;
      } else if (critType === 'final_rank') {
        if (a.final_rank !== b.final_rank) return b.final_rank - a.final_rank;
      } else if (critType === 'most_points_against') {
        const paA = scope === 'regular_season' ? a.reg_points_against : a.full_points_against;
        const paB = scope === 'regular_season' ? b.reg_points_against : b.full_points_against;
        if (Math.abs(paA - paB) > 0.001) return paB - paA;
      } else if (critType === 'head_to_head') {
        if (seasonMatchups.length > 0) {
          const mAB = seasonMatchups.filter(m => 
            ((m.home_manager_id === a.manager_id && m.away_manager_id === b.manager_id) ||
             (m.home_manager_id === b.manager_id && m.away_manager_id === a.manager_id))
          );
          let aWins = 0, bWins = 0;
          mAB.forEach(m => {
            const hMid = m.home_manager_id;
            const hPts = Number(m.home_score || m.team_1_actual_points) || 0;
            const aPts = Number(m.away_score || m.team_2_actual_points) || 0;
            if (hPts > aPts) {
              if (hMid === a.manager_id) aWins++; else bWins++;
            } else if (aPts > hPts) {
              if (hMid === a.manager_id) bWins++; else aWins++;
            }
          });
          if (aWins !== bWins) return aWins - bWins;
        }
      }
    }
    // Fallback tiebreaker: least points
    const finalPtsA = scope === 'regular_season' ? a.reg_points_for : a.full_points_for;
    const finalPtsB = scope === 'regular_season' ? b.reg_points_for : b.full_points_for;
    return finalPtsA - finalPtsB;
  });

  const loserTeam = candidatePool[0];
  if (!loserTeam) return null;

  const usedPts = scope === 'regular_season' ? loserTeam.reg_points_for : loserTeam.full_points_for;
  const usedWins = (scope === 'full_season' && loserTeam.has_matchup_data) ? loserTeam.full_wins : loserTeam.reg_wins;
  const usedLosses = (scope === 'full_season' && loserTeam.has_matchup_data) ? loserTeam.full_losses : loserTeam.reg_losses;
  const usedTies = (scope === 'full_season' && loserTeam.has_matchup_data) ? loserTeam.full_ties : loserTeam.reg_ties;
  const recordStr = `${usedWins}-${usedLosses}${usedTies > 0 ? `-${usedTies}` : ''}`;

  let statSummary = `${usedPts.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} Total Pts (${recordStr})`;
  if (scope === 'bracket_playoffs' && loserTeam.final_rank) {
    statSummary = `${loserTeam.final_rank}th Place (${usedPts.toFixed(1)} Pts, ${recordStr})`;
  }

  return {
    manager_id: loserTeam.manager_id,
    manager_name: loserTeam.manager_name,
    team_id: loserTeam.team_id,
    team_name: loserTeam.team_name,
    year: yr,
    rule_type: ruleConfig.scope || 'bracket_playoffs',
    rule_description: ruleConfig.description || getRuleDescription(ruleConfig),
    stats_summary: statSummary,
    raw_team: loserTeam,
    ranked_pool: candidatePool
  };
}
