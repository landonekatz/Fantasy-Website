// scripts/reconstruct_league_transactions.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const RTDB_BASE = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';

const cleanNorm = (n) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();

/**
 * 1. RECONSTRUCT LAMARKABLE (SLEEPER) TRANSACTIONS
 */
async function reconstructLamarkable() {
    console.log('\n--- 1. Reconstructing Lamarkable (Sleeper) Transactions ---');
    const sleeperPlayers = await fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json());
    
    const canonicalSeasons = {
        '2023': '916337198876880896',
        '2024': '1126285408805027840',
        '2025': '1255976928184111104',
        '2026': '1387183026630332416'
    };

    const allTransactions = [];

    // Fetch canonical members to map Sleeper IDs/usernames to actual manager names
    const mData = await fetch(`${RTDB_BASE}/leagues/lamarkablefantasy/members.json`).then(r => r.json()) || [];
    const membersList = Array.isArray(mData) ? mData : (mData.managers || []);
    const memberMap = new Map();
    membersList.forEach(m => {
        if (!m) return;
        const canonicalName = m.name || m.display_name || '';
        if (m.id) memberMap.set(String(m.id).toLowerCase(), canonicalName);
        if (m.username) memberMap.set(String(m.username).toLowerCase(), canonicalName);
        if (Array.isArray(m.platform_ids)) {
            m.platform_ids.forEach(pid => memberMap.set(String(pid).toLowerCase(), canonicalName));
        }
    });

    for (const [yrStr, lid] of Object.entries(canonicalSeasons)) {
        const yr = parseInt(yrStr, 10);
        console.log(`Processing Sleeper season ${yr} (${lid})...`);
        
        const [users, rosters] = await Promise.all([
            fetch(`https://api.sleeper.app/v1/league/${lid}/users`).then(r => r.json()),
            fetch(`https://api.sleeper.app/v1/league/${lid}/rosters`).then(r => r.json())
        ]);

        const userMap = new Map();
        (users || []).forEach(u => userMap.set(u.user_id, u));

        const rosterMap = new Map();
        (rosters || []).forEach(r => {
            const u = userMap.get(r.owner_id) || {};
            const ownerKey = String(r.owner_id || '').toLowerCase();
            const dName = memberMap.get(ownerKey) || u.display_name || u.username || `Manager ${r.roster_id}`;
            const tName = u.metadata?.team_name || `${dName}${dName.endsWith('s') ? "'" : "'s"} Team`;
            rosterMap.set(r.roster_id, {
                ownerId: r.owner_id || `sleeper_roster_${r.roster_id}`,
                managerName: dName,
                teamName: tName
            });
        });

        for (let w = 1; w <= 17; w++) {
            const r = await fetch(`https://api.sleeper.app/v1/league/${lid}/transactions/${w}`);
            if (!r.ok) continue;
            const weekTxs = await r.json();
            if (!Array.isArray(weekTxs)) continue;

            for (const tx of weekTxs) {
                if (tx.status !== 'complete') continue;
                const execDate = tx.created || tx.status_updated || Date.now();
                const formattedTimestamp = new Date(execDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

                if (tx.type === 'trade' && Array.isArray(tx.roster_ids) && tx.roster_ids.length >= 2) {
                    const r1 = tx.roster_ids[0];
                    const r2 = tx.roster_ids[1];
                    const m1 = rosterMap.get(r1) || { ownerId: `r_${r1}`, managerName: `Team ${r1}`, teamName: `Team ${r1}` };
                    const m2 = rosterMap.get(r2) || { ownerId: `r_${r2}`, managerName: `Team ${r2}`, teamName: `Team ${r2}` };

                    const r1Adds = [];
                    const r2Adds = [];

                    if (tx.adds) {
                        for (const [pid, toRoster] of Object.entries(tx.adds)) {
                            const p = sleeperPlayers[pid];
                            const pName = p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : `Player ${pid}`;
                            if (toRoster === r1) r1Adds.push(pName);
                            else if (toRoster === r2) r2Adds.push(pName);
                        }
                    }

                    const r1Picks = [];
                    const r2Picks = [];
                    if (Array.isArray(tx.draft_picks)) {
                        for (const pick of tx.draft_picks) {
                            const pDesc = `${pick.season} Round ${pick.round} Pick`;
                            if (pick.owner_id === r1) r1Picks.push(pDesc);
                            else if (pick.owner_id === r2) r2Picks.push(pDesc);
                        }
                    }

                    const team1Received = [...r1Adds, ...r1Picks];
                    const team2Received = [...r2Adds, ...r2Picks];
                    const allTraded = [...r1Adds, ...r2Adds];

                    const p1Str = team1Received.join(', ') || 'considerations';
                    const p2Str = team2Received.join(', ') || 'considerations';
                    const details = `${m1.managerName} received ${p1Str}; ${m2.managerName} received ${p2Str}`;

                    // Bilateral trade representation
                    allTransactions.push({
                        id: tx.transaction_id || `${yr}_trade_${allTransactions.length + 1}`,
                        year: yr,
                        season: yr,
                        week: w,
                        date: execDate,
                        timestamp: formattedTimestamp,
                        action_type: 'TRADE',
                        type: 'trade',
                        team_id: r1,
                        team_name: m1.teamName,
                        manager_id: m1.ownerId,
                        manager_name: m1.managerName,
                        trade_partner_team: m2.teamName,
                        trade_partner_manager_id: m2.ownerId,
                        trade_partner_manager_name: m2.managerName,
                        added_players: r1Adds, // Players received by Team 1
                        dropped_players: r2Adds, // Players sent by Team 1 (received by Team 2)
                        partner_added_players: r2Adds,
                        partner_dropped_players: r1Adds,
                        traded_players: allTraded,
                        draft_picks: [...r1Picks, ...r2Picks],
                        faab_bid: 0,
                        details: details,
                        items: []
                    });
                } else if (tx.type === 'waiver' || tx.type === 'free_agent') {
                    const rId = Array.isArray(tx.roster_ids) && tx.roster_ids.length > 0 ? tx.roster_ids[0] : 1;
                    const mInfo = rosterMap.get(rId) || { ownerId: `r_${rId}`, managerName: `Team ${rId}`, teamName: `Team ${rId}` };

                    const added = [];
                    const dropped = [];
                    if (tx.adds) {
                        for (const pid of Object.keys(tx.adds)) {
                            const p = sleeperPlayers[pid];
                            added.push(p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : `Player ${pid}`);
                        }
                    }
                    if (tx.drops) {
                        for (const pid of Object.keys(tx.drops)) {
                            const p = sleeperPlayers[pid];
                            dropped.push(p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : `Player ${pid}`);
                        }
                    }

                    const faabBid = tx.settings?.waiver_bid || 0;
                    const parts = [];
                    if (added.length > 0) parts.push(`Added: ${added.join(', ')}`);
                    if (dropped.length > 0) parts.push(`Dropped: ${dropped.join(', ')}`);
                    if (faabBid > 0) parts.push(`FAAB: $${faabBid}`);

                    allTransactions.push({
                        id: tx.transaction_id || `${yr}_tx_${allTransactions.length + 1}`,
                        year: yr,
                        season: yr,
                        week: w,
                        date: execDate,
                        timestamp: formattedTimestamp,
                        action_type: tx.type === 'waiver' ? 'WAIVER' : 'FREEAGENT',
                        type: tx.type === 'waiver' ? 'waiver' : 'free_agent',
                        team_id: rId,
                        team_name: mInfo.teamName,
                        manager_id: mInfo.ownerId,
                        manager_name: mInfo.managerName,
                        trade_partner_team: '',
                        trade_partner_manager_id: '',
                        trade_partner_manager_name: '',
                        added_players: added,
                        dropped_players: dropped,
                        traded_players: [],
                        faab_bid: faabBid,
                        details: parts.join(' · ') || tx.type,
                        items: []
                    });
                }
            }
        }
    }

    allTransactions.sort((a, b) => b.date - a.date);
    const tradeCount = allTransactions.filter(t => t.type === 'trade').length;
    console.log(`Lamarkable total transactions: ${allTransactions.length} (Trades: ${tradeCount})`);

    // Push to Firebase RTDB
    console.log('Pushing Lamarkable transactions to Firebase RTDB...');
    const putRes = await fetch(`${RTDB_BASE}/leagues/lamarkablefantasy/transactions.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(allTransactions)
    });
    console.log('Lamarkable RTDB PUT status:', putRes.status);
    return allTransactions;
}

/**
 * 2. RECONSTRUCT ESPN LEAGUE TRANSACTIONS (GAYWOOD & FBO)
 */
async function reconstructEspnTransactions(leagueId, localJsonPath) {
    console.log(`\n--- Reconstructing ESPN League: ${leagueId} ---`);
    
    // Fetch league data from RTDB or local
    let stats = [];
    let drafts = [];
    let members = [];

    if (localJsonPath && fs.existsSync(localJsonPath)) {
        const statsPath = path.join(path.dirname(localJsonPath), 'weekly_player_stats.json');
        const draftsPath = path.join(path.dirname(localJsonPath), 'draft_results.json');
        const membersPath = path.join(path.dirname(localJsonPath), 'managers.json');
        
        if (fs.existsSync(statsPath)) stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
        if (fs.existsSync(draftsPath)) drafts = JSON.parse(fs.readFileSync(draftsPath, 'utf8'));
        if (fs.existsSync(membersPath)) {
            const mData = JSON.parse(fs.readFileSync(membersPath, 'utf8'));
            members = Array.isArray(mData) ? mData : (mData.managers || []);
        }
    }

    if (stats.length === 0) {
        console.log(`Fetching ${leagueId} stats from RTDB...`);
        stats = await fetch(`${RTDB_BASE}/leagues/${leagueId}/weekly_player_stats.json`).then(r => r.json()) || [];
        drafts = await fetch(`${RTDB_BASE}/leagues/${leagueId}/draft_results.json`).then(r => r.json()) || [];
        const mData = await fetch(`${RTDB_BASE}/leagues/${leagueId}/members.json`).then(r => r.json()) || [];
        members = Array.isArray(mData) ? mData : (mData.managers || []);
    }

    console.log(`Loaded ${stats.length} stats rows, ${drafts.length} drafts, ${members.length} members`);

    const mgrNameMap = new Map();
    members.forEach(m => {
        const id = String(m.id || m.manager_id || '').toLowerCase();
        mgrNameMap.set(id, m.name || m.manager_name || m.display_name || id);
    });

    let newMembersAdded = false;
    stats.forEach(s => {
        const rawMid = s.manager_id;
        const mid = String(rawMid || '').toLowerCase();
        if (mid && !mgrNameMap.has(mid)) {
            const mName = s.manager_name || s.team_name || mid;
            mgrNameMap.set(mid, mName);
            members.push({
                id: rawMid,
                name: mName,
                isActive: false,
                status: 'Retired'
            });
            newMembersAdded = true;
        }
    });

    if (newMembersAdded) {
        console.log(`Updated ${leagueId} members with historical managers (${members.length} total members)`);
        await fetch(`${RTDB_BASE}/leagues/${leagueId}/members.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(members)
        });
    }

    // Group stats by year
    const seasonStatsMap = new Map();
    stats.forEach(s => {
        const yr = Number(s.season || s.year);
        if (!yr) return;
        if (!seasonStatsMap.has(yr)) seasonStatsMap.set(yr, []);
        seasonStatsMap.get(yr).push(s);
    });

    // Group drafts by year
    const seasonDraftMap = new Map();
    drafts.forEach(d => {
        const yr = Number(d.season || d.year);
        if (!yr) return;
        if (!seasonDraftMap.has(yr)) seasonDraftMap.set(yr, []);
        seasonDraftMap.get(yr).push(d);
    });

    const seasons = Array.from(seasonStatsMap.keys()).sort((a, b) => a - b);
    const transactions = [];

    for (const yr of seasons) {
        const yrStats = seasonStatsMap.get(yr) || [];
        const yrDrafts = seasonDraftMap.get(yr) || [];

        // Map manager -> drafted players
        const draftRosters = new Map();
        yrDrafts.forEach(d => {
            const mid = String(d.manager_id || '').toLowerCase();
            if (!mid) return;
            if (!draftRosters.has(mid)) draftRosters.set(mid, new Set());
            draftRosters.get(mid).add(cleanNorm(d.player_name));
        });

        // Map week -> manager -> player norm -> raw name
        // Also map manager_id -> team_id
        const weeklyRosters = new Map();
        const mgrTeamMap = new Map();
        let maxWeek = 1;
        yrStats.forEach(s => {
            const w = Number(s.week || 1);
            if (w > maxWeek) maxWeek = w;
            const mid = String(s.manager_id || '').toLowerCase();
            const pName = s.player_name || s.playerName || '';
            const np = cleanNorm(pName);
            if (!mid || !np) return;

            if (!mgrTeamMap.has(mid) && s.team_id !== undefined) {
                mgrTeamMap.set(mid, s.team_id);
            }

            if (!weeklyRosters.has(w)) weeklyRosters.set(w, new Map());
            const wMap = weeklyRosters.get(w);
            if (!wMap.has(mid)) wMap.set(mid, new Map());
            wMap.get(mid).set(np, pName);
        });

        // Check for official ESPN mTeam.json trade quotas (specifically for Gaywood if available)
        let teamTradeQuota = null;
        if (leagueId === 'gaywoodfantasyfootball') {
            const mTeamPath = path.join(rootDir, 'gaywoodfantasy/scraper/raw_data', `${yr}_mTeam.json`);
            if (fs.existsSync(mTeamPath)) {
                try {
                    const mTeamData = JSON.parse(fs.readFileSync(mTeamPath, 'utf8'));
                    const root = Array.isArray(mTeamData) ? mTeamData[0] : mTeamData;
                    if (root && root.teams) {
                        teamTradeQuota = new Map();
                        root.teams.forEach(t => {
                            teamTradeQuota.set(t.id, t.transactionCounter?.trades || 0);
                        });
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
        const tradesUsed = new Map();

        // Week 1 preseason adds
        const w1Map = weeklyRosters.get(1) || new Map();
        w1Map.forEach((pMap, mid) => {
            const draftedSet = draftRosters.get(mid) || new Set();
            pMap.forEach((rawName, np) => {
                if (!draftedSet.has(np)) {
                    const mName = mgrNameMap.get(mid) || mid;
                    transactions.push({
                        id: `espn_${yr}_w1_${mid}_${np.substring(0, 5)}`,
                        year: yr,
                        season: yr,
                        week: 1,
                        date: new Date(yr, 8, 4, 12, 0).getTime(),
                        timestamp: `Sep 4, ${yr}`,
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

        let priorRosters = w1Map;

        // Week-over-week analysis
        for (let w = 2; w <= maxWeek; w++) {
            const currMap = weeklyRosters.get(w);
            if (!currMap) continue;

            const playersLeaving = new Map(); // norm -> { rawName, fromMid }
            priorRosters.forEach((pMap, mid) => {
                const currPMap = currMap.get(mid) || new Map();
                pMap.forEach((rawName, np) => {
                    if (!currPMap.has(np)) {
                        playersLeaving.set(np, { rawName, fromMid: mid });
                    }
                });
            });

            // Detect all players arriving
            const playersArriving = new Map(); // norm -> { rawName, toMid }
            currMap.forEach((currPMap, toMid) => {
                const priorPMap = priorRosters.get(toMid) || new Map();
                currPMap.forEach((rawName, np) => {
                    if (!priorPMap.has(np)) {
                        playersArriving.set(np, { rawName, toMid });
                    }
                });
            });

            // Group direct transfers: fromMid -> toMid -> [players]
            const managerTransfers = new Map(); // `mid1_mid2` -> { m1, m2, m1Gets: [], m2Gets: [] }

            playersArriving.forEach((arrInfo, np) => {
                if (playersLeaving.has(np)) {
                    const leavInfo = playersLeaving.get(np);
                    if (leavInfo.fromMid !== arrInfo.toMid) {
                        const m1 = leavInfo.fromMid;
                        const m2 = arrInfo.toMid;
                        const pairKey = [m1, m2].sort().join('___');

                        if (!managerTransfers.has(pairKey)) {
                            const [firstM, secondM] = pairKey.split('___');
                            managerTransfers.set(pairKey, {
                                m1: firstM,
                                m2: secondM,
                                m1Gets: [],
                                m2Gets: []
                            });
                        }

                        const pair = managerTransfers.get(pairKey);
                        if (arrInfo.toMid === pair.m1) {
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

            // Create paired bilateral trade transactions (STRICTLY BILATERAL ONLY)
            // A trade REQUIRES that BOTH teams receive at least one player!
            // Unilateral moves (Team 1 drops player C, Team 2 claims player C) are waiver claims, NOT trades!
            managerTransfers.forEach((pair, pairKey) => {
                if (pair.m1Gets.length === 0 || pair.m2Gets.length === 0) {
                    return; // Unilateral transfer: not a trade, will be routed to waivers/drops below!
                }

                // If official ESPN trade quotas exist, enforce them to eliminate false positive waiver swaps
                if (teamTradeQuota) {
                    const tid1 = mgrTeamMap.get(pair.m1);
                    const tid2 = mgrTeamMap.get(pair.m2);
                    const q1 = teamTradeQuota.get(tid1);
                    const q2 = teamTradeQuota.get(tid2);
                    if (!q1 || !q2) return; // Non-trading team, route to waivers
                    const u1 = tradesUsed.get(tid1) || 0;
                    const u2 = tradesUsed.get(tid2) || 0;
                    if (u1 >= q1 || u2 >= q2) return; // Quota reached, route to waivers
                    tradesUsed.set(tid1, u1 + 1);
                    tradesUsed.set(tid2, u2 + 1);
                }

                // Register all players involved in this genuine bilateral deal
                pair.m1Gets.forEach(p => tradedPlayerNorms.add(cleanNorm(p)));
                pair.m2Gets.forEach(p => tradedPlayerNorms.add(cleanNorm(p)));

                const name1 = mgrNameMap.get(pair.m1) || pair.m1;
                const name2 = mgrNameMap.get(pair.m2) || pair.m2;
                const allTraded = [...pair.m1Gets, ...pair.m2Gets];

                const p1Str = pair.m1Gets.join(', ');
                const p2Str = pair.m2Gets.join(', ');
                const details = `${name1} received ${p1Str}; ${name2} received ${p2Str}`;

                transactions.push({
                    id: `espn_${yr}_w${w}_trade_${pair.m1}_${pair.m2}`,
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
                    added_players: pair.m1Gets, // Players received by Manager 1
                    dropped_players: pair.m2Gets, // Players sent by Manager 1 (received by Manager 2)
                    partner_added_players: pair.m2Gets,
                    partner_dropped_players: pair.m1Gets,
                    traded_players: allTraded,
                    faab_bid: 0,
                    details: details,
                    items: []
                });
            });

            // Waivers (players arriving that were not in a trade)
            playersArriving.forEach((arrInfo, np) => {
                if (!tradedPlayerNorms.has(np)) {
                    const mName = mgrNameMap.get(arrInfo.toMid) || arrInfo.toMid;
                    transactions.push({
                        id: `espn_${yr}_w${w}_waiver_${arrInfo.toMid}_${np.substring(0, 5)}`,
                        year: yr,
                        season: yr,
                        week: w,
                        date: txDate,
                        timestamp: txTimeStr,
                        action_type: 'WAIVER',
                        type: 'waiver',
                        team_id: 1,
                        team_name: `${mName}'s Team`,
                        manager_id: arrInfo.toMid,
                        manager_name: mName,
                        trade_partner_team: '',
                        trade_partner_manager_id: '',
                        trade_partner_manager_name: '',
                        added_players: [arrInfo.rawName],
                        dropped_players: [],
                        traded_players: [],
                        faab_bid: 0,
                        details: `Added: ${arrInfo.rawName}`,
                        items: []
                    });
                }
            });

            // Drops (players leaving that were not in a trade)
            playersLeaving.forEach((leavInfo, np) => {
                if (!tradedPlayerNorms.has(np)) {
                    const mName = mgrNameMap.get(leavInfo.fromMid) || leavInfo.fromMid;
                    transactions.push({
                        id: `espn_${yr}_w${w}_drop_${leavInfo.fromMid}_${np.substring(0, 5)}`,
                        year: yr,
                        season: yr,
                        week: w,
                        date: txDate,
                        timestamp: txTimeStr,
                        action_type: 'DROP',
                        type: 'free_agent',
                        team_id: 1,
                        team_name: `${mName}'s Team`,
                        manager_id: leavInfo.fromMid,
                        manager_name: mName,
                        trade_partner_team: '',
                        trade_partner_manager_id: '',
                        trade_partner_manager_name: '',
                        added_players: [],
                        dropped_players: [leavInfo.rawName],
                        traded_players: [],
                        faab_bid: 0,
                        details: `Dropped: ${leavInfo.rawName}`,
                        items: []
                    });
                }
            });

            priorRosters = currMap;
        }
    }

    transactions.sort((a, b) => b.date - a.date);
    const trades = transactions.filter(t => t.type === 'trade');
    console.log(`Reconstructed ${transactions.length} total transactions for ${leagueId} (Trades: ${trades.length})`);
    if (trades.length > 0) {
        console.log('Sample trade:', trades[0]);
    }

    // Save locally if path exists
    if (localJsonPath) {
        fs.writeFileSync(localJsonPath, JSON.stringify(transactions, null, 2), 'utf8');
        console.log(`Saved to ${localJsonPath}`);
    }

    // Push to Firebase RTDB
    console.log(`Pushing ${transactions.length} transactions to Firebase RTDB for ${leagueId}...`);
    const putRes = await fetch(`${RTDB_BASE}/leagues/${leagueId}/transactions.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(transactions)
    });
    console.log(`RTDB PUT status for ${leagueId}:`, putRes.status);
    return transactions;
}

async function main() {
    await reconstructLamarkable();
    const gaywoodLocalPath = path.join(rootDir, 'gaywoodfantasy', 'data', 'transactions.json');
    await reconstructEspnTransactions('gaywoodfantasyfootball', gaywoodLocalPath);
    await reconstructEspnTransactions('fbo', null);
    console.log('\nAll transactions successfully reconstructed and pushed to Firebase RTDB!');
}

main().catch(console.error);
