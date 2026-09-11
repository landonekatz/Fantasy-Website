import fs from 'fs';
import { TransactionsEngine } from '../src/transactions_engine.js';

const domElements = new Map();
global.document = {
    getElementById: (id) => domElements.get(id) || null,
    querySelectorAll: () => [],
    createElement: (tag) => {
        const el = {
            id: '',
            className: '',
            innerHTML: '',
            showModal: () => {},
            close: () => {},
            addEventListener: () => {},
            getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 })
        };
        return el;
    },
    body: {
        appendChild: (el) => {
            if (el.id) domElements.set(el.id, el);
        }
    }
};

const dmsTx = JSON.parse(fs.readFileSync('./dmsfantasy/data/transactions.json', 'utf8'));
const dmsMgr = JSON.parse(fs.readFileSync('./dmsfantasy/data/managers.json', 'utf8'));
const dmsStats = JSON.parse(fs.readFileSync('./dmsfantasy/data/weekly_player_stats.json', 'utf8'));
const dmsDraft = JSON.parse(fs.readFileSync('./dmsfantasy/data/draft_results.json', 'utf8'));

const engine = new TransactionsEngine({
    leagueId: 'dms',
    leaguePlatform: 'yahoo',
    transactions: dmsTx,
    managers: dmsMgr,
    playerStats: dmsStats,
    draftResults: dmsDraft,
    currentYear: 2024
});

console.log('--- 1. ACTIVE SUB-TAB & NAVIGATION ORDER ---');
console.log('Default activeSubTab:', engine.activeSubTab);
if (engine.activeSubTab !== 'trades') {
    throw new Error('FAIL: engine.activeSubTab should default to "trades"');
}

// Check rendered nav HTML
const mockContainer = { innerHTML: '' };
domElements.set('transactions-app', mockContainer);
engine.containerId = 'transactions-app';
engine.render();

const navHtml = mockContainer.innerHTML;
const tradesIndex = navHtml.indexOf('id="tab-tx-trades"');
const overviewIndex = navHtml.indexOf('id="tab-tx-overview"');
const h2hIndex = navHtml.indexOf('id="tab-tx-h2h"');
const waiversIndex = navHtml.indexOf('id="tab-tx-waivers"');
const feedIndex = navHtml.indexOf('id="tab-tx-feed"');

console.log('Nav button positions:', { tradesIndex, overviewIndex, h2hIndex, waiversIndex, feedIndex });
if (!(tradesIndex < overviewIndex && overviewIndex < h2hIndex && h2hIndex < waiversIndex && waiversIndex < feedIndex)) {
    throw new Error('FAIL: Navigation buttons are not in the correct order (trades, overview, h2h, waivers, feed)');
}

if (!navHtml.includes('>Franchise to Franchise Trade History<')) {
    throw new Error('FAIL: H2H nav button text should be "Franchise to Franchise Trade History"');
}

console.log('\n--- 2. H2H SECTION TITLE ---');
const h2hHtml = engine.renderH2HSection(engine.evaluateAllTransactions());
if (!h2hHtml.includes('<h2>Franchise to Franchise Trade History</h2>')) {
    throw new Error('FAIL: H2H section title should be "Franchise to Franchise Trade History"');
}

console.log('\n--- 3. UNFAIR TRADES TABLE: 5 COLUMNS & NET ADVANTAGE ---');
const ev = engine.evaluateAllTransactions();
const overviewHtml = engine.renderOverviewSection(ev);

if (!overviewHtml.includes('<th>Net Advantage</th>')) {
    throw new Error('FAIL: Unfair trades table must have <th>Net Advantage</th> column');
}
if (overviewHtml.includes('<th>LTI Delta</th>') || overviewHtml.includes('<th>Lineup Surplus</th>')) {
    throw new Error('FAIL: Separate LTI Delta and Lineup Surplus headers should be consolidated into Net Advantage');
}

// Verify sorting of unfairTrades is strictly by LTI difference
for (let i = 0; i < ev.unfairTrades.length - 1; i++) {
    const curr = ev.unfairTrades[i];
    const next = ev.unfairTrades[i + 1];
    if (curr.ltiDifference < next.ltiDifference) {
        throw new Error(`FAIL: unfairTrades not sorted strictly by descending LTI delta! At index ${i}: ${curr.ltiDifference} < ${next.ltiDifference}`);
    }
}
console.log('Top 5 Unfair Trades strictly sorted by LTI delta:');
ev.unfairTrades.slice(0, 5).forEach((t, i) => {
    console.log(`  ${i + 1}. LTI Delta: +${t.ltiDifference} | Lineup Surplus: +${t.pointDifference} pts | ${t.team1.isWinner ? t.team1.managerName : t.team2.managerName} vs ${t.team1.isWinner ? t.team2.managerName : t.team1.managerName}`);
});

console.log('\n--- 4. TOP PICKUPS COST COLUMN NOWRAP & FORMAT ---');
if (!overviewHtml.includes('strong>$') || !overviewHtml.includes('<small class="tx-muted">(')) {
    throw new Error('FAIL: Top pickups cost cell not formatted with compact strong bid and muted budget percentage');
}

console.log('\n--- 5. WORST DROPS & TOP PICKUPS ROW COUNTS ---');
console.log('Worst drops count in table:', (overviewHtml.match(/data-player/g) || []).length);
// Verify 10 rows sliced
const dropsMatches = overviewHtml.split('Worst Drops of All Time')[1].split('Top Pickups of All Time')[0];
const dropRowCount = (dropsMatches.match(/<tr>/g) || []).length - 1; // subtract thead tr
console.log('Worst Drops rows:', dropRowCount);
if (dropRowCount !== 10) {
    throw new Error(`FAIL: Expected 10 rows in Worst Drops, got ${dropRowCount}`);
}

const pickupsMatches = overviewHtml.split('Top Pickups of All Time')[1].split('The Career Nomads')[0];
const pickupRowCount = (pickupsMatches.match(/<tr>/g) || []).length - 1; // subtract thead tr
console.log('Top Pickups rows:', pickupRowCount);
if (pickupRowCount !== 10) {
    throw new Error(`FAIL: Expected 10 rows in Top Pickups, got ${pickupRowCount}`);
}

console.log('\n--- 6. BAYESIAN EXTRAPOLATION FOR INJURED TRADED PLAYERS ---');
// Test 1: 8+ games -> alpha = 1.0 (no shrinkage)
const robustEval = { gamesPlayed: 10, ppg: 18.0, position: 'WR', fullSeasonPpg: 18.0 };
const robustExtrap = engine.getExtrapolatedMissedPpg(robustEval, 6);
console.log('Robust sample (10 games @ 18.0 PPG):', robustExtrap, '(Expected 18.0)');
if (Math.abs(robustExtrap - 18.0) > 0.05) {
    throw new Error(`FAIL: Robust sample should extrapolate at 100% PPG! Got ${robustExtrap}`);
}

// Test 2: 2 games @ 30 PPG -> alpha = 0.25 (heavy shrinkage toward position/player baseline)
const smallHotEval = { gamesPlayed: 2, ppg: 30.0, position: 'WR', fullSeasonPpg: 12.0 };
const smallHotExtrap = engine.getExtrapolatedMissedPpg(smallHotEval, 14);
console.log('Small hot streak sample (2 games @ 30.0 PPG, full season 12.0 PPG):', smallHotExtrap);
if (smallHotExtrap > 20.0) {
    throw new Error(`FAIL: Small hot sample should be regressed under 20 PPG! Got ${smallHotExtrap}`);
}

console.log('\n--- 7. TRADE RECORD (W-L-T) EXPLAINER MODAL & HELP BUTTON ---');
const tradeTableHtml = engine.renderTradeLeaderboardTable();
if (!tradeTableHtml.includes('btn-trade-record-help')) {
    throw new Error('FAIL: Record (W-L-T) header must include btn-trade-record-help');
}

// Render modal
engine.renderTradeRecordModal();
const recordModal = domElements.get('tx-trade-record-modal');
if (!recordModal) {
    throw new Error('FAIL: tx-trade-record-modal was not created');
}
console.log('Trade Record Modal HTML contains key sections:');
console.log('  - Determining Wins, Losses, and Ties:', recordModal.innerHTML.includes('Determining Wins, Losses, and Ties'));
console.log('  - Core Principles: LTI & VORP:', recordModal.innerHTML.includes('Core Principles: LTI & VORP'));
console.log('  - 2-for-1 Consolidation Roster Trust:', recordModal.innerHTML.includes('2-for-1 Consolidation Roster Trust'));
console.log('  - Statistical Injury Extrapolation:', recordModal.innerHTML.includes('Statistical Injury Extrapolation'));

if (!recordModal.innerHTML.includes('Determining Wins, Losses, and Ties') ||
    !recordModal.innerHTML.includes('Core Principles: LTI & VORP') ||
    !recordModal.innerHTML.includes('2-for-1 Consolidation Roster Trust') ||
    !recordModal.innerHTML.includes('Statistical Injury Extrapolation')) {
    throw new Error('FAIL: Trade Record Modal missing required explanatory sections');
}

console.log('\n--- 8. EMPIRICAL VOLUME BONUS & STATISTICAL RATIONALE ---');
engine.renderTradingScoreModal();
const tradingScoreModal = domElements.get('tx-trading-score-modal');
if (!tradingScoreModal) {
    throw new Error('FAIL: tx-trading-score-modal was not created');
}
console.log('Trading Score Modal includes empirical championship evidence:', tradingScoreModal.innerHTML.includes('100% of league champions'));
console.log('Trading Score Modal includes playoff rate evidence:', tradingScoreModal.innerHTML.includes('2.4x higher rate'));
if (!tradingScoreModal.innerHTML.includes('100% of league champions') || !tradingScoreModal.innerHTML.includes('2.4x higher rate')) {
    throw new Error('FAIL: Trading Score modal missing empirical playoff/championship evidence');
}

console.log('\n--- 10. WAIVER PICKUP LEADERBOARD & COLUMN REFINEMENTS ---');
const pickupTableHtml = engine.renderPickupLeaderboardTable();
console.log('Pickup Table contains Avg Add Pts:', pickupTableHtml.includes('Avg Add Pts'));
console.log('Pickup Table contains Avg LTI:', pickupTableHtml.includes('Avg LTI'));
console.log('Pickup Table contains compact FA Gems header:', pickupTableHtml.includes('FA Gems'));
console.log('Pickup Table contains btn-avg-added-lti-help:', pickupTableHtml.includes('btn-avg-added-lti-help'));
console.log('Pickup Table contains btn-faab-waiver-coercion-help:', pickupTableHtml.includes('btn-faab-waiver-coercion-help'));
console.log('Pickup Table contains btn-lti-pickup-rating-help:', pickupTableHtml.includes('btn-lti-pickup-rating-help'));

if (!pickupTableHtml.includes('Avg Add Pts') ||
    !pickupTableHtml.includes('Avg LTI') ||
    !pickupTableHtml.includes('FA Gems') ||
    !pickupTableHtml.includes('btn-avg-added-lti-help') ||
    !pickupTableHtml.includes('btn-faab-waiver-coercion-help') ||
    !pickupTableHtml.includes('btn-lti-pickup-rating-help')) {
    throw new Error('FAIL: Pickup Table missing required columns or help buttons');
}

console.log('\n--- 11. PICKUP METHODOLOGY MODALS ---');
engine.renderPickupRatingModal();
const pickupRatingModal = domElements.get('tx-pickup-rating-modal');
if (!pickupRatingModal || !pickupRatingModal.innerHTML.includes('How LTI Pickup Rating is Calculated')) {
    throw new Error('FAIL: tx-pickup-rating-modal missing or incomplete');
}

engine.renderAvgAddedLtiModal();
const avgLtiModal = domElements.get('tx-avg-added-lti-modal');
if (!avgLtiModal || !avgLtiModal.innerHTML.includes('How Average Added LTI is Calculated')) {
    throw new Error('FAIL: tx-avg-added-lti-modal missing or incomplete');
}

engine.renderFaabWaiverCoercionModal();
const faabModal = domElements.get('tx-faab-waiver-coercion-modal');
if (!faabModal || !faabModal.innerHTML.includes('Standardizing FAAB Budgets')) {
    throw new Error('FAIL: tx-faab-waiver-coercion-modal missing or incomplete');
}
console.log('All 3 pickup explainer modals rendered and verified.');

console.log('\n--- 12. PLATFORM COMPLIANCE (0 EMOJIS & 0 EM-DASHES) ---');
const engineCode = fs.readFileSync('./src/transactions_engine.js', 'utf8');

// Check for em-dash (—)
if (engineCode.includes('—')) {
    throw new Error('FAIL: Detected em-dash character in src/transactions_engine.js! Em-dash policy requires ", as" instead.');
}

// Check for emojis
const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
// Note: 🏆 and 🚽 are only allowed in Record Book, not transactions_engine.js
const emojiMatch = engineCode.match(emojiRegex);
if (emojiMatch) {
    throw new Error(`FAIL: Detected emoji "${emojiMatch[0]}" in src/transactions_engine.js! Platform policy prohibits emojis outside Record Book.`);
}

console.log('No em-dashes found. No unauthorized emojis found.');

console.log('\n--- 13. LATEST AUDIO REQUIREMENTS & REGRESSIONS ---');
// Test A: Sampson vs Bam Knight
const sampsonTx = dmsTx.find(x => x.season === 2026 && x.added_players?.some(p => /sampson/i.test(p)));
if (!sampsonTx) throw new Error('FAIL: Sampson transaction not found');
const evSampson = engine.evaluatePickup(sampsonTx);
console.log('Sampson Tx LTI:', evSampson.transactionLti, '| Verdict:', evSampson.verdict);
if (evSampson.transactionLti < 55) {
    throw new Error(`FAIL: Sampson transaction LTI (${evSampson.transactionLti}) is penalized despite dropping Bam Knight who missed rest of season!`);
}
const sampsonCard = engine.renderPickupCard(evSampson);
if (!sampsonCard.includes('Added:') || !sampsonCard.includes('Dropped:')) {
    throw new Error('FAIL: Pickup card does not use clean Added: and Dropped: labels');
}
if (sampsonCard.includes('Acquired (Add)') || sampsonCard.includes('Surrendered (Drop)')) {
    throw new Error('FAIL: Pickup card still contains Acquired/Surrendered phrases');
}
if (sampsonCard.includes('delta)')) {
    throw new Error('FAIL: Pickup card still contains parenthetical delta in Transaction LTI');
}
if (!sampsonCard.includes('% bgt')) {
    throw new Error('FAIL: FAAB percentage does not use % bgt abbreviation');
}

// Test B: Saints vs Vikings DEF
const vikesTx = dmsTx.find(x => x.season === 2026 && x.added_players?.includes('Saints') && x.dropped_players?.includes('Vikings'));
if (!vikesTx) throw new Error('FAIL: Saints/Vikings transaction not found');
const evVikes = engine.evaluatePickup(vikesTx);
const vikesCard = engine.renderPickupCard(evVikes);
if (vikesCard.includes('missed')) {
    throw new Error('FAIL: Vikings DEF still shows missed games badge');
}
console.log('Saints/Vikings DEF evaluated cleanly with no missed games badge.');

// Test C: Compulsory pure drops relative dampening
const pureDrop = dmsTx.find(x => x.season === 2026 && x.week === 15 && x.dropped_players?.includes('Brandon Aiyuk') && (!x.added_players || x.added_players.length === 0));
if (pureDrop) {
    const evDrop = engine.evaluateDrop(pureDrop);
    console.log('Pure drop relative points lost:', evDrop.relativePointsLost, '| verdict:', evDrop.verdict);
    if (evDrop.relativePointsLost !== 0 || evDrop.verdict !== 'Optimal Cut') {
        throw new Error('FAIL: Pure drop of inactive/0-pt player was not evaluated as optimal cut');
    }
}

// Test D: Pickup table formatting (no inline widths)
if (pickupTableHtml.includes('style="width: 44px') || pickupTableHtml.includes('style="width: 50px')) {
    throw new Error('FAIL: Pickup table still contains hardcoded column inline widths');
}
console.log('Pickup and trade leaderboard tables have unified format parity.');

console.log('\n=============================================');
console.log('ALL 13 VERIFICATION CHECKS PASSED WITH FLYING COLORS!');
console.log('=============================================');

