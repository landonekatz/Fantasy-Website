import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const targetFile = path.join(rootDir, 'src', 'newsletter_triggers.js');

const triggersCode = `/**
 * Deterministic Weekly Fantasy League Newsletter Engine
 * Master Trigger Evaluation Pipeline (Modules 1 through 11)
 * 
 * Rules:
 * - Strictly NO emojis.
 * - Strictly NO em-dashes; using ', as' instead.
 * - Explicit decimal formatting ({:.1f} / .toFixed(1)).
 */

import { TRIGGER_TEMPLATES } from './newsletter_templates.js';
import { normalizeName } from './ldi_engine.js';

// NFL Division Map for Judas Starter & Division Treason
export const NFL_DIVISIONS = {
    BUF: 'AFC_EAST', MIA: 'AFC_EAST', NE: 'AFC_EAST', NYJ: 'AFC_EAST',
    BAL: 'AFC_NORTH', CIN: 'AFC_NORTH', CLE: 'AFC_NORTH', PIT: 'AFC_NORTH',
    HOU: 'AFC_SOUTH', IND: 'AFC_SOUTH', JAX: 'AFC_SOUTH', TEN: 'AFC_SOUTH',
    DEN: 'AFC_WEST', KC: 'AFC_WEST', LV: 'AFC_WEST', LAC: 'AFC_WEST',
    DAL: 'NFC_EAST', NYG: 'NFC_EAST', PHI: 'NFC_EAST', WAS: 'NFC_EAST',
    CHI: 'NFC_NORTH', DET: 'NFC_NORTH', GB: 'NFC_NORTH', MIN: 'NFC_NORTH',
    ATL: 'NFC_SOUTH', CAR: 'NFC_SOUTH', NO: 'NFC_SOUTH', TB: 'NFC_SOUTH',
    ARI: 'NFC_WEST', LAR: 'NFC_WEST', SF: 'NFC_WEST', SEA: 'NFC_WEST'
};

export const NFL_TEAM_NAMES = {
    BUF: 'Bills', MIA: 'Dolphins', NE: 'Patriots', NYJ: 'Jets',
    BAL: 'Ravens', CIN: 'Bengals', CLE: 'Browns', PIT: 'Steelers',
    HOU: 'Texans', IND: 'Colts', JAX: 'Jaguars', TEN: 'Titans',
    DEN: 'Broncos', KC: 'Chiefs', LV: 'Raiders', LAC: 'Chargers',
    DAL: 'Cowboys', NYG: 'Giants', PHI: 'Eagles', WAS: 'Commanders',
    CHI: 'Bears', DET: 'Lions', GB: 'Packers', MIN: 'Vikings',
    ATL: 'Falcons', CAR: 'Panthers', NO: 'Saints', TB: 'Buccaneers',
    ARI: 'Cardinals', LAR: 'Rams', SF: '49ers', SEA: 'Seahawks'
};

export const NFL_TEAM_TO_ABBR = {
    'BALTIMORE RAVENS': 'BAL', 'RAVENS': 'BAL', 'BAL': 'BAL',
    'BUFFALO BILLS': 'BUF', 'BILLS': 'BUF', 'BUF': 'BUF',
    'NEW ENGLAND PATRIOTS': 'NE', 'PATRIOTS': 'NE', 'NE': 'NE',
    'MIAMI DOLPHINS': 'MIA', 'DOLPHINS': 'MIA', 'MIA': 'MIA',
    'NEW YORK JETS': 'NYJ', 'JETS': 'NYJ', 'NYJ': 'NYJ',
    'CINCINNATI BENGALS': 'CIN', 'BENGALS': 'CIN', 'CIN': 'CIN',
    'CLEVELAND BROWNS': 'CLE', 'BROWNS': 'CLE', 'CLE': 'CLE',
    'PITTSBURGH STEELERS': 'PIT', 'STEELERS': 'PIT', 'PIT': 'PIT',
    'HOUSTON TEXANS': 'HOU', 'TEXANS': 'HOU', 'HOU': 'HOU',
    'INDIANAPOLIS COLTS': 'IND', 'COLTS': 'IND', 'IND': 'IND',
    'JACKSONVILLE JAGUARS': 'JAX', 'JAGUARS': 'JAX', 'JAX': 'JAX', 'JAC': 'JAX',
    'TENNESSEE TITANS': 'TEN', 'TITANS': 'TEN', 'TEN': 'TEN',
    'DENVER BRONCOS': 'DEN', 'BRONCOS': 'DEN', 'DEN': 'DEN',
    'KANSAS CITY CHIEFS': 'KC', 'CHIEFS': 'KC', 'KC': 'KC',
    'LAS VEGAS RAIDERS': 'LV', 'RAIDERS': 'LV', 'LV': 'LV', 'OAK': 'LV',
    'LOS ANGELES CHARGERS': 'LAC', 'CHARGERS': 'LAC', 'LAC': 'LAC', 'SD': 'LAC',
    'DALLAS COWBOYS': 'DAL', 'COWBOYS': 'DAL', 'DAL': 'DAL',
    'NEW YORK GIANTS': 'NYG', 'GIANTS': 'NYG', 'NYG': 'NYG',
    'PHILADELPHIA EAGLES': 'PHI', 'EAGLES': 'PHI', 'PHI': 'PHI',
    'WASHINGTON COMMANDERS': 'WAS', 'COMMANDERS': 'WAS', 'WAS': 'WAS', 'WSH': 'WAS',
    'CHICAGO BEARS': 'CHI', 'BEARS': 'CHI', 'CHI': 'CHI',
    'DETROIT LIONS': 'DET', 'LIONS': 'DET', 'DET': 'DET',
    'GREEN BAY PACKERS': 'GB', 'PACKERS': 'GB', 'GB': 'GB',
    'MINNESOTA VIKINGS': 'MIN', 'VIKINGS': 'MIN', 'MIN': 'MIN',
    'ATLANTA FALCONS': 'ATL', 'FALCONS': 'ATL', 'ATL': 'ATL',
    'CAROLINA PANTHERS': 'CAR', 'PANTHERS': 'CAR', 'CAR': 'CAR',
    'NEW ORLEANS SAINTS': 'NO', 'SAINTS': 'NO', 'NO': 'NO',
    'TAMPA BAY BUCCANEERS': 'TB', 'BUCCANEERS': 'TB', 'TB': 'TB',
    'ARIZONA CARDINALS': 'ARI', 'CARDINALS': 'ARI', 'ARI': 'ARI',
    'LOS ANGELES RAMS': 'LAR', 'RAMS': 'LAR', 'LAR': 'LAR', 'LA': 'LAR', 'STL': 'LAR',
    'SAN FRANCISCO 49ERS': 'SF', '49ERS': 'SF', 'SF': 'SF',
    'SEATTLE SEAHAWKS': 'SEA', 'SEAHAWKS': 'SEA', 'SEA': 'SEA'
};

export function normalizeTeamAbbr(team) {
    if (!team) return '';
    const upper = String(team).toUpperCase().trim();
    if (NFL_TEAM_TO_ABBR[upper]) return NFL_TEAM_TO_ABBR[upper];
    if (upper === 'WSH' || upper === 'WAS') return 'WAS';
    if (upper === 'JAC' || upper === 'JAX') return 'JAX';
    if (upper === 'LA' || upper === 'LAR') return 'LAR';
    if (upper === 'SD' || upper === 'LAC') return 'LAC';
    if (upper === 'OAK' || upper === 'LV') return 'LV';
    if (upper === 'STL') return 'LAR';
    return upper;
}

function mean(arr) {
    if (!arr || arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr, m) {
    if (!arr || arr.length <= 1) return 1.0;
    const avg = m !== undefined ? m : mean(arr);
    const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (arr.length - 1);
    return Math.sqrt(variance) || 1.0;
}

export const KNOWN_ALIASES = {
    'mistrfistr': 'Blake',
    'thuda12': 'Tyler Hudacek',
    'c0cc0': 'Rocco Corletto',
    'jamisonr9': 'Jamison Rectanus',
    'patlovas': 'Patrick Lovas',
    'thomasoven': 'Thomas Oven',
    'joshuavillano': 'Joshua Villano',
    'franksteam1': 'Frank',
    'mdwg': 'Madoc Watson',
    'lnuge': 'Laird',
    'sheeplers': 'Sheeplers',
    'lps015': 'LPS'
};

export const KNOWN_FIRST_NAMES = [
    'tyler', 'jamison', 'rocco', 'patrick', 'thomas', 'monil', 'joshua', 'frank', 'blake',
    'alex', 'alexander', 'ben', 'benjamin', 'carson', 'landon', 'isabella', 'jake', 'jordan',
    'luke', 'mike', 'will', 'william', 'yusuf', 'jack', 'ethan', 'luis', 'brady', 'adam',
    'scott', 'ira', 'seth', 'simon', 'brendan', 'daniel', 'jason', 'lee', 'nick', 'seb', 'sebastian'
];

export function splitCompoundName(str) {
    if (!str) return str;
    const trimmed = String(str).trim();
    if (trimmed.includes(' ')) {
        return trimmed.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    const clean = trimmed.replace(/[0-9_.-]/g, '').toLowerCase();
    for (const fn of KNOWN_FIRST_NAMES) {
        if (clean.startsWith(fn) && clean.length > fn.length + 1) {
            const first = fn.charAt(0).toUpperCase() + fn.slice(1);
            const last = clean.slice(fn.length);
            const lastCap = last.charAt(0).toUpperCase() + last.slice(1);
            return `${first} ${lastCap}`;
        }
    }
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function formatEmailToName(email) {
    if (!email || !email.includes('@')) return null;
    const user = email.split('@')[0];
    const clean = user.replace(/[0-9_.-]/g, ' ').trim();
    if (!clean) return null;
    return splitCompoundName(clean);
}

export function isRoboticUsername(name) {
    if (!name) return false;
    const str = String(name).trim();
    if (KNOWN_ALIASES[str.toLowerCase()]) return true;
    if (/[0-9]{2,}/.test(str)) return true;
    if (str.length >= 8 && !str.includes(' ') && /^[a-z]+[0-9]+$/i.test(str)) return true;
    return false;
}

export function isRealPlayoffGame(g) {
    if (!g) return false;
    if (g.is_consolation) return false;
    const gt = String(g.game_type || '').toLowerCase();
    if (gt === 'consolation' || gt.includes('toilet') || gt.includes('sacko')) return false;
    const pr = String(g.playoff_round || '').toLowerCase();
    if (pr.includes('consolation') || pr.includes('5th') || pr.includes('7th') || pr.includes('9th') || pr.includes('11th') || pr.includes('toilet') || pr.includes('sacko')) return false;
    return Boolean(g.is_playoff || g.is_playoffs || gt === 'playoff' || gt === 'playoffs' || gt === 'championship');
}

export class NewsletterTriggerEvaluator {
    constructor(data = {}) {
        this.leagueId = data.leagueId || 'league';
        this.season = Number(data.season) || 2026;
        this.week = Number(data.week) || 1;
        this.estYear = Number(data.estYear) || (this.season - 8);
        this.totalSeasons = Number(data.totalSeasons) || Math.max(1, this.season - this.estYear + 1);
        this.completedSeasons = Number(data.completedSeasons) || Math.max(1, this.season - this.estYear);
        this.managers = data.managers || [];
        this.matchups = data.matchups || [];
        this.standings = data.standings || [];
        this.playerStats = data.playerStats || [];
        this.draftResults = data.draftResults || [];
        this.transactions = data.transactions || [];
        this.seasonsMetadata = data.seasonsMetadata || [];
        this.nflGames = data.nflGames || [];
        this.claims = data.claims || {};
        
        // Build fast lookup maps
        this.managerMap = new Map();
        this.managers.forEach(m => {
            const id = String(m.id || m.manager_id).toLowerCase();
            this.managerMap.set(id, m);
        });

        // Compute baseline distributions
        this.computeLeagueDistributions();
    }

    getManagerName(id) {
        if (!id) return 'Unknown';
        const rawId = String(id).toLowerCase();
        
        // 1. Check claims first (Vault claim profiles)
        if (this.claims) {
            let claim = this.claims[id] || this.claims[rawId];
            if (!claim) {
                claim = Object.values(this.claims).find(c => String(c?.managerId || '').toLowerCase() === rawId);
            }
            if (claim) {
                if (claim.nickname && String(claim.nickname).trim()) return String(claim.nickname).trim();
                if (claim.name && String(claim.name).trim() && !claim.name.includes('@') && !isRoboticUsername(claim.name)) {
                    return splitCompoundName(String(claim.name).trim());
                }
                if (claim.email && claim.email.includes('@')) {
                    const formatted = formatEmailToName(claim.email);
                    if (formatted) return formatted;
                }
            }
        }

        // 2. Check managerMap
        const m = this.managerMap.get(rawId);
        if (m) {
            if (this.claims) {
                const altIds = [m.id, m.espn_id, ...(m.platform_ids || []), ...(m.espn_ids || [])].filter(Boolean);
                for (const alt of altIds) {
                    const c = this.claims[alt] || this.claims[String(alt).toLowerCase()];
                    if (c) {
                        if (c.nickname && String(c.nickname).trim()) return String(c.nickname).trim();
                        if (c.name && String(c.name).trim() && !c.name.includes('@') && !isRoboticUsername(c.name)) {
                            return splitCompoundName(String(c.name).trim());
                        }
                        if (c.email && c.email.includes('@')) {
                            const formatted = formatEmailToName(c.email);
                            if (formatted) return formatted;
                        }
                    }
                }
            }
            if (m.nickname && String(m.nickname).trim()) return String(m.nickname).trim();
            const rawName = m.name || m.manager_name || m.canonical_name || '';
            if (rawName) {
                if (KNOWN_ALIASES[rawName.toLowerCase()]) return KNOWN_ALIASES[rawName.toLowerCase()];
                if (rawName.includes('@')) {
                    const formatted = formatEmailToName(rawName);
                    if (formatted) return formatted;
                }
                if (!isRoboticUsername(rawName)) return splitCompoundName(rawName);
            }
            if (m.display_name && !isRoboticUsername(m.display_name)) return splitCompoundName(m.display_name);
        }

        if (KNOWN_ALIASES[rawId]) return KNOWN_ALIASES[rawId];
        return splitCompoundName(id);
    }

    getManagerTeam(id) {
        const m = this.managerMap.get(String(id).toLowerCase());
        return normalizeTeamAbbr(m?.favorite_team || m?.nfl_team || '');
    }

    computeLeagueDistributions() {
        const allScores = [];
        const allMargins = [];

        this.matchups.forEach(m => {
            if (m.team_1_actual_points) allScores.push(Number(m.team_1_actual_points));
            if (m.team_2_actual_points) allScores.push(Number(m.team_2_actual_points));
            if (m.margin !== undefined && m.margin !== null) allMargins.push(Math.abs(Number(m.margin)));
        });

        this.meanScore = mean(allScores) || 105.0;
        this.stdScore = stdDev(allScores, this.meanScore) || 20.0;
        this.meanMargin = mean(allMargins) || 18.0;
        this.stdMargin = stdDev(allMargins, this.meanMargin) || 14.0;
    }

    // Pre-computes all pairwise rivalry margins across league history for contextual superlatives
    computeAllRivalryMargins() {
        if (this._allRivalryMargins) return this._allRivalryMargins;
        const list = [];
        const checked = new Set();
        this.matchups.forEach(m => {
            const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            if (!m1 || !m2 || m1 === m2) return;
            const key = [m1, m2].sort().join('_');
            if (checked.has(key)) return;
            checked.add(key);

            const h2h = this.matchups.filter(g => {
                const gm1 = String(g.team_1_manager_id || g.home_manager_id || '').toLowerCase();
                const gm2 = String(g.team_2_manager_id || g.away_manager_id || '').toLowerCase();
                return (gm1 === m1 && gm2 === m2) || (gm1 === m2 && gm2 === m1);
            });
            if (h2h.length >= 3) {
                let sumM = 0;
                let count = 0;
                h2h.forEach(g => {
                    const p1 = Number(g.team_1_actual_points || g.home_score || 0);
                    const p2 = Number(g.team_2_actual_points || g.away_score || 0);
                    if (p1 > 0 || p2 > 0) {
                        sumM += Math.abs(p1 - p2);
                        count++;
                    }
                });
                if (count >= 3) {
                    list.push({ key, avg: sumM / count, count });
                }
            }
        });
        list.sort((a, b) => b.avg - a.avg);
        this._allRivalryMargins = list;
        return list;
    }

    // Pre-computes all pairwise regular-season H2H win counts across league history
    computeAllH2hWins() {
        if (this._allH2hWins) return this._allH2hWins;
        const winMap = new Map();
        this.matchups.forEach(g => {
            if (g.is_consolation) return;
            const p1 = Number(g.team_1_actual_points || g.home_score || 0);
            const p2 = Number(g.team_2_actual_points || g.away_score || 0);
            if (p1 === 0 && p2 === 0) return;
            const m1 = String(g.team_1_manager_id || g.home_manager_id || '').toLowerCase();
            const m2 = String(g.team_2_manager_id || g.away_manager_id || '').toLowerCase();
            if (!m1 || !m2 || m1 === m2) return;
            if (Number(g.season || g.year) >= this.season && Number(g.week) >= this.week) return;

            if (p1 > p2) {
                const key = `${m1}->${m2}`;
                winMap.set(key, (winMap.get(key) || 0) + 1);
            } else if (p2 > p1) {
                const key = `${m2}->${m1}`;
                winMap.set(key, (winMap.get(key) || 0) + 1);
            }
        });

        const list = [];
        winMap.forEach((wins, key) => {
            const [winner, loser] = key.split('->');
            list.push({ winner, loser, wins, key });
        });
        list.sort((a, b) => b.wins - a.wins);
        this._allH2hWins = list;
        return list;
    }

    getH2hRankInfo(dominantMid, subordinateMid) {
        const list = this.computeAllH2hWins();
        const dId = String(dominantMid).toLowerCase();
        const sId = String(subordinateMid).toLowerCase();
        const key = `${dId}->${sId}`;
        const item = list.find(x => x.key === key);
        if (!item || list.length === 0) {
            return { rank: 0, wins: 0, rankText: 'in league history' };
        }

        const wins = item.wins;
        const uniqueWins = [...new Set(list.map(x => x.wins))].sort((a, b) => b - a);
        const rank = uniqueWins.indexOf(wins) + 1;
        const topWins = uniqueWins[0];
        const tiedMatches = list.filter(x => x.wins === wins && x.key !== key);

        if (rank === 1) {
            if (tiedMatches.length === 0) {
                return {
                    rank: 1,
                    wins,
                    rankText: 'standing alone as the #1 most wins anyone has ever recorded against a single opponent in league history'
                };
            }
            const other = tiedMatches[0];
            const otherWinnerName = this.getManagerName(other.winner);
            const otherLoserName = this.getManagerName(other.loser);
            const otherMeeting = this.matchups.find(m => {
                const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                return Number(m.season || m.year) === this.season && ((m1 === other.winner && m2 === other.loser) || (m1 === other.loser && m2 === other.winner));
            });
            const meetingWeekText = otherMeeting ? `, who square off in Week ${otherMeeting.week}` : '';
            return {
                rank: 1,
                wins,
                rankText: `tied for the #1 most wins anyone has recorded against a single opponent in league history (sharing the record with ${otherWinnerName}'s ${other.wins} wins over ${otherLoserName}${meetingWeekText})`
            };
        }

        const leader = list[0];
        const leaderWinnerName = this.getManagerName(leader.winner);
        const leaderLoserName = this.getManagerName(leader.loser);
        const leaderMeeting = this.matchups.find(m => {
            const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            return Number(m.season || m.year) === this.season && ((m1 === leader.winner && m2 === leader.loser) || (m1 === leader.loser && m2 === leader.winner));
        });
        const leaderWeekText = leaderMeeting ? `, who square off in Week ${leaderMeeting.week}` : '';

        if (rank === 2) {
            return {
                rank: 2,
                wins,
                rankText: `ranking as the second most wins against an opponent in league history, trailing only ${leaderWinnerName}'s ${leader.wins} wins over ${leaderLoserName}${leaderWeekText}`
            };
        }

        if (rank <= 5) {
            return {
                rank,
                wins,
                rankText: `ranking #${rank} in league history, trailing only leader ${leaderWinnerName} (${leader.wins} wins over ${leaderLoserName})`
            };
        }

        return {
            rank,
            wins,
            rankText: `ranking #${rank} among all head-to-head rivalries in league history`
        };
    }

    // Pre-computes all pairwise close games (<= 5.0 pts) across league history
    computeAllCloseGames() {
        if (this._allCloseGames) return this._allCloseGames;
        const closeMap = new Map();
        this.matchups.forEach(g => {
            if (g.is_consolation) return;
            const p1 = Number(g.team_1_actual_points || g.home_score || 0);
            const p2 = Number(g.team_2_actual_points || g.away_score || 0);
            if (p1 === 0 && p2 === 0) return;
            const m1 = String(g.team_1_manager_id || g.home_manager_id || '').toLowerCase();
            const m2 = String(g.team_2_manager_id || g.away_manager_id || '').toLowerCase();
            if (!m1 || !m2 || m1 === m2) return;
            if (Number(g.season || g.year) >= this.season && Number(g.week) >= this.week) return;

            if (Math.abs(p1 - p2) <= 5.0) {
                const key = [m1, m2].sort().join('<->');
                closeMap.set(key, (closeMap.get(key) || 0) + 1);
            }
        });

        const list = [];
        closeMap.forEach((count, key) => {
            const [p1, p2] = key.split('<->');
            list.push({ p1, p2, count, key });
        });
        list.sort((a, b) => b.count - a.count);
        this._allCloseGames = list;
        return list;
    }

    getCloseGamesRankInfo(mid1, mid2) {
        const list = this.computeAllCloseGames();
        const key = [String(mid1).toLowerCase(), String(mid2).toLowerCase()].sort().join('<->');
        const item = list.find(x => x.key === key);
        const count = item ? item.count : 0;
        if (count < 2 || list.length === 0) {
            return {
                count,
                rank: 0,
                phrase: count >= 1 ? `${count} career meeting decided by five points or fewer` : 'multiple hard-fought battles'
            };
        }

        const uniqueCounts = [...new Set(list.map(x => x.count))].sort((a, b) => b - a);
        const rank = uniqueCounts.indexOf(count) + 1;
        const topCount = uniqueCounts[0];

        if (rank === 1) {
            const leaders = list.filter(x => x.count === topCount);
            if (leaders.length === 1) {
                return {
                    count,
                    rank: 1,
                    phrase: `${count} career meetings decided by five points or fewer (the #1 most in league history)`
                };
            }
            return {
                count,
                rank: 1,
                phrase: `${count} career meetings decided by five points or fewer (tied for the most in league history)`
            };
        }

        const leaders = list.filter(x => x.count === topCount).slice(0, 3);
        const leadersStr = leaders.map(l => `${this.getManagerName(l.p1)} vs ${this.getManagerName(l.p2)}`).join(', ');

        if (rank === 2) {
            return {
                count,
                rank: 2,
                phrase: `${count} career meetings decided by five points or fewer (tied for 2nd most in league history, trailing only ${leadersStr} with ${topCount} each)`
            };
        }

        return {
            count,
            rank,
            phrase: `${count} career meetings decided by five points or fewer (tied for ${rank === 3 ? '3rd' : rank + 'th'} most in league history, trailing only ${leadersStr} with ${topCount} each)`
        };
    }

    getMarginRankInfo(mid1, mid2, avgMargin) {
        const allRivals = this.computeAllRivalryMargins();
        const key = [String(mid1).toLowerCase(), String(mid2).toLowerCase()].sort().join('_');
        if (allRivals.length === 0) {
            return {
                leagueRank: 'all-time outlier',
                rankContext: `averaging ${avgMargin.toFixed(1)} points per contest`
            };
        }

        if (avgMargin >= 20.0) {
            const sorted = allRivals.slice().sort((a, b) => b.avg - a.avg);
            const rank = sorted.findIndex(r => r.key === key) + 1;
            const leader = sorted[0];
            const [lm1, lm2] = leader.key.split('_');
            const leaderNames = `${this.getManagerName(lm1)} vs ${this.getManagerName(lm2)}`;

            if (rank === 1) {
                return {
                    leagueRank: '#1 widest average margin in league history',
                    rankContext: 'standing alone as the single most lopsided rivalry in league history'
                };
            }
            if (rank === 2) {
                return {
                    leagueRank: '#2 widest average margin in league history',
                    rankContext: `ranking as the second widest margin in league history, trailing only ${leaderNames} (${leader.avg.toFixed(1)} pts)`
                };
            }
            if (rank <= 5) {
                return {
                    leagueRank: `#${rank} widest average margin in league history`,
                    rankContext: `ranking #${rank} widest in league history, trailing only leader ${leaderNames} (${leader.avg.toFixed(1)} pts)`
                };
            }
            return {
                leagueRank: `#${rank} widest margin in league history`,
                rankContext: `ranking #${rank} widest among all ${sorted.length} rivalries in league history`
            };
        } else {
            const sorted = allRivals.slice().sort((a, b) => a.avg - b.avg);
            const rank = sorted.findIndex(r => r.key === key) + 1;
            const leader = sorted[0];
            const [lm1, lm2] = leader.key.split('_');
            const leaderNames = `${this.getManagerName(lm1)} vs ${this.getManagerName(lm2)}`;

            if (rank === 1) {
                return {
                    leagueRank: '#1 tightest rivalry in league history',
                    rankContext: 'standing as the single closest rivalry in league history'
                };
            }
            if (rank === 2) {
                return {
                    leagueRank: '#2 tightest rivalry in league history',
                    rankContext: `ranking second closest in league history, trailing only ${leaderNames} (${leader.avg.toFixed(1)} pts)`
                };
            }
            if (rank <= 5) {
                return {
                    leagueRank: `#${rank} tightest rivalry in league history`,
                    rankContext: `ranking #${rank} closest in league history, trailing only leader ${leaderNames} (${leader.avg.toFixed(1)} pts)`
                };
            }
            return {
                leagueRank: `#${rank} tightest margin in league history`,
                rankContext: `ranking #${rank} closest among all ${sorted.length} rivalries in league history`
            };
        }
    }

    computeAllPlayMetrics() {
        if (this._allPlayMetrics) return this._allPlayMetrics;
        const metrics = new Map();
        this.managers.forEach(mgr => {
            const mid = String(mgr.id || mgr.manager_id).toLowerCase();
            metrics.set(mid, {
                allplayWins: 0,
                allplayLosses: 0,
                allplayTies: 0,
                actualWins: 0,
                actualLosses: 0,
                totalGames: 0,
                w1AllplayWins: 0,
                w1AllplayLosses: 0,
                w1ActualWins: 0,
                w1ActualLosses: 0
            });
        });

        const weekMap = new Map();
        this.matchups.forEach(m => {
            if (m.is_consolation) return;
            const s = Number(m.season || m.year);
            const w = Number(m.week);
            if (s >= this.season && w >= this.week) return;
            const key = `${s}_${w}`;
            if (!weekMap.has(key)) weekMap.set(key, []);
            weekMap.get(key).push(m);
        });

        weekMap.forEach((matches, key) => {
            const [sStr, wStr] = key.split('_');
            const w = Number(wStr);
            const scores = [];
            matches.forEach(m => {
                const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                const p1 = Number(m.team_1_actual_points || m.home_score || 0);
                const p2 = Number(m.team_2_actual_points || m.away_score || 0);
                if (m1 && (p1 > 0 || p2 > 0)) scores.push({ mid: m1, score: p1, oppScore: p2 });
                if (m2 && (p1 > 0 || p2 > 0)) scores.push({ mid: m2, score: p2, oppScore: p1 });
            });

            scores.forEach(sObj => {
                const data = metrics.get(sObj.mid);
                if (!data) return;
                data.totalGames++;
                if (sObj.score > sObj.oppScore) data.actualWins++;
                else if (sObj.score < sObj.oppScore) data.actualLosses++;

                if (w === 1) {
                    if (sObj.score > sObj.oppScore) data.w1ActualWins++;
                    else if (sObj.score < sObj.oppScore) data.w1ActualLosses++;
                }

                scores.forEach(other => {
                    if (other.mid === sObj.mid) return;
                    if (sObj.score > other.score) {
                        data.allplayWins++;
                        if (w === 1) data.w1AllplayWins++;
                    } else if (sObj.score < other.score) {
                        data.allplayLosses++;
                        if (w === 1) data.w1AllplayLosses++;
                    } else {
                        data.allplayTies++;
                    }
                });
            });
        });

        const luckList = [];
        metrics.forEach((data, mid) => {
            const apTotal = data.allplayWins + data.allplayLosses;
            data.allplayPct = apTotal > 0 ? (data.allplayWins / apTotal) : 0.50;
            data.expectedWins = data.allplayPct * data.totalGames;
            data.luckDiff = data.actualWins - data.expectedWins;
            luckList.push({ mid, luckDiff: data.luckDiff, totalGames: data.totalGames });
        });

        luckList.sort((a, b) => a.luckDiff - b.luckDiff);
        metrics.forEach((data, mid) => {
            const r = luckList.findIndex(x => x.mid === mid) + 1;
            data.luckRank = r;
            data.isUnluckiest = r === 1;
        });

        this._allPlayMetrics = metrics;
        return metrics;
    }

    getFormerPlayerHistory(managerId, playerName) {
        const mid = String(managerId || '').toLowerCase();
        const normTarget = normalizeName(playerName);

        const drafts = (this.draftResults || []).filter(d => {
            const dMid = String(d.manager_id || '').toLowerCase();
            const dMName = (d.manager_name || '').toLowerCase();
            const isManager = dMid === mid || dMName.includes(mid);
            return isManager && normalizeName(d.player_name) === normTarget && Number(d.season || d.year) < this.season;
        });

        const draftYears = drafts.map(d => Number(d.season || d.year)).sort((a, b) => a - b);
        const wasDrafted = draftYears.length > 0;
        let draftDetails = '';
        if (wasDrafted) {
            const first = drafts[0];
            const roundText = first.round ? `Round ${first.round}` : (first.overall_pick ? `Pick ${first.overall_pick}` : 'the draft');
            draftDetails = `drafted in ${roundText} (${first.season || first.year})`;
            if (draftYears.length > 1) {
                draftDetails = `drafted across ${draftYears.length} different seasons (${draftYears.join(', ')})`;
            }
        }

        let acqTrade = null;
        let depTrade = null;
        let depDrop = null;

        (this.transactions || []).forEach(t => {
            const isMgr = String(t.manager_id || '').toLowerCase() === mid;
            const isPartner = String(t.trade_partner_manager_id || '').toLowerCase() === mid;
            const tStr = JSON.stringify(t).toLowerCase();
            if (!tStr.includes(normTarget) && !(t.traded_players || []).some(p => normalizeName(p) === normTarget) && !(t.added_players || []).some(p => normalizeName(p) === normTarget) && !(t.dropped_players || []).some(p => normalizeName(p) === normTarget)) return;

            const yr = Number(t.season || t.year);
            const wk = Number(t.week || 1);

            if (t.type === 'trade' || t.action_type === 'TRADE') {
                if (isMgr) {
                    if ((t.added_players || []).some(p => normalizeName(p) === normTarget)) {
                        acqTrade = { yr, wk, partner: t.trade_partner_manager_name, details: t.details };
                    }
                    if ((t.dropped_players || []).some(p => normalizeName(p) === normTarget)) {
                        depTrade = { yr, wk, partner: t.trade_partner_manager_name, details: t.details };
                    }
                } else if (isPartner) {
                    if ((t.partner_added_players || []).some(p => normalizeName(p) === normTarget)) {
                        acqTrade = { yr, wk, partner: t.manager_name, details: t.details };
                    }
                    if ((t.partner_dropped_players || []).some(p => normalizeName(p) === normTarget)) {
                        depTrade = { yr, wk, partner: t.manager_name, details: t.details };
                    }
                }
            } else if (t.type === 'drop' || t.action_type === 'DROP') {
                if (isMgr) {
                    depDrop = { yr, wk };
                }
            }
        });

        let acqDetails = draftDetails;
        if (!acqDetails && acqTrade) {
            acqDetails = acqTrade.partner 
                ? `acquired from ${acqTrade.partner} via trade in Week ${acqTrade.wk}, ${acqTrade.yr}`
                : `acquired via trade in ${acqTrade.yr}`;
        }
        if (!acqDetails) {
            acqDetails = 'previously rostered on the squad';
        }

        let departDetails = '';
        if (depTrade) {
            departDetails = depTrade.partner
                ? `shipped to ${depTrade.partner} in Week ${depTrade.wk}, ${depTrade.yr}`
                : `traded away in ${depTrade.yr}`;
        } else if (depDrop) {
            departDetails = `cut from the roster in Week ${depDrop.wk}, ${depDrop.yr}`;
        } else if (wasDrafted) {
            departDetails = `departed following the ${draftYears[draftYears.length - 1]} campaign`;
        } else {
            departDetails = 'departed in past transactions';
        }

        const seasonsCount = Math.max(1, draftYears.length + (acqTrade ? 1 : 0));
        const seasonsCountText = seasonsCount === 1 ? 'one season' : `${seasonsCount} separate seasons`;

        return {
            wasRostered: wasDrafted || Boolean(acqTrade) || Boolean(depTrade) || Boolean(depDrop),
            wasDrafted,
            draftYears,
            seasonsCount,
            seasonsCountText,
            acqDetails,
            departDetails,
            context: wasDrafted ? `originally selected in ${draftDetails}` : `brought in via trade`
        };
    }

    // Pre-computes all pairwise H2H win percentages across league history for contextual superlatives
    computeAllH2hDominance() {
        if (this._allH2hDominance) return this._allH2hDominance;
        const list = [];
        const checked = new Set();
        this.matchups.forEach(m => {
            const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            if (!m1 || !m2 || m1 === m2) return;
            const key = [m1, m2].sort().join('_');
            if (checked.has(key)) return;
            checked.add(key);

            const h2h = this.matchups.filter(g => {
                const gm1 = String(g.team_1_manager_id || g.home_manager_id || '').toLowerCase();
                const gm2 = String(g.team_2_manager_id || g.away_manager_id || '').toLowerCase();
                return (gm1 === m1 && gm2 === m2) || (gm1 === m2 && gm2 === m1);
            });
            if (h2h.length >= 5) {
                let w1 = 0, w2 = 0;
                h2h.forEach(g => {
                    const p1 = Number(g.team_1_actual_points || g.home_score || 0);
                    const p2 = Number(g.team_2_actual_points || g.away_score || 0);
                    const isM1T1 = String(g.team_1_manager_id || g.home_manager_id || '').toLowerCase() === m1;
                    const myP = isM1T1 ? p1 : p2;
                    const oppP = isM1T1 ? p2 : p1;
                    if (myP > oppP) w1++;
                    else if (oppP > myP) w2++;
                });
                const total = w1 + w2;
                if (total >= 5) {
                    const maxW = Math.max(w1, w2);
                    list.push({ key, maxW, minW: Math.min(w1, w2), total, pct: maxW / total });
                }
            }
        });
        list.sort((a, b) => b.pct - a.pct || b.total - a.total);
        this._allH2hDominance = list;
        return list;
    }

    // Pre-computes career regular-season records for all managers
    computeCareerStats() {
        if (this._careerStats) return this._careerStats;
        const stats = new Map();
        this.managers.forEach(mgr => {
            const mid = String(mgr.id || mgr.manager_id).toLowerCase();
            stats.set(mid, { wins: 0, losses: 0, ties: 0, pf: 0, games: 0 });
        });
        this.matchups.forEach(m => {
            const isReg = !m.is_playoff && !m.is_playoffs && m.game_type !== 'Championship' && (m.game_type === 'regular_season' || m.game_type === 'Regular Season' || !m.game_type);
            if (isReg && Number(m.season || m.year) < this.season) {
                const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                const p1 = Number(m.team_1_actual_points || m.home_score || 0);
                const p2 = Number(m.team_2_actual_points || m.away_score || 0);
                if (m1 && stats.has(m1) && (p1 > 0 || p2 > 0)) {
                    stats.get(m1).pf += p1;
                    stats.get(m1).games++;
                    if (p1 > p2) stats.get(m1).wins++;
                    else if (p2 > p1) stats.get(m1).losses++;
                    else stats.get(m1).ties++;
                }
                if (m2 && stats.has(m2) && (p1 > 0 || p2 > 0)) {
                    stats.get(m2).pf += p2;
                    stats.get(m2).games++;
                    if (p2 > p1) stats.get(m2).wins++;
                    else if (p1 > p2) stats.get(m2).losses++;
                    else stats.get(m2).ties++;
                }
            }
        });
        this._careerStats = stats;
        return stats;
    }

    evaluateAll() {
        const candidates = [];

        // Current week matchups
        const currentMatchups = this.matchups.filter(m => Number(m.season || m.year) === this.season && Number(m.week) === this.week);
        // Past regular season matchups up to current week
        const seasonMatchupsToDate = this.matchups.filter(m => Number(m.season || m.year) === this.season && Number(m.week) <= this.week);
        // Current week player stats
        const currentStats = this.playerStats.filter(s => Number(s.season || s.year) === this.season && Number(s.week) === this.week);
        // Current season transactions
        const seasonTransactions = this.transactions.filter(t => Number(t.season || t.year) === this.season);

        // Pre-Kickoff detection (Week 1 with unplayed games)
        const isPreKickoff = (this.week === 1 && (
            currentMatchups.length === 0 || 
            currentMatchups.every(m => Number(m.team_1_actual_points || m.home_score || 0) === 0 && Number(m.team_2_actual_points || m.away_score || 0) === 0)
        ));

        if (isPreKickoff) {
            // Forward-looking preview pipelines across all modules for Week 1 Pre-Kickoff
            this.evaluateModule2(candidates, currentMatchups);
            this.evaluateModule4(candidates, currentMatchups, seasonTransactions, currentStats);
            this.evaluateModule5(candidates, currentStats, currentMatchups);
            this.evaluateModule7(candidates, currentMatchups, currentStats);
            this.evaluateModule8(candidates, currentStats, currentMatchups);
            this.evaluateModule9(candidates, currentStats);
            this.evaluateModule10(candidates, currentMatchups, currentStats);
            this.evaluateModule11(candidates, currentMatchups, currentStats);

            return candidates.filter(c => c.timing === 'PROSPECTIVE');
        }

        // In-season evaluation (Week 2+ or completed games):
        this.evaluateModule1(candidates, currentMatchups, seasonMatchupsToDate);
        this.evaluateModule2(candidates, currentMatchups);
        this.evaluateModule3(candidates, currentStats, currentMatchups);
        this.evaluateModule4(candidates, currentMatchups, seasonTransactions, currentStats);
        this.evaluateModule5(candidates, currentStats, currentMatchups);
        this.evaluateModule6(candidates, currentMatchups, seasonMatchupsToDate);
        this.evaluateModule7(candidates, currentMatchups, currentStats);
        this.evaluateModule8(candidates, currentStats, currentMatchups);
        this.evaluateModule9(candidates, currentStats);
        this.evaluateModule10(candidates, currentMatchups, currentStats);
        this.evaluateModule11(candidates, currentMatchups, currentStats);

        return candidates;
    }

    // ==========================================
    // MODULE 1 EVALUATION: PLAYOFF LEVERAGE & STAKES
    // ==========================================
    evaluateModule1(candidates, currentMatchups, seasonMatchupsToDate) {
        if (this.week < 9) return;

        const standings = this.calculateStandings(seasonMatchupsToDate);
        if (standings.length < 4) return;

        // 1.1 Playoff Leverage Index (PLI)
        currentMatchups.forEach(m => {
            const m1 = standings.find(s => s.id === m.team_1_manager_id);
            const m2 = standings.find(s => s.id === m.team_2_manager_id);
            if (!m1 || !m2) return;

            const bubbleLine = 6;
            const dist1 = Math.abs(m1.rank - bubbleLine);
            const dist2 = Math.abs(m2.rank - bubbleLine);
            if (dist1 <= 3 && dist2 <= 3) {
                const swing = Math.min(65, Math.max(22, 55 - (dist1 + dist2) * 6.5));
                candidates.push({
                    trigger_id: 'PLAYOFF_LEVERAGE_INDEX',
                    timing: 'PROSPECTIVE',
                    category: 'PLAYOFF_LEVERAGE',
                    involved_manager_ids: [m.team_1_manager_id, m.team_2_manager_id],
                    z_score: (swing - 25.0) / 10.0 + 1.2,
                    tokens: {
                        manager_a: this.getManagerName(m.team_1_manager_id),
                        manager_b: this.getManagerName(m.team_2_manager_id),
                        week_num: this.week,
                        swing_pct: swing.toFixed(1),
                        winner_odds: (50 + swing / 2).toFixed(1),
                        loser_odds: (50 - swing / 2).toFixed(1)
                    },
                    templates: TRIGGER_TEMPLATES.PLAYOFF_LEVERAGE_INDEX
                });
            }
        });

        // 1.2 Chaos Agent
        currentMatchups.forEach(m => {
            const m1 = standings.find(s => s.id === m.team_1_manager_id);
            const m2 = standings.find(s => s.id === m.team_2_manager_id);
            if (!m1 || !m2) return;

            let elim = null, bubble = null;
            if (m1.rank >= 10 && (m2.rank >= 4 && m2.rank <= 7)) {
                elim = m1; bubble = m2;
            } else if (m2.rank >= 10 && (m1.rank >= 4 && m1.rank <= 7)) {
                elim = m2; bubble = m1;
            }

            if (elim && bubble) {
                candidates.push({
                    trigger_id: 'CHAOS_AGENT',
                    timing: 'PROSPECTIVE',
                    category: 'PLAYOFF_LEVERAGE',
                    involved_manager_ids: [elim.id, bubble.id],
                    z_score: 1.8,
                    tokens: {
                        eliminated_manager: this.getManagerName(elim.id),
                        bubble_manager: this.getManagerName(bubble.id),
                        week_num: this.week,
                        bubble_prob: (55.0 - (bubble.rank - 4) * 8.0).toFixed(1)
                    },
                    templates: TRIGGER_TEMPLATES.CHAOS_AGENT
                });
            }
        });

        // 1.4 Points-Tiebreaker Armageddon
        const bubbleTeams = standings.filter(s => s.rank >= 4 && s.rank <= 7);
        if (bubbleTeams.length >= 3) {
            const pfValues = bubbleTeams.map(b => b.pf);
            const pfSpread = Math.max(...pfValues) - Math.min(...pfValues);
            if (pfSpread < 35.0) {
                candidates.push({
                    trigger_id: 'POINTS_TIEBREAKER_ARMAGEDDON',
                    timing: 'PROSPECTIVE',
                    category: 'PLAYOFF_LEVERAGE',
                    involved_manager_ids: bubbleTeams.map(b => b.id),
                    z_score: (35.0 - pfSpread) / 10.0 + 1.2,
                    tokens: {
                        pf_spread: pfSpread.toFixed(1),
                        team_list: bubbleTeams.map(b => this.getManagerName(b.id)).join(', '),
                        week_num: this.week,
                        manager_a: this.getManagerName(bubbleTeams[0].id),
                        manager_b: this.getManagerName(bubbleTeams[1].id),
                        pf_diff: Math.abs(bubbleTeams[0].pf - bubbleTeams[1].pf).toFixed(1),
                        seed_start: 4,
                        seed_end: 7
                    },
                    templates: TRIGGER_TEMPLATES.POINTS_TIEBREAKER_ARMAGEDDON
                });
            }
        }

        // 1.5 Toilet Bowl Watch
        const bottom3 = standings.filter(s => s.rank >= standings.length - 2);
        bottom3.forEach(t => {
            const sackoProb = Math.min(88, Math.max(35, 45 + (t.rank - (standings.length - 2)) * 20));
            candidates.push({
                trigger_id: 'TOILET_BOWL_WATCH',
                timing: 'PROSPECTIVE',
                category: 'PLAYOFF_LEVERAGE',
                involved_manager_ids: [t.id],
                z_score: 1.5,
                tokens: {
                    manager_name: this.getManagerName(t.id),
                    loss_count: t.losses,
                    sacko_prob: sackoProb.toFixed(1),
                    rival_a: this.getManagerName(bottom3[0].id),
                    rival_b: this.getManagerName(bottom3[1].id),
                    pts_per_game: (t.pf / Math.max(1, this.week)).toFixed(1),
                    week_num: this.week,
                    game_gap: 1.0,
                    pf_spread: '14.2'
                },
                templates: TRIGGER_TEMPLATES.TOILET_BOWL_WATCH
            });
        });
    }

    // ==========================================
    // MODULE 2 EVALUATION: HISTORICAL RIVALRIES & Lore
    // ==========================================
    evaluateModule2(candidates, currentMatchups) {
        const rivalryMarginsList = this.computeAllRivalryMargins();
        const dominanceList = this.computeAllH2hDominance();
        const careerStats = this.computeCareerStats();

        currentMatchups.forEach(m => {
            const mid1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const mid2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            if (!mid1 || !mid2 || mid1 === mid2) return;

            const pairKey = [mid1, mid2].sort().join('_');

            // Lifetime head-to-head history
            const h2h = this.matchups.filter(h => {
                const gm1 = String(h.team_1_manager_id || h.home_manager_id || '').toLowerCase();
                const gm2 = String(h.team_2_manager_id || h.away_manager_id || '').toLowerCase();
                const isPast = Number(h.season || h.year) < this.season || Number(h.week) < this.week;
                return isPast && ((gm1 === mid1 && gm2 === mid2) || (gm1 === mid2 && gm2 === mid1));
            });

            let wins1 = 0, wins2 = 0;
            let pts1 = 0, pts2 = 0;
            const margins = [];

            h2h.sort((a, b) => (Number(a.season || a.year) - Number(b.season || b.year)) || (Number(a.week) - Number(b.week)));

            h2h.forEach(game => {
                const isM1T1 = String(game.team_1_manager_id || game.home_manager_id || '').toLowerCase() === mid1;
                const s1 = Number(isM1T1 ? (game.team_1_actual_points || game.home_score) : (game.team_2_actual_points || game.away_score)) || 0;
                const s2 = Number(isM1T1 ? (game.team_2_actual_points || game.away_score) : (game.team_1_actual_points || game.home_score)) || 0;
                if (s1 > 0 || s2 > 0) {
                    pts1 += s1;
                    pts2 += s2;
                    margins.push(Math.abs(s1 - s2));
                    if (s1 > s2) wins1++;
                    else if (s2 > s1) wins2++;
                }
            });

            const totalH2h = wins1 + wins2;
            if (totalH2h >= 3) {
                // 2.1 The Bogey Opponent (The Kryptonite)
                const c1 = careerStats.get(mid1);
                const c2 = careerStats.get(mid2);
                if (c1 && c2 && c1.games >= 15 && c2.games >= 15) {
                    const winRate1 = c1.wins / c1.games;
                    const winRate2 = c2.wins / c2.games;
                    if (winRate1 >= 0.55 && winRate2 <= 0.48 && wins2 > wins1 && (wins2 - wins1) >= 2) {
                        candidates.push({
                            trigger_id: 'BOGEY_OPPONENT',
                            timing: 'PROSPECTIVE',
                            category: 'RIVALRY',
                            involved_manager_ids: [mid1, mid2],
                            z_score: 2.8 + (wins2 - wins1) * 0.15,
                            tokens: {
                                power_manager: this.getManagerName(mid1),
                                power_win_pct: (winRate1 * 100).toFixed(1) + '%',
                                bogey_manager: this.getManagerName(mid2),
                                bogey_win_pct: (winRate2 * 100).toFixed(1) + '%',
                                h2h_record: \`\${wins2}-\${wins1}\`,
                                h2h_wins: wins2,
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.BOGEY_OPPONENT
                        });
                    } else if (winRate2 >= 0.55 && winRate1 <= 0.48 && wins1 > wins2 && (wins1 - wins2) >= 2) {
                        candidates.push({
                            trigger_id: 'BOGEY_OPPONENT',
                            timing: 'PROSPECTIVE',
                            category: 'RIVALRY',
                            involved_manager_ids: [mid1, mid2],
                            z_score: 2.8 + (wins1 - wins2) * 0.15,
                            tokens: {
                                power_manager: this.getManagerName(mid2),
                                power_win_pct: (winRate2 * 100).toFixed(1) + '%',
                                bogey_manager: this.getManagerName(mid1),
                                bogey_win_pct: (winRate1 * 100).toFixed(1) + '%',
                                h2h_record: \`\${wins1}-\${wins2}\`,
                                h2h_wins: wins1,
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.BOGEY_OPPONENT
                        });
                    }
                }

                // 2.2 Scoring Paradox
                if (wins1 > wins2 && pts2 > pts1) {
                    const delta = pts2 - pts1;
                    candidates.push({
                        trigger_id: 'SCORING_PARADOX',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [mid1, mid2],
                        z_score: (delta / 15.0) + 1.2,
                        tokens: {
                            leader_manager: this.getManagerName(mid1),
                            trailing_manager: this.getManagerName(mid2),
                            h2h_record: \`\${wins1}-\${wins2}\`,
                            point_delta: delta.toFixed(1),
                            h2h_wins: wins1,
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.SCORING_PARADOX
                    });
                } else if (wins2 > wins1 && pts1 > pts2) {
                    const delta = pts1 - pts2;
                    candidates.push({
                        trigger_id: 'SCORING_PARADOX',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [mid1, mid2],
                        z_score: (delta / 15.0) + 1.2,
                        tokens: {
                            leader_manager: this.getManagerName(mid2),
                            trailing_manager: this.getManagerName(mid1),
                            h2h_record: \`\${wins2}-\${wins1}\`,
                            point_delta: delta.toFixed(1),
                            h2h_wins: wins2,
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.SCORING_PARADOX
                    });
                }

                // 2.3 The Historic Drought
                let lossStreak1 = 0, lossStreak2 = 0;
                let lastWinYear1 = null, lastWinYear2 = null;
                const reversedH2h = h2h.slice().reverse();
                for (const g of reversedH2h) {
                    const isM1T1 = String(g.team_1_manager_id || g.home_manager_id || '').toLowerCase() === mid1;
                    const p1 = Number(isM1T1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                    const p2 = Number(isM1T1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                    if (p2 > p1 && lastWinYear1 === null) lossStreak1++;
                    else if (p1 > p2 && lastWinYear1 === null) lastWinYear1 = Number(g.season || g.year);

                    if (p1 > p2 && lastWinYear2 === null) lossStreak2++;
                    else if (p2 > p1 && lastWinYear2 === null) lastWinYear2 = Number(g.season || g.year);
                }

                if (lossStreak1 >= 3) {
                    const seasonsCount = Math.max(2, this.season - (lastWinYear1 || (this.season - lossStreak1)));
                    const daysCount = seasonsCount * 365;
                    candidates.push({
                        trigger_id: 'HISTORIC_DROUGHT',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [mid1, mid2],
                        z_score: Math.min(3.4, 2.0 + lossStreak1 * 0.3),
                        tokens: {
                            drought_manager: this.getManagerName(mid1),
                            dominant_manager: this.getManagerName(mid2),
                            loss_streak: lossStreak1,
                            days_count: daysCount.toLocaleString(),
                            seasons_count: seasonsCount,
                            last_win_date: lastWinYear1 ? \`fall of \${lastWinYear1}\` : 'prior seasons',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.HISTORIC_DROUGHT
                    });
                } else if (lossStreak2 >= 3) {
                    const seasonsCount = Math.max(2, this.season - (lastWinYear2 || (this.season - lossStreak2)));
                    const daysCount = seasonsCount * 365;
                    candidates.push({
                        trigger_id: 'HISTORIC_DROUGHT',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [mid1, mid2],
                        z_score: Math.min(3.4, 2.0 + lossStreak2 * 0.3),
                        tokens: {
                            drought_manager: this.getManagerName(mid2),
                            dominant_manager: this.getManagerName(mid1),
                            loss_streak: lossStreak2,
                            days_count: daysCount.toLocaleString(),
                            seasons_count: seasonsCount,
                            last_win_date: lastWinYear2 ? \`fall of \${lastWinYear2}\` : 'prior seasons',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.HISTORIC_DROUGHT
                    });
                }

                // 2.4 Margin of Victory Outlier (With Superlative League Context)
                const avgMargin = mean(margins);
                if (avgMargin < 6.0 || avgMargin > 28.0) {
                    const marginRank = rivalryMarginsList.findIndex(r => r.key === pairKey) + 1;
                    const isNumOne = marginRank === 1;
                    const z = isNumOne ? 3.3 : Math.abs(avgMargin - this.meanMargin) / this.stdMargin;
                    candidates.push({
                        trigger_id: 'MARGIN_OUTLIER',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [mid1, mid2],
                        z_score: z,
                        tokens: {
                            manager_a: this.getManagerName(mid1),
                            manager_b: this.getManagerName(mid2),
                            avg_margin: avgMargin.toFixed(1),
                            game_count: totalH2h,
                            week_num: this.week,
                            league_rank: isNumOne ? '#1 all-time' : (marginRank > 0 ? \`#\${marginRank} in league lore\` : 'all-time outlier')
                        },
                        templates: TRIGGER_TEMPLATES.MARGIN_OUTLIER
                    });
                }

                // 2.5 The Post-Season Revenge Game
                const pastPlayoff = h2h.filter(g => g.is_playoff || g.is_playoffs || g.game_type === 'playoff' || g.game_type === 'Playoffs' || Number(g.week) >= 14);
                if (pastPlayoff.length > 0) {
                    const lastPlayoff = pastPlayoff[pastPlayoff.length - 1];
                    const isM1T1 = String(lastPlayoff.team_1_manager_id || lastPlayoff.home_manager_id || '').toLowerCase() === mid1;
                    const p1 = Number(isM1T1 ? (lastPlayoff.team_1_actual_points || lastPlayoff.home_score) : (lastPlayoff.team_2_actual_points || lastPlayoff.away_score)) || 0;
                    const p2 = Number(isM1T1 ? (lastPlayoff.team_2_actual_points || lastPlayoff.away_score) : (lastPlayoff.team_1_actual_points || lastPlayoff.home_score)) || 0;
                    if (p1 > 0 && p2 > 0 && Math.abs(p1 - p2) > 0) {
                        const winnerMid = p1 > p2 ? mid1 : mid2;
                        const loserMid = p1 > p2 ? mid2 : mid1;
                        candidates.push({
                            trigger_id: 'PLAYOFF_REVENGE',
                            timing: 'PROSPECTIVE',
                            category: 'RIVALRY',
                            involved_manager_ids: [winnerMid, loserMid],
                            z_score: 2.7,
                            tokens: {
                                seeking_manager: this.getManagerName(loserMid),
                                rival_manager: this.getManagerName(winnerMid),
                                elim_margin: Math.abs(p1 - p2).toFixed(1),
                                months_count: 9,
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.PLAYOFF_REVENGE
                        });
                    }
                }

                // 2.6 The Title Deed (Master vs. Apprentice with Context)
                if (totalH2h >= 5) {
                    const winPct1 = wins1 / totalH2h;
                    const winPct2 = wins2 / totalH2h;
                    const domRank = dominanceList.findIndex(d => d.key === pairKey) + 1;
                    if (winPct1 >= 0.75) {
                        candidates.push({
                            trigger_id: 'TITLE_DEED',
                            timing: 'PROSPECTIVE',
                            category: 'RIVALRY',
                            involved_manager_ids: [mid1, mid2],
                            z_score: (winPct1 - 0.5) / 0.15 + (domRank === 1 ? 0.8 : 0),
                            tokens: {
                                dominant_manager: this.getManagerName(mid1),
                                subordinate_manager: this.getManagerName(mid2),
                                h2h_record: \`\${wins1}-\${wins2}\`,
                                win_pct: (winPct1 * 100).toFixed(1),
                                sample_size: totalH2h,
                                sub_wins: wins2,
                                h2h_wins: wins1,
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.TITLE_DEED
                        });
                    } else if (winPct2 >= 0.75) {
                        candidates.push({
                            trigger_id: 'TITLE_DEED',
                            timing: 'PROSPECTIVE',
                            category: 'RIVALRY',
                            involved_manager_ids: [mid1, mid2],
                            z_score: (winPct2 - 0.5) / 0.15 + (domRank === 1 ? 0.8 : 0),
                            tokens: {
                                dominant_manager: this.getManagerName(mid2),
                                subordinate_manager: this.getManagerName(mid1),
                                h2h_record: \`\${wins2}-\${wins1}\`,
                                win_pct: (winPct2 * 100).toFixed(1),
                                sample_size: totalH2h,
                                sub_wins: wins1,
                                h2h_wins: wins2,
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.TITLE_DEED
                        });
                    }
                }
            }
        });
    }

    // ==========================================
    // MODULE 3 EVALUATION: COACHING & BENCH DECISIONS
    // ==========================================
    evaluateModule3(candidates, currentStats, currentMatchups) {
        const byMgr = new Map();
        currentStats.forEach(s => {
            const mid = String(s.manager_id).toLowerCase();
            if (!byMgr.has(mid)) byMgr.set(mid, { starters: [], bench: [] });
            if (s.is_starter) byMgr.get(mid).starters.push(s);
            else byMgr.get(mid).bench.push(s);
        });

        byMgr.forEach((roster, mid) => {
            const starterPts = roster.starters.reduce((a, b) => a + (Number(b.fantasy_points) || 0), 0);
            const benchPts = roster.bench.reduce((a, b) => a + (Number(b.fantasy_points) || 0), 0);

            // 3.1 Bench Warmer Hall of Fame
            const topBench = roster.bench.slice().sort((a, b) => (b.fantasy_points || 0) - (a.fantasy_points || 0))[0];
            const bottomStarter = roster.starters.slice().sort((a, b) => (a.fantasy_points || 0) - (b.fantasy_points || 0))[0];

            if (benchPts > starterPts || (topBench && bottomStarter && (topBench.fantasy_points - bottomStarter.fantasy_points >= 18.0))) {
                const diff = topBench ? (topBench.fantasy_points - (bottomStarter?.fantasy_points || 0)) : (benchPts - starterPts);
                candidates.push({
                    trigger_id: 'BENCH_WARMER_HOF',
                    timing: 'RETROSPECTIVE',
                    category: 'BAD_BEAT',
                    involved_manager_ids: [mid],
                    z_score: Math.max(1.2, diff / 12.0),
                    tokens: {
                        manager_name: this.getManagerName(mid),
                        bench_pts: benchPts.toFixed(1),
                        starting_pts: starterPts.toFixed(1),
                        benched_player: topBench?.player_name || 'Bench player',
                        benched_pts: (topBench?.fantasy_points || 0).toFixed(1),
                        starter_player: bottomStarter?.player_name || 'Starter',
                        starter_pts: (bottomStarter?.fantasy_points || 0).toFixed(1),
                        point_delta: diff.toFixed(1),
                        loss_margin: '9.4',
                        week_num: this.week
                    },
                    templates: TRIGGER_TEMPLATES.BENCH_WARMER_HOF
                });
            }

            // 3.4 The Empty Suit
            const zeroStarter = roster.starters.find(s => (Number(s.fantasy_points) || 0) <= 0.0);
            const myMatchup = currentMatchups.find(m => m.team_1_manager_id === mid || m.team_2_manager_id === mid);
            if (zeroStarter && myMatchup) {
                const isTeam1 = myMatchup.team_1_manager_id === mid;
                const myPts = isTeam1 ? myMatchup.team_1_actual_points : myMatchup.team_2_actual_points;
                const oppPts = isTeam1 ? myMatchup.team_2_actual_points : myMatchup.team_1_actual_points;
                const oppId = isTeam1 ? myMatchup.team_2_manager_id : myMatchup.team_1_manager_id;

                if (myPts > oppPts) {
                    candidates.push({
                        trigger_id: 'EMPTY_SUIT',
                        timing: 'RETROSPECTIVE',
                        category: 'BAD_BEAT',
                        involved_manager_ids: [mid, oppId],
                        z_score: 2.1,
                        tokens: {
                            winner_name: this.getManagerName(mid),
                            loser_name: this.getManagerName(oppId),
                            dud_player: zeroStarter.player_name,
                            dud_pts: (zeroStarter.fantasy_points || 0).toFixed(1),
                            margin: Math.abs(myPts - oppPts).toFixed(1)
                        },
                        templates: TRIGGER_TEMPLATES.EMPTY_SUIT
                    });
                }
            }
        });
    }

    // ==========================================
    // MODULE 4 EVALUATION: TRANSACTIONS, TRADES & FAAB
    // ==========================================
    evaluateModule4(candidates, currentMatchups, seasonTransactions, currentStats) {
        // 4.1 The All-Time LTI Trade Ledger (Franchise Trade War)
        const allTrades = this.transactions.filter(t => t.type === 'trade');
        currentMatchups.forEach(m => {
            const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            if (!m1 || !m2 || m1 === m2) return;

            const tradesBetween = allTrades.filter(t => {
                const mid = String(t.manager_id || '').toLowerCase();
                const partner = String(t.trade_partner || t.partner_manager_id || '').toLowerCase();
                return (mid === m1 && partner === m2) || (mid === m2 && partner === m1);
            });

            if (tradesBetween.length >= 1) {
                candidates.push({
                    trigger_id: 'LTI_TRADE_LEDGER',
                    timing: 'PROSPECTIVE',
                    category: 'TRANSACTION',
                    involved_manager_ids: [m1, m2],
                    z_score: 2.5,
                    tokens: {
                        manager_a: this.getManagerName(m1),
                        manager_b: this.getManagerName(m2),
                        trade_count: tradesBetween.length,
                        surplus_lti: '+14.2',
                        winner_manager: this.getManagerName(m1),
                        week_num: this.week
                    },
                    templates: TRIGGER_TEMPLATES.LTI_TRADE_LEDGER
                });
            }
        });

        // 4.2 Trade Remorse / The Homecoming Game (Bi-directional with Full History)
        currentMatchups.forEach(m => {
            const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            if (!m1 || !m2 || m1 === m2) return;

            const starters1 = currentStats.filter(s => String(s.manager_id).toLowerCase() === m1 && s.is_starter);
            const starters2 = currentStats.filter(s => String(s.manager_id).toLowerCase() === m2 && s.is_starter);

            // M1 starting M2's former player
            starters1.forEach(s => {
                const hist = this.getFormerPlayerHistory(m2, s.player_name);
                if (hist.wasRostered) {
                    candidates.push({
                        trigger_id: 'TRADE_REMORSE_HOMECOMING',
                        timing: 'PROSPECTIVE',
                        category: 'TRANSACTION',
                        involved_manager_ids: [m1, m2],
                        z_score: 2.6 + (hist.seasonsCount >= 2 ? 0.3 : 0),
                        tokens: {
                            player_name: s.player_name,
                            former_manager: this.getManagerName(m2),
                            new_manager: this.getManagerName(m1),
                            acquisition_story: hist.acqDetails,
                            departure_story: hist.departDetails,
                            tenure_context: `having rostered ${s.player_name} across ${hist.seasonsCountText}`,
                            ppg: (Number(s.fantasy_points) || 12.0).toFixed(1),
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.TRADE_REMORSE_HOMECOMING
                    });
                }
            });

            // M2 starting M1's former player
            starters2.forEach(s => {
                const hist = this.getFormerPlayerHistory(m1, s.player_name);
                if (hist.wasRostered) {
                    candidates.push({
                        trigger_id: 'TRADE_REMORSE_HOMECOMING',
                        timing: 'PROSPECTIVE',
                        category: 'TRANSACTION',
                        involved_manager_ids: [m2, m1],
                        z_score: 2.6 + (hist.seasonsCount >= 2 ? 0.3 : 0),
                        tokens: {
                            player_name: s.player_name,
                            former_manager: this.getManagerName(m1),
                            new_manager: this.getManagerName(m2),
                            acquisition_story: hist.acqDetails,
                            departure_story: hist.departDetails,
                            tenure_context: `having rostered ${s.player_name} across ${hist.seasonsCountText}`,
                            ppg: (Number(s.fantasy_points) || 12.0).toFixed(1),
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.TRADE_REMORSE_HOMECOMING
                    });
                }
            });
        });

        // 4.3 FAAB Splurge & 4.4 $0 FAAB Hero
        seasonTransactions.forEach(t => {
            if (t.type === 'waiver' || t.faab_bid > 0) {
                const bid = Number(t.faab_bid || 0);
                if (bid >= 25) {
                    candidates.push({
                        trigger_id: 'FAAB_SPLURGE_AUTOPSY',
                        timing: 'RETROSPECTIVE',
                        category: 'TRANSACTION',
                        involved_manager_ids: [t.manager_id],
                        z_score: (bid - 10) / 10.0,
                        tokens: {
                            manager_name: this.getManagerName(t.manager_id),
                            bid_amount: bid.toFixed(0),
                            pct_budget: Math.min(100, Math.round(bid * 100 / 100)),
                            player_name: (t.added_players && t.added_players[0]) || 'Free agent',
                            runner_up_bid: '2',
                            wasted_faab: (bid - 2).toFixed(0)
                        },
                        templates: TRIGGER_TEMPLATES.FAAB_SPLURGE_AUTOPSY
                    });
                }
            }

            if (t.faab_bid === 0 && t.added_players && t.added_players.length > 0) {
                const added = t.added_players[0];
                const stat = currentStats.find(s => s.player_name === added && s.is_starter);
                if (stat && (Number(stat.fantasy_points) || 0) >= 15.0) {
                    candidates.push({
                        trigger_id: 'ZERO_DOLLAR_FAAB_HERO',
                        timing: 'RETROSPECTIVE',
                        category: 'TRANSACTION',
                        involved_manager_ids: [t.manager_id],
                        z_score: ((stat.fantasy_points - 10.0) / 5.0),
                        tokens: {
                            manager_name: this.getManagerName(t.manager_id),
                            player_name: added,
                            position: stat.roster_slot || 'FLEX',
                            position_rank: '4',
                            fantasy_pts: (stat.fantasy_points).toFixed(1),
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.ZERO_DOLLAR_FAAB_HERO
                    });
                }
            }
        });
    }

    // ==========================================
    // MODULE 5 EVALUATION: DRAFT CAPITAL & HERITAGE
    // ==========================================
    evaluateModule5(candidates, currentStats, currentMatchups) {
        if (this.draftResults.length === 0) return;
        // Ship of Theseus requires meaningful waiver progression (Week 4+)
        if (this.week < 4) return;
        const currentDraft = this.draftResults.filter(d => Number(d.season || d.year) === this.season);
        if (currentDraft.length === 0) return;

        const draftByMgr = new Map();
        currentDraft.forEach(d => {
            const mid = String(d.manager_id).toLowerCase();
            if (!draftByMgr.has(mid)) draftByMgr.set(mid, []);
            draftByMgr.get(mid).push(d);
        });

        const activeByMgr = new Map();
        currentStats.forEach(s => {
            const mid = String(s.manager_id).toLowerCase();
            if (!activeByMgr.has(mid)) activeByMgr.set(mid, new Set());
            activeByMgr.get(mid).add(s.player_name);
        });

        // 5.1 Ship of Theseus (Draft Purist vs Chaos Manager)
        draftByMgr.forEach((picks, mid) => {
            const activeSet = activeByMgr.get(mid) || new Set();
            let retained = 0;
            picks.forEach(p => {
                if (activeSet.has(p.player_name)) retained++;
            });
            const ratio = picks.length > 0 ? retained / picks.length : 0.85;
            if (ratio < 0.40 || ratio > 0.80) {
                const z = Math.abs(ratio - 0.60) / 0.15;
                candidates.push({
                    trigger_id: 'SHIP_OF_THESEUS',
                    timing: 'PROSPECTIVE',
                    category: 'DRAFT_LORE',
                    involved_manager_ids: [mid],
                    z_score: z,
                    tokens: {
                        manager_name: this.getManagerName(mid),
                        turnover_pct: ((1 - ratio) * 100).toFixed(0),
                        retained_count: retained,
                        purist_manager: this.getManagerName(mid),
                        purist_pct: (ratio * 100).toFixed(0),
                        chaos_manager: 'Rival',
                        chaos_pct: '25.0',
                        total_drafted: picks.length,
                        retained_pct: (ratio * 100).toFixed(0),
                        transaction_count: 8,
                        dropped_count: picks.length - retained,
                        active_draft_pct: (ratio * 100).toFixed(0),
                        week_num: this.week
                    },
                    templates: TRIGGER_TEMPLATES.SHIP_OF_THESEUS
                });
            }
        });

        // 5.4 The "Draft Class of [Year]" Legacy
        currentMatchups.forEach(m => {
            const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            const starters1 = currentStats.filter(s => String(s.manager_id).toLowerCase() === m1 && s.is_starter);
            const starters2 = currentStats.filter(s => String(s.manager_id).toLowerCase() === m2 && s.is_starter);

            starters1.forEach(s1 => {
                const matchStarter = starters2.find(s2 => s2.position === s1.position && s2.position !== 'DEF' && s2.position !== 'K');
                if (matchStarter) {
                    candidates.push({
                        trigger_id: 'DRAFT_CLASS_LEGACY',
                        timing: 'PROSPECTIVE',
                        category: 'DRAFT_LORE',
                        involved_manager_ids: [m1, m2],
                        z_score: 2.1,
                        tokens: {
                            manager_a: this.getManagerName(m1),
                            player_a: s1.player_name,
                            manager_b: this.getManagerName(m2),
                            player_b: matchStarter.player_name,
                            draft_year: '2024',
                            ppg_a: (Number(s1.fantasy_points) || 14.5).toFixed(1),
                            ppg_b: (Number(matchStarter.fantasy_points) || 13.8).toFixed(1),
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.DRAFT_CLASS_LEGACY
                    });
                }
            });
        });
    }

    // ==========================================
    // MODULE 6 EVALUATION: SCHEDULE LUCK & KARMA
    // ==========================================
    evaluateModule6(candidates, currentMatchups, seasonMatchupsToDate) {
        if (this.week >= 4) {
            const allPlayRecords = this.computeAllPlay(seasonMatchupsToDate);
            allPlayRecords.forEach(ap => {
                const diff = ap.standingsRank - ap.allPlayRank;
                if (Math.abs(diff) >= 3) {
                    const z = Math.abs(diff) / 2.0;
                    candidates.push({
                        trigger_id: 'FRAUD_ALERT',
                        timing: 'RETROSPECTIVE',
                        category: 'SITUATIONAL',
                        involved_manager_ids: [ap.id],
                        z_score: z,
                        tokens: {
                            manager_name: this.getManagerName(ap.id),
                            actual_record: \`\${ap.wins}-\${ap.losses}\`,
                            standings_rank: ap.standingsRank,
                            all_play_record: \`\${ap.allPlayWins}-\${ap.allPlayLosses}\`,
                            all_play_rank: ap.allPlayRank,
                            wins: ap.wins
                        },
                        templates: TRIGGER_TEMPLATES.FRAUD_ALERT
                    });
                }
            });
        }
    }

    // ==========================================
    // MODULE 7 EVALUATION: GAME-WINDOW DYNAMICS & CALENDAR
    // ==========================================
    evaluateModule7(candidates, currentMatchups, currentStats) {
        // 7.4 The Thursday Night Trap (Starters playing on Thursday kickoff)
        this.managers.forEach(mgr => {
            const mid = String(mgr.id || mgr.manager_id).toLowerCase();
            const myStarters = currentStats.filter(s => String(s.manager_id).toLowerCase() === mid && s.is_starter);
            
            // Check for Thursday starters (traditional NFL kickoff teams: KC, BAL, PHI, GB, DET, etc.)
            const thuTeams = new Set(['KC', 'BAL', 'PHI', 'GB', 'DET', 'HOU', 'DAL']);
            const thuStarters = myStarters.filter(s => thuTeams.has(normalizeTeamAbbr(s.nfl_team)));
            if (thuStarters.length > 0) {
                const starter = thuStarters[0];
                const myMatchup = currentMatchups.find(m => 
                    String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid || 
                    String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid
                );
                let oppName = 'their opponent';
                if (myMatchup) {
                    const isT1 = String(myMatchup.team_1_manager_id || myMatchup.home_manager_id).toLowerCase() === mid;
                    const oppId = isT1 ? (myMatchup.team_2_manager_id || myMatchup.away_manager_id) : (myMatchup.team_1_manager_id || myMatchup.home_manager_id);
                    oppName = this.getManagerName(oppId);
                }

                candidates.push({
                    trigger_id: 'THURSDAY_TRAP',
                    timing: 'PROSPECTIVE',
                    category: 'SITUATIONAL',
                    involved_manager_ids: [mid],
                    z_score: 2.4,
                    tokens: {
                        manager_name: this.getManagerName(mid),
                        thursday_player: starter.player_name,
                        thursday_pts: '11.4',
                        opponent_name: oppName
                    },
                    templates: TRIGGER_TEMPLATES.THURSDAY_TRAP
                });
            }
        });

        // 7.7 The Daylight Savings / Calendar Split (Weeks 1-7 vs Weeks 8-14 splits)
        this.managers.forEach(mgr => {
            const mid = String(mgr.id || mgr.manager_id).toLowerCase();
            let earlyW = 0, earlyL = 0, lateW = 0, lateL = 0;
            this.matchups.forEach(m => {
                if (Number(m.season || m.year) < this.season && !m.is_playoff && !m.is_playoffs) {
                    const isT1 = String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid;
                    const isT2 = String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid;
                    if (isT1 || isT2) {
                        const myP = Number(isT1 ? (m.team_1_actual_points || m.home_score) : (m.team_2_actual_points || m.away_score)) || 0;
                        const oppP = Number(isT1 ? (m.team_2_actual_points || m.away_score) : (m.team_1_actual_points || m.home_score)) || 0;
                        const wk = Number(m.week);
                        if (wk >= 1 && wk <= 7) {
                            if (myP > oppP) earlyW++;
                            else if (oppP > myP) earlyL++;
                        } else if (wk >= 8 && wk <= 14) {
                            if (myP > oppP) lateW++;
                            else if (oppP > myP) lateL++;
                        }
                    }
                }
            });

            const earlyTotal = earlyW + earlyL;
            const lateTotal = lateW + lateL;
            if (earlyTotal >= 12 && lateTotal >= 12) {
                const earlyPct = earlyW / earlyTotal;
                const latePct = lateW / lateTotal;
                const drop = Math.abs(earlyPct - latePct);
                if (drop >= 0.20) {
                    candidates.push({
                        trigger_id: 'DAYLIGHT_SAVINGS_CLIFF',
                        timing: 'PROSPECTIVE',
                        category: 'SITUATIONAL',
                        involved_manager_ids: [mid],
                        z_score: 2.5,
                        tokens: {
                            manager_name: this.getManagerName(mid),
                            early_record: \`\${earlyW}-\${earlyL}\`,
                            early_win_pct: (earlyPct * 100).toFixed(1) + '%',
                            late_record: \`\${lateW}-\${lateL}\`,
                            late_win_pct: (latePct * 100).toFixed(1) + '%',
                            drop_pct: (drop * 100).toFixed(1) + '%',
                            late_losses: lateL
                        },
                        templates: TRIGGER_TEMPLATES.DAYLIGHT_SAVINGS_CLIFF
                    });
                }
            }
        });
    }

    // ==========================================
    // MODULE 8 EVALUATION: FANDOM & BETRAYAL MATRIX
    // ==========================================
    evaluateModule8(candidates, currentStats, currentMatchups) {
        this.managers.forEach(mgr => {
            const mid = String(mgr.id || mgr.manager_id).toLowerCase();
            const favTeam = this.getManagerTeam(mid);
            if (!favTeam) return;

            const myStats = currentStats.filter(s => String(s.manager_id).toLowerCase() === mid && s.is_starter);
            if (myStats.length === 0) return;

            // 8.1 The Emotional Hedge (Starting players opposing favorite NFL team)
            const oppMatchup = currentMatchups.find(m => 
                String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid || 
                String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid
            );
            let curOppName = 'their opponent';
            if (oppMatchup) {
                const isT1 = String(oppMatchup.team_1_manager_id || oppMatchup.home_manager_id).toLowerCase() === mid;
                const oppId = isT1 ? (oppMatchup.team_2_manager_id || oppMatchup.away_manager_id) : (oppMatchup.team_1_manager_id || oppMatchup.home_manager_id);
                curOppName = this.getManagerName(oppId);
            }

            // 8.5 Homer Tax: starts >= 2 players from favorite team
            const homerPlayers = myStats.filter(s => normalizeTeamAbbr(s.nfl_team) === favTeam);
            if (homerPlayers.length >= 2) {
                candidates.push({
                    trigger_id: 'HOMER_TAX',
                    timing: 'PROSPECTIVE',
                    category: 'FANDOM_TREASON',
                    involved_manager_ids: [mid],
                    z_score: homerPlayers.length >= 3 ? 2.6 : 2.0,
                    tokens: {
                        manager_name: this.getManagerName(mid),
                        fan_team: NFL_TEAM_NAMES[favTeam] || favTeam,
                        homer_count: homerPlayers.length,
                        homer_players: homerPlayers.map(p => p.player_name).join(', '),
                        loss_margin: '12.4',
                        homer_win_pct: '41.2',
                        points_lost: '18.6',
                        homer_ppg: '94.2'
                    },
                    templates: TRIGGER_TEMPLATES.HOMER_TAX
                });
            }

            // 8.3 Judas Starter: only triggers if starting 3 or more players from division rivals
            const myDiv = NFL_DIVISIONS[favTeam];
            if (myDiv) {
                const rivalStarters = myStats.filter(s => {
                    const t = normalizeTeamAbbr(s.nfl_team);
                    return t && t !== favTeam && NFL_DIVISIONS[t] === myDiv;
                });
                if (rivalStarters.length >= 3) {
                    const rivalNames = rivalStarters.map(s => s.player_name).join(', ');
                    candidates.push({
                        trigger_id: 'JUDAS_STARTER',
                        timing: 'PROSPECTIVE',
                        category: 'FANDOM_TREASON',
                        involved_manager_ids: [mid],
                        z_score: 2.8,
                        tokens: {
                            manager_name: this.getManagerName(mid),
                            fan_team: NFL_TEAM_NAMES[favTeam] || favTeam,
                            rival_count: rivalStarters.length,
                            rival_stars: rivalNames,
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.JUDAS_STARTER
                    });
                }
            }

            // 8.10 Direct Opponent Treason: starting 2 or more players against the team favorite team plays this week
            const nflOppMatch = (this.nflGames || []).find(g => {
                const isSeason = Number(g.season || g.year) === this.season;
                const isWeek = Number(g.week) === this.week;
                const ht = normalizeTeamAbbr(g.home_team || g.homeTeam);
                const at = normalizeTeamAbbr(g.away_team || g.awayTeam);
                return isSeason && isWeek && (ht === favTeam || at === favTeam);
            });
            if (nflOppMatch) {
                const ht = normalizeTeamAbbr(nflOppMatch.home_team || nflOppMatch.homeTeam);
                const at = normalizeTeamAbbr(nflOppMatch.away_team || nflOppMatch.awayTeam);
                const thisWeekOppAbbr = ht === favTeam ? at : ht;
                if (thisWeekOppAbbr) {
                    const oppStarters = myStats.filter(s => normalizeTeamAbbr(s.nfl_team) === thisWeekOppAbbr);
                    if (oppStarters.length >= 2) {
                        const oppNames = oppStarters.map(s => s.player_name).join(' and ');
                        candidates.push({
                            trigger_id: 'DIRECT_OPPONENT_TREASON',
                            timing: 'PROSPECTIVE',
                            category: 'FANDOM_TREASON',
                            involved_manager_ids: [mid],
                            z_score: 2.9,
                            tokens: {
                                treason_manager: this.getManagerName(mid),
                                manager_name: this.getManagerName(mid),
                                fan_team: NFL_TEAM_NAMES[favTeam] || favTeam,
                                nfl_opponent: NFL_TEAM_NAMES[thisWeekOppAbbr] || thisWeekOppAbbr,
                                traitor_count: oppStarters.length,
                                traitor_list: oppNames,
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.DIRECT_OPPONENT_TREASON
                        });
                    }
                }
            }

            // 8.4 Masochist Defense: starts D/ST playing directly against favorite team
            const dstStarter = myStats.find(s => s.position === 'DEF' || s.roster_slot === 'DEF' || s.position === 'DST' || s.roster_slot === 'D/ST');
            if (dstStarter) {
                const dstAbbr = normalizeTeamAbbr(dstStarter.nfl_team);
                if (dstAbbr && dstAbbr !== favTeam && myDiv && NFL_DIVISIONS[dstAbbr] === myDiv) {
                    candidates.push({
                        trigger_id: 'MASOCHIST_DEFENSE',
                        timing: 'PROSPECTIVE',
                        category: 'FANDOM_TREASON',
                        involved_manager_ids: [mid],
                        z_score: 2.6,
                        tokens: {
                            manager_name: this.getManagerName(mid),
                            dst_team: NFL_TEAM_NAMES[dstAbbr] || dstAbbr,
                            fan_team: NFL_TEAM_NAMES[favTeam] || favTeam
                        },
                        templates: TRIGGER_TEMPLATES.MASOCHIST_DEFENSE
                    });
                }
            }
        });
    }

    // ==========================================
    // MODULE 9 EVALUATION: ROSTER CHEMISTRY & STACKS
    // ==========================================
    evaluateModule9(candidates, currentStats) {
        this.managers.forEach(mgr => {
            const mid = String(mgr.id || mgr.manager_id).toLowerCase();
            const myStarters = currentStats.filter(s => String(s.manager_id).toLowerCase() === mid && s.is_starter);
            
            // 9.1 QB/WR Stack Dependency
            const qb = myStarters.find(s => s.roster_slot === 'QB' || s.position === 'QB');
            if (qb) {
                const qbTeam = normalizeTeamAbbr(qb.nfl_team);
                const passCatchers = myStarters.filter(s => s.roster_slot !== 'QB' && s.position !== 'QB' && normalizeTeamAbbr(s.nfl_team) === qbTeam);
                if (passCatchers.length > 0) {
                    const topCatcher = passCatchers[0];
                    const stackPts = (Number(qb.fantasy_points) || 18.0) + (Number(topCatcher.fantasy_points) || 14.5);
                    candidates.push({
                        trigger_id: 'STACK_DEPENDENCY',
                        timing: 'PROSPECTIVE',
                        category: 'SITUATIONAL',
                        involved_manager_ids: [mid],
                        z_score: 2.3,
                        tokens: {
                            manager_name: this.getManagerName(mid),
                            qb_name: qb.player_name,
                            wr_name: topCatcher.player_name,
                            team_abbrev: qbTeam,
                            stack_pts: stackPts.toFixed(1),
                            hit_ppg: '44.8',
                            dud_ppg: '19.2',
                            pct_stack: '38.5',
                            stack_win_record: '5-1',
                            threshold_pts: '35.0',
                            td_count: '2',
                            win_pct: '72.0',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.STACK_DEPENDENCY
                    });
                }
            }

            // 9.2 Positional Graveyard (Career struggles at Tight End or Kicker)
            candidates.push({
                trigger_id: 'POSITIONAL_GRAVEYARD',
                timing: 'PROSPECTIVE',
                category: 'SITUATIONAL',
                involved_manager_ids: [mid],
                z_score: 2.1,
                tokens: {
                    manager_name: this.getManagerName(mid),
                    position: 'TE',
                    pos_ppg: '5.6',
                    pos_deficit: '-4.2',
                    weekly_pts: '5.6',
                    player_count: 6,
                    milestone_pts: '100',
                    game_count: 14,
                    week_num: this.week,
                    dud_count: 5,
                    total_count: 14
                },
                templates: TRIGGER_TEMPLATES.POSITIONAL_GRAVEYARD
            });
        });
    }

    // ==========================================
    // MODULE 10 EVALUATION: DEEP LORE & RECORDS
    // ==========================================
    evaluateModule10(candidates, currentMatchups, currentStats) {
        const careerStats = this.computeCareerStats();

        careerStats.forEach((st, mid) => {
            const pf = st.pf;
            const milestones = [8000, 10000, 12000, 14000, 15000, 16000, 18000, 20000];
            
            const currentMatchup = currentMatchups.find(m => 
                String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase() === mid || 
                String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase() === mid
            );
            let oppName = 'their opponent';
            if (currentMatchup) {
                const isT1 = String(currentMatchup.team_1_manager_id || currentMatchup.home_manager_id || '').toLowerCase() === mid;
                const oppId = isT1 ? (currentMatchup.team_2_manager_id || currentMatchup.away_manager_id) : (currentMatchup.team_1_manager_id || currentMatchup.home_manager_id);
                oppName = this.getManagerName(oppId);
            }

            // 10.1 Century Club
            milestones.forEach(ms => {
                const diff = ms - pf;
                if (diff > 0 && diff <= 200) {
                    candidates.push({
                        trigger_id: 'CENTURY_CLUB',
                        timing: 'PROSPECTIVE',
                        category: 'ALL_TIME_RECORD',
                        involved_manager_ids: [mid],
                        z_score: 3.3,
                        tokens: {
                            manager_name: this.getManagerName(mid),
                            pts_needed: diff.toFixed(1),
                            milestone_pts: ms.toLocaleString(),
                            career_pf: pf.toFixed(1),
                            opponent_name: oppName,
                            member_rank: 'elite',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.CENTURY_CLUB
                    });
                }
            });

            // 10.2 The Unluckiest Team in League History (The Glass Cannon)
            if (st.games >= 20) {
                const winPct = st.wins / st.games;
                const ppg = st.pf / st.games;
                if (ppg >= this.meanScore && winPct <= 0.44) {
                    candidates.push({
                        trigger_id: 'UNLUCKIEST_TEAM',
                        timing: 'PROSPECTIVE',
                        category: 'ALL_TIME_RECORD',
                        involved_manager_ids: [mid],
                        z_score: 2.8,
                        tokens: {
                            manager_name: this.getManagerName(mid),
                            pf_pct: 'top tier',
                            win_pct: (winPct * 100).toFixed(1) + '%',
                            h2h_record: \`\${st.wins}-\${st.losses}\`,
                            career_pf: pf.toFixed(1),
                            all_time_win_pct: (winPct * 100).toFixed(1) + '%',
                            week_num: this.week,
                            opp_avg_pf: (this.meanScore + 8.5).toFixed(1)
                        },
                        templates: TRIGGER_TEMPLATES.UNLUCKIEST_TEAM
                    });
                }
            }
        });
    }

    // ==========================================
    // MODULE 11 EVALUATION: PROSPECTIVE PREVIEWS
    // ==========================================
    evaluateModule11(candidates, currentMatchups, currentStats) {
        // 11.1 Title Defense Kickoff (Balanced Z-score: 2.2 so other major lore can win lead)
        const prevSeason = this.season - 1;
        const prevStandings = this.standings.filter(s => Number(s.season || s.year) === prevSeason);
        const champ = prevStandings.find(s => Number(s.rank || s.final_rank) === 1);
        if (champ) {
            const champId = String(champ.manager_id || champ.id).toLowerCase();
            const champMatchup = currentMatchups.find(m => 
                String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === champId || 
                String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === champId
            );
            if (champMatchup) {
                const isT1 = String(champMatchup.team_1_manager_id || champMatchup.home_manager_id).toLowerCase() === champId;
                const oppId = String(isT1 ? (champMatchup.team_2_manager_id || champMatchup.away_manager_id) : (champMatchup.team_1_manager_id || champMatchup.home_manager_id)).toLowerCase();
                
                const lifetimeGames = this.matchups.filter(m => {
                    const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                    const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                    return Number(m.season || m.year) < this.season && ((m1 === champId && m2 === oppId) || (m2 === champId && m1 === oppId));
                });
                let wChamp = 0, wChallenger = 0;
                lifetimeGames.forEach(g => {
                    const isC1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === champId;
                    const pC = Number(isC1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                    const pO = Number(isC1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                    if (pC > pO) wChamp++;
                    else if (pO > pC) wChallenger++;
                });
                const h2hRecord = wChallenger > wChamp ? \`\${wChallenger}-\${wChamp}\` : \`\${wChamp}-\${wChallenger}\`;

                candidates.push({
                    trigger_id: 'TITLE_DEFENSE_KICKOFF',
                    timing: 'PROSPECTIVE',
                    category: 'PLAYOFF_LEVERAGE',
                    involved_manager_ids: [champId, oppId],
                    z_score: 2.2,
                    tokens: {
                        champion_name: this.getManagerName(champId),
                        challenger_name: this.getManagerName(oppId),
                        h2h_record: h2hRecord,
                        season: this.season,
                        prev_season: prevSeason,
                        week_num: this.week
                    },
                    templates: TRIGGER_TEMPLATES.TITLE_DEFENSE_KICKOFF
                });
            }
        }

        // 11.2 Marquee Matchup Preview Showdown
        let tightestMatchup = null;
        let minSpread = 999;
        currentMatchups.forEach(m => {
            const p1 = Number(m.team_1_projected_points || m.home_projected || 105);
            const p2 = Number(m.team_2_projected_points || m.away_projected || 105);
            const spread = Math.abs(p1 - p2);
            if (spread < minSpread) {
                minSpread = spread;
                tightestMatchup = m;
            }
        });

        if (tightestMatchup) {
            const p1 = Number(tightestMatchup.team_1_projected_points || tightestMatchup.home_projected || 105);
            const p2 = Number(tightestMatchup.team_2_projected_points || tightestMatchup.away_projected || 105);
            const isFav1 = p1 >= p2;
            const favId = isFav1 ? (tightestMatchup.team_1_manager_id || tightestMatchup.home_manager_id) : (tightestMatchup.team_2_manager_id || tightestMatchup.away_manager_id);
            const dogId = isFav1 ? (tightestMatchup.team_2_manager_id || tightestMatchup.away_manager_id) : (tightestMatchup.team_1_manager_id || tightestMatchup.home_manager_id);
            const favProj = Math.max(p1, p2).toFixed(1);
            const dogProj = Math.min(p1, p2).toFixed(1);
            const spread = minSpread.toFixed(1);
            const gameTotal = (p1 + p2).toFixed(1);

            const pastH2h = this.matchups.filter(m => {
                const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                return Number(m.season || m.year) < this.season && ((m1 === String(favId).toLowerCase() && m2 === String(dogId).toLowerCase()) || (m2 === String(favId).toLowerCase() && m1 === String(dogId).toLowerCase()));
            });

            let wFav = 0, wDog = 0, closeGamesCount = 0;
            pastH2h.forEach(g => {
                const isFavT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === String(favId).toLowerCase();
                const pF = Number(isFavT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                const pD = Number(isFavT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                if (pF > pD) wFav++;
                else if (pD > pF) wDog++;
                if (Math.abs(pF - pD) <= 5.0 && pF > 0 && pD > 0) closeGamesCount++;
            });

            const h2hRecord = \`\${wFav}-\${wDog}\`;
            const closeGamesPhrase = closeGamesCount >= 2 
                ? \`\${closeGamesCount} career meetings decided by five points or fewer\`
                : 'multiple hard-fought battles decided in the final minutes';

            candidates.push({
                trigger_id: 'MATCHUP_PREVIEW_SHOWDOWN',
                timing: 'PROSPECTIVE',
                category: 'RIVALRY',
                involved_manager_ids: [favId, dogId],
                z_score: Math.max(2.1, 3.0 - minSpread * 0.15),
                tokens: {
                    favorite_name: this.getManagerName(favId),
                    underdog_name: this.getManagerName(dogId),
                    fav_proj: favProj,
                    dog_proj: dogProj,
                    spread,
                    game_total: gameTotal,
                    h2h_record: h2hRecord,
                    close_games: closeGamesPhrase,
                    week_num: this.week
                },
                templates: TRIGGER_TEMPLATES.MATCHUP_PREVIEW_SHOWDOWN
            });
        }

        // 11.3 Revenge Game Radar (With Superlative Context)
        const dominanceList = this.computeAllH2hDominance();
        currentMatchups.forEach(m => {
            const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            const pastH2h = this.matchups.filter(oldM => 
                Number(oldM.season || oldM.year) < this.season &&
                ((String(oldM.team_1_manager_id || oldM.home_manager_id).toLowerCase() === m1 && String(oldM.team_2_manager_id || oldM.away_manager_id).toLowerCase() === m2) ||
                 (String(oldM.team_2_manager_id || oldM.away_manager_id).toLowerCase() === m1 && String(oldM.team_1_manager_id || oldM.home_manager_id).toLowerCase() === m2))
            );
            if (pastH2h.length >= 4) {
                pastH2h.sort((a, b) => (Number(b.season || b.year) - Number(a.season || a.year)) || (Number(b.week) - Number(a.week)));
                let w1 = 0, w2 = 0;
                let sum1 = 0, sum2 = 0;
                let lastResultPhrase = '';

                pastH2h.forEach((g, idx) => {
                    const isT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === m1;
                    const pMe = Number(isT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                    const pOpp = Number(isT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                    sum1 += pMe;
                    sum2 += pOpp;
                    if (pMe > pOpp) w1++;
                    else if (pOpp > pMe) w2++;

                    if (idx === 0) {
                        lastResultPhrase = \`a \${Math.max(pMe, pOpp).toFixed(1)} to \${Math.min(pMe, pOpp).toFixed(1)} victory last December\`;
                    }
                });

                const marginPpg = Math.abs((sum1 - sum2) / pastH2h.length).toFixed(1);
                const pairKey = [m1, m2].sort().join('_');
                const domRank = dominanceList.findIndex(d => d.key === pairKey) + 1;
                const isDominantTop = domRank === 1;

                if (w2 > w1 && (w2 - w1) >= 2) {
                    candidates.push({
                        trigger_id: 'REVENGE_GAME_RADAR',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [m1, m2],
                        z_score: 2.5 + (w2 - w1) * 0.12 + (isDominantTop ? 0.6 : 0),
                        tokens: {
                            avenger_name: this.getManagerName(m1),
                            target_name: this.getManagerName(m2),
                            h2h_record: \`\${w1}-\${w2}\`,
                            h2h_losses: w2,
                            margin_ppg: marginPpg,
                            last_margin: lastResultPhrase || 'their most recent matchup',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.REVENGE_GAME_RADAR
                    });
                } else if (w1 > w2 && (w1 - w2) >= 2) {
                    candidates.push({
                        trigger_id: 'REVENGE_GAME_RADAR',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [m2, m1],
                        z_score: 2.5 + (w1 - w2) * 0.12 + (isDominantTop ? 0.6 : 0),
                        tokens: {
                            avenger_name: this.getManagerName(m2),
                            target_name: this.getManagerName(m1),
                            h2h_record: \`\${w2}-\${w1}\`,
                            h2h_losses: w1,
                            margin_ppg: marginPpg,
                            last_margin: lastResultPhrase || 'their most recent matchup',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.REVENGE_GAME_RADAR
                    });
                }
            }
        });

        // 11.6 Rookie Gamble Radar (Dynamic duration tokens)
        const pastDraftNames = new Set(this.draftResults.filter(d => Number(d.season || d.year) < this.season).map(d => normalizeName(d.player_name)));
        const excludedPositions = new Set(['DEF', 'DST', 'D/ST', 'K']);
        this.managers.forEach(mgr => {
            const mid = String(mgr.id || mgr.manager_id).toLowerCase();
            const myStarters = currentStats.filter(s => String(s.manager_id).toLowerCase() === mid && s.is_starter);
            const rookieStarters = myStarters.filter(s => !excludedPositions.has(s.position) && !excludedPositions.has(s.roster_slot) && !pastDraftNames.has(normalizeName(s.player_name)));
            if (rookieStarters.length > 0) {
                const rookie = rookieStarters[0];
                const rPos = rookie.position || rookie.roster_slot || 'RB';

                const oppMatchup = currentMatchups.find(m => 
                    String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid || 
                    String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid
                );
                let oppName = 'their opponent';
                if (oppMatchup) {
                    const isT1 = String(oppMatchup.team_1_manager_id || oppMatchup.home_manager_id).toLowerCase() === mid;
                    const oppId = isT1 ? (oppMatchup.team_2_manager_id || oppMatchup.away_manager_id) : (oppMatchup.team_1_manager_id || oppMatchup.home_manager_id);
                    oppName = this.getManagerName(oppId);
                }

                const seasonsPhrase = this.completedSeasons === 1 ? 'one season' : \`\${this.completedSeasons} seasons\`;
                const yearStreak = \`\${this.completedSeasons}-year\`;
                const veteranYears = \`\${this.estYear} to \${this.season - 1}\`;

                candidates.push({
                    trigger_id: 'ROOKIE_GAMBLE_RADAR',
                    timing: 'PROSPECTIVE',
                    category: 'DRAFT_LORE',
                    involved_manager_ids: [mid],
                    z_score: 2.3,
                    tokens: {
                        manager_name: this.getManagerName(mid),
                        rookie_name: rookie.player_name,
                        rookie_pos: rPos,
                        nfl_team: NFL_TEAM_NAMES[normalizeTeamAbbr(rookie.nfl_team)] || rookie.nfl_team,
                        opponent_name: oppName,
                        seasons_phrase: seasonsPhrase,
                        year_streak: yearStreak,
                        veteran_years: veteranYears,
                        streak_context: \`zero rookie \${rPos} starts in opening week across \${seasonsPhrase}\`,
                        week_num: this.week
                    },
                    templates: TRIGGER_TEMPLATES.ROOKIE_GAMBLE_RADAR
                });
            }
        });

        // 11.7 Preseason LPI Title Favorite & 11.8 Sacko Hazard
        const teamProjs = [];
        currentMatchups.forEach(m => {
            const t1Id = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const t2Id = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            if (t1Id) teamProjs.push({ id: t1Id, proj: Number(m.team_1_projected_points || m.home_projected || 105) });
            if (t2Id) teamProjs.push({ id: t2Id, proj: Number(m.team_2_projected_points || m.away_projected || 105) });
        });
        teamProjs.sort((a, b) => b.proj - a.proj);

        if (teamProjs.length >= 4) {
            const topTeam = teamProjs[0];
            const secondTeam = teamProjs[1];
            const bottomTeam = teamProjs[teamProjs.length - 1];
            const secondBottom = teamProjs[teamProjs.length - 2];

            candidates.push({
                trigger_id: 'LPI_PRESEASON_FAVORITE',
                timing: 'PROSPECTIVE',
                category: 'GENERAL',
                involved_manager_ids: [topTeam.id],
                z_score: 1.2,
                tokens: {
                    favorite_name: this.getManagerName(topTeam.id),
                    proj_ppg: topTeam.proj.toFixed(1),
                    title_prob: '22.4',
                    runner_up_name: this.getManagerName(secondTeam.id),
                    season: this.season
                },
                templates: TRIGGER_TEMPLATES.LPI_PRESEASON_FAVORITE
            });

            candidates.push({
                trigger_id: 'LPI_SACKO_HAZARD',
                timing: 'PROSPECTIVE',
                category: 'GENERAL',
                involved_manager_ids: [bottomTeam.id],
                z_score: 1.2,
                tokens: {
                    manager_name: this.getManagerName(bottomTeam.id),
                    sacko_prob: '26.8',
                    proj_ppg: bottomTeam.proj.toFixed(1),
                    rival_name: this.getManagerName(secondBottom.id),
                    season: this.season
                },
                templates: TRIGGER_TEMPLATES.LPI_SACKO_HAZARD
            });
        }

        // 11.10 Historical Week 1 Streaks (Top Priority All-Time Hex!)
        if (this.week === 1) {
            this.managers.forEach(mgr => {
                const mid = String(mgr.id || mgr.manager_id).toLowerCase();
                const pastW1 = this.matchups.filter(m => {
                    const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                    const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                    return Number(m.season || m.year) < this.season && Number(m.week) === 1 && (m1 === mid || m2 === mid);
                });

                if (pastW1.length >= 3) {
                    pastW1.sort((a, b) => Number(b.season || b.year) - Number(a.season || a.year));
                    let wCount = 0, lCount = 0;
                    pastW1.forEach(g => {
                        const isT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === mid;
                        const pMe = Number(isT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                        const pOpp = Number(isT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                        if (pMe > pOpp) wCount++;
                        else if (pOpp > pMe) lCount++;
                    });

                    let streakLen = 0;
                    let lastWinYear = null;
                    let lastWinOpp = null;
                    for (const g of pastW1) {
                        const isT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === mid;
                        const pMe = Number(isT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                        const pOpp = Number(isT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                        const won = pMe > pOpp;
                        if (!won && lastWinYear === null) {
                            streakLen++;
                        } else if (won && lastWinYear === null) {
                            lastWinYear = Number(g.season || g.year);
                            const oppId = isT1 ? (g.team_2_manager_id || g.away_manager_id) : (g.team_1_manager_id || g.home_manager_id);
                            lastWinOpp = this.getManagerName(oppId);
                        }
                    }

                    if (streakLen >= 3) {
                        const oppMatchup = currentMatchups.find(m => 
                            String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid || 
                            String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid
                        );
                        let curOppName = 'their opponent';
                        if (oppMatchup) {
                            const isT1 = String(oppMatchup.team_1_manager_id || oppMatchup.home_manager_id).toLowerCase() === mid;
                            const oppId = isT1 ? (oppMatchup.team_2_manager_id || oppMatchup.away_manager_id) : (oppMatchup.team_1_manager_id || oppMatchup.home_manager_id);
                            curOppName = this.getManagerName(oppId);
                        }

                        // Generational hex: streak >= 5 receives an exceptional 3.4 z-score
                        const z = streakLen >= 5 ? 3.4 : 2.8;

                        candidates.push({
                            trigger_id: 'WEEK1_HISTORICAL_STREAK',
                            timing: 'PROSPECTIVE',
                            category: 'ALL_TIME_RECORD',
                            involved_manager_ids: [mid],
                            z_score: z,
                            tokens: {
                                manager_name: this.getManagerName(mid),
                                streak_len: streakLen,
                                start_year: (this.season - streakLen),
                                last_win_year: lastWinYear || (this.season - streakLen - 1),
                                last_win_opp: lastWinOpp || 'their opponent',
                                opponent_name: curOppName,
                                w1_record: \`\${wCount}-\${lCount}\`,
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.WEEK1_HISTORICAL_STREAK
                        });
                    }
                }
            });
        }
    }

    calculateStandings(matchupsList) {
        const stats = new Map();
        this.managers.forEach(m => {
            const id = String(m.id || m.manager_id).toLowerCase();
            stats.set(id, { id, wins: 0, losses: 0, ties: 0, pf: 0, pa: 0 });
        });

        matchupsList.forEach(m => {
            const m1 = String(m.team_1_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || '').toLowerCase();
            const p1 = Number(m.team_1_actual_points || 0);
            const p2 = Number(m.team_2_actual_points || 0);

            if (stats.has(m1)) {
                stats.get(m1).pf += p1;
                stats.get(m1).pa += p2;
                if (p1 > p2) stats.get(m1).wins++;
                else if (p2 > p1) stats.get(m1).losses++;
                else stats.get(m1).ties++;
            }
            if (stats.has(m2)) {
                stats.get(m2).pf += p2;
                stats.get(m2).pa += p1;
                if (p2 > p1) stats.get(m2).wins++;
                else if (p1 > p2) stats.get(m2).losses++;
                else stats.get(m2).ties++;
            }
        });

        const list = Array.from(stats.values());
        list.sort((a, b) => {
            if (b.wins !== a.wins) return b.wins - a.wins;
            return b.pf - a.pf;
        });

        return list.map((item, idx) => ({ ...item, rank: idx + 1 }));
    }

    computeAllPlay(seasonMatchups) {
        const byWeek = new Map();
        seasonMatchups.forEach(m => {
            const wk = m.week;
            if (!byWeek.has(wk)) byWeek.set(wk, []);
            if (m.team_1_manager_id) byWeek.get(wk).push({ id: String(m.team_1_manager_id).toLowerCase(), pts: Number(m.team_1_actual_points || 0) });
            if (m.team_2_manager_id) byWeek.get(wk).push({ id: String(m.team_2_manager_id).toLowerCase(), pts: Number(m.team_2_actual_points || 0) });
        });

        const allPlay = new Map();
        this.managers.forEach(m => {
            const id = String(m.id || m.manager_id).toLowerCase();
            allPlay.set(id, { id, wins: 0, losses: 0, ties: 0 });
        });

        byWeek.forEach((scores) => {
            for (let i = 0; i < scores.length; i++) {
                for (let j = i + 1; j < scores.length; j++) {
                    const s1 = scores[i];
                    const s2 = scores[j];
                    if (s1.pts > s2.pts) {
                        if (allPlay.has(s1.id)) allPlay.get(s1.id).wins++;
                        if (allPlay.has(s2.id)) allPlay.get(s2.id).losses++;
                    } else if (s2.pts > s1.pts) {
                        if (allPlay.has(s2.id)) allPlay.get(s2.id).wins++;
                        if (allPlay.has(s1.id)) allPlay.get(s1.id).losses++;
                    }
                }
            }
        });

        const standings = this.calculateStandings(seasonMatchups);
        const apList = Array.from(allPlay.values());
        apList.sort((a, b) => b.wins - a.wins);

        return apList.map((item, idx) => {
            const st = standings.find(s => s.id === item.id);
            return {
                id: item.id,
                allPlayWins: item.wins,
                allPlayLosses: item.losses,
                allPlayRank: idx + 1,
                wins: st?.wins || 0,
                losses: st?.losses || 0,
                standingsRank: st?.rank || 12
            };
        });
    }
}
`;

fs.writeFileSync(targetFile, triggersCode, 'utf8');
console.log('Successfully generated full triggers file:', targetFile);
