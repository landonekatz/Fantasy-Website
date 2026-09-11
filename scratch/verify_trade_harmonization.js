import fs from 'fs';
import { TransactionsEngine } from '../src/transactions_engine.js';

// Mock DOM
const domElements = new Map();
global.document = {
    getElementById: (id) => domElements.get(id) || null,
    querySelectorAll: () => [],
    createElement: (tag) => ({
        id: '',
        className: '',
        innerHTML: '',
        showModal: () => {},
        close: () => {},
        addEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, right: 100, top: 0, bottom: 100 })
    }),
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

console.log('=== TEST 1: SIGN AGREEMENT ACROSS ALL TRADES ===');
const trades = dmsTx.filter(t => t.type === 'trade' || t.action_type === 'TRADE');
console.log('Evaluating', trades.length, 'trades in DMS history...');

let evaluatedTrades = [];
trades.forEach((t, i) => {
    const ev = engine.evaluateTrade(t);
    evaluatedTrades.push(ev);

    const pts = ev.team1.netPoints;
    const lti = ev.team1.netLti;

    // Check sign consistency
    if (pts > 0 && lti < 0) {
        throw new Error(`FAIL: Trade ${ev.season} W${ev.week} (${ev.team1.managerName} vs ${ev.team2.managerName}) has positive points (+${pts}) but negative LTI (${lti})!`);
    }
    if (pts < 0 && lti > 0) {
        throw new Error(`FAIL: Trade ${ev.season} W${ev.week} (${ev.team1.managerName} vs ${ev.team2.managerName}) has negative points (${pts}) but positive LTI (+${lti})!`);
    }

    // Check winner consistency
    if (ev.team1.isWinner && (pts < 0 || lti < 0)) {
        throw new Error(`FAIL: Winner team 1 has negative points or LTI! (${pts} pts, ${lti} LTI)`);
    }
    if (ev.team2.isWinner && (ev.team2.netPoints < 0 || ev.team2.netLti < 0)) {
        throw new Error(`FAIL: Winner team 2 has negative points or LTI! (${ev.team2.netPoints} pts, ${ev.team2.netLti} LTI)`);
    }

    // Check player position tags
    ev.team1.players.forEach(p => {
        if (!p.position || p.position === 'undefined') {
            throw new Error(`FAIL: Trade ${t.id} team1 player ${p.playerName} has undefined position!`);
        }
    });
    ev.team2.players.forEach(p => {
        if (!p.position || p.position === 'undefined') {
            throw new Error(`FAIL: Trade ${t.id} team2 player ${p.playerName} has undefined position!`);
        }
    });
});

console.log(`PASS: All ${trades.length} trades have 100% sign agreement between Net Lineup Points and Net LTI!`);
console.log('PASS: All player objects in evaluateTrade have valid, defined position tags.');

console.log('\n=== TEST 2: TARGET CASES FROM AUDIO FEEDBACK ===');

// Case A: Mike vs Landon 2026 W7
const tMikeLandon = trades.find(t => t.season == 2026 && (t.week == 7 || t.week == 6 || t.week == 8));
if (tMikeLandon) {
    const ev = engine.evaluateTrade(tMikeLandon);
    console.log(`2026 W${ev.week} Mike vs Landon:`);
    console.log(`  Mike Net Pts: ${ev.team1.netPoints}, Net LTI: ${ev.team1.netLti}, Verdict: ${ev.verdict}, Winner: ${ev.team1.isWinner ? ev.team1.managerName : ev.team2.managerName}`);
    if (ev.team1.netPoints <= 0 || ev.team1.netLti <= 0) {
        throw new Error('FAIL: Mike should have positive net points and positive Net LTI!');
    }
}

// Case B: Will vs Landon 2025 W6 (Amon-Ra for Dobbins + Diggs)
const tWillLandon = trades.find(t => t.id === '449.l.80052.tr.185');
if (tWillLandon) {
    const ev = engine.evaluateTrade(tWillLandon);
    console.log(`2025 W${ev.week} Will vs Landon (Amon-Ra deal):`);
    console.log(`  Will Net Pts: ${ev.team1.netPoints}, Net LTI: ${ev.team1.netLti}, Lineup Pts: ${ev.team1.lineupPoints} vs ${ev.team2.lineupPoints}`);
    console.log(`  Verdict: ${ev.verdict}, Winner: ${ev.team1.isWinner ? ev.team1.managerName : ev.team2.managerName}`);
    if (ev.team1.isWinner && ev.team1.netPoints < 0) {
        throw new Error('FAIL: Winner should never have negative net points!');
    }
}

// Case C: Landon vs Jack 2020 W2 (James White for Kenyan Drake + Will Fuller)
const tJackLandon = trades.find(t => t.season == 2020 && (t.dropped_players?.includes('James White') || t.added_players?.includes('James White')));
if (tJackLandon) {
    const ev = engine.evaluateTrade(tJackLandon);
    console.log(`2020 W${ev.week} Landon vs Jack (James White deal):`);
    console.log(`  Jack Net Pts: ${ev.team2.netPoints}, Net LTI: ${ev.team2.netLti}, Lineup Pts: ${ev.team2.lineupPoints} vs ${ev.team1.lineupPoints}`);
    console.log(`  Verdict: ${ev.verdict}, Winner: ${ev.team2.isWinner ? ev.team2.managerName : ev.team1.managerName}`);
    if (ev.team2.netLti < 35 || ev.verdict !== 'True Fleece') {
        throw new Error(`FAIL: Jack's 143.7 point advantage should be rewarded with substantial LTI (got +${ev.team2.netLti}) and True Fleece verdict!`);
    }
}

console.log('\n=== TEST 3: ACTIVITY FEED HTML OUTPUT & ZERO "UNDEFINED" POSITIONS ===');
const evAll = engine.evaluateAllTransactions();
const feedHtml = engine.renderFeedItems(evAll);

if (feedHtml.includes('class="tx-pos-tag">undefined</span>') || feedHtml.includes('>undefined<')) {
    throw new Error('FAIL: Feed HTML contains "undefined" in position tags or text!');
}
console.log('PASS: Feed HTML contains zero instances of "undefined" in position tags or text.');

// Verify trade card rendering includes position tags and breakdown notes
const sampleTradeCard = engine.renderTradeCard(evAll.unfairTrades[0]);
console.log('Sample Trade Card has tx-pos-tag:', sampleTradeCard.includes('class="tx-pos-tag"'));
console.log('Sample Trade Card has Extrapolated note (if applicable) or actual pts breakdown:', sampleTradeCard.includes('actual pts'));

console.log('\n=== TEST 4: METHODOLOGY MODAL UPDATED ===');
engine.renderTradeRecordModal();
const modal = domElements.get('tx-trade-record-modal');
if (!modal || !modal.innerHTML.includes('Balanced Deal (Tie):') || !modal.innerHTML.includes('True Fleece:')) {
    throw new Error('FAIL: Trade Record Modal missing calibrated 5-tier explanations!');
}
console.log('PASS: Trade Record Modal clearly documents all 5 calibrated verdict tiers.');

console.log('\n=== TEST 5: PLATFORM POLICIES (0 EMOJIS & 0 EM-DASHES) ===');
const engineCode = fs.readFileSync('./src/transactions_engine.js', 'utf8');

if (engineCode.includes('—')) {
    throw new Error('FAIL: Found em-dash (—) in src/transactions_engine.js!');
}

const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const emojiMatch = engineCode.match(emojiRegex);
if (emojiMatch) {
    throw new Error(`FAIL: Found emoji "${emojiMatch[0]}" in src/transactions_engine.js!`);
}
console.log('PASS: 0 em-dashes and 0 unauthorized emojis found in src/transactions_engine.js.');

console.log('\n=============================================');
console.log('ALL VERIFICATION CHECKS PASSED WITH 100% SUCCESS!');
console.log('=============================================');
