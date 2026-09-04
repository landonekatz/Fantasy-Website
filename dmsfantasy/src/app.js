import { VaultDraftEngine } from '/src/draft.js';
import { nflStats } from '/src/nfl_stats.js';
import { database } from '/src/firebase.js';
import { ref as dbRef, set, get, child, update, onValue } from 'firebase/database';
import { formatManagerDisplayName } from '/src/formatters.js';
import { calculateSeasonLoser, getRuleDescription } from '/src/compiler.js';
import { CommissionerNotesEngine } from '/src/commissioner_notes.js';
import { PowerRankingsEngine } from '/src/power_rankings.js';

function formatDumbartonNflInfo(p) {
    let opp = (p.nfl_team || '').trim();
    let rawRes = (p.nfl_game_result || '').trim();
    let statLine = (p.nfl_stat_line || '').trim();
    
    if (!rawRes && !opp) return statLine;
    
    let loc = '';
    if (rawRes.endsWith('@')) {
        loc = '@';
        rawRes = rawRes.slice(0, -1).trim();
    } else if (rawRes.endsWith('vs')) {
        loc = 'vs';
        rawRes = rawRes.slice(0, -2).trim();
    }
    
    let gameStr = rawRes;
    if (opp) {
        if (loc) gameStr = `${rawRes} ${loc} ${opp}`;
        else gameStr = `${rawRes} ${opp}`;
    }
    
    const parts = [gameStr, statLine].filter(Boolean);
    return parts.join(' • ');
}

class FantasyApp {
    constructor() {
        this.managers = [];
        this.matchups = [];
        this.playerStats = [];
        this.standings = [];
        this.transactions = [];
        this.currentYearFilter = 'all'; // 'all', '2020-present', 'custom'
        this.customStartYear = 2018;
        this.customEndYear = 2026;
        this.activeTab = 'home';
        this.includePlayoffs = true;

        this.overviewSortBy = 'wins';
        this.overviewSortOrder = 'desc';
        this.recordFilters = {
            overview: { year: 'all', retired: false, customStart: 2018, customEnd: 2026 },
            singlegame: { year: '2020-present', retired: false, customStart: 2018, customEnd: 2026 },
            singleseason: { year: '2020-present', retired: false, customStart: 2018, customEnd: 2026 },
            streaks: { year: '2020-present', retired: false, customStart: 2018, customEnd: 2026 },
            playoffs: { year: '2020-present', retired: false, customStart: 2018, customEnd: 2026 }
        };
        this.db = null;
        this.notesEngine = null;
        this.powerRankingsEngine = null;
        this.leagueSlug = 'dmsfantasy';
        this.leagueSettings = {
            name: 'The Dumbarton Fantasy Football League HQ',
            join_code: 'DNFUAM',
            tagline: '8 Seasons • 15 Managers • One Vault'
        };
    }

    renderPrivateGuard() {
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const userEmail = (session?.email || '').toLowerCase();
        if (session?.isFounder || userEmail === 'landonekatz@gmail.com') return;

        let overlay = document.getElementById('private-guard-overlay');
        if (overlay) return;

        const leagueTitle = 'The Dumbarton League';

        overlay = document.createElement('div');
        overlay.id = 'private-guard-overlay';
        overlay.style.cssText = 'position: fixed; inset: 0; z-index: 99999; background: #0f1115; display: flex; align-items: center; justify-content: center; padding: 1.5rem; font-family: "Inter", sans-serif; color: #fff; overflow-y: auto;';
        
        overlay.innerHTML = `
            <div class="card" style="max-width: 440px; width: 100%; background: #181b20; border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 12px; padding: 2.25rem 2rem; box-shadow: 0 20px 40px rgba(0,0,0,0.6); text-align: center; position: relative;">
                <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); color: var(--accent-gold, #c5a059); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1.25rem;">
                    Private League Archive
                </div>
                
                <h1 style="font-family: 'Cinzel', serif; font-size: 1.75rem; color: var(--accent-gold, #c5a059); margin: 0 0 0.5rem 0; line-height: 1.25;">
                    ${leagueTitle}
                </h1>
                
                <p style="color: #94a3b8; font-size: 0.88rem; line-height: 1.5; margin: 0 0 1.5rem 0;">
                    This Fantasy Vault is private. Please sign in or enter your Join Code to access records, box scores, and analytics.
                </p>

                <!-- Google 1-Click SSO -->
                <button id="guard-btn-google" type="button" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0.75rem; background: #fff; color: #1f2937; border: none; border-radius: 6px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                    Sign In with Google
                </button>

                <div style="display: flex; align-items: center; margin: 1.15rem 0; color: #64748b; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px;">
                    <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
                    <span style="padding: 0 0.75rem;">or email</span>
                    <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
                </div>

                <!-- Email & Password Form -->
                <form id="guard-email-form" style="display: flex; flex-direction: column; gap: 0.65rem;">
                    <input type="email" id="guard-input-email" placeholder="name@example.com" required style="width: 100%; padding: 0.65rem 0.8rem; background: #0f1115; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.88rem; box-sizing: border-box;">
                    <input type="password" id="guard-input-pass" placeholder="Password" required style="width: 100%; padding: 0.65rem 0.8rem; background: #0f1115; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 0.88rem; box-sizing: border-box;">
                    <button type="submit" style="width: 100%; padding: 0.7rem; background: var(--accent-gold, #c5a059); color: #000; font-weight: 700; border: none; border-radius: 6px; font-size: 0.88rem; cursor: pointer;">Sign In / Register</button>
                </form>

                <div style="display: flex; align-items: center; margin: 1.15rem 0; color: #64748b; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px;">
                    <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
                    <span style="padding: 0 0.75rem;">or join code</span>
                    <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
                </div>

                <!-- Join Code Form -->
                <form id="guard-code-form" style="display: flex; gap: 0.5rem;">
                    <input type="text" id="guard-input-code" placeholder="6-char code" maxlength="6" style="flex: 1; padding: 0.6rem; background: #0f1115; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-family: monospace; text-transform: uppercase; font-size: 0.9rem; text-align: center; letter-spacing: 1px; box-sizing: border-box;">
                    <button type="submit" style="padding: 0.6rem 1rem; background: rgba(212, 175, 55, 0.15); border: 1px solid var(--accent-gold, #c5a059); color: var(--accent-gold, #c5a059); border-radius: 6px; font-weight: 700; font-size: 0.82rem; cursor: pointer;">Unlock</button>
                </form>

                <div id="guard-error-msg" style="display: none; margin-top: 0.85rem; padding: 0.5rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; border-radius: 6px; font-size: 0.8rem;"></div>

                <div style="margin-top: 1.25rem; font-size: 0.8rem; color: #64748b;">
                    <a href="/" style="color: #94a3b8; text-decoration: none;">← Return to The Fantasy Vault Home</a>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);

        const showError = (msg) => {
            const errEl = document.getElementById('guard-error-msg');
            if (errEl) {
                errEl.textContent = msg;
                errEl.style.display = 'block';
            }
        };

        const unlockVault = async () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            const founderBar = document.getElementById('founder-control-bar');
            if (founderBar) founderBar.remove();
            this.setupThemeToggle();
            await this.loadData();
            this.initPowerRankings();
            this.setupNavigation();
            this.setupH2HControls();
            this.renderH2H();
        };

        // Google SSO
        const btnGoogle = document.getElementById('guard-btn-google');
        if (btnGoogle) {
            btnGoogle.addEventListener('click', async () => {
                try {
                    await window.AuthEngine.loginWithGoogle();
                    window.AuthEngine.setPersona('member');
                    await unlockVault();
                } catch (err) {
                    showError("Google Sign-In failed: " + err.message);
                }
            });
        }

        // Email Auth Form
        const emailForm = document.getElementById('guard-email-form');
        if (emailForm) {
            emailForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('guard-input-email')?.value.trim();
                const pass = document.getElementById('guard-input-pass')?.value;
                if (!email || !pass) return;
                try {
                    await window.AuthEngine.loginWithEmail(email, pass);
                    window.AuthEngine.setPersona('member');
                    await unlockVault();
                } catch (err) {
                    showError("Sign In failed: " + err.message);
                }
            });
        }

        // Code Form
        const codeForm = document.getElementById('guard-code-form');
        if (codeForm) {
            codeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = document.getElementById('guard-input-code')?.value.trim().toUpperCase();
                if (!code) return;
                const check = window.AuthEngine.processJoinCode(code);
                if (check.success) {
                    window.AuthEngine.setPersona('member');
                    if (typeof window.startManagerClaimFlow === 'function') {
                        window.startManagerClaimFlow(code);
                    }
                    await unlockVault();
                } else {
                    showError(check.message || "Invalid Join Code");
                }
            });
        }

        // Also listen for auth changes
        window.addEventListener('vault_auth_changed', async (e) => {
            if (e.detail) {
                await unlockVault();
            }
        }, { once: true });
    }

    async init() {
        if (window.AuthEngine && typeof window.AuthEngine.recordActiveLeague === 'function') {
            window.AuthEngine.recordActiveLeague('dmsfantasy');
        } else {
            localStorage.setItem('vault_last_league', 'dmsfantasy');
        }

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('building')) {
            window.history.replaceState({}, '', window.location.pathname);
        }

        const joinCode = urlParams.get('join');
        if (joinCode) {
            setTimeout(() => {
                if (typeof window.startManagerClaimFlow === 'function') {
                    window.startManagerClaimFlow(joinCode);
                }
            }, 500);
        }

        // 1. Immediately wire navigation, theme, and admin tab visibility on frame 0
        this.setupThemeToggle();
        this.setupNavigation();
        this.checkAdminAccess();

        // Wait for initial Firebase auth resolution with timeout protection
        if (typeof window.AuthEngine !== 'undefined' && typeof window.AuthEngine.ready === 'function') {
            await Promise.race([
                window.AuthEngine.ready(),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
        }

        await this.loadData();

        // 2. Private League Guard (Public by default)
        const isPrivate = Boolean(this.leagueSettings?.is_private);
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const userEmail = (session?.email || '').toLowerCase();
        const isFounder = Boolean(session?.isFounder || userEmail === 'landonekatz@gmail.com');

        if (isPrivate) {
            if (!session) {
                this.renderPrivateGuard();
                return;
            }
            const adminEmail = (this.leagueSettings?.admin_email || '').toLowerCase();
            const isLeagueAdmin = isFounder || (adminEmail && userEmail === adminEmail) || (session.adminLeagues && session.adminLeagues.includes('dmsfantasy'));
            const hasJoined = session.joinedLeagues && session.joinedLeagues.includes('dmsfantasy');
            const hasClaim = this.claims && Object.values(this.claims).some(c => (c?.userId === session.uid) || (c?.email && c.email.toLowerCase() === userEmail));
            const isAuthorized = isFounder || isLeagueAdmin || hasJoined || hasClaim;

            if (!isAuthorized) {
                this.renderAccessDenied(session);
                return;
            }
        } else {
            if (session && !isFounder) {
                const adminEmail = (this.leagueSettings?.admin_email || '').toLowerCase();
                const isLeagueAdmin = (adminEmail && userEmail === adminEmail) || (session.adminLeagues && session.adminLeagues.includes('dmsfantasy'));
                const hasClaim = this.claims && Object.values(this.claims).some(c => (c?.userId === session.uid) || (c?.email && c.email.toLowerCase() === userEmail));
                if (!isLeagueAdmin && !hasClaim) {
                    this.showGuestNotice();
                }
            }
        }

        window.addEventListener('vault_nickname_updated', (e) => {
            const { managerId, nickname } = e.detail || {};
            if (!this.claims) this.claims = {};
            if (managerId) {
                this.claims[managerId] = { ...(this.claims[managerId] || {}), nickname };
                const mgr = (this.managers || []).find(m => m.id === managerId || String(m.id).toLowerCase() === String(managerId).toLowerCase());
                if (mgr) mgr.nickname = nickname;
            }
            this.refreshNicknamesUI();
        });

        const founderBar = document.getElementById('founder-control-bar');
        if (founderBar) founderBar.remove();
        this.initPowerRankings();
        this.setupH2HControls();
        this.renderH2H();
        this.checkAdminAccess();
        if (this.activeTab === 'draft') {
            this.renderDraft();
        }
    }

    showGuestNotice() {
        if (document.getElementById('guest-notice-banner')) return;
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        if (!session) return;
        
        const banner = document.createElement('div');
        banner.id = 'guest-notice-banner';
        banner.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; background: #ffffff; color: #0f172a; border: 1px solid #cbd5e1; border-left: 4px solid #d97706; padding: 0.85rem 1.15rem; border-radius: 8px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15); max-width: 420px; display: flex; align-items: flex-start; gap: 10px; font-size: 0.85rem; line-height: 1.45; animation: slideInUp 0.3s ease;';
        
        banner.innerHTML = `
            <div style="flex: 1;">
                <div style="font-weight: 700; color: #b45309; margin-bottom: 2px; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px;">Guest View</div>
                <div>You are currently viewing this league as a guest. If you are a member of this league, contact your league commissioner for an invite link.</div>
            </div>
            <button id="close-guest-banner" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #94a3b8; padding: 0; line-height: 1;" title="Dismiss">&times;</button>
        `;
        
        document.body.appendChild(banner);
        document.getElementById('close-guest-banner')?.addEventListener('click', () => {
            banner.remove();
        });
        setTimeout(() => {
            if (banner && banner.parentNode) {
                banner.style.opacity = '0';
                banner.style.transition = 'opacity 0.5s ease';
                setTimeout(() => banner.remove(), 500);
            }
        }, 10000);
    }

    renderAccessDenied(session) {
        let overlay = document.getElementById('vault-access-denied-overlay');
        if (overlay) return;
        
        overlay = document.createElement('div');
        overlay.id = 'vault-access-denied-overlay';
        overlay.className = 'guard-overlay';
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 1.5rem;';
        
        const userEmail = session?.email || 'Your account';
        overlay.innerHTML = `
            <div class="guard-card" style="background: #ffffff; color: #0f172a; max-width: 480px; width: 100%; border-radius: 12px; padding: 2.25rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); text-align: center; border: 1px solid #e2e8f0;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 1.4rem; font-weight: 800; margin-bottom: 1rem;">!</div>
                <h2 style="font-size: 1.35rem; font-family: var(--font-heading, 'Cinzel', serif); font-weight: 800; margin-bottom: 0.5rem; color: #0f172a;">Access Denied</h2>
                <p style="color: #64748b; font-size: 0.88rem; line-height: 1.55; margin-bottom: 1.5rem;">
                    Your account (<strong>${userEmail}</strong>) does not have access to this private league. If you are a member of this league, please enter a valid Join Code below or ask your commissioner for an invite link.
                </p>

                <!-- Join Code Form -->
                <form id="denied-code-form" style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <input type="text" id="denied-input-code" placeholder="6-char code" maxlength="6" style="flex: 1; padding: 0.65rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; font-family: monospace; text-transform: uppercase; font-size: 0.95rem; text-align: center; letter-spacing: 1px; box-sizing: border-box;">
                    <button type="submit" style="padding: 0.65rem 1.25rem; background: #fef3c7; border: 1px solid #d97706; color: #b45309; border-radius: 6px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">Unlock</button>
                </form>

                <div id="denied-error-msg" style="display: none; margin-bottom: 1rem; padding: 0.5rem; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 6px; font-size: 0.8rem;"></div>

                <div style="display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.25rem; font-size: 0.82rem;">
                    <button id="denied-btn-signout" style="background: none; border: none; color: #b45309; font-weight: 600; cursor: pointer; text-decoration: underline;">Sign Out / Switch Account</button>
                    <span style="color: #cbd5e1;">|</span>
                    <a href="/" style="color: #64748b; text-decoration: none;">Return Home &rarr;</a>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);

        const showError = (msg) => {
            const errEl = document.getElementById('denied-error-msg');
            if (errEl) {
                errEl.textContent = msg;
                errEl.style.display = 'block';
            }
        };

        const codeForm = document.getElementById('denied-code-form');
        if (codeForm) {
            codeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const code = document.getElementById('denied-input-code')?.value.trim().toUpperCase();
                if (!code) return;
                const check = window.AuthEngine.processJoinCode(code);
                if (check.success) {
                    if (typeof window.AuthEngine.linkUserLeague === 'function') {
                        await window.AuthEngine.linkUserLeague('dmsfantasy', 'member', 'The Dumbarton League');
                    }
                    overlay.remove();
                    window.location.reload();
                } else {
                    showError(check.message || "Invalid Join Code");
                }
            });
        }

        const btnSignout = document.getElementById('denied-btn-signout');
        if (btnSignout) {
            btnSignout.addEventListener('click', () => {
                window.AuthEngine.logout();
            });
        }
    }

    setupFounderControlBar() {
        const bar = document.getElementById('founder-control-bar');
        if (bar) bar.remove();
    }

    setupThemeToggle() {
        const btn = document.getElementById('theme-toggle-btn');
        const label = document.getElementById('theme-toggle-label');
        if (!btn || !label) return;

        let savedTheme = 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        label.textContent = `Theme: Light`;

        btn.addEventListener('click', () => {
            if (document.body.classList.contains('rivalry-dungeon-mode')) return;
            // Dark mode removed
        });
    }

    async loadData() {
        // Support both fetch and offline FANTASY_DATA window variable fallback
        const fetchOrFallback = async (filename, bundleKey) => {
            try {
                const basePath = window.location.pathname.includes('dmsfantasy') ? '/dmsfantasy/data/' : 'data/';
                const res = await fetch(`${basePath}${filename}?v=${Date.now()}`, { cache: 'no-store' });
                if (res.ok) {
                    return await res.json();
                }
            } catch (err) {
                console.warn(`Could not fetch data/${filename}, falling back to window.FANTASY_DATA`, err);
            }
            if (window.FANTASY_DATA && window.FANTASY_DATA[bundleKey]) {
                return window.FANTASY_DATA[bundleKey];
            }
            return null;
        };

        const [managersData, matchupsData, statsData, standingsData, transactionsData, powerRankingsData, draftData] = await Promise.all([
            fetchOrFallback('managers.json', 'managers'),
            fetchOrFallback('matchups.json', 'matchups'),
            fetchOrFallback('weekly_player_stats.json', 'weekly_player_stats'),
            fetchOrFallback('league_standings.json', 'league_standings'),
            fetchOrFallback('transactions.json', 'transactions'),
            fetchOrFallback('power_rankings_history.json', 'power_rankings_history'),
            fetchOrFallback('draft_results.json', 'draft_results')
        ]);

        if (managersData) {
            this.managersData = managersData;
            const rawList = managersData.managers || [];
            this.managers = rawList.map(m => {
                const isRetired = (m.status && m.status.toLowerCase() === 'retired');
                return {
                    ...m,
                    id: m.id || m.manager_id,
                    manager_id: m.id || m.manager_id,
                    name: m.name || m.manager_name,
                    manager_name: m.name || m.manager_name,
                    is_retired: isRetired,
                    status_group: isRetired ? 'Retired Managers' : 'Current Managers'
                };
            });
        }
        this.matchups = matchupsData || [];
        this.playerStats = statsData || [];
        this.standings = standingsData || [];
        this.transactions = transactionsData || [];
        this.powerRankingsHistory = powerRankingsData || [];
        this.draftResults = draftData || [];

        nflStats.preloadSeason(2025);
        nflStats.preloadSeason(2024);

        // Fetch custom league settings, claims, and managers from Firebase RTDB
        try {
            const [settingsSnap, claimsSnap, managersSnap] = await Promise.all([
                get(dbRef(database, `leagues/dmsfantasy/league_settings`)).catch(() => null),
                get(dbRef(database, `leagues/dmsfantasy/claims`)).catch(() => null),
                get(dbRef(database, `leagues/dmsfantasy/managers`)).catch(() => null)
            ]);
            if (settingsSnap && settingsSnap.exists()) {
                this.leagueSettings = { ...this.leagueSettings, ...settingsSnap.val() };
            }
            if (claimsSnap && claimsSnap.exists()) {
                this.claims = claimsSnap.val() || {};
                Object.entries(this.claims).forEach(([mId, cVal]) => {
                    const nick = typeof cVal === 'object' && cVal !== null ? cVal.nickname : '';
                    if (nick) {
                        const target = this.managers.find(m => m.id === mId);
                        if (target && !target.nickname) target.nickname = nick;
                    }
                });
            }
            if (managersSnap && managersSnap.exists()) {
                const rtdbManagers = managersSnap.val();
                if (Array.isArray(rtdbManagers)) {
                    rtdbManagers.forEach(rm => {
                        const target = this.managers.find(m => m.id === rm.id);
                        if (target) {
                            if (rm.name) {
                                target.name = rm.name;
                                target.canonical_name = rm.name;
                                target.manager_name = rm.name;
                            }
                            if (rm.nickname !== undefined) target.nickname = rm.nickname;
                        }
                    });
                }
            }

            // Real-time listener for claims nicknames
            try {
                const claimsRef = dbRef(database, `leagues/dmsfantasy/claims`);
                onValue(claimsRef, (snapshot) => {
                    this.claims = snapshot.exists() ? (snapshot.val() || {}) : {};
                    Object.entries(this.claims).forEach(([mId, cVal]) => {
                        const nick = typeof cVal === 'object' && cVal !== null ? cVal.nickname : '';
                        const target = this.managers.find(m => m.id === mId || String(m.id).toLowerCase() === String(mId).toLowerCase());
                        if (target) target.nickname = nick || '';
                    });
                    this.refreshNicknamesUI();
                });
            } catch (e) {}
        } catch (e) {
            console.warn('Could not fetch RTDB settings for dmsfantasy', e);
        }

        // Live update header masthead on load
        if (this.leagueSettings?.name) {
            const h1El = document.querySelector('.masthead-main h1');
            if (h1El) {
                const hasLeagueSuffix = /league$/i.test(this.leagueSettings.name.trim());
                h1El.innerHTML = `${this.leagueSettings.name}<br>${hasLeagueSuffix ? 'HQ' : 'League HQ'}`;
            }
            document.title = `${this.leagueSettings.name} HQ`;
        }
        if (this.leagueSettings?.tagline) {
            const pEl = document.querySelector('.masthead-main p');
            if (pEl) pEl.textContent = this.leagueSettings.tagline;
        }

        console.log(`Loaded ${this.managers.length} managers, ${this.matchups.length} matchups, ${this.playerStats.length} player stats, ${this.transactions.length} transactions, ${this.powerRankingsHistory.length} power rankings weeks.`);

        // Initialize unified Commissioner Notes & League Updates Engine
        this.notesEngine = new CommissionerNotesEngine({
            leagueSlug: 'dmsfantasy',
            app: this,
            containerId: 'story',
            scrollerPillId: 'scroller-pill-notes',
            adminContainerId: 'admin-sec-notes'
        });

        // Initialize unified Power Rankings Engine
        this.powerRankingsEngine = new PowerRankingsEngine({
            leagueSlug: 'dmsfantasy',
            app: this,
            containerId: 'rankings',
            adminContainerId: 'admin-sec-power-rankings'
        });
    }

    refreshNicknamesUI() {
        if (typeof this.initPowerRankings === 'function') this.initPowerRankings();
        if (typeof this.setupH2HControls === 'function') this.setupH2HControls();
        if (typeof this.renderH2H === 'function') this.renderH2H();
        if (typeof this.renderRecords === 'function') this.renderRecords();
        if (typeof this.renderRivalryWeek === 'function') this.renderRivalryWeek();
        if (this.draftEngine) {
            this.draftEngine.updateData({
                managers: this.managers || this.members,
                draftResults: this.draftResults,
                leagueSettings: this.leagueSettings,
                scoringSettings: this.scoringSettings || this.leagueSettings
            });
            if (this.activeTab === 'draft' || this.activeTab === 'draft-hub') {
                this.draftEngine.render();
            }
        }
    }

    getManagerDisplayName(managerId, fallbackName = '') {
        if (!managerId && !fallbackName) return 'Unknown';
        const searchId = String(managerId || '').toLowerCase().trim();
        const searchFallback = String(fallbackName || '').toLowerCase().trim();

        const m = (this.managers || []).find(mgr => {
            const id = String(mgr.id || mgr.manager_id || '').toLowerCase().trim();
            const name = String(mgr.name || mgr.manager_name || '').toLowerCase().trim();
            const fullName = String(mgr.full_name || '').toLowerCase().trim();
            const dispName = String(mgr.display_name || '').toLowerCase().trim();
            const espnId = String(mgr.espn_id || '').toLowerCase().trim();
            return (id && (id === searchId || id === searchFallback)) ||
                   (name && (name === searchId || name === searchFallback)) ||
                   (fullName && (fullName === searchId || fullName === searchFallback)) ||
                   (dispName && (dispName === searchId || dispName === searchFallback)) ||
                   (espnId && (espnId === searchId || espnId === searchFallback)) ||
                   ((searchId === 'ben' || searchId === 'benjamin') && (id === 'benjamin' || name === 'benjamin'));
        });

        const allowNicknames = this.leagueSettings?.allow_nicknames !== false;
        const session = typeof window.AuthEngine !== 'undefined' ? window.AuthEngine.getSession() : null;
        const currentLeagueSlug = this.leagueSlug || 'dmsfantasy';
        const sessionNick = (session?.managerNicknames && session.managerNicknames[currentLeagueSlug]) || '';
        const isCurrentSessionUser = session && m && (
            (session.claims && session.claims[currentLeagueSlug] === m.id) ||
            (this.claims && (this.claims[m.id]?.userId === session.uid || this.claims[m.espn_id]?.userId === session.uid)) ||
            (this.claims && (this.claims[m.id]?.email?.toLowerCase() === session.email?.toLowerCase() || this.claims[m.espn_id]?.email?.toLowerCase() === session.email?.toLowerCase()))
        );

        let nick = m?.nickname || 
                   (this.claims && (this.claims[m?.id]?.nickname || this.claims[m?.espn_id]?.nickname || this.claims[managerId]?.nickname)) || 
                   '';

        if (!nick && isCurrentSessionUser && sessionNick) {
            nick = sessionNick;
        }

        const baseName = m ? (m.canonical_name || m.name || m.manager_name || m.display_name || m.full_name) : (fallbackName || managerId);

        return formatManagerDisplayName(baseName, nick, allowNicknames);
    }

    getCurrentTeamName(managerId) {
        if (!this.managersData || !this.managersData.team_mappings) return 'Unknown Team';
        const cleanId = String(managerId || '').toLowerCase().trim();
        const targetId = (cleanId === 'ben' || cleanId === 'benjamin') ? 'benjamin' : cleanId;
        const mappings = this.managersData.team_mappings.filter(m => {
            const mId = String(m.manager_id || '').toLowerCase().trim();
            return mId === targetId || mId === cleanId;
        });
        if (mappings.length === 0) return 'Unknown Team';
        mappings.sort((a, b) => b.year - a.year);
        return mappings[0].team_name;
    }

    initPowerRankings() {
        if (this.notesEngine) {
            this.notesEngine.render();
        }
        if (this.powerRankingsEngine) {
            this.powerRankingsEngine.render();
        }
    }

    setupNavigation() {
        const btnHome = document.getElementById('btn-tab-home');
        const btnH2h = document.getElementById('btn-tab-h2h');
        const btnRecords = document.getElementById('btn-tab-records');
        const btnDraft = document.getElementById('btn-tab-draft');
        const btnRivalry = document.getElementById('btn-tab-rivalry');
        const btnAdmin = document.getElementById('btn-tab-admin');
        const viewHome = document.getElementById('view-home');
        const viewH2h = document.getElementById('view-h2h');
        const viewRecords = document.getElementById('view-records');
        const viewDraft = document.getElementById('view-draft');
        const viewRivalry = document.getElementById('view-rivalry');
        const viewAdmin = document.getElementById('view-admin');

        const switchTab = (tab) => {
            this.activeTab = tab;
            [btnHome, btnH2h, btnRecords, btnDraft, btnRivalry, btnAdmin].forEach(btn => btn && btn.classList.remove('active'));
            [viewHome, viewH2h, viewRecords, viewDraft, viewRivalry, viewAdmin].forEach(view => view && view.classList.remove('active'));

            if (tab === 'rivalry') {
                document.body.classList.add('rivalry-dungeon-mode');
                const themeLabel = document.getElementById('theme-toggle-label');
                if (themeLabel) themeLabel.textContent = 'THEME: BLOOD';
                if (!document.getElementById('dungeon-bg-style')) {
                    const imgUrl = '/dungeon_new.png';
                    const s = document.createElement('style');
                    s.id = 'dungeon-bg-style';
                    s.textContent = `body.rivalry-dungeon-mode::before {
                        background-image:
                            radial-gradient(circle at 50% 0%, rgba(230, 46, 45, 0.22) 0%, transparent 65%),
                            linear-gradient(180deg, rgba(10, 4, 5, 0.5) 0%, rgba(10, 4, 5, 0.8) 100%),
                            url('${imgUrl}');
                    }`;
                    document.head.appendChild(s);
                }
            } else {
                if (document.body.classList.contains('rivalry-dungeon-mode')) {
                    document.body.classList.remove('rivalry-dungeon-mode');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
                const themeLabel = document.getElementById('theme-toggle-label');
                if (themeLabel) {
                    themeLabel.textContent = `Theme: Light`;
                }
            }

            if (tab === 'home') {
                btnHome && btnHome.classList.add('active');
                viewHome && viewHome.classList.add('active');
            } else if (tab === 'h2h') {
                btnH2h && btnH2h.classList.add('active');
                viewH2h && viewH2h.classList.add('active');
                this.renderH2H();
            } else if (tab === 'records') {
                btnRecords && btnRecords.classList.add('active');
                viewRecords && viewRecords.classList.add('active');
                this.renderRecordBook();
            } else if (tab === 'draft') {
                btnDraft && btnDraft.classList.add('active');
                viewDraft && viewDraft.classList.add('active');
                this.renderDraft();
            } else if (tab === 'rivalry') {
                btnRivalry && btnRivalry.classList.add('active');
                viewRivalry && viewRivalry.classList.add('active');
                if (typeof this.renderRivalryWeek === 'function') {
                    this.renderRivalryWeek();
                }
            } else if (tab === 'admin') {
                btnAdmin && btnAdmin.classList.add('active');
                viewAdmin && viewAdmin.classList.add('active');
                this.renderAdminDashboard();
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        if (btnHome) btnHome.addEventListener('click', () => switchTab('home'));
        if (btnH2h) btnH2h.addEventListener('click', () => switchTab('h2h'));
        if (btnRecords) btnRecords.addEventListener('click', () => switchTab('records'));
        if (btnDraft) btnDraft.addEventListener('click', () => switchTab('draft'));
        if (btnRivalry) btnRivalry.addEventListener('click', () => switchTab('rivalry'));
        if (btnAdmin) btnAdmin.addEventListener('click', () => switchTab('admin'));

        this.checkAdminAccess();
        window.addEventListener('vault_auth_changed', () => this.checkAdminAccess());

        // Setup smooth scrolling for "On This Page" subnav pills on League Home
        const scrollerLinks = document.querySelectorAll('.scroller-pill');
        scrollerLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href');
                if (targetId && targetId.startsWith('#')) {
                    e.preventDefault();
                    const el = document.querySelector(targetId);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                }
            });
        });
    }

    checkAdminAccess() {
        const btnAdmin = document.getElementById('btn-tab-admin');
        if (!btnAdmin) return;
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const isFounder = Boolean(session && (session.isFounder || (session.email && session.email.toLowerCase() === 'landonekatz@gmail.com')));
        const isAdmin = session && ((session.adminLeagues && (session.adminLeagues.includes('dmsfantasy') || session.adminLeagues.includes('dms'))) || isFounder);
        if (isAdmin) {
            btnAdmin.style.display = 'inline-flex';
        } else {
            btnAdmin.style.display = 'none';
        }
        if (this.notesEngine) {
            this.notesEngine.render();
        }
    }

    renderAdminDashboard() {
        const container = document.getElementById('view-admin');
        if (!container) return;
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const leagueName = this.leagueSettings?.name || "The Dumbarton Fantasy Football League HQ";
        const leagueSlug = "dmsfantasy";
        const currentTagline = this.leagueSettings?.tagline || this.leagueSettings?.subtitle || "8 Seasons • 15 Managers • One Vault";
        if (!this.leagueSettings) this.leagueSettings = {};
        if (!this.leagueSettings.join_code) {
            this.leagueSettings.join_code = 'DNFUAM';
        }
        const joinCode = this.leagueSettings.join_code.toUpperCase();
        const joinLink = `${window.location.origin}/dmsfantasy/?join=${joinCode}`;
        const isPrivate = Boolean(this.leagueSettings?.is_private);

        const memberList = (this.managers && this.managers.length > 0) ? this.managers : [];
        const sortedMembers = [...memberList].sort((a, b) => (a.canonical_name || a.name || '').localeCompare(b.canonical_name || b.name || ''));

        // Check if the current admin has claimed a profile in this league
        const currentAdminClaim = session ? (session.claims?.[leagueSlug] || (this.claims && Object.entries(this.claims).find(([k, v]) => v?.email === session.email)?.[0])) : null;
        const unclaimedMembers = sortedMembers.filter(m => !this.claims || !this.claims[m.id]);
        
        // Build 3-column table rows: Manager Name (input + Save) | Active Seasons | Claim Actions
        const managerRows = sortedMembers.map(m => {
            const memberMatchups = (this.matchups || []).filter(x => x.home_manager_id === m.id || x.away_manager_id === m.id || x.team_1_manager_id === m.id || x.team_2_manager_id === m.id);
            const yearsActive = [...new Set(memberMatchups.map(x => x.year || x.season).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
            const yearsStr = yearsActive.length > 0 ? `${yearsActive[0]}–${yearsActive[yearsActive.length - 1]} (${yearsActive.length} yr${yearsActive.length > 1 ? 's' : ''})` : 'Active';
            
            const mName = m.canonical_name || m.name || m.id;
            const claim = this.claims ? this.claims[m.id] : null;
            const claimEmail = claim ? (claim.email || claim.name || 'Claimed') : '';
            const isClaimed = Boolean(claim);

            return `
                <tr data-manager-id="${m.id}">
                    <td style="padding: 8px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <input type="text" class="admin-input mgr-rename-input" value="${mName}" placeholder="Full Name" style="flex: 1; min-width: 140px; padding: 6px 8px; font-size: 0.86rem; font-weight: 600; box-sizing: border-box; border: 1px solid var(--border-line); border-radius: 4px;">
                            <button class="btn-save-manager-name btn btn-sm btn-primary" data-manager-id="${m.id}" style="padding: 5px 12px; font-size: 0.76rem; font-weight: 600; cursor: pointer; white-space: nowrap; border-radius: 4px;">Save</button>
                        </div>
                    </td>
                    <td style="padding: 8px; font-size: 0.82rem; color: var(--text-muted); font-weight: 500; white-space: nowrap;">${yearsStr}</td>
                    <td style="padding: 8px;">
                        <div class="admin-actions-cell" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            ${isClaimed ? `
                                <span class="badge-registered" style="font-size: 0.72rem; padding: 3px 8px; background: #ecfdf5; color: #065f46; border-radius: 4px; border: 1px solid #a7f3d0; font-weight: 600;" title="Claimed by ${claimEmail}">
                                    ✓ ${claimEmail}
                                </span>
                                <button class="btn-reassign-manager btn btn-sm" data-manager-id="${m.id}" data-manager-name="${mName}" style="padding: 3px 8px; font-size: 0.72rem; border: 1px solid var(--border-line); background: #fff; border-radius: 4px; cursor: pointer;">Reassign</button>
                            ` : `
                                <span class="badge-unregistered" style="font-size: 0.72rem; padding: 3px 8px; background: #f8fafc; color: #475569; border-radius: 4px; border: 1px solid #cbd5e1; font-weight: 600;">Unclaimed</span>
                                <button class="btn-copy-claim-link btn btn-sm" data-manager-id="${m.id}" data-manager-name="${mName}" style="padding: 4px 8px; font-size: 0.72rem; font-weight: 600; background: #f8fafc; border: 1px solid var(--border-line); border-radius: 4px; cursor: pointer;">Copy Link</button>
                                <button class="btn-email-claim-link btn btn-sm btn-primary" data-manager-id="${m.id}" data-manager-name="${mName}" style="padding: 4px 8px; font-size: 0.72rem; font-weight: 600; cursor: pointer; border-radius: 4px;">Email Link</button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const unclaimedOptions = unclaimedMembers.map(m => `<option value="${m.id}">${m.canonical_name || m.name || m.id}</option>`).join('');
        const allowNicknames = this.leagueSettings?.allow_nicknames !== false;

        const distinctYears = [...new Set((this.standings || []).map(s => Number(s.season || s.year)).filter(Boolean))].sort((a, b) => b - a);
        const activeYearsList = distinctYears.length > 0 ? distinctYears : [new Date().getFullYear()];
        const seasonOptions = activeYearsList.map(y => `<option value="${y}">Season ${y}</option>`).join('');

        const managerOptions = sortedMembers.map(m => `<option value="${m.id}">${m.canonical_name || m.name || m.id}</option>`).join('');

        container.innerHTML = `
            <div class="admin-dashboard-container">

                <!-- Sticky Settings Sidebar -->
                <aside class="admin-sidebar" id="admin-settings-sidebar">
                    <div class="admin-sidebar-header">
                        <div class="admin-sidebar-title-row">
                            <span class="admin-sidebar-title">League Settings</span>
                            <span class="admin-sidebar-badge">Admin</span>
                        </div>
                        <p class="admin-sidebar-subtitle">Navigation &amp; Controls</p>
                    </div>

                    <nav class="admin-sidebar-nav">
                        <!-- Group 1: General & Branding -->
                        <div class="admin-sidebar-group">
                            <div class="admin-sidebar-group-title">General &amp; Branding</div>

                            <a href="#admin-sec-identity" class="admin-nav-item active" data-section="admin-sec-identity">
                                <span class="admin-nav-item-title">Identity &amp; Motto</span>
                                <span class="admin-nav-item-sub">Title, Motto, Tagline</span>
                            </a>

                            <a href="#admin-sec-nicknames" class="admin-nav-item" data-section="admin-sec-nicknames">
                                <span class="admin-nav-item-title">Manager Nicknames</span>
                                <span class="admin-nav-item-sub">Custom Quotes Toggle</span>
                            </a>
                        </div>

                        <!-- Group 2: Editorials & Publishing -->
                        <div class="admin-sidebar-group">
                            <div class="admin-sidebar-group-title">Editorials &amp; Publishing</div>

                            <a href="#admin-sec-notes" class="admin-nav-item" data-section="admin-sec-notes">
                                <span class="admin-nav-item-title">Commissioner Notes</span>
                                <span class="admin-nav-item-sub">Announcements, Editors</span>
                            </a>

                            <a href="#admin-sec-power-rankings" class="admin-nav-item" data-section="admin-sec-power-rankings">
                                <span class="admin-nav-item-title">Power Rankings</span>
                                <span class="admin-nav-item-sub">Rankings, Authors</span>
                            </a>
                        </div>

                        <!-- Group 3: Competition & Rules -->
                        <div class="admin-sidebar-group">
                            <div class="admin-sidebar-group-title">Competition &amp; Rules</div>

                            <a href="#admin-sec-loser" class="admin-nav-item" data-section="admin-sec-loser">
                                <span class="admin-nav-item-title">Loser Conditions</span>
                                <span class="admin-nav-item-sub">Last Place &amp; Punishments</span>
                            </a>
                        </div>

                        <!-- Group 4: Members & Security -->
                        <div class="admin-sidebar-group">
                            <div class="admin-sidebar-group-title">Members &amp; Security</div>

                            <a href="#admin-sec-privacy" class="admin-nav-item" data-section="admin-sec-privacy">
                                <span class="admin-nav-item-title">Privacy &amp; Access</span>
                                <span class="admin-nav-item-sub">Public / Private Vault</span>
                            </a>

                            <a href="#admin-sec-roster" class="admin-nav-item" data-section="admin-sec-roster">
                                <span class="admin-nav-item-title">Manager Roster</span>
                                <span class="admin-nav-item-sub">Renaming, Merging, Claims</span>
                            </a>

                            <a href="#admin-sec-invites" class="admin-nav-item" data-section="admin-sec-invites">
                                <span class="admin-nav-item-title">Invites &amp; Join Codes</span>
                                <span class="admin-nav-item-sub">Join Code, Direct Links</span>
                            </a>

                            <a href="#admin-sec-transfer" class="admin-nav-item" data-section="admin-sec-transfer">
                                <span class="admin-nav-item-title">Administrator Role</span>
                                <span class="admin-nav-item-sub">Admin Email, Transfer</span>
                            </a>
                        </div>
                    </nav>
                </aside>

                <!-- Main Settings Content Area -->
                <main class="admin-main-content">

                <!-- Retrospective Admin Self-Claim Card (If Admin Has No Claimed Profile) -->
                ${!currentAdminClaim ? `
                    <div class="card admin-section-card" style="background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; padding: 1.25rem 1.5rem; border-radius: 8px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                            <div>
                                <div style="font-size: 0.82rem; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Claim Your Manager Profile (League Admin)</div>
                                <p style="font-size: 0.88rem; color: #78350f; margin: 0; line-height: 1.45;">
                                    You are currently administering this league as <strong>${session?.email || 'Admin'}</strong>, but haven't linked your manager profile yet. Select your team to track your personal career stats, win/loss records, and head-to-head history.
                                </p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <select id="admin-self-claim-select" class="admin-select" style="min-width: 180px; padding: 6px 10px; font-size: 0.85rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff;">
                                    <option value="">-- Select Your Team --</option>
                                    ${unclaimedOptions}
                                </select>
                                <button id="btn-admin-self-claim" class="btn btn-primary" style="padding: 7px 14px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer; white-space: nowrap;">Claim Profile</button>
                            </div>
                        </div>
                        <div id="admin-self-claim-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>
                ` : ''}

                <!-- 1. IDENTITY & CUSTOMIZATION -->
                <div id="admin-sec-identity" class="card admin-section-card">
                    <div class="admin-card-header">
                        <h2>League Identity &amp; Customization</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Customize your official masthead title and subtitle motto.</p>
                    </div>

                    <!-- Note from Landon for Tagline Customization -->
                    <div class="admin-landon-note">
                        <div class="landon-avatar">LK</div>
                        <div>
                            <div class="landon-note-title">A Note from the Founder, Landon</div>
                            <p class="landon-note-text">
                                Hey, this is one of the first points of customization for your league. Feel free to make the league tagline a tradition, as maybe the champion gets to create the tagline for the next year! That's something you as the admin have control of. I've included below some sample taglines that I came up with in a quick brainstorm, and I'll keep adding more, but feel free to make one up on your own as well.
                            </p>
                        </div>
                    </div>

                    <!-- Custom League Title -->
                    <div style="margin-top: 1.25rem;">
                        <label for="admin-league-title-input" style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: var(--text-secondary);">Custom League Title:</label>
                        <div class="tagline-input-row">
                            <input type="text" id="admin-league-title-input" class="admin-input" value="${leagueName}" placeholder="e.g. The Dumbarton League HQ">
                            <button id="btn-save-league-title" class="btn btn-primary">Save Title</button>
                        </div>
                        <div id="title-save-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.5rem;"></div>
                    </div>

                    <!-- Tagline Customization -->
                    <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
                        <label for="admin-tagline-input" style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: var(--text-secondary);">League Tagline / Subtitle Motto:</label>
                        <div class="tagline-presets-wrapper">
                            <button type="button" class="btn-tagline-preset" data-preset="Variance is an excuse for incompetence">"Variance is an excuse for incompetence"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Landon is the greatest fantasy player of all time">"Landon is the greatest fantasy player of all time"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Fantasy in name only">"Fantasy in name only"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Inside joke">"Inside joke"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="In a league of our own">"In a league of our own"</button>
                        </div>
                        <div class="tagline-input-row">
                            <input type="text" id="admin-tagline-input" class="admin-input" value="${currentTagline}" placeholder="Enter custom motto...">
                            <button id="btn-save-tagline" class="btn btn-primary">Save Tagline</button>
                        </div>
                        <div id="tagline-save-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.5rem;"></div>
                    </div>
                </div>

                <!-- 2. LEAGUE NICKNAMES CUSTOMIZATION -->
                <div id="admin-sec-nicknames" class="card admin-section-card">
                    <div class="admin-card-header">
                        <h2>League Nicknames Customization</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Enable or disable custom manager nicknames across your league archive.</p>
                    </div>
                    <div style="padding: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                    <strong style="font-size: 1rem; color: var(--text-primary);">Nickname Status:</strong>
                                    <span id="admin-nickname-badge" style="display: inline-block; font-size: 0.78rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; ${allowNicknames ? 'background:#dcfce7; color:#15803d;' : 'background:#f1f5f9; color:#64748b;'}">
                                        ${allowNicknames ? 'Nicknames: Enabled' : 'Nicknames: Disabled'}
                                    </span>
                                </div>
                                <p id="admin-nickname-desc" style="margin: 0 0 6px 0; font-size: 0.86rem; color: var(--text-secondary); line-height: 1.5; max-width: 650px;">
                                    This is another point of customization for your league, and you can enable nicknames for your league members to be displayed if you so choose. When enabled, custom nicknames will appear formatted in quotes (e.g. <em>John "Downtown" Brown</em> or <em>Landon "The Commish"</em>) throughout your vault in Head-to-Head matchups, Draft Central, and the Record Book.
                                </p>
                                <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted); line-height: 1.45; max-width: 650px;">
                                    You and your league members can assign and edit your individual nicknames anytime in the <strong>My Account</strong> tab located in the top right of the navigation bar.
                                </p>
                            </div>
                            <button id="btn-toggle-nicknames" class="btn" style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; cursor: pointer; border-radius: 6px; ${allowNicknames ? 'background:#475569; color:#fff; border:none;' : 'background:var(--accent-gold, #991b1b); color:#fff; border:none;'}">
                                ${allowNicknames ? 'Disable League Nicknames' : 'Enable League Nicknames'}
                            </button>
                        </div>
                        <div id="nickname-toggle-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>
                </div>

                <!-- 3. COMMISSIONER NOTES & LEAGUE UPDATES -->
                <div id="admin-sec-notes" class="card admin-section-card">
                    <!-- Populated by CommissionerNotesEngine -->
                </div>

                <!-- 4. POWER RANKINGS & PUBLISHING PERMISSIONS -->
                <div id="admin-sec-power-rankings" class="card admin-section-card">
                    <!-- Populated by PowerRankingsEngine -->
                </div>

                <!-- 3. LEAGUE LOSER CONDITIONS -->
                <div id="admin-sec-loser" class="card admin-section-card">
                    <div class="admin-card-header">
                        <h2>League Loser Conditions</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Configure the exact timing, pool, and ordered criteria that determine the outright loser for each season.</p>
                    </div>

                    <div style="margin-top: 1.25rem;">
                        <!-- Season Selector & Current Loser Display -->
                        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem;">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <label for="admin-loser-season-select" style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Select Season:</label>
                                    <select id="admin-loser-season-select" class="admin-select" style="min-width: 150px; padding: 6px 12px; font-weight: 700; font-size: 0.9rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                                        ${seasonOptions}
                                    </select>
                                </div>
                                <div id="admin-loser-active-pill" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(153, 27, 27, 0.1); border: 1px solid rgba(153, 27, 27, 0.35); padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; color: #991b1b;">
                                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #991b1b;"></span>
                                    <span id="admin-loser-rule-label">Custom Loser Condition</span>
                                </div>
                            </div>

                            <!-- Current Rule & Calculated Loser Box -->
                            <div id="admin-loser-current-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid var(--accent-gold, #991b1b); border-radius: 6px; padding: 1rem 1.25rem;">
                                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                                    <div>
                                        <div style="font-size: 0.76rem; font-weight: 800; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Current Season Rule &amp; Result</div>
                                        <div id="admin-loser-current-desc" style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 6px;">
                                            12th Place (Toilet Bowl / Consolation Bracket Loser)
                                        </div>
                                        <div id="admin-loser-current-winner" style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">
                                            Designated Loser: <span style="color: #dc2626;" id="admin-loser-current-name">Loading...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Rule Presets -->
                        <div style="margin-bottom: 1.25rem;">
                            <label style="display: block; font-size: 0.78rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px;">
                                Quick Presets:
                            </label>
                            <div class="loser-presets-wrapper">
                                <button type="button" class="btn-loser-preset" data-preset="standard">12th Place Bracket (Standard)</button>
                                <button type="button" class="btn-loser-preset" data-preset="full_least_pts">Outright Least Pts (Full Season)</button>
                                <button type="button" class="btn-loser-preset" data-preset="reg_least_pts">Least Pts (Regular Season)</button>
                                <button type="button" class="btn-loser-preset" data-preset="worst_record_pts">Worst Record, Tiebreak Least Pts</button>
                                <button type="button" class="btn-loser-preset" data-preset="non_playoff_least_pts">Non-Playoff Fewest Pts</button>
                            </div>
                        </div>

                        <!-- Custom Rule Builder Form -->
                        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.25rem;">
                            <div style="font-size: 0.78rem; font-weight: 800; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                                Custom Loser Rule Configuration:
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 1.25rem;">
                                <!-- 1. Scope / Timing -->
                                <div>
                                    <label for="admin-loser-scope" style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">1. Timing Window (Scope):</label>
                                    <select id="admin-loser-scope" class="admin-select" style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                                        <option value="bracket_playoffs">Playoff Bracket / Consolation Rank</option>
                                        <option value="full_season">Full Season (Regular Season + Playoffs Combined)</option>
                                        <option value="regular_season">Regular Season Only (Weeks 1–14/15)</option>
                                    </select>
                                </div>

                                <!-- 2. Candidate Pool -->
                                <div>
                                    <label for="admin-loser-pool" style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">2. Eligible Team Pool:</label>
                                    <select id="admin-loser-pool" class="admin-select" style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                                        <option value="all_teams">All 12 League Members Outright</option>
                                        <option value="non_playoff_teams">Non-Playoff Teams (Bottom 6 Missed Playoffs)</option>
                                        <option value="bracket_consolation">Consolation Bracket Teams</option>
                                    </select>
                                </div>

                                <!-- 3. Primary Condition -->
                                <div>
                                    <label for="admin-loser-crit1" style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">3. Primary Condition (1st Order):</label>
                                    <select id="admin-loser-crit1" class="admin-select" style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                                        <option value="least_points">Least Points Scored (Lowest PF)</option>
                                        <option value="worst_record">Worst Record / Win Percentage</option>
                                        <option value="final_rank">Bracket Placement (12th Place)</option>
                                        <option value="most_points_against">Most Points Against (Highest PA)</option>
                                    </select>
                                </div>

                                <!-- 4. Secondary Tiebreaker -->
                                <div>
                                    <label for="admin-loser-crit2" style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">4. First Tiebreaker (2nd Order):</label>
                                    <select id="admin-loser-crit2" class="admin-select" style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);">
                                        <option value="least_points">Least Points Scored</option>
                                        <option value="worst_record">Worst Record / Win Percentage</option>
                                        <option value="most_points_against">Most Points Against</option>
                                        <option value="head_to_head">Head-to-Head Record</option>
                                        <option value="none">None (Standard Fallback)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Manual Override Accordion / Checkbox -->
                            <div style="padding-top: 1rem; border-top: 1px solid var(--border-color); margin-bottom: 1.25rem;">
                                <label style="display: inline-flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 700; color: var(--text-primary); cursor: pointer;">
                                    <input type="checkbox" id="admin-loser-manual-toggle" style="cursor: pointer;">
                                    Manually Designate Specific Manager as Loser (Custom Punishment / Exception)
                                </label>

                                <div id="admin-loser-manual-fields" style="display: none; margin-top: 10px; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px;">
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                                        <div>
                                            <label for="admin-loser-manual-mgr" style="display: block; font-size: 0.78rem; font-weight: 700; margin-bottom: 4px; color: var(--text-secondary);">Select Designated Manager:</label>
                                            <select id="admin-loser-manual-mgr" class="admin-select" style="width: 100%; padding: 6px 10px; font-size: 0.85rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary);">
                                                <option value="">-- Choose Manager --</option>
                                                ${managerOptions}
                                            </select>
                                        </div>
                                        <div>
                                            <label for="admin-loser-manual-reason" style="display: block; font-size: 0.78rem; font-weight: 700; margin-bottom: 4px; color: var(--text-secondary);">Custom Reason / Punishment Details:</label>
                                            <input type="text" id="admin-loser-manual-reason" class="admin-input" placeholder="e.g. Lost custom Week 17 Sacko punishment match" style="width: 100%; padding: 6px 10px; font-size: 0.85rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-surface); box-sizing: border-box;">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Live Dynamic Preview of Calculated Loser -->
                            <div style="background: rgba(153, 27, 27, 0.03); border: 1px dashed var(--border-color); border-radius: 6px; padding: 12px 16px; margin-bottom: 1.25rem;">
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                                    <div>
                                        <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Live Preview (Result of Current Form Settings)</div>
                                        <div id="admin-loser-preview-text" style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
                                            Projected Loser: <span style="color: #dc2626;" id="admin-loser-preview-name">Calculating...</span>
                                        </div>
                                        <div id="admin-loser-preview-stats" style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <button id="btn-save-loser-condition" class="btn btn-primary" style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; cursor: pointer; white-space: nowrap;">
                                    Save Rule for <span id="btn-loser-save-year-label">Selected Season</span>
                                </button>
                                <button id="btn-apply-future-loser-conditions" class="btn btn-gold" style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; cursor: pointer; white-space: nowrap;">
                                    Apply Rule as Future Default
                                </button>
                                <button id="btn-apply-all-loser-conditions" class="btn btn-secondary-action" style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; cursor: pointer; white-space: nowrap;">
                                    Apply Rule to All Seasons (Past &amp; Future)
                                </button>
                                <button id="btn-reset-loser-condition" class="btn" style="padding: 9px 16px; font-weight: 600; font-size: 0.82rem; border-radius: 6px; cursor: pointer; white-space: nowrap; background: transparent; border: 1px solid var(--border-color); color: var(--text-muted);">
                                    Reset to Standard (12th Place)
                                </button>
                            </div>
                            <div id="loser-condition-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                        </div>
                    </div>
                </div>

                <!-- 4. PRIVACY & ACCESS CONTROL -->
                <div id="admin-sec-privacy" class="card admin-section-card">
                    <div class="admin-card-header">
                        <h2>League Privacy &amp; Access Control</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Control whether your archive is publicly readable or restricted to signed-in league members.</p>
                    </div>
                    <div style="padding: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                    <strong style="font-size: 1rem; color: var(--text-primary);">Vault Access:</strong>
                                    <span id="admin-privacy-badge" style="display: inline-block; font-size: 0.78rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; ${isPrivate ? 'background:#fee2e2; color:#dc2626;' : 'background:#dcfce7; color:#15803d;'}\">
                                        ${isPrivate ? 'Private (Invite &amp; SSO Guarded)' : 'Public (Open Link Access)'}
                                    </span>
                                </div>
                                <p id="admin-privacy-desc" style="margin: 0; font-size: 0.84rem; color: var(--text-muted); line-height: 1.45; max-width: 600px;">
                                    ${isPrivate 
                                        ? 'Private vaults require managers to be logged in to view your archive, draft records, and record books.' 
                                        : 'Public vaults allow anyone with your league link to explore your history, record books, and draft analysis.'}
                                </p>
                            </div>
                            <button id="btn-toggle-privacy" class="btn" style="padding: 8px 16px; font-weight: 700; font-size: 0.85rem; cursor: pointer; border-radius: 6px; ${isPrivate ? 'background:#15803d; color:#fff; border:none;' : 'background:#475569; color:#fff; border:none;'}">
                                ${isPrivate ? 'Make League Public' : 'Make League Private'}
                            </button>
                        </div>
                        <div id="privacy-toggle-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>
                </div>

                <!-- 5. REGISTERED MEMBERS & MANAGER ROSTER -->
                <div id="admin-sec-roster" class="card admin-section-card">
                    <div class="admin-card-header">
                        <h2>League Members Roster</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Manage manager display names, copy personalized claim links, and manage account assignments.</p>
                    </div>

                    <div style="margin-top: 1.25rem;">
                        <div class="admin-table-scroll">
                            <table class="admin-table">
                                <thead>
                                    <tr>
                                        <th style="width: 45%;">Manager Display Name</th>
                                        <th style="width: 20%;">Active Seasons</th>
                                        <th style="width: 35%;">Account &amp; Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${managerRows}
                                </tbody>
                            </table>
                        </div>
                        <div id="manager-rename-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>
                </div>

                <!-- 6. LEAGUE INVITES & ACCESS -->
                <div id="admin-sec-invites" class="card admin-section-card">
                    <div class="admin-card-header">
                        <h2>League Invites &amp; Access Control</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Share your official join code and direct invite links with league members to grant them access to this vault.</p>
                    </div>

                    <div class="admin-invite-grid" style="margin-top: 1.25rem;">
                        <div class="admin-invite-box">
                            <span class="invite-label">Official Join Code:</span>
                            <div class="invite-value-row">
                                <code class="invite-code-pill">${joinCode}</code>
                                <button class="btn-copy-action btn btn-sm" data-copy="${joinCode}">Copy Code</button>
                            </div>
                        </div>
                        <div class="admin-invite-box" style="grid-column: span 2;">
                            <span class="invite-label">General League Invite Link:</span>
                            <div class="invite-value-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span class="invite-link-text">${joinLink}</span>
                                    <button class="btn-copy-action btn btn-sm btn-primary" data-copy="${joinLink}">Copy Link</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: 1.25rem; padding: 0.85rem 1rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px;">
                        <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted); line-height: 1.45;">
                            <strong>General Invite Notice:</strong> Share this general invite link with your league members. When they join using this link, they will be prompted to select and claim their manager profile from the roster.
                        </p>
                    </div>
                </div>

                <!-- 7. TRANSFER ADMIN STATUS -->
                <div id="admin-sec-transfer" class="card admin-section-card">
                    <div class="admin-card-header">
                        <h2>Transfer Admin Status</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Transfer official ownership and commissioner control of this league archive to another manager.</p>
                    </div>
                    <div style="padding: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 6px;">
                        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; margin: 0 0 1rem 0;">
                            Need to pass commissioner duties to another league member? You can invite a manager to take over admin status by email or by copying an admin transfer link. When they accept and sign in, full commissioner permissions will be transferred to their account.
                        </p>
                        <button id="btn-open-transfer-admin-modal" class="btn btn-gold" style="padding: 8px 16px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; cursor: pointer;">Transfer Admin Status</button>
                    </div>
                </div>
                </main>
            </div>
        `;

        // Wire up Retrospective Admin Self-Claim
        const btnSelfClaim = container.querySelector('#btn-admin-self-claim');
        const selectSelfClaim = container.querySelector('#admin-self-claim-select');
        if (btnSelfClaim && selectSelfClaim) {
            btnSelfClaim.addEventListener('click', async () => {
                const mgrId = selectSelfClaim.value;
                if (!mgrId) {
                    alert('Please select your manager profile.');
                    return;
                }
                const selectedMgr = sortedMembers.find(m => m.id === mgrId);
                const mgrName = selectedMgr?.canonical_name || selectedMgr?.name || mgrId;
                btnSelfClaim.disabled = true;
                btnSelfClaim.textContent = 'Claiming...';
                try {
                    await window.AuthEngine.claimManagerProfile(leagueSlug, mgrId, mgrName);
                    await window.AuthEngine.linkUserLeague(leagueSlug, 'admin', leagueName);

                    if (!this.claims) this.claims = {};
                    this.claims[mgrId] = {
                        userId: session?.uid,
                        email: session?.email,
                        name: mgrName,
                        claimedAt: new Date().toISOString()
                    };
                    if (session) {
                        if (!session.claims) session.claims = {};
                        session.claims[leagueSlug] = mgrId;
                    }
                    try {
                        localStorage.setItem(`vault_claims_${leagueSlug}`, JSON.stringify(this.claims));
                    } catch (e) {}

                    const feedbackEl = document.getElementById('admin-self-claim-feedback');
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.style.color = '#15803d';
                        feedbackEl.innerHTML = `✓ Successfully linked your profile as <strong>${mgrName}</strong>!`;
                    }
                    setTimeout(() => { this.renderAdminDashboard(); }, 1000);
                } catch (e) {
                    console.error('Failed to self claim', e);
                    alert('Failed to link profile.');
                } finally {
                    btnSelfClaim.disabled = false;
                    btnSelfClaim.textContent = 'Claim Profile';
                }
            });
        }

        // Wire up Tagline preset buttons
        container.querySelectorAll('.btn-tagline-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-preset');
                const taglineInput = container.querySelector('#admin-tagline-input');
                if (taglineInput && text) {
                    taglineInput.value = text;
                    taglineInput.focus();
                }
            });
        });

        // Render Commissioner Notes admin section
        if (this.notesEngine) {
            this.notesEngine.renderAdminSection(container.querySelector('#admin-sec-notes'));
        }

        // Render Power Rankings admin section
        if (this.powerRankingsEngine) {
            this.powerRankingsEngine.renderAdminSection(container.querySelector('#admin-sec-power-rankings'));
        }

        // Wire up Save Tagline button
        container.querySelector('#btn-save-tagline')?.addEventListener('click', async () => {
            const taglineInput = container.querySelector('#admin-tagline-input');
            const newTagline = taglineInput?.value.trim();
            if (!newTagline) return;
            const feedbackEl = document.getElementById('tagline-save-feedback');
            try {
                if (!this.leagueSettings) this.leagueSettings = {};
                this.leagueSettings.tagline = newTagline;
                
                // Live update masthead subtitle immediately
                const pEl = document.querySelector('.masthead-main p');
                if (pEl) pEl.textContent = newTagline;

                const settingsRef = dbRef(database, `leagues/dmsfantasy/league_settings`);
                await update(settingsRef, { tagline: newTagline });
                if (feedbackEl) {
                    feedbackEl.style.display = 'block';
                    feedbackEl.style.color = '#15803d';
                    feedbackEl.innerHTML = `✓ Tagline updated to: "<em>${newTagline}</em>"`;
                    setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                }
            } catch (e) {
                console.error('Failed to save tagline', e);
            }
        });

        // Wire up Save Title button
        container.querySelector('#btn-save-league-title')?.addEventListener('click', async () => {
            const titleInput = container.querySelector('#admin-league-title-input');
            const newTitle = titleInput?.value.trim();
            if (!newTitle) return;
            const feedbackEl = document.getElementById('title-save-feedback');
            try {
                if (!this.leagueSettings) this.leagueSettings = {};
                this.leagueSettings.name = newTitle;

                // Live update masthead title immediately
                const h1El = document.querySelector('.masthead-main h1');
                if (h1El) {
                    const hasLeagueSuffix = /league$/i.test(newTitle.trim());
                    h1El.innerHTML = `${newTitle}<br>${hasLeagueSuffix ? 'HQ' : 'League HQ'}`;
                }
                document.title = `${newTitle} HQ`;

                const settingsRef = dbRef(database, `leagues/dmsfantasy/league_settings`);
                await update(settingsRef, { name: newTitle });
                if (feedbackEl) {
                    feedbackEl.style.display = 'block';
                    feedbackEl.style.color = '#15803d';
                    feedbackEl.innerHTML = `✓ League title updated to "<strong>${newTitle}</strong>"!`;
                    setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                }
            } catch (e) {
                console.error('Failed to save title', e);
            }
        });

        // Wire up Transfer Admin Status modal opener
        container.querySelector('#btn-open-transfer-admin-modal')?.addEventListener('click', () => {
            if (typeof window.openAdminTransferModal === 'function') {
                window.openAdminTransferModal(leagueSlug);
            }
        });

        // Wire up Manager Rename buttons
        container.querySelectorAll('.btn-save-manager-name').forEach(btn => {
            btn.addEventListener('click', async () => {
                const mgrId = btn.getAttribute('data-manager-id');
                const row = container.querySelector(`tr[data-manager-id="${mgrId}"]`);
                const nameInput = row ? row.querySelector('.mgr-rename-input') : null;
                if (!nameInput) return;
                const newName = nameInput.value.trim();
                if (!newName) {
                    alert("Manager display name cannot be empty.");
                    return;
                }
                const orig = btn.textContent;
                btn.disabled = true;
                btn.textContent = 'Saving...';
                await this.updateManagerName(mgrId, newName);
                btn.disabled = false;
                btn.textContent = orig;
            });
        });

        // Wire up Toggle Nicknames button
        const btnToggleNicknames = container.querySelector('#btn-toggle-nicknames');
        if (btnToggleNicknames) {
            btnToggleNicknames.addEventListener('click', async () => {
                const currentAllow = this.leagueSettings?.allow_nicknames !== false;
                await this.toggleLeagueNicknames(!currentAllow);
            });
        }

        // Wire up Privacy Toggle
        const btnTogglePrivacy = container.querySelector('#btn-toggle-privacy');
        if (btnTogglePrivacy) {
            btnTogglePrivacy.addEventListener('click', async () => {
                const currentPrivate = Boolean(this.leagueSettings?.is_private);
                const nextPrivate = !currentPrivate;
                btnTogglePrivacy.disabled = true;
                btnTogglePrivacy.textContent = 'Updating...';

                try {
                    if (!this.leagueSettings) this.leagueSettings = {};
                    this.leagueSettings.is_private = nextPrivate;
                    const settingsRef = dbRef(database, `leagues/dmsfantasy/league_settings`);
                    await update(settingsRef, { is_private: nextPrivate });

                    const feedbackEl = document.getElementById('privacy-toggle-feedback');
                    const badgeEl = document.getElementById('admin-privacy-badge');
                    const descEl = document.getElementById('admin-privacy-desc');

                    if (badgeEl) {
                        badgeEl.style.background = nextPrivate ? '#fee2e2' : '#dcfce7';
                        badgeEl.style.color = nextPrivate ? '#dc2626' : '#15803d';
                        badgeEl.textContent = nextPrivate ? 'Private (Invite &amp; SSO Guarded)' : 'Public (Open Link Access)';
                    }
                    if (descEl) {
                        descEl.textContent = nextPrivate 
                            ? 'Private vaults require managers to be logged in to view your archive, draft records, and record books.' 
                            : 'Public vaults allow anyone with your league link to explore your history, record books, and draft analysis.';
                    }
                    btnTogglePrivacy.style.background = nextPrivate ? '#15803d' : '#475569';
                    btnTogglePrivacy.textContent = nextPrivate ? 'Make League Public' : 'Make League Private';

                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.innerHTML = `✓ League access updated to <strong>${nextPrivate ? 'Private (Guarded)' : 'Public (Open)'}</strong>.`;
                        setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                    }
                } catch (e) {
                    console.error('Failed to toggle privacy', e);
                } finally {
                    btnTogglePrivacy.disabled = false;
                }
            });
        }

        // Wire up Copy Action buttons
        container.querySelectorAll('.btn-copy-action').forEach(btn => {
            btn.addEventListener('click', () => {
                const textToCopy = btn.getAttribute('data-copy');
                if (!textToCopy) return;
                const orig = btn.textContent;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    btn.textContent = 'Copied!';
                    setTimeout(() => { btn.textContent = orig; }, 2000);
                });
            });
        });

        // Wire up Copy Claim Link buttons on manager rows
        container.querySelectorAll('.btn-copy-claim-link').forEach(btn => {
            btn.addEventListener('click', () => {
                const mgrId = btn.getAttribute('data-manager-id');
                const mgrName = btn.getAttribute('data-manager-name');
                const claimLink = `${window.location.origin}/dmsfantasy/?action=claim_manager&manager=${encodeURIComponent(mgrId)}`;

                navigator.clipboard.writeText(claimLink).then(() => {
                    const orig = btn.textContent;
                    btn.textContent = 'Copied!';
                    const feedbackEl = document.getElementById('manager-claim-feedback');
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.innerHTML = `✓ Personalized claim link for <strong>${mgrName}</strong> copied to clipboard!<br><span style="font-family: monospace; font-size: 0.8rem;">${claimLink}</span>`;
                        setTimeout(() => { feedbackEl.style.display = 'none'; }, 6000);
                    }
                    setTimeout(() => { btn.textContent = orig; }, 2500);
                });
            });
        });

        // Wire up Email Claim Link buttons on manager rows
        container.querySelectorAll('.btn-email-claim-link').forEach(btn => {
            btn.addEventListener('click', () => {
                const mgrId = btn.getAttribute('data-manager-id');
                const mgrName = btn.getAttribute('data-manager-name');
                if (typeof window.openEmailClaimModal === 'function') {
                    window.openEmailClaimModal(leagueSlug, mgrId, mgrName);
                }
            });
        });

        // Wire up Reassign buttons on claimed manager rows
        container.querySelectorAll('.btn-reassign-manager').forEach(btn => {
            btn.addEventListener('click', async () => {
                const mgrId = btn.getAttribute('data-manager-id');
                const mgrName = btn.getAttribute('data-manager-name');
                const confirmReassign = window.confirm(
                    `Do you want to unlink and reassign the account claimed for "${mgrName}"?\n\n` +
                    `This will mark "${mgrName}" as Unclaimed so another email account can claim this manager profile.`
                );
                if (confirmReassign) {
                    if (this.claims && this.claims[mgrId]) {
                        delete this.claims[mgrId];
                    }
                    try {
                        const claimRef = dbRef(database, `leagues/dmsfantasy/claims/${mgrId}`);
                        await set(claimRef, null);
                    } catch (e) {
                        console.error('Failed to unlink claim', e);
                    }
                    this.renderAdminDashboard();
                }
            });
        });

        // Setup Loser Conditions Interactive System
        const loserSeasonSelect = container.querySelector('#admin-loser-season-select');
        const loserScopeSelect = container.querySelector('#admin-loser-scope');
        const loserPoolSelect = container.querySelector('#admin-loser-pool');
        const loserCrit1Select = container.querySelector('#admin-loser-crit1');
        const loserCrit2Select = container.querySelector('#admin-loser-crit2');
        const loserManualToggle = container.querySelector('#admin-loser-manual-toggle');
        const loserManualFields = container.querySelector('#admin-loser-manual-fields');
        const loserManualMgr = container.querySelector('#admin-loser-manual-mgr');
        const loserManualReason = container.querySelector('#admin-loser-manual-reason');

        const loserCurrentDesc = container.querySelector('#admin-loser-current-desc');
        const loserCurrentName = container.querySelector('#admin-loser-current-name');
        const loserRuleLabel = container.querySelector('#admin-loser-rule-label');
        const btnSaveYearLabel = container.querySelector('#btn-loser-save-year-label');

        const loserPreviewName = container.querySelector('#admin-loser-preview-name');
        const loserPreviewStats = container.querySelector('#admin-loser-preview-stats');

        const getSelectedYear = () => Number(loserSeasonSelect?.value || activeYearsList[0]);

        const getFormConfig = () => {
            const isManual = Boolean(loserManualToggle?.checked);
            if (isManual) {
                const targetMid = loserManualMgr?.value || '';
                const targetMgr = sortedMembers.find(m => m.id === targetMid);
                const reason = loserManualReason?.value?.trim() || '';
                return {
                    mode: 'manual',
                    designated_manager_id: targetMid,
                    designated_manager_name: targetMgr ? (targetMgr.canonical_name || targetMgr.name) : targetMid,
                    custom_reason: reason,
                    description: `Manual commissioner designation: ${reason || 'Custom League Punishment'}`
                };
            }

            const scope = loserScopeSelect?.value || 'bracket_playoffs';
            const pool = loserPoolSelect?.value || 'all_teams';
            const c1 = loserCrit1Select?.value || 'least_points';
            const c2 = loserCrit2Select?.value;

            const criteria = [
                { type: c1, order: c1 === 'most_points_against' ? 'desc' : 'asc' }
            ];
            if (c2 && c2 !== 'none') {
                criteria.push({ type: c2, order: c2 === 'most_points_against' ? 'desc' : 'asc' });
            }

            return {
                mode: 'custom',
                scope,
                pool,
                criteria,
                description: getRuleDescription({ scope, pool, criteria })
            };
        };

        const updateLoserPreview = () => {
            const yr = getSelectedYear();
            const formConfig = getFormConfig();
            const previewRes = calculateSeasonLoser(yr, this.standings, this.matchups, { [yr]: formConfig }, this.leagueSettings);
            if (previewRes && previewRes.manager_id) {
                const mgrName = this.getManagerName ? this.getManagerName(previewRes.manager_id, previewRes.manager_name) : (previewRes.manager_name || previewRes.manager_id);
                const tName = previewRes.team_name ? ` (${previewRes.team_name})` : '';
                if (loserPreviewName) loserPreviewName.innerHTML = `<strong>${mgrName}</strong>${tName}`;
                if (loserPreviewStats) loserPreviewStats.textContent = `${previewRes.stats_summary} , as ${previewRes.rule_description}`;
            } else {
                if (loserPreviewName) loserPreviewName.textContent = 'No standing data for selected season';
                if (loserPreviewStats) loserPreviewStats.textContent = '';
            }
        };

        const updateLoserUI = (yr) => {
            if (btnSaveYearLabel) btnSaveYearLabel.textContent = `Season ${yr}`;
            const conditionsMap = this.leagueSettings?.loser_conditions || {};
            const activeConfig = conditionsMap[yr] || conditionsMap[String(yr)] || conditionsMap['default'] || {
                mode: 'standard',
                scope: 'bracket_playoffs',
                pool: 'bracket_consolation',
                criteria: [{ type: 'final_rank', order: 'desc' }],
                description: 'Final Playoff / Consolation Bracket Rank (12th Place)'
            };

            // Update Current Result Box
            const currentRes = calculateSeasonLoser(yr, this.standings, this.matchups, this.leagueSettings?.loser_conditions, this.leagueSettings);
            if (currentRes && currentRes.manager_id) {
                const curMgr = this.getManagerName ? this.getManagerName(currentRes.manager_id, currentRes.manager_name) : (currentRes.manager_name || currentRes.manager_id);
                const curTeam = currentRes.team_name ? ` (${currentRes.team_name})` : '';
                if (loserCurrentDesc) loserCurrentDesc.textContent = currentRes.rule_description;
                if (loserCurrentName) loserCurrentName.innerHTML = `<strong>${curMgr}</strong>${curTeam} <span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal;">[${currentRes.stats_summary}]</span>`;
                if (loserRuleLabel) loserRuleLabel.textContent = (activeConfig.mode === 'standard' || !conditionsMap[yr]) ? 'Standard Bracket Rule' : 'Custom Configured Rule';
            } else {
                if (loserCurrentDesc) loserCurrentDesc.textContent = 'Standard Playoff Bracket Finish';
                if (loserCurrentName) loserCurrentName.textContent = 'No season data';
                if (loserRuleLabel) loserRuleLabel.textContent = 'Default Rule';
            }

            // Populate form controls
            if (activeConfig.mode === 'manual') {
                if (loserManualToggle) loserManualToggle.checked = true;
                if (loserManualFields) loserManualFields.style.display = 'block';
                if (loserManualMgr) loserManualMgr.value = activeConfig.designated_manager_id || '';
                if (loserManualReason) loserManualReason.value = activeConfig.custom_reason || '';
            } else {
                if (loserManualToggle) loserManualToggle.checked = false;
                if (loserManualFields) loserManualFields.style.display = 'none';
                if (loserScopeSelect) loserScopeSelect.value = activeConfig.scope || 'bracket_playoffs';
                if (loserPoolSelect) loserPoolSelect.value = activeConfig.pool || 'all_teams';
                if (loserCrit1Select) loserCrit1Select.value = activeConfig.criteria?.[0]?.type || activeConfig.criteria?.[0] || 'least_points';
                if (loserCrit2Select) loserCrit2Select.value = activeConfig.criteria?.[1]?.type || activeConfig.criteria?.[1] || 'none';
            }

            updateLoserPreview();
        };

        if (loserSeasonSelect) {
            loserSeasonSelect.addEventListener('change', () => {
                updateLoserUI(getSelectedYear());
            });
            // Initial load for first season
            updateLoserUI(getSelectedYear());
        }

        // Form change listeners for live preview
        [loserScopeSelect, loserPoolSelect, loserCrit1Select, loserCrit2Select, loserManualMgr, loserManualReason].forEach(el => {
            el?.addEventListener('change', updateLoserPreview);
            el?.addEventListener('input', updateLoserPreview);
        });

        loserManualToggle?.addEventListener('change', () => {
            if (loserManualFields) {
                loserManualFields.style.display = loserManualToggle.checked ? 'block' : 'none';
            }
            updateLoserPreview();
        });

        // Preset buttons
        container.querySelectorAll('.btn-loser-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.getAttribute('data-preset');
                if (loserManualToggle) loserManualToggle.checked = false;
                if (loserManualFields) loserManualFields.style.display = 'none';

                if (preset === 'standard') {
                    if (loserScopeSelect) loserScopeSelect.value = 'bracket_playoffs';
                    if (loserPoolSelect) loserPoolSelect.value = 'bracket_consolation';
                    if (loserCrit1Select) loserCrit1Select.value = 'final_rank';
                    if (loserCrit2Select) loserCrit2Select.value = 'none';
                } else if (preset === 'full_least_pts') {
                    if (loserScopeSelect) loserScopeSelect.value = 'full_season';
                    if (loserPoolSelect) loserPoolSelect.value = 'all_teams';
                    if (loserCrit1Select) loserCrit1Select.value = 'least_points';
                    if (loserCrit2Select) loserCrit2Select.value = 'worst_record';
                } else if (preset === 'reg_least_pts') {
                    if (loserScopeSelect) loserScopeSelect.value = 'regular_season';
                    if (loserPoolSelect) loserPoolSelect.value = 'all_teams';
                    if (loserCrit1Select) loserCrit1Select.value = 'least_points';
                    if (loserCrit2Select) loserCrit2Select.value = 'worst_record';
                } else if (preset === 'worst_record_pts') {
                    if (loserScopeSelect) loserScopeSelect.value = 'regular_season';
                    if (loserPoolSelect) loserPoolSelect.value = 'all_teams';
                    if (loserCrit1Select) loserCrit1Select.value = 'worst_record';
                    if (loserCrit2Select) loserCrit2Select.value = 'least_points';
                } else if (preset === 'non_playoff_least_pts') {
                    if (loserScopeSelect) loserScopeSelect.value = 'regular_season';
                    if (loserPoolSelect) loserPoolSelect.value = 'non_playoff_teams';
                    if (loserCrit1Select) loserCrit1Select.value = 'least_points';
                    if (loserCrit2Select) loserCrit2Select.value = 'worst_record';
                }
                updateLoserPreview();
            });
        });

        // Save Rule for Selected Season
        const btnSaveLoser = container.querySelector('#btn-save-loser-condition');
        if (btnSaveLoser) {
            btnSaveLoser.addEventListener('click', async () => {
                const yr = getSelectedYear();
                const formConfig = getFormConfig();
                const feedbackEl = document.getElementById('loser-condition-feedback');
                btnSaveLoser.disabled = true;
                btnSaveLoser.textContent = 'Saving...';
                try {
                    await this.saveLoserCondition(yr, formConfig);
                    if (typeof this.renderRecords === 'function') this.renderRecords();
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg success';
                        feedbackEl.innerHTML = `✓ Successfully saved loser condition for <strong>Season ${yr}</strong>!`;
                        setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                    }
                    updateLoserUI(yr);
                } catch (e) {
                    console.error('Failed to save loser condition', e);
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg error';
                        feedbackEl.textContent = 'Failed to save loser condition. Please try again.';
                    }
                } finally {
                    btnSaveLoser.disabled = false;
                    btnSaveLoser.textContent = `Save Rule for Season ${yr}`;
                }
            });
        }

        // Apply Rule as Future Default
        const btnApplyFutureLoser = container.querySelector('#btn-apply-future-loser-conditions');
        if (btnApplyFutureLoser) {
            btnApplyFutureLoser.addEventListener('click', async () => {
                const formConfig = getFormConfig();
                const confirmed = window.confirm("Set this rule as the new default loser condition for all future seasons?");
                if (!confirmed) return;

                const feedbackEl = document.getElementById('loser-condition-feedback');
                btnApplyFutureLoser.disabled = true;
                btnApplyFutureLoser.textContent = 'Setting Default...';
                try {
                    await this.applyLoserConditionToFutureSeasons(formConfig);
                    if (typeof this.renderRecords === 'function') this.renderRecords();
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg success';
                        feedbackEl.innerHTML = `✓ Set as the <strong>default loser condition</strong> for current and future seasons!`;
                        setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                    }
                    updateLoserUI(getSelectedYear());
                } catch (e) {
                    console.error('Failed to set future loser condition default', e);
                } finally {
                    btnApplyFutureLoser.disabled = false;
                    btnApplyFutureLoser.textContent = 'Apply Rule as Future Default';
                }
            });
        }

        // Apply Rule to All Seasons
        const btnApplyAllLoser = container.querySelector('#btn-apply-all-loser-conditions');
        if (btnApplyAllLoser) {
            btnApplyAllLoser.addEventListener('click', async () => {
                const formConfig = getFormConfig();
                const confirmed = window.confirm("Are you sure you want to apply this loser condition rule to ALL seasons in league history?");
                if (!confirmed) return;

                const feedbackEl = document.getElementById('loser-condition-feedback');
                btnApplyAllLoser.disabled = true;
                btnApplyAllLoser.textContent = 'Applying...';
                try {
                    await this.applyLoserConditionToAllSeasons(formConfig);
                    if (typeof this.renderRecords === 'function') this.renderRecords();
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg success';
                        feedbackEl.innerHTML = `✓ Applied loser condition rule to <strong>all seasons</strong> across league history!`;
                        setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                    }
                    updateLoserUI(getSelectedYear());
                } catch (e) {
                    console.error('Failed to apply loser conditions to all', e);
                } finally {
                    btnApplyAllLoser.disabled = false;
                    btnApplyAllLoser.textContent = 'Apply Rule to All Seasons (Past & Future)';
                }
            });
        }

        // Reset to Standard
        const btnResetLoser = container.querySelector('#btn-reset-loser-condition');
        if (btnResetLoser) {
            btnResetLoser.addEventListener('click', async () => {
                const yr = getSelectedYear();
                const feedbackEl = document.getElementById('loser-condition-feedback');
                btnResetLoser.disabled = true;
                try {
                    await this.resetLoserCondition(yr);
                    if (typeof this.renderRecords === 'function') this.renderRecords();
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg success';
                        feedbackEl.innerHTML = `✓ Reset Season ${yr} to standard 12th place bracket finish.`;
                        setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                    }
                    updateLoserUI(yr);
                } catch (e) {
                    console.error('Failed to reset loser condition', e);
                } finally {
                    btnResetLoser.disabled = false;
                }
            });
        }

        // Setup smooth scrolling & active ScrollSpy for Admin Settings Sidebar
        this.setupAdminSidebarScrollSpy(container);
    }

    setupAdminSidebarScrollSpy(container) {
        const sidebarLinks = container.querySelectorAll('.admin-nav-item');
        const sections = container.querySelectorAll('.admin-section-card');
        if (!sidebarLinks.length || !sections.length) return;

        // Smooth scroll on click
        sidebarLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href')?.replace('#', '');
                const targetEl = container.querySelector(`#${targetId}`);
                if (targetEl) {
                    const headerOffset = 90;
                    const elementPosition = targetEl.getBoundingClientRect().top;
                    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                    window.scrollTo({
                        top: offsetPosition,
                        behavior: 'smooth'
                    });
                    sidebarLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            });
        });

        // ScrollSpy observer
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.id;
                        sidebarLinks.forEach(link => {
                            if (link.getAttribute('data-section') === id || link.getAttribute('href') === `#${id}`) {
                                link.classList.add('active');
                            } else {
                                link.classList.remove('active');
                            }
                        });
                    }
                });
            }, {
                rootMargin: '-10% 0px -70% 0px'
            });

            sections.forEach(sec => observer.observe(sec));
        }
    }

    async saveLoserCondition(year, ruleConfig) {
        if (!this.leagueSettings) this.leagueSettings = {};
        if (!this.leagueSettings.loser_conditions) this.leagueSettings.loser_conditions = {};
        this.leagueSettings.loser_conditions[year] = ruleConfig;

        try {
            const loserRef = dbRef(database, `leagues/dmsfantasy/league_settings/loser_conditions/${year}`);
            await set(loserRef, ruleConfig);
        } catch (e) {
            console.error("Failed to save loser condition to Firebase", e);
        }
    }

    async applyLoserConditionToFutureSeasons(ruleConfig) {
        if (!this.leagueSettings) this.leagueSettings = {};
        if (!this.leagueSettings.loser_conditions) this.leagueSettings.loser_conditions = {};

        this.leagueSettings.loser_conditions['default'] = ruleConfig;

        try {
            const defaultRef = dbRef(database, `leagues/dmsfantasy/league_settings/loser_conditions/default`);
            await set(defaultRef, ruleConfig);
        } catch (e) {
            console.error("Failed to save default loser condition to Firebase", e);
        }
    }

    async applyLoserConditionToAllSeasons(ruleConfig) {
        if (!this.leagueSettings) this.leagueSettings = {};
        if (!this.leagueSettings.loser_conditions) this.leagueSettings.loser_conditions = {};

        const distinctYears = [...new Set((this.standings || []).map(s => Number(s.season || s.year)).filter(Boolean))];
        this.leagueSettings.loser_conditions['default'] = ruleConfig;
        for (const yr of distinctYears) {
            this.leagueSettings.loser_conditions[yr] = ruleConfig;
        }

        try {
            const loserRef = dbRef(database, `leagues/dmsfantasy/league_settings/loser_conditions`);
            await set(loserRef, this.leagueSettings.loser_conditions);
        } catch (e) {
            console.error("Failed to save loser conditions to Firebase", e);
        }
    }

    async resetLoserCondition(year) {
        const standardConfig = {
            mode: 'standard',
            scope: 'bracket_playoffs',
            pool: 'bracket_consolation',
            criteria: [{ type: 'final_rank', order: 'desc' }],
            description: 'Final Playoff / Consolation Bracket Rank (12th Place)'
        };
        await this.saveLoserCondition(year, standardConfig);
    }

    async updateManagerName(managerId, newName, newNickname = null) {
        const feedbackEl = document.getElementById('manager-claim-feedback');
        try {
            const cleanName = String(newName || '').trim();
            const cleanNick = newNickname !== null ? String(newNickname).trim().slice(0, 20) : null;

            // 1. Update in-memory managers
            const mgr = (this.managers || []).find(m => m.id === managerId);
            if (mgr) {
                mgr.name = cleanName;
                mgr.canonical_name = cleanName;
                mgr.manager_name = cleanName;
                if (cleanNick !== null) {
                    mgr.nickname = cleanNick;
                }
            }

            // 2. Update matchups
            (this.matchups || []).forEach(m => {
                if (m.home_manager_id === managerId || m.team_1_manager_id === managerId) {
                    m.home_manager_name = cleanName;
                    m.team_1_manager_name = cleanName;
                }
                if (m.away_manager_id === managerId || m.team_2_manager_id === managerId) {
                    m.away_manager_name = cleanName;
                    m.team_2_manager_name = cleanName;
                }
            });

            // 3. Update player stats
            (this.playerStats || []).forEach(p => {
                if (p.manager_id === managerId) {
                    p.manager_name = cleanName;
                }
            });

            // 4. Update standings
            (this.standings || []).forEach(s => {
                if (s.manager_id === managerId) {
                    s.manager_name = cleanName;
                }
            });

            // 5. Update draft results
            (this.draftResults || []).forEach(d => {
                if (d.manager_id === managerId || d.managerId === managerId) {
                    d.manager_name = cleanName;
                }
            });

            // 6. Update Firebase RTDB
            const allManagersRef = dbRef(database, `leagues/dmsfantasy/managers`);
            await set(allManagersRef, this.managers);

            if (cleanNick !== null) {
                const claimRef = dbRef(database, `leagues/dmsfantasy/claims/${managerId}`);
                await update(claimRef, { name: cleanName, nickname: cleanNick }).catch(() => {});
            }

            // 7. Refresh UI components immediately
            this.setupH2HControls();
            this.renderH2H();
            if (typeof this.renderRecords === 'function') {
                this.renderRecords();
            }
            if (this.draftEngine) {
                this.draftEngine.updateData({ managers: this.managers, draftResults: this.draftResults, leagueSettings: this.leagueSettings });
                if (this.activeTab === 'draft') this.draftEngine.render();
            }
            this.renderAdminDashboard();

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.innerHTML = `✓ Manager display name updated to "<strong>${cleanName}</strong>"!`;
                setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
            }
        } catch (e) {
            console.error('Failed to update manager name', e);
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.style.background = '#fee2e2';
                feedbackEl.style.color = '#dc2626';
                feedbackEl.textContent = 'Error updating manager name. Please try again.';
            }
        }
    }

    async toggleLeagueNicknames(enabled) {
        const feedbackEl = document.getElementById('nickname-toggle-feedback');
        const btn = document.getElementById('btn-toggle-nicknames');
        if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

        try {
            if (!this.leagueSettings) this.leagueSettings = {};
            this.leagueSettings.allow_nicknames = enabled;

            const settingsRef = dbRef(database, `leagues/dmsfantasy/league_settings`);
            await update(settingsRef, { allow_nicknames: enabled });

            // Live update all components
            this.setupH2HControls();
            this.renderH2H();
            if (typeof this.renderRecords === 'function') this.renderRecords();
            if (this.draftEngine) {
                this.draftEngine.updateData({ managers: this.managers, leagueSettings: this.leagueSettings });
                if (this.activeTab === 'draft') this.draftEngine.render();
            }
            this.renderAdminDashboard();

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.style.color = '#15803d';
                feedbackEl.textContent = `✓ Nickname display ${enabled ? 'enabled' : 'disabled'} across your league!`;
                setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
            }
        } catch (e) {
            console.error('Failed to toggle nicknames', e);
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.style.color = '#dc2626';
                feedbackEl.textContent = 'Error updating nickname setting. Please try again.';
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async renderDraft() {
        if (!this.draftEngine) {
            this.draftEngine = new VaultDraftEngine({
                containerId: 'view-draft',
                draftResults: this.draftResults,
                weeklyPlayerStats: this.playerStats,
                matchups: this.matchups,
                transactions: this.transactions,
                managers: this.managers,
                leagueSettings: { name: 'The Dumbarton League', scoring_format: 'Half-PPR (0.5)', allow_nicknames: this.leagueSettings?.allow_nicknames !== false },
                scoringSettings: {}
            });
        } else {
            this.draftEngine.updateData({
                draftResults: this.draftResults,
                weeklyPlayerStats: this.playerStats,
                matchups: this.matchups,
                transactions: this.transactions,
                managers: this.managers,
                leagueSettings: { name: 'The Dumbarton League', scoring_format: 'Half-PPR (0.5)', allow_nicknames: this.leagueSettings?.allow_nicknames !== false },
                scoringSettings: {}
            });
        }
        await this.draftEngine.render();
    }

    setupH2HControls() {
        const sel1 = document.getElementById('h2h-manager-1');
        const sel2 = document.getElementById('h2h-manager-2');

        if (!sel1 || !sel2) return;

        // Group managers by status
        const currentGroup = this.managers.filter(m => m.status_group === 'Current Managers');
        const retiredGroup = this.managers.filter(m => m.status_group === 'Retired Managers');

        const createOptgroup = (label, items) => {
            if (!items.length) return '';
            let html = `<optgroup label="${label}">`;
            items.forEach(m => {
                const name = this.getManagerDisplayName(m.id, m.canonical_name || m.name || m.id);
                html += `<option value="${m.id}">${name}</option>`;
            });
            html += `</optgroup>`;
            return html;
        };

        const placeholderOption = `<option value="" selected>-- Select a Manager --</option>`;
        const fullOptions = placeholderOption + createOptgroup('Current Managers', currentGroup) + createOptgroup('Retired Managers', retiredGroup);
        sel1.innerHTML = fullOptions;
        sel2.innerHTML = fullOptions;

        // Start with no managers selected
        sel1.value = "";
        sel2.value = "";

        sel1.addEventListener('change', () => this.renderH2H());
        sel2.addEventListener('change', () => this.renderH2H());

        // Setup year filter buttons
        const btnAll = document.getElementById('filter-btn-all');
        const btn2020 = document.getElementById('filter-btn-2020');
        const btnCustom = document.getElementById('filter-btn-custom');
        const customContainer = document.getElementById('custom-year-span-container');
        const selStart = document.getElementById('custom-start-year');
        const selEnd = document.getElementById('custom-end-year');

        const updateFilterButtons = (mode) => {
            this.currentYearFilter = mode;
            
            // Update active state
            [btnAll, btn2020, btnCustom].forEach(btn => btn?.classList.remove('active'));
            if (mode === 'all') btnAll?.classList.add('active');
            if (mode === '2020-present') btn2020?.classList.add('active');
            if (mode === 'custom') {
                btnCustom?.classList.add('active');
                if (customContainer) customContainer.style.display = 'flex';
            } else {
                if (customContainer) customContainer.style.display = 'none';
            }
            this.renderH2H();
        };

        btnAll?.addEventListener('click', () => updateFilterButtons('all'));
        btn2020?.addEventListener('click', () => updateFilterButtons('2020-present'));
        btnCustom?.addEventListener('click', () => updateFilterButtons('custom'));

        selStart?.addEventListener('change', () => {
            this.customStartYear = parseInt(selStart.value, 10);
            this.renderH2H();
        });
        selEnd?.addEventListener('change', () => {
            this.customEndYear = parseInt(selEnd.value, 10);
            this.renderH2H();
        });

        const togglePlayoffs = document.getElementById('toggle-playoffs');
        const toggleLabel = document.getElementById('toggle-playoffs-label');
        if (togglePlayoffs) {
            togglePlayoffs.addEventListener('change', () => {
                this.includePlayoffs = togglePlayoffs.checked;
                if (toggleLabel) {
                    toggleLabel.textContent = this.includePlayoffs ? 'Include Playoffs: ON' : 'Include Playoffs: OFF';
                }
                this.renderH2H();
            });
        }
    }

    getFilteredYearRange() {
        if (this.currentYearFilter === 'all') {
            return { min: 2018, max: 2026 };
        } else if (this.currentYearFilter === '2020-present') {
            return { min: 2020, max: 2026 };
        } else {
            return {
                min: Math.min(this.customStartYear, this.customEndYear),
                max: Math.max(this.customStartYear, this.customEndYear)
            };
        }
    }

    renderH2H() {
        const sel1 = document.getElementById('h2h-manager-1');
        const sel2 = document.getElementById('h2h-manager-2');
        const heroContainer = document.getElementById('h2h-hero');
        const listContainer = document.getElementById('h2h-matchups-list');
        const summaryContainer = document.getElementById('h2h-summary-card');

        if (!sel1 || !sel2 || !heroContainer || !listContainer) return;

        const m1Id = sel1.value;
        const m2Id = sel2.value;
        const range = this.getFilteredYearRange();

        const m1Obj = this.managers.find(m => m.id === m1Id) || { name: m1Id };
        const m2Obj = this.managers.find(m => m.id === m2Id) || { name: m2Id };

        const m1Name = this.getManagerDisplayName(m1Id, m1Obj.canonical_name || m1Obj.name || m1Id);
        const m2Name = this.getManagerDisplayName(m2Id, m2Obj.canonical_name || m2Obj.name || m2Id);

        if (!m1Id || !m2Id) {
            heroContainer.innerHTML = `
                <div style="padding: 40px 20px; text-align: center;">
                    <div style="font-size: 1rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-gold);">[ SELECT TWO MANAGERS ]</div>
                </div>
            `;
            listContainer.innerHTML = '';
            if (summaryContainer) summaryContainer.style.display = 'none';
            return;
        }

        if (m1Id === m2Id) {
            heroContainer.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
                    <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-gold); margin-bottom: 10px;">[ ARCHIVE NOTICE ]</div>
                    <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Same Manager Selected</div>
                    <div>Please select two different managers to view their Head-to-Head matchup history.</div>
                </div>
            `;
            listContainer.innerHTML = '';
            if (summaryContainer) summaryContainer.style.display = 'none';
            return;
        }

        // Filter games between m1 and m2 in the year span (excluding consolation games)
        const filtered = this.matchups.filter(g => {
            // 1. Never include consolation games (including 3rd place)
            if (g.game_type && g.game_type.toLowerCase().includes('consolation')) return false;
            if (g.playoff_round && g.playoff_round.toLowerCase().includes('consolation')) return false;

            // 2. Respect Playoff Games Toggle ON/OFF
            if (!this.includePlayoffs && g.is_playoffs) return false;

            // 3. Check year range filter
            const y = g.season;
            if (y < range.min || y > range.max) return false;

            // 4. Check if both managers are involved
            const t1Mgr = g.team_1_manager_id;
            const t2Mgr = g.team_2_manager_id;

            return (t1Mgr === m1Id && t2Mgr === m2Id) || (t1Mgr === m2Id && t2Mgr === m1Id);
        });

        // Sort chronologically: Earliest at top, Latest at bottom
        filtered.sort((a, b) => {
            if (a.season !== b.season) return a.season - b.season;
            return a.week - b.week;
        });

        // Collect stats & historical team names
        let m1Wins = 0, m2Wins = 0, ties = 0;
        let m1PF = 0, m2PF = 0;
        let m1Proj = 0, m2Proj = 0;
        let m1PlayoffWins = 0, m2PlayoffWins = 0;
        let maxBlowout = null;
        let minMargin = null;

        const m1TeamNames = new Set();
        const m2TeamNames = new Set();

        filtered.forEach(g => {
            const isM1Team1 = g.team_1_manager_id === m1Id;
            const t1Name = g.team_1_name || 'Team 1';
            const t2Name = g.team_2_name || 'Team 2';

            const m1Score = isM1Team1 ? g.team_1_actual_points : g.team_2_actual_points;
            const m2Score = isM1Team1 ? g.team_2_actual_points : g.team_1_actual_points;

            const m1ProjScore = isM1Team1 ? (g.team_1_projected_points || 0) : (g.team_2_projected_points || 0);
            const m2ProjScore = isM1Team1 ? (g.team_2_projected_points || 0) : (g.team_1_projected_points || 0);

            if (isM1Team1) {
                if (t1Name) m1TeamNames.add(t1Name);
                if (t2Name) m2TeamNames.add(t2Name);
            } else {
                if (t2Name) m1TeamNames.add(t2Name);
                if (t1Name) m2TeamNames.add(t1Name);
            }

            m1PF += m1Score;
            m2PF += m2Score;
            m1Proj += m1ProjScore;
            m2Proj += m2ProjScore;

            const margin = Math.abs(m1Score - m2Score);
            const winnerId = g.winner_team_id;
            const isM1Win = (isM1Team1 && winnerId === g.team_1_id) || (!isM1Team1 && winnerId === g.team_2_id);
            const isM2Win = (isM1Team1 && winnerId === g.team_2_id) || (!isM1Team1 && winnerId === g.team_1_id);

            if (isM1Win) {
                m1Wins++;
                if (g.is_playoffs) m1PlayoffWins++;
            } else if (isM2Win) {
                m2Wins++;
                if (g.is_playoffs) m2PlayoffWins++;
            } else {
                ties++;
            }

            if (!maxBlowout || margin > maxBlowout.margin) {
                maxBlowout = { margin, winner: isM1Win ? m1Name : m2Name, season: g.season, week: g.week };
            }
            if (!minMargin || margin < minMargin.margin) {
                minMargin = { margin, winner: isM1Win ? m1Name : m2Name, season: g.season, week: g.week };
            }
        });

        const totalGames = filtered.length;
        const winPct1 = totalGames > 0 ? ((m1Wins + 0.5 * ties) / totalGames * 100).toFixed(1) : '0.0';
        const winPct2 = totalGames > 0 ? ((m2Wins + 0.5 * ties) / totalGames * 100).toFixed(1) : '0.0';

        const barLeftPct = totalGames > 0 ? (m1Wins / (m1Wins + m2Wins || 1) * 100).toFixed(0) : 50;
        const barRightPct = 100 - barLeftPct;

        const currentTeam1 = this.getCurrentTeamName(m1Id);
        const currentTeam2 = this.getCurrentTeamName(m2Id);

        // Render BIG Hero Overall Record Banner
        heroContainer.innerHTML = `
            <div class="hero-content-grid">
                <div class="hero-manager-col">
                    <img src="${m1Obj.logo_url || 'https://yahoofantasysports-res.cloudinary.com/image/upload/t_s90sq/fantasy-logos/a0fe865f598d352044589dffd4119b4a5b5eab9fbb8d4a5b226a56f71aa36a3c.jpg'}" alt="${m1Name}" class="hero-avatar">
                    <div class="hero-team-names" style="font-size:1.1rem; color:var(--text-primary); font-weight:bold;">${currentTeam1}</div>
                    <div class="hero-manager-name" style="font-size:0.9rem; color:var(--text-secondary); margin-top:2px;">${m1Name}</div>
                </div>

                <div class="hero-record-col">
                    <div class="hero-record-label">All-Time Head-to-Head Record</div>
                    <div class="hero-big-record">${m1Wins} - ${m2Wins}${ties > 0 ? ' - ' + ties : ''}</div>
                    <div class="hero-win-pct">${m1Name} Win Pct: ${winPct1}% (${totalGames} Games)</div>
                    <div class="hero-comparison-bar">
                        <div class="hero-bar-left" style="width: ${barLeftPct}%;" title="${m1Name}: ${m1Wins} Wins"></div>
                        <div class="hero-bar-right" style="width: ${barRightPct}%;" title="${m2Name}: ${m2Wins} Wins"></div>
                    </div>
                </div>

                <div class="hero-manager-col">
                    <img src="${m2Obj.logo_url || 'https://yahoofantasysports-res.cloudinary.com/image/upload/t_s90sq/fantasy-logos/a2cbd9723f84f4669346df652de732b6c5f6f3693459ee1df2940f334441bd13.jpg'}" alt="${m2Name}" class="hero-avatar">
                    <div class="hero-team-names" style="font-size:1.1rem; color:var(--text-primary); font-weight:bold;">${currentTeam2}</div>
                    <div class="hero-manager-name" style="font-size:0.9rem; color:var(--text-secondary); margin-top:2px;">${m2Name}</div>
                </div>
            </div>
        `;

        // Render Chronological Matchups List
        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted);">No head-to-head matchups found between ${m1Name} and ${m2Name} in the selected year span.</div>`;
            if (summaryContainer) summaryContainer.style.display = 'none';
            return;
        }

        let cardsHtml = '';
        filtered.forEach(g => {
            const isM1Team1 = g.team_1_manager_id === m1Id;
            const t1Name = isM1Team1 ? g.team_1_name : g.team_2_name;
            const t2Name = isM1Team1 ? g.team_2_name : g.team_1_name;
            const t1Score = isM1Team1 ? g.team_1_actual_points : g.team_2_actual_points;
            const t2Score = isM1Team1 ? g.team_2_actual_points : g.team_1_actual_points;
            const t1Proj = isM1Team1 ? g.team_1_projected_points : g.team_2_projected_points;
            const t2Proj = isM1Team1 ? g.team_2_projected_points : g.team_1_projected_points;

            const isT1Win = (isM1Team1 && g.winner_team_id === g.team_1_id) || (!isM1Team1 && g.winner_team_id === g.team_2_id);
            const isT2Win = (isM1Team1 && g.winner_team_id === g.team_2_id) || (!isM1Team1 && g.winner_team_id === g.team_1_id);

            const isPlayoffs = g.is_playoffs;
            const gameTypeLabel = isPlayoffs ? `Playoffs • ${g.playoff_round || 'Game'}` : 'Regular Season';
            const cardClass = isPlayoffs ? 'h2h-matchup-card playoff-game' : 'h2h-matchup-card';
            const margin = Math.abs(t1Score - t2Score).toFixed(2);

            const leftTeamId = isM1Team1 ? g.team_1_id : g.team_2_id;
            const rightTeamId = isM1Team1 ? g.team_2_id : g.team_1_id;

            cardsHtml += `
                <div class="${cardClass}" onclick="app.openBoxscoreModal(${g.season}, ${g.week}, ${leftTeamId}, ${rightTeamId})">
                    <div class="matchup-date-badge">
                        <div class="matchup-year-week">${g.season} • Week ${g.week}</div>
                        <div class="matchup-game-type ${isPlayoffs ? 'playoff-label' : ''}">${gameTypeLabel}</div>
                    </div>

                    <div class="matchup-teams-comparison">
                        <div class="team-box ${isT1Win ? 'winner' : ''}">
                            <div class="team-name-line">${t1Name} (${m1Name})</div>
                            <div class="team-score-line">
                                <span class="team-score">${t1Score.toFixed(2)} ${isT1Win ? '<span class="win-badge">WIN</span>' : ''}</span>
                                <span class="team-proj">Proj: ${t1Proj ? t1Proj.toFixed(2) : '-'}</span>
                            </div>
                        </div>

                        <div class="matchup-margin-badge">
                            <div>VS</div>
                            <div style="font-size: 0.7rem; opacity: 0.8;">+${margin}</div>
                        </div>

                        <div class="team-box ${isT2Win ? 'winner' : ''}">
                            <div class="team-name-line">${t2Name} (${m2Name})</div>
                            <div class="team-score-line">
                                <span class="team-score">${t2Score.toFixed(2)} ${isT2Win ? '<span class="win-badge">WIN</span>' : ''}</span>
                                <span class="team-proj">Proj: ${t2Proj ? t2Proj.toFixed(2) : '-'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="matchup-action-hint">
                        <span>View Boxscore & Roster</span>
                        <span>➔</span>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = cardsHtml;

        // Render Summary Footer Card
        if (summaryContainer) {
            summaryContainer.style.display = 'block';
            const m1Avg = (m1PF / (totalGames || 1)).toFixed(2);
            const m2Avg = (m2PF / (totalGames || 1)).toFixed(2);
            const pWinsText = `${m1PlayoffWins} - ${m2PlayoffWins}`;

            const pfLeader = m1PF >= m2PF ? m1Name : m2Name;
            const pfDiff = Math.abs(m1PF - m2PF).toFixed(1);

            const projLeader = m1Proj >= m2Proj ? m1Name : m2Name;
            const projDiff = Math.abs(m1Proj - m2Proj).toFixed(1);

            const avgLeader = parseFloat(m1Avg) >= parseFloat(m2Avg) ? m1Name : m2Name;
            const avgDiff = Math.abs(parseFloat(m1Avg) - parseFloat(m2Avg)).toFixed(2);

            summaryContainer.innerHTML = `
                <h3>Head-to-Head Summary Stats (${m1Name} vs ${m2Name})</h3>
                <div class="summary-grid">
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Total Points Scored (PF)</div>
                        <div class="summary-stat-value">${m1PF.toFixed(1)} - ${m2PF.toFixed(1)}</div>
                        <div style="font-size: 0.8rem; color: var(--accent-gold); font-weight: 700; margin-top: 4px;">+${pfDiff} pts (${pfLeader} leads)</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Total Projections (Proj)</div>
                        <div class="summary-stat-value">${m1Proj.toFixed(1)} - ${m2Proj.toFixed(1)}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 600; margin-top: 4px;">+${projDiff} proj (${projLeader} favored)</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Average Points Per Game</div>
                        <div class="summary-stat-value">${m1Avg} - ${m2Avg}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">+${avgDiff} ppg (${avgLeader} leads)</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Playoff Head-to-Head Record</div>
                        <div class="summary-stat-value">${pWinsText}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">Postseason battles</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Largest Blowout Win</div>
                        <div class="summary-stat-value">${maxBlowout ? `+${maxBlowout.margin.toFixed(2)} pts` : '-'}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">${maxBlowout ? `${maxBlowout.winner} (${maxBlowout.season} W${maxBlowout.week})` : '-'}</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Closest Matchup Margin</div>
                        <div class="summary-stat-value">${minMargin ? `+${minMargin.margin.toFixed(2)} pts` : '-'}</div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); font-weight: 600; margin-top: 4px;">${minMargin ? `${minMargin.winner} (${minMargin.season} W${minMargin.week})` : '-'}</div>
                    </div>
                </div>
            `;
        }
    }

    openBoxscoreModal(season, week, leftId, rightId) {
        const sNum = Number(season);
        const wNum = Number(week);
        const lId = Number(leftId);
        const rId = Number(rightId);

        const modal = document.getElementById('boxscore-modal');
        const modalContent = document.getElementById('boxscore-modal-content');
        if (!modal || !modalContent) return;

        // Find matchup metadata
        const m = this.matchups.find(x => x.season === sNum && x.week === wNum && ((x.team_1_id === lId && x.team_2_id === rId) || (x.team_1_id === rId && x.team_2_id === lId)));
        if (!m) return;

        const isLeftTeam1 = m.team_1_id === lId;
        const leftName = isLeftTeam1 ? m.team_1_name : m.team_2_name;
        const rightName = isLeftTeam1 ? m.team_2_name : m.team_1_name;
        const leftScore = isLeftTeam1 ? m.team_1_actual_points : m.team_2_actual_points;
        const rightScore = isLeftTeam1 ? m.team_2_actual_points : m.team_1_actual_points;
        const isLeftWin = m.winner_team_id === lId;
        const isRightWin = m.winner_team_id === rId;

        const leftMgrId = m.team_1_manager_id || m.home_manager_id;
        const rightMgrId = m.team_2_manager_id || m.away_manager_id;
        const leftMgrName = this.getManagerDisplayName(leftMgrId, m.team_1_manager_name || m.home_manager_name);
        const rightMgrName = this.getManagerDisplayName(rightMgrId, m.team_2_manager_name || m.away_manager_name);

        // Find all player stats for both teams in that season & week (deduplicating duplicate records)
        const rawGamePlayers = this.playerStats.filter(p => p.season === sNum && p.week === wNum && (p.team_id === lId || p.team_id === rId));
        const seenPlayerKeys = new Set();
        const gamePlayers = [];
        for (const p of rawGamePlayers) {
            const k = `${p.team_id}_${p.player_id || p.player_name}_${p.player_name}_${p.is_starter ? 'S' : 'B'}`;
            if (!seenPlayerKeys.has(k)) {
                seenPlayerKeys.add(k);
                gamePlayers.push(p);
            }
        }

        const leftPlayers = gamePlayers.filter(p => p.team_id === lId);
        const rightPlayers = gamePlayers.filter(p => p.team_id === rId);

        const renderRosterTable = (players, teamName, score, isWinner, managerName) => {
            const starters = players.filter(p => p.is_starter);
            const bench = players.filter(p => !p.is_starter);

            let html = `
                <div class="roster-card">
                    <div class="roster-card-header">
                        <div class="roster-team-title">${teamName} ${managerName ? `<span style="font-size: 0.82rem; font-weight: normal; color: var(--text-muted); margin-left: 6px;">(${managerName})</span>` : ''} ${isWinner ? '<span class="win-badge">WINNER</span>' : ''}</div>
                        <div class="roster-team-score">${score.toFixed(2)}</div>
                    </div>

                    <div class="roster-section-title"><span>Starters</span></div>
            `;

            if (players.length === 0) {
                html += `
                    <div style="padding: 28px; text-align: center; color: var(--text-muted); font-size: 0.95rem;">
                        <em>Detailed individual player box score was not archived for this matchup.</em>
                    </div>
                `;
            }

            const STANDARD_SLOTS = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'W/R/T', 'K', 'DEF'];
            const remainingStarters = [...starters];

            STANDARD_SLOTS.forEach(slot => {
                let matchIdx = remainingStarters.findIndex(p => p.roster_slot === slot);
                if (matchIdx === -1 && slot === 'W/R/T') {
                    matchIdx = remainingStarters.findIndex(p => ['WR', 'RB', 'TE', 'FLEX', 'W/R', 'W/R/T'].includes(p.roster_slot));
                }
                if (matchIdx !== -1) {
                    const p = remainingStarters.splice(matchIdx, 1)[0];
                    const slotClass = slot.toLowerCase().replace(/[^a-z]/g, '');
                    const nflInfo = formatDumbartonNflInfo(p);
                    html += `
                        <div class="player-row">
                            <div class="player-left">
                                <span class="slot-badge ${slotClass}">${slot}</span>
                                <div>
                                    <div class="player-name">${p.player_name}</div>
                                    <div class="nfl-team">${nflInfo || 'NFL'}</div>
                                </div>
                            </div>
                            <div class="player-right">
                                <div class="player-pts">${p.fantasy_points !== undefined ? p.fantasy_points.toFixed(2) : '0.00'}</div>
                                <div class="player-proj">Proj: ${p.projected_points !== undefined ? p.projected_points.toFixed(2) : '-'}</div>
                            </div>
                        </div>
                    `;
                } else {
                    const slotClass = slot.toLowerCase().replace(/[^a-z]/g, '');
                    html += `
                        <div class="player-row" style="opacity: 0.45;">
                            <div class="player-left">
                                <span class="slot-badge ${slotClass}">${slot}</span>
                                <div>
                                    <div class="player-name" style="font-style: italic; color: var(--text-muted);">Empty</div>
                                    <div class="nfl-team">-</div>
                                </div>
                            </div>
                            <div class="player-right">
                                <div class="player-pts">0.00</div>
                                <div class="player-proj">Proj: -</div>
                            </div>
                        </div>
                    `;
                }
            });

            remainingStarters.forEach(p => {
                const slotClass = p.roster_slot.toLowerCase().replace(/[^a-z]/g, '');
                const nflInfo = formatDumbartonNflInfo(p);
                html += `
                    <div class="player-row">
                        <div class="player-left">
                            <span class="slot-badge ${slotClass}">${p.roster_slot}</span>
                            <div>
                                <div class="player-name">${p.player_name}</div>
                                <div class="nfl-team">${nflInfo || 'NFL'}</div>
                            </div>
                        </div>
                        <div class="player-right">
                            <div class="player-pts">${p.fantasy_points !== undefined ? p.fantasy_points.toFixed(2) : '0.00'}</div>
                            <div class="player-proj">Proj: ${p.projected_points !== undefined ? p.projected_points.toFixed(2) : '-'}</div>
                        </div>
                    </div>
                `;
            });

            if (bench.length > 0) {
                html += `<div class="roster-section-title" style="margin-top: 20px;"><span>Bench & IR</span></div>`;
                bench.forEach(p => {
                    const slotClass = p.roster_slot.toLowerCase().replace(/[^a-z]/g, '');
                    const nflInfo = formatDumbartonNflInfo(p);
                    html += `
                        <div class="player-row" style="opacity: 0.8;">
                            <div class="player-left">
                                <span class="slot-badge ${slotClass}">${p.roster_slot}</span>
                                <div>
                                    <div class="player-name">${p.player_name}</div>
                                    <div class="nfl-team">${nflInfo || 'NFL'}</div>
                                </div>
                            </div>
                            <div class="player-right">
                                <div class="player-pts">${p.fantasy_points !== undefined ? p.fantasy_points.toFixed(2) : '0.00'}</div>
                                <div class="player-proj">Proj: ${p.projected_points !== undefined ? p.projected_points.toFixed(2) : '-'}</div>
                            </div>
                        </div>
                    `;
                });
            }

            html += `</div>`;
            return html;
        };

        modalContent.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>${season} • Week ${week} ${m.is_playoffs ? ' • ' + (m.playoff_round || 'Playoffs') : ' • Regular Season'}</h2>
                    <p>${leftName} (${leftScore.toFixed(2)}) vs ${rightName} (${rightScore.toFixed(2)})</p>
                </div>
                <button class="modal-close-btn" onclick="document.getElementById('boxscore-modal').close()">✕</button>
            </div>

            <div class="rosters-grid">
                ${renderRosterTable(leftPlayers, leftName, leftScore, isLeftWin, leftMgrName)}
                ${renderRosterTable(rightPlayers, rightName, rightScore, isRightWin, rightMgrName)}
            </div>
        `;

        if (typeof modal.showModal === 'function') {
            modal.showModal();
        } else {
            modal.style.display = 'block';
        }
    }
}

window.FantasyApp = FantasyApp;
const app = new FantasyApp();
window.app = app;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        app.init();
    });
} else {
    app.init();
}

// Setup modal backdrop click & Escape close
function setupBoxscoreModal() {
    const modal = document.getElementById('boxscore-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            const rect = modal.getBoundingClientRect();
            const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                                rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
            if (!isInDialog) {
                modal.close();
            }
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBoxscoreModal);
} else {
    setupBoxscoreModal();
}

