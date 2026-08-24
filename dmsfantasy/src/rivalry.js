/**
 * Rivalry Week, as Hell / Dungeon Theme (Official Site Implementation)
 * Est. 2027 • Dedicated Thanksgiving Week Rivalries
 */

const TargetApp = (typeof window !== 'undefined' && window.FantasyApp) ? window.FantasyApp : FantasyApp;
TargetApp.prototype.renderRivalryWeek = function() {
    const root = document.getElementById('view-rivalry');
    if (!root) return;

    // Official Rivalry Mapping (Surnames displayed on site, Manager names used for data matching)
    const RIVALRY_PAIRS = [
        {
            id: 'raufman_fey',
            surname1: 'RAUFMAN',
            surname2: 'FEY',
            manager1: 'Benjamin',
            manager2: 'Jake',
            writeup: 'A former double champion struggling in a new era. A perennial contender - and one-time champ - riding a five-season playoff streak. Both men who never once have admitted defeat. The championships were promised to them 3000 years ago. Two men fighting a holy war every year over the same religion - fantasy football. It doesn\'t get much better than this. Ben vs. Jake.'
        },
        {
            id: 'stamatos_gutberlet',
            surname1: 'STAMATOS',
            surname2: 'GUTBERLET',
            manager1: 'Mike',
            manager2: 'Luke',
            writeup: 'It\'s on sight. Their blood stains the walls of the groupchat. Vicious battles where nothing is below the belt and nothing is off limits. Friends in the offseason. It all dissapears with the opening kickoff. To paraphrase a great double champion - "When you lose I celebrate". One looking for a record-breaking third ring. The other just wanting a playoff win. Mike vs. Luke.'
        },
        {
            id: 'katz_frey',
            surname1: 'KATZ',
            surname2: 'FREY',
            manager1: 'Landon',
            manager2: 'Alex',
            writeup: 'Polar opposites in record. One is 72-54 all time. The other is 54-72. But who cares? What really matters is trophies. Championships. They define your legacy. And in terms of trophies, both men are tied. The quest for a second ring. Landon vs. Alex'
        },
        {
            id: 'watson_boice',
            surname1: 'WATSON',
            surname2: 'BOICE',
            manager1: 'Madoc',
            manager2: 'Ryan',
            writeup: 'Ryan is the type of person who thinks everything is sunshine and rainbows - and for good reason. His handicap is low, his football team is good, and he was able to make a serious contender in year two as a member of the DMS Fantasy league. Madoc sees the world in a melancholy gray and thrives on the sadness of others - and nothing would make him happier than taking Ryan and his squad out behind the woodshed on a yearly basis. Madoc vs. Ryan. '
        },
        {
            id: 'lehmann_sabatino',
            surname1: 'LEHMANN',
            surname2: 'SABATINO',
            manager1: 'Will',
            manager2: 'Isabella',
            writeup: '2021. The Championship. Kamara’s 54.7. Losing by less than two points. No playoff wins since. How does one break the curse of AK? Maybe by demolishing the one it all started against - a double champion who elevates come playoff time, with a ridiculous 6-1 record in the big games. Isabella vs. Will.'
        },
        {
            id: 'glikin_beck',
            surname1: 'GLIKIN',
            surname2: 'BECK',
            manager1: 'Carson',
            manager2: 'Jordan',
            writeup: 'It feels like one of these two are due. Both longtime league members. Both never won the big game. Both had years where it just slipped away. Completely different styles of coaching - one likes sticking with his guys, while the other will literally trade anything that’s not nailed down - and rip the nails out if he so chooses. Always a fun one. Jordan vs. Carson.'
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
            <div class="dungeon-masthead" style="position: relative;">
                <h1 class="dungeon-main-title">Rivalry Week</h1>
                <blockquote class="dungeon-quote">
                    <p>Were half to half the world by the ears and he.</p>
                    <p>Upon my party, I'ld revolt to make</p>
                    <p>Only my wars with him: he is a lion</p>
                    <p>That I am proud to hunt.</p>
                </blockquote>
                <div class="dungeon-quote-credit">— William Shakespeare, <em>Coriolanus</em></div>
                <p class="dungeon-subtitle">
                    Starting in the 2026-2027 season, every manager is bound to an eternal rival. Contested annually during the week of Thanksgiving, where rivalry records are carved in stone forever.
                </p>

                <!-- Commissioner Intro Box -->
                <div class="dungeon-mike-box">
                    <span class="dungeon-box-tag">MIKE'S MANIFESTO</span>
                    <p>"I have no enemies" is what I would say if I had no enemies. But everyone has enemies. Opps. Rivals. And for the first time in the history of the Dumbarton fantasy football league, we'll have a week dedicated to that feeling in your chest that you get when you see their team name across from yours in the Yahoo matchups page. It just means more. This is rivalry week.</p>
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
                    <!-- Card Header: Concept 5 Hybrid Clash Title -->
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

                    <!-- Mike's Blurb Placeholder Above Matchups -->
                    <div class="dungeon-blurb-box">
                        <span class="dungeon-blurb-label">Mike's Rivalry Feud Chronicle</span>
                        <div class="dungeon-blurb-text">
                            ${rivalry.writeup || ''}
                        </div>
                    </div>
                </div>

                <div>
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

                    <button class="dungeon-btn-view" onclick="FantasyApp.toggleRivalryDrawer(this)">
                        View Rivalry Matchups
                    </button>
                    <div class="dungeon-matchups-drawer">
                        <div class="dungeon-matchups-drawer-inner">
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
                        <div class="dungeon-matchup-score">${m.team_1_name} ${s1.toFixed(2)} vs ${s2.toFixed(2)} ${m.team_2_name}</div>
                    </div>
                `;
            });
            html += `</div>`;
        }

        html += `
                        </div>
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

    // Equalize card heights so all cards in each visual row match,
    // but without grid stretch (so opening a drawer won't shift siblings).
    requestAnimationFrame(() => {
        const cards = root.querySelectorAll('.dungeon-card');
        // Reset first so we measure natural heights
        cards.forEach(c => c.style.minHeight = '');
        // Group cards into rows by their top offset
        const rows = {};
        cards.forEach(c => {
            const top = c.getBoundingClientRect().top;
            const key = Math.round(top);
            if (!rows[key]) rows[key] = [];
            rows[key].push(c);
        });
        // Set each row's cards to the tallest card in that row
        Object.values(rows).forEach(row => {
            const maxH = Math.max(...row.map(c => c.offsetHeight));
            row.forEach(c => c.style.minHeight = maxH + 'px');
        });
    });
};

// Toggle handler for rivalry matchups drawer
TargetApp.toggleRivalryDrawer = function(btn) {
    const drawer = btn.nextElementSibling;
    if (!drawer) return;
    const isOpen = drawer.classList.toggle('open');
    btn.textContent = isOpen ? 'Hide Rivalry Matchups' : 'View Rivalry Matchups';
};
