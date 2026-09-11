import { TransactionsEngine } from '../src/transactions_engine.js';
import espnAthletesData from '../src/espn_athletes_data.json' with { type: 'json' };

const RTDB_BASE = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';

const fetchJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
};

async function verifyLeague(slug) {
  console.log(`\n========================================`);
  console.log(`VERIFYING LEAGUE: ${slug}`);
  console.log(`========================================`);

  const [txData, draftData, membersData, settingsData] = await Promise.all([
    fetchJson(`${RTDB_BASE}/leagues/${slug}/transactions.json`).catch(() => []),
    fetchJson(`${RTDB_BASE}/leagues/${slug}/draft_results.json`).catch(() => []),
    fetchJson(`${RTDB_BASE}/leagues/${slug}/members.json`).catch(() => []),
    fetchJson(`${RTDB_BASE}/leagues/${slug}/league_settings.json`).catch(() => ({}))
  ]);

  const rawTxList = Array.isArray(txData) ? txData : Object.values(txData || {});
  console.log(`Raw transactions loaded from RTDB: ${rawTxList.length}`);

  // Test TransactionsEngine initialization
  const engine = new TransactionsEngine({
    transactions: rawTxList,
    draftResults: draftData,
    managers: membersData,
    leagueSettings: settingsData,
    playerStats: [],
    matchups: []
  });

  engine.init();

  const processedTxs = engine.transactions;
  console.log(`Engine processed transactions: ${processedTxs.length}`);

  // 1. Check for empty transactions
  const emptyTxs = processedTxs.filter(t => {
    const adds = (t.added_players || []).filter(Boolean);
    const drops = (t.dropped_players || []).filter(Boolean);
    const traded = (t.traded_players || []).filter(Boolean);
    const picks = (t.draft_picks || []).filter(Boolean);
    return adds.length === 0 && drops.length === 0 && traded.length === 0 && picks.length === 0;
  });

  if (emptyTxs.length > 0) {
    console.error(`FAILED: Found ${emptyTxs.length} empty transactions in engine!`, emptyTxs.slice(0, 2));
    process.exit(1);
  } else {
    console.log(`PASSED: 0 empty transactions in engine.`);
  }

  // 2. Check for DRAFT transactions in feed
  const draftTxs = processedTxs.filter(t => t.action_type === 'DRAFT' || t.type === 'DRAFT');
  if (draftTxs.length > 0) {
    console.error(`FAILED: Found ${draftTxs.length} DRAFT transactions in transactions feed!`);
    process.exit(1);
  } else {
    console.log(`PASSED: 0 DRAFT transactions in transactions feed.`);
  }

  // 3. Check for "Player ID" strings
  const stringified = JSON.stringify(processedTxs);
  const pIdMatches = stringified.match(/Player ID\s*\d+/g);
  if (pIdMatches) {
    console.error(`FAILED: Found unresolved Player ID matches:`, [...new Set(pIdMatches)]);
    process.exit(1);
  } else {
    console.log(`PASSED: 0 Player ID strings found across all transactions.`);
  }

  // 4. Test feed rendering output
  engine.filterYear = 'all';
  engine.filterType = 'all';
  engine.filterManager = 'all';
  const ev = engine.evaluateAllTransactions();
  const feedHtml = engine.renderFeedItems(ev);

  if (feedHtml.includes('Player ID')) {
    console.error(`FAILED: Feed HTML contains "Player ID"!`);
    process.exit(1);
  } else {
    console.log(`PASSED: Feed HTML contains 0 "Player ID" references.`);
  }

  // Check for dummy empty cards in feed HTML
  if (feedHtml.includes('<strong></strong> <small class="tx-muted">()</small>')) {
    console.error(`FAILED: Feed HTML contains empty manager card!`);
    process.exit(1);
  } else {
    console.log(`PASSED: Feed HTML contains 0 empty manager cards.`);
  }

  // Check Gaywood 2026 specific moves
  if (slug === 'gaywoodfantasyfootball') {
    const tx2026 = processedTxs.filter(t => t.season == 2026 || t.year == 2026);
    console.log(`2026 Gaywood transactions count: ${tx2026.length}`);
    tx2026.forEach((t, i) => {
      console.log(`  [2026 Move ${i + 1}] ${t.manager_name} (${t.type}): Adds [${(t.added_players||[]).join(', ')}] Drops [${(t.dropped_players||[]).join(', ')}]`);
    });

    const expectedDrops = ['Eli Stowers', 'Nicholas Singleton', 'Emmett Johnson', 'Tyjae Spears', 'Jordan Addison'];
    const all2026Drops = tx2026.flatMap(t => t.dropped_players || []);
    expectedDrops.forEach(exp => {
      if (!all2026Drops.includes(exp)) {
        console.error(`FAILED: Expected dropped player "${exp}" not found in 2026 transactions!`);
        process.exit(1);
      }
    });
    console.log(`PASSED: All 5 dropped players in 2026 Gaywood resolved perfectly to real names: ${expectedDrops.join(', ')}`);
  }
}

async function run() {
  await verifyLeague('gaywoodfantasyfootball');
  await verifyLeague('abtherapyleague');
  await verifyLeague('fbo');
  await verifyLeague('dmsfantasy');
  await verifyLeague('lamarkablefantasy');
  console.log(`\n========================================`);
  console.log(`ALL TESTS PASSED WITH 100% SUCCESS!`);
  console.log(`========================================\n`);
}

run().catch(err => {
  console.error('Verification failure:', err);
  process.exit(1);
});
