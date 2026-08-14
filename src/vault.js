import { compileVaultData } from './compiler.js';
import { database } from './firebase.js';
import { ref as dbRef, set, get, child, update } from 'firebase/database';
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
        this.draftResults = [];
        this.leagueSettings = {};
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

    async showBuildingSequence() {
        return new Promise(async (resolve) => {
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.backgroundColor = 'var(--bg-main)';
            overlay.style.zIndex = '9999';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'column';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.style.fontFamily = 'var(--font-main, sans-serif)';
            
            overlay.innerHTML = `
              <div style="text-align: center; padding: 3rem 1rem; width: 100%; max-width: 500px;">
                <div class="spinner" style="margin: 0 auto 1.5rem auto; border: 4px solid rgba(255, 215, 0, 0.2); border-top-color: var(--accent-gold); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
                <h3 style="font-family: var(--font-heading, 'Cinzel', serif); color: var(--accent-gold); margin-bottom: 0.5rem; font-size: 1.5rem;">Forging Your Vault</h3>
                <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 2rem;">Please keep this page open while we import your league history.</p>
                
                <div style="width: 100%; background: var(--bg-card); border-radius: 8px; height: 12px; overflow: hidden; border: 1px solid var(--border-line); margin-bottom: 0.75rem;">
                  <div id="build-progress-bar" style="width: 0%; height: 100%; background: var(--accent-gold); transition: width 0.3s ease;"></div>
                </div>
                
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-muted); font-weight: 500;">
                  <span id="build-status-text">Starting up...</span>
                  <span id="build-progress-text">0%</span>
                </div>
              </div>
              <style>
                @keyframes spin { 100% { transform: rotate(360deg); } }
              </style>
            `;
            
            document.body.appendChild(overlay);
            
            const bar = document.getElementById('build-progress-bar');
            const text = document.getElementById('build-progress-text');
            const status = document.getElementById('build-status-text');
            
            const updateUI = (progress, msg) => {
              bar.style.width = progress + '%';
              text.textContent = Math.round(progress) + '%';
              status.textContent = msg;
            };

            updateUI(5, "Initializing scrapers...");

            const pendingRaw = sessionStorage.getItem('pendingVaultBuild');
            if (!pendingRaw) {
                updateUI(100, "Error: Missing credentials!");
                setTimeout(resolve, 2000);
                return;
            }
            const creds = JSON.parse(pendingRaw);
            const { leagueId, s2, swid, customName } = creds;
            const slug = window.location.pathname.substring(1).replace(/\/$/, "");

            try {
                const currentYear = new Date().getFullYear();
                const possibleYears = Array.from({ length: 30 }, (_, i) => currentYear - i);
                
                updateUI(5, "Discovering league history...");

                const validYears = [];
                const checkPromises = possibleYears.map(async (year) => {
                    const checkUrl = `/api/scrape-season?leagueId=${leagueId}&year=${year}&s2=${encodeURIComponent(s2)}&swid=${encodeURIComponent(swid)}&checkOnly=true`;
                    try {
                        const res = await fetch(checkUrl);
                        if (res.ok) validYears.push(year);
                    } catch (e) {
                        // ignore fetch failures
                    }
                });

                await Promise.all(checkPromises);
                
                // Sort descending
                validYears.sort((a, b) => b - a);

                if (validYears.length === 0) {
                    throw new Error("No data found for this league.");
                }

                const seasonsData = [];
                let completed = 0;
                for (const year of validYears) {
                    updateUI(15 + (completed / validYears.length) * 70, `Syncing ${year} season...`);
                    const url = `/api/scrape-season?leagueId=${leagueId}&year=${year}&s2=${encodeURIComponent(s2)}&swid=${encodeURIComponent(swid)}`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.data) {
                            seasonsData.push(data);
                        }
                    } else if (res.status !== 404) {
                        console.warn(`Failed to fetch ${year}:`, res.status);
                    }
                    completed++;
                }

                if (seasonsData.length === 0) {
                    throw new Error("No data found for this league.");
                }

                updateUI(85, "Fetching NFL Schedule & Generating Vault payload...");
                let nflCsvData = null;
                try {
                    const nflRes = await fetch('/nfl_all_games_master.csv');
                    if (nflRes.ok) {
                        nflCsvData = await nflRes.text();
                    }
                } catch (e) {
                    console.warn("Could not load NFL schedule data:", e);
                }
                const compiledPayload = compileVaultData(seasonsData, creds.members, customName, nflCsvData);
                const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
                if (session && session.email) {
                    compiledPayload.league_settings.admin_email = session.email;
                }

                updateUI(92, "Saving to Vault Database...");
                const databaseRef = dbRef(database, `leagues/${slug}`);
                await set(databaseRef, compiledPayload);

                sessionStorage.removeItem('pendingVaultBuild');

                updateUI(100, "Complete!");
                if (session && session.email) {
                    try {
                        const joinCode = slug.substring(0, 3).toUpperCase() + "24"; 
                        await fetch('/api/email', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ 
                                email: session.email, 
                                slug: slug,
                                joinCode: joinCode,
                                origin: window.location.origin
                            })
                        });
                    } catch (e) {
                        console.error("Failed to send welcome email", e);
                    }
                }

                setTimeout(() => {
                    overlay.style.opacity = '0';
                    overlay.style.transition = 'opacity 0.5s ease';
                    setTimeout(() => {
                        document.body.removeChild(overlay);
                        resolve();
                    }, 500);
                }, 500);

            } catch (error) {
                console.error("Build Failed:", error);
                updateUI(100, "Build failed. " + error.message);
                setTimeout(() => {
                    document.body.removeChild(overlay);
                    resolve();
                }, 3000);
            }
        });
    }

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('building')) {
            await this.showBuildingSequence();
            window.history.replaceState({}, '', window.location.pathname);
        }

        // Private League Guard
        if (typeof window.AuthEngine !== 'undefined') {
            const persona = window.AuthEngine.getPersona();
            if (persona === 'public') {
                document.body.innerHTML = `
                    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#1a1d21; color:#fff; text-align:center; padding: 2rem; font-family: 'Inter', sans-serif;">
                        <h1 style="font-family:'Cinzel', serif; color:#c5a059; margin-bottom: 1rem; font-size: 2.5rem;">Private League Archive</h1>
                        <p style="margin-bottom: 2rem; color: #a1aab3; max-width: 420px; line-height: 1.6;">This Fantasy Vault is private. You must be an authenticated member or league administrator to view these records.</p>
                        <a href="/" style="background:#c5a059; color:#000; padding: 0.85rem 1.75rem; border-radius: 4px; font-weight:600; text-decoration:none; font-size: 0.95rem;">Sign In / Enter Invite Code</a>
                    </div>
                `;
                return;
            }
        }

        this.setupFounderControlBar();
        this.setupThemeToggle();
        await this.loadData();
        this.initPowerRankings();
        this.setupNavigation();
        this.setupH2HControls();
        this.renderH2H();
        this.updateAdminTabVisibility();
        window.addEventListener('vault_auth_changed', () => {
            this.updateAdminTabVisibility();
            if (this.activeTab === 'admin') {
                this.renderAdminDashboard();
            }
        });

        // Check for join code in URL params (e.g. ?join=CODE)
        const joinCodeParam = urlParams.get('join');
        if (joinCodeParam) {
            setTimeout(() => {
                if (typeof window.startManagerClaimFlow === 'function') {
                    window.startManagerClaimFlow(joinCodeParam);
                }
            }, 600);
        }
    }

    setupFounderControlBar() {
        if (typeof window.AuthEngine === 'undefined') return;
        
        let bar = document.getElementById('founder-control-bar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'founder-control-bar';
            bar.className = 'founder-control-bar';
            document.body.prepend(bar);
        }

        const session = window.AuthEngine.getSession();
        const persona = window.AuthEngine.getPersona();
        const activeUser = session ? (session.name || session.email) : 'Guest Visitor';
        const isFounder = session && session.isFounder;
        if (!isFounder) return;

        let personaHtml = '';
        if (isFounder) {
            personaHtml = `
                <label style="margin-left:0.5rem;">Persona:</label>
                <select id="select-persona-mode" class="persona-select">
                    <option value="founder" ${persona === 'founder' ? 'selected' : ''}>👑 Founder View (Landon)</option>
                    <option value="admin" ${persona === 'admin' ? 'selected' : ''}>⚙️ League Admin (Commissioner)</option>
                    <option value="member" ${persona === 'member' ? 'selected' : ''}>👥 Verified Member (Team Owner)</option>
                    <option value="public" ${persona === 'public' ? 'selected' : ''}>👁️ Public Visitor</option>
                </select>
            `;
        }

        const leagueName = this.bundleData && this.bundleData.league_settings ? this.bundleData.league_settings.name : "The Fantasy Vault Archive";
        
        bar.innerHTML = `
            <div class="founder-bar-left">
                <span>🏛️ ${leagueName}</span>
            </div>
            <div class="founder-bar-right">
                <span>User: <strong>${activeUser}</strong> ${isFounder ? '<span style="color:#d4af37;">(Founder)</span>' : ''}</span>
                ${personaHtml}
                <a href="/" style="color:#c5a059; text-decoration:none; margin-left:0.5rem; font-weight:600;">Hub &rarr;</a>
            </div>
        `;

        const select = document.getElementById('select-persona-mode');
        if (select) {
            select.addEventListener('change', (e) => {
                window.AuthEngine.setPersona(e.target.value);
                window.location.reload();
            });
        }
    }

    openSettingsModal(season) {
        const modal = document.getElementById('settings-modal');
        const content = document.getElementById('settings-modal-content');
        const yearTitle = document.getElementById('settings-modal-year');
        
        if (modal && content && yearTitle) {
            yearTitle.textContent = `${season} Season`;
            
            const settings = (this.scoringSettings && (this.scoringSettings[season] || this.scoringSettings[String(season)])) ||
                             (this.leagueSettings && (this.leagueSettings[season] || this.leagueSettings.scoringRules));

            if (!settings || Object.keys(settings).length === 0) {
                content.innerHTML = '<p style="padding: 1rem; color: var(--text-muted);">No scoring settings available for this season.</p>';
            } else {
                let html = '';
                Object.keys(settings).forEach(category => {
                    html += `
                    <div style="margin-bottom: 20px;">
                        <h3 style="color: var(--accent-gold); font-size: 1.1rem; margin-bottom: 8px; border-bottom: 1px solid var(--border-color); padding-bottom: 4px;">${category}</h3>
                        <table class="table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="border-bottom: 2px solid var(--border-color); text-align: left;">
                                    <th style="padding: 6px 8px; color: var(--text-muted); font-size: 0.85rem;">Action</th>
                                    <th style="padding: 6px 8px; text-align: right; color: var(--text-muted); font-size: 0.85rem;">Points</th>
                                </tr>
                            </thead>
                            <tbody>
                    `;
                    settings[category].forEach(item => {
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
        const slug = window.location.pathname.substring(1).replace(/\/$/, "");
        
        let bundleData = null;
        try {
            const databaseRef = dbRef(database, `leagues/${slug}`);
            const snapshot = await get(databaseRef);
            if (snapshot.exists()) {
                bundleData = snapshot.val();
            }
        } catch (err) {
            console.error("Failed to load league data from database:", err);
            // Fallback for static demo routes
            if (window.FANTASY_DATA) {
                bundleData = window.FANTASY_DATA;
            }
        }

        if (!bundleData) {
            document.body.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#1a1d21; color:#fff; text-align:center; padding: 2rem;">
                    <h1 style="color:#ff6b6b;">Vault Not Found</h1>
                    <p>No data exists for this league yet, or it is currently being built.</p>
                </div>
            `;
            return;
        }

        const managersData = bundleData.members || [];
        const matchupsData = bundleData.matchups || [];
        const statsData = bundleData.weekly_player_stats || [];
        const standingsData = bundleData.league_standings || [];
        const transactionsData = bundleData.transactions || [];
        const powerRankingsData = bundleData.power_rankings_history || [];
        const draftData = bundleData.draft_results || [];
        const settingsData = bundleData.league_settings || {};

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
        this.scoringSettings = bundleData.scoring_settings || bundleData.scoring_rules || {};

        // Load claims & registration state from Firebase RTDB
        this.claims = {};
        if (this.leagueSlug) {
            try {
                const claimsSnap = await get(dbRef(database, `leagues/${this.leagueSlug}/claims`));
                if (claimsSnap.exists()) {
                    this.claims = claimsSnap.val() || {};
                }
            } catch (e) {
                console.warn('Could not load claims from RTDB', e);
            }

            // Real-time listener for claims
            try {
                const claimsRef = dbRef(database, `leagues/${this.leagueSlug}/claims`);
                onValue(claimsRef, (snapshot) => {
                    this.claims = snapshot.exists() ? (snapshot.val() || {}) : {};
                    if (this.activeTab === 'admin') {
                        this.renderAdminDashboard();
                    }
                });
            } catch (e) {
                console.warn('Claims listener error', e);
            }
        }

        // Register dynamic join code for AuthEngine
        if (typeof window.JOIN_CODES !== 'undefined' && this.leagueSlug) {
            const dynamicCode = (this.leagueSettings.join_code || this.leagueSlug.substring(0, 3).toUpperCase() + '24').toUpperCase();
            window.JOIN_CODES[dynamicCode] = {
                leagueId: this.leagueSlug,
                name: this.leagueSettings.name || "Fantasy Football League",
                path: `/${this.leagueSlug}/`,
                managers: this.members || this.managers || []
            };
        }

        // Update DOM with League Metadata
        const leagueName = this.leagueSettings.name || "Fantasy Football League";
        const totalSeasons = this.leagueSettings.totalSeasons || this.seasonsList?.length || "--";
        const firstYear = this.leagueSettings.firstYear || "2015";
        
        const titleEl = document.getElementById("league-title");
        if (titleEl) {
            const hasLeagueSuffix = /league$/i.test(leagueName.trim());
            titleEl.innerHTML = `${leagueName}<br>${hasLeagueSuffix ? 'HQ' : 'League HQ'}`;
        }

        const tagline = this.leagueSettings.tagline || this.leagueSettings.subtitle || "Your League Archive";
        const subtitleEl = document.getElementById("league-subtitle");
        if (subtitleEl) subtitleEl.textContent = tagline;
        
        const idInfoEl = document.getElementById("league-id-info");
        if (idInfoEl) idInfoEl.textContent = `League ID: ${this.leagueSettings.id || "------"}`;

        const editionInfoEl = document.getElementById("league-edition-info");
        if (editionInfoEl) editionInfoEl.innerHTML = `EST. ${firstYear}`;

        const seasonsEl = document.getElementById("total-seasons");
        if (seasonsEl) seasonsEl.textContent = totalSeasons;

        const footerTextEl = document.getElementById("footer-text");
        if (footerTextEl) footerTextEl.textContent = `${leagueName} Archive`;
        
        const recordsHeroLeagueNameEl = document.getElementById("records-hero-league-name");
        if (recordsHeroLeagueNameEl) recordsHeroLeagueNameEl.textContent = `The ${leagueName} Record Book`;

        const footerEspnLinkEl = document.getElementById("footer-espn-link");
        if (footerEspnLinkEl && this.leagueSettings.id) {
            footerEspnLinkEl.href = `https://fantasy.espn.com/football/league?leagueId=${this.leagueSettings.id}`;
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
        const btnAdmin = document.getElementById('btn-tab-admin');
        const viewHome = document.getElementById('view-home');
        const viewH2h = document.getElementById('view-h2h');
        const viewRecords = document.getElementById('view-records');
        const viewAdmin = document.getElementById('view-admin');

        const switchTab = (tab) => {
            this.activeTab = tab;
            [btnHome, btnH2h, btnRecords, btnAdmin].forEach(btn => btn && btn.classList.remove('active'));
            [viewHome, viewH2h, viewRecords, viewAdmin].forEach(view => view && view.classList.remove('active'));

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
            } else if (tab === 'admin') {
                btnAdmin && btnAdmin.classList.add('active');
                viewAdmin && viewAdmin.classList.add('active');
                this.renderAdminDashboard();
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        this.switchTab = switchTab;

        if (btnHome) btnHome.addEventListener('click', () => switchTab('home'));
        if (btnH2h) btnH2h.addEventListener('click', () => switchTab('h2h'));
        if (btnRecords) btnRecords.addEventListener('click', () => switchTab('records'));
        if (btnAdmin) btnAdmin.addEventListener('click', () => switchTab('admin'));

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
                const name = m.canonical_name || m.name || m.id;
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

        const firstYear = parseInt(this.leagueSettings.firstYear) || 2015;
        const lastYear = parseInt(this.leagueSettings.lastYear) || new Date().getFullYear();

        if (btnAll) btnAll.textContent = `All Years (${firstYear}–${lastYear})`;

        if (selStart && selEnd) {
            let optionsHTML = '';
            for (let y = firstYear; y <= lastYear; y++) {
                optionsHTML += `<option value="${y}">${y}</option>`;
            }
            selStart.innerHTML = optionsHTML;
            selEnd.innerHTML = optionsHTML;
            
            // Set defaults
            selStart.value = firstYear.toString();
            selEnd.value = lastYear.toString();
        }

        
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

        const m1Name = m1Obj.canonical_name || m1Obj.name || m1Id;
        const m2Name = m2Obj.canonical_name || m2Obj.name || m2Id;

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
                : `onclick="window.app.openBoxscoreModal(${g.year}, ${g.week}, '${g.home_manager_id}', '${g.away_manager_id}')"`;

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

        const rawGamePlayers = this.playerStats.filter(p => {
            const yr = Number(p.year || p.season);
            const wk = Number(p.week);
            if (yr !== sNum || wk !== wNum) return false;
            const pTeam = Number(p.team_id);
            const hTeam = Number(m.home_team_id !== undefined ? m.home_team_id : m.team_1_id);
            const aTeam = Number(m.away_team_id !== undefined ? m.away_team_id : m.team_2_id);
            if (pTeam === hTeam || pTeam === aTeam) return true;
            if (p.manager_id && (p.manager_id === m.home_manager_id || p.manager_id === m.away_manager_id || p.manager_id === m.team_1_manager_id || p.manager_id === m.team_2_manager_id)) return true;
            return false;
        });
        const seenKeys = new Set();
        const gamePlayers = [];
        for (const p of rawGamePlayers) {
            const k = `${p.team_id}_${p.player_id || p.player_name}_${p.is_starter ? 'S' : 'B'}`;
            if (!seenKeys.has(k)) { seenKeys.add(k); gamePlayers.push(p); }
        }
        const leftTeamId = Number(m.home_team_id !== undefined ? m.home_team_id : m.team_1_id);
        const rightTeamId = Number(m.away_team_id !== undefined ? m.away_team_id : m.team_2_id);
        const leftMgrId = m.home_manager_id || m.team_1_manager_id;
        const rightMgrId = m.away_manager_id || m.team_2_manager_id;

        const leftPlayers  = gamePlayers.filter(p => Number(p.team_id) === leftTeamId || (leftMgrId && p.manager_id === leftMgrId));
        const rightPlayers = gamePlayers.filter(p => Number(p.team_id) === rightTeamId || (rightMgrId && p.manager_id === rightMgrId));

        const renderRosterTable = (players, teamName, score, isWinner) => {
            const starters = players.filter(p => p.is_starter);
            const bench    = players.filter(p => !p.is_starter);
            let html = `<div class="roster-card"><div class="roster-card-header"><div class="roster-team-title">${teamName} ${isWinner ? '<span class="win-badge">WINNER</span>' : ''}</div><div class="roster-team-score">${score.toFixed(2)}</div></div><div class="roster-section-title"><span>Starters</span></div>`;

            if (players.length === 0) {
                html += `
                    <div style="padding: 36px 16px; text-align: center; color: var(--text-muted);">
                        <div style="font-size: 1.8rem; margin-bottom: 8px;">⏳</div>
                        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px; font-size: 0.95rem;">Box score is populating, please check back in a moment.</div>
                        <div style="font-size: 0.82rem;">Player statlines and rosters are synchronizing with the platform archive.</div>
                    </div>
                `;
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
                    <h2>${season} • Week ${week} ${m && m.is_playoff ? '— Playoffs (' + (roundName || 'Playoffs') + ')' : '— Regular Season'}</h2>
                    <p>${leftName} (${leftScore.toFixed(2)}) vs ${rightName} (${rightScore.toFixed(2)})</p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="btn btn-sm btn-outline-primary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="window.app.openSettingsModal(${season})" title="View League Scoring Settings">? Scoring</button>
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

    updateAdminTabVisibility() {
        const btnAdmin = document.getElementById('btn-tab-admin');
        if (!btnAdmin) return;
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const adminEmail = this.leagueSettings?.admin_email || window.FANTASY_DATA?.league_settings?.admin_email;
        const isFounder = window.AuthEngine && window.AuthEngine.isFounder();
        const isLeagueAdmin = Boolean(isFounder || (session && adminEmail && session.email && session.email.toLowerCase() === adminEmail.toLowerCase()));

        if (isLeagueAdmin) {
            btnAdmin.style.display = 'inline-flex';
        } else {
            btnAdmin.style.display = 'none';
            if (this.activeTab === 'admin') {
                this.switchTab('home');
            }
        }
    }

    renderAdminDashboard() {
        const container = document.getElementById('view-admin');
        if (!container) return;

        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const currentTagline = this.leagueSettings.tagline || this.leagueSettings.subtitle || "Your League Archive";
        const leagueName = this.leagueSettings.name || "Fantasy Football League";

        // Join code & shareable links
        const joinCode = (this.leagueSettings.join_code || (this.leagueSlug ? this.leagueSlug.substring(0, 3).toUpperCase() + '24' : 'VAULT24')).toUpperCase();
        const joinLink = window.location.origin + '/' + this.leagueSlug + '/?join=' + joinCode;
        const leagueUrl = window.location.origin + '/' + this.leagueSlug + '/';

        // Generate manager list for renaming, claims, and merging
        const sortedMembers = [...(this.members || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        // Build table rows for registered members, display name editing, and invites
        const managerRows = sortedMembers.map(m => {
            const memberMatchups = this.matchups.filter(x => x.home_manager_id === m.id || x.away_manager_id === m.id || x.team_1_manager_id === m.id || x.team_2_manager_id === m.id);
            const yearsActive = [...new Set(memberMatchups.map(x => x.year || x.season))].sort();
            const yearsStr = yearsActive.length > 0 ? `${yearsActive[0]}–${yearsActive[yearsActive.length - 1]} (${yearsActive.length} yr${yearsActive.length > 1 ? 's' : ''})` : 'Active';
            
            const claim = this.claims ? this.claims[m.id] : null;
            const claimEmail = claim ? (claim.email || claim.name || 'Claimed') : '';
            const isClaimed = Boolean(claim);

            const emailSubject = encodeURIComponent(`Claim your ${leagueName} profile on The Fantasy Vault`);
            const emailBody = encodeURIComponent(
                `Hey ${m.name},\n\n` +
                `You're invited to claim your manager profile and explore our complete all-time league archive on The Fantasy Vault!\n\n` +
                `🔗 Direct Claim Link: ${joinLink}\n` +
                `🎟️ League Join Code: ${joinCode}\n\n` +
                `See all of your historical matchups, stats, head-to-head records, and league trophies in one place.`
            );
            const mailtoHref = `mailto:${claim?.email || ''}?subject=${emailSubject}&body=${emailBody}`;

            return `
                <tr data-manager-id="${m.id}">
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <input type="text" class="admin-input mgr-rename-input" value="${m.name}" placeholder="Display name" style="min-width: 120px; max-width: 180px; padding: 6px 10px; font-size: 0.88rem; font-weight: 600;">
                            <button class="btn-save-manager-name btn-primary" data-manager-id="${m.id}" style="padding: 6px 10px; font-size: 0.78rem; font-weight: 600; cursor: pointer; white-space: nowrap;">Save</button>
                        </div>
                    </td>
                    <td style="font-family: monospace; font-size: 0.8rem; color: var(--text-muted);">${m.id}</td>
                    <td style="font-size: 0.82rem; color: var(--text-secondary);">${yearsStr}</td>
                    <td>
                        ${isClaimed ? `
                            <span class="badge-registered" title="Claimed by ${claimEmail}${claim.claimedAt ? ' on ' + new Date(claim.claimedAt).toLocaleDateString() : ''}">
                                ✓ ${claimEmail}
                            </span>
                        ` : `
                            <span class="badge-unregistered">Unregistered</span>
                        `}
                    </td>
                    <td>
                        <div class="admin-actions-cell">
                            <a href="${mailtoHref}" class="btn-email-invite" title="Open email draft to send invite to ${m.name}">
                                ✉️ Email Invite
                            </a>
                            <button class="btn-copy-action btn-sm" data-copy="${joinLink}" title="Copy direct invite link">
                                📋 Copy Link
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        // Build options for merge selector
        const managerOptions = sortedMembers.map(m => `<option value="${m.id}">${m.name} (ID: ${m.id})</option>`).join('');

        container.innerHTML = `
            <div class="admin-dashboard-wrapper">
                <!-- Masthead / Title -->
                <div class="admin-dashboard-hero">
                    <div class="admin-badge-gold">👑 League Admin Control Panel</div>
                    <h1>${leagueName} Administration</h1>
                    <p class="admin-hero-sub">Manage your league's public identity, custom taglines, manager roster names, historical merges, and member access.</p>
                </div>

                <!-- 1. TAGLINE CUSTOMIZATION -->
                <div class="card admin-section-card">
                    <div class="admin-card-header">
                        <div class="admin-card-icon">🏷️</div>
                        <div>
                            <h2>League Tagline & Subtitle</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Customize the official league motto displayed directly beneath your league title on the homepage header.</p>
                        </div>
                    </div>

                    <div class="admin-landon-note">
                        <div class="landon-avatar">👑</div>
                        <div class="landon-note-content">
                            <div class="landon-note-title">A Note from Landon</div>
                            <p class="landon-note-text">"This is one of the first points of customization for your league! Feel free to choose from one of the preset league taglines below, enter your own custom motto, or make it a league tradition by letting your reigning league champion set the tagline for the season."</p>
                        </div>
                    </div>

                    <div style="margin-top: 1.25rem;">
                        <label style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: var(--text-secondary);">Choose a Preset Tagline:</label>
                        <div class="tagline-presets-grid">
                            <button type="button" class="btn-tagline-preset" data-preset="Your League Archive">"Your League Archive"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="The All-Time Archive & Historical Record">"The All-Time Archive &amp; Historical Record"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Where Legends Collide & Records Fall">"Where Legends Collide &amp; Records Fall"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Precision Fantasy Football Analytics">"Precision Fantasy Football Analytics"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Every Matchup. Every Champion. Eternal Record.">"Every Matchup. Every Champion. Eternal Record."</button>
                            <button type="button" class="btn-tagline-preset" data-preset="A Tradition Unlike Any Other">"A Tradition Unlike Any Other"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Where Bad Trades Live Forever">"Where Bad Trades Live Forever"</button>
                        </div>
                    </div>

                    <div style="margin-top: 1.5rem;">
                        <label for="admin-tagline-input" style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; color: var(--text-secondary);">Custom Tagline / Subtitle:</label>
                        <div class="tagline-input-row">
                            <input type="text" id="admin-tagline-input" class="admin-input" value="${currentTagline}" placeholder="Enter your league's custom motto or tagline...">
                            <button id="btn-save-tagline" class="btn-primary" style="padding: 10px 20px; font-weight: 700; border-radius: 4px; white-space: nowrap; cursor: pointer;">Save Tagline</button>
                        </div>
                        <div id="tagline-save-feedback" class="admin-feedback-msg" style="display: none;"></div>
                    </div>
                </div>

                <!-- 2. REGISTERED MEMBERS & MANAGER ROSTER -->
                <div class="card admin-section-card" style="margin-top: 2rem;">
                    <div class="admin-card-header">
                        <div class="admin-card-icon">👥</div>
                        <div>
                            <h2>League Members & Registration Roster</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Manage manager display names, view registered email accounts, and send invite links for members to claim their historical profiles.</p>
                        </div>
                    </div>

                    <div style="margin-top: 1.25rem;">
                        <div class="admin-table-scroll">
                            <table class="admin-table">
                                <thead>
                                    <tr>
                                        <th>Manager Display Name</th>
                                        <th>Manager ID</th>
                                        <th>Active Seasons</th>
                                        <th>Account / Registered Email</th>
                                        <th>Invite &amp; Claim Links</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${managerRows}
                                </tbody>
                            </table>
                        </div>
                        <div id="manager-rename-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>

                    <!-- Merge Historical Managers Sub-block -->
                    <div class="admin-merge-box" style="margin-top: 2rem;">
                        <h3 style="font-size: 1.05rem; font-weight: 700; margin-top: 0; margin-bottom: 0.5rem; color: #991B1B; display: flex; align-items: center; gap: 8px;">
                            <span>🔗 Merge Historical Manager Profiles</span>
                        </h3>
                        <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem; line-height: 1.5;">
                            If an owner played under different accounts, aliases, or team profiles in past seasons, select their old profile to absorb it into their primary active profile. All matchup histories, championships, and statistics will be transferred.
                        </p>

                        <div class="admin-merge-controls">
                            <div class="merge-select-group">
                                <label for="merge-source-mgr">Source Profile <span style="font-weight:normal; opacity:0.8;">(Old alias to absorb &amp; delete)</span>:</label>
                                <select id="merge-source-mgr" class="admin-select">
                                    <option value="">-- Select Source Profile --</option>
                                    ${managerOptions}
                                </select>
                            </div>
                            <div class="merge-arrow">➔</div>
                            <div class="merge-select-group">
                                <label for="merge-target-mgr">Target Profile <span style="font-weight:normal; opacity:0.8;">(Active profile to keep &amp; inherit records)</span>:</label>
                                <select id="merge-target-mgr" class="admin-select">
                                    <option value="">-- Select Target Profile --</option>
                                    ${managerOptions}
                                </select>
                            </div>
                            <button id="btn-run-merge" class="btn btn-danger" style="padding: 10px 18px; font-weight: 700; height: 42px; border-radius: 4px; white-space: nowrap; cursor: pointer;">Merge Profiles</button>
                        </div>
                        <div id="manager-merge-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>
                </div>

                <!-- 3. LEAGUE INVITES & ACCESS -->
                <div class="card admin-section-card" style="margin-top: 2rem;">
                    <div class="admin-card-header">
                        <div class="admin-card-icon">🎟️</div>
                        <div>
                            <h2>League Invites & Access Control</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Share join codes and direct links with your league members to grant them access to this vault.</p>
                        </div>
                    </div>

                    <div class="admin-invite-grid" style="margin-top: 1.25rem;">
                        <div class="admin-invite-box">
                            <span class="invite-label">Official Join Code:</span>
                            <div class="invite-value-row">
                                <code class="invite-code-pill">${joinCode}</code>
                                <button class="btn-copy-action btn-sm" data-copy="${joinCode}">Copy Code</button>
                            </div>
                        </div>
                        <div class="admin-invite-box">
                            <span class="invite-label">Direct Invite Link:</span>
                            <div class="invite-value-row">
                                <span class="invite-link-text">${joinLink}</span>
                                <button class="btn-copy-action btn-sm" data-copy="${joinLink}">Copy Link</button>
                            </div>
                        </div>
                        <div class="admin-invite-box">
                            <span class="invite-label">Public League URL:</span>
                            <div class="invite-value-row">
                                <span class="invite-link-text">${leagueUrl}</span>
                                <button class="btn-copy-action btn-sm" data-copy="${leagueUrl}">Copy URL</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Wire up Tagline preset buttons
        const presetBtns = container.querySelectorAll('.btn-tagline-preset');
        const taglineInput = container.querySelector('#admin-tagline-input');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-preset');
                if (taglineInput && text) {
                    taglineInput.value = text;
                    taglineInput.focus();
                }
            });
        });

        // Wire up Save Tagline button
        const btnSaveTagline = container.querySelector('#btn-save-tagline');
        if (btnSaveTagline && taglineInput) {
            btnSaveTagline.addEventListener('click', async () => {
                const newTagline = taglineInput.value.trim();
                if (!newTagline) return;
                await this.saveLeagueTagline(newTagline);
            });
        }

        // Wire up Manager Rename buttons
        const renameBtns = container.querySelectorAll('.btn-save-manager-name');
        renameBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const mgrId = btn.getAttribute('data-manager-id');
                const row = container.querySelector(`tr[data-manager-id="${mgrId}"]`);
                const input = row ? row.querySelector('.mgr-rename-input') : null;
                if (!input) return;
                const newName = input.value.trim();
                if (!newName) {
                    alert("Manager display name cannot be empty.");
                    return;
                }
                await this.updateManagerName(mgrId, newName);
            });
        });

        // Wire up Merge Managers button
        const btnMerge = container.querySelector('#btn-run-merge');
        const selSource = container.querySelector('#merge-source-mgr');
        const selTarget = container.querySelector('#merge-target-mgr');
        if (btnMerge && selSource && selTarget) {
            btnMerge.addEventListener('click', async () => {
                const sourceId = selSource.value;
                const targetId = selTarget.value;
                if (!sourceId || !targetId) {
                    alert("Please select both a Source Manager and a Target Manager.");
                    return;
                }
                if (sourceId === targetId) {
                    alert("Source and Target Manager cannot be the same person.");
                    return;
                }
                const sourceMember = this.members.find(m => m.id === sourceId);
                const targetMember = this.members.find(m => m.id === targetId);
                const sourceName = sourceMember ? sourceMember.name : sourceId;
                const targetName = targetMember ? targetMember.name : targetId;

                const confirmed = window.confirm(
                    `Are you sure you want to merge "${sourceName}" into "${targetName}"?\n\n` +
                    `All historical matchup results, statistics, and records for "${sourceName}" will be permanently transferred to "${targetName}".\n\n` +
                    `This action cannot be undone.`
                );
                if (confirmed) {
                    await this.mergeHistoricalManagers(sourceId, targetId);
                }
            });
        }

        // Wire up Copy buttons
        const copyBtns = container.querySelectorAll('.btn-copy-action');
        copyBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const textToCopy = btn.getAttribute('data-copy');
                if (textToCopy) {
                    try {
                        await navigator.clipboard.writeText(textToCopy);
                        const originalText = btn.textContent;
                        btn.textContent = '✓ Copied!';
                        setTimeout(() => { btn.textContent = originalText; }, 2000);
                    } catch (e) {
                        console.error('Clipboard copy failed', e);
                    }
                }
            });
        });
    }

    async saveLeagueTagline(newTagline) {
        const feedbackEl = document.getElementById('tagline-save-feedback');
        const btn = document.getElementById('btn-save-tagline');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

        try {
            this.leagueSettings.tagline = newTagline;
            this.leagueSettings.subtitle = newTagline;

            // Live update header subtitle
            const subtitleEl = document.getElementById('league-subtitle');
            if (subtitleEl) subtitleEl.textContent = newTagline;

            // Save to Firebase RTDB
            if (this.leagueSlug) {
                const settingsRef = dbRef(database, `leagues/${this.leagueSlug}/league_settings`);
                await update(settingsRef, {
                    tagline: newTagline,
                    subtitle: newTagline
                });
            }

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg success';
                feedbackEl.innerHTML = `✓ Tagline updated successfully to "<em>${newTagline}</em>"!`;
                setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
            }
        } catch (e) {
            console.error('Failed to save tagline', e);
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg error';
                feedbackEl.textContent = 'Error saving tagline. Please try again.';
            }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Save Tagline'; }
        }
    }

    async updateManagerName(managerId, newName) {
        const feedbackEl = document.getElementById('manager-rename-feedback');
        try {
            // 1. Update in-memory members
            const memberIdx = this.members.findIndex(m => m.id === managerId);
            if (memberIdx !== -1) {
                this.members[memberIdx].name = newName;
            }

            // 2. Update in-memory managers
            const mgr = this.managers.find(m => m.id === managerId);
            if (mgr) {
                mgr.name = newName;
                mgr.manager_name = newName;
            }

            // 3. Update matchups
            this.matchups.forEach(m => {
                if (m.home_manager_id === managerId || m.team_1_manager_id === managerId) {
                    m.home_manager_name = newName;
                    m.team_1_manager_name = newName;
                }
                if (m.away_manager_id === managerId || m.team_2_manager_id === managerId) {
                    m.away_manager_name = newName;
                    m.team_2_manager_name = newName;
                }
            });

            // 4. Update player stats
            this.playerStats.forEach(p => {
                if (p.manager_id === managerId) {
                    p.manager_name = newName;
                }
            });

            // 5. Update standings
            this.standings.forEach(s => {
                if (s.manager_id === managerId) {
                    s.manager_name = newName;
                }
            });

            // 6. Update Firebase RTDB
            if (this.leagueSlug) {
                if (memberIdx !== -1) {
                    const memberRef = dbRef(database, `leagues/${this.leagueSlug}/members/${memberIdx}`);
                    await update(memberRef, { name: newName });
                }
                const allMembersRef = dbRef(database, `leagues/${this.leagueSlug}/members`);
                await set(allMembersRef, this.members);
            }

            // 7. Refresh UI components
            this.setupH2HControls();
            if (this.activeTab === 'admin') {
                this.renderAdminDashboard();
            }

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg success';
                feedbackEl.innerHTML = `✓ Manager name updated to "<strong>${newName}</strong>"!`;
                setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
            }
        } catch (e) {
            console.error('Failed to update manager name', e);
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg error';
                feedbackEl.textContent = 'Error updating manager name. Please try again.';
            }
        }
    }

    async mergeHistoricalManagers(sourceId, targetId) {
        const feedbackEl = document.getElementById('manager-merge-feedback');
        const btn = document.getElementById('btn-run-merge');
        if (btn) { btn.disabled = true; btn.textContent = 'Merging...'; }

        try {
            const targetMember = this.members.find(m => m.id === targetId);
            const targetName = targetMember ? targetMember.name : targetId;

            // 1. Reassign matchups
            this.matchups.forEach(m => {
                if (m.home_manager_id === sourceId || m.team_1_manager_id === sourceId) {
                    m.home_manager_id = targetId;
                    m.team_1_manager_id = targetId;
                    m.home_manager_name = targetName;
                    m.team_1_manager_name = targetName;
                }
                if (m.away_manager_id === sourceId || m.team_2_manager_id === sourceId) {
                    m.away_manager_id = targetId;
                    m.team_2_manager_id = targetId;
                    m.away_manager_name = targetName;
                    m.team_2_manager_name = targetName;
                }
            });

            // 2. Reassign player stats
            this.playerStats.forEach(p => {
                if (p.manager_id === sourceId) {
                    p.manager_id = targetId;
                    p.manager_name = targetName;
                }
            });

            // 3. Reassign standings
            this.standings.forEach(s => {
                if (s.manager_id === sourceId) {
                    s.manager_id = targetId;
                    s.manager_name = targetName;
                }
            });

            // 4. Remove source from members
            this.members = this.members.filter(m => m.id !== sourceId);
            this.managers = this.managers.filter(m => m.id !== sourceId);

            // 5. Save updated datasets to Firebase RTDB
            if (this.leagueSlug) {
                const membersRef = dbRef(database, `leagues/${this.leagueSlug}/members`);
                const matchupsRef = dbRef(database, `leagues/${this.leagueSlug}/matchups`);
                const standingsRef = dbRef(database, `leagues/${this.leagueSlug}/league_standings`);
                const playerStatsRef = dbRef(database, `leagues/${this.leagueSlug}/weekly_player_stats`);

                await set(membersRef, this.members);
                await set(matchupsRef, this.matchups);
                await set(standingsRef, this.standings);
                await set(playerStatsRef, this.playerStats);
            }

            // 6. Refresh UI components
            this.setupH2HControls();
            this.renderAdminDashboard();

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg success';
                feedbackEl.innerHTML = `✓ Successfully merged manager profiles into <strong>${targetName}</strong>!`;
                setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
            }
        } catch (e) {
            console.error('Failed to merge managers', e);
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg error';
                feedbackEl.textContent = 'Error during merge. Please try again.';
            }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Merge Profiles'; }
        }
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
