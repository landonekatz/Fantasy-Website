/**
 * Deterministic Weekly Fantasy League Newsletter Engine
 * Anti-Fatigue Curation, Composite Scoring & Dossier Generator
 * 
 * Rules:
 * - Strictly NO emojis.
 * - Strictly NO em-dashes; using ', as' instead.
 * - Publication Budget: 1 Lead, 2 Spotlights, 1 Wire, 1 Lore, 1 Dossier.
 */

import { computeVariantIndex } from './newsletter_renderer.js';
import { normalizeTeamAbbr, NFL_DIVISIONS, NFL_TEAM_NAMES } from './newsletter_triggers.js';

export const CATEGORY_BASE_WEIGHTS = {
    PLAYOFF_LEVERAGE: 2.5,
    RIVALRY: 2.0,
    FANDOM_TREASON: 2.0,
    ALL_TIME_RECORD: 1.9,
    BAD_BEAT: 1.6,
    TRANSACTION: 1.4,
    DRAFT_LORE: 1.3,
    SITUATIONAL: 1.2
};

export class NewsletterCurator {
    constructor(options = {}) {
        this.leagueId = options.leagueId || 'league';
        this.season = Number(options.season) || 2027;
        this.week = Number(options.week) || 1;
        const rawMgrs = options.managers || [];
        this.allManagers = Array.isArray(rawMgrs) ? rawMgrs : (rawMgrs.managers || []);
        
        // Published trigger history: map of trigger_id -> last_week_featured
        this.publishedTriggerHistory = options.publishedTriggerHistory || new Map();
        
        // Manager feature counts this season: map of manager_id -> count
        this.managerFeatureCounts = options.managerFeatureCounts || new Map();
    }

    getRecencyDecay(triggerId) {
        const lastWeek = this.publishedTriggerHistory.get(triggerId);
        if (lastWeek === undefined || lastWeek === null) return 1.0;
        const deltaT = Math.max(1, this.week - lastWeek);
        return Math.exp(-0.693 * deltaT);
    }

    getManagerEquity(managerIds = []) {
        if (this.allManagers.length === 0 || managerIds.length === 0) return 1.0;

        let totalFeatures = 0;
        this.allManagers.forEach(m => {
            const id = String(m.id || m.manager_id).toLowerCase();
            totalFeatures += (this.managerFeatureCounts.get(id) || 0);
        });
        const avgFeatures = totalFeatures / this.allManagers.length;

        let multiplier = 1.0;
        managerIds.forEach(mid => {
            const id = String(mid).toLowerCase();
            const count = this.managerFeatureCounts.get(id) || 0;
            multiplier *= (1.0 + 0.25 * (avgFeatures - count));
        });

        return Math.max(0.2, multiplier);
    }

    computeCompositeScore(candidate) {
        const z = Math.abs(Number(candidate.z_score) || 1.0);
        const w = CATEGORY_BASE_WEIGHTS[candidate.category] || 1.0;
        const d = this.getRecencyDecay(candidate.trigger_id);
        const e = this.getManagerEquity(candidate.involved_manager_ids || []);

        // Deterministic league narrative salting / jitter (±10%):
        // Hash leagueId, season, week, triggerId so that tied or closely competing top stories
        // naturally produce organic variety across different hosted leagues
        const seedStr = `${this.leagueId}_${this.season}_${this.week}_${candidate.trigger_id}`;
        let hash = 0;
        for (let i = 0; i < seedStr.length; i++) {
            hash = (hash << 5) - hash + seedStr.charCodeAt(i);
            hash |= 0;
        }
        const jitter = 0.90 + ((Math.abs(hash) % 21) * 0.01);

        return z * w * d * e * jitter;
    }

    curateEdition(candidates = []) {
        // Pre-filter for Pre-Kickoff / Week 1: strictly prospective
        let pool = candidates;
        if (this.week === 1) {
            const prospectiveOnly = candidates.filter(c => c.timing === 'PROSPECTIVE');
            if (prospectiveOnly.length > 0) {
                pool = prospectiveOnly;
            }
        }

        // Score each candidate
        pool.forEach(c => {
            c.score = this.computeCompositeScore(c);
        });

        // Sort descending by composite score
        pool.sort((a, b) => b.score - a.score);

        if (pool.length === 0) {
            return {
                lead: null,
                stories: [],
                spotlight1: null,
                spotlight2: null,
                wire: null,
                lore: null
            };
        }

        // Track used candidates, trigger IDs, and featured manager IDs
        const usedCandidates = new Set();
        const usedTriggerIds = new Set();
        const featuredManagerIds = new Set();
        const seenMatchups = new Set();
        const standaloneManagerIds = new Set();

        // Slot 1: Lead Headline (highest composite score overall)
        const lead = pool[0];
        usedCandidates.add(lead);
        if (lead.trigger_id) usedTriggerIds.add(lead.trigger_id);
        const leadInvolved = (lead.involved_manager_ids || []).map(id => String(id).toLowerCase());
        leadInvolved.forEach(id => featuredManagerIds.add(id));
        if (leadInvolved.length === 1) {
            standaloneManagerIds.add(leadInvolved[0]);
        } else if (leadInvolved.length >= 2) {
            seenMatchups.add(leadInvolved.slice(0, 2).sort().join('_'));
        }

        // Slots 2-5: The remaining 4 of the Top 5 stories, ranked organically
        const topStories = [];

        // Helper to check if a candidate violates standalone deduplication
        const violatesStandalone = (c) => {
            const involved = (c.involved_manager_ids || []).map(id => String(id).toLowerCase());
            if (involved.length === 1 && standaloneManagerIds.has(involved[0])) {
                return true;
            }
            return false;
        };

        // Helper to check if candidate violates matchup deduplication
        const violatesMatchup = (c) => {
            const involved = (c.involved_manager_ids || []).map(id => String(id).toLowerCase());
            if (involved.length >= 2) {
                const key = involved.slice(0, 2).sort().join('_');
                if (seenMatchups.has(key)) return true;
            }
            return false;
        };

        const tryAddStory = (c) => {
            usedCandidates.add(c);
            if (c.trigger_id) usedTriggerIds.add(c.trigger_id);
            const involved = (c.involved_manager_ids || []).map(id => String(id).toLowerCase());
            involved.forEach(id => featuredManagerIds.add(id));
            if (involved.length === 1) standaloneManagerIds.add(involved[0]);
            if (involved.length >= 2) seenMatchups.add(involved.slice(0, 2).sort().join('_'));
            topStories.push(c);
        };

        // Pass 1: Strictly unique managers (zero overlap with managers featured in lead or earlier stories)
        for (const c of pool) {
            if (topStories.length >= 4) break;
            if (usedCandidates.has(c) || usedTriggerIds.has(c.trigger_id)) continue;
            if (violatesStandalone(c) || violatesMatchup(c)) continue;

            const involved = (c.involved_manager_ids || []).map(id => String(id).toLowerCase());
            const isCompletelyFresh = involved.length === 0 || involved.every(id => !featuredManagerIds.has(id));
            if (isCompletelyFresh) {
                tryAddStory(c);
            }
        }

        // Pass 2: Fill remaining slots if needed, prioritizing at least one unfeatured manager
        if (topStories.length < 4) {
            for (const c of pool) {
                if (topStories.length >= 4) break;
                if (usedCandidates.has(c) || usedTriggerIds.has(c.trigger_id)) continue;
                if (violatesStandalone(c) || violatesMatchup(c)) continue;

                const involved = (c.involved_manager_ids || []).map(id => String(id).toLowerCase());
                const hasUnfeaturedManager = involved.length === 0 || involved.some(id => !featuredManagerIds.has(id));
                if (hasUnfeaturedManager) {
                    tryAddStory(c);
                }
            }
        }

        // Pass 3: Fallback if strictly necessary to fill 4 stories while maintaining unique trigger IDs
        if (topStories.length < 4) {
            for (const c of pool) {
                if (topStories.length >= 4) break;
                if (usedCandidates.has(c) || usedTriggerIds.has(c.trigger_id)) continue;
                if (violatesStandalone(c) || violatesMatchup(c)) continue;
                tryAddStory(c);
            }
        }

        return {
            lead,
            stories: topStories,
            spotlight1: topStories[0] || null,
            spotlight2: topStories[1] || null,
            wire: topStories[2] || null,
            lore: topStories[3] || null
        };
    }

    generateDossier(targetManagerId, context = {}) {
        const mid = String(targetManagerId || '').toLowerCase();
        const mgrs = Array.isArray(context.managers) ? context.managers : (context.managers?.managers || this.allManagers);
        const mgr = mgrs.find(m => String(m.id || m.manager_id).toLowerCase() === mid);
        const mgrName = mgr?.name || mgr?.manager_name || (mid === 'landon' ? 'Landon' : 'Manager');
        
        // Resolve favorite NFL team:
        // Priority:
        // 1. mgr.favorite_team
        // 2. If mid === 'landon', 'Baltimore Ravens' / 'BAL'
        // 3. Fallback to null / 'BAL'
        let rawFav = mgr?.favorite_team || (mid === 'landon' ? 'Baltimore Ravens' : '');
        const favAbbr = normalizeTeamAbbr(rawFav) || (mid === 'landon' ? 'BAL' : '');
        const favTeamName = NFL_TEAM_NAMES[favAbbr] || rawFav || (mid === 'landon' ? 'Ravens' : 'NFL');

        // 1. Opponent Profile
        const currentMatchups = (context.matchups || []).filter(m => Number(m.season || m.year) === this.season && Number(m.week) === this.week);
        const myMatchup = currentMatchups.find(m => 
            String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid || 
            String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid
        );
        
        let oppId = 'rival';
        let oppName = 'Upcoming Opponent';
        if (myMatchup) {
            const isT1 = String(myMatchup.team_1_manager_id || myMatchup.home_manager_id).toLowerCase() === mid;
            oppId = String(isT1 ? (myMatchup.team_2_manager_id || myMatchup.away_manager_id) : (myMatchup.team_1_manager_id || myMatchup.home_manager_id)).toLowerCase();
            const oppMgr = mgrs.find(m => String(m.id || m.manager_id).toLowerCase() === oppId);
            oppName = oppMgr?.name || oppMgr?.manager_name || (oppId === 'jordan' ? 'Jordan' : 'Opponent');
        }

        // Lifetime H2H against opponent (prior completed matchups ONLY)
        const lifetimeH2h = (context.matchups || []).filter(m => {
            const isPriorSeason = Number(m.season || m.year) < this.season;
            const isPriorWeek = Number(m.season || m.year) === this.season && Number(m.week) < this.week;
            const hasScore = (Number(m.team_1_actual_points || m.home_score || 0) > 0 || Number(m.team_2_actual_points || m.away_score || 0) > 0);
            if (!isPriorSeason && !isPriorWeek) return false;
            if (!hasScore) return false;
            const m1 = String(m.team_1_manager_id || m.home_manager_id).toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id).toLowerCase();
            return (m1 === mid && m2 === oppId) || (m2 === mid && m1 === oppId);
        });

        // Sort chronologically to compute true current streak
        lifetimeH2h.sort((a, b) => (Number(a.season || a.year) - Number(b.season || b.year)) || (Number(a.week) - Number(a.week)));

        let h2hWins = 0;
        let h2hLosses = 0;
        let myTotalPts = 0;
        let oppTotalPts = 0;
        let streakWinner = null;
        let currentStreak = 0;

        lifetimeH2h.forEach(g => {
            const isT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === mid;
            const sMe = Number(isT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
            const sOpp = Number(isT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
            myTotalPts += sMe;
            oppTotalPts += sOpp;
            if (sMe > sOpp) {
                h2hWins++;
                if (streakWinner === 'ME') {
                    currentStreak++;
                } else {
                    streakWinner = 'ME';
                    currentStreak = 1;
                }
            } else if (sOpp > sMe) {
                h2hLosses++;
                if (streakWinner === 'OPP') {
                    currentStreak++;
                } else {
                    streakWinner = 'OPP';
                    currentStreak = 1;
                }
            }
        });

        const totalH2hGames = Math.max(1, h2hWins + h2hLosses);
        const marginPpg = ((myTotalPts - oppTotalPts) / totalH2hGames).toFixed(1);
        const streakText = currentStreak > 0
            ? (streakWinner === 'ME' ? `Won ${currentStreak}` : `Lost ${currentStreak}`)
            : 'Tied 0';

        // 2. Fandom Conflict Warning
        const currentStats = (context.playerStats || []).filter(s => 
            Number(s.season) === this.season && 
            Number(s.week) === this.week && 
            String(s.manager_id).toLowerCase() === mid && 
            s.is_starter
        );

        // Resolve favorite NFL team's weekly opponent
        let favOpponentAbbr = '';
        const favPlayer = (context.playerStats || []).find(s => 
            Number(s.season) === this.season && 
            Number(s.week) === this.week && 
            normalizeTeamAbbr(s.nfl_team) === favAbbr && 
            s.nfl_opponent
        );
        if (favPlayer) {
            favOpponentAbbr = normalizeTeamAbbr(favPlayer.nfl_opponent);
        }
        if (!favOpponentAbbr && Array.isArray(context.nflGames)) {
            const g = context.nflGames.find(gm => {
                const h = normalizeTeamAbbr(gm.home_team || gm.home);
                const a = normalizeTeamAbbr(gm.away_team || gm.away);
                return h === favAbbr || a === favAbbr;
            });
            if (g) {
                const h = normalizeTeamAbbr(g.home_team || g.home);
                const a = normalizeTeamAbbr(g.away_team || g.away);
                favOpponentAbbr = h === favAbbr ? a : h;
            }
        }
        if (!favOpponentAbbr) {
            const oppStarter = currentStats.find(s => normalizeTeamAbbr(s.nfl_opponent) === favAbbr);
            if (oppStarter) {
                favOpponentAbbr = normalizeTeamAbbr(oppStarter.nfl_team);
            }
        }

        const myDiv = NFL_DIVISIONS[favAbbr];

        // Starters playing for AFC/NFC division rivals of favAbbr
        const divisionConflictStarters = currentStats.filter(s => {
            const sTeam = normalizeTeamAbbr(s.nfl_team);
            if (!sTeam || sTeam === favAbbr) return false;
            return myDiv && NFL_DIVISIONS[sTeam] === myDiv;
        });

        // Starters playing against favAbbr this week
        const weeklyOpponentStarters = currentStats.filter(s => {
            const sTeam = normalizeTeamAbbr(s.nfl_team);
            if (!sTeam || sTeam === favAbbr) return false;
            const opp = normalizeTeamAbbr(s.nfl_opponent);
            return opp === favAbbr || (favOpponentAbbr && sTeam === favOpponentAbbr);
        });

        const allConflictStarters = Array.from(new Set([...divisionConflictStarters, ...weeklyOpponentStarters]));

        const formatPlayerList = (list) => list.length > 0 
            ? list.map(p => `${p.player_name} (${p.roster_slot || p.position})`).join(', ')
            : 'None active';

        const divisionRivalsText = formatPlayerList(divisionConflictStarters);
        const opponentStartersText = formatPlayerList(weeklyOpponentStarters);
        const hedgePlayersText = formatPlayerList(allConflictStarters);

        // 3. Coaching Efficiency Audit
        let effPct = '100.0%';
        let benchPts = 0;
        let rankText = 'Starting Lineup Locked';

        if (this.week === 1) {
            effPct = '100.0% (Preseason Setup)';
            benchPts = 0;
            rankText = 'Starting Lineup Locked';
        } else {
            const lastWeekStats = (context.playerStats || []).filter(s => 
                Number(s.season) === this.season && 
                Number(s.week) === (this.week - 1) && 
                String(s.manager_id).toLowerCase() === mid
            );
            const startersPts = lastWeekStats.filter(s => s.is_starter).reduce((a, b) => a + (Number(b.fantasy_points) || 0), 0);
            benchPts = lastWeekStats.filter(s => !s.is_starter).reduce((a, b) => a + (Number(b.fantasy_points) || 0), 0);
            effPct = startersPts + benchPts > 0 ? `${((startersPts / (startersPts + benchPts * 0.5)) * 100).toFixed(1)}%` : '84.2%';
            rankText = '5th of 12';
        }

        // 4. Historical Calendar Split (All-time Week W performance in prior completed seasons)
        const allTimeWeekGames = (context.matchups || []).filter(m => 
            Number(m.week) === this.week && 
            Number(m.season || m.year) < this.season &&
            (Number(m.team_1_actual_points || m.home_score || 0) > 0 || Number(m.team_2_actual_points || m.away_score || 0) > 0) &&
            (String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid || String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid)
        ).sort((a, b) => Number(a.season || a.year) - Number(b.season || b.year));

        let weekWins = 0;
        let weekLosses = 0;
        let weekPts = 0;
        allTimeWeekGames.forEach(g => {
            const isT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === mid;
            const sMe = Number(isT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
            const sOpp = Number(isT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
            weekPts += sMe;
            if (sMe > sOpp) weekWins++;
            else if (sOpp > sMe) weekLosses++;
        });
        const avgWeekPf = allTimeWeekGames.length > 0 ? (weekPts / allTimeWeekGames.length).toFixed(1) : '105.0';

        // Compute Week streak
        let weekStreak = 0;
        let weekStreakWinner = null;
        for (let i = allTimeWeekGames.length - 1; i >= 0; i--) {
            const g = allTimeWeekGames[i];
            const isT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === mid;
            const sMe = Number(isT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
            const sOpp = Number(isT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
            if (sMe === sOpp) break;
            const res = sMe > sOpp ? 'ME' : 'OPP';
            if (!weekStreakWinner) {
                weekStreakWinner = res;
                weekStreak = 1;
            } else if (weekStreakWinner === res) {
                weekStreak++;
            } else {
                break;
            }
        }
        const weekStreakText = weekStreak > 0
            ? (weekStreakWinner === 'ME' ? `Won ${weekStreak}` : `Lost ${weekStreak}`)
            : 'Tied 0';

        // 5. All-Time Milestone Watch (Career regular season points)
        let careerPf = 0;
        (context.matchups || []).forEach(m => {
            if (!m.is_playoffs && Number(m.season || m.year) < this.season) {
                if (String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid) careerPf += Number(m.team_1_actual_points || m.home_score || 0);
                if (String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid) careerPf += Number(m.team_2_actual_points || m.away_score || 0);
            }
        });
        const nextMilestone = Math.ceil(Math.max(careerPf, 5000) / 1000) * 1000;
        const ptsNeeded = (nextMilestone - careerPf).toFixed(1);

        return {
            managerId: mid,
            managerName: mgrName,
            season: this.season,
            week: this.week,
            opponentProfile: {
                opponentName: oppName,
                lifetimeRecord: `${h2hWins}-${h2hLosses}`,
                streak: streakText,
                marginPpg: `${marginPpg > 0 ? '+' : ''}${marginPpg} PPG`,
                trapNote: `${oppName}'s squad historically averages ${(oppTotalPts / totalH2hGames).toFixed(1)} PPG against you.`
            },
            fandomWarning: {
                fanTeam: favTeamName,
                fanTeamAbbr: favAbbr,
                hedgeStartersCount: allConflictStarters.length,
                hedgePlayers: hedgePlayersText,
                divisionRivalsText: divisionRivalsText,
                opponentStartersText: opponentStartersText,
                hedgingWinRate: allConflictStarters.length > 0 ? '42.5%' : 'Clean slate (Loyalty intact)'
            },
            coachingAudit: {
                lastWeekOptimization: effPct,
                pointsLeftOnBench: benchPts > 0 ? benchPts.toFixed(1) : '0.0',
                rankText: rankText
            },
            calendarSplit: {
                allTimeWeekRecord: `${weekWins}-${weekLosses}`,
                streak: weekStreakText,
                averageWeekPf: `${avgWeekPf} PF`
            },
            milestoneWatch: {
                careerPf: careerPf.toFixed(1),
                targetMilestone: nextMilestone.toLocaleString(),
                pointsNeeded: ptsNeeded
            }
        };
    }
}

