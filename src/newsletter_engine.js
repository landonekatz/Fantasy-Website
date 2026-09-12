/**
 * Deterministic Weekly Fantasy League Newsletter Engine
 * Master Orchestrator
 * 
 * Rules:
 * - Strictly NO emojis (clean badges/typography).
 * - Strictly NO em-dashes; using ', as' instead.
 * - Wednesday Kickoff Exception: Dispatch_Time = min(Wednesday 06:00 UTC, T_kickoff - 3 hours).
 * - Older / Newer pagination matching Commissioner Notes.
 */

import { NewsletterTriggerEvaluator } from './newsletter_triggers.js';
import { NewsletterCurator } from './newsletter_curator.js';
import { NewsletterRenderer } from './newsletter_renderer.js';

export function resolveDispatchTimestamp(firstKickoffUtc) {
    if (!firstKickoffUtc) {
        // Standard default: Wednesday 06:00:00 UTC
        const now = new Date();
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 6, 0, 0));
        return d;
    }

    const kickoffDate = new Date(firstKickoffUtc);
    const standardWednesday = new Date(Date.UTC(kickoffDate.getUTCFullYear(), kickoffDate.getUTCMonth(), kickoffDate.getUTCDate(), 6, 0, 0));
    const threeHoursBefore = new Date(kickoffDate.getTime() - (3 * 60 * 60 * 1000));

    // If kickoff occurs on Wednesday and threeHoursBefore is earlier than 06:00 UTC
    if (threeHoursBefore < standardWednesday) {
        return threeHoursBefore;
    }
    return standardWednesday;
}

export function formatDispatchTimestamp(dateObj) {
    if (!dateObj) return 'Wednesday 06:00 UTC';
    const d = new Date(dateObj);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[d.getUTCMonth()];
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const mins = d.getUTCMinutes().toString().padStart(2, '0');
    return `${month} ${day}, ${year}, ${hours}:${mins} UTC`;
}

export class NewsletterEngine {
    constructor(options = {}) {
        this.leagueId = options.leagueId || 'league';
        this.leagueSlug = options.leagueSlug || this.leagueId;
        this.containerId = options.containerId || 'view-newsletter';
        this.app = options.app || null;
        this.leagueSettings = options.leagueSettings || this.app?.leagueSettings || null;
        this.newsletterTitle = options.newsletterTitle || this.leagueSettings?.newsletter_title || 'The Weekly Gazette';

        // Data references
        this.managers = options.managers || [];
        this.matchups = options.matchups || [];
        this.standings = options.standings || [];
        this.playerStats = options.playerStats || [];
        this.draftResults = options.draftResults || [];
        this.transactions = options.transactions || [];
        this.seasonsMetadata = options.seasonsMetadata || [];
        this.nflGames = options.nflGames || [];
        this.claims = options.claims || this.app?.claims || {};

        this.renderer = new NewsletterRenderer({ leagueId: this.leagueId, newsletterTitle: this.newsletterTitle });
        
        // Navigation state
        this.initialEditions = options.editions || [];
        this.editions = [];
        this.currentIndex = 0; // 0 = latest edition, 1+ = older editions
        this.selectedDossierManagerId = null;
        this.isLoaded = false;
    }

    updateData(options = {}) {
        if (options.app) this.app = options.app;
        if (options.leagueSettings) this.leagueSettings = options.leagueSettings;
        if (options.newsletterTitle) this.newsletterTitle = options.newsletterTitle;
        if (options.managers !== undefined) this.managers = options.managers || [];
        if (options.matchups !== undefined) this.matchups = options.matchups || [];
        if (options.standings !== undefined) this.standings = options.standings || [];
        if (options.playerStats !== undefined) this.playerStats = options.playerStats || [];
        if (options.draftResults !== undefined) this.draftResults = options.draftResults || [];
        if (options.transactions !== undefined) this.transactions = options.transactions || [];
        if (options.seasonsMetadata !== undefined) this.seasonsMetadata = options.seasonsMetadata || [];
        if (options.nflGames !== undefined) this.nflGames = options.nflGames || [];
        if (options.claims !== undefined) this.claims = options.claims;
        this.isLoaded = false;
    }

    setNewsletterTitle(newTitle) {
        this.newsletterTitle = newTitle || 'The Weekly Gazette';
        if (this.renderer) {
            this.renderer.newsletterTitle = this.newsletterTitle;
        }
        if (typeof document !== 'undefined' && this.containerId) {
            const container = document.getElementById(this.containerId);
            if (container) this.render(container);
        }
    }

    getLeagueEstYear() {
        if (this.leagueSettings?.est_year) return Number(this.leagueSettings.est_year);
        if (this.leagueSettings?.founded_year) return Number(this.leagueSettings.founded_year);
        if (this.leagueSettings?.firstYear) return Number(this.leagueSettings.firstYear);
        if (this.leagueSettings?.startYear) return Number(this.leagueSettings.startYear);
        if (this.app?.leagueSettings?.est_year) return Number(this.app.leagueSettings.est_year);
        if (this.app?.leagueSettings?.founded_year) return Number(this.app.leagueSettings.founded_year);
        if (this.app?.leagueSettings?.firstYear) return Number(this.app.leagueSettings.firstYear);
        if (this.app?.leagueSettings?.startYear) return Number(this.app.leagueSettings.startYear);

        const allYears = [];
        if (this.seasonsMetadata && this.seasonsMetadata.length > 0) {
            this.seasonsMetadata.forEach(s => {
                const yr = Number(s.season || s.year);
                if (yr > 1990 && yr < 2100) allYears.push(yr);
            });
        }
        if (this.draftResults && this.draftResults.length > 0) {
            this.draftResults.forEach(d => {
                const yr = Number(d.season || d.year);
                if (yr > 1990 && yr < 2100) allYears.push(yr);
            });
        }
        if (this.matchups && this.matchups.length > 0) {
            this.matchups.forEach(m => {
                const yr = Number(m.season || m.year);
                if (yr > 1990 && yr < 2100) allYears.push(yr);
            });
        }
        if (this.standings && this.standings.length > 0) {
            this.standings.forEach(s => {
                const yr = Number(s.season || s.year);
                if (yr > 1990 && yr < 2100) allYears.push(yr);
            });
        }
        if (allYears.length > 0) {
            return Math.min(...allYears);
        }

        const knownEst = {
            'dmsfantasy': 2018,
            'gaywoodfantasyfootball': 2015,
            'gaywoodfantasy': 2015,
            'abtherapyleague': 2022,
            'fbo': 2021,
            'lamarkablefantasy': 2022
        };
        const slug = String(this.leagueSlug || this.leagueId || '').toLowerCase();
        if (knownEst[slug]) return knownEst[slug];

        return 2018;
    }

    calculateVolume(season) {
        const estYear = this.getLeagueEstYear();
        const yr = Number(season) || new Date().getFullYear();
        return yr >= estYear ? (yr - estYear + 1) : 1;
    }

    setData(data = {}) {
        if (data.managers) this.managers = data.managers;
        if (data.matchups) this.matchups = data.matchups;
        if (data.standings) this.standings = data.standings;
        if (data.playerStats) this.playerStats = data.playerStats;
        if (data.draftResults) this.draftResults = data.draftResults;
        if (data.transactions) this.transactions = data.transactions;
        if (data.seasonsMetadata) this.seasonsMetadata = data.seasonsMetadata;
        if (data.nflGames) this.nflGames = data.nflGames;
        if (data.claims) this.claims = data.claims;
        if (data.leagueId) this.leagueId = data.leagueId;
        if (data.leagueSettings) {
            this.leagueSettings = data.leagueSettings;
            if (this.leagueSettings.newsletter_title) {
                this.newsletterTitle = this.leagueSettings.newsletter_title;
            }
        }
        if (data.newsletterTitle) this.newsletterTitle = data.newsletterTitle;
        if (data.editions) {
            this.initialEditions = data.editions;
            this.editions = [...data.editions];
            this.currentIndex = 0;
            this.isLoaded = true;
        }
        this.renderer = new NewsletterRenderer({ leagueId: this.leagueId, newsletterTitle: this.newsletterTitle });
    }

    getDefaultManagerId() {
        if (this.selectedDossierManagerId) return this.selectedDossierManagerId;

        // Check if user has claimed manager profile in session
        const session = typeof window !== 'undefined' && window.AuthEngine ? window.AuthEngine.getSession() : null;
        if (session) {
            const userClaim = session.claims?.[this.leagueSlug] || (this.app?.claims && Object.entries(this.app.claims).find(([k, v]) => v?.email && session.email && v.email.toLowerCase() === session.email.toLowerCase())?.[0]);
            if (userClaim) return String(userClaim).toLowerCase();
        }

        // Default to Landon if present in league, otherwise first manager
        const landon = this.managers.find(m => String(m.id || m.manager_id).toLowerCase() === 'landon');
        if (landon) return 'landon';

        const first = this.managers[0];
        return first ? String(first.id || first.manager_id).toLowerCase() : 'alex';
    }

    generateEdition(season, week) {
        const estYear = this.getLeagueEstYear();
        const volume = this.calculateVolume(season);
        const totalSeasons = Math.max(1, (Number(season) || 2026) - estYear + 1);
        const completedSeasons = Math.max(1, (Number(season) || 2026) - estYear);

        const evaluator = new NewsletterTriggerEvaluator({
            leagueId: this.leagueId,
            season,
            week,
            estYear,
            totalSeasons,
            completedSeasons,
            managers: this.managers,
            matchups: this.matchups,
            standings: this.standings,
            playerStats: this.playerStats,
            draftResults: this.draftResults,
            transactions: this.transactions,
            seasonsMetadata: this.seasonsMetadata,
            nflGames: this.nflGames,
            claims: this.claims,
            leagueSettings: this.leagueSettings
        });

        const candidates = evaluator.evaluateAll();

        const curator = new NewsletterCurator({
            leagueId: this.leagueId,
            season,
            week,
            managers: this.managers,
            claims: this.claims
        });

        const curated = curator.curateEdition(candidates);

        // Resolve copy templates for each publication slot
        const leadStory = curated.lead ? this.renderer.resolveStory(curated.lead, season, week) : { text: '' };
        const spotlight1 = curated.spotlight1 ? this.renderer.resolveStory(curated.spotlight1, season, week) : { text: '' };
        const spotlight2 = curated.spotlight2 ? this.renderer.resolveStory(curated.spotlight2, season, week) : { text: '' };
        const wire = curated.wire ? this.renderer.resolveStory(curated.wire, season, week) : { text: '' };
        const lore = curated.lore ? this.renderer.resolveStory(curated.lore, season, week) : { text: '' };

        // Dispatch timestamp with Wednesday Kickoff Exception
        const dispatchDate = resolveDispatchTimestamp(null);

        const rawStories = Array.isArray(curated.stories) && curated.stories.length > 0 
            ? curated.stories 
            : [curated.spotlight1, curated.spotlight2, curated.wire, curated.lore].filter(Boolean);
        const resolvedStories = rawStories.map(s => this.renderer.resolveStory(s, season, week));

        return {
            id: `edition_${this.leagueId}_${season}_wk${week}`,
            leagueId: this.leagueId,
            season,
            week,
            volume,
            newsletterTitle: this.newsletterTitle,
            dispatchTimestamp: dispatchDate.toISOString(),
            dispatchTimestampFormatted: formatDispatchTimestamp(dispatchDate),
            leadStory,
            stories: resolvedStories,
            spotlight1,
            spotlight2,
            wire,
            lore,
            curator
        };
    }

    compileAllEditions(options = {}) {
        this.editions = [];
        if (!this.matchups || this.matchups.length === 0) return;

        // 1. If explicit editions array was provided, use it directly
        if (Array.isArray(this.initialEditions) && this.initialEditions.length > 0) {
            this.editions = [...this.initialEditions];
            this.currentIndex = 0;
            this.isLoaded = true;
            return;
        }

        // 2. Discover available seasons and weeks from matchups
        const seasons = Array.from(new Set(this.matchups.map(m => Number(m.season || m.year)).filter(Boolean))).sort((a, b) => b - a);
        const targetSeason = options.season || (seasons.length > 0 ? seasons[0] : 2026);

        const seasonMatchups = this.matchups.filter(m => Number(m.season || m.year) === targetSeason);
        const weeksWithMatchups = Array.from(new Set(seasonMatchups.map(m => Number(m.week)).filter(Boolean))).sort((a, b) => a - b);

        // Find completed weeks (games played with scores > 0 and winner decided)
        const completedWeeks = weeksWithMatchups.filter(w => {
            const weekGames = seasonMatchups.filter(m => Number(m.week) === w);
            return weekGames.some(m => {
                const p1 = Number(m.home_score || m.team_1_actual_points || m.points1 || 0);
                const p2 = Number(m.away_score || m.team_2_actual_points || m.points2 || 0);
                return (p1 > 0 || p2 > 0) && m.winner !== 'UNDECIDED';
            });
        });

        // Determine current active week:
        // If some weeks are completed, current active week is the next unplayed week (e.g. max(completed) + 1),
        // or max completed week if season is finished.
        let activeWeek = 1;
        if (completedWeeks.length > 0) {
            const maxCompleted = Math.max(...completedWeeks);
            const nextWeek = maxCompleted + 1;
            activeWeek = weeksWithMatchups.includes(nextWeek) ? nextWeek : maxCompleted;
        } else if (weeksWithMatchups.length > 0) {
            activeWeek = Math.min(...weeksWithMatchups);
        }

        // Available weeks to publish are from activeWeek down to 1 (descending so index 0 = active/current)
        const publishWeeks = weeksWithMatchups.filter(w => w <= activeWeek).sort((a, b) => b - a);
        if (publishWeeks.length === 0) {
            publishWeeks.push(1);
        }

        for (const wk of publishWeeks) {
            try {
                const ed = this.generateEdition(targetSeason, wk);
                if (ed) {
                    this.editions.push(ed);
                }
            } catch (err) {
                console.warn(`[NewsletterEngine] Error compiling edition for season ${targetSeason} week ${wk}:`, err);
            }
        }

        this.currentIndex = 0;
        this.isLoaded = true;
    }

    setEditions(editions) {
        if (Array.isArray(editions)) {
            this.initialEditions = editions;
            this.editions = [...editions];
            this.currentIndex = 0;
            this.isLoaded = true;
            if (typeof document !== 'undefined' && this.containerId) {
                const container = document.getElementById(this.containerId);
                if (container) this.render(container);
            }
        }
    }

    goToEdition(index) {
        if (index >= 0 && index < this.editions.length) {
            this.currentIndex = index;
            if (typeof document !== 'undefined' && this.containerId) {
                const container = document.getElementById(this.containerId);
                if (container) this.render(container);
            }
        }
    }

    render(containerEl) {
        const container = containerEl || document.getElementById(this.containerId);
        if (!container) return;

        if (!this.isLoaded || this.editions.length === 0) {
            this.compileAllEditions();
        }

        if (this.editions.length === 0) {
            container.innerHTML = `
                <div class="newsletter-card" style="padding: 2.5rem; text-align: center;">
                    <h2>League Newsletters</h2>
                    <p style="color: var(--text-muted); font-style: italic; margin-top: 1rem;">
                        No weekly matchups available to generate intelligence dispatches.
                    </p>
                </div>
            `;
            return;
        }

        if (this.currentIndex < 0) this.currentIndex = 0;
        if (this.currentIndex >= this.editions.length) this.currentIndex = this.editions.length - 1;

        const currentEdition = this.editions[this.currentIndex];
        const totalEditions = this.editions.length;
        const isLive = this.currentIndex === 0;
        const targetManagerId = this.getDefaultManagerId();

        // Generate dynamic dossier for selected manager
        const curator = currentEdition.curator || new NewsletterCurator({
            leagueId: this.leagueId,
            season: currentEdition.season,
            week: currentEdition.week,
            managers: this.managers
        });

        const dossier = curator.generateDossier(targetManagerId, {
            managers: this.managers,
            matchups: this.matchups,
            playerStats: this.playerStats,
            draftResults: this.draftResults,
            standings: this.standings
        });

        const currentTitle = this.newsletterTitle || this.leagueSettings?.newsletter_title || this.app?.leagueSettings?.newsletter_title || 'The Weekly Gazette';
        const editionHtml = this.renderer.renderEditionHtml(currentEdition, dossier, this.managers, { newsletterTitle: currentTitle });

        // Show navigation bar only if there are multiple editions to paginate between (matching Commissioner Notes & Power Rankings)
        const navBarHtml = totalEditions > 1 ? `
            <div class="newsletter-nav-bar notes-card-header" style="margin-bottom: 1.5rem;">
                <div class="notes-title-group" style="display: flex; align-items: center; gap: 0.75rem;">
                    <div class="newsletter-nav-title-group">
                        <span class="newsletter-nav-kicker">Intelligence Archives</span>
                        <h2 class="newsletter-nav-title" style="margin: 0; font-size: 1.35rem;">${currentTitle}</h2>
                    </div>
                    ${!isLive ? `
                        <span class="notes-status-badge notes-status-archived">
                            Archived • Vol. ${currentEdition.volume} Issue ${currentEdition.week}
                        </span>
                    ` : `
                        <span class="notes-status-badge notes-status-live">
                            <span class="notes-status-dot"></span> Current Edition
                        </span>
                    `}
                </div>

                <div class="notes-controls-group">
                    <div class="notes-nav-group">
                        <button type="button" class="notes-nav-btn btn-newsletter-prev" ${this.currentIndex >= totalEditions - 1 ? 'disabled' : ''} title="View older edition">
                            ‹ Older
                        </button>
                        <span class="notes-nav-indicator">${this.currentIndex + 1} of ${totalEditions}</span>
                        <button type="button" class="notes-nav-btn btn-newsletter-next" ${this.currentIndex === 0 ? 'disabled' : ''} title="View newer edition">
                            Newer ›
                        </button>
                    </div>
                </div>
            </div>
        ` : '';

        const footerReturnHtml = (!isLive && totalEditions > 1) ? `
            <div class="notes-meta-footer newsletter-meta-footer" style="margin-top: 2rem;">
                <div class="notes-meta-text">
                    Viewing archived dispatch for <strong>Season ${currentEdition.season}, Week ${currentEdition.week}</strong>.
                </div>
                <button type="button" class="notes-return-live-btn btn btn-sm btn-newsletter-return-live" title="Return to current active edition">
                    Return to Current Newsletter →
                </button>
            </div>
        ` : '';

        container.innerHTML = `
            <div class="newsletter-page-wrapper">
                ${navBarHtml}

                <!-- Edition Content -->
                <div class="newsletter-content-viewport">
                    ${editionHtml}
                </div>

                ${footerReturnHtml}
            </div>
        `;

        this.bindEvents(container);
    }

    bindEvents(container) {
        const btnPrev = container.querySelector('.btn-newsletter-prev');
        const btnNext = container.querySelector('.btn-newsletter-next');
        const btnReturnLive = container.querySelector('.btn-newsletter-return-live');
        const dossierSelect = container.querySelector('#newsletter-dossier-select');

        if (btnPrev) {
            btnPrev.addEventListener('click', () => {
                if (this.currentIndex < this.editions.length - 1) {
                    this.currentIndex++;
                    this.render(container);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }

        if (btnNext) {
            btnNext.addEventListener('click', () => {
                if (this.currentIndex > 0) {
                    this.currentIndex--;
                    this.render(container);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        }

        if (btnReturnLive) {
            btnReturnLive.addEventListener('click', () => {
                this.currentIndex = 0;
                this.render(container);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        }

        if (dossierSelect) {
            dossierSelect.addEventListener('change', (e) => {
                this.selectedDossierManagerId = e.target.value;
                this.render(container);
            });
        }
    }
}
