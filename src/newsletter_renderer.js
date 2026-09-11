/**
 * Deterministic Weekly Fantasy League Newsletter Engine
 * Deterministic HTML Component Renderer & Template Resolver
 * 
 * Rules:
 * - Strictly NO emojis.
 * - Strictly NO em-dashes; using ', as' instead.
 * - Salted Modulo Hash: Variant_Index = (Hash(LeagueID + Season + Week + TriggerID) + Sum(ManagerIDs)) % 10.
 */

import { TRIGGER_HEADLINES } from './newsletter_templates.js';

function stringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function sumManagerIds(managerIds = []) {
    let sum = 0;
    for (const mid of managerIds) {
        const s = String(mid || '').toLowerCase();
        for (let i = 0; i < s.length; i++) {
            sum += s.charCodeAt(i);
        }
    }
    return sum;
}

export function computeVariantIndex(leagueId, season, week, triggerId, managerIds = []) {
    const seedStr = `${leagueId}_${season}_${week}_${triggerId}`;
    const hash = stringHash(seedStr);
    const mSum = sumManagerIds(managerIds);
    return Math.abs(hash + mSum) % 10;
}

export function renderTemplate(templateStr, tokens = {}) {
    if (!templateStr) return '';
    return templateStr.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
        if (tokens[key] !== undefined && tokens[key] !== null) {
            return String(tokens[key]);
        }

        // Comprehensive alias resolution
        const aliases = {
            dominant_manager: tokens.dominant_manager || tokens.bully_name || tokens.manager_name || tokens.winner_name || tokens.manager_a,
            submissive_manager: tokens.submissive_manager || tokens.victim_name || tokens.opponent_name || tokens.loser_name || tokens.manager_b,
            bully_name: tokens.bully_name || tokens.dominant_manager || tokens.manager_name,
            victim_name: tokens.victim_name || tokens.submissive_manager || tokens.opponent_name,
            winner_name: tokens.winner_name || tokens.manager_name || tokens.avenger_name || tokens.champion_name,
            loser_name: tokens.loser_name || tokens.opponent_name || tokens.target_name || tokens.runner_up,
            avenger_name: tokens.avenger_name || tokens.manager_name || tokens.winner_name,
            target_name: tokens.target_name || tokens.opponent_name || tokens.loser_name,
            landlord_name: tokens.landlord_name || tokens.manager_name || tokens.winner_name,
            tenant_name: tokens.tenant_name || tokens.opponent_name || tokens.loser_name,
            manager_a: tokens.manager_a || tokens.manager_name,
            manager_b: tokens.manager_b || tokens.opponent_name,
            champion_name: tokens.champion_name || tokens.manager_name,
            runner_up: tokens.runner_up || tokens.opponent_name,
            manager_name: tokens.manager_name || tokens.winner_name || tokens.dominant_manager || tokens.avenger_name || tokens.champion_name || tokens.manager_a,
            opponent_name: tokens.opponent_name || tokens.loser_name || tokens.submissive_manager || tokens.target_name || tokens.runner_up || tokens.manager_b,
            durable_manager: tokens.durable_manager || tokens.manager_name,
            fragile_manager: tokens.fragile_manager || tokens.opponent_name,
            streamer_manager: tokens.streamer_manager || tokens.manager_name,
            hoarder_manager: tokens.hoarder_manager || tokens.opponent_name,
            week_num: tokens.week_num !== undefined ? tokens.week_num : '1',
            spread: tokens.spread || '0.9',
            position: tokens.position || tokens.pos || 'QB',
            record_category: tokens.record_category || 'Scoring',
            milestone_pts: tokens.milestone_pts || '16,000'
        };

        if (aliases[key] !== undefined && aliases[key] !== null) {
            return String(aliases[key]);
        }

        // Return empty string instead of raw curly braces
        return '';
    });
}

export function formatCategoryBadge(cat, triggerId) {
    if (triggerId) {
        const triggerMap = {
            MARGIN_OUTLIER: 'Blowout Outlier',
            BOGEY_OPPONENT: 'Bogey Rivalry',
            HISTORIC_DROUGHT: 'Drought Watch',
            TITLE_DEED: 'Master vs Apprentice',
            SCORING_PARADOX: 'Scoring Paradox',
            PLAYOFF_REVENGE: 'Playoff Revenge',
            TOILET_BOWL_REMATCH: 'Toilet Bowl Rematch',
            STAT_CORRECTION_TRAUMA: 'Stat Correction',
            WEEK1_HISTORICAL_STREAK: 'Opening Day Hex',
            CENTURY_CLUB: 'Milestone Watch',
            UNLUCKIEST_TEAM: 'The Glass Cannon',
            DYNASTY_ERA_TRACKER: 'Dynasty Ledger',
            TITLE_DEFENSE_KICKOFF: 'Title Defense',
            MATCHUP_PREVIEW_SHOWDOWN: 'Marquee Clash',
            REVENGE_GAME_RADAR: 'Grudge Match',
            CORNERSTONE_CLASH: 'Franchise Anchors',
            DRAFT_STACK_DEPENDENCY: 'Aerial Stack',
            STACK_DEPENDENCY: 'Aerial Stack',
            ROOKIE_GAMBLE_RADAR: 'Rookie Debut',
            LPI_PRESEASON_FAVORITE: 'Preseason #1',
            LPI_SACKO_HAZARD: 'Cellar Hazard',
            JUDAS_STARTER: 'Division Treason',
            DIRECT_OPPONENT_TREASON: 'Sunday Treason',
            PRESEASON_TREASON_ALERT: 'Division Treason',
            EMOTIONAL_HEDGE: 'Emotional Hedge',
            MASOCHIST_DEFENSE: 'Masochist D/ST',
            HOMER_TAX: 'Homer Tax',
            THURSDAY_TRAP: 'Thursday Night Trap',
            DAYLIGHT_SAVINGS_CLIFF: 'Calendar Split',
            MONDAY_NIGHT_MIRACLE: 'Monday Clutch',
            MONDAY_NIGHT_SWEAT: 'The Monday Hunt',
            LTI_TRADE_LEDGER: 'Franchise Trade War',
            TRADE_REMORSE_HOMECOMING: 'Homecoming Game',
            SHIP_OF_THESEUS: 'Roster Identity',
            DRAFT_CLASS_LEGACY: 'Draft Class Rivalry',
            POSITIONAL_GRAVEYARD: 'Roster Hex',
            HOARDER_VS_STREAMER: 'Streaming Strategy',
            IRON_HORSE_VS_GLASS_HOUSE: 'Injury Triage',
            BENCH_WARMER_HOF: 'Bench Malpractice',
            EMPTY_SUIT: 'Empty Suit',
            FAAB_SPLURGE_AUTOPSY: 'FAAB Autopsy',
            ZERO_DOLLAR_FAAB_HERO: '$0 FAAB Hero',
            FRAUD_ALERT: 'Fraud Alert',
            HIGHEST_SCORING_LOSER: 'Hard Luck Trophy',
            ZOMBIE_WIN: 'Zombie Win',
            PLAYOFF_LEVERAGE_INDEX: 'Playoff Leverage',
            CHAOS_AGENT: 'Spoiler Alert',
            POINTS_TIEBREAKER_ARMAGEDDON: 'Tiebreaker Math',
            TOILET_BOWL_WATCH: 'Toilet Bowl Watch'
        };
        if (triggerMap[triggerId]) return triggerMap[triggerId];
    }

    if (!cat) return 'Dispatch';
    const clean = String(cat).replace(/_/g, ' ').trim().toUpperCase();
    const map = {
        'PLAYOFF LEVERAGE': 'Title Stakes',
        'PLAYOFF_LEVERAGE': 'Title Stakes',
        'RIVALRY': 'Historic Grudge',
        'ALL TIME RECORD': 'Historical Record',
        'ALL_TIME_RECORD': 'Historical Record',
        'DRAFT LORE': 'Draft Heritage',
        'DRAFT_LORE': 'Draft Heritage',
        'FANDOM TREASON': 'Fandom Treason',
        'FANDOM_TREASON': 'Fandom Treason',
        'SITUATIONAL': 'Tactical Intel',
        'BAD BEAT': 'Bad Beat Alert',
        'BAD_BEAT': 'Bad Beat Alert',
        'TRANSACTION': 'The Wire Desk',
        'LTI & FAAB': 'Waiver Wire'
    };
    return map[cat] || map[clean] || clean.split(' ').map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}

export function getMainCategoryMeta(cat, triggerId) {
    const tid = String(triggerId || '').toUpperCase();
    const c = String(cat || '').toUpperCase().replace(/\s+/g, '_');

    // High-priority trigger mapping
    if (tid === 'UNLUCKIEST_TEAM' || tid === 'SCORING_PARADOX' || tid === 'STAT_CORRECTION_TRAUMA' || tid === 'HIGHEST_SCORING_LOSER' || tid === 'MEDIAN_REALITY_CHECK') {
        return { label: 'Schedule Karma', slug: 'karma', className: 'newsletter-pill-cat-karma' };
    }
    if (tid === 'WEEK1_HISTORICAL_STREAK' || tid === 'HISTORIC_DROUGHT' || tid === 'CENTURY_CLUB' || tid === 'MARGIN_OUTLIER' || tid === 'DYNASTY_ERA_TRACKER') {
        return { label: 'Historical Record', slug: 'record', className: 'newsletter-pill-cat-record' };
    }
    if (tid.includes('TREASON') || tid === 'JUDAS_STARTER' || tid === 'DIRECT_OPPONENT_TREASON' || tid === 'PRESEASON_TREASON_ALERT') {
        return { label: 'Fandom Treason', slug: 'treason', className: 'newsletter-pill-cat-treason' };
    }
    if (tid === 'TITLE_DEFENSE_KICKOFF' || tid === 'PLAYOFF_LEVERAGE_INDEX' || tid === 'CHAOS_AGENT' || tid === 'CLINCH_MATRIX' || tid === 'POINTS_TIEBREAKER_ARMAGEDDON' || tid === 'PLAYOFF_REVENGE') {
        return { label: 'Title Stakes', slug: 'playoff', className: 'newsletter-pill-cat-playoff' };
    }
    if (tid.includes('DRAFT') || tid.includes('ROOKIE') || tid === 'SHIP_OF_THESEUS' || tid === 'BUST_BENCHMARK') {
        return { label: 'Draft Heritage', slug: 'draft', className: 'newsletter-pill-cat-draft' };
    }
    if (tid.includes('TRADE') || tid.includes('FAAB') || tid === 'TRADE_REMORSE_HOMECOMING' || tid === 'PANIC_SELLER_ROSTER_BURN' || tid === 'ZERO_DOLLAR_FAAB_HERO') {
        return { label: 'Waiver & Wire', slug: 'wire', className: 'newsletter-pill-cat-wire' };
    }
    if (tid.includes('TRAP') || tid.includes('MONDAY') || tid.includes('EMOTIONAL') || tid.includes('MASOCHIST') || tid.includes('CALENDAR') || tid.includes('DAYLIGHT')) {
        return { label: 'Tactical Intel', slug: 'tactical', className: 'newsletter-pill-cat-tactical' };
    }
    if (tid === 'EMPTY_SUIT' || tid === 'BENCH_WARMER_HOF' || tid === 'FRAUD_ALERT') {
        return { label: 'Bad Beat', slug: 'badbeat', className: 'newsletter-pill-cat-badbeat' };
    }

    // Category fallbacks
    if (c.includes('RIVALRY') || c.includes('GRUDGE')) {
        return { label: 'Rivalry', slug: 'rivalry', className: 'newsletter-pill-cat-rivalry' };
    }
    if (c.includes('RECORD')) {
        return { label: 'Historical Record', slug: 'record', className: 'newsletter-pill-cat-record' };
    }
    if (c.includes('DRAFT')) {
        return { label: 'Draft Heritage', slug: 'draft', className: 'newsletter-pill-cat-draft' };
    }
    if (c.includes('TREASON')) {
        return { label: 'Fandom Treason', slug: 'treason', className: 'newsletter-pill-cat-treason' };
    }
    if (c.includes('PLAYOFF') || c.includes('LEVERAGE')) {
        return { label: 'Title Stakes', slug: 'playoff', className: 'newsletter-pill-cat-playoff' };
    }
    if (c.includes('BAD_BEAT')) {
        return { label: 'Bad Beat', slug: 'badbeat', className: 'newsletter-pill-cat-badbeat' };
    }
    if (c.includes('TRANSACTION') || c.includes('LTI') || c.includes('FAAB')) {
        return { label: 'Waiver & Wire', slug: 'wire', className: 'newsletter-pill-cat-wire' };
    }
    if (c.includes('SITUATIONAL') || c.includes('TACTICAL')) {
        return { label: 'Tactical Intel', slug: 'tactical', className: 'newsletter-pill-cat-tactical' };
    }

    return { label: 'League Intel', slug: 'intel', className: 'newsletter-pill-cat-tactical' };
}

export function normalizeStoryTokens(rawTokens = {}) {
    const tokens = { ...rawTokens };
    const m1 = tokens.manager_1 || tokens.manager || tokens.manager_name || tokens.seeking_manager || tokens.winner_manager || tokens.dominant_manager || tokens.avenger_name || tokens.landlord_name;
    const m2 = tokens.manager_2 || tokens.opponent || tokens.opponent_name || tokens.rival_manager || tokens.loser_manager || tokens.subordinate_manager || tokens.target_name || tokens.tenant_name || tokens.submissive_manager;

    if (m1) {
        if (!tokens.manager_name) tokens.manager_name = m1;
        if (!tokens.manager_1) tokens.manager_1 = m1;
        if (!tokens.seeking_manager) tokens.seeking_manager = m1;
        if (!tokens.avenger_name) tokens.avenger_name = m1;
        if (!tokens.dominant_manager) tokens.dominant_manager = m1;
        if (!tokens.landlord_name) tokens.landlord_name = m1;
    }
    if (m2) {
        if (!tokens.opponent_name) tokens.opponent_name = m2;
        if (!tokens.manager_2) tokens.manager_2 = m2;
        if (!tokens.rival_manager) tokens.rival_manager = m2;
        if (!tokens.target_name) tokens.target_name = m2;
        if (!tokens.subordinate_manager) tokens.subordinate_manager = m2;
        if (!tokens.tenant_name) tokens.tenant_name = m2;
        if (!tokens.submissive_manager) tokens.submissive_manager = m2;
    }
    if (tokens.winner_manager && !tokens.winner_name) tokens.winner_name = tokens.winner_manager;
    if (tokens.loser_manager && !tokens.loser_name) tokens.loser_name = tokens.loser_manager;
    if (tokens.winner_name && !tokens.winner_manager) tokens.winner_manager = tokens.winner_name;
    if (tokens.loser_name && !tokens.loser_manager) tokens.loser_manager = tokens.loser_name;
    if (tokens.record_category && !tokens.stat_category) tokens.stat_category = tokens.record_category;
    if (tokens.stat_category && !tokens.record_category) tokens.record_category = tokens.stat_category;
    return tokens;
}

export class NewsletterRenderer {
    constructor(options = {}) {
        this.leagueId = options.leagueId || 'league';
        this.newsletterTitle = options.newsletterTitle || 'The Weekly Gazette';
    }

    resolveStory(candidate, season, week) {
        if (!candidate) {
            return { text: '', headline: '', variantIndex: 0, triggerId: null, category: 'GENERAL' };
        }
        const vIdx = computeVariantIndex(this.leagueId, season, week, candidate.trigger_id, candidate.involved_manager_ids || []);
        const tokens = normalizeStoryTokens(candidate.tokens || {});
        
        let text = '';
        if (candidate.templates && Array.isArray(candidate.templates)) {
            const chosenTemplate = candidate.templates[vIdx] || candidate.templates[0] || '';
            text = renderTemplate(chosenTemplate, tokens);
        } else if (typeof candidate.text === 'string') {
            text = renderTemplate(candidate.text, tokens);
        }

        let headline = '';
        const hTemplates = candidate.headlineTemplates || (TRIGGER_HEADLINES && TRIGGER_HEADLINES[candidate.trigger_id]);
        if (hTemplates && Array.isArray(hTemplates)) {
            const chosenH = hTemplates[vIdx] || hTemplates[0] || '';
            headline = renderTemplate(chosenH, tokens);
        } else if (candidate.headline) {
            headline = renderTemplate(candidate.headline, tokens);
        }

        return {
            text,
            headline,
            variantIndex: vIdx,
            triggerId: candidate.trigger_id,
            trigger_id: candidate.trigger_id,
            category: candidate.category,
            categoryBadge: formatCategoryBadge(candidate.category, candidate.trigger_id),
            mainCategory: getMainCategoryMeta(candidate.category, candidate.trigger_id),
            score: candidate.score || 1.0,
            tokens
        };
    }

    renderEditionHtml(edition, targetDossier, allManagers = [], options = {}) {
        if (!edition) {
            return `
                <div class="newsletter-empty-state">
                    <h3>No Newsletter Editions Found</h3>
                    <p>Weekly intelligence dispatches will appear here following Tuesday stat corrections and waiver claims.</p>
                </div>
            `;
        }

        const leadStory = edition.leadStory || {};
        const rawStories = edition.stories && edition.stories.length > 0
            ? edition.stories
            : [edition.spotlight1, edition.spotlight2, edition.wire, edition.lore].filter(Boolean);
        const stories = rawStories.slice(0, 4);
        const dossier = targetDossier || edition.dossier || {};

        const title = options.newsletterTitle || edition.newsletterTitle || this.newsletterTitle || 'The Weekly Gazette';
        const volume = edition.volume || (edition.season - 2017);

        const leadTriggerId = leadStory.triggerId || leadStory.trigger_id;
        const leadCatMeta = leadStory.mainCategory || getMainCategoryMeta(leadStory.category, leadTriggerId);
        const leadSubtag = formatCategoryBadge(leadStory.category, leadTriggerId);

        return `
            <div class="newsletter-edition-container">
                <!-- Edition Masthead -->
                <header class="newsletter-masthead">
                    <div class="newsletter-masthead-meta">
                        <span class="newsletter-vol">VOL. ${volume} • ISSUE ${edition.week}</span>
                        <span class="newsletter-dispatch-time">Dispatched: ${edition.dispatchTimestampFormatted || 'Wednesday 06:00 UTC'}</span>
                    </div>
                    <h1 class="newsletter-masthead-title">${title}</h1>
                </header>

                <!-- Top News Grid -->
                <div class="newsletter-main-grid">
                    
                    <!-- Slot 1: Lead Headline -->
                    ${leadStory.text ? `
                        <article class="newsletter-card newsletter-lead-card">
                            <div class="newsletter-card-badge-row">
                                <span class="newsletter-pill newsletter-pill-lead">Lead Story</span>
                                <span class="newsletter-pill ${leadCatMeta.className}">${leadCatMeta.label}</span>
                                <span class="newsletter-pill newsletter-pill-subtag">${leadSubtag}</span>
                            </div>
                            <div class="newsletter-lead-content">
                                ${leadStory.headline ? `<h2 class="newsletter-card-headline newsletter-lead-headline">${leadStory.headline}</h2>` : ''}
                                <p class="newsletter-lead-copy">${leadStory.text}</p>
                            </div>
                        </article>
                    ` : ''}

                    <!-- Slots 2-5: The Remaining 4 of the Top 5 Stories (2x2 Grid) -->
                    <div class="newsletter-stories-grid">
                        ${stories.map((story) => {
                            if (!story || !story.text) return '';
                            const triggerId = story.triggerId || story.trigger_id;
                            const catMeta = story.mainCategory || getMainCategoryMeta(story.category, triggerId);
                            const subtag = formatCategoryBadge(story.category, triggerId);
                            return `
                                <article class="newsletter-card newsletter-story-card">
                                    <div class="newsletter-card-badge-row">
                                        <span class="newsletter-pill ${catMeta.className}">${catMeta.label}</span>
                                        <span class="newsletter-pill newsletter-pill-subtag">${subtag}</span>
                                    </div>
                                    ${story.headline ? `<h3 class="newsletter-card-headline">${story.headline}</h3>` : ''}
                                    <p class="newsletter-story-copy">${story.text}</p>
                                </article>
                            `;
                        }).join('')}
                    </div>

                    <!-- Slot 6: Authenticated / Selected My Dossier -->
                    <section class="newsletter-card newsletter-dossier-card">
                        <div class="newsletter-dossier-header">
                            <div>

                                <h2 class="newsletter-dossier-title">Dossier: ${dossier.managerName || 'Manager Intelligence'}</h2>
                            </div>
                            <div class="newsletter-dossier-manager-picker">
                                <label for="newsletter-dossier-select" class="dossier-picker-label">Inspect Manager:</label>
                                <select id="newsletter-dossier-select" class="dossier-picker-select">
                                    ${(Array.isArray(allManagers) ? allManagers : (allManagers?.managers || [])).map(m => {
                                        const mId = String(m.id || m.manager_id).toLowerCase();
                                        const mName = m.name || m.manager_name || mId;
                                        const isSelected = mId === String(dossier.managerId).toLowerCase();
                                        return `<option value="${mId}" ${isSelected ? 'selected' : ''}>${mName}</option>`;
                                    }).join('')}
                                </select>
                            </div>
                        </div>

                        <!-- 5 Dossier Intelligence Modules -->
                        <div class="dossier-modules-grid">
                            <!-- Module 1: Opponent Profile -->
                            <div class="dossier-module-box">
                                <div class="dossier-module-tag">1. OPPONENT PROFILE</div>
                                <div class="dossier-module-headline">vs. ${dossier.opponentProfile?.opponentName || 'Upcoming Opponent'}</div>
                                <ul class="dossier-bullets">
                                    <li>Lifetime Head-to-Head: <strong>${dossier.opponentProfile?.lifetimeRecord || '0-0'}</strong> (${dossier.opponentProfile?.streak || 'Streak: Even'})</li>
                                    <li>Career Scoring Margin: <strong>${dossier.opponentProfile?.marginPpg || '0.0 PPG'}</strong></li>
                                    <li>Scouting Note: ${dossier.opponentProfile?.trapNote || 'Standard matchup volatility projected.'}</li>
                                </ul>
                            </div>

                            <!-- Module 2: Fandom Conflict Warning -->
                            <div class="dossier-module-box">
                                <div class="dossier-module-tag">2. FANDOM CONFLICT WARNING</div>
                                <div class="dossier-module-headline">Declared Team: ${dossier.fandomWarning?.fanTeam || 'NFL'}</div>
                                <ul class="dossier-bullets">
                                    <li>Division Rivals: <strong>${dossier.fandomWarning?.divisionRivalsText || 'None active'}</strong></li>
                                    <li>Playing ${dossier.fandomWarning?.fanTeam || 'Your Team'} This Week: <strong>${dossier.fandomWarning?.opponentStartersText || 'None active'}</strong></li>
                                    <li>Historical Win Rate When Hedging: <strong>${dossier.fandomWarning?.hedgingWinRate || '50.0%'}</strong></li>
                                </ul>
                            </div>

                            <!-- Module 3: Coaching Efficiency Audit -->
                            <div class="dossier-module-box">
                                <div class="dossier-module-tag">3. COACHING EFFICIENCY AUDIT</div>
                                <div class="dossier-module-headline">Lineup Optimization</div>
                                <ul class="dossier-bullets">
                                    <li>Recent Efficiency Grade: <strong>${dossier.coachingAudit?.lastWeekOptimization || '85.0%'}</strong></li>
                                    <li>Points Stranded on Pine: <strong>${dossier.coachingAudit?.pointsLeftOnBench || '14.0'} pts</strong></li>
                                    <li>Season Rank: <strong>${dossier.coachingAudit?.rankText || 'Middle of pack'}</strong></li>
                                </ul>
                            </div>

                            <!-- Module 4: Historical Calendar Split -->
                            <div class="dossier-module-box">
                                <div class="dossier-module-tag">4. HISTORICAL CALENDAR SPLIT</div>
                                <div class="dossier-module-headline">Week ${dossier.week || 1} Trend</div>
                                <ul class="dossier-bullets">
                                    <li>All-Time Week ${dossier.week || 1} Record: <strong>${dossier.calendarSplit?.allTimeWeekRecord || '0-0'}</strong> (${dossier.calendarSplit?.streak || 'Streak: Even'})</li>
                                    <li>Average Week ${dossier.week || 1} Output: <strong>${dossier.calendarSplit?.averageWeekPf || '105.0 PF'}</strong></li>
                                </ul>
                            </div>

                            <!-- Module 5: Milestone Watch -->
                            <div class="dossier-module-box">
                                <div class="dossier-module-tag">5. ALL-TIME MILESTONE WATCH</div>
                                <div class="dossier-module-headline">Career Regular Season Scoring</div>
                                <ul class="dossier-bullets">
                                    <li>Current Regular Season Points: <strong>${dossier.milestoneWatch?.careerPf || '0.0'}</strong></li>
                                    <li>Approaching Milestone: <strong>${dossier.milestoneWatch?.targetMilestone || '10,000'} PF</strong></li>
                                    <li>Points Needed: <strong>${dossier.milestoneWatch?.pointsNeeded || '0.0'} pts</strong></li>
                                </ul>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        `;
    }
}
