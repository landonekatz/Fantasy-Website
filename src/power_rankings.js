/**
 * THE FANTASY VAULT & DMS LEAGUE
 * Modular Power Rankings Engine with Interactive Sorting & Accordion Blurbs
 */

import { database } from './firebase.js';
import { ref as dbRef, set, get, onValue } from 'firebase/database';

function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

export class PowerRankingsEngine {
    constructor({ leagueSlug = 'dmsfantasy', app = null, containerId = 'rankings', adminContainerId = 'admin-sec-power-rankings' } = {}) {
        this.leagueSlug = leagueSlug;
        this.app = app;
        this.containerId = containerId;
        this.adminContainerId = adminContainerId;

        this.data = {
            allowed_editors: [],
            current_ranking: null,
            archived_rankings: []
        };

        this.currentIndex = 0; // 0 = live ranking, 1+ = archived rankings
        this.initialized = false;
        this.allBlurbsOpen = null; // null = follow default (live=open, archive=closed)

        this.loadInitialFallback();
        this.init();
    }

    async init() {
        if (database) {
            const rankingsRef = dbRef(database, `leagues/${this.leagueSlug}/power_rankings`);
            onValue(rankingsRef, (snapshot) => {
                const val = snapshot.val();
                if (val && (val.current_ranking || (Array.isArray(val.archived_rankings) && val.archived_rankings.length > 0))) {
                    this.data = {
                        allowed_editors: val.allowed_editors || [],
                        current_ranking: this.normalizeEdition(val.current_ranking),
                        archived_rankings: Array.isArray(val.archived_rankings) ? val.archived_rankings.map(item => this.normalizeEdition(item)) : []
                    };
                    if (!this.data.current_ranking && this.data.archived_rankings.length > 0) {
                        this.data.current_ranking = this.data.archived_rankings[0];
                        this.data.archived_rankings = this.data.archived_rankings.slice(1);
                    }
                } else {
                    this.loadInitialFallback();
                    if (val && val.allowed_editors) {
                        this.data.allowed_editors = val.allowed_editors;
                    }
                }
                this.initialized = true;
                this.render();
                this.renderAdminSection();
            });
        } else {
            this.loadInitialFallback();
            this.initialized = true;
            this.render();
            this.renderAdminSection();
        }

        // Listen for session auth changes
        window.addEventListener('vault:auth:change', () => {
            this.render();
            this.renderAdminSection();
        });
    }

    canonicalizeManagerId(mgrId) {
        if (!mgrId) return mgrId;
        const managers = this.getManagersList();
        const cleanId = String(mgrId).toLowerCase().trim();
        const found = managers.find(m => {
            const mId = String(m.id || '').toLowerCase().trim();
            const mName = String(m.canonical_name || m.name || '').toLowerCase().trim();
            if (mId === cleanId || mName === cleanId) return true;
            if ((cleanId === 'ben' || cleanId === 'benjamin') && (mId === 'benjamin' || mId === 'ben' || mName === 'benjamin' || mName === 'ben')) return true;
            return false;
        });
        return found ? found.id : mgrId;
    }

    normalizeEdition(edition) {
        if (!edition) return null;
        const normalized = { ...edition };
        if (Array.isArray(normalized.rankings)) {
            normalized.rankings = normalized.rankings.map((r, idx) => {
                if (typeof r === 'string') {
                    return {
                        rank: idx + 1,
                        manager_id: this.canonicalizeManagerId(r),
                        prev_rank: null,
                        blurb: ''
                    };
                }
                return {
                    ...r,
                    rank: r.rank || (idx + 1),
                    manager_id: this.canonicalizeManagerId(r.manager_id),
                    prev_rank: r.prev_rank !== undefined && r.prev_rank !== null && r.prev_rank !== '' ? Number(r.prev_rank) : null,
                    blurb: r.blurb || ''
                };
            });
        }
        return normalized;
    }

    loadInitialFallback() {
        // Fallback from app.powerRankingsHistory or window.FANTASY_DATA if available
        const history = (this.app && Array.isArray(this.app.powerRankingsHistory) && this.app.powerRankingsHistory.length > 0)
            ? this.app.powerRankingsHistory
            : (window.FANTASY_DATA && Array.isArray(window.FANTASY_DATA.power_rankings_history) && window.FANTASY_DATA.power_rankings_history.length > 0)
                ? window.FANTASY_DATA.power_rankings_history
                : [];

        if (history.length > 0) {
            const sorted = [...history].sort((a, b) => (b.week || 0) - (a.week || 0));
            const latest = sorted[0];
            const archives = sorted.slice(1);

            this.data.current_ranking = this.normalizeEdition(this.formatRawHistoryItem(latest));
            this.data.archived_rankings = archives.map(item => this.normalizeEdition(this.formatRawHistoryItem(item)));
        }
    }

    formatRawHistoryItem(item) {
        if (!item) return null;
        if (item.rankings && Array.isArray(item.rankings) && typeof item.rankings[0] === 'object') {
            return item;
        }

        // Convert string-array rankings into structured items
        const rawList = Array.isArray(item.rankings) ? item.rankings : [];
        const structured = rawList.map((mgrId, idx) => ({
            rank: idx + 1,
            manager_id: this.canonicalizeManagerId(mgrId),
            prev_rank: null,
            blurb: ''
        }));

        return {
            id: item.id || `pr_week_${item.week || 0}`,
            week: item.week !== undefined ? item.week : 0,
            title: item.title || `Week ${item.week || 0} Power Rankings`,
            subtitle: item.subtitle || '',
            author_name: item.author_name || 'Commissioner',
            created_at: item.created_at || Date.now(),
            updated_at: item.updated_at || Date.now(),
            rankings: structured
        };
    }

    getManagersList() {
        if (this.app && Array.isArray(this.app.managers) && this.app.managers.length > 0) {
            return this.app.managers;
        }
        if (this.app && Array.isArray(this.app.members) && this.app.members.length > 0) {
            return this.app.members;
        }
        if (window.FANTASY_DATA && Array.isArray(window.FANTASY_DATA.members)) {
            return window.FANTASY_DATA.members;
        }
        return [];
    }

    getManagerDetails(mgrId) {
        const canonicalId = this.canonicalizeManagerId(mgrId);
        const managers = this.getManagersList();
        const found = managers.find(m => m.id === canonicalId || m.id === mgrId || m.name?.toLowerCase() === mgrId?.toLowerCase());
        
        let teamName = 'Team ' + (found?.canonical_name || found?.name || canonicalId || 'Member');
        if (this.app && typeof this.app.getCurrentTeamName === 'function') {
            teamName = this.app.getCurrentTeamName(canonicalId);
            if ((teamName === 'Unknown Team' || !teamName) && found && found.team_name) {
                teamName = found.team_name;
            }
        } else if (found && found.team_name) {
            teamName = found.team_name;
        }

        let displayName = found?.canonical_name || found?.name || canonicalId || 'Manager';
        if (displayName && (displayName.toLowerCase() === 'madoc' || displayName.toLowerCase() === 'maddox')) {
            displayName = 'Madoc';
        }
        if (this.app && typeof this.app.getManagerDisplayName === 'function') {
            displayName = this.app.getManagerDisplayName(canonicalId, displayName);
        }

        const logoUrl = found?.logo_url || found?.avatar || 'https://s.yimg.com/cv/apiv2/default/nfl/nfl_1.png';

        return {
            id: canonicalId,
            name: displayName,
            displayName,
            teamName,
            logoUrl
        };
    }

    canEdit() {
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        if (!session) return false;

        // 1. Founder access
        if (session.isFounder || session.email === 'landonekatz@gmail.com') return true;

        // 2. League Admin access
        const isLeagueAdmin = (session.role === 'admin' && (session.leagueId === this.leagueSlug || session.leagueSlug === this.leagueSlug)) ||
                              (Array.isArray(session.adminOf) && session.adminOf.includes(this.leagueSlug));
        if (isLeagueAdmin) return true;

        // 3. Check allowed editors list
        const allowed = Array.isArray(this.data.allowed_editors) ? this.data.allowed_editors : [];
        if (session.email && allowed.includes(session.email)) return true;

        const claimedMgrId = session.claims ? session.claims[this.leagueSlug] : null;
        if (claimedMgrId && allowed.includes(claimedMgrId)) return true;

        if (this.app && this.app.claims) {
            for (const [mgrId, claim] of Object.entries(this.app.claims)) {
                if (claim.userId === session.uid || claim.email === session.email) {
                    if (allowed.includes(mgrId)) return true;
                }
            }
        }

        return false;
    }

    getCurrentUserDisplayName() {
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        if (!session) return 'Commissioner';

        const managers = this.getManagersList();
        const claimedMgrId = session.claims ? session.claims[this.leagueSlug] : null;
        if (claimedMgrId) {
            const found = managers.find(m => m.id === claimedMgrId);
            if (found) return found.canonical_name || found.name || 'Commissioner';
        }

        if (this.app && this.app.claims) {
            for (const [mgrId, claim] of Object.entries(this.app.claims)) {
                if (claim.userId === session.uid || claim.email === session.email) {
                    const found = managers.find(m => m.id === mgrId);
                    if (found) return found.canonical_name || found.name || claim.name || 'Commissioner';
                }
            }
        }

        if (session.isFounder || session.email === 'landonekatz@gmail.com') return 'Landon Katz';
        if (session.name && !session.name.includes('@')) return session.name;
        if (session.email) {
            const prefix = session.email.split('@')[0];
            return prefix.charAt(0).toUpperCase() + prefix.slice(1);
        }
        return 'Commissioner';
    }

    getAllRankings() {
        const all = [];
        if (this.data.current_ranking) {
            all.push(this.data.current_ranking);
        }
        if (Array.isArray(this.data.archived_rankings)) {
            all.push(...this.data.archived_rankings);
        }
        return all;
    }

    render() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        if (!this.data.current_ranking) {
            this.loadInitialFallback();
        }

        const allRankings = this.getAllRankings();
        const total = allRankings.length;

        if (total === 0) {
            container.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h2 style="margin:0;">Power Rankings</h2>
                    ${this.canEdit() ? `
                        <button type="button" class="btn btn-sm btn-primary btn-rankings-new">
                            + Create Power Rankings
                        </button>
                    ` : ''}
                </div>
                <p style="color:var(--text-muted); font-style:italic; margin:1rem 0;">No power rankings have been published yet.</p>
            `;
            container.querySelector('.btn-rankings-new')?.addEventListener('click', () => this.openNewRankingsModal());
            return;
        }

        if (this.currentIndex >= total) this.currentIndex = 0;
        const activeRanking = allRankings[this.currentIndex];
        const isLive = this.currentIndex === 0;

        // Default blurb state: live = open by default, archive = closed by default
        const defaultOpen = isLive;
        const areAllOpen = this.allBlurbsOpen !== null ? this.allBlurbsOpen : defaultOpen;

        const createdStr = formatTimestamp(activeRanking.created_at);
        const updatedStr = formatTimestamp(activeRanking.updated_at);
        const authorName = activeRanking.author_name || 'Commissioner';
        const editorName = activeRanking.last_edited_by || authorName;
        const isEdited = activeRanking.updated_at && activeRanking.created_at && (activeRanking.updated_at - activeRanking.created_at > 60000);
        const hasEditAccess = this.canEdit();

        const rankingsList = Array.isArray(activeRanking.rankings) ? activeRanking.rankings : [];

        container.innerHTML = `
            <div class="power-rankings-card-header">
                <div class="rankings-title-group">
                    <h2 class="rankings-main-title">${activeRanking.title || 'Power Rankings'}</h2>
                    ${!isLive ? `
                        <span class="notes-status-badge notes-status-archived">
                            Archived • ${createdStr || 'Past Week'}
                        </span>
                    ` : ''}
                </div>

                <div class="rankings-controls-group">
                    <!-- Toggle All Blurbs Button -->
                    <button type="button" class="btn btn-sm btn-rankings-toggle-all" title="Toggle all blurbs open or closed">
                        ${areAllOpen ? 'Collapse All Blurbs' : 'Expand All Blurbs'}
                    </button>

                    <!-- Archive Navigation -->
                    ${total > 1 ? `
                        <div class="notes-nav-group">
                            <button type="button" class="notes-nav-btn btn-rankings-prev" ${this.currentIndex >= total - 1 ? 'disabled' : ''} title="View older rankings">
                                ‹ Older
                            </button>
                            <span class="notes-nav-indicator">${this.currentIndex + 1} of ${total}</span>
                            <button type="button" class="notes-nav-btn btn-rankings-next" ${this.currentIndex === 0 ? 'disabled' : ''} title="View newer rankings">
                                Newer ›
                            </button>
                        </div>
                    ` : ''}

                    <!-- Editor Action Buttons -->
                    ${hasEditAccess ? `
                        <div class="notes-editor-actions">
                            ${isLive ? `
                                <button type="button" class="btn btn-sm btn-rankings-edit" title="Edit these rankings in-place">
                                    Edit Rankings
                                </button>
                            ` : ''}
                            <button type="button" class="btn btn-sm btn-primary btn-rankings-new" title="Create new rankings (archives current)">
                                + New Rankings
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${activeRanking.subtitle ? `
                <div class="rankings-subtitle-bar">
                    ${activeRanking.subtitle}
                </div>
            ` : ''}

            <!-- Ranked Teams List -->
            <div class="rankings-list-wrapper">
                ${rankingsList.map((item, idx) => {
                    const rank = item.rank || (idx + 1);
                    const mgr = this.getManagerDetails(item.manager_id);
                    const prev = item.prev_rank;
                    
                    let trendBadge = '';
                    if (prev === null || prev === undefined) {
                        trendBadge = '<span class="trend-badge trend-flat">■ (--)</span>';
                    } else if (rank < prev) {
                        const diff = prev - rank;
                        trendBadge = `<span class="trend-badge trend-up">▲ +${diff}</span>`;
                    } else if (rank > prev) {
                        const diff = rank - prev;
                        trendBadge = `<span class="trend-badge trend-down">▼ -${diff}</span>`;
                    } else {
                        trendBadge = '<span class="trend-badge trend-flat">■ (--)</span>';
                    }

                    const hasBlurb = Boolean(item.blurb && item.blurb.trim());
                    let parsedBlurb = '';
                    if (hasBlurb) {
                        if (window.marked && !/<[a-z][\s\S]*>/i.test(item.blurb)) {
                            parsedBlurb = window.marked.parse(item.blurb);
                        } else {
                            parsedBlurb = item.blurb;
                        }
                    } else {
                        parsedBlurb = '<p style="color:var(--text-muted); font-style:italic;">No blurb provided for this team.</p>';
                    }

                    const isOpen = areAllOpen;

                    return `
                        <div class="ranking-item-card ${isOpen ? 'expanded' : ''}" data-rank="${rank}" data-manager="${item.manager_id}">
                            <div class="ranking-header-row" role="button" tabindex="0" title="Click to expand/collapse recap">
                                <div class="ranking-num-badge ${rank <= 3 ? 'rank-top3' : ''}">
                                    ${rank}
                                </div>
                                <img class="ranking-team-logo" src="${mgr.logoUrl}" alt="${mgr.teamName}" loading="lazy">
                                <div class="ranking-team-info">
                                    <span class="ranking-team-name">${mgr.teamName}</span>
                                    <span class="ranking-manager-name">${mgr.name}</span>
                                </div>
                                <div class="ranking-trend-slot">
                                    ${trendBadge}
                                </div>
                                <div class="ranking-accordion-indicator">
                                    <span class="ranking-chevron">${isOpen ? '▲' : '▼'}</span>
                                </div>
                            </div>

                            <div class="ranking-blurb-drawer" style="${isOpen ? 'display:block;' : 'display:none;'}">
                                <div class="ranking-blurb-content markdown-body">
                                    ${parsedBlurb}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Rankings Footer Metadata -->
            <div class="notes-meta-footer">
                <div class="notes-meta-text">
                    <span>Rankings compiled by <strong>${authorName}</strong> on ${createdStr || 'Recent'}</span>
                    ${isEdited ? `<span class="notes-meta-edited"> • Last edited by <strong>${editorName}</strong> on ${updatedStr}</span>` : ''}
                </div>
                ${!isLive ? `
                    <button type="button" class="rankings-return-live-btn btn btn-sm">
                        Return to Current Rankings →
                    </button>
                ` : ''}
            </div>
        `;

        this.attachViewEventListeners(container, total);
    }

    attachViewEventListeners(container, total) {
        // Toggle individual blurb accordions
        container.querySelectorAll('.ranking-header-row').forEach(row => {
            row.addEventListener('click', () => {
                const card = row.closest('.ranking-item-card');
                const drawer = card.querySelector('.ranking-blurb-drawer');
                const chevron = card.querySelector('.ranking-chevron');
                if (!drawer) return;

                const isCurrentlyOpen = drawer.style.display !== 'none';
                if (isCurrentlyOpen) {
                    drawer.style.display = 'none';
                    card.classList.remove('expanded');
                    if (chevron) chevron.textContent = '▼';
                } else {
                    drawer.style.display = 'block';
                    card.classList.add('expanded');
                    if (chevron) chevron.textContent = '▲';
                }
            });
        });

        // Toggle all blurbs
        container.querySelector('.btn-rankings-toggle-all')?.addEventListener('click', () => {
            const isCurrentlyAllOpen = container.querySelector('.btn-rankings-toggle-all').textContent.includes('Collapse');
            this.allBlurbsOpen = !isCurrentlyAllOpen;
            this.render();
        });

        // Archive Pagination
        container.querySelector('.btn-rankings-prev')?.addEventListener('click', () => {
            if (this.currentIndex < total - 1) {
                this.currentIndex++;
                this.allBlurbsOpen = null; // reset to archive default (closed)
                this.render();
            }
        });

        container.querySelector('.btn-rankings-next')?.addEventListener('click', () => {
            if (this.currentIndex > 0) {
                this.currentIndex--;
                this.allBlurbsOpen = null;
                this.render();
            }
        });

        container.querySelector('.rankings-return-live-btn')?.addEventListener('click', () => {
            this.currentIndex = 0;
            this.allBlurbsOpen = null;
            this.render();
        });

        // Edit / New modal triggers
        container.querySelector('.btn-rankings-edit')?.addEventListener('click', () => this.openEditModal());
        container.querySelector('.btn-rankings-new')?.addEventListener('click', () => this.openNewRankingsModal());
    }

    openEditModal() {
        if (!this.canEdit()) {
            alert('You do not have permission to edit power rankings.');
            return;
        }

        const activeRanking = this.data.current_ranking || {};
        this.renderRankingsEditorModal({
            isNew: false,
            initialData: activeRanking
        });
    }

    openNewRankingsModal() {
        if (!this.canEdit()) {
            alert('You do not have permission to create power rankings.');
            return;
        }

        // For a new ranking, prefill teams from current ranking order with previous rank set
        const currentRanking = this.data.current_ranking;
        const initialTeams = [];

        if (currentRanking && Array.isArray(currentRanking.rankings) && currentRanking.rankings.length > 0) {
            currentRanking.rankings.forEach((item, idx) => {
                initialTeams.push({
                    rank: idx + 1,
                    manager_id: item.manager_id,
                    prev_rank: item.rank || (idx + 1),
                    blurb: ''
                });
            });
        } else {
            const managers = this.getManagersList();
            managers.forEach((m, idx) => {
                initialTeams.push({
                    rank: idx + 1,
                    manager_id: m.id,
                    prev_rank: null,
                    blurb: ''
                });
            });
        }

        this.renderRankingsEditorModal({
            isNew: true,
            initialData: {
                title: '',
                subtitle: '',
                rankings: initialTeams
            }
        });
    }

    renderRankingsEditorModal({ isNew = false, initialData = {} }) {
        const authorName = this.getCurrentUserDisplayName();
        let modal = document.getElementById('rankings-editor-modal');
        if (!modal) {
            modal = document.createElement('dialog');
            modal.id = 'rankings-editor-modal';
            modal.className = 'notes-modal-dialog rankings-modal-dialog';
            document.body.appendChild(modal);
        }

        const currentYear = new Date().getFullYear();
        const defaultTitlePlaceholder = `e.g. Week 1 ${currentYear} Power Rankings`;

        // Ensure all managers exist in list and calculate automated prev_rank from previous edition
        const managers = this.getManagersList();
        const prevRanking = this.data?.current_ranking;
        let teamItems = [];

        if (isNew) {
            // New ranking edition: base order defaults to previous edition's order (or default managers list)
            let baseOrder = [];
            if (Array.isArray(initialData.rankings) && initialData.rankings.length > 0) {
                baseOrder = initialData.rankings;
            } else if (prevRanking && Array.isArray(prevRanking.rankings) && prevRanking.rankings.length > 0) {
                baseOrder = prevRanking.rankings;
            } else {
                baseOrder = managers;
            }

            teamItems = baseOrder.map((item, idx) => {
                const mgrId = item.manager_id || item.id;
                // Automatic trend lookup from the most recent power ranking
                let calculatedPrevRank = null;
                if (prevRanking && Array.isArray(prevRanking.rankings)) {
                    const foundPrev = prevRanking.rankings.find(r => r.manager_id === mgrId);
                    if (foundPrev && foundPrev.rank) {
                        calculatedPrevRank = Number(foundPrev.rank);
                    }
                }
                return {
                    rank: idx + 1,
                    manager_id: mgrId,
                    prev_rank: calculatedPrevRank,
                    blurb: ''
                };
            });
        } else {
            // Editing existing ranking edition: preserve recorded prev_rank
            const existing = Array.isArray(initialData.rankings) ? initialData.rankings : [];
            if (existing.length > 0) {
                teamItems = existing.map((item, idx) => ({
                    rank: item.rank || (idx + 1),
                    manager_id: item.manager_id,
                    prev_rank: item.prev_rank !== undefined && item.prev_rank !== null && item.prev_rank !== '' ? Number(item.prev_rank) : null,
                    blurb: item.blurb || ''
                }));
            } else {
                teamItems = managers.map((m, idx) => ({
                    rank: idx + 1,
                    manager_id: m.id,
                    prev_rank: null,
                    blurb: ''
                }));
            }
        }

        // Ensure any missing manager is included
        const existingIds = new Set(teamItems.map(t => t.manager_id));
        managers.forEach(m => {
            if (!existingIds.has(m.id)) {
                let calcPrev = null;
                if (prevRanking && Array.isArray(prevRanking.rankings)) {
                    const foundPrev = prevRanking.rankings.find(r => r.manager_id === m.id);
                    if (foundPrev && foundPrev.rank) calcPrev = Number(foundPrev.rank);
                }
                teamItems.push({
                    rank: teamItems.length + 1,
                    manager_id: m.id,
                    prev_rank: calcPrev,
                    blurb: ''
                });
            }
        });

        // Editor state
        const state = {
            isNew,
            step: 1, // 1: Order Teams, 2: Write Blurbs
            blurbViewMode: 'focus', // 'focus' | 'all'
            focusedIndex: 0,
            title: initialData.title || '',
            subtitle: initialData.subtitle || '',
            rankings: teamItems,
            authorName
        };

        const renderModalContent = () => {
            modal.innerHTML = `
                <div class="notes-modal-content rankings-editor-modal-content">
                    <div class="notes-modal-header">
                        <div>
                            <h3 class="notes-modal-title">${state.isNew ? 'Create New Power Rankings' : 'Edit Power Rankings'}</h3>
                            <p class="notes-modal-subtitle">
                                ${state.isNew ? 'Reorder teams, write blurbs, and publish live rankings.' : 'Update rankings order and blurbs in-place without creating an archive entry.'}
                            </p>
                        </div>
                        <button type="button" class="notes-modal-close" onclick="document.getElementById('rankings-editor-modal').close()">✕</button>
                    </div>

                    <!-- Two-Stage Stepper Header -->
                    <div class="rankings-stepper-bar">
                        <div class="stepper-step ${state.step === 1 ? 'active' : 'completed'}" data-nav-step="1" role="button" tabindex="0">
                            <span class="stepper-title">1. Order Teams</span>
                        </div>
                        <div class="stepper-connector"></div>
                        <div class="stepper-step ${state.step === 2 ? 'active' : ''}" data-nav-step="2" role="button" tabindex="0">
                            <span class="stepper-title">2. Write Blurbs</span>
                        </div>
                    </div>

                    <!-- STAGE 1: ORDER TEAMS -->
                    <div class="rankings-stage-wrapper" id="stage-1-view" style="${state.step === 1 ? 'display:flex;' : 'display:none;'}">
                        <!-- Headline & Subtitle Inputs -->
                        <div class="rankings-title-row">
                            <div style="flex:2;">
                                <label class="editor-field-label">Rankings Headline / Title:</label>
                                <input type="text" id="ranking-title-input" class="admin-input editor-title-input" value="${state.title}" placeholder="${defaultTitlePlaceholder}" required>
                            </div>
                            <div style="flex:1;">
                                <label class="editor-field-label">Subtitle / Memo (Optional):</label>
                                <input type="text" id="ranking-subtitle-input" class="admin-input editor-title-input" value="${state.subtitle}" placeholder="e.g. Preseason Tiers &amp; Outlook">
                            </div>
                        </div>

                        <!-- Stage 1 Automated Trend Notice -->
                        <div class="rankings-quick-toolbar">
                            <div class="quick-toolbar-label">
                                <strong>Automatic Trends:</strong> Movement is automatically calculated from the previous power ranking. Drag (☰) or click ▲ / ▼ to reorder teams.
                            </div>
                        </div>

                        <!-- Stage 1 Compact Reorder Cards List -->
                        <div class="rankings-sort-list" id="rankings-sort-list">
                            <!-- Populated dynamically -->
                        </div>

                        <div id="stage-1-feedback" class="admin-feedback-msg" style="display:none; margin-top:0.5rem;"></div>

                        <!-- Stage 1 Footer -->
                        <div class="notes-modal-footer">
                            <button type="button" class="btn-notes-cancel" onclick="document.getElementById('rankings-editor-modal').close()">Cancel</button>
                            <button type="button" id="btn-goto-stage-2" class="btn-notes-save" style="background:#0f172a; color:#fff;">
                                Next: Write Blurbs (12 Teams) →
                            </button>
                        </div>
                    </div>

                    <!-- STAGE 2: WRITE BLURBS -->
                    <div class="rankings-stage-wrapper" id="stage-2-view" style="${state.step === 2 ? 'display:flex;' : 'display:none;'}">
                        <!-- Mode Switcher Header -->
                        <div class="blurbs-view-header">
                            <div class="blurbs-view-title">
                                <strong>Team Blurbs:</strong> Choose a writing view mode below. Your blurbs save automatically as you write.
                            </div>
                            <div class="blurb-view-mode-toggle">
                                <button type="button" class="btn-view-mode ${state.blurbViewMode === 'focus' ? 'active' : ''}" data-mode="focus">
                                    Focus (One by One)
                                </button>
                                <button type="button" class="btn-view-mode ${state.blurbViewMode === 'all' ? 'active' : ''}" data-mode="all">
                                    Full List (All at Once)
                                </button>
                            </div>
                        </div>

                        <!-- Focus Mode Container (One by One) -->
                        <div id="blurbs-focus-container" class="blurbs-focus-layout" style="${state.blurbViewMode === 'focus' ? 'display:grid;' : 'display:none;'}">
                            <!-- Left Team Selector List -->
                            <div class="blurbs-team-nav-list" id="blurbs-team-nav-list">
                                <!-- Populated dynamically -->
                            </div>

                            <!-- Right WYSIWYG Workspace -->
                            <div class="blurbs-focus-workspace" id="blurbs-focus-workspace">
                                <!-- Populated dynamically -->
                            </div>
                        </div>

                        <!-- Full List Mode Container (All at Once) -->
                        <div id="blurbs-all-container" class="blurbs-all-layout" style="${state.blurbViewMode === 'all' ? 'display:flex;' : 'display:none;'}">
                            <!-- Populated dynamically -->
                        </div>

                        <div id="stage-2-feedback" class="admin-feedback-msg" style="display:none; margin-top:0.5rem;"></div>

                        <!-- Stage 2 Footer -->
                        <div class="notes-modal-footer">
                            <button type="button" id="btn-back-to-stage-1" class="btn-notes-cancel">
                                ← Back to Ordering
                            </button>

                            <div class="editor-attribution-pill" style="margin: 0 auto 0 10px;">
                                <span class="editor-attribution-dot"></span>
                                <strong>Publishing as: ${state.authorName}</strong>
                            </div>

                            <button type="button" id="btn-submit-publish-rankings" class="btn-notes-save">
                                ${state.isNew ? 'Publish Power Rankings' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            renderStage1Cards();
            renderStage2();
            attachModalEventListeners();
        };

        const renderStage1Cards = () => {
            const listEl = modal.querySelector('#rankings-sort-list');
            if (!listEl) return;

            listEl.innerHTML = state.rankings.map((item, idx) => {
                const rank = idx + 1;
                const mgr = this.getManagerDetails(item.manager_id);
                const prev = item.prev_rank;
                let trendBadge = '';
                if (prev === null || prev === undefined || prev === '') {
                    trendBadge = '<span class="trend-badge trend-flat">■ (--)</span>';
                } else {
                    const pNum = Number(prev);
                    if (isNaN(pNum)) {
                        trendBadge = '<span class="trend-badge trend-flat">■ (--)</span>';
                    } else if (rank < pNum) {
                        trendBadge = `<span class="trend-badge trend-up">▲ +${pNum - rank}</span>`;
                    } else if (rank > pNum) {
                        trendBadge = `<span class="trend-badge trend-down">▼ -${rank - pNum}</span>`;
                    } else {
                        trendBadge = '<span class="trend-badge trend-flat">■ (--)</span>';
                    }
                }

                return `
                    <div class="sort-team-card" draggable="true" data-index="${idx}" data-manager-id="${item.manager_id}">
                        <div class="sort-card-left">
                            <div class="sort-controls">
                                <button type="button" class="btn-sort-move btn-sort-up" title="Move Up" ${idx === 0 ? 'disabled' : ''}>▲</button>
                                <button type="button" class="btn-sort-move btn-sort-down" title="Move Down" ${idx === state.rankings.length - 1 ? 'disabled' : ''}>▼</button>
                                <span class="sort-drag-handle" title="Drag to reorder">☰</span>
                            </div>
                            <div class="sort-rank-badge ${rank <= 3 ? 'rank-top3' : ''}">#${rank}</div>
                            <img class="sort-team-logo" src="${mgr.logoUrl}" alt="${mgr.teamName}">
                            <div class="sort-team-info">
                                <span class="sort-team-name">${mgr.teamName}</span>
                                <span class="sort-manager-name">${mgr.name}</span>
                            </div>
                        </div>

                        <div class="sort-card-right">
                            <div class="sort-trend-preview">${trendBadge}</div>
                            <div class="sort-prev-badge-slot">
                                <span class="sort-prev-pill" title="Calculated from previous edition">Prev: ${prev !== null && prev !== undefined && prev !== '' ? '#' + prev : '--'}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            attachStage1DragAndSorting();
        };

        const attachStage1DragAndSorting = () => {
            const listEl = modal.querySelector('#rankings-sort-list');
            if (!listEl) return;

            // HTML5 Drag and drop
            let draggedIndex = null;
            listEl.querySelectorAll('.sort-team-card').forEach((card) => {
                card.addEventListener('dragstart', (e) => {
                    draggedIndex = parseInt(card.getAttribute('data-index'), 10);
                    card.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(draggedIndex));
                });

                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                    listEl.querySelectorAll('.sort-team-card').forEach(c => c.classList.remove('drag-over'));
                    draggedIndex = null;
                });

                card.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    card.classList.add('drag-over');
                });

                card.addEventListener('dragleave', () => {
                    card.classList.remove('drag-over');
                });

                card.addEventListener('drop', (e) => {
                    e.preventDefault();
                    card.classList.remove('drag-over');
                    const targetIndex = parseInt(card.getAttribute('data-index'), 10);
                    if (draggedIndex !== null && draggedIndex !== targetIndex) {
                        const movedItem = state.rankings.splice(draggedIndex, 1)[0];
                        state.rankings.splice(targetIndex, 0, movedItem);
                        state.rankings.forEach((r, idx) => { r.rank = idx + 1; });
                        renderStage1Cards();
                    }
                });
            });
        };

        const renderStage2 = () => {
            if (state.blurbViewMode === 'focus') {
                renderStage2FocusMode();
            } else {
                renderStage2AllMode();
            }
        };

        const renderStage2FocusMode = () => {
            const navList = modal.querySelector('#blurbs-team-nav-list');
            const workspace = modal.querySelector('#blurbs-focus-workspace');
            if (!navList || !workspace) return;

            // Render left team nav list
            navList.innerHTML = state.rankings.map((item, idx) => {
                const rank = idx + 1;
                const mgr = this.getManagerDetails(item.manager_id);
                const hasBlurb = Boolean(item.blurb && item.blurb.trim() && item.blurb !== '<p></p>' && item.blurb !== '<p><br></p>');
                return `
                    <button type="button" class="blurb-team-nav-item ${idx === state.focusedIndex ? 'active' : ''}" data-index="${idx}">
                        <div class="nav-item-rank ${rank <= 3 ? 'rank-top3' : ''}">#${rank}</div>
                        <img class="nav-item-logo" src="${mgr.logoUrl}" alt="${mgr.teamName}">
                        <div class="nav-item-info">
                            <span class="nav-item-team">${mgr.teamName}</span>
                            <span class="nav-item-mgr">${mgr.name}</span>
                        </div>
                        <span class="nav-item-status ${hasBlurb ? 'written' : 'empty'}">
                            ${hasBlurb ? '✓' : '•'}
                        </span>
                    </button>
                `;
            }).join('');

            // Render active team WYSIWYG workspace
            const activeItem = state.rankings[state.focusedIndex] || state.rankings[0];
            const activeRank = state.focusedIndex + 1;
            const activeMgr = this.getManagerDetails(activeItem.manager_id);
            const prev = activeItem.prev_rank;
            let trendBadge = '';
            if (prev === null || prev === undefined || prev === '') {
                trendBadge = '<span class="trend-badge trend-flat">■ (--)</span>';
            } else {
                const pNum = Number(prev);
                if (isNaN(pNum)) {
                    trendBadge = '<span class="trend-badge trend-flat">■ (--)</span>';
                } else if (activeRank < pNum) {
                    trendBadge = `<span class="trend-badge trend-up">▲ +${pNum - activeRank}</span>`;
                } else if (activeRank > pNum) {
                    trendBadge = `<span class="trend-badge trend-down">▼ -${activeRank - pNum}</span>`;
                } else {
                    trendBadge = '<span class="trend-badge trend-flat">■ (--)</span>';
                }
            }

            workspace.innerHTML = `
                <div class="focus-team-banner">
                    <div class="focus-banner-left">
                        <div class="focus-rank-pill ${activeRank <= 3 ? 'rank-top3' : ''}">Rank #${activeRank}</div>
                        <img class="focus-team-logo" src="${activeMgr.logoUrl}" alt="${activeMgr.teamName}">
                        <div>
                            <h4 class="focus-team-title">${activeMgr.teamName}</h4>
                            <span class="focus-mgr-subtitle">Manager: ${activeMgr.name}</span>
                        </div>
                    </div>
                    <div class="focus-banner-right">
                        ${trendBadge}
                        <span class="focus-prev-text">Prev: ${prev !== null && prev !== undefined && prev !== '' ? '#' + prev : '--'}</span>
                    </div>
                </div>

                <!-- Focused WYSIWYG Editor Container -->
                <div class="editor-container" style="flex:1; margin-bottom: 0; display:flex; flex-direction:column;">
                    <div class="editor-toolbar">
                        <button type="button" class="editor-tool-btn" data-command="bold" title="Bold (Ctrl+B)"><b>B</b></button>
                        <button type="button" class="editor-tool-btn" data-command="italic" title="Italic (Ctrl+I)"><i>I</i></button>
                        <button type="button" class="editor-tool-btn" data-command="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                        <button type="button" class="editor-tool-btn" data-command="strikeThrough" title="Strikethrough"><s>S</s></button>
                        <span class="editor-tool-sep"></span>
                        <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="h2" title="Heading 2">H2</button>
                        <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="h3" title="Heading 3">H3</button>
                        <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="p" title="Paragraph / Normal Text">P</button>
                        <span class="editor-tool-sep"></span>
                        <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="blockquote" title="Blockquote">”</button>
                        <button type="button" class="editor-tool-btn" data-command="insertUnorderedList" title="Bullet List">• List</button>
                        <button type="button" class="editor-tool-btn" data-command="insertOrderedList" title="Numbered List">1. List</button>
                        <span class="editor-tool-sep"></span>
                        <button type="button" class="editor-tool-btn" data-command="createLink" title="Insert Link">Link</button>
                        <button type="button" class="editor-tool-btn" data-command="insertHorizontalRule" title="Horizontal Divider">Divider</button>
                        <button type="button" class="editor-tool-btn" data-command="removeFormat" title="Clear Formatting">Clear</button>
                    </div>
                    <div contenteditable="true" id="focus-blurb-wysiwyg-editor" class="notes-wysiwyg-editor" data-placeholder="Write recap, positives/negatives, and analysis for ${activeMgr.name}..." style="min-height: 220px; max-height: 340px; flex:1;"></div>
                    <div class="editor-status-bar">
                        <span class="editor-word-count">0 words • 0 characters</span>
                        <span class="editor-hint">Auto-saves as you write and navigate</span>
                    </div>
                </div>

                <!-- Step-Through Navigation -->
                <div class="focus-nav-bar">
                    <button type="button" id="btn-focus-prev-team" class="btn btn-sm" ${state.focusedIndex === 0 ? 'disabled' : ''}>
                        ← Previous Team
                    </button>
                    <span class="focus-step-indicator">${state.focusedIndex + 1} of 12</span>
                    <button type="button" id="btn-focus-next-team" class="btn btn-sm btn-primary" ${state.focusedIndex === 11 ? 'disabled' : ''}>
                        Next Team →
                    </button>
                </div>
            `;

            // Initialize WYSIWYG editor for focused team
            const editorEl = workspace.querySelector('#focus-blurb-wysiwyg-editor');
            const countEl = workspace.querySelector('.editor-word-count');
            if (editorEl) {
                let initialHtml = activeItem.blurb || '';
                if (initialHtml && !/<[a-z][\s\S]*>/i.test(initialHtml) && window.marked) {
                    initialHtml = window.marked.parse(initialHtml);
                }
                editorEl.innerHTML = initialHtml;

                const syncActiveStats = () => {
                    const text = editorEl.innerText || '';
                    const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
                    const chars = text.length;
                    if (countEl) countEl.textContent = `${words} word${words !== 1 ? 's' : ''} • ${chars} char${chars !== 1 ? 's' : ''}`;
                    state.rankings[state.focusedIndex].blurb = editorEl.innerHTML;
                    
                    // Update status dot in sidebar
                    const navBtn = navList.querySelector(`.blurb-team-nav-item[data-index="${state.focusedIndex}"] .nav-item-status`);
                    if (navBtn) {
                        const hasB = Boolean(text.trim());
                        navBtn.className = `nav-item-status ${hasB ? 'written' : 'empty'}`;
                        navBtn.textContent = hasB ? '✓' : '•';
                    }
                };

                editorEl.addEventListener('input', syncActiveStats);
                editorEl.addEventListener('blur', syncActiveStats);
                syncActiveStats();

                // Wire toolbar commands
                workspace.querySelectorAll('.editor-tool-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        editorEl.focus();
                        const cmd = btn.getAttribute('data-command');
                        const val = btn.getAttribute('data-value');
                        if (cmd === 'createLink') {
                            const url = prompt('Enter link URL (e.g. https://...):', 'https://');
                            if (url) document.execCommand('createLink', false, url);
                        } else if (cmd === 'formatBlock') {
                            document.execCommand('formatBlock', false, `<${val}>`);
                        } else if (cmd) {
                            document.execCommand(cmd, false, val || null);
                        }
                        syncActiveStats();
                    });
                });
            }

            // Wire focus navigation buttons
            workspace.querySelector('#btn-focus-prev-team')?.addEventListener('click', () => {
                if (state.focusedIndex > 0) {
                    state.focusedIndex--;
                    renderStage2FocusMode();
                }
            });

            workspace.querySelector('#btn-focus-next-team')?.addEventListener('click', () => {
                if (state.focusedIndex < state.rankings.length - 1) {
                    state.focusedIndex++;
                    renderStage2FocusMode();
                }
            });

            // Wire sidebar team item click
            navList.querySelectorAll('.blurb-team-nav-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    const idx = parseInt(btn.getAttribute('data-index'), 10);
                    if (!isNaN(idx)) {
                        state.focusedIndex = idx;
                        renderStage2FocusMode();
                    }
                });
            });
        };

        const renderStage2AllMode = () => {
            const allContainer = modal.querySelector('#blurbs-all-container');
            if (!allContainer) return;

            allContainer.innerHTML = state.rankings.map((item, idx) => {
                const rank = idx + 1;
                const mgr = this.getManagerDetails(item.manager_id);
                return `
                    <div class="blurb-all-card" data-index="${idx}">
                        <div class="blurb-all-card-header">
                            <div class="blurb-all-rank ${rank <= 3 ? 'rank-top3' : ''}">#${rank}</div>
                            <img class="blurb-all-logo" src="${mgr.logoUrl}" alt="${mgr.teamName}">
                            <div class="blurb-all-team-info">
                                <span class="blurb-all-team-name">${mgr.teamName}</span>
                                <span class="blurb-all-mgr-name">${mgr.name}</span>
                            </div>
                        </div>
                        <div class="editor-container" style="margin-bottom:0;">
                            <div class="editor-toolbar">
                                <button type="button" class="editor-tool-btn" data-command="bold" title="Bold"><b>B</b></button>
                                <button type="button" class="editor-tool-btn" data-command="italic" title="Italic"><i>I</i></button>
                                <button type="button" class="editor-tool-btn" data-command="underline" title="Underline"><u>U</u></button>
                                <button type="button" class="editor-tool-btn" data-command="strikeThrough" title="Strikethrough"><s>S</s></button>
                                <span class="editor-tool-sep"></span>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="h2" title="Heading 2">H2</button>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="h3" title="Heading 3">H3</button>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="p" title="Paragraph">P</button>
                                <span class="editor-tool-sep"></span>
                                <button type="button" class="editor-tool-btn" data-command="formatBlock" data-value="blockquote" title="Quote">”</button>
                                <button type="button" class="editor-tool-btn" data-command="insertUnorderedList" title="Bullet List">• List</button>
                                <button type="button" class="editor-tool-btn" data-command="insertOrderedList" title="Numbered List">1. List</button>
                                <span class="editor-tool-sep"></span>
                                <button type="button" class="editor-tool-btn" data-command="createLink" title="Link">Link</button>
                                <button type="button" class="editor-tool-btn" data-command="insertHorizontalRule" title="Divider">Divider</button>
                                <button type="button" class="editor-tool-btn" data-command="removeFormat" title="Clear">Clear</button>
                            </div>
                            <div contenteditable="true" class="notes-wysiwyg-editor all-mode-wysiwyg" data-index="${idx}" data-placeholder="Write recap and analysis for ${mgr.name}..." style="min-height: 120px; max-height: 220px;"></div>
                            <div class="editor-status-bar">
                                <span class="editor-word-count">0 words • 0 characters</span>
                                <span class="editor-hint">Auto-saves on change</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Initialize editors in All Mode
            allContainer.querySelectorAll('.blurb-all-card').forEach(card => {
                const idx = parseInt(card.getAttribute('data-index'), 10);
                const editorEl = card.querySelector('.all-mode-wysiwyg');
                const countEl = card.querySelector('.editor-word-count');
                if (!editorEl) return;

                let initialHtml = state.rankings[idx]?.blurb || '';
                if (initialHtml && !/<[a-z][\s\S]*>/i.test(initialHtml) && window.marked) {
                    initialHtml = window.marked.parse(initialHtml);
                }
                editorEl.innerHTML = initialHtml;

                const syncStats = () => {
                    const text = editorEl.innerText || '';
                    const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
                    const chars = text.length;
                    if (countEl) countEl.textContent = `${words} words • ${chars} chars`;
                    state.rankings[idx].blurb = editorEl.innerHTML;
                };

                editorEl.addEventListener('input', syncStats);
                editorEl.addEventListener('blur', syncStats);
                syncStats();

                card.querySelectorAll('.editor-tool-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        editorEl.focus();
                        const cmd = btn.getAttribute('data-command');
                        const val = btn.getAttribute('data-value');
                        if (cmd === 'createLink') {
                            const url = prompt('Enter link URL (e.g. https://...):', 'https://');
                            if (url) document.execCommand('createLink', false, url);
                        } else if (cmd === 'formatBlock') {
                            document.execCommand('formatBlock', false, `<${val}>`);
                        } else if (cmd) {
                            document.execCommand(cmd, false, val || null);
                        }
                        syncStats();
                    });
                });
            });
        };

        const attachModalEventListeners = () => {
            // Stepper Nav header clicks
            modal.querySelectorAll('.stepper-step').forEach(stepBtn => {
                stepBtn.addEventListener('click', () => {
                    const targetStep = parseInt(stepBtn.getAttribute('data-nav-step'), 10);
                    if (targetStep === 1 || targetStep === 2) {
                        saveInputsToState();
                        state.step = targetStep;
                        renderModalContent();
                    }
                });
            });

            // Title & Subtitle inputs
            const titleInput = modal.querySelector('#ranking-title-input');
            const subtitleInput = modal.querySelector('#ranking-subtitle-input');
            titleInput?.addEventListener('input', (e) => { state.title = e.target.value; });
            subtitleInput?.addEventListener('input', (e) => { state.subtitle = e.target.value; });

            // Up / Down click handler in Stage 1
            const listEl = modal.querySelector('#rankings-sort-list');
            listEl?.addEventListener('click', (e) => {
                const btnUp = e.target.closest('.btn-sort-up');
                const btnDown = e.target.closest('.btn-sort-down');
                if (btnUp) {
                    const card = btnUp.closest('.sort-team-card');
                    const idx = parseInt(card.getAttribute('data-index'), 10);
                    if (idx > 0) {
                        const temp = state.rankings[idx];
                        state.rankings[idx] = state.rankings[idx - 1];
                        state.rankings[idx - 1] = temp;
                        state.rankings.forEach((r, i) => { r.rank = i + 1; });
                        renderStage1Cards();
                    }
                } else if (btnDown) {
                    const card = btnDown.closest('.sort-team-card');
                    const idx = parseInt(card.getAttribute('data-index'), 10);
                    if (idx < state.rankings.length - 1) {
                        const temp = state.rankings[idx];
                        state.rankings[idx] = state.rankings[idx + 1];
                        state.rankings[idx + 1] = temp;
                        state.rankings.forEach((r, i) => { r.rank = i + 1; });
                        renderStage1Cards();
                    }
                }
            });

            // Stage 1 -> Stage 2
            modal.querySelector('#btn-goto-stage-2')?.addEventListener('click', () => {
                saveInputsToState();
                state.step = 2;
                renderModalContent();
            });

            // Stage 2 -> Stage 1
            modal.querySelector('#btn-back-to-stage-1')?.addEventListener('click', () => {
                saveInputsToState();
                state.step = 1;
                renderModalContent();
            });

            // View Mode Switcher
            modal.querySelectorAll('.btn-view-mode').forEach(btn => {
                btn.addEventListener('click', () => {
                    const mode = btn.getAttribute('data-mode');
                    if (mode === 'focus' || mode === 'all') {
                        saveInputsToState();
                        state.blurbViewMode = mode;
                        renderStage2();
                        modal.querySelectorAll('.btn-view-mode').forEach(b => {
                            b.classList.toggle('active', b.getAttribute('data-mode') === mode);
                        });
                        const focusCont = modal.querySelector('#blurbs-focus-container');
                        const allCont = modal.querySelector('#blurbs-all-container');
                        if (focusCont) focusCont.style.display = mode === 'focus' ? 'grid' : 'none';
                        if (allCont) allCont.style.display = mode === 'all' ? 'flex' : 'none';
                    }
                });
            });

            // Final Submit Button (Stage 2)
            modal.querySelector('#btn-submit-publish-rankings')?.addEventListener('click', async () => {
                saveInputsToState();
                const feedbackEl = modal.querySelector('#stage-2-feedback');
                const submitBtn = modal.querySelector('#btn-submit-publish-rankings');

                if (!state.title.trim()) {
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.style.color = '#ef4444';
                        feedbackEl.textContent = 'Please enter a headline title for these rankings (in Step 1).';
                    }
                    state.step = 1;
                    renderModalContent();
                    return;
                }

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = state.isNew ? 'Publishing...' : 'Saving...';
                }

                const success = state.isNew
                    ? await this.publishNewRanking(state.title, state.subtitle, state.rankings, state.authorName)
                    : await this.saveLiveRankingEdit(state.title, state.subtitle, state.rankings, state.authorName);

                if (success) {
                    modal.close();
                    this.currentIndex = 0;
                    this.allBlurbsOpen = null;
                    this.render();
                    this.renderAdminSection();
                } else {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = state.isNew ? 'Publish Power Rankings' : 'Save Changes';
                    }
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.style.color = '#ef4444';
                        feedbackEl.textContent = 'Failed to save rankings. Please try again.';
                    }
                }
            });
        };

        const saveInputsToState = () => {
            const titleInput = modal.querySelector('#ranking-title-input');
            const subtitleInput = modal.querySelector('#ranking-subtitle-input');
            if (titleInput) state.title = titleInput.value.trim();
            if (subtitleInput) state.subtitle = subtitleInput.value.trim();

            if (state.blurbViewMode === 'focus') {
                const editorEl = modal.querySelector('#focus-blurb-wysiwyg-editor');
                if (editorEl && state.rankings[state.focusedIndex]) {
                    state.rankings[state.focusedIndex].blurb = editorEl.innerHTML;
                }
            } else {
                modal.querySelectorAll('.all-mode-wysiwyg').forEach(editorEl => {
                    const idx = parseInt(editorEl.getAttribute('data-index'), 10);
                    if (!isNaN(idx) && state.rankings[idx]) {
                        state.rankings[idx].blurb = editorEl.innerHTML;
                    }
                });
            }
        };

        renderModalContent();

        if (typeof modal.showModal === 'function') {
            modal.showModal();
        } else {
            modal.style.display = 'block';
        }
    }

    async saveLiveRankingEdit(title, subtitle, rankings, editorName) {
        if (!this.canEdit()) return false;
        const now = Date.now();
        const resolvedName = editorName || this.getCurrentUserDisplayName();
        const cleanRankings = Array.isArray(rankings) ? rankings.map((r, idx) => ({
            ...r,
            rank: r.rank || (idx + 1),
            manager_id: this.canonicalizeManagerId(r.manager_id),
            prev_rank: r.prev_rank !== undefined && r.prev_rank !== null && r.prev_rank !== '' ? Number(r.prev_rank) : null,
            blurb: r.blurb || ''
        })) : [];

        if (!this.data.current_ranking) {
            this.data.current_ranking = {
                id: `pr_${now}`,
                created_at: now
            };
        }

        this.data.current_ranking.title = title;
        this.data.current_ranking.subtitle = subtitle;
        this.data.current_ranking.rankings = cleanRankings;
        this.data.current_ranking.updated_at = now;
        this.data.current_ranking.last_edited_by = resolvedName;
        if (!this.data.current_ranking.author_name) {
            this.data.current_ranking.author_name = resolvedName;
        }

        if (database) {
            try {
                const currentRef = dbRef(database, `leagues/${this.leagueSlug}/power_rankings/current_ranking`);
                await set(currentRef, this.data.current_ranking);
                return true;
            } catch (e) {
                console.error('Error saving live rankings to Firebase:', e);
                return false;
            }
        }
        return true;
    }

    async publishNewRanking(title, subtitle, rankings, authorName) {
        if (!this.canEdit()) return false;
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const now = Date.now();
        const resolvedName = authorName || this.getCurrentUserDisplayName();
        const cleanRankings = Array.isArray(rankings) ? rankings.map((r, idx) => ({
            ...r,
            rank: r.rank || (idx + 1),
            manager_id: this.canonicalizeManagerId(r.manager_id),
            prev_rank: r.prev_rank !== undefined && r.prev_rank !== null && r.prev_rank !== '' ? Number(r.prev_rank) : null,
            blurb: r.blurb || ''
        })) : [];

        // 1. Move old current_ranking to archived_rankings
        if (this.data.current_ranking && Array.isArray(this.data.current_ranking.rankings) && this.data.current_ranking.rankings.length > 0) {
            const archived = {
                ...this.data.current_ranking,
                archived_at: now
            };
            if (!Array.isArray(this.data.archived_rankings)) {
                this.data.archived_rankings = [];
            }
            this.data.archived_rankings.unshift(archived);
        }

        // 2. Set new live current_ranking
        this.data.current_ranking = {
            id: `pr_${now}`,
            title,
            subtitle,
            rankings: cleanRankings,
            author_name: resolvedName,
            author_email: session?.email || '',
            created_at: now,
            updated_at: now,
            last_edited_by: resolvedName
        };

        if (database) {
            try {
                const rootRef = dbRef(database, `leagues/${this.leagueSlug}/power_rankings`);
                await set(rootRef, {
                    allowed_editors: this.data.allowed_editors || [],
                    current_ranking: this.data.current_ranking,
                    archived_rankings: this.data.archived_rankings || []
                });
                return true;
            } catch (e) {
                console.error('Error publishing new power rankings to Firebase:', e);
                return false;
            }
        }
        return true;
    }

    async addEditor(managerIdOrEmail) {
        if (!this.canEdit()) return false;
        const clean = (managerIdOrEmail || '').trim();
        if (!clean) return false;

        if (!Array.isArray(this.data.allowed_editors)) {
            this.data.allowed_editors = [];
        }

        if (!this.data.allowed_editors.includes(clean)) {
            this.data.allowed_editors.push(clean);
            if (database) {
                try {
                    const editorsRef = dbRef(database, `leagues/${this.leagueSlug}/power_rankings/allowed_editors`);
                    await set(editorsRef, this.data.allowed_editors);
                } catch (e) {
                    console.error('Error saving allowed power rankings editor to Firebase:', e);
                    return false;
                }
            }
        }
        return true;
    }

    async removeEditor(managerIdOrEmail) {
        if (!this.canEdit()) return false;
        const clean = (managerIdOrEmail || '').trim();
        if (!clean || !Array.isArray(this.data.allowed_editors)) return false;

        this.data.allowed_editors = this.data.allowed_editors.filter(e => e !== clean);
        if (database) {
            try {
                const editorsRef = dbRef(database, `leagues/${this.leagueSlug}/power_rankings/allowed_editors`);
                await set(editorsRef, this.data.allowed_editors);
            } catch (e) {
                console.error('Error removing power rankings editor from Firebase:', e);
                return false;
            }
        }
        return true;
    }

    renderAdminSection(container = null) {
        const target = container || document.getElementById(this.adminContainerId);
        if (!target) return;

        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const managers = this.getManagersList();
        const claims = this.app?.claims || {};
        const allowedEditors = Array.isArray(this.data.allowed_editors) ? this.data.allowed_editors : [];
        const adminEmail = (this.app?.leagueSettings?.admin_email || session?.email || 'Admin').toLowerCase();

        // Sort managers
        const sortedManagers = [...managers].sort((a, b) => (a.canonical_name || a.name || '').localeCompare(b.canonical_name || b.name || ''));
        const availableToAdd = sortedManagers.filter(m => !allowedEditors.includes(m.id));

        const managerOptions = availableToAdd.map(m => {
            const mName = m.canonical_name || m.name || m.id;
            return `<option value="${m.id}">${mName}</option>`;
        }).join('');

        // Build list of editors
        const editorRows = [];

        // 1. Admin Row (Default)
        editorRows.push(`
            <tr style="border-bottom: 1px solid var(--border-line);">
                <td style="padding: 10px 12px; font-weight: 700;">
                    League Administrator (${adminEmail})
                </td>
                <td style="padding: 10px 12px;">
                    <span style="display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;">
                        Admin • Default Edit Access
                    </span>
                </td>
                <td style="padding: 10px 12px; text-align: right; color: var(--text-muted); font-size: 0.8rem;">
                    Default Permitted
                </td>
            </tr>
        `);

        // 2. Additional Editors
        allowedEditors.forEach(ed => {
            const mgr = sortedManagers.find(m => m.id === ed || String(m.id).toLowerCase() === String(ed).toLowerCase());
            const claim = mgr ? claims[mgr.id] : null;
            const displayName = mgr ? (mgr.canonical_name || mgr.name || mgr.id) : ed;
            const claimEmail = claim ? claim.email : (ed.includes('@') ? ed : 'Unclaimed Account');

            editorRows.push(`
                <tr style="border-bottom: 1px solid var(--border-line);">
                    <td style="padding: 10px 12px; font-weight: 600;">
                        ${displayName} <span style="color: var(--text-muted); font-size: 0.82rem; font-weight: normal;">(${claimEmail})</span>
                    </td>
                    <td style="padding: 10px 12px;">
                        <span style="display: inline-block; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe;">
                            Granted Edit Access
                        </span>
                    </td>
                    <td style="padding: 10px 12px; text-align: right;">
                        <button type="button" class="btn btn-sm btn-revoke-pr-editor" data-editor-id="${ed}" style="padding: 3px 8px; font-size: 0.75rem; border: 1px solid #fca5a5; background: #fef2f2; color: #991b1b; border-radius: 4px; cursor: pointer;">
                            Revoke
                        </button>
                    </td>
                </tr>
            `);
        });

        const currentRanking = this.data.current_ranking;
        const rankingCreatedStr = currentRanking ? formatTimestamp(currentRanking.created_at) : '';
        const rankingUpdatedStr = currentRanking && currentRanking.updated_at ? formatTimestamp(currentRanking.updated_at) : '';

        target.innerHTML = `
            <div class="admin-card-header">
                <h2>Power Rankings &amp; Publishing Permissions</h2>
                <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">
                    Manage who is permitted to compile, reorder, and publish weekly Power Rankings across your league.
                </p>
            </div>

            <!-- 1. Edit Permissions Manager -->
            <div style="margin-top: 1.25rem;">
                <label style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: var(--text-secondary);">
                    Power Rankings Authors &amp; Permissions:
                </label>
                <p style="font-size: 0.86rem; color: var(--text-muted); margin: 0 0 1rem 0; line-height: 1.45;">
                    By default, only the league admin has edit access. You can grant power ranking editing permissions to as many managers as you like. When granted members sign in, they will see <strong>Edit Rankings</strong> and <strong>+ New Rankings</strong> buttons on the home page.
                </p>

                <!-- Add Editor Row -->
                <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 1rem;">
                    <select id="admin-pr-add-manager-select" class="admin-select" style="min-width: 220px; padding: 7px 10px; font-size: 0.86rem; font-weight: 600; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                        <option value="">-- Select Manager to Grant Edit Access --</option>
                        ${managerOptions}
                    </select>
                    <button type="button" id="btn-grant-pr-editor-access" class="btn btn-primary" style="padding: 7px 14px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer; white-space: nowrap;">
                        Grant Edit Access
                    </button>
                </div>
                <div id="pr-editor-feedback" class="admin-feedback-msg" style="display: none; margin-bottom: 0.75rem;"></div>

                <!-- Editors Table -->
                <div style="overflow-x: auto; border: 1px solid var(--border-line); border-radius: 6px; background: var(--bg-card);">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem; text-align: left;">
                        <thead>
                            <tr style="background: var(--bg-surface); border-bottom: 1px solid var(--border-line);">
                                <th style="padding: 8px 12px; font-weight: 700; color: var(--text-secondary); font-size: 0.78rem; text-transform: uppercase;">Manager / Account</th>
                                <th style="padding: 8px 12px; font-weight: 700; color: var(--text-secondary); font-size: 0.78rem; text-transform: uppercase;">Permission Level</th>
                                <th style="padding: 8px 12px; font-weight: 700; color: var(--text-secondary); font-size: 0.78rem; text-transform: uppercase; text-align: right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${editorRows.join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 2. Current Live Rankings Overview & Quick Action -->
            <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                    <div>
                        <label style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; color: var(--text-secondary);">
                            Current Live Power Rankings Overview:
                        </label>
                        <p style="margin: 3px 0 0 0; font-size: 0.82rem; color: var(--text-muted);">
                            ${currentRanking ? `Compiled by <strong>${currentRanking.author_name || 'Commissioner'}</strong> on ${rankingCreatedStr || 'N/A'}${rankingUpdatedStr ? ` (Last edited ${rankingUpdatedStr})` : ''}` : 'No power rankings published yet.'}
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        ${currentRanking ? `
                            <button type="button" id="btn-admin-edit-live-pr" class="btn btn-sm" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer;">
                                Edit Live Rankings
                            </button>
                        ` : ''}
                        <button type="button" id="btn-admin-create-new-pr" class="btn btn-sm btn-primary" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer;">
                            + New Rankings Edition
                        </button>
                    </div>
                </div>

                <div style="background: var(--bg-surface); border: 1px solid var(--border-line); border-radius: 6px; padding: 1rem;">
                    <div style="font-weight: 800; font-size: 0.95rem; margin-bottom: 2px; color: var(--text-primary);">
                        ${currentRanking ? (currentRanking.title || 'Untitled Rankings') : 'No Power Rankings Created'}
                    </div>
                    ${currentRanking && currentRanking.subtitle ? `
                        <div style="font-size: 0.84rem; color: var(--text-muted); margin-bottom: 6px;">${currentRanking.subtitle}</div>
                    ` : ''}
                    <div style="font-size: 0.82rem; color: var(--text-secondary);">
                        ${currentRanking && Array.isArray(currentRanking.rankings) ? `Active edition includes ${currentRanking.rankings.length} ranked teams with attached analysis.` : 'Publish your first edition using the button above.'}
                    </div>
                </div>
            </div>
        `;

        // Wire up Add Editor button
        target.querySelector('#btn-grant-pr-editor-access')?.addEventListener('click', async () => {
            const select = target.querySelector('#admin-pr-add-manager-select');
            const feedback = target.querySelector('#pr-editor-feedback');
            const selectedMgrId = select ? select.value : '';

            if (!selectedMgrId) {
                if (feedback) {
                    feedback.style.display = 'block';
                    feedback.style.color = '#ef4444';
                    feedback.textContent = 'Please select a manager to grant edit access.';
                }
                return;
            }

            const res = await this.addEditor(selectedMgrId);
            if (feedback) {
                feedback.style.display = 'block';
                if (res) {
                    feedback.style.color = '#15803d';
                    feedback.textContent = `✓ Granted power rankings author access to ${selectedMgrId}!`;
                } else {
                    feedback.style.color = '#ef4444';
                    feedback.textContent = 'Failed to grant author access.';
                }
                setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 4000);
            }
            this.renderAdminSection(target);
        });

        // Wire up Revoke buttons
        target.querySelectorAll('.btn-revoke-pr-editor').forEach(btn => {
            btn.addEventListener('click', async () => {
                const edId = btn.getAttribute('data-editor-id');
                if (!edId) return;
                await this.removeEditor(edId);
                this.renderAdminSection(target);
            });
        });

        // Wire up quick edit / new buttons in admin
        target.querySelector('#btn-admin-edit-live-pr')?.addEventListener('click', () => this.openEditModal());
        target.querySelector('#btn-admin-create-new-pr')?.addEventListener('click', () => this.openNewRankingsModal());
    }
}
