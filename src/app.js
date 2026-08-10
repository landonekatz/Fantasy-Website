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
    }

    async init() {
        this.setupThemeToggle();
        await this.loadData();
        this.initPowerRankings();
        this.setupNavigation();
        this.setupH2HControls();
        this.renderH2H();
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

        const [managersData, matchupsData, statsData, standingsData, transactionsData] = await Promise.all([
            fetchOrFallback('managers.json', 'managers'),
            fetchOrFallback('matchups.json', 'matchups'),
            fetchOrFallback('weekly_player_stats.json', 'weekly_player_stats'),
            fetchOrFallback('league_standings.json', 'league_standings'),
            fetchOrFallback('transactions.json', 'transactions')
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

        console.log(`Loaded ${this.managers.length} managers, ${this.matchups.length} matchups, ${this.playerStats.length} player stats, ${this.transactions.length} transactions.`);
    }

    getCurrentTeamName(managerId) {
        if (!this.managersData || !this.managersData.team_mappings) return 'Unknown Team';
        const mappings = this.managersData.team_mappings.filter(m => m.manager_id === managerId);
        if (mappings.length === 0) return 'Unknown Team';
        mappings.sort((a, b) => b.year - a.year);
        return mappings[0].team_name;
    }

    initPowerRankings() {
        const ranks = document.querySelectorAll('.rank[data-manager]');
        ranks.forEach(el => {
            const managerId = el.getAttribute('data-manager');
            const manager = this.managers.find(m => m.id === managerId);
            if (manager) {
                const infoEl = el.querySelector('.rank-info');
                if (infoEl) {
                    const logoUrl = manager.logo_url || 'https://s.yimg.com/cv/apiv2/default/nfl/nfl_1.png';
                    const teamName = this.getCurrentTeamName(managerId);
                    infoEl.innerHTML = `
                        <span class="rank-manager-name">${manager.name}</span>
                        <span class="rank-team-parenthetical">(<img class="rank-logo-inline" src="${logoUrl}" alt="logo"> ${teamName})</span>
                    `;
                }
            }
        });
    }

    setupNavigation() {
        const btnHome = document.getElementById('btn-tab-home');
        const btnH2h = document.getElementById('btn-tab-h2h');
        const btnRecords = document.getElementById('btn-tab-records');
        const btnRivalry = document.getElementById('btn-tab-rivalry');
        const viewHome = document.getElementById('view-home');
        const viewH2h = document.getElementById('view-h2h');
        const viewRecords = document.getElementById('view-records');
        const viewRivalry = document.getElementById('view-rivalry');

        const switchTab = (tab) => {
            this.activeTab = tab;
            [btnHome, btnH2h, btnRecords, btnRivalry].forEach(btn => btn && btn.classList.remove('active'));
            [viewHome, viewH2h, viewRecords, viewRivalry].forEach(view => view && view.classList.remove('active'));

            if (tab === 'rivalry') {
                document.body.classList.add('rivalry-dungeon-mode');
                const themeLabel = document.getElementById('theme-toggle-label');
                if (themeLabel) themeLabel.textContent = 'THEME: BLOOD';
                // Inject image URL relative to the page so it works on any host subdirectory
                if (!document.getElementById('dungeon-bg-style')) {
                    const imgUrl = new URL('dungeon_new.png', window.location.href).href;
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
            } else if (tab === 'rivalry') {
                btnRivalry && btnRivalry.classList.add('active');
                viewRivalry && viewRivalry.classList.add('active');
                if (typeof this.renderRivalryWeek === 'function') {
                    this.renderRivalryWeek();
                }
            }
        };

        if (btnHome) btnHome.addEventListener('click', () => switchTab('home'));
        if (btnH2h) btnH2h.addEventListener('click', () => switchTab('h2h'));
        if (btnRecords) btnRecords.addEventListener('click', () => switchTab('records'));
        if (btnRivalry) btnRivalry.addEventListener('click', () => switchTab('rivalry'));

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
            const involves1 = g.team_1_manager_id === m1Id || g.team_2_manager_id === m1Id;
            const involves2 = g.team_1_manager_id === m2Id || g.team_2_manager_id === m2Id;
            return involves1 && involves2;
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

        const renderRosterTable = (players, teamName, score, isWinner) => {
            const starters = players.filter(p => p.is_starter);
            const bench = players.filter(p => !p.is_starter);

            let html = `
                <div class="roster-card">
                    <div class="roster-card-header">
                        <div class="roster-team-title">${teamName} ${isWinner ? '<span class="win-badge">WINNER</span>' : ''}</div>
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
                    const nflInfo = [p.nfl_team, p.nfl_game_result, p.nfl_stat_line].filter(Boolean).join(' • ');
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
                                    <div class="nfl-team">—</div>
                                </div>
                            </div>
                            <div class="player-right">
                                <div class="player-pts">0.00</div>
                                <div class="player-proj">Proj: —</div>
                            </div>
                        </div>
                    `;
                }
            });

            remainingStarters.forEach(p => {
                const slotClass = p.roster_slot.toLowerCase().replace(/[^a-z]/g, '');
                const nflInfo = [p.nfl_team, p.nfl_game_result, p.nfl_stat_line].filter(Boolean).join(' • ');
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
                    const nflInfo = [p.nfl_team, p.nfl_game_result, p.nfl_stat_line].filter(Boolean).join(' • ');
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
                    <h2>${season} • Week ${week} ${m.is_playoffs ? '— ' + (m.playoff_round || 'Playoffs') : '— Regular Season'}</h2>
                    <p>${leftName} (${leftScore.toFixed(2)}) vs ${rightName} (${rightScore.toFixed(2)})</p>
                </div>
                <button class="modal-close-btn" onclick="document.getElementById('boxscore-modal').close()">✕</button>
            </div>

            <div class="rosters-grid">
                ${renderRosterTable(leftPlayers, leftName, leftScore, isLeftWin)}
                ${renderRosterTable(rightPlayers, rightName, rightScore, isRightWin)}
            </div>
        `;

        if (typeof modal.showModal === 'function') {
            modal.showModal();
        } else {
            modal.style.display = 'block';
        }
    }
}

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
