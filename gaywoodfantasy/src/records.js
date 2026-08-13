// The Record Book Analytics & UI Renderer for Gaywood Fantasy Football League HQ
// Extends FantasyApp with all 5 Record Book sections, table PPG toggles, and custom interactive filtering

const TargetApp = (typeof window !== 'undefined' && window.FantasyApp) ? window.FantasyApp : FantasyApp;
Object.assign(TargetApp.prototype, {

    // Helper: format season year with asterisk for 2015-2019
    formatSeasonYear(year) {
        if (year === undefined || year === null) return "";
        return `${Number(year)}`;
    },

    // Helper: check if season/week is valid (through 2021, max week was 16; 2022 onward, 17+ weeks)
    isValidSeasonWeek(season, week) {
        const y = Number(season);
        const w = Number(week);
        if (y <= 2020 && w > 16) return false;
        return true;
    },

    // Helper: check if a matchup is a valid regular season or championship playoff game (EXCLUDE consolation & 3rd place!)
    isValidRecordMatchup(m) {
        if (!m) return false;
        const gt = (m.game_type || '').toLowerCase();
        if (gt.includes('consolation') || gt.includes('3rd')) return false;
        if (m.is_consolation) return false;
        if (!this.isValidSeasonWeek(m.year, m.week)) return false;
        return true;
    },

    // Helper: check if a season falls within the current filter bar setting
    filterSeasonByRule(season, filterObj) {
        const y = Number(season);
        if (!filterObj || filterObj.year === 'all') return true;
        if (filterObj.year === 'custom') {
            const start = Number(filterObj.customStart || 2015);
            const end = Number(filterObj.customEnd || 2025);
            return y >= start && y <= end;
        }
        return true;
    },

    // Helper: check if a manager should be included based on Retired Managers toggle
    isManagerIncluded(managerId, filterObj, optionalManagerStatus = null) {
        if (filterObj && filterObj.retired) {
            // Include all managers if checkbox is checked
            return true;
        }
        // First check in this.managers
        const m = (this.managers || []).find(mgr => (mgr.id || mgr.manager_id) === managerId);
        if (m) {
            if (m.is_retired || (m.status || '').toLowerCase() === 'retired' || m.status_group === 'Retired Managers') {
                return false;
            }
            return true;
        }
        // If optionalManagerStatus is provided from standings row, check it
        if (optionalManagerStatus && optionalManagerStatus.toLowerCase() === 'retired') {
            return false;
        }
        return true;
    },

    // Helper: lookup manager name or return formatted default
    getManagerName(managerId, fallbackName = '') {
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
                   (espnId && (espnId === searchId || espnId === searchFallback));
        });

        if (m) {
            return m.name || m.manager_name || m.display_name || m.full_name;
        }

        const raw = (fallbackName && fallbackName !== managerId) ? fallbackName : managerId;
        if (!raw) return 'Unknown';
        const clean = String(raw).replace(/_/g, ' ').trim();
        return clean.replace(/\b\w/g, c => c.toUpperCase());
    },

    // Helper: get final placement badge HTML for a season and manager
    getFinalPlacementBadge(season, managerId) {
        const s = (this.standings || []).find(row => Number(row.year) === Number(season) && (row.manager_id === managerId || row.id === managerId));
        if (!s) return '';
        const rank = s.final_rank;
        if (rank === 1) {
            return `<span class="placement-pill placement-1st" title="League Champion">1st Place</span>`;
        }
        if (rank === 2) {
            return `<span class="placement-pill" title="Runner Up">2nd Place</span>`;
        }
        if (rank === 3) {
            return `<span class="placement-pill">3rd Place</span>`;
        }
        if (rank === 12) {
            return `<span class="placement-pill placement-12th" title="Outright Loser / Toilet Bowl">12th Place</span>`;
        }
        return `<span class="placement-pill">${rank}th Place</span>`;
    },

    // Helper: count trade transactions for a season/manager
    getTradesCount(season, managerId) {
        if (!this.transactions || this.transactions.length === 0) return 0;
        let count = 0;
        for (const t of this.transactions) {
            if (Number(t.year) === Number(season) && t.type === 'trade') {
                const details = (t.details || '').toLowerCase();
                if (details.includes('veto')) continue;
                if (t.manager_id === managerId || t.trade_partner_manager_id === managerId) {
                    count++;
                }
            }
        }
        return count;
    },

    // Render the entire Record Book page view
    renderRecordBook() {
        this.renderRecordsHero();
        this.renderRecordsSection1_Overview();
        this.renderRecordsSection2_SingleGame();
        this.renderRecordsSection3_SingleSeason();
        this.renderRecordsSection4_Streaks();
        this.renderRecordsSection5_Playoffs();
    },

    // Render Hero Header Banner with aggregate historical statistics
    renderRecordsHero() {
        const el = document.getElementById('records-hero');
        if (!el) return;

        const seasonsCount = new Set((this.matchups || []).map(m => m.year)).size;
        const validGames = (this.matchups || []).filter(m => this.isValidRecordMatchup(m));
        const totalGames = validGames.length;
        const regGames = validGames.filter(m => !m.is_playoff && !m.is_consolation).length;
        const playoffGames = validGames.filter(m => m.is_playoff).length;
        const consolationGames = validGames.filter(m => m.is_consolation).length;
        const totalPoints = validGames.reduce((sum, m) => sum + (m.home_score || 0) + (m.away_score || 0), 0);
        const currentMgrs = (this.managers || []).filter(m => !m.is_retired && (m.status || '').toLowerCase() !== 'retired').length;
        const retiredMgrs = (this.managers || []).filter(m => m.is_retired || (m.status || '').toLowerCase() === 'retired').length;

        el.innerHTML = `
            <div class="records-hero-title">
                <span>The Gaywood League Record Book</span>
            </div>
            <div class="records-hero-stats">
                <div class="hero-stat-badge">
                    <span class="hero-stat-value">${seasonsCount}</span>
                    <span class="hero-stat-label">Seasons Logged</span>
                </div>
                <div class="hero-stat-badge">
                    <span class="hero-stat-value">${totalGames.toLocaleString()}</span>
                    <span class="hero-stat-label">Total Matchups (${regGames.toLocaleString()} Reg, ${playoffGames.toLocaleString()} Playoff)</span>
                </div>
                <div class="hero-stat-badge">
                    <span class="hero-stat-value">${Math.round(totalPoints).toLocaleString()}</span>
                    <span class="hero-stat-label">All-Time Points Scored</span>
                </div>
                <div class="hero-stat-badge">
                    <span class="hero-stat-value">${currentMgrs}</span>
                    <span class="hero-stat-label">Active Managers (${retiredMgrs} Retired)</span>
                </div>
            </div>
        `;
    },

    // Helper: render standard section header & filter bar HTML
    renderFilterBarHTML(sectionKey, title, subtitle, filterObj, showPlayoffsToggle = false) {
        const year = filterObj.year || 'all';
        const retired = !!filterObj.retired;
        const playoffs = filterObj.playoffs !== undefined ? filterObj.playoffs : true;

        const allActive = year === 'all' ? 'active' : '';
        const customActive = year === 'custom' ? 'active' : '';

        const startYear = filterObj.customStart || 2015;
        const endYear = filterObj.customEnd || 2025;

        let yearOptions = '';
        for (let y = 2015; y <= 2025; y++) {
            yearOptions += `<option value="${y}">${y}</option>`;
        }

        const customSelectsStyle = year === 'custom' ? 'display:flex; gap:6px; align-items:center;' : 'display:none;';

        const playoffsToggleHTML = showPlayoffsToggle ? `
            <label class="records-toggle-label" title="Toggle playoff games in records">
                <input type="checkbox" class="records-toggle-checkbox filter-playoffs-toggle" data-section="${sectionKey}" ${playoffs ? 'checked' : ''}>
                <span>Include Playoff Games</span>
            </label>
        ` : '';

        return `
            <div class="records-section-header">
                <div class="records-section-title-wrap">
                    <h2>${title}</h2>
                    ${subtitle ? `<p>${subtitle}</p>` : ''}
                </div>
                <div class="records-filter-bar" data-section="${sectionKey}">
                    <div class="records-year-group">
                        <button class="records-year-btn ${allActive}" data-section="${sectionKey}" data-year="all">All Years</button>
                        <button class="records-year-btn ${customActive}" data-section="${sectionKey}" data-year="custom">Custom Span</button>
                    </div>
                    <div class="records-custom-span-wrap" style="${customSelectsStyle}">
                        <select class="records-custom-span-select filter-custom-start" data-section="${sectionKey}">
                            ${yearOptions.replace(`value="${startYear}"`, `value="${startYear}" selected`)}
                        </select>
                        <span style="color:var(--text-muted); font-size:0.8rem;">to</span>
                        <select class="records-custom-span-select filter-custom-end" data-section="${sectionKey}">
                            ${yearOptions.replace(`value="${endYear}"`, `value="${endYear}" selected`)}
                        </select>
                    </div>
                    <label class="records-toggle-label" title="Include retired league managers in records">
                        <input type="checkbox" class="records-toggle-checkbox filter-retired-toggle" data-section="${sectionKey}" ${retired ? 'checked' : ''}>
                        <span>Include Retired Managers</span>
                    </label>
                    ${playoffsToggleHTML}
                </div>
            </div>
        `;
    },

    // Helper: attach event listeners to a section's filter bar
    setupSectionFilterListeners(sectionKey, reRenderFn) {
        const container = document.querySelector(`.records-filter-bar[data-section="${sectionKey}"]`);
        if (!container) return;

        const yearBtns = container.querySelectorAll('.records-year-btn');
        yearBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const yearVal = btn.getAttribute('data-year');
                this.recordFilters[sectionKey].year = yearVal;
                reRenderFn.call(this);
            });
        });

        const startSel = container.querySelector('.filter-custom-start');
        const endSel = container.querySelector('.filter-custom-end');
        if (startSel && endSel) {
            startSel.addEventListener('change', () => {
                this.recordFilters[sectionKey].customStart = Number(startSel.value);
                this.recordFilters[sectionKey].year = 'custom';
                reRenderFn.call(this);
            });
            endSel.addEventListener('change', () => {
                this.recordFilters[sectionKey].customEnd = Number(endSel.value);
                this.recordFilters[sectionKey].year = 'custom';
                reRenderFn.call(this);
            });
        }

        const retiredCheckbox = container.querySelector('.filter-retired-toggle');
        if (retiredCheckbox) {
            retiredCheckbox.addEventListener('change', () => {
                this.recordFilters[sectionKey].retired = retiredCheckbox.checked;
                reRenderFn.call(this);
            });
        }

        const playoffsCheckbox = container.querySelector('.filter-playoffs-toggle');
        if (playoffsCheckbox) {
            playoffsCheckbox.addEventListener('change', () => {
                this.recordFilters[sectionKey].playoffs = playoffsCheckbox.checked;
                reRenderFn.call(this);
            });
        }
    },

    // ==========================================================================
    // SECTION 1: MANAGER RECORD BOOK OVERVIEW & TITLES
    // ==========================================================================
    renderRecordsSection1_Overview() {
        const el = document.getElementById('sec-overview');
        if (!el) return;

        const filterObj = this.recordFilters.overview;
        const mode = filterObj.mode || 'totals'; // 'totals' or 'ppg'

        // Initialize every active/included manager from this.managers (so Madoc and all current managers appear)
        const managerStatsMap = {};
        for (const m of (this.managers || [])) {
            const mid = m.id || m.manager_id;
            if (!this.isManagerIncluded(mid, filterObj, m.status)) continue;
            managerStatsMap[mid] = {
                manager_id: mid,
                manager_name: this.getManagerName(mid, m.manager_name || m.name),
                wins: 0,
                losses: 0,
                ties: 0,
                points_for: 0,
                points_against: 0,
                seasons_count: 0,
                years_count: 0
            };
        }

        // Aggregate REGULAR SEASON career stats per manager from standings
        for (const s of (this.standings || [])) {
            if (!this.filterSeasonByRule(s.year, filterObj)) continue;
            const mid = s.manager_id || s.id;
            if (!this.isManagerIncluded(mid, filterObj, s.manager_status)) continue;

            if (!managerStatsMap[mid]) {
                managerStatsMap[mid] = {
                    manager_id: mid,
                    manager_name: this.getManagerName(mid, s.manager_name),
                    wins: 0,
                    losses: 0,
                    ties: 0,
                    points_for: 0,
                    points_against: 0,
                    seasons_count: 0,
                    years_count: 0
                };
            }
            managerStatsMap[mid].wins += (Number(s.wins) || 0);
            managerStatsMap[mid].losses += (Number(s.losses) || 0);
            managerStatsMap[mid].ties += (Number(s.ties) || 0);
            managerStatsMap[mid].points_for += (Number(s.points_for) || 0);
            managerStatsMap[mid].points_against += (Number(s.points_against) || 0);
            managerStatsMap[mid].years_count += 1;
        }

        const statsList = Object.values(managerStatsMap).map(m => {
            const totalGames = m.wins + m.losses + m.ties;
            const win_pct = totalGames > 0 ? (m.wins + 0.5 * m.ties) / totalGames : 0;
            const point_diff = m.points_for - m.points_against;
            const ppg = totalGames > 0 ? m.points_for / totalGames : 0;
            const pf_ppg = totalGames > 0 ? m.points_for / totalGames : 0;
            const pa_ppg = totalGames > 0 ? m.points_against / totalGames : 0;
            const diff_ppg = totalGames > 0 ? point_diff / totalGames : 0;

            return {
                ...m,
                total_games: totalGames,
                win_pct,
                point_diff,
                ppg,
                pf_ppg,
                pa_ppg,
                diff_ppg
            };
        });

        // Sort by currently selected overview sort column
        const sortBy = this.overviewSortBy || (mode === 'totals' ? 'wins' : 'wins');
        const order = this.overviewSortOrder || 'desc';
        statsList.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            if (valA === valB) {
                valA = a.wins;
                valB = b.wins;
            }
            return order === 'desc' ? valB - valA : valA - valB;
        });

        // Generate Career Table HTML
        const getSortIndicator = (col) => {
            if (this.overviewSortBy !== col) return '<span class="sort-indicator">↕</span>';
            return this.overviewSortOrder === 'desc' ? '<span class="sort-indicator" style="opacity:1; color:#f59e0b;">▼</span>' : '<span class="sort-indicator" style="opacity:1; color:#f59e0b;">▲</span>';
        };

        const tableRowsHTML = statsList.map((m, idx) => {
            const pfDisplay = mode === 'totals' ?
                m.points_for.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1}) :
                m.pf_ppg.toFixed(1);
            const paDisplay = mode === 'totals' ?
                m.points_against.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1}) :
                m.pa_ppg.toFixed(1);
            const diffVal = mode === 'totals' ? m.point_diff : m.diff_ppg;
            const diffDisplay = `${diffVal >= 0 ? '+' : ''}${diffVal.toFixed(1)}`;
            const col8Display = mode === 'totals' ?
                m.ppg.toFixed(1) :
                `${m.years_count} <small style="font-size:0.7rem; color:var(--text-muted);">Yrs</small>`;

            return `
                <tr>
                    <td style="font-weight:800; color:var(--text-muted);">${idx + 1}</td>
                    <td style="font-weight:700; color:var(--text-primary);">${m.manager_name}</td>
                    <td style="font-weight:700;">${m.wins}–${m.losses}${m.ties > 0 ? '–' + m.ties : ''}</td>
                    <td style="font-weight:700; color:#f59e0b;">${(m.win_pct * 100).toFixed(1)}%</td>
                    <td style="font-weight:600;">${pfDisplay}</td>
                    <td style="font-weight:600;">${paDisplay}</td>
                    <td style="font-weight:700; color:${diffVal >= 0 ? '#10b981' : '#ef4444'};">${diffDisplay}</td>
                    <td style="font-weight:600; color:var(--text-secondary);">${col8Display}</td>
                </tr>
            `;
        }).join('');

        // Championships List (Total Finals Wins)
        const champMap = {};
        let mostRecentChampYear = -1;
        let mostRecentChampManagerId = null;

        for (const s of (this.standings || [])) {
            if (!this.filterSeasonByRule(s.year, filterObj)) continue;
            const mid = s.manager_id || s.id;
            if (!this.isManagerIncluded(mid, filterObj, s.manager_status)) continue;
            if (s.final_rank === 1) {
                if (!champMap[mid]) {
                    champMap[mid] = {
                        manager_id: mid,
                        manager_name: this.getManagerName(mid, s.manager_name),
                        total: 0,
                        years: []
                    };
                }
                champMap[mid].total += 1;
                champMap[mid].years.push(Number(s.year));
                if (Number(s.year) > mostRecentChampYear) {
                    mostRecentChampYear = Number(s.year);
                    mostRecentChampManagerId = mid;
                }
            }
        }

        const champList = Object.values(champMap);
        champList.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            const maxA = Math.max(...a.years);
            const maxB = Math.max(...b.years);
            return maxB - maxA;
        });

        const champHTML = champList.map(c => {
            const isReigning = (c.manager_id === mostRecentChampManagerId);
            const seasonsFormatted = c.years.sort((x, y) => y - x).map(y => {
                const badge = this.formatSeasonYear(y);
                return `<span class="placement-pill placement-1st">${badge}</span>`;
            }).join(' ');

            return `
                <div class="title-item">
                    <div class="title-item-manager">
                        <span>${c.manager_name}</span>
                        ${isReigning ? '<span class="trophy-badge" title="Reigning League Champion">🏆</span>' : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="title-item-seasons">${seasonsFormatted}</div>
                        <span class="rank-badge rank-1" style="width:auto; padding:2px 8px;">${c.total} ${c.total === 1 ? 'Title' : 'Titles'}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Outright Losses List (12th Place Finishes / Toilet Bowl Losers)
        const toiletMap = {};
        let mostRecentToiletYear = -1;
        let mostRecentToiletManagerId = null;

        for (const s of (this.standings || [])) {
            if (!this.filterSeasonByRule(s.year, filterObj)) continue;
            const mid = s.manager_id || s.id;
            if (!this.isManagerIncluded(mid, filterObj, s.manager_status)) continue;
            if (s.final_rank === 12) {
                if (!toiletMap[mid]) {
                    toiletMap[mid] = {
                        manager_id: mid,
                        manager_name: this.getManagerName(mid, s.manager_name),
                        total: 0,
                        years: []
                    };
                }
                toiletMap[mid].total += 1;
                toiletMap[mid].years.push(Number(s.year));
                if (Number(s.year) > mostRecentToiletYear) {
                    mostRecentToiletYear = Number(s.year);
                    mostRecentToiletManagerId = mid;
                }
            }
        }

        const toiletList = Object.values(toiletMap);
        toiletList.sort((a, b) => {
            if (b.total !== a.total) return b.total - a.total;
            const maxA = Math.max(...a.years);
            const maxB = Math.max(...b.years);
            return maxB - maxA;
        });

        const toiletHTML = toiletList.map(t => {
            const isReigningLoser = (t.manager_id === mostRecentToiletManagerId);
            const seasonsFormatted = t.years.sort((x, y) => y - x).map(y => {
                const badge = this.formatSeasonYear(y);
                return `<span class="placement-pill placement-12th">${badge}</span>`;
            }).join(' ');

            return `
                <div class="title-item">
                    <div class="title-item-manager">
                        <span>${t.manager_name}</span>
                        ${isReigningLoser ? '<span class="toilet-badge" title="Most Recent Outright Loser">🚽</span>' : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <div class="title-item-seasons">${seasonsFormatted}</div>
                        <span class="rank-badge" style="width:auto; padding:2px 8px; background:rgba(239,68,68,0.2); color:#ef4444;">${t.total} ${t.total === 1 ? 'Last' : 'Lasts'}</span>
                    </div>
                </div>
            `;
        }).join('');

        const headerHTML = this.renderFilterBarHTML('overview', 'Manager Standings and Titles', '', filterObj);

        // Header column labels depend on Mode (Totals vs PPG)
        const col5Label = mode === 'totals' ? `Points For (PF) ${getSortIndicator('points_for')}` : `PF / Game (PF/G) ${getSortIndicator('pf_ppg')}`;
        const col5Key = mode === 'totals' ? 'points_for' : 'pf_ppg';

        const col6Label = mode === 'totals' ? `Points Against (PA) ${getSortIndicator('points_against')}` : `PA / Game (PA/G) ${getSortIndicator('pa_ppg')}`;
        const col6Key = mode === 'totals' ? 'points_against' : 'pa_ppg';

        const col7Label = mode === 'totals' ? `Point Diff ${getSortIndicator('point_diff')}` : `Diff / Game ${getSortIndicator('diff_ppg')}`;
        const col7Key = mode === 'totals' ? 'point_diff' : 'diff_ppg';

        const col8Label = mode === 'totals' ? `PPG ${getSortIndicator('ppg')}` : `Seasons ${getSortIndicator('seasons_count')}`;
        const col8Key = mode === 'totals' ? 'ppg' : 'seasons_count';

        el.innerHTML = `
            ${headerHTML}

            <div class="records-table-wrap">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 4px;">
                    <span style="font-weight:700; font-size:0.9rem; color:var(--text-secondary);">All-Time Regular Season Career Standings</span>
                    <div class="table-mode-toggle">
                        <button class="table-mode-btn ${mode === 'totals' ? 'active' : ''}" data-section="overview" data-mode="totals">Totals</button>
                        <button class="table-mode-btn ${mode === 'ppg' ? 'active' : ''}" data-section="overview" data-mode="ppg">Per Game (PPG)</button>
                    </div>
                </div>
                <table class="records-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Manager</th>
                            <th class="records-th-sortable" data-sort="wins">W–L–T ${getSortIndicator('wins')}</th>
                            <th class="records-th-sortable" data-sort="win_pct">Win % ${getSortIndicator('win_pct')}</th>
                            <th class="records-th-sortable" data-sort="${col5Key}">${col5Label}</th>
                            <th class="records-th-sortable" data-sort="${col6Key}">${col6Label}</th>
                            <th class="records-th-sortable" data-sort="${col7Key}">${col7Label}</th>
                            <th class="records-th-sortable" data-sort="${col8Key}">${col8Label}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHTML || '<tr><td colspan="8" style="text-align:center;">No manager data matching filter</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div class="records-title-grid">
                <div class="records-title-card championship-card">
                    <div class="title-card-header">
                        <h3>Total Championships</h3>
                    </div>
                    <div class="records-title-list">
                        ${champHTML || '<div style="color:var(--text-muted); text-align:center;">No championships found</div>'}
                    </div>
                </div>

                <div class="records-title-card toilet-card">
                    <div class="title-card-header">
                        <h3>Total Outright Losses</h3>
                    </div>
                    <div class="records-title-list">
                        ${toiletHTML || '<div style="color:var(--text-muted); text-align:center;">No outright losses found</div>'}
                    </div>
                </div>
            </div>
        `;

        this.setupSectionFilterListeners('overview', this.renderRecordsSection1_Overview);

        // Setup mode toggle listeners
        const modeBtns = el.querySelectorAll('.table-mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.recordFilters.overview.mode = btn.getAttribute('data-mode');
                this.renderRecordsSection1_Overview();
            });
        });

        // Setup sortable table headers
        const thList = el.querySelectorAll('.records-th-sortable');
        thList.forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort');
                if (this.overviewSortBy === col) {
                    this.overviewSortOrder = this.overviewSortOrder === 'desc' ? 'asc' : 'desc';
                } else {
                    this.overviewSortBy = col;
                    this.overviewSortOrder = 'desc';
                }
                this.renderRecordsSection1_Overview();
            });
        });
    },

    // ==========================================================================
    // SECTION 2: SINGLE GAME RECORDS
    // ==========================================================================
    renderRecordsSection2_SingleGame() {
        const el = document.getElementById('sec-singlegame');
        if (!el) return;

        const filterObj = this.recordFilters.singlegame;

        // Collect all single team games from matchups (EXCLUDE consolation / 3rd place!)
        const singleGames = [];
        for (const m of (this.matchups || [])) {
            if (!this.isValidRecordMatchup(m)) continue;
            if (!this.filterSeasonByRule(m.year, filterObj)) continue;
            if (filterObj.playoffs === false && m.is_playoff) continue;
            // Also ignore consolation games entirely for most records unless explicitly included
            if (filterObj.playoffs === false && m.is_consolation) continue;

            if (m.home_team_id && this.isManagerIncluded(m.home_manager_id, filterObj)) {
                singleGames.push({
                    season: m.year,
                    week: m.week,
                    team_id: m.home_team_id,
                    team_name: m.home_team_name || 'Team 1',
                    manager_id: m.home_manager_id,
                    manager_name: this.getManagerName(m.home_manager_id, m.home_manager_name),
                    score: Number(m.home_score) || 0,
                    opponent_id: m.away_team_id,
                    opponent_name: this.getManagerName(m.away_manager_id, 'Opponent', m.away_manager_name),
                    opponent_score: Number(m.away_score) || 0,
                    is_playoffs: !!m.is_playoff
                });
            }
            if (m.away_team_id && this.isManagerIncluded(m.away_manager_id, filterObj)) {
                singleGames.push({
                    season: m.year,
                    week: m.week,
                    team_id: m.away_team_id,
                    team_name: m.away_team_name || 'Team 2',
                    manager_id: m.away_manager_id,
                    manager_name: this.getManagerName(m.away_manager_id, m.away_manager_name),
                    score: Number(m.away_score) || 0,
                    opponent_id: m.home_team_id,
                    opponent_name: this.getManagerName(m.home_manager_id, 'Opponent', m.home_manager_name),
                    opponent_score: Number(m.home_score) || 0,
                    is_playoffs: !!m.is_playoff
                });
            }
        }

        // Top 10 Highest Scoring Games
        const top10High = [...singleGames].sort((a, b) => b.score - a.score).slice(0, 10);

        // Top 10 Lowest Scoring Games
        const top10Low = [...singleGames].filter(g => g.score > 0).sort((a, b) => a.score - b.score).slice(0, 10);

        // Top 10 Most Bench Points in Single Game
        const validMatchupKeys = new Set();
        for (const m of (this.matchups || [])) {
            if (!this.isValidRecordMatchup(m)) continue;
            if (!this.filterSeasonByRule(m.year, filterObj)) continue;
            if (filterObj.playoffs === false && m.is_playoff) continue;
            if (filterObj.playoffs === false && m.is_consolation) continue;

            if (m.home_team_id) validMatchupKeys.add(`${m.year}_${m.week}_${m.home_team_id}`);
            if (m.away_team_id) validMatchupKeys.add(`${m.year}_${m.week}_${m.away_team_id}`);
        }

        const benchMap = {};
        for (const p of (this.playerStats || [])) {
            if (!this.filterSeasonByRule(p.year, filterObj)) continue;
            if (filterObj.playoffs === false && p.is_playoff) continue;
            if (filterObj.playoffs === false && p.is_consolation) continue;
            if (!this.isManagerIncluded(p.manager_id, filterObj)) continue;
            if (!validMatchupKeys.has(`${p.year}_${p.week}_${p.team_id}`)) continue;

            const key = `${p.year}_${p.week}_${p.manager_id}`;
            if (!benchMap[key]) {
                const m = (this.matchups || []).find(x =>
                    Number(x.year || x.season) === Number(p.year) && Number(x.week) === Number(p.week) &&
                    (x.home_manager_id === p.manager_id || x.away_manager_id === p.manager_id ||
                     x.team_1_manager_id === p.manager_id || x.team_2_manager_id === p.manager_id)
                );
                const isHome = m && (m.home_manager_id === p.manager_id || m.team_1_manager_id === p.manager_id);
                const teamId = p.team_id || (m ? (isHome ? (m.home_team_id || m.team_1_id) : (m.away_team_id || m.team_2_id)) : 0);
                const oppId = m ? (isHome ? (m.away_team_id || m.away_manager_id) : (m.home_team_id || m.home_manager_id)) : 0;
                const oppName = m ? (isHome ? (m.away_manager_name || m.team_2_manager_name) : (m.home_manager_name || m.team_1_manager_name)) : '';

                benchMap[key] = {
                    year: p.year,
                    week: p.week,
                    team_id: teamId,
                    opponent_id: oppId,
                    opponent_name: this.getManagerName(oppId, oppName),
                    manager_id: p.manager_id,
                    manager_name: this.getManagerName(p.manager_id),
                    bench_points: 0,
                    seen_players: new Set()
                };
            }
            const pKey = `${p.player_id || p.player_name}_${p.player_name}`;
            if (benchMap[key].seen_players.has(pKey)) continue;
            benchMap[key].seen_players.add(pKey);

            if (!p.is_starter) {
                const pts = Number(p.fantasy_points) || Number(p.actual_points) || 0;
                benchMap[key].bench_points += pts;
            }
        }

        const top10Bench = Object.values(benchMap)
            .sort((a, b) => b.bench_points - a.bench_points)
            .slice(0, 10);

        const renderSingleGameItem = (item, idx, val, valSuffix = 'pts') => {
            const seasonBadge = this.formatSeasonYear(item.year || item.season);
            const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
            const displayYear = item.year || item.season;
            const canViewBoxscore = displayYear >= 2018;
            const btnHtml = canViewBoxscore
                ? `<button class="btn-view-matchup" onclick="window.app.openBoxscoreModal(${displayYear}, ${item.week}, ${item.team_id}, ${item.opponent_id})">View Matchup</button>`
                : `<button class="btn-view-matchup" disabled title="Pre-2018 Boxscore Data Unavailable">Data Unavailable</button>`;
            return `
                <div class="record-item">
                    <div class="record-item-left">
                        <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                        <div class="record-item-info">
                            <div class="record-item-top">
                                <span class="record-team-name" title="${item.team_name}">${item.manager_name}</span>
                            </div>
                            <div class="record-sub-info">
                                <span>${seasonBadge} Week ${item.week}${item.opponent_name ? ` • vs ${item.opponent_name}` : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div class="record-item-right">
                        <span class="record-value">${typeof val === 'number' ? val.toFixed(2) : val} <small style="font-size:0.7rem; color:var(--text-muted);">${valSuffix}</small></span>
                        ${btnHtml}
                    </div>
                </div>
            `;
        };

        const headerHTML = this.renderFilterBarHTML('singlegame', 'Single Game Records', '', filterObj, true);

        el.innerHTML = `
            ${headerHTML}
            <div class="records-card-grid-3">
                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Top 10 Highest Scoring</h3>
                    </div>
                    <div class="record-item-list">
                        ${top10High.map((item, i) => renderSingleGameItem(item, i, item.score, 'pts')).join('') || '<div style="color:var(--text-muted); text-align:center;">No games found</div>'}
                    </div>
                </div>

                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Top 10 Lowest Scoring</h3>
                    </div>
                    <div class="record-item-list">
                        ${top10Low.map((item, i) => renderSingleGameItem(item, i, item.score, 'pts')).join('') || '<div style="color:var(--text-muted); text-align:center;">No games found</div>'}
                    </div>
                </div>

                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Top 10 Most Bench Points</h3>
                    </div>
                    <div class="record-item-list">
                        ${top10Bench.map((item, i) => renderSingleGameItem(item, i, item.bench_points, 'bench')).join('') || '<div style="color:var(--text-muted); text-align:center;">No games found</div>'}
                    </div>
                </div>
            </div>
        `;

        this.setupSectionFilterListeners('singlegame', this.renderRecordsSection2_SingleGame);
    },

    // ==========================================================================
    // SECTION 3: SINGLE SEASON RECORDS
    // ==========================================================================
    renderRecordsSection3_SingleSeason() {
        const el = document.getElementById('sec-singleseason');
        if (!el) return;

        const filterObj = this.recordFilters.singleseason;

        const filteredStandings = (this.standings || []).filter(s => {
            const mid = s.manager_id || s.id;
            return this.filterSeasonByRule(s.year, filterObj) &&
                   this.isManagerIncluded(mid, filterObj, s.manager_status);
        });

        // 13 Top 5 Lists logic
        const isPlayoffsMaker = (s) => (s && (s.made_playoffs === true || String(s.made_playoffs).toLowerCase() === 'true'));

        const mostPtsMissPlayoffs = [...filteredStandings].filter(s => !isPlayoffsMaker(s))
            .sort((a, b) => (Number(b.points_for) || 0) - (Number(a.points_for) || 0)).slice(0, 5);

        const leastPtsMakePlayoffs = [...filteredStandings].filter(s => isPlayoffsMaker(s))
            .sort((a, b) => (Number(a.points_for) || 0) - (Number(b.points_for) || 0)).slice(0, 5);

        const leastPtsWinLeague = [...filteredStandings].filter(s => (s.final_rank || s.rank) === 1)
            .sort((a, b) => (Number(a.points_for) || 0) - (Number(b.points_for) || 0)).slice(0, 5);

        const mostPtsLoseLeague = [...filteredStandings].filter(s => (s.final_rank || s.rank) === 12)
            .sort((a, b) => (Number(b.points_for) || 0) - (Number(a.points_for) || 0)).slice(0, 5);

        const getWinPct = (s) => {
            const wins = Number(s.wins) || 0;
            const losses = Number(s.losses) || 0;
            const ties = Number(s.ties) || 0;
            const total = wins + losses + ties;
            let pct = total > 0 ? (wins + 0.5 * ties) / total : (Number(s.win_pct) || 0);
            return isNaN(pct) ? 0 : pct;
        };

        const getWinPctStr = (s) => `${(getWinPct(s) * 100).toFixed(1)}%`;

        const bestRecordEver = [...filteredStandings]
            .sort((a, b) => {
                const diff = getWinPct(b) - getWinPct(a);
                if (Math.abs(diff) > 0.0001) return diff;
                return (Number(b.wins) || 0) - (Number(a.wins) || 0);
            }).slice(0, 5);

        const worstRecordEver = [...filteredStandings]
            .sort((a, b) => {
                const diff = getWinPct(a) - getWinPct(b);
                if (Math.abs(diff) > 0.0001) return diff;
                return (Number(a.wins) || 0) - (Number(b.wins) || 0);
            }).slice(0, 5);

        const mostPointsForEver = [...filteredStandings]
            .sort((a, b) => (Number(b.points_for) || 0) - (Number(a.points_for) || 0)).slice(0, 5);

        const leastPointsForEver = [...filteredStandings]
            .sort((a, b) => (Number(a.points_for) || 0) - (Number(b.points_for) || 0)).slice(0, 5);

        const mostPointsAgainstEver = [...filteredStandings]
            .sort((a, b) => (Number(b.points_against) || 0) - (Number(a.points_against) || 0)).slice(0, 5);

        const leastPointsAgainstEver = [...filteredStandings]
            .sort((a, b) => (Number(a.points_against) || 0) - (Number(b.points_against) || 0)).slice(0, 5);

        const mostMovesEver = [...filteredStandings]
            .sort((a, b) => (Number(b.transactions) || 0) - (Number(a.transactions) || 0)).slice(0, 5);

        const leastMovesEver = [...filteredStandings]
            .sort((a, b) => (Number(a.transactions) || 0) - (Number(b.transactions) || 0)).slice(0, 5);

        const mostTradesEver = [...filteredStandings]
            .sort((a, b) => {
                const midB = b.manager_id || b.id;
                const midA = a.manager_id || a.id;
                const trB = (b.trades !== undefined) ? Number(b.trades) : this.getTradesCount(b.year, midB);
                const trA = (a.trades !== undefined) ? Number(a.trades) : this.getTradesCount(a.year, midA);
                if (trB !== trA) return trB - trA;
                return (Number(b.transactions) || 0) - (Number(a.transactions) || 0);
            }).slice(0, 5);

        const renderTop5ListCard = (title, list, valFn, valSuffix = 'PF', showPlacementBadge = true) => {
            const itemsHTML = list.map((s, idx) => {
                const mid = s.manager_id || s.id;
                const managerName = this.getManagerName(mid, s.manager_name);
                const seasonBadge = this.formatSeasonYear(s.year);
                const placementBadge = showPlacementBadge ? this.getFinalPlacementBadge(s.year, mid) : '';
                const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
                const valStr = valFn(s);
                const suffixStr = typeof valSuffix === 'function' ? valSuffix(s) : valSuffix;
                return `
                    <div class="record-item">
                        <div class="record-item-left">
                            <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                            <div class="record-item-info">
                                <div class="record-item-top">
                                    <span class="record-team-name" title="${s.team_name}">${managerName}</span>
                                    ${placementBadge}
                                </div>
                                <div class="record-sub-info">
                                    <span>${seasonBadge} Season • ${s.wins}–${s.losses}${s.ties > 0 ? '–' + s.ties : ''}</span>
                                </div>
                            </div>
                        </div>
                        <div class="record-item-right">
                            <span class="record-value">${valStr} <small style="font-size:0.7rem; color:var(--text-muted);">${suffixStr}</small></span>
                        </div>
                    </div>
                `;
            }).join('');

            return `
                <div class="record-card">
                    <div class="record-card-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="record-item-list">
                        ${itemsHTML || '<div style="color:var(--text-muted); text-align:center;">No seasons found</div>'}
                    </div>
                </div>
            `;
        };

        const headerHTML = this.renderFilterBarHTML('singleseason', 'Single Season Records', '', filterObj);

        el.innerHTML = `
            ${headerHTML}
            <div class="records-card-grid-3">
                ${renderTop5ListCard('Most Points to Miss Playoffs', mostPtsMissPlayoffs, s => Number(s.points_for).toFixed(1), 'PF', true)}
                ${renderTop5ListCard('Least Points to Make Playoffs', leastPtsMakePlayoffs, s => Number(s.points_for).toFixed(1), 'PF', true)}
                ${renderTop5ListCard('Least Points to Win League', leastPtsWinLeague, s => Number(s.points_for).toFixed(1), 'PF', false)}
                ${renderTop5ListCard('Most Points to Lose League', mostPtsLoseLeague, s => Number(s.points_for).toFixed(1), 'PF', false)}
                ${renderTop5ListCard('Best Records', bestRecordEver, s => `${s.wins}-${s.losses}`, s => getWinPctStr(s), true)}
                ${renderTop5ListCard('Worst Records', worstRecordEver, s => `${s.wins}-${s.losses}`, s => getWinPctStr(s), true)}
                ${renderTop5ListCard('Most Points For Ever', mostPointsForEver, s => Number(s.points_for).toFixed(1), 'PF', true)}
                ${renderTop5ListCard('Least Points For Ever', leastPointsForEver, s => Number(s.points_for).toFixed(1), 'PF', true)}
                ${renderTop5ListCard('Most Points Against Ever', mostPointsAgainstEver, s => Number(s.points_against).toFixed(1), 'PA', true)}
                ${renderTop5ListCard('Least Points Against Ever', leastPointsAgainstEver, s => Number(s.points_against).toFixed(1), 'PA', true)}
                ${renderTop5ListCard('Most Moves Ever', mostMovesEver, s => s.transactions || 0, 'Moves', true)}
                ${renderTop5ListCard('Least Moves Ever', leastMovesEver, s => s.transactions || 0, 'Moves', true)}
                ${renderTop5ListCard('Most Trades Ever', mostTradesEver, s => {
                    const mid = s.manager_id || s.id;
                    return (s.trades !== undefined) ? s.trades : this.getTradesCount(s.year, mid);
                }, 'Trades', true)}
            </div>
        `;

        this.setupSectionFilterListeners('singleseason', this.renderRecordsSection3_SingleSeason);
    },

    // ==========================================================================
    // SECTION 4: STREAK RECORDS (REGULAR SEASON WIN / LOSS STREAKS)
    // ==========================================================================
    renderRecordsSection4_Streaks() {
        const el = document.getElementById('sec-streaks');
        if (!el) return;

        const filterObj = this.recordFilters.streaks;

        // Collect chronological regular season games per manager (EXCLUDE consolation & 3rd place!)
        const regMatchups = (this.matchups || []).filter(m => !m.is_playoff && !m.is_consolation && this.isValidRecordMatchup(m))
            .sort((a, b) => {
                if (Number(a.year) !== Number(b.year)) return Number(a.year) - Number(b.year);
                return Number(a.week) - Number(b.week);
            });

        // 1. MULTI-SEASON STREAKS (Can carry over across seasons)
        const multiStreaks = [];
        const activeMulti = {};

        const processMultiGame = (managerId, managerName, isWin, season, week) => {
            const type = isWin ? 'W' : 'L';
            let current = activeMulti[managerId];

            if (!current || current.type !== type) {
                if (current && current.length > 0) {
                    multiStreaks.push({
                        manager_id: managerId,
                        manager_name: this.getManagerName(managerId, managerName),
                        type: current.type,
                        length: current.length,
                        startSeason: current.startSeason,
                        startWeek: current.startWeek,
                        endSeason: current.endSeason,
                        endWeek: current.endWeek,
                        seasons: Array.from(current.seasons)
                    });
                }
                activeMulti[managerId] = {
                    type,
                    length: 1,
                    startSeason: season,
                    startWeek: week,
                    endSeason: season,
                    endWeek: week,
                    seasons: new Set([season])
                };
            } else {
                current.length += 1;
                current.endSeason = season;
                current.endWeek = week;
                current.seasons.add(season);
            }
        };

        // 2. SINGLE-SEASON STREAKS (Reset each new season)
        const singleSeasonStreaks = [];
        const activeSingle = {};

        const processSingleGame = (managerId, managerName, isWin, season, week) => {
            const type = isWin ? 'W' : 'L';
            let current = activeSingle[managerId];

            if (!current || current.year !== season || current.type !== type) {
                if (current && current.length > 0) {
                    singleSeasonStreaks.push({
                        manager_id: managerId,
                        manager_name: this.getManagerName(managerId, managerName),
                        type: current.type,
                        length: current.length,
                        startSeason: current.year,
                        startWeek: current.startWeek,
                        endSeason: current.year,
                        endWeek: current.endWeek,
                        seasons: [current.year]
                    });
                }
                activeSingle[managerId] = {
                    year: season,
                    startSeason: season,
                    endSeason: season,
                    type,
                    length: 1,
                    startWeek: week,
                    endWeek: week
                };
            } else {
                current.length += 1;
                current.endWeek = week;
            }
        };

        for (const m of regMatchups) {
            const s1 = Number(m.home_score) || 0;
            const s2 = Number(m.away_score) || 0;
            if (s1 === s2) continue; // Skip ties for streak counts

            const isTeam1Win = s1 > s2;
            if (m.home_manager_id) {
                processMultiGame(m.home_manager_id, m.home_manager_name, isTeam1Win, m.year, m.week);
                processSingleGame(m.home_manager_id, m.home_manager_name, isTeam1Win, m.year, m.week);
            }
            if (m.away_manager_id) {
                processMultiGame(m.away_manager_id, m.away_manager_name, !isTeam1Win, m.year, m.week);
                processSingleGame(m.away_manager_id, m.away_manager_name, !isTeam1Win, m.year, m.week);
            }
        }

        // Push active streaks at end of timeline
        for (const [mid, st] of Object.entries(activeMulti)) {
            if (st && st.length > 0) {
                multiStreaks.push({
                    manager_id: mid,
                    manager_name: this.getManagerName(mid),
                    type: st.type,
                    length: st.length,
                    startSeason: st.startSeason,
                    startWeek: st.startWeek,
                    endSeason: st.endSeason,
                    endWeek: st.endWeek,
                    seasons: Array.from(st.seasons)
                });
            }
        }

        for (const [mid, st] of Object.entries(activeSingle)) {
            if (st && st.length > 0) {
                singleSeasonStreaks.push({
                    manager_id: mid,
                    manager_name: this.getManagerName(mid),
                    type: st.type,
                    length: st.length,
                    startSeason: st.year,
                    startWeek: st.startWeek,
                    endSeason: st.year,
                    endWeek: st.endWeek,
                    seasons: [st.year]
                });
            }
        }

        // Filter streaks by year filter & retired managers toggle
        const filterStreakFn = st => {
            if (!this.isManagerIncluded(st.manager_id, filterObj)) return false;
            return st.seasons.some(s => this.filterSeasonByRule(s, filterObj));
        };

        const top5MultiWin = [...multiStreaks].filter(s => s.type === 'W' && filterStreakFn(s))
            .sort((a, b) => b.length - a.length || b.endSeason - a.endSeason).slice(0, 5);

        const top5MultiLoss = [...multiStreaks].filter(s => s.type === 'L' && filterStreakFn(s))
            .sort((a, b) => b.length - a.length || b.endSeason - a.endSeason).slice(0, 5);

        const top5SingleWin = [...singleSeasonStreaks].filter(s => s.type === 'W' && filterStreakFn(s))
            .sort((a, b) => b.length - a.length || b.endSeason - a.endSeason).slice(0, 5);

        const top5SingleLoss = [...singleSeasonStreaks].filter(s => s.type === 'L' && filterStreakFn(s))
            .sort((a, b) => b.length - a.length || b.endSeason - a.endSeason).slice(0, 5);

        const renderStreakItem = (item, idx) => {
            const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
            const spanText = `${this.formatSeasonYear(item.startSeason)} W${item.startWeek} – ${this.formatSeasonYear(item.endSeason)} W${item.endWeek}`;
            const placements = (item.seasons || item.years || []).map(y => this.getFinalPlacementBadge(y, item.manager_id)).join(' ');

            return `
                <div class="record-item">
                    <div class="record-item-left">
                        <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                        <div class="record-item-info">
                            <div class="record-item-top">
                                <span class="record-team-name">${item.manager_name}</span>
                                <span style="display:inline-flex; align-items:center; gap:4px; flex-shrink:0;">${placements}</span>
                            </div>
                            <div class="record-sub-info">
                                <span>${spanText}</span>
                            </div>
                        </div>
                    </div>
                    <div class="record-item-right">
                        <span class="record-value" style="color:${item.type === 'W' ? '#10b981' : '#ef4444'}">${item.length} <small style="font-size:0.7rem; color:var(--text-muted);">Games</small></span>
                    </div>
                </div>
            `;
        };

        const headerHTML = this.renderFilterBarHTML('streaks', 'Streak Records', '', filterObj);

        el.innerHTML = `
            ${headerHTML}
            <div class="records-card-grid-2">
                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Longest Regular Season Win Streaks (Multi-Season)</h3>
                    </div>
                    <div class="record-item-list">
                        ${top5MultiWin.map((s, i) => renderStreakItem(s, i)).join('') || '<div style="color:var(--text-muted); text-align:center;">No streaks found</div>'}
                    </div>
                </div>

                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Longest Regular Season Loss Streaks (Multi-Season)</h3>
                    </div>
                    <div class="record-item-list">
                        ${top5MultiLoss.map((s, i) => renderStreakItem(s, i)).join('') || '<div style="color:var(--text-muted); text-align:center;">No streaks found</div>'}
                    </div>
                </div>

                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Longest Regular Season Win Streaks (Single-Season)</h3>
                    </div>
                    <div class="record-item-list">
                        ${top5SingleWin.map((s, i) => renderStreakItem(s, i)).join('') || '<div style="color:var(--text-muted); text-align:center;">No streaks found</div>'}
                    </div>
                </div>

                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Longest Regular Season Loss Streaks (Single-Season)</h3>
                    </div>
                    <div class="record-item-list">
                        ${top5SingleLoss.map((s, i) => renderStreakItem(s, i)).join('') || '<div style="color:var(--text-muted); text-align:center;">No streaks found</div>'}
                    </div>
                </div>
            </div>
        `;

        this.setupSectionFilterListeners('streaks', this.renderRecordsSection4_Streaks);
    },

    // ==========================================================================
    // SECTION 5: PLAYOFF RECORDS
    // ==========================================================================
    renderRecordsSection5_Playoffs() {
        const el = document.getElementById('sec-playoffs');
        if (!el) return;

        const filterObj = this.recordFilters.playoffs;
        const mode = filterObj.mode || 'totals'; // 'totals' or 'ppg'

        // 1. ALL-TIME CAREER PLAYOFF STATS TABLE (with Totals / PPG Mode toggle)
        const playoffStatsMap = {};
        for (const m of (this.managers || [])) {
            const mid = m.id || m.manager_id;
            if (!this.isManagerIncluded(mid, filterObj, m.status)) continue;
            playoffStatsMap[mid] = {
                manager_id: mid,
                manager_name: this.getManagerName(mid, m.manager_name || m.name),
                wins: 0,
                losses: 0,
                points_for: 0,
                points_against: 0,
                games_count: 0
            };
        }

        // Aggregate playoff games per manager (EXCLUDE consolation & 3rd place games!)
        for (const m of (this.matchups || [])) {
            if (!m.is_playoff) continue;
            if (!this.isValidRecordMatchup(m)) continue;
            if (!this.filterSeasonByRule(m.year, filterObj)) continue;

            const t1Mid = m.home_manager_id;
            const t2Mid = m.away_manager_id;
            const s1 = Number(m.home_score) || 0;
            const s2 = Number(m.away_score) || 0;

            if (t1Mid && this.isManagerIncluded(t1Mid, filterObj)) {
                if (!playoffStatsMap[t1Mid]) {
                    playoffStatsMap[t1Mid] = {
                        manager_id: t1Mid,
                        manager_name: this.getManagerName(t1Mid, m.home_manager_name),
                        wins: 0, losses: 0, points_for: 0, points_against: 0, games_count: 0
                    };
                }
                playoffStatsMap[t1Mid].games_count += 1;
                playoffStatsMap[t1Mid].points_for += s1;
                playoffStatsMap[t1Mid].points_against += s2;
                if (s1 > s2) playoffStatsMap[t1Mid].wins += 1;
                else if (s1 < s2) playoffStatsMap[t1Mid].losses += 1;
            }

            if (t2Mid && this.isManagerIncluded(t2Mid, filterObj)) {
                if (!playoffStatsMap[t2Mid]) {
                    playoffStatsMap[t2Mid] = {
                        manager_id: t2Mid,
                        manager_name: this.getManagerName(t2Mid, m.away_manager_name),
                        wins: 0, losses: 0, points_for: 0, points_against: 0, games_count: 0
                    };
                }
                playoffStatsMap[t2Mid].games_count += 1;
                playoffStatsMap[t2Mid].points_for += s2;
                playoffStatsMap[t2Mid].points_against += s1;
                if (s2 > s1) playoffStatsMap[t2Mid].wins += 1;
                else if (s2 < s1) playoffStatsMap[t2Mid].losses += 1;
            }
        }

        const playoffList = Object.values(playoffStatsMap).map(m => {
            const totalGames = m.wins + m.losses;
            const win_pct = totalGames > 0 ? m.wins / totalGames : 0;
            const point_diff = m.points_for - m.points_against;
            const ppg = totalGames > 0 ? m.points_for / totalGames : 0;
            const pf_ppg = totalGames > 0 ? m.points_for / totalGames : 0;
            const pa_ppg = totalGames > 0 ? m.points_against / totalGames : 0;
            const diff_ppg = totalGames > 0 ? point_diff / totalGames : 0;

            return {
                ...m,
                total_games: totalGames,
                win_pct,
                point_diff,
                ppg,
                pf_ppg,
                pa_ppg,
                diff_ppg
            };
        });

        const pSortBy = this.playoffsSortBy || 'wins';
        const pOrder = this.playoffsSortOrder || 'desc';
        playoffList.sort((a, b) => {
            let valA = a[pSortBy];
            let valB = b[pSortBy];
            if (valA === valB) {
                valA = a.wins;
                valB = b.wins;
            }
            return pOrder === 'desc' ? valB - valA : valA - valB;
        });

        const getPlayoffSortInd = (col) => {
            if (this.playoffsSortBy !== col) return '<span class="sort-indicator">↕</span>';
            return this.playoffsSortOrder === 'desc' ? '<span class="sort-indicator" style="opacity:1; color:#f59e0b;">▼</span>' : '<span class="sort-indicator" style="opacity:1; color:#f59e0b;">▲</span>';
        };

        const playoffTableHTML = playoffList.map((m, idx) => {
            const pfDisplay = mode === 'totals' ?
                m.points_for.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1}) :
                m.pf_ppg.toFixed(1);
            const paDisplay = mode === 'totals' ?
                m.points_against.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1}) :
                m.pa_ppg.toFixed(1);
            const diffVal = mode === 'totals' ? m.point_diff : m.diff_ppg;
            const diffDisplay = `${diffVal >= 0 ? '+' : ''}${diffVal.toFixed(1)}`;
            const col8Display = mode === 'totals' ?
                m.ppg.toFixed(1) :
                `${m.games_count} <small style="font-size:0.7rem; color:var(--text-muted);">Games</small>`;

            return `
                <tr>
                    <td style="font-weight:800; color:var(--text-muted);">${idx + 1}</td>
                    <td style="font-weight:700; color:var(--text-primary);">${m.manager_name}</td>
                    <td style="font-weight:700;">${m.wins}–${m.losses}</td>
                    <td style="font-weight:700; color:#f59e0b;">${(m.win_pct * 100).toFixed(1)}%</td>
                    <td style="font-weight:600;">${pfDisplay}</td>
                    <td style="font-weight:600;">${paDisplay}</td>
                    <td style="font-weight:700; color:${diffVal >= 0 ? '#10b981' : '#ef4444'};">${diffDisplay}</td>
                    <td style="font-weight:600; color:var(--text-secondary);">${col8Display}</td>
                </tr>
            `;
        }).join('');

        // 2. PLAYOFF APPEARANCES (Full-Width Card above 5-item lists)
        const mgrPlayoffMap = {};
        for (const s of (this.standings || [])) {
            if (!this.filterSeasonByRule(s.year, filterObj)) continue;
            const mid = s.manager_id || s.id;
            if (!this.isManagerIncluded(mid, filterObj, s.manager_status)) continue;

            if (!mgrPlayoffMap[mid]) {
                mgrPlayoffMap[mid] = {
                    manager_id: mid,
                    manager_name: this.getManagerName(mid, s.manager_name),
                    appearances: 0,
                    total_seasons: 0,
                    seasons_made: [],
                    all_seasons: []
                };
            }
            mgrPlayoffMap[mid].total_seasons += 1;
            const yr = Number(s.year || s.season);
            const isMade = (s.made_playoffs === true || String(s.made_playoffs).toLowerCase() === 'true');
            mgrPlayoffMap[mid].all_seasons.push({ year: yr, season: yr, made: isMade });
            if (isMade) {
                mgrPlayoffMap[mid].appearances += 1;
                mgrPlayoffMap[mid].seasons_made.push(yr);
            }
        }

        const appearancesList = Object.values(mgrPlayoffMap).sort((a, b) => {
            if (b.appearances !== a.appearances) return b.appearances - a.appearances;
            return (b.appearances / b.total_seasons) - (a.appearances / a.total_seasons);
        });

        // 3. Playoff Droughts & Make Streaks
        const allDroughts = [];
        const activeDroughts = [];
        const allMakeStreaks = [];
        const activeMakeStreaks = [];

        for (const m of Object.values(mgrPlayoffMap)) {
            const sortedSeasons = [...m.all_seasons].sort((a, b) => a.year - b.year);
            let curDrought = 0;
            let maxDrought = 0;
            let droughtStart = 0;
            let droughtEnd = 0;
            let maxDroughtSpan = '';

            let curMake = 0;
            let maxMake = 0;
            let maxMakeSpan = '';
            let makeStart = 0;

            for (let i = 0; i < sortedSeasons.length; i++) {
                const s = sortedSeasons[i];
                if (!s.made) {
                    if (curDrought === 0) droughtStart = s.year;
                    curDrought += 1;
                    droughtEnd = s.year;
                    if (curDrought > maxDrought) {
                        maxDrought = curDrought;
                        maxDroughtSpan = `${this.formatSeasonYear(droughtStart)} – ${this.formatSeasonYear(droughtEnd)}`;
                    }
                    curMake = 0;
                } else {
                    if (curMake === 0) makeStart = s.year;
                    curMake += 1;
                    if (curMake > maxMake) {
                        maxMake = curMake;
                        maxMakeSpan = `${this.formatSeasonYear(makeStart)} – ${this.formatSeasonYear(s.year)}`;
                    }
                    curDrought = 0;
                }
            }

            if (maxDrought > 0) {
                allDroughts.push({
                    manager_name: this.getManagerName(m.manager_id, m.manager_name),
                    length: maxDrought,
                    span: maxDroughtSpan
                });
            }
            if (maxMake > 0) {
                allMakeStreaks.push({
                    manager_name: this.getManagerName(m.manager_id, m.manager_name),
                    length: maxMake,
                    span: maxMakeSpan
                });
            }

            if (sortedSeasons.length > 0) {
                let actD = 0;
                for (let j = sortedSeasons.length - 1; j >= 0; j--) {
                    if (!sortedSeasons[j].made) actD++;
                    else break;
                }
                if (actD > 0) {
                    activeDroughts.push({
                        manager_name: this.getManagerName(m.manager_id, m.manager_name),
                        length: actD,
                        span: `Last ${actD} Seasons`
                    });
                }

                let actM = 0;
                for (let j = sortedSeasons.length - 1; j >= 0; j--) {
                    if (sortedSeasons[j].made) actM++;
                    else break;
                }
                if (actM > 0) {
                    activeMakeStreaks.push({
                        manager_name: this.getManagerName(m.manager_id, m.manager_name),
                        length: actM,
                        span: `Last ${actM} Seasons`
                    });
                }
            }
        }

        const top5Droughts = allDroughts.sort((a, b) => b.length - a.length).slice(0, 5);
        const topActiveDroughts = activeDroughts.sort((a, b) => b.length - a.length).slice(0, 5);
        const top5Makes = allMakeStreaks.sort((a, b) => b.length - a.length).slice(0, 5);
        const topActiveMakes = activeMakeStreaks.sort((a, b) => b.length - a.length).slice(0, 5);

        // Playoff Single Game & Matchup Lists (EXCLUDE consolation & 3rd place!)
        const playoffSingleGames = [];
        const playoffMatchups = [];
        const playoffRunsMap = {}; // key: `${season}_${managerId}`

        for (const m of (this.matchups || [])) {
            if (!m.is_playoff) continue;
            if (!this.isValidRecordMatchup(m)) continue;
            if (!this.filterSeasonByRule(m.year, filterObj)) continue;

            const t1Inc = this.isManagerIncluded(m.home_manager_id, filterObj);
            const t2Inc = this.isManagerIncluded(m.away_manager_id, filterObj);
            if (!t1Inc && !t2Inc) continue;

            const s1 = Number(m.home_score) || 0;
            const s2 = Number(m.away_score) || 0;

            const roundName = m.playoff_round || (this.getPlayoffRoundName ? this.getPlayoffRoundName(m.year, m.week) : '');

            if (t1Inc) {
                playoffSingleGames.push({
                    season: m.year, week: m.week, team_id: m.home_team_id,
                    playoff_round: roundName,
                    manager_name: this.getManagerName(m.home_manager_id, m.home_manager_name),
                    score: s1, opponent_id: m.away_team_id,
                    opponent_name: this.getManagerName(m.away_manager_id, 'Opponent', m.away_manager_name)
                });
            }
            if (t2Inc) {
                playoffSingleGames.push({
                    season: m.year, week: m.week, team_id: m.away_team_id,
                    playoff_round: roundName,
                    manager_name: this.getManagerName(m.away_manager_id, m.away_manager_name),
                    score: s2, opponent_id: m.home_team_id,
                    opponent_name: this.getManagerName(m.home_manager_id, 'Opponent', m.home_manager_name)
                });
            }

            playoffMatchups.push({
                season: m.year, week: m.week, home_team_id: m.home_team_id, away_team_id: m.away_team_id,
                playoff_round: roundName,
                home_manager: this.getManagerName(m.home_manager_id, m.home_manager_name),
                away_manager: this.getManagerName(m.away_manager_id, m.away_manager_name),
                score_1: s1, score_2: s2,
                combined: s1 + s2
            });

            // Aggregate postseason runs
            if (t1Inc && m.home_manager_id) {
                const k = `${m.year}_${m.home_manager_id}`;
                if (!playoffRunsMap[k]) {
                    playoffRunsMap[k] = {
                        season: m.year, manager_id: m.home_manager_id,
                        manager_name: this.getManagerName(m.home_manager_id, m.home_manager_name),
                        games: 0, total_points: 0, wins: 0, losses: 0
                    };
                }
                playoffRunsMap[k].games++;
                playoffRunsMap[k].total_points += s1;
                if (s1 > s2) playoffRunsMap[k].wins++;
                else if (s1 < s2) playoffRunsMap[k].losses++;
            }
            if (t2Inc && m.away_manager_id) {
                const k = `${m.year}_${m.away_manager_id}`;
                if (!playoffRunsMap[k]) {
                    playoffRunsMap[k] = {
                        season: m.year, manager_id: m.away_manager_id,
                        manager_name: this.getManagerName(m.away_manager_id, m.away_manager_name),
                        games: 0, total_points: 0, wins: 0, losses: 0
                    };
                }
                playoffRunsMap[k].games++;
                playoffRunsMap[k].total_points += s2;
                if (s2 > s1) playoffRunsMap[k].wins++;
                else if (s2 < s1) playoffRunsMap[k].losses++;
            }
        }

        const top10BestSingle = [...playoffSingleGames].sort((a, b) => b.score - a.score).slice(0, 10);
        const top10WorstSingle = [...playoffSingleGames].filter(g => g.score > 0).sort((a, b) => a.score - b.score).slice(0, 10);
        const top10LowestMatchup = [...playoffMatchups].filter(m => m.combined > 0).sort((a, b) => a.combined - b.combined).slice(0, 10);
        const top10HighestMatchup = [...playoffMatchups].sort((a, b) => b.combined - a.combined).slice(0, 10);

        const top5DominantRuns = Object.values(playoffRunsMap)
            .map(r => ({ ...r, ppg: r.games > 0 ? r.total_points / r.games : 0 }))
            .sort((a, b) => b.ppg - a.ppg)
            .slice(0, 5);

        // HTML Builders
        const renderSingleGameRow = (item, idx) => {
            const seasonBadge = this.formatSeasonYear(item.year || item.season);
            const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
            const displayYear = item.year || item.season;
            const canViewBoxscore = displayYear >= 2018;
            const roundBadge = item.playoff_round ? ` (${item.playoff_round})` : '';
            const btnHtml = canViewBoxscore
                ? `<button class="btn-view-matchup" onclick="window.app.openBoxscoreModal(${displayYear}, ${item.week}, ${item.team_id}, ${item.opponent_id})">View Matchup</button>`
                : `<button class="btn-view-matchup" disabled title="Pre-2018 Boxscore Data Unavailable">Data Unavailable</button>`;
            return `
                <div class="record-item">
                    <div class="record-item-left">
                        <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                        <div class="record-item-info">
                            <div class="record-item-top">
                                <span class="record-team-name">${item.manager_name}</span>
                            </div>
                            <div class="record-sub-info">
                                <span>${seasonBadge} Week ${item.week}${roundBadge} • vs ${item.opponent_name}</span>
                            </div>
                        </div>
                    </div>
                    <div class="record-item-right">
                        <span class="record-value">${item.score.toFixed(2)} <small style="font-size:0.7rem; color:var(--text-muted);">pts</small></span>
                        ${btnHtml}
                    </div>
                </div>
            `;
        };

        const renderMatchupRow = (m, idx) => {
            const seasonBadge = this.formatSeasonYear(m.year || m.season);
            const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
            const displayYear = m.year || m.season;
            const canViewBoxscore = displayYear >= 2018;
            const roundBadge = m.playoff_round ? ` (${m.playoff_round})` : ' (Playoffs)';
            const btnHtml = canViewBoxscore
                ? `<button class="btn-view-matchup" onclick="window.app.openBoxscoreModal(${displayYear}, ${m.week}, ${m.home_team_id}, ${m.away_team_id})">View Matchup</button>`
                : `<button class="btn-view-matchup" disabled title="Pre-2018 Boxscore Data Unavailable">Data Unavailable</button>`;
            return `
                <div class="record-item">
                    <div class="record-item-left">
                        <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                        <div class="record-item-info">
                            <div class="record-item-top">
                                <span class="record-team-name">${m.home_manager} (${m.score_1.toFixed(1)}) vs ${m.away_manager} (${m.score_2.toFixed(1)})</span>
                            </div>
                            <div class="record-sub-info">
                                <span>${seasonBadge} Week ${m.week}${roundBadge}</span>
                            </div>
                        </div>
                    </div>
                    <div class="record-item-right">
                        <span class="record-value">${m.combined.toFixed(2)} <small style="font-size:0.7rem; color:var(--text-muted);">combined</small></span>
                        ${btnHtml}
                    </div>
                </div>
            `;
        };

        const renderRunRow = (r, idx) => {
            const seasonBadge = this.formatSeasonYear(r.year || r.season);
            const placementBadge = this.getFinalPlacementBadge(r.year, r.manager_id);
            const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
            return `
                <div class="record-item">
                    <div class="record-item-left">
                        <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                        <div class="record-item-info">
                            <div class="record-item-top">
                                <span class="record-team-name">${r.manager_name}</span>
                                ${placementBadge}
                            </div>
                            <div class="record-sub-info">
                                <span>${seasonBadge} Postseason • ${r.wins}-${r.losses} Record • ${r.total_points.toFixed(1)} Pts</span>
                            </div>
                        </div>
                    </div>
                    <div class="record-item-right">
                        <span class="record-value">${r.ppg.toFixed(2)} <small style="font-size:0.7rem; color:var(--text-muted);">PPG</small></span>
                    </div>
                </div>
            `;
        };

        const renderSimpleListCard = (title, list, valFn, labelFn) => {
            return `
                <div class="record-card">
                    <div class="record-card-header">
                        <h3>${title}</h3>
                    </div>
                    <div class="record-item-list">
                        ${list.map((item, idx) => {
                            const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
                            return `
                                <div class="record-item">
                                    <div class="record-item-left">
                                        <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                                        <div class="record-item-info">
                                            <div class="record-item-top">
                                                <span class="record-team-name">${item.manager_name}</span>
                                            </div>
                                            <div class="record-sub-info">
                                                <span>${labelFn(item)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="record-item-right">
                                        <span class="record-value">${valFn(item)}</span>
                                    </div>
                                </div>
                            `;
                        }).join('') || '<div style="color:var(--text-muted); text-align:center;">No records found</div>'}
                    </div>
                </div>
            `;
        };

        const headerHTML = this.renderFilterBarHTML('playoffs', 'Playoff Records', '', filterObj);

        // Header column labels for playoff career table
        const pCol5Label = mode === 'totals' ? `Points For (PF) ${getPlayoffSortInd('points_for')}` : `PF / Game (PF/G) ${getPlayoffSortInd('pf_ppg')}`;
        const pCol5Key = mode === 'totals' ? 'points_for' : 'pf_ppg';

        const pCol6Label = mode === 'totals' ? `Points Against (PA) ${getPlayoffSortInd('points_against')}` : `PA / Game (PA/G) ${getPlayoffSortInd('pa_ppg')}`;
        const pCol6Key = mode === 'totals' ? 'points_against' : 'pa_ppg';

        const pCol7Label = mode === 'totals' ? `Point Diff ${getPlayoffSortInd('point_diff')}` : `Diff / Game ${getPlayoffSortInd('diff_ppg')}`;
        const pCol7Key = mode === 'totals' ? 'point_diff' : 'diff_ppg';

        const pCol8Label = mode === 'totals' ? `PPG ${getPlayoffSortInd('ppg')}` : `Games ${getPlayoffSortInd('games_count')}`;
        const pCol8Key = mode === 'totals' ? 'ppg' : 'games_count';

        el.innerHTML = `
            ${headerHTML}

            <!-- 1. All-Time Career Playoff Stats Table (Full-Width) -->
            <div class="records-table-wrap">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding:0 4px;">
                    <span style="font-weight:700; font-size:0.9rem; color:var(--text-secondary);">All-Time Championship Bracket Playoff Standings</span>
                    <div class="table-mode-toggle">
                        <button class="table-mode-btn ${mode === 'totals' ? 'active' : ''}" data-section="playoffs" data-mode="totals">Totals</button>
                        <button class="table-mode-btn ${mode === 'ppg' ? 'active' : ''}" data-section="playoffs" data-mode="ppg">Per Game (PPG)</button>
                    </div>
                </div>
                <table class="records-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Manager</th>
                            <th class="records-th-sortable" data-sort="wins">W–L ${getPlayoffSortInd('wins')}</th>
                            <th class="records-th-sortable" data-sort="win_pct">Win % ${getPlayoffSortInd('win_pct')}</th>
                            <th class="records-th-sortable" data-sort="${pCol5Key}">${pCol5Label}</th>
                            <th class="records-th-sortable" data-sort="${pCol6Key}">${pCol6Label}</th>
                            <th class="records-th-sortable" data-sort="${pCol7Key}">${pCol7Label}</th>
                            <th class="records-th-sortable" data-sort="${pCol8Key}">${pCol8Label}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${playoffTableHTML || '<tr><td colspan="8" style="text-align:center;">No playoff data matching filter</td></tr>'}
                    </tbody>
                </table>
            </div>

            <!-- 2. Most Playoff Appearances (Full-Width Card above 5-item grids) -->
            <div class="record-card" style="margin-top: 24px;">
                <div class="record-card-header">
                    <h3>Most Playoff Appearances</h3>
                </div>
                <div class="record-item-list" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; padding: 12px;">
                    ${appearancesList.map((item, idx) => {
                        const rankClass = idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : '';
                        const appRate = Math.round((item.appearances / item.total_seasons) * 100) || 0;
                        return `
                            <div class="record-item" style="border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 12px;">
                                <div class="record-item-left">
                                    <span class="rank-badge ${rankClass}">#${idx + 1}</span>
                                    <div class="record-item-info">
                                        <span class="record-team-name">${item.manager_name}</span>
                                        <div class="record-sub-info">
                                            <span>${item.appearances} of ${item.total_seasons} Seasons</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="record-item-right">
                                    <span class="record-value">${appRate}%</span>
                                </div>
                            </div>
                        `;
                    }).join('') || '<div style="color:var(--text-muted); text-align:center;">No appearances found</div>'}
                </div>
            </div>

            <!-- 3. Five-Item Cards (3-Column Grid) -->
            <div class="records-card-grid-3" style="margin-top: 24px;">
                ${renderSimpleListCard('Longest Playoff Droughts (All-Time)', top5Droughts, d => `${d.length} <small style="font-size:0.7rem; color:var(--text-muted);">Yrs</small>`, d => d.span)}
                ${renderSimpleListCard('Longest Active Playoff Droughts', topActiveDroughts, d => `${d.length} <small style="font-size:0.7rem; color:var(--text-muted);">Yrs</small>`, d => d.span)}
                ${renderSimpleListCard('Longest Playoff Make Streaks (All-Time)', top5Makes, m => `${m.length} <small style="font-size:0.7rem; color:var(--text-muted);">Yrs</small>`, m => m.span)}
                ${renderSimpleListCard('Current Active Playoff Make Streaks', topActiveMakes, m => `${m.length} <small style="font-size:0.7rem; color:var(--text-muted);">Yrs</small>`, m => m.span)}
                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Top 5 Most Dominant Playoff Runs (by PPG)</h3>
                    </div>
                    <div class="record-item-list">
                        ${top5DominantRuns.map((r, i) => renderRunRow(r, i)).join('') || '<div style="color:var(--text-muted); text-align:center;">No runs found</div>'}
                    </div>
                </div>
            </div>

            <!-- 4. Ten-Item Cards (2-Column Grid) -->
            <div class="records-card-grid-2" style="margin-top: 24px;">
                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Top 10 Highest Scoring Playoff Games (Single Team)</h3>
                    </div>
                    <div class="record-item-list">
                        ${top10BestSingle.map((g, i) => renderSingleGameRow(g, i)).join('') || '<div style="color:var(--text-muted); text-align:center;">No games found</div>'}
                    </div>
                </div>

                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Top 10 Worst Scoring Playoff Games (Single Team)</h3>
                    </div>
                    <div class="record-item-list">
                        ${top10WorstSingle.map((g, i) => renderSingleGameRow(g, i)).join('') || '<div style="color:var(--text-muted); text-align:center;">No games found</div>'}
                    </div>
                </div>

                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Top 10 Lowest Scoring Playoff Matchups (Combined)</h3>
                    </div>
                    <div class="record-item-list">
                        ${top10LowestMatchup.map((m, i) => renderMatchupRow(m, i)).join('') || '<div style="color:var(--text-muted); text-align:center;">No matchups found</div>'}
                    </div>
                </div>

                <div class="record-card">
                    <div class="record-card-header">
                        <h3>Top 10 Highest Scoring Playoff Matchups (Combined)</h3>
                    </div>
                    <div class="record-item-list">
                        ${top10HighestMatchup.map((m, i) => renderMatchupRow(m, i)).join('') || '<div style="color:var(--text-muted); text-align:center;">No matchups found</div>'}
                    </div>
                </div>
            </div>
        `;

        this.setupSectionFilterListeners('playoffs', this.renderRecordsSection5_Playoffs);

        // Setup mode toggle listeners for playoff table
        const modeBtns = el.querySelectorAll('.table-mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.recordFilters.playoffs.mode = btn.getAttribute('data-mode');
                this.renderRecordsSection5_Playoffs();
            });
        });

        // Setup sortable table headers for playoff table
        const thList = el.querySelectorAll('.records-th-sortable');
        thList.forEach(th => {
            th.addEventListener('click', () => {
                const col = th.getAttribute('data-sort');
                if (this.playoffsSortBy === col) {
                    this.playoffsSortOrder = this.playoffsSortOrder === 'desc' ? 'asc' : 'desc';
                } else {
                    this.playoffsSortBy = col;
                    this.playoffsSortOrder = 'desc';
                }
                this.renderRecordsSection5_Playoffs();
            });
        });
    }

});
