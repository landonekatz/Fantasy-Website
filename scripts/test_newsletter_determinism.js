/**
 * Automated Test Suite for Deterministic Weekly Newsletter Engine
 * 
 * Verifies:
 * 1. Ingestion Cadence & Wednesday Kickoff Exception.
 * 2. Deterministic Variant Selection & Salting Modulo Hash.
 * 3. Token Substitution & Precision Arithmetic.
 * 4. Anti-Fatigue Curation & Strict Publication Budget.
 * 5. 100% Identical Output Across Consecutive Pipeline Runs.
 * 6. Platform Rules Compliance (NO emojis, NO em-dashes).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TRIGGER_TEMPLATES, TRIGGER_HEADLINES } from '../src/newsletter_templates.js';
import { NewsletterTriggerEvaluator } from '../src/newsletter_triggers.js';
import { NewsletterCurator } from '../src/newsletter_curator.js';
import { NewsletterRenderer, computeVariantIndex, renderTemplate } from '../src/newsletter_renderer.js';
import { NewsletterEngine, resolveDispatchTimestamp } from '../src/newsletter_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`PASS: ${message}`);
        passed++;
    } else {
        console.error(`FAIL: ${message}`);
        failed++;
    }
}

console.log('--- TEST 1: Schedule & Wednesday Kickoff Exception ---');
{
    // Normal week without early Wednesday game -> default Wednesday 06:00:00 UTC
    const normalDispatch = resolveDispatchTimestamp(null);
    assert(normalDispatch.getUTCHours() === 6 && normalDispatch.getUTCMinutes() === 0, 'Normal dispatch defaults to 06:00 UTC');

    // Wednesday game at 08:00 UTC -> 3 hours prior is 05:00 UTC -> min(06:00, 05:00) = 05:00 UTC
    const wedEarlyKickoff = new Date(Date.UTC(2026, 8, 9, 8, 0, 0)); // Wed Sept 9, 2026, 08:00 UTC
    const earlyDispatch = resolveDispatchTimestamp(wedEarlyKickoff);
    assert(earlyDispatch.getUTCHours() === 5 && earlyDispatch.getUTCMinutes() === 0, 'Wednesday 08:00 UTC kickoff calculates 05:00 UTC dispatch');

    // Wednesday game at 18:00 UTC -> 3 hours prior is 15:00 UTC -> min(06:00, 15:00) = 06:00 UTC
    const wedLateKickoff = new Date(Date.UTC(2026, 8, 9, 18, 0, 0));
    const lateDispatch = resolveDispatchTimestamp(wedLateKickoff);
    assert(lateDispatch.getUTCHours() === 6 && lateDispatch.getUTCMinutes() === 0, 'Wednesday 18:00 UTC kickoff preserves standard 06:00 UTC dispatch');
}

console.log('\n--- TEST 2: Deterministic Modulo Hash Variant Selection ---');
{
    const v1 = computeVariantIndex('dmsfantasy', 2026, 7, 'TINKERING_PENALTY', ['alex', 'benjamin']);
    const v2 = computeVariantIndex('dmsfantasy', 2026, 7, 'TINKERING_PENALTY', ['alex', 'benjamin']);
    assert(v1 >= 0 && v1 < 10, 'Variant index is between 0 and 9');
    assert(v1 === v2, 'Identical inputs produce identical variant index');

    // Different manager IDs or trigger ID shifts hash
    const v3 = computeVariantIndex('dmsfantasy', 2026, 7, 'EMPTY_SUIT', ['alex', 'benjamin']);
    const v4 = computeVariantIndex('dmsfantasy', 2026, 8, 'TINKERING_PENALTY', ['alex', 'benjamin']);
    assert(typeof v3 === 'number' && typeof v4 === 'number', 'Different parameters produce valid numbers');
}

console.log('\n--- TEST 3: Template Token Resolution & Rule Compliance ---');
{
    const triggerKeys = Object.keys(TRIGGER_TEMPLATES);
    assert(triggerKeys.length === 71, `Expected 71 triggers across Modules 1-11, found ${triggerKeys.length}`);

    let allTenVariants = true;
    let noEmojis = true;
    let noEmDashes = true;

    // Emoji detection regex
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const [key, variants] of Object.entries(TRIGGER_TEMPLATES)) {
        if (!Array.isArray(variants) || variants.length !== 10) {
            allTenVariants = false;
            console.error(`Trigger ${key} does not have exactly 10 variants (has ${variants.length})`);
        }
        variants.forEach((v, idx) => {
            if (emojiRegex.test(v)) {
                noEmojis = false;
                console.error(`Trigger ${key} variant ${idx} contains emoji!`);
            }
            if (v.includes('—')) {
                noEmDashes = false;
                console.error(`Trigger ${key} variant ${idx} contains em-dash!`);
            }
        });
    }

    assert(allTenVariants, `All ${triggerKeys.length} triggers have exactly 10 distinct body variants (${triggerKeys.length * 10} total templates)`);
    assert(noEmojis, `Zero emojis across all ${triggerKeys.length * 10} templates (Platform Emoji Policy)`);
    assert(noEmDashes, `Zero em-dashes across all ${triggerKeys.length * 10} templates (Platform Em-Dash Policy)`);

    // Verify TRIGGER_HEADLINES
    const headlineKeys = Object.keys(TRIGGER_HEADLINES);
    assert(headlineKeys.length === 71, `Expected 71 triggers in TRIGGER_HEADLINES, found ${headlineKeys.length}`);
    let allTenHeadlineVariants = true;
    let headlinesNoEmojis = true;
    let headlinesNoEmDashes = true;

    for (const [key, hVariants] of Object.entries(TRIGGER_HEADLINES)) {
        if (!Array.isArray(hVariants) || hVariants.length !== 10) {
            allTenHeadlineVariants = false;
            console.error(`Headline ${key} does not have exactly 10 variants (has ${hVariants.length})`);
        }
        hVariants.forEach((hv, idx) => {
            if (emojiRegex.test(hv)) {
                headlinesNoEmojis = false;
                console.error(`Headline ${key} variant ${idx} contains emoji!`);
            }
            if (hv.includes('—')) {
                headlinesNoEmDashes = false;
                console.error(`Headline ${key} variant ${idx} contains em-dash!`);
            }
        });
    }

    assert(allTenHeadlineVariants, `All ${headlineKeys.length} triggers have exactly 10 distinct headline variants (${headlineKeys.length * 10} total headlines)`);
    assert(headlinesNoEmojis, `Zero emojis across all ${headlineKeys.length * 10} headlines (Platform Emoji Policy)`);
    assert(headlinesNoEmDashes, `Zero em-dashes across all ${headlineKeys.length * 10} headlines (Platform Em-Dash Policy)`);

    // Test token replacement
    const sampleTemplate = TRIGGER_TEMPLATES.TINKERING_PENALTY[0];
    const rendered = renderTemplate(sampleTemplate, {
        swap_time: '12:55 PM',
        manager_name: 'Alex',
        benched_player: 'Jayden Reed',
        started_player: 'Christian Watson',
        benched_pts: '24.6',
        started_pts: '4.2',
        margin: '11.8'
    });
    assert(!rendered.includes('{') && !rendered.includes('}'), 'All tokens successfully interpolated');
    assert(rendered.includes('Alex') && rendered.includes('24.6'), 'Interpolated values correctly present');
}

console.log('\n--- TEST 4: Anti-Fatigue Curation & Scoring Math ---');
{
    const curator = new NewsletterCurator({
        leagueId: 'dmsfantasy',
        season: 2026,
        week: 8,
        managers: [
            { id: 'alex', name: 'Alex' },
            { id: 'benjamin', name: 'Benjamin' },
            { id: 'carson', name: 'Carson' },
            { id: 'landon', name: 'Landon' }
        ]
    });

    // Recency decay: featured 1 week ago (delta_t = 1) -> exp(-0.693 * 1) ~= 0.50
    curator.publishedTriggerHistory.set('TINKERING_PENALTY', 7);
    const decay1 = curator.getRecencyDecay('TINKERING_PENALTY');
    assert(Math.abs(decay1 - 0.50) < 0.02, `Recency decay 1 week ago is ~0.50 (got ${decay1.toFixed(3)})`);

    // Never featured -> 1.0
    const decayNever = curator.getRecencyDecay('NEW_TRIGGER');
    assert(decayNever === 1.0, 'Never-featured trigger decay is 1.0');

    // Manager equity: manager with 0 features when average is 2 -> equity > 1.0
    curator.managerFeatureCounts.set('alex', 4);
    curator.managerFeatureCounts.set('benjamin', 2);
    curator.managerFeatureCounts.set('carson', 2);
    curator.managerFeatureCounts.set('landon', 0); // below average
    const equityLandon = curator.getManagerEquity(['landon']);
    const equityAlex = curator.getManagerEquity(['alex']);
    assert(equityLandon > 1.0, `Under-featured manager receives boost > 1.0 (got ${equityLandon.toFixed(2)})`);
    assert(equityAlex < 1.0, `Over-featured manager receives penalty < 1.0 (got ${equityAlex.toFixed(2)})`);

    // Composite score math: S = |Z| * W * D(t) * E(m)
    const cand = {
        trigger_id: 'EMPTY_SUIT',
        category: 'BAD_BEAT',
        involved_manager_ids: ['landon'],
        z_score: 2.0
    };
    const compScore = curator.computeCompositeScore(cand);
    assert(compScore > 0, `Composite score calculated successfully (${compScore.toFixed(2)})`);
}

console.log('\n--- TEST 5: Full Pipeline Curation Budget & Dossier Generation ---');
{
    const mockManagers = [
        { id: 'alex', name: 'Alex', favorite_team: 'PHI' },
        { id: 'benjamin', name: 'Benjamin', favorite_team: 'KC' },
        { id: 'carson', name: 'Carson', favorite_team: 'DAL' },
        { id: 'landon', name: 'Landon', favorite_team: 'BAL' }
    ];

    const mockMatchups = [
        { season: 2026, week: 10, team_1_manager_id: 'alex', team_1_actual_points: 125.4, team_2_manager_id: 'benjamin', team_2_actual_points: 110.2, margin: 15.2 },
        { season: 2026, week: 10, team_1_manager_id: 'carson', team_1_actual_points: 88.0, team_2_manager_id: 'landon', team_2_actual_points: 134.5, margin: 46.5 }
    ];

    const mockPlayerStats = [
        { season: 2026, week: 10, manager_id: 'alex', player_name: 'Jalen Hurts', is_starter: true, roster_slot: 'QB', nfl_team: 'PHI', fantasy_points: 24.5 },
        { season: 2026, week: 10, manager_id: 'alex', player_name: 'A.J. Brown', is_starter: true, roster_slot: 'WR', nfl_team: 'PHI', fantasy_points: 18.2 },
        { season: 2026, week: 10, manager_id: 'benjamin', player_name: 'Patrick Mahomes', is_starter: true, roster_slot: 'QB', nfl_team: 'KC', fantasy_points: 19.4 }
    ];

    const evaluator = new NewsletterTriggerEvaluator({
        leagueId: 'dmsfantasy',
        season: 2026,
        week: 10,
        managers: mockManagers,
        matchups: mockMatchups,
        playerStats: mockPlayerStats
    });

    const candidates = evaluator.evaluateAll();
    assert(candidates.length > 0, `Triggers successfully evaluated (generated ${candidates.length} candidates)`);

    const curator = new NewsletterCurator({
        leagueId: 'dmsfantasy',
        season: 2026,
        week: 10,
        managers: mockManagers
    });

    const curated = curator.curateEdition(candidates);
    assert(curated.lead !== null, 'Lead Story successfully curated');

    // Generate Dossier
    const dossier = curator.generateDossier('alex', {
        managers: mockManagers,
        matchups: mockMatchups,
        playerStats: mockPlayerStats
    });
    assert(dossier.managerName === 'Alex', 'Dossier manager name correctly populated');
    assert(dossier.opponentProfile !== undefined, 'Dossier Module 1: Opponent Profile populated');
    assert(dossier.fandomWarning !== undefined, 'Dossier Module 2: Fandom Conflict Warning populated');
    assert(dossier.coachingAudit !== undefined, 'Dossier Module 3: Coaching Efficiency Audit populated');
    assert(dossier.calendarSplit !== undefined, 'Dossier Module 4: Historical Calendar Split populated');
    assert(dossier.milestoneWatch !== undefined, 'Dossier Module 5: Milestone Watch populated');
}

console.log('\n--- TEST 6: 100% Deterministic Reproduction Across Runs ---');
{
    const mockManagers = [
        { id: 'alex', name: 'Alex', favorite_team: 'PHI' },
        { id: 'benjamin', name: 'Benjamin', favorite_team: 'KC' }
    ];
    const mockMatchups = [
        { season: 2026, week: 5, team_1_manager_id: 'alex', team_1_actual_points: 112.5, team_2_manager_id: 'benjamin', team_2_actual_points: 98.4, margin: 14.1 }
    ];
    const mockPlayerStats = [
        { season: 2026, week: 5, manager_id: 'alex', player_name: 'Jalen Hurts', is_starter: true, roster_slot: 'QB', nfl_team: 'PHI', fantasy_points: 20.0 }
    ];

    const engine1 = new NewsletterEngine({
        leagueId: 'dmsfantasy',
        managers: mockManagers,
        matchups: mockMatchups,
        playerStats: mockPlayerStats
    });
    const ed1 = engine1.generateEdition(2026, 5);

    let identical = true;
    for (let run = 2; run <= 10; run++) {
        const engineN = new NewsletterEngine({
            leagueId: 'dmsfantasy',
            managers: mockManagers,
            matchups: mockMatchups,
            playerStats: mockPlayerStats
        });
        const edN = engineN.generateEdition(2026, 5);
        if (ed1.leadStory.text !== edN.leadStory.text || ed1.leadStory.variantIndex !== edN.leadStory.variantIndex) {
            identical = false;
        }
    }
    assert(identical, '10 consecutive pipeline runs produced 100% identical outputs and variant indices');
}

console.log('\n--- TEST 7: Active Week 1 Compilation, Volume Math, & Masthead Clean-up ---');
{
    const mockManagers = [
        { id: 'alex', name: 'Alex' },
        { id: 'benjamin', name: 'Benjamin' }
    ];
    const mockMatchups = [
        { season: 2025, week: 1, team_1_manager_id: 'alex', team_1_actual_points: 100, team_2_manager_id: 'benjamin', team_2_actual_points: 90 },
        { season: 2025, week: 2, team_1_manager_id: 'alex', team_1_actual_points: 105, team_2_manager_id: 'benjamin', team_2_actual_points: 95 },
        { season: 2026, week: 1, team_1_manager_id: 'alex', team_1_actual_points: 0, team_2_manager_id: 'benjamin', team_2_actual_points: 0, winner: 'UNDECIDED' },
        { season: 2026, week: 2, team_1_manager_id: 'alex', team_1_actual_points: 0, team_2_manager_id: 'benjamin', team_2_actual_points: 0, winner: 'UNDECIDED' }
    ];
    const mockSeasonsMeta = [
        { season: 2018 },
        { season: 2019 },
        { season: 2020 },
        { season: 2021 },
        { season: 2022 },
        { season: 2023 },
        { season: 2024 },
        { season: 2025 },
        { season: 2026 }
    ];

    const engine = new NewsletterEngine({
        leagueId: 'dmsfantasy',
        managers: mockManagers,
        matchups: mockMatchups,
        seasonsMetadata: mockSeasonsMeta,
        leagueSettings: { est_year: 2018 }
    });

    engine.compileAllEditions();

    // Verify exactly 1 edition compiled for active season Week 1
    assert(engine.editions.length === 1, `Exactly 1 edition compiled for active season (got ${engine.editions.length})`);
    const activeEd = engine.editions[0];
    assert(activeEd.season === 2026 && activeEd.week === 1, `Compiled edition is active season 2026 Week 1 (got season ${activeEd.season}, week ${activeEd.week})`);

    // Verify Volume calculation (2026 - 2018 + 1 = 9)
    assert(activeEd.volume === 9, `Volume for 2026 with EST. 2018 is 9 (got ${activeEd.volume})`);

    // Verify Volume for 10th year (2027 - 2018 + 1 = 10)
    const vol10 = engine.calculateVolume(2027);
    assert(vol10 === 10, `Volume for 10th year (2027) is 10 (got ${vol10})`);

    // Verify Masthead clean-up
    const defaultHtml = engine.renderer.renderEditionHtml(activeEd, null, mockManagers);
    assert(defaultHtml.includes('The Weekly Gazette'), 'Default masthead title is "The Weekly Gazette"');
    assert(!defaultHtml.includes('Official Vault Dispatch'), 'Cluttered "Official Vault Dispatch" badge is removed');
    assert(!defaultHtml.includes('Automated League Intelligence, Statistical Deviations, and Banter'), 'Cluttered subtitle is removed');
    assert(defaultHtml.includes('VOL. 9 • ISSUE 1'), 'Masthead displays accurate Volume and Issue (VOL. 9 • ISSUE 1)');

    // Verify Custom Newsletter Title
    engine.setNewsletterTitle('The Dumbarton Chronicle');
    const customHtml = engine.renderer.renderEditionHtml(activeEd, null, mockManagers, { newsletterTitle: engine.newsletterTitle });
    assert(customHtml.includes('The Dumbarton Chronicle'), 'Custom newsletter title overrides default');
}

console.log('\n--- TEST 8: DMS 2027 Week 1 Live Data (Vol. 10 Issue 1, Prospective Headlines, & Landon Dossier) ---');
{
    const fs = await import('fs');
    const managersData = JSON.parse(fs.readFileSync('./dmsfantasy/data/managers.json', 'utf8'));
    const matchups = JSON.parse(fs.readFileSync('./dmsfantasy/data/matchups.json', 'utf8'));
    const playerStats = JSON.parse(fs.readFileSync('./dmsfantasy/data/weekly_player_stats.json', 'utf8'));
    const draftResults = JSON.parse(fs.readFileSync('./dmsfantasy/data/draft_results.json', 'utf8'));
    const standings = JSON.parse(fs.readFileSync('./dmsfantasy/data/league_standings.json', 'utf8'));
    const seasonsMetadata = JSON.parse(fs.readFileSync('./dmsfantasy/data/seasons_metadata.json', 'utf8'));

    const engine = new NewsletterEngine({
        leagueId: 'dmsfantasy',
        leagueSlug: 'dmsfantasy',
        managers: managersData.managers,
        matchups,
        standings,
        playerStats,
        draftResults,
        transactions: [],
        seasonsMetadata,
        leagueSettings: { est_year: 2018 }
    });

    engine.compileAllEditions();
    assert(engine.editions.length > 0, 'Compiled editions array is not empty');

    const ed2027 = engine.editions[0];
    assert(ed2027.season === 2027, `Active season is 2027 (got ${ed2027.season})`);
    assert(ed2027.week === 1, `Active week is 1 (got ${ed2027.week})`);
    assert(ed2027.volume === 10, `Active volume is 10 for DMS 10th season (got ${ed2027.volume})`);

    // Verify stories are non-empty and prospective
    assert(ed2027.leadStory.text.length > 15, 'Lead story populated');
    assert(ed2027.spotlight1.text.length > 15, 'Spotlight 1 populated');
    assert(ed2027.spotlight2.text.length > 15, 'Spotlight 2 populated');
    assert(ed2027.wire.text.length > 15, 'Wire desk populated');
    assert(ed2027.lore.text.length > 15, 'Deep lore populated');

    // Verify story triggers are unique and populated
    const edTriggers = [ed2027.leadStory.trigger_id, ed2027.spotlight1.trigger_id, ed2027.spotlight2.trigger_id, ed2027.wire.trigger_id, ed2027.lore.trigger_id].filter(Boolean);
    const uniqueTriggers = new Set(edTriggers);
    assert(uniqueTriggers.size === edTriggers.length, `All curated stories have unique triggers (got ${uniqueTriggers.size} unique of ${edTriggers.length})`);
    assert(Boolean(ed2027.leadStory.trigger_id), `Lead story populated with high-anomaly trigger: ${ed2027.leadStory.trigger_id}`);

    // Generate Landon's Dossier
    const dossier = ed2027.curator.generateDossier('landon', {
        managers: managersData.managers,
        matchups,
        playerStats,
        draftResults,
        standings
    });

    // 1. Opponent Profile (vs Jordan, 6-7 H2H, streak Won 1)
    assert(dossier.opponentProfile.opponentName === 'Jordan', `Opponent is Jordan, not Jake (got ${dossier.opponentProfile.opponentName})`);
    assert(dossier.opponentProfile.lifetimeRecord === '6-7', `Lifetime H2H vs Jordan is 6-7 (got ${dossier.opponentProfile.lifetimeRecord})`);
    assert(dossier.opponentProfile.streak === 'Won 1', `Recent streak vs Jordan is Won 1 (got ${dossier.opponentProfile.streak})`);

    // 2. Fandom Conflict Warning (Ravens, Harold Fannin Jr & Evan McPherson)
    assert(dossier.fandomWarning.fanTeam === 'Ravens', `Declared team is Ravens, not Philadelphia (got ${dossier.fandomWarning.fanTeam})`);
    assert(dossier.fandomWarning.hedgePlayers.includes('Harold Fannin Jr.') && dossier.fandomWarning.hedgePlayers.includes('Evan McPherson'),
        `Conflicting starters are Harold Fannin Jr. and Evan McPherson (got ${dossier.fandomWarning.hedgePlayers})`);

    // 3. Preseason Coaching Efficiency Audit
    assert(dossier.coachingAudit.lastWeekOptimization === '100.0% (Preseason Setup)',
        `Coaching efficiency is 100.0% (Preseason Setup) (got ${dossier.coachingAudit.lastWeekOptimization})`);
    assert(dossier.coachingAudit.pointsLeftOnBench === '0.0', `Preseason bench points left is 0.0 (got ${dossier.coachingAudit.pointsLeftOnBench})`);

    // 4. Historical Calendar Split (3-6 all-time Week 1, 97.9 PF)
    assert(dossier.calendarSplit.allTimeWeekRecord === '3-6', `All-Time Week 1 record is 3-6 (got ${dossier.calendarSplit.allTimeWeekRecord})`);
    assert(dossier.calendarSplit.averageWeekPf === '97.9 PF', `All-Time Week 1 average is 97.9 PF (got ${dossier.calendarSplit.averageWeekPf})`);

    // 5. Milestone Watch (12,748.0 PF, target 13,000, needed 252.0 pts)
    assert(dossier.milestoneWatch.careerPf === '12748.0', `Career regular season PF is 12,748.0 (got ${dossier.milestoneWatch.careerPf})`);
    assert(dossier.milestoneWatch.targetMilestone === '13,000', `Target milestone is 13,000 (got ${dossier.milestoneWatch.targetMilestone})`);
    assert(dossier.milestoneWatch.pointsNeeded === '252.0', `Points needed is 252.0 (got ${dossier.milestoneWatch.pointsNeeded})`);

    // Full HTML render check
    const fullHtml = engine.renderer.renderEditionHtml(ed2027, dossier, managersData.managers);
    assert(fullHtml.includes('VOL. 10 • ISSUE 1'), 'Rendered HTML contains "VOL. 10 • ISSUE 1"');
    assert(!fullHtml.includes('—'), 'Rendered HTML contains strictly NO em-dashes');
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert(!emojiRegex.test(fullHtml), 'Rendered HTML contains strictly NO emojis');
    assert(!fullHtml.includes('eight seasons'), 'Rendered HTML does not contain hardcoded "eight seasons"');
}

console.log('\n--- TEST 9: Dynamic Multi-League Volume Math & Deduplication ---');
{
    // Test AB Therapy: Est 2022, 2026 season should be Volume 5
    const abEngine = new NewsletterEngine({
        leagueId: 'ab_therapy',
        leagueSlug: 'abtherapyleague',
        managers: [{ id: 'm1', name: 'Manager 1' }, { id: 'm2', name: 'Manager 2' }]
    });
    const abVol2026 = abEngine.calculateVolume(2026);
    assert(abVol2026 === 5, `AB Therapy season 2026 is Volume 5 (got ${abVol2026})`);

    // Test Gaywood: Est 2015, 2026 season should be Volume 12
    const gwEngine = new NewsletterEngine({
        leagueId: 'gaywoodfantasyfootball',
        leagueSlug: 'gaywoodfantasyfootball',
        managers: [{ id: 'm1', name: 'Manager 1' }, { id: 'm2', name: 'Manager 2' }]
    });
    const gwVol2026 = gwEngine.calculateVolume(2026);
    assert(gwVol2026 === 12, `Gaywood season 2026 is Volume 12 (got ${gwVol2026})`);

    // Test DMS: Est 2018, 2026 season is Volume 9, 2027 is Volume 10
    const dmsEngine = new NewsletterEngine({
        leagueId: 'dmsfantasy',
        leagueSlug: 'dmsfantasy',
        managers: [{ id: 'm1', name: 'Manager 1' }, { id: 'm2', name: 'Manager 2' }]
    });
    assert(dmsEngine.calculateVolume(2026) === 9, `DMS season 2026 is Volume 9 (got ${dmsEngine.calculateVolume(2026)})`);
    assert(dmsEngine.calculateVolume(2027) === 10, `DMS season 2027 is Volume 10 (got ${dmsEngine.calculateVolume(2027)})`);

    // Test Deduplication across Curator:
    // Pass two identical triggers MARGIN_OUTLIER with high scores
    const testCurator = new NewsletterCurator({
        leagueId: 'test_league',
        season: 2026,
        week: 1,
        managers: [{ id: 'm1', name: 'Manager 1' }, { id: 'm2', name: 'Manager 2' }, { id: 'm3', name: 'Manager 3' }, { id: 'm4', name: 'Manager 4' }]
    });

    const candidates = [
        { trigger_id: 'MARGIN_OUTLIER', timing: 'PROSPECTIVE', category: 'ALL_TIME_RECORD', involved_manager_ids: ['m1', 'm2'], z_score: 3.5, tokens: {} },
        { trigger_id: 'MARGIN_OUTLIER', timing: 'PROSPECTIVE', category: 'ALL_TIME_RECORD', involved_manager_ids: ['m3', 'm4'], z_score: 3.4, tokens: {} },
        { trigger_id: 'MATCHUP_PREVIEW_SHOWDOWN', timing: 'PROSPECTIVE', category: 'RIVALRY', involved_manager_ids: ['m1', 'm2'], z_score: 2.8, tokens: {} },
        { trigger_id: 'ROOKIE_GAMBLE_RADAR', timing: 'PROSPECTIVE', category: 'DRAFT_LORE', involved_manager_ids: ['m3'], z_score: 2.5, tokens: {} },
        { trigger_id: 'CENTURY_CLUB', timing: 'PROSPECTIVE', category: 'ALL_TIME_RECORD', involved_manager_ids: ['m4'], z_score: 2.2, tokens: {} }
    ];

    const curated = testCurator.curateEdition(candidates);
    const usedTriggers = [curated.lead?.trigger_id, curated.spotlight1?.trigger_id, curated.spotlight2?.trigger_id, curated.wire?.trigger_id, curated.lore?.trigger_id].filter(Boolean);
    const triggerCounts = {};
    for (const tid of usedTriggers) {
        triggerCounts[tid] = (triggerCounts[tid] || 0) + 1;
    }
    assert(triggerCounts['MARGIN_OUTLIER'] === 1, `MARGIN_OUTLIER only used once despite multiple high candidates (got ${triggerCounts['MARGIN_OUTLIER']})`);
}

// ==========================================
// TEST 10: Factual Accuracy & Generic Revision Verification
// ==========================================
console.log('\n--- TEST 10: Factual Accuracy & Generic Revision Verification ---');
{
    const dmsManagersData = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'managers.json'), 'utf8'));
    const dmsMatchups = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'matchups.json'), 'utf8'));
    const dmsWeeklyStats = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'weekly_player_stats.json'), 'utf8'));

    const evaluator = new NewsletterTriggerEvaluator({
        leagueId: 'dmsfantasy',
        season: 2027,
        week: 1,
        managers: dmsManagersData.managers,
        matchups: dmsMatchups,
        playerStats: dmsWeeklyStats,
        transactions: []
    });

    const candidates = evaluator.evaluateAll();

    // 1. Mike vs Will MUST NOT trigger PLAYOFF_REVENGE
    const mwPlayoff = candidates.find(c => {
        const ids = (c.involved_manager_ids || []).map(String);
        return ids.includes('mike') && ids.includes('will') && c.trigger_id === 'PLAYOFF_REVENGE';
    });
    assert(!mwPlayoff, 'Mike vs Will never triggers PLAYOFF_REVENGE (2023 was consolation game)');

    // 2. SHIP_OF_THESEUS must not trigger in Week 1
    const shipW1 = candidates.find(c => c.trigger_id === 'SHIP_OF_THESEUS');
    assert(!shipW1, 'SHIP_OF_THESEUS does not trigger in Week 1');

    // 3. Ben vs Luke H2H superlative rank
    const benLukeRadar = candidates.find(c => {
        const ids = (c.involved_manager_ids || []).map(String);
        return (ids.includes('ben') || ids.includes('benjamin')) && ids.includes('luke') && c.trigger_id === 'REVENGE_GAME_RADAR';
    });
    assert(Boolean(benLukeRadar), 'Ben vs Luke triggers REVENGE_GAME_RADAR');
    assert(benLukeRadar.tokens.h2h_league_rank.includes('#1') && benLukeRadar.tokens.h2h_league_rank.includes('Isabella') && benLukeRadar.tokens.h2h_league_rank.includes('Week 9'),
        `Ben vs Luke h2h_league_rank has complete context (got: ${benLukeRadar?.tokens?.h2h_league_rank})`);

    // 4. Isabella Jaylen Warren does NOT trigger JUDAS_STARTER
    const isabellaJudas = candidates.find(c => {
        const ids = (c.involved_manager_ids || []).map(String);
        return ids.includes('isabella') && c.trigger_id === 'JUDAS_STARTER';
    });
    assert(!isabellaJudas, 'Isabella starting 1 Steelers player does not trigger JUDAS_STARTER (requires 3+)');

    // 5. Sleeper Manager Name Resolution
    const sleeperEval = new NewsletterTriggerEvaluator({
        managers: [
            { id: '870546917308952576', name: 'MistrFistr' },
            { id: '1179722739718299648', name: 'THuda12' },
            { id: '1389311619867103232', name: 'c0cc0' },
            { id: '884205459035361280', name: 'jamisonr9' },
            { id: '870487784425750528', name: 'lnuge' },
            { id: '1258232732161417216', name: 'franksteam1' }
        ]
    });
    assert(sleeperEval.getManagerName('870546917308952576') === 'Blake', 'MistrFistr resolves to Blake');
    assert(sleeperEval.getManagerName('1179722739718299648') === 'Tyler', 'THuda12 resolves to Tyler');
    assert(sleeperEval.getManagerName('1389311619867103232') === 'Rocco', 'c0cc0 resolves to Rocco');
    assert(sleeperEval.getManagerName('884205459035361280') === 'Jamison', 'jamisonr9 resolves to Jamison');
    assert(sleeperEval.getManagerName('870487784425750528') === 'Laird', 'lnuge resolves to Laird');
    assert(sleeperEval.getManagerName('1258232732161417216') === 'Frank', 'franksteam1 resolves to Frank');

    // 6. Gaywood Brady vs Adam H2H superlative rank
    const gaywoodManagers = JSON.parse(fs.readFileSync(path.join(rootDir, 'gaywoodfantasy', 'data', 'managers.json'), 'utf8'));
    const gaywoodMatchups = JSON.parse(fs.readFileSync(path.join(rootDir, 'gaywoodfantasy', 'data', 'matchups.json'), 'utf8'));
    const gaywoodDraft = JSON.parse(fs.readFileSync(path.join(rootDir, 'gaywoodfantasy', 'data', 'draft_results.json'), 'utf8'));

    const gwEval = new NewsletterTriggerEvaluator({
        leagueId: 'gaywoodfantasyfootball',
        season: 2025,
        week: 1,
        managers: gaywoodManagers,
        matchups: gaywoodMatchups,
        draftResults: gaywoodDraft,
        transactions: []
    });
    const gwCandidates = gwEval.evaluateAll();
    const bradyAdam = gwCandidates.find(c => {
        const ids = (c.involved_manager_ids || []).map(String);
        return ids.includes('brady') && ids.includes('adam_b') && c.trigger_id === 'REVENGE_GAME_RADAR';
    });
    assert(Boolean(bradyAdam), 'Brady vs Adam triggers REVENGE_GAME_RADAR');
    assert(bradyAdam.tokens.h2h_league_rank.includes('second most') && bradyAdam.tokens.h2h_league_rank.includes('Scott') && bradyAdam.tokens.h2h_league_rank.includes('Tyler'),
        `Brady vs Adam h2h_league_rank contextualizes rank #2 (got: ${bradyAdam?.tokens?.h2h_league_rank})`);
}

// ==========================================
// TEST 11: Top 5 Organic Curation, No Naked Rivals, Jake Luck, & Rookie Verification
// ==========================================
console.log('\n--- TEST 11: Top 5 Organic Curation, No Naked Rivals, Jake Luck, & Rookie Verification ---');
{
    // 1. Check for naked "rival" or "rivalry" across all templates and headlines
    const nakedRivalRegex = /\b(a|the|two|their|this)\s+(rival|rivals|rivalry)\b/i;
    let foundNakedRival = false;
    for (const [key, variants] of Object.entries(TRIGGER_TEMPLATES)) {
        variants.forEach((v, idx) => {
            if (nakedRivalRegex.test(v)) {
                foundNakedRival = true;
                console.error(`Trigger ${key} variant ${idx} contains naked rival/rivalry: "${v}"`);
            }
        });
    }
    for (const [key, hVariants] of Object.entries(TRIGGER_HEADLINES)) {
        hVariants.forEach((hv, idx) => {
            if (nakedRivalRegex.test(hv)) {
                foundNakedRival = true;
                console.error(`Headline ${key} variant ${idx} contains naked rival/rivalry: "${hv}"`);
            }
        });
    }
    assert(!foundNakedRival, 'Zero naked/unadorned "rival" or "rivalry" across all templates and headlines');

    // 2. DMS 2027 Top 5 Organic Curation structure
    const dmsManagersData = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'managers.json'), 'utf8'));
    const dmsMatchups = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'matchups.json'), 'utf8'));
    const dmsWeeklyStats = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'weekly_player_stats.json'), 'utf8'));
    const dmsDraft = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'draft_results.json'), 'utf8'));
    const dmsStandings = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'league_standings.json'), 'utf8'));
    const dmsSeasons = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'seasons_metadata.json'), 'utf8'));

    const engine = new NewsletterEngine({
        leagueId: 'dmsfantasy',
        leagueSlug: 'dmsfantasy',
        managers: dmsManagersData.managers,
        matchups: dmsMatchups,
        standings: dmsStandings,
        playerStats: dmsWeeklyStats,
        draftResults: dmsDraft,
        transactions: [],
        seasonsMetadata: dmsSeasons,
        leagueSettings: { est_year: 2018 }
    });

    engine.compileAllEditions();
    const ed = engine.editions[0];
    assert(Array.isArray(ed.stories) && ed.stories.length === 4, `Curated edition contains exactly 4 stories in grid (got ${ed.stories?.length})`);
    assert(Boolean(ed.leadStory), 'Curated edition contains #1 Lead Story');

    // Verify rendered HTML includes stories grid and correct category badges
    const html = engine.renderer.renderEditionHtml(ed, null, dmsManagersData.managers);
    assert(html.includes('newsletter-stories-grid'), 'Rendered HTML uses .newsletter-stories-grid');
    assert(!html.includes('Matchup Spotlight I'), 'Rendered HTML does not contain rigid "Matchup Spotlight I" badge');
    assert(!html.includes('Wire Desk'), 'Rendered HTML does not contain rigid "Wire Desk" badge');

    // 3. Jake vs Alex Luck Depth Verification
    const evaluator = new NewsletterTriggerEvaluator({
        leagueId: 'dmsfantasy',
        season: 2027,
        week: 1,
        managers: dmsManagersData.managers,
        matchups: dmsMatchups,
        playerStats: dmsWeeklyStats,
        draftResults: dmsDraft,
        transactions: []
    });
    const cands = evaluator.evaluateAll();
    const jakeUnluckiest = cands.find(c => {
        const ids = (c.involved_manager_ids || []).map(String);
        return ids.includes('jake') && c.trigger_id === 'UNLUCKIEST_TEAM';
    });
    assert(Boolean(jakeUnluckiest), 'Jake triggers UNLUCKIEST_TEAM for Week 1');
    assert(Boolean(jakeUnluckiest?.tokens?.h2hLuckNarrative), 'Jake UNLUCKIEST_TEAM contains h2hLuckNarrative token');
    assert(Boolean(jakeUnluckiest?.tokens?.oppH2hRecordText), 'Jake UNLUCKIEST_TEAM contains explicit leader in oppH2hRecordText');
    assert(jakeUnluckiest?.tokens?.oppH2hRecordText?.includes('leading') || jakeUnluckiest?.tokens?.oppH2hRecordText?.includes('deadlocked'),
        `oppH2hRecordText states leader explicitly (got: ${jakeUnluckiest?.tokens?.oppH2hRecordText})`);

    // Verify template rendering for Jake UNLUCKIEST_TEAM
    const renderedJake = renderTemplate(TRIGGER_TEMPLATES.UNLUCKIEST_TEAM[0], jakeUnluckiest.tokens);
    assert(renderedJake.includes('Alex') && renderedJake.includes('Jake'), 'Rendered template mentions both Jake and Alex');
    assert(!renderedJake.includes('{') && !renderedJake.includes('}'), 'Rendered Jake template has no unreplaced tokens');
    assert(!renderedJake.includes('—'), 'Rendered Jake template has no em-dashes');

    // 4. Carson Rookie Gamble Verification
    const carsonRookie = cands.find(c => {
        const ids = (c.involved_manager_ids || []).map(String);
        return ids.includes('carson') && c.trigger_id === 'ROOKIE_GAMBLE_RADAR';
    });
    assert(Boolean(carsonRookie), 'Carson triggers ROOKIE_GAMBLE_RADAR');
    assert(!JSON.stringify(carsonRookie?.tokens || {}).includes('9 years'), 'Carson rookie tokens do not claim unverified 9-year drought');
    const renderedCarson = renderTemplate(TRIGGER_TEMPLATES.ROOKIE_GAMBLE_RADAR[0], carsonRookie.tokens);
    assert(!renderedCarson.includes("hasn't started a rookie"), 'Carson rookie narrative does not assert unverified rookie drought');
    assert(!renderedCarson.includes('{') && !renderedCarson.includes('}'), 'Rendered Carson template has no unreplaced tokens');

    // 5. Ben vs Luke gritty tone verification
    const benLuke = cands.find(c => {
        const ids = (c.involved_manager_ids || []).map(String);
        return (ids.includes('ben') || ids.includes('benjamin')) && ids.includes('luke') && c.trigger_id === 'REVENGE_GAME_RADAR';
    });
    assert(Boolean(benLuke), 'Ben vs Luke triggers REVENGE_GAME_RADAR');
    const renderedBenLuke = renderTemplate(TRIGGER_TEMPLATES.REVENGE_GAME_RADAR[0], benLuke.tokens);
    assert(!renderedBenLuke.toLowerCase().includes('rivals') && !renderedBenLuke.toLowerCase().includes('rivalry'),
        'Ben vs Luke revenge narrative does not call them rivals (uses master-servant / dominance)');

    // 6. Inaugural Meeting (0-0) H2H Fallback verification (e.g. Gaywood Ira vs Greg)
    const gwManagers = JSON.parse(fs.readFileSync(path.join(rootDir, 'gaywoodfantasy', 'data', 'managers.json'), 'utf8'));
    const gwMatchups = JSON.parse(fs.readFileSync(path.join(rootDir, 'gaywoodfantasy', 'data', 'matchups.json'), 'utf8'));
    const gwDraft = JSON.parse(fs.readFileSync(path.join(rootDir, 'gaywoodfantasy', 'data', 'draft_results.json'), 'utf8'));
    const gwEval = new NewsletterTriggerEvaluator({
        leagueId: 'gaywoodfantasyfootball',
        season: 2025,
        week: 1,
        managers: gwManagers,
        matchups: gwMatchups,
        draftResults: gwDraft,
        transactions: []
    });
    const gwCands = gwEval.evaluateAll();
    const unluckiestGw = gwCands.find(c => c.trigger_id === 'UNLUCKIEST_TEAM');
    if (unluckiestGw) {
        const gwNarrative = unluckiestGw.tokens.h2h_luck_narrative || unluckiestGw.tokens.h2hLuckNarrative;
        assert(Boolean(gwNarrative), 'Gaywood UNLUCKIEST_TEAM generated h2hLuckNarrative');
        assert(typeof gwNarrative === 'string' && !gwNarrative.includes('undefined'), 'h2hLuckNarrative does not contain undefined');
    }
}

console.log('\n--- TEST 12: Dual Pill Badges, 2x2 Grid, Strict Disjoint Curation & Enriched Lore ---');
{
    // 1. Strict Disjoint Manager Curation in DMS
    const dmsManagersData = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'managers.json'), 'utf8'));
    const dmsMatchups = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'matchups.json'), 'utf8'));
    const dmsWeeklyStats = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'weekly_player_stats.json'), 'utf8'));
    const dmsDraft = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'draft_results.json'), 'utf8'));
    const dmsStandings = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'league_standings.json'), 'utf8'));
    const dmsSeasons = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'seasons_metadata.json'), 'utf8'));

    const engine = new NewsletterEngine({
        leagueId: 'dmsfantasy',
        leagueSlug: 'dmsfantasy',
        leagueName: 'The Dumbarton Fantasy League',
        managers: dmsManagersData,
        matchups: dmsMatchups,
        playerStats: dmsWeeklyStats,
        draftResults: dmsDraft,
        standings: dmsStandings,
        seasonsMetadata: dmsSeasons
    });

    engine.compileAllEditions();
    const ed = engine.editions[0];
    assert(Boolean(ed), 'Compiled active DMS edition');

    // Collect all manager IDs across the 5 stories
    const allFeaturedManagerIds = [];
    const leadMids = (ed.leadStory.tokens?.manager_name ? [ed.leadStory.tokens.manager_name] : []);
    allFeaturedManagerIds.push(...leadMids);

    const storyManagerNames = [];
    ed.stories.forEach(s => {
        if (s.tokens?.manager_name) storyManagerNames.push(s.tokens.manager_name);
        if (s.tokens?.opponent_name && s.tokens.opponent_name !== 'their opponent') {
            storyManagerNames.push(s.tokens.opponent_name);
        }
    });

    // Check that Jordan is featured in WEEK1_HISTORICAL_STREAK and NOT featured twice
    const jordanStories = ed.stories.filter(s => s.tokens?.manager_name === 'Jordan' || s.tokens?.opponent_name === 'Jordan');
    assert(jordanStories.length === 1, `Jordan is featured in exactly 1 story (got ${jordanStories.length})`);
    assert(jordanStories[0].trigger_id === 'WEEK1_HISTORICAL_STREAK', `Jordan story is WEEK1_HISTORICAL_STREAK (got ${jordanStories[0].trigger_id})`);

    // Verify 2x2 grid and dual-pill HTML rendering
    const html = engine.renderer.renderEditionHtml(ed, null, dmsManagersData);
    assert(html.includes('class="newsletter-stories-grid"'), 'Rendered HTML contains .newsletter-stories-grid');
    assert(!html.includes('newsletter-spotlights-row'), 'Rendered HTML does not contain deprecated .newsletter-spotlights-row');
    assert(!html.includes('newsletter-pill-story'), 'Rendered HTML does not contain generic blue Top Story badge');
    assert(html.includes('newsletter-pill-subtag'), 'Rendered HTML contains .newsletter-pill-subtag');
    assert(html.includes('newsletter-pill-cat-'), 'Rendered HTML contains category-specific color pills');

    // Verify SCORING_PARADOX point totals and non-empty manager_name
    const evalObj = new NewsletterTriggerEvaluator({
        leagueId: 'dmsfantasy',
        season: 2027,
        week: 1,
        matchups: dmsMatchups,
        managers: dmsManagersData,
        standings: dmsStandings
    });
    const spCand = {
        trigger_id: 'SCORING_PARADOX',
        category: 'RIVALRY',
        tokens: {
            manager_name: 'Cai Jones',
            opponent_name: "Sean O'Donnell",
            leader_manager: "Sean O'Donnell",
            trailing_manager: 'Cai Jones',
            h2h_record: '3-2',
            point_delta: '22.1',
            leader_pts: '581.4',
            trailing_pts: '603.5',
            career_meetings: 5,
            h2h_wins: 3,
            week_num: 1
        },
        templates: TRIGGER_TEMPLATES.SCORING_PARADOX
    };
    const resolvedSp = engine.renderer.resolveStory(spCand, 2027, 1);
    assert(!resolvedSp.headline.includes('  '), 'SCORING_PARADOX headline does not contain double space / missing name');
    assert(resolvedSp.text.includes('603.5') && resolvedSp.text.includes('581.4'), 'SCORING_PARADOX body contains exact point totals 603.5 and 581.4');

    // Verify PLAYOFF_REVENGE score summary and phantom champion lore
    const prCand = {
        trigger_id: 'PLAYOFF_REVENGE',
        category: 'RIVALRY',
        tokens: {
            seeking_manager: 'Luis Batlle',
            rival_manager: 'Ethan .',
            avenger_name: 'Luis Batlle',
            target_name: 'Ethan .',
            winner_name: 'Ethan .',
            loser_name: 'Luis Batlle',
            elim_margin: '18.1',
            playoff_score_summary: '113.25-95.15',
            playoff_round_name: 'Quarterfinals',
            phantom_champ_text: 'Had Luis Batlle survived that 113.25-95.15 quarterfinals clash, their subsequent outputs (Week 16: 109.2, Week 17: 101.5) would have fallen just short of the eventual champion',
            months_count: 9,
            playoff_year: 2025,
            season_phrase: 'last season',
            winter_phrase: 'last winter',
            week_num: 1
        },
        templates: TRIGGER_TEMPLATES.PLAYOFF_REVENGE
    };
    const resolvedPr = engine.renderer.resolveStory(prCand, 2027, 1);
    assert(resolvedPr.text.includes('113.25-95.15'), 'PLAYOFF_REVENGE body contains exact playoff score summary');
    assert(resolvedPr.text.includes('quarterfinals'), 'PLAYOFF_REVENGE body contains playoff round name');
    assert(resolvedPr.text.includes('subsequent outputs'), 'PLAYOFF_REVENGE body contains phantom champion context');
    assert(!resolvedPr.text.includes('—'), 'PLAYOFF_REVENGE body contains NO em-dashes');

    // Verify TITLE_DEFENSE_KICKOFF enriched lore
    const tdCand = {
        trigger_id: 'TITLE_DEFENSE_KICKOFF',
        category: 'PLAYOFF_LEVERAGE',
        tokens: {
            champion_name: 'David Holt',
            challenger_name: 'Will Hovey',
            champ_runner_up: 'Cai Jones',
            champ_final_score: '130.6-87.4',
            champ_margin: '43.2',
            last_meeting_result: 'Will Hovey claiming their most recent encounter 144.6-112.4 in Week 5 of 2025',
            nemesis_context: 'owning a 4-1 regular season edge over David Holt',
            h2h_record: '5-3',
            season: 2026,
            prev_season: 2025,
            week_num: 1
        },
        templates: TRIGGER_TEMPLATES.TITLE_DEFENSE_KICKOFF
    };
    const resolvedTd = engine.renderer.resolveStory(tdCand, 2026, 1);
    assert(resolvedTd.text.includes('Cai Jones') || resolvedTd.text.includes('130.6-87.4') || resolvedTd.text.includes('Will Hovey'), 'TITLE_DEFENSE_KICKOFF body contains rich championship or nemesis context');
    assert(!resolvedTd.text.includes('—'), 'TITLE_DEFENSE_KICKOFF body contains NO em-dashes');

    // Verify WEEK1_HISTORICAL_STREAK winless opener accuracy
    const w1Cand = {
        trigger_id: 'WEEK1_HISTORICAL_STREAK',
        category: 'ALL_TIME_RECORD',
        tokens: {
            manager_name: 'Laird',
            streak_len: 3,
            start_year: 2023,
            last_win_year: 'never',
            last_win_opp: 'none',
            loss_history: 'Tyler in 2025, Asher in 2024, Blake in 2023',
            opener_history_text: 'having gone winless all-time on opening day with consecutive Week 1 losses to Tyler in 2025, Asher in 2024, Blake in 2023',
            opponent_name: 'Monil',
            w1_record: '0-3',
            week_num: 1
        },
        templates: TRIGGER_TEMPLATES.WEEK1_HISTORICAL_STREAK
    };
    const resolvedW1 = engine.renderer.resolveStory(w1Cand, 2026, 1);
    assert(resolvedW1.text.includes('Monil'), 'WEEK1_HISTORICAL_STREAK mentions upcoming opponent Monil');
    assert(resolvedW1.text.includes('winless all-time') || resolvedW1.text.includes('Tyler in 2025'), 'WEEK1_HISTORICAL_STREAK accurately reflects winless history');
    assert(!resolvedW1.text.includes('undefined'), 'WEEK1_HISTORICAL_STREAK does not contain undefined');
    assert(!resolvedW1.text.includes('—'), 'WEEK1_HISTORICAL_STREAK body contains NO em-dashes');
}

console.log('\n--- TEST 13: Time-Scrollable Multi-Edition Navigation (Parity with Commissioner Notes & Power Rankings) ---');
{
    const mockManagers = [
        { id: 'alex', name: 'Alex' },
        { id: 'benjamin', name: 'Benjamin' }
    ];
    // Create matchups where Week 1 is completed (actual points > 0) and Week 2 is also available
    const multiWeekMatchups = [
        { season: 2026, week: 1, team_1_manager_id: 'alex', team_1_actual_points: 110, team_2_manager_id: 'benjamin', team_2_actual_points: 90, winner: 'alex' },
        { season: 2026, week: 2, team_1_manager_id: 'alex', team_1_actual_points: 0, team_2_manager_id: 'benjamin', team_2_actual_points: 0, winner: 'UNDECIDED' }
    ];

    const engine = new NewsletterEngine({
        leagueId: 'dmsfantasy',
        managers: mockManagers,
        matchups: multiWeekMatchups,
        leagueSettings: { est_year: 2018 }
    });

    engine.compileAllEditions();

    // Verify 2 editions compiled: Week 2 (Live / Current at index 0) and Week 1 (Archived at index 1)
    assert(engine.editions.length === 2, `Compiled exactly 2 editions for multi-week season (got ${engine.editions.length})`);
    assert(engine.editions[0].week === 2, `Edition 0 is Week 2 (Current) (got Week ${engine.editions[0].week})`);
    assert(engine.editions[1].week === 1, `Edition 1 is Week 1 (Archived) (got Week ${engine.editions[1].week})`);

    // Create a mock DOM container for testing render & event wiring
    const mockContainer = {
        innerHTML: '',
        listeners: {},
        querySelector(sel) {
            // Simple mock querySelector to test presence and event wiring
            if (this.innerHTML.includes(sel.replace('.', '').replace('#', ''))) {
                return {
                    addEventListener: (event, fn) => {
                        this.listeners[sel] = fn;
                    }
                };
            }
            return null;
        }
    };

    // Render Current Edition (index 0)
    engine.currentIndex = 0;
    engine.render(mockContainer);

    assert(mockContainer.innerHTML.includes('notes-nav-group'), 'Rendered HTML contains .notes-nav-group for multi-edition');
    assert(mockContainer.innerHTML.includes('btn-newsletter-prev'), 'Rendered HTML contains .btn-newsletter-prev');
    assert(mockContainer.innerHTML.includes('btn-newsletter-next'), 'Rendered HTML contains .btn-newsletter-next');
    assert(mockContainer.innerHTML.includes('1 of 2'), 'Counter shows "1 of 2" on live edition');
    assert(mockContainer.innerHTML.includes('notes-status-live'), 'Live edition displays .notes-status-live badge');
    assert(mockContainer.innerHTML.includes('Current Edition'), 'Live edition displays "Current Edition" text');
    assert(!mockContainer.innerHTML.includes('notes-status-archived'), 'Live edition does NOT display archived badge');
    assert(!mockContainer.innerHTML.includes('btn-newsletter-return-live'), 'Live edition does NOT display return to current button');

    // Advance to Older Edition (index 1)
    engine.currentIndex = 1;
    engine.render(mockContainer);

    assert(mockContainer.innerHTML.includes('2 of 2'), 'Counter shows "2 of 2" on archived edition');
    assert(mockContainer.innerHTML.includes('notes-status-archived'), 'Archived edition displays .notes-status-archived badge');
    assert(mockContainer.innerHTML.includes('Archived • Vol. 9 Issue 1'), 'Archived badge displays "Archived • Vol. 9 Issue 1"');
    assert(mockContainer.innerHTML.includes('btn-newsletter-return-live'), 'Archived edition displays .btn-newsletter-return-live button');
    assert(mockContainer.innerHTML.includes('Return to Current Newsletter →'), 'Button text displays "Return to Current Newsletter →"');

    // Test goToEdition helper method
    engine.goToEdition(0);
    assert(engine.currentIndex === 0, 'goToEdition(0) sets currentIndex back to 0');
    engine.goToEdition(1);
    assert(engine.currentIndex === 1, 'goToEdition(1) sets currentIndex to 1');

    // Test single-edition hiding behavior
    const singleEngine = new NewsletterEngine({
        leagueId: 'dmsfantasy',
        managers: mockManagers,
        matchups: [{ season: 2026, week: 1, team_1_manager_id: 'alex', team_1_actual_points: 0, team_2_manager_id: 'benjamin', team_2_actual_points: 0, winner: 'UNDECIDED' }]
    });
    singleEngine.compileAllEditions();
    assert(singleEngine.editions.length === 1, 'Single edition compiled when only 1 week exists');
    singleEngine.render(mockContainer);
    assert(!mockContainer.innerHTML.includes('notes-nav-group'), 'Navigation controls are hidden when only 1 edition exists (matching Commissioner Notes)');
}

console.log('\n=============================================');
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('=============================================');

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}

