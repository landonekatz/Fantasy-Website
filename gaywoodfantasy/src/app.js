import { VaultDraftEngine } from '/src/draft.js';
import { nflStats } from '/src/nfl_stats.js';
import { database } from '/src/firebase.js';
import { ref as dbRef, set, get, child, update, onValue } from 'firebase/database';
import { formatManagerDisplayName } from '/src/formatters.js';

function getPlayoffRoundName(season, week) {
    const yr = Number(season);
    const wk = Number(week);
    if (yr <= 2020) {
        if (wk === 14) return 'Quarterfinals';
        if (wk === 15) return 'Semifinals';
        if (wk === 16) return 'Championship';
    } else {
        if (wk === 15) return 'Quarterfinals';
        if (wk === 16) return 'Semifinals';
        if (wk === 17) return 'Championship';
    }
    return 'Playoffs';
}

function formatPlayerStats(player) {
    if (!player.stat_line || Object.keys(player.stat_line).length === 0) return '';
    const stats = player.stat_line;
    let out = [];

    // DEFENSE / SPECIAL TEAMS
    if (player.position === 'D/ST' || player.position === 'DEF') {
        const ptsAllowed = stats['120'];
        const ydsAllowed = stats['127'];
        const sacks = Math.round(stats['99'] || 0);
        const ints = Math.round(stats['95'] || 0);
        const fumRec = Math.round(stats['96'] || 0);
        const safeties = Math.round(stats['98'] || 0);
        const blocks = Math.round(stats['97'] || 0);
        const defTD = Math.round((stats['105'] || 0) + (stats['101'] || 0) + (stats['102'] || 0) + (stats['103'] || 0) + (stats['104'] || 0));

        if (ptsAllowed != null) out.push(`PA: ${ptsAllowed}`);
        if (ydsAllowed != null) out.push(`YA: ${ydsAllowed}`);
        if (sacks > 0) out.push(`${sacks} Sack${sacks > 1 ? 's' : ''}`);
        if (ints > 0) out.push(`${ints} INT`);
        if (fumRec > 0) out.push(`${fumRec} FR`);
        if (safeties > 0) out.push(`${safeties} Safety`);
        if (blocks > 0) out.push(`${blocks} Blk`);
        if (defTD > 0) out.push(`${defTD} Def TD`);
        return out.join(', ');
    }

    // KICKER
    if (player.position === 'K') {
        const fgMade = Math.round(stats['83'] || 0);
        const fgAtt = Math.round(stats['84'] || 0);
        const patMade = Math.round(stats['86'] || 0);
        const patAtt = Math.round(stats['87'] || 0);
        const fg50 = Math.round(stats['74'] || stats['77'] || stats['80'] || 0);
        
        if (fgMade > 0 || fgAtt > 0) {
            let fgStr = `${fgMade}/${Math.max(fgMade, fgAtt)} FG`;
            if (fg50 > 0) fgStr += ` (${fg50} 50+)`;
            out.push(fgStr);
        }
        if (patMade > 0 || patAtt > 0) {
            out.push(`${patMade}/${Math.max(patMade, patAtt)} PAT`);
        }
        return out.join(', ');
    }

    // OFFENSE
    const passYd = Math.round(stats['3'] || 0);
    const passTd = Math.round(stats['4'] || 0);
    const passInt = Math.round(stats['20'] || 0);
    if (passYd !== 0) out.push(`${passYd} Pass Yds`);
    if (passTd > 0) out.push(`${passTd} Pass TD`);
    if (passInt > 0) out.push(`${passInt} INT`);

    const rushYd = Math.round(stats['24'] || 0);
    const rushAtt = Math.round(stats['23'] || 0);
    const rushTd = Math.round(stats['25'] || 0);
    if (rushYd !== 0) out.push(`${rushYd} Rush Yds`);
    if (rushTd > 0) out.push(`${rushTd} Rush TD`);
    if (rushAtt > 0) out.push(`${rushAtt} Rush Att`);

    const recYd = Math.round(stats['42'] || 0);
    const recs = Math.round(stats['53'] || 0);
    const recTd = Math.round(stats['43'] || 0);
    const recTgt = Math.round(stats['41'] || 0);
    if (recYd !== 0) out.push(`${recYd} Rec Yds`);
    if (recs > 0) out.push(`${recs} Rec`);
    if (recTd > 0) out.push(`${recTd} Rec TD`);
    if (recTgt > 0) out.push(`${recTgt} Tgt`);

    const fumLost = Math.round(stats['72'] || 0);
    if (fumLost > 0) {
        out.push(`${fumLost} Fum`);
    }

    return out.join(', ');
}

class FantasyApp {
    constructor() {
        this.managers = [];
        this.matchups = [];
        this.playerStats = [];
        this.standings = [];
        this.transactions = [];
        this.leagueSlug = 'gaywoodfantasy';
        this.leagueSettings = {
            name: 'Gaywood / Katz Fantasy Football League HQ',
            join_code: 'Y6CW7J',
            tagline: '11 Seasons • 21 Managers • One Eternal Pursuit'
        };
        this.currentYearFilter = 'all'; // 'all', '2020-present', 'custom'
        this.customStartYear = 2018;
        this.customEndYear = 2026;
        this.activeTab = 'home';
        this.includePlayoffs = true;

        this.overviewSortBy = 'wins';
        this.overviewSortOrder = 'desc';
        this.recordFilters = {
            overview: { year: 'all', retired: false, customStart: 2015, customEnd: 2025 },
            singlegame: { year: 'all', retired: false, customStart: 2015, customEnd: 2025 },
            singleseason: { year: 'all', retired: false, customStart: 2015, customEnd: 2025 },
            streaks: { year: 'all', retired: false, customStart: 2015, customEnd: 2025 },
            playoffs: { year: 'all', retired: false, customStart: 2015, customEnd: 2025 }
        };
        this.db = null;
    }

    renderPrivateGuard() {
        let overlay = document.getElementById('private-guard-overlay');
        if (overlay) return;

        const leagueTitle = 'Gaywood / Katz League';

        overlay = document.createElement('div');
        overlay.id = 'private-guard-overlay';
        overlay.style.cssText = 'position: fixed; inset: 0; z-index: 99999; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 1.5rem; font-family: "Inter", sans-serif; overflow-y: auto;';
        
        overlay.innerHTML = `
            <div class="card" style="max-width: 440px; width: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 2.25rem 2rem; box-shadow: 0 20px 40px rgba(0,0,0,0.25); text-align: center; position: relative;">
                <div style="display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 20px; background: #fef3c7; border: 1px solid #fde68a; color: #b45309; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1.25rem;">
                    Private League Archive
                </div>
                
                <h1 style="font-family: 'Cinzel', serif; font-size: 1.75rem; color: #0f172a; margin: 0 0 0.5rem 0; line-height: 1.25;">
                    ${leagueTitle}
                </h1>
                
                <p style="color: #64748b; font-size: 0.88rem; line-height: 1.5; margin: 0 0 1.5rem 0;">
                    This Fantasy Vault is private. Please sign in or enter your Join Code to access records, box scores, and analytics.
                </p>

                <!-- Google 1-Click SSO -->
                <button id="guard-btn-google" type="button" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0.75rem; background: #ffffff; color: #1f2937; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                    Sign In with Google
                </button>

                <div style="display: flex; align-items: center; margin: 1.15rem 0; color: #94a3b8; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px;">
                    <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                    <span style="padding: 0 0.75rem;">or email</span>
                    <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                </div>

                <!-- Email & Password Form -->
                <form id="guard-email-form" style="display: flex; flex-direction: column; gap: 0.65rem;">
                    <input type="email" id="guard-input-email" placeholder="name@example.com" required style="width: 100%; padding: 0.65rem 0.8rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; font-size: 0.88rem; box-sizing: border-box;">
                    <input type="password" id="guard-input-pass" placeholder="Password" required style="width: 100%; padding: 0.65rem 0.8rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; font-size: 0.88rem; box-sizing: border-box;">
                    <button type="submit" style="width: 100%; padding: 0.7rem; background: #0f172a; color: #fff; font-weight: 700; border: none; border-radius: 6px; font-size: 0.88rem; cursor: pointer;">Sign In / Register</button>
                </form>

                <div style="display: flex; align-items: center; margin: 1.15rem 0; color: #94a3b8; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px;">
                    <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                    <span style="padding: 0 0.75rem;">or join code</span>
                    <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                </div>

                <!-- Join Code Form -->
                <form id="guard-code-form" style="display: flex; gap: 0.5rem;">
                    <input type="text" id="guard-input-code" placeholder="6-char code" maxlength="6" style="flex: 1; padding: 0.6rem; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; font-family: monospace; text-transform: uppercase; font-size: 0.9rem; text-align: center; letter-spacing: 1px; box-sizing: border-box;">
                    <button type="submit" style="padding: 0.6rem 1rem; background: #fef3c7; border: 1px solid #d97706; color: #b45309; border-radius: 6px; font-weight: 700; font-size: 0.82rem; cursor: pointer;">Unlock</button>
                </form>

                <div id="guard-error-msg" style="display: none; margin-top: 0.85rem; padding: 0.5rem; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; border-radius: 6px; font-size: 0.8rem;"></div>

                <div style="margin-top: 1.25rem; font-size: 0.8rem; color: #64748b;">
                    <a href="/" style="color: #64748b; text-decoration: none;">&larr; Return to The Fantasy Vault Home</a>
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
            window.AuthEngine.recordActiveLeague('gaywoodfantasy');
        } else {
            localStorage.setItem('vault_last_league', 'gaywoodfantasy');
        }

        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('building')) {
            window.history.replaceState({}, '', window.location.pathname);
        }

        // 1. Invite Link Intercept
        const joinCode = urlParams.get('join');
        if (joinCode) {
            window.location.href = `/?join=${joinCode}`;
            return;
        }

        // 1. Immediately wire navigation, theme, and admin tab visibility on frame 0
        this.setupThemeToggle();
        this.setupNavigation();
        this.checkAdminAccess();

        // Wait for initial Firebase auth resolution
        if (typeof window.AuthEngine !== 'undefined' && typeof window.AuthEngine.ready === 'function') {
            await window.AuthEngine.ready();
        }

        await this.loadData();

        // 2. Private League Guard (Public by default)
        const isPrivate = Boolean(this.leagueSettings?.is_private);
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;

        if (isPrivate) {
            if (!session) {
                this.renderPrivateGuard();
                return;
            }
            const userEmail = (session.email || '').toLowerCase();
            const adminEmail = (this.leagueSettings?.admin_email || '').toLowerCase();
            const isLeagueAdmin = (adminEmail && userEmail === adminEmail) || (session.adminLeagues && session.adminLeagues.includes('gaywoodfantasy'));
            const hasJoined = session.joinedLeagues && session.joinedLeagues.includes('gaywoodfantasy');
            const hasClaim = this.claims && Object.values(this.claims).some(c => (c?.userId === session.uid) || (c?.email && c.email.toLowerCase() === userEmail));
            const isAuthorized = isLeagueAdmin || hasJoined || hasClaim;

            if (!isAuthorized) {
                this.renderAccessDenied(session);
                return;
            }
        } else {
            if (session) {
                const userEmail = (session.email || '').toLowerCase();
                const adminEmail = (this.leagueSettings?.admin_email || '').toLowerCase();
                const isLeagueAdmin = (adminEmail && userEmail === adminEmail) || (session.adminLeagues && session.adminLeagues.includes('gaywoodfantasy'));
                const hasClaim = this.claims && Object.values(this.claims).some(c => (c?.userId === session.uid) || (c?.email && c.email.toLowerCase() === userEmail));
                if (!isLeagueAdmin && !hasClaim) {
                    this.showGuestNotice();
                }
            }
        }

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
                <h2 style="font-size: 1.35rem; font-family: var(--font-heading, 'Newsreader', serif); font-weight: 800; margin-bottom: 0.5rem; color: #0f172a;">Access Denied</h2>
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
                        await window.AuthEngine.linkUserLeague('gaywoodfantasy', 'member', 'Gaywood / Katz League');
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

    openSettingsModal(season) {
        const modal = document.getElementById('settings-modal');
        const content = document.getElementById('settings-modal-content');
        const yearTitle = document.getElementById('settings-modal-year');
        
        if (modal && content && yearTitle) {
            yearTitle.textContent = `${season} Season`;
            
            const settings = this.leagueSettings[season];
            if (!settings || Object.keys(settings).length === 0) {
                content.innerHTML = '<p style="padding: 1rem; color: var(--text-muted);">No scoring settings available for this season.</p>';
            } else {
                const getScoringItemRank = (name, category) => {
                    const cat = (category || '').toLowerCase();
                    const n = (name || '').toLowerCase();
                    
                    if (cat.includes('defense')) {
                        if (n.includes('sack')) return 10;
                        if (n.includes('interception') && !n.includes('td')) return 11;
                        if (n.includes('fumble recovered') || n.includes('fr')) return 12;
                        if (n.includes('safety')) return 13;
                        if (n.includes('blocked punt, pat or fg') || n.includes('blocked kick')) return 14;
                        if (n.includes('blocked punt or fg return') || n.includes('return td')) return 20;
                        if (n.includes('interception return td')) return 21;
                        if (n.includes('fumble return td')) return 22;
                        if (n.includes('kickoff return td')) return 23;
                        if (n.includes('punt return td')) return 24;
                        
                        // Defense Points Allowed in Ascending Order
                        if (n.includes('0 point') || n.includes('0 pt') || n.includes('shutout')) return 30;
                        if (n.includes('1-6 point') || n.includes('1-6 pt')) return 31;
                        if (n.includes('7-13 point') || n.includes('7-13 pt')) return 32;
                        if (n.includes('14-17 point') || n.includes('14-20 point') || n.includes('14-17 pt')) return 33;
                        if (n.includes('18-21 point') || n.includes('18-21 pt')) return 34;
                        if (n.includes('22-27 point') || n.includes('22-27 pt')) return 35;
                        if (n.includes('28-34 point') || n.includes('28-34 pt')) return 36;
                        if (n.includes('35-45 point') || n.includes('35-45 pt')) return 37;
                        if (n.includes('46+ point') || n.includes('46+ pt')) return 38;
                        
                        // Yards Allowed in Ascending Order
                        if (n.includes('less than 100') || n.includes('< 100')) return 50;
                        if (n.includes('100-199')) return 51;
                        if (n.includes('200-299')) return 52;
                        if (n.includes('300-349')) return 53;
                        if (n.includes('350-399')) return 54;
                        if (n.includes('400-449')) return 55;
                        if (n.includes('450-499')) return 56;
                        if (n.includes('500-549')) return 57;
                        if (n.includes('550+')) return 58;
                    }
                    
                    if (cat.includes('kick')) {
                        if (n.includes('pat made') || n.includes('extra point made')) return 10;
                        if (n.includes('pat miss') || n.includes('extra point miss')) return 11;
                        if (n.includes('0-39') && n.includes('made')) return 20;
                        if (n.includes('40-49') && n.includes('made')) return 21;
                        if (n.includes('50-59') && n.includes('made')) return 22;
                        if (n.includes('60+') && n.includes('made')) return 23;
                        if (n.includes('50+') && n.includes('made')) return 24;
                        if (n.includes('0-39') && n.includes('miss')) return 30;
                        if (n.includes('40-49') && n.includes('miss')) return 31;
                        if (n.includes('50+') && n.includes('miss')) return 32;
                    }
                    
                    return 100;
                };

                let html = '';
                const categoryOrder = ['Passing', 'Rushing', 'Receiving', 'Kicking', 'Team Defense and Special Teams', 'Team Defense / Special Teams', 'Miscellaneous'];
                const sortedCategories = Object.keys(settings).sort((a, b) => {
                    const idxA = categoryOrder.findIndex(c => a.toLowerCase().includes(c.toLowerCase()));
                    const idxB = categoryOrder.findIndex(c => b.toLowerCase().includes(c.toLowerCase()));
                    return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
                });

                sortedCategories.forEach(category => {
                    const rawItems = settings[category] || [];
                    const sortedItems = [...rawItems].sort((a, b) => getScoringItemRank(a.name, category) - getScoringItemRank(b.name, category));
                    
                    html += `
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: var(--accent-gold); font-size: 1.1rem; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px; font-family: var(--font-heading, 'Cinzel', serif);">${category}</h3>
                        <table class="table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border-color); text-align: left;">
                                    <th style="padding: 6px 8px; color: var(--text-muted); font-size: 0.85rem;">Action</th>
                                    <th style="padding: 6px 8px; text-align: right; color: var(--text-muted); font-size: 0.85rem;">Points</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    sortedItems.forEach(item => {
                        html += `
                            <tr style="border-bottom: 1px solid var(--border-color);">
                                <td style="padding: 8px; font-weight: 500;">${item.name}</td>
                                <td style="padding: 8px; text-align: right; color: var(--text-primary); font-weight: 700;">${item.points > 0 ? '+' : ''}${item.points}</td>
                            </tr>
                        `;
                    });
                    html += '</tbody></table></div>';
                });
                content.innerHTML = html;
            }
            if (typeof modal.showModal === 'function') modal.showModal();
            else modal.style.display = 'block';
        }
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
                const res = await fetch(`data/${filename}?v=${Date.now()}`, { cache: 'no-store' });
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

        const [managersData, matchupsData, statsData, standingsData, transactionsData, powerRankingsData, draftData, settingsData] = await Promise.all([
            fetchOrFallback('managers.json', 'managers'),
            fetchOrFallback('matchups.json', 'matchups'),
            fetchOrFallback('weekly_player_stats.json', 'weekly_player_stats'),
            fetchOrFallback('league_standings.json', 'league_standings'),
            fetchOrFallback('transactions.json', 'transactions'),
            fetchOrFallback('power_rankings_history.json', 'power_rankings_history'),
            fetchOrFallback('draft_results.json', 'draft_results'),
            fetchOrFallback('league_settings.json', 'league_settings')
        ]);

        nflStats.preloadSeason(2025);
        nflStats.preloadSeason(2024);

        if (managersData) {
            this.managersData = managersData;
            const rawList = Array.isArray(managersData) ? managersData : (managersData.managers || []);
            this.managers = rawList.map(m => {
                const isRetired = (m.status && m.status.toLowerCase() === 'retired');
                const cleanName = m.name || m.display_name || m.full_name || m.manager_name;
                return {
                    ...m,
                    id: m.id || m.manager_id,
                    manager_id: m.id || m.manager_id,
                    name: cleanName,
                    manager_name: cleanName,
                    is_retired: isRetired,
                    status_group: isRetired ? 'Retired Managers' : 'Current Managers'
                };
            });
        }

        const rawStandings = standingsData || [];
        this.standings = rawStandings.map(s => {
            const yr = Number(s.year || s.season);
            const madePlayoffs = s.made_playoffs !== undefined ?
                (s.made_playoffs === true || String(s.made_playoffs).toLowerCase() === 'true') :
                (s.playoff_seed ? s.playoff_seed <= (yr >= 2022 ? 6 : 4) : false);
            return {
                ...s,
                season: yr,
                year: yr,
                rank: s.final_rank || s.rank,
                made_playoffs: madePlayoffs,
                win_pct: (s.wins + s.losses + s.ties > 0) ? (s.wins + 0.5 * s.ties) / (s.wins + s.losses + s.ties) : (s.win_pct || 0)
            };
        });

        const rawMatchups = matchupsData || [];
        this.matchups = rawMatchups.map(m => {
            const yr = Number(m.year || m.season);
            const isPlayoffs = Boolean(m.is_playoff || m.is_playoffs || m.game_type === 'Championship');
            const hId = m.home_team_id !== undefined ? m.home_team_id : m.team_1_id;
            const aId = m.away_team_id !== undefined ? m.away_team_id : m.team_2_id;
            const hPts = m.home_score !== undefined ? m.home_score : m.team_1_actual_points;
            const aPts = m.away_score !== undefined ? m.away_score : m.team_2_actual_points;

            return {
                ...m,
                season: yr,
                year: yr,
                is_playoffs: isPlayoffs,
                is_playoff: isPlayoffs,
                playoff_round: m.playoff_round || (isPlayoffs ? getPlayoffRoundName(yr, m.week) : ''),
                team_1_id: hId,
                team_1_name: m.home_team_name || m.team_1_name,
                team_1_manager_id: m.home_manager_id || m.team_1_manager_id,
                team_1_manager_name: m.home_manager_name || m.team_1_manager_name,
                team_1_actual_points: hPts,
                team_2_id: aId,
                team_2_name: m.away_team_name || m.team_2_name,
                team_2_manager_id: m.away_manager_id || m.team_2_manager_id,
                team_2_manager_name: m.away_manager_name || m.team_2_manager_name,
                team_2_actual_points: aPts,
                home_team_id: hId,
                home_score: hPts,
                away_team_id: aId,
                away_score: aPts,
                winner_team_id: m.winner === 'HOME' ? hId : (m.winner === 'AWAY' ? aId : m.winner_team_id)
            };
        });

        this.playerStats = statsData || [];
        this.transactions = transactionsData || [];
        this.powerRankingsHistory = powerRankingsData || [];
        this.draftResults = draftData || [];
        this.leagueSettings = settingsData || {};

        // Fetch custom league settings, claims, and managers from Firebase RTDB
        try {
            const [settingsSnap, claimsSnap, managersSnap] = await Promise.all([
                get(dbRef(database, `leagues/gaywoodfantasy/league_settings`)).catch(() => null),
                get(dbRef(database, `leagues/gaywoodfantasy/claims`)).catch(() => null),
                get(dbRef(database, `leagues/gaywoodfantasy/managers`)).catch(() => null)
            ]);
            if (settingsSnap && settingsSnap.exists()) {
                this.leagueSettings = { ...this.leagueSettings, ...settingsSnap.val() };
            }
            if (claimsSnap && claimsSnap.exists()) {
                this.claims = claimsSnap.val() || {};
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
        } catch (e) {
            console.warn('Could not fetch RTDB settings for gaywoodfantasy', e);
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
    }

    getCurrentTeamName(managerId) {
        if (!this.managersData || !this.managersData.team_mappings) return 'Unknown Team';
        const mappings = this.managersData.team_mappings.filter(m => m.manager_id === managerId);
        if (mappings.length === 0) return 'Unknown Team';
        mappings.sort((a, b) => b.year - a.year);
        return mappings[0].team_name;
    }

    initPowerRankings() {
        // 1. Populate logo, team name, manager name from managers data (DOM-based - chips are hardcoded in HTML)
        const ranks = document.querySelectorAll('.rank[data-manager]');
        ranks.forEach((el, index) => {
            const managerId = el.getAttribute('data-manager');
            const manager = this.managers.find(m => m.id === managerId);
            if (manager) {
                const logoEl = el.querySelector('.rank-logo');
                const teamEl = el.querySelector('.rank-team');
                const mgrEl = el.querySelector('.rank-manager');

                // Insert rank number if it doesn't exist
                if (!el.querySelector('.rank-number')) {
                    const rankNumEl = document.createElement('div');
                    rankNumEl.className = 'rank-number';
                    rankNumEl.style.cssText = 'font-size: 1.2rem; font-weight: bold; margin-right: 15px; width: 25px; text-align: center; color: var(--text-color);';
                    rankNumEl.textContent = `${index + 1}.`;
                    el.insertBefore(rankNumEl, el.firstChild);
                }

                if (logoEl) logoEl.src = manager.logo_url || 'https://s.yimg.com/cv/apiv2/default/nfl/nfl_1.png';
                if (teamEl) teamEl.textContent = this.getCurrentTeamName(managerId);
                if (mgrEl) mgrEl.textContent = manager.name;
                
                // Add click listener to scroll to this manager's recap
                el.style.cursor = 'pointer';
                el.addEventListener('click', () => {
                    const storyContent = document.getElementById('weekly-story-content');
                    if (storyContent) {
                        const headings = Array.from(storyContent.querySelectorAll('h3, h2'));
                        // Try to find the heading containing the manager's name
                        const targetHeading = headings.find(h => 
                            h.textContent.toLowerCase().includes(manager.name.toLowerCase())
                        );
                        if (targetHeading) {
                            targetHeading.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }
                });
            }
        });

        // 2. Render weekly story content from the latest week in power_rankings_history
        if (this.powerRankingsHistory && this.powerRankingsHistory.length > 0) {
            const latest = this.powerRankingsHistory.sort((a, b) => b.week - a.week)[0];
            const rawContent = latest.html_content || '';

            // Split: everything before "### 1." goes to Personnel Changes card is already in HTML;
            // ranked write-ups (### 1. onward) go to weekly story
            const splitMatch = rawContent.match(/\n(#{1,3}\s*1\.)/);
            const storyContent = splitMatch
                ? rawContent.slice(rawContent.indexOf(splitMatch[0])).trim()
                : rawContent;

            const storyEl = document.getElementById('weekly-story-content');
            if (storyEl) {
                storyEl.innerHTML = (window.marked && storyContent)
                    ? marked.parse(storyContent)
                    : storyContent.replace(/\n/g, '<br>');
            }
        }
    }

    setupNavigation() {
        const btnHome = document.getElementById('btn-tab-home');
        const btnH2h = document.getElementById('btn-tab-h2h');
        const btnRecords = document.getElementById('btn-tab-records');
        const btnDraft = document.getElementById('btn-tab-draft');
        const btnAdmin = document.getElementById('btn-tab-admin');
        const viewHome = document.getElementById('view-home');
        const viewH2h = document.getElementById('view-h2h');
        const viewRecords = document.getElementById('view-records');
        const viewDraft = document.getElementById('view-draft');
        const viewAdmin = document.getElementById('view-admin');

        const switchTab = (tab) => {
            this.activeTab = tab;
            [btnHome, btnH2h, btnRecords, btnDraft, btnAdmin].forEach(btn => btn && btn.classList.remove('active'));
            [viewHome, viewH2h, viewRecords, viewDraft, viewAdmin].forEach(view => view && view.classList.remove('active'));

            const themeLabel = document.getElementById('theme-toggle-label');
            if (themeLabel) {
                themeLabel.textContent = `Theme: Light`;
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
        const isFounder = session && session.isFounder;
        const isAdmin = session && ((session.adminLeagues && (session.adminLeagues.includes('gaywoodfantasy') || session.adminLeagues.includes('gaywood'))) || isFounder);
        if (isAdmin) {
            btnAdmin.style.display = 'inline-flex';
        } else {
            btnAdmin.style.display = 'none';
        }
    }

    renderAdminDashboard() {
        const container = document.getElementById('view-admin');
        if (!container) return;

        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const leagueName = this.leagueSettings?.name || "Gaywood / Katz Fantasy Football League HQ";
        const leagueSlug = "gaywoodfantasy";
        const currentTagline = this.leagueSettings?.tagline || this.leagueSettings?.subtitle || "11 Seasons • 21 Managers • One Eternal Pursuit";
        if (!this.leagueSettings) this.leagueSettings = {};
        if (!this.leagueSettings.join_code) {
            this.leagueSettings.join_code = 'Y6CW7J';
        }
        const joinCode = this.leagueSettings.join_code.toUpperCase();
        const joinLink = `${window.location.origin}/gaywoodfantasy/?join=${joinCode}`;
        const isPrivate = Boolean(this.leagueSettings?.is_private);

        const memberList = (this.managers && this.managers.length > 0) ? this.managers : [];
        const sortedMembers = [...memberList].sort((a, b) => (a.canonical_name || a.name || '').localeCompare(b.canonical_name || b.name || ''));

        // Check if the current admin has claimed a profile in this league
        const currentAdminClaim = session ? (session.claims?.[leagueSlug] || (this.claims && Object.entries(this.claims).find(([k, v]) => v?.email === session.email)?.[0])) : null;
        const unclaimedMembers = sortedMembers.filter(m => !this.claims || !this.claims[m.id]);

        // Build 3-column table rows: Manager Name (input + Save) | Active Seasons | Claim Actions
        const managerRows = sortedMembers.map(m => {
            const memberMatchups = (this.matchups || []).filter(x => x.home_manager_id === m.id || x.away_manager_id === m.id);
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
                                <span class="badge-registered" style="font-size: 0.72rem; padding: 2px 6px; background: #ecfdf5; color: #065f46; border-radius: 4px; border: 1px solid #a7f3d0;" title="Claimed by ${claimEmail}">
                                    ✓ ${claimEmail}
                                </span>
                                <button class="btn-reassign-manager btn btn-sm" data-manager-id="${m.id}" data-manager-name="${mName}" style="padding: 2px 6px; font-size: 0.72rem; border: 1px solid var(--border-line); background: #fff; border-radius: 4px; cursor: pointer;">Reassign</button>
                            ` : `
                                <span class="badge-unregistered" style="font-size: 0.72rem; padding: 2px 6px; background: #f1f5f9; color: #64748b; border-radius: 4px;">Unclaimed</span>
                                <button class="btn-copy-claim-link btn btn-sm" data-manager-id="${m.id}" data-manager-name="${mName}" style="padding: 4px 8px; font-size: 0.72rem; font-weight: 600; background: #f8fafc; border: 1px solid var(--border-line); border-radius: 4px; cursor: pointer;">Copy Link</button>
                                <button class="btn-email-claim-link btn btn-sm btn-primary" data-manager-id="${m.id}" data-manager-name="${mName}" style="padding: 4px 8px; font-size: 0.72rem; font-weight: 600; cursor: pointer; border-radius: 4px;">Email Link</button>
                            `}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        const managerOptions = sortedMembers.map(m => `<option value="${m.id}">${m.canonical_name || m.name || m.id}</option>`).join('');
        const unclaimedOptions = unclaimedMembers.map(m => `<option value="${m.id}">${m.canonical_name || m.name || m.id}</option>`).join('');
        const allowNicknames = this.leagueSettings?.allow_nicknames !== false;

        container.innerHTML = `
            <div class="admin-dashboard-wrapper" style="max-width: 960px; margin: 0 auto; padding: 1.5rem 0;">

                <!-- Retrospective Admin Self-Claim Card (If Admin Has No Claimed Profile) -->
                ${!currentAdminClaim ? `
                    <div class="card admin-section-card" style="margin-bottom: 1.5rem; background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; padding: 1.25rem 1.5rem; border-radius: 8px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                            <div>
                                <div style="font-size: 0.82rem; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Claim Your Manager Profile (League Admin)</div>
                                <p style="font-size: 0.88rem; color: #78350f; margin: 0; line-height: 1.45;">
                                    You are currently administering this league as <strong>${session?.email || 'Admin'}</strong>, but haven't linked your manager profile yet. Select your team to track your personal career stats, win/loss records, and head-to-head history.
                                </p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <select id="admin-self-claim-select" style="min-width: 180px; padding: 6px 10px; font-size: 0.85rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff;">
                                    <option value="">-- Select Your Team --</option>
                                    ${unclaimedOptions}
                                </select>
                                <button id="btn-admin-self-claim" class="btn btn-primary" style="padding: 7px 14px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer; white-space: nowrap;">Claim Profile</button>
                            </div>
                        </div>
                        <div id="admin-self-claim-feedback" style="display: none; margin-top: 0.75rem; font-size: 0.85rem;"></div>
                    </div>
                ` : ''}

                <!-- 1. IDENTITY & CUSTOMIZATION -->
                <div class="card admin-section-card" style="margin-bottom: 1.5rem; background: var(--bg-card); border: 1px solid var(--border-line); border-radius: 8px; padding: 1.25rem 1.5rem;">
                    <div class="admin-card-header" style="border-bottom: 1px solid var(--border-line); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                        <h2 style="font-family: var(--font-heading, 'Newsreader', serif); font-size: 1.3rem; margin: 0 0 4px 0;">League Identity &amp; Customization</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Customize your official masthead title and subtitle motto.</p>
                    </div>

                    <!-- Note from Landon for Tagline Customization -->
                    <div style="margin-top: 1rem; background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; padding: 1rem 1.25rem; border-radius: 6px;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">A Note from the Founder, Landon</div>
                        <p style="font-size: 0.88rem; color: #78350f; line-height: 1.5; margin: 0;">
                            Hey, this is one of the first points of customization for your league. Feel free to make the league tagline a tradition, as maybe the champion gets to create the tagline for the next year! That's something you as the admin have control of. I've included below some sample taglines that I came up with in a quick brainstorm, and I'll keep adding more, but feel free to make one up on your own as well.
                        </p>
                    </div>

                    <!-- Custom League Title -->
                    <div style="margin-top: 1rem;">
                        <label for="admin-league-title-input" style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: var(--text-secondary);">Custom League Title:</label>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <input type="text" id="admin-league-title-input" value="${leagueName}" style="flex: 1; min-width: 240px; padding: 8px 12px; font-size: 0.9rem; border: 1px solid var(--border-line); border-radius: 4px;">
                            <button id="btn-save-league-title" class="btn btn-primary" style="padding: 8px 16px; font-weight: 700; border-radius: 4px; white-space: nowrap; cursor: pointer;">Save Title</button>
                        </div>
                        <div id="title-save-feedback" style="display: none; margin-top: 0.5rem; font-size: 0.85rem;"></div>
                    </div>

                    <!-- Tagline Customization -->
                    <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border-line);">
                        <label for="admin-tagline-input" style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: var(--text-secondary);">League Tagline / Subtitle:</label>
                        <div class="tagline-presets-wrapper">
                            <button type="button" class="btn-tagline-preset" data-preset="Variance is an excuse for incompetence">"Variance is an excuse for incompetence"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Landon is the greatest fantasy player of all time">"Landon is the greatest fantasy player of all time"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Fantasy in name only">"Fantasy in name only"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Inside joke">"Inside joke"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="In a league of our own">"In a league of our own"</button>
                        </div>
                        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <input type="text" id="admin-tagline-input" value="${currentTagline}" placeholder="Enter custom motto..." style="flex: 1; min-width: 240px; padding: 8px 12px; font-size: 0.9rem; border: 1px solid var(--border-line); border-radius: 4px;">
                            <button id="btn-save-tagline" class="btn btn-primary" style="padding: 8px 16px; font-weight: 700; border-radius: 4px; white-space: nowrap; cursor: pointer;">Save Tagline</button>
                        </div>
                        <div id="tagline-save-feedback" style="display: none; margin-top: 0.5rem; font-size: 0.85rem;"></div>
                    </div>
                </div>

                <!-- 2. LEAGUE NICKNAMES CUSTOMIZATION -->
                <div class="card admin-section-card" style="margin-bottom: 1.5rem; background: var(--bg-card); border: 1px solid var(--border-line); border-radius: 8px; padding: 1.25rem 1.5rem;">
                    <div class="admin-card-header" style="border-bottom: 1px solid var(--border-line); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                        <h2 style="font-family: var(--font-heading, 'Newsreader', serif); font-size: 1.3rem; margin: 0 0 4px 0;">League Nicknames Customization</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Enable or disable custom manager nicknames across your league archive.</p>
                    </div>
                    <div style="padding: 1rem; background: #f8fafc; border: 1px solid var(--border-line); border-radius: 6px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                    <strong style="font-size: 0.95rem; color: var(--text-main);">Nickname Status:</strong>
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
                            <button id="btn-toggle-nicknames" class="btn" style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; cursor: pointer; border-radius: 6px; ${allowNicknames ? 'background:#475569; color:#fff; border:none;' : 'background:var(--accent-gold, #b45309); color:#fff; border:none;'}">
                                ${allowNicknames ? 'Disable League Nicknames' : 'Enable League Nicknames'}
                            </button>
                        </div>
                        <div id="nickname-toggle-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem; color: #15803d; font-size: 0.85rem;"></div>
                    </div>
                </div>

                <!-- 3. PRIVACY & ACCESS CONTROL -->
                <div class="card admin-section-card" style="margin-bottom: 1.5rem; background: var(--bg-card); border: 1px solid var(--border-line); border-radius: 8px; padding: 1.25rem 1.5rem;">
                    <div class="admin-card-header" style="border-bottom: 1px solid var(--border-line); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                        <h2 style="font-family: var(--font-heading, 'Newsreader', serif); font-size: 1.3rem; margin: 0 0 4px 0;">League Privacy &amp; Access Control</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Control whether your archive is publicly readable or restricted to signed-in league members.</p>
                    </div>
                    <div style="padding: 1rem; background: #f8fafc; border: 1px solid var(--border-line); border-radius: 6px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                    <strong style="font-size: 0.95rem; color: var(--text-main);">Vault Access:</strong>
                                    <span id="admin-privacy-badge" style="display: inline-block; font-size: 0.78rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; ${isPrivate ? 'background:#fee2e2; color:#dc2626;' : 'background:#dcfce7; color:#15803d;'}">
                                        ${isPrivate ? 'Private (Invite &amp; SSO Guarded)' : 'Public (Open Link Access)'}
                                    </span>
                                </div>
                                <p id="admin-privacy-desc" style="margin: 0; font-size: 0.84rem; color: var(--text-muted); line-height: 1.45;">
                                    ${isPrivate 
                                        ? 'Private vaults require managers to be logged in to view your archive, draft records, and record books.' 
                                        : 'Public vaults allow anyone with your league link to explore your history, record books, and draft analysis.'}
                                </p>
                            </div>
                            <button id="btn-toggle-privacy" class="btn" style="padding: 8px 16px; font-weight: 700; font-size: 0.85rem; cursor: pointer; border-radius: 6px; ${isPrivate ? 'background:#15803d; color:#fff; border:none;' : 'background:#475569; color:#fff; border:none;'}">
                                ${isPrivate ? 'Make League Public' : 'Make League Private'}
                            </button>
                        </div>
                        <div id="privacy-toggle-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem; color: #15803d; font-size: 0.85rem;"></div>
                    </div>
                </div>

                <!-- 4. REGISTERED MEMBERS & MANAGER ROSTER -->
                <div class="card admin-section-card" style="margin-bottom: 1.5rem; background: var(--bg-card); border: 1px solid var(--border-line); border-radius: 8px; padding: 1.25rem 1.5rem;">
                    <div class="admin-card-header" style="border-bottom: 1px solid var(--border-line); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                        <h2 style="font-family: var(--font-heading, 'Newsreader', serif); font-size: 1.3rem; margin: 0 0 4px 0;">League Members Roster</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Manage manager display names, copy individual claim links, or email invitations directly.</p>
                    </div>

                    <div style="overflow-x: auto;">
                        <table class="table" style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border-line); text-align: left;">
                                    <th style="padding: 8px; width: 45%;">Manager Display Name</th>
                                    <th style="padding: 8px; width: 20%;">Active Seasons</th>
                                    <th style="padding: 8px; width: 35%;">Claim Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${managerRows}
                            </tbody>
                        </table>
                    </div>
                    <div id="manager-rename-feedback" style="display: none; margin-top: 0.75rem; padding: 0.5rem; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; color: #065f46; font-size: 0.85rem;"></div>
                </div>

                <!-- 5. LEAGUE INVITES & ACCESS -->
                <div class="card admin-section-card" style="margin-bottom: 1.5rem; background: var(--bg-card); border: 1px solid var(--border-line); border-radius: 8px; padding: 1.25rem 1.5rem;">
                    <div class="admin-card-header" style="border-bottom: 1px solid var(--border-line); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                        <h2 style="font-family: var(--font-heading, 'Newsreader', serif); font-size: 1.3rem; margin: 0 0 4px 0;">League Invites &amp; Access Control</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Share your official join code and direct invite links with league members to grant them access to this vault.</p>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-top: 1rem;">
                        <div style="padding: 1rem; background: #f8fafc; border: 1px solid var(--border-line); border-radius: 6px;">
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Official Join Code:</span>
                            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px;">
                                <code style="padding: 4px 10px; background: #fff; border: 1px solid var(--border-line); font-weight: 700; font-size: 1.05rem; letter-spacing: 1px; border-radius: 4px;">${joinCode}</code>
                                <button class="btn-copy-action btn btn-sm btn-outline-primary" data-copy="${joinCode}" style="padding: 4px 10px; font-size: 0.8rem; cursor: pointer;">Copy Code</button>
                            </div>
                        </div>
                        <div style="padding: 1rem; background: #f8fafc; border: 1px solid var(--border-line); border-radius: 6px;">
                            <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">General League Invite Link:</span>
                            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
                                <span style="font-size: 0.82rem; font-family: monospace; color: var(--text-main); word-break: break-all;">${joinLink}</span>
                                <button class="btn-copy-action btn btn-sm btn-primary" data-copy="${joinLink}" style="padding: 4px 10px; font-size: 0.8rem; cursor: pointer;">Copy Link</button>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: 1rem; padding: 0.85rem 1rem; background: #f8fafc; border: 1px solid var(--border-line); border-radius: 6px;">
                        <p style="margin: 0; font-size: 0.82rem; color: var(--text-muted); line-height: 1.45;">
                            <strong>General Invite Notice:</strong> Share this general invite link with your league members. When they join using this link, they will be prompted to select and claim their manager profile from the roster.
                        </p>
                    </div>
                </div>

                <!-- 5. TRANSFER ADMIN STATUS -->
                <div class="card admin-section-card" style="margin-bottom: 1.5rem; background: var(--bg-card); border: 1px solid var(--border-line); border-radius: 8px; padding: 1.25rem 1.5rem;">
                    <div class="admin-card-header" style="border-bottom: 1px solid var(--border-line); padding-bottom: 0.75rem; margin-bottom: 1rem;">
                        <h2 style="font-family: var(--font-heading, 'Newsreader', serif); font-size: 1.3rem; margin: 0 0 4px 0;">Transfer Admin Status</h2>
                        <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Transfer official ownership and commissioner control of this league archive to another manager.</p>
                    </div>
                    <div style="padding: 1rem; background: #f8fafc; border: 1px solid var(--border-line); border-radius: 6px;">
                        <p style="font-size: 0.88rem; color: var(--text-secondary, #334155); line-height: 1.5; margin: 0 0 1rem 0;">
                            Need to pass commissioner duties to another league member? You can invite a manager to take over admin status by email or by copying an admin transfer link. When they accept and sign in, full commissioner permissions will be transferred to their account.
                        </p>
                        <button id="btn-open-transfer-admin-modal" class="btn" style="background: #b45309; color: #fff; padding: 8px 16px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; cursor: pointer; border: none;">Transfer Admin Status</button>
                    </div>
                </div>
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

                const settingsRef = dbRef(database, `leagues/gaywoodfantasy/league_settings`);
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

                const settingsRef = dbRef(database, `leagues/gaywoodfantasy/league_settings`);
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
                    const settingsRef = dbRef(database, `leagues/gaywoodfantasy/league_settings`);
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
                const claimLink = `${window.location.origin}/gaywoodfantasy/?action=claim_manager&manager=${encodeURIComponent(mgrId)}`;

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
                        const claimRef = dbRef(database, `leagues/gaywoodfantasy/claims/${mgrId}`);
                        await set(claimRef, null);
                    } catch (e) {
                        console.error('Failed to unlink claim', e);
                    }
                    this.renderAdminDashboard();
                }
            });
        });
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
            const allManagersRef = dbRef(database, `leagues/gaywoodfantasy/managers`);
            await set(allManagersRef, this.managers);

            if (cleanNick !== null) {
                const claimRef = dbRef(database, `leagues/gaywoodfantasy/claims/${managerId}`);
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

            const settingsRef = dbRef(database, `leagues/gaywoodfantasy/league_settings`);
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
                transactions: this.transactions,
                managers: this.managers,
                leagueSettings: { name: 'Gaywood / Katz League', id: '262404', scoring_format: 'Half-PPR (0.5)', allow_nicknames: this.leagueSettings?.allow_nicknames !== false },
                scoringSettings: this.leagueSettings
            });
        } else {
            this.draftEngine.updateData({
                draftResults: this.draftResults,
                weeklyPlayerStats: this.playerStats,
                transactions: this.transactions,
                managers: this.managers,
                leagueSettings: { name: 'Gaywood / Katz League', id: '262404', scoring_format: 'Half-PPR (0.5)', allow_nicknames: this.leagueSettings?.allow_nicknames !== false },
                scoringSettings: this.leagueSettings
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

        const allowNick = this.leagueSettings?.allow_nicknames !== false;
        const createOptgroup = (label, items) => {
            if (!items.length) return '';
            let html = `<optgroup label="${label}">`;
            items.forEach(m => {
                const name = formatManagerDisplayName(m.canonical_name || m.name || m.id, m.nickname, allowNick);
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
        const btnCustom = document.getElementById('filter-btn-custom');
        const customContainer = document.getElementById('custom-year-span-container');
        const selStart = document.getElementById('custom-start-year');
        const selEnd = document.getElementById('custom-end-year');
        
        if (this.currentYearFilter === 'all') {
            btnAll?.classList.add('active');
        } else if (this.currentYearFilter === 'custom') {
            btnCustom?.classList.add('active');
        }

        const updateFilterButtons = (mode) => {
            this.currentYearFilter = mode;
            
            // Update active state
            [btnAll, btnCustom].forEach(btn => btn?.classList.remove('active'));
            if (mode === 'all') btnAll?.classList.add('active');
                        if (mode === 'custom') {
                btnCustom?.classList.add('active');
                if (customContainer) customContainer.style.display = 'flex';
            } else {
                if (customContainer) customContainer.style.display = 'none';
            }
            this.renderH2H();
        };

        btnAll?.addEventListener('click', () => updateFilterButtons('all'));
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
            return { min: 2015, max: 2026 };
        }
        if (this.currentYearFilter === 'custom') {
            return { min: this.customStartYear, max: this.customEndYear };
        }
        const yearMatch = this.currentYearFilter.match(/^(\d{4})$/);
        if (yearMatch) {
            const yr = parseInt(yearMatch[1], 10);
            return { min: yr, max: yr };
        }
        // '2020-present' logic removed from buttons, fallback to all if needed
        return { min: 2015, max: 2026 };
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

        const allowNick = this.leagueSettings?.allow_nicknames !== false;
        const m1Name = formatManagerDisplayName(m1Obj.canonical_name || m1Obj.name || m1Id, m1Obj.nickname, allowNick);
        const m2Name = formatManagerDisplayName(m2Obj.canonical_name || m2Obj.name || m2Id, m2Obj.nickname, allowNick);

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

        // Filter using home_manager_id / away_manager_id schema
        const filtered = this.matchups.filter(g => {
            if (!this.includePlayoffs && g.is_playoff) return false;
            const y = g.year;
            if (y < range.min || y > range.max) return false;
            const ids = new Set([g.home_manager_id, g.away_manager_id]);
            return ids.has(m1Id) && ids.has(m2Id);
        });

        // Sort chronologically
        filtered.sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.week - b.week;
        });

        // Precompute projected points map from playerStats
        const projMap = {};
        if (this.playerStats) {
            this.playerStats.forEach(p => {
                if (p.is_starter) {
                    const key = `${p.year}_${p.week}_${p.manager_id}`;
                    projMap[key] = (projMap[key] || 0) + (p.projected_points || 0);
                }
            });
        }

        // Accumulate stats using home/away schema; winner is "HOME" or "AWAY"
        let m1Wins = 0, m2Wins = 0, ties = 0;
        let m1PF = 0, m2PF = 0;
        let m1ProjTotal = 0, m2ProjTotal = 0;
        let m1PlayoffWins = 0, m2PlayoffWins = 0;
        let maxBlowout = null;
        let minMargin = null;

        filtered.forEach(g => {
            const isM1Home = g.home_manager_id === m1Id;
            const m1Score = isM1Home ? (g.home_score || 0) : (g.away_score || 0);
            const m2Score = isM1Home ? (g.away_score || 0) : (g.home_score || 0);

            m1PF += m1Score;
            m2PF += m2Score;
            
            const m1Proj = projMap[`${g.year}_${g.week}_${m1Id}`] || 0;
            const m2Proj = projMap[`${g.year}_${g.week}_${m2Id}`] || 0;
            m1ProjTotal += m1Proj;
            m2ProjTotal += m2Proj;

            const margin = Math.abs(m1Score - m2Score);
            const isM1Win = (isM1Home && g.winner === 'HOME') || (!isM1Home && g.winner === 'AWAY');
            const isM2Win = (isM1Home && g.winner === 'AWAY') || (!isM1Home && g.winner === 'HOME');

            if (isM1Win) { m1Wins++; if (g.is_playoff) m1PlayoffWins++; }
            else if (isM2Win) { m2Wins++; if (g.is_playoff) m2PlayoffWins++; }
            else { ties++; }

            if (!maxBlowout || margin > maxBlowout.margin) maxBlowout = { margin, winner: isM1Win ? m1Name : m2Name, season: g.year, week: g.week };
            if (!minMargin || margin < minMargin.margin) minMargin = { margin, winner: isM1Win ? m1Name : m2Name, season: g.year, week: g.week };
        });

        const totalGames = filtered.length;
        const winPct1 = totalGames > 0 ? ((m1Wins + 0.5 * ties) / totalGames * 100).toFixed(1) : '0.0';

        const barLeftPct = totalGames > 0 ? (m1Wins / (m1Wins + m2Wins || 1) * 100).toFixed(0) : 50;
        const barRightPct = 100 - barLeftPct;

        // Hero: initial letter avatars instead of ESPN pfps
        heroContainer.innerHTML = `
            <div class="hero-content-grid">
                <div class="hero-manager-col">
                    <div style="width:72px;height:72px;border-radius:50%;background:var(--bg-surface);border:2px solid var(--border-color);display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;color:var(--accent-gold);margin:0 auto 8px;">${m1Name.charAt(0).toUpperCase()}</div>
                    <div class="hero-manager-name" style="font-size:1.1rem;color:var(--text-primary);font-weight:bold;">${m1Name}</div>
                </div>
                <div class="hero-record-col">
                    <div class="hero-record-label">All-Time Head-to-Head Record (${range.min}${range.min !== range.max ? ' - ' + range.max : ''})</div>
                    <div class="hero-big-record">${m1Wins} - ${m2Wins}${ties > 0 ? ' - ' + ties : ''}</div>
                    <div class="hero-win-pct">${m1Name} Win Pct: ${winPct1}% (${totalGames} Games)</div>
                    <div class="hero-comparison-bar">
                        <div class="hero-bar-left" style="width: ${barLeftPct}%;" title="${m1Name}: ${m1Wins} Wins"></div>
                        <div class="hero-bar-right" style="width: ${barRightPct}%;" title="${m2Name}: ${m2Wins} Wins"></div>
                    </div>
                </div>
                <div class="hero-manager-col">
                    <div style="width:72px;height:72px;border-radius:50%;background:var(--bg-surface);border:2px solid var(--border-color);display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;color:var(--accent-gold);margin:0 auto 8px;">${m2Name.charAt(0).toUpperCase()}</div>
                    <div class="hero-manager-name" style="font-size:1.1rem;color:var(--text-primary);font-weight:bold;">${m2Name}</div>
                </div>
            </div>
        `;

        if (filtered.length === 0) {
            listContainer.innerHTML = `<div class="card" style="text-align:center;color:var(--text-muted);">No head-to-head matchups found between ${m1Name} and ${m2Name} in the selected year span.</div>`;
            if (summaryContainer) summaryContainer.style.display = 'none';
            return;
        }

        let cardsHtml = '';
        filtered.forEach(g => {
            const isM1Home = g.home_manager_id === m1Id;
            const t1Name  = isM1Home ? (g.home_team_name || m1Name) : (g.away_team_name || m1Name);
            const t2Name  = isM1Home ? (g.away_team_name || m2Name) : (g.home_team_name || m2Name);
            const t1Score = isM1Home ? (g.home_score || 0) : (g.away_score || 0);
            const t2Score = isM1Home ? (g.away_score || 0) : (g.home_score || 0);
            
            const t1Proj = projMap[`${g.year}_${g.week}_${m1Id}`] || 0;
            const t2Proj = projMap[`${g.year}_${g.week}_${m2Id}`] || 0;
            
            const isT1Win = (isM1Home && g.winner === 'HOME') || (!isM1Home && g.winner === 'AWAY');
            const isT2Win = !isT1Win;
            const isPlayoffs = g.is_playoff;
            const cardClass = isPlayoffs ? 'h2h-matchup-card playoff-game' : 'h2h-matchup-card';
            const margin = Math.abs(t1Score - t2Score).toFixed(2);

            const clickHandler = g.year < 2018
                ? `onclick="alert('ESPN has removed public access to player boxscore data prior to 2018.')"`
                : `onclick="app.openBoxscoreModal(${g.year}, ${g.week}, '${g.home_manager_id}', '${g.away_manager_id}')"`;

            cardsHtml += `
                <div class="${cardClass}" ${clickHandler}>
                    <div class="matchup-date-badge">
                        <div class="matchup-year-week">${g.year} • Week ${g.week}</div>
                        <div class="matchup-game-type ${isPlayoffs ? 'playoff-label' : ''}">${isPlayoffs ? 'Playoffs • ' + (g.playoff_round || getPlayoffRoundName(g.year, g.week)) : 'Regular Season'}</div>
                    </div>
                    <div class="matchup-teams-comparison">
                        <div class="team-box ${isT1Win ? 'winner' : ''}">
                            <div class="team-name-line">${t1Name} (${m1Name})</div>
                            <div class="team-score-line">
                                <span class="team-score">${t1Score.toFixed(2)} ${isT1Win ? '<span class="win-badge">WIN</span>' : ''}</span>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Proj: ${t1Proj ? t1Proj.toFixed(2) : '-'}</div>
                        </div>
                        <div class="matchup-margin-badge"><div>VS</div><div style="font-size:0.7rem;opacity:0.8;">+${margin}</div></div>
                        <div class="team-box ${isT2Win ? 'winner' : ''}">
                            <div class="team-name-line">${t2Name} (${m2Name})</div>
                            <div class="team-score-line">
                                <span class="team-score">${t2Score.toFixed(2)} ${isT2Win ? '<span class="win-badge">WIN</span>' : ''}</span>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Proj: ${t2Proj ? t2Proj.toFixed(2) : '-'}</div>
                        </div>
                    </div>
                    <div class="matchup-action-hint">
                        <span>${g.year < 2018 ? 'No player data available pre-2018' : 'View Boxscore & Roster'}</span>
                        <span>${g.year < 2018 ? '' : '➔'}</span>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = cardsHtml;

        if (summaryContainer) {
            summaryContainer.style.display = 'block';
            const m1Avg = (m1PF / (totalGames || 1)).toFixed(2);
            const m2Avg = (m2PF / (totalGames || 1)).toFixed(2);
            const pfLeader = m1PF >= m2PF ? m1Name : m2Name;
            const pfDiff   = Math.abs(m1PF - m2PF).toFixed(1);
            const avgLeader = parseFloat(m1Avg) >= parseFloat(m2Avg) ? m1Name : m2Name;
            const avgDiff   = Math.abs(parseFloat(m1Avg) - parseFloat(m2Avg)).toFixed(2);
            
            const projLeader = m1ProjTotal >= m2ProjTotal ? m1Name : m2Name;
            const projDiff   = Math.abs(m1ProjTotal - m2ProjTotal).toFixed(1);

            summaryContainer.innerHTML = `
                <h3>Head-to-Head Summary Stats (${m1Name} vs ${m2Name})</h3>
                <div class="summary-grid">
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Total Points Scored (PF)</div>
                        <div class="summary-stat-value">${m1PF.toFixed(1)} - ${m2PF.toFixed(1)}</div>
                        <div style="font-size:0.8rem;color:var(--accent-gold);font-weight:700;margin-top:4px;">+${pfDiff} pts (${pfLeader} leads)</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Average Points Per Game</div>
                        <div class="summary-stat-value">${m1Avg} - ${m2Avg}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;margin-top:4px;">+${avgDiff} ppg (${avgLeader} leads)</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Total Projected Points <span style="font-size:0.7em; font-weight:normal; opacity:0.7;">(2018+)</span></div>
                        <div class="summary-stat-value">${m1ProjTotal.toFixed(1)} - ${m2ProjTotal.toFixed(1)}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;margin-top:4px;">+${projDiff} proj (${projLeader} leads)</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Playoff Head-to-Head Record</div>
                        <div class="summary-stat-value">${m1PlayoffWins} - ${m2PlayoffWins}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;margin-top:4px;">Postseason battles</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Largest Blowout Win</div>
                        <div class="summary-stat-value">${maxBlowout ? `+${maxBlowout.margin.toFixed(2)} pts` : '-'}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;margin-top:4px;">${maxBlowout ? `${maxBlowout.winner} (${maxBlowout.season} W${maxBlowout.week})` : '-'}</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Closest Matchup Margin</div>
                        <div class="summary-stat-value">${minMargin ? `+${minMargin.margin.toFixed(2)} pts` : '-'}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;margin-top:4px;">${minMargin ? `${minMargin.winner} (${minMargin.season} W${minMargin.week})` : '-'}</div>
                    </div>
                </div>
            `;
        }
    }

    openBoxscoreModal(season, week, homeManagerId, awayManagerId) {
        const sNum = Number(season);
        const wNum = Number(week);
        const modal = document.getElementById('boxscore-modal');
        const modalContent = document.getElementById('boxscore-modal-content');
        if (!modal || !modalContent) return;

        const hId = homeManagerId;
        const aId = awayManagerId;

        const m = this.matchups.find(x => {
            const yr = Number(x.year || x.season);
            const wk = Number(x.week);
            if (yr !== sNum || wk !== wNum) return false;
            
            // Match manager IDs or team IDs
            if (x.home_manager_id === hId && x.away_manager_id === aId) return true;
            if (x.home_manager_id === aId && x.away_manager_id === hId) return true;
            if (x.team_1_manager_id === hId && x.team_2_manager_id === aId) return true;
            if (x.team_1_manager_id === aId && x.team_2_manager_id === hId) return true;
            if (Number(x.home_team_id) === Number(hId) && (!aId || Number(x.away_team_id) === Number(aId))) return true;
            if (Number(x.away_team_id) === Number(hId) && (!aId || Number(x.home_team_id) === Number(aId))) return true;
            if (Number(x.team_1_id) === Number(hId) && (!aId || Number(x.team_2_id) === Number(aId))) return true;
            if (Number(x.team_2_id) === Number(hId) && (!aId || Number(x.team_1_id) === Number(aId))) return true;
            return false;
        });
        if (!m) return;

        const leftName  = m.home_team_name || m.team_1_name || m.home_manager_id;
        const rightName = m.away_team_name || m.team_2_name || m.away_manager_id;
        const leftScore  = Number(m.home_score !== undefined ? m.home_score : m.team_1_actual_points) || 0;
        const rightScore = Number(m.away_score !== undefined ? m.away_score : m.team_2_actual_points) || 0;
        const isLeftWin  = m.winner === 'HOME' || (m.winner_team_id && Number(m.winner_team_id) === Number(m.team_1_id)) || leftScore > rightScore;
        const isRightWin = m.winner === 'AWAY' || (m.winner_team_id && Number(m.winner_team_id) === Number(m.team_2_id)) || rightScore > leftScore;

        const rawGamePlayers = this.playerStats.filter(p => p.year === sNum && p.week === wNum && (p.team_id === m.home_team_id || p.team_id === m.away_team_id));
        const seenKeys = new Set();
        const gamePlayers = [];
        for (const p of rawGamePlayers) {
            const k = `${p.team_id}_${p.player_id || p.player_name}_${p.is_starter ? 'S' : 'B'}`;
            if (!seenKeys.has(k)) { seenKeys.add(k); gamePlayers.push(p); }
        }
        const leftPlayers  = gamePlayers.filter(p => p.team_id === m.home_team_id);
        const rightPlayers = gamePlayers.filter(p => p.team_id === m.away_team_id);

        const renderRosterTable = (players, teamName, score, isWinner) => {
            const starters = players.filter(p => p.is_starter);
            const bench    = players.filter(p => !p.is_starter);
            let html = `<div class="roster-card"><div class="roster-card-header"><div class="roster-team-title">${teamName} ${isWinner ? '<span class="win-badge">WINNER</span>' : ''}</div><div class="roster-team-score">${score.toFixed(2)}</div></div><div class="roster-section-title"><span>Starters</span></div>`;

            if (players.length === 0) {
                html += `<div style="padding:28px;text-align:center;color:var(--text-muted);"><em>Detailed player box score not archived for this matchup.</em></div>`;
            } else {
                const SLOTS = [
                    { id: 0, label: 'QB' },
                    { id: 2, label: 'RB' },
                    { id: 2, label: 'RB' },
                    { id: 4, label: 'WR' },
                    { id: 4, label: 'WR' },
                    { id: 6, label: 'TE' },
                    { id: 23, label: 'FLEX' },
                    { id: 16, label: 'DEF' },
                    { id: 17, label: 'K' }
                ];
                
                const rem = [...starters];
                SLOTS.forEach(slot => {
                    let idx = rem.findIndex(p => p.lineup_slot_id === slot.id);
                    if (idx !== -1) {
                        const p = rem.splice(idx, 1)[0];
                        const sc = slot.label.toLowerCase().replace(/[^a-z]/g, '');
                        const projHtml = p.projected_points != null && p.projected_points > 0 ? `<div class="player-proj">Proj: ${p.projected_points.toFixed(2)}</div>` : '';
                        
                        const statsLine = formatPlayerStats(p);
                        const nflMatchupInfo = [p.nfl_team, p.nfl_game_result, statsLine].filter(Boolean).join(' • ');

                        html += `<div class="player-row"><div class="player-left"><span class="slot-badge ${sc}">${slot.label}</span><div><div class="player-name">${p.player_name}</div><div class="nfl-team">${nflMatchupInfo || 'NFL'}</div></div></div><div class="player-right"><div class="player-pts">${p.fantasy_points != null ? p.fantasy_points.toFixed(2) : '0.00'}</div>${projHtml}</div></div>`;
                    } else {
                        const sc = slot.label.toLowerCase().replace(/[^a-z]/g, '');
                        html += `<div class="player-row" style="opacity:0.45;"><div class="player-left"><span class="slot-badge ${sc}">${slot.label}</span><div><div class="player-name" style="font-style:italic;color:var(--text-muted);">Empty</div></div></div><div class="player-right"><div class="player-pts">0.00</div></div></div>`;
                    }
                });
                
                // Any remaining starters that didn't fit the expected slots (just in case)
                rem.forEach(p => {
                    const projHtml = p.projected_points != null && p.projected_points > 0 ? `<div class="player-proj">Proj: ${p.projected_points.toFixed(2)}</div>` : '';
                    const statsLine = formatPlayerStats(p);
                    const nflMatchupInfo = [p.nfl_team, p.nfl_game_result, statsLine].filter(Boolean).join(' • ');

                    html += `<div class="player-row"><div class="player-left"><span class="slot-badge flex">EXTRA</span><div><div class="player-name">${p.player_name}</div><div class="nfl-team">${nflMatchupInfo || 'NFL'}</div></div></div><div class="player-right"><div class="player-pts">${p.fantasy_points != null ? p.fantasy_points.toFixed(2) : '0.00'}</div>${projHtml}</div></div>`;
                });

                if (bench.length > 0) {
                    html += `<div class="roster-section-title" style="margin-top:20px;"><span>Bench & IR</span></div>`;
                    bench.forEach(p => {
                        const slotLabel = p.lineup_slot_id === 21 ? 'IR' : 'BN';
                        const sc = slotLabel.toLowerCase();
                        const projHtml = p.projected_points != null && p.projected_points > 0 ? `<div class="player-proj">Proj: ${p.projected_points.toFixed(2)}</div>` : '';
                        
                        const statsLine = formatPlayerStats(p);
                        const nflMatchupInfo = [p.nfl_team, p.nfl_game_result, statsLine].filter(Boolean).join(' • ');

                        html += `<div class="player-row" style="opacity:0.8;"><div class="player-left"><span class="slot-badge ${sc}">${slotLabel}</span><div><div class="player-name">${p.player_name}</div><div class="nfl-team">${nflMatchupInfo || 'NFL'}</div></div></div><div class="player-right"><div class="player-pts">${p.fantasy_points != null ? p.fantasy_points.toFixed(2) : '0.00'}</div>${projHtml}</div></div>`;
                    });
                }
            }
            html += `</div>`;
            return html;
        };

        const roundName = m ? (m.playoff_round || (m.is_playoff ? getPlayoffRoundName(season, week) : '')) : '';
        modalContent.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>${season} • Week ${week} ${m && m.is_playoff ? ', as Playoffs (' + (roundName || 'Playoffs') + ')' : ', as Regular Season'}</h2>
                    <p>${leftName} (${leftScore.toFixed(2)}) vs ${rightName} (${rightScore.toFixed(2)})</p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="btn btn-sm btn-outline-primary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="app.openSettingsModal(${season})" title="View League Scoring Settings">? Scoring</button>
                    <button class="modal-close-btn" onclick="document.getElementById('boxscore-modal').close()">✕</button>
                </div>
            </div>
            <div class="rosters-grid">
                ${renderRosterTable(leftPlayers, leftName, leftScore, isLeftWin)}
                ${renderRosterTable(rightPlayers, rightName, rightScore, isRightWin)}
            </div>
        `;

        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.style.display = 'block';
    }
}

window.FantasyApp = FantasyApp;
const app = new FantasyApp();
window.app = app;
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});

// Setup modal backdrop click & Escape close
document.addEventListener('DOMContentLoaded', () => {
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
});
