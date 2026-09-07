import { compileVaultData, generateRandomJoinCode, calculateSeasonLoser, getRuleDescription } from './compiler.js';
import { database } from './firebase.js';
import { ref as dbRef, set, get, child, update, onValue } from 'firebase/database';
import { VaultDraftEngine } from './draft.js';
import { nflStats } from './nfl_stats.js';
import { formatManagerDisplayName } from './formatters.js';
import { CommissionerNotesEngine } from './commissioner_notes.js';
import { PowerRankingsEngine } from './power_rankings.js';
export function getMatchupRoundLabel(m) {
    if (!m) return '';
    const gt = String(m.game_type || '').toLowerCase().trim();
    const pr = String(m.playoff_round || '').toLowerCase().trim();

    // 1. Toilet Bowl
    if (m.is_toilet_bowl || gt.includes('toilet') || pr.includes('toilet')) {
        return 'Toilet Bowl';
    }

    // 2. 3rd Place Consolation Game
    if (gt.includes('3rd') || pr.includes('3rd')) {
        return '3rd Place Game';
    }

    // 3. Consolation bracket / game
    if (m.is_consolation || gt.includes('consolation') || pr.includes('consolation')) {
        return 'Consolation';
    }

    // 4. Explicit round names (playoff_round takes priority over bracket-wide game_type)
    if (pr.includes('quarter') || gt.includes('quarter')) return 'Quarterfinals';
    if (pr.includes('semi') || gt.includes('semi')) return 'Semifinals';
    if (pr.includes('final') || pr.includes('champ') || gt.includes('champ')) return 'Championship';

    // 5. Fallback inference based on week IF it is marked as a playoff game
    const isPlayoffs = Boolean(m.is_playoffs || m.is_playoff || gt === 'playoffs');
    if (isPlayoffs) {
        const yr = Number(m.season || m.year);
        const wk = Number(m.week);
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

    return '';
}

export function getPlayoffRoundName(season, week) {
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
    if (!player) return '';
    if (typeof player.nfl_stat_line === 'string' && player.nfl_stat_line.trim()) {
        return player.nfl_stat_line.trim();
    }
    if (typeof player.stat_line === 'string' && player.stat_line.trim()) {
        return player.stat_line.trim();
    }
    if (!player.stat_line || typeof player.stat_line !== 'object' || Object.keys(player.stat_line).length === 0) return '';
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

function formatPlayerNflGameInfo(player) {
    if (!player) return 'NFL';
    let opp = (player.nfl_team || '').trim();
    let rawRes = (player.nfl_game_result || '').trim();
    let statLine = formatPlayerStats(player);

    if (rawRes) {
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
            else if (!gameStr.includes(opp)) gameStr = `${rawRes} ${opp}`;
        }
        return [gameStr, statLine].filter(Boolean).join(' • ');
    }

    return [opp, statLine].filter(Boolean).join(' • ') || 'NFL';
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
        this.seasonLabelConvention = 'kickoff';
        this.isChampionshipYearConvention = false;
        this.paradigms = {};
        this.db = null;
        this.notesEngine = null;
    }

    isRawChampionshipYearBasis() {
        const setting = this.leagueSettings?.raw_year_basis || this.rawYearBasis;
        if (setting === 'championship') return true;
        if (setting === 'kickoff') return false;
        const platform = (this.leagueSettings?.platform || this.platform || '').toLowerCase();
        if (platform === 'yahoo') return true;
        const slug = (this.leagueSlug || '').toLowerCase();
        if (slug === 'dmsfantasy') return true;
        const name = (this.leagueSettings?.name || '').toLowerCase();
        if (name.includes('dumbarton') || name.includes('dms')) return true;
        return false;
    }

    formatSeasonYear(year) {
        if (year === undefined || year === null) return "";
        const num = Number(year);
        if (isNaN(num)) return `${year}`;
        const isChampionship = Boolean(
            this.seasonLabelConvention === 'championship' || 
            this.isChampionshipYearConvention
        );
        const isRawChampionship = this.isRawChampionshipYearBasis();
        const displayYear = isRawChampionship 
            ? (isChampionship ? num : (num - 1))
            : (isChampionship ? (num + 1) : num);
        return `${displayYear}`;
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
                if (overlay && overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
                resolve();
                return;
            }
            // Consume immediately so that browser back button or refresh cannot re-trigger building
            sessionStorage.removeItem('pendingVaultBuild');
            const creds = JSON.parse(pendingRaw);
            const { leagueId, s2, swid, customName } = creds;
            const slug = window.location.pathname.substring(1).replace(/\/$/, "");

            try {
                let seasonsData = [];

                if (creds.platform === 'sleeper') {
                    updateUI(10, "Fetching Sleeper league seasons...");
                    const canonicalSeasons = creds.canonicalSeasons || {};
                    const seasonEntries = Object.entries(canonicalSeasons).sort((a, b) => Number(b[0]) - Number(a[0]));

                    if (seasonEntries.length > 0) {
                        let completed = 0;
                        for (const [yr, sLeagueId] of seasonEntries) {
                            updateUI(15 + (completed / seasonEntries.length) * 70, `Syncing Sleeper ${yr} season...`);
                            const url = `/api/scrape-sleeper-season?leagueId=${encodeURIComponent(sLeagueId)}&year=${encodeURIComponent(yr)}`;
                            const res = await fetch(url);
                            if (res.ok) {
                                const data = await res.json();
                                if (data && data.data) seasonsData.push(data);
                            }
                            completed++;
                        }
                    } else {
                        const sLeagueId = String(leagueId || '');
                        updateUI(30, `Syncing Sleeper season...`);
                        const url = `/api/scrape-sleeper-season?leagueId=${encodeURIComponent(sLeagueId)}`;
                        const res = await fetch(url);
                        if (res.ok) {
                            const data = await res.json();
                            if (data && data.data) seasonsData.push(data);
                        }
                    }
                } else if (creds.platform === 'yahoo') {
                    updateUI(20, "Connecting to Yahoo Fantasy API & syncing season records...");
                    let cleanKey = String(leagueId || '').trim();
                    if (!cleanKey.includes('.l.')) {
                        cleanKey = `nfl.l.${cleanKey}`;
                    }
                    const url = `/api/scrape-yahoo-season?leagueKey=${encodeURIComponent(cleanKey)}`;
                    const res = await fetch(url);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.data) {
                            seasonsData.push(data);
                        }
                    } else {
                        const errJson = await res.json().catch(() => ({}));
                        throw new Error(errJson.error || `Failed to fetch Yahoo league data (HTTP ${res.status}).`);
                    }
                } else {
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

                // Attach platform credentials for automated multi-league sync jobs
                compiledPayload.credentials = {
                    platform: creds.platform || 'espn',
                    leagueId: String(leagueId || ''),
                    s2: s2 || '',
                    swid: swid || '',
                    canonicalSeasons: creds.canonicalSeasons || null,
                    last_synced: new Date().toISOString()
                };
                compiledPayload.league_settings.platform = creds.platform || 'espn';
                compiledPayload.league_settings.last_synced = new Date().toISOString();

                // Strict Overwrite Protection: Never overwrite an existing league without verified commissioner authorization
                const existingSnap = await get(dbRef(database, `leagues/${slug}`));
                if (existingSnap.exists()) {
                    const existingData = existingSnap.val();
                    const isProtectedSystemLeague = slug === 'dmsfantasy' || slug === 'gaywoodfantasyfootball';
                    const isExistingAdmin = session && session.email && (
                        existingData.league_settings?.admin_email === session.email ||
                        session.adminLeagues?.includes(slug) ||
                        session.isFounder
                    );

                    if (isProtectedSystemLeague || (!isExistingAdmin && existingData.league_settings)) {
                        throw new Error(`The league "${slug}" already exists in The Fantasy Vault and is protected from being overwritten. Please choose a different league name.`);
                    }
                }

                updateUI(92, "Saving to Vault Database...");
                const databaseRef = dbRef(database, `leagues/${slug}`);
                await set(databaseRef, compiledPayload);

                // Auto-link new league to user's profile and save in session/storage
                if (window.AuthEngine && typeof window.AuthEngine.linkUserLeague === 'function') {
                    await window.AuthEngine.linkUserLeague(slug, 'admin', customName || compiledPayload.league_settings?.name);
                    if (creds.creatorClaimId && typeof window.AuthEngine.claimManagerProfile === 'function') {
                        const claimedMgr = compiledPayload.members?.find(m => m.id === creds.creatorClaimId);
                        await window.AuthEngine.claimManagerProfile(slug, creds.creatorClaimId, claimedMgr?.name || creds.creatorClaimId, creds.favoriteNflTeam);
                    }
                } else {
                    localStorage.setItem('vault_last_league', slug);
                }

                updateUI(96, "Rendering League Record Books & Visualizations...");
                this.precompiledBundle = compiledPayload;
                
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

                this.finishBuildingOverlay = () => {
                    updateUI(100, "Welcome to Your Vault!");
                    setTimeout(() => {
                        overlay.style.opacity = '0';
                        overlay.style.transition = 'opacity 0.6s ease';
                        setTimeout(() => {
                            if (overlay && overlay.parentNode) {
                                overlay.parentNode.removeChild(overlay);
                            }
                        }, 600);
                    }, 400);
                };

                resolve();
            } catch (error) {
                console.error("Build Failed:", error);
                if (bar) bar.style.background = '#ef4444';
                if (text) {
                    text.textContent = 'Failed';
                    text.style.color = '#ef4444';
                }
                if (status) {
                    status.innerHTML = `<span style="color: #ef4444; font-weight: 600;">Import Error:</span> ${error.message}`;
                }
                
                const card = overlay.querySelector('div');
                if (card) {
                    const errorBox = document.createElement('div');
                    errorBox.style.cssText = 'margin-top: 1.5rem; padding: 1.25rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; text-align: left;';
                    errorBox.innerHTML = `
                        <div style="font-weight: 700; color: #dc2626; margin-bottom: 0.5rem; font-size: 0.95rem;">Build Encountered an Error</div>
                        <p style="font-size: 0.85rem; color: var(--text-secondary, #475569); margin-bottom: 1rem; line-height: 1.45;">${error.message}</p>
                        <div style="display: flex; gap: 0.75rem;">
                            <a href="/" class="btn-primary" style="flex: 1; text-align: center; text-decoration: none; padding: 0.6rem; font-size: 0.88rem; justify-content: center; display: inline-flex; align-items: center;">Return to Landing Page &rarr;</a>
                            <button id="btn-retry-build" class="btn" style="flex: 1; padding: 0.6rem; font-size: 0.88rem; cursor: pointer; border: 1px solid var(--border-line, #cbd5e1); background: #ffffff; color: #0f172a; font-weight: 600; border-radius: 4px;">Retry Build</button>
                        </div>
                    `;
                    card.appendChild(errorBox);
                    document.getElementById('btn-retry-build')?.addEventListener('click', () => {
                        window.location.reload();
                    });
                }
            }
        });
    }

    renderPrivateGuard() {
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const userEmail = (session?.email || '').toLowerCase();
        if (session?.isFounder || userEmail === 'landonekatz@gmail.com') return;

        let overlay = document.getElementById('private-guard-overlay');
        if (overlay) return;

        const pathSlug = window.location.pathname.substring(1).replace(/\/$/, "");
        const leagueTitle = this.leagueSettings?.name ||
            (pathSlug ? pathSlug.toUpperCase() + ' Vault' : 'Private League Archive');

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

        const checkAndUnlock = async () => {
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
            window.location.reload();
        };

        // Google SSO
        const btnGoogle = document.getElementById('guard-btn-google');
        if (btnGoogle) {
            btnGoogle.addEventListener('click', async () => {
                try {
                    await window.AuthEngine.loginWithGoogle();
                    await checkAndUnlock();
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
                    await checkAndUnlock();
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
                    if (typeof window.startManagerClaimFlow === 'function') {
                        window.startManagerClaimFlow(code);
                    }
                    await checkAndUnlock();
                } else {
                    showError(check.message || "Invalid Join Code");
                }
            });
        }
    }

    renderAccessDenied(session) {
        const userEmail = (session?.email || '').toLowerCase();
        if (session?.isFounder || userEmail === 'landonekatz@gmail.com') return;

        let overlay = document.getElementById('vault-access-denied-overlay');
        if (overlay) return;
        
        overlay = document.createElement('div');
        overlay.id = 'vault-access-denied-overlay';
        overlay.className = 'guard-overlay';
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(10px); z-index: 99999; display: flex; align-items: center; justify-content: center; padding: 1.5rem;';
        
        const displayEmail = session?.email || 'Your account';
        overlay.innerHTML = `
            <div class="guard-card" style="background: #ffffff; color: #0f172a; max-width: 480px; width: 100%; border-radius: 12px; padding: 2.25rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); text-align: center; border: 1px solid #e2e8f0;">
                <div style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; font-size: 1.4rem; font-weight: 800; margin-bottom: 1rem;">!</div>
                <h2 style="font-size: 1.35rem; font-family: var(--font-heading, 'Cinzel', serif); font-weight: 800; margin-bottom: 0.5rem; color: #0f172a;">Access Denied</h2>
                <p style="color: #64748b; font-size: 0.88rem; line-height: 1.55; margin-bottom: 1.5rem;">
                    Your account (<strong>${displayEmail}</strong>) does not have access to this private league. If you are a member of this league, please enter a valid Join Code below or ask your commissioner for an invite link.
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
                        await window.AuthEngine.linkUserLeague(this.leagueSlug, 'member', this.leagueSettings?.name || '');
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

    async init() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('building')) {
            window.history.replaceState({}, '', window.location.pathname);
            if (sessionStorage.getItem('pendingVaultBuild')) {
                await this.showBuildingSequence();
            }
        }

        let pathSlug = urlParams.get('league') || urlParams.get('slug') || window.location.pathname.replace(/^\/|\/$/g, "");
        if (pathSlug === 'vault.html' || pathSlug === 'vault' || !pathSlug) {
            pathSlug = urlParams.get('league') || urlParams.get('slug') || sessionStorage.getItem('vault_nav_slug') || localStorage.getItem('vault_last_league') || '';
        }
        this.leagueSlug = pathSlug;
        if (pathSlug && pathSlug !== 'vault.html' && pathSlug !== 'vault') {
            try {
                sessionStorage.setItem('vault_nav_slug', pathSlug);
            } catch (e) {}
            // Normalize address bar from /vault.html?league=slug to clean vanity path /slug
            if (window.location.pathname.includes('vault.html') || window.location.pathname === '/vault') {
                const searchParams = new URLSearchParams(window.location.search);
                searchParams.delete('league');
                searchParams.delete('slug');
                const remainingQuery = searchParams.toString() ? '?' + searchParams.toString() : '';
                try {
                    window.history.replaceState({}, '', `/${pathSlug}${remainingQuery}${window.location.hash}`);
                } catch (e) {}
            }
            if (window.AuthEngine && typeof window.AuthEngine.recordActiveLeague === 'function') {
                window.AuthEngine.recordActiveLeague(pathSlug);
            } else {
                try { localStorage.setItem('vault_last_league', pathSlug); } catch (e) {}
            }
        }

        // 1. Immediately wire navigation, theme, and admin tab visibility on frame 0
        this.setupThemeToggle();
        this.setupNavigation();
        this.updateAdminTabVisibility();
        window.addEventListener('vault_auth_changed', () => {
            this.updateAdminTabVisibility();
            if (this.activeTab === 'admin') {
                this.renderAdminDashboard();
            }
        });

        // Wait for initial Firebase auth resolution with timeout protection
        if (typeof window.AuthEngine !== 'undefined' && typeof window.AuthEngine.ready === 'function') {
            await Promise.race([
                window.AuthEngine.ready(),
                new Promise(resolve => setTimeout(resolve, 800))
            ]);
        }

        await this.loadData();

        // Check Private vs Public League Guarding
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
            const isLeagueAdmin = isFounder || (adminEmail && userEmail === adminEmail) || (session.adminLeagues && session.adminLeagues.includes(this.leagueSlug));
            const hasJoined = session.joinedLeagues && session.joinedLeagues.includes(this.leagueSlug);
            const hasClaim = this.claims && Object.values(this.claims).some(c => (c?.userId === session.uid) || (c?.email && c.email.toLowerCase() === userEmail));
            const isAuthorized = isFounder || isLeagueAdmin || hasJoined || hasClaim;

            if (!isAuthorized) {
                this.renderAccessDenied(session);
                return;
            }
        } else {
            // Public league -> Show subtle guest notice if signed in but not claimed/admin and not founder
            if (session && !isFounder) {
                const adminEmail = (this.leagueSettings?.admin_email || '').toLowerCase();
                const isLeagueAdmin = (adminEmail && userEmail === adminEmail) || (session.adminLeagues && session.adminLeagues.includes(this.leagueSlug));
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
                const list = (this.members && this.members.length > 0) ? this.members : (this.managers || []);
                const mgr = list.find(m => m.id === managerId || m.espn_id === managerId || String(m.id).toLowerCase() === String(managerId).toLowerCase() || String(m.espn_id).toLowerCase() === String(managerId).toLowerCase());
                if (mgr) mgr.nickname = nickname;
            }
            this.refreshNicknamesUI();
        });

        const founderBar = document.getElementById('founder-control-bar');
        if (founderBar) founderBar.remove();
        this.initPowerRankings();
        this.setupH2HControls();
        this.renderH2H();
        this.updateAdminTabVisibility();
        if (this.activeTab === 'draft') {
            this.renderDraft();
        }

        // Check for join code in URL params (e.g. ?join=CODE)
        const joinCodeParam = urlParams.get('join');
        if (joinCodeParam) {
            setTimeout(() => {
                if (typeof window.startManagerClaimFlow === 'function') {
                    window.startManagerClaimFlow(joinCodeParam);
                }
            }, 600);
        }

        // Finish the building overlay now that all DOM, tabs, and records are rendered
        if (typeof this.finishBuildingOverlay === 'function') {
            this.finishBuildingOverlay();
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
            
            const settings = (this.scoringSettings && (this.scoringSettings[season] || this.scoringSettings[String(season)])) ||
                             (this.leagueSettings && (this.leagueSettings[season] || this.leagueSettings.scoringRules));

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
        const urlParams = new URLSearchParams(window.location.search);
        let slug = this.leagueSlug || urlParams.get('league') || urlParams.get('slug') || window.location.pathname.replace(/^\/|\/$/g, "");
        if (slug === 'vault.html' || slug === 'vault' || !slug) {
            slug = urlParams.get('league') || urlParams.get('slug') || sessionStorage.getItem('vault_nav_slug') || localStorage.getItem('vault_last_league') || '';
        }
        this.leagueSlug = slug;
        
        let bundleData = null;
        if (this.precompiledBundle) {
            bundleData = this.precompiledBundle;
        } else {
            try {
                const databaseRef = dbRef(database, `leagues/${slug}`);
                const snapshot = await get(databaseRef);
                if (snapshot.exists()) {
                    bundleData = snapshot.val();
                }
            } catch (err) {
                console.error("Failed to load league data from database:", err);
            }
        }

        // Fallback for static demo leagues if RTDB is empty
        if (!bundleData) {
            if (window.FANTASY_DATA) {
                bundleData = window.FANTASY_DATA;
            } else if (slug === 'dmsfantasy') {
                try {
                    const [mgrs, stands, mat, stats, draft, tx, pr] = await Promise.all([
                        fetch('/dmsfantasy/data/managers.json').then(r => r.json()).catch(() => null),
                        fetch('/dmsfantasy/data/league_standings.json').then(r => r.json()),
                        fetch('/dmsfantasy/data/matchups.json').then(r => r.json()),
                        fetch('/dmsfantasy/data/weekly_player_stats.json').then(r => r.json()),
                        fetch('/dmsfantasy/data/draft_results.json').then(r => r.json()),
                        fetch('/dmsfantasy/data/transactions.json').then(r => r.json()),
                        fetch('/dmsfantasy/data/power_rankings_history.json').then(r => r.json()).catch(() => null)
                    ]);
                    bundleData = {
                        members: mgrs?.managers || [],
                        team_mappings: mgrs?.team_mappings || [],
                        league_standings: stands,
                        matchups: mat,
                        weekly_player_stats: stats,
                        draft_results: draft,
                        transactions: tx,
                        power_rankings_history: pr || [],
                        league_settings: { name: 'The Dumbarton Fantasy Football League', firstYear: 2018, lastYear: 2026, totalSeasons: 10, scoring_format: 'Half-PPR (0.5)' }
                    };
                } catch (e) {
                    console.warn('Failed local dms fallback:', e);
                }
            }
        }

        if (!bundleData) {
            document.body.innerHTML = `
                <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; text-align: center; padding: 2rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <div style="max-width: 520px; width: 90%; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 12px; padding: 2.5rem 2rem; box-shadow: 0 20px 40px rgba(0,0,0,0.4);">
                        <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: rgba(212, 175, 55, 0.15); color: #d4af37; font-weight: 800; font-size: 1.1rem; margin-bottom: 1.25rem;">TFV</div>
                        <h1 style="font-family: 'Cinzel', serif, Georgia; font-size: 1.6rem; color: #d4af37; margin: 0 0 0.75rem 0;">Vault Not Found</h1>
                        <p style="color: #94a3b8; font-size: 0.92rem; line-height: 1.5; margin: 0 0 1.75rem 0;">
                            No historical archive exists for <code>/${encodeURIComponent(slug || 'league')}</code>, as this league has not been registered yet. All existing league archives are protected from accidental overwrites.
                        </p>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <a href="/" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: #d4af37; color: #000; padding: 0.75rem 1.25rem; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 0.95rem;">
                                Return to The Fantasy Vault Hub &rarr;
                            </a>
                            <a href="/#register" style="display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #94a3b8; border: 1px solid #334155; padding: 0.7rem 1.25rem; border-radius: 6px; font-weight: 600; text-decoration: none; font-size: 0.88rem;">
                                Register or Import a New League
                            </a>
                        </div>
                    </div>
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
        this.leagueSettings = settingsData;
        this.rawYearBasis = this.leagueSettings.raw_year_basis || (this.leagueSettings.platform === 'yahoo' || this.leagueSlug === 'dmsfantasy' ? 'championship' : 'kickoff');

        const initialConvention = settingsData.seasonLabelConvention || bundleData.seasonLabelConvention || 'kickoff';
        this.seasonLabelConvention = initialConvention;
        if (this.leagueSettings) {
            this.leagueSettings.seasonLabelConvention = initialConvention;
        }
        this.isChampionshipYearConvention = (initialConvention === 'championship');
        this.paradigms = bundleData.paradigms || {};
        if (!this.paradigms.power_rankings && bundleData.power_rankings) {
            this.paradigms.power_rankings = bundleData.power_rankings;
        }
        if (!this.paradigms.rivalries && bundleData.rivalries) {
            this.paradigms.rivalries = bundleData.rivalries;
        }
        this.syncStatus = bundleData.sync_status || null;
        this.credentials = bundleData.credentials || {};
        this.teamMappings = bundleData.team_mappings || (Array.isArray(managersData) ? null : managersData?.team_mappings) || [];

        if (managersData) {
            this.managersData = managersData;
            const rawList = Array.isArray(managersData) ? managersData : (managersData.managers || []);
            this.managers = rawList.map(m => {
                const isRetired = (m.status && m.status.toLowerCase() === 'retired');
                const rawName = m.name || m.display_name || m.full_name || m.manager_name;
                const cleanName = (m.id === 'madoc' || (rawName && rawName.toLowerCase() === 'madoc') || (rawName && rawName.toLowerCase() === 'maddox')) ? 'Madoc' : rawName;
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
            this.members = this.managers;
        } else {
            this.managers = [];
            this.members = [];
        }

        const rawStandings = standingsData || [];
        this.standings = rawStandings.map(s => {
            const yr = Number(s.year || s.season);
            const mId = s.manager_id || s.id;
            const mName = s.manager_name || s.name || 'Unknown';
            const cleanName = (mId === 'madoc' || (mName && mName.toLowerCase() === 'madoc') || (mName && mName.toLowerCase() === 'maddox')) ? 'Madoc' : mName;
            const madePlayoffs = s.made_playoffs !== undefined ?
                (s.made_playoffs === true || String(s.made_playoffs).toLowerCase() === 'true') :
                (s.playoff_seed ? s.playoff_seed <= (yr >= 2022 ? 6 : 4) : false);
            return {
                ...s,
                season: yr,
                year: yr,
                manager_id: mId,
                manager_name: cleanName,
                rank: s.final_rank || s.rank,
                made_playoffs: madePlayoffs,
                win_pct: (s.wins + s.losses + s.ties > 0) ? (s.wins + 0.5 * s.ties) / (s.wins + s.losses + s.ties) : (s.win_pct || 0)
            };
        });

        const rawMatchups = matchupsData || [];
        this.matchups = rawMatchups.map(m => {
            const yr = Number(m.year || m.season);
            const isPlayoffs = Boolean(m.is_playoff || m.is_playoffs || m.game_type === 'Championship' || (m.game_type && m.game_type !== 'regular_season' && m.game_type !== 'Regular Season'));
            const hId = m.home_team_id !== undefined ? m.home_team_id : m.team_1_id;
            const aId = m.away_team_id !== undefined ? m.away_team_id : m.team_2_id;
            const hPts = m.home_score !== undefined ? m.home_score : m.team_1_actual_points;
            const aPts = m.away_score !== undefined ? m.away_score : m.team_2_actual_points;

            const roundLabel = getMatchupRoundLabel(m);
            return {
                ...m,
                season: yr,
                year: yr,
                is_playoffs: isPlayoffs,
                is_playoff: isPlayoffs,
                playoff_round: roundLabel || m.playoff_round || (isPlayoffs ? getPlayoffRoundName(yr, m.week) : ''),
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

        // Ensure clean 6-character random alphanumeric join code
        if (!this.leagueSettings.join_code || this.leagueSettings.join_code.length < 6 || /24$/.test(this.leagueSettings.join_code)) {
            const newCode = generateRandomJoinCode();
            this.leagueSettings.join_code = newCode;
            if (this.leagueSlug) {
                try {
                    const settingsRef = dbRef(database, `leagues/${this.leagueSlug}/league_settings`);
                    update(settingsRef, { join_code: newCode }).catch(() => {});
                } catch (e) {}
            }
        }

        this.claims = {};
        this.users = {};
        if (this.leagueSlug) {
            try {
                const [settingsSnap, claimsSnap, conventionSnap, leagueUsersSnap] = await Promise.all([
                    get(dbRef(database, `leagues/${this.leagueSlug}/league_settings`)).catch(() => null),
                    get(dbRef(database, `leagues/${this.leagueSlug}/claims`)).catch(() => null),
                    get(dbRef(database, `leagues/${this.leagueSlug}/seasonLabelConvention`)).catch(() => null),
                    get(dbRef(database, `leagues/${this.leagueSlug}/users`)).catch(() => null)
                ]);
                if (settingsSnap && settingsSnap.exists()) {
                    const liveSettings = settingsSnap.val() || {};
                    this.leagueSettings = { ...(this.leagueSettings || {}), ...liveSettings };
                    if (liveSettings.seasonLabelConvention) {
                        this.seasonLabelConvention = liveSettings.seasonLabelConvention;
                        this.isChampionshipYearConvention = (this.seasonLabelConvention === 'championship');
                    }
                }
                if (conventionSnap && conventionSnap.exists()) {
                    const conv = conventionSnap.val();
                    if (conv) {
                        this.seasonLabelConvention = conv;
                        if (this.leagueSettings) this.leagueSettings.seasonLabelConvention = conv;
                        this.isChampionshipYearConvention = (conv === 'championship');
                    }
                }
                if (claimsSnap && claimsSnap.exists()) {
                    this.claims = claimsSnap.val() || {};
                }
                if (leagueUsersSnap && leagueUsersSnap.exists()) {
                    this.users = leagueUsersSnap.val() || {};
                }
                // Also scan users table to guarantee 100% complete claim records with registered emails
                try {
                    const usersSnap = await get(dbRef(database, 'users'));
                    if (usersSnap.exists()) {
                        const usersVal = usersSnap.val() || {};
                        Object.entries(usersVal).forEach(([uid, uData]) => {
                            if (uData?.claims?.[this.leagueSlug]) {
                                const c = uData.claims[this.leagueSlug];
                                const mId = c.managerId;
                                if (mId && (!this.claims[mId] || !this.claims[mId].email)) {
                                    const email = (c.managerName && c.managerName.includes('@')) ? c.managerName : (uData.email || '');
                                    this.claims[mId] = {
                                        userId: uid,
                                        email: email,
                                        name: c.managerName || email,
                                        claimedAt: c.claimedAt || Date.now(),
                                        ...(this.claims[mId] || {})
                                    };
                                }
                            }
                        });
                    }
                } catch (eUsers) {}

                const list = (this.members && this.members.length > 0) ? this.members : (this.managers || []);
                list.forEach(m => {
                    const claim = this.claims[m.id] || (m.espn_id && this.claims[m.espn_id]);
                    if (claim && claim.nickname !== undefined && !m.nickname) {
                        m.nickname = claim.nickname;
                    }
                });
            } catch (e) {
                console.warn('Could not load claims from RTDB', e);
            }

            // Real-time listener for claims
            try {
                const claimsRef = dbRef(database, `leagues/${this.leagueSlug}/claims`);
                onValue(claimsRef, (snapshot) => {
                    this.claims = snapshot.exists() ? (snapshot.val() || {}) : {};
                    const list = (this.members && this.members.length > 0) ? this.members : (this.managers || []);
                    list.forEach(m => {
                        const claim = this.claims[m.id] || this.claims[m.espn_id];
                        if (claim && claim.nickname !== undefined) {
                            m.nickname = claim.nickname;
                        }
                    });
                    this.refreshNicknamesUI();
                    this.updateAdminTabVisibility();
                });
            } catch (e) {
                console.warn('Claims listener error', e);
            }
        }

        nflStats.preloadSeason(2025);
        nflStats.preloadSeason(2024);

        // Register dynamic join code for AuthEngine
        if (typeof window.JOIN_CODES !== 'undefined' && this.leagueSlug) {
            const dynamicCode = this.leagueSettings.join_code.toUpperCase();
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
            let baseName = (leagueName || "Fantasy Football").trim();
            if (/league$/i.test(baseName)) {
                baseName = baseName.replace(/league$/i, '').trim();
            }
            titleEl.innerHTML = `${baseName}<br>League HQ`;
        }

        const tagline = this.leagueSettings.tagline || this.leagueSettings.subtitle || "In a league of our own";
        const subtitleEl = document.getElementById("league-subtitle");
        if (subtitleEl) subtitleEl.textContent = tagline;
        
        const idInfoEl = document.getElementById("league-id-info");
        if (idInfoEl) {
            const validId = (this.leagueSettings?.id && this.leagueSettings.id !== '------') ? this.leagueSettings.id : (this.credentials?.league_id || null);
            if (validId) {
                idInfoEl.textContent = `League ID: ${validId}`;
                idInfoEl.style.display = 'block';
            } else {
                idInfoEl.style.display = 'none';
            }
        }

        const editionInfoEl = document.getElementById("league-edition-info");
        if (editionInfoEl) editionInfoEl.innerHTML = `EST. ${this.formatSeasonYear(firstYear)}`;

        const seasonsEl = document.getElementById("total-seasons");
        if (seasonsEl) seasonsEl.textContent = totalSeasons;

        const footerTextEl = document.getElementById("footer-text");
        if (footerTextEl) footerTextEl.textContent = `${leagueName} Archive`;
        
        const recordsHeroLeagueNameEl = document.getElementById("records-hero-league-name");
        if (recordsHeroLeagueNameEl) recordsHeroLeagueNameEl.textContent = `The ${leagueName} Record Book`;

        const footerEspnLinkEl = document.getElementById("footer-espn-link");
        if (footerEspnLinkEl) {
            if (this.leagueSettings.platform === 'yahoo') {
                footerEspnLinkEl.textContent = 'View on Yahoo';
                footerEspnLinkEl.href = this.leagueSettings.id ? `https://football.fantasysports.yahoo.com/f1/${this.leagueSettings.id}` : 'https://football.fantasysports.yahoo.com';
            } else {
                footerEspnLinkEl.textContent = 'View on ESPN';
                footerEspnLinkEl.href = this.leagueSettings.id ? `https://fantasy.espn.com/football/league?leagueId=${this.leagueSettings.id}` : '#';
            }
        }

        const btnParadigms = document.getElementById('btn-tab-paradigms');
        if (btnParadigms) {
            btnParadigms.style.display = '';
        }

        const hasRivalry = Boolean(
            (Array.isArray(this.paradigms?.rivalries) && this.paradigms.rivalries.length > 0) ||
            (this.paradigms?.rivalries && typeof this.paradigms.rivalries === 'object' && Object.keys(this.paradigms.rivalries).length > 0) ||
            (this.leagueSlug === 'dmsfantasy')
        );
        const btnRivalry = document.getElementById('btn-tab-rivalry');
        if (btnRivalry) {
            btnRivalry.style.display = hasRivalry ? '' : 'none';
        }

        const hasPr = Boolean(
            this.paradigms?.power_rankings?.enabled ||
            this.paradigms?.power_rankings?.current_ranking ||
            (Array.isArray(this.paradigms?.power_rankings?.archived_rankings) && this.paradigms.power_rankings.archived_rankings.length > 0) ||
            (Array.isArray(this.powerRankingsHistory) && this.powerRankingsHistory.length > 0) ||
            (this.leagueSlug === 'dmsfantasy')
        );
        const cardRankings = document.getElementById('rankings');
        const pillRankings = document.getElementById('scroller-pill-rankings');
        if (cardRankings) cardRankings.style.display = hasPr ? '' : 'none';
        if (pillRankings) pillRankings.style.display = hasPr ? '' : 'none';

        console.log(`Loaded ${this.managers.length} managers, ${this.matchups.length} matchups, ${this.playerStats.length} player stats, ${this.transactions.length} transactions, ${this.powerRankingsHistory.length} power rankings weeks.`);

        // Initialize unified Commissioner Notes & League Updates Engine
        this.notesEngine = new CommissionerNotesEngine({
            leagueSlug: this.leagueSlug || 'league',
            app: this,
            containerId: 'commissioner-note',
            scrollerPillId: 'scroller-pill-notes',
            adminContainerId: 'admin-sec-notes'
        });

        // Initialize unified Power Rankings Engine
        this.powerRankingsEngine = new PowerRankingsEngine({
            leagueSlug: this.leagueSlug || 'league',
            app: this,
            containerId: 'rankings',
            adminContainerId: 'admin-sec-power-rankings'
        });

        this.initWelcomeCard();
    }

    refreshNicknamesUI() {
        if (typeof this.initPowerRankings === 'function') this.initPowerRankings();
        if (typeof this.setupH2HControls === 'function') this.setupH2HControls();
        if (typeof this.renderH2H === 'function') this.renderH2H();
        if (typeof this.renderRecords === 'function') this.renderRecords();
        if (typeof this.renderRivalryWeek === 'function') this.renderRivalryWeek();
        if (this.activeTab === 'admin' && typeof this.renderAdminDashboard === 'function') {
            this.renderAdminDashboard();
        }
        if (this.draftEngine) {
            this.draftEngine.updateData({
                managers: this.managers || this.members,
                draftResults: this.draftResults,
                weeklyPlayerStats: this.playerStats,
                matchups: this.matchups,
                leagueSettings: this.leagueSettings,
                scoringSettings: this.scoringSettings || this.leagueSettings
            });
            if (this.activeTab === 'draft' || this.activeTab === 'draft-hub') {
                this.draftEngine.render();
            }
        }
        this.initWelcomeCard();
    }

    initWelcomeCard() {
        const welcomeCard = document.getElementById('welcome');
        const welcomePill = document.getElementById('scroller-pill-welcome');
        const btnDismiss = document.getElementById('btn-dismiss-welcome');
        if (!welcomeCard) return;

        const storageKey = `vault_dismiss_welcome_${this.leagueSlug || 'league'}`;
        const isDismissed = localStorage.getItem(storageKey) === 'true' || Boolean(this.leagueSettings?.hide_welcome_card);

        if (isDismissed) {
            welcomeCard.style.display = 'none';
            if (welcomePill) welcomePill.style.display = 'none';
        } else {
            welcomeCard.style.display = '';
            if (welcomePill) welcomePill.style.display = '';
        }

        if (btnDismiss && !btnDismiss._hasClickListener) {
            btnDismiss._hasClickListener = true;
            btnDismiss.addEventListener('click', () => {
                localStorage.setItem(storageKey, 'true');
                welcomeCard.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                welcomeCard.style.opacity = '0';
                welcomeCard.style.transform = 'translateY(-6px)';
                setTimeout(() => {
                    welcomeCard.style.display = 'none';
                    if (welcomePill) welcomePill.style.display = 'none';
                }, 200);
            });
        }
    }

    getManagerDisplayName(managerId, fallbackName = '') {
        if (!managerId && !fallbackName) return 'Unknown';
        const searchId = String(managerId || '').toLowerCase().trim();
        const searchFallback = String(fallbackName || '').toLowerCase().trim();

        const mList = (this.members && this.members.length > 0) ? this.members : (this.managers || []);
        const m = mList.find(mgr => {
            const id = String(mgr.id || mgr.manager_id || '').toLowerCase().trim();
            const name = String(mgr.name || mgr.manager_name || '').toLowerCase().trim();
            const fullName = String(mgr.full_name || '').toLowerCase().trim();
            const dispName = String(mgr.display_name || '').toLowerCase().trim();
            const espnId = String(mgr.espn_id || '').toLowerCase().trim();
            return (id && (id === searchId || id === searchFallback)) ||
                   (name && (name === searchId || name === searchFallback)) ||
                   (fullName && (fullName === searchId || fullName === searchFallback)) ||
                   (dispName && (dispName === searchId || dispName === searchFallback)) ||
                   (espnId && (espnId === searchId || espnId === searchFallback));
        });

        const allowNicknames = this.leagueSettings?.allow_nicknames !== false;
        const session = typeof window.AuthEngine !== 'undefined' ? window.AuthEngine.getSession() : null;
        const currentLeagueSlug = this.leagueSlug || '';
        const sessionNick = (session?.managerNicknames && currentLeagueSlug) ? session.managerNicknames[currentLeagueSlug] : '';
        const isCurrentSessionUser = session && m && currentLeagueSlug && (
            (session.claims && (session.claims[currentLeagueSlug] === m.id || session.claims[currentLeagueSlug] === m.espn_id)) ||
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
        const cleanId = String(managerId || '').toLowerCase().trim();
        const targetId = (cleanId === 'ben' || cleanId === 'benjamin') ? 'benjamin' : cleanId;

        // 1. Check team mappings
        const mappings = (this.teamMappings && Array.isArray(this.teamMappings) ? this.teamMappings : (this.managersData?.team_mappings || []))
            .filter(m => {
                const mId = String(m.manager_id || '').toLowerCase().trim();
                return mId === targetId || mId === cleanId;
            });
        if (mappings.length > 0) {
            mappings.sort((a, b) => b.year - a.year);
            return mappings[0].team_name;
        }

        // 2. Check standings
        if (this.standings && Array.isArray(this.standings)) {
            const rows = this.standings.filter(s => {
                const sId = String(s.manager_id || s.id || '').toLowerCase().trim();
                return sId === targetId || sId === cleanId;
            });
            if (rows.length > 0) {
                rows.sort((a, b) => (b.year || b.season) - (a.year || a.season));
                return rows[0].team_name;
            }
        }

        // 3. Fallback to manager displayName
        const mgr = (this.managers || []).find(m => String(m.id).toLowerCase() === targetId);
        return mgr ? `${mgr.name}'s Team` : 'Unknown Team';
    }

    getPlayerHeadshot(name, pos = '') {
        if (!name) return '';
        if (window.NFLStatsService && typeof window.NFLStatsService.getPlayerHeadshot === 'function') {
            return window.NFLStatsService.getPlayerHeadshot(name, pos);
        }
        return '';
    }

    initPowerRankings() {
        if (this.notesEngine) {
            this.notesEngine.render();
        }
        const hasPr = Boolean(
            this.paradigms?.power_rankings?.enabled ||
            this.paradigms?.power_rankings?.current_ranking ||
            (Array.isArray(this.paradigms?.power_rankings?.archived_rankings) && this.paradigms.power_rankings.archived_rankings.length > 0) ||
            (Array.isArray(this.powerRankingsHistory) && this.powerRankingsHistory.length > 0) ||
            (this.powerRankingsEngine && (this.powerRankingsEngine.data?.current_ranking || this.powerRankingsEngine.data?.archived_rankings?.length > 0)) ||
            (this.leagueSlug === 'dmsfantasy')
        );
        const cardRankings = document.getElementById('rankings');
        const pillRankings = document.getElementById('scroller-pill-rankings');
        if (cardRankings) cardRankings.style.display = hasPr ? '' : 'none';
        if (pillRankings) pillRankings.style.display = hasPr ? '' : 'none';

        if (hasPr && this.powerRankingsEngine) {
            this.powerRankingsEngine.containerId = 'rankings';
            this.powerRankingsEngine.render();
        }
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
                if (mgrEl) mgrEl.textContent = this.getManagerDisplayName(managerId, manager.name);
                
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
        const btnRivalry = document.getElementById('btn-tab-rivalry');
        const btnParadigms = document.getElementById('btn-tab-paradigms');
        const btnAdmin = document.getElementById('btn-tab-admin');
        const viewHome = document.getElementById('view-home');
        const viewH2h = document.getElementById('view-h2h');
        const viewRecords = document.getElementById('view-records');
        const viewDraft = document.getElementById('view-draft');
        const viewRivalry = document.getElementById('view-rivalry');
        const viewParadigms = document.getElementById('view-paradigms');
        const viewAdmin = document.getElementById('view-admin');

        const switchTab = (tab) => {
            this.activeTab = tab;
            [btnHome, btnH2h, btnRecords, btnDraft, btnRivalry, btnParadigms, btnAdmin].forEach(btn => btn && btn.classList.remove('active'));
            [viewHome, viewH2h, viewRecords, viewDraft, viewRivalry, viewParadigms, viewAdmin].forEach(view => view && view.classList.remove('active'));

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
                            url('${imgUrl}') !important;
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
                const hasPr = Boolean(
                    this.paradigms?.power_rankings?.enabled ||
                    this.paradigms?.power_rankings?.current_ranking ||
                    (Array.isArray(this.paradigms?.power_rankings?.archived_rankings) && this.paradigms.power_rankings.archived_rankings.length > 0) ||
                    (Array.isArray(this.powerRankingsHistory) && this.powerRankingsHistory.length > 0) ||
                    (this.powerRankingsEngine && (this.powerRankingsEngine.data?.current_ranking || this.powerRankingsEngine.data?.archived_rankings?.length > 0)) ||
                    (this.leagueSlug === 'dmsfantasy')
                );
                if (hasPr && this.powerRankingsEngine) {
                    this.powerRankingsEngine.containerId = 'rankings';
                    this.powerRankingsEngine.render();
                }
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
                this.renderRivalryWeek();
            } else if (tab === 'paradigms') {
                btnParadigms && btnParadigms.classList.add('active');
                viewParadigms && viewParadigms.classList.add('active');
                this.renderParadigms();
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
        if (btnDraft) btnDraft.addEventListener('click', () => switchTab('draft'));
        if (btnRivalry) btnRivalry.addEventListener('click', () => switchTab('rivalry'));
        if (btnParadigms) btnParadigms.addEventListener('click', () => switchTab('paradigms'));
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

        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get('tab') || window.location.hash.replace(/^#/, '');
        let targetTab = tabParam;
        if (targetTab === 'rivalry') {
            const hasRivalry = Boolean(
                (Array.isArray(this.paradigms?.rivalries) && this.paradigms.rivalries.length > 0) ||
                (this.paradigms?.rivalries && typeof this.paradigms.rivalries === 'object' && Object.keys(this.paradigms.rivalries).length > 0) ||
                (this.leagueSlug === 'dmsfantasy')
            );
            if (!hasRivalry) targetTab = 'home';
        }
        if (['home', 'h2h', 'records', 'draft', 'rivalry', 'paradigms', 'admin'].includes(targetTab)) {
            switchTab(targetTab);
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
                leagueSettings: this.leagueSettings,
                seasonLabelConvention: this.seasonLabelConvention,
                scoringSettings: this.scoringSettings
            });
        } else {
            this.draftEngine.updateData({
                draftResults: this.draftResults,
                weeklyPlayerStats: this.playerStats,
                matchups: this.matchups,
                transactions: this.transactions,
                managers: this.managers,
                leagueSettings: this.leagueSettings,
                seasonLabelConvention: this.seasonLabelConvention,
                scoringSettings: this.scoringSettings
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
        const btnCustom = document.getElementById('filter-btn-custom');
        const customContainer = document.getElementById('custom-year-span-container');
        const selStart = document.getElementById('custom-start-year');
        const selEnd = document.getElementById('custom-end-year');

        const firstYear = parseInt(this.leagueSettings.firstYear) || 2015;
        const lastYear = parseInt(this.leagueSettings.lastYear) || new Date().getFullYear();

        const firstDisplay = this.formatSeasonYear(firstYear);
        const lastDisplay = this.formatSeasonYear(lastYear);
        if (btnAll) btnAll.textContent = `All Years (${firstDisplay} to ${lastDisplay})`;

        if (selStart && selEnd) {
            let optionsHTML = '';
            for (let y = firstYear; y <= lastYear; y++) {
                optionsHTML += `<option value="${y}">${this.formatSeasonYear(y)}</option>`;
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
            const firstYear = parseInt(this.leagueSettings.firstYear) || 2015;
            const lastYear = parseInt(this.leagueSettings.lastYear) || new Date().getFullYear();
            return { min: firstYear, max: lastYear };
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

        // Filter using home_manager_id / away_manager_id schema
        const filtered = this.matchups.filter(g => {
            if (!this.includePlayoffs && g.is_playoff) return false;
            const y = g.season || g.year;
            if (y < range.min || y > range.max) return false;
            const involves1 = g.home_manager_id === m1Id || g.away_manager_id === m1Id || g.team_1_manager_id === m1Id || g.team_2_manager_id === m1Id;
            const involves2 = g.home_manager_id === m2Id || g.away_manager_id === m2Id || g.team_1_manager_id === m2Id || g.team_2_manager_id === m2Id;
            return involves1 && involves2;
        });

        // Sort chronologically
        filtered.sort((a, b) => {
            const yrA = a.season || a.year;
            const yrB = b.season || b.year;
            if (yrA !== yrB) return yrA - yrB;
            return a.week - b.week;
        });

        // Precompute projected points map from playerStats
        const projMap = {};
        if (this.playerStats) {
            this.playerStats.forEach(p => {
                if (p.is_starter) {
                    const key = `${p.year || p.season}_${p.week}_${p.manager_id}`;
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
        // Only count actually played games for all-time stats
        const playedGames = filtered.filter(g => {
            const isM1Home = g.home_manager_id === m1Id || g.team_1_manager_id === m1Id;
            const s1 = isM1Home ? (g.home_score !== undefined ? g.home_score : g.team_1_actual_points) : (g.away_score !== undefined ? g.away_score : g.team_2_actual_points);
            const s2 = isM1Home ? (g.away_score !== undefined ? g.away_score : g.team_2_actual_points) : (g.home_score !== undefined ? g.home_score : g.team_1_actual_points);
            const winner = g.winner || '';
            return Number(s1) > 0 || Number(s2) > 0 || (winner && winner !== 'UNDECIDED');
        });

        playedGames.forEach(g => {
            const isM1Home = g.home_manager_id === m1Id || g.team_1_manager_id === m1Id;
            const m1Score = isM1Home ? (g.home_score !== undefined ? g.home_score : g.team_1_actual_points) : (g.away_score !== undefined ? g.away_score : g.team_2_actual_points);
            const m2Score = isM1Home ? (g.away_score !== undefined ? g.away_score : g.team_2_actual_points) : (g.home_score !== undefined ? g.home_score : g.team_1_actual_points);
            
            m1PF += m1Score || 0;
            m2PF += m2Score || 0;
            
            const m1Proj = projMap[`${g.year || g.season}_${g.week}_${m1Id}`] || 0;
            const m2Proj = projMap[`${g.year || g.season}_${g.week}_${m2Id}`] || 0;
            m1ProjTotal += m1Proj;
            m2ProjTotal += m2Proj;

            const margin = Math.abs((m1Score || 0) - (m2Score || 0));
            const isM1Win = (m1Score || 0) > (m2Score || 0);
            const isM2Win = (m2Score || 0) > (m1Score || 0);

            if (isM1Win) { m1Wins++; if (g.is_playoff) m1PlayoffWins++; }
            else if (isM2Win) { m2Wins++; if (g.is_playoff) m2PlayoffWins++; }
            else { ties++; }

            if (!maxBlowout || margin > maxBlowout.margin) maxBlowout = { margin, winner: isM1Win ? m1Name : m2Name, season: g.year || g.season, week: g.week };
            if (!minMargin || margin < minMargin.margin) minMargin = { margin, winner: isM1Win ? m1Name : m2Name, season: g.year || g.season, week: g.week };
        });

        const totalGames = playedGames.length;
        const winPct1 = totalGames > 0 ? ((m1Wins + 0.5 * ties) / totalGames * 100).toFixed(1) : '0.0';

        const barLeftPct = totalGames > 0 ? (m1Wins / (m1Wins + m2Wins || 1) * 100).toFixed(0) : 50;
        const barRightPct = 100 - barLeftPct;

        const m1Avatar = m1Obj.avatar || m1Obj.logo_url || m1Obj.avatar_url;
        const m2Avatar = m2Obj.avatar || m2Obj.logo_url || m2Obj.avatar_url;

        const m1AvatarHtml = m1Avatar
            ? `<img src="${m1Avatar}" alt="${m1Name}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--accent-gold);margin:0 auto 8px;display:block;">`
            : `<div style="width:72px;height:72px;border-radius:50%;background:var(--bg-surface);border:2px solid var(--border-color);display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;color:var(--accent-gold);margin:0 auto 8px;">${m1Name.charAt(0).toUpperCase()}</div>`;

        const m2AvatarHtml = m2Avatar
            ? `<img src="${m2Avatar}" alt="${m2Name}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--accent-gold);margin:0 auto 8px;display:block;">`
            : `<div style="width:72px;height:72px;border-radius:50%;background:var(--bg-surface);border:2px solid var(--border-color);display:flex;align-items:center;justify-content:center;font-size:1.8rem;font-weight:700;color:var(--accent-gold);margin:0 auto 8px;">${m2Name.charAt(0).toUpperCase()}</div>`;

        heroContainer.innerHTML = `
            <div class="hero-content-grid">
                <div class="hero-manager-col">
                    ${m1AvatarHtml}
                    <div class="hero-manager-name" style="font-size:1.1rem;color:var(--text-primary);font-weight:bold;">${m1Name}</div>
                </div>
                <div class="hero-record-col">
                    <div class="hero-record-label">All-Time Head-to-Head Record (${this.formatSeasonYear(range.min)}${range.min !== range.max ? ' to ' + this.formatSeasonYear(range.max) : ''})</div>
                    <div class="hero-big-record">${m1Wins} - ${m2Wins}${ties > 0 ? ' - ' + ties : ''}</div>
                    <div class="hero-win-pct">${m1Name} Win Pct: ${winPct1}% (${totalGames} Games)</div>
                    <div class="hero-comparison-bar">
                        <div class="hero-bar-left" style="width: ${barLeftPct}%;" title="${m1Name}: ${m1Wins} Wins"></div>
                        <div class="hero-bar-right" style="width: ${barRightPct}%;" title="${m2Name}: ${m2Wins} Wins"></div>
                    </div>
                </div>
                <div class="hero-manager-col">
                    ${m2AvatarHtml}
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
            const isM1Home = g.home_manager_id === m1Id || g.team_1_manager_id === m1Id;
            const t1Name = isM1Home ? (g.home_team_name || g.team_1_name || m1Name) : (g.away_team_name || g.team_2_name || m1Name);
            const t2Name = isM1Home ? (g.away_team_name || g.team_2_name || m2Name) : (g.home_team_name || g.team_1_name || m2Name);
            const t1Score = Number(isM1Home ? (g.home_score !== undefined ? g.home_score : g.team_1_actual_points) : (g.away_score !== undefined ? g.away_score : g.team_2_actual_points)) || 0;
            const t2Score = Number(isM1Home ? (g.away_score !== undefined ? g.away_score : g.team_2_actual_points) : (g.home_score !== undefined ? g.home_score : g.team_1_actual_points)) || 0;

            const t1Proj = projMap[`${g.year || g.season}_${g.week}_${m1Id}`] || 0;
            const t2Proj = projMap[`${g.year || g.season}_${g.week}_${m2Id}`] || 0;
            
            const isPlayed = Number(t1Score) > 0 || Number(t2Score) > 0 || (g.winner && g.winner !== 'UNDECIDED');
            const isT1Win = isPlayed && ((isM1Home && g.winner === 'HOME') || (!isM1Home && g.winner === 'AWAY') || (t1Score > t2Score));
            const isT2Win = isPlayed && !isT1Win && t2Score > t1Score;
            const isPlayoffs = g.is_playoff;
            const cardClass = isPlayoffs ? 'h2h-matchup-card playoff-game' : 'h2h-matchup-card';
            const margin = isPlayed ? Math.abs(t1Score - t2Score).toFixed(2) : null;

            // Find top scoring starter for team 1 and team 2 in this game
            const gYr = Number(g.year || g.season);
            const gWk = Number(g.week);
            const m1Starters = (this.playerStats || []).filter(p => Number(p.year || p.season) === gYr && Number(p.week) === gWk && p.manager_id === m1Id && p.is_starter);
            const m2Starters = (this.playerStats || []).filter(p => Number(p.year || p.season) === gYr && Number(p.week) === gWk && p.manager_id === m2Id && p.is_starter);
            
            const top1 = m1Starters.sort((a, b) => (Number(b.fantasy_points) || 0) - (Number(a.fantasy_points) || 0))[0];
            const top2 = m2Starters.sort((a, b) => (Number(b.fantasy_points) || 0) - (Number(a.fantasy_points) || 0))[0];

            const top1Headshot = top1 ? (top1.headshot_url || top1.headshotUrl || this.getPlayerHeadshot(top1.player_name, top1.position || top1.roster_slot)) : '';
            const top2Headshot = top2 ? (top2.headshot_url || top2.headshotUrl || this.getPlayerHeadshot(top2.player_name, top2.position || top2.roster_slot)) : '';

            const top1Html = top1 && Number(top1.fantasy_points) > 0 ? `
                <div class="matchup-star-player" title="Top Performer: ${top1.player_name} (${Number(top1.fantasy_points).toFixed(2)} pts)">
                    ${top1Headshot ? `<img src="${top1Headshot}" class="mini-player-headshot" alt="${top1.player_name}" onerror="this.style.display='none'">` : ''}
                    <span style="font-weight:600;">${top1.player_name}</span>
                    <span style="color:var(--accent-gold); font-weight:700;">${Number(top1.fantasy_points).toFixed(1)}</span>
                </div>
            ` : '';

            const top2Html = top2 && Number(top2.fantasy_points) > 0 ? `
                <div class="matchup-star-player" title="Top Performer: ${top2.player_name} (${Number(top2.fantasy_points).toFixed(2)} pts)">
                    ${top2Headshot ? `<img src="${top2Headshot}" class="mini-player-headshot" alt="${top2.player_name}" onerror="this.style.display='none'">` : ''}
                    <span style="font-weight:600;">${top2.player_name}</span>
                    <span style="color:var(--accent-gold); font-weight:700;">${Number(top2.fantasy_points).toFixed(1)}</span>
                </div>
            ` : '';

            const clickHandler = !isPlayed
                ? `onclick="alert('This matchup has not been played yet.')"`
                : (g.year < 2018 && this.leagueSettings?.platform !== 'yahoo'
                    ? `onclick="alert('ESPN has removed public access to player boxscore data prior to 2018.')"`
                    : `onclick="window.app.openBoxscoreModal(${g.year || g.season}, ${g.week}, '${g.home_manager_id || g.team_1_manager_id}', '${g.away_manager_id || g.team_2_manager_id}')"`);

            cardsHtml += `
                <div class="${cardClass}" ${clickHandler}>
                    <div class="matchup-date-badge">
                        <div class="matchup-year-week">${this.formatSeasonYear(g.year || g.season)} • Week ${g.week}</div>
                        <div class="matchup-game-type ${isPlayoffs ? 'playoff-label' : ''}">${!isPlayed ? 'Upcoming Matchup' : (isPlayoffs ? 'Playoffs • ' + (getMatchupRoundLabel(g) || g.playoff_round || getPlayoffRoundName(g.year || g.season, g.week)) : 'Regular Season')}</div>
                    </div>
                    <div class="matchup-teams-comparison">
                        <div class="team-box ${isT1Win ? 'winner' : ''}">
                            <div class="team-name-line">${t1Name} (${m1Name})</div>
                            <div class="team-score-line">
                                <span class="team-score">${isPlayed ? t1Score.toFixed(2) : '-'} ${isT1Win ? '<span class="win-badge">WIN</span>' : ''}</span>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Proj: ${t1Proj ? t1Proj.toFixed(2) : '-'}</div>
                            ${top1Html}
                        </div>
                        <div class="matchup-margin-badge"><div>VS</div>${margin !== null ? `<div style="font-size:0.7rem;opacity:0.8;">+${margin}</div>` : ''}</div>
                        <div class="team-box ${isT2Win ? 'winner' : ''}">
                            <div class="team-name-line">${t2Name} (${m2Name})</div>
                            <div class="team-score-line">
                                <span class="team-score">${isPlayed ? t2Score.toFixed(2) : '-'} ${isT2Win ? '<span class="win-badge">WIN</span>' : ''}</span>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Proj: ${t2Proj ? t2Proj.toFixed(2) : '-'}</div>
                            ${top2Html}
                        </div>
                    </div>
                    <div class="matchup-action-hint">
                        <span>${!isPlayed ? 'Matchup Pending' : (g.year < 2018 ? 'No player data available pre-2018' : 'View Boxscore & Roster')}</span>
                        <span>${!isPlayed || g.year < 2018 ? '' : '➔'}</span>
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

            // Find top individual player score across all played games in this rivalry
            let topPerformer = null;
            playedGames.forEach(g => {
                const yr = Number(g.year || g.season);
                const wk = Number(g.week);
                const starters = (this.playerStats || []).filter(p => Number(p.year || p.season) === yr && Number(p.week) === wk && (p.manager_id === m1Id || p.manager_id === m2Id) && p.is_starter);
                starters.forEach(p => {
                    const pts = Number(p.fantasy_points) || 0;
                    if (!topPerformer || pts > topPerformer.points) {
                        topPerformer = {
                            name: p.player_name,
                            points: pts,
                            manager_name: p.manager_id === m1Id ? m1Name : m2Name,
                            year: yr,
                            week: wk,
                            headshot: p.headshot_url || p.headshotUrl || this.getPlayerHeadshot(p.player_name, p.position || p.roster_slot)
                        };
                    }
                });
            });

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
                        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;margin-top:4px;">${maxBlowout ? `${maxBlowout.winner} (${this.formatSeasonYear(maxBlowout.season)} W${maxBlowout.week})` : '-'}</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Closest Matchup Margin</div>
                        <div class="summary-stat-value">${minMargin ? `+${minMargin.margin.toFixed(2)} pts` : '-'}</div>
                        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;margin-top:4px;">${minMargin ? `${minMargin.winner} (${this.formatSeasonYear(minMargin.season)} W${minMargin.week})` : '-'}</div>
                    </div>
                    <div class="summary-stat-box">
                        <div class="summary-stat-label">Rivalry High Single-Player Score</div>
                        <div class="summary-stat-value" style="display:flex; align-items:center; gap:8px; justify-content:center;">
                            ${topPerformer && topPerformer.headshot ? `<img src="${topPerformer.headshot}" class="mini-player-headshot" alt="${topPerformer.name}" onerror="this.style.display='none'">` : ''}
                            <span>${topPerformer ? `${topPerformer.name} (${topPerformer.points.toFixed(2)})` : '-'}</span>
                        </div>
                        <div style="font-size:0.8rem;color:var(--text-muted);font-weight:600;margin-top:4px;">${topPerformer ? `${topPerformer.manager_name} (${this.formatSeasonYear(topPerformer.year)} W${topPerformer.week})` : '-'}</div>
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
            const yrMatches = (yr === sNum || Number(this.formatSeasonYear(yr)) === sNum || String(this.formatSeasonYear(yr)) === String(sNum));
            if (!yrMatches || wk !== wNum) return false;
            
            // Match manager IDs or team IDs flexibly
            const hIdStr = hId != null ? String(hId).toLowerCase().trim() : '';
            const aIdStr = aId != null ? String(aId).toLowerCase().trim() : '';
            const hNum = Number(hId);
            const aNum = Number(aId);

            const xHId = String(x.home_manager_id || x.team_1_manager_id || '').toLowerCase().trim();
            const xAId = String(x.away_manager_id || x.team_2_manager_id || '').toLowerCase().trim();
            const xHTeam = Number(x.home_team_id !== undefined ? x.home_team_id : x.team_1_id);
            const xATeam = Number(x.away_team_id !== undefined ? x.away_team_id : x.team_2_id);

            const isHMatch = (
                (hIdStr && (xHId === hIdStr || String(xHTeam) === hIdStr)) ||
                (!isNaN(hNum) && hNum !== 0 && xHTeam === hNum)
            );
            const isAMatch = (
                (aIdStr && (xAId === aIdStr || String(xATeam) === aIdStr)) ||
                (!isNaN(aNum) && aNum !== 0 && xATeam === aNum)
            );

            if (isHMatch && (!aId || isAMatch)) return true;

            const isHMatchSwapped = (
                (hIdStr && (xAId === hIdStr || String(xATeam) === hIdStr)) ||
                (!isNaN(hNum) && hNum !== 0 && xATeam === hNum)
            );
            const isAMatchSwapped = (
                (aIdStr && (xHId === aIdStr || String(xHTeam) === aIdStr)) ||
                (!isNaN(aNum) && aNum !== 0 && xHTeam === aNum)
            );

            if (isHMatchSwapped && (!aId || isAMatchSwapped)) return true;

            // Fallback: if only one side is passed or opponent is 0, match on one side
            if (isHMatch || isHMatchSwapped) return true;

            return false;
        });
        if (!m) return;

        const leftName  = m.home_team_name || m.team_1_name || m.home_manager_id;
        const rightName = m.away_team_name || m.team_2_name || m.away_manager_id;
        const leftScore  = Number(m.home_score !== undefined ? m.home_score : m.team_1_actual_points) || 0;
        const rightScore = Number(m.away_score !== undefined ? m.away_score : m.team_2_actual_points) || 0;
        const isLeftWin  = m.winner === 'HOME' || (m.winner_team_id && Number(m.winner_team_id) === Number(m.team_1_id)) || leftScore > rightScore;
        const isRightWin = m.winner === 'AWAY' || (m.winner_team_id && Number(m.winner_team_id) === Number(m.team_2_id)) || rightScore > leftScore;

        const matchYr = Number(m.year || m.season);
        const leftTeamId = Number(m.home_team_id !== undefined ? m.home_team_id : m.team_1_id);
        const rightTeamId = Number(m.away_team_id !== undefined ? m.away_team_id : m.team_2_id);
        const leftMgrId = m.home_manager_id || m.team_1_manager_id;
        const rightMgrId = m.away_manager_id || m.team_2_manager_id;
        const leftMgrName = this.getManagerDisplayName(leftMgrId, m.home_manager_name || m.team_1_manager_name);
        const rightMgrName = this.getManagerDisplayName(rightMgrId, m.away_manager_name || m.team_2_manager_name);

        const rawGamePlayers = this.playerStats.filter(p => {
            const yr = Number(p.year || p.season);
            const wk = Number(p.week);
            if (yr !== matchYr || wk !== wNum) return false;
            const pTeam = Number(p.team_id);
            if (pTeam && (pTeam === leftTeamId || pTeam === rightTeamId)) return true;
            if (p.manager_id && (p.manager_id === leftMgrId || p.manager_id === rightMgrId)) return true;
            return false;
        });

        const seenKeys = new Set();
        const gamePlayers = [];
        for (const p of rawGamePlayers) {
            const k = `${p.team_id}_${p.player_id || p.player_name}_${p.is_starter ? 'S' : 'B'}`;
            if (!seenKeys.has(k)) { seenKeys.add(k); gamePlayers.push(p); }
        }

        const leftPlayers  = gamePlayers.filter(p => (leftTeamId && Number(p.team_id) === leftTeamId) || (leftMgrId && p.manager_id === leftMgrId));
        const rightPlayers = gamePlayers.filter(p => (rightTeamId && Number(p.team_id) === rightTeamId) || (rightMgrId && p.manager_id === rightMgrId));

        const renderRosterTable = (players, teamName, score, isWinner, managerName) => {
            const starters = players.filter(p => p.is_starter);
            const bench    = players.filter(p => !p.is_starter);
            let html = `<div class="roster-card"><div class="roster-card-header"><div class="roster-team-title">${teamName} ${managerName ? `<span style="font-size: 0.82rem; font-weight: normal; color: var(--text-muted); margin-left: 6px;">(${managerName})</span>` : ''} ${isWinner ? '<span class="win-badge">WINNER</span>' : ''}</div><div class="roster-team-score">${score.toFixed(2)}</div></div><div class="roster-section-title"><span>Starters</span></div>`;

            if (players.length === 0) {
                html += `
                    <div style="padding: 36px 16px; text-align: center; color: var(--text-muted);">
                        <div style="margin-bottom: 8px; color: var(--accent-gold); display: flex; justify-content: center;">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px; font-size: 0.95rem;">Box score is populating, please check back in a moment.</div>
                        <div style="font-size: 0.82rem;">Player statlines and rosters are synchronizing with the platform archive.</div>
                    </div>
                `;
            } else {
                // Normalize slot labels for consistent display
                const normalizeSlot = (slot) => {
                    if (!slot) return null;
                    const s = slot.toUpperCase();
                    if (s === 'SUPER_FLEX' || s === 'SUPERFLEX' || s === 'QB_FLEX') return 'SFLEX';
                    if (s === 'W/R/T' || s === 'W_R_T') return 'FLEX';
                    if (s === 'W/R' || s === 'W_R') return 'FLEX';
                    if (s === 'IDP_FLEX' || s === 'IDP') return 'IDP';
                    if (s === 'REC_FLEX') return 'FLEX';
                    return slot;
                };

                // Determine if these players have explicit roster_slot labels (Sleeper/Yahoo)
                // vs. ESPN players which use lineup_slot_id only.
                const hasExplicitSlots = starters.some(p => p.roster_slot && p.roster_slot !== 'BN' && p.roster_slot !== 'IR');

                if (hasExplicitSlots) {
                    // Slot-first rendering: sort starters into a canonical slot order using their actual roster_slot.
                    // This respects the manager's actual lineup (e.g., a TE in FLEX shows as FLEX, not TE).
                    const SLOT_ORDER = ['QB', 'SFLEX', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'D/ST'];
                    const grouped = {};
                    const unslotted = [];

                    starters.forEach(p => {
                        const normalized = normalizeSlot(p.roster_slot) || 'FLEX';
                        if (!grouped[normalized]) grouped[normalized] = [];
                        grouped[normalized].push(p);
                    });

                    // Render in canonical order, then any extra slots not in SLOT_ORDER
                    const renderedSlots = new Set();
                    const renderSlotGroup = (slotKey, players) => {
                        players.forEach(p => {
                            const displaySlot = slotKey === 'FLEX' && (p.roster_slot === 'W/R/T' || p.roster_slot === 'W/R') ? p.roster_slot : slotKey;
                            const sc = slotKey.toLowerCase().replace(/[^a-z]/g, '');
                            const projHtml = p.projected_points != null && p.projected_points > 0 ? `<div class="player-proj">Proj: ${Number(p.projected_points).toFixed(2)}</div>` : '';
                            const nflMatchupInfo = formatPlayerNflGameInfo(p);
                            const headshot = p.headshot_url || p.headshotUrl || this.getPlayerHeadshot(p.player_name, p.position);
                            const headshotHtml = headshot ? `<img src="${headshot}" class="player-headshot" alt="${p.player_name}" onerror="this.style.display='none'">` : '';
                            html += `<div class="player-row"><div class="player-left">${headshotHtml}<span class="slot-badge ${sc}">${displaySlot}</span><div><div class="player-name">${p.player_name}</div><div class="nfl-team">${nflMatchupInfo || 'NFL'}</div></div></div><div class="player-right"><div class="player-pts">${p.fantasy_points != null ? Number(p.fantasy_points).toFixed(2) : '0.00'}</div>${projHtml}</div></div>`;
                        });
                    };

                    SLOT_ORDER.forEach(slotKey => {
                        if (grouped[slotKey] && grouped[slotKey].length > 0) {
                            renderSlotGroup(slotKey, grouped[slotKey]);
                            renderedSlots.add(slotKey);
                        }
                    });

                    // Any extra slots not in canonical order (e.g. IDP, SFLEX at end)
                    Object.keys(grouped).forEach(slotKey => {
                        if (!renderedSlots.has(slotKey)) {
                            renderSlotGroup(slotKey, grouped[slotKey]);
                        }
                    });

                } else {
                    // ESPN greedy matching via lineup_slot_id or position.
                    // IMPORTANT: Old Sleeper data cached in Firebase has lineup_slot_id=0 for every player
                    // (because the compiler defaulted to 0 when no slot ID existed). This caused the
                    // first starter to always be assigned to QB (lineup_slot_id 0 = ESPN QB slot).
                    // Detect this: if ALL starters have lineup_slot_id===0, suppress slot-ID tests
                    // and match solely on player position.
                    const allSlotsZero = starters.length > 0 && starters.every(p => (p.lineup_slot_id === 0 || p.lineup_slot_id == null || p.lineup_slot_id === -1));

                    const STANDARD_SLOTS = [
                        { label: 'QB',   test: p => (!allSlotsZero && p.lineup_slot_id === 0)  || p.roster_slot === 'QB'   || (!p.roster_slot && p.position === 'QB') },
                        { label: 'RB',   test: p => (!allSlotsZero && p.lineup_slot_id === 2)  || p.roster_slot === 'RB'   || (!p.roster_slot && p.position === 'RB') },
                        { label: 'RB',   test: p => (!allSlotsZero && p.lineup_slot_id === 2)  || p.roster_slot === 'RB'   || (!p.roster_slot && p.position === 'RB') },
                        { label: 'WR',   test: p => (!allSlotsZero && p.lineup_slot_id === 4)  || p.roster_slot === 'WR'   || (!p.roster_slot && p.position === 'WR') },
                        { label: 'WR',   test: p => (!allSlotsZero && p.lineup_slot_id === 4)  || p.roster_slot === 'WR'   || (!p.roster_slot && p.position === 'WR') },
                        { label: 'TE',   test: p => (!allSlotsZero && p.lineup_slot_id === 6)  || p.roster_slot === 'TE'   || (!p.roster_slot && p.position === 'TE') },
                        { label: 'FLEX', test: p => (!allSlotsZero && p.lineup_slot_id === 23) || ['W/R/T', 'FLEX', 'W/R'].includes(p.roster_slot) || (!p.roster_slot && ['RB', 'WR', 'TE'].includes(p.position)) },
                        { label: 'K',    test: p => (!allSlotsZero && p.lineup_slot_id === 17) || p.roster_slot === 'K'    || p.position === 'K' },
                        { label: 'DEF',  test: p => (!allSlotsZero && p.lineup_slot_id === 16) || ['DEF', 'D/ST'].includes(p.roster_slot) || ['DEF', 'D/ST'].includes(p.position) }
                    ];

                    const remainingStarters = [...starters];
                    STANDARD_SLOTS.forEach(slot => {
                        let idx = remainingStarters.findIndex(slot.test);
                        if (idx !== -1) {
                            const p = remainingStarters.splice(idx, 1)[0];
                            const slotDisplay = (p.roster_slot === 'W/R/T' || p.roster_slot === 'W/R') ? p.roster_slot : slot.label;
                            const sc = slot.label.toLowerCase().replace(/[^a-z]/g, '');
                            const projHtml = p.projected_points != null && p.projected_points > 0 ? `<div class="player-proj">Proj: ${Number(p.projected_points).toFixed(2)}</div>` : '';
                            
                            const nflMatchupInfo = formatPlayerNflGameInfo(p);
                            const headshot = p.headshot_url || p.headshotUrl || this.getPlayerHeadshot(p.player_name, p.position || p.roster_slot);
                            const headshotHtml = headshot ? `<img src="${headshot}" class="player-headshot" alt="${p.player_name}" onerror="this.style.display='none'">` : '';

                            html += `<div class="player-row"><div class="player-left">${headshotHtml}<span class="slot-badge ${sc}">${slotDisplay}</span><div><div class="player-name">${p.player_name}</div><div class="nfl-team">${nflMatchupInfo || 'NFL'}</div></div></div><div class="player-right"><div class="player-pts">${p.fantasy_points != null ? Number(p.fantasy_points).toFixed(2) : '0.00'}</div>${projHtml}</div></div>`;
                        } else {
                            const sc = slot.label.toLowerCase().replace(/[^a-z]/g, '');
                            html += `<div class="player-row" style="opacity:0.45;"><div class="player-left"><span class="slot-badge ${sc}">${slot.label}</span><div><div class="player-name" style="font-style:italic;color:var(--text-muted);">Empty</div></div></div><div class="player-right"><div class="player-pts">0.00</div></div></div>`;
                        }
                    });

                    // Any remaining starters that didn't fit into the fixed slots
                    remainingStarters.forEach(p => {
                        const slotDisplay = p.roster_slot || p.position || 'FLEX';
                        const sc = slotDisplay.toLowerCase().replace(/[^a-z]/g, '');
                        const projHtml = p.projected_points != null && p.projected_points > 0 ? `<div class="player-proj">Proj: ${Number(p.projected_points).toFixed(2)}</div>` : '';
                        const nflMatchupInfo = formatPlayerNflGameInfo(p);
                        const headshot = p.headshot_url || p.headshotUrl || this.getPlayerHeadshot(p.player_name, p.position || p.roster_slot);
                        const headshotHtml = headshot ? `<img src="${headshot}" class="player-headshot" alt="${p.player_name}" onerror="this.style.display='none'">` : '';

                        html += `<div class="player-row"><div class="player-left">${headshotHtml}<span class="slot-badge ${sc}">${slotDisplay}</span><div><div class="player-name">${p.player_name}</div><div class="nfl-team">${nflMatchupInfo || 'NFL'}</div></div></div><div class="player-right"><div class="player-pts">${p.fantasy_points != null ? Number(p.fantasy_points).toFixed(2) : '0.00'}</div>${projHtml}</div></div>`;
                    });
                }


                if (bench.length > 0) {
                    html += `<div class="roster-section-title" style="margin-top:20px;"><span>Bench & IR</span></div>`;
                    bench.forEach(p => {
                        const isIR = p.lineup_slot_id === 21 || p.roster_slot === 'IR';
                        const slotLabel = isIR ? 'IR' : 'BN';
                        const sc = slotLabel.toLowerCase();
                        const projHtml = p.projected_points != null && p.projected_points > 0 ? `<div class="player-proj">Proj: ${Number(p.projected_points).toFixed(2)}</div>` : '';
                        
                        const nflMatchupInfo = formatPlayerNflGameInfo(p);
                        const headshot = p.headshot_url || p.headshotUrl || this.getPlayerHeadshot(p.player_name, p.position || p.roster_slot);
                        const headshotHtml = headshot ? `<img src="${headshot}" class="player-headshot" alt="${p.player_name}" onerror="this.style.display='none'">` : '';

                        html += `<div class="player-row" style="opacity:0.8;"><div class="player-left">${headshotHtml}<span class="slot-badge ${sc}">${slotLabel}</span><div><div class="player-name">${p.player_name}</div><div class="nfl-team">${nflMatchupInfo || 'NFL'}</div></div></div><div class="player-right"><div class="player-pts">${p.fantasy_points != null ? Number(p.fantasy_points).toFixed(2) : '0.00'}</div>${projHtml}</div></div>`;
                    });
                }
            }
            html += `</div>`;
            return html;
        };

        const roundName = m ? (getMatchupRoundLabel(m) || m.playoff_round || (m.is_playoff ? getPlayoffRoundName(matchYr, week) : '')) : '';
        modalContent.innerHTML = `
            <div class="modal-header">
                <div class="modal-title-area">
                    <h2>${this.formatSeasonYear(matchYr)} • Week ${week} ${m && m.is_playoff ? ' • Playoffs (' + (roundName || 'Playoffs') + ')' : ' • Regular Season'}</h2>
                    <p>${leftName} (${leftScore.toFixed(2)}) vs ${rightName} (${rightScore.toFixed(2)})</p>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="btn btn-sm btn-outline-primary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="window.app.openSettingsModal(${matchYr})" title="View League Scoring Settings">? Scoring</button>
                    <button class="modal-close-btn" onclick="document.getElementById('boxscore-modal').close()">✕</button>
                </div>
            </div>
            <div class="rosters-grid">
                ${renderRosterTable(leftPlayers, leftName, leftScore, isLeftWin, leftMgrName)}
                ${renderRosterTable(rightPlayers, rightName, rightScore, isRightWin, rightMgrName)}
            </div>
        `;

        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.style.display = 'block';
    }

    renderParadigms() {
        const subtabPr = document.getElementById('paradigm-subtab-pr');
        const subtabRiv = document.getElementById('paradigm-subtab-rivalry');
        const secPr = document.getElementById('sec-paradigm-pr');
        const secRiv = document.getElementById('sec-paradigm-rivalry');
        const prContainer = document.getElementById('paradigm-power-rankings-container');
        const rivContainer = document.getElementById('paradigm-rivalry-container');

        const hasPr = Boolean(
            this.paradigms?.power_rankings?.enabled ||
            this.paradigms?.power_rankings?.current_ranking ||
            (Array.isArray(this.paradigms?.power_rankings?.archived_rankings) && this.paradigms.power_rankings.archived_rankings.length > 0) ||
            (Array.isArray(this.powerRankingsHistory) && this.powerRankingsHistory.length > 0) ||
            (this.powerRankingsEngine && (this.powerRankingsEngine.data?.current_ranking || this.powerRankingsEngine.data?.archived_rankings?.length > 0)) ||
            (this.leagueSlug === 'dmsfantasy')
        );
        const hasRiv = Boolean(
            (Array.isArray(this.paradigms?.rivalries) && this.paradigms.rivalries.length > 0) ||
            (this.paradigms?.rivalries && typeof this.paradigms.rivalries === 'object' && Object.keys(this.paradigms.rivalries).length > 0) ||
            (this.leagueSlug === 'dmsfantasy')
        );

        if (!this.activeParadigmSubtab) {
            this.activeParadigmSubtab = 'pr';
        }

        const showSubtab = (tab) => {
            this.activeParadigmSubtab = tab;
            if (subtabPr) subtabPr.classList.toggle('active', tab === 'pr');
            if (subtabRiv) subtabRiv.classList.toggle('active', tab === 'rivalry');
            if (secPr) secPr.style.display = (tab === 'pr') ? 'block' : 'none';
            if (secRiv) secRiv.style.display = (tab === 'rivalry') ? 'block' : 'none';

            if (tab === 'pr') {
                if (hasPr && this.powerRankingsEngine && prContainer) {
                    this.powerRankingsEngine.containerId = 'paradigm-power-rankings-container';
                    this.powerRankingsEngine.render();
                } else if (prContainer) {
                    prContainer.innerHTML = `
                        <div class="card" style="text-align: center; padding: 3rem 2rem; max-width: 760px; margin: 0 auto; box-shadow: var(--shadow-sm);">
                            <h2 style="font-family: var(--font-heading, 'Newsreader', serif); font-size: 1.8rem; margin-bottom: 0.75rem;">Power Rankings Paradigm</h2>
                            <p style="color: var(--text-muted); font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem;">
                                Power Rankings bring editorial depth, weekly analytical tiers, and bragging rights to your league. Published editions feature custom blurbs, movement indicators, and multi-author publishing access.
                            </p>
                            <div style="background: var(--bg-main, rgba(0,0,0,0.03)); border: 1px dashed var(--border-color, #ccc); border-radius: 8px; padding: 1.25rem; font-size: 0.9rem; color: var(--text-muted);">
                                Power Rankings have not been published for this league yet. League Commissioners can initialize and publish rankings from the Admin Dashboard.
                            </div>
                        </div>
                    `;
                }
            } else if (tab === 'rivalry') {
                if (hasRiv && rivContainer) {
                    this.renderRivalries(rivContainer);
                } else if (rivContainer) {
                    rivContainer.innerHTML = `
                        <div class="card" style="text-align: center; padding: 3rem 2rem; max-width: 760px; margin: 0 auto; box-shadow: var(--shadow-sm);">
                            <h2 style="font-family: var(--font-heading, 'Newsreader', serif); font-size: 1.8rem; margin-bottom: 0.75rem;">Rivalry Week Paradigm</h2>
                            <p style="color: var(--text-muted); font-size: 1rem; line-height: 1.6; margin-bottom: 1.5rem;">
                                Rivalry Week locks in permanent, bad-blood head-to-head matchups annually during a marquee regular-season week, as Thanksgiving Week. Historical records, feud chronicles, and high scores are tracked forever.
                            </p>
                            <div style="background: var(--bg-main, rgba(0,0,0,0.03)); border: 1px dashed var(--border-color, #ccc); border-radius: 8px; padding: 1.25rem; font-size: 0.9rem; color: var(--text-muted);">
                                Rivalry Week has not been activated for this league yet. Commissioners can establish rivalry pairs and feud chronicles in the Admin Dashboard.
                            </div>
                        </div>
                    `;
                }
            }
        };

        if (subtabPr) subtabPr.onclick = () => showSubtab('pr');
        if (subtabRiv) subtabRiv.onclick = () => showSubtab('rivalry');

        showSubtab(this.activeParadigmSubtab);
    }

    renderRivalryWeek() {
        const root = document.getElementById('view-rivalry');
        if (!root) return;
        this.renderRivalries(root);
    }

    renderRivalries(container) {
        if (!container) container = document.getElementById('paradigm-rivalry-container') || document.getElementById('view-rivalry');
        if (!container) return;

        const rivalries = Array.isArray(this.paradigms?.rivalries) ? this.paradigms.rivalries : [];
        if (rivalries.length === 0) {
            container.innerHTML = `<div class="card" style="text-align: center; color: var(--text-muted); padding: 2rem;">No rivalries configured for this league.</div>`;
            return;
        }

        const inauguralRawYear = this.paradigms?.rivalry_inaugural_season || 2027;
        const getRivalryHistory = (mgr1, mgr2) => {
            const matches = [];
            if (!this.matchups) return matches;
            const n1 = (mgr1 || '').toLowerCase().trim();
            const n2 = (mgr2 || '').toLowerCase().trim();

            for (const m of this.matchups) {
                const yr = Number(m.year || m.season);
                const wk = Number(m.week);
                if (yr >= inauguralRawYear && wk === 13) {
                    const hId = (m.home_manager_id || m.team_1_manager_id || '').toLowerCase();
                    const aId = (m.away_manager_id || m.team_2_manager_id || '').toLowerCase();
                    const hName = (m.home_manager_name || m.team_1_manager_name || '').toLowerCase();
                    const aName = (m.away_manager_name || m.team_2_manager_name || '').toLowerCase();

                    const match1 = (hId === n1 || hName.includes(n1) || aId === n1 || aName.includes(n1));
                    const match2 = (hId === n2 || hName.includes(n2) || aId === n2 || aName.includes(n2));
                    if (match1 && match2) {
                        matches.push(m);
                    }
                }
            }
            return matches;
        };

        let cardsHtml = '';
        rivalries.forEach(rivalry => {
            const history = getRivalryHistory(rivalry.manager1, rivalry.manager2);
            let wins1 = 0;
            let wins2 = 0;
            let pts1 = 0.0;
            let pts2 = 0.0;

            history.forEach(m => {
                const s1 = Number(m.home_score !== undefined ? m.home_score : m.team_1_actual_points) || 0;
                const s2 = Number(m.away_score !== undefined ? m.away_score : m.team_2_actual_points) || 0;
                pts1 += s1;
                pts2 += s2;
                if (s1 > s2) wins1++;
                else if (s2 > s1) wins2++;
            });

            const inauguralYear = this.formatSeasonYear(inauguralRawYear);
            let drawerContent = '';
            if (history.length === 0) {
                drawerContent = `
                    <div class="dungeon-inaugural-banner">
                        <strong>Inaugural Matchup: ${inauguralYear} Season</strong>
                        No annual rivalry games contested yet. Future scores, winners, and boxscores will appear here automatically starting in ${inauguralYear}.
                    </div>
                `;
            } else {
                drawerContent = `<div class="dungeon-matchup-list">`;
                history.forEach(m => {
                    const s1 = Number(m.home_score !== undefined ? m.home_score : m.team_1_actual_points) || 0;
                    const s2 = Number(m.away_score !== undefined ? m.away_score : m.team_2_actual_points) || 0;
                    const t1 = m.home_team_name || m.team_1_name || 'Team 1';
                    const t2 = m.away_team_name || m.team_2_name || 'Team 2';
                    const yr = Number(m.year || m.season);
                    drawerContent += `
                        <div class="dungeon-matchup-row" onclick="window.app && window.app.openBoxscoreModal(${yr}, ${m.week}, '${m.home_manager_id || m.team_1_manager_id}', '${m.away_manager_id || m.team_2_manager_id}')">
                            <div class="dungeon-matchup-year">${this.formatSeasonYear(yr)} Week ${m.week}</div>
                            <div class="dungeon-matchup-score">${t1} ${s1.toFixed(2)} vs ${s2.toFixed(2)} ${t2}</div>
                        </div>
                    `;
                });
                drawerContent += `</div>`;
            }

            cardsHtml += `
                <div class="dungeon-card">
                    <div>
                        <div class="dungeon-card-header">
                            <div class="dungeon-rivalry-title-grid">
                                <div class="dungeon-rivalry-cell cell-left">
                                    <span class="dungeon-rivalry-name">${rivalry.surname1}</span>
                                </div>
                                <div class="dungeon-vs-text">VS.</div>
                                <div class="dungeon-rivalry-cell cell-right">
                                    <span class="dungeon-rivalry-name">${rivalry.surname2}</span>
                                </div>
                            </div>
                            <div class="dungeon-rivalry-underline"></div>
                        </div>

                        <div class="dungeon-blurb-box">
                            <span class="dungeon-blurb-label">Rivalry Feud Chronicle</span>
                            <div class="dungeon-blurb-text">
                                ${rivalry.writeup || ''}
                            </div>
                        </div>
                    </div>

                    <div>
                        <div class="dungeon-record-showcase">
                            <div class="dungeon-record-main">${wins1} - ${wins2}</div>
                            <div class="dungeon-record-label">All-Time Rivalry Record</div>
                            <div class="dungeon-points-split">
                                <div class="dungeon-pts-box">
                                    <div class="dungeon-pts-name">${rivalry.surname1}</div>
                                    <div class="dungeon-pts-val">${pts1.toFixed(1)}</div>
                                    <div class="dungeon-pts-label">Total Pts</div>
                                </div>
                                <div class="dungeon-pts-box">
                                    <div class="dungeon-pts-name">${rivalry.surname2}</div>
                                    <div class="dungeon-pts-val">${pts2.toFixed(1)}</div>
                                    <div class="dungeon-pts-label">Total Pts</div>
                                </div>
                            </div>
                        </div>

                        <button class="dungeon-btn-view" onclick="window.app ? window.app.toggleRivalryDrawer(this) : (window.toggleRivalryDrawer && window.toggleRivalryDrawer(this))">
                            View Rivalry Matchups
                        </button>
                        <div class="dungeon-matchups-drawer">
                            <div class="dungeon-matchups-drawer-inner">
                                ${drawerContent}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = `
            <div class="rivalry-dungeon-container">
                <div class="dungeon-masthead" style="position: relative;">
                    <h1 class="dungeon-main-title">Rivalry Week</h1>
                    <blockquote class="dungeon-quote">
                        <p>Were half to half the world by the ears and he.</p>
                        <p>Upon my party, I'ld revolt to make</p>
                        <p>Only my wars with him: he is a lion</p>
                        <p>That I am proud to hunt.</p>
                    </blockquote>
                    <div class="dungeon-quote-credit">, as William Shakespeare, <em>Coriolanus</em></div>
                    <p class="dungeon-subtitle">
                        Every manager is bound to an eternal rival. Contested annually during the week of Thanksgiving, where rivalry records are carved in stone forever.
                    </p>

                    <div class="dungeon-mike-box">
                        <span class="dungeon-box-tag">COMMISSIONER MANIFESTO</span>
                        <p>"I have no enemies" is what I would say if I had no enemies. But everyone has enemies. Opps. Rivals. And for the first time in league history, we have a week dedicated to that feeling in your chest that you get when you see their team name across from yours on the matchups page. It just means more. This is rivalry week.</p>
                    </div>
                </div>

                <div class="dungeon-rivalry-grid">
                    ${cardsHtml}
                </div>
            </div>
        `;
    }

    toggleRivalryDrawer(btn) {
        const drawer = btn.nextElementSibling;
        if (!drawer) return;
        const isOpen = drawer.classList.toggle('open');
        btn.textContent = isOpen ? 'Hide Rivalry Matchups' : 'View Rivalry Matchups';
    }

    updateAdminTabVisibility() {
        const btnAdmin = document.getElementById('btn-tab-admin');
        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const userEmail = (session?.email || '').toLowerCase();
        const isFounder = Boolean(session?.isFounder || userEmail === 'landonekatz@gmail.com');
        const adminEmail = this.leagueSettings?.admin_email || window.FANTASY_DATA?.league_settings?.admin_email;
        const isLeagueAdmin = Boolean(isFounder || (session && adminEmail && userEmail === adminEmail.toLowerCase()) || (session && session.adminLeagues && session.adminLeagues.includes(this.leagueSlug)));

        if (btnAdmin) {
            if (isLeagueAdmin) {
                btnAdmin.style.display = 'inline-flex';
            } else {
                btnAdmin.style.display = 'none';
                if (this.activeTab === 'admin') {
                    this.switchTab('home');
                }
            }
        }

        // Check if current admin has claimed a manager profile in this league
        const currentAdminClaim = session ? (session.claims?.[this.leagueSlug] || localStorage.getItem('vault_claim_' + this.leagueSlug) || (this.claims && Object.entries(this.claims).find(([k, v]) => v?.email === userEmail || (session.uid && v?.userId === session.uid))?.[0])) : null;
        const btnClaimAdmin = document.getElementById('btn-claim-admin-profile');
        if (btnClaimAdmin) {
            btnClaimAdmin.style.display = 'none';
        }

        this.renderAdminClaimPrompt(isLeagueAdmin, currentAdminClaim);

        if (this.notesEngine) {
            this.notesEngine.render();
        }
    }

    renderAdminClaimPrompt(isLeagueAdmin, currentAdminClaim) {
        let bannerContainer = document.getElementById('admin-unclaimed-banner-container');
        if (!bannerContainer) {
            const homeView = document.getElementById('view-home');
            if (homeView) {
                bannerContainer = document.createElement('div');
                bannerContainer.id = 'admin-unclaimed-banner-container';
                homeView.insertBefore(bannerContainer, homeView.firstChild);
            }
        }
        if (!bannerContainer) return;

        if (!isLeagueAdmin || currentAdminClaim) {
            bannerContainer.innerHTML = '';
            bannerContainer.style.display = 'none';
            return;
        }

        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const memberList = (this.members && this.members.length > 0) ? this.members : (this.managers && this.managers.length > 0 ? this.managers : (window.FANTASY_DATA?.members || []));
        const sortedMembers = [...memberList].sort((a, b) => (a.canonical_name || a.name || '').localeCompare(b.canonical_name || b.name || ''));
        const unclaimed = sortedMembers.filter(m => !this.claims || (!this.claims[m.id] && (!m.espn_id || !this.claims[m.espn_id])));
        const optionsList = unclaimed.length > 0 ? unclaimed : sortedMembers;

        const optionsHtml = optionsList.map(m => {
            const mName = m.canonical_name || m.name || m.id;
            const isLandonMatch = session?.email?.toLowerCase().includes('landon') && (mName.toLowerCase().includes('landon') || m.id.toLowerCase().includes('landon'));
            return `<option value="${m.id}" ${isLandonMatch ? 'selected' : ''}>${mName}</option>`;
        }).join('');

        bannerContainer.style.display = 'block';
        bannerContainer.innerHTML = `
            <div class="card admin-claim-hero-banner" style="background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fde047; border-left: 5px solid #d97706; padding: 1.25rem 1.5rem; border-radius: 8px; margin-bottom: 1.5rem; box-shadow: 0 4px 12px rgba(217, 119, 6, 0.08);">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 260px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 0.72rem; font-weight: 800; text-transform: uppercase; background: #d97706; color: #fff; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">League Admin</span>
                            <span style="font-weight: 800; font-size: 1rem; color: #78350f;">Action Required: Link Your Manager Profile</span>
                        </div>
                        <p style="margin: 0; font-size: 0.88rem; color: #92400e; line-height: 1.45;">
                            You are recognized as the administrator of this league (<strong>${session?.email || 'Admin'}</strong>), but haven't linked your manager profile yet. Select your team below to connect your personal career stats, win/loss records, and head-to-head history:
                        </p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <select id="banner-admin-claim-select" class="admin-select" style="min-width: 170px; padding: 7px 10px; font-size: 0.88rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff;">
                            <option value="">-- Select Your Team --</option>
                            ${optionsHtml}
                        </select>
                        <select id="banner-admin-nfl-select" class="admin-select" title="Favorite NFL Team (trust us, this will be important later)" style="min-width: 170px; padding: 7px 10px; font-size: 0.88rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff;">
                            <option value="">-- Favorite NFL Team --</option>
                            ${(window.renderNflTeamSelectOptions ? window.renderNflTeamSelectOptions(session?.favorite_team) : '')}
                        </select>
                        <button id="btn-banner-admin-claim" class="btn-primary" style="padding: 7px 18px; font-size: 0.88rem; font-weight: 700; border-radius: 4px; cursor: pointer; white-space: nowrap;">Link Team</button>
                    </div>
                </div>
                <div id="banner-admin-claim-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
            </div>
        `;

        const btnClaim = bannerContainer.querySelector('#btn-banner-admin-claim');
        const selectClaim = bannerContainer.querySelector('#banner-admin-claim-select');
        const selectNfl = bannerContainer.querySelector('#banner-admin-nfl-select');
        const feedbackEl = bannerContainer.querySelector('#banner-admin-claim-feedback');

        btnClaim?.addEventListener('click', async () => {
            const mgrId = selectClaim?.value;
            if (!mgrId) {
                alert('Please select your manager profile.');
                return;
            }
            const favoriteTeam = selectNfl?.value || '';
            if (!favoriteTeam) {
                alert('Please select your favorite NFL team. Trust us, this will be important later.');
                if (selectNfl) selectNfl.focus();
                return;
            }
            const targetMgr = sortedMembers.find(m => m.id === mgrId);
            const mgrName = targetMgr?.canonical_name || targetMgr?.name || mgrId;
            btnClaim.disabled = true;
            btnClaim.textContent = 'Linking...';

            try {
                if (typeof window.AuthEngine?.claimManagerProfile === 'function') {
                    await window.AuthEngine.claimManagerProfile(this.leagueSlug, mgrId, mgrName, favoriteTeam);
                    await window.AuthEngine.linkUserLeague(this.leagueSlug, 'admin', this.leagueSettings?.name || 'League');
                }
                if (!this.claims) this.claims = {};
                this.claims[mgrId] = {
                    userId: session?.uid,
                    email: session?.email,
                    name: mgrName,
                    claimedAt: Date.now()
                };
                if (session) {
                    if (!session.claims) session.claims = {};
                    session.claims[this.leagueSlug] = mgrId;
                }
                try { localStorage.setItem(`vault_claim_${this.leagueSlug}`, mgrId); } catch(e){}

                if (feedbackEl) {
                    feedbackEl.style.display = 'block';
                    feedbackEl.className = 'admin-feedback-msg success';
                    feedbackEl.innerHTML = `✓ Successfully linked your profile as <strong>${mgrName}</strong>! Refreshing...`;
                }
                setTimeout(() => {
                    this.updateAdminTabVisibility();
                    if (this.activeTab === 'admin') {
                        this.renderAdminDashboard();
                    } else {
                        window.location.reload();
                    }
                }, 1000);
            } catch (e) {
                console.error('Error claiming admin profile from banner:', e);
                btnClaim.disabled = false;
                btnClaim.textContent = 'Link Team';
                if (feedbackEl) {
                    feedbackEl.style.display = 'block';
                    feedbackEl.className = 'admin-feedback-msg error';
                    feedbackEl.textContent = 'Failed to link profile. Please try again.';
                }
            }
        });
    }

    renderAdminDashboard() {
        const container = document.getElementById('view-admin');
        if (!container) return;

        const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
        const userEmail = (session?.email || '').toLowerCase();
        const isFounder = Boolean(session?.isFounder || userEmail === 'landonekatz@gmail.com');
        const adminEmail = (this.leagueSettings?.admin_email || window.FANTASY_DATA?.league_settings?.admin_email || '').toLowerCase();
        const isDesignatedAdmin = Boolean(adminEmail && userEmail === adminEmail);
        const isFounderInspection = Boolean(isFounder && !isDesignatedAdmin && this.leagueSlug !== 'dmsfantasy');
        const isPrivate = Boolean(this.leagueSettings?.is_private);
        const isWelcomeHidden = Boolean(this.leagueSettings?.hide_welcome_card);

        const currentTagline = this.leagueSettings.tagline || this.leagueSettings.subtitle || "In a league of our own";
        const leagueName = this.leagueSettings.name || "Fantasy Football League";
        const leagueSlug = this.leagueSlug || window.location.pathname.substring(1).replace(/\/$/, "") || "league";

        const currentPlatform = (this.credentials?.platform || this.leagueSettings?.platform || 'espn').toLowerCase();
        const syncStatus = this.syncStatus || {};
        const isAuthRequired = syncStatus.status === 'auth_required';
        const lastSynced = this.credentials?.last_synced || syncStatus.last_synced || 'Not synced yet';

        // Check 30-day slug change limit
        const lastSlugChange = this.leagueSettings?.last_slug_change_at;
        let slugDaysRemaining = 0;
        if (lastSlugChange) {
            const elapsed = Date.now() - Number(lastSlugChange);
            const thirtyDays = 30 * 24 * 60 * 60 * 1000;
            if (elapsed < thirtyDays) {
                slugDaysRemaining = Math.ceil((thirtyDays - elapsed) / (24 * 60 * 60 * 1000));
            }
        }

        // Ensure clean 6-character random alphanumeric join code
        if (!this.leagueSettings.join_code || this.leagueSettings.join_code.length < 6 || /24$/.test(this.leagueSettings.join_code)) {
            const newCode = generateRandomJoinCode();
            this.leagueSettings.join_code = newCode;
            if (this.leagueSlug) {
                try {
                    const settingsRef = dbRef(database, `leagues/${this.leagueSlug}/league_settings`);
                    update(settingsRef, { join_code: newCode }).catch(() => {});
                } catch (e) {}
            }
        }

        const joinCode = this.leagueSettings.join_code.toUpperCase();
        const joinLink = window.location.origin + '/' + leagueSlug + '/?join=' + joinCode;

        // Generate manager list for renaming, claims, and merging (always pre-populated)
        const memberList = (this.members && this.members.length > 0) ? this.members : (this.managers && this.managers.length > 0 ? this.managers : (window.FANTASY_DATA?.members || []));
        const sortedMembers = [...memberList].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // Check if the current admin has claimed a profile in this league
        const currentAdminClaim = session ? (session.claims?.[leagueSlug] || (this.claims && Object.entries(this.claims).find(([k, v]) => v?.email === session.email)?.[0])) : null;
        const unclaimedMembers = sortedMembers.filter(m => !this.claims || (!this.claims[m.id] && (!m.espn_id || !this.claims[m.espn_id])));
        
        // Categorize managers by active and inactive status
        const isManagerActive = (m) => {
            if (m.isActive === true) return true;
            if (m.isActive === false) return false;
            if (m.is_retired === true) return false;
            const statusStr = String(m.status || '').toLowerCase().trim();
            if (statusStr === 'active' || statusStr === 'current') return true;
            if (statusStr === 'retired' || statusStr === 'inactive') return false;
            return true;
        };

        const activeMembers = sortedMembers.filter(isManagerActive);
        const inactiveMembers = sortedMembers.filter(m => !isManagerActive(m));

        // Build 3-column table row for a manager
        const buildManagerRow = (m, statusType) => {
            const memberMatchups = (this.matchups || []).filter(x => x.home_manager_id === m.id || x.away_manager_id === m.id || x.team_1_manager_id === m.id || x.team_2_manager_id === m.id);
            const yearsActive = [...new Set(memberMatchups.map(x => x.year || x.season).filter(Boolean))].sort((a, b) => Number(a) - Number(b));
            const yearsStr = yearsActive.length > 0 ? `${yearsActive[0]}–${yearsActive[yearsActive.length - 1]} (${yearsActive.length} yr${yearsActive.length > 1 ? 's' : ''})` : 'Active';
            
            const claim = this.claims ? (
                this.claims[m.id] ||
                (m.espn_id && this.claims[m.espn_id]) ||
                (m.espn_ids && m.espn_ids.map(id => this.claims[id]).find(Boolean)) ||
                Object.values(this.claims).find(c => c.managerId === m.id || (m.espn_id && c.managerId === m.espn_id) || (m.espn_ids && m.espn_ids.includes(c.managerId)))
            ) : null;
            const leagueUser = (claim?.userId && this.users?.[claim.userId])
                ? this.users[claim.userId]
                : (this.users ? Object.values(this.users).find(u => u.managerId === m.id || (m.espn_id && u.managerId === m.espn_id) || (m.espn_ids && m.espn_ids.includes(u.managerId))) : null);
            const claimEmail = claim ? (claim.email || leagueUser?.email || claim.name || 'Claimed') : (leagueUser?.email || '');
            const isClaimed = Boolean(claim || leagueUser);

            const statusBadge = statusType === 'active'
                ? `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #ecfdf5; color: #15803d; border: 1px solid #bbf7d0; margin-left: 4px;"><span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #16a34a;"></span>Active</span>`
                : `<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; font-weight: 600; padding: 2px 6px; border-radius: 4px; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; margin-left: 4px;"><span style="display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: #94a3b8;"></span>Inactive</span>`;

            return `
                <tr data-manager-id="${m.id}" data-status="${statusType}">
                    <td>
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <input type="text" class="admin-input mgr-rename-input" value="${m.name}" placeholder="Display name" ${isFounderInspection ? 'disabled title="Editing disabled in Founder Inspection Mode" style="flex: 1; min-width: 140px; padding: 6px 8px; font-size: 0.86rem; font-weight: 600; box-sizing: border-box; background: #f8fafc; cursor: not-allowed;"' : 'style="flex: 1; min-width: 140px; padding: 6px 8px; font-size: 0.86rem; font-weight: 600; box-sizing: border-box;"'}>
                            <button class="btn-save-manager-name btn-primary" data-manager-id="${m.id}" ${isFounderInspection ? 'disabled title="Editing disabled in Founder Inspection Mode" style="padding: 5px 12px; font-size: 0.76rem; font-weight: 600; cursor: not-allowed; white-space: nowrap; border-radius: 4px; opacity: 0.5;"' : 'style="padding: 5px 12px; font-size: 0.76rem; font-weight: 600; cursor: pointer; white-space: nowrap; border-radius: 4px;"'}>Save</button>
                            ${statusBadge}
                        </div>
                    </td>
                    <td style="font-size: 0.82rem; color: var(--text-secondary); font-weight: 500; white-space: nowrap;">${yearsStr}</td>
                    <td>
                        <div class="admin-actions-cell" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            ${isClaimed ? `
                                <div style="display: inline-flex; flex-direction: column; gap: 2px;">
                                    <span class="badge-registered" title="Claimed by ${claimEmail}${claim && claim.claimedAt ? ' on ' + new Date(claim.claimedAt).toLocaleDateString() : ''}">
                                        <span style="color: #15803d; font-weight: 800;">✓</span> ${claimEmail}
                                    </span>
                                    ${claim && claim.claimedAt ? `
                                        <span style="font-size: 0.7rem; color: var(--text-muted); padding-left: 2px;">Joined ${new Date(claim.claimedAt).toLocaleDateString()}</span>
                                    ` : ''}
                                </div>
                                ${!isFounderInspection ? `
                                    <button class="btn-reassign-manager" data-manager-id="${m.id}" data-manager-name="${m.name}" style="background: none; border: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; cursor: pointer;" title="Unlink / Reassign mapped account">Reassign</button>
                                ` : ''}
                            ` : `
                                <span class="badge-unregistered">Unclaimed</span>
                                <button class="btn-copy-claim-link btn" data-manager-id="${m.id}" data-manager-name="${m.name}" style="padding: 4px 8px; font-size: 0.72rem; font-weight: 600; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">Copy Link</button>
                                ${!isFounderInspection ? `
                                    <button class="btn-email-claim-link btn-primary" data-manager-id="${m.id}" data-manager-name="${m.name}" style="padding: 4px 8px; font-size: 0.72rem; font-weight: 600; cursor: pointer; border-radius: 4px;">Email Link</button>
                                ` : ''}
                            `}
                        </div>
                    </td>
                </tr>
            `;
        };

        const activeManagerRows = activeMembers.map(m => buildManagerRow(m, 'active')).join('');
        const inactiveManagerRows = inactiveMembers.map(m => buildManagerRow(m, 'inactive')).join('');

        let managerRows = '';
        if (activeMembers.length > 0) {
            managerRows += `
                <tr class="table-group-header" data-status-header="active">
                    <td colspan="3" style="background: var(--bg-surface, #f8fafc); padding: 9px 14px; border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-weight: 700; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-primary); display: inline-flex; align-items: center; gap: 6px;">
                                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #16a34a;"></span>
                                Active Managers (${activeMembers.length})
                            </span>
                            <span style="font-size: 0.72rem; font-weight: 700; color: #15803d; background: #ecfdf5; padding: 2px 8px; border-radius: 9999px; border: 1px solid #bbf7d0;">Current Season Roster</span>
                        </div>
                    </td>
                </tr>
                ${activeManagerRows}
            `;
        }
        if (inactiveMembers.length > 0) {
            managerRows += `
                <tr class="table-group-header" data-status-header="inactive">
                    <td colspan="3" style="background: var(--bg-surface, #f8fafc); padding: 9px 14px; border-top: 2px solid var(--border-color); border-bottom: 1px solid var(--border-color);">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-weight: 700; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); display: inline-flex; align-items: center; gap: 6px;">
                                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #94a3b8;"></span>
                                Inactive / Historical Managers (${inactiveMembers.length})
                            </span>
                            <span style="font-size: 0.72rem; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 9999px; border: 1px solid #cbd5e1;">Former Members</span>
                        </div>
                    </td>
                </tr>
                ${inactiveManagerRows}
            `;
        }

        // Build options for merge selector and season selector
        const managerOptions = sortedMembers.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        const unclaimedOptions = unclaimedMembers.map(m => {
            const isLandonMatch = session?.email?.toLowerCase().includes('landon') && (m.name.toLowerCase().includes('landon') || m.id.toLowerCase().includes('landon'));
            return `<option value="${m.id}" ${isLandonMatch ? 'selected' : ''}>${m.name}</option>`;
        }).join('');

        const distinctYears = [...new Set((this.standings || []).map(s => Number(s.year || s.season)).filter(Boolean))].sort((a, b) => b - a);
        const activeYearsList = distinctYears.length > 0 ? distinctYears : [new Date().getFullYear()];
        const seasonOptions = activeYearsList.map(y => `<option value="${y}">Season ${y}</option>`).join('');

        const allowNicknames = this.leagueSettings?.allow_nicknames !== false;

        container.innerHTML = `
            <div class="admin-dashboard-container">

                <!-- Sticky Settings Sidebar -->
                <aside class="admin-sidebar" id="admin-settings-sidebar">
                    <div class="admin-sidebar-header">
                        <div class="admin-sidebar-title-row">
                            <span class="admin-sidebar-title">League Settings</span>
                            <span class="admin-sidebar-badge">${isFounderInspection ? 'Founder' : 'Admin'}</span>
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

                            <a href="#admin-sec-season-convention" class="admin-nav-item" data-section="admin-sec-season-convention">
                                <span class="admin-nav-item-title">Season Convention</span>
                                <span class="admin-nav-item-sub">Draft vs Championship Year</span>
                            </a>

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

                            <a href="#admin-sec-sync" class="admin-nav-item" data-section="admin-sec-sync">
                                <span class="admin-nav-item-title">Provider &amp; Weekly Sync</span>
                                <span class="admin-nav-item-sub">Credentials, Privacy, Sync Status</span>
                            </a>
                        </div>
                    </nav>
                </aside>

                <!-- Main Settings Content Area -->
                <main class="admin-main-content">

                <!-- Founder Inspection Mode Banner -->
                ${isFounderInspection ? `
                    <div class="admin-founder-banner">
                        <div style="flex: 1; min-width: 260px;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="font-weight: 800; font-size: 0.85rem; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px;">Founder Inspection Mode (Read-Only)</span>
                                <span style="background: #fef3c7; color: #92400e; font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; border: 1px solid #fde68a;">Viewing All Settings &amp; Member Accounts</span>
                            </div>
                            <p style="margin: 0; font-size: 0.86rem; color: var(--text-secondary); line-height: 1.45;">
                                You are inspecting this vault as the platform founder. All commissioner configurations, custom rules, member claims, and user accounts are visible exactly as they exist, with editing actions disabled to protect league data.
                            </p>
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.78rem; font-weight: 700; color: #64748b; background: #ffffff; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1;">Admin: ${adminEmail || 'Commissioner'}</span>
                        </div>
                    </div>
                ` : ''}

                <!-- Retrospective Admin Self-Claim Card (If Admin Has No Claimed Profile) -->
                ${!currentAdminClaim ? `
                    <div class="card admin-section-card" style="margin-top: 1.5rem; background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; padding: 1.25rem 1.5rem; border-radius: 8px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                            <div>
                                <div style="font-size: 0.82rem; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">Claim Your Manager Profile (League Admin)</div>
                                <p style="font-size: 0.88rem; color: #78350f; margin: 0; line-height: 1.45;">
                                    You are currently administering this league as <strong>${session?.email || 'Admin'}</strong>, but haven't linked your manager profile yet. Select your team to track your personal career stats, win/loss records, and head-to-head history.
                                </p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                <select id="admin-self-claim-select" class="admin-select" style="min-width: 170px; padding: 6px 10px; font-size: 0.85rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff;">
                                    <option value="">-- Select Your Team --</option>
                                    ${unclaimedOptions}
                                </select>
                                <select id="admin-self-claim-nfl" class="admin-select" title="Favorite NFL Team (trust us, this will be important later)" style="min-width: 170px; padding: 6px 10px; font-size: 0.85rem; font-weight: 600; border-radius: 4px; border: 1px solid #cbd5e1; background: #fff;">
                                    <option value="">-- Favorite NFL Team --</option>
                                    ${(window.renderNflTeamSelectOptions ? window.renderNflTeamSelectOptions(session?.favorite_team) : '')}
                                </select>
                                <button id="btn-admin-self-claim" class="btn-primary" style="padding: 7px 14px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer; white-space: nowrap;">Claim Profile</button>
                            </div>
                        </div>
                        <div id="admin-self-claim-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>
                ` : ''}

                <!-- Provider Auth / Privacy Warning Card -->
                ${isAuthRequired ? `
                    <div class="card admin-section-card" style="margin-top: 1.5rem; background: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; padding: 1.25rem 1.5rem; border-radius: 8px;">
                        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                            <div style="flex: 1; min-width: 260px;">
                                <div style="font-size: 0.82rem; font-weight: 800; color: #be123c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">
                                    Weekly Stats Sync Paused: League Privacy Changed
                                </div>
                                <p style="font-size: 0.88rem; color: #881337; margin: 0 0 6px 0; line-height: 1.45;">
                                    Automated weekly updates are temporarily paused because your league on <strong>${currentPlatform.toUpperCase()}</strong> appears to have been switched to <strong>Private</strong>, or your host authorization expired.
                                </p>
                                <p style="font-size: 0.82rem; color: #9f1239; margin: 0;">
                                    Please provide your private credentials in the Provider &amp; Weekly Sync section below so weekly matchups and stats can resume syncing automatically.
                                </p>
                            </div>
                            <a href="#admin-sec-sync" class="btn" style="background: #e11d48; color: #fff; padding: 8px 16px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; text-decoration: none; white-space: nowrap;">Update Credentials</a>
                        </div>
                    </div>
                ` : ''}

                <!-- 1. IDENTITY & CUSTOMIZATION -->
                <div id="admin-sec-identity" class="card admin-section-card" style="margin-top: 1.5rem;">
                    <div class="admin-card-header">
                        <div>
                            <h2>League Identity &amp; Customization</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Customize your official masthead title, custom URL slug, and subtitle motto.</p>
                        </div>
                    </div>

                    <!-- Note from Landon for Tagline Customization -->
                    <div style="margin-top: 1rem; background: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #d97706; padding: 1rem 1.25rem; border-radius: 6px;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.25rem;">A Note from the Founder, Landon</div>
                        <p style="font-size: 0.88rem; color: #78350f; line-height: 1.5; margin: 0;">
                            Hey, this is one of the first points of customization for your league. Feel free to make the league tagline a tradition, as maybe the champion gets to create the tagline for the next year! That's something you as the admin have control of. I've included below some sample taglines that I came up with in a quick brainstorm, and I'll keep adding more, but feel free to make one up on your own as well.
                        </p>
                    </div>

                    <!-- Custom League Title -->
                    <div style="margin-top: 1.25rem;">
                        <label for="admin-league-title-input" style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: var(--text-secondary);">Custom League Title:</label>
                        <div class="tagline-input-row">
                            <input type="text" id="admin-league-title-input" class="admin-input" value="${leagueName}" placeholder="e.g. Ironclad Dynasty League HQ" ${isFounderInspection ? 'disabled style="background: #f8fafc; cursor: not-allowed;"' : ''}>
                            <button id="btn-save-league-title" class="btn-primary" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 10px 18px; font-weight: 700; border-radius: 4px; white-space: nowrap; opacity: 0.5; cursor: not-allowed;"' : 'style="padding: 10px 18px; font-weight: 700; border-radius: 4px; white-space: nowrap; cursor: pointer;"'}>Save Title</button>
                        </div>
                        <div id="title-save-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.5rem;"></div>
                    </div>

                    <!-- Custom League URL Slug -->
                    <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
                        <label for="admin-league-slug-input" style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; color: var(--text-secondary);">Custom League URL Slug:</label>
                        <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0 0 8px 0; line-height: 1.45;">
                            You can only change this once every 30 days. Once you click save, you will be immediately redirected to the new URL, and the previous URL will no longer work.
                        </p>
                        ${slugDaysRemaining > 0 ? `
                            <div style="margin-bottom: 8px; font-size: 0.82rem; color: #b45309; background: #fffbeb; border: 1px solid #fef3c7; padding: 6px 10px; border-radius: 4px; font-weight: 600;">
                                Slug last changed ${new Date(lastSlugChange).toLocaleDateString()}. You can change it again in ${slugDaysRemaining} day(s).
                            </div>
                        ` : ''}
                        <div class="tagline-input-row">
                            <div style="display: flex; align-items: center; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 4px; padding-left: 10px; flex: 1;">
                                <span style="color: var(--text-muted); font-size: 0.85rem; font-family: monospace;">thefantasyvault.com/</span>
                                <input type="text" id="admin-league-slug-input" class="admin-input" value="${leagueSlug}" placeholder="your-league" ${isFounderInspection ? 'disabled style="border: none; background: transparent; padding-left: 2px; cursor: not-allowed;"' : 'style="border: none; background: transparent; padding-left: 2px;"'}>
                            </div>
                            <button id="btn-save-league-slug" class="btn-primary" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 10px 18px; font-weight: 700; border-radius: 4px; white-space: nowrap; opacity: 0.5; cursor: not-allowed;"' : 'style="padding: 10px 18px; font-weight: 700; border-radius: 4px; white-space: nowrap; cursor: pointer;"'}>Save URL</button>
                        </div>
                        <div id="slug-save-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.5rem;"></div>
                    </div>

                    <!-- Custom League Tagline / Motto -->
                    <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
                        <label for="admin-tagline-input" style="display: block; font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; color: var(--text-secondary);">League Tagline / Subtitle Motto:</label>
                        <div class="tagline-presets-wrapper">
                            <button type="button" class="btn-tagline-preset" data-preset="Variance is an excuse for incompetence" ${isFounderInspection ? 'disabled' : ''}>"Variance is an excuse for incompetence"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Landon is the greatest fantasy player of all time" ${isFounderInspection ? 'disabled' : ''}>"Landon is the greatest fantasy player of all time"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Fantasy in name only" ${isFounderInspection ? 'disabled' : ''}>"Fantasy in name only"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="Inside joke" ${isFounderInspection ? 'disabled' : ''}>"Inside joke"</button>
                            <button type="button" class="btn-tagline-preset" data-preset="In a league of our own" ${isFounderInspection ? 'disabled' : ''}>"In a league of our own"</button>
                        </div>
                        <div class="tagline-input-row">
                            <input type="text" id="admin-tagline-input" class="admin-input" value="${currentTagline}" placeholder="Enter your league's custom motto or tagline..." ${isFounderInspection ? 'disabled style="background: #f8fafc; cursor: not-allowed;"' : ''}>
                            <button id="btn-save-tagline" class="btn-primary" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 10px 18px; font-weight: 700; border-radius: 4px; white-space: nowrap; opacity: 0.5; cursor: not-allowed;"' : 'style="padding: 10px 18px; font-weight: 700; border-radius: 4px; white-space: nowrap; cursor: pointer;"'}>Save Tagline</button>
                        </div>
                        <div id="tagline-save-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.5rem;"></div>
                    </div>
                </div>

                <!-- 2. LEAGUE NICKNAMES CUSTOMIZATION -->
                <div id="admin-sec-nicknames" class="card admin-section-card" style="margin-top: 2rem;">
                    <div class="admin-card-header">
                        <div>
                            <h2>League Nicknames Customization</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Enable or disable custom manager nicknames across your league archive.</p>
                        </div>
                    </div>
                    <div style="margin-top: 1.25rem; padding: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
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
                            <button id="btn-toggle-nicknames" class="btn" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; border: none; background: #94a3b8; color: #fff; cursor: not-allowed; opacity: 0.7;"' : `style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; cursor: pointer; border-radius: 6px; ${allowNicknames ? 'background:#475569; color:#fff; border:none;' : 'background:var(--accent-gold, #b45309); color:#fff; border:none;'}"`}>
                                ${allowNicknames ? 'Disable League Nicknames' : 'Enable League Nicknames'}
                            </button>
                        </div>
                        <div id="nickname-toggle-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>

                    <!-- Welcome Card Home Display Toggle -->
                    <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--border-color);">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
                            <div>
                                <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; color: var(--text-primary);">
                                    Home Screen "Welcome to Archive" Card
                                </div>
                                <p style="margin: 0; font-size: 0.84rem; color: var(--text-secondary); line-height: 1.45; max-width: 650px;">
                                    When enabled, the introductory "Welcome to the Archive" card is displayed on the home page. You can permanently remove it for all league members once the league is established.
                                </p>
                            </div>
                            <button id="btn-toggle-welcome-card" class="btn" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; border: none; background: #94a3b8; color: #fff; cursor: not-allowed; opacity: 0.7;"' : `style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; cursor: pointer; border-radius: 6px; ${isWelcomeHidden ? 'background:var(--accent-gold, #b45309); color:#fff; border:none;' : 'background:#dc2626; color:#fff; border:none;'}"`}>
                                ${isWelcomeHidden ? 'Restore Welcome Card' : 'Remove from Home Screen'}
                            </button>
                        </div>
                        <div id="welcome-toggle-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>
                </div>

                <!-- 3. COMMISSIONER NOTES & LEAGUE UPDATES -->
                <div id="admin-sec-notes" class="card admin-section-card" style="margin-top: 2rem;">
                    <!-- Populated by CommissionerNotesEngine -->
                </div>

                <!-- 4. POWER RANKINGS & PUBLISHING PERMISSIONS -->
                <div id="admin-sec-power-rankings" class="card admin-section-card" style="margin-top: 2rem;">
                    <!-- Populated by PowerRankingsEngine -->
                </div>

                <!-- SEASON YEAR LABEL CONVENTION -->
                <div id="admin-sec-season-convention" class="card admin-section-card" style="margin-top: 2rem;">
                    <div class="admin-card-header">
                        <div>
                            <h2>Season Year Label Convention</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Configure how your league historically numbers and displays each season.</p>
                        </div>
                    </div>
                    <div style="margin-top: 1.25rem; padding: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
                        <p style="font-size: 0.86rem; color: var(--text-secondary); line-height: 1.5; margin: 0 0 1rem 0;">
                            Select the numbering system for your league's seasons across all pages, Head-to-Head records, Draft Central, and the Record Book:
                        </p>
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                            <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: ${this.isChampionshipYearConvention ? 'transparent' : 'rgba(226, 183, 20, 0.08)'};">
                                <input type="radio" name="admin-season-convention" value="kickoff" ${!this.isChampionshipYearConvention ? 'checked' : ''} style="margin-top: 3px;">
                                <div>
                                    <strong style="display: block; font-size: 0.92rem; color: var(--text-primary);">Year of the Draft (Default)</strong>
                                    <span style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; display: block;">Seasons are labeled by the calendar year the draft took place (e.g. Fall 2024 draft is labeled "2024 Season").</span>
                                </div>
                            </label>
                            <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer; padding: 10px 12px; border: 1px solid var(--border-color); border-radius: 6px; background: ${this.isChampionshipYearConvention ? 'rgba(226, 183, 20, 0.08)' : 'transparent'};">
                                <input type="radio" name="admin-season-convention" value="championship" ${this.isChampionshipYearConvention ? 'checked' : ''} style="margin-top: 3px;">
                                <div>
                                    <strong style="display: block; font-size: 0.92rem; color: var(--text-primary);">Year of the Championship</strong>
                                    <span style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.4; display: block;">Seasons are labeled by the calendar year the champion is crowned in January (e.g. Fall 2024 draft is labeled "2025 Champion").</span>
                                </div>
                            </label>
                        </div>
                        <div style="margin-top: 1rem; display: flex; align-items: center; justify-content: flex-end; gap: 10px;">
                            <button id="btn-save-season-convention" class="btn-primary" style="padding: 8px 18px; font-weight: 700; border-radius: 4px; cursor: pointer;">Save Convention</button>
                        </div>
                        <div id="season-convention-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>
                </div>

                <!-- 3. LEAGUE LOSER CONDITIONS -->
                <div id="admin-sec-loser" class="card admin-section-card" style="margin-top: 2rem;">
                    <div class="admin-card-header">
                        <div>
                            <h2>League Loser Conditions</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Configure the exact timing, pool, and ordered criteria that determine the outright loser for each season.</p>
                        </div>
                    </div>

                    <div style="margin-top: 1.25rem;">
                        <!-- Season Selector & Current Loser Display -->
                        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 1.25rem; margin-bottom: 1.25rem;">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem;">
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <label for="admin-loser-season-select" style="font-weight: 700; font-size: 0.85rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Select Season:</label>
                                    <select id="admin-loser-season-select" class="admin-select" style="min-width: 150px; padding: 6px 12px; font-weight: 700; font-size: 0.9rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); cursor: pointer;">
                                        ${seasonOptions}
                                    </select>
                                </div>
                                <div id="admin-loser-active-pill" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(212, 175, 55, 0.12); border: 1px solid rgba(212, 175, 55, 0.35); padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; color: #b45309;">
                                    <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #b45309;"></span>
                                    <span id="admin-loser-rule-label">Custom Loser Condition</span>
                                </div>
                            </div>

                            <!-- Current Rule & Calculated Loser Box -->
                            <div id="admin-loser-current-card" style="background: var(--bg-card); border: 1px solid var(--border-color); border-left: 4px solid var(--accent-gold, #d4af37); border-radius: 6px; padding: 1rem 1.25rem;">
                                <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                                    <div>
                                        <div style="font-size: 0.76rem; font-weight: 800; color: #b45309; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Current Season Rule &amp; Result</div>
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
                                <button type="button" class="btn-loser-preset" data-preset="standard" ${isFounderInspection ? 'disabled' : ''}>12th Place Bracket (Standard)</button>
                                <button type="button" class="btn-loser-preset" data-preset="full_least_pts" ${isFounderInspection ? 'disabled' : ''}>Outright Least Pts (Full Season)</button>
                                <button type="button" class="btn-loser-preset" data-preset="reg_least_pts" ${isFounderInspection ? 'disabled' : ''}>Least Pts (Regular Season)</button>
                                <button type="button" class="btn-loser-preset" data-preset="worst_record_pts" ${isFounderInspection ? 'disabled' : ''}>Worst Record, Tiebreak Least Pts</button>
                                <button type="button" class="btn-loser-preset" data-preset="non_playoff_least_pts" ${isFounderInspection ? 'disabled' : ''}>Non-Playoff Fewest Pts</button>
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
                                    <select id="admin-loser-scope" class="admin-select" ${isFounderInspection ? 'disabled style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: #f8fafc; color: var(--text-primary); cursor: not-allowed;"' : 'style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);"'}>
                                        <option value="bracket_playoffs">Playoff Bracket / Consolation Rank</option>
                                        <option value="full_season">Full Season (Regular Season + Playoffs Combined)</option>
                                        <option value="regular_season">Regular Season Only (Weeks 1–14/15)</option>
                                    </select>
                                </div>

                                <!-- 2. Candidate Pool -->
                                <div>
                                    <label for="admin-loser-pool" style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">2. Eligible Team Pool:</label>
                                    <select id="admin-loser-pool" class="admin-select" ${isFounderInspection ? 'disabled style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: #f8fafc; color: var(--text-primary); cursor: not-allowed;"' : 'style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);"'}>
                                        <option value="all_teams">All 12 League Members Outright</option>
                                        <option value="non_playoff_teams">Non-Playoff Teams (Bottom 6 Missed Playoffs)</option>
                                        <option value="bracket_consolation">Consolation Bracket Teams</option>
                                    </select>
                                </div>

                                <!-- 3. Primary Condition -->
                                <div>
                                    <label for="admin-loser-crit1" style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">3. Primary Condition (1st Order):</label>
                                    <select id="admin-loser-crit1" class="admin-select" ${isFounderInspection ? 'disabled style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: #f8fafc; color: var(--text-primary); cursor: not-allowed;"' : 'style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);"'}>
                                        <option value="least_points">Least Points Scored (Lowest PF)</option>
                                        <option value="worst_record">Worst Record / Win Percentage</option>
                                        <option value="final_rank">Bracket Placement (12th Place)</option>
                                        <option value="most_points_against">Most Points Against (Highest PA)</option>
                                    </select>
                                </div>

                                <!-- 4. Secondary Tiebreaker -->
                                <div>
                                    <label for="admin-loser-crit2" style="display: block; font-size: 0.8rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 6px;">4. First Tiebreaker (2nd Order):</label>
                                    <select id="admin-loser-crit2" class="admin-select" ${isFounderInspection ? 'disabled style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: #f8fafc; color: var(--text-primary); cursor: not-allowed;"' : 'style="width: 100%; padding: 8px 10px; font-size: 0.86rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary);"'}>
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
                                    <input type="checkbox" id="admin-loser-manual-toggle" ${isFounderInspection ? 'disabled' : ''} style="cursor: pointer;">
                                    Manually Designate Specific Manager as Loser (Custom Punishment / Exception)
                                </label>

                                <div id="admin-loser-manual-fields" style="display: none; margin-top: 10px; padding: 12px; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px;">
                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                                        <div>
                                            <label for="admin-loser-manual-mgr" style="display: block; font-size: 0.78rem; font-weight: 700; margin-bottom: 4px; color: var(--text-secondary);">Select Designated Manager:</label>
                                            <select id="admin-loser-manual-mgr" class="admin-select" ${isFounderInspection ? 'disabled style="width: 100%; padding: 6px 10px; font-size: 0.85rem; border-radius: 4px; border: 1px solid var(--border-color); background: #f8fafc; color: var(--text-primary); cursor: not-allowed;"' : 'style="width: 100%; padding: 6px 10px; font-size: 0.85rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-surface); color: var(--text-primary);"'}>
                                                <option value="">-- Choose Manager --</option>
                                                ${managerOptions}
                                            </select>
                                        </div>
                                        <div>
                                            <label for="admin-loser-manual-reason" style="display: block; font-size: 0.78rem; font-weight: 700; margin-bottom: 4px; color: var(--text-secondary);">Custom Reason / Punishment Details:</label>
                                            <input type="text" id="admin-loser-manual-reason" class="admin-input" placeholder="e.g. Lost custom Week 17 Sacko punishment match" ${isFounderInspection ? 'disabled style="width: 100%; padding: 6px 10px; font-size: 0.85rem; border-radius: 4px; border: 1px solid var(--border-color); background: #f8fafc; box-sizing: border-box; cursor: not-allowed;"' : 'style="width: 100%; padding: 6px 10px; font-size: 0.85rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-surface); box-sizing: border-box;"'}>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Live Dynamic Preview of Calculated Loser -->
                            <div style="background: rgba(15, 23, 42, 0.03); border: 1px dashed var(--border-color); border-radius: 6px; padding: 12px 16px; margin-bottom: 1.25rem;">
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                                    <div>
                                        <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Live Preview (Result of Current Form Settings)</div>
                                        <div id="admin-loser-preview-text" style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
                                            <span id="admin-loser-preview-label">Projected Loser:</span> <span style="color: #dc2626;" id="admin-loser-preview-name">Calculating...</span>
                                        </div>
                                        <div id="admin-loser-preview-stats" style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 2px;"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <button id="btn-save-loser-condition" class="btn-primary" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; white-space: nowrap; opacity: 0.5; cursor: not-allowed;"' : 'style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; cursor: pointer; white-space: nowrap;"'}>
                                    Save Rule for <span id="btn-loser-save-year-label">Selected Season</span>
                                </button>
                                <button id="btn-apply-future-loser-conditions" class="btn btn-gold" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; white-space: nowrap; opacity: 0.5; cursor: not-allowed;"' : 'style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; cursor: pointer; white-space: nowrap;"'}>
                                    Apply Rule as Future Default
                                </button>
                                <button id="btn-apply-all-loser-conditions" class="btn btn-secondary-action" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; white-space: nowrap; opacity: 0.5; cursor: not-allowed;"' : 'style="padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; cursor: pointer; white-space: nowrap;"'}>
                                    Apply Rule to All Seasons (Past &amp; Future)
                                </button>
                                <button id="btn-reset-loser-condition" class="btn" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 9px 16px; font-weight: 600; font-size: 0.82rem; border-radius: 6px; white-space: nowrap; background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); opacity: 0.5; cursor: not-allowed;"' : 'style="padding: 9px 16px; font-weight: 600; font-size: 0.82rem; border-radius: 6px; cursor: pointer; white-space: nowrap; background: transparent; border: 1px solid var(--border-color); color: var(--text-muted);"'}>
                                    Reset to Standard (12th Place)
                                </button>
                            </div>
                            <div id="loser-condition-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                        </div>
                    </div>
                </div>

                <!-- 4. PRIVACY & ACCESS CONTROL -->
                <div id="admin-sec-privacy" class="card admin-section-card" style="margin-top: 2rem;">
                    <div class="admin-card-header">
                        <div>
                            <h2>League Privacy &amp; Access Control</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Control whether your archive is publicly readable or restricted to signed-in league members.</p>
                        </div>
                    </div>
                    <div style="margin-top: 1.25rem; padding: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                    <strong style="font-size: 1rem; color: var(--text-primary);">Vault Access:</strong>
                                    <span id="admin-privacy-badge" style="display: inline-block; font-size: 0.78rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; ${isPrivate ? 'background:#fee2e2; color:#dc2626;' : 'background:#dcfce7; color:#15803d;'}">
                                        ${isPrivate ? 'Private (Invite &amp; SSO Guarded)' : 'Public (Open Link Access)'}
                                    </span>
                                </div>
                                <p id="admin-privacy-desc" style="margin: 0; font-size: 0.84rem; color: var(--text-muted); line-height: 1.45; max-width: 600px;">
                                    ${isPrivate 
                                        ? 'Private vaults require managers to be logged in to view your archive, draft records, and record books.' 
                                        : 'Public vaults allow anyone with your league link to explore your history, record books, and draft analysis.'}
                                </p>
                            </div>
                            <button id="btn-toggle-privacy" class="btn" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 8px 16px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; border: none; background: #94a3b8; color: #fff; cursor: not-allowed; opacity: 0.7;"' : `style="padding: 8px 16px; font-weight: 700; font-size: 0.85rem; cursor: pointer; border-radius: 6px; ${isPrivate ? 'background:#15803d; color:#fff; border:none;' : 'background:#475569; color:#fff; border:none;'}"`}>
                                ${isPrivate ? 'Make League Public' : 'Make League Private'}
                            </button>
                        </div>
                        <div id="privacy-toggle-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>
                </div>

                <!-- 5. REGISTERED MEMBERS & MANAGER ROSTER -->
                <div id="admin-sec-roster" class="card admin-section-card" style="margin-top: 2rem;">
                    <div class="admin-card-header">
                        <div>
                            <h2>League Members Roster</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Manage manager display names, copy personalized claim links, and view registered member accounts.</p>
                        </div>
                    </div>

                    <div style="margin-top: 1.25rem;">
                        <div class="manager-roster-filters" style="display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 0.85rem; flex-wrap: wrap;">
                            <div style="display: inline-flex; align-items: center; gap: 4px; background: var(--bg-surface, #f1f5f9); padding: 3px; border-radius: 9999px; border: 1px solid var(--border-color);">
                                <button type="button" class="btn-roster-filter active" data-filter="all" style="padding: 5px 14px; font-size: 0.78rem; font-weight: 700; border-radius: 9999px; border: none; background: var(--text-primary); color: #fff; cursor: pointer; transition: all 0.15s ease;">
                                    All (${sortedMembers.length})
                                </button>
                                <button type="button" class="btn-roster-filter" data-filter="active" style="padding: 5px 14px; font-size: 0.78rem; font-weight: 700; border-radius: 9999px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; transition: all 0.15s ease;">
                                    Active (${activeMembers.length})
                                </button>
                                <button type="button" class="btn-roster-filter" data-filter="inactive" style="padding: 5px 14px; font-size: 0.78rem; font-weight: 700; border-radius: 9999px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; transition: all 0.15s ease;">
                                    Inactive (${inactiveMembers.length})
                                </button>
                            </div>
                            <div style="font-size: 0.78rem; color: var(--text-muted); font-weight: 500;">
                                Showing <strong>${activeMembers.length} active</strong>, <strong>${inactiveMembers.length} inactive</strong>
                            </div>
                        </div>

                        <div class="admin-table-scroll">
                            <table class="admin-table">
                                <thead>
                                    <tr>
                                        <th style="width: 45%;">Manager Display Name</th>
                                        <th style="width: 20%;">Active Seasons</th>
                                        <th style="width: 35%;">Account &amp; Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="manager-roster-tbody">
                                    ${managerRows}
                                </tbody>
                            </table>
                        </div>
                        <div id="manager-rename-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>

                    <!-- Merge Historical Managers Sub-block -->
                    <div class="admin-merge-box" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border-color);">
                        <h3 style="font-size: 1rem; font-weight: 700; margin-top: 0; margin-bottom: 0.35rem; color: #991B1B;">
                            Merge Historical Manager Profiles
                        </h3>
                        <p style="color: var(--text-secondary); font-size: 0.82rem; margin-bottom: 0.85rem; line-height: 1.45;">
                            If an owner played under different accounts or aliases in past seasons, select their old profile to absorb it into their primary active profile. All matchup histories, championships, and statistics will be transferred.
                        </p>

                        <div class="admin-merge-controls">
                            <div class="merge-select-group">
                                <label for="merge-source-mgr">Source Profile (Old / Duplicate):</label>
                                <select id="merge-source-mgr" class="admin-select" ${isFounderInspection ? 'disabled style="background:#f8fafc; cursor:not-allowed;"' : ''}>
                                    <option value="">-- Select Source Profile --</option>
                                    ${managerOptions}
                                </select>
                            </div>
                            <div class="merge-arrow">➔</div>
                            <div class="merge-select-group">
                                <label for="merge-target-mgr">Target Profile (Primary / Active):</label>
                                <select id="merge-target-mgr" class="admin-select" ${isFounderInspection ? 'disabled style="background:#f8fafc; cursor:not-allowed;"' : ''}>
                                    <option value="">-- Select Target Profile --</option>
                                    ${managerOptions}
                                </select>
                            </div>
                            <button id="btn-run-merge" class="btn btn-danger" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="padding: 9px 16px; font-weight: 700; height: 38px; border-radius: 4px; white-space: nowrap; opacity: 0.5; cursor: not-allowed;"' : 'style="padding: 9px 16px; font-weight: 700; height: 38px; border-radius: 4px; white-space: nowrap; cursor: pointer;"'}>Merge Profiles</button>
                        </div>
                        <div id="manager-merge-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                    </div>
                </div>

                <!-- 6. LEAGUE INVITES & ACCESS -->
                <div id="admin-sec-invites" class="card admin-section-card" style="margin-top: 2rem;">
                    <div class="admin-card-header">
                        <div>
                            <h2>League Invites &amp; Access Control</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Share your official join code and direct invite links with league members to grant them access to this vault.</p>
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
                        <div class="admin-invite-box" style="grid-column: span 2;">
                            <span class="invite-label">General League Invite Link:</span>
                            <div class="invite-value-row" style="flex-direction: column; align-items: stretch; gap: 8px;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span class="invite-link-text">${joinLink}</span>
                                    <button class="btn-copy-action btn-sm" data-copy="${joinLink}">Copy Invite Link</button>
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
                <div id="admin-sec-transfer" class="card admin-section-card" style="margin-top: 2rem;">
                    <div class="admin-card-header">
                        <div>
                            <h2>Transfer Admin Status</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Transfer official ownership and commissioner control of this league archive to another manager.</p>
                        </div>
                    </div>
                    <div style="margin-top: 1.25rem; padding: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
                        <div style="margin-bottom: 1rem; padding: 0.75rem 1rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
                            <span style="font-size: 0.85rem; color: var(--text-secondary);">Current Commissioner Account:</span>
                            <code style="font-size: 0.88rem; font-weight: 700; color: #b45309; font-family: monospace;">${adminEmail || 'Not configured'}</code>
                        </div>
                        <p style="font-size: 0.88rem; color: var(--text-secondary); line-height: 1.5; margin: 0 0 1rem 0;">
                            Need to pass commissioner duties to another league member? You can invite a manager to take over admin status by email or by copying an admin transfer link. When they accept and sign in, full commissioner permissions will be transferred to their account.
                        </p>
                        <button id="btn-open-transfer-admin-modal" class="btn" ${isFounderInspection ? 'disabled title="Disabled in Founder Inspection Mode" style="background: #cbd5e1; color: #64748b; padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; cursor: not-allowed; border: none;"' : 'style="background: #b45309; color: #fff; padding: 9px 18px; font-weight: 700; font-size: 0.85rem; border-radius: 6px; cursor: pointer; border: none;"'}>Transfer Admin Status</button>
                    </div>
                </div>

                <!-- 8. PROVIDER CONNECTION & WEEKLY SYNC -->
                <div id="admin-sec-sync" class="card admin-section-card" style="margin-top: 2rem;">
                    <div class="admin-card-header">
                        <div>
                            <h2>Provider Connection &amp; Weekly Sync</h2>
                            <p style="color: var(--text-muted); font-size: 0.88rem; margin: 0;">Manage your active fantasy host connection, private credentials, and automated weekly updates.</p>
                        </div>
                    </div>
                    <div style="margin-top: 1.25rem; padding: 1.25rem; background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;">
                        <!-- Status Row -->
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                    <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-secondary);">Active Current Platform:</span>
                                    <span style="display: inline-block; font-size: 0.78rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: rgba(212, 175, 55, 0.15); color: #b45309; text-transform: uppercase;">
                                        ${currentPlatform}
                                    </span>
                                </div>
                                <div style="font-size: 0.82rem; color: var(--text-muted);">
                                    Sync Status: 
                                    <span style="font-weight: 700; color: ${isAuthRequired ? '#dc2626' : '#15803d'};">
                                        ${isAuthRequired ? 'Sync Paused (Credentials Required)' : 'Active &amp; In-Season Syncing'}
                                    </span>
                                    ${lastSynced !== 'Not synced yet' ? ` &bull; Last Synced: ${new Date(lastSynced).toLocaleDateString()}` : ''}
                                </div>
                            </div>
                            ${isAuthRequired ? `
                                <span style="display: inline-block; font-size: 0.76rem; font-weight: 800; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 4px 10px; border-radius: 6px;">
                                    Attention Required
                                </span>
                            ` : `
                                <span style="display: inline-block; font-size: 0.76rem; font-weight: 800; background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 4px 10px; border-radius: 6px;">
                                    Sync Healthy
                                </span>
                            `}
                        </div>

                        <!-- Historical multi-platform notice -->
                        <div style="margin-bottom: 1.25rem; padding: 0.85rem 1rem; background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px;">
                            <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 2px;">Multi-Platform Historical Support:</div>
                            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted); line-height: 1.45;">
                                If your league previously existed on other platforms (such as ESPN or Sleeper) before moving to ${currentPlatform.toUpperCase()}, those historical seasons remain permanently archived in your vault. Weekly automated synchronization pulls exclusively from your active platform for the current season.
                            </p>
                        </div>

                        ${currentPlatform === 'espn' ? `
                            <!-- ESPN Credentials Form -->
                            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem 1.25rem;">
                                <div style="font-size: 0.84rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
                                    ESPN Private League Cookies:
                                </div>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 12px 0; line-height: 1.45;">
                                    If your ESPN league is set to Private, provide your <code>espn_s2</code> and <code>SWID</code> cookie values. These are used strictly to query official matchup and roster scores.
                                </p>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px;">
                                    <div>
                                        <label for="admin-sync-espn-s2" style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">espn_s2 Cookie:</label>
                                        <input type="password" id="admin-sync-espn-s2" class="admin-input" placeholder="Paste espn_s2 value" value="${this.credentials?.s2 || ''}" ${isFounderInspection ? 'disabled style="background:#f8fafc; cursor:not-allowed;"' : ''}>
                                    </div>
                                    <div>
                                        <label for="admin-sync-espn-swid" style="display: block; font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); margin-bottom: 4px;">SWID Cookie:</label>
                                        <input type="text" id="admin-sync-espn-swid" class="admin-input" placeholder="{...}" value="${this.credentials?.swid || ''}" ${isFounderInspection ? 'disabled style="background:#f8fafc; cursor:not-allowed;"' : ''}>
                                    </div>
                                </div>
                                <button id="btn-save-sync-credentials" class="btn-primary" ${isFounderInspection ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'style="padding: 7px 16px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer;"'}>
                                    Save ESPN Credentials &amp; Resume Sync
                                </button>
                                <div id="sync-credentials-feedback" class="admin-feedback-msg" style="display: none; margin-top: 0.75rem;"></div>
                            </div>
                        ` : currentPlatform === 'yahoo' ? `
                            <!-- Yahoo Re-authorization -->
                            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem 1.25rem;">
                                <div style="font-size: 0.84rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
                                    Yahoo Fantasy Sports Connection:
                                </div>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0 0 12px 0; line-height: 1.45;">
                                    Yahoo connections use secure OAuth 2.0. If your league changed permissions or authorization expired, re-authenticate your Yahoo account below.
                                </p>
                                <button id="btn-reconnect-yahoo" class="btn" ${isFounderInspection ? 'disabled style="background:#cbd5e1; color:#64748b; cursor:not-allowed;"' : 'style="background: #6001d2; color: #fff; padding: 8px 18px; font-size: 0.82rem; font-weight: 700; border-radius: 4px; cursor: pointer; border: none;"'}>
                                    Reconnect Yahoo Account
                                </button>
                            </div>
                        ` : `
                            <!-- General / Sleeper -->
                            <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 6px; padding: 1rem 1.25rem;">
                                <div style="font-size: 0.84rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
                                    Platform ID:
                                </div>
                                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0; line-height: 1.45;">
                                    Platform ID: <code>${this.credentials?.leagueId || this.leagueSettings?.id || 'Connected'}</code>
                                </p>
                            </div>
                        `}
                    </div>
                </div>
                </main>
            </div>
        `;

        // Wire up Retrospective Admin Self-Claim
        const btnSelfClaim = container.querySelector('#btn-admin-self-claim');
        const selectSelfClaim = container.querySelector('#admin-self-claim-select');
        const selectSelfNfl = container.querySelector('#admin-self-claim-nfl');
        if (btnSelfClaim && selectSelfClaim) {
            btnSelfClaim.addEventListener('click', async () => {
                const mgrId = selectSelfClaim.value;
                if (!mgrId) {
                    alert('Please select your manager profile.');
                    return;
                }
                const favoriteTeam = selectSelfNfl?.value || '';
                if (!favoriteTeam) {
                    alert('Please select your favorite NFL team. Trust us, this will be important later.');
                    if (selectSelfNfl) selectSelfNfl.focus();
                    return;
                }
                const selectedMgr = sortedMembers.find(m => m.id === mgrId);
                btnSelfClaim.disabled = true;
                btnSelfClaim.textContent = 'Claiming...';
                try {
                    await window.AuthEngine.claimManagerProfile(leagueSlug, mgrId, selectedMgr?.name || mgrId, favoriteTeam);
                    await window.AuthEngine.linkUserLeague(leagueSlug, 'admin', leagueName);
                    const feedbackEl = document.getElementById('admin-self-claim-feedback');
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg success';
                        feedbackEl.innerHTML = `✓ Successfully linked your profile as <strong>${selectedMgr?.name || mgrId}</strong>!`;
                    }
                    setTimeout(() => { this.renderAdminDashboard(); }, 1500);
                } catch (e) {
                    console.error('Failed to self claim', e);
                    alert('Failed to link profile.');
                } finally {
                    btnSelfClaim.disabled = false;
                    btnSelfClaim.textContent = 'Claim Profile';
                }
            });
        }

        // Wire up Transfer Admin Status modal opener
        container.querySelector('#btn-open-transfer-admin-modal')?.addEventListener('click', () => {
            if (typeof window.openAdminTransferModal === 'function') {
                window.openAdminTransferModal(leagueSlug);
            }
        });

        // Wire up Season Year Label Convention saving
        const btnSaveConvention = container.querySelector('#btn-save-season-convention');
        if (btnSaveConvention) {
            btnSaveConvention.addEventListener('click', async () => {
                const checkedRadio = container.querySelector('input[name="admin-season-convention"]:checked');
                const conventionVal = checkedRadio ? checkedRadio.value : 'kickoff';
                const feedbackEl = container.querySelector('#season-convention-feedback');

                this.seasonLabelConvention = conventionVal;
                this.isChampionshipYearConvention = (conventionVal === 'championship');
                if (!this.leagueSettings) this.leagueSettings = {};
                this.leagueSettings.seasonLabelConvention = conventionVal;

                try {
                    await Promise.all([
                        update(dbRef(database, `leagues/${this.leagueSlug}/league_settings`), {
                            seasonLabelConvention: conventionVal
                        }),
                        set(dbRef(database, `leagues/${this.leagueSlug}/seasonLabelConvention`), conventionVal)
                    ]);
                } catch (e) {
                    console.warn('Could not save season convention to Firebase:', e);
                }

                if (feedbackEl) {
                    feedbackEl.style.display = 'block';
                    feedbackEl.className = 'admin-feedback-msg success';
                    feedbackEl.textContent = `✓ Saved! Season convention is now set to "${conventionVal === 'championship' ? 'Year of the Championship' : 'Year of the Draft'}".`;
                    setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                }

                this.initHeader();
                if (typeof this.renderH2H === 'function') this.renderH2H();
                if (typeof this.renderRecordBook === 'function') this.renderRecordBook();
                if (typeof this.renderParadigms === 'function') this.renderParadigms();
                if (this.draftEngine) {
                    this.draftEngine.updateData({
                        leagueSettings: this.leagueSettings,
                        seasonLabelConvention: conventionVal
                    });
                    if (this.activeTab === 'draft' || this.activeTab === 'draft-hub') {
                        this.draftEngine.render();
                    }
                }
            });
        }

        // Wire up Provider & Weekly Sync credentials saving
        const btnSaveSync = container.querySelector('#btn-save-sync-credentials');
        if (btnSaveSync) {
            btnSaveSync.addEventListener('click', async () => {
                const s2Val = container.querySelector('#admin-sync-espn-s2')?.value?.trim() || '';
                const swidVal = container.querySelector('#admin-sync-espn-swid')?.value?.trim() || '';
                btnSaveSync.disabled = true;
                btnSaveSync.textContent = 'Saving...';
                try {
                    const credRef = dbRef(database, `leagues/${leagueSlug}/credentials`);
                    await update(credRef, { s2: s2Val, swid: swidVal });
                    const statusRef = dbRef(database, `leagues/${leagueSlug}/sync_status`);
                    await update(statusRef, { status: 'healthy', updated_at: new Date().toISOString() });
                    if (this.syncStatus) this.syncStatus.status = 'healthy';
                    if (!this.credentials) this.credentials = {};
                    this.credentials.s2 = s2Val;
                    this.credentials.swid = swidVal;
                    const feedbackEl = container.querySelector('#sync-credentials-feedback');
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg success';
                        feedbackEl.innerHTML = '✓ ESPN private credentials saved. Weekly synchronization will resume on schedule.';
                    }
                    setTimeout(() => { this.renderAdminDashboard(); }, 1800);
                } catch (e) {
                    console.error('Failed to update sync credentials:', e);
                    alert('Failed to save credentials.');
                } finally {
                    btnSaveSync.disabled = false;
                    btnSaveSync.textContent = 'Save ESPN Credentials & Resume Sync';
                }
            });
        }

        const btnReconnectYahoo = container.querySelector('#btn-reconnect-yahoo');
        if (btnReconnectYahoo) {
            btnReconnectYahoo.addEventListener('click', async () => {
                try {
                    const res = await fetch(`/api/yahoo?action=auth-url&redirect_uri=${encodeURIComponent(window.location.origin + '/api/yahoo/callback')}`);
                    const data = await res.json();
                    if (data.url) {
                        window.location.href = data.url;
                    } else {
                        alert('Unable to initialize Yahoo OAuth.');
                    }
                } catch (e) {
                    alert('Error reaching Yahoo auth service: ' + e.message);
                }
            });
        }

        // Wire up Copy Claim Link buttons on manager rows
        container.querySelectorAll('.btn-copy-claim-link').forEach(btn => {
            btn.addEventListener('click', () => {
                const mgrId = btn.getAttribute('data-manager-id');
                const mgrName = btn.getAttribute('data-manager-name');
                const claimLink = `${window.location.origin}/${leagueSlug}/?action=claim_manager&manager=${encodeURIComponent(mgrId)}`;

                navigator.clipboard.writeText(claimLink).then(() => {
                    const origText = btn.textContent;
                    btn.textContent = 'Copied!';
                    btn.style.background = '#15803d';
                    btn.style.color = '#fff';
                    const feedbackEl = document.getElementById('manager-rename-feedback');
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg success';
                        feedbackEl.innerHTML = `✓ Personalized claim link for <strong>${mgrName}</strong> copied to clipboard!<br><span style="font-family: monospace; font-size: 0.8rem; color: #475569;">${claimLink}</span>`;
                        setTimeout(() => { feedbackEl.style.display = 'none'; }, 6000);
                    }
                    setTimeout(() => {
                        btn.textContent = origText;
                        btn.style.background = '';
                        btn.style.color = '';
                    }, 2500);
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
                    if (this.leagueSlug) {
                        try {
                            const claimRef = dbRef(database, `leagues/${this.leagueSlug}/claims/${mgrId}`);
                            await set(claimRef, null);
                        } catch (e) {
                            console.error('Failed to unlink claim', e);
                        }
                    }
                    this.renderAdminDashboard();
                }
            });
        });

        // Wire up Roster Active/Inactive filter pills
        container.querySelectorAll('.btn-roster-filter').forEach(pill => {
            pill.addEventListener('click', () => {
                container.querySelectorAll('.btn-roster-filter').forEach(p => {
                    p.classList.remove('active');
                    p.style.background = 'transparent';
                    p.style.color = 'var(--text-secondary)';
                });
                pill.classList.add('active');
                pill.style.background = 'var(--text-primary)';
                pill.style.color = '#fff';

                const filter = pill.getAttribute('data-filter');
                const rows = container.querySelectorAll('#manager-roster-tbody tr[data-status]');
                const headers = container.querySelectorAll('#manager-roster-tbody tr[data-status-header]');

                if (filter === 'all') {
                    rows.forEach(r => { r.style.display = ''; });
                    headers.forEach(h => { h.style.display = ''; });
                } else if (filter === 'active') {
                    rows.forEach(r => {
                        r.style.display = r.getAttribute('data-status') === 'active' ? '' : 'none';
                    });
                    headers.forEach(h => {
                        h.style.display = h.getAttribute('data-status-header') === 'active' ? '' : 'none';
                    });
                } else if (filter === 'inactive') {
                    rows.forEach(r => {
                        r.style.display = r.getAttribute('data-status') === 'inactive' ? '' : 'none';
                    });
                    headers.forEach(h => {
                        h.style.display = h.getAttribute('data-status-header') === 'inactive' ? '' : 'none';
                    });
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

        // Wire up Tagline preset buttons
        const presetBtns = container.querySelectorAll('.btn-tagline-preset');
        const taglineInput = container.querySelector('#admin-tagline-input');
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (isFounderInspection) return;
                const text = btn.getAttribute('data-preset');
                if (taglineInput && text) {
                    taglineInput.value = text;
                    taglineInput.focus();
                }
            });
        });

        // Wire up Save Title button
        const btnSaveTitle = container.querySelector('#btn-save-league-title');
        const titleInput = container.querySelector('#admin-league-title-input');
        if (btnSaveTitle && titleInput) {
            btnSaveTitle.addEventListener('click', async () => {
                if (isFounderInspection) return;
                const newTitle = titleInput.value.trim();
                if (!newTitle) {
                    alert("League title cannot be empty.");
                    return;
                }
                await this.saveLeagueTitle(newTitle);
            });
        }

        // Wire up Save URL Slug button
        const btnSaveSlug = container.querySelector('#btn-save-league-slug');
        const slugInput = container.querySelector('#admin-league-slug-input');
        if (btnSaveSlug && slugInput) {
            btnSaveSlug.addEventListener('click', async () => {
                if (isFounderInspection) return;
                const newSlug = slugInput.value.trim();
                if (!newSlug) {
                    alert("League URL slug cannot be empty.");
                    return;
                }
                await this.saveLeagueSlug(newSlug);
            });
        }

        // Wire up Save Tagline button
        const btnSaveTagline = container.querySelector('#btn-save-tagline');
        if (btnSaveTagline && taglineInput) {
            btnSaveTagline.addEventListener('click', async () => {
                if (isFounderInspection) return;
                const newTagline = taglineInput.value.trim();
                if (!newTagline) return;
                await this.saveLeagueTagline(newTagline);
            });
        }

        // Wire up Manager Rename buttons
        const renameBtns = container.querySelectorAll('.btn-save-manager-name');
        renameBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                if (isFounderInspection) return;
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
                if (isFounderInspection) return;
                const currentAllow = this.leagueSettings?.allow_nicknames !== false;
                await this.toggleLeagueNicknames(!currentAllow);
            });
        }

        // Wire up Toggle Welcome Card button
        const btnToggleWelcome = container.querySelector('#btn-toggle-welcome-card');
        if (btnToggleWelcome) {
            btnToggleWelcome.addEventListener('click', async () => {
                if (isFounderInspection) return;
                const currentHidden = Boolean(this.leagueSettings?.hide_welcome_card);
                const newHidden = !currentHidden;
                const feedbackEl = document.getElementById('welcome-toggle-feedback');
                btnToggleWelcome.disabled = true;
                try {
                    this.leagueSettings.hide_welcome_card = newHidden;
                    if (this.leagueSlug) {
                        const settingsRef = dbRef(database, `leagues/${this.leagueSlug}/league_settings`);
                        await update(settingsRef, { hide_welcome_card: newHidden });
                    }
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg success';
                        feedbackEl.innerHTML = `✓ Welcome card is now <strong>${newHidden ? 'Removed from Home Screen' : 'Visible on Home Screen'}</strong>!`;
                        setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                    }
                    this.initWelcomeCard();
                    setTimeout(() => { this.renderAdminDashboard(); }, 1200);
                } catch (e) {
                    console.error('Failed to toggle welcome card', e);
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg error';
                        feedbackEl.textContent = 'Failed to update welcome card setting.';
                    }
                } finally {
                    btnToggleWelcome.disabled = false;
                }
            });
        }

        // Wire up Toggle Privacy button
        const btnTogglePrivacy = container.querySelector('#btn-toggle-privacy');
        if (btnTogglePrivacy) {
            btnTogglePrivacy.addEventListener('click', async () => {
                if (isFounderInspection) return;
                const newPrivate = !Boolean(this.leagueSettings?.is_private);
                const feedbackEl = document.getElementById('privacy-toggle-feedback');
                btnTogglePrivacy.disabled = true;
                try {
                    this.leagueSettings.is_private = newPrivate;
                    if (this.leagueSlug) {
                        const settingsRef = dbRef(database, `leagues/${this.leagueSlug}/league_settings`);
                        await update(settingsRef, { is_private: newPrivate });
                    }
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg success';
                        feedbackEl.innerHTML = `✓ League is now <strong>${newPrivate ? 'Private' : 'Public'}</strong>!`;
                        setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
                    }
                    setTimeout(() => { this.renderAdminDashboard(); }, 1200);
                } catch (e) {
                    console.error('Failed to toggle privacy', e);
                    if (feedbackEl) {
                        feedbackEl.style.display = 'block';
                        feedbackEl.className = 'admin-feedback-msg error';
                        feedbackEl.textContent = 'Failed to update privacy setting.';
                    }
                } finally {
                    btnTogglePrivacy.disabled = false;
                }
            });
        }

        // Wire up Merge Managers button
        const btnMerge = container.querySelector('#btn-run-merge');
        const selSource = container.querySelector('#merge-source-mgr');
        const selTarget = container.querySelector('#merge-target-mgr');
        if (btnMerge && selSource && selTarget) {
            btnMerge.addEventListener('click', async () => {
                if (isFounderInspection) return;
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
                    designated_manager_name: targetMgr ? targetMgr.name : targetMid,
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
            const currentSeasonYear = activeYearsList[0]; // Largest (most recent) year
            const isCurrentSeason = yr >= currentSeasonYear;
            const loserPreviewLabel = container.querySelector('#admin-loser-preview-label');

            const formConfig = getFormConfig();
            const previewRes = calculateSeasonLoser(yr, this.standings, this.matchups, { [yr]: formConfig }, this.leagueSettings);
            if (previewRes && previewRes.manager_id) {
                const mgrName = this.getManagerName(previewRes.manager_id, previewRes.manager_name);
                const tName = previewRes.team_name ? ` (${previewRes.team_name})` : '';
                if (loserPreviewLabel) loserPreviewLabel.textContent = isCurrentSeason ? 'Projected Loser:' : 'Season Loser:';
                if (loserPreviewName) loserPreviewName.innerHTML = `<strong>${mgrName}</strong>${tName}`;
                if (loserPreviewStats) loserPreviewStats.textContent = `${previewRes.stats_summary} · ${previewRes.rule_description}`;
            } else {
                if (loserPreviewLabel) loserPreviewLabel.textContent = isCurrentSeason ? 'Projected Loser:' : 'Season Loser:';
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
                const curMgr = this.getManagerName(currentRes.manager_id, currentRes.manager_name);
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

            // Highlight active quick preset button
            container.querySelectorAll('.btn-loser-preset').forEach(btn => {
                const presetKey = btn.getAttribute('data-preset');
                let isMatch = false;
                if (presetKey === 'standard' && (activeConfig.mode === 'standard' || (activeConfig.scope === 'bracket_playoffs' && activeConfig.pool === 'bracket_consolation'))) isMatch = true;
                if (presetKey === 'full_least_pts' && activeConfig.scope === 'full_season' && activeConfig.criteria?.[0]?.type === 'least_points') isMatch = true;
                if (presetKey === 'reg_least_pts' && activeConfig.scope === 'regular_season' && activeConfig.criteria?.[0]?.type === 'least_points') isMatch = true;
                if (presetKey === 'worst_record_pts' && activeConfig.criteria?.[0]?.type === 'worst_record') isMatch = true;
                if (presetKey === 'non_playoff_least_pts' && activeConfig.pool === 'non_playoff_teams') isMatch = true;
                btn.classList.toggle('active', isMatch);
            });

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
                if (isFounderInspection) return;
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
                if (isFounderInspection) return;
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
                if (isFounderInspection) return;
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
                if (isFounderInspection) return;
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
                if (isFounderInspection) return;
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

        if (this.leagueSlug) {
            try {
                const loserRef = dbRef(database, `leagues/${this.leagueSlug}/league_settings/loser_conditions/${year}`);
                await set(loserRef, ruleConfig);
            } catch (e) {
                console.error("Failed to save loser condition to Firebase", e);
            }
        }
        if (this.precompiledBundle?.league_settings) {
            if (!this.precompiledBundle.league_settings.loser_conditions) this.precompiledBundle.league_settings.loser_conditions = {};
            this.precompiledBundle.league_settings.loser_conditions[year] = ruleConfig;
        }
    }

    async applyLoserConditionToFutureSeasons(ruleConfig) {
        if (!this.leagueSettings) this.leagueSettings = {};
        if (!this.leagueSettings.loser_conditions) this.leagueSettings.loser_conditions = {};

        this.leagueSettings.loser_conditions['default'] = ruleConfig;

        if (this.leagueSlug) {
            try {
                const defaultRef = dbRef(database, `leagues/${this.leagueSlug}/league_settings/loser_conditions/default`);
                await set(defaultRef, ruleConfig);
            } catch (e) {
                console.error("Failed to save default loser condition to Firebase", e);
            }
        }
        if (this.precompiledBundle?.league_settings) {
            if (!this.precompiledBundle.league_settings.loser_conditions) this.precompiledBundle.league_settings.loser_conditions = {};
            this.precompiledBundle.league_settings.loser_conditions['default'] = ruleConfig;
        }
    }

    async applyLoserConditionToAllSeasons(ruleConfig) {
        if (!this.leagueSettings) this.leagueSettings = {};
        if (!this.leagueSettings.loser_conditions) this.leagueSettings.loser_conditions = {};

        const distinctYears = [...new Set((this.standings || []).map(s => Number(s.year || s.season)).filter(Boolean))];
        this.leagueSettings.loser_conditions['default'] = ruleConfig;
        for (const yr of distinctYears) {
            this.leagueSettings.loser_conditions[yr] = ruleConfig;
        }

        if (this.leagueSlug) {
            try {
                const loserRef = dbRef(database, `leagues/${this.leagueSlug}/league_settings/loser_conditions`);
                await set(loserRef, this.leagueSettings.loser_conditions);
            } catch (e) {
                console.error("Failed to save loser conditions to Firebase", e);
            }
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

    async saveLeagueTitle(newTitle) {
        const feedbackEl = document.getElementById('title-save-feedback');
        const btn = document.getElementById('btn-save-league-title');
        if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

        try {
            this.leagueSettings.name = newTitle;

            // Live update header masthead immediately
            const titleEl = document.getElementById("league-title");
            if (titleEl) {
                let baseName = (newTitle || "Fantasy Football").trim();
                if (/league$/i.test(baseName)) {
                    baseName = baseName.replace(/league$/i, '').trim();
                }
                titleEl.innerHTML = `${baseName}<br>League HQ`;
            }

            document.title = `${newTitle} HQ | The Fantasy Vault`;

            const footerTextEl = document.getElementById("footer-text");
            if (footerTextEl) footerTextEl.textContent = `${newTitle} Archive`;

            const recordsHeroLeagueNameEl = document.getElementById("records-hero-league-name");
            if (recordsHeroLeagueNameEl) recordsHeroLeagueNameEl.textContent = `The ${newTitle} Record Book`;

            // Save to Firebase RTDB
            if (this.leagueSlug) {
                const settingsRef = dbRef(database, `leagues/${this.leagueSlug}/league_settings`);
                await update(settingsRef, { name: newTitle });
            }

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg success';
                feedbackEl.innerHTML = `✓ League title updated to "<strong>${newTitle}</strong>"!`;
                setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
            }
        } catch (e) {
            console.error('Failed to save league title', e);
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg error';
                feedbackEl.textContent = 'Error saving league title. Please try again.';
            }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = 'Save Title'; }
        }
    }

    async saveLeagueSlug(newSlugRaw) {
        const feedbackEl = document.getElementById('slug-save-feedback');
        const btn = document.getElementById('btn-save-league-slug');
        const cleanSlug = String(newSlugRaw || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        if (!cleanSlug || cleanSlug.length < 3) {
            alert("Custom URL slug must be at least 3 characters long (letters, numbers, hyphens).");
            return;
        }

        if (cleanSlug.length > 40) {
            alert("Custom URL slug must be 40 characters or fewer.");
            return;
        }

        if (cleanSlug === this.leagueSlug) {
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg error';
                feedbackEl.textContent = 'This is already your current league URL slug.';
                setTimeout(() => { feedbackEl.style.display = 'none'; }, 3000);
            }
            return;
        }

        const reservedSlugs = ['admin', 'api', 'auth', 'draft', 'records', 'h2h', 'login', 'signup', 'vault', 'thefantasyvault', 'dmsfantasy', 'assets', 'data', 'dist', 'node_modules'];
        if (reservedSlugs.includes(cleanSlug)) {
            alert(`The slug "${cleanSlug}" is a reserved system keyword. Please choose a different slug.`);
            return;
        }

        // 30-day rate limit check
        const lastChange = this.leagueSettings?.last_slug_change_at;
        if (lastChange) {
            const elapsedMs = Date.now() - Number(lastChange);
            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            if (elapsedMs < thirtyDaysMs) {
                const daysRemaining = Math.ceil((thirtyDaysMs - elapsedMs) / (24 * 60 * 60 * 1000));
                alert(`You can only change your custom URL slug once every 30 days.\n\nPlease wait ${daysRemaining} more day(s) before changing it again.`);
                return;
            }
        }

        // Check if new slug is already taken
        if (btn) { btn.disabled = true; btn.textContent = 'Checking availability...'; }
        try {
            const targetSnap = await get(dbRef(database, `leagues/${cleanSlug}`));
            if (targetSnap.exists()) {
                alert(`The URL slug "${cleanSlug}" is already taken by another league. Please choose a different slug.`);
                if (btn) { btn.disabled = false; btn.textContent = 'Save URL'; }
                return;
            }

            const confirmed = window.confirm(
                `Are you sure you want to change your league URL to:\nthefantasyvault.com/${cleanSlug}\n\n` +
                `IMPORTANT:\n` +
                `1. You can only change your URL slug once every 30 days.\n` +
                `2. Once saved, you will be immediately redirected to the new URL.\n` +
                `3. The old URL (thefantasyvault.com/${this.leagueSlug}) will permanently stop working.\n\n` +
                `Do you want to proceed?`
            );

            if (!confirmed) {
                if (btn) { btn.disabled = false; btn.textContent = 'Save URL'; }
                return;
            }

            if (btn) btn.textContent = 'Migrating league data...';

            // Read existing league data from RTDB
            const oldSlug = this.leagueSlug;
            const oldSnap = await get(dbRef(database, `leagues/${oldSlug}`));
            let leagueData = oldSnap.exists() ? oldSnap.val() : {};

            // Update settings in payload
            if (!leagueData.league_settings) leagueData.league_settings = {};
            leagueData.league_settings.slug = cleanSlug;
            leagueData.league_settings.last_slug_change_at = Date.now();

            // Write to new path
            await set(dbRef(database, `leagues/${cleanSlug}`), leagueData);

            // Delete old path completely so old URL will not work
            await set(dbRef(database, `leagues/${oldSlug}`), null);

            // Update local storage and cached references
            localStorage.setItem('vault_last_league', cleanSlug);
            const oldClaim = localStorage.getItem('vault_claim_' + oldSlug);
            if (oldClaim) {
                localStorage.setItem('vault_claim_' + cleanSlug, oldClaim);
                localStorage.removeItem('vault_claim_' + oldSlug);
            }

            // Update user profile leagues in Firebase if session exists
            const session = window.AuthEngine ? window.AuthEngine.getSession() : null;
            if (session && session.uid) {
                try {
                    const userSnap = await get(dbRef(database, `users/${session.uid}`));
                    if (userSnap.exists()) {
                        const uData = userSnap.val();
                        let adminLeagues = (uData.adminLeagues || []).map(s => s === oldSlug ? cleanSlug : s);
                        let joinedLeagues = (uData.joinedLeagues || []).map(s => s === oldSlug ? cleanSlug : s);
                        let claims = uData.claims || {};
                        if (claims[oldSlug]) {
                            claims[cleanSlug] = claims[oldSlug];
                            delete claims[oldSlug];
                        }
                        await update(dbRef(database, `users/${session.uid}`), {
                            adminLeagues,
                            joinedLeagues,
                            claims
                        });
                    }
                } catch (uErr) {
                    console.warn('Failed to update user league list', uErr);
                }
            }

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg success';
                feedbackEl.innerHTML = `✓ URL slug changed to <strong>${cleanSlug}</strong>! Redirecting...`;
            }

            // Immediately redirect to new URL
            setTimeout(() => {
                window.location.href = `/${encodeURIComponent(cleanSlug)}`;
            }, 800);

        } catch (e) {
            console.error('Failed to change URL slug', e);
            alert('An error occurred while updating the league URL slug. Please try again.');
            if (btn) { btn.disabled = false; btn.textContent = 'Save URL'; }
        }
    }

    async updateManagerName(managerId, newName, newNickname = null) {
        const feedbackEl = document.getElementById('manager-rename-feedback');
        try {
            const cleanName = String(newName || '').trim();
            const cleanNick = newNickname !== null ? String(newNickname).trim().slice(0, 20) : null;

            // 1. Update in-memory members
            const memberIdx = this.members.findIndex(m => m.id === managerId);
            if (memberIdx !== -1) {
                this.members[memberIdx].name = cleanName;
                this.members[memberIdx].canonical_name = cleanName;
                if (cleanNick !== null) {
                    this.members[memberIdx].nickname = cleanNick;
                }
            }

            // 2. Update in-memory managers
            const mgr = this.managers.find(m => m.id === managerId);
            if (mgr) {
                mgr.name = cleanName;
                mgr.canonical_name = cleanName;
                mgr.manager_name = cleanName;
                if (cleanNick !== null) {
                    mgr.nickname = cleanNick;
                }
            }

            // 3. Update matchups
            this.matchups.forEach(m => {
                if (m.home_manager_id === managerId || m.team_1_manager_id === managerId) {
                    m.home_manager_name = cleanName;
                    m.team_1_manager_name = cleanName;
                }
                if (m.away_manager_id === managerId || m.team_2_manager_id === managerId) {
                    m.away_manager_name = cleanName;
                    m.team_2_manager_name = cleanName;
                }
            });

            // 4. Update player stats
            this.playerStats.forEach(p => {
                if (p.manager_id === managerId) {
                    p.manager_name = cleanName;
                }
            });

            // 5. Update standings
            this.standings.forEach(s => {
                if (s.manager_id === managerId) {
                    s.manager_name = cleanName;
                }
            });

            // 6. Update draft results
            (this.draftResults || []).forEach(d => {
                if (d.manager_id === managerId || d.managerId === managerId) {
                    d.manager_name = cleanName;
                }
            });

            // 7. Update Firebase RTDB
            if (this.leagueSlug) {
                const allMembersRef = dbRef(database, `leagues/${this.leagueSlug}/members`);
                await set(allMembersRef, this.members);

                const allManagersRef = dbRef(database, `leagues/${this.leagueSlug}/managers`);
                await set(allManagersRef, this.managers);

                if (cleanNick !== null) {
                    const claimRef = dbRef(database, `leagues/${this.leagueSlug}/claims/${managerId}`);
                    await update(claimRef, { name: cleanName, nickname: cleanNick }).catch(() => {});
                }
            }

            // 8. Refresh ALL UI components across the site immediately
            this.setupH2HControls();
            this.renderH2H();
            this.initPowerRankings?.();
            if (typeof this.renderRecords === 'function') {
                this.renderRecords();
            }
            if (this.draftEngine) {
                this.draftEngine.updateData({ managers: this.managers, draftResults: this.draftResults, leagueSettings: this.leagueSettings });
                if (this.activeTab === 'draft') this.draftEngine.render();
            }
            if (this.activeTab === 'admin') {
                this.renderAdminDashboard();
            }

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg success';
                feedbackEl.innerHTML = `✓ Manager display name updated to "<strong>${cleanName}</strong>"!`;
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

    async toggleLeagueNicknames(enabled) {
        const feedbackEl = document.getElementById('nickname-toggle-feedback');
        const btn = document.getElementById('btn-toggle-nicknames');
        if (btn) { btn.disabled = true; btn.textContent = 'Updating...'; }

        try {
            this.leagueSettings.allow_nicknames = enabled;

            if (this.leagueSlug) {
                const settingsRef = dbRef(database, `leagues/${this.leagueSlug}/league_settings`);
                await update(settingsRef, { allow_nicknames: enabled });
            }

            // Live update all components
            this.setupH2HControls();
            this.renderH2H();
            this.initPowerRankings?.();
            if (typeof this.renderRecords === 'function') this.renderRecords();
            if (this.draftEngine) {
                this.draftEngine.updateData({ managers: this.managers, leagueSettings: this.leagueSettings });
                if (this.activeTab === 'draft') this.draftEngine.render();
            }

            if (this.activeTab === 'admin') {
                this.renderAdminDashboard();
            }

            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg success';
                feedbackEl.textContent = `✓ Nickname display ${enabled ? 'enabled' : 'disabled'} across your league!`;
                setTimeout(() => { feedbackEl.style.display = 'none'; }, 4000);
            }
        } catch (e) {
            console.error('Failed to toggle nicknames', e);
            if (feedbackEl) {
                feedbackEl.style.display = 'block';
                feedbackEl.className = 'admin-feedback-msg error';
                feedbackEl.textContent = 'Error updating nickname setting. Please try again.';
            }
        } finally {
            if (btn) btn.disabled = false;
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

            // 4. Reassign draft results
            (this.draftResults || []).forEach(d => {
                if (d.manager_id === sourceId || d.managerId === sourceId) {
                    d.manager_id = targetId;
                    d.managerId = targetId;
                    d.manager_name = targetName;
                    d.managerName = targetName;
                }
            });

            // 5. Reassign transactions
            (this.transactions || []).forEach(t => {
                if (t.manager_id === sourceId || t.managerId === sourceId) {
                    t.manager_id = targetId;
                    t.managerId = targetId;
                    t.manager_name = targetName;
                    t.managerName = targetName;
                }
            });

            // 6. Inherit identity mappings (platform_ids, espn_ids, aliases)
            const sourceMember = this.members.find(m => m.id === sourceId);
            if (targetMember && sourceMember) {
                if (!targetMember.platform_ids) targetMember.platform_ids = [targetMember.id];
                for (const pid of (sourceMember.platform_ids || [sourceMember.id])) {
                    if (!targetMember.platform_ids.includes(pid)) targetMember.platform_ids.push(pid);
                }
                if (!targetMember.espn_ids) targetMember.espn_ids = [targetMember.id];
                for (const eid of (sourceMember.espn_ids || [])) {
                    if (!targetMember.espn_ids.includes(eid)) targetMember.espn_ids.push(eid);
                }
                if (!targetMember.aliases) targetMember.aliases = [targetMember.name];
                if (sourceMember.name && !targetMember.aliases.includes(sourceMember.name)) {
                    targetMember.aliases.push(sourceMember.name);
                }
                for (const a of (sourceMember.aliases || [])) {
                    if (!targetMember.aliases.includes(a)) targetMember.aliases.push(a);
                }
            }

            // 7. Remove source from members
            this.members = this.members.filter(m => m.id !== sourceId);
            this.managers = this.managers.filter(m => m.id !== sourceId);

            // 8. Save updated datasets to Firebase RTDB
            if (this.leagueSlug) {
                const membersRef = dbRef(database, `leagues/${this.leagueSlug}/members`);
                const matchupsRef = dbRef(database, `leagues/${this.leagueSlug}/matchups`);
                const standingsRef = dbRef(database, `leagues/${this.leagueSlug}/league_standings`);
                const playerStatsRef = dbRef(database, `leagues/${this.leagueSlug}/weekly_player_stats`);

                await set(membersRef, this.members);
                await set(matchupsRef, this.matchups);
                await set(standingsRef, this.standings);
                await set(playerStatsRef, this.playerStats);

                if (this.draftResults && this.draftResults.length > 0) {
                    await set(dbRef(database, `leagues/${this.leagueSlug}/draft_results`), this.draftResults);
                }
                if (this.transactions && this.transactions.length > 0) {
                    await set(dbRef(database, `leagues/${this.leagueSlug}/transactions`), this.transactions);
                }
            }

            // 9. Refresh UI & sub-engines
            this.setupH2HControls();
            this.renderAdminDashboard();
            if (this.recordBook && typeof this.recordBook.init === 'function') {
                this.recordBook.init();
            }
            if (this.draftEngine && typeof this.draftEngine.updateData === 'function') {
                this.draftEngine.updateData({ managers: this.managers, draftResults: this.draftResults, leagueSettings: this.leagueSettings });
            }

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

