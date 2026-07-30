/**
 * Rivalry Week — Hell / Dungeon Theme (Official Site Implementation)
 * Est. 2027 • Dedicated Thanksgiving Week Rivalries
 */

FantasyApp.prototype.renderRivalryWeek = function() {
    const root = document.getElementById('view-rivalry');
    if (!root) return;

    // Official Rivalry Mapping (Surnames displayed on site, Manager names used for data matching)
    const RIVALRY_PAIRS = [
        {
            id: 'raufman_fey',
            surname1: 'RAUFMAN',
            surname2: 'FEY',
            manager1: 'Benjamin',
            manager2: 'Jake'
        },
        {
            id: 'stamatos_gutberlet',
            surname1: 'STAMATOS',
            surname2: 'GUTBERLET',
            manager1: 'Mike',
            manager2: 'Luke'
        },
        {
            id: 'katz_frey',
            surname1: 'KATZ',
            surname2: 'FREY',
            manager1: 'Landon',
            manager2: 'Alex'
        },
        {
            id: 'watson_boice',
            surname1: 'WATSON',
            surname2: 'BOICE',
            manager1: 'Madoc',
            manager2: 'Ryan'
        },
        {
            id: 'lehmann_sabatino',
            surname1: 'LEHMANN',
            surname2: 'SABATINO',
            manager1: 'Will',
            manager2: 'Isabella'
        },
        {
            id: 'glikin_beck',
            surname1: 'GLIKIN',
            surname2: 'BECK',
            manager1: 'Carson',
            manager2: 'Jordan'
        }
    ];

    // Helper: Find all Week 13 (Thanksgiving) rivalry matchups from 2027 onward between these two managers
    const getRivalryHistory = (manager1, manager2) => {
        const matches = [];
        if (!this.matchups) return matches;

        const isMatchup = (m, n1, n2) => {
            const t1 = (m.team_1_name || '').toLowerCase();
            const t2 = (m.team_2_name || '').toLowerCase();
            const id1 = m.team_1_id;
            const id2 = m.team_2_id;

            // Resolve IDs or names
            const mObj1 = this.managers && this.managers.find(mgr => mgr.name.toLowerCase() === n1.toLowerCase() || mgr.id === id1);
            const mObj2 = this.managers && this.managers.find(mgr => mgr.name.toLowerCase() === n2.toLowerCase() || mgr.id === id2);

            const match1 = (mObj1 && mObj1.name.toLowerCase() === n1.toLowerCase()) || t1.includes(n1.toLowerCase());
            const match2 = (mObj2 && mObj2.name.toLowerCase() === n2.toLowerCase()) || t2.includes(n2.toLowerCase());

            return match1 && match2;
        };

        for (const m of this.matchups) {
            if (m.season >= 2027 && m.week === 13) {
                if ((isMatchup(m, manager1, manager2)) || (isMatchup(m, manager2, manager1))) {
                    matches.push(m);
                }
            }
        }
        return matches;
    };

    let html = `
        <div class="rivalry-dungeon-container">
            <!-- Masthead -->
            <div class="dungeon-masthead">
                <div class="dungeon-est-badge">
                    <!-- SVG Iron Chain Icon -->
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 4H8A6 6 0 0 0 8 16H10V14H8A4 4 0 0 1 8 6H10V4M14 20H16A6 6 0 0 0 16 8H14V10H16A4 4 0 0 1 16 18H14V20M8 11H16V13H8V11Z"/>
                    </svg>
                    EST. 2027
                </div>
                <h1 class="dungeon-main-title">Rivalry Week</h1>
                <p style="font-size:0.72rem;color:#9c787b;font-style:italic;margin-bottom:8px;">
                    Mike — please feel free to update the blurb below, it was AI generated. Also mention that it occurs on Thanksgiving rather than Week 13.
                </p>
                <p class="dungeon-subtitle">
                    Forged in fire starting in 2027, every manager is bound to an eternal rival. 
                    Contested annually during Week 13, where rivalry records are etched in stone forever.
                </p>

                <!-- Commissioner Intro Box -->
                <div class="dungeon-mike-box">
                    <span class="dungeon-box-tag">RIVALRY WEEK EST. 2027 — COMMISSIONER MANIFESTO</span>
                    <p>[Placeholder for Mike: Write an official league introduction to Rivalry Week here. Declare the pride, blood feud, and eternal bragging rights on the line every November.]</p>
                    <div class="dungeon-mike-note">
                        Note to Mike: You can reorder the rivalry listings on this page as you please. Once games are played, listings will automatically be ordered by the most recent winner.
                    </div>
                </div>
            </div>

            <!-- 6 Rivalries Grid -->
            <div class="dungeon-rivalry-grid">
    `;

    RIVALRY_PAIRS.forEach((rivalry, idx) => {
        const history = getRivalryHistory(rivalry.manager1, rivalry.manager2);

        let wins1 = 0;
        let wins2 = 0;
        let pts1 = 0.0;
        let pts2 = 0.0;

        history.forEach(m => {
            const isTeam1Left = (m.team_1_name || '').toLowerCase().includes(rivalry.manager1.toLowerCase()) || 
                                (this.getManagerNameById && this.getManagerNameById(m.team_1_id).toLowerCase() === rivalry.manager1.toLowerCase());

            const score1 = isTeam1Left ? (m.team_1_score || 0) : (m.team_2_score || 0);
            const score2 = isTeam1Left ? (m.team_2_score || 0) : (m.team_1_score || 0);

            pts1 += score1;
            pts2 += score2;

            if (score1 > score2) wins1++;
            else if (score2 > score1) wins2++;
        });

        html += `
            <div class="dungeon-card">
                <div>
                    <!-- Card Header: Title spans 100% width across the top, zero extra tags -->
                    <div class="dungeon-card-header">
                        <div class="dungeon-rivalry-title">${rivalry.surname1} vs. ${rivalry.surname2}</div>
                    </div>

                    <!-- Mike's Blurb Placeholder Above Matchups -->
                    <div class="dungeon-blurb-box">
                        <span class="dungeon-blurb-label">Mike's Rivalry Feud Chronicle</span>
                        <div class="dungeon-blurb-text">
                            [Placeholder for Mike: Write a short chronicle of the ${rivalry.surname1} vs. ${rivalry.surname2} blood feud and rivalry history...]
                        </div>
                    </div>

                    <!-- Prominent Record & Points Highlight -->
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
                </div>

                <div>
                    <button class="dungeon-btn-view" onclick="FantasyApp.toggleRivalryDrawer(this)">
                        View Rivalry Matchups
                    </button>
                    <div class="dungeon-matchups-drawer">
        `;

        if (history.length === 0) {
            html += `
                <div class="dungeon-inaugural-banner">
                    <strong>Inaugural Matchup: 2027 Season</strong>
                    No annual rivalry games contested yet. Future scores, winners, and boxscores will appear here automatically starting in 2027.
                </div>
            `;
        } else {
            html += `<div class="dungeon-matchup-list">`;
            history.forEach(m => {
                const s1 = m.team_1_score || 0;
                const s2 = m.team_2_score || 0;
                html += `
                    <div class="dungeon-matchup-row" onclick="window.app && window.app.openBoxscoreModal(${m.season}, ${m.week}, ${m.team_1_id}, ${m.team_2_id})">
                        <div class="dungeon-matchup-year">${m.season} Week ${m.week}</div>
                        <div class="dungeon-matchup-score">${m.team_1_name} ${s1.toFixed(2)} — ${s2.toFixed(2)} ${m.team_2_name}</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
        </div>
    `;

    root.innerHTML = html;
};

// Toggle handler for rivalry matchups drawer
FantasyApp.toggleRivalryDrawer = function(btn) {
    const drawer = btn.nextElementSibling;
    if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        btn.textContent = 'View Rivalry Matchups';
    } else if (drawer) {
        drawer.classList.add('open');
        btn.textContent = 'Hide Rivalry Matchups';
    }
};
