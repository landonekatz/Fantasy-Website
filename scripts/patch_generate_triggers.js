import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const genScriptPath = path.join(rootDir, 'scripts', 'generate_full_triggers.js');

let code = fs.readFileSync(genScriptPath, 'utf8');

// 1. Add Helper Functions before export class NewsletterTriggerEvaluator
const oldClassDef = `export class NewsletterTriggerEvaluator {
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
        const m = this.managerMap.get(String(id).toLowerCase());
        return m?.name || m?.manager_name || m?.canonical_name || id;
    }`;

const newClassDef = `export const KNOWN_ALIASES = {
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
        return trimmed.split(/\\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    }
    const clean = trimmed.replace(/[0-9_.-]/g, '').toLowerCase();
    for (const fn of KNOWN_FIRST_NAMES) {
        if (clean.startsWith(fn) && clean.length > fn.length + 1) {
            const first = fn.charAt(0).toUpperCase() + fn.slice(1);
            const last = clean.slice(fn.length);
            const lastCap = last.charAt(0).toUpperCase() + last.slice(1);
            return \`\${first} \${lastCap}\`;
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
    }`;

code = code.replace(oldClassDef, newClassDef);

// 2. Add Helper Methods to NewsletterTriggerEvaluator
const oldDominanceMethod = `    // Pre-computes all pairwise H2H win percentages across league history for contextual superlatives
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
    }`;

const newDominanceMethod = `    // Pre-computes all pairwise regular-season H2H win counts across league history
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
                const key = \`\${m1}->\${m2}\`;
                winMap.set(key, (winMap.get(key) || 0) + 1);
            } else if (p2 > p1) {
                const key = \`\${m2}->\${m1}\`;
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
        const key = \`\${dId}->\${sId}\`;
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
            const meetingWeekText = otherMeeting ? \`, who square off in Week \${otherMeeting.week}\` : '';
            return {
                rank: 1,
                wins,
                rankText: \`tied for the #1 most wins anyone has recorded against a single opponent in league history (sharing the record with \${otherWinnerName}'s \${other.wins} wins over \${otherLoserName}\${meetingWeekText})\`
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
        const leaderWeekText = leaderMeeting ? \`, who square off in Week \${leaderMeeting.week}\` : '';

        if (rank === 2) {
            return {
                rank: 2,
                wins,
                rankText: \`ranking as the second most wins against an opponent in league history, trailing only \${leaderWinnerName}'s \${leader.wins} wins over \${leaderLoserName}\${leaderWeekText}\`
            };
        }

        if (rank <= 5) {
            return {
                rank,
                wins,
                rankText: \`ranking #\${rank} in league history, trailing only leader \${leaderWinnerName} (\${leader.wins} wins over \${leaderLoserName})\`
            };
        }

        return {
            rank,
            wins,
            rankText: \`ranking #\${rank} among all head-to-head rivalries in league history\`
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
                phrase: count >= 1 ? \`\${count} career meeting decided by five points or fewer\` : 'multiple hard-fought battles'
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
                    phrase: \`\${count} career meetings decided by five points or fewer (the #1 most in league history)\`
                };
            }
            return {
                count,
                rank: 1,
                phrase: \`\${count} career meetings decided by five points or fewer (tied for the most in league history)\`
            };
        }

        const leaders = list.filter(x => x.count === topCount).slice(0, 3);
        const leadersStr = leaders.map(l => \`\${this.getManagerName(l.p1)} vs \${this.getManagerName(l.p2)}\`).join(', ');

        if (rank === 2) {
            return {
                count,
                rank: 2,
                phrase: \`\${count} career meetings decided by five points or fewer (tied for 2nd most in league history, trailing only \${leadersStr} with \${topCount} each)\`
            };
        }

        return {
            count,
            rank,
            phrase: \`\${count} career meetings decided by five points or fewer (tied for \${rank === 3 ? '3rd' : rank + 'th'} most in league history, trailing only \${leadersStr} with \${topCount} each)\`
        };
    }

    getMarginRankInfo(mid1, mid2, avgMargin) {
        const allRivals = this.computeAllRivalryMargins();
        const key = [String(mid1).toLowerCase(), String(mid2).toLowerCase()].sort().join('_');
        if (allRivals.length === 0) {
            return {
                leagueRank: 'all-time outlier',
                rankContext: \`averaging \${avgMargin.toFixed(1)} points per contest\`
            };
        }

        if (avgMargin >= 20.0) {
            const sorted = allRivals.slice().sort((a, b) => b.avg - a.avg);
            const rank = sorted.findIndex(r => r.key === key) + 1;
            const leader = sorted[0];
            const [lm1, lm2] = leader.key.split('_');
            const leaderNames = \`\${this.getManagerName(lm1)} vs \${this.getManagerName(lm2)}\`;

            if (rank === 1) {
                return {
                    leagueRank: '#1 widest average margin in league history',
                    rankContext: 'standing alone as the single most lopsided rivalry in league history'
                };
            }
            if (rank === 2) {
                return {
                    leagueRank: '#2 widest average margin in league history',
                    rankContext: \`ranking as the second widest margin in league history, trailing only \${leaderNames} (\${leader.avg.toFixed(1)} pts)\`
                };
            }
            if (rank <= 5) {
                return {
                    leagueRank: \`#\${rank} widest average margin in league history\`,
                    rankContext: \`ranking #\${rank} widest in league history, trailing only leader \${leaderNames} (\${leader.avg.toFixed(1)} pts)\`
                };
            }
            return {
                leagueRank: \`#\${rank} widest margin in league history\`,
                rankContext: \`ranking #\${rank} widest among all \${sorted.length} rivalries in league history\`
            };
        } else {
            const sorted = allRivals.slice().sort((a, b) => a.avg - b.avg);
            const rank = sorted.findIndex(r => r.key === key) + 1;
            const leader = sorted[0];
            const [lm1, lm2] = leader.key.split('_');
            const leaderNames = \`\${this.getManagerName(lm1)} vs \${this.getManagerName(lm2)}\`;

            if (rank === 1) {
                return {
                    leagueRank: '#1 tightest rivalry in league history',
                    rankContext: 'standing as the single closest rivalry in league history'
                };
            }
            if (rank === 2) {
                return {
                    leagueRank: '#2 tightest rivalry in league history',
                    rankContext: \`ranking second closest in league history, trailing only \${leaderNames} (\${leader.avg.toFixed(1)} pts)\`
                };
            }
            if (rank <= 5) {
                return {
                    leagueRank: \`#\${rank} tightest rivalry in league history\`,
                    rankContext: \`ranking #\${rank} closest in league history, trailing only leader \${leaderNames} (\${leader.avg.toFixed(1)} pts)\`
                };
            }
            return {
                leagueRank: \`#\${rank} tightest margin in league history\`,
                rankContext: \`ranking #\${rank} closest among all \${sorted.length} rivalries in league history\`
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
            const key = \`\${s}_\${w}\`;
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
            const roundText = first.round ? \`Round \${first.round}\` : (first.overall_pick ? \`Pick \${first.overall_pick}\` : 'the draft');
            draftDetails = \`drafted in \${roundText} (\${first.season || first.year})\`;
            if (draftYears.length > 1) {
                draftDetails = \`drafted across \${draftYears.length} different seasons (\${draftYears.join(', ')})\`;
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
                ? \`acquired from \${acqTrade.partner} via trade in Week \${acqTrade.wk}, \${acqTrade.yr}\`
                : \`acquired via trade in \${acqTrade.yr}\`;
        }
        if (!acqDetails) {
            acqDetails = 'previously rostered on the squad';
        }

        let departDetails = '';
        if (depTrade) {
            departDetails = depTrade.partner
                ? \`shipped to \${depTrade.partner} in Week \${depTrade.wk}, \${depTrade.yr}\`
                : \`traded away in \${depTrade.yr}\`;
        } else if (depDrop) {
            departDetails = \`cut from the roster in Week \${depDrop.wk}, \${depDrop.yr}\`;
        } else if (wasDrafted) {
            departDetails = \`departed following the \${draftYears[draftYears.length - 1]} campaign\`;
        } else {
            departDetails = 'departed in past transactions';
        }

        const seasonsCount = Math.max(1, draftYears.length + (acqTrade ? 1 : 0));
        const seasonsCountText = seasonsCount === 1 ? 'one season' : \`\${seasonsCount} separate seasons\`;

        return {
            wasRostered: wasDrafted || Boolean(acqTrade) || Boolean(depTrade) || Boolean(depDrop),
            wasDrafted,
            draftYears,
            seasonsCount,
            seasonsCountText,
            acqDetails,
            departDetails,
            context: wasDrafted ? \`originally selected in \${draftDetails}\` : \`brought in via trade\`
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
    }`;

code = code.replace(oldDominanceMethod, newDominanceMethod);

// 3. Update Module 2: MARGIN_OUTLIER, PLAYOFF_REVENGE, TITLE_DEED
const oldModule2Chunk = `                // 2.4 Margin of Victory Outlier (With Superlative League Context)
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
                }`;

const newModule2Chunk = `                // 2.4 Margin of Victory Outlier (With Superlative League Context)
                const avgMargin = mean(margins);
                if (avgMargin < 6.0 || avgMargin > 28.0) {
                    const marginInfo = this.getMarginRankInfo(mid1, mid2, avgMargin);
                    const z = avgMargin > 28.0 ? 3.3 : Math.abs(avgMargin - this.meanMargin) / this.stdMargin;
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
                            league_rank: marginInfo.leagueRank,
                            rank_context: marginInfo.rankContext
                        },
                        templates: TRIGGER_TEMPLATES.MARGIN_OUTLIER
                    });
                }

                // 2.5 The Post-Season Revenge Game (Strict Playoffs Only)
                const pastPlayoff = h2h.filter(g => isRealPlayoffGame(g));
                if (pastPlayoff.length > 0) {
                    const lastPlayoff = pastPlayoff[pastPlayoff.length - 1];
                    const isM1T1 = String(lastPlayoff.team_1_manager_id || lastPlayoff.home_manager_id || '').toLowerCase() === mid1;
                    const p1 = Number(isM1T1 ? (lastPlayoff.team_1_actual_points || lastPlayoff.home_score) : (lastPlayoff.team_2_actual_points || lastPlayoff.away_score)) || 0;
                    const p2 = Number(isM1T1 ? (lastPlayoff.team_2_actual_points || lastPlayoff.away_score) : (lastPlayoff.team_1_actual_points || lastPlayoff.home_score)) || 0;
                    if (p1 > 0 && p2 > 0 && Math.abs(p1 - p2) > 0) {
                        const winnerMid = p1 > p2 ? mid1 : mid2;
                        const loserMid = p1 > p2 ? mid2 : mid1;
                        const playYr = Number(lastPlayoff.season || lastPlayoff.year);
                        const isLastYear = playYr === (this.season - 1);
                        candidates.push({
                            trigger_id: 'PLAYOFF_REVENGE',
                            timing: 'PROSPECTIVE',
                            category: 'RIVALRY',
                            involved_manager_ids: [winnerMid, loserMid],
                            z_score: isLastYear ? 3.0 : 2.5,
                            tokens: {
                                seeking_manager: this.getManagerName(loserMid),
                                rival_manager: this.getManagerName(winnerMid),
                                avenger_name: this.getManagerName(loserMid),
                                target_name: this.getManagerName(winnerMid),
                                elim_margin: Math.abs(p1 - p2).toFixed(1),
                                months_count: isLastYear ? 9 : Math.max(12, (this.season - playYr) * 12),
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.PLAYOFF_REVENGE
                        });
                    }
                }

                // 2.6 The Title Deed (Master vs. Apprentice with Superlative Context)
                if (totalH2h >= 5) {
                    const winPct1 = wins1 / totalH2h;
                    const winPct2 = wins2 / totalH2h;
                    if (winPct1 >= 0.75) {
                        const rankInfo1 = this.getH2hRankInfo(mid1, mid2);
                        candidates.push({
                            trigger_id: 'TITLE_DEED',
                            timing: 'PROSPECTIVE',
                            category: 'RIVALRY',
                            involved_manager_ids: [mid1, mid2],
                            z_score: (winPct1 - 0.5) / 0.15 + (rankInfo1.rank === 1 ? 0.9 : 0),
                            tokens: {
                                dominant_manager: this.getManagerName(mid1),
                                subordinate_manager: this.getManagerName(mid2),
                                landlord_name: this.getManagerName(mid1),
                                tenant_name: this.getManagerName(mid2),
                                h2h_record: \`\${wins1}-\${wins2}\`,
                                win_pct: (winPct1 * 100).toFixed(1),
                                sample_size: totalH2h,
                                sub_wins: wins2,
                                h2h_wins: wins1,
                                h2h_win_rank_text: rankInfo1.rankText,
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.TITLE_DEED
                        });
                    } else if (winPct2 >= 0.75) {
                        const rankInfo2 = this.getH2hRankInfo(mid2, mid1);
                        candidates.push({
                            trigger_id: 'TITLE_DEED',
                            timing: 'PROSPECTIVE',
                            category: 'RIVALRY',
                            involved_manager_ids: [mid1, mid2],
                            z_score: (winPct2 - 0.5) / 0.15 + (rankInfo2.rank === 1 ? 0.9 : 0),
                            tokens: {
                                dominant_manager: this.getManagerName(mid2),
                                subordinate_manager: this.getManagerName(mid1),
                                landlord_name: this.getManagerName(mid2),
                                tenant_name: this.getManagerName(mid1),
                                h2h_record: \`\${wins2}-\${wins1}\`,
                                win_pct: (winPct2 * 100).toFixed(1),
                                sample_size: totalH2h,
                                sub_wins: wins1,
                                h2h_wins: wins2,
                                h2h_win_rank_text: rankInfo2.rankText,
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.TITLE_DEED
                        });
                    }
                }`;

code = code.replace(oldModule2Chunk, newModule2Chunk);

// 4. Update Module 4: TRADE_REMORSE_HOMECOMING
const oldModule4Chunk = `        // 4.2 Trade Remorse / The Homecoming Game
        currentMatchups.forEach(m => {
            const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            const m2PastDrops = this.transactions.filter(t => String(t.manager_id || '').toLowerCase() === m2 && (t.type === 'drop' || t.type === 'trade'));
            m2PastDrops.forEach(t => {
                const dropped = t.dropped_players || t.traded_players || [];
                dropped.forEach(pName => {
                    const activeOnM1 = currentStats.find(s => String(s.manager_id).toLowerCase() === m1 && s.player_name === pName && s.is_starter);
                    if (activeOnM1) {
                        candidates.push({
                            trigger_id: 'TRADE_REMORSE_HOMECOMING',
                            timing: 'PROSPECTIVE',
                            category: 'TRANSACTION',
                            involved_manager_ids: [m1, m2],
                            z_score: 2.3,
                            tokens: {
                                player_name: pName,
                                former_manager: this.getManagerName(m2),
                                new_manager: this.getManagerName(m1),
                                ppg: (Number(activeOnM1.fantasy_points) || 12.0).toFixed(1),
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.TRADE_REMORSE_HOMECOMING
                        });
                    }
                });
            });
        });`;

const newModule4Chunk = `        // 4.2 Trade Remorse / The Homecoming Game (Bi-directional with Full History)
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
                            tenure_context: \`having rostered \${s.player_name} across \${hist.seasonsCountText}\`,
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
                            tenure_context: \`having rostered \${s.player_name} across \${hist.seasonsCountText}\`,
                            ppg: (Number(s.fantasy_points) || 12.0).toFixed(1),
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.TRADE_REMORSE_HOMECOMING
                    });
                }
            });
        });`;

code = code.replace(oldModule4Chunk, newModule4Chunk);

// 5. Update Module 5: SHIP_OF_THESEUS Guard
const oldModule5Start = `    evaluateModule5(candidates, currentStats, currentMatchups) {
        if (this.draftResults.length === 0) return;`;

const newModule5Start = `    evaluateModule5(candidates, currentStats, currentMatchups) {
        if (this.draftResults.length === 0) return;
        // Ship of Theseus requires meaningful waiver progression (Week 4+)
        if (this.week < 4) return;`;

code = code.replace(oldModule5Start, newModule5Start);

// 6. Update Module 8: JUDAS_STARTER (>=3) & DIRECT_OPPONENT_TREASON (>=2)
const oldModule8Judas = `            // 8.3 Judas Starter: starts player from division rival
            const myDiv = NFL_DIVISIONS[favTeam];
            if (myDiv) {
                const rivalStarters = myStats.filter(s => {
                    const t = normalizeTeamAbbr(s.nfl_team);
                    return t && t !== favTeam && NFL_DIVISIONS[t] === myDiv;
                });
                if (rivalStarters.length > 0) {
                    const star = rivalStarters[0];
                    const divRivalAbbr = normalizeTeamAbbr(star.nfl_team);
                    candidates.push({
                        trigger_id: 'JUDAS_STARTER',
                        timing: 'PROSPECTIVE',
                        category: 'FANDOM_TREASON',
                        involved_manager_ids: [mid],
                        z_score: 2.5,
                        tokens: {
                            manager_name: this.getManagerName(mid),
                            fan_team: NFL_TEAM_NAMES[favTeam] || favTeam,
                            div_rival: NFL_TEAM_NAMES[divRivalAbbr] || divRivalAbbr,
                            rival_star: star.player_name,
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.JUDAS_STARTER
                    });
                }
            }`;

const newModule8Judas = `            // 8.3 Judas Starter: only triggers if starting 3 or more players from division rivals
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
            }`;

code = code.replace(oldModule8Judas, newModule8Judas);

// 7. Update Module 10: UNLUCKIEST_TEAM
const oldModule10Unlucky = `            // 10.2 The Unluckiest Team in League History (The Glass Cannon)
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
            }`;

const newModule10Unlucky = `            // 10.2 The Unluckiest Team in League History (Grounded in All-Play & Luck Index)
            const playMetrics = this.computeAllPlayMetrics().get(mid);
            if (st.games >= 15 && playMetrics) {
                const winPct = st.wins / st.games;
                const ppg = st.pf / st.games;
                if (playMetrics.isUnluckiest || (ppg >= this.meanScore && winPct <= 0.46)) {
                    const luckDiffText = playMetrics.luckDiff < 0 ? \`\${Math.abs(playMetrics.luckDiff).toFixed(1)} games\` : \`+\${playMetrics.luckDiff.toFixed(1)} games\`;
                    const luckRankText = playMetrics.isUnluckiest ? '#1 unluckiest in league history' : \`#\${playMetrics.luckRank} in schedule cruelty\`;
                    candidates.push({
                        trigger_id: 'UNLUCKIEST_TEAM',
                        timing: 'PROSPECTIVE',
                        category: 'ALL_TIME_RECORD',
                        involved_manager_ids: [mid],
                        z_score: playMetrics.isUnluckiest ? 3.3 : 2.7,
                        tokens: {
                            manager_name: this.getManagerName(mid),
                            all_play_record: \`\${playMetrics.allplayWins}-\${playMetrics.allplayLosses}\`,
                            all_play_pct: (playMetrics.allplayPct * 100).toFixed(1),
                            actual_record: \`\${st.wins}-\${st.losses}\`,
                            luck_index: luckDiffText,
                            luck_rank: luckRankText,
                            wk1_all_play_record: \`\${playMetrics.w1AllplayWins}-\${playMetrics.w1AllplayLosses}\`,
                            wk1_actual_record: \`\${playMetrics.w1ActualWins}-\${playMetrics.w1ActualLosses}\`,
                            h2h_record: \`\${st.wins}-\${st.losses}\`,
                            career_pf: pf.toFixed(1),
                            all_time_win_pct: (winPct * 100).toFixed(1),
                            opp_avg_pf: (this.meanScore + 8.5).toFixed(1),
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.UNLUCKIEST_TEAM
                    });
                }
            }`;

code = code.replace(oldModule10Unlucky, newModule10Unlucky);

// 8. Update Module 11: MATCHUP_PREVIEW_SHOWDOWN, REVENGE_GAME_RADAR, LPI demotion
const oldModule11Block = `            const h2hRecord = \`\${wFav}-\${wDog}\`;
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
        });`;

const newModule11Block = `            const h2hRecord = \`\${wFav}-\${wDog}\`;
            const closeGamesRankInfo = this.getCloseGamesRankInfo(favId, dogId);

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
                    close_games: closeGamesRankInfo.phrase,
                    week_num: this.week
                },
                templates: TRIGGER_TEMPLATES.MATCHUP_PREVIEW_SHOWDOWN
            });
        }

        // 11.3 Revenge Game Radar (With Contextual Superlatives)
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
                        const gYr = Number(g.season || g.year);
                        const isPriorSeason = gYr === (this.season - 1);
                        const timeText = isPriorSeason ? 'last season' : \`in \${gYr}\`;
                        lastResultPhrase = \`a \${Math.max(pMe, pOpp).toFixed(1)} to \${Math.min(pMe, pOpp).toFixed(1)} victory \${timeText}\`;
                    }
                });

                const marginPpg = Math.abs((sum1 - sum2) / pastH2h.length).toFixed(1);

                if (w2 > w1 && (w2 - w1) >= 2) {
                    const rankInfo = this.getH2hRankInfo(m2, m1);
                    candidates.push({
                        trigger_id: 'REVENGE_GAME_RADAR',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [m1, m2],
                        z_score: 2.6 + (w2 - w1) * 0.12 + (rankInfo.rank === 1 ? 0.8 : 0),
                        tokens: {
                            dominant_manager: this.getManagerName(m2),
                            subordinate_manager: this.getManagerName(m1),
                            target_name: this.getManagerName(m2),
                            avenger_name: this.getManagerName(m1),
                            h2h_record: \`\${w2}-\${w1}\`,
                            h2h_wins: w2,
                            h2h_losses: w2,
                            h2h_league_rank: rankInfo.rankText,
                            sample_size: w1 + w2,
                            margin_ppg: marginPpg,
                            last_margin: lastResultPhrase || 'their most recent matchup',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.REVENGE_GAME_RADAR
                    });
                } else if (w1 > w2 && (w1 - w2) >= 2) {
                    const rankInfo = this.getH2hRankInfo(m1, m2);
                    candidates.push({
                        trigger_id: 'REVENGE_GAME_RADAR',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [m2, m1],
                        z_score: 2.6 + (w1 - w2) * 0.12 + (rankInfo.rank === 1 ? 0.8 : 0),
                        tokens: {
                            dominant_manager: this.getManagerName(m1),
                            subordinate_manager: this.getManagerName(m2),
                            target_name: this.getManagerName(m1),
                            avenger_name: this.getManagerName(m2),
                            h2h_record: \`\${w1}-\${w2}\`,
                            h2h_wins: w1,
                            h2h_losses: w1,
                            h2h_league_rank: rankInfo.rankText,
                            sample_size: w1 + w2,
                            margin_ppg: marginPpg,
                            last_margin: lastResultPhrase || 'their most recent matchup',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.REVENGE_GAME_RADAR
                    });
                }
            }
        });`;

code = code.replace(oldModule11Block, newModule11Block);

// 9. Update LPI_PRESEASON_FAVORITE and LPI_SACKO_HAZARD z-score & category
const oldLpiBlock = `            candidates.push({
                trigger_id: 'LPI_PRESEASON_FAVORITE',
                timing: 'PROSPECTIVE',
                category: 'PLAYOFF_LEVERAGE',
                involved_manager_ids: [topTeam.id],
                z_score: 2.1,
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
                category: 'PLAYOFF_LEVERAGE',
                involved_manager_ids: [bottomTeam.id],
                z_score: 2.0,
                tokens: {
                    manager_name: this.getManagerName(bottomTeam.id),
                    sacko_prob: '26.8',
                    proj_ppg: bottomTeam.proj.toFixed(1),
                    rival_name: this.getManagerName(secondBottom.id),
                    season: this.season
                },
                templates: TRIGGER_TEMPLATES.LPI_SACKO_HAZARD
            });`;

const newLpiBlock = `            candidates.push({
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
            });`;

code = code.replace(oldLpiBlock, newLpiBlock);

fs.writeFileSync(genScriptPath, code, 'utf8');
console.log('Successfully patched scripts/generate_full_triggers.js');
