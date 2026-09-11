/**
 * Transactions Tracker & LTI Evaluation Engine
 * Universal multi-tenant transaction evaluator and archive for The Fantasy Vault and Dumbarton League HQ.
 * Adheres strictly to:
 * - Platform Emoji Policy: strictly NO emojis across the tab (using clean SVGs / typography).
 * - Platform Em-Dash Policy: strictly NO em-dashes; ', as' is used instead.
 * - Metric Name: Landon Transaction Index (LTI), applying positional expectation, VORP, and lineup consolidation.
 */

import { LDIEngine, normalizeName, standardNormalCdf } from './ldi_engine.js';
import nflDefenseStats from './nfl_defense_stats.json' with { type: 'json' };
import espnAthletesData from './espn_athletes_data.json' with { type: 'json' };

// Positional replacement baselines for standard 12-team, 1QB fantasy football leagues
const POSITIONAL_REPLACEMENT_PPG = {
    QB: 16.5,
    RB: 8.0,
    WR: 8.5,
    TE: 6.0,
    K: 7.0,
    DEF: 6.5
};

const NFL_DEFENSE_TEAMS = {
    // Cardinals
    'arizona cardinals': 'ARI', 'arizona': 'ARI', 'cardinals': 'ARI', 'arizonacardinals': 'ARI',
    // Falcons
    'atlanta falcons': 'ATL', 'atlanta': 'ATL', 'falcons': 'ATL', 'atlantafalcons': 'ATL',
    // Ravens
    'baltimore ravens': 'BAL', 'baltimore': 'BAL', 'ravens': 'BAL', 'baltimoreravens': 'BAL',
    // Bills
    'buffalo bills': 'BUF', 'buffalo': 'BUF', 'bills': 'BUF', 'buffalobills': 'BUF',
    // Panthers
    'carolina panthers': 'CAR', 'carolina': 'CAR', 'panthers': 'CAR', 'carolinapanthers': 'CAR',
    // Bears
    'chicago bears': 'CHI', 'chicago': 'CHI', 'bears': 'CHI', 'chicagobears': 'CHI',
    // Bengals
    'cincinnati bengals': 'CIN', 'cincinnati': 'CIN', 'bengals': 'CIN', 'cincinnatibengals': 'CIN',
    // Browns
    'cleveland browns': 'CLE', 'cleveland': 'CLE', 'browns': 'CLE', 'clevelandbrowns': 'CLE',
    // Cowboys
    'dallas cowboys': 'DAL', 'dallas': 'DAL', 'cowboys': 'DAL', 'dallascowboys': 'DAL',
    // Broncos
    'denver broncos': 'DEN', 'denver': 'DEN', 'broncos': 'DEN', 'denverbroncos': 'DEN',
    // Lions
    'detroit lions': 'DET', 'detroit': 'DET', 'lions': 'DET', 'detroitlions': 'DET',
    // Packers
    'green bay packers': 'GB', 'green bay': 'GB', 'packers': 'GB', 'greenbaypackers': 'GB', 'greenbay': 'GB',
    // Texans
    'houston texans': 'HOU', 'houston': 'HOU', 'texans': 'HOU', 'houstontexans': 'HOU',
    // Colts
    'indianapolis colts': 'IND', 'indianapolis': 'IND', 'colts': 'IND', 'indianapoliscolts': 'IND',
    // Jaguars
    'jacksonville jaguars': 'JAX', 'jacksonville': 'JAX', 'jaguars': 'JAX', 'jacksonvillejaguars': 'JAX',
    // Chiefs
    'kansas city chiefs': 'KC', 'kansas city': 'KC', 'chiefs': 'KC', 'kansascitychiefs': 'KC', 'kansascity': 'KC',
    // Chargers
    'los angeles chargers': 'LAC', 'la chargers': 'LAC', 'chargers': 'LAC', 'losangeleschargers': 'LAC', 'lachargers': 'LAC', 'san diego chargers': 'LAC',
    // Rams
    'los angeles rams': 'LAR', 'la rams': 'LAR', 'rams': 'LAR', 'losangelesrams': 'LAR', 'larams': 'LAR', 'st louis rams': 'LAR',
    // Raiders
    'las vegas raiders': 'LV', 'oakland raiders': 'LV', 'raiders': 'LV', 'lasvegasraiders': 'LV', 'oaklandraiders': 'LV',
    // Dolphins
    'miami dolphins': 'MIA', 'miami': 'MIA', 'dolphins': 'MIA', 'miamidolphins': 'MIA',
    // Vikings
    'minnesota vikings': 'MIN', 'minnesota': 'MIN', 'vikings': 'MIN', 'minnesotavikings': 'MIN',
    // Patriots
    'new england patriots': 'NE', 'new england': 'NE', 'patriots': 'NE', 'newenglandpatriots': 'NE', 'newengland': 'NE',
    // Saints
    'new orleans saints': 'NO', 'new orleans': 'NO', 'saints': 'NO', 'neworleanssaints': 'NO', 'neworleans': 'NO',
    // Giants
    'new york giants': 'NYG', 'ny giants': 'NYG', 'giants': 'NYG', 'newyorkgiants': 'NYG', 'nygiants': 'NYG',
    // Jets
    'new york jets': 'NYJ', 'ny jets': 'NYJ', 'jets': 'NYJ', 'newyorkjets': 'NYJ', 'nyjets': 'NYJ',
    // Eagles
    'philadelphia eagles': 'PHI', 'philadelphia': 'PHI', 'eagles': 'PHI', 'philadelphiaeagles': 'PHI',
    // Steelers
    'pittsburgh steelers': 'PIT', 'pittsburgh': 'PIT', 'steelers': 'PIT', 'pittsburghsteelers': 'PIT',
    // 49ers
    'san francisco 49ers': 'SF', 'san francisco': 'SF', '49ers': 'SF', 'sanfrancisco49ers': 'SF', 'niners': 'SF',
    // Seahawks
    'seattle seahawks': 'SEA', 'seattle': 'SEA', 'seahawks': 'SEA', 'seattleseahawks': 'SEA',
    // Buccaneers
    'tampa bay buccaneers': 'TB', 'tampa bay': 'TB', 'buccaneers': 'TB', 'bucs': 'TB', 'tampabaybuccaneers': 'TB', 'tampabay': 'TB',
    // Titans
    'tennessee titans': 'TEN', 'tennessee': 'TEN', 'titans': 'TEN', 'tennesseetitans': 'TEN',
    // Commanders
    'washington commanders': 'WAS', 'washington football team': 'WAS', 'washington redskins': 'WAS', 'washington': 'WAS', 'commanders': 'WAS', 'redskins': 'WAS', 'washingtoncommanders': 'WAS', 'washingtonredskins': 'WAS'
};

const DEFENSE_TEAM_NAMES = new Set(Object.keys(NFL_DEFENSE_TEAMS));

export function resolveDefAbbr(name) {
    if (!name) return null;
    const raw = String(name).trim();
    const isExplicitDef = /\b(dst|d\/st|def|defense)\b/i.test(raw);
    const cleanSpaced = raw.toLowerCase()
        .replace(/\b(dst|d\/st|def|defense)\b/gi, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const cleanCondensed = cleanSpaced.replace(/\s+/g, '');

    // 1. Direct exact match in dictionary (e.g. 'broncos', 'denver broncos', 'denverbroncos')
    if (NFL_DEFENSE_TEAMS[cleanSpaced]) return NFL_DEFENSE_TEAMS[cleanSpaced];
    if (NFL_DEFENSE_TEAMS[cleanCondensed]) return NFL_DEFENSE_TEAMS[cleanCondensed];

    // 2. If it explicitly contains 'DST', 'D/ST', 'DEF', or 'Defense', match against team name/mascot
    if (isExplicitDef) {
        for (const [key, abbr] of Object.entries(NFL_DEFENSE_TEAMS)) {
            if (key.length >= 4 && (cleanSpaced === key || cleanSpaced.includes(key) || cleanCondensed.includes(key))) {
                return abbr;
            }
        }
    }

    return null;
}

export class TransactionsEngine {
    constructor(options = {}) {
        this.containerId = options.containerId || 'view-transactions';
        this.transactions = options.transactions || [];
        this.playerStats = options.playerStats || [];
        this.managers = Array.isArray(options.managers) ? options.managers : (options.managers?.managers || []);
        this.draftResults = options.draftResults || [];
        this.matchups = options.matchups || [];
        this.leagueSettings = options.leagueSettings || {};
        this.seasonsMetadata = options.seasonsMetadata || [];
        this.formatSeasonYear = options.formatSeasonYear || ((y) => `${y}`);
        this.openThroughlineCallback = options.openThroughlineCallback || null;

        this.ldiEngine = new LDIEngine();
        
        // Active UI sub-view & filters
        this.activeSubTab = 'trades'; // 'trades' | 'overview' | 'h2h' | 'waivers' | 'feed'
        this.filterYear = 'all';
        this.filterType = 'all'; // 'all' | 'trade' | 'waiver' | 'free_agent' | 'drop'
        this.filterManager = 'all';
        this.filterSearch = '';
        this.h2hManager1 = '';
        this.h2hManager2 = '';

        // Leaderboard filters
        this.leaderboardMode = 'trades'; // 'trades' | 'pickups'
        this.leaderboardEra = 'all'; // 'all' | '2020' | 'custom'
        this.leaderboardCustomStart = 2018;
        this.leaderboardCustomEnd = 2026;
        this.leaderboardStatus = 'active'; // 'active' | 'all'
        this.leaderboardSeason = 'all';
        this.pickupSystem = 'all'; // 'all' | 'faab' | 'waiver'
        this.tradeSortKey = 'rating';
        this.tradeSortAsc = false;
        this.pickupSortKey = 'rating';
        this.pickupSortAsc = false;

        this.cachedEvaluations = null;
        this.init();
    }

    setData(data = {}) {
        if (data.transactions) this.transactions = data.transactions;
        if (data.playerStats) this.playerStats = data.playerStats;
        if (data.managers) this.managers = Array.isArray(data.managers) ? data.managers : (data.managers?.managers || []);
        if (data.draftResults) this.draftResults = data.draftResults;
        if (data.matchups) this.matchups = data.matchups;
        if (data.leagueSettings) this.leagueSettings = data.leagueSettings;
        if (data.seasonsMetadata) this.seasonsMetadata = data.seasonsMetadata;
        if (data.formatSeasonYear) this.formatSeasonYear = data.formatSeasonYear;
        this.cachedEvaluations = null;
        this.init();
    }

    init() {
        this.buildLookups();
        if (!this.transactions || this.transactions.length === 0) {
            const reconstructed = this.reconstructTransactionsFromRosters();
            if (reconstructed && reconstructed.length > 0) {
                this.transactions = reconstructed;
            }
        }
        if (this.transactions && this.transactions.length > 0) {
            this.transactions = this.pairUnilateralTransactions(this.transactions);
        }
        this.evaluateAllTransactions();
    }

    resolvePlayerName(pName) {
        if (!pName) return '';
        const str = String(pName).trim();
        const pIdMatch = str.match(/^Player ID\s*(\d+)$/i);
        if (pIdMatch) {
            const id = pIdMatch[1];
            if (espnAthletesData && espnAthletesData[id]?.name) {
                return espnAthletesData[id].name;
            }
        }
        if (espnAthletesData && espnAthletesData[str]?.name) {
            return espnAthletesData[str].name;
        }
        return str;
    }

    /**
     * Pairs unilateral adds and drops occurring in the same week for the same manager into unified transactions.
     * Provides full cross-platform parity between ESPN/reconstructed feeds and native Yahoo add/drop formats.
     */
    pairUnilateralTransactions(rawList) {
        if (!Array.isArray(rawList) || rawList.length === 0) return [];

        const trades = [];
        const alreadyPaired = [];
        const unilateralByBucket = new Map();

        const getTxTimestamp = (tx) => {
            if (!tx) return null;
            if (typeof tx.date === 'number' && !isNaN(tx.date) && tx.date > 0) return tx.date;
            if (tx.date) {
                const ms = new Date(tx.date).getTime();
                if (!isNaN(ms) && ms > 0) return ms;
            }
            return null;
        };

        rawList.forEach(rawT => {
            if (!rawT) return;

            // Discard draft events entirely
            if (rawT.action_type === 'DRAFT' || rawT.type === 'DRAFT') return;

            const adds = (Array.isArray(rawT.added_players) ? rawT.added_players : []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);
            const drops = (Array.isArray(rawT.dropped_players) ? rawT.dropped_players : []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);
            const traded = (Array.isArray(rawT.traded_players) ? rawT.traded_players : []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);
            const picks = (Array.isArray(rawT.draft_picks) ? rawT.draft_picks : []).filter(Boolean);

            let details = rawT.details || '';
            if (details) {
                details = details.replace(/Player ID\s*(\d+)/gi, (m, id) => {
                    return (espnAthletesData && espnAthletesData[id]?.name) || m;
                });
            }

            const t = {
                ...rawT,
                added_players: adds,
                dropped_players: drops,
                traded_players: traded,
                draft_picks: picks,
                details
            };

            const isTrade = t.type === 'trade' || t.action_type === 'TRADE';
            if (isTrade) {
                if (traded.length > 0 || adds.length > 0 || drops.length > 0 || picks.length > 0) {
                    trades.push(t);
                }
                return;
            }

            // Discard completely empty transactions
            if (adds.length === 0 && drops.length === 0 && traded.length === 0 && picks.length === 0) {
                return;
            }

            // If already has both added and dropped players, keep as already paired
            if (adds.length > 0 && drops.length > 0) {
                alreadyPaired.push(t);
                return;
            }

            const yr = Number(t.season || t.year);
            const wk = this.getTransactionWeek(t);
            const mgrObj = this.resolveManager(t.manager_id) || this.resolveManager(t.manager_name);
            const mId = mgrObj ? String(mgrObj.id).toLowerCase() : String(t.manager_id || '').toLowerCase().trim();
            const key = `${yr}_${wk}_${mId}`;

            if (!unilateralByBucket.has(key)) unilateralByBucket.set(key, []);
            unilateralByBucket.get(key).push(t);
        });

        const result = [...trades, ...alreadyPaired];

        unilateralByBucket.forEach(bucket => {
            const pureAdds = [];
            const pureDrops = [];

            bucket.forEach(t => {
                const adds = Array.isArray(t.added_players) ? t.added_players.filter(Boolean) : [];
                const drops = Array.isArray(t.dropped_players) ? t.dropped_players.filter(Boolean) : [];
                if (adds.length > 0) pureAdds.push(t);
                else if (drops.length > 0) pureDrops.push(t);
            });

            if (pureAdds.length > 0 && pureDrops.length > 0) {
                const addQueue = [...pureAdds];
                const dropQueue = [...pureDrops];

                // Helper to check if two transactions are close in time (within 48 hours)
                // If either has no specific timestamp (e.g. synthetic reconstructed week), allow pairing
                const canPairByTime = (txA, txB) => {
                    const timeA = getTxTimestamp(txA);
                    const timeB = getTxTimestamp(txB);
                    if (timeA === null || timeB === null) return true; // Reconstructed week moves
                    return Math.abs(timeA - timeB) <= 48 * 3600 * 1000;
                };

                // Attempt position matching first among temporally eligible pairs
                for (let i = addQueue.length - 1; i >= 0; i--) {
                    const aTx = addQueue[i];
                    const aName = aTx.added_players[0];
                    const aPos = this.getPlayerPosition(aName, aTx.season || aTx.year);

                    const dIdx = dropQueue.findIndex(dTx => {
                        if (!canPairByTime(aTx, dTx)) return false;
                        const dName = dTx.dropped_players[0];
                        const dPos = this.getPlayerPosition(dName, dTx.season || dTx.year);
                        return aPos && dPos && aPos === dPos;
                    });

                    if (dIdx !== -1) {
                        const dTx = dropQueue.splice(dIdx, 1)[0];
                        addQueue.splice(i, 1);
                        result.push({
                            ...aTx,
                            dropped_players: dTx.dropped_players,
                            details: `Added: ${aTx.added_players.join(', ')} · Dropped: ${dTx.dropped_players.join(', ')}${aTx.faab_bid > 0 ? ` · FAAB: $${aTx.faab_bid}` : (dTx.faab_bid > 0 ? ` · FAAB: $${dTx.faab_bid}` : '')}`
                        });
                    }
                }

                // Pair remaining temporally eligible adds with drops
                for (let i = addQueue.length - 1; i >= 0; i--) {
                    const aTx = addQueue[i];
                    const dIdx = dropQueue.findIndex(dTx => canPairByTime(aTx, dTx));
                    if (dIdx !== -1) {
                        const dTx = dropQueue.splice(dIdx, 1)[0];
                        addQueue.splice(i, 1);
                        result.push({
                            ...aTx,
                            dropped_players: dTx.dropped_players,
                            details: `Added: ${aTx.added_players.join(', ')} · Dropped: ${dTx.dropped_players.join(', ')}${aTx.faab_bid > 0 ? ` · FAAB: $${aTx.faab_bid}` : (dTx.faab_bid > 0 ? ` · FAAB: $${dTx.faab_bid}` : '')}`
                        });
                    }
                }

                // Any moves separated by > 48 hours remain clean unilateral moves
                addQueue.forEach(a => result.push(a));
                dropQueue.forEach(d => result.push(d));
            } else {
                pureAdds.forEach(a => result.push(a));
                pureDrops.forEach(d => result.push(d));
            }
        });

        // Sort chronologically
        result.sort((a, b) => {
            const yrA = Number(a.season || a.year || 0);
            const yrB = Number(b.season || b.year || 0);
            if (yrB !== yrA) return yrB - yrA;
            const wA = this.getTransactionWeek(a);
            const wB = this.getTransactionWeek(b);
            if (wB !== wA) return wB - wA;
            const dA = a.date ? new Date(a.date).getTime() : 0;
            const dB = b.date ? new Date(b.date).getTime() : 0;
            return dB - dA;
        });

        return result;
    }

    resolveManager(query) {
        if (!query) return null;
        const key = String(query).toLowerCase().trim();
        if (this.managerMap.has(key)) return this.managerMap.get(key);
        const norm = key.replace(/[^a-z0-9]/g, '');
        if (this.managerMap.has(norm)) return this.managerMap.get(norm);
        for (const [k, m] of this.managerMap.entries()) {
            if (k.includes(key) || key.includes(k)) return m;
        }
        return null;
    }

    reconstructTransactionsFromRosters() {
        if (!this.playerStats || this.playerStats.length === 0) return [];

        const managersList = Array.isArray(this.managers) ? this.managers : (this.managers?.managers || []);
        const mgrNameMap = new Map();
        managersList.forEach(m => {
            const id = String(m.id || m.manager_id).toLowerCase();
            mgrNameMap.set(id, m.alias || m.name || m.manager_name || m.display_name || id);
        });

        const seasonStatsMap = new Map();
        this.playerStats.forEach(s => {
            const yr = Number(s.season || s.year);
            if (!yr) return;
            if (!seasonStatsMap.has(yr)) seasonStatsMap.set(yr, []);
            seasonStatsMap.get(yr).push(s);
        });

        const seasonDraftMap = new Map();
        (this.draftResults || []).forEach(d => {
            const yr = Number(d.season || d.year);
            if (!yr) return;
            if (!seasonDraftMap.has(yr)) seasonDraftMap.set(yr, []);
            seasonDraftMap.get(yr).push(d);
        });

        const reconstructed = [];
        const seasons = Array.from(seasonStatsMap.keys()).sort((a, b) => a - b);

        for (const yr of seasons) {
            const stats = seasonStatsMap.get(yr) || [];
            const drafts = seasonDraftMap.get(yr) || [];

            const draftRosters = new Map();
            drafts.forEach(d => {
                const mid = String(d.manager_id || '').toLowerCase();
                if (!mid) return;
                if (!draftRosters.has(mid)) draftRosters.set(mid, new Set());
                draftRosters.get(mid).add(normalizeName(d.player_name || d.playerName));
            });

            const weeklyRosters = new Map();
            let maxWeek = 1;
            stats.forEach(s => {
                const w = Number(s.week || 1);
                if (w > maxWeek) maxWeek = w;
                const mid = String(s.manager_id || '').toLowerCase();
                const pName = s.player_name || s.playerName || '';
                const np = normalizeName(pName);
                if (!mid || !np) return;

                if (!weeklyRosters.has(w)) weeklyRosters.set(w, new Map());
                const weekMap = weeklyRosters.get(w);
                if (!weekMap.has(mid)) weekMap.set(mid, new Map());
                weekMap.get(mid).set(np, pName);
            });

            let priorRosters = new Map();

            // Week 1: detect players on roster not drafted
            const w1Map = weeklyRosters.get(1) || new Map();
            w1Map.forEach((pMap, mid) => {
                const draftedSet = draftRosters.get(mid) || new Set();
                pMap.forEach((rawName, np) => {
                    if (!draftedSet.has(np)) {
                        const mName = mgrNameMap.get(mid) || mid;
                        reconstructed.push({
                            year: yr,
                            season: yr,
                            week: 1,
                            date: new Date(yr, 8, 4, 12, 0).getTime(),
                            timestamp: `Sep 4, Week 1`,
                            action_type: 'WAIVER',
                            type: 'waiver',
                            team_id: 1,
                            team_name: `${mName}'s Team`,
                            manager_id: mid,
                            manager_name: mName,
                            trade_partner_team: '',
                            trade_partner_manager_id: '',
                            trade_partner_manager_name: '',
                            added_players: [rawName],
                            dropped_players: [],
                            traded_players: [],
                            faab_bid: 0,
                            details: `Added: ${rawName}`,
                            items: []
                        });
                    }
                });
            });

            priorRosters = w1Map;

            // Weeks 2 through maxWeek
            for (let w = 2; w <= maxWeek; w++) {
                const currMap = weeklyRosters.get(w) || new Map();

                const playersLeaving = new Map();
                priorRosters.forEach((pMap, mid) => {
                    const currPMap = currMap.get(mid) || new Map();
                    pMap.forEach((rawName, np) => {
                        if (!currPMap.has(np)) {
                            playersLeaving.set(np, { rawName, fromMid: mid });
                        }
                    });
                });

                const playersArriving = new Map();
                currMap.forEach((currPMap, toMid) => {
                    const priorPMap = priorRosters.get(toMid) || new Map();
                    currPMap.forEach((rawName, np) => {
                        if (!priorPMap.has(np)) {
                            playersArriving.set(np, { rawName, toMid });
                        }
                    });
                });

                const managerTransfers = new Map();

                playersArriving.forEach((arrInfo, np) => {
                    if (playersLeaving.has(np)) {
                        const leavInfo = playersLeaving.get(np);
                        if (leavInfo.fromMid !== arrInfo.toMid) {
                            const [mLow, mHigh] = [leavInfo.fromMid, arrInfo.toMid].sort();
                            const pairKey = `${mLow}__${mHigh}`;

                            if (!managerTransfers.has(pairKey)) {
                                managerTransfers.set(pairKey, {
                                    m1: mLow,
                                    m2: mHigh,
                                    m1Gets: [],
                                    m2Gets: []
                                });
                            }

                            const pair = managerTransfers.get(pairKey);
                            if (arrInfo.toMid === mLow) {
                                pair.m1Gets.push(arrInfo.rawName);
                            } else {
                                pair.m2Gets.push(arrInfo.rawName);
                            }
                        }
                    }
                });

                const txDate = new Date(yr, 8, Math.min(28, 4 + (w - 1) * 7), 14, 0).getTime();
                const txTimeStr = `Week ${w}, ${yr}`;
                const tradedPlayerNorms = new Set();

                // Bilateral trades (STRICTLY BILATERAL ONLY)
                managerTransfers.forEach((pair) => {
                    if (pair.m1Gets.length === 0 || pair.m2Gets.length === 0) {
                        return; // Unilateral move: not a trade, handled by waivers/drops below
                    }

                    pair.m1Gets.forEach(p => tradedPlayerNorms.add(normalizeName(p)));
                    pair.m2Gets.forEach(p => tradedPlayerNorms.add(normalizeName(p)));

                    const name1 = mgrNameMap.get(pair.m1) || pair.m1;
                    const name2 = mgrNameMap.get(pair.m2) || pair.m2;
                    const allTraded = [...pair.m1Gets, ...pair.m2Gets];
                    const p1Str = pair.m1Gets.join(', ');
                    const p2Str = pair.m2Gets.join(', ');
                    const details = `${name1} received ${p1Str}; ${name2} received ${p2Str}`;

                    reconstructed.push({
                        year: yr,
                        season: yr,
                        week: w,
                        date: txDate,
                        timestamp: txTimeStr,
                        action_type: 'TRADE',
                        type: 'trade',
                        team_id: 1,
                        team_name: `${name1}'s Team`,
                        manager_id: pair.m1,
                        manager_name: name1,
                        trade_partner_team: `${name2}'s Team`,
                        trade_partner_manager_id: pair.m2,
                        trade_partner_manager_name: name2,
                        added_players: pair.m1Gets,
                        dropped_players: pair.m2Gets,
                        partner_added_players: pair.m2Gets,
                        partner_dropped_players: pair.m1Gets,
                        traded_players: allTraded,
                        faab_bid: 0,
                        details: details,
                        items: []
                    });
                });

                // Group non-trade arrivals and departures by manager to pair adds & drops
                const mgrAddsMap = new Map();
                const mgrDropsMap = new Map();

                playersArriving.forEach((arrInfo, np) => {
                    if (!tradedPlayerNorms.has(np)) {
                        if (!mgrAddsMap.has(arrInfo.toMid)) mgrAddsMap.set(arrInfo.toMid, []);
                        mgrAddsMap.get(arrInfo.toMid).push(arrInfo.rawName);
                    }
                });

                playersLeaving.forEach((leavInfo, np) => {
                    if (!tradedPlayerNorms.has(np)) {
                        if (!mgrDropsMap.has(leavInfo.fromMid)) mgrDropsMap.set(leavInfo.fromMid, []);
                        mgrDropsMap.get(leavInfo.fromMid).push(leavInfo.rawName);
                    }
                });

                const allMids = new Set([...mgrAddsMap.keys(), ...mgrDropsMap.keys()]);
                allMids.forEach(mid => {
                    const adds = mgrAddsMap.get(mid) || [];
                    const drops = mgrDropsMap.get(mid) || [];
                    const mName = mgrNameMap.get(mid) || mid;

                    const addQueue = [...adds];
                    const dropQueue = [...drops];

                    // Position matching first
                    for (let i = addQueue.length - 1; i >= 0; i--) {
                        const aName = addQueue[i];
                        const aPos = this.getPlayerPosition(aName, yr);
                        const dropIdx = dropQueue.findIndex(dName => {
                            const dPos = this.getPlayerPosition(dName, yr);
                            return aPos && dPos && aPos === dPos;
                        });

                        if (dropIdx !== -1) {
                            const dName = dropQueue.splice(dropIdx, 1)[0];
                            addQueue.splice(i, 1);
                            reconstructed.push({
                                year: yr,
                                season: yr,
                                week: w,
                                date: txDate,
                                timestamp: txTimeStr,
                                action_type: 'WAIVER',
                                type: 'waiver',
                                team_id: 1,
                                team_name: `${mName}'s Team`,
                                manager_id: mid,
                                manager_name: mName,
                                trade_partner_team: '',
                                trade_partner_manager_id: '',
                                trade_partner_manager_name: '',
                                added_players: [aName],
                                dropped_players: [dName],
                                traded_players: [],
                                faab_bid: 0,
                                details: `Added: ${aName} · Dropped: ${dName}`,
                                items: []
                            });
                        }
                    }

                    // Pair remaining in order
                    while (addQueue.length > 0 && dropQueue.length > 0) {
                        const aName = addQueue.shift();
                        const dName = dropQueue.shift();
                        reconstructed.push({
                            year: yr,
                            season: yr,
                            week: w,
                            date: txDate,
                            timestamp: txTimeStr,
                            action_type: 'WAIVER',
                            type: 'waiver',
                            team_id: 1,
                            team_name: `${mName}'s Team`,
                            manager_id: mid,
                            manager_name: mName,
                            trade_partner_team: '',
                            trade_partner_manager_id: '',
                            trade_partner_manager_name: '',
                            added_players: [aName],
                            dropped_players: [dName],
                            traded_players: [],
                            faab_bid: 0,
                            details: `Added: ${aName} · Dropped: ${dName}`,
                            items: []
                        });
                    }

                    // Pure adds remaining
                    addQueue.forEach(aName => {
                        reconstructed.push({
                            year: yr,
                            season: yr,
                            week: w,
                            date: txDate,
                            timestamp: txTimeStr,
                            action_type: 'WAIVER',
                            type: 'waiver',
                            team_id: 1,
                            team_name: `${mName}'s Team`,
                            manager_id: mid,
                            manager_name: mName,
                            trade_partner_team: '',
                            trade_partner_manager_id: '',
                            trade_partner_manager_name: '',
                            added_players: [aName],
                            dropped_players: [],
                            traded_players: [],
                            faab_bid: 0,
                            details: `Added: ${aName}`,
                            items: []
                        });
                    });

                    // Pure drops remaining
                    dropQueue.forEach(dName => {
                        reconstructed.push({
                            year: yr,
                            season: yr,
                            week: w,
                            date: txDate,
                            timestamp: txTimeStr,
                            action_type: 'DROP',
                            type: 'free_agent',
                            team_id: 1,
                            team_name: `${mName}'s Team`,
                            manager_id: mid,
                            manager_name: mName,
                            trade_partner_team: '',
                            trade_partner_manager_id: '',
                            trade_partner_manager_name: '',
                            added_players: [],
                            dropped_players: [dName],
                            traded_players: [],
                            faab_bid: 0,
                            details: `Dropped: ${dName}`,
                            items: []
                        });
                    });
                });

                priorRosters = currMap;
            }
        }

        return reconstructed;
    }

    buildLookups() {
        // 1. Manager map: indexed by id, alias, name, full_name, display_name, username, slug, espn_id, platform_ids
        this.managerMap = new Map();
        (this.managers || []).forEach(m => {
            if (!m) return;
            const primaryId = String(m.id || m.manager_id || '').toLowerCase().trim();
            if (primaryId) this.managerMap.set(primaryId, m);
            if (m.alias) this.managerMap.set(String(m.alias).toLowerCase().trim(), m);
            if (m.name) this.managerMap.set(String(m.name).toLowerCase().trim(), m);
            if (m.full_name) this.managerMap.set(String(m.full_name).toLowerCase().trim(), m);
            if (m.display_name) this.managerMap.set(String(m.display_name).toLowerCase().trim(), m);
            if (m.username) this.managerMap.set(String(m.username).toLowerCase().trim(), m);
            if (m.slug) this.managerMap.set(String(m.slug).toLowerCase().trim(), m);
            if (m.espn_id) this.managerMap.set(String(m.espn_id).toLowerCase().trim(), m);
            if (Array.isArray(m.platform_ids)) {
                m.platform_ids.forEach(pid => this.managerMap.set(String(pid).toLowerCase().trim(), m));
            }
            if (Array.isArray(m.espn_ids)) {
                m.espn_ids.forEach(eid => this.managerMap.set(String(eid).toLowerCase().trim(), m));
            }

            const fullName = String(m.alias || m.name || m.full_name || '').trim();
            if (fullName) {
                const parts = fullName.split(/\s+/);
                const firstName = parts[0].toLowerCase();
                const normFull = fullName.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (!this.managerMap.has(firstName)) this.managerMap.set(firstName, m);
                if (!this.managerMap.has(normFull)) this.managerMap.set(normFull, m);
                if (parts.length > 1) {
                    const lastInitial = parts[parts.length - 1][0].toLowerCase();
                    const slugWithInit = `${firstName}_${lastInitial}`;
                    const normWithInit = `${firstName}${lastInitial}`;
                    if (!this.managerMap.has(slugWithInit)) this.managerMap.set(slugWithInit, m);
                    if (!this.managerMap.has(normWithInit)) this.managerMap.set(normWithInit, m);
                }
            }
        });

        // 2. Player position lookup across drafts and stats
        this.playerPositionMap = new Map();

        // 3. Weekly player stats map: `${season}_${normPlayerName}` -> array of weekly stats sorted by week
        this.playerStatsMap = new Map();
        (this.playerStats || []).forEach(stat => {
            const yr = Number(stat.season || stat.year);
            const np = normalizeName(stat.player_name || stat.playerName || '');
            if (!np || !yr) return;

            const rawSlot = String(stat.roster_slot || '').toUpperCase();
            const pos = stat.position || stat.pos || (['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(rawSlot) ? rawSlot : '');
            if (pos && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(pos)) {
                this.playerPositionMap.set(np, pos);
            }

            const key = `${yr}_${np}`;
            if (!this.playerStatsMap.has(key)) {
                this.playerStatsMap.set(key, []);
            }
            this.playerStatsMap.get(key).push({
                week: Number(stat.week || 1),
                points: Number(stat.fantasy_points ?? stat.points ?? 0),
                projected: Number(stat.projected_points ?? 0),
                isStarter: Boolean(stat.is_starter ?? (stat.roster_slot && stat.roster_slot !== 'BN' && stat.roster_slot !== 'IR')),
                rosterSlot: stat.roster_slot || '',
                teamId: stat.team_id,
                managerId: String(stat.manager_id || '').toLowerCase(),
                pos
            });
        });

        // Sort player weekly logs by week ascending
        this.playerStatsMap.forEach(logs => {
            logs.sort((a, b) => a.week - b.week);
        });

        // 4. Draft results map: `${season}_${normPlayerName}` -> pick
        this.draftPickMap = new Map();
        (this.draftResults || []).forEach(p => {
            const yr = Number(p.season || p.year);
            const np = normalizeName(p.player_name || p.playerName || '');
            if (!np || !yr) return;
            this.draftPickMap.set(`${yr}_${np}`, p);
            if (p.position && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position)) {
                this.playerPositionMap.set(np, p.position);
            }
        });

        // 5. Default H2H managers
        if (!this.h2hManager1 && this.managers.length > 0) {
            this.h2hManager1 = this.managers[0].id;
        }
        if (!this.h2hManager2 && this.managers.length > 1) {
            this.h2hManager2 = this.managers[1].id;
        }
    }

    /**
     * Resolves the canonical display name of a manager using members.json lookup first.
     */
    getManagerDisplayName(managerId, fallbackName = '') {
        const mgr = this.resolveManager(managerId) || this.resolveManager(fallbackName);
        if (mgr && (mgr.alias || mgr.name)) return mgr.alias || mgr.name;
        if (fallbackName) return fallbackName;
        return managerId || 'Manager';
    }

    /**
     * Detects whether the active league uses FAAB waivers or standard waiver priority.
     */
    leagueUsesFaab() {
        if (this.leagueSettings?.has_faab !== undefined) {
            return Boolean(this.leagueSettings.has_faab);
        }
        if (this.leagueSettings?.waiver_type) {
            return this.leagueSettings.waiver_type.toLowerCase() === 'faab';
        }
        const hasBudget = (this.seasonsMetadata || []).some(s => Number(s.faab_budget || 0) > 0);
        if (hasBudget) return true;

        if (this.leagueSettings?.faab_budgets && Object.values(this.leagueSettings.faab_budgets).some(b => Number(b) > 0)) {
            return true;
        }

        const hasBids = (this.transactions || []).some(t => Number(t.faab_bid || t.bidAmount || 0) > 0);
        return hasBids;
    }

    /**
     * Resolves the verified position of a player.
     */
    getPlayerPosition(playerName, season) {
        const np = normalizeName(playerName);
        const raw = String(playerName || '').toLowerCase();
        const isExplicitDef = /\b(dst|d\/st|def|defense)\b/i.test(raw);

        if (isExplicitDef || DEFENSE_TEAM_NAMES.has(np)) {
            return 'DEF';
        }

        const pick = this.draftPickMap.get(`${season}_${np}`);
        if (pick?.position && pick.position !== 'W/R/T' && pick.position !== 'FLEX') {
            return pick.position;
        }

        const logs = this.playerStatsMap.get(`${season}_${np}`) || [];
        const validLog = logs.find(l => l.pos && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(l.pos));
        if (validLog) return validLog.pos;

        if (this.playerPositionMap.has(np)) {
            return this.playerPositionMap.get(np);
        }

        if (Boolean(resolveDefAbbr(playerName))) {
            return 'DEF';
        }

        return 'WR';
    }

    /**
     * Checks if a player is a skill-position player (QB, RB, WR, TE).
     */
    isSkillPosition(playerName, season) {
        const pos = this.getPlayerPosition(playerName, season);
        return ['QB', 'RB', 'WR', 'TE'].includes(pos);
    }

    /**
     * Dynamically determines the starting FAAB budget for a given season.
     */
    getSeasonFaabBudget(season) {
        const yr = Number(season);

        // 1. Explicit metadata in seasonsMetadata
        const meta = (this.seasonsMetadata || []).find(m => Number(m.season || m.year) === yr);
        if (meta && typeof meta.faab_budget === 'number' && meta.faab_budget >= 0) {
            return meta.faab_budget;
        }

        // 2. League settings
        if (this.leagueSettings?.faab_budgets?.[yr]) {
            return Number(this.leagueSettings.faab_budgets[yr]);
        }
        if (this.leagueSettings?.seasons?.[yr]?.faab_budget) {
            return Number(this.leagueSettings.seasons[yr].faab_budget);
        }

        // 3. Dynamic detection from transaction bids in this season
        const seasonTxs = (this.transactions || []).filter(t => Number(t.season || t.year) === yr);
        const bids = seasonTxs.map(t => Number(t.faab_bid || t.bidAmount || 0)).filter(b => b > 0);
        if (bids.length > 0) {
            const maxBid = Math.max(...bids);
            if (maxBid > 200) return 1000;
            if (maxBid > 100) return 1000;
            return 100;
        }

        // 4. Default fallbacks for DMS
        if (yr >= 2027) return 100;
        if (yr >= 2024 && yr < 2027) return 1000;
        return 0; // 2018-2023 were rolling priority waivers
    }

    /**
     * Estimates or retrieves the exact regular season week for a transaction.
     */
    getTransactionWeek(tx) {
        if (tx.week && Number(tx.week) > 0) return Number(tx.week);
        const ts = tx.timestamp || tx.date || '';

        let txDate = null;
        if (typeof ts === 'number') {
            txDate = new Date(ts);
        } else if (typeof ts === 'string' && ts.trim()) {
            const parsed = Date.parse(ts);
            if (!isNaN(parsed)) {
                txDate = new Date(parsed);
            } else {
                const parts = ts.match(/([a-zA-Z]+)\s+(\d+)/);
                if (parts) {
                    const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
                    const mIdx = months[parts[1].toLowerCase().slice(0, 3)];
                    if (mIdx !== undefined) {
                        const yr = Number(tx.season || tx.year || 2024);
                        const calYear = (mIdx < 3) ? yr : (yr - 1);
                        txDate = new Date(calYear, mIdx, parseInt(parts[2], 10));
                    }
                }
            }
        }

        if (txDate) {
            const calYear = txDate.getFullYear();
            // If the transaction occurred in Jan/Feb/March, it belongs to the previous calendar year's NFL regular season
            if (txDate.getMonth() < 3) {
                const prevKickoff = new Date(calYear - 1, 8, 7);
                const diffDays = Math.floor((txDate - prevKickoff) / (1000 * 60 * 60 * 24));
                return Math.min(18, Math.max(1, Math.floor(diffDays / 7) + 1));
            }

            const kickoff = new Date(calYear, 8, 7);
            const diffDays = Math.floor((txDate - kickoff) / (1000 * 60 * 60 * 24));
            if (diffDays < 0) return 0; // Preseason
            return Math.min(18, Math.max(1, Math.floor(diffDays / 7) + 1));
        }

        return 1;
    }

    /**
     * Determines whether the league uses championship year basis (e.g. Yahoo/DMS where season year is kickoff year + 1).
     */
    isRawChampionshipYearBasis() {
        const setting = this.leagueSettings?.raw_year_basis;
        if (setting === 'championship') return true;
        if (setting === 'kickoff') return false;
        const platform = (this.leagueSettings?.platform || '').toLowerCase();
        if (platform === 'yahoo') return true;
        const name = (this.leagueSettings?.name || '').toLowerCase();
        if (name.includes('dumbarton') || name.includes('dms')) return true;
        if (typeof window !== 'undefined' && window.location && window.location.pathname.includes('dmsfantasy')) return true;
        if (this.seasonsMetadata && this.seasonsMetadata.some(s => s.season === 2018 || s.season === 2026)) {
            const s2018 = this.seasonsMetadata.find(s => s.season === 2018);
            if (s2018 && s2018.total_weeks_scraped === 17) return true;
        }
        if (this.playerStats && this.playerStats.some(s => Number(s.season || s.year) === 2026 && Number(s.week || 0) >= 16)) {
            return true;
        }
        return false;
    }

    /**
     * Converts a league season identifier to the corresponding NFL calendar season year.
     */
    getNflYear(season) {
        const yr = Number(season);
        return this.isRawChampionshipYearBasis() ? yr - 1 : yr;
    }

    /**
     * Checks if a season is unplayed (kickoff pending or 0 games completed).
     */
    isSeasonUnplayed(season) {
        const yr = Number(season);
        if (!yr) return false;

        // 1. Explicitly 0 weeks scraped in seasonsMetadata
        if (this.seasonsMetadata && this.seasonsMetadata.length > 0) {
            const meta = this.seasonsMetadata.find(s => Number(s.season || s.year) === yr);
            if (meta && meta.total_weeks_scraped === 0) return true;
        }

        // 2. Matchups check: has any game been completed?
        if (this.matchups && this.matchups.length > 0) {
            const seasonMatchups = this.matchups.filter(m => Number(m.year || m.season) === yr);
            if (seasonMatchups.length > 0) {
                const hasCompletedGame = seasonMatchups.some(m => {
                    const s1 = Number(m.home_score ?? m.team_1_actual_points ?? 0);
                    const s2 = Number(m.away_score ?? m.team_2_actual_points ?? 0);
                    return s1 > 0 || s2 > 0 || (m.winner && m.winner !== 'UNDECIDED' && m.winner !== 'N/A');
                });
                if (!hasCompletedGame) return true;
            }
        }

        // 3. Player stats check
        if (this.playerStats && this.playerStats.length > 0) {
            const seasonStats = this.playerStats.filter(s => Number(s.season || s.year) === yr);
            if (seasonStats.length === 0) {
                const allYears = Array.from(new Set(this.playerStats.map(s => Number(s.season || s.year)).filter(Boolean)));
                const maxYear = Math.max(...allYears, 0);
                if (yr > maxYear) return true;
            } else {
                const hasPoints = seasonStats.some(s => Number(s.fantasy_points ?? s.points ?? 0) > 0);
                if (!hasPoints) return true;
            }
        }

        return false;
    }

    /**
     * Resolves the maximum real matchup week played by the league in a given season,
     * ensuring unplayed NFL weeks (e.g. Week 18, or Week 17 in earlier eras) are completely excluded.
     */
    getLeagueMaxWeek(season) {
        const yr = Number(season);
        if (this.isSeasonUnplayed(yr)) {
            return 0;
        }
        if (this.playerStats && this.playerStats.length > 0) {
            const realGames = this.playerStats.filter(s => 
                s.season === yr && 
                s.matchup_result && 
                s.matchup_result !== 'N/A' && 
                s.opponent_team_name !== 'BYE' && 
                (s.team_score > 0 || s.points > 0)
            );
            if (realGames.length > 0) {
                return Math.max(...realGames.map(s => s.week));
            }
        }
        return yr >= 2022 ? 17 : 16;
    }

    /**
     * Calculates LTI (Landon Transaction Index), points, and positional VORP within a specific window of weeks.
     */
    calculatePlayerLtiWindow(playerName, season, startWeek, endWeek) {
        const yr = Number(season);
        const leagueMaxWeek = this.getLeagueMaxWeek(yr);
        const effectiveEndWeek = Math.min(endWeek, leagueMaxWeek);
        const np = normalizeName(playerName);
        const pos = this.getPlayerPosition(playerName, yr);
        const logs = this.playerStatsMap.get(`${yr}_${np}`) || [];

        let windowLogs = logs.filter(l => l.week >= startWeek && l.week <= effectiveEndWeek);

        // Fallback for unrostered NFL Team Defenses: incorporate real-world NFL fantasy scoring
        if (pos === 'DEF' && effectiveEndWeek >= startWeek) {
            const defAbbr = resolveDefAbbr(playerName);
            if (defAbbr) {
                const nflYr = this.getNflYear(yr);
                for (let w = startWeek; w <= effectiveEndWeek; w++) {
                    if (!windowLogs.some(l => l.week === w)) {
                        const defKey = `${nflYr}_${defAbbr}_${w}`;
                        if (nflDefenseStats && nflDefenseStats[defKey] !== undefined) {
                            windowLogs.push({
                                week: w,
                                points: Number(nflDefenseStats[defKey]),
                                projected: 8.0,
                                isStarter: false,
                                rosterSlot: 'DEF',
                                pos: 'DEF'
                            });
                        }
                    }
                }
                windowLogs.sort((a, b) => a.week - b.week);
            }
        }

        const weeklyPoints = windowLogs.map(l => l.points);
        const totalPoints = weeklyPoints.reduce((s, p) => s + p, 0);
        const gamesPlayed = pos === 'DEF' ? weeklyPoints.length : weeklyPoints.filter(p => p > 0).length;
        const ppg = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0;

        const windowWeeks = Math.max(1, effectiveEndWeek - startWeek + 1);
        const isSkill = ['QB', 'RB', 'WR', 'TE'].includes(pos);
        const replPpg = POSITIONAL_REPLACEMENT_PPG[pos] || (pos === 'DEF' ? 8.0 : (pos === 'K' ? 7.5 : 8.0));

        // VORP over the window
        const vorpPoints = Math.round((totalPoints - (replPpg * gamesPlayed)) * 10) / 10;
        const posVorpPpg = Math.round((ppg - replPpg) * 10) / 10;

        if (gamesPlayed === 0) {
            // Player missed the entire window (inactive, injured, unrostered, or 0 games played)
            // Evaluates zero fantasy output against replacement expectation
            const vorpPoints = Math.round((0 - (replPpg * windowWeeks)) * 10) / 10;
            const posVorpPpg = -replPpg;
            const z = vorpPoints / (14.0 * Math.sqrt(Math.max(1, windowWeeks)));
            const ltiScore = Math.max(1, Math.min(99, Math.round(standardNormalCdf(z) * 100)));
            return {
                ltiScore,
                totalPoints: 0,
                effectivePoints: 0,
                gamesPlayed: 0,
                ppg: 0,
                vorpPoints,
                posVorpPpg,
                position: pos,
                weeklyPoints: []
            };
        }

        if (!isSkill) {
            // Kickers and Defenses: LTI calibrated by VORP against positional baseline
            const z = vorpPoints / (14.0 * Math.sqrt(Math.max(1, windowWeeks)));
            const ltiScore = Math.max(1, Math.min(99, Math.round(standardNormalCdf(z) * 100)));
            return {
                ltiScore,
                totalPoints: Math.round(totalPoints * 10) / 10,
                effectivePoints: Math.round(totalPoints * 10) / 10,
                gamesPlayed,
                ppg: Math.round(ppg * 10) / 10,
                vorpPoints,
                posVorpPpg,
                position: pos,
                weeklyPoints
            };
        }

        if (pos === 'QB') {
            // Quarterbacks in 1-QB leagues have high scoring baselines (16.5 PPG).
            // Discount QB effectivePoints to flex-starter scale so their raw baseline does not distort skill player trades:
            // effectivePoints = (5.5 flex baseline + Math.max(0, posVorpPpg)) * gamesPlayed
            const qbEffectivePpg = 5.5 + Math.max(0, posVorpPpg);
            const effectivePoints = Math.round(qbEffectivePpg * gamesPlayed * 10) / 10;
            const z = vorpPoints / (14.0 * Math.sqrt(Math.max(1, windowWeeks)));
            const ltiScore = Math.max(1, Math.min(99, Math.round(standardNormalCdf(z) * 100)));
            return {
                ltiScore,
                totalPoints: Math.round(totalPoints * 10) / 10,
                effectivePoints,
                gamesPlayed,
                ppg: Math.round(ppg * 10) / 10,
                vorpPoints,
                posVorpPpg,
                position: pos,
                weeklyPoints
            };
        }

        // Monotonic LTI calibration directly tied to Value Over Replacement Player (VORP)
        // 0 VORP = 50 LTI (replacement level). Higher VORP strictly yields higher LTI.
        const z = vorpPoints / (14.0 * Math.sqrt(Math.max(1, windowWeeks)));
        const ltiScore = Math.max(1, Math.min(99, Math.round(standardNormalCdf(z) * 100)));

        return {
            ltiScore,
            totalPoints: Math.round(totalPoints * 10) / 10,
            effectivePoints: Math.round(totalPoints * 10) / 10,
            gamesPlayed,
            ppg: Math.round(ppg * 10) / 10,
            vorpPoints,
            posVorpPpg,
            position: pos,
            weeklyPoints
        };
    }

    /**
     * Statistically extrapolates rest-of-season scoring rate for traded players who missed games due to injury.
     * Incorporates Bayesian shrinkage against the player's broader season sample and positional baselines,
     * honoring the LDI golden rule of never punishing injuries while protecting against small-sample hot streaks.
     */
    getExtrapolatedMissedPpg(pEval, remainingWeeks) {
        const post = pEval?.postTrade || pEval || {};
        const gp = post.gamesPlayed || 0;
        if (gp >= remainingWeeks) return post.ppg || 0;

        const pos = post.position;
        // For QBs, discount to flex-starter effective scale to prevent raw QB baselines from distorting trades
        const isQb = pos === 'QB';
        const effectivePostPpg = isQb 
            ? (post.effectivePoints !== undefined && gp > 0 ? post.effectivePoints / gp : 5.5 + Math.max(0, post.posVorpPpg))
            : (post.ppg || 0);

        // Positional starter baselines
        const starterBaseline = isQb ? 9.0 : (pos === 'RB' ? 11.5 : (pos === 'WR' ? 11.0 : (pos === 'TE' ? 8.0 : 5.5)));

        // Prior baseline: combine pre-trade games if available to establish larger full-season sample
        let priorPpg = starterBaseline;
        if (pEval.preTrade && pEval.preTrade.gamesPlayed >= 2) {
            const preGp = pEval.preTrade.gamesPlayed;
            const prePts = isQb ? (pEval.preTrade.effectivePoints || pEval.preTrade.totalPoints) : pEval.preTrade.totalPoints;
            const postPts = isQb ? (post.effectivePoints || post.totalPoints) : post.totalPoints;
            priorPpg = Math.round(((prePts + postPts) / (preGp + gp)) * 10) / 10;
        } else if (effectivePostPpg < starterBaseline) {
            priorPpg = Math.max(5.5, effectivePostPpg);
        }

        // Bayesian sample-size shrinkage:
        // 8+ games played = 100% confidence in actual post-trade performance (alpha = 1.0)
        // Smaller samples smoothly regress toward the broader player/positional baseline
        const alpha = Math.max(0, Math.min(1.0, gp / 8.0));
        const extrapolatedPpg = Math.round((alpha * effectivePostPpg + (1 - alpha) * priorPpg) * 10) / 10;

        return Math.max(5.5, extrapolatedPpg);
    }

    /**
     * Evaluates a single trade transaction with lineup consolidation nuance.
     */
    evaluateTrade(tx) {
        const yr = Number(tx.season || tx.year);
        const isPending = this.isSeasonUnplayed(yr);
        const totalWeeks = this.getLeagueMaxWeek(yr);
        const tradeWeek = this.getTransactionWeek(tx);
        const isPreseason = tradeWeek === 0;

        const team1Name = tx.team_name || 'Team 1';
        const team1MgrId = String(tx.manager_id || '').toLowerCase();
        const team1MgrName = this.getManagerDisplayName(team1MgrId, tx.manager_name || team1Name);

        const team2Name = tx.trade_partner_team || 'Team 2';
        const team2MgrId = String(tx.trade_partner_manager_id || '').toLowerCase();
        const team2MgrName = this.getManagerDisplayName(team2MgrId, tx.trade_partner_manager_name || team2Name);

        const team1Players = (Array.isArray(tx.added_players) ? tx.added_players : []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);
        const team2Players = (Array.isArray(tx.dropped_players) ? tx.dropped_players : (Array.isArray(tx.partner_added_players) ? tx.partner_added_players : [])).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);

        if (isPending) {
            const team1Evaluations = team1Players.map(pName => {
                const pos = this.getPlayerPosition(pName, yr) || 'UTIL';
                return {
                    playerName: pName,
                    position: pos,
                    preTrade: null,
                    postTrade: {
                        ltiScore: 50,
                        totalPoints: 0,
                        effectivePoints: 0,
                        gamesPlayed: 0,
                        ppg: 0,
                        vorpPoints: 0,
                        posVorpPpg: 0,
                        position: pos,
                        weeklyPoints: []
                    },
                    missedWeeks: 0,
                    eligibleMissedWeeks: 0,
                    extrapPpg: 0,
                    missedPoints: 0,
                    effectivePoints: 0,
                    effectiveLti: 50
                };
            });

            const team2Evaluations = team2Players.map(pName => {
                const pos = this.getPlayerPosition(pName, yr) || 'UTIL';
                return {
                    playerName: pName,
                    position: pos,
                    preTrade: null,
                    postTrade: {
                        ltiScore: 50,
                        totalPoints: 0,
                        effectivePoints: 0,
                        gamesPlayed: 0,
                        ppg: 0,
                        vorpPoints: 0,
                        posVorpPpg: 0,
                        position: pos,
                        weeklyPoints: []
                    },
                    missedWeeks: 0,
                    eligibleMissedWeeks: 0,
                    extrapPpg: 0,
                    missedPoints: 0,
                    effectivePoints: 0,
                    effectiveLti: 50
                };
            });

            return {
                id: tx.id || `${yr}_trade_${Math.random().toString(36).substring(2, 7)}`,
                season: yr,
                week: tradeWeek,
                isPreseason,
                isPending: true,
                timestamp: tx.timestamp || tx.date || '',
                team1: {
                    name: team1Name,
                    managerId: team1MgrId,
                    managerName: team1MgrName,
                    players: team1Evaluations,
                    rosPoints: 0,
                    rawPoints: 0,
                    missedBackfill: 0,
                    openSlots: 0,
                    openSlotPoints: 0,
                    lineupPoints: 0,
                    vorp: 0,
                    avgRosLti: 50,
                    avgPreLti: 50,
                    netPoints: 0,
                    netLti: 0,
                    ltiSurplus: 0,
                    isWinner: false
                },
                team2: {
                    name: team2Name,
                    managerId: team2MgrId,
                    managerName: team2MgrName,
                    players: team2Evaluations,
                    rosPoints: 0,
                    rawPoints: 0,
                    missedBackfill: 0,
                    openSlots: 0,
                    openSlotPoints: 0,
                    lineupPoints: 0,
                    vorp: 0,
                    avgRosLti: 50,
                    avgPreLti: 50,
                    netPoints: 0,
                    netLti: 0,
                    ltiSurplus: 0,
                    isWinner: false
                },
                pointDifference: 0,
                ltiDifference: 0,
                weeklyMargin: 0,
                isUneven: team1Players.length !== team2Players.length,
                verdict: 'Season Pending',
                gradeBadge: 'pending',
                rawTx: tx
            };
        }

        // 1. Evaluate Team 1 incoming players
        const team1Evaluations = team1Players.map(pName => {
            const preTrade = isPreseason ? null : this.calculatePlayerLtiWindow(pName, yr, 1, Math.max(1, tradeWeek));
            const postTrade = this.calculatePlayerLtiWindow(pName, yr, isPreseason ? 1 : tradeWeek + 1, totalWeeks);
            const position = postTrade?.position || preTrade?.position || this.getPlayerPosition(pName, yr) || 'UTIL';
            return {
                playerName: pName,
                position,
                preTrade,
                postTrade
            };
        });

        // 2. Evaluate Team 2 incoming players
        const team2Evaluations = team2Players.map(pName => {
            const preTrade = isPreseason ? null : this.calculatePlayerLtiWindow(pName, yr, 1, Math.max(1, tradeWeek));
            const postTrade = this.calculatePlayerLtiWindow(pName, yr, isPreseason ? 1 : tradeWeek + 1, totalWeeks);
            const position = postTrade?.position || preTrade?.position || this.getPlayerPosition(pName, yr) || 'UTIL';
            return {
                playerName: pName,
                position,
                preTrade,
                postTrade
            };
        });

        const count1 = team1Evaluations.length;
        const count2 = team2Evaluations.length;
        const maxSlots = Math.max(count1, count2);
        const remainingWeeks = Math.max(1, totalWeeks - (isPreseason ? 0 : tradeWeek));
        const REPLACEMENT_STARTER_PPG = 5.5; // Realistic waiver flex replacement in 12-team leagues

        // Wear-and-tear cutoff curve: normal variance (minor injuries) is not prorated (LDI Section 4.3)
        // Scaled to remaining trade window: ~4 missed games in 16-game season -> Math.max(1, Math.round(W / 4))
        const wearCutoff = Math.max(1, Math.round(remainingWeeks / 4));

        // 3. Extrapolate injuries per LDI golden rule & compute starting equity per player
        let team1MissedBackfill = 0;
        let team2MissedBackfill = 0;

        team1Evaluations.forEach(e => {
            const gp = e.postTrade.gamesPlayed || 0;
            const missed = isPreseason ? 0 : Math.max(0, remainingWeeks - gp);
            const rawExtrap = missed > 0 ? this.getExtrapolatedMissedPpg(e, remainingWeeks) : (e.postTrade.ppg || 0);
            const extrapPpg = Math.max(REPLACEMENT_STARTER_PPG, rawExtrap);

            // Wear-and-tear cutoff curve: normal variance (minor injuries <= wearCutoff) is not prorated (LDI Section 4.3).
            // Zero points are added for absences within normal wear-and-tear.
            // Only severe absences beyond the cutoff qualify for Bayesian rate extrapolation.
            const eligibleMissed = Math.max(0, missed - wearCutoff);
            const missedPoints = Math.round(eligibleMissed * extrapPpg * 10) / 10;
            const basePoints = e.postTrade.effectivePoints !== undefined ? e.postTrade.effectivePoints : e.postTrade.totalPoints;
            const effectivePoints = Math.round((basePoints + missedPoints) * 10) / 10;
            
            // Effective LTI reflecting starting contribution over remaining weeks
            const pos = e.position;
            const replPpg = POSITIONAL_REPLACEMENT_PPG[pos] || 8.0;
            const effectiveVorp = Math.round((effectivePoints - (replPpg * remainingWeeks)) * 10) / 10;
            const z = effectiveVorp / (14.0 * Math.sqrt(Math.max(1, remainingWeeks)));
            const effectiveLti = Math.max(1, Math.min(99, Math.round(standardNormalCdf(z) * 100)));

            e.missedWeeks = missed;
            e.eligibleMissedWeeks = eligibleMissed;
            e.extrapPpg = extrapPpg;
            e.missedPoints = missedPoints;
            e.effectivePoints = effectivePoints;
            e.effectiveLti = effectiveLti;
            team1MissedBackfill += missedPoints;
        });

        team2Evaluations.forEach(e => {
            const gp = e.postTrade.gamesPlayed || 0;
            const missed = isPreseason ? 0 : Math.max(0, remainingWeeks - gp);
            const rawExtrap = missed > 0 ? this.getExtrapolatedMissedPpg(e, remainingWeeks) : (e.postTrade.ppg || 0);
            const extrapPpg = Math.max(REPLACEMENT_STARTER_PPG, rawExtrap);

            // Wear-and-tear cutoff curve: normal variance (minor injuries <= wearCutoff) is not prorated (LDI Section 4.3).
            // Zero points are added for absences within normal wear-and-tear.
            // Only severe absences beyond the cutoff qualify for Bayesian rate extrapolation.
            const eligibleMissed = Math.max(0, missed - wearCutoff);
            const missedPoints = Math.round(eligibleMissed * extrapPpg * 10) / 10;
            const basePoints = e.postTrade.effectivePoints !== undefined ? e.postTrade.effectivePoints : e.postTrade.totalPoints;
            const effectivePoints = Math.round((basePoints + missedPoints) * 10) / 10;
            
            // Effective LTI reflecting starting contribution over remaining weeks
            const pos = e.position;
            const replPpg = POSITIONAL_REPLACEMENT_PPG[pos] || 8.0;
            const effectiveVorp = Math.round((effectivePoints - (replPpg * remainingWeeks)) * 10) / 10;
            const z = effectiveVorp / (14.0 * Math.sqrt(Math.max(1, remainingWeeks)));
            const effectiveLti = Math.max(1, Math.min(99, Math.round(standardNormalCdf(z) * 100)));

            e.missedWeeks = missed;
            e.eligibleMissedWeeks = eligibleMissed;
            e.extrapPpg = extrapPpg;
            e.missedPoints = missedPoints;
            e.effectivePoints = effectivePoints;
            e.effectiveLti = effectiveLti;
            team2MissedBackfill += missedPoints;
        });

        team1MissedBackfill = Math.round(team1MissedBackfill * 10) / 10;
        team2MissedBackfill = Math.round(team2MissedBackfill * 10) / 10;

        // 4. Starting Lineup Consolidation & Roster Opportunity Cost (2-for-1 trust)
        const team1RawPoints = Math.round(team1Evaluations.reduce((s, e) => s + e.postTrade.totalPoints, 0) * 10) / 10;
        const team2RawPoints = Math.round(team2Evaluations.reduce((s, e) => s + e.postTrade.totalPoints, 0) * 10) / 10;
        const team1RosPoints = Math.round(team1Evaluations.reduce((s, e) => s + (e.postTrade.effectivePoints !== undefined ? e.postTrade.effectivePoints : e.postTrade.totalPoints), 0) * 10) / 10;
        const team2RosPoints = Math.round(team2Evaluations.reduce((s, e) => s + (e.postTrade.effectivePoints !== undefined ? e.postTrade.effectivePoints : e.postTrade.totalPoints), 0) * 10) / 10;
        const team1Vorp = Math.round(team1Evaluations.reduce((s, e) => s + e.postTrade.vorpPoints, 0) * 10) / 10;
        const team2Vorp = Math.round(team2Evaluations.reduce((s, e) => s + e.postTrade.vorpPoints, 0) * 10) / 10;

        let team1OpenSlots = 0;
        let team2OpenSlots = 0;
        let team1OpenSlotPoints = 0;
        let team2OpenSlotPoints = 0;

        const VACANT_SLOT_PPG = 8.5; // Dedicated replacement baseline giving full credit to consolidating managers (2-for-1 or 3-for-2)
        if (!isPreseason) {
            if (count1 < count2) {
                team1OpenSlots = count2 - count1;
                team1OpenSlotPoints = Math.round(team1OpenSlots * remainingWeeks * VACANT_SLOT_PPG * 10) / 10;
            } else if (count2 < count1) {
                team2OpenSlots = count1 - count2;
                team2OpenSlotPoints = Math.round(team2OpenSlots * remainingWeeks * VACANT_SLOT_PPG * 10) / 10;
            }
        }

        const team1LineupPoints = Math.round((team1RosPoints + team1MissedBackfill + team1OpenSlotPoints) * 10) / 10;
        const team2LineupPoints = Math.round((team2RosPoints + team2MissedBackfill + team2OpenSlotPoints) * 10) / 10;

        // Net Points Delta (lineup-adjusted)
        const netPointsSide1 = Math.round((team1LineupPoints - team2LineupPoints) * 10) / 10;
        const netPointsSide2 = -netPointsSide1;
        const absDiff = Math.abs(netPointsSide1);

        // Weekly starting margin per starting slot
        const weeklyMargin = remainingWeeks > 0 ? netPointsSide1 / remainingWeeks : 0;
        const absWeeklyMargin = Math.abs(weeklyMargin);

        // Inconclusivity Dampener: dynamic confidence factor based on post-deal games missed across all traded players
        const totalExpectedWeeks = (count1 + count2) * remainingWeeks;
        const totalMissedWeeks = team1Evaluations.reduce((s, e) => s + e.missedWeeks, 0) + team2Evaluations.reduce((s, e) => s + e.missedWeeks, 0);
        const missedRate = totalExpectedWeeks > 0 ? Math.min(1.0, totalMissedWeeks / totalExpectedWeeks) : 0;
        const confidenceFactor = Math.max(0.70, 1.0 - (0.30 * missedRate));

        // Net LTI Delta: strictly monotonic with starting lineup margin, tempered by empirical trade conclusiveness
        // A margin of ~1.0 PPG equates to ~5 LTI; ~8.5+ PPG equates to ~43+ LTI (True Fleece).
        // Zero points differential strictly equals 0 LTI differential.
        const rawLtiDelta = Math.min(49, Math.max(1, Math.round(absWeeklyMargin * 5.0)));
        const dampenedLtiDelta = Math.max(1, Math.round(rawLtiDelta * confidenceFactor));
        const netLtiSide1 = netPointsSide1 === 0 
            ? 0 
            : (netPointsSide1 > 0 ? 1 : -1) * Math.min(49, dampenedLtiDelta);
        const netLtiSide2 = -netLtiSide1;
        const absLti = Math.abs(netLtiSide1);

        // Starting talent composite LTI (balanced by open slot replacement baseline of 50)
        const team1StartingLti = maxSlots > 0 
            ? Math.round((team1Evaluations.reduce((s, e) => s + e.effectiveLti, 0) + (team1OpenSlots * 50)) / maxSlots)
            : 50;
        const team2StartingLti = maxSlots > 0 
            ? Math.round((team2Evaluations.reduce((s, e) => s + e.effectiveLti, 0) + (team2OpenSlots * 50)) / maxSlots)
            : 50;

        const team1AvgPreLti = isPreseason ? 50 : (team1Evaluations.length > 0 
            ? Math.round(team1Evaluations.reduce((s, e) => s + (e.preTrade?.ltiScore || 50), 0) / team1Evaluations.length)
            : 50);
        const team2AvgPreLti = isPreseason ? 50 : (team2Evaluations.length > 0 
            ? Math.round(team2Evaluations.reduce((s, e) => s + (e.preTrade?.ltiScore || 50), 0) / team2Evaluations.length)
            : 50);

        // 5. Verdict determination: strictly based on Net LTI Delta
        let verdict = 'Balanced Deal';
        let winnerSide = 0; // 0 = tie/balanced, 1 = team1, 2 = team2
        let gradeBadge = 'verdict-balanced';

        if (absLti < 6) {
            verdict = 'Balanced Deal';
            winnerSide = 0;
            gradeBadge = 'verdict-balanced';
        } else {
            winnerSide = netPointsSide1 > 0 ? 1 : 2;

            if (absLti >= 43) {
                verdict = 'True Fleece';
                gradeBadge = 'verdict-fleece';
            } else if (absLti >= 28) {
                verdict = 'Highway Robbery';
                gradeBadge = 'verdict-robbery';
            } else if (absLti >= 14) {
                verdict = 'Clear Winner';
                gradeBadge = 'verdict-clear';
            } else {
                verdict = 'Modest Edge';
                gradeBadge = 'verdict-modest';
            }
        }

        return {
            id: tx.id || `${yr}_trade_${Math.random().toString(36).substring(2, 7)}`,
            season: yr,
            week: tradeWeek,
            isPreseason,
            timestamp: tx.timestamp || tx.date || '',
            team1: {
                name: team1Name,
                managerId: team1MgrId,
                managerName: team1MgrName,
                players: team1Evaluations,
                rosPoints: team1RosPoints,
                rawPoints: team1RawPoints,
                missedBackfill: team1MissedBackfill,
                openSlots: team1OpenSlots,
                openSlotPoints: team1OpenSlotPoints,
                lineupPoints: team1LineupPoints,
                vorp: team1Vorp,
                avgRosLti: team1StartingLti,
                avgPreLti: team1AvgPreLti,
                netPoints: netPointsSide1,
                netLti: netLtiSide1,
                ltiSurplus: netLtiSide1,
                isWinner: winnerSide === 1
            },
            team2: {
                name: team2Name,
                managerId: team2MgrId,
                managerName: team2MgrName,
                players: team2Evaluations,
                rosPoints: team2RosPoints,
                rawPoints: team2RawPoints,
                missedBackfill: team2MissedBackfill,
                openSlots: team2OpenSlots,
                openSlotPoints: team2OpenSlotPoints,
                lineupPoints: team2LineupPoints,
                vorp: team2Vorp,
                avgRosLti: team2StartingLti,
                avgPreLti: team2AvgPreLti,
                netPoints: netPointsSide2,
                netLti: netLtiSide2,
                ltiSurplus: netLtiSide2,
                isWinner: winnerSide === 2
            },
            pointDifference: absDiff,
            ltiDifference: absLti,
            weeklyMargin: Math.round(absWeeklyMargin * 10) / 10,
            isUneven: count1 !== count2,
            verdict,
            gradeBadge,
            rawTx: tx
        };
    }

    /**
     * Evaluates a waiver or free agent pickup with budget standardization.
     */
    evaluatePickup(tx) {
        const yr = Number(tx.season || tx.year);
        const isPending = this.isSeasonUnplayed(yr);
        const totalWeeks = this.getLeagueMaxWeek(yr);
        const week = this.getTransactionWeek(tx);
        const remainingWeeks = Math.max(1, totalWeeks - week);
        const faabBid = Number(tx.faab_bid || tx.bidAmount || 0);
        const faabBudget = this.getSeasonFaabBudget(yr);
        const budgetPct = faabBudget > 0 ? Math.round((faabBid / faabBudget) * 1000) / 10 : 0;
        const stdBid = faabBudget > 0 ? Math.round((faabBid / faabBudget) * 100) : faabBid;
        const isWaiver = tx.type === 'waiver' || tx.action_type === 'WAIVER';
        const isFreeAgent = !isWaiver && (tx.type === 'free_agent' || tx.action_type === 'FREE_AGENT' || tx.action_type === 'FREEAGENT');

        const teamName = tx.team_name || '';
        const mgrId = String(tx.manager_id || '').toLowerCase();
        const mgrName = this.getManagerDisplayName(mgrId, tx.manager_name || teamName);

        const addedPlayers = (Array.isArray(tx.added_players) ? tx.added_players : []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);
        const droppedPlayers = (Array.isArray(tx.dropped_players) ? tx.dropped_players : []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);

        if (isPending) {
            const evaluatedAdds = addedPlayers.map(pName => {
                const pos = this.getPlayerPosition(pName, yr) || 'UTIL';
                return {
                    playerName: pName,
                    position: pos,
                    prePickup: null,
                    postPickup: { ltiScore: 50, totalPoints: 0, effectivePoints: 0, gamesPlayed: 0, ppg: 0, vorpPoints: 0, posVorpPpg: 0, position: pos, weeklyPoints: [] },
                    missedWeeks: 0,
                    efficiency: 0
                };
            });
            const evaluatedDrops = droppedPlayers.map(pName => {
                const pos = this.getPlayerPosition(pName, yr) || 'UTIL';
                return {
                    playerName: pName,
                    position: pos,
                    preDrop: null,
                    postDrop: { ltiScore: 50, totalPoints: 0, effectivePoints: 0, gamesPlayed: 0, ppg: 0, vorpPoints: 0, posVorpPpg: 0, position: pos, weeklyPoints: [] },
                    missedWeeks: 0
                };
            });

            return {
                id: tx.id || `${yr}_tx_${Math.random().toString(36).substring(2, 7)}`,
                season: yr,
                week,
                isPending: true,
                timestamp: tx.timestamp || tx.date || '',
                type: isWaiver ? 'waiver' : 'free_agent',
                isWaiverClaim: isWaiver,
                isFreeAgent,
                teamName,
                managerId: mgrId,
                managerName: mgrName,
                faabBid,
                faabBudget,
                budgetPct,
                stdBid,
                addedPlayers: evaluatedAdds,
                droppedPlayers: evaluatedDrops,
                players: evaluatedAdds,
                totalRosPoints: 0,
                totalRosVorp: 0,
                avgRosLti: 50,
                droppedRosPoints: 0,
                droppedRosVorp: 0,
                avgDroppedLti: 50,
                netPoints: 0,
                netLti: 0,
                transactionLti: 'Pending',
                verdict: 'Season Pending',
                gradeBadge: 'pending',
                adjustmentNote: 'Season pending kickoff',
                rawTx: tx
            };
        }

        const evaluatedAdds = addedPlayers.map(pName => {
            const prePickup = week > 1 ? this.calculatePlayerLtiWindow(pName, yr, 1, week) : null;
            const postPickup = this.calculatePlayerLtiWindow(pName, yr, week + 1, totalWeeks);
            const pos = this.getPlayerPosition(pName, yr) || (postPickup ? postPickup.position : 'UTIL');
            const isKDef = ['DEF', 'K'].includes(pos);
            const missedWeeks = isKDef ? 0 : Math.max(0, remainingWeeks - ((postPickup && postPickup.gamesPlayed) || 0));
            const efficiency = stdBid > 0 ? Math.round((postPickup.totalPoints / stdBid) * 10) / 10 : postPickup.totalPoints;
            return {
                playerName: pName,
                position: pos,
                prePickup,
                postPickup,
                missedWeeks,
                efficiency
            };
        });

        const evaluatedDrops = droppedPlayers.map(pName => {
            const preDrop = week > 1 ? this.calculatePlayerLtiWindow(pName, yr, 1, week) : null;
            const postDrop = this.calculatePlayerLtiWindow(pName, yr, week + 1, totalWeeks);
            const pos = this.getPlayerPosition(pName, yr) || (postDrop ? postDrop.position : 'UTIL');
            const isKDef = ['DEF', 'K'].includes(pos);
            const missedWeeks = isKDef ? 0 : Math.max(0, remainingWeeks - ((postDrop && postDrop.gamesPlayed) || 0));
            return {
                playerName: pName,
                position: pos,
                preDrop,
                postDrop,
                missedWeeks
            };
        });

        const totalRosPoints = Math.round(evaluatedAdds.reduce((s, p) => s + (p.postPickup.totalPoints || 0), 0) * 10) / 10;
        const totalRosVorp = Math.round(evaluatedAdds.reduce((s, p) => s + (p.postPickup.vorpPoints || 0), 0) * 10) / 10;
        const avgRosLti = evaluatedAdds.length > 0 
            ? Math.round(evaluatedAdds.reduce((s, p) => s + p.postPickup.ltiScore, 0) / evaluatedAdds.length) 
            : 50;

        const droppedRosPoints = Math.round(evaluatedDrops.reduce((s, p) => s + (p.postDrop.totalPoints || 0), 0) * 10) / 10;
        const droppedRosVorp = Math.round(evaluatedDrops.reduce((s, p) => s + (p.postDrop.vorpPoints || 0), 0) * 10) / 10;
        const avgDroppedLti = evaluatedDrops.length > 0
            ? Math.round(evaluatedDrops.reduce((s, p) => s + p.postDrop.ltiScore, 0) / evaluatedDrops.length)
            : 50;

        // Cross-positional K/DEF dampening
        const hasKDefAdd = evaluatedAdds.some(p => ['K', 'DEF'].includes(p.position));
        const hasSkillAdd = evaluatedAdds.some(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
        const hasKDefDrop = evaluatedDrops.some(p => ['K', 'DEF'].includes(p.position));
        const hasSkillDrop = evaluatedDrops.some(p => ['QB', 'RB', 'WR', 'TE'].includes(p.position));
        const isCrossKDef = (hasKDefAdd && hasSkillDrop) || (hasSkillAdd && hasKDefDrop);
        const crossDampener = isCrossKDef ? 0.5 : 1.0;

        let netPoints = totalRosPoints;
        let netLti = avgRosLti - 50;
        let adjustmentNote = '';
        let verdict = 'Balanced Swap';
        let gradeBadge = 'balanced-deal';

        if (evaluatedAdds.length > 0 && evaluatedDrops.length > 0) {
            const rawNetPts = totalRosPoints - droppedRosPoints;
            const rawNetLti = avgRosLti - avgDroppedLti;
            netPoints = Math.round(rawNetPts * crossDampener * 10) / 10;
            netLti = Math.round(rawNetLti * crossDampener);
            if (isCrossKDef) adjustmentNote = 'K/DEF streaming adjusted (50% dampener)';

            if (netLti >= 18) {
                verdict = 'Decisive Upgrade';
                gradeBadge = 'clear-winner';
            } else if (netLti >= 7) {
                verdict = 'Modest Edge';
                gradeBadge = 'modest-edge';
            } else if (netLti <= -18) {
                verdict = 'Drop Regret';
                gradeBadge = 'highway-robbery';
            } else if (netLti <= -7) {
                verdict = 'Negative Margin';
                gradeBadge = 'modest-edge';
            } else {
                verdict = 'Balanced Swap';
                gradeBadge = 'balanced-deal';
            }
        } else if (evaluatedAdds.length === 0 && evaluatedDrops.length > 0) {
            // Pure drop: delegate to evaluateDrop for relative roster context
            const dropEval = this.evaluateDrop(tx);
            netPoints = dropEval.netPoints;
            netLti = dropEval.netLti;
            adjustmentNote = dropEval.adjustmentNote;
            verdict = dropEval.verdict;
            gradeBadge = dropEval.gradeBadge;
        } else if (evaluatedAdds.length > 0) {
            const txLti = Math.max(1, Math.min(99, 50 + netLti));
            if (txLti >= 70) {
                verdict = 'Elite Addition';
                gradeBadge = 'clear-winner';
            } else if (txLti >= 55) {
                verdict = 'Quality Starter';
                gradeBadge = 'modest-edge';
            } else if (txLti >= 48) {
                verdict = 'Depth Addition';
                gradeBadge = 'balanced-deal';
            } else {
                verdict = 'Marginal Add';
                gradeBadge = 'balanced-deal';
            }
        } else {
            verdict = 'Roster Cut';
            gradeBadge = 'balanced-deal';
        }

        const transactionLti = Math.max(1, Math.min(99, 50 + netLti));

        return {
            id: tx.id || `${yr}_tx_${Math.random().toString(36).substring(2, 7)}`,
            season: yr,
            week,
            timestamp: tx.timestamp || tx.date || '',
            type: isWaiver ? 'waiver' : 'free_agent',
            isWaiverClaim: isWaiver,
            isFreeAgent,
            teamName,
            managerId: mgrId,
            managerName: mgrName,
            faabBid,
            faabBudget,
            budgetPct,
            stdBid,
            addedPlayers: evaluatedAdds,
            droppedPlayers: evaluatedDrops,
            players: evaluatedAdds,
            totalRosPoints,
            totalRosVorp,
            avgRosLti,
            droppedRosPoints,
            droppedRosVorp,
            avgDroppedLti,
            netPoints,
            netLti,
            transactionLti,
            verdict,
            gradeBadge,
            adjustmentNote,
            rawTx: tx
        };
    }

    /**
     * Evaluates dropped players.
     */
    evaluateDrop(tx) {
        const yr = Number(tx.season || tx.year);
        const isPending = this.isSeasonUnplayed(yr);
        const totalWeeks = this.getLeagueMaxWeek(yr);
        const week = this.getTransactionWeek(tx);
        const remainingWeeks = Math.max(1, totalWeeks - week);

        const teamName = tx.team_name || '';
        const mgrId = String(tx.manager_id || '').toLowerCase();
        const mgrName = this.getManagerDisplayName(mgrId, tx.manager_name || teamName);

        const droppedPlayers = (Array.isArray(tx.dropped_players) ? tx.dropped_players : []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);

        if (isPending) {
            const evaluatedPlayers = droppedPlayers.map(pName => {
                const pos = this.getPlayerPosition(pName, yr) || 'UTIL';
                return {
                    playerName: pName,
                    position: pos,
                    preDrop: null,
                    postDrop: { ltiScore: 50, totalPoints: 0, effectivePoints: 0, gamesPlayed: 0, ppg: 0, vorpPoints: 0, posVorpPpg: 0, position: pos, weeklyPoints: [] },
                    missedWeeks: 0
                };
            });

            return {
                id: tx.id || `${yr}_drop_${Math.random().toString(36).substring(2, 7)}`,
                season: yr,
                week,
                isPending: true,
                timestamp: tx.timestamp || tx.date || '',
                teamName,
                managerId: mgrId,
                managerName: mgrName,
                players: evaluatedPlayers,
                totalRosPoints: 0,
                avgRosLti: 50,
                isPureDrop: (!tx.added_players || tx.added_players.length === 0) && droppedPlayers.length > 0,
                hasRosterContext: false,
                bestAltCandidate: null,
                relativePointsLost: 0,
                relativeLtiDelta: 0,
                dampeningFactor: 0,
                adjustmentNote: 'Season pending kickoff',
                verdict: 'Season Pending',
                gradeBadge: 'pending',
                netPoints: 0,
                netLti: 0,
                transactionLti: 'Pending',
                rawTx: tx
            };
        }

        const evaluatedPlayers = droppedPlayers.map(pName => {
            const preDrop = week > 1 ? this.calculatePlayerLtiWindow(pName, yr, 1, week) : null;
            const postDrop = this.calculatePlayerLtiWindow(pName, yr, week + 1, totalWeeks);
            const pos = this.getPlayerPosition(pName, yr) || (postDrop ? postDrop.position : 'UTIL');
            const isKDef = ['DEF', 'K'].includes(pos);
            const missedWeeks = isKDef ? 0 : Math.max(0, remainingWeeks - ((postDrop && postDrop.gamesPlayed) || 0));
            return {
                playerName: pName,
                position: pos,
                preDrop,
                postDrop,
                missedWeeks
            };
        });

        const totalRosPoints = Math.round(evaluatedPlayers.reduce((s, p) => s + ((p.postDrop && p.postDrop.totalPoints) || 0), 0) * 10) / 10;
        const avgRosLti = evaluatedPlayers.length > 0
            ? Math.round(evaluatedPlayers.reduce((s, p) => s + ((p.postDrop && p.postDrop.ltiScore) || 50), 0) / evaluatedPlayers.length)
            : 50;

        // Relative evaluation against roster context for compulsory pure drops
        const isPureDrop = (!tx.added_players || tx.added_players.length === 0) && droppedPlayers.length > 0;
        let hasRosterContext = false;
        let bestAltCandidate = null;
        let relativePointsLost = 0;
        let relativeLtiDelta = 0;
        let dampeningFactor = 0.5;
        let adjustmentNote = 'Compulsory drop adjusted';
        let verdict = 'Optimal Cut';
        let gradeBadge = 'balanced-deal';

        if (totalRosPoints === 0 || avgRosLti <= 35) {
            // Dropped player was sub-replacement, inactive, or non-contributor rest of season
            relativePointsLost = 0;
            relativeLtiDelta = 0;
            dampeningFactor = 0.0;
            adjustmentNote = 'Optimal compulsory cut (0 rest-of-season output)';
            verdict = 'Optimal Cut';
            gradeBadge = 'balanced-deal';
        } else if (!isPureDrop) {
            // Standard drop accompanied by pickup (dampened via evaluatePickup)
            relativePointsLost = totalRosPoints;
            relativeLtiDelta = Math.max(0, avgRosLti - 50);
            adjustmentNote = 'Drop accompanied by pickup';
            verdict = 'Roster Cut';
            gradeBadge = 'balanced-deal';
        } else {
            // Compulsory pure drop
            if (this.playerStats && this.playerStats.length > 0) {
                let roster = (this.playerStats || []).filter(s => 
                    Number(s.season || s.year) === yr && 
                    Number(s.week || 1) === week && 
                    String(s.manager_id || '').toLowerCase() === mgrId
                );
                if (roster.length === 0 && week > 1) {
                    roster = (this.playerStats || []).filter(s => 
                        Number(s.season || s.year) === yr && 
                        Number(s.week || 1) === (week - 1) && 
                        String(s.manager_id || '').toLowerCase() === mgrId
                    );
                }

                const droppedNorms = new Set(droppedPlayers.map(p => normalizeName(p)));
                const benchCandidates = [];
                const allOtherCandidates = [];
                const seenNorms = new Set();

                roster.forEach(s => {
                    const rawName = s.player_name || s.playerName || '';
                    const np = normalizeName(rawName);
                    if (!np || droppedNorms.has(np) || seenNorms.has(np)) return;
                    seenNorms.add(np);

                    const slot = String(s.roster_slot || '').toUpperCase();
                    if (slot === 'BN' || slot === 'IR') {
                        benchCandidates.push({ rawName, slot });
                    } else {
                        allOtherCandidates.push({ rawName, slot });
                    }
                });

                const candidatePool = benchCandidates.length > 0 ? benchCandidates : allOtherCandidates;

                if (candidatePool.length > 0) {
                    hasRosterContext = true;
                    const candidateEvals = candidatePool.map(c => {
                        const ev = this.calculatePlayerLtiWindow(c.rawName, yr, week + 1, totalWeeks);
                        return {
                            name: c.rawName,
                            slot: c.slot,
                            totalPoints: ev ? ev.totalPoints : 0,
                            ppg: ev ? ev.ppg : 0,
                            ltiScore: ev ? ev.ltiScore : 50,
                            gamesPlayed: ev ? ev.gamesPlayed : 0
                        };
                    }).sort((a, b) => a.totalPoints - b.totalPoints || a.ltiScore - b.ltiScore);

                    bestAltCandidate = candidateEvals[0];
                    const altPts = bestAltCandidate.totalPoints;
                    const altLti = bestAltCandidate.ltiScore;

                    const diffPts = totalRosPoints - altPts;
                    const diffLti = avgRosLti - altLti;

                    if (diffPts <= 0 && diffLti <= 0) {
                        relativePointsLost = 0;
                        relativeLtiDelta = 0;
                        dampeningFactor = 0.0;
                        adjustmentNote = 'Optimal compulsory cut (lowest rest-of-season contributor)';
                        verdict = 'Optimal Cut';
                        gradeBadge = 'balanced-deal';
                    } else {
                        // Dampening is scaled by:
                        // 1) How bad the dropped player was (avgRosLti)
                        // 2) How much better it would have been to drop the alternative candidate instead (diffPts, diffLti)
                        let qualityFactor;
                        if (avgRosLti <= 30) qualityFactor = 0.20;
                        else if (avgRosLti <= 40) qualityFactor = 0.35;
                        else if (avgRosLti <= 50) qualityFactor = 0.50;
                        else if (avgRosLti <= 60) qualityFactor = 0.75;
                        else qualityFactor = 1.0;

                        const rawAdvantagePts = Math.max(0, diffPts);
                        const rawAdvantageLti = Math.max(0, diffLti);

                        relativePointsLost = Math.round(rawAdvantagePts * qualityFactor * 10) / 10;
                        relativeLtiDelta = Math.max(0, Math.round(rawAdvantageLti * qualityFactor));
                        dampeningFactor = qualityFactor;

                        adjustmentNote = `Compulsory drop (${Math.round((1 - qualityFactor) * 100)}% dampener, relative loss: ${relativePointsLost} pts vs kept ${bestAltCandidate.name})`;

                        if (relativePointsLost >= 80 && relativeLtiDelta >= 25) {
                            verdict = 'Severe Drop Regret';
                            gradeBadge = 'highway-robbery';
                        } else if (relativePointsLost >= 40 || relativeLtiDelta >= 15) {
                            verdict = 'Drop Regret';
                            gradeBadge = 'modest-edge';
                        } else {
                            verdict = 'Minor Value Loss';
                            gradeBadge = 'balanced-deal';
                        }
                    }
                }
            }

            if (!hasRosterContext) {
                // Historical season or no weekly roster log: apply baseline dampening
                const qualityFactor = avgRosLti <= 50 ? 0.35 : Math.min(1.0, 0.5 + (avgRosLti - 50) / 50);
                relativePointsLost = Math.round(totalRosPoints * qualityFactor * 10) / 10;
                relativeLtiDelta = Math.max(0, Math.round((avgRosLti - 50) * qualityFactor));
                dampeningFactor = qualityFactor;
                adjustmentNote = `Compulsory drop baseline (${Math.round((1 - qualityFactor) * 100)}% dampener)`;
                verdict = relativeLtiDelta >= 15 ? 'Drop Regret' : 'Roster Pruning';
                gradeBadge = relativeLtiDelta >= 15 ? 'modest-edge' : 'balanced-deal';
            }
        }

        const netPoints = -relativePointsLost;
        const netLti = -relativeLtiDelta;
        const transactionLti = Math.max(1, Math.min(99, 50 + netLti));

        return {
            id: tx.id || `${yr}_drop_${Math.random().toString(36).substring(2, 7)}`,
            season: yr,
            week,
            timestamp: tx.timestamp || tx.date || '',
            teamName,
            managerId: mgrId,
            managerName: mgrName,
            players: evaluatedPlayers,
            totalRosPoints,
            avgRosLti,
            isPureDrop,
            hasRosterContext,
            bestAltCandidate,
            relativePointsLost,
            relativeLtiDelta,
            dampeningFactor,
            adjustmentNote,
            verdict,
            gradeBadge,
            netPoints,
            netLti,
            transactionLti,
            rawTx: tx
        };
    }

    /**
     * Compiles and evaluates all platform transactions.
     */
    evaluateAllTransactions() {
        if (this.cachedEvaluations) return this.cachedEvaluations;

        const evaluatedTrades = [];
        const evaluatedPickups = [];
        const evaluatedDrops = [];
        const seenTradePairs = new Set();

        (this.transactions || []).forEach(tx => {
            const isTrade = tx.type === 'trade' || tx.action_type === 'TRADE';
            const isWaiver = tx.type === 'waiver' || tx.action_type === 'WAIVER';
            const isFreeAgent = tx.type === 'free_agent' || tx.action_type === 'FREE_AGENT' || tx.action_type === 'FREEAGENT';
            const isDrop = tx.type === 'drop' || tx.action_type === 'DROP';

            if (isTrade) {
                const team1 = tx.team_name || '';
                const team2 = tx.trade_partner_team || '';
                const sortedKey = `${tx.season}_${[team1, team2].sort().join('_vs_')}_${tx.timestamp}`;
                if (!seenTradePairs.has(sortedKey)) {
                    seenTradePairs.add(sortedKey);
                    evaluatedTrades.push(this.evaluateTrade(tx));
                }
            } else if (isWaiver || isFreeAgent || isDrop) {
                if (Array.isArray(tx.added_players) && tx.added_players.length > 0) {
                    evaluatedPickups.push(this.evaluatePickup(tx));
                }
                if (Array.isArray(tx.dropped_players) && tx.dropped_players.length > 0) {
                    evaluatedDrops.push(this.evaluateDrop(tx));
                }
            }
        });

        // 1. Worst Drops of All Time (In-Season blunders, week >= 1, ranked by VORP/LTI)
        const worstDrops = [];
        evaluatedDrops.forEach(d => {
            if (d.isPending || d.week < 1) return; // Strictly in-season completed drops only
            d.players.forEach(p => {
                if (!['QB', 'RB', 'WR', 'TE'].includes(p.postDrop.position)) return; // No K/DEF
                if (p.postDrop && p.postDrop.gamesPlayed >= 3 && p.postDrop.totalPoints >= 40) {
                    worstDrops.push({
                        season: d.season,
                        week: d.week,
                        managerName: d.managerName,
                        managerId: d.managerId,
                        teamName: d.teamName,
                        playerName: p.playerName,
                        position: p.postDrop.position,
                        postDropPoints: p.postDrop.totalPoints,
                        postDropVorp: p.postDrop.vorpPoints,
                        postDropLti: p.postDrop.ltiScore,
                        postDropPpg: p.postDrop.ppg,
                        postDropGames: p.postDrop.gamesPlayed
                    });
                }
            });
        });
        worstDrops.sort((a, b) => b.postDropVorp - a.postDropVorp || b.postDropPoints - a.postDropPoints);
        const seenDrops = new Set();
        const uniqueWorstDrops = [];
        worstDrops.forEach(d => {
            const key = `${d.season}_${normalizeName(d.playerName)}`;
            if (!seenDrops.has(key)) {
                seenDrops.add(key);
                uniqueWorstDrops.push(d);
            }
        });

        // 2. Best Pickups of All Time (Ranked by VORP/LTI)
        const bestPickups = [];
        evaluatedPickups.forEach(pk => {
            if (pk.isPending) return;
            pk.players.forEach(p => {
                if (!['QB', 'RB', 'WR', 'TE'].includes(p.postPickup.position)) return;
                if (p.postPickup && p.postPickup.gamesPlayed >= 3 && p.postPickup.totalPoints >= 30) {
                    bestPickups.push({
                        season: pk.season,
                        week: pk.week,
                        managerName: pk.managerName,
                        managerId: pk.managerId,
                        teamName: pk.teamName,
                        playerName: p.playerName,
                        faabBid: pk.faabBid,
                        faabBudget: pk.faabBudget,
                        budgetPct: pk.budgetPct,
                        stdBid: pk.stdBid,
                        isFreeAgent: pk.isFreeAgent,
                        rosPoints: p.postPickup.totalPoints,
                        rosVorp: p.postPickup.vorpPoints,
                        rosLti: p.postPickup.ltiScore,
                        rosPpg: p.postPickup.ppg,
                        rosGames: p.postPickup.gamesPlayed,
                        position: p.postPickup.position,
                        efficiency: p.efficiency
                    });
                }
            });
        });
        bestPickups.sort((a, b) => b.rosVorp - a.rosVorp || b.rosPoints - a.rosPoints);
        const seenPickups = new Set();
        const uniqueBestPickups = [];
        bestPickups.forEach(p => {
            const key = `${p.season}_${normalizeName(p.playerName)}`;
            if (!seenPickups.has(key)) {
                seenPickups.add(key);
                uniqueBestPickups.push(p);
            }
        });

        // 3. Blockbuster FAAB Pickups (Ranked by % of Starting FAAB Budget)
        const blockbusterPickups = evaluatedPickups
            .filter(pk => !pk.isPending && pk.faabBid > 0 && pk.players.length > 0)
            .map(pk => ({
                season: pk.season,
                week: pk.week,
                managerName: pk.managerName,
                managerId: pk.managerId,
                teamName: pk.teamName,
                faabBid: pk.faabBid,
                faabBudget: pk.faabBudget,
                budgetPct: pk.budgetPct,
                stdBid: pk.stdBid,
                playerName: pk.players[0].playerName,
                position: pk.players[0].postPickup.position,
                rosPoints: pk.totalRosPoints,
                rosVorp: pk.totalRosVorp,
                rosLti: pk.avgRosLti,
                rosPpg: pk.players[0].postPickup.ppg,
                rosGames: pk.players[0].postPickup.gamesPlayed,
                efficiency: pk.players[0].efficiency
            }))
            .sort((a, b) => b.budgetPct - a.budgetPct || b.faabBid - a.faabBid);

        const seenBlockbuster = new Set();
        const uniqueBlockbusters = [];
        blockbusterPickups.forEach(b => {
            const key = `${b.season}_${normalizeName(b.playerName)}`;
            if (!seenBlockbuster.has(key)) {
                seenBlockbuster.add(key);
                uniqueBlockbusters.push(b);
            }
        });

        // 4. Best Free Agent Pickups ($0 FAAB gems) & Top Waiver Wire Pickups
        const freeAgentSteals = uniqueBestPickups
            .filter(p => p.isFreeAgent)
            .sort((a, b) => b.rosVorp - a.rosVorp || b.rosPoints - a.rosPoints);

        const topWaiverPickupsRaw = uniqueBestPickups
            .filter(p => !p.isFreeAgent)
            .sort((a, b) => b.rosVorp - a.rosVorp || b.rosPoints - a.rosPoints);
        const topWaiverPickups = topWaiverPickupsRaw.length > 0 ? topWaiverPickupsRaw : uniqueBestPickups;

        // 5. Most Unfair Trades & Most Equal Trades
        const unfairTrades = [...evaluatedTrades].filter(t => !t.isPending).sort((a, b) => (b.ltiDifference - a.ltiDifference) || (b.pointDifference - a.pointDifference));
        const equalTrades = [...evaluatedTrades]
            .filter(t => !t.isPending && (t.verdict === 'Balanced Deal' || t.pointDifference < 15.0))
            .sort((a, b) => a.pointDifference - b.pointDifference);

        // 6. Player Transaction Superlatives (Skill Positions Only)
        const careerMoves = new Map();
        const singleSeasonShuttles = new Map();
        const careerTrades = new Map();
        const singleSeasonTrades = new Map();

        (this.transactions || []).forEach(tx => {
            const yr = Number(tx.season || tx.year);
            const isTrade = tx.type === 'trade' || tx.action_type === 'TRADE';
            const players = [
                ...(Array.isArray(tx.added_players) ? tx.added_players : []),
                ...(Array.isArray(tx.dropped_players) ? tx.dropped_players : []),
                ...(Array.isArray(tx.traded_players) ? tx.traded_players : [])
            ];

            const unique = [...new Set(players)];
            unique.forEach(p => {
                if (!this.isSkillPosition(p, yr)) return; // Exclude DST / K
                const cleanName = p.trim();

                careerMoves.set(cleanName, (careerMoves.get(cleanName) || 0) + 1);
                const seasonKey = `${yr}__${cleanName}`;
                singleSeasonShuttles.set(seasonKey, (singleSeasonShuttles.get(seasonKey) || 0) + 1);

                if (isTrade) {
                    careerTrades.set(cleanName, (careerTrades.get(cleanName) || 0) + 1);
                    singleSeasonTrades.set(seasonKey, (singleSeasonTrades.get(seasonKey) || 0) + 1);
                }
            });
        });

        const fantasyNomads = Array.from(careerMoves.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const seasonWaiverShuttles = Array.from(singleSeasonShuttles.entries())
            .map(([key, count]) => {
                const [season, name] = key.split('__');
                return { season: Number(season), name, count };
            })
            .sort((a, b) => b.count - a.count);

        const mostTradedPlayers = Array.from(careerTrades.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const singleSeasonTraded = Array.from(singleSeasonTrades.entries())
            .map(([key, count]) => {
                const [season, name] = key.split('__');
                return { season: Number(season), name, count };
            })
            .sort((a, b) => b.count - a.count);

        this.cachedEvaluations = {
            trades: evaluatedTrades,
            pickups: evaluatedPickups,
            drops: evaluatedDrops,
            unfairTrades,
            equalTrades,
            worstDrops: uniqueWorstDrops,
            bestPickups: uniqueBestPickups,
            blockbusterPickups: uniqueBlockbusters,
            topWaiverPickups,
            freeAgentSteals,
            fantasyNomads,
            seasonWaiverShuttles,
            mostTradedPlayers,
            singleSeasonTraded
        };

        return this.cachedEvaluations;
    }

    /**
     * Builds the manager trade leaderboard with active filtering options.
     */
    getFilteredManagerLeaderboard() {
        const ev = this.evaluateAllTransactions();
        let filteredTrades = (ev.trades || []).filter(t => !t.isPending);

        // 1. Era filter
        if (this.leaderboardEra === '2020') {
            filteredTrades = filteredTrades.filter(t => t.season >= 2020);
        } else if (this.leaderboardEra === 'custom') {
            const start = Math.min(Number(this.leaderboardCustomStart), Number(this.leaderboardCustomEnd));
            const end = Math.max(Number(this.leaderboardCustomStart), Number(this.leaderboardCustomEnd));
            filteredTrades = filteredTrades.filter(t => t.season >= start && t.season <= end);
        }

        // 2. Season filter
        if (this.leaderboardSeason !== 'all') {
            const targetSeason = Number(this.leaderboardSeason);
            filteredTrades = filteredTrades.filter(t => t.season === targetSeason);
        }

        // 3. Manager map setup
        const managerTradeStats = new Map();
        (this.managers || []).forEach(m => {
            const isRetired = Boolean(m.retired || m.is_retired);
            if (this.leaderboardStatus === 'active' && isRetired) return;

            managerTradeStats.set(String(m.id).toLowerCase(), {
                id: m.id,
                name: m.alias || m.name,
                logoUrl: m.logo_url,
                tradesCount: 0,
                wins: 0,
                losses: 0,
                ties: 0,
                netPoints: 0.0,
                totalRosPointsAcquired: 0.0,
                totalPreLti: 0,
                totalRosLti: 0,
                totalLtiSurplus: 0
            });
        });

        filteredTrades.forEach(tr => {
            if (tr.isPending) return;
            const mgr1 = this.resolveManager(tr.team1.managerId) || this.resolveManager(tr.team1.managerName);
            const m1Key = mgr1 ? String(mgr1.id).toLowerCase() : String(tr.team1.managerId || '').toLowerCase();
            const m1 = managerTradeStats.get(m1Key);

            const mgr2 = this.resolveManager(tr.team2.managerId) || this.resolveManager(tr.team2.managerName);
            const m2Key = mgr2 ? String(mgr2.id).toLowerCase() : String(tr.team2.managerId || '').toLowerCase();
            const m2 = managerTradeStats.get(m2Key);

            if (m1) {
                m1.tradesCount++;
                m1.netPoints += tr.team1.netPoints;
                m1.totalRosPointsAcquired += tr.team1.rosPoints;
                m1.totalPreLti += tr.team1.avgPreLti;
                m1.totalRosLti += tr.team1.avgRosLti;
                m1.totalLtiSurplus += (tr.team1.ltiSurplus !== undefined ? tr.team1.ltiSurplus : tr.team1.netLti);
                if (tr.team1.isWinner) m1.wins++;
                else if (tr.team2.isWinner) m1.losses++;
                else m1.ties++;
            }

            if (m2) {
                m2.tradesCount++;
                m2.netPoints += tr.team2.netPoints;
                m2.totalRosPointsAcquired += tr.team2.rosPoints;
                m2.totalPreLti += tr.team2.avgPreLti;
                m2.totalRosLti += tr.team2.avgRosLti;
                m2.totalLtiSurplus += (tr.team2.ltiSurplus !== undefined ? tr.team2.ltiSurplus : tr.team2.netLti);
                if (tr.team2.isWinner) m2.wins++;
                else if (tr.team1.isWinner) m2.losses++;
                else m2.ties++;
            }
        });

        const leaderboard = Array.from(managerTradeStats.values()).map(stat => {
            const winRate = stat.tradesCount > 0 ? (stat.wins / (stat.wins + stat.losses || 1)) * 100 : 0;
            const avgLtiSurplus = stat.tradesCount > 0 ? Math.round((stat.totalLtiSurplus / stat.tradesCount) * 10) / 10 : 0;
            
            // LTI Trading Rating (0-100 scale directly reflecting LTI surplus and win rate)
            let rating = 50;
            if (stat.tradesCount > 0) {
                const surplusComponent = Math.min(35, Math.max(-35, avgLtiSurplus * 1.5));
                const winComponent = ((winRate - 50) / 50) * 12;
                const volumeBonus = Math.min(4.0, (stat.tradesCount / (stat.tradesCount + 8)) * 5.0);
                rating = Math.max(1, Math.min(99, Math.round(50 + surplusComponent + winComponent + volumeBonus)));
            }

            return {
                ...stat,
                netPoints: Math.round(stat.netPoints * 10) / 10,
                winRate: Math.round(winRate * 10) / 10,
                avgLtiSurplus,
                rating
            };
        });

        leaderboard.sort((a, b) => {
            const key = this.tradeSortKey || 'rating';
            const asc = this.tradeSortAsc ? 1 : -1;
            if (key === 'name') {
                return asc * a.name.localeCompare(b.name);
            }
            if (key === 'trades') {
                return (a.tradesCount - b.tradesCount) * asc || (b.rating - a.rating);
            }
            if (key === 'record') {
                return (a.wins - b.wins) * asc || (a.winRate - b.winRate) * asc;
            }
            if (key === 'winRate') {
                return (a.winRate - b.winRate) * asc || (b.rating - a.rating);
            }
            if (key === 'netPoints') {
                return (a.netPoints - b.netPoints) * asc || (b.rating - a.rating);
            }
            if (key === 'avgLtiSurplus') {
                return (a.avgLtiSurplus - b.avgLtiSurplus) * asc || (b.rating - a.rating);
            }
            // default: rating
            return (a.rating - b.rating) * asc || (b.netPoints - a.netPoints);
        });
        return leaderboard;
    }

    /**
     * Builds the manager pickup & waiver leaderboard.
     */
    getFilteredPickupLeaderboard() {
        const ev = this.evaluateAllTransactions();
        let pickups = (ev.pickups || []).filter(p => !p.isPending);
        let drops = (ev.drops || []).filter(d => !d.isPending);

        // 1. Era filter
        if (this.leaderboardEra === '2020') {
            pickups = pickups.filter(p => p.season >= 2020);
            drops = drops.filter(d => d.season >= 2020);
        } else if (this.leaderboardEra === 'custom') {
            const start = Math.min(Number(this.leaderboardCustomStart), Number(this.leaderboardCustomEnd));
            const end = Math.max(Number(this.leaderboardCustomStart), Number(this.leaderboardCustomEnd));
            pickups = pickups.filter(p => p.season >= start && p.season <= end);
            drops = drops.filter(d => d.season >= start && d.season <= end);
        }

        // 2. Season filter
        if (this.leaderboardSeason !== 'all') {
            const targetSeason = Number(this.leaderboardSeason);
            pickups = pickups.filter(p => p.season === targetSeason);
            drops = drops.filter(d => d.season === targetSeason);
        }

        // 3. System filter (FAAB vs Waiver priority)
        if (this.leagueUsesFaab()) {
            if (this.pickupSystem === 'faab') {
                pickups = pickups.filter(p => p.faabBudget > 0);
                drops = drops.filter(d => this.getSeasonFaabBudget(d.season) > 0);
            } else if (this.pickupSystem === 'waiver') {
                pickups = pickups.filter(p => p.faabBudget === 0);
                drops = drops.filter(d => this.getSeasonFaabBudget(d.season) === 0);
            }
        }

        const managerStats = new Map();
        (this.managers || []).forEach(m => {
            const isRetired = Boolean(m.retired || m.is_retired);
            if (this.leaderboardStatus === 'active' && isRetired) return;

            managerStats.set(String(m.id).toLowerCase(), {
                id: m.id,
                name: m.alias || m.name,
                logoUrl: m.logo_url,
                addsCount: 0,
                waiverClaims: 0,
                freeAgentAdds: 0,
                totalRosPoints: 0,
                totalLtiScore: 0,
                dropsCount: 0,
                lostDropPoints: 0,
                freeAgentGems: 0,
                totalFaabSpent: 0,
                seasonBudgets: new Map()
            });
        });

        pickups.forEach(pk => {
            if (pk.isPending) return;
            const mgr = this.resolveManager(pk.managerId) || this.resolveManager(pk.managerName);
            const mId = mgr ? String(mgr.id).toLowerCase() : String(pk.managerId || '').toLowerCase();
            const stat = managerStats.get(mId);
            if (!stat) return;

            pk.players.forEach(p => {
                stat.addsCount++;
                if (pk.isFreeAgent) {
                    stat.freeAgentAdds++;
                } else {
                    stat.waiverClaims++;
                }
                stat.totalRosPoints += (p.postPickup.totalPoints || 0);
                stat.totalLtiScore += (p.postPickup.ltiScore || 50);

                // Micro-bid bargains (<= 2% of budget or $0) yielding starting-caliber skill production
                const budgetPct = pk.budgetPct !== undefined ? pk.budgetPct : (pk.faabBudget > 0 ? (Number(pk.faabBid || 0) / pk.faabBudget) * 100 : 0);
                const isMicroBidOrFree = Number(pk.faabBid || 0) === 0 || budgetPct <= 2.0;
                const isSkill = p.postPickup && ['QB', 'RB', 'WR', 'TE'].includes(p.postPickup.position);
                if (isSkill && isMicroBidOrFree && (p.postPickup.totalPoints >= 60 || p.postPickup.ltiScore >= 70)) {
                    stat.freeAgentGems++;
                }
            });
            stat.totalFaabSpent += Number(pk.faabBid || 0);
            if (pk.faabBudget > 0 && !stat.seasonBudgets.has(pk.season)) {
                stat.seasonBudgets.set(pk.season, pk.faabBudget);
            }
        });

        drops.forEach(d => {
            if (d.isPending) return;
            if (d.week < 1) return; // mid-season cuts only
            const mgr = this.resolveManager(d.managerId) || this.resolveManager(d.managerName);
            const mId = mgr ? String(mgr.id).toLowerCase() : String(d.managerId || '').toLowerCase();
            const stat = managerStats.get(mId);
            if (!stat) return;

            const isPureDrop = Boolean(d.isPureDrop ?? (!d.rawTx?.added_players || d.rawTx.added_players.length === 0));

            if (isPureDrop && d.hasRosterContext) {
                stat.dropsCount += (d.players || []).length;
                const hasStartingSkill = d.players.some(p => {
                    const post = p.postDrop;
                    const isSkill = post && ['QB', 'RB', 'WR', 'TE'].includes(post.position);
                    return isSkill && post.gamesPlayed >= 3 && post.totalPoints >= 40 && post.vorpPoints > 0;
                });
                if (hasStartingSkill && d.relativePointsLost > 0) {
                    stat.lostDropPoints += d.relativePointsLost;
                }
            } else {
                const dampener = isPureDrop ? 0.5 : 1.0;
                d.players.forEach(p => {
                    stat.dropsCount++;
                    const isSkill = p.postDrop && ['QB', 'RB', 'WR', 'TE'].includes(p.postDrop.position);
                    // Fair drop regret: only starting-caliber skill players who contributed positive VORP
                    if (isSkill && p.postDrop.gamesPlayed >= 3 && p.postDrop.totalPoints >= 40 && p.postDrop.vorpPoints > 0) {
                        stat.lostDropPoints += Math.round(p.postDrop.totalPoints * dampener * 10) / 10;
                    }
                });
            }
        });

        const leaderboard = Array.from(managerStats.values())
            .filter(s => s.addsCount > 0 || s.dropsCount > 0)
            .map(s => {
                const avgAddedLti = s.addsCount > 0 ? Math.round(s.totalLtiScore / s.addsCount) : 50;
                const netAcqPoints = Math.round((s.totalRosPoints - s.lostDropPoints) * 10) / 10;
                const avgNetPoints = s.addsCount > 0 ? Math.round((netAcqPoints / s.addsCount) * 10) / 10 : 0;
                const avgAddedPoints = s.addsCount > 0 ? Math.round((s.totalRosPoints / s.addsCount) * 10) / 10 : 0;
                
                // Total budget and relative proportion of FAAB spent
                const totalBudget = Array.from(s.seasonBudgets.values()).reduce((sum, b) => sum + b, 0);
                const budgetPctSpent = totalBudget > 0 ? Math.round((s.totalFaabSpent / totalBudget) * 100) : null;

                // Composite LTI Pickup Rating (1-99 rating)
                // Anchored at baseline 50 for total market passivity
                const shrinkFactor = s.addsCount > 0 ? s.addsCount / (s.addsCount + 8) : 0;
                const ltiComponent = (avgAddedLti - 50) * 0.7 * shrinkFactor;
                const netMoveComponent = shrinkFactor * Math.min(12, Math.max(-12, (avgNetPoints - 25.0) * 0.5));
                const dropPenalty = shrinkFactor * Math.min(15, (s.lostDropPoints / (s.addsCount || 1)) * 0.35);
                const gemsBonus = Math.min(5, s.freeAgentGems * 0.5);
                const volumeBonus = s.addsCount > 0 ? Math.min(4.0, (s.addsCount / (s.addsCount + 15)) * 5.0) : 0;

                const rating = Math.max(1, Math.min(99, Math.round(50 + ltiComponent + netMoveComponent - dropPenalty + gemsBonus + volumeBonus)));

                return {
                    ...s,
                    totalRosPoints: Math.round(s.totalRosPoints * 10) / 10,
                    lostDropPoints: Math.round(s.lostDropPoints * 10) / 10,
                    netAcqPoints,
                    avgNetPoints,
                    avgAddedPoints,
                    avgAddedLti,
                    totalBudget,
                    budgetPctSpent,
                    rating
                };
            });

        leaderboard.sort((a, b) => {
            const key = this.pickupSortKey || 'rating';
            const asc = this.pickupSortAsc ? 1 : -1;
            if (key === 'name') {
                return asc * a.name.localeCompare(b.name);
            }
            if (key === 'adds') {
                return (a.addsCount - b.addsCount) * asc || (b.rating - a.rating);
            }
            if (key === 'waiverClaims') {
                return (a.waiverClaims - b.waiverClaims) * asc || (b.rating - a.rating);
            }
            if (key === 'totalRosPoints') {
                return (a.totalRosPoints - b.totalRosPoints) * asc || (b.rating - a.rating);
            }
            if (key === 'avgNetPoints' || key === 'avgAdditionalPoints') {
                return (a.avgNetPoints - b.avgNetPoints) * asc || (b.rating - a.rating);
            }
            if (key === 'avgAddedLti') {
                return (a.avgAddedLti - b.avgAddedLti) * asc || (b.rating - a.rating);
            }
            if (key === 'lostDropPoints') {
                return (a.lostDropPoints - b.lostDropPoints) * asc || (b.rating - a.rating);
            }
            if (key === 'netAcqPoints') {
                return (a.netAcqPoints - b.netAcqPoints) * asc || (b.rating - a.rating);
            }
            if (key === 'freeAgentGems') {
                return (a.freeAgentGems - b.freeAgentGems) * asc || (b.rating - a.rating);
            }
            if (key === 'totalFaabSpent') {
                return (a.totalFaabSpent - b.totalFaabSpent) * asc || (b.rating - a.rating);
            }
            // default: rating
            return (a.rating - b.rating) * asc || (b.netAcqPoints - a.netAcqPoints);
        });
        return leaderboard;
    }

    /**
     * Retrieves all trades conducted between two specific managers.
     */
    getHeadToHeadTrades(mgr1Id, mgr2Id) {
        const id1 = String(mgr1Id || '').toLowerCase();
        const id2 = String(mgr2Id || '').toLowerCase();
        if (!id1 || !id2 || id1 === id2) return [];

        const ev = this.evaluateAllTransactions();
        return ev.trades.filter(tr => {
            const t1 = tr.team1.managerId;
            const t2 = tr.team2.managerId;
            return (t1 === id1 && t2 === id2) || (t1 === id2 && t2 === id1);
        });
    }

    /**
     * Compiles complete chronological transaction throughline for a specific player in a season.
     */
    getPlayerThroughline(playerName, season) {
        const yr = Number(season);
        const np = normalizeName(playerName);
        const pick = this.draftPickMap.get(`${yr}_${np}`) || null;
        const totalWeeks = this.getLeagueMaxWeek(yr);
        const faabBudget = this.getSeasonFaabBudget(yr);

        const events = [];

        if (pick) {
            events.push({
                type: 'draft',
                title: 'Drafted',
                week: 0,
                timestamp: 'Draft Day',
                teamName: pick.team_name || pick.teamName || '',
                managerId: pick.manager_id || pick.managerId || '',
                managerName: pick.manager_name || pick.managerName || '',
                round: pick.round || pick.round_number || '',
                pick: pick.round_pick || pick.pick_number || '',
                overallPick: pick.overall_pick_number || pick.overallPick || '',
                details: `Selected in Round ${pick.round || 1}, Pick ${pick.round_pick || 1} (Overall #${pick.overall_pick_number || pick.overallPick || 1})`
            });
        }

        (this.transactions || []).forEach(tx => {
            if (Number(tx.season || tx.year) !== yr) return;
            const week = this.getTransactionWeek(tx);
            const adds = Array.isArray(tx.added_players) ? tx.added_players : [];
            const drops = Array.isArray(tx.dropped_players) ? tx.dropped_players : [];
            const isTrade = tx.type === 'trade' || tx.action_type === 'TRADE';

            const matchAdd = adds.some(p => normalizeName(p) === np);
            const matchDrop = drops.some(p => normalizeName(p) === np);

            if (isTrade) {
                if (matchAdd || matchDrop) {
                    const toTeam = matchAdd ? tx.team_name : tx.trade_partner_team;
                    const fromTeam = matchAdd ? tx.trade_partner_team : tx.team_name;
                    const mgr = matchAdd 
                        ? this.getManagerDisplayName(tx.manager_id, tx.manager_name || tx.team_name)
                        : this.getManagerDisplayName(tx.trade_partner_manager_id, tx.trade_partner_manager_name || tx.trade_partner_team);
                    events.push({
                        type: 'trade',
                        title: 'Traded',
                        week,
                        timestamp: tx.timestamp || '',
                        teamName: toTeam,
                        managerName: mgr,
                        details: `Traded from ${fromTeam} to ${toTeam}`
                    });
                }
            } else if (matchAdd) {
                const faabBid = Number(tx.faab_bid || 0);
                const budgetPct = faabBudget > 0 ? Math.round((faabBid / faabBudget) * 1000) / 10 : 0;
                const isFaab = this.leagueUsesFaab();
                const isWaiverClaim = isFaab ? faabBid > 0 : (tx.type === 'waiver' || tx.action_type === 'WAIVER');
                const mgr = this.getManagerDisplayName(tx.manager_id, tx.manager_name || tx.team_name);

                let claimDetails = 'Added off Free Agency';
                if (isFaab && faabBid > 0) {
                    claimDetails = `Claimed off waivers for $${faabBid} (${budgetPct}% of $${faabBudget} season FAAB budget)`;
                } else if (isWaiverClaim) {
                    claimDetails = 'Claimed off waivers';
                }

                events.push({
                    type: isWaiverClaim ? 'waiver' : 'free_agent',
                    title: isWaiverClaim ? 'Waiver Claim' : 'Free Agent Add',
                    week,
                    timestamp: tx.timestamp || '',
                    teamName: tx.team_name,
                    managerName: mgr,
                    faabBid,
                    faabBudget,
                    budgetPct,
                    details: claimDetails
                });
            } else if (matchDrop) {
                const mgr = this.getManagerDisplayName(tx.manager_id, tx.manager_name || tx.team_name);
                events.push({
                    type: 'drop',
                    title: 'Dropped',
                    week,
                    timestamp: tx.timestamp || '',
                    teamName: tx.team_name,
                    managerName: mgr,
                    details: `Dropped to waivers by ${mgr}`
                });
            }
        });

        // Compute full season stats
        const fullSeasonStats = this.calculatePlayerLtiWindow(playerName, yr, 1, totalWeeks);

        return {
            playerName,
            season: yr,
            position: fullSeasonStats.position,
            totalPoints: fullSeasonStats.totalPoints,
            vorpPoints: fullSeasonStats.vorpPoints,
            ppg: fullSeasonStats.ppg,
            gamesPlayed: fullSeasonStats.gamesPlayed,
            ltiScore: fullSeasonStats.ltiScore,
            events
        };
    }

    /**
     * Universal player transaction throughline modal dialog.
     */
    renderThroughlineModal(playerName, season) {
        const modalId = 'player-throughline-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = modalId;
            modal.className = 'boxscore-modal throughline-modal';
            document.body.appendChild(modal);
        }

        const data = this.getPlayerThroughline(playerName, season);

        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>${data.playerName}</h2>
                    <p>${this.formatSeasonYear(data.season)} Transaction Throughline &middot; ${data.position} &middot; ${data.totalPoints} pts (+${data.vorpPoints} VORP, ${data.ppg} PPG in ${data.gamesPlayed} GP) &middot; ${data.ltiScore} LTI</p>
                </div>
                <button class="modal-close-btn" id="btn-close-throughline">&times;</button>
            </div>
            <div class="throughline-content-body">
                ${data.events.length === 0 ? `
                    <p style="color: var(--text-muted); padding: 1.5rem 0;">No transactions recorded for ${data.playerName} in ${this.formatSeasonYear(data.season)}.</p>
                ` : `
                    <div class="throughline-timeline">
                        ${data.events.map(ev => `
                            <div class="throughline-event-card ${ev.type}">
                                <div class="throughline-event-meta">
                                    <span class="throughline-badge ${ev.type}">${ev.title}</span>
                                    <span class="throughline-time">${ev.week > 0 ? `Week ${ev.week}` : 'Preseason'} &middot; ${ev.timestamp}</span>
                                </div>
                                <div class="throughline-event-main">
                                    <strong>${ev.managerName || ev.teamName}</strong>
                                    <p>${ev.details}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;

        modal.showModal();
        document.getElementById('btn-close-throughline')?.addEventListener('click', () => modal.close());
    }

    /**
     * Renders a comprehensive, casual explainer modal covering transaction acumen,
     * LTI Surplus vs Trading Rating dynamics, lineup surplus, and waiver wire logic.
     */
    renderMethodologyModal() {
        const modalId = 'tx-methodology-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = modalId;
            modal.className = 'boxscore-modal tx-methodology-dialog';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>How Transaction Acumen is Evaluated</h2>
                    <p>Landon Transaction Index (LTI) &middot; Starting Lineup Surplus &middot; Market Philosophy</p>
                </div>
                <button class="modal-close-btn" id="btn-close-methodology">&times;</button>
            </div>
            <div class="tx-methodology-content" style="display: flex; flex-direction: column; gap: 1.5rem; font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary);">
                
                <div style="background: rgba(245, 158, 11, 0.08); border-left: 4px solid var(--accent-gold); padding: 1rem 1.25rem; border-radius: 0 8px 8px 0;">
                    <h3 style="color: var(--accent-gold); margin: 0 0 0.5rem 0; font-size: 1.1rem; font-family: 'Newsreader', Georgia, serif;">Core Philosophy: Action vs. Inaction</h3>
                    <p style="margin: 0;">
                        In fantasy football, the easiest way to avoid making a bad trade is to never make a trade at all. But sitting on the sidelines also guarantees you never improve your roster through market leverage. Our transaction engine is built around a simple truth: active dealmaking that upgrades starting lineups and builds equity deserves recognition, as market engagement carries inherent risk.
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">LTI Surplus vs. LTI Trading Rating</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            Why can a manager with a slight negative surplus (e.g. Landon with -0.6 average surplus across 18 trades) have a higher Trading Rating (53) than a manager who has never made a trade (+0.0 surplus, sitting at baseline 50)?
                        </p>
                        <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem;">
                            Baseline 50 represents absolute neutrality. A manager with 0 trades has risked nothing and won nothing. Landon's -0.6 surplus across 18 trades represents essentially dead-even trading (-11 net points total over almost two decades), but includes 9 trade victories, multiple playoff-clinching starting lineup upgrades, and heavy market participation. Trading ratings reward sustained, active dealmaking and net trade wins rather than penalizing someone for being active.
                        </p>
                    </div>

                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Starting Lineup Surplus & Roster Mechanics</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            Trades are judged by starting lineup impact, not raw bench points. Consolidating two bench flex players for one top-tier RB1 or WR1 (a classic 2-for-1) often creates immense starting lineup surplus, even if the raw point totals look comparable on paper.
                        </p>
                        <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem;">
                            Furthermore, kickers and team defenses are aggressively docked, as streaming replacement levels make their trade value virtually negligible. No manager gets crowned for trading a flex starter for a kicker. Preseason moves also receive 0 artificial replacement credit, keeping all valuations anchored to real in-season performance.
                        </p>
                    </div>
                </div>

                <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                    <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Pickup & Waiver Wire Acumen</h4>
                    <p style="margin: 0; font-size: 0.9rem;">
                        Waiver performance is measured by efficiency and true rest-of-season (ROS) impact:
                    </p>
                    <ul style="margin: 0.75rem 0 0 1.25rem; padding: 0; font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.4rem;">
                        <li><strong>Rest-of-Season (ROS) Points & LTI:</strong> We evaluate whether an added player became a meaningful starter for your team, not just a one-week roster churn.</li>
                        <li><strong>FAAB & Waiver Efficiency:</strong> In FAAB eras, spending $20 for a high-LTI starter is genius resource allocation; burning half your budget on a one-week flash-in-the-pan drops your efficiency. In waiver priority eras, timely claims on breakout stars separate the best wire players.</li>
                        <li><strong>Free Agent Gems:</strong> $0 bids and pure free-agent adds that deliver starting-caliber production (60+ points or 70+ LTI) provide huge boosts to your acumen rating.</li>
                        <li><strong>Drop Regret Penalty:</strong> Cutting a player who goes on to score heavily for a competitor counts against your net acquisition score, reflecting the real sting of bad drops.</li>
                    </ul>
                </div>

            </div>
        `;

        modal.showModal();
        document.getElementById('btn-close-methodology')?.addEventListener('click', () => modal.close());
        modal.addEventListener('click', (e) => {
            const rect = modal.getBoundingClientRect();
            if (
                e.clientX < rect.left ||
                e.clientX > rect.right ||
                e.clientY < rect.top ||
                e.clientY > rect.bottom
            ) {
                modal.close();
            }
        });
    }

    renderLtiSurplusModal() {
        const modalId = 'tx-lti-surplus-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = modalId;
            modal.className = 'boxscore-modal tx-methodology-dialog';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>How LTI Surplus is Calculated</h2>
                    <p>Zero-Sum Talent Conservation &middot; Games-Missed Proration &middot; Net Starting Equity</p>
                </div>
                <button class="modal-close-btn" id="btn-close-lti-surplus">&times;</button>
            </div>
            <div class="tx-methodology-content" style="display: flex; flex-direction: column; gap: 1.5rem; font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary);">
                <div style="background: rgba(245, 158, 11, 0.08); border-left: 4px solid var(--accent-gold); padding: 1rem 1.25rem; border-radius: 0 8px 8px 0;">
                    <h3 style="color: var(--accent-gold); margin: 0 0 0.5rem 0; font-size: 1.1rem; font-family: 'Newsreader', Georgia, serif;">Zero-Sum Talent Conservation</h3>
                    <p style="margin: 0;">
                        The Landon Transaction Index (LTI) is a conserved talent metric centered at 50 (replacement starter level). In every trade between two managers, talent equity is strictly zero-sum: every point of LTI equity gained by Team A is mathematically balanced by a point of LTI equity surrendered by Team B (+X LTI vs. -X LTI).
                    </p>
                </div>

                <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                    <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Games-Missed Proration & Injury Realism</h4>
                    <p style="margin: 0; font-size: 0.9rem;">
                        Per the LDI framework, trades evaluate true per-game starting talent rather than raw unadjusted accumulated points. When a traded starter misses games due to injury, the engine does not treat those missed weeks as 0 points, as fantasy managers replace injured players on their active roster with viable waiver wire starters (5.5 PPG baseline).
                    </p>
                    <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem;">
                        This ensures elite performers who missed time (such as Antonio Brown scoring 16.7 PPG across 4 games) are credited for their dominant starting-caliber LTI (74 LTI) rather than penalized below mediocre low-ceiling players who played more games.
                    </p>
                </div>

                <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                    <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Cumulative Career LTI Surplus</h4>
                    <p style="margin: 0; font-size: 0.9rem;">
                        Your career LTI Surplus represents the average net LTI talent margin accumulated per completed trade across your entire franchise history. A positive surplus indicates you consistently extracted higher-caliber starting assets than you traded away.
                    </p>
                </div>
            </div>
        `;

        modal.showModal();
        document.getElementById('btn-close-lti-surplus')?.addEventListener('click', () => modal.close());
        modal.addEventListener('click', (e) => {
            const rect = modal.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                modal.close();
            }
        });
    }

    renderTradingScoreModal() {
        const modalId = 'tx-trading-score-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = modalId;
            modal.className = 'boxscore-modal tx-methodology-dialog';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>How LTI Trading Rating is Calculated</h2>
                    <p>Composite 1-99 Acumen Scale &middot; Activity Incentives &middot; Market Participation</p>
                </div>
                <button class="modal-close-btn" id="btn-close-trading-score">&times;</button>
            </div>
            <div class="tx-methodology-content" style="display: flex; flex-direction: column; gap: 1.5rem; font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary);">
                <div style="background: rgba(245, 158, 11, 0.08); border-left: 4px solid var(--accent-gold); padding: 1rem 1.25rem; border-radius: 0 8px 8px 0;">
                    <h3 style="color: var(--accent-gold); margin: 0 0 0.5rem 0; font-size: 1.1rem; font-family: 'Newsreader', Georgia, serif;">The 1-99 Composite Formula</h3>
                    <p style="margin: 0;">
                        The LTI Trading Rating blends talent extraction, head-to-head trade win rate, and deal volume into a single comprehensive metric, anchored at baseline 50:
                    </p>
                    <div style="margin-top: 0.75rem; font-family: monospace; font-size: 0.88rem; background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color);">
                        Rating = 50 + LTI Surplus Component (+/-35) + Win Rate Component (+/-12) + Empirical Volume Bonus (+4.0 max)
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Core Components</h4>
                        <ul style="margin: 0.5rem 0 0 1.2rem; padding: 0; font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.4rem;">
                            <li><strong>LTI Surplus (+/-35 pts):</strong> Scales your career average LTI surplus per deal (surplus &times; 1.5), directly measuring whether you upgrade your starting talent.</li>
                            <li><strong>Win Rate (+/-12 pts):</strong> Measures your winning percentage in decisive trades (verdicts with a clear winner).</li>
                            <li><strong>Empirical Volume Credibility (+4.0 pts max):</strong> Uses an empirical Bayes saturation curve based on transaction volume, recognizing managers who actively participate in trade markets.</li>
                        </ul>
                    </div>

                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Empirical Rationale: Volume &amp; Championship Odds</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            Historical league data shows that managers completing 3+ trades per season qualify for the playoffs at an 81.3% rate compared to only 33.3% for inactive managers (a 2.4x higher rate), and 100% of league champions completed multiple starting lineup trades during their championship seasons.
                        </p>
                        <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem;">
                            Baseline 50 represents total market passivity. While passive management avoids trade losses, it prevents consolidating depth into weekly anchors or hedging playoff injuries. The empirical volume credibility curve awards up to +4.0 points for proven market engagement, recognizing managers who actively take calculated risks to optimize starting lineups.
                        </p>
                    </div>
                </div>
            </div>
        `;

        modal.showModal();
        document.getElementById('btn-close-trading-score')?.addEventListener('click', () => modal.close());
        modal.addEventListener('click', (e) => {
            const rect = modal.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                modal.close();
            }
        });
    }

    renderTradeRecordModal() {
        const modalId = 'tx-trade-record-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = modalId;
            modal.className = 'boxscore-modal tx-methodology-dialog';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>How Trade Records & Verdicts are Evaluated</h2>
                    <p>Harmonized LTI &middot; Weekly Lineup Margin &middot; 2-for-1 Consolidation &middot; Statistical Extrapolation</p>
                </div>
                <button class="modal-close-btn" id="btn-close-trade-record">&times;</button>
            </div>
            <div class="tx-methodology-content" style="display: flex; flex-direction: column; gap: 1.5rem; font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary);">
                <div style="background: rgba(245, 158, 11, 0.08); border-left: 4px solid var(--accent-gold); padding: 1rem 1.25rem; border-radius: 0 8px 8px 0;">
                    <h3 style="color: var(--accent-gold); margin: 0 0 0.5rem 0; font-size: 1.1rem; font-family: 'Newsreader', Georgia, serif;">Determining Wins, Losses, and Ties (The 5 Verdict Tiers)</h3>
                    <p style="margin: 0;">
                        Every trade in league history is graded over its post-deal starting window by measuring starting lineup point margin per week (&Delta; PPG) and Net LTI equity. Starting points and LTI are mathematically harmonized, as ensuring that positive lineup production strictly corresponds with positive talent gain:
                    </p>
                    <ul style="margin: 0.75rem 0 0 1.2rem; padding: 0; font-size: 0.88rem; display: flex; flex-direction: column; gap: 0.35rem;">
                        <li><strong>Balanced Deal (Tie):</strong> &lt; 6 Net LTI (0 to 5 &Delta; LTI). Both franchises are awarded a win-win tie (0-0-1).</li>
                        <li><strong>Modest Edge:</strong> 6 to 13 Net LTI. Advantageous starting exchange.</li>
                        <li><strong>Clear Winner:</strong> 14 to 27 Net LTI. Decisive starting lineup upgrade.</li>
                        <li><strong>Highway Robbery:</strong> 28 to 42 Net LTI. Severe starting lopsidedness.</li>
                        <li><strong>True Fleece:</strong> &ge; 43 Net LTI. Historic, league-altering talent extraction.</li>
                    </ul>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Core Principles: LTI & VORP</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            The Landon Transaction Index (LTI) is centered at 50 (replacement starter level). Rather than measuring bench points that never enter active fantasy lineups, Value Over Replacement Player (VORP) measures the true starting margin created above the streaming baseline. Every point of LTI talent equity gained by one franchise is conserved and surrendered by the other.
                        </p>
                    </div>

                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">2-for-1 Consolidation Roster Trust</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            When a manager trades two starting-caliber players for one elite superstar, our engine trusts that the consolidating manager can handle the roster move. The vacated starting slot is filled from the waiver wire at the vacant slot baseline (8.5 PPG). This ensures consolidating depth into an elite weekly anchor is properly credited for its lineup-winning impact.
                        </p>
                    </div>
                </div>

                <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                    <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Statistical Injury Extrapolation &amp; Wear-and-Tear Cutoffs (LDI Principles)</h4>
                    <p style="margin: 0; font-size: 0.9rem;">
                        Consistent with Section 4.3 of the LDI framework, short-term absences within the normal in-season wear-and-tear threshold (calculated dynamically as one-quarter of the post-deal window) represent standard operational variance. These minor games add zero prorated points rather than receiving statistical extrapolation, reflecting realistic in-season operational variance.
                    </p>
                    <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem;">
                        Only significant games missed beyond the wear-and-tear cutoff qualify for statistical extrapolation. To protect against small-sample hot streaks, we apply continuous Bayesian shrinkage, as robust samples (8+ games) extrapolate at 100% of their actual per-game rate, while smaller samples smoothly regress toward the player's broader season baseline and positional averages. Unplayed NFL weeks outside the league calendar (such as Week 18) are strictly excluded from all player stats and games played.
                    </p>
                </div>

                <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                    <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Rest-of-Season Production (Lineup Evaluation)</h4>
                    <p style="margin: 0; font-size: 0.9rem;">
                        Displayed at the footer of each side in every trade card, Rest-of-Season Production measures the total starting fantasy output delivered to a franchise over the remainder of the fantasy calendar. It combines actual fantasy points scored during healthy starting appearances, Bayesian-extrapolated points for significant injury absences beyond normal wear-and-tear, and open-slot waiver baseline points (8.5 PPG) for consolidating managers in uneven deals.
                    </p>
                </div>

                <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                    <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">LTI Inconclusivity Dampener</h4>
                    <p style="margin: 0; font-size: 0.9rem;">
                        When a trade suffers extensive injury time across the players exchanged, the empirical verdict becomes inherently less conclusive than a deal where all players stayed healthy. While Net Rest-of-Season Production remains completely unadjusted, as preserving exact lineup scoring, the Net LTI Delta scale is dynamically dampened by up to 30% based on the aggregate missed-game rate. This ensures high-variance, injury-marred trades are graded with appropriate statistical modesty.
                    </p>
                </div>
            </div>
        `;

        modal.showModal();
        document.getElementById('btn-close-trade-record')?.addEventListener('click', () => modal.close());
        modal.addEventListener('click', (e) => {
            const rect = modal.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                modal.close();
            }
        });
    }

    renderPickupRatingModal() {
        const modalId = 'tx-pickup-rating-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = modalId;
            modal.className = 'boxscore-modal tx-methodology-dialog';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>How LTI Pickup Rating is Calculated</h2>
                    <p>Composite 1-99 Acumen Scale &middot; Net Production per Move &middot; Market Activity</p>
                </div>
                <button class="modal-close-btn" id="btn-close-pickup-rating">&times;</button>
            </div>
            <div class="tx-methodology-content" style="display: flex; flex-direction: column; gap: 1.5rem; font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary);">
                <div style="background: rgba(245, 158, 11, 0.08); border-left: 4px solid var(--accent-gold); padding: 1rem 1.25rem; border-radius: 0 8px 8px 0;">
                    <h3 style="color: var(--accent-gold); margin: 0 0 0.5rem 0; font-size: 1.1rem; font-family: 'Newsreader', Georgia, serif;">The 1-99 Composite Formula</h3>
                    <p style="margin: 0;">
                        The LTI Pickup Rating evaluates waiver and free-agent acumen by measuring true starting talent extracted, net points added per transaction, regret from dropped starters, and bargain discovery, anchored at baseline 50:
                    </p>
                    <div style="margin-top: 0.75rem; font-family: monospace; font-size: 0.88rem; background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 6px; border: 1px solid var(--border-color);">
                        Rating = 50 + LTI Talent Component (+/-15) + Net Points per Move (+/-12) - Drop Regret Penalty (15 max) + Free Agent Gems (+5 max) + Volume Credibility (+4.0 max)
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Core Components</h4>
                        <ul style="margin: 0.5rem 0 0 1.2rem; padding: 0; font-size: 0.9rem; display: flex; flex-direction: column; gap: 0.4rem;">
                            <li><strong>LTI Talent Component (+/-15 pts):</strong> Scales your average added LTI against the replacement baseline (50), rewarding managers who consistently target above-replacement talent.</li>
                            <li><strong>Net Points per Move (+/-12 pts):</strong> Measures average net rest-of-season production added per transaction move, comparing acquired assets against surrendered drops.</li>
                            <li><strong>Drop Regret Penalty (up to -15 pts):</strong> Deducts rating equity when a manager drops a starting-caliber skill player who goes on to provide positive Value Over Replacement (VORP) for competitors. Routine drops of kickers, defenses, or sub-replacement bench depth incur zero penalty.</li>
                            <li><strong>Free Agent Gems (+5 pts max):</strong> Rewards finding starting-caliber skill players for $0 or micro-bids (&le; 2% budget).</li>
                        </ul>
                    </div>

                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Empirical Rationale: Activity &amp; Championships</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            Across league history, managers who actively work the waiver wire (averaging 15+ adds per season) secure playoff berths at an 84.6% rate, and 100% of league champions actively acquired starting lineup contributors off the wire during their title runs.
                        </p>
                        <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem;">
                            Baseline 50 represents total wire dormancy. The empirical volume credibility bonus awards up to +4.0 points for proven market engagement, recognizing managers who actively churn depth to uncover breakout starters and patch injury voids.
                        </p>
                    </div>
                </div>
            </div>
        `;

        modal.showModal();
        document.getElementById('btn-close-pickup-rating')?.addEventListener('click', () => modal.close());
        modal.addEventListener('click', (e) => {
            const rect = modal.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                modal.close();
            }
        });
    }

    renderAvgAddedLtiModal() {
        const modalId = 'tx-avg-added-lti-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = modalId;
            modal.className = 'boxscore-modal tx-methodology-dialog';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>How Average Added LTI is Calculated</h2>
                    <p>Talent Caliber &middot; Value Over Replacement (VORP) &middot; Baseline Calibration</p>
                </div>
                <button class="modal-close-btn" id="btn-close-avg-added-lti">&times;</button>
            </div>
            <div class="tx-methodology-content" style="display: flex; flex-direction: column; gap: 1.5rem; font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary);">
                <div style="background: rgba(245, 158, 11, 0.08); border-left: 4px solid var(--accent-gold); padding: 1rem 1.25rem; border-radius: 0 8px 8px 0;">
                    <h3 style="color: var(--accent-gold); margin: 0 0 0.5rem 0; font-size: 1.1rem; font-family: 'Newsreader', Georgia, serif;">Centered at Baseline 50</h3>
                    <p style="margin: 0;">
                        Average Added LTI evaluates the starting-caliber quality of players acquired through waivers and free agency. Centered at 50 (replacement starter level), an average score above 50 indicates that a manager consistently targets legitimate starting contributors, while scores below 50 reflect depth stashes or speculative bench churn.
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Post-Pickup Window Evaluation</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            Each player's LTI is measured over the remaining regular season schedule from the week they were added. Value Over Replacement Player (VORP) is calculated against positional replacement baselines (QB 16.5 PPG, RB/WR 9.5 PPG, TE 7.0 PPG).
                        </p>
                    </div>

                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Streaming Asset Neutralization</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            Kickers and Team Defenses have virtually zero sustainable trade or starting equity above streaming baselines (7.5 PPG for K, 8.0 PPG for DEF). Our engine scales their effective contribution so streaming a weekly defense never distorts your talent rating.
                        </p>
                    </div>
                </div>
            </div>
        `;

        modal.showModal();
        document.getElementById('btn-close-avg-added-lti')?.addEventListener('click', () => modal.close());
        modal.addEventListener('click', (e) => {
            const rect = modal.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                modal.close();
            }
        });
    }

    renderFaabWaiverCoercionModal() {
        const modalId = 'tx-faab-waiver-coercion-modal';
        let modal = document.getElementById(modalId);
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = modalId;
            modal.className = 'boxscore-modal tx-methodology-dialog';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>Standardizing FAAB Budgets &amp; Waiver Priority Eras</h2>
                    <p>Budget Normalization &middot; Capital Coercion &middot; Free Agent Efficiency</p>
                </div>
                <button class="modal-close-btn" id="btn-close-faab-waiver-coercion">&times;</button>
            </div>
            <div class="tx-methodology-content" style="display: flex; flex-direction: column; gap: 1.5rem; font-size: 0.95rem; line-height: 1.6; color: var(--text-secondary);">
                <div style="background: rgba(245, 158, 11, 0.08); border-left: 4px solid var(--accent-gold); padding: 1rem 1.25rem; border-radius: 0 8px 8px 0;">
                    <h3 style="color: var(--accent-gold); margin: 0 0 0.5rem 0; font-size: 1.1rem; font-family: 'Newsreader', Georgia, serif;">Cross-Era Capital Standardization</h3>
                    <p style="margin: 0;">
                        Leagues naturally evolve their transaction rules across seasons. Whether your league utilized traditional rolling waiver priority or modern Free Agent Acquisition Budgets (FAAB), our engine standardizes acquisition capital into a unified framework:
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">FAAB Budget Percentage ($100 Scale)</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            Different seasons or leagues allocate varying starting budgets ($100, $200, or $1,000). Every bid is converted into its exact percentage of starting budget and normalized to a standard $100 baseline, ensuring a $20 bid on a $100 budget is evaluated with the same capital weight as a $40 bid on a $200 budget.
                        </p>
                    </div>

                    <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                        <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Waiver Priority Coercion</h4>
                        <p style="margin: 0; font-size: 0.9rem;">
                            In rolling waiver priority eras, managers spend priority capital to guarantee a claim, dropping to the back of the order. These claims are treated as high-conviction allocations equivalent to primary FAAB bids. Conversely, additions made after players clear waivers are recognized as pure Free Agent pickups requiring zero priority capital.
                        </p>
                    </div>
                </div>

                <div class="card" style="margin: 0; background: var(--bg-card, rgba(255,255,255,0.03)); border: 1px solid var(--border-color); padding: 1.25rem; border-radius: 10px;">
                    <h4 style="color: var(--text-primary); margin: 0 0 0.5rem 0; font-size: 1rem;">Acquisition Efficiency &amp; Free Agent Gems</h4>
                    <p style="margin: 0; font-size: 0.9rem;">
                        Acquisition efficiency evaluates rest-of-season starting production generated per unit of standardized capital spent. Free agent gems recognize starting-caliber skill additions acquired for $0 or micro-bids (&le; 2% of budget), celebrating elite market timing where no budget was sacrificed.
                    </p>
                </div>
            </div>
        `;

        modal.showModal();
        document.getElementById('btn-close-faab-waiver-coercion')?.addEventListener('click', () => modal.close());
        modal.addEventListener('click', (e) => {
            const rect = modal.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                modal.close();
            }
        });
    }

    // ==========================================
    // UI SUB-TAB RENDERERS
    // ==========================================

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const ev = this.evaluateAllTransactions();

        container.innerHTML = `
            <div class="page-scroller-bar">
                <span class="scroller-label">Tracker Views:</span>
                <div class="scroller-links">
                    <button type="button" class="scroller-pill ${this.activeSubTab === 'trades' ? 'active' : ''}" id="tab-tx-trades">Transaction Master Leaderboard</button>
                    <button type="button" class="scroller-pill ${this.activeSubTab === 'overview' ? 'active' : ''}" id="tab-tx-overview">Overview and Superlatives</button>
                    <button type="button" class="scroller-pill ${this.activeSubTab === 'h2h' ? 'active' : ''}" id="tab-tx-h2h">Franchise to Franchise Trade History</button>
                    <button type="button" class="scroller-pill ${this.activeSubTab === 'waivers' ? 'active' : ''}" id="tab-tx-waivers">${this.leagueUsesFaab() ? 'Waiver Wire and FAAB' : 'Waiver Wire'}</button>
                    <button type="button" class="scroller-pill ${this.activeSubTab === 'feed' ? 'active' : ''}" id="tab-tx-feed">Transaction Activity Feed</button>
                </div>
            </div>

            <!-- Top Level Sub-Views -->
            <div id="tx-subview-trades" class="tx-subview" style="display: ${this.activeSubTab === 'trades' ? 'block' : 'none'};">
                ${this.renderTradeMasterSection()}
            </div>

            <div id="tx-subview-overview" class="tx-subview" style="display: ${this.activeSubTab === 'overview' ? 'block' : 'none'};">
                ${this.renderOverviewSection(ev)}
            </div>

            <div id="tx-subview-h2h" class="tx-subview" style="display: ${this.activeSubTab === 'h2h' ? 'block' : 'none'};">
                ${this.renderH2HSection(ev)}
            </div>

            <div id="tx-subview-waivers" class="tx-subview" style="display: ${this.activeSubTab === 'waivers' ? 'block' : 'none'};">
                ${this.renderWaiverWireSection(ev)}
            </div>

            <div id="tx-subview-feed" class="tx-subview" style="display: ${this.activeSubTab === 'feed' ? 'block' : 'none'};">
                ${this.renderFeedSection(ev)}
            </div>
        `;

        this.attachEventListeners();
    }

    attachEventListeners() {
        // Sub-tabs
        const subTabs = ['trades', 'overview', 'h2h', 'waivers', 'feed'];
        subTabs.forEach(st => {
            const btn = document.getElementById(`tab-tx-${st}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    this.activeSubTab = st;
                    this.render();
                });
            }
        });

        // Transaction Master Leaderboard Mode Events
        const btnModeTrades = document.getElementById('btn-lead-mode-trades');
        const btnModePickups = document.getElementById('btn-lead-mode-pickups');
        if (btnModeTrades && btnModePickups) {
            btnModeTrades.addEventListener('click', () => {
                this.leaderboardMode = 'trades';
                this.updateTradeLeaderboard();
            });
            btnModePickups.addEventListener('click', () => {
                this.leaderboardMode = 'pickups';
                this.updateTradeLeaderboard();
            });
        }

        // Leaderboard Era Filter Events
        const btnEraAll = document.getElementById('btn-lead-era-all');
        const btnEra2020 = document.getElementById('btn-lead-era-2020');
        const btnEraCustom = document.getElementById('btn-lead-era-custom');
        if (btnEraAll && btnEra2020) {
            btnEraAll.addEventListener('click', () => {
                this.leaderboardEra = 'all';
                this.updateTradeLeaderboard();
            });
            btnEra2020.addEventListener('click', () => {
                this.leaderboardEra = '2020';
                this.updateTradeLeaderboard();
            });
            if (btnEraCustom) {
                btnEraCustom.addEventListener('click', () => {
                    this.leaderboardEra = 'custom';
                    this.updateTradeLeaderboard();
                });
            }
        }

        const selCustomStart = document.getElementById('select-lead-custom-start');
        const selCustomEnd = document.getElementById('select-lead-custom-end');
        if (selCustomStart && selCustomEnd) {
            selCustomStart.addEventListener('change', (e) => {
                this.leaderboardCustomStart = Number(e.target.value);
                this.updateTradeLeaderboard();
            });
            selCustomEnd.addEventListener('change', (e) => {
                this.leaderboardCustomEnd = Number(e.target.value);
                this.updateTradeLeaderboard();
            });
        }

        const selPickupSystem = document.getElementById('select-lead-pickup-system');
        if (selPickupSystem) {
            selPickupSystem.addEventListener('change', (e) => {
                this.pickupSystem = e.target.value;
                this.updateTradeLeaderboard();
            });
        }

        const btnStatusActive = document.getElementById('btn-lead-status-active');
        const btnStatusAll = document.getElementById('btn-lead-status-all');
        if (btnStatusActive && btnStatusAll) {
            btnStatusActive.addEventListener('click', () => {
                this.leaderboardStatus = 'active';
                this.updateTradeLeaderboard();
            });
            btnStatusAll.addEventListener('click', () => {
                this.leaderboardStatus = 'all';
                this.updateTradeLeaderboard();
            });
        }

        const selLeadSeason = document.getElementById('select-lead-season');
        if (selLeadSeason) {
            selLeadSeason.addEventListener('change', (e) => {
                this.leaderboardSeason = e.target.value;
                this.updateTradeLeaderboard();
            });
        }

        // H2H Manager Selectors
        const sel1 = document.getElementById('h2h-tx-mgr1');
        const sel2 = document.getElementById('h2h-tx-mgr2');
        if (sel1) {
            sel1.addEventListener('change', (e) => {
                this.h2hManager1 = e.target.value;
                this.updateH2HView();
            });
        }
        if (sel2) {
            sel2.addEventListener('change', (e) => {
                this.h2hManager2 = e.target.value;
                this.updateH2HView();
            });
        }

        // Feed Filters
        const yearFilter = document.getElementById('filter-tx-year');
        const typeFilter = document.getElementById('filter-tx-type');
        const mgrFilter = document.getElementById('filter-tx-manager');
        const searchInput = document.getElementById('filter-tx-search');

        if (yearFilter) {
            yearFilter.addEventListener('change', (e) => {
                this.filterYear = e.target.value;
                this.updateFeedView();
            });
        }
        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.filterType = e.target.value;
                this.updateFeedView();
            });
        }
        if (mgrFilter) {
            mgrFilter.addEventListener('change', (e) => {
                this.filterManager = e.target.value;
                this.updateFeedView();
            });
        }
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterSearch = e.target.value.toLowerCase().trim();
                this.updateFeedView();
            });
        }

        // Methodology modal trigger
        const btnMethodology = document.getElementById('btn-tx-methodology');
        if (btnMethodology) {
            btnMethodology.addEventListener('click', () => {
                this.renderMethodologyModal();
            });
        }

        // Clickable player links for Throughline Modal
        this.attachPlayerTriggers();

        // Interactive sort headers for transaction leaderboards
        this.attachSortListeners();
    }

    attachPlayerTriggers() {
        document.querySelectorAll('.player-throughline-trigger').forEach(el => {
            el.addEventListener('click', (e) => {
                e.preventDefault();
                const pName = el.getAttribute('data-player');
                const yr = el.getAttribute('data-season') || (this.filterYear !== 'all' ? this.filterYear : 2024);
                if (pName) {
                    this.renderThroughlineModal(pName, yr);
                }
            });
        });
    }

    attachSortListeners() {
        document.querySelectorAll('.tx-sortable-th[data-sort-trade]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort-trade');
                if (this.tradeSortKey === col) {
                    this.tradeSortAsc = !this.tradeSortAsc;
                } else {
                    this.tradeSortKey = col;
                    this.tradeSortAsc = (col === 'name');
                }
                this.updateTradeLeaderboard();
            });
        });

        document.querySelectorAll('.tx-sortable-th[data-sort-pickup]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort-pickup');
                if (this.pickupSortKey === col) {
                    this.pickupSortAsc = !this.pickupSortAsc;
                } else {
                    this.pickupSortKey = col;
                    this.pickupSortAsc = (col === 'name' || col === 'lostDropPoints');
                }
                this.updateTradeLeaderboard();
            });
        });

        // Modal triggers inside header cells with stopPropagation so sorting is not triggered
        document.querySelectorAll('.btn-trade-record-help').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renderTradeRecordModal();
            });
        });

        document.querySelectorAll('.btn-lti-surplus-help').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renderLtiSurplusModal();
            });
        });

        document.querySelectorAll('.btn-lti-trading-score-help').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renderTradingScoreModal();
            });
        });

        document.querySelectorAll('.btn-avg-added-lti-help').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renderAvgAddedLtiModal();
            });
        });

        document.querySelectorAll('.btn-faab-waiver-coercion-help').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renderFaabWaiverCoercionModal();
            });
        });

        document.querySelectorAll('.btn-lti-pickup-rating-help').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.renderPickupRatingModal();
            });
        });
    }

    updateTradeLeaderboard() {
        const container = document.getElementById('trade-leaderboard-table-container');
        if (!container) return;
        container.innerHTML = this.leaderboardMode === 'pickups'
            ? this.renderPickupLeaderboardTable()
            : this.renderTradeLeaderboardTable();
        this.attachPlayerTriggers();
        this.attachSortListeners();

        // Update active classes on mode buttons
        const btnModeTrades = document.getElementById('btn-lead-mode-trades');
        const btnModePickups = document.getElementById('btn-lead-mode-pickups');
        if (btnModeTrades && btnModePickups) {
            btnModeTrades.classList.toggle('active', this.leaderboardMode === 'trades');
            btnModePickups.classList.toggle('active', this.leaderboardMode === 'pickups');
        }

        // Update active classes on era buttons
        const btnEraAll = document.getElementById('btn-lead-era-all');
        const btnEra2020 = document.getElementById('btn-lead-era-2020');
        const btnEraCustom = document.getElementById('btn-lead-era-custom');
        if (btnEraAll && btnEra2020) {
            btnEraAll.classList.toggle('active', this.leaderboardEra === 'all');
            btnEra2020.classList.toggle('active', this.leaderboardEra === '2020');
            if (btnEraCustom) {
                btnEraCustom.classList.toggle('active', this.leaderboardEra === 'custom');
            }
        }

        const customRangeWrap = document.getElementById('lead-custom-range-wrap');
        if (customRangeWrap) {
            customRangeWrap.style.display = this.leaderboardEra === 'custom' ? 'inline-flex' : 'none';
        }

        const selPickupSystem = document.getElementById('select-lead-pickup-system');
        if (selPickupSystem) {
            selPickupSystem.style.display = (this.leaderboardMode === 'pickups' && this.leagueUsesFaab()) ? 'inline-block' : 'none';
        }

        const btnStatusActive = document.getElementById('btn-lead-status-active');
        const btnStatusAll = document.getElementById('btn-lead-status-all');
        if (btnStatusActive && btnStatusAll) {
            btnStatusActive.classList.toggle('active', this.leaderboardStatus === 'active');
            btnStatusAll.classList.toggle('active', this.leaderboardStatus === 'all');
        }
    }

    updateH2HView() {
        const container = document.getElementById('h2h-trade-results-container');
        if (!container) return;
        container.innerHTML = this.renderH2HTradeHistory();
        this.attachPlayerTriggers();
    }

    updateFeedView() {
        const container = document.getElementById('tx-feed-list-container');
        if (!container) return;
        const ev = this.evaluateAllTransactions();
        container.innerHTML = this.renderFeedItems(ev);
        this.attachPlayerTriggers();
    }

    // ==========================================
    // SECTION BUILDERS
    // ==========================================

    renderOverviewSection(ev) {
        const topFleece = ev.unfairTrades[0];
        const topPickup = ev.bestPickups[0];
        const topWorstDrop = ev.worstDrops[0];
        const topNomad = ev.fantasyNomads[0];

        return `
            <div class="tx-hero-banner card">
                <div class="tx-hero-header">
                    <h2>Transactions Tracker</h2>
                    <p class="tx-hero-subtitle">
                        Every trade, waiver wire claim, and in-season drop evaluated through the Landon Transaction Index (LTI), as tracking who actually won each deal across league history.
                    </p>
                </div>
                <div class="tx-highlight-grid">
                    <div class="tx-highlight-card">
                        <span class="tx-hl-label">All-Time True Fleece</span>
                        <div class="tx-hl-value">${topFleece ? `${topFleece.team1.isWinner ? topFleece.team1.managerName : topFleece.team2.managerName} (+${topFleece.pointDifference} pts)` : 'None'}</div>
                        <span class="tx-hl-desc">${topFleece ? `${this.formatSeasonYear(topFleece.season)} &middot; ${topFleece.team1.managerName} vs ${topFleece.team2.managerName}` : ''}</span>
                    </div>
                    <div class="tx-highlight-card">
                        <span class="tx-hl-label">Best Pickup of All Time</span>
                        <div class="tx-hl-value">${topPickup ? topPickup.playerName : 'None'}</div>
                        <span class="tx-hl-desc">${topPickup ? `${topPickup.rosPoints} pts &middot; ${topPickup.rosLti} LTI &middot; ${topPickup.managerName}` : ''}</span>
                    </div>
                    <div class="tx-highlight-card">
                        <span class="tx-hl-label">Most Catastrophic Drop</span>
                        <div class="tx-hl-value">${topWorstDrop ? topWorstDrop.playerName : 'None'}</div>
                        <span class="tx-hl-desc">${topWorstDrop ? `Dropped in Week ${topWorstDrop.week} by ${topWorstDrop.managerName} &middot; Scored ${topWorstDrop.postDropPoints} pts (${topWorstDrop.postDropLti} LTI) afterwards` : ''}</span>
                    </div>
                    <div class="tx-highlight-card">
                        <span class="tx-hl-label">The League Nomad</span>
                        <div class="tx-hl-value">${topNomad ? topNomad.name : 'None'}</div>
                        <span class="tx-hl-desc">${topNomad ? `${topNomad.count} career roster moves and transfers (Skill Player)` : ''}</span>
                    </div>
                </div>
            </div>

            <!-- Top Superlative Grids -->
            <div class="tx-grid-two-col">
                <!-- Fleeces and Robberies -->
                <div class="card">
                    <h3>Most Unfair Trades (True Fleeces & Highway Robberies)</h3>
                    <p class="tx-card-subtitle">The most lopsided exchanges in league history incorporating starting lineup consolidation.</p>
                    <div class="tx-table-wrap">
                        <table class="tx-table">
                            <thead>
                                <tr>
                                    <th>Season</th>
                                    <th>Winner</th>
                                    <th>Loser</th>
                                    <th>Net Advantage</th>
                                    <th>Verdict</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ev.unfairTrades.slice(0, 10).map(tr => {
                                    const w = tr.team1.isWinner ? tr.team1 : tr.team2;
                                    const l = tr.team1.isWinner ? tr.team2 : tr.team1;
                                    return `
                                        <tr>
                                            <td>${this.formatSeasonYear(tr.season)}</td>
                                            <td><strong>${w.managerName}</strong><br><small class="tx-muted">${w.players.map(p => p.playerName).join(', ')}</small></td>
                                            <td><strong>${l.managerName}</strong><br><small class="tx-muted">${l.players.map(p => p.playerName).join(', ')}</small></td>
                                            <td style="white-space: nowrap;">
                                                <span class="ldi-pill ldi-pill-high">+${tr.ltiDifference} LTI</span>
                                                <div class="tx-pos" style="font-size: 0.8rem; margin-top: 3px;">+${tr.pointDifference} pts</div>
                                            </td>
                                            <td><span class="tx-trade-verdict-badge ${tr.gradeBadge}">${tr.verdict}</span></td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Balanced Trades -->
                <div class="card">
                    <h3>Most Equal Trades (True Win-Win)</h3>
                    <p class="tx-card-subtitle">Trades where both managers received near-identical starting value and output.</p>
                    <div class="tx-table-wrap">
                        <table class="tx-table">
                            <thead>
                                <tr>
                                    <th>Season</th>
                                    <th>Team 1</th>
                                    <th>Team 2</th>
                                    <th>Margin</th>
                                    <th>Verdict</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ev.equalTrades.slice(0, 10).map(tr => `
                                    <tr>
                                        <td>${this.formatSeasonYear(tr.season)}</td>
                                        <td><strong>${tr.team1.managerName}</strong><br><small class="tx-muted">${tr.team1.players.map(p => p.playerName).join(', ')}</small></td>
                                        <td><strong>${tr.team2.managerName}</strong><br><small class="tx-muted">${tr.team2.players.map(p => p.playerName).join(', ')}</small></td>
                                        <td>&plusmn;${tr.pointDifference} pts</td>
                                        <td><span class="tx-trade-verdict-badge verdict-balanced">Balanced Deal</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="tx-grid-two-col" style="margin-top: 1.5rem;">
                <!-- Worst Drops (In-Season Blunders) -->
                <div class="card">
                    <h3>Worst Drops of All Time (In-Season)</h3>
                    <p class="tx-card-subtitle">Mid-season panic cuts (Week 1+) ranked by post-drop fantasy production.</p>
                    <div class="tx-table-wrap">
                        <table class="tx-table">
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>Dropped By</th>
                                    <th>Week</th>
                                    <th>Post-Drop Output</th>
                                    <th>Post-Drop LTI</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ev.worstDrops.slice(0, 10).map(d => `
                                    <tr>
                                        <td>
                                            <div class="tx-player-cell">
                                                <a href="#" class="player-throughline-trigger" data-player="${d.playerName}" data-season="${d.season}"><strong>${d.playerName}</strong></a>
                                                <span class="tx-pos-tag">${d.position}</span>
                                            </div>
                                        </td>
                                        <td>${d.managerName}</td>
                                        <td style="white-space: nowrap;">Week ${d.week} (${this.formatSeasonYear(d.season)})</td>
                                        <td class="tx-pos" style="white-space: nowrap;">
                                            <div>${d.postDropPoints} pts</div>
                                            <div class="tx-muted" style="font-size: 0.75rem; white-space: nowrap;">(${d.postDropPpg} PPG)</div>
                                        </td>
                                        <td><span class="ldi-pill ldi-pill-high">${d.postDropLti}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Best Pickups -->
                <div class="card">
                    <h3>Top Pickups of All Time</h3>
                    <p class="tx-card-subtitle">Mid-season waiver and FA acquisitions ranked by rest-of-season output.</p>
                    <div class="tx-table-wrap">
                        <table class="tx-table">
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>Acquired By</th>
                                    <th>When</th>
                                    <th>${this.leagueUsesFaab() ? 'Cost' : 'Claim Type'}</th>
                                    <th>ROS Output</th>
                                    <th>ROS LTI</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ev.bestPickups.slice(0, 10).map(pk => `
                                    <tr>
                                        <td>
                                            <div class="tx-player-cell">
                                                <a href="#" class="player-throughline-trigger" data-player="${pk.playerName}" data-season="${pk.season}"><strong>${pk.playerName}</strong></a>
                                                <span class="tx-pos-tag">${pk.position}</span>
                                            </div>
                                        </td>
                                        <td>${pk.managerName}</td>
                                        <td style="white-space: nowrap;">Week ${pk.week} (${this.formatSeasonYear(pk.season)})</td>
                                        <td style="white-space: nowrap;">${this.leagueUsesFaab() ? (pk.faabBid > 0 ? `<strong>$${pk.faabBid}</strong> <small class="tx-muted">(${pk.budgetPct}%)</small>` : 'Free') : (pk.isFreeAgent ? 'Free Agent' : 'Waivers')}</td>
                                        <td class="tx-pos" style="white-space: nowrap;">
                                            <div>${pk.rosPoints} pts</div>
                                            <div class="tx-muted" style="font-size: 0.75rem; white-space: nowrap;">(${pk.rosPpg} PPG)</div>
                                        </td>
                                        <td><span class="ldi-pill ldi-pill-high">${pk.rosLti}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Nomads and Transaction Records -->
            <div class="tx-grid-two-col" style="margin-top: 1.5rem;">
                <div class="card">
                    <h3>The Career Nomads (Skill Positions)</h3>
                    <p class="tx-card-subtitle">Skill-position players who changed rosters the most times in league history.</p>
                    <div class="tx-table-wrap">
                        <table class="tx-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Player</th>
                                    <th>Total Moves & Transfers</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ev.fantasyNomads.slice(0, 5).map((n, idx) => `
                                    <tr>
                                        <td><strong>#${idx + 1}</strong></td>
                                        <td><a href="#" class="player-throughline-trigger" data-player="${n.name}"><strong>${n.name}</strong></a></td>
                                        <td><strong style="color: var(--accent-gold);">${n.count} moves</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="card">
                    <h3>Single-Season Waiver Shuttles</h3>
                    <p class="tx-card-subtitle">Players cut and claimed off the waiver wire the most times in a single year.</p>
                    <div class="tx-table-wrap">
                        <table class="tx-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Player</th>
                                    <th>Season</th>
                                    <th>In-Season Moves</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ev.seasonWaiverShuttles.slice(0, 5).map((s, idx) => `
                                    <tr>
                                        <td><strong>#${idx + 1}</strong></td>
                                        <td><a href="#" class="player-throughline-trigger" data-player="${s.name}" data-season="${s.season}"><strong>${s.name}</strong></a></td>
                                        <td>${this.formatSeasonYear(s.season)}</td>
                                        <td><strong style="color: var(--accent-gold);">${s.count} moves</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }

    renderTradeMasterSection() {
        const seasons = [...new Set((this.transactions || []).map(t => Number(t.season || t.year)).filter(Boolean))].sort((a, b) => b - a);

        return `
            <div class="card">
                <div class="tx-toolbar-row">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <h2>All-Time Transaction Master Leaderboard</h2>
                        </div>
                        <p class="tx-card-subtitle">Ranked by career transaction acumen, starting lineup surplus, and Landon Transaction Index (LTI) impact.</p>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
                        <!-- Mode toggle -->
                        <div class="tx-filter-btn-group">
                            <button type="button" class="tx-btn-toggle ${this.leaderboardMode === 'trades' ? 'active' : ''}" id="btn-lead-mode-trades">Trade Acumen</button>
                            <button type="button" class="tx-btn-toggle ${this.leaderboardMode === 'pickups' ? 'active' : ''}" id="btn-lead-mode-pickups">Pickup & Waiver Acumen</button>
                        </div>

                        <!-- Era toggle -->
                        <div class="tx-filter-btn-group">
                            <button type="button" class="tx-btn-toggle ${this.leaderboardEra === 'all' ? 'active' : ''}" id="btn-lead-era-all">All-Time</button>
                            <button type="button" class="tx-btn-toggle ${this.leaderboardEra === '2020' ? 'active' : ''}" id="btn-lead-era-2020">2020-Present</button>
                            <button type="button" class="tx-btn-toggle ${this.leaderboardEra === 'custom' ? 'active' : ''}" id="btn-lead-era-custom">Custom Range</button>
                        </div>

                        <!-- Custom Range Dropdowns -->
                        <div class="tx-custom-range-wrap" id="lead-custom-range-wrap" style="display: ${this.leaderboardEra === 'custom' ? 'inline-flex' : 'none'};">
                            <label for="select-lead-custom-start">From:</label>
                            <select id="select-lead-custom-start" class="tx-select-season">
                                ${seasons.map(y => `<option value="${y}" ${Number(y) === Number(this.leaderboardCustomStart) ? 'selected' : ''}>${this.formatSeasonYear(y)}</option>`).join('')}
                            </select>
                            <label for="select-lead-custom-end">To:</label>
                            <select id="select-lead-custom-end" class="tx-select-season">
                                ${seasons.map(y => `<option value="${y}" ${Number(y) === Number(this.leaderboardCustomEnd) ? 'selected' : ''}>${this.formatSeasonYear(y)}</option>`).join('')}
                            </select>
                        </div>

                        <!-- Pickup System Filter -->
                        <select id="select-lead-pickup-system" class="tx-select-season" style="display: ${this.leaderboardMode === 'pickups' && this.leagueUsesFaab() ? 'inline-block' : 'none'};">
                            <option value="all" ${this.pickupSystem === 'all' ? 'selected' : ''}>All Systems</option>
                            <option value="faab" ${this.pickupSystem === 'faab' ? 'selected' : ''}>FAAB Era Only</option>
                            <option value="waiver" ${this.pickupSystem === 'waiver' ? 'selected' : ''}>Waiver Priority Era Only</option>
                        </select>

                        <!-- Status toggle -->
                        <div class="tx-filter-btn-group">
                            <button type="button" class="tx-btn-toggle ${this.leaderboardStatus === 'active' ? 'active' : ''}" id="btn-lead-status-active">Active Only</button>
                            <button type="button" class="tx-btn-toggle ${this.leaderboardStatus === 'all' ? 'active' : ''}" id="btn-lead-status-all">All Managers</button>
                        </div>

                        <!-- Season select -->
                        <select id="select-lead-season" class="tx-select-season">
                            <option value="all" ${this.leaderboardSeason === 'all' ? 'selected' : ''}>All Seasons</option>
                            ${seasons.map(y => `<option value="${y}" ${String(y) === String(this.leaderboardSeason) ? 'selected' : ''}>${this.formatSeasonYear(y)}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div id="trade-leaderboard-table-container">
                    ${this.leaderboardMode === 'pickups' ? this.renderPickupLeaderboardTable() : this.renderTradeLeaderboardTable()}
                </div>
            </div>
        `;
    }

    renderTradeLeaderboardTable() {
        if (this.leaderboardSeason !== 'all' && this.isSeasonUnplayed(this.leaderboardSeason)) {
            return `
                <div class="tx-table-wrap">
                    <div style="text-align: center; color: var(--text-muted); padding: 3rem 1.5rem; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: 8px;">
                        <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">${this.formatSeasonYear(this.leaderboardSeason)} Season Pending Kickoff</h4>
                        <p style="margin: 0; font-size: 0.9rem;">Regular season games have not started yet for this season. Trade evaluations and manager trading ratings will populate automatically as weekly NFL matchups are played.</p>
                    </div>
                </div>
            `;
        }

        const leaderboard = this.getFilteredManagerLeaderboard();

        const getIndicator = (key) => {
            if (this.tradeSortKey !== key) return '<span class="tx-sort-arrow">↕</span>';
            return this.tradeSortAsc
                ? '<span class="tx-sort-arrow" style="opacity: 1; color: var(--accent-gold);">▲</span>'
                : '<span class="tx-sort-arrow" style="opacity: 1; color: var(--accent-gold);">▼</span>';
        };

        return `
            <div class="tx-table-wrap">
                <table class="tx-table">
                    <thead>
                        <tr>
                            <th class="tx-sortable-th ${this.tradeSortKey === 'rank' ? 'sorted' : ''}" data-sort-trade="rank">Rank ${getIndicator('rank')}</th>
                            <th class="tx-sortable-th ${this.tradeSortKey === 'name' ? 'sorted' : ''}" data-sort-trade="name">Manager ${getIndicator('name')}</th>
                            <th class="tx-sortable-th ${this.tradeSortKey === 'trades' ? 'sorted' : ''}" data-sort-trade="trades">Trades ${getIndicator('trades')}</th>
                            <th class="tx-sortable-th ${this.tradeSortKey === 'record' ? 'sorted' : ''}" data-sort-trade="record">
                                <span style="display: inline-flex; align-items: center; gap: 5px;">
                                    Record (W-L-T)
                                    <button type="button" class="tx-info-help-btn btn-trade-record-help" title="Trade Record and Evaluation Methodology" aria-label="Trade Record Info" style="width: 16px; height: 16px; font-size: 0.65rem; padding: 0; line-height: 1;">?</button>
                                    ${getIndicator('record')}
                                </span>
                            </th>
                            <th class="tx-sortable-th ${this.tradeSortKey === 'winRate' ? 'sorted' : ''}" data-sort-trade="winRate">Win % ${getIndicator('winRate')}</th>
                            <th class="tx-sortable-th ${this.tradeSortKey === 'netPoints' ? 'sorted' : ''}" data-sort-trade="netPoints">Adjusted Lineup Net Pts ${getIndicator('netPoints')}</th>
                            <th class="tx-sortable-th ${this.tradeSortKey === 'avgLtiSurplus' ? 'sorted' : ''}" data-sort-trade="avgLtiSurplus">
                                <span style="display: inline-flex; align-items: center; gap: 5px;">
                                    LTI Surplus
                                    <button type="button" class="tx-info-help-btn btn-lti-surplus-help" title="How LTI Surplus is Calculated" aria-label="LTI Surplus Info" style="width: 16px; height: 16px; font-size: 0.65rem; padding: 0; line-height: 1;">?</button>
                                    ${getIndicator('avgLtiSurplus')}
                                </span>
                            </th>
                            <th class="tx-sortable-th ${this.tradeSortKey === 'rating' ? 'sorted' : ''}" data-sort-trade="rating">
                                <span style="display: inline-flex; align-items: center; gap: 5px;">
                                    LTI Trading Rating
                                    <button type="button" class="tx-info-help-btn btn-lti-trading-score-help" title="How LTI Trading Rating is Calculated" aria-label="LTI Trading Rating Info" style="width: 16px; height: 16px; font-size: 0.65rem; padding: 0; line-height: 1;">?</button>
                                    ${getIndicator('rating')}
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${leaderboard.length === 0 ? `
                            <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No trades recorded matching the selected filter criteria.</td></tr>
                        ` : leaderboard.map((m, idx) => `
                            <tr>
                                <td><strong>#${idx + 1}</strong></td>
                                <td>
                                    <div style="display:flex; align-items:center; gap: 0.5rem;">
                                        ${m.logoUrl ? `<img src="${m.logoUrl}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">` : ''}
                                        <strong>${m.name}</strong>
                                    </div>
                                </td>
                                <td>${m.tradesCount}</td>
                                <td>${m.wins}-${m.losses}-${m.ties}</td>
                                <td>${m.winRate}%</td>
                                <td class="${m.netPoints >= 0 ? 'tx-pos' : 'tx-neg'}">${m.netPoints >= 0 ? `+${m.netPoints}` : m.netPoints}</td>
                                <td><span class="ldi-pill ${m.avgLtiSurplus >= 0 ? 'ldi-pill-high' : 'ldi-pill-low'}">${m.avgLtiSurplus >= 0 ? `+${m.avgLtiSurplus}` : m.avgLtiSurplus}</span></td>
                                <td><strong style="font-size: 1.1rem; color: var(--accent-gold);">${m.rating}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderPickupLeaderboardTable() {
        if (this.leaderboardSeason !== 'all' && this.isSeasonUnplayed(this.leaderboardSeason)) {
            return `
                <div class="tx-table-wrap">
                    <div style="text-align: center; color: var(--text-muted); padding: 3rem 1.5rem; background: var(--bg-surface); border: 1px dashed var(--border-color); border-radius: 8px;">
                        <h4 style="color: var(--text-primary); margin-bottom: 0.5rem;">${this.formatSeasonYear(this.leaderboardSeason)} Season Pending Kickoff</h4>
                        <p style="margin: 0; font-size: 0.9rem;">Regular season games have not started yet for this season. Waiver wire and free agent pickup evaluations will populate automatically as weekly NFL matchups are played.</p>
                    </div>
                </div>
            `;
        }

        const leaderboard = this.getFilteredPickupLeaderboard();

        const getIndicator = (key) => {
            if (this.pickupSortKey !== key) return '<span class="tx-sort-arrow">↕</span>';
            return this.pickupSortAsc
                ? '<span class="tx-sort-arrow" style="opacity: 1; color: var(--accent-gold);">▲</span>'
                : '<span class="tx-sort-arrow" style="opacity: 1; color: var(--accent-gold);">▼</span>';
        };

        return `
            <div class="tx-table-wrap">
                <table class="tx-table">
                    <thead>
                        <tr>
                            <th class="tx-sortable-th ${this.pickupSortKey === 'rank' ? 'sorted' : ''}" data-sort-pickup="rank">Rank ${getIndicator('rank')}</th>
                            <th class="tx-sortable-th ${this.pickupSortKey === 'name' ? 'sorted' : ''}" data-sort-pickup="name">Manager ${getIndicator('name')}</th>
                            <th class="tx-sortable-th ${this.pickupSortKey === 'adds' ? 'sorted' : ''}" data-sort-pickup="adds">Adds ${getIndicator('adds')}</th>
                            <th class="tx-sortable-th ${this.pickupSortKey === 'totalRosPoints' ? 'sorted' : ''}" data-sort-pickup="totalRosPoints">ROS Pts ${getIndicator('totalRosPoints')}</th>
                            <th class="tx-sortable-th ${this.pickupSortKey === 'avgNetPoints' ? 'sorted' : ''}" data-sort-pickup="avgNetPoints" title="Average net additional points added per waiver transaction">Avg Add Pts ${getIndicator('avgNetPoints')}</th>
                            <th class="tx-sortable-th ${this.pickupSortKey === 'avgAddedLti' ? 'sorted' : ''}" data-sort-pickup="avgAddedLti">
                                <span style="display: inline-flex; align-items: center; gap: 4px;">
                                    Avg LTI
                                    <button type="button" class="tx-info-help-btn btn-avg-added-lti-help" title="How Average Added LTI is Calculated" aria-label="Avg Added LTI Info" style="width: 15px; height: 15px; font-size: 0.65rem; padding: 0; line-height: 1;">?</button>
                                    ${getIndicator('avgAddedLti')}
                                </span>
                            </th>
                            <th class="tx-sortable-th ${this.pickupSortKey === 'lostDropPoints' ? 'sorted' : ''}" data-sort-pickup="lostDropPoints">Drop Loss ${getIndicator('lostDropPoints')}</th>
                            <th class="tx-sortable-th ${this.pickupSortKey === 'netAcqPoints' ? 'sorted' : ''}" data-sort-pickup="netAcqPoints">Net Acq ${getIndicator('netAcqPoints')}</th>
                            <th class="tx-sortable-th ${this.pickupSortKey === 'freeAgentGems' ? 'sorted' : ''}" data-sort-pickup="freeAgentGems" title="Free Agent Gems: starting-caliber skill additions on $0 or micro-bids">
                                FA Gems ${getIndicator('freeAgentGems')}
                            </th>
                            ${this.leagueUsesFaab()
                                ? `<th class="tx-sortable-th ${this.pickupSortKey === 'totalFaabSpent' ? 'sorted' : ''}" data-sort-pickup="totalFaabSpent">
                                    <span style="display: inline-flex; align-items: center; gap: 4px;">
                                        FAAB Spent
                                        <button type="button" class="tx-info-help-btn btn-faab-waiver-coercion-help" title="How FAAB vs Waiver Priority is Standardized" aria-label="FAAB vs Waiver Standardization Info" style="width: 15px; height: 15px; font-size: 0.65rem; padding: 0; line-height: 1;">?</button>
                                        ${getIndicator('totalFaabSpent')}
                                    </span>
                                   </th>`
                                : `<th class="tx-sortable-th ${this.pickupSortKey === 'waiverClaims' ? 'sorted' : ''}" data-sort-pickup="waiverClaims">
                                    <span style="display: inline-flex; align-items: center; gap: 4px;">
                                        Waiver Claims
                                        <button type="button" class="tx-info-help-btn btn-faab-waiver-coercion-help" title="How FAAB vs Waiver Priority is Standardized" aria-label="FAAB vs Waiver Standardization Info" style="width: 15px; height: 15px; font-size: 0.65rem; padding: 0; line-height: 1;">?</button>
                                        ${getIndicator('waiverClaims')}
                                    </span>
                                   </th>`
                            }
                            <th class="tx-sortable-th ${this.pickupSortKey === 'rating' ? 'sorted' : ''}" data-sort-pickup="rating">
                                <span style="display: inline-flex; align-items: center; gap: 4px;">
                                    Pickup Rating
                                    <button type="button" class="tx-info-help-btn btn-lti-pickup-rating-help" title="How LTI Pickup Rating is Calculated" aria-label="LTI Pickup Rating Info" style="width: 15px; height: 15px; font-size: 0.65rem; padding: 0; line-height: 1;">?</button>
                                    ${getIndicator('rating')}
                                </span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${leaderboard.length === 0 ? `
                            <tr><td colspan="11" style="text-align: center; color: var(--text-muted); padding: 2rem;">No pickup or waiver transactions recorded matching the selected filter criteria.</td></tr>
                        ` : leaderboard.map((m, idx) => `
                            <tr>
                                <td><strong>#${idx + 1}</strong></td>
                                <td>
                                    <div style="display:flex; align-items:center; gap: 0.5rem;">
                                        ${m.logoUrl ? `<img src="${m.logoUrl}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">` : ''}
                                        <strong>${m.name}</strong>
                                    </div>
                                </td>
                                <td>${m.addsCount}</td>
                                <td>+${m.totalRosPoints}</td>
                                <td class="${m.avgNetPoints >= 0 ? 'tx-pos' : 'tx-neg'}"><strong>${m.avgNetPoints >= 0 ? `+${m.avgNetPoints}` : m.avgNetPoints}</strong></td>
                                <td><span class="ldi-pill ldi-pill-high">${m.avgAddedLti}</span></td>
                                <td class="${m.lostDropPoints > 0 ? 'tx-neg' : 'tx-muted'}">${m.lostDropPoints > 0 ? `-${m.lostDropPoints}` : '0.0'}</td>
                                <td class="${m.netAcqPoints >= 0 ? 'tx-pos' : 'tx-neg'}"><strong>${m.netAcqPoints >= 0 ? `+${m.netAcqPoints}` : m.netAcqPoints}</strong></td>
                                <td>${m.freeAgentGems > 0 ? `<strong style="color: var(--accent-green, #10b981);">${m.freeAgentGems}</strong>` : '0'}</td>
                                ${this.leagueUsesFaab()
                                    ? `<td>$${m.totalFaabSpent} ${m.budgetPctSpent !== null ? `<small class="tx-muted">(${m.budgetPctSpent}% bgt)</small>` : ''}</td>`
                                    : `<td><strong>${m.waiverClaims}</strong> <small class="tx-muted">(${m.freeAgentAdds} FA)</small></td>`
                                }
                                <td><strong style="font-size: 1.1rem; color: var(--accent-gold);">${m.rating}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    renderH2HSection(ev) {
        return `
            <div class="card">
                <h2>Franchise to Franchise Trade History</h2>
                <p class="tx-card-subtitle">Examine the lifetime trading ledger and series record between any two league managers.</p>
                
                <div class="h2h-select-row" style="margin: 1.5rem 0;">
                    <div class="manager-select-box">
                        <label for="h2h-tx-mgr1">Manager 1</label>
                        <select id="h2h-tx-mgr1">
                            ${this.managers.map(m => `<option value="${m.id}" ${m.id === this.h2hManager1 ? 'selected' : ''}>${m.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="vs-badge">VS</div>
                    <div class="manager-select-box">
                        <label for="h2h-tx-mgr2">Manager 2</label>
                        <select id="h2h-tx-mgr2">
                            ${this.managers.map(m => `<option value="${m.id}" ${m.id === this.h2hManager2 ? 'selected' : ''}>${m.name}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div id="h2h-trade-results-container">
                    ${this.renderH2HTradeHistory()}
                </div>
            </div>
        `;
    }

    renderH2HTradeHistory() {
        const trades = this.getHeadToHeadTrades(this.h2hManager1, this.h2hManager2);
        const m1 = this.managerMap.get(String(this.h2hManager1).toLowerCase());
        const m2 = this.managerMap.get(String(this.h2hManager2).toLowerCase());

        if (!m1 || !m2 || m1.id === m2.id) {
            return `<p style="color: var(--text-muted); text-align: center; padding: 2rem 0;">Please select two different managers to view their trading history.</p>`;
        }

        if (trades.length === 0) {
            return `
                <div class="tx-empty-state">
                    <p style="color: var(--text-muted); text-align: center; padding: 2rem 0;">
                        No recorded trades between <strong>${m1.name}</strong> and <strong>${m2.name}</strong> in league history.
                    </p>
                </div>
            `;
        }

        let m1Wins = 0;
        let m2Wins = 0;
        let ties = 0;
        let m1NetPts = 0;

        trades.forEach(tr => {
            const isM1Side1 = tr.team1.managerId === m1.id;
            const m1Side = isM1Side1 ? tr.team1 : tr.team2;
            const m2Side = isM1Side1 ? tr.team2 : tr.team1;

            if (m1Side.isWinner) m1Wins++;
            else if (m2Side.isWinner) m2Wins++;
            else ties++;

            m1NetPts += m1Side.netPoints;
        });

        m1NetPts = Math.round(m1NetPts * 10) / 10;

        return `
            <div class="h2h-summary-card" style="margin-bottom: 1.5rem; text-align: center;">
                <div style="display:flex; justify-content: space-around; align-items: center;">
                    <div>
                        <h3>${m1.name}</h3>
                        <p style="font-size: 1.5rem; font-weight: 800; color: var(--accent-gold);">${m1Wins} Wins</p>
                    </div>
                    <div>
                        <span class="tx-muted">${trades.length} Total Trades</span><br>
                        <strong>${ties} Balanced Deals</strong><br>
                        <span style="font-size: 0.9rem;" class="${m1NetPts >= 0 ? 'tx-pos' : 'tx-neg'}">
                            ${m1NetPts >= 0 ? `${m1.name} +${m1NetPts} ROS pts` : `${m2.name} +${Math.abs(m1NetPts)} ROS pts`}
                        </span>
                    </div>
                    <div>
                        <h3>${m2.name}</h3>
                        <p style="font-size: 1.5rem; font-weight: 800; color: var(--accent-gold);">${m2Wins} Wins</p>
                    </div>
                </div>
            </div>

            <div class="tx-trade-cards-list">
                ${trades.map(tr => this.renderTradeCard(tr, m1.id, m2.id)).join('')}
            </div>
        `;
    }

    renderTradeCard(tr, leftManagerId = null, rightManagerId = null) {
        const yr = Number(tr.season || tr.year);
        
        // Orientation: if leftManagerId matches team2, team2 is on the left
        const isTeam2Left = leftManagerId && String(tr.team2.managerId).toLowerCase() === String(leftManagerId).toLowerCase();
        const teamA = isTeam2Left ? tr.team2 : tr.team1;
        const teamB = isTeam2Left ? tr.team1 : tr.team2;

        const renderTradeSide = (team) => {
            const isWinner = Boolean(team.isWinner);
            const mgrName = team.managerName || '';
            const teamName = team.teamName || '';
            const players = team.players || [];
            const lineupPts = team.lineupPoints !== undefined ? team.lineupPoints : 0;
            const netPts = team.netPoints !== undefined ? team.netPoints : 0;
            const netLti = team.netLti !== undefined ? team.netLti : 0;

            const ltiPillHtml = tr.isPending ? `
                <span class="ldi-pill ldi-pill-pending">Pending</span>
            ` : `
                <span class="ldi-pill ${netLti > 0 ? 'ldi-pill-high' : (netLti < 0 ? 'ldi-pill-low' : '')}">
                    ${netLti > 0 ? `+${netLti}` : netLti} LTI
                </span>
            `;

            return `
                <div class="tx-trade-side ${isWinner ? 'winner-side' : ''}">
                    <div>
                        <div class="tx-side-mgr" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <strong>${mgrName}</strong>
                                ${ltiPillHtml}
                            </div>
                            <span class="tx-side-team">${teamName}</span>
                        </div>
                        <div class="tx-side-players">
                            <span class="tx-players-label">Acquired:</span>
                            <ul>
                                ${players.map(p => {
                                    const pre = p.preTrade;
                                    const post = p.postTrade;
                                    const pts = post ? post.totalPoints : 0;
                                    const ppg = post ? post.ppg : 0;
                                    const gp = post ? post.gamesPlayed : 0;
                                    const missed = p.missedWeeks || 0;
                                    const rosLti = post ? post.ltiScore : 50;
                                    const pos = p.position || (post ? post.position : 'UTIL');

                                    return `
                                        <li>
                                            <div class="tx-player-cell">
                                                <a href="#" class="player-throughline-trigger" data-player="${p.playerName}" data-season="${yr}"><strong>${p.playerName}</strong></a>
                                                <span class="tx-pos-tag">${pos}</span>
                                            </div>
                                            <span class="tx-player-sub">
                                                ${tr.isPending ? `
                                                    ROS: <span class="ldi-pill-sm ldi-pill-pending">Season Pending</span>
                                                ` : `
                                                    ${pre ? `Pre: <span class="ldi-pill-sm">${pre.ltiScore} LTI</span> &middot; ` : ''}
                                                    ROS: <span class="ldi-pill-sm ${rosLti >= 55 ? 'ldi-pill-high' : (rosLti < 45 ? 'ldi-pill-low' : '')}">${rosLti} LTI</span>
                                                    (${pts} actual pts &middot; ${ppg} PPG over ${gp} gp${missed > 0 ? ` &middot; missed ${missed} game${missed > 1 ? 's' : ''}` : ''})
                                                `}
                                            </span>
                                        </li>
                                    `;
                                }).join('')}
                            </ul>
                        </div>
                    </div>

                    <div class="tx-side-footer">
                        ${tr.isPending ? `
                            <span>Season Pending Kickoff</span>
                        ` : `
                            <span>Rest-of-Season Production: <strong>${lineupPts} pts</strong></span>
                        `}
                    </div>
                </div>
            `;
        };

        return `
            <div class="tx-trade-card card ${tr.gradeBadge || 'balanced-deal'}">
                <div class="tx-trade-header">
                    <div class="tx-trade-meta">
                        <span class="tx-trade-type-badge">TRADE</span>
                        <span class="tx-trade-date">${this.formatSeasonYear(yr)} &middot; ${tr.week > 0 ? `Week ${tr.week}` : 'Preseason'} &middot; ${tr.timestamp || ''}</span>
                    </div>
                    <div class="tx-trade-verdict-badge ${tr.gradeBadge || 'balanced-deal'}">
                        ${tr.verdict || 'Balanced Deal'}
                    </div>
                </div>

                <div class="tx-trade-body">
                    ${renderTradeSide(teamA)}
                    <div class="tx-trade-divider">&harr;</div>
                    ${renderTradeSide(teamB)}
                </div>
            </div>
        `;
    }

    renderWaiverWireSection(ev) {
        const isFaab = this.leagueUsesFaab();

        return `
            <div class="tx-grid-two-col">
                <!-- Card 1: Top Waivers -->
                <div class="card">
                    <h2>${isFaab ? 'Blockbuster FAAB Bids' : 'Top Waiver Wire Pickups of All Time'}</h2>
                    <p class="tx-card-subtitle">${isFaab ? 'Standardized by percentage of starting season FAAB budget spent.' : 'Most impactful players claimed through waiver priority ranked by rest-of-season output.'}</p>
                    <div class="tx-table-wrap">
                        <table class="tx-table">
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>Manager</th>
                                    ${isFaab ? `
                                        <th>Winning Bid</th>
                                        <th>% Bgt</th>
                                        <th>ROS Output</th>
                                        <th>Efficiency</th>
                                    ` : `
                                        <th>Week</th>
                                        <th>ROS Output</th>
                                        <th>ROS LTI</th>
                                    `}
                                </tr>
                            </thead>
                            <tbody>
                                ${(isFaab ? ev.blockbusterPickups : (ev.topWaiverPickups || ev.bestPickups)).slice(0, 10).map(pk => `
                                    <tr>
                                        <td>
                                            <div class="tx-player-cell">
                                                <a href="#" class="player-throughline-trigger" data-player="${pk.playerName}" data-season="${pk.season}"><strong>${pk.playerName}</strong></a>
                                                <span class="tx-pos-tag">${pk.position}</span>
                                            </div>
                                        </td>
                                        <td>${pk.managerName}</td>
                                        ${isFaab ? `
                                            <td><strong>$${pk.faabBid}</strong></td>
                                            <td><strong style="color: var(--accent-gold);">${pk.budgetPct}%</strong></td>
                                            <td class="tx-pos">${pk.rosPoints} pts <small class="tx-muted">(${pk.rosPpg} PPG)</small></td>
                                            <td>${pk.efficiency} <small class="tx-muted">pts / $</small></td>
                                        ` : `
                                            <td style="white-space: nowrap;">Week ${pk.week} (${this.formatSeasonYear(pk.season)})</td>
                                            <td class="tx-pos">${pk.rosPoints} pts <small class="tx-muted">(${pk.rosPpg} PPG)</small></td>
                                            <td><span class="ldi-pill ldi-pill-high">${pk.rosLti}</span></td>
                                        `}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- Card 2: Top Free Agents -->
                <div class="card">
                    <h2>${isFaab ? 'Free Agent Steals ($0 FAAB)' : 'Top Free Agent Pickups of All Time'}</h2>
                    <p class="tx-card-subtitle">${isFaab ? 'Undiscovered gems claimed for free ranked by rest-of-season production.' : 'Undiscovered gems claimed directly from free agency ranked by rest-of-season production.'}</p>
                    <div class="tx-table-wrap">
                        <table class="tx-table">
                            <thead>
                                <tr>
                                    <th>Player</th>
                                    <th>Manager</th>
                                    <th>Week</th>
                                    <th>ROS Output</th>
                                    <th>ROS LTI</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ev.freeAgentSteals.slice(0, 10).map(pk => `
                                    <tr>
                                        <td>
                                            <div class="tx-player-cell">
                                                <a href="#" class="player-throughline-trigger" data-player="${pk.playerName}" data-season="${pk.season}"><strong>${pk.playerName}</strong></a>
                                                <span class="tx-pos-tag">${pk.position}</span>
                                            </div>
                                        </td>
                                        <td>${pk.managerName}</td>
                                        <td style="white-space: nowrap;">Week ${pk.week} (${this.formatSeasonYear(pk.season)})</td>
                                        <td class="tx-pos">${pk.rosPoints} pts <small class="tx-muted">(${pk.rosPpg} PPG)</small></td>
                                        <td><span class="ldi-pill ldi-pill-high">${pk.rosLti}</span></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Full Worst Drops -->
            <div class="card" style="margin-top: 1.5rem;">
                <h2>Catastrophic Drops Archive (In-Season)</h2>
                <p class="tx-card-subtitle">Complete leaderboard of players cut to waivers (Week 1+) who punished their former managers.</p>
                <div class="tx-table-wrap">
                    <table class="tx-table">
                        <thead>
                            <tr>
                                <th>Rank</th>
                                <th>Player</th>
                                <th>Dropped By</th>
                                <th>Season</th>
                                <th>Week</th>
                                <th>Post-Drop Output</th>
                                <th>Post-Drop LTI</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ev.worstDrops.slice(0, 15).map((d, idx) => `
                                <tr>
                                    <td><strong>#${idx + 1}</strong></td>
                                    <td>
                                        <div class="tx-player-cell">
                                            <a href="#" class="player-throughline-trigger" data-player="${d.playerName}" data-season="${d.season}"><strong>${d.playerName}</strong></a>
                                            <span class="tx-pos-tag">${d.position}</span>
                                        </div>
                                    </td>
                                    <td><strong>${d.managerName}</strong></td>
                                    <td>${this.formatSeasonYear(d.season)}</td>
                                    <td>Week ${d.week}</td>
                                    <td class="tx-pos">${d.postDropPoints} pts <small class="tx-muted">(${d.postDropGames} GP)</small></td>
                                    <td><span class="ldi-pill ldi-pill-high">${d.postDropLti}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    renderFeedSection(ev) {
        const seasons = [...new Set((this.transactions || []).map(t => Number(t.season || t.year)).filter(Boolean))].sort((a, b) => b - a);

        return `
            <div class="card">
                <h2>Transaction Activity Feed</h2>
                <p class="tx-card-subtitle">Filter and search every recorded roster transaction in league history.</p>

                <div class="tx-filter-bar">
                    <div class="tx-filter-group">
                        <label for="filter-tx-year">Season</label>
                        <select id="filter-tx-year">
                            <option value="all">All Seasons</option>
                            ${seasons.map(y => `<option value="${y}" ${String(y) === String(this.filterYear) ? 'selected' : ''}>${this.formatSeasonYear(y)}</option>`).join('')}
                        </select>
                    </div>

                    <div class="tx-filter-group">
                        <label for="filter-tx-type">Type</label>
                        <select id="filter-tx-type">
                            <option value="all" ${this.filterType === 'all' ? 'selected' : ''}>All Transactions</option>
                            <option value="trade" ${this.filterType === 'trade' ? 'selected' : ''}>Trades Only</option>
                            <option value="waiver" ${this.filterType === 'waiver' ? 'selected' : ''}>${this.leagueUsesFaab() ? 'Waiver Claims (FAAB)' : 'Waiver Claims'}</option>
                            <option value="free_agent" ${this.filterType === 'free_agent' ? 'selected' : ''}>Free Agents</option>
                        </select>
                    </div>

                    <div class="tx-filter-group">
                        <label for="filter-tx-manager">Manager</label>
                        <select id="filter-tx-manager">
                            <option value="all">All Managers</option>
                            ${this.managers.map(m => `<option value="${m.id}" ${String(m.id).toLowerCase() === String(this.filterManager).toLowerCase() ? 'selected' : ''}>${m.name}</option>`).join('')}
                        </select>
                    </div>

                    <div class="tx-filter-group" style="flex: 1; min-width: 180px;">
                        <label for="filter-tx-search">Search Player</label>
                        <input type="text" id="filter-tx-search" placeholder="Player name..." value="${this.filterSearch || ''}">
                    </div>
                </div>

                <div id="tx-feed-list-container" style="margin-top: 1.5rem;">
                    ${this.renderFeedItems(ev)}
                </div>
            </div>
        `;
    }

    renderFeedItems(ev) {
        let items = (this.transactions || []).filter(tx => {
            if (!tx) return false;
            if (tx.action_type === 'DRAFT' || tx.type === 'DRAFT') return false;

            const yr = Number(tx.season || tx.year);
            if (this.filterYear !== 'all' && yr !== Number(this.filterYear)) return false;

            const isTrade = tx.type === 'trade' || tx.action_type === 'TRADE';
            const isWaiver = tx.type === 'waiver' || tx.action_type === 'WAIVER';
            const isFreeAgent = !isWaiver && (tx.type === 'free_agent' || tx.action_type === 'FREE_AGENT' || tx.action_type === 'FREEAGENT');

            if (this.filterType === 'trade' && !isTrade) return false;
            if (this.filterType === 'waiver' && !isWaiver) return false;
            if (this.filterType === 'free_agent' && !isFreeAgent) return false;

            const rawAdds = (tx.added_players || []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);
            const rawDrops = (tx.dropped_players || []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);
            const rawTraded = (tx.traded_players || []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);
            const rawPicks = (tx.draft_picks || []).filter(Boolean);

            if (rawAdds.length === 0 && rawDrops.length === 0 && rawTraded.length === 0 && rawPicks.length === 0) {
                return false;
            }

            if (this.filterManager !== 'all') {
                const targetMgr = String(this.filterManager).toLowerCase();
                const m1 = String(tx.manager_id || '').toLowerCase();
                const m2 = String(tx.trade_partner_manager_id || '').toLowerCase();
                if (m1 !== targetMgr && m2 !== targetMgr) return false;
            }

            if (this.filterSearch) {
                const s = this.filterSearch.toLowerCase();
                const adds = rawAdds.map(p => p.toLowerCase());
                const drops = rawDrops.map(p => p.toLowerCase());
                const traded = rawTraded.map(p => p.toLowerCase());
                const matches = adds.some(p => p.includes(s)) || drops.some(p => p.includes(s)) || traded.some(p => p.includes(s));
                if (!matches) return false;
            }

            return true;
        });

        if (items.length === 0) {
            return `<p style="color: var(--text-muted); text-align: center; padding: 2rem 0;">No transactions match the selected filters.</p>`;
        }

        const paginated = items.slice(0, 100);

        return `
            <div class="tx-feed-list">
                ${paginated.map(tx => {
                    const isTrade = tx.type === 'trade' || tx.action_type === 'TRADE';
                    if (isTrade) {
                        const trEval = this.evaluateTrade(tx);
                        const leftMgr = this.filterManager !== 'all' ? this.filterManager : null;
                        return this.renderTradeCard(trEval, leftMgr);
                    }
                    const adds = (tx.added_players || []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);
                    const drops = (tx.dropped_players || []).map(p => this.resolvePlayerName(p?.name || p)).filter(Boolean);
                    if (adds.length === 0 && drops.length === 0) {
                        return '';
                    }
                    const isPureDrop = adds.length === 0 && drops.length > 0;
                    if (isPureDrop) {
                        const dropEval = this.evaluateDrop(tx);
                        return this.renderDropCard(dropEval);
                    }
                    const pkEval = this.evaluatePickup(tx);
                    return this.renderPickupCard(pkEval);
                }).join('')}
            </div>
            ${items.length > 100 ? `<p style="text-align: center; color: var(--text-muted); margin-top: 1rem;">Showing first 100 of ${items.length} transactions.</p>` : ''}
        `;
    }

    renderPickupCard(pk) {
        const yr = Number(pk.season || pk.year);
        const adds = pk.addedPlayers || pk.players || [];
        const drops = pk.droppedPlayers || [];
        const faab = Number(pk.faabBid || 0);
        const budgetPct = pk.budgetPct || 0;

        let typeBadge = 'FREE AGENT';
        let badgeClass = 'free_agent';
        if (pk.isWaiverClaim || pk.type === 'waiver') {
            if (this.leagueUsesFaab() && faab > 0) {
                typeBadge = `WAIVER CLAIM ($${faab} &middot; ${budgetPct}% bgt)`;
            } else if (this.leagueUsesFaab() && faab === 0) {
                typeBadge = 'WAIVER CLAIM ($0 BID)';
            } else {
                typeBadge = 'WAIVER CLAIM';
            }
            badgeClass = 'waiver';
        }

        const renderPlayerRow = (p, isAdd) => {
            const pre = isAdd ? p.prePickup : p.preDrop;
            const post = isAdd ? p.postPickup : p.postDrop;
            const pts = post ? post.totalPoints : 0;
            const ppg = post ? post.ppg : 0;
            const gp = post ? post.gamesPlayed : 0;
            const pos = p.position || (post ? post.position : 'UTIL');
            const isKDef = ['K', 'DEF'].includes(pos);
            const missed = isKDef ? 0 : (p.missedWeeks || 0);
            const rosLti = post ? post.ltiScore : 50;

            return `
                <li>
                    <div class="tx-player-cell">
                        <a href="#" class="player-throughline-trigger" data-player="${p.playerName}" data-season="${yr}"><strong>${p.playerName}</strong></a>
                        <span class="tx-pos-tag">${pos}</span>
                    </div>
                    <span class="tx-player-sub">
                        ${pk.isPending ? `
                            ROS: <span class="ldi-pill-sm ldi-pill-pending">Season Pending</span>
                        ` : `
                            ${pre ? `Pre: <span class="ldi-pill-sm">${pre.ltiScore} LTI</span> &middot; ` : ''}
                            ROS: <span class="ldi-pill-sm ${rosLti >= 55 ? 'ldi-pill-high' : (rosLti < 45 ? 'ldi-pill-low' : '')}">${rosLti} LTI</span>
                            (${pts} actual pts &middot; ${ppg} PPG over ${gp} gp${missed > 0 ? ` &middot; missed ${missed} game${missed > 1 ? 's' : ''}` : ''})
                        `}
                    </span>
                </li>
            `;
        };

        return `
            <div class="tx-trade-card card ${pk.gradeBadge || 'balanced-deal'}">
                <div class="tx-trade-header">
                    <div class="tx-trade-meta">
                        <span class="tx-type-pill ${badgeClass}">${typeBadge}</span>
                        <span class="tx-trade-date">${this.formatSeasonYear(yr)} &middot; ${pk.week > 0 ? `Week ${pk.week}` : 'Preseason'} &middot; ${pk.timestamp || ''}</span>
                        <span class="tx-std-mgr"><strong>${pk.managerName}</strong> <small class="tx-muted">(${pk.teamName || ''})</small></span>
                    </div>
                    <div class="tx-trade-verdict-badge ${pk.gradeBadge || 'balanced-deal'}">
                        ${pk.verdict || 'Standard Move'}
                    </div>
                </div>

                <div class="tx-trade-body" style="grid-template-columns: ${drops.length > 0 ? '1fr 1fr' : '1fr'}; gap: 1.25rem;">
                    <div class="tx-trade-side">
                        <div class="tx-side-players">
                            <span class="tx-players-label">Added:</span>
                            <ul>
                                ${adds.map(p => renderPlayerRow(p, true)).join('')}
                            </ul>
                        </div>
                    </div>

                    ${drops.length > 0 ? `
                        <div class="tx-trade-side">
                            <div class="tx-side-players">
                                <span class="tx-players-label">Dropped:</span>
                                <ul>
                                    ${drops.map(p => renderPlayerRow(p, false)).join('')}
                                </ul>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="tx-side-footer" style="padding: 0.75rem 1.25rem; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                    ${pk.isPending ? `
                        <span>Season Pending Kickoff</span>
                        <span style="white-space: nowrap;">
                            Transaction LTI: <strong class="tx-muted">Pending</strong>
                        </span>
                    ` : `
                        <span>
                            Lineup Net: <strong class="${pk.netPoints >= 0 ? 'tx-pos' : 'tx-neg'}">${pk.netPoints >= 0 ? `+${pk.netPoints}` : pk.netPoints} net pts</strong>
                            ${pk.adjustmentNote ? `<small class="tx-muted" style="margin-left: 6px;">(${pk.adjustmentNote})</small>` : ''}
                        </span>
                        <span style="white-space: nowrap;">
                            Transaction LTI: <strong class="${pk.netLti >= 0 ? 'tx-pos' : 'tx-neg'}">${pk.transactionLti} LTI</strong>
                        </span>
                    `}
                </div>
            </div>
        `;
    }

    renderDropCard(drop) {
        const yr = Number(drop.season || drop.year);
        const players = drop.players || [];
        const alt = drop.bestAltCandidate;

        return `
            <div class="tx-trade-card card ${drop.gradeBadge || 'balanced-deal'}">
                <div class="tx-trade-header">
                    <div class="tx-trade-meta">
                        <span class="tx-type-pill drop" style="background: rgba(239, 68, 68, 0.15); color: var(--accent-red, #ef4444); border: 1px solid rgba(239, 68, 68, 0.3);">ROSTER DROP</span>
                        <span class="tx-trade-date">${this.formatSeasonYear(yr)} &middot; ${drop.week > 0 ? `Week ${drop.week}` : 'Preseason'} &middot; ${drop.timestamp || ''}</span>
                        <span class="tx-std-mgr"><strong>${drop.managerName}</strong> <small class="tx-muted">(${drop.teamName || ''})</small></span>
                    </div>
                    <div class="tx-trade-verdict-badge ${drop.gradeBadge || 'balanced-deal'}">
                        ${drop.verdict || 'Roster Pruning'}
                    </div>
                </div>

                <div class="tx-trade-body" style="grid-template-columns: 1fr;">
                    <div class="tx-trade-side">
                        <div class="tx-side-players">
                            <span class="tx-players-label">Dropped:</span>
                            <ul>
                                ${players.map(p => {
                                    const pre = p.preDrop;
                                    const post = p.postDrop;
                                    const pts = post ? post.totalPoints : 0;
                                    const ppg = post ? post.ppg : 0;
                                    const gp = post ? post.gamesPlayed : 0;
                                    const pos = p.position || (post ? post.position : 'UTIL');
                                    const isKDef = ['K', 'DEF'].includes(pos);
                                    const missed = isKDef ? 0 : (p.missedWeeks || 0);
                                    const rosLti = post ? post.ltiScore : 50;
                                    return `
                                        <li>
                                            <div class="tx-player-cell">
                                                <a href="#" class="player-throughline-trigger" data-player="${p.playerName}" data-season="${yr}">${p.playerName}</a>
                                                <span class="tx-pos-tag">${pos}</span>
                                            </div>
                                            <span class="tx-player-sub">
                                                ${drop.isPending ? `
                                                    ROS: <span class="ldi-pill-sm ldi-pill-pending">Season Pending</span>
                                                ` : `
                                                    ${pre ? `Pre: <span class="ldi-pill-sm">${pre.ltiScore} LTI</span> &middot; ` : ''}
                                                    ROS: <span class="ldi-pill-sm ${rosLti >= 55 ? 'ldi-pill-high' : (rosLti < 45 ? 'ldi-pill-low' : '')}">${rosLti} LTI</span>
                                                    (${pts} actual pts &middot; ${ppg} PPG over ${gp} gp${missed > 0 ? ` &middot; missed ${missed} game${missed > 1 ? 's' : ''}` : ''})
                                                `}
                                            </span>
                                        </li>
                                    `;
                                }).join('')}
                            </ul>
                        </div>

                        ${alt ? `
                            <div style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: var(--bg-card); border-radius: 6px; font-size: 0.8rem; color: var(--text-muted); border: 1px dashed var(--border-color);">
                                <strong>Compulsory Cut Roster Context:</strong> Best alternative candidate kept was <strong>${alt.name}</strong> [${alt.slot || 'BN'}] (${alt.totalPoints} ROS pts &middot; ${alt.ltiScore} LTI). 
                                ${drop.relativePointsLost === 0 
                                    ? 'Optimal decision, as dropped player was the lowest producer on the roster.' 
                                    : `Relative opportunity loss of ${drop.relativePointsLost} net pts (${drop.relativeLtiDelta} LTI delta) compared to dropping ${alt.name}.`}
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="tx-side-footer" style="padding: 0.75rem 1.25rem; border-top: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                    ${drop.isPending ? `
                        <span>Season Pending Kickoff</span>
                        <span style="white-space: nowrap;">
                            Transaction LTI: <strong class="tx-muted">Pending</strong>
                        </span>
                    ` : `
                        <span>
                            Lineup Net: <strong class="${drop.netPoints >= 0 ? 'tx-pos' : 'tx-neg'}">${drop.netPoints >= 0 ? `+${drop.netPoints}` : drop.netPoints} net pts</strong>
                            ${drop.adjustmentNote ? `<small class="tx-muted" style="margin-left: 6px;">(${drop.adjustmentNote})</small>` : ''}
                        </span>
                        <span style="white-space: nowrap;">
                            Transaction LTI: <strong class="${drop.netLti >= 0 ? 'tx-pos' : 'tx-neg'}">${drop.transactionLti} LTI</strong>
                        </span>
                    `}
                </div>
            </div>
        `;
    }
}
