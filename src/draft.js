/**
 * VaultDraftEngine
 * Full implementation of the Landon Draft Index (LDI) framework
 * According to landon_draft_index_framework.md
 */

import { nflStats } from './nfl_stats.js';
import { ldiEngine, LDIEngine, normalizeName } from './ldi_engine.js';

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

export class VaultDraftEngine {
    constructor(options = {}) {
        this.containerId = options.containerId || 'view-draft';
        this.draftResults = options.draftResults || [];
        this.weeklyPlayerStats = options.weeklyPlayerStats || [];
        this.transactions = options.transactions || [];
        this.managers = options.managers || [];
        this.leagueSettings = options.leagueSettings || {};
        this.scoringSettings = options.scoringSettings || {};
        
        this.nameMode = 'manager'; // 'manager' | 'team'
        this.displayGrouping = 'round'; // 'round' | 'manager'
        this.selectedYear = null;
        this.seasons = [];
        this.playerTruePositions = {};
        this.showTuningPanel = false;
        
        // Listen to LDI tuning changes for live instant re-render
        this.unsubscribeLdi = ldiEngine.subscribe(() => {
            this.render();
        });

        this.init();
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
            this.selectedYear = this.seasons[0];
            const nflYear = this.getNflYear(this.selectedYear);
            nflStats.preloadSeason(nflYear).then(() => {
                if (typeof document !== 'undefined') {
                    const container = document.getElementById(this.containerId);
                    if (container) {
                        this.render();
                    }
                }
            });
        }

        this.buildTruePositionMap();
    }

    destroy() {
        if (this.unsubscribeLdi) {
            this.unsubscribeLdi();
        }
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
                      (typeof window !== 'undefined' && window.location.pathname.includes('dmsfantasy')) ||
                      Boolean(this.leagueSettings?.is_dms || this.leagueSettings?.year_offset === -1);
        return isDms ? (yr - 1) : yr;
    }

    async setYear(year) {
        this.selectedYear = Number(year);
        const nflYear = this.getNflYear(this.selectedYear);
        if (!nflStats.isSeasonLoaded(nflYear)) {
            await nflStats.preloadSeason(nflYear);
        }
        this.render();
    }

    setNameMode(mode) {
        this.nameMode = mode;
        this.render();
    }

    toggleTuningPanel() {
        this.showTuningPanel = !this.showTuningPanel;
        this.render();
    }

    getScoringFormat(year) {
        if (this.leagueSettings?.scoring_format) {
            return this.leagueSettings.scoring_format;
        }
        const leagueName = (this.leagueSettings?.name || '').toLowerCase();
        if (leagueName.includes('dumbarton') || leagueName.includes('dms') || (typeof window !== 'undefined' && window.location.pathname.includes('dmsfantasy'))) {
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
                      (typeof window !== 'undefined' && window.location.pathname.includes('dmsfantasy'));
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

        return {
            league_id: isDms ? 'dms' : 'gaywood',
            season_year: yr,
            num_teams: numTeams,
            starters_qb: startersQb,
            starters_rb: startersRb,
            starters_wr: startersWr,
            starters_te: startersTe,
            starters_flex: startersFlex,
            total_season_weeks: totalWeeks
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
        const maxRegularSeasonGames = leagueSeasonSettings.total_season_weeks;

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

        // 1. Process Draft Picks: compute Positional Ranks
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
            const mgrName = pick.manager_name || pick.managerName || (this.managers.find(m => m.id === mgrId)?.name || 'Manager');
            const teamName = pick.team_name || pick.teamName || mgrName;

            // Positional draft rank
            if (!draftedPosCounts[pos]) draftedPosCounts[pos] = 0;
            draftedPosCounts[pos]++;
            const draftedPosNum = draftedPosCounts[pos];
            const draftedPosRank = `${pos}${draftedPosNum}`;

            // Resolve finish rank for display
            const scoringFormat = this.getScoringFormat(year);
            const nflInfo = nflStats.getPlayerStats(pName, nflYear, pos, scoringFormat);
            const finalInfo = playerFinalRanks[String(pId)] || playerFinalRanks[pName.toLowerCase()] || null;

            let finishPosRank = 'Unranked';
            let finishPosNum = null;
            let totalPoints = 0;
            let gamesPlayed = 0;
            let gamesMissed = 0;

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
            }

            // Score pick using LDI Engine (Section 4)
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

            const ldiResult = ldiEngine.scorePick(pickInput, leagueSeasonSettings);

            // Transaction / Destination Tag
            let destinationTag = 'Retained All Season';
            let tagType = 'retained';
            let tradeInfo = null;

            if (finalInfo && finalInfo.weeklyRoster) {
                const rosterEntries = Object.entries(finalInfo.weeklyRoster);
                const otherMgrs = rosterEntries.filter(([wk, m]) => {
                    const pMgrId = typeof m === 'object' ? (m?.managerId || m?.manager_id) : m;
                    return pMgrId && String(pMgrId).toLowerCase() !== String(mgrId).toLowerCase();
                });
                if (otherMgrs.length > 0) {
                    const firstWeekMoved = otherMgrs[0][0];
                    const rawTarget = otherMgrs[0][1];
                    const targetMgrId = typeof rawTarget === 'object' ? (rawTarget?.managerId || rawTarget?.manager_id) : rawTarget;
                    const targetMgrName = this.managers.find(m => String(m.id).toLowerCase() === String(targetMgrId).toLowerCase())?.name ||
                                          this.managers.find(m => String(m.manager_id).toLowerCase() === String(targetMgrId).toLowerCase())?.name ||
                                          targetMgrId;
                    destinationTag = `Moved to ${targetMgrName} (Wk ${firstWeekMoved})`;
                    tagType = 'traded';
                    tradeInfo = {
                        year,
                        week: Number(firstWeekMoved),
                        fromManagerId: mgrId,
                        fromManagerName: mgrName,
                        toManagerId: targetMgrId,
                        toManagerName: targetMgrName,
                        playerId: pId,
                        playerName: pName,
                        position: pos
                    };
                } else if (finalInfo.weeksPlayed < 4 && maxRegularSeasonGames > 8) {
                    const activeWeeks = Array.from(playerSeasonTotals[String(pId)]?.weeksActive || []);
                    const lastActiveWk = activeWeeks.length > 0 ? Math.max(...activeWeeks) : 1;
                    const dropWk = Math.min(lastActiveWk + 1, maxRegularSeasonGames);
                    destinationTag = `Dropped to Waivers (Wk ${dropWk})`;
                    tagType = 'dropped';
                }
            }

            const pickData = {
                overallPick,
                round,
                roundPick,
                playerId: pId,
                playerName: pName,
                position: pos,
                nflTeam: nflTeam,
                managerId: mgrId,
                managerName: mgrName,
                teamName: teamName,
                draftedPosRank,
                draftedPosNum,
                finishPosRank,
                finishPosNum,
                totalPoints,
                gamesPlayed: (nflInfo && nflInfo.gp !== null) ? nflInfo.gp : (ldiResult.gamesPlayed ?? gamesPlayed),
                gamesMissed: (nflInfo && nflInfo.missedGames !== undefined) ? nflInfo.missedGames : (ldiResult.gamesMissed ?? gamesMissed),
                ldiResult,
                destinationTag,
                tagType,
                tradeInfo
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

        // 2. Manager-Level Rollup & Empirical Percentile Grade (Sections 5 & 6)
        const managerLeaderboard = Object.values(managerPicksMap).map(mObj => {
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
                meanLdiRaw: rollup.meanLdiRaw,
                draftIndex: rollup.managerDisplayScore,
                gradeInfo: LDIEngine.getScoreGrade(rollup.managerDisplayScore),
                hits,
                busts,
                steals,
                picks: mObj.picks
            };
        }).sort((a, b) => b.draftIndex - a.draftIndex);

        // Best Steal & Biggest Bust (Sections 4 & 6)
        const validSkillPicks = enrichedPicks.filter(p => p.ldiResult?.isScored && p.playerName && !p.playerName.startsWith('Player #-1'));
        const bestSteal = [...validSkillPicks].sort((a, b) => (b.ldiResult.LDI_raw || 0) - (a.ldiResult.LDI_raw || 0))[0] || null;
        
        const earlyPicks = validSkillPicks.filter(p => p.round <= 4);
        const biggestBust = [...earlyPicks].sort((a, b) => (a.ldiResult.LDI_raw || 0) - (b.ldiResult.LDI_raw || 0))[0] || null;

        return {
            year,
            maxWeeksInSeason: maxRegularSeasonGames,
            scoringFormat: this.getScoringFormat(year),
            totalPicks: enrichedPicks.length,
            picks: enrichedPicks,
            managerPicksMap,
            managerLeaderboard,
            bestSteal,
            biggestBust,
            tuningParams: ldiEngine.params
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
                    <h1>Draft Archive</h1>
                    <p>No historical draft records found.</p>
                </div>
            `;
            return;
        }

        const nflYear = this.getNflYear(this.selectedYear);
        if (!nflStats.isSeasonLoaded(nflYear)) {
            await nflStats.preloadSeason(nflYear);
        }

        const analytics = this.computeSeasonAnalytics(this.selectedYear);
        const maxWeeks = analytics.maxWeeksInSeason || (this.selectedYear >= 2021 ? 17 : 16);
        const defaultPossibleG = Math.max(1, maxWeeks - 1);
        const managerPicksMap = analytics.managerPicksMap || {};
        const managerLeaderboard = analytics.managerLeaderboard || [];

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
                ${yr}
            </button>
        `).join('');

        // Top Summary Hero Cards HTML
        const topDraftChampion = managerLeaderboard[0] || null;
        const stealHTML = analytics.bestSteal ? `
            <div class="draft-hero-card gold-glow">
                <div class="draft-card-tag" style="color: #10b981; font-weight: 700; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px;">Steal of the Draft</div>
                <div class="draft-card-main-val">${analytics.bestSteal.playerName}</div>
                <div class="draft-card-sub">
                    <strong>${analytics.bestSteal.position}</strong> · Rd ${analytics.bestSteal.round} (Pick #${analytics.bestSteal.overallPick}) · <em>${analytics.bestSteal.managerName}</em>
                </div>
                <div class="draft-metric-pill green" title="Landon Draft Index Pick Score & Raw Performance">
                    ${analytics.bestSteal.draftedPosRank} &rarr; ${analytics.bestSteal.finishPosRank} <span style="font-weight:800; margin-left:4px;">(${analytics.bestSteal.ldiResult.pickDisplayScore} LDI · +${analytics.bestSteal.ldiResult.LDI_raw >= 0 ? analytics.bestSteal.ldiResult.LDI_raw.toFixed(2) : analytics.bestSteal.ldiResult.LDI_raw} Raw)</span>
                </div>
            </div>
        ` : '';

        const bustHTML = analytics.biggestBust ? `
            <div class="draft-hero-card red-glow">
                <div class="draft-card-tag" style="color: #ef4444; font-weight: 700; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px;">Biggest Bust</div>
                <div class="draft-card-main-val">${analytics.biggestBust.playerName}</div>
                <div class="draft-card-sub">
                    <strong>${analytics.biggestBust.position}</strong> · Rd ${analytics.biggestBust.round} (Pick #${analytics.biggestBust.overallPick}) · <em>${analytics.biggestBust.managerName}</em>
                </div>
                <div class="draft-metric-pill red" title="Landon Draft Index Pick Score & Raw Performance">
                    ${analytics.biggestBust.draftedPosRank} &rarr; ${analytics.biggestBust.finishPosRank} <span style="font-weight:800; margin-left:4px;">(${analytics.biggestBust.ldiResult.pickDisplayScore} LDI · ${analytics.biggestBust.ldiResult.LDI_raw.toFixed(2)} Raw)</span>
                </div>
            </div>
        ` : '';

        const champGrade = topDraftChampion ? topDraftChampion.gradeInfo : { grade: 'A+', color: '#10b981' };
        const champHTML = topDraftChampion ? `
            <div class="draft-hero-card">
                <div class="draft-card-tag" style="color: var(--accent-gold); font-weight: 700; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.5px;">Draft Class Champion</div>
                <div class="draft-card-main-val">${this.nameMode === 'team' ? topDraftChampion.teamName : topDraftChampion.managerName}</div>
                <div class="draft-card-sub">
                    Landon Draft Index: <strong style="color: ${champGrade.color}; font-size: 1.15rem;">${topDraftChampion.draftIndex} / 100 (${champGrade.grade})</strong>
                </div>
                <div class="draft-metric-pill gold" title="Mean LDI Raw Value & Scoring Hits">
                    ${topDraftChampion.meanLdiRaw >= 0 ? '+' : ''}${topDraftChampion.meanLdiRaw.toFixed(2)} Mean LDI Raw (${topDraftChampion.hits} Hits)
                </div>
            </div>
        ` : '';

        // Manager Leaderboard Table/Chips
        const managerChipsHTML = managerLeaderboard.map((m, idx) => {
            const g = m.gradeInfo;
            return `
                <div class="draft-mgr-chip" style="border-left: 3px solid ${g.color};" title="Draft Grade: ${m.draftIndex}/100 (${g.grade}) • Mean LDI: ${m.meanLdiRaw >= 0 ? '+' : ''}${m.meanLdiRaw.toFixed(3)} • Hits: ${m.hits} • Busts: ${m.busts}">
                    <span class="draft-chip-rank">#${idx + 1}</span>
                    <span class="draft-chip-name">${this.nameMode === 'team' ? m.teamName : m.managerName}</span>
                    <span class="draft-chip-score" style="color: ${g.color}; font-weight: 800;">
                        ${m.draftIndex} <small style="font-size:0.75em; color:var(--text-muted); font-weight: 600;">(${g.grade})</small>
                    </span>
                </div>
            `;
        }).join('');

        // Founder Tuning Panel HTML (Section 8)
        const p = analytics.tuningParams;
        const tuningPanelHTML = `
            <div class="ldi-tuning-panel ${this.showTuningPanel ? 'open' : 'collapsed'}">
                <div class="ldi-tuning-header">
                    <div class="ldi-tuning-title-group">
                        <span class="ldi-tuning-badge">Founder Tuning Panel</span>
                        <h3>Live Model Calibration</h3>
                        <p>Adjust scoring parameters in real time. Changes instantly recalculate all picks, pills, and manager percentiles across the platform.</p>
                    </div>
                    <div class="ldi-tuning-actions">
                        <button id="btn-reset-tuning" class="ldi-btn-secondary">Reset Defaults</button>
                        <button id="btn-close-tuning" class="ldi-btn-icon" title="Close Panel">✕</button>
                    </div>
                </div>

                <div class="ldi-sliders-grid">
                    <!-- Lambda (Miss Dampening) -->
                    <div class="ldi-slider-card">
                        <div class="ldi-slider-label-row">
                            <span class="ldi-slider-title">Miss Dampening (λ)</span>
                            <span class="ldi-slider-val" id="val-lambda">${Number(p.lambda).toFixed(2)}</span>
                        </div>
                        <p class="ldi-slider-desc">
                            <strong>Meaning:</strong> Penalizes underperforming picks (busts) relative to hits.<br>
                            <strong>Adjusting:</strong> Lower values forgive missed picks to reward draft steals; higher values enforce strict penalties for busts.
                        </p>
                        <input type="range" class="ldi-range-slider" id="slider-lambda" min="0.00" max="1.00" step="0.05" value="${p.lambda}">
                    </div>

                    <!-- Alpha (VORP Blend Weight) -->
                    <div class="ldi-slider-card">
                        <div class="ldi-slider-label-row">
                            <span class="ldi-slider-title">VORP Blend Weight (α)</span>
                            <span class="ldi-slider-val" id="val-alpha">${Number(p.alpha).toFixed(2)}</span>
                        </div>
                        <p class="ldi-slider-desc">
                            <strong>Meaning:</strong> Balance between positional performance (α) and overall draft slot VORP (1-α).<br>
                            <strong>Adjusting:</strong> Higher values emphasize positional rank vs expectation; lower values reward early-round positional scarcity.
                        </p>
                        <input type="range" class="ldi-range-slider" id="slider-alpha" min="0.50" max="1.00" step="0.05" value="${p.alpha}">
                    </div>

                    <!-- Winsorization Cap Percentile -->
                    <div class="ldi-slider-card">
                        <div class="ldi-slider-label-row">
                            <span class="ldi-slider-title">Winsorization Cap Percentile</span>
                            <span class="ldi-slider-val" id="val-winsor">${Math.round(p.winsor_percentile * 100)}th</span>
                        </div>
                        <p class="ldi-slider-desc">
                            <strong>Meaning:</strong> Upper weekly scoring ceiling per position to trim extreme single-week outlier spikes.<br>
                            <strong>Adjusting:</strong> Lower percentiles compress massive outlier games; higher percentiles preserve full raw spike weeks.
                        </p>
                        <input type="range" class="ldi-range-slider" id="slider-winsor" min="0.70" max="0.99" step="0.05" value="${p.winsor_percentile}">
                    </div>

                    <!-- Inconsistency Threshold T_bust -->
                    <div class="ldi-slider-card">
                        <div class="ldi-slider-label-row">
                            <span class="ldi-slider-title">Inconsistency Threshold (T_bust)</span>
                            <span class="ldi-slider-val" id="val-tbust">${Number(p.t_bust).toFixed(2)}</span>
                        </div>
                        <p class="ldi-slider-desc">
                            <strong>Meaning:</strong> Share of points scored in top 25% best games needed to trigger the diagnostic pill.<br>
                            <strong>Adjusting:</strong> Lower values flag more boom-or-bust players; higher values restrict the pill to extreme single-week wonders.
                        </p>
                        <input type="range" class="ldi-range-slider" id="slider-tbust" min="0.30" max="0.70" step="0.05" value="${p.t_bust}">
                    </div>

                    <!-- Games Missed Threshold -->
                    <div class="ldi-slider-card">
                        <div class="ldi-slider-label-row">
                            <span class="ldi-slider-title">Games-Missed Threshold</span>
                            <span class="ldi-slider-val" id="val-gmissed">${p.games_missed_threshold} Games</span>
                        </div>
                        <p class="ldi-slider-desc">
                            <strong>Meaning:</strong> Absence cutoff before injury proration lowers a player's baseline expectation.<br>
                            <strong>Adjusting:</strong> Lower thresholds prorate short 1-2 game absences; higher thresholds require prolonged multi-week injuries.
                        </p>
                        <input type="range" class="ldi-range-slider" id="slider-gmissed" min="1" max="8" step="1" value="${p.games_missed_threshold}">
                    </div>
                </div>
            </div>
        `;

        // Pick Row Renderer (shared across By Round and By Team/Manager views)
        const renderPickRow = (p) => {
            const displayName = this.nameMode === 'team' ? p.teamName : p.managerName;
            const isDefOrK = (p.position === 'DEF' || p.position === 'D/ST' || p.position === 'K');
            const ldi = p.ldiResult;

            // LDI Pick Score Badge (Sections 4.8 & 6.1)
            let scoreBadge = '';
            if (isDefOrK) {
                scoreBadge = `<span class="pick-val-badge omitted" title="Kickers and Defenses are excluded from LDI scoring">K / DEF</span>`;
            } else if (ldi && ldi.isScored) {
                const grade = LDIEngine.getScoreGrade(ldi.pickDisplayScore);
                scoreBadge = `
                    <span class="pick-val-badge" style="background: ${grade.bg}; color: ${grade.color}; border: 1px solid ${grade.border};" title="LDI Pick Score: ${ldi.pickDisplayScore} / 100 (${grade.grade}) • Raw: ${ldi.LDI_raw >= 0 ? '+' : ''}${ldi.LDI_raw.toFixed(2)} • Residual: ${ldi.residual >= 0 ? '+' : ''}${ldi.residual.toFixed(1)} pts">
                        ${ldi.pickDisplayScore} <small style="font-size: 0.75em; opacity: 0.9;">LDI</small>
                    </span>
                `;
            }

            // Diagnostic Pills (Section 7)
            let injuryBadge = '';
            if (!isDefOrK && p.gamesMissed >= 4) {
                const missedCount = p.gamesMissed;
                const possibleG = ldi?.possibleGames || defaultPossibleG;
                if (p.gamesPlayed > 0 && p.totalPoints > 0) {
                    const pacePts = ldi?.fullSeasonPace ? ldi.fullSeasonPace : ((p.totalPoints / Math.max(1, p.gamesPlayed)) * possibleG);
                    const posPaceRank = nflStats.getPositionalPaceRank(p.position, pacePts, nflYear, analytics.scoringFormat);
                    const paceDisplay = posPaceRank ? `${posPaceRank} Pace` : `${Math.round(pacePts)} Pts Pace`;
                    const adjExpVal = ldi?.E_adj !== undefined ? `${ldi.E_adj} adj exp` : 'prorated expected';
                    injuryBadge = `
                        <span class="pick-sub-tag injury" title="Missed ${missedCount} regular season games (Paced for ${pacePts.toFixed(1)} pts = ${posPaceRank || 'pace'} over ${possibleG} games vs ${adjExpVal})">Missed ${missedCount} Games (${paceDisplay})</span>
                    `;
                } else {
                    injuryBadge = `
                        <span class="pick-sub-tag injury" title="Missed entire season (${missedCount} games) due to injury. No baseline penalty applied (Z = 0).">Missed ${missedCount} Games</span>
                    `;
                }
            }

            // Inconsistent Producer Pill (Section 7.2)
            let inconsistentBadge = '';
            if (ldi && ldi.inconsistentProducer) {
                inconsistentBadge = `
                    <span class="pick-sub-tag boom-bust" title="${ldi.inconsistentTooltip}">Inconsistent Producer</span>
                `;
            }

            // Low Confidence Warning (Section 10)
            let lowConfBadge = '';
            if (ldi && ldi.isLowConfidence) {
                lowConfBadge = `
                    <span class="pick-sub-tag low-conf" title="Draft rank exceeded historical training sample depth (evaluated via conservative extrapolation)">Extrapolated Slot</span>
                `;
            }

            // Transaction Badge
            let txBadge = '';
            if (p.tagType === 'traded') {
                txBadge = `<button type="button" class="pick-sub-tag traded" data-pick-overall="${p.overallPick}" title="Click to view full trade details">⇄ ${p.destinationTag}</button>`;
            } else if (p.tagType === 'dropped') {
                txBadge = `<span class="pick-sub-tag dropped">${p.destinationTag}</span>`;
            }

            const posClass = `pos-${(p.position || '').toLowerCase().replace(/[^a-z0-9]/g, '')}`;

            return `
                <div class="draft-pick-row">
                    <div class="pick-num-badge">
                        <span class="pick-overall">#${p.overallPick}</span>
                        <span class="pick-round-pos">${this.displayGrouping === 'manager' ? `Rd ${p.round}` : `${p.round}.${p.roundPick < 10 ? '0' + p.roundPick : p.roundPick}`}</span>
                    </div>

                    <div class="pick-info-col">
                        <div class="pick-top-line">
                            <span class="pick-player-name">${p.playerName}</span>
                            <span class="pick-pos-pill ${posClass}">${p.position}${p.nflTeam ? ' · ' + p.nflTeam : ''}</span>
                        </div>
                        
                        <div class="pick-owner-line">
                            <span class="pick-owner-name">${displayName}</span>
                        </div>

                        <div class="pick-ranks-line">
                            <span class="rank-step"><small>Drafted:</small> <strong>${p.draftedPosRank}</strong></span>
                            <span class="rank-arrow">&rarr;</span>
                            <span class="rank-step"><small>Finish:</small> <strong>${p.finishPosRank}</strong></span>
                            ${scoreBadge}
                        </div>

                        ${(injuryBadge || inconsistentBadge || lowConfBadge || txBadge) ? `
                            <div class="pick-tags-line">
                                ${injuryBadge}
                                ${inconsistentBadge}
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

        // 3-Column Manager/Team Cards Grid HTML (Ordered by Round 1 draft slot)
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
                            <span class="round-title">${mTitle}</span>
                            <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 600; margin-left: 6px;">Slot #${slotIdx + 1}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${mRollup ? `<span class="draft-chip-score" style="color: ${mRollup.gradeInfo?.color || '#10b981'}; font-weight: 800;" title="LDI Draft Efficiency Grade">${mRollup.draftIndex} / 100 (${mRollup.gradeInfo?.grade || 'B'})</span>` : ''}
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
                <!-- Draft Hero Banner -->
                <div class="draft-hero-banner">
                    <div class="draft-hero-title-group">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;">
                            <div>
                                <span class="draft-hero-subtitle">Historical Draft Archive</span>
                                <h1>${this.selectedYear} League Draft</h1>
                            </div>
                            <button id="btn-toggle-tuning" class="ldi-btn-tuning ${this.showTuningPanel ? 'active' : ''}">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                                Tuning Panel
                            </button>
                        </div>
                        <p class="draft-hero-desc">
                            Complete round-by-round draft results with drafted positional ranks, final season positional finishes, injury indicators, and the <strong>Landon Draft Index (LDI)</strong>.
                        </p>
                    </div>

                    <!-- Founder Tuning Panel Container -->
                    ${tuningPanelHTML}

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

                <!-- Landon Draft Index Summary Cards -->
                <div class="draft-analytics-grid">
                    ${champHTML}
                    ${stealHTML}
                    ${bustHTML}
                </div>

                <!-- Manager Draft Class Leaderboard -->
                <div class="draft-leaderboard-bar">
                    <div class="draft-leaderboard-title">Draft Efficiency Standings (LDI):</div>
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

        // Attach Year Click Listeners
        container.querySelectorAll('.season-pill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const yr = Number(e.currentTarget.getAttribute('data-year'));
                this.setYear(yr);
            });
        });

        // Attach Grouping View Toggle Listeners
        const btnGroupRound = container.querySelector('#btn-group-round');
        const btnGroupManager = container.querySelector('#btn-group-manager');
        if (btnGroupRound) {
            btnGroupRound.addEventListener('click', () => this.setDisplayGrouping('round'));
        }
        if (btnGroupManager) {
            btnGroupManager.addEventListener('click', () => this.setDisplayGrouping('manager'));
        }

        // Attach Name Mode Toggle Listeners
        const btnMgr = container.querySelector('#btn-toggle-mgr');
        const btnTeam = container.querySelector('#btn-toggle-team');
        if (btnMgr) {
            btnMgr.addEventListener('click', () => this.setNameMode('manager'));
        }
        if (btnTeam) {
            btnTeam.addEventListener('click', () => this.setNameMode('team'));
        }

        // Attach Tuning Panel Toggle Listener
        const btnToggleTuning = container.querySelector('#btn-toggle-tuning');
        const btnCloseTuning = container.querySelector('#btn-close-tuning');
        btnToggleTuning?.addEventListener('click', () => this.toggleTuningPanel());
        btnCloseTuning?.addEventListener('click', () => this.toggleTuningPanel());

        // Attach Tuning Sliders Listeners
        const sliderLambda = container.querySelector('#slider-lambda');
        const sliderAlpha = container.querySelector('#slider-alpha');
        const sliderWinsor = container.querySelector('#slider-winsor');
        const sliderTbust = container.querySelector('#slider-tbust');
        const sliderGmissed = container.querySelector('#slider-gmissed');
        const btnResetTuning = container.querySelector('#btn-reset-tuning');

        sliderLambda?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            ldiEngine.updateParams({ lambda: val });
        });

        sliderAlpha?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            ldiEngine.updateParams({ alpha: val });
        });

        sliderWinsor?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            ldiEngine.updateParams({ winsor_percentile: val });
        });

        sliderTbust?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            ldiEngine.updateParams({ t_bust: val });
        });

        sliderGmissed?.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            ldiEngine.updateParams({ games_missed_threshold: val });
        });

        btnResetTuning?.addEventListener('click', () => {
            ldiEngine.resetDefaults();
        });

        // Attach Click Listeners for Traded Picks
        container.querySelectorAll('.pick-sub-tag.traded').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const pickOverall = Number(e.currentTarget.getAttribute('data-pick-overall'));
                const pick = analytics.picks.find(p => p.overallPick === pickOverall);
                if (pick) {
                    this.openTradeModal(pick);
                }
            });
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
        const dateStr = tradeTx?.date || tradeTx?.timestamp || `${year} Season • Week ${targetWeek}`;

        let assetsHTML = '';
        if (tradeTx && tradeTx.items && tradeTx.items.length > 0) {
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
                        <div style="font-size: 0.85rem; color: var(--text-muted);">Traded to ${toName} around Week ${targetWeek}</div>
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
}
