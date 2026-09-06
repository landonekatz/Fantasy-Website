/**
 * NFLStatsService
 * Standardized NFL Player Data, Games Played, and Historical Finishes
 * Powered by Sleeper NFL API (Free, Unauthenticated REST Endpoints)
 */

import { nflHistoricalTeams } from './nfl_historical_teams.js';

class NFLStatsService {
    constructor() {
        this.playersCache = null;
        this.seasonStatsCache = {}; // year -> { [playerId]: stats }
        this.nameToIdMap = null; // normalizedName -> id
        this.loadingPromises = {};
        this.storageKeyPrefix = 'fv_nfl_stats_';
        
        // Auto-preload players directory for headshots & player matching
        if (typeof window !== 'undefined' || typeof fetch !== 'undefined') {
            this.loadPlayers().catch(() => {});
        }
    }

    normalizeName(name) {
        if (!name) return '';
        return String(name)
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    getStorage(key) {
        try {
            const raw = sessionStorage.getItem(this.storageKeyPrefix + key);
            if (raw) {
                const parsed = JSON.parse(raw);
                // Cache for 12 hours
                if (Date.now() - (parsed.timestamp || 0) < 12 * 60 * 60 * 1000) {
                    return parsed.data;
                }
            }
        } catch (e) {
            // Storage access restricted or disabled
        }
        return null;
    }

    setStorage(key, data) {
        try {
            sessionStorage.setItem(this.storageKeyPrefix + key, JSON.stringify({
                timestamp: Date.now(),
                data: data
            }));
        } catch (e) {
            // Storage full or restricted
        }
    }

    async loadPlayers() {
        if (this.playersCache) return this.playersCache;
        if (this.loadingPromises['players']) return this.loadingPromises['players'];

        const cached = this.getStorage('players_directory');
        if (cached) {
            this.playersCache = cached;
            this.buildNameToIdMap(cached);
            return cached;
        }

        this.loadingPromises['players'] = (async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const res = await fetch('https://api.sleeper.app/v1/players/nfl', { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const players = await res.json();
                this.playersCache = players;
                this.buildNameToIdMap(players);
                this.setStorage('players_directory', players);
                return players;
            } catch (err) {
                console.warn('[NFLStatsService] Unable to load NFL players directory:', err);
                return null;
            } finally {
                delete this.loadingPromises['players'];
            }
        })();

        return this.loadingPromises['players'];
    }

    buildNameToIdMap(players) {
        if (!players) return;
        const map = {};
        Object.entries(players).forEach(([id, p]) => {
            const first = p.first_name || '';
            const last = p.last_name || '';
            const full = `${first} ${last}`.trim();
            const norm = this.normalizeName(full);
            if (norm) {
                map[norm] = id;
                if (p.position) {
                    map[`${norm}_${p.position.toLowerCase()}`] = id;
                }
            }
        });
        this.nameToIdMap = map;
    }

    async loadSeasonStats(year) {
        const yr = Number(year);
        if (this.seasonStatsCache[yr]) return this.seasonStatsCache[yr];
        if (this.loadingPromises[`stats_${yr}`]) return this.loadingPromises[`stats_${yr}`];

        const cached = this.getStorage(`stats_${yr}`);
        if (cached) {
            this.seasonStatsCache[yr] = cached;
            return cached;
        }

        this.loadingPromises[`stats_${yr}`] = (async () => {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000);
                const res = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${yr}`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const stats = await res.json();
                this.seasonStatsCache[yr] = stats;
                this.setStorage(`stats_${yr}`, stats);
                return stats;
            } catch (err) {
                console.warn(`[NFLStatsService] Unable to load NFL stats for ${yr}:`, err);
                return null;
            } finally {
                delete this.loadingPromises[`stats_${yr}`];
            }
        })();

        return this.loadingPromises[`stats_${yr}`];
    }

    isSeasonLoaded(year) {
        const yr = Number(year);
        return Boolean(this.playersCache && this.seasonStatsCache[yr]);
    }

    async preloadSeason(year) {
        try {
            await Promise.all([
                this.loadPlayers(),
                this.loadSeasonStats(year)
            ]);
        } catch (e) {
            console.warn('[NFLStatsService] Preload season failed:', e);
        }
    }

    async preloadAllSeasons(years = []) {
        try {
            await this.loadPlayers();
            const yrList = Array.isArray(years) && years.length > 0
                ? years
                : [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
            await Promise.allSettled(yrList.map(yr => this.loadSeasonStats(yr)));
        } catch (e) {
            console.warn('[NFLStatsService] Preload all seasons failed:', e);
        }
    }

    findPlayerId(name, pos = '') {
        if (!this.nameToIdMap) return null;
        const norm = this.normalizeName(name);
        const posKey = pos ? `${norm}_${pos.toLowerCase()}` : '';
        if (posKey && this.nameToIdMap[posKey]) {
            return this.nameToIdMap[posKey];
        }
        if (this.nameToIdMap[norm]) {
            return this.nameToIdMap[norm];
        }

        // Common Nicknames & Aliases
        const aliases = {
            'hollywood brown': 'marquise brown',
            'robby anderson': 'robbie chosen',
            'robbie anderson': 'robbie chosen',
            'chosen anderson': 'robbie chosen',
            'mitch trubisky': 'mitchell trubisky',
            'gabriel davis': 'gabe davis',
            'josh palmer': 'joshua palmer',
            'chigoziem okonkwo': 'chig okonkwo',
            'ken walker': 'kenneth walker',
            'deandre swift': 'dandre swift',
            'cameron akers': 'cam akers',
            'matt stafford': 'matthew stafford',
            'christopher godwin': 'chris godwin',
            'will fuller': 'william fuller',
            'kenneth gainwell': 'kenny gainwell',
            'jeffrey wilson': 'jeff wilson',
            'jeffery wilson': 'jeff wilson',
            'ben watson': 'benjamin watson',
            'eli mitchell': 'elijah mitchell',
            'nyheim hines': 'nyheim millerhines',
            'travis etienne': 'travis etienne'
        };

        if (aliases[norm] && this.nameToIdMap[aliases[norm]]) {
            return this.nameToIdMap[aliases[norm]];
        }

        return null;
    }

    getPlayerHeadshot(name, pos = '') {
        if (!name) return '';
        const normPos = String(pos || '').toUpperCase();
        
        if (normPos === 'DEF' || normPos === 'D/ST') {
            const teamDefMap = {
                'steelers': 'pit', 'texans': 'hou', 'rams': 'lar', 'cardinals': 'ari',
                'raiders': 'lv', 'ravens': 'bal', 'panthers': 'car', 'seahawks': 'sea',
                'vikings': 'min', 'broncos': 'den', 'bills': 'buf', 'buccaneers': 'tb',
                'packers': 'gb', 'chiefs': 'kc', 'giants': 'nyg', 'patriots': 'ne',
                'jaguars': 'jax', 'lions': 'det', 'dolphins': 'mia', 'eagles': 'phi',
                'colts': 'ind', 'saints': 'no', 'falcons': 'atl', 'browns': 'cle',
                'jets': 'nyj', 'commanders': 'was', 'washington': 'was', 'bears': 'chi',
                'bengals': 'cin', 'titans': 'ten', 'chargers': 'lac', 'cowboys': 'dal',
                '49ers': 'sf'
            };
            const normName = this.normalizeName(name);
            for (const [k, abbr] of Object.entries(teamDefMap)) {
                if (normName.includes(k)) {
                    return `https://sleepercdn.com/images/team_logos/nfl/${abbr}.png`;
                }
            }
        }

        if (!this.nameToIdMap && !this.loadingPromises['players']) {
            this.loadPlayers().catch(() => {});
        }

        const pId = this.findPlayerId(name, pos);
        if (pId) {
            return `https://sleepercdn.com/content/nfl/players/thumb/${pId}.jpg`;
        }
        return '';
    }

    getPlayerStats(name, year, pos = '', scoringFormat = '') {
        const yr = Number(year);
        const statsMap = this.seasonStatsCache[yr];
        if (!statsMap) return null;

        const pId = this.findPlayerId(name, pos);
        if (!pId || !statsMap[pId]) return null;

        const raw = statsMap[pId];
        const fmtStr = String(scoringFormat || '').toLowerCase();
        let posRankNum = null;
        let totalPts = 0;

        if (fmtStr.includes('half') || fmtStr.includes('0.5')) {
            posRankNum = raw.pos_rank_half_ppr || raw.pos_rank_ppr || raw.pos_rank_std || null;
            totalPts = raw.pts_half_ppr !== undefined ? raw.pts_half_ppr : (raw.pts_ppr !== undefined ? raw.pts_ppr : (raw.pts_std || 0));
        } else if (fmtStr.includes('standard') || fmtStr.includes('0.0') || fmtStr.includes('std')) {
            posRankNum = raw.pos_rank_std || raw.pos_rank_half_ppr || raw.pos_rank_ppr || null;
            totalPts = raw.pts_std !== undefined ? raw.pts_std : (raw.pts_half_ppr !== undefined ? raw.pts_half_ppr : (raw.pts_ppr || 0));
        } else {
            // Default to PPR
            posRankNum = raw.pos_rank_ppr || raw.pos_rank_half_ppr || raw.pos_rank_std || null;
            totalPts = raw.pts_ppr !== undefined ? raw.pts_ppr : (raw.pts_half_ppr !== undefined ? raw.pts_half_ppr : (raw.pts_std || 0));
        }

        let gp = null;
        if (raw.gp !== undefined && raw.gp !== null) {
            gp = Number(raw.gp);
        } else if (totalPts > 0) {
            gp = raw.gms_active !== undefined ? Number(raw.gms_active) : 1;
        } else {
            gp = 0;
        }

        // Explicit Joe Mixon 2025 season-ending injury check
        const normName = this.normalizeName(name);
        if (normName === 'joe mixon' && yr === 2025) {
            gp = 0;
            totalPts = 0;
        }

        const regularSeasonLength = yr >= 2021 ? 17 : 16;
        const isDefOrK = (pos === 'DEF' || pos === 'D/ST' || pos === 'K');
        const missedGames = (gp !== null && !isDefOrK) ? Math.max(0, regularSeasonLength - gp) : 0;

        const posRank = posRankNum && pos ? `${pos}${posRankNum}` : (posRankNum ? `#${posRankNum}` : null);
        const playerTeam = nflHistoricalTeams.getTeam(name, yr, pos) || raw.team || (this.playersCache && this.playersCache[pId]?.team) || '';

        return {
            playerId: pId,
            team: playerTeam,
            gp: gp,
            gamesPlayed: gp,
            missedGames: missedGames,
            isInjuredMissed: !isDefOrK && missedGames >= 4 && (totalPts > 0 || (gp !== null && gp > 0)),
            posRankNum: posRankNum,
            posRank: posRank,
            posRankPpr: raw.pos_rank_ppr,
            posRankHalfPpr: raw.pos_rank_half_ppr,
            posRankStd: raw.pos_rank_std,
            totalPts: Math.round(totalPts * 10) / 10,
            ptsPpr: raw.pts_ppr,
            ptsHalfPpr: raw.pts_half_ppr,
            ptsStd: raw.pts_std,
            isFound: true
        };
    }

    getPositionalPaceRank(pos, projectedPts, year, scoringFormat = '') {
        const yr = Number(year);
        const statsMap = this.seasonStatsCache[yr];
        const normPos = String(pos || '').toUpperCase();
        if (!statsMap || !normPos || projectedPts <= 0) return null;

        const fmtStr = String(scoringFormat || '').toLowerCase();
        const allScoresAtPos = [];

        Object.entries(statsMap).forEach(([id, st]) => {
            const pInfo = this.playersCache ? this.playersCache[id] : null;
            const pPos = (pInfo?.position || st.position || '').toUpperCase();
            if (pPos === normPos) {
                let pts = 0;
                if (fmtStr.includes('half') || fmtStr.includes('0.5')) {
                    pts = st.pts_half_ppr !== undefined ? st.pts_half_ppr : (st.pts_ppr !== undefined ? st.pts_ppr : (st.pts_std || 0));
                } else if (fmtStr.includes('standard') || fmtStr.includes('0.0') || fmtStr.includes('std')) {
                    pts = st.pts_std !== undefined ? st.pts_std : (st.pts_half_ppr !== undefined ? st.pts_half_ppr : (st.pts_ppr || 0));
                } else {
                    pts = st.pts_ppr !== undefined ? st.pts_ppr : (st.pts_half_ppr !== undefined ? st.pts_half_ppr : (st.pts_std || 0));
                }
                if (pts > 0) {
                    allScoresAtPos.push(pts);
                }
            }
        });

        if (allScoresAtPos.length === 0) return null;

        allScoresAtPos.sort((a, b) => b - a);

        let higherCount = 0;
        for (let i = 0; i < allScoresAtPos.length; i++) {
            if (allScoresAtPos[i] > projectedPts) {
                higherCount++;
            } else {
                break;
            }
        }

        const paceRankNum = higherCount + 1;
        return `${normPos}${paceRankNum}`;
    }
}

export const nflStats = new NFLStatsService();
if (typeof window !== 'undefined') {
    window.NFLStatsService = nflStats;
}
