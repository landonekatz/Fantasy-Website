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
    }

    async init() {
        this.setupFounderControlBar();
        this.setupThemeToggle();
        await this.loadData();
        this.setupNavigation();
        this.setupH2HControls();
        this.renderH2H();
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

        bar.innerHTML = `
            <div class="founder-bar-left">
                <span>🏛️ The Fantasy Vault Archive</span>
                <span style="opacity:0.7;">&bull; Gaywood / Katz HQ (Join Code: KATZ15)</span>
            </div>
            <div class="founder-bar-right">
                <span>User: <strong>${activeUser}</strong> ${isFounder ? '<span style="color:#d4af37;">(Founder)</span>' : ''}</span>
                <label style="margin-left:0.5rem;">Persona:</label>
                <select id="select-persona-mode" class="persona-select">
                    <option value="founder" ${persona === 'founder' ? 'selected' : ''}>👑 Founder View (Landon)</option>
                    <option value="admin" ${persona === 'admin' ? 'selected' : ''}>⚙️ League Admin (Commissioner)</option>
                    <option value="member" ${persona === 'member' ? 'selected' : ''}>👥 Verified Member (Team Owner)</option>
                    <option value="public" ${persona === 'public' ? 'selected' : ''}>👁️ Public Visitor</option>
                </select>
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
            
            const settings = this.leagueSettings[season];
            if (!settings || Object.keys(settings).length === 0) {
                content.innerHTML = '<p>No scoring settings available for this season.</p>';
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
        const viewHome = document.getElementById('view-home');
        const viewH2h = document.getElementById('view-h2h');
        const viewRecords = document.getElementById('view-records');

        const switchTab = (tab) => {
            this.activeTab = tab;
            [btnHome, btnH2h, btnRecords].forEach(btn => btn && btn.classList.remove('active'));
            [viewHome, viewH2h, viewRecords].forEach(view => view && view.classList.remove('active'));

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
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        if (btnHome) btnHome.addEventListener('click', () => switchTab('home'));
        if (btnH2h) btnH2h.addEventListener('click', () => switchTab('h2h'));
        if (btnRecords) btnRecords.addEventListener('click', () => switchTab('records'));

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
                    <h2>${season} • Week ${week} ${m && m.is_playoff ? '— Playoffs (' + (roundName || 'Playoffs') + ')' : '— Regular Season'}</h2>
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
