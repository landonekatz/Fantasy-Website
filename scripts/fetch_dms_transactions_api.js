// scripts/fetch_dms_transactions_api.js
// Fetches 100% of historical transactions for all 10 Dumbarton seasons directly from the official Yahoo Fantasy Sports API.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { refreshAccessToken, fetchYahooApi } from '../api/yahoo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const managersData = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'managers.json'), 'utf8'));

// Build team lookup: `${year}_${cleanTeamName}` -> manager info
const teamLookup = new Map();
const managerNameMap = new Map();

(managersData.managers || []).forEach(m => {
  managerNameMap.set(m.id, m.name);
});

(managersData.team_mappings || []).forEach(tm => {
  const normName = tm.team_name.toLowerCase().replace(/['’]/g, "'").trim();
  const key = `${tm.year}_${normName}`;
  const mName = managerNameMap.get(tm.manager_id) || tm.manager_id;
  teamLookup.set(key, { id: tm.manager_id, name: mName, teamName: tm.team_name });
  // Also map by team_id
  teamLookup.set(`${tm.year}_t_${tm.team_id}`, { id: tm.manager_id, name: mName, teamName: tm.team_name });
});

function findManager(year, rawTeamName, teamId) {
  if (teamId && teamLookup.has(`${year}_t_${teamId}`)) {
    return teamLookup.get(`${year}_t_${teamId}`);
  }
  if (!rawTeamName) return { id: '', name: '', teamName: '' };
  const norm = rawTeamName.toLowerCase().replace(/['’]/g, "'").trim();
  const key = `${year}_${norm}`;
  if (teamLookup.has(key)) return teamLookup.get(key);

  for (const [k, v] of teamLookup.entries()) {
    if (k.startsWith(`${year}_`)) {
      const teamPart = k.replace(`${year}_`, '');
      if (teamPart.includes(norm) || norm.includes(teamPart)) {
        return v;
      }
    }
  }

  return { id: '', name: rawTeamName, teamName: rawTeamName };
}

const DUMBARTON_SEASONS = [
  { nflYear: 2026, displayYear: 2027, key: '470.l.52841' },
  { nflYear: 2025, displayYear: 2026, key: '461.l.42542' },
  { nflYear: 2024, displayYear: 2025, key: '449.l.80052' },
  { nflYear: 2023, displayYear: 2024, key: '423.l.30266' },
  { nflYear: 2022, displayYear: 2023, key: '414.l.873470' },
  { nflYear: 2021, displayYear: 2022, key: '406.l.818216' },
  { nflYear: 2020, displayYear: 2021, key: '399.l.941578' },
  { nflYear: 2019, displayYear: 2020, key: '390.l.978070' },
  { nflYear: 2018, displayYear: 2019, key: '380.l.1168960' },
  { nflYear: 2017, displayYear: 2018, key: '371.l.862430' }
];

async function run() {
  console.log('Authenticating with Yahoo API...');
  const tokenData = await refreshAccessToken();
  const token = tokenData.access_token;
  console.log('Yahoo API authenticated successfully.');

  const allCompiledTransactions = [];

  for (const s of DUMBARTON_SEASONS) {
    const yr = s.displayYear;
    console.log(`\nFetching official Yahoo API transactions for season ${yr} (League: ${s.key})...`);
    const res = await fetchYahooApi(`league/${s.key}/transactions`, token);
    const transObj = res?.fantasy_content?.league?.[1]?.transactions;
    const count = transObj?.count || 0;
    console.log(`  Received ${count} raw transactions from Yahoo API.`);

    for (let i = 0; i < count; i++) {
      const tr = transObj[i]?.transaction;
      if (!tr) continue;

      const meta = tr[0];
      const playersBlock = tr[1]?.players;
      const status = meta.status;
      if (status && status !== 'successful' && status !== 'EXECUTED') continue;

      const txType = meta.type; // 'trade', 'add/drop', 'add', 'drop', 'commish'
      const tsEpoch = parseInt(meta.timestamp, 10) * 1000;
      const dateObj = new Date(tsEpoch);
      const formattedTimestamp = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      const faabBid = parseInt(meta.faab_bid || 0, 10);

      // Extract all player objects in this transaction
      const parsedPlayers = [];
      if (playersBlock) {
        const pCount = playersBlock.count || 0;
        for (let p = 0; p < pCount; p++) {
          const pData = playersBlock[p]?.player;
          if (!pData) continue;
          const pMeta = pData[0];
          const pAction = pData[1]?.transaction_data;
          const actionObj = Array.isArray(pAction) ? pAction[0] : pAction;
          const pName = pMeta?.find(x => x && x.name)?.name?.full || '';
          const pPos = pMeta?.find(x => x && x.display_position)?.display_position || '';

          parsedPlayers.push({
            name: pName,
            position: pPos,
            action: actionObj?.type || '',
            sourceType: actionObj?.source_type || '',
            sourceTeamKey: actionObj?.source_team_key || '',
            sourceTeamName: actionObj?.source_team_name || '',
            destType: actionObj?.destination_type || '',
            destTeamKey: actionObj?.destination_team_key || '',
            destTeamName: actionObj?.destination_team_name || ''
          });
        }
      }

      if (txType === 'trade') {
        // Multi-team trade from official Yahoo API
        const traderKey = meta.trader_team_key || '';
        const traderName = meta.trader_team_name || '';
        const tradeeKey = meta.tradee_team_key || '';
        const tradeeName = meta.tradee_team_name || '';

        const traderIdMatch = traderKey.match(/\.t\.(\d+)$/);
        const tradeeIdMatch = tradeeKey.match(/\.t\.(\d+)$/);
        const traderTeamId = traderIdMatch ? parseInt(traderIdMatch[1], 10) : null;
        const tradeeTeamId = tradeeIdMatch ? parseInt(tradeeIdMatch[1], 10) : null;

        const mgr1 = findManager(yr, traderName, traderTeamId);
        const mgr2 = findManager(yr, tradeeName, tradeeTeamId);

        // Players received by trader vs tradee
        const traderReceived = parsedPlayers
          .filter(p => p.destTeamKey === traderKey || (traderName && p.destTeamName === traderName))
          .map(p => p.name);
        const tradeeReceived = parsedPlayers
          .filter(p => p.destTeamKey === tradeeKey || (tradeeName && p.destTeamName === tradeeName))
          .map(p => p.name);

        const allTraded = [...new Set([...traderReceived, ...tradeeReceived])];

        allCompiledTransactions.push({
          id: meta.transaction_key || `${yr}_tr_${meta.transaction_id || i}`,
          season: yr,
          year: yr,
          type: 'trade',
          action_type: 'TRADE',
          date: tsEpoch,
          timestamp: formattedTimestamp,
          team_id: traderTeamId,
          team_name: mgr1.teamName || traderName,
          manager_id: mgr1.id,
          manager_name: mgr1.name,
          trade_partner_team: mgr2.teamName || tradeeName,
          trade_partner_manager_id: mgr2.id,
          trade_partner_manager_name: mgr2.name,
          added_players: traderReceived,
          dropped_players: tradeeReceived,
          traded_players: allTraded,
          partner_added_players: tradeeReceived,
          partner_dropped_players: traderReceived,
          faab_bid: faabBid,
          details: `${mgr1.name} received ${traderReceived.join(', ') || 'picks'}; ${mgr2.name} received ${tradeeReceived.join(', ') || 'picks'}`
        });
      } else {
        // Standard Add / Drop / Waiver / Free Agent transaction
        const addedPlayers = parsedPlayers.filter(p => p.action === 'add').map(p => p.name);
        const droppedPlayers = parsedPlayers.filter(p => p.action === 'drop').map(p => p.name);

        // Determine primary team
        const primaryDest = parsedPlayers.find(p => p.destType === 'team');
        const primarySource = parsedPlayers.find(p => p.sourceType === 'team');
        const teamKey = primaryDest?.destTeamKey || primarySource?.sourceTeamKey || '';
        const rawTeamName = primaryDest?.destTeamName || primarySource?.sourceTeamName || '';
        const teamIdMatch = teamKey.match(/\.t\.(\d+)$/);
        const teamId = teamIdMatch ? parseInt(teamIdMatch[1], 10) : null;

        const mgr = findManager(yr, rawTeamName, teamId);

        const isWaiver = faabBid > 0 || parsedPlayers.some(p => p.sourceType === 'waivers');
        const actionType = isWaiver ? 'waiver' : 'free_agent';

        const parts = [];
        if (addedPlayers.length > 0) parts.push(`Added: ${addedPlayers.join(', ')}`);
        if (droppedPlayers.length > 0) parts.push(`Dropped: ${droppedPlayers.join(', ')}`);
        if (faabBid > 0) parts.push(`FAAB: $${faabBid}`);

        allCompiledTransactions.push({
          id: meta.transaction_key || `${yr}_tx_${meta.transaction_id || i}`,
          season: yr,
          year: yr,
          type: actionType,
          action_type: actionType.toUpperCase(),
          date: tsEpoch,
          timestamp: formattedTimestamp,
          team_id: teamId,
          team_name: mgr.teamName || rawTeamName,
          manager_id: mgr.id,
          manager_name: mgr.name,
          added_players: addedPlayers,
          dropped_players: droppedPlayers,
          traded_players: [],
          faab_bid: faabBid,
          details: parts.join(' · ') || txType
        });
      }
    }
  }

  // Sort descending by season, then timestamp
  allCompiledTransactions.sort((a, b) => (b.date || 0) - (a.date || 0));

  console.log(`\n======================================================`);
  console.log(`Successfully fetched and compiled ${allCompiledTransactions.length} 100% official Yahoo API transactions!`);
  const tradesCount = allCompiledTransactions.filter(t => t.type === 'trade').length;
  console.log(`Total Official Trades from Yahoo API: ${tradesCount}`);
  console.log(`Total Official Waivers / Adds / Drops from Yahoo API: ${allCompiledTransactions.length - tradesCount}`);
  console.log(`======================================================`);

  // Write to dmsfantasy/data/transactions.json
  const outPath = path.join(rootDir, 'dmsfantasy', 'data', 'transactions.json');
  fs.writeFileSync(outPath, JSON.stringify(allCompiledTransactions, null, 2), 'utf8');
  console.log(`Saved API transactions to: ${outPath}`);

  // Push directly to Firebase RTDB for dmsfantasy
  console.log('Pushed official Yahoo API transactions to Firebase RTDB at /leagues/dmsfantasy/transactions...');
  const fbRes = await fetch('https://fantasy-vault-4f8da-default-rtdb.firebaseio.com/leagues/dmsfantasy/transactions.json', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(allCompiledTransactions)
  });
  console.log(`Firebase RTDB update status: ${fbRes.status} (${fbRes.statusText})`);
}

run().catch(e => {
  console.error('Fatal API sync error:', e);
  process.exit(1);
});
