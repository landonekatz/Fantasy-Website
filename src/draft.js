/**
 * VaultDraftEngine
 * Full implementation of the Landon Draft Index (LDI) framework
 * According to landon_draft_index_framework.md
 */

import { nflStats } from './nfl_stats.js';
import { nflHistoricalTeams } from './nfl_historical_teams.js';
import { ldiEngine, LDIEngine, normalizeName } from './ldi_engine.js';
import { formatManagerDisplayName } from './formatters.js';

function normalizePosition(rawPos, playerName = '') {
    const p = String(rawPos || '').trim().toUpperCase();
    const name = String(playerName || '').trim().toLowerCase();

    if (name.includes('d/st') || name.includes('defense') || p.includes('DEF') || p.includes('DST') || p === 'D/ST') return 'DEF';
    if (p.startsWith('QB')) return 'QB';
    if (p.startsWith('RB')) return 'RB';
    if (p.startsWith('WR')) return 'WR';
    if (p.startsWith('TE')) return 'TE';
    if (p.startsWith('K') || p.startsWith('PK') || name.includes('kicker')) return 'K';
    return null;
}

function normPlayerName(name) {
    if (!name) return '';
    return String(name).toLowerCase()
        .replace(/\b(jr\.?|sr\.?|ii|iii|iv|v)\b/gi, '')
        .replace(/[^a-z0-9]/gi, '')
        .trim();
}

export class VaultDraftEngine {
    constructor(options = {}) {
        this.containerId = options.containerId || 'view-draft';
        this.draftResults = this.normalizeDraftResults(options.draftResults);
        this.weeklyPlayerStats = this.normalizeWeeklyStats(options.weeklyPlayerStats);
        this.matchups = Array.isArray(options.matchups) ? options.matchups : (options.matchups?.matchups || []);
        this.transactions = Array.isArray(options.transactions) ? options.transactions : (options.transactions?.transactions || []);
        this.managers = this.normalizeManagers(options.managers);
        this.leagueSettings = options.leagueSettings || {};
        this.scoringSettings = options.scoringSettings || {};
        this.options = options;
        this.seasonLabelConvention = options.seasonLabelConvention || options.leagueSettings?.seasonLabelConvention || 'kickoff';
        
        this.subTab = 'yearly'; // 'yearly' | 'overall' | 'team'
        this.nameMode = 'manager'; // 'manager' | 'team'
        this.displayGrouping = 'round'; // 'round' | 'manager'
        this.selectedYear = null;
        this.selectedManagerId = null;
        this.showLeagueAvg = true; // Toggle for solo team graph comparison line
        this.overallYearFilter = 'all'; // 'all' | '2020-present' | 'custom' | specific year e.g. '2024'
        this.overallCustomStart = null;
        this.overallCustomEnd = null;
        this.overallIncludeRetired = false; // toggle to include retired managers in overall
        this.soloYearFilter = 'all'; // 'all' | '2020-present' | 'custom' | specific year e.g. '2024'
        this.soloCustomStart = null;
        this.soloCustomEnd = null;
        this.soloIncludeRetired = false; // toggle to show retired managers in solo profile
        this.seasons = [];
        this.playerTruePositions = {};
        
        // Listen to LDI tuning changes for live instant re-render
        this.unsubscribeLdi = ldiEngine.subscribe(() => {
            this.render();
        });

        this.init();
    }

    formatSeasonYear(year) {
        if (year === undefined || year === null) return "";
        const num = Number(year);
        if (isNaN(num)) return `${year}`;
        const isChampionship = (this.seasonLabelConvention === 'championship' || this.leagueSettings?.seasonLabelConvention === 'championship');
        return isChampionship ? `${num + 1}` : `${num}`;
    }

    normalizeDraftResults(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw.draft_results)) return raw.draft_results;
        if (Array.isArray(raw.picks)) return raw.picks;
        if (Array.isArray(raw.drafts)) return raw.drafts;
        if (typeof raw === 'object') {
            const flattened = [];
            Object.entries(raw).forEach(([yrKey, val]) => {
                if (Array.isArray(val)) {
                    val.forEach(p => {
                        flattened.push({
                            ...p,
                            year: p.year || p.season || (isNaN(Number(yrKey)) ? undefined : Number(yrKey))
                        });
                    });
                }
            });
            if (flattened.length > 0) return flattened;
        }
        return [];
    }

    normalizeWeeklyStats(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw.weekly_player_stats)) return raw.weekly_player_stats;
        if (Array.isArray(raw.stats)) return raw.stats;
        if (Array.isArray(raw.player_stats)) return raw.player_stats;
        return [];
    }

    normalizeManagers(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (Array.isArray(raw.managers)) return raw.managers;
        if (Array.isArray(raw.members)) return raw.members;
        return [];
    }

    updateData(options = {}) {
        if (options.draftResults !== undefined) {
            this.draftResults = this.normalizeDraftResults(options.draftResults);
        }
        if (options.weeklyPlayerStats !== undefined) {
            this.weeklyPlayerStats = this.normalizeWeeklyStats(options.weeklyPlayerStats);
        }
        if (options.matchups !== undefined) {
            this.matchups = Array.isArray(options.matchups) ? options.matchups : (options.matchups?.matchups || []);
        }
        if (options.transactions !== undefined) {
            this.transactions = Array.isArray(options.transactions) ? options.transactions : (options.transactions?.transactions || []);
        }
        if (options.managers !== undefined) {
            this.managers = this.normalizeManagers(options.managers);
        }
        if (options.leagueSettings !== undefined) {
            this.leagueSettings = options.leagueSettings || {};
        }
        if (options.scoringSettings !== undefined) {
            this.scoringSettings = options.scoringSettings || {};
        }
        this.init();
    }

    setSubTab(tab, managerId = null) {
        this.subTab = tab;
        if (managerId) {
            this.selectedManagerId = managerId;
            this.soloYearFilter = 'all';
        }
        this.render();
    }

    setDisplayGrouping(grouping) {
        this.displayGrouping = grouping;
        this.render();
    }

    init() {
        const yearsSet = new Set();
        (this.draftResults || []).forEach(p => {
            const yr = p.year || p.season;
            if (yr) yearsSet.add(Number(yr));
        });
        
        this.seasons = Array.from(yearsSet).sort((a, b) => b - a);
        if (this.seasons.length > 0) {
            const sortedAsc = [...this.seasons].sort((a, b) => a - b);
            const minYr = sortedAsc[0];
            const maxYr = sortedAsc[sortedAsc.length - 1];

            if (!this.overallCustomStart) this.overallCustomStart = minYr;
            if (!this.overallCustomEnd) this.overallCustomEnd = maxYr;
            if (!this.soloCustomStart) this.soloCustomStart = minYr;
            if (!this.soloCustomEnd) this.soloCustomEnd = maxYr;

            if (!this.selectedYear || !this.seasons.includes(this.selectedYear)) {
                this.selectedYear = this.seasons[0];
            }
            const allNflYears = this.seasons.map(yr => this.getNflYear(yr));
            nflStats.preloadAllSeasons(allNflYears).then(() => {
                if (typeof document !== 'undefined') {
                    const container = document.getElementById(this.containerId);
                    if (container && (container.classList.contains('active') || container.offsetParent !== null)) {
                        this.render();
                    }
                }
            }).catch(() => {});
        }

        this.buildTruePositionMap();

        // Default selected manager for solo profile (prioritizing active managers)
        const mgrList = this.getManagerList();
        const activeMgrs = mgrList.filter(m => !m.isRetired);
        if (activeMgrs.length > 0 && !this.selectedManagerId) {
            this.selectedManagerId = activeMgrs[0].id;
        } else if (mgrList.length > 0 && !this.selectedManagerId) {
            this.selectedManagerId = mgrList[0].id;
        }
    }

    filterSeasonByRule(seasonYear, filterMode, customStart, customEnd) {
        const y = Number(seasonYear);
        if (!filterMode || filterMode === 'all') return true;
        if (filterMode === '2020-present') return y >= 2020;
        if (filterMode === 'custom') {
            const start = Number(customStart || 2015);
            const end = Number(customEnd || 2030);
            return y >= start && y <= end;
        }
        return String(filterMode) === String(y);
    }

    destroy() {
        if (this.unsubscribeLdi) {
            this.unsubscribeLdi();
        }
    }

    getManagerList() {
        const mgrs = Array.isArray(this.managers) ? this.managers : (this.managers?.managers || []);
        const found = [];
        const seen = new Set();
        const allowNicknames = this.leagueSettings?.allow_nicknames !== false;

        mgrs.forEach(m => {
            const id = String(m.id || m.manager_id || '');
            if (id && !seen.has(id)) {
                seen.add(id);
                const isRetired = m.is_retired === true || 
                                  m.isActive === false || 
                                  (m.status || '').toLowerCase() === 'retired' || 
                                  m.status_group === 'Retired Managers';
                const baseName = m.canonical_name || m.name || m.manager_name || id;
                const winAppClaims = typeof window !== 'undefined' ? window.app?.claims : undefined;
                const nick = m.nickname || (this.claims && this.claims[id]?.nickname) || (winAppClaims && winAppClaims[id]?.nickname) || '';
                const displayName = formatManagerDisplayName(baseName, nick, allowNicknames);
                found.push({
                    id,
                    name: displayName,
                    baseName: baseName,
                    team: m.team || m.team_name || displayName,
                    isRetired,
                    status: m.status || (isRetired ? 'retired' : 'active'),
                    statusGroup: isRetired ? 'Retired Managers' : 'Current Managers'
                });
            }
        });
        // Also extract from drafts if not in managers list
        (this.draftResults || []).forEach(p => {
            const id = String(p.manager_id || p.managerId || '');
            if (id && !seen.has(id)) {
                seen.add(id);
                const baseName = p.manager_name || p.managerName || id;
                const winAppClaims = typeof window !== 'undefined' ? window.app?.claims : undefined;
                const nick = p.nickname || (this.claims && this.claims[id]?.nickname) || (winAppClaims && winAppClaims[id]?.nickname) || '';
                const displayName = formatManagerDisplayName(baseName, nick, allowNicknames);
                found.push({
                    id,
                    name: displayName,
                    baseName: baseName,
                    team: p.team_name || p.teamName || displayName,
                    isRetired: false,
                    status: 'active',
                    statusGroup: 'Current Managers'
                });
            }
        });
        return found;
    }

    isManagerRetired(managerId) {
        if (!managerId) return false;
        const mgr = this.getManagerList().find(m => String(m.id).toLowerCase() === String(managerId).toLowerCase());
        return !!(mgr && mgr.isRetired);
    }

    buildTruePositionMap() {
        this.playerTruePositions = {};
        (this.weeklyPlayerStats || []).forEach(st => {
            const pId = st.player_id || st.playerId;
            const pName = (st.player_name || st.playerName || '').toLowerCase();
            let rawPos = st.position || st.roster_slot || st.pos;
            let pos = normalizePosition(rawPos, st.player_name || st.playerName);

            if (!pos && st.lineup_slot_id !== undefined) {
                const slot = Number(st.lineup_slot_id);
                if (slot === 0) pos = 'QB';
                else if (slot === 2) pos = 'RB';
                else if (slot === 4) pos = 'WR';
                else if (slot === 6) pos = 'TE';
                else if (slot === 16) pos = 'DEF';
                else if (slot === 17) pos = 'K';
            }

            if (pos && pos !== 'FLEX' && pos !== 'BN' && pos !== 'IR') {
                if (pId) this.playerTruePositions[String(pId)] = pos;
                if (pName) this.playerTruePositions[pName] = pos;
            }
        });
    }

    resolvePlayerPosition(pId, pName, rawPos) {
        let pos = normalizePosition(rawPos, pName);
        if (!pos && pId && this.playerTruePositions[String(pId)]) {
            pos = this.playerTruePositions[String(pId)];
        }
        if (!pos && pName && this.playerTruePositions[String(pName).toLowerCase()]) {
            pos = this.playerTruePositions[String(pName).toLowerCase()];
        }
        if (!pos && pName) {
            const nflId = nflStats.findPlayerId(pName);
            if (nflId && nflStats.playersCache && nflStats.playersCache[nflId]?.position) {
                pos = normalizePosition(nflStats.playersCache[nflId].position, pName);
            }
        }
        if (!pos) {
            if (String(pName).toLowerCase().includes('d/st') || String(pName).toLowerCase().includes('defense')) {
                pos = 'DEF';
            } else if (String(pName).toLowerCase().includes('kicker')) {
                pos = 'K';
            } else {
                pos = 'WR';
            }
        }
        return pos;
    }

    getNflYear(year) {
        const yr = Number(year);
        const leagueName = (this.leagueSettings?.name || '').toLowerCase();
        const isDms = leagueName.includes('dumbarton') || leagueName.includes('dms') || 
                      Boolean(typeof window !== 'undefined' && window?.location?.pathname?.includes('dmsfantasy')) ||
                      Boolean(this.leagueSettings?.is_dms || this.leagueSettings?.year_offset === -1);
        return isDms ? (yr - 1) : yr;
    }

    setYear(year) {
        this.selectedYear = Number(year);
        this.render();
        const nflYear = this.getNflYear(this.selectedYear);
        if (!nflStats.isSeasonLoaded(nflYear)) {
            nflStats.preloadSeason(nflYear).then(() => {
                const container = document.getElementById(this.containerId);
                if (container && (container.classList.contains('active') || container.offsetParent !== null)) {
                    this.render();
                }
            }).catch(() => {});
        }
    }

    setNameMode(mode) {
        this.nameMode = mode;
        this.render();
    }

    setSelectedManager(mId) {
        this.selectedManagerId = mId;
        this.render();
    }

    toggleLeagueAvgComparison() {
        this.showLeagueAvg = !this.showLeagueAvg;
        this.render();
    }

    getPositionalPaceRank(pos, pacePts, year, scoringFormat = '', posGrouped = null) {
        if (!pos || !pacePts || pacePts <= 0) return '';
        const normPos = String(pos).toUpperCase();
        const nflYear = this.getNflYear(year);

        // 1. Try NFL global stats first if loaded
        let paceRank = nflStats.getPositionalPaceRank(normPos, pacePts, nflYear, scoringFormat);
        if (paceRank) return paceRank;

        // 2. Try local league season totals
        if (posGrouped && posGrouped[normPos] && posGrouped[normPos].length > 0) {
            const scores = posGrouped[normPos].map(p => p.totalPts || 0);
            let higherCount = 0;
            for (let i = 0; i < scores.length; i++) {
                if (scores[i] > pacePts) higherCount++;
                else break;
            }
            return `${normPos}${higherCount + 1}`;
        }

        // 3. Fallback to weekly_logs_cache from precompiled model data for this nflYear
        const weeklyLogsCache = ldiEngine.weeklyLogsCache || {};
        const posSeasonTotals = [];
        Object.entries(weeklyLogsCache).forEach(([key, data]) => {
            const parts = key.split('_');
            const logYear = Number(parts[parts.length - 1]);
            if (logYear === nflYear && data && data.A_pts > 0) {
                const pName = parts.slice(0, -1).join(' ');
                const pPos = this.playerTruePositions[pName] || this.playerTruePositions[key] || data.position;
                if (pPos === normPos) {
                    posSeasonTotals.push(data.A_pts);
                }
            }
        });
        if (posSeasonTotals.length > 0) {
            posSeasonTotals.sort((a, b) => b - a);
            let higherCount = 0;
            for (let i = 0; i < posSeasonTotals.length; i++) {
                if (posSeasonTotals[i] > pacePts) higherCount++;
                else break;
            }
            return `${normPos}${higherCount + 1}`;
        }

        return '';
    }

    getScoringFormat(year) {
        if (this.leagueSettings?.scoring_format) {
            return this.leagueSettings.scoring_format;
        }
        const leagueName = (this.leagueSettings?.name || '').toLowerCase();
        if (leagueName.includes('dumbarton') || leagueName.includes('dms') || (typeof window !== 'undefined' && window?.location?.pathname?.includes('dmsfantasy'))) {
            return 'Half-PPR (0.5)';
        }

        const rules = (this.scoringSettings && (this.scoringSettings[year] || this.scoringSettings[String(year)])) ||
                      (this.leagueSettings && (this.leagueSettings[year] || this.leagueSettings.scoringRules)) || {};
        
        let recPts = 0;
        const recList = rules['Receiving'] || [];
        const recItem = recList.find(i => (i.name || '').toLowerCase().includes('each reception') || (i.name || '').toLowerCase().includes('receptions'));
        if (recItem) recPts = Number(recItem.points) || 0;

        if (recPts >= 1) return 'PPR (1.0)';
        if (recPts >= 0.5) return 'Half-PPR (0.5)';
        return 'Standard (0.0)';
    }

    getLeagueSeasonSettings(year) {
        const leagueName = (this.leagueSettings?.name || '').toLowerCase();
        const isDms = leagueName.includes('dumbarton') || leagueName.includes('dms') || 
                      Boolean(typeof window !== 'undefined' && window?.location?.pathname?.includes('dmsfantasy'));
        const yr = Number(year);
        const nflYear = this.getNflYear(yr);
        
        const totalWeeks = nflYear >= 2021 ? 17 : 16;
        
        let numTeams = 12;
        if (!isDms && yr === 2020) numTeams = 10;

        let startersQb = 1;
        let startersRb = 2;
        let startersWr = 2;
        let startersTe = 1;
        let startersFlex = 1;

        if (isDms && (yr === 2018 || yr === 2019)) {
            startersWr = 3;
            startersFlex = 0;
        }

        const tracksStartingLineups = isDms ? true : (yr >= 2018);

        return {
            league_id: isDms ? 'dms' : 'gaywood',
            nfl_year: nflYear,
            season_year: yr,
            num_teams: numTeams,
            starters_qb: startersQb,
            starters_rb: startersRb,
            starters_wr: startersWr,
            starters_te: startersTe,
            starters_flex: startersFlex,
            total_season_weeks: totalWeeks,
            tracks_starting_lineups: tracksStartingLineups
        };
    }

    /**
     * Compute Season Analytics with Pure LDI Engine
     */
    computeSeasonAnalytics(year) {
        const yearStats = (this.weeklyPlayerStats || []).filter(s => Number(s.year || s.season) === year);
        const yearDraft = (this.draftResults || []).filter(p => Number(p.year || p.season) === year);
        const yearTx = (this.transactions || []).filter(t => Number(t.year || t.season) === year);

        const nflYear = this.getNflYear(year);
        const leagueSeasonSettings = this.getLeagueSeasonSettings(year);
        const fullRegularSeasonWeeks = leagueSeasonSettings.total_season_weeks;

        // Check if this season draft has occurred but is unplayed (0 total stats recorded)
        let totalGamesPlayedInSeason = 0;
        let maxPlayedWeek = 0;
        yearStats.forEach(st => {
            const pts = Number(st.fantasy_points !== undefined ? st.fantasy_points : (st.fantasyPoints !== undefined ? st.fantasyPoints : 0));
            if (pts > 0) {
                totalGamesPlayedInSeason++;
                const wk = Number(st.week) || 1;
                if (wk > maxPlayedWeek) maxPlayedWeek = wk;
            }
        });

        // Also check matchups for completed regular season weeks
        (this.matchups || []).forEach(m => {
            if (Number(m.year || m.season) === year && !m.is_playoff) {
                const s1 = Number(m.home_score !== undefined ? m.home_score : m.team_1_actual_points) || 0;
                const s2 = Number(m.away_score !== undefined ? m.away_score : m.team_2_actual_points) || 0;
                if (s1 > 0 || s2 > 0 || (m.winner && m.winner !== 'UNDECIDED')) {
                    const wk = Number(m.week) || 1;
                    if (wk > maxPlayedWeek) maxPlayedWeek = wk;
                }
            }
        });

        // Determine season status: unplayed vs in-progress vs completed
        const isUnplayedSeason = (totalGamesPlayedInSeason === 0 && maxPlayedWeek === 0);
        const isSeasonInProgress = !isUnplayedSeason && (maxPlayedWeek > 0 && maxPlayedWeek < fullRegularSeasonWeeks);
        const maxRegularSeasonGames = isSeasonInProgress ? maxPlayedWeek : fullRegularSeasonWeeks;

        if (isSeasonInProgress) {
            leagueSeasonSettings.total_season_weeks = maxPlayedWeek;
            leagueSeasonSettings.is_in_progress = true;
        }

        // Index all transactions for this season
        const normPlayerName = (name) => {
            if (!name) return '';
            return String(name).toLowerCase()
                .replace(/\b(jr\.?|sr\.?|ii|iii|iv|v)\b/gi, '')
                .replace(/[^a-z0-9]/gi, '')
                .trim();
        };

        const seasonDropsMap = new Map();
        const seasonAddsMap = new Map();
        const seasonAllPlayerTxs = new Map();

        yearTx.forEach(t => {
            const droppedList = Array.isArray(t.dropped_players) ? [...t.dropped_players] : [];
            const addedList = Array.isArray(t.added_players) ? [...t.added_players] : [];
            
            // Extract added player from details if added_players is empty (Yahoo format)
            if (addedList.length === 0 && t.details && t.details !== 'Traded to') {
                const addMatch = t.details.match(/^([A-Za-z0-9\.\'\-\s]+?)\s+(?:[A-Z]{2,3}|49ers)\s+-\s+(?:QB|RB|WR|TE|K|DEF)/);
                if (addMatch && addMatch[1]) {
                    const cleanAdd = addMatch[1].trim();
                    if (!addedList.includes(cleanAdd) && !droppedList.includes(cleanAdd)) {
                        addedList.push(cleanAdd);
                    }
                }
            }

            // Extract from ESPN items array if present
            if (Array.isArray(t.items)) {
                t.items.forEach(item => {
                    const pName = item.player_name || item.name;
                    if (pName) {
                        if (item.type === 'DROP' && !droppedList.includes(pName)) droppedList.push(pName);
                        if (item.type === 'ADD' && !addedList.includes(pName)) addedList.push(pName);
                    }
                });
            }

            droppedList.forEach(p => {
                const np = normPlayerName(p);
                if (!np) return;
                if (!seasonDropsMap.has(np)) seasonDropsMap.set(np, []);
                seasonDropsMap.get(np).push(t);
                
                if (!seasonAllPlayerTxs.has(np)) seasonAllPlayerTxs.set(np, []);
                if (!seasonAllPlayerTxs.get(np).includes(t)) {
                    seasonAllPlayerTxs.get(np).push(t);
                }
            });
            
            addedList.forEach(p => {
                const np = normPlayerName(p);
                if (!np) return;
                if (!seasonAddsMap.has(np)) seasonAddsMap.set(np, []);
                seasonAddsMap.get(np).push(t);
                
                if (!seasonAllPlayerTxs.has(np)) seasonAllPlayerTxs.set(np, []);
                if (!seasonAllPlayerTxs.get(np).includes(t)) {
                    seasonAllPlayerTxs.get(np).push(t);
                }
            });

            // Also index trades from t.items or traded_players
            const isTrade = (t.action_type === 'TRADE' || t.type === 'trade');
            if (isTrade) {
                const tradedList = Array.isArray(t.traded_players) ? [...t.traded_players] : [];
                if (Array.isArray(t.items)) {
                    t.items.forEach(item => {
                        const pName = item.player_name || item.name;
                        if (pName && !tradedList.includes(pName)) tradedList.push(pName);
                    });
                }
                tradedList.forEach(p => {
                    const np = normPlayerName(p);
                    if (!np) return;
                    if (!seasonAllPlayerTxs.has(np)) seasonAllPlayerTxs.set(np, []);
                    if (!seasonAllPlayerTxs.get(np).includes(t)) {
                        seasonAllPlayerTxs.get(np).push(t);
                    }
                });
            }
        });

        const playerWeeklyMgrMap = new Map();
        yearStats.forEach(st => {
            const np = normPlayerName(st.player_name || st.playerName);
            if (!np) return;
            const wk = Number(st.week) || 1;
            const stMgr = String(st.manager_id || st.managerId || (st.team_id !== undefined ? `team_${st.team_id}` : '')).toLowerCase();
            if (!playerWeeklyMgrMap.has(np)) playerWeeklyMgrMap.set(np, new Map());
            playerWeeklyMgrMap.get(np).set(wk, stMgr);
        });

        // Group player weekly stats for transaction and roster tracking
        const playerSeasonTotals = {};
        yearStats.forEach(st => {
            const pId = st.player_id || st.playerId || st.player_name;
            const name = st.player_name || st.playerName || `Player #${pId}`;
            const pos = this.resolvePlayerPosition(pId, name, st.position || st.roster_slot || st.pos);
            const nfl = st.nfl_team || st.nflTeam || '';
            const pts = Number(st.fantasy_points !== undefined ? st.fantasy_points : (st.fantasyPoints || 0));
            const wk = Number(st.week) || 1;
            const mgrId = st.manager_id || st.managerId || '';

            const key = String(pId);
            if (!playerSeasonTotals[key]) {
                playerSeasonTotals[key] = {
                    id: pId,
                    name: name,
                    pos: pos,
                    nflTeam: nfl,
                    totalPts: 0,
                    weeksActive: new Set(),
                    weeklyRoster: {}
                };
            }

            playerSeasonTotals[key].totalPts += pts;
            playerSeasonTotals[key].weeksActive.add(wk);
            playerSeasonTotals[key].weeklyRoster[wk] = mgrId;
            if (!playerSeasonTotals[key].nflTeam && nfl) playerSeasonTotals[key].nflTeam = nfl;
            if (pos && playerSeasonTotals[key].pos !== pos) playerSeasonTotals[key].pos = pos;
        });

        // Compute local positional finishes
        const posGrouped = { QB: [], RB: [], WR: [], TE: [], K: [], DEF: [] };
        Object.values(playerSeasonTotals).forEach(p => {
            const pos = p.pos || 'FLEX';
            if (!posGrouped[pos]) posGrouped[pos] = [];
            posGrouped[pos].push(p);
        });

        const playerFinalRanks = {};
        Object.keys(posGrouped).forEach(pos => {
            posGrouped[pos].sort((a, b) => b.totalPts - a.totalPts);
            posGrouped[pos].forEach((p, idx) => {
                const rankNum = idx + 1;
                const gamesPlayed = p.weeksActive.size;
                const info = {
                    finishRankNum: rankNum,
                    finishPosRank: `${pos}${rankNum}`,
                    totalPts: Math.round(p.totalPts * 10) / 10,
                    weeksPlayed: gamesPlayed,
                    weeklyRoster: p.weeklyRoster
                };
                playerFinalRanks[String(p.id)] = info;
                playerFinalRanks[p.name.toLowerCase()] = info;
            });
        });

        // Process Draft Picks: compute Positional Ranks
        const draftedPosCounts = {};
        const enrichedPicks = [];
        const managerPicksMap = {};

        const sortedPicks = [...yearDraft].sort((a, b) => (Number(a.overall_pick || a.overallPick) || 0) - (Number(b.overall_pick || b.overallPick) || 0));

        sortedPicks.forEach(pick => {
            const overallPick = Number(pick.overall_pick || pick.overallPick) || 1;
            const round = Number(pick.round) || 1;
            const roundPick = Number(pick.round_pick || pick.roundPick || pick.pick_in_round || pick.pickInRound) || 1;
            const pId = pick.player_id || pick.playerId || '';
            const pName = pick.player_name || pick.playerName || (pId ? `Player #${pId}` : 'Pass / Empty Slot');
            const pos = this.resolvePlayerPosition(pId, pName, pick.position);
            const nflTeam = pick.nfl_team || pick.nflTeam || '';
            const mgrId = pick.manager_id || pick.managerId || '';
            const mgrList = this.getManagerList();
            const mgrName = pick.manager_name || pick.managerName || (mgrList.find(m => String(m.id).toLowerCase() === String(mgrId).toLowerCase())?.name || 'Manager');
            const teamName = pick.team_name || pick.teamName || mgrName;

            // Positional draft rank
            if (!draftedPosCounts[pos]) draftedPosCounts[pos] = 0;
            draftedPosCounts[pos]++;
            const draftedPosNum = draftedPosCounts[pos];
            const draftedPosRank = `${pos}${draftedPosNum}`;

            // Resolve finish rank for display
            const scoringFormat = this.getScoringFormat(year);
            const nflInfo = !isUnplayedSeason ? nflStats.getPlayerStats(pName, nflYear, pos, scoringFormat) : null;
            const finalInfo = !isUnplayedSeason ? (playerFinalRanks[String(pId)] || playerFinalRanks[pName.toLowerCase()] || null) : null;
            const ldiLogs = !isUnplayedSeason ? ldiEngine.getPlayerWeeklyLogs(pName, nflYear) : null;

            let finishPosRank = isUnplayedSeason ? 'Pending' : 'Unranked';
            let finishPosNum = null;
            let totalPoints = 0;
            let gamesPlayed = 0;
            let gamesMissed = 0;

            if (!isUnplayedSeason) {
                if (nflInfo) {
                    finishPosRank = nflInfo.posRank || 'Unranked';
                    finishPosNum = nflInfo.posRankNum || null;
                    totalPoints = nflInfo.totalPts || 0;
                    gamesPlayed = nflInfo.gp !== null && nflInfo.gp !== undefined ? nflInfo.gp : 0;
                    gamesMissed = nflInfo.missedGames !== undefined ? nflInfo.missedGames : Math.max(0, maxRegularSeasonGames - gamesPlayed);
                } else if (finalInfo) {
                    finishPosRank = finalInfo.finishPosRank;
                    finishPosNum = finalInfo.finishRankNum;
                    totalPoints = finalInfo.totalPts;
                    gamesPlayed = finalInfo.weeksPlayed || 0;
                    gamesMissed = Math.max(0, maxRegularSeasonGames - gamesPlayed);
                } else if (ldiLogs) {
                    totalPoints = ldiLogs.A_pts || 0;
                    gamesPlayed = ldiLogs.games_played || 0;
                    gamesMissed = ldiLogs.games_missed || 0;
                }
            }

            // Resolve accurate NFL team at time of draft
            let resolvedNflTeam = pick.nfl_team || pick.nflTeam || '';
            const histTeam = nflHistoricalTeams.getTeam(pName, year, pos);
            if (histTeam) {
                resolvedNflTeam = histTeam;
            } else if (nflInfo?.team) {
                resolvedNflTeam = nflInfo.team;
            } else if (nflTeam && nflTeam.length <= 4) {
                resolvedNflTeam = nflTeam;
            }

            // Score pick using pure LDI Engine
            let ldiResult = null;
            if (!isUnplayedSeason) {
                const pickInput = {
                    season_year: year,
                    player_name: pName,
                    player_id: pId,
                    position: pos,
                    overall_pick_number: overallPick,
                    positional_draft_rank: draftedPosNum,
                    total_points: totalPoints,
                    games_played: gamesPlayed,
                    games_missed: gamesMissed
                };
                ldiResult = ldiEngine.scorePick(pickInput, leagueSeasonSettings);
            } else {
                ldiResult = {
                    isScored: false,
                    reason: 'Season pending start',
                    position: pos,
                    overallPickNumber: overallPick
                };
            }

            // Transaction / Destination Tag Lifecycle
            let destinationTag = '';
            let tagType = 'retained';
            let tradeInfo = null;
            let dropInfo = null;

            const np = normPlayerName(pName);
            const dMgrLower = String(mgrId || (pick.team_id !== undefined ? `team_${pick.team_id}` : '')).toLowerCase();
            const dTeamId = pick.team_id !== undefined ? String(pick.team_id) : (pick.teamId !== undefined ? String(pick.teamId) : '');

            // Check if drafter explicitly dropped this player in transactions
            const playerDrops = seasonDropsMap.get(np) || [];
            const droppedByDrafterTxs = playerDrops.filter(t => {
                const tMgr = String(t.manager_id || t.managerId || '').toLowerCase();
                const tTeam = t.team_id !== undefined ? String(t.team_id) : (t.teamId !== undefined ? String(t.teamId) : '');
                if (tMgr && (tMgr === dMgrLower || (dMgrLower && tMgr.includes(dMgrLower)))) return true;
                if (tTeam && dTeamId && tTeam === dTeamId) return true;
                if (Array.isArray(t.items)) {
                    return t.items.some(item => {
                        const isMatch = normPlayerName(item.player_name || item.name) === np;
                        const isDrop = item.type === 'DROP';
                        const isFromTeam = (dTeamId && String(item.from_team) === dTeamId) || (dMgrLower && String(item.from_team).toLowerCase() === dMgrLower);
                        return isMatch && isDrop && isFromTeam;
                    });
                }
                return false;
            });
            const playerAllTxs = (seasonAllPlayerTxs.get(np) || []).slice();

            // Weekly roster assignments for this player
            const weekMap = playerWeeklyMgrMap.get(np) || new Map();
            const drafterWeeks = [];
            const otherMgrWeeks = [];

            weekMap.forEach((mId, wk) => {
                const isDrafterWeek = (mId === dMgrLower) || (dTeamId && mId === `team_${dTeamId}`) || (dMgrLower && mId.includes(dMgrLower));
                if (isDrafterWeek) {
                    drafterWeeks.push(wk);
                } else if (mId) {
                    otherMgrWeeks.push({ week: wk, managerId: mId });
                }
            });
            otherMgrWeeks.sort((a, b) => a.week - b.week);

            if (droppedByDrafterTxs.length > 0) {
                tagType = 'dropped';
                const lastDrafterWk = drafterWeeks.length > 0 ? Math.max(...drafterWeeks) : 0;
                const dropWeek = lastDrafterWk > 0 ? Math.min(lastDrafterWk + 1, maxRegularSeasonGames) : 1;
                destinationTag = `Dropped to Waivers (Wk ${dropWeek})`;
                
                dropInfo = {
                    year,
                    dropWeek,
                    drafterManagerId: mgrId,
                    drafterManagerName: mgrName,
                    teamName: teamName,
                    playerId: pId,
                    playerName: pName,
                    position: pos,
                    overallPick,
                    round,
                    roundPick,
                    transactions: playerAllTxs
                };
            } else if (otherMgrWeeks.length > 0) {
                const firstOther = otherMgrWeeks[0];
                const firstOtherWeek = Number(firstOther.week);
                const targetMgrId = firstOther.managerId;
                const targetMgrName = mgrList.find(m => String(m.id).toLowerCase() === String(targetMgrId).toLowerCase())?.name || targetMgrId;
                const lastDrafterWk = drafterWeeks.length > 0 ? Math.max(...drafterWeeks) : 0;
                const dropWeek = lastDrafterWk > 0 ? Math.min(lastDrafterWk + 1, maxRegularSeasonGames) : 1;

                // If there is a gap between the last week drafter held them and first week new manager held them,
                // it is impossible for it to be a trade (the player was unrostered on waivers/FA during the gap).
                const isRosterGap = (firstOtherWeek > lastDrafterWk + 1);

                // Check if the new manager acquired this player via waiver claim or free agent pickup
                const targetMgrLower = String(targetMgrId).toLowerCase();
                const targetAdds = (seasonAddsMap.get(np) || []).filter(t => {
                    const tMgr = String(t.manager_id || t.managerId || '').toLowerCase();
                    const tTeam = t.team_id !== undefined ? String(t.team_id) : '';
                    return (tMgr && (tMgr === targetMgrLower || targetMgrLower.includes(tMgr))) || (tTeam && tTeam === targetMgrLower);
                });
                const isClaimedByOther = targetAdds.length > 0;

                // Reconstruct full trade package: find all players moving between dMgrLower and targetMgrId at firstOtherWeek
                const sideASent = []; // Drafter sent to target
                const sideBSent = []; // Target sent to drafter
                
                playerWeeklyMgrMap.forEach((wMap, otherNp) => {
                    const prevMgr = wMap.get(firstOtherWeek - 1);
                    const currMgr = wMap.get(firstOtherWeek);
                    
                    if (prevMgr === dMgrLower && currMgr === targetMgrId) {
                        const wasDropped = (seasonDropsMap.get(otherNp) || []).some(t => String(t.manager_id || t.managerId || '').toLowerCase() === dMgrLower);
                        if (!wasDropped) {
                            const originalStat = yearStats.find(s => normPlayerName(s.player_name || s.playerName) === otherNp);
                            const dispName = originalStat?.player_name || originalStat?.playerName || otherNp;
                            const dispPos = originalStat?.position || originalStat?.roster_slot || '';
                            sideASent.push({ name: dispName, pos: dispPos });
                        }
                    } else if (prevMgr === targetMgrId && currMgr === dMgrLower) {
                        const wasDropped = (seasonDropsMap.get(otherNp) || []).some(t => String(t.manager_id || t.managerId || '').toLowerCase() === targetMgrId);
                        if (!wasDropped) {
                            const originalStat = yearStats.find(s => normPlayerName(s.player_name || s.playerName) === otherNp);
                            const dispName = originalStat?.player_name || originalStat?.playerName || otherNp;
                            const dispPos = originalStat?.position || originalStat?.roster_slot || '';
                            sideBSent.push({ name: dispName, pos: dispPos });
                        }
                    }
                });
                
                if (!sideASent.some(p => normPlayerName(p.name) === np)) {
                    sideASent.unshift({ name: pName, pos: pos });
                }
                
                // A legitimate trade requires consecutive weeks (no gap), no waiver claim by target, and counterpart assets or explicit multi-player move
                const isLegitTrade = !isRosterGap && !isClaimedByOther && (sideBSent.length > 0 || (sideASent.length > 1 && !isClaimedByOther));

                if (isLegitTrade) {
                    tagType = 'traded';
                    destinationTag = `Traded to ${targetMgrName} (Wk ${firstOtherWeek})`;
                    tradeInfo = {
                        year,
                        week: firstOtherWeek,
                        fromManagerId: mgrId,
                        fromManagerName: mgrName,
                        toManagerId: targetMgrId,
                        toManagerName: targetMgrName,
                        playerId: pId,
                        playerName: pName,
                        position: pos,
                        sideASent,
                        sideBSent
                    };
                } else {
                    tagType = 'dropped';
                    destinationTag = `Dropped to Waivers (Wk ${dropWeek})`;
                    dropInfo = {
                        year,
                        dropWeek,
                        drafterManagerId: mgrId,
                        drafterManagerName: mgrName,
                        teamName: teamName,
                        playerId: pId,
                        playerName: pName,
                        position: pos,
                        overallPick,
                        round,
                        roundPick,
                        transactions: playerAllTxs
                    };
                }
            } else {
                tagType = 'retained';
                destinationTag = '';
            }

            const pickData = {
                overallPick,
                round,
                roundPick,
                playerId: pId,
                playerName: pName,
                position: pos,
                nflTeam: resolvedNflTeam,
                managerId: mgrId,
                managerName: mgrName,
                teamName: teamName,
                draftedPosRank,
                draftedPosNum,
                finishPosRank,
                finishPosNum,
                totalPoints,
                gamesPlayed: (nflInfo && nflInfo.gp !== null) ? nflInfo.gp : (ldiResult?.gamesPlayed ?? gamesPlayed),
                gamesMissed: (nflInfo && nflInfo.missedGames !== undefined) ? nflInfo.missedGames : (ldiResult?.gamesMissed ?? gamesMissed),
                ldiResult,
                destinationTag,
                tagType,
                tradeInfo,
                dropInfo
            };

            enrichedPicks.push(pickData);

            if (mgrId) {
                if (!managerPicksMap[mgrId]) {
                    managerPicksMap[mgrId] = {
                        managerId: mgrId,
                        managerName: mgrName,
                        teamName: teamName,
                        picks: []
                    };
                }
                managerPicksMap[mgrId].picks.push(pickData);
            }
        });

        // Manager-Level Rollup & Standardized 1-100 Grade
        const managerLeaderboard = Object.values(managerPicksMap).map(mObj => {
            if (isUnplayedSeason) {
                return {
                    managerId: mObj.managerId,
                    managerName: mObj.managerName,
                    teamName: mObj.teamName,
                    totalPicks: mObj.picks.length,
                    scoredPicksCount: 0,
                    LDI_manager_season: null,
                    compositeLdi: null,
                    meanLdi: null,
                    draftIndex: null,
                    isPending: true,
                    gradeInfo: { grade: 'Pending', tier: 'pending', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', border: 'rgba(148, 163, 184, 0.3)' },
                    hits: 0,
                    busts: 0,
                    steals: 0,
                    picks: mObj.picks
                };
            }

            const scoredPicks = mObj.picks.map(p => p.ldiResult).filter(r => r && r.isScored);
            const rollup = ldiEngine.computeManagerRollup(scoredPicks);

            const hits = scoredPicks.filter(p => p.pickDisplayScore >= 75).length;
            const busts = scoredPicks.filter(p => p.pickDisplayScore <= 25).length;
            const steals = scoredPicks.filter(p => p.pickDisplayScore >= 85).length;

            return {
                managerId: mObj.managerId,
                managerName: mObj.managerName,
                teamName: mObj.teamName,
                totalPicks: mObj.picks.length,
                scoredPicksCount: rollup.scoredPicksCount,
                LDI_manager_season: rollup.LDI_manager_season,
                compositeLdi: rollup.compositeLdi,
                meanLdi: rollup.meanLdi,
                draftIndex: rollup.managerDisplayScore,
                gradeInfo: LDIEngine.getScoreGrade(rollup.managerDisplayScore),
                isPending: false,
                hits,
                busts,
                steals,
                picks: mObj.picks
            };
        }).sort((a, b) => {
            if (isUnplayedSeason) {
                const aSlot = a.picks[0]?.overallPick ?? 999;
                const bSlot = b.picks[0]?.overallPick ?? 999;
                return aSlot - bSlot;
            }
            return (b.draftIndex ?? 0) - (a.draftIndex ?? 0);
        });

        // Best Steal, Worst Draft, What If, Bust
        let bestSteal = null;
        let biggestWhatIf = null;
        let biggestBust = null;
        let worstDraft = null;

        if (!isUnplayedSeason) {
            const validSkillPicks = enrichedPicks.filter(p => p.ldiResult?.isScored && p.playerName && !p.playerName.startsWith('Player #-1'));
            const stealCandidates = validSkillPicks.filter(p => p.finishPosNum !== null && p.finishPosNum !== undefined && p.finishPosNum <= p.draftedPosNum);
            bestSteal = [...stealCandidates].sort((a, b) => (b.ldiResult.LDI_pick || 0) - (a.ldiResult.LDI_pick || 0))[0] || null;
            
            const whatIfCandidates = validSkillPicks.filter(p => (p.finishPosNum === null || p.finishPosNum === undefined || p.finishPosNum > p.draftedPosNum) && (p.ldiResult?.LDI_pick || 0) > 0.2);
            biggestWhatIf = [...whatIfCandidates].sort((a, b) => (b.ldiResult.LDI_pick || 0) - (a.ldiResult.LDI_pick || 0))[0] || null;

            const earlyPicks = validSkillPicks.filter(p => p.round <= 4);
            biggestBust = [...earlyPicks].sort((a, b) => (a.ldiResult.LDI_pick || 0) - (b.ldiResult.LDI_pick || 0))[0] || null;

            // Worst draft hero card (lowest scoring manager in the draft class)
            if (managerLeaderboard.length > 0) {
                worstDraft = managerLeaderboard[managerLeaderboard.length - 1];
            }
        }

        return {
            year,
            isUnplayedSeason,
            maxWeeksInSeason: maxRegularSeasonGames,
            scoringFormat: this.getScoringFormat(year),
            totalPicks: enrichedPicks.length,
            picks: enrichedPicks,
            managerPicksMap,
            managerLeaderboard,
            bestSteal,
            biggestWhatIf,
            biggestBust,
            worstDraft,
            posGrouped,
            tuningParams: ldiEngine.params
        };
    }

    /**
     * Compute All-Time Macro Analytics across every completed draft season with year & retired manager filtering
     */
    computeAllTimeAnalytics(yearFilter = this.overallYearFilter, includeRetired = this.overallIncludeRetired, customStart = this.overallCustomStart, customEnd = this.overallCustomEnd) {
        const seasonAnalyticsMap = {};
        const managerAllPicks = {};
        const managerSeasonRollups = {};
        const allScoredPicks = [];
        const allManagerSeasons = [];

        const targetSeasons = this.seasons.filter(yr => this.filterSeasonByRule(yr, yearFilter, customStart, customEnd));

        targetSeasons.forEach(yr => {
            const a = this.computeSeasonAnalytics(yr);
            seasonAnalyticsMap[yr] = a;

            // Skip unplayed seasons from all-time historical leaderboard
            if (a.isUnplayedSeason) return;

            a.picks.forEach(p => {
                if (p.ldiResult?.isScored) {
                    const mId = p.managerId;
                    if (!includeRetired && this.isManagerRetired(mId)) {
                        return; // filter out retired manager
                    }
                    allScoredPicks.push({ ...p, seasonYear: yr });
                    if (mId) {
                        if (!managerAllPicks[mId]) managerAllPicks[mId] = [];
                        managerAllPicks[mId].push({ ...p, seasonYear: yr });
                    }
                }
            });

            a.managerLeaderboard.forEach(m => {
                if (!m.isPending && m.draftIndex !== null) {
                    const mId = m.managerId;
                    if (!includeRetired && this.isManagerRetired(mId)) {
                        return; // filter out retired manager
                    }
                    allManagerSeasons.push({ ...m, seasonYear: yr });
                    if (mId) {
                        if (!managerSeasonRollups[mId]) managerSeasonRollups[mId] = [];
                        managerSeasonRollups[mId].push({ ...m, seasonYear: yr });
                    }
                }
            });
        });

        // 1. All-Time Manager Leaderboard with Statistically Sound Composite LDI
        const managerCompositeList = Object.entries(managerAllPicks).map(([mId, picks]) => {
            const seasonRollups = managerSeasonRollups[mId] || [];
            const mgrObj = this.getManagerList().find(m => String(m.id).toLowerCase() === String(mId).toLowerCase());
            const managerName = mgrObj?.name || picks[0]?.managerName || mId;
            const teamName = mgrObj?.team || picks[0]?.teamName || managerName;
            const isRetired = this.isManagerRetired(mId);

            const composite = ldiEngine.computeCareerComposite(picks, seasonRollups);

            // Best and Worst draft year
            let bestYear = null;
            let bestYearScore = -1;
            let worstYear = null;
            let worstYearScore = 999;

            seasonRollups.forEach(sr => {
                if (sr.draftIndex > bestYearScore) {
                    bestYearScore = sr.draftIndex;
                    bestYear = sr.seasonYear;
                }
                if (sr.draftIndex < worstYearScore) {
                    worstYearScore = sr.draftIndex;
                    worstYear = sr.seasonYear;
                }
            });

            const stealsCount = picks.filter(p => (p.finishPosNum !== null && p.finishPosNum <= p.draftedPosNum) && (p.ldiResult?.LDI_pick || 0) >= 0.8).length;

            return {
                managerId: mId,
                managerName,
                teamName,
                isRetired,
                compositeScore: composite.compositeScore,
                gradeInfo: composite.gradeInfo,
                careerMeanLdi: composite.careerMeanLdi,
                shrunkLdi: composite.shrunkLdi,
                totalPicks: composite.totalPicks,
                seasonsCount: composite.seasonsCount,
                hitCount: composite.hitCount,
                hitRate: composite.hitRate,
                bustCount: composite.bustCount,
                bustRate: composite.bustRate,
                seasonStdDev: composite.seasonStdDev,
                bestYear,
                bestYearScore: bestYearScore >= 0 ? bestYearScore : null,
                worstYear,
                worstYearScore: worstYearScore <= 100 ? worstYearScore : null,
                stealsCount,
                picks,
                seasonRollups
            };
        }).sort((a, b) => b.compositeScore - a.compositeScore || b.careerMeanLdi - a.careerMeanLdi);

        // 2. Top 5 Best Drafts of All Time (Single-Season Manager Draft Classes)
        const top5BestDrafts = [...allManagerSeasons]
            .sort((a, b) => (b.draftIndex - a.draftIndex) || (b.LDI_manager_season - a.LDI_manager_season))
            .slice(0, 5);

        // 3. Top 5 Worst Drafts of All Time
        const top5WorstDrafts = [...allManagerSeasons]
            .sort((a, b) => (a.draftIndex - b.draftIndex) || (a.LDI_manager_season - b.LDI_manager_season))
            .slice(0, 5);

        // 4. Top 5 Best Picks / Greatest Steals of All Time
        const top5BestPicks = [...allScoredPicks]
            .filter(p => p.playerName && !p.playerName.startsWith('Player #-1'))
            .sort((a, b) => (b.ldiResult?.LDI_pick || 0) - (a.ldiResult?.LDI_pick || 0))
            .slice(0, 5);

        // 5. Top 5 Biggest Busts of All Time (Rounds 1-4 high capital misses)
        const top5BiggestBusts = [...allScoredPicks]
            .filter(p => p.round <= 4 && p.playerName && !p.playerName.startsWith('Player #-1'))
            .sort((a, b) => (a.ldiResult?.LDI_pick || 0) - (b.ldiResult?.LDI_pick || 0))
            .slice(0, 5);

        // 6. Top 5 Biggest "What Ifs" of All Time (Prorated high performers limited by games missed)
        const top5WhatIfs = [...allScoredPicks]
            .filter(p => p.gamesMissed >= 4 && (p.ldiResult?.LDI_pick || 0) > 0.3)
            .sort((a, b) => (b.ldiResult?.LDI_pick || 0) - (a.ldiResult?.LDI_pick || 0))
            .slice(0, 5);

        return {
            seasonAnalyticsMap,
            managerCompositeList,
            top5BestDrafts,
            top5WorstDrafts,
            top5BestPicks,
            top5BiggestBusts,
            top5WhatIfs,
            allScoredPicks,
            targetSeasons,
            yearFilter,
            customStart,
            customEnd,
            includeRetired
        };
    }

    async render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        if (!this.selectedYear && this.seasons.length > 0) {
            this.selectedYear = this.seasons[0];
        }

        if (!this.selectedYear) {
            container.innerHTML = `
                <div class="view-header">
                    <h1>Draft Central</h1>
                    <p>No historical draft records found.</p>
                </div>
            `;
            return;
        }

        const nflYear = this.getNflYear(this.selectedYear);
        if (!nflStats.isSeasonLoaded(nflYear)) {
            nflStats.preloadSeason(nflYear).then(() => {
                const c = document.getElementById(this.containerId);
                if (c && (c.classList.contains('active') || c.offsetParent !== null)) {
                    this.render();
                }
            }).catch(() => {});
        }

        // Render based on selected sub-tab
        if (this.subTab === 'overall') {
            this.renderOverallView(container);
        } else if (this.subTab === 'team') {
            this.renderTeamView(container);
        } else {
            this.renderYearlyView(container);
        }
    }

    /**
     * Render Top Sub-Navigation Bar inside Draft Central
     */
    renderSubNavHTML() {
        return `
            <div class="draft-subnav-bar">
                <div class="draft-subnav-group">
                    <button class="draft-subnav-btn ${this.subTab === 'yearly' ? 'active' : ''}" id="btn-subnav-yearly">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:5px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Yearly Draft Room
                    </button>
                    <button class="draft-subnav-btn ${this.subTab === 'overall' ? 'active' : ''}" id="btn-subnav-overall">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>
                        Draft Overall (All-Time)
                    </button>
                    <button class="draft-subnav-btn ${this.subTab === 'team' ? 'active' : ''}" id="btn-subnav-team">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:5px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        Solo Team Profile
                    </button>
                </div>

                <div class="draft-subnav-right">
                    <button id="btn-open-ldi-info" class="ldi-info-trigger-btn" title="Learn what makes the Landon Draft Index different">
                        <span class="ldi-info-icon">?</span>
                        <span class="ldi-info-text">What is LDI?</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * View 1: Yearly Archive Draft Room
     */
    renderYearlyView(container) {
        const analytics = this.computeSeasonAnalytics(this.selectedYear);
        const maxWeeks = analytics.maxWeeksInSeason || (this.selectedYear >= 2021 ? 17 : 16);
        const defaultPossibleG = Math.max(1, maxWeeks - 1);
        const managerPicksMap = analytics.managerPicksMap || {};
        const managerLeaderboard = analytics.managerLeaderboard || [];
        const isUnplayed = analytics.isUnplayedSeason;

        const formatLdiVal = (val, showPlus = true) => {
            const num = Number(val);
            if (isNaN(num)) return '0.0';
            return (showPlus && num >= 0 ? '+' : '') + num.toFixed(1);
        };

        // Group picks by round
        const roundsMap = {};
        analytics.picks.forEach(p => {
            const r = p.round;
            if (!roundsMap[r]) roundsMap[r] = [];
            roundsMap[r].push(p);
        });
        const roundsList = Object.keys(roundsMap).map(Number).sort((a, b) => a - b);

        // Year Selector Buttons HTML
        const yearButtonsHTML = this.seasons.map(yr => `
            <button class="season-pill-btn ${yr === this.selectedYear ? 'active' : ''}" data-year="${yr}">
                ${this.formatSeasonYear(yr)}
            </button>
        `).join('');

        // Top Summary Hero Cards HTML (Yearly view)
        let heroCardsHTML = '';
        if (isUnplayed) {
            heroCardsHTML = `
                <div class="draft-unplayed-banner">
                    <div class="draft-unplayed-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    </div>
                    <div class="draft-unplayed-content">
                        <h3>${this.formatSeasonYear(this.selectedYear)} Draft Completed · Season Pending Kickoff</h3>
                        <p>Weekly game statistics have not started yet for this season. The <strong>Landon Draft Index (LDI)</strong> will automatically populate starting in Week 1 as weekly game data is recorded, dialing in continuously as the season progresses.</p>
                    </div>
                </div>
            `;
        } else {
            const topDraftChampion = managerLeaderboard[0] || null;
            const worstDraftObj = analytics.worstDraft || null;

            const champScore = topDraftChampion ? (topDraftChampion.LDI_manager_season ?? 0) : 0;
            const champGrade = topDraftChampion ? (topDraftChampion.gradeInfo || { grade: 'A+', color: '#10b981' }) : { grade: 'A+', color: '#10b981' };

            const worstScore = worstDraftObj ? (worstDraftObj.LDI_manager_season ?? 0) : 0;
            const worstGrade = worstDraftObj ? (worstDraftObj.gradeInfo || { grade: 'F', color: '#ef4444' }) : { grade: 'F', color: '#ef4444' };

            const stealScore = analytics.bestSteal ? (analytics.bestSteal.ldiResult?.LDI_pick ?? 0) : 0;
            const whatIfScore = analytics.biggestWhatIf ? (analytics.biggestWhatIf.ldiResult?.LDI_pick ?? 0) : 0;
            const bustScore = analytics.biggestBust ? (analytics.biggestBust.ldiResult?.LDI_pick ?? 0) : 0;
            const champHTML = topDraftChampion ? `
                <div class="draft-hero-card champion-glow">
                    <div class="draft-card-tag champion-tag">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/></svg>
                        <span>Draft Class Champion</span>
                    </div>
                    <div class="draft-card-main-val clickable-mgr champion-name" data-mgr-id="${topDraftChampion.managerId}">${this.nameMode === 'team' ? topDraftChampion.teamName : topDraftChampion.managerName}</div>
                    <div class="draft-card-sub">
                        Landon Draft Index: <strong style="color: ${champGrade.color}; font-size: 1.15rem;">${topDraftChampion.draftIndex} / 100 (${champGrade.grade})</strong>
                    </div>
                    <div class="draft-metric-pill gold-crown" title="Average Manager LDI & Scoring Hits">
                        ${formatLdiVal(champScore, true)} Mean LDI (${topDraftChampion.hits} Hits)
                    </div>
                </div>
            ` : '';

            const worstHTML = worstDraftObj ? `
                <div class="draft-hero-card worst-draft-glow">
                    <div class="draft-card-tag worst-draft-tag">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                        <span>Worst Draft of the Year</span>
                    </div>
                    <div class="draft-card-main-val clickable-mgr" data-mgr-id="${worstDraftObj.managerId}">${this.nameMode === 'team' ? worstDraftObj.teamName : worstDraftObj.managerName}</div>
                    <div class="draft-card-sub">
                        Landon Draft Index: <strong style="color: ${worstGrade.color}; font-size: 1.15rem;">${worstDraftObj.draftIndex} / 100 (${worstGrade.grade})</strong>
                    </div>
                    <div class="draft-metric-pill doom-crimson" title="Average Manager LDI & Scoring Busts">
                        ${formatLdiVal(worstScore, false)} Mean LDI (${worstDraftObj.busts} Busts)
                    </div>
                </div>
            ` : '';

            const stealHTML = analytics.bestSteal ? `
                <div class="draft-hero-card steal-glow">
                    <div class="draft-card-tag steal-tag">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="6 3 18 3 22 9 12 22 2 9 6 3"></polygon></svg>
                        <span>Steal of the Draft</span>
                    </div>
                    <div class="draft-card-main-val">${analytics.bestSteal.playerName}</div>
                    <div class="draft-card-sub">
                        <strong>${analytics.bestSteal.position}</strong> · Rd ${analytics.bestSteal.round} (Pick #${analytics.bestSteal.overallPick}) · <em class="clickable-mgr" data-mgr-id="${analytics.bestSteal.managerId}">${analytics.bestSteal.managerName}</em>
                    </div>
                    <div class="draft-metric-pill green-gem" title="Landon Draft Index Pick Score & LDI Raw Output">
                        ${analytics.bestSteal.draftedPosRank} &rarr; ${analytics.bestSteal.finishPosRank} <span style="font-weight:800; margin-left:4px;">(${analytics.bestSteal.ldiResult?.pickDisplayScore ?? 50} LDI · ${formatLdiVal(stealScore, true)} LDI Raw)</span>
                    </div>
                </div>
            ` : '';

            const whatIfHTML = analytics.biggestWhatIf ? `
                <div class="draft-hero-card whatif-glow">
                    <div class="draft-card-tag whatif-tag">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                        <span>Biggest What If</span>
                    </div>
                    <div class="draft-card-main-val">${analytics.biggestWhatIf.playerName}</div>
                    <div class="draft-card-sub">
                        <strong>${analytics.biggestWhatIf.position}</strong> · Rd ${analytics.biggestWhatIf.round} (Pick #${analytics.biggestWhatIf.overallPick}) · <em class="clickable-mgr" data-mgr-id="${analytics.biggestWhatIf.managerId}">${analytics.biggestWhatIf.managerName}</em>
                    </div>
                    <div class="draft-metric-pill purple-cosmic" title="Pace-Adjusted LDI Pick Score: elite production per game despite missed time preventing positional finish leap">
                        ${analytics.biggestWhatIf.draftedPosRank} &rarr; ${analytics.biggestWhatIf.finishPosRank} <span style="font-weight:800; margin-left:4px;">(${analytics.biggestWhatIf.ldiResult?.pickDisplayScore ?? 50} LDI · ${formatLdiVal(whatIfScore, true)} LDI Raw)</span>
                    </div>
                </div>
            ` : '';

            const bustHTML = analytics.biggestBust ? `
                <div class="draft-hero-card bust-glow">
                    <div class="draft-card-tag bust-tag">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                        <span>Biggest Bust</span>
                    </div>
                    <div class="draft-card-main-val">${analytics.biggestBust.playerName}</div>
                    <div class="draft-card-sub">
                        <strong>${analytics.biggestBust.position}</strong> · Rd ${analytics.biggestBust.round} (Pick #${analytics.biggestBust.overallPick}) · <em class="clickable-mgr" data-mgr-id="${analytics.biggestBust.managerId}">${analytics.biggestBust.managerName}</em>
                    </div>
                    <div class="draft-metric-pill flame-amber" title="Landon Draft Index Pick Score & LDI Raw Output">
                        ${analytics.biggestBust.draftedPosRank} &rarr; ${analytics.biggestBust.finishPosRank} <span style="font-weight:800; margin-left:4px;">(${analytics.biggestBust.ldiResult?.pickDisplayScore ?? 50} LDI · ${formatLdiVal(bustScore, false)} LDI Raw)</span>
                    </div>
                </div>
            ` : '';

            heroCardsHTML = `
                <div class="draft-analytics-grid five-cards">
                    ${champHTML}
                    ${worstHTML}
                    ${stealHTML}
                    ${whatIfHTML}
                    ${bustHTML}
                </div>
            `;
        }

        // Manager Leaderboard Table/Chips
        const managerChipsHTML = managerLeaderboard.map((m, idx) => {
            if (isUnplayed) {
                return `
                    <div class="draft-mgr-chip clickable-mgr" data-mgr-id="${m.managerId}" style="border-left: 3px solid #94a3b8;" title="Season Pending">
                        <span class="draft-chip-rank">#${idx + 1}</span>
                        <span class="draft-chip-name">${this.nameMode === 'team' ? m.teamName : m.managerName}</span>
                        <span class="draft-chip-score" style="color: #94a3b8; font-weight: 600;">Pending</span>
                    </div>
                `;
            }
            const g = m.gradeInfo || { grade: 'B', color: '#10b981' };
            const compScore = Number(m.LDI_manager_season ?? 0);
            return `
                <div class="draft-mgr-chip clickable-mgr" data-mgr-id="${m.managerId}" style="border-left: 3px solid ${g.color};" title="Draft Grade: ${m.draftIndex}/100 (${g.grade}) • Mean LDI: ${compScore >= 0 ? '+' : ''}${compScore.toFixed(2)} • Hits: ${m.hits} • Busts: ${m.busts}">
                    <span class="draft-chip-rank">#${idx + 1}</span>
                    <span class="draft-chip-name">${this.nameMode === 'team' ? m.teamName : m.managerName}</span>
                    <span class="draft-chip-score" style="color: ${g.color}; font-weight: 800;">
                        ${m.draftIndex} <small style="font-size:0.75em; color:var(--text-muted); font-weight: 600;">(${g.grade})</small>
                    </span>
                </div>
            `;
        }).join('');

        // Pick Row Renderer
        const renderPickRow = (p) => {
            const displayName = this.nameMode === 'team' ? p.teamName : p.managerName;
            const isDefOrK = (p.position === 'DEF' || p.position === 'D/ST' || p.position === 'K');
            const ldi = p.ldiResult;

            // LDI Pick Score Badge
            let scoreBadge = '';
            if (isUnplayed) {
                scoreBadge = `<span class="pick-val-badge pending" title="Weekly games pending">Pending</span>`;
            } else if (isDefOrK) {
                scoreBadge = `<span class="pick-val-badge omitted" title="Kickers and Defenses are unrated in LDI">K / DEF</span>`;
            } else if (ldi && ldi.isScored) {
                const gradeInfo = LDIEngine.getScoreGrade(ldi.pickDisplayScore);
                scoreBadge = `
                    <span class="pick-val-badge ${gradeInfo.tier}" style="background: ${gradeInfo.bg}; color: ${gradeInfo.color}; border: 1px solid ${gradeInfo.border};" title="LDI Pick Score: ${ldi.pickDisplayScore} / 100 (${gradeInfo.grade}) · LDI Raw: ${ldi.LDI_pick >= 0 ? '+' : ''}${ldi.LDI_pick.toFixed(2)} · Residual: ${ldi.Residual >= 0 ? '+' : ''}${ldi.Residual.toFixed(1)} pts vs ${ldi.E_adj} exp (${ldi.eRate} PPG)">
                        <strong>${ldi.pickDisplayScore}</strong> <small style="font-size: 0.72em; opacity: 0.9; margin-left: 2px; font-weight: 700;">LDI</small>
                    </span>
                `;
            }

            // Missed Games Badge
            let injuryBadge = '';
            const missedCount = (p.gamesMissed !== undefined && p.gamesMissed !== null) ? p.gamesMissed : (ldi?.gamesMissed ?? 0);
            const possibleG = (p.possibleGames !== undefined && p.possibleGames !== null) ? p.possibleGames : (ldi?.possibleGames ?? defaultPossibleG);
            const gamesPlayed = (p.gamesPlayed !== undefined && p.gamesPlayed !== null) ? p.gamesPlayed : (ldi?.gamesPlayed ?? 0);

            if (!isUnplayed && missedCount >= 4) {
                if (gamesPlayed > 0 && p.totalPoints > 0) {
                    const pacePts = ((p.totalPoints / Math.max(1, gamesPlayed)) * possibleG);
                    const posPaceRank = this.getPositionalPaceRank(p.position, pacePts, this.selectedYear, analytics.scoringFormat, analytics.posGrouped);
                    const paceDisplay = posPaceRank ? ` (${posPaceRank} Pace)` : '';
                    const adjExpVal = ldi?.E_adj !== undefined ? `${ldi.E_adj} adj exp` : 'prorated expected';
                    injuryBadge = `
                        <span class="pick-sub-tag injury" title="Missed ${missedCount} regular season games (Paced for ${pacePts.toFixed(1)} pts = ${posPaceRank || 'pace'} over ${possibleG} games vs ${adjExpVal})">Missed ${missedCount} Games${paceDisplay}</span>
                    `;
                } else {
                    injuryBadge = `
                        <span class="pick-sub-tag injury" title="Missed entire season (${missedCount} games) due to injury. No baseline penalty applied (Z = 0).">Missed ${missedCount} Games</span>
                    `;
                }
            }

            // Consistency Pills
            let tailPillBadge = '';
            if (!isUnplayed && ldi && ldi.consistentBooms) {
                tailPillBadge = `
                    <span class="pick-sub-tag consistent-booms consistent-with-booms" title="${ldi.consistentBoomsTooltip}">Consistent with Booms</span>
                `;
            } else if (!isUnplayed && ldi && ldi.inconsistentProducer) {
                tailPillBadge = `
                    <span class="pick-sub-tag inconsistent-producer boom-bust" title="${ldi.inconsistentTooltip}">Inconsistent Producer</span>
                `;
            }

            // Low Confidence Warning
            let lowConfBadge = '';
            if (!isUnplayed && ldi && ldi.isLowConfidence) {
                lowConfBadge = `
                    <span class="pick-sub-tag low-conf" title="Draft rank exceeded historical training sample depth (evaluated via conservative extrapolation)">Extrapolated Slot</span>
                `;
            }

            // Transaction Badge
            let txBadge = '';
            const pickYr = p.year || this.selectedYear;
            if (p.tagType === 'traded' && p.destinationTag) {
                txBadge = `<button type="button" class="pick-sub-tag traded" data-pick-overall="${p.overallPick}" data-year="${pickYr}" title="Click to view full trade details">⇄ ${p.destinationTag}</button>`;
            } else if (p.tagType === 'dropped' && p.destinationTag) {
                txBadge = `<button type="button" class="pick-sub-tag dropped" data-pick-overall="${p.overallPick}" data-year="${pickYr}" title="Click to view full add/drop transaction history">↓ ${p.destinationTag}</button>`;
            }

            const posClass = `pos-${(p.position || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            const headshotHtml = (p.headshot_url || p.headshotUrl)
                ? `<img src="${p.headshot_url || p.headshotUrl}" alt="${p.playerName}" class="pick-player-headshot" onerror="this.style.display='none'">`
                : '';

            return `
                <div class="draft-pick-row">
                    <div class="pick-num-badge">
                        <span class="pick-overall">#${p.overallPick}</span>
                        <span class="pick-round-pos">${this.displayGrouping === 'manager' ? `Rd ${p.round}` : `${p.round}.${p.roundPick < 10 ? '0' + p.roundPick : p.roundPick}`}</span>
                    </div>

                    <div class="pick-info-col">
                        <div class="pick-top-line">
                            ${headshotHtml}
                            <span class="pick-player-name">${p.playerName}</span>
                            <span class="pick-pos-pill ${posClass}">${p.position}${p.nflTeam ? ' · ' + p.nflTeam : ''}</span>
                        </div>
                        
                        <div class="pick-owner-line">
                            <span class="pick-owner-name clickable-mgr" data-mgr-id="${p.managerId}">${displayName}</span>
                        </div>

                        <div class="pick-ranks-line">
                            <span class="rank-step"><small>Drafted:</small> <strong>${p.draftedPosRank}</strong></span>
                            <span class="rank-arrow">&rarr;</span>
                            <span class="rank-step"><small>Finish:</small> <strong>${p.finishPosRank}</strong></span>
                            ${scoreBadge}
                        </div>

                        ${(injuryBadge || tailPillBadge || lowConfBadge || txBadge) ? `
                            <div class="pick-tags-line">
                                ${injuryBadge}
                                ${tailPillBadge}
                                ${lowConfBadge}
                                ${txBadge}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        };

        // 3-Column Round Cards Grid HTML
        const roundCardsHTML = roundsList.map(rNum => {
            const picks = roundsMap[rNum] || [];
            const pickRowsHTML = picks.map(p => renderPickRow(p)).join('');

            return `
                <div class="draft-round-card">
                    <div class="draft-round-header">
                        <span class="round-title">ROUND ${rNum}</span>
                        <span class="round-pick-count">${picks.length} Picks</span>
                    </div>
                    <div class="draft-picks-list">
                        ${pickRowsHTML}
                    </div>
                </div>
            `;
        }).join('');

        // 3-Column Manager/Team Cards Grid HTML
        const managerOrderList = [];
        const seenMgrIds = new Set();
        (roundsMap[1] || []).forEach(p => {
            if (p.managerId && !seenMgrIds.has(p.managerId)) {
                seenMgrIds.add(p.managerId);
                managerOrderList.push(p.managerId);
            }
        });
        Object.keys(managerPicksMap).forEach(mId => {
            if (!seenMgrIds.has(mId)) {
                seenMgrIds.add(mId);
                managerOrderList.push(mId);
            }
        });

        const managerCardsHTML = managerOrderList.map((mId, slotIdx) => {
            const mData = managerPicksMap[mId];
            if (!mData) return '';
            const mPicks = [...mData.picks].sort((a, b) => a.overallPick - b.overallPick);
            const mRollup = managerLeaderboard.find(r => r.managerId === mId);
            const mTitle = this.nameMode === 'team' ? mData.teamName : mData.managerName;
            const pickRowsHTML = mPicks.map(p => renderPickRow(p)).join('');

            return `
                <div class="draft-round-card">
                    <div class="draft-round-header">
                        <div>
                            <span class="round-title clickable-mgr" data-mgr-id="${mId}">${mTitle}</span>
                            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; margin-left: 6px;">Slot #${slotIdx + 1}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${mRollup && !isUnplayed ? `<span class="draft-chip-score" style="color: ${mRollup.gradeInfo?.color || '#10b981'}; font-weight: 800;" title="LDI Draft Efficiency Grade">${mRollup.draftIndex} / 100 (${mRollup.gradeInfo?.grade || 'B'})</span>` : ''}
                            <span class="round-pick-count">${mPicks.length} Picks</span>
                        </div>
                    </div>
                    <div class="draft-picks-list">
                        ${pickRowsHTML}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = `
            <div class="draft-view-wrapper">
                <!-- Sub-navigation Bar -->
                ${this.renderSubNavHTML()}

                <!-- Draft Hero Banner -->
                <div class="draft-hero-banner">
                    <div class="draft-hero-title-group">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                            <div>
                                <span class="draft-hero-subtitle">Historical Draft Room</span>
                                <h1>${this.selectedYear} League Draft</h1>
                            </div>
                        </div>
                        <p class="draft-hero-desc">
                            Complete round-by-round draft results with drafted positional ranks, season-end positional finishes, injury indicators, and the <strong>Landon Draft Index (LDI)</strong>.
                        </p>
                    </div>

                    <!-- Year Selector Toolbar -->
                    <div class="draft-toolbar-row">
                        <div class="draft-seasons-scroll">
                            ${yearButtonsHTML}
                        </div>

                        <div class="draft-controls-group">
                            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600;">View:</span>
                            <div class="draft-toggle-pill">
                                <button id="btn-group-round" class="draft-toggle-btn ${this.displayGrouping === 'round' ? 'active' : ''}">By Round</button>
                                <button id="btn-group-manager" class="draft-toggle-btn ${this.displayGrouping === 'manager' ? 'active' : ''}">By ${this.nameMode === 'team' ? 'Team' : 'Manager'}</button>
                            </div>

                            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-left: 6px;">Names:</span>
                            <div class="draft-toggle-pill">
                                <button id="btn-toggle-mgr" class="draft-toggle-btn ${this.nameMode === 'manager' ? 'active' : ''}">Managers</button>
                                <button id="btn-toggle-team" class="draft-toggle-btn ${this.nameMode === 'team' ? 'active' : ''}">Teams</button>
                            </div>
                            <span class="scoring-format-badge">${analytics.scoringFormat}</span>
                        </div>
                    </div>
                </div>

                <!-- Hero Cards -->
                ${heroCardsHTML}

                <!-- Manager Leaderboard Chip Bar -->
                <div class="draft-leaderboard-bar">
                    <div class="draft-leaderboard-title">${isUnplayed ? 'Draft Class Slots:' : 'Draft Efficiency Standings (LDI):'}</div>
                    <div class="draft-chips-scroll">
                        ${managerChipsHTML}
                    </div>
                </div>

                <!-- 3-Column Grid (Round or Manager/Team cards) -->
                <div class="draft-rounds-grid">
                    ${this.displayGrouping === 'manager' ? managerCardsHTML : roundCardsHTML}
                </div>
            </div>
        `;

        this.attachCommonListeners(container, analytics);
    }

    /**
     * View 2: Draft Overall (All-Time Macro Leaderboard & Top 5 Records)
     */
    renderOverallView(container) {
        const allTime = this.computeAllTimeAnalytics(this.overallYearFilter, this.overallIncludeRetired, this.overallCustomStart, this.overallCustomEnd);
        const managerLeaderboard = allTime.managerCompositeList;
        const targetSeasons = allTime.targetSeasons || [];
        const isCustom = this.overallYearFilter === 'custom';
        const isPresent = this.overallYearFilter === '2020-present';
        const isSingleYear = !['all', '2020-present', 'custom'].includes(this.overallYearFilter);

        let heroSubtitle = 'All-Time League Compilation';
        let heroTitle = 'All-Time Draft Leaderboard & Records';
        let heroDesc = `Macro analysis of every draft pick and manager performance across league history (${this.seasons.length} Seasons). Ranked by the <strong>Statistically Shrunk Composite LDI</strong>, accounting for career sample size, positional scarcity, and consistency.`;
        let tableColTitle = 'Composite LDI';
        let sectionTitle = 'All-Time Manager Draft Leaderboard';
        let sectionTag = `Ranked by Career Composite LDI (${managerLeaderboard.length} Managers)`;

        if (isPresent) {
            heroSubtitle = '2020–Present Draft Analytics';
            heroTitle = '2020–Present Draft Leaderboard & Records';
            heroDesc = `Comparative multi-season draft evaluation for drafts from 2020 to present (${targetSeasons.length} Seasons) based on empirical rate scoring, games-missed proration, and positional scarcity.`;
            tableColTitle = '2020+ Score';
            sectionTitle = '2020–Present Draft Leaderboard';
            sectionTag = `Ranked by 2020–Present Composite (${managerLeaderboard.length} Managers)`;
        } else if (isCustom) {
            heroSubtitle = `${this.overallCustomStart}–${this.overallCustomEnd} Draft Analytics`;
            heroTitle = `${this.overallCustomStart}–${this.overallCustomEnd} Draft Leaderboard & Records`;
            heroDesc = `Comparative multi-season draft evaluation for drafts from ${this.overallCustomStart} to ${this.overallCustomEnd} (${targetSeasons.length} Seasons) based on empirical rate scoring, games-missed proration, and positional scarcity.`;
            tableColTitle = 'Span Score';
            sectionTitle = `${this.overallCustomStart}–${this.overallCustomEnd} Draft Leaderboard`;
            sectionTag = `Ranked by ${this.overallCustomStart}–${this.overallCustomEnd} Composite (${managerLeaderboard.length} Managers)`;
        } else if (isSingleYear) {
            heroSubtitle = `${this.overallYearFilter} Season Analytics`;
            heroTitle = `${this.overallYearFilter} Draft Leaderboard & Records`;
            heroDesc = `Single-season comparative evaluation for the ${this.overallYearFilter} draft class based on empirical rate scoring, games-missed proration, and positional scarcity.`;
            tableColTitle = `${this.overallYearFilter} Score`;
            sectionTitle = `${this.overallYearFilter} Season Draft Leaderboard`;
            sectionTag = `Ranked by ${this.overallYearFilter} Draft Score (${managerLeaderboard.length} Managers)`;
        }

        const sortedAsc = [...this.seasons].sort((a, b) => a - b);
        const yearOptionsStartHTML = sortedAsc.map(y => `<option value="${y}" ${Number(this.overallCustomStart) === Number(y) ? 'selected' : ''}>${this.formatSeasonYear(y)}</option>`).join('');
        const yearOptionsEndHTML = sortedAsc.map(y => `<option value="${y}" ${Number(this.overallCustomEnd) === Number(y) ? 'selected' : ''}>${this.formatSeasonYear(y)}</option>`).join('');

        const formatLdiVal = (val, showPlus = true) => {
            const num = Number(val);
            if (isNaN(num)) return '0.0';
            return (showPlus && num >= 0 ? '+' : '') + num.toFixed(2);
        };

        // Manager Leaderboard Rows
        const managerRowsHTML = managerLeaderboard.map((m, idx) => {
            const g = m.gradeInfo || { grade: 'B', color: '#10b981' };
            const rankClass = idx === 0 ? 'gold' : (idx === 1 ? 'silver' : (idx === 2 ? 'bronze' : ''));

            return `
                <tr class="draft-alltime-row clickable-mgr" data-mgr-id="${m.managerId}" title="Click to view ${m.managerName}'s complete solo draft scorecard">
                    <td class="col-rank"><span class="rank-badge ${rankClass}">#${idx + 1}</span></td>
                    <td class="col-manager">
                        <div class="mgr-cell-name">
                            <strong>${m.managerName}</strong> ${m.isRetired ? '<span class="retired-pill-badge">Retired</span>' : ''}
                            <small class="text-muted">${m.teamName}</small>
                        </div>
                    </td>
                    <td class="col-center"><span class="stat-bubble">${m.seasonsCount}</span></td>
                    <td class="col-center">${m.totalPicks}</td>
                    <td class="col-composite">
                        <div class="composite-grade-pill" style="border-color: ${g.border}; background: ${g.bg}; color: ${g.color};">
                            <span class="comp-score">${m.compositeScore}</span>
                            <span class="comp-grade">(${g.grade})</span>
                        </div>
                    </td>
                    <td class="col-mean" style="font-weight: 700; color: ${m.careerMeanLdi >= 0 ? '#10b981' : '#ef4444'};">
                        ${formatLdiVal(m.careerMeanLdi, true)}
                    </td>
                    <td class="col-center"><span class="hit-rate-text">${m.hitRate}%</span></td>
                    <td class="col-center"><span class="bust-rate-text">${m.bustRate}%</span></td>
                    <td class="col-center">
                        ${m.bestYear ? `<span class="best-year-badge">${m.bestYear} (${m.bestYearScore})</span>` : 'N/A'}
                    </td>
                    <td class="col-center"><span class="steal-count-badge">${m.stealsCount}</span></td>
                </tr>
            `;
        }).join('');

        // Top 5 Best Drafts Cards
        const bestDraftsHTML = allTime.top5BestDrafts.map((d, i) => `
            <div class="top5-item-row">
                <span class="top5-rank">#${i + 1}</span>
                <div class="top5-info">
                    <div class="top5-title clickable-mgr" data-mgr-id="${d.managerId}">${d.managerName} <small>(${d.seasonYear})</small></div>
                    <div class="top5-sub">${d.teamName} · ${d.hits} Hits</div>
                </div>
                <div class="top5-score-badge" style="color: ${d.gradeInfo?.color || '#10b981'};">
                    ${d.draftIndex} <small>(${d.gradeInfo?.grade || 'A+'})</small>
                </div>
            </div>
        `).join('');

        // Top 5 Worst Drafts Cards
        const worstDraftsHTML = allTime.top5WorstDrafts.map((d, i) => `
            <div class="top5-item-row">
                <span class="top5-rank">#${i + 1}</span>
                <div class="top5-info">
                    <div class="top5-title clickable-mgr" data-mgr-id="${d.managerId}">${d.managerName} <small>(${d.seasonYear})</small></div>
                    <div class="top5-sub">${d.teamName} · ${d.busts} Busts</div>
                </div>
                <div class="top5-score-badge" style="color: ${d.gradeInfo?.color || '#ef4444'};">
                    ${d.draftIndex} <small>(${d.gradeInfo?.grade || 'F'})</small>
                </div>
            </div>
        `).join('');

        // Top 5 Best Picks Cards
        const bestPicksHTML = allTime.top5BestPicks.map((p, i) => `
            <div class="top5-item-row">
                <span class="top5-rank">#${i + 1}</span>
                <div class="top5-info">
                    <div class="top5-title">${p.playerName} <small>(${p.seasonYear})</small></div>
                    <div class="top5-sub">${p.position} · Rd ${p.round} (#${p.overallPick}) · <span class="clickable-mgr" data-mgr-id="${p.managerId}">${p.managerName}</span></div>
                </div>
                <div class="top5-score-badge" style="color: #10b981;">
                    ${p.ldiResult?.pickDisplayScore ?? 99} <small style="font-size:0.7em;">(${formatLdiVal(p.ldiResult?.LDI_pick ?? 0, true)})</small>
                </div>
            </div>
        `).join('');

        // Top 5 Biggest Busts Cards
        const biggestBustsHTML = allTime.top5BiggestBusts.map((p, i) => `
            <div class="top5-item-row">
                <span class="top5-rank">#${i + 1}</span>
                <div class="top5-info">
                    <div class="top5-title">${p.playerName} <small>(${p.seasonYear})</small></div>
                    <div class="top5-sub">${p.position} · Rd ${p.round} (#${p.overallPick}) · <span class="clickable-mgr" data-mgr-id="${p.managerId}">${p.managerName}</span></div>
                </div>
                <div class="top5-score-badge" style="color: #ef4444;">
                    ${p.ldiResult?.pickDisplayScore ?? 1} <small style="font-size:0.7em;">(${formatLdiVal(p.ldiResult?.LDI_pick ?? 0, false)})</small>
                </div>
            </div>
        `).join('');

        // Top 5 Biggest What Ifs Cards
        const whatIfsHTML = allTime.top5WhatIfs.map((p, i) => `
            <div class="top5-item-row">
                <span class="top5-rank">#${i + 1}</span>
                <div class="top5-info">
                    <div class="top5-title">${p.playerName} <small>(${p.seasonYear})</small></div>
                    <div class="top5-sub">${p.position} · Missed ${p.gamesMissed} Games · <span class="clickable-mgr" data-mgr-id="${p.managerId}">${p.managerName}</span></div>
                </div>
                <div class="top5-score-badge" style="color: #a855f7;">
                    ${p.ldiResult?.pickDisplayScore ?? 75} <small style="font-size:0.7em;">(${formatLdiVal(p.ldiResult?.LDI_pick ?? 0, true)})</small>
                </div>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="draft-view-wrapper">
                <!-- Sub-navigation Bar -->
                ${this.renderSubNavHTML()}

                <!-- Draft Overall Hero Banner -->
                <div class="draft-hero-banner">
                    <div class="draft-hero-title-group">
                        <span class="draft-hero-subtitle">${heroSubtitle}</span>
                        <h1>${heroTitle}</h1>
                        <p class="draft-hero-desc">
                            ${heroDesc}
                        </p>
                    </div>

                    <!-- Filter Controls Bar -->
                    <div class="draft-toolbar-row">
                        <div class="draft-filters-bar" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
                            <div class="draft-filter-item" style="display: flex; gap: 6px; align-items: center;">
                                <span class="draft-filter-label">Seasons:</span>
                                <div class="records-year-group">
                                    <button class="records-year-btn ${this.overallYearFilter === 'all' ? 'active' : ''}" data-section="overall" data-year="all">All Years</button>
                                    <button class="records-year-btn ${this.overallYearFilter === '2020-present' ? 'active' : ''}" data-section="overall" data-year="2020-present">2020–Present</button>
                                    <button class="records-year-btn ${this.overallYearFilter === 'custom' ? 'active' : ''}" data-section="overall" data-year="custom">Custom Span</button>
                                </div>
                            </div>

                            <div class="records-custom-span-wrap" id="overall-custom-span-wrap" style="${this.overallYearFilter === 'custom' ? 'display:flex; gap:6px; align-items:center;' : 'display:none;'}">
                                <select id="overall-custom-start" class="records-custom-span-select">
                                    ${yearOptionsStartHTML}
                                </select>
                                <span style="color:var(--text-muted); font-size:0.8rem;">to</span>
                                <select id="overall-custom-end" class="records-custom-span-select">
                                    ${yearOptionsEndHTML}
                                </select>
                            </div>

                            <div class="draft-filter-item">
                                <span class="draft-filter-label">Single Season:</span>
                                <select id="overall-filter-year-select" class="draft-filter-select">
                                    <option value="all" ${['all', '2020-present', 'custom'].includes(this.overallYearFilter) ? 'selected' : ''}>-- Single Year --</option>
                                    ${this.seasons.map(yr => `
                                        <option value="${yr}" ${String(this.overallYearFilter) === String(yr) ? 'selected' : ''}>${this.formatSeasonYear(yr)} Season</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="draft-filter-item">
                                <label class="draft-toggle-label" title="Toggle retired managers in historical rankings">
                                    <input type="checkbox" id="overall-toggle-retired" class="draft-toggle-checkbox" ${this.overallIncludeRetired ? 'checked' : ''}>
                                    <span>Include Retired Managers</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- All-Time / Filtered Leaderboard Section -->
                <div class="draft-overall-section">
                    <div class="section-header-row">
                        <h2>${sectionTitle}</h2>
                        <span class="section-tag-badge">${sectionTag}</span>
                    </div>

                    <div class="table-container draft-table-card">
                        <table class="data-table draft-alltime-table">
                            <thead>
                                <tr>
                                    <th class="col-rank">Rank</th>
                                    <th class="col-manager">Manager / Team</th>
                                    <th class="col-center" title="Total seasons drafted in filter">Seasons</th>
                                    <th class="col-center" title="Total skill picks evaluated">Picks</th>
                                    <th class="col-composite" title="Sample-size adjusted 1-99 Composite Grade">${tableColTitle}</th>
                                    <th class="col-mean" title="Career unweighted mean LDI per pick">Mean LDI</th>
                                    <th class="col-center" title="% of picks scoring >= 75 LDI">Hit Rate</th>
                                    <th class="col-center" title="% of picks scoring <= 25 LDI">Bust Rate</th>
                                    <th class="col-center" title="Best single-season draft score">Best Year</th>
                                    <th class="col-center" title="Steal picks">Steals</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${managerRowsHTML.length > 0 ? managerRowsHTML : '<tr><td colspan="10" class="text-muted" style="text-align:center; padding: 24px;">No managers match the selected filter.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Top 5 Record Modules Grid -->
                <div class="draft-top5-grid">
                    <!-- Top 5 Best Drafts -->
                    <div class="top5-card gold-border">
                        <div class="top5-header">
                            <span class="top5-header-tag" style="color: #10b981;">Draft Class Mastery</span>
                            <h3>Top 5 Best Drafts of All Time</h3>
                        </div>
                        <div class="top5-list">
                            ${bestDraftsHTML || '<div class="top5-empty">No entries found</div>'}
                        </div>
                    </div>

                    <!-- Top 5 Worst Drafts -->
                    <div class="top5-card red-border">
                        <div class="top5-header">
                            <span class="top5-header-tag" style="color: #ef4444;">Draft Day Disasters</span>
                            <h3>Top 5 Worst Drafts of All Time</h3>
                        </div>
                        <div class="top5-list">
                            ${worstDraftsHTML || '<div class="top5-empty">No entries found</div>'}
                        </div>
                    </div>

                    <!-- Top 5 Best Picks / Steals -->
                    <div class="top5-card emerald-border">
                        <div class="top5-header">
                            <span class="top5-header-tag" style="color: #34d399;">Greatest Value Finds</span>
                            <h3>Top 5 Best Picks of All Time</h3>
                        </div>
                        <div class="top5-list">
                            ${bestPicksHTML || '<div class="top5-empty">No entries found</div>'}
                        </div>
                    </div>

                    <!-- Top 5 Biggest Busts -->
                    <div class="top5-card crimson-border">
                        <div class="top5-header">
                            <span class="top5-header-tag" style="color: #f87171;">Early Round Regrets</span>
                            <h3>Top 5 Biggest Busts of All Time</h3>
                        </div>
                        <div class="top5-list">
                            ${biggestBustsHTML || '<div class="top5-empty">No entries found</div>'}
                        </div>
                    </div>

                    <!-- Top 5 Biggest What Ifs -->
                    <div class="top5-card purple-border">
                        <div class="top5-header">
                            <span class="top5-header-tag" style="color: #c084fc;">Injury-Derailed Ceilings</span>
                            <h3>Top 5 Biggest What Ifs of All Time</h3>
                        </div>
                        <div class="top5-list">
                            ${whatIfsHTML || '<div class="top5-empty">No entries found</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.attachCommonListeners(container);
    }

    /**
     * View 3: Solo Team / Manager Draft Profile Tab with Year & Retired Filtering
     */
    renderTeamView(container) {
        const allTime = this.computeAllTimeAnalytics('all', true);
        const mgrList = this.getManagerList();
        
        const activeMgrs = mgrList.filter(m => !m.isRetired);
        const retiredMgrs = mgrList.filter(m => m.isRetired);
        const availableMgrs = this.soloIncludeRetired ? mgrList : activeMgrs;

        // If currently selected manager is retired and soloIncludeRetired is false, fallback to first active manager
        if (!this.soloIncludeRetired && this.selectedManagerId && this.isManagerRetired(this.selectedManagerId)) {
            if (activeMgrs.length > 0) {
                this.selectedManagerId = activeMgrs[0].id;
            }
        } else if (!this.selectedManagerId && availableMgrs.length > 0) {
            this.selectedManagerId = availableMgrs[0].id;
        }

        const mgrComposite = allTime.managerCompositeList.find(m => String(m.managerId).toLowerCase() === String(this.selectedManagerId).toLowerCase()) || 
                             allTime.managerCompositeList[0] || null;
        
        const mId = mgrComposite?.managerId || this.selectedManagerId;
        const managerName = mgrComposite?.managerName || 'Manager';
        const teamName = mgrComposite?.teamName || managerName;
        const isRetired = this.isManagerRetired(mId);

        const allSeasonRollups = mgrComposite?.seasonRollups || [];
        const allPicks = mgrComposite?.picks || [];
        const sortedAllSeasons = [...allSeasonRollups].sort((a, b) => b.seasonYear - a.seasonYear);

        const isCustom = this.soloYearFilter === 'custom';
        const isPresent = this.soloYearFilter === '2020-present';
        const isSingleYear = !['all', '2020-present', 'custom'].includes(this.soloYearFilter);

        // Filter target picks and target season rollups according to filter rule
        const targetPicks = allPicks.filter(p => this.filterSeasonByRule(p.seasonYear, this.soloYearFilter, this.soloCustomStart, this.soloCustomEnd));
        const targetSeasonRollups = sortedAllSeasons.filter(s => this.filterSeasonByRule(s.seasonYear, this.soloYearFilter, this.soloCustomStart, this.soloCustomEnd));

        const targetSeasonRollup = isSingleYear 
            ? sortedAllSeasons.find(s => String(s.seasonYear) === String(this.soloYearFilter))
            : null;

        const formatLdiVal = (val, showPlus = true) => {
            const num = Number(val);
            if (isNaN(num)) return '0.0';
            return (showPlus && num >= 0 ? '+' : '') + num.toFixed(2);
        };

        let heroSubtitle = `Solo Team Draft Profile · All-Time Career History`;
        let heroTitle = `${managerName}'s Draft History`;
        let heroDesc = `Career draft scorecard, year-over-year LDI performance trends, round efficiency, and historical draft class archives for ${managerName} (${sortedAllSeasons.length} Seasons).`;
        let cardMainTag = 'Composite Draft Grade';
        let peakTitle = 'Peak Performance';
        let peakVal = mgrComposite?.bestYear ?? 'N/A';
        let peakSub = `Best Score: ${mgrComposite?.bestYearScore ?? 'N/A'} / 100`;

        if (isPresent) {
            heroSubtitle = `Solo Team Draft Profile · 2020–Present Compilation`;
            heroTitle = `${managerName}'s 2020–Present Draft Profile`;
            heroDesc = `Multi-season draft scorecard and round efficiency breakdown for ${managerName} across the 2020–Present draft classes (${targetSeasonRollups.length} Seasons).`;
            cardMainTag = '2020+ Draft Grade';
            peakTitle = '2020+ Best Draft';
            const bestInSpan = [...targetSeasonRollups].sort((a, b) => b.draftIndex - a.draftIndex)[0];
            peakVal = bestInSpan ? `${bestInSpan.seasonYear} (${bestInSpan.draftIndex})` : 'N/A';
            peakSub = bestInSpan ? `Grade: ${bestInSpan.gradeInfo?.grade || 'A'}` : '';
        } else if (isCustom) {
            heroSubtitle = `Solo Team Draft Profile · ${this.soloCustomStart}–${this.soloCustomEnd} Compilation`;
            heroTitle = `${managerName}'s ${this.soloCustomStart}–${this.soloCustomEnd} Draft Profile`;
            heroDesc = `Multi-season draft scorecard and round efficiency breakdown for ${managerName} across the ${this.soloCustomStart}–${this.soloCustomEnd} draft classes (${targetSeasonRollups.length} Seasons).`;
            cardMainTag = `${this.soloCustomStart}–${this.soloCustomEnd} Draft Grade`;
            peakTitle = 'Span Best Draft';
            const bestInSpan = [...targetSeasonRollups].sort((a, b) => b.draftIndex - a.draftIndex)[0];
            peakVal = bestInSpan ? `${bestInSpan.seasonYear} (${bestInSpan.draftIndex})` : 'N/A';
            peakSub = bestInSpan ? `Grade: ${bestInSpan.gradeInfo?.grade || 'A'}` : '';
        } else if (isSingleYear) {
            heroSubtitle = `Solo Team Draft Profile · ${this.soloYearFilter} Draft Class`;
            heroTitle = `${managerName}'s ${this.soloYearFilter} Draft Scorecard`;
            heroDesc = `Single-season draft scorecard and round efficiency breakdown for ${managerName}'s <strong>${this.soloYearFilter} Draft Class</strong>.`;
            cardMainTag = `${this.soloYearFilter} Draft Grade`;
            peakTitle = `${this.soloYearFilter} Class Score`;
            peakVal = `${targetSeasonRollup?.draftIndex ?? 50} / 100`;
            peakSub = `Season Grade: ${targetSeasonRollup?.gradeInfo?.grade || 'B'}`;
        }

        // Scorecard calculations
        let displayScore = 50;
        let gradeInfo = { grade: 'B', color: '#10b981' };
        let displayMeanLdi = 0;
        let totalPicksCount = targetPicks.length;
        let seasonsCount = targetSeasonRollups.length;
        let hitCount = targetPicks.filter(p => (p.ldiResult?.pickDisplayScore ?? 50) >= 75).length;
        let bustCount = targetPicks.filter(p => (p.ldiResult?.pickDisplayScore ?? 50) < 30).length;
        let hitRate = totalPicksCount > 0 ? Math.round((hitCount / totalPicksCount) * 100) : 0;
        let bustRate = totalPicksCount > 0 ? Math.round((bustCount / totalPicksCount) * 100) : 0;

        if (isSingleYear && targetSeasonRollup) {
            displayScore = targetSeasonRollup.draftIndex;
            gradeInfo = targetSeasonRollup.gradeInfo || LDIEngine.getScoreGrade(displayScore);
            displayMeanLdi = targetSeasonRollup.LDI_manager_season ?? targetSeasonRollup.meanLdi ?? 0;
            hitCount = targetSeasonRollup.hits;
            bustCount = targetSeasonRollup.busts;
            totalPicksCount = targetSeasonRollup.scoredPicksCount;
            hitRate = totalPicksCount > 0 ? Math.round((hitCount / totalPicksCount) * 100) : 0;
            bustRate = totalPicksCount > 0 ? Math.round((bustCount / totalPicksCount) * 100) : 0;
            seasonsCount = 1;
        } else if (targetPicks.length > 0 && targetSeasonRollups.length > 0) {
            const spanComposite = ldiEngine.computeCareerComposite(targetPicks, targetSeasonRollups);
            displayScore = spanComposite.compositeScore;
            gradeInfo = spanComposite.gradeInfo;
            displayMeanLdi = spanComposite.careerMeanLdi;
            hitCount = spanComposite.hitCount;
            bustCount = spanComposite.bustCount;
            hitRate = spanComposite.hitRate;
            bustRate = spanComposite.bustRate;
            totalPicksCount = spanComposite.totalPicks;
            seasonsCount = spanComposite.seasonsCount;
        } else if (mgrComposite) {
            displayScore = mgrComposite.compositeScore;
            gradeInfo = mgrComposite.gradeInfo;
            displayMeanLdi = mgrComposite.careerMeanLdi;
            hitCount = mgrComposite.hitCount;
            bustCount = mgrComposite.bustCount;
            hitRate = mgrComposite.hitRate;
            bustRate = mgrComposite.bustRate;
            totalPicksCount = mgrComposite.totalPicks;
            seasonsCount = mgrComposite.seasonsCount;
        }

        const sortedAsc = [...this.seasons].sort((a, b) => a - b);
        const soloYearOptionsStartHTML = sortedAsc.map(y => `<option value="${y}" ${Number(this.soloCustomStart) === Number(y) ? 'selected' : ''}>${y}</option>`).join('');
        const soloYearOptionsEndHTML = sortedAsc.map(y => `<option value="${y}" ${Number(this.soloCustomEnd) === Number(y) ? 'selected' : ''}>${y}</option>`).join('');

        // Manager Dropdown Options
        const activeOptions = activeMgrs.map(m => `<option value="${m.id}" ${String(m.id).toLowerCase() === String(mId).toLowerCase() ? 'selected' : ''}>${m.name} (${m.team})</option>`).join('');
        const retiredOptions = retiredMgrs.map(m => `<option value="${m.id}" ${String(m.id).toLowerCase() === String(mId).toLowerCase() ? 'selected' : ''}>${m.name} [Retired] (${m.team})</option>`).join('');

        // Manager Selector Pills HTML (Visible managers only)
        const mgrSelectorButtonsHTML = availableMgrs.map(m => `
            <button class="season-pill-btn ${String(m.id).toLowerCase() === String(mId).toLowerCase() ? 'active' : ''} ${m.isRetired ? 'retired-pill' : ''}" data-mgr-select="${m.id}">
                ${m.name} ${m.isRetired ? '<small>(Ret)</small>' : ''}
            </button>
        `).join('');

        // Compute Round-by-Round Efficiency on targetPicks
        const earlyPicks = targetPicks.filter(p => p.round <= 4);
        const midPicks = targetPicks.filter(p => p.round >= 5 && p.round <= 8);
        const latePicks = targetPicks.filter(p => p.round >= 9);

        const earlyHits = earlyPicks.filter(p => (p.ldiResult?.pickDisplayScore ?? 50) >= 75).length;
        const midHits = midPicks.filter(p => (p.ldiResult?.pickDisplayScore ?? 50) >= 75).length;
        const lateHits = latePicks.filter(p => (p.ldiResult?.pickDisplayScore ?? 50) >= 75).length;

        const earlyHitRate = earlyPicks.length > 0 ? Math.round((earlyHits / earlyPicks.length) * 100) : 0;
        const midHitRate = midPicks.length > 0 ? Math.round((midHits / midPicks.length) * 100) : 0;
        const lateHitRate = latePicks.length > 0 ? Math.round((lateHits / latePicks.length) * 100) : 0;

        // Top 5 Best Picks
        const bestPicks = [...targetPicks]
            .filter(p => p.playerName && !p.playerName.startsWith('Player #-1'))
            .sort((a, b) => (b.ldiResult?.LDI_pick ?? 0) - (a.ldiResult?.LDI_pick ?? 0))
            .slice(0, 5);

        // Top 5 Worst Picks
        const worstPicks = [...targetPicks]
            .filter(p => p.playerName && !p.playerName.startsWith('Player #-1'))
            .sort((a, b) => (a.ldiResult?.LDI_pick ?? 0) - (b.ldiResult?.LDI_pick ?? 0))
            .slice(0, 5);

        const bestPicksRowsHTML = bestPicks.map((p, i) => `
            <tr>
                <td class="col-rank">#${i + 1}</td>
                <td><strong>${p.playerName}</strong> <small class="text-muted">(${p.seasonYear})</small></td>
                <td><span class="pick-pos-pill pos-${(p.position || '').toLowerCase()}">${p.position}</span></td>
                <td>Rd ${p.round} (#${p.overallPick})</td>
                <td>${p.draftedPosRank} &rarr; ${p.finishPosRank}</td>
                <td style="font-weight: 800; color: #10b981;">${p.ldiResult?.pickDisplayScore ?? 99} <small style="font-size:0.75em;">(${formatLdiVal(p.ldiResult?.LDI_pick ?? 0, true)})</small></td>
            </tr>
        `).join('');

        const worstPicksRowsHTML = worstPicks.map((p, i) => `
            <tr>
                <td class="col-rank">#${i + 1}</td>
                <td><strong>${p.playerName}</strong> <small class="text-muted">(${p.seasonYear})</small></td>
                <td><span class="pick-pos-pill pos-${(p.position || '').toLowerCase()}">${p.position}</span></td>
                <td>Rd ${p.round} (#${p.overallPick})</td>
                <td>${p.draftedPosRank} &rarr; ${p.finishPosRank}</td>
                <td style="font-weight: 800; color: #ef4444;">${p.ldiResult?.pickDisplayScore ?? 1} <small style="font-size:0.75em;">(${formatLdiVal(p.ldiResult?.LDI_pick ?? 0, false)})</small></td>
            </tr>
        `).join('');

        // Season History Cards
        const seasonCardsHTML = sortedAllSeasons.map(s => {
            const sGrade = s.gradeInfo || { grade: 'B', color: '#10b981' };
            const isMatch = this.filterSeasonByRule(s.seasonYear, this.soloYearFilter, this.soloCustomStart, this.soloCustomEnd);
            const isCardSelected = isSingleYear ? String(this.soloYearFilter) === String(s.seasonYear) : isMatch;
            return `
                <div class="solo-season-card ${isCardSelected ? 'card-selected-highlight' : ''}" style="${!isMatch ? 'opacity: 0.45;' : ''}">
                    <div class="solo-season-header">
                        <div>
                            <span class="solo-season-year">${s.seasonYear} Draft</span>
                            <span class="solo-season-team">${s.teamName}</span>
                        </div>
                        <div class="solo-season-grade" style="color: ${sGrade.color};">
                            ${s.draftIndex} / 100 <small>(${sGrade.grade})</small>
                        </div>
                    </div>
                    <div class="solo-season-stats">
                        <div class="solo-stat-item">
                            <span class="stat-lbl">Mean LDI</span>
                            <span class="stat-val">${formatLdiVal(s.LDI_manager_season ?? s.meanLdi ?? 0, true)}</span>
                        </div>
                        <div class="solo-stat-item">
                            <span class="stat-lbl">Hits / Busts</span>
                            <span class="stat-val">${s.hits} / ${s.busts}</span>
                        </div>
                        <div class="solo-stat-item">
                            <span class="stat-lbl">Picks Scored</span>
                            <span class="stat-val">${s.scoredPicksCount}</span>
                        </div>
                    </div>
                    <div class="solo-season-actions">
                        <button class="btn-jump-year" data-year="${s.seasonYear}">View ${s.seasonYear} Board &rarr;</button>
                    </div>
                </div>
            `;
        }).join('');

        // Generate SVG History Graph
        const chartSVG = this.generateManagerLdiTrendSVG(sortedAllSeasons, allTime);

        container.innerHTML = `
            <div class="draft-view-wrapper">
                <!-- Sub-navigation Bar -->
                ${this.renderSubNavHTML()}

                <!-- Solo Profile Hero Header -->
                <div class="draft-hero-banner">
                    <div class="draft-hero-title-group">
                        <span class="draft-hero-subtitle">${heroSubtitle} ${isRetired ? '<span class="retired-pill-badge">Retired Manager</span>' : ''}</span>
                        <h1>${heroTitle}</h1>
                        <p class="draft-hero-desc">
                            ${heroDesc}
                        </p>
                    </div>

                    <!-- Filter Controls Bar -->
                    <div class="draft-toolbar-row">
                        <div class="draft-filters-bar" style="display: flex; flex-wrap: wrap; gap: 12px; align-items: center;">
                            <div class="draft-filter-item">
                                <span class="draft-filter-label">Manager:</span>
                                <select id="solo-mgr-select" class="draft-filter-select">
                                    <optgroup label="Active Managers">
                                        ${activeOptions}
                                    </optgroup>
                                    ${this.soloIncludeRetired && retiredMgrs.length > 0 ? `
                                        <optgroup label="Retired Managers">
                                            ${retiredOptions}
                                        </optgroup>
                                    ` : ''}
                                </select>
                            </div>

                            <div class="draft-filter-item" style="display: flex; gap: 6px; align-items: center;">
                                <span class="draft-filter-label">Draft Classes:</span>
                                <div class="records-year-group">
                                    <button class="records-year-btn ${this.soloYearFilter === 'all' ? 'active' : ''}" data-section="solo" data-year="all">All Years</button>
                                    <button class="records-year-btn ${this.soloYearFilter === '2020-present' ? 'active' : ''}" data-section="solo" data-year="2020-present">2020–Present</button>
                                    <button class="records-year-btn ${this.soloYearFilter === 'custom' ? 'active' : ''}" data-section="solo" data-year="custom">Custom Span</button>
                                </div>
                            </div>

                            <div class="records-custom-span-wrap" id="solo-custom-span-wrap" style="${this.soloYearFilter === 'custom' ? 'display:flex; gap:6px; align-items:center;' : 'display:none;'}">
                                <select id="solo-custom-start" class="records-custom-span-select">
                                    ${soloYearOptionsStartHTML}
                                </select>
                                <span style="color:var(--text-muted); font-size:0.8rem;">to</span>
                                <select id="solo-custom-end" class="records-custom-span-select">
                                    ${soloYearOptionsEndHTML}
                                </select>
                            </div>

                            <div class="draft-filter-item">
                                <span class="draft-filter-label">Single Class:</span>
                                <select id="solo-filter-year-select" class="draft-filter-select">
                                    <option value="all" ${['all', '2020-present', 'custom'].includes(this.soloYearFilter) ? 'selected' : ''}>-- Single Class --</option>
                                    ${sortedAllSeasons.map(s => `
                                        <option value="${s.seasonYear}" ${String(this.soloYearFilter) === String(s.seasonYear) ? 'selected' : ''}>${s.seasonYear} Class (${s.draftIndex}/100)</option>
                                    `).join('')}
                                </select>
                            </div>

                            <div class="draft-filter-item">
                                <label class="draft-toggle-label" title="Toggle retired managers in manager list">
                                    <input type="checkbox" id="solo-toggle-retired" class="draft-toggle-checkbox" ${this.soloIncludeRetired ? 'checked' : ''}>
                                    <span>Show Retired Managers</span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Quick Click Manager Pills -->
                    <div class="draft-toolbar-row" style="margin-top: 4px;">
                        <div class="draft-seasons-scroll">
                            ${mgrSelectorButtonsHTML}
                        </div>
                    </div>
                </div>

                <!-- Career / Single-Season Scorecard Grid -->
                <div class="solo-scorecard-grid">
                    <div class="solo-score-card main-grade">
                        <div class="solo-score-tag">${cardMainTag}</div>
                        <div class="solo-score-val" style="color: ${gradeInfo.color};">
                            ${displayScore} <small>(${gradeInfo.grade})</small>
                        </div>
                        <div class="solo-score-sub">
                            ${isSingleYear ? 'Season' : 'Career'} Mean LDI: <strong>${formatLdiVal(displayMeanLdi, true)}</strong>
                        </div>
                    </div>

                    <div class="solo-score-card">
                        <div class="solo-score-tag">${isSingleYear ? 'Class Size' : 'Draft Experience'}</div>
                        <div class="solo-score-val">${seasonsCount} <small style="font-size:0.9rem; color:var(--text-muted);">${seasonsCount === 1 ? 'Season' : 'Seasons'}</small></div>
                        <div class="solo-score-sub">Total Skill Picks: <strong>${totalPicksCount}</strong></div>
                    </div>

                    <div class="solo-score-card">
                        <div class="solo-score-tag">Hit vs Bust Rate</div>
                        <div class="solo-score-val" style="color: #10b981;">
                            ${hitRate}% <small style="color: #ef4444; font-size: 0.9rem; margin-left: 4px;">/ ${bustRate}%</small>
                        </div>
                        <div class="solo-score-sub">${hitCount} Hits · ${bustCount} Busts</div>
                    </div>

                    <div class="solo-score-card">
                        <div class="solo-score-tag">${peakTitle}</div>
                        <div class="solo-score-val">${peakVal}</div>
                        <div class="solo-score-sub">${peakSub}</div>
                    </div>
                </div>

                <!-- Interactive Multi-Year LDI Trend Graph Section -->
                <div class="draft-chart-section">
                    <div class="chart-header-row">
                        <div>
                            <h2>Landon Draft Index History</h2>
                            <p class="text-muted">Season-by-season draft efficiency progression (${sortedAllSeasons.length} Draft Classes)${isSingleYear ? ` · Highlighting ${this.soloYearFilter} Season` : ''}</p>
                        </div>
                        <div class="chart-controls">
                            <button id="btn-toggle-league-avg" class="chart-toggle-btn ${this.showLeagueAvg ? 'active' : ''}">
                                <span class="toggle-indicator ${this.showLeagueAvg ? 'on' : 'off'}"></span>
                                Compare with League Benchmark
                            </button>
                        </div>
                    </div>

                    <div class="chart-canvas-card">
                        ${chartSVG}
                    </div>
                </div>

                <!-- Round Efficiency Breakdown -->
                <div class="draft-round-efficiency-grid">
                    <div class="efficiency-card">
                        <div class="efficiency-header">
                            <span class="efficiency-title">Early Rounds (1–4)</span>
                            <span class="efficiency-count">${earlyPicks.length} Picks</span>
                        </div>
                        <div class="efficiency-rate-bar">
                            <div class="rate-fill green" style="width: ${earlyHitRate}%;"></div>
                        </div>
                        <div class="efficiency-footer">
                            <span>Hit Rate: <strong>${earlyHitRate}%</strong></span>
                            <span>${earlyHits} Elite Hits</span>
                        </div>
                    </div>

                    <div class="efficiency-card">
                        <div class="efficiency-header">
                            <span class="efficiency-title">Middle Rounds (5–8)</span>
                            <span class="efficiency-count">${midPicks.length} Picks</span>
                        </div>
                        <div class="efficiency-rate-bar">
                            <div class="rate-fill blue" style="width: ${midHitRate}%;"></div>
                        </div>
                        <div class="efficiency-footer">
                            <span>Hit Rate: <strong>${midHitRate}%</strong></span>
                            <span>${midHits} Hits</span>
                        </div>
                    </div>

                    <div class="efficiency-card">
                        <div class="efficiency-header">
                            <span class="efficiency-title">Late Rounds (9+)</span>
                            <span class="efficiency-count">${latePicks.length} Picks</span>
                        </div>
                        <div class="efficiency-rate-bar">
                            <div class="rate-fill purple" style="width: ${lateHitRate}%;"></div>
                        </div>
                        <div class="efficiency-footer">
                            <span>Hit Rate: <strong>${lateHitRate}%</strong></span>
                            <span>${lateHits} Late Steals</span>
                        </div>
                    </div>
                </div>

                <!-- Best & Worst Career / Season Picks Tables Grid -->
                <div class="solo-picks-grid">
                    <div class="solo-table-card">
                        <div class="solo-table-header">
                            <h3 style="color: #10b981;">${isSingleYear ? `Top ${this.soloYearFilter} Picks` : 'Top 5 Greatest Career Picks'}</h3>
                            <span class="text-muted">Highest LDI value generated</span>
                        </div>
                        <table class="data-table solo-table">
                            <thead>
                                <tr>
                                    <th class="col-rank">#</th>
                                    <th>Player</th>
                                    <th>Pos</th>
                                    <th>Pick</th>
                                    <th>Movement</th>
                                    <th>LDI</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${bestPicksRowsHTML || '<tr><td colspan="6" class="text-muted" style="text-align:center;">No picks found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>

                    <div class="solo-table-card">
                        <div class="solo-table-header">
                            <h3 style="color: #ef4444;">${isSingleYear ? `Worst ${this.soloYearFilter} Busts` : 'Top 5 Worst Career Busts'}</h3>
                            <span class="text-muted">Lowest LDI relative to draft slot</span>
                        </div>
                        <table class="data-table solo-table">
                            <thead>
                                <tr>
                                    <th class="col-rank">#</th>
                                    <th>Player</th>
                                    <th>Pos</th>
                                    <th>Pick</th>
                                    <th>Movement</th>
                                    <th>LDI</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${worstPicksRowsHTML || '<tr><td colspan="6" class="text-muted" style="text-align:center;">No picks found.</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Complete Draft Class Log Archive -->
                <div class="draft-overall-section">
                    <div class="section-header-row">
                        <h2>Chronological Draft Class History</h2>
                        <span class="section-tag-badge">Every Draft Board</span>
                    </div>

                    <div class="solo-seasons-grid">
                        ${seasonCardsHTML}
                    </div>
                </div>
            </div>
        `;

        this.attachCommonListeners(container);
    }

    /**
     * Generate Pure Vector SVG History Line Chart with Benchmark Toggle and Year Highlighting
     */
    generateManagerLdiTrendSVG(sortedSeasons, allTime) {
        if (!sortedSeasons || sortedSeasons.length === 0) {
            return `<div class="chart-empty-state">No historical draft data to chart.</div>`;
        }

        // Chronological order for x-axis (left to right)
        const chronSeasons = [...sortedSeasons].sort((a, b) => a.seasonYear - b.seasonYear);

        // Calculate League Average Draft Index per year
        const leagueAvgMap = {};
        allTime.seasonAnalyticsMap && Object.entries(allTime.seasonAnalyticsMap).forEach(([yr, a]) => {
            if (!a.isUnplayedSeason && a.managerLeaderboard && a.managerLeaderboard.length > 0) {
                const validMgrs = a.managerLeaderboard.filter(m => m.draftIndex !== null && !m.isPending);
                if (validMgrs.length > 0) {
                    const avg = validMgrs.reduce((sum, m) => sum + m.draftIndex, 0) / validMgrs.length;
                    leagueAvgMap[yr] = Math.round(avg);
                }
            }
        });

        // Dimensions
        const width = 860;
        const height = 320;
        const padLeft = 50;
        const padRight = 30;
        const padTop = 30;
        const padBottom = 40;

        const chartW = width - padLeft - padRight;
        const chartH = height - padTop - padBottom;

        const minScore = 0;
        const maxScore = 100;

        const getX = (idx) => {
            if (chronSeasons.length === 1) return padLeft + chartW / 2;
            return padLeft + (idx / (chronSeasons.length - 1)) * chartW;
        };

        const getY = (val) => {
            const clamped = Math.max(minScore, Math.min(maxScore, val));
            return padTop + chartH - ((clamped - minScore) / (maxScore - minScore)) * chartH;
        };

        // Grid lines (y = 25, 50, 75, 100)
        const gridYValues = [25, 50, 75, 100];
        const gridLinesSVG = gridYValues.map(v => {
            const y = getY(v);
            return `
                <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--border-color, rgba(255,255,255,0.08))" stroke-dasharray="3,3" stroke-width="1"/>
                <text x="${padLeft - 10}" y="${y + 4}" font-size="11" fill="var(--text-muted, #94a3b8)" text-anchor="end" font-weight="600">${v}</text>
            `;
        }).join('');

        // Manager points and path
        const managerPoints = chronSeasons.map((s, idx) => ({
            x: getX(idx),
            y: getY(s.draftIndex),
            year: s.seasonYear,
            score: s.draftIndex,
            grade: s.gradeInfo?.grade || 'B',
            color: s.gradeInfo?.color || '#10b981',
            meanLdi: s.LDI_manager_season ?? s.meanLdi ?? 0,
            isSelected: String(this.soloYearFilter) === String(s.seasonYear)
        }));

        let managerPathD = '';
        if (managerPoints.length > 0) {
            managerPathD = `M ${managerPoints[0].x} ${managerPoints[0].y} ` + managerPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
        }

        // Area path under manager line
        let areaPathD = '';
        if (managerPoints.length > 1) {
            areaPathD = `M ${managerPoints[0].x} ${padTop + chartH} L ${managerPoints[0].x} ${managerPoints[0].y} ` +
                        managerPoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') +
                        ` L ${managerPoints[managerPoints.length - 1].x} ${padTop + chartH} Z`;
        }

        // League average points and path
        const leaguePoints = chronSeasons.map((s, idx) => {
            const avg = leagueAvgMap[s.seasonYear] || 50;
            return {
                x: getX(idx),
                y: getY(avg),
                year: s.seasonYear,
                score: avg
            };
        });

        let leaguePathD = '';
        if (leaguePoints.length > 0) {
            leaguePathD = `M ${leaguePoints[0].x} ${leaguePoints[0].y} ` + leaguePoints.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
        }

        // X-axis season labels
        const xLabelsSVG = managerPoints.map(p => `
            <text x="${p.x}" y="${height - 12}" font-size="12" fill="${p.isSelected ? '#f59e0b' : 'var(--text-secondary, #cbd5e1)'}" text-anchor="middle" font-weight="${p.isSelected ? '900' : '700'}">${p.year}</text>
        `).join('');

        // Render SVG
        return `
            <svg viewBox="0 0 ${width} ${height}" class="draft-trend-svg" style="width:100%; height:auto; display:block;">
                <defs>
                    <linearGradient id="managerGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/>
                        <stop offset="100%" stop-color="#10b981" stop-opacity="0.0"/>
                    </linearGradient>
                </defs>

                <!-- Grid Lines & Labels -->
                ${gridLinesSVG}
                ${xLabelsSVG}

                <!-- Area Fill -->
                ${areaPathD ? `<path d="${areaPathD}" fill="url(#managerGrad)"/>` : ''}

                <!-- League Benchmark Line (Toggleable) -->
                ${this.showLeagueAvg && leaguePathD ? `
                    <path d="${leaguePathD}" fill="none" stroke="#94a3b8" stroke-width="2" stroke-dasharray="6,4" opacity="0.8"/>
                    ${leaguePoints.map(p => `
                        <circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#94a3b8" stroke="var(--bg-card, #1e293b)" stroke-width="1.5"/>
                    `).join('')}
                ` : ''}

                <!-- Manager Main Line -->
                ${managerPathD ? `<path d="${managerPathD}" fill="none" stroke="#10b981" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` : ''}

                <!-- Manager Data Points -->
                ${managerPoints.map(p => `
                    <g class="chart-point-group" tabindex="0" data-chart-year="${p.year}" style="cursor: pointer;">
                        ${p.isSelected ? `
                            <circle cx="${p.x}" cy="${p.y}" r="12" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-dasharray="2,2"/>
                        ` : ''}
                        <circle cx="${p.x}" cy="${p.y}" r="${p.isSelected ? '7.5' : '6.5'}" fill="${p.color}" stroke="${p.isSelected ? '#f59e0b' : 'var(--bg-surface, #0f172a)'}" stroke-width="2.5" style="transition: transform 0.2s;"/>
                        <circle cx="${p.x}" cy="${p.y}" r="14" fill="transparent"/>
                        <title>${p.year} Draft Grade: ${p.score} / 100 (${p.grade}) · Mean LDI: ${p.meanLdi >= 0 ? '+' : ''}${p.meanLdi.toFixed(2)}${this.showLeagueAvg ? ` · League Avg: ${leagueAvgMap[p.year] || 50}` : ''}</title>
                    </g>
                `).join('')}
            </svg>

            <!-- Chart Legend -->
            <div class="chart-legend-row">
                <div class="legend-item">
                    <span class="legend-dot" style="background:#10b981;"></span>
                    <span>Manager Draft Grade</span>
                </div>
                ${this.showLeagueAvg ? `
                    <div class="legend-item">
                        <span class="legend-line-dashed" style="background:#94a3b8;"></span>
                        <span>League Benchmark / Average</span>
                    </div>
                ` : ''}
                ${this.soloYearFilter !== 'all' ? `
                    <div class="legend-item">
                        <span class="legend-dot" style="background:#f59e0b; border: 1px dashed #fff;"></span>
                        <span>Filtered Draft Class (${this.soloYearFilter})</span>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Attach Event Listeners (Year selection, Tabs, Info modal, Managers, Trades, Filters)
     */
    attachCommonListeners(container, analytics = null) {
        // Sub-Navigation Tabs
        container.querySelector('#btn-subnav-yearly')?.addEventListener('click', () => this.setSubTab('yearly'));
        container.querySelector('#btn-subnav-overall')?.addEventListener('click', () => this.setSubTab('overall'));
        container.querySelector('#btn-subnav-team')?.addEventListener('click', () => this.setSubTab('team'));

        // Info Blurb Modal Trigger
        container.querySelector('#btn-open-ldi-info')?.addEventListener('click', () => this.openLdiInfoModal());

        // Year Selector Pills in Yearly View
        container.querySelectorAll('.season-pill-btn[data-year]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const yr = Number(e.currentTarget.getAttribute('data-year'));
                this.setYear(yr);
            });
        });

        // Manager Selector Pills in Solo Profile
        container.querySelectorAll('.season-pill-btn[data-mgr-select]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mId = e.currentTarget.getAttribute('data-mgr-select');
                this.setSelectedManager(mId);
            });
        });

        // Overall View Filters: Year button group
        container.querySelectorAll('.records-year-btn[data-section="overall"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.currentTarget.getAttribute('data-year');
                this.overallYearFilter = val;
                this.render();
            });
        });

        // Overall Custom Span Selects
        const overallStart = container.querySelector('#overall-custom-start');
        const overallEnd = container.querySelector('#overall-custom-end');
        if (overallStart && overallEnd) {
            overallStart.addEventListener('change', () => {
                this.overallCustomStart = Number(overallStart.value);
                this.overallYearFilter = 'custom';
                this.render();
            });
            overallEnd.addEventListener('change', () => {
                this.overallCustomEnd = Number(overallEnd.value);
                this.overallYearFilter = 'custom';
                this.render();
            });
        }

        // Overall Single Year Select
        const overallYearSelect = container.querySelector('#overall-filter-year-select');
        if (overallYearSelect) {
            overallYearSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.overallYearFilter = e.target.value;
                    this.render();
                }
            });
        }

        const overallRetiredToggle = container.querySelector('#overall-toggle-retired');
        if (overallRetiredToggle) {
            overallRetiredToggle.addEventListener('change', (e) => {
                this.overallIncludeRetired = e.target.checked;
                this.render();
            });
        }

        // Solo Profile Filters: Manager select
        const soloMgrSelect = container.querySelector('#solo-mgr-select');
        if (soloMgrSelect) {
            soloMgrSelect.addEventListener('change', (e) => {
                this.setSelectedManager(e.target.value);
            });
        }

        // Solo Profile Filters: Year button group
        container.querySelectorAll('.records-year-btn[data-section="solo"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.currentTarget.getAttribute('data-year');
                this.soloYearFilter = val;
                this.render();
            });
        });

        // Solo Custom Span Selects
        const soloStart = container.querySelector('#solo-custom-start');
        const soloEnd = container.querySelector('#solo-custom-end');
        if (soloStart && soloEnd) {
            soloStart.addEventListener('change', () => {
                this.soloCustomStart = Number(soloStart.value);
                this.soloYearFilter = 'custom';
                this.render();
            });
            soloEnd.addEventListener('change', () => {
                this.soloCustomEnd = Number(soloEnd.value);
                this.soloYearFilter = 'custom';
                this.render();
            });
        }

        // Solo Single Class Select
        const soloYearSelect = container.querySelector('#solo-filter-year-select');
        if (soloYearSelect) {
            soloYearSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.soloYearFilter = e.target.value;
                    this.render();
                }
            });
        }

        const soloRetiredToggle = container.querySelector('#solo-toggle-retired');
        if (soloRetiredToggle) {
            soloRetiredToggle.addEventListener('change', (e) => {
                this.soloIncludeRetired = e.target.checked;
                this.render();
            });
        }

        // Clickable points on SVG Chart to select year
        container.querySelectorAll('.chart-point-group[data-chart-year]').forEach(g => {
            g.addEventListener('click', (e) => {
                const yr = e.currentTarget.getAttribute('data-chart-year');
                if (yr) {
                    this.soloYearFilter = this.soloYearFilter === yr ? 'all' : yr;
                    this.render();
                }
            });
        });

        // Grouping View Toggle Listeners
        const btnGroupRound = container.querySelector('#btn-group-round');
        const btnGroupManager = container.querySelector('#btn-group-manager');
        btnGroupRound?.addEventListener('click', () => this.setDisplayGrouping('round'));
        btnGroupManager?.addEventListener('click', () => this.setDisplayGrouping('manager'));

        // Name Mode Toggle Listeners
        const btnMgr = container.querySelector('#btn-toggle-mgr');
        const btnTeam = container.querySelector('#btn-toggle-team');
        btnMgr?.addEventListener('click', () => this.setNameMode('manager'));
        btnTeam?.addEventListener('click', () => this.setNameMode('team'));

        // League Benchmark Toggle in Solo Profile
        container.querySelector('#btn-toggle-league-avg')?.addEventListener('click', () => this.toggleLeagueAvgComparison());

        // Jump to Year from Solo Profile Cards
        container.querySelectorAll('.btn-jump-year').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const yr = Number(e.currentTarget.getAttribute('data-year'));
                this.selectedYear = yr;
                this.setSubTab('yearly');
            });
        });

        // Clickable Manager links across all cards & tables
        container.querySelectorAll('.clickable-mgr').forEach(el => {
            el.addEventListener('click', (e) => {
                const mId = e.currentTarget.getAttribute('data-mgr-id');
                if (mId) {
                    this.setSubTab('team', mId);
                }
            });
        });

        // Global Clickable Traded & Dropped Picks via Event Delegation
        container.addEventListener('click', (e) => {
            const dropBtn = e.target.closest('.pick-sub-tag.dropped');
            if (dropBtn) {
                e.preventDefault();
                e.stopPropagation();
                const pickOverall = Number(dropBtn.getAttribute('data-pick-overall'));
                const pickYear = Number(dropBtn.getAttribute('data-year')) || Number(this.selectedYear);
                const yearAnalytics = this.computeSeasonAnalytics(pickYear);
                const pick = yearAnalytics?.picks?.find(p => p.overallPick === pickOverall);
                if (pick) {
                    this.openDropModal(pick);
                }
                return;
            }

            const tradeBtn = e.target.closest('.pick-sub-tag.traded');
            if (tradeBtn) {
                e.preventDefault();
                e.stopPropagation();
                const pickOverall = Number(tradeBtn.getAttribute('data-pick-overall'));
                const pickYear = Number(tradeBtn.getAttribute('data-year')) || Number(this.selectedYear);
                const yearAnalytics = this.computeSeasonAnalytics(pickYear);
                const pick = yearAnalytics?.picks?.find(p => p.overallPick === pickOverall);
                if (pick) {
                    this.openTradeModal(pick);
                }
                return;
            }
        });
    }

    /**
     * Open LDI Explanatory Info Modal
     */
    openLdiInfoModal() {
        let modal = document.getElementById('ldi-info-modal');
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = 'ldi-info-modal';
            modal.className = 'modal ldi-info-dialog';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="ldi-info-modal-inner">
                <div class="ldi-info-modal-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="ldi-info-badge">Framework Guide</span>
                        <h2 style="font-family: 'Newsreader', Georgia, serif; font-size: 1.45rem; font-weight: 700; margin: 0; color: var(--text-primary);">The Landon Draft Index (LDI)</h2>
                    </div>
                    <button class="modal-close-btn" id="close-ldi-modal-btn" style="background: none; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 4px 8px;">✕</button>
                </div>

                <div class="ldi-info-modal-body">
                    <!-- Note from the Founder, Landon -->
                    <div style="background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; padding: 1rem 1.25rem; border-radius: 6px; margin-bottom: 1.25rem;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.35rem;">A Note from the Founder, Landon</div>
                        <p style="font-size: 0.9rem; color: #78350f; line-height: 1.55; margin: 0;">
                            I developed the Landon Draft Index (LDI) as an advanced, rate-based fantasy football draft evaluation framework which looks at the true value generated by every draft selection relative to its draft capital and historical positional expectations. You'll see below an explanation that is a bit more in detail and describes the nuances of LDI. Enjoy!
                        </p>
                    </div>

                    <div class="ldi-info-callout" style="margin-top: 0;">
                        <div class="ldi-callout-title">Why LDI is Different:</div>
                        <p>
                            Traditional draft evaluators rely on end-of-season total points, which unfairly penalize players who miss games due to injury and overlook the massive scarcity differences between positions. LDI evaluates performance on a per-game rate against Generalized Additive Model (GAM) curves, recognizing that finding an elite difference-maker at quarterback or tight end is much harder than at replaceable depth positions, so the magnitude of the score shift is greater. The index incorporates an 85% positional baseline blended with a 15% Value Over Replacement Player (VORP) capital weight, provides intelligent concessions for injuries via games-missed proration, and uses a two-stage consistency filter to separate reliable weekly starters with explosive ceilings from erratic boom-or-bust producers.
                        </p>
                    </div>
                </div>

                <div class="ldi-info-modal-footer">
                    <button id="btn-close-ldi-dialog" class="btn-primary" style="padding: 8px 20px; font-weight: 700; border-radius: 4px; cursor: pointer;">Got It</button>
                </div>
            </div>
        `;

        if (typeof modal.showModal === 'function' && !modal.open) {
            modal.showModal();
        }

        const closeBtn = modal.querySelector('#close-ldi-modal-btn');
        const actionCloseBtn = modal.querySelector('#btn-close-ldi-dialog');
        const closeModal = () => modal.close();
        
        closeBtn?.addEventListener('click', closeModal);
        actionCloseBtn?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.close();
        });
    }

    openTradeModal(pickData) {
        if (!pickData) return;
        let modal = document.getElementById('trade-details-modal');
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = 'trade-details-modal';
            modal.className = 'modal trade-details-dialog';
            document.body.appendChild(modal);
        }

        const year = Number(this.selectedYear);
        const tInfo = pickData.tradeInfo;
        const targetWeek = tInfo?.week || 1;
        const targetPlayer = (pickData.playerName || '').toLowerCase();

        const yearTx = (this.transactions || []).filter(t => Number(t.year || t.season) === year);
        const matchingTrades = yearTx.filter(t => {
            const isTrade = (t.action_type === 'TRADE' || t.type === 'trade');
            if (!isTrade) return false;
            const detailsStr = (t.details || JSON.stringify(t)).toLowerCase();
            const hasPlayer = detailsStr.includes(targetPlayer) || 
                              (t.traded_players && t.traded_players.some(p => String(p).toLowerCase().includes(targetPlayer))) ||
                              (t.items && t.items.some(i => (i.player_name && i.player_name.toLowerCase().includes(targetPlayer)) || i.player_id === pickData.playerId));
            return hasPlayer;
        });

        const tradeTx = matchingTrades[0] || null;
        const fromName = tInfo?.fromManagerName || pickData.managerName;
        const toName = tInfo?.toManagerName || 'Trade Partner';
        const dateStr = tradeTx?.date || tradeTx?.timestamp || `${year} Season · Week ${targetWeek}`;

        let assetsHTML = '';
        if (tInfo && (tInfo.sideASent?.length > 0 || tInfo.sideBSent?.length > 0)) {
            assetsHTML = `
                <div class="trade-assets-grid">
                    <div class="trade-side-card">
                        <div class="trade-side-header">${fromName} Receives:</div>
                        <ul class="trade-assets-list">
                            ${tInfo.sideBSent.length > 0 
                                ? tInfo.sideBSent.map(p => `<li><strong>${p.name || p}</strong> ${p.pos ? `<span class="trade-asset-pos">${p.pos}</span>` : ''}</li>`).join('') 
                                : '<li style="color: var(--text-muted); font-style: italic;">Draft picks / Considerations</li>'}
                        </ul>
                    </div>
                    <div class="trade-side-card">
                        <div class="trade-side-header">${toName} Receives:</div>
                        <ul class="trade-assets-list">
                            ${tInfo.sideASent.length > 0 
                                ? tInfo.sideASent.map(p => `<li><strong>${p.name || p}</strong> ${p.pos ? `<span class="trade-asset-pos">${p.pos}</span>` : ''}</li>`).join('') 
                                : '<li style="color: var(--text-muted); font-style: italic;">Draft picks / Considerations</li>'}
                        </ul>
                    </div>
                </div>
            `;
        } else if (tradeTx && tradeTx.items && tradeTx.items.length > 0) {
            const sideA = tradeTx.items.filter(i => String(i.from_team) === String(tradeTx.items[0]?.from_team));
            const sideB = tradeTx.items.filter(i => String(i.from_team) !== String(tradeTx.items[0]?.from_team));
            
            assetsHTML = `
                <div class="trade-assets-grid">
                    <div class="trade-side-card">
                        <div class="trade-side-header">${fromName} Receives:</div>
                        <ul class="trade-assets-list">
                            ${(sideB.length > 0 ? sideB : sideA).map(i => `<li><strong>${i.player_name}</strong></li>`).join('')}
                        </ul>
                    </div>
                    <div class="trade-side-card">
                        <div class="trade-side-header">${toName} Receives:</div>
                        <ul class="trade-assets-list">
                            ${(sideB.length > 0 ? sideA : sideB).map(i => `<li><strong>${i.player_name}</strong></li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        } else if (tradeTx && tradeTx.details && tradeTx.details !== 'Traded to') {
            assetsHTML = `
                <div class="trade-raw-details">
                    <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 6px;">Transaction Log:</div>
                    <p style="margin: 0; font-size: 0.9rem; color: var(--text-primary); line-height: 1.5; background: var(--bg-surface); padding: 10px 14px; border-radius: 6px; border: 1px solid var(--border-color);">${tradeTx.details}</p>
                </div>
            `;
        } else {
            assetsHTML = `
                <div class="trade-assets-grid">
                    <div class="trade-side-card">
                        <div class="trade-side-header">Sent By:</div>
                        <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary); margin-bottom: 4px;">${fromName}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Traded to ${toName} in Week ${targetWeek}</div>
                    </div>
                    <div class="trade-side-card">
                        <div class="trade-side-header">Acquired Asset:</div>
                        <div style="font-weight: 700; font-size: 1rem; color: var(--accent-gold); margin-bottom: 4px;">${pickData.playerName}</div>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">${pickData.position}${pickData.nflTeam ? ' · ' + pickData.nflTeam : ''} (Drafted Rd ${pickData.round}, Pick #${pickData.overallPick})</div>
                    </div>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="trade-modal-inner" style="padding: 24px; max-width: 540px; margin: 0 auto;">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
                    <div>
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-blue, #1d4ed8); text-transform: uppercase; letter-spacing: 0.5px;">Trade Transaction Details</span>
                        <h2 style="font-family: 'Newsreader', Georgia, serif; font-size: 1.4rem; font-weight: 700; margin: 4px 0 2px; color: var(--text-primary);">${pickData.playerName} Trade</h2>
                        <span style="font-size: 0.85rem; color: var(--text-muted);">${dateStr}</span>
                    </div>
                    <button class="modal-close-btn" id="close-trade-modal-btn" style="background: none; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 4px 8px;">✕</button>
                </div>

                ${assetsHTML}

                <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                    <button id="btn-close-trade-dialog" class="btn-primary" style="padding: 8px 18px; font-weight: 700; border-radius: 4px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;

        if (typeof modal.showModal === 'function' && !modal.open) {
            modal.showModal();
        }

        const closeBtn = modal.querySelector('#close-trade-modal-btn');
        const actionCloseBtn = modal.querySelector('#btn-close-trade-dialog');
        const closeModal = () => modal.close();
        
        closeBtn?.addEventListener('click', closeModal);
        actionCloseBtn?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.close();
        });
    }

    /**
     * Open Full Add/Drop & Waiver Log Modal for a Player
     */
    openDropModal(pickData) {
        if (!pickData) return;
        let modal = document.getElementById('drop-history-modal');
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = 'drop-history-modal';
            modal.className = 'modal drop-history-dialog';
            document.body.appendChild(modal);
        }

        const year = Number(this.selectedYear);
        const dInfo = pickData.dropInfo;
        const dropWeek = dInfo?.dropWeek || 1;
        const drafterName = dInfo?.drafterManagerName || pickData.managerName;
        const teamName = dInfo?.teamName || pickData.teamName || drafterName;
        const txList = dInfo?.transactions || [];

        let timelineHTML = '';
        if (txList.length > 0) {
            const npTarget = normPlayerName(pickData.playerName);
            timelineHTML = `
                <div class="drop-timeline">
                    ${txList.map(tx => {
                        const isDrop = (tx.dropped_players || []).some(p => {
                            const np1 = normPlayerName(p);
                            return np1.includes(npTarget) || npTarget.includes(np1);
                        }) || (Array.isArray(tx.items) && tx.items.some(i => i.type === 'DROP' && (normPlayerName(i.player_name || i.name).includes(npTarget) || npTarget.includes(normPlayerName(i.player_name || i.name)))));

                        const isAdd = (tx.added_players || []).some(p => {
                            const np1 = normPlayerName(p);
                            return np1.includes(npTarget) || npTarget.includes(np1);
                        }) || (Array.isArray(tx.items) && tx.items.some(i => i.type === 'ADD' && (normPlayerName(i.player_name || i.name).includes(npTarget) || npTarget.includes(normPlayerName(i.player_name || i.name)))));

                        const isTrade = (tx.action_type === 'TRADE' || tx.type === 'trade');

                        let badgeText = 'Transaction';
                        let badgeClass = 'drop-badge-general';
                        
                        if (isTrade) {
                            badgeText = 'Trade';
                            badgeClass = 'drop-badge-adddrop';
                        } else if (isDrop && isAdd) {
                            badgeText = 'Add / Drop';
                            badgeClass = 'drop-badge-adddrop';
                        } else if (isDrop) {
                            badgeText = (tx.type === 'free_agent' || tx.action_type === 'FREEAGENT') ? 'Dropped to FA' : 'Dropped to Waivers';
                            badgeClass = 'drop-badge-dropped';
                        } else if (isAdd) {
                            badgeText = (tx.type === 'waiver' || tx.action_type === 'WAIVER') ? 'Claimed off Waivers' : 'Free Agent Pickup';
                            badgeClass = 'drop-badge-added';
                        }

                        let mgrDisplay = tx.manager_name || tx.manager_id || '';
                        let teamDisplay = tx.team_name ? ` · ${tx.team_name}` : '';

                        if (!mgrDisplay && Array.isArray(tx.items)) {
                            const targetItem = tx.items.find(i => normPlayerName(i.player_name || i.name) === npTarget);
                            const relevantTeamId = isDrop ? targetItem?.from_team : targetItem?.to_team;
                            if (relevantTeamId !== undefined) {
                                const matchedMgr = this.managers.find(m => String(m.team_id) === String(relevantTeamId) || String(m.id) === String(relevantTeamId));
                                if (matchedMgr) {
                                    mgrDisplay = matchedMgr.name || matchedMgr.manager_name || `Team ${relevantTeamId}`;
                                } else {
                                    mgrDisplay = `Team ${relevantTeamId}`;
                                }
                            }
                        }
                        if (!mgrDisplay) mgrDisplay = 'League Transaction';

                        let dateDisplay = `${year} Season`;
                        const rawDate = tx.timestamp || tx.date;
                        if (rawDate) {
                            if (typeof rawDate === 'number' || (!isNaN(rawDate) && !isNaN(parseFloat(rawDate)) && String(rawDate).length >= 10)) {
                                const d = new Date(Number(rawDate));
                                if (!isNaN(d.getTime())) {
                                    dateDisplay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                                }
                            } else if (String(rawDate).includes('T')) {
                                const d = new Date(rawDate);
                                if (!isNaN(d.getTime())) {
                                    dateDisplay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                                }
                            } else {
                                dateDisplay = String(rawDate);
                            }
                        }

                        const bidVal = tx.faab_bid || tx.bid_amount || 0;
                        const faabDisplay = (bidVal && Number(bidVal) > 0) ? `<span class="drop-faab-tag">FAAB: $${bidVal}</span>` : '';

                        let detailsText = '';
                        if (tx.details && tx.details !== 'Traded to') {
                            detailsText = `<div class="drop-item-details">${tx.details}</div>`;
                        } else if (Array.isArray(tx.items) && tx.items.length > 0) {
                            const adds = tx.items.filter(i => i.type === 'ADD').map(i => i.player_name || i.name);
                            const drops = tx.items.filter(i => i.type === 'DROP').map(i => i.player_name || i.name);
                            const parts = [];
                            if (adds.length > 0) parts.push(`Added: ${adds.join(', ')}`);
                            if (drops.length > 0) parts.push(`Dropped: ${drops.join(', ')}`);
                            if (parts.length > 0) {
                                detailsText = `<div class="drop-item-details">${parts.join(' · ')}</div>`;
                            }
                        }

                        return `
                            <div class="drop-timeline-item">
                                <div class="drop-timeline-marker ${badgeClass}"></div>
                                <div class="drop-timeline-content">
                                    <div class="drop-item-top">
                                        <span class="drop-action-badge ${badgeClass}">${badgeText}</span>
                                        <span class="drop-item-date">${dateDisplay}</span>
                                    </div>
                                    <div class="drop-item-manager">
                                        <strong>${mgrDisplay}</strong>${teamDisplay}
                                        ${faabDisplay}
                                    </div>
                                    ${detailsText}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else {
            timelineHTML = `
                <div class="drop-empty-state" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 16px; text-align: center;">
                    <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
                        Drafted by <strong>${drafterName}</strong> in Round ${pickData.round} (Pick #${pickData.overallPick}) and released to waivers during the ${year} season (Week ${dropWeek}).
                    </p>
                </div>
            `;
        }

        modal.innerHTML = `
            <div class="drop-modal-inner" style="padding: 24px; max-width: 580px; margin: 0 auto;">
                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 18px; border-bottom: 1px solid var(--border-color); padding-bottom: 14px;">
                    <div>
                        <span style="font-size: 0.75rem; font-weight: 700; color: #dc2626; text-transform: uppercase; letter-spacing: 0.5px;">Waiver & Transaction Log</span>
                        <h2 style="font-family: 'Newsreader', Georgia, serif; font-size: 1.4rem; font-weight: 700; margin: 4px 0 2px; color: var(--text-primary);">${pickData.playerName}</h2>
                        <span style="font-size: 0.85rem; color: var(--text-muted);">Drafted Rd ${pickData.round}, Pick #${pickData.overallPick} by ${drafterName} (${teamName}) · ${year} Season</span>
                    </div>
                    <button class="modal-close-btn" id="close-drop-modal-btn" style="background: none; border: none; font-size: 1.25rem; color: var(--text-muted); cursor: pointer; padding: 4px 8px;">✕</button>
                </div>

                <div class="drop-summary-banner" style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Draft Status</span>
                        <div style="font-size: 0.95rem; font-weight: 700; color: #dc2626; margin-top: 2px;">Dropped to Waivers (Wk ${dropWeek})</div>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">Season Moves</span>
                        <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-top: 2px;">${txList.length} ${txList.length === 1 ? 'Action' : 'Actions'}</div>
                    </div>
                </div>

                ${timelineHTML}

                <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
                    <button id="btn-close-drop-dialog" class="btn-primary" style="padding: 8px 18px; font-weight: 700; border-radius: 4px; cursor: pointer;">Close</button>
                </div>
            </div>
        `;

        if (typeof modal.showModal === 'function' && !modal.open) {
            modal.showModal();
        }

        const closeBtn = modal.querySelector('#close-drop-modal-btn');
        const actionCloseBtn = modal.querySelector('#btn-close-drop-dialog');
        const closeModal = () => modal.close();

        closeBtn?.addEventListener('click', closeModal);
        actionCloseBtn?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.close();
        });
    }
}
