// scripts/patch_newsletter_triggers.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const triggersPath = path.join(rootDir, 'src', 'newsletter_triggers.js');
let content = fs.readFileSync(triggersPath, 'utf8');

const updatedEval10And11 = `    // ==========================================
    // MODULE 10 EVALUATION: DEEP LORE & MILESTONES
    // ==========================================
    evaluateModule10(candidates, currentMatchups, currentStats) {
        // 10.1 Century Club: career regular season PF & Win Milestones
        const careerPfMap = new Map();
        const careerWinsMap = new Map();

        this.matchups.forEach(m => {
            const isReg = !m.is_playoff && !m.is_playoffs && m.game_type !== 'Championship' && (m.game_type === 'regular_season' || m.game_type === 'Regular Season' || !m.game_type);
            if (isReg) {
                const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                const p1 = Number(m.team_1_actual_points || m.home_score || 0);
                const p2 = Number(m.team_2_actual_points || m.away_score || 0);

                if (m1) {
                    careerPfMap.set(m1, (careerPfMap.get(m1) || 0) + p1);
                    if (p1 > p2) careerWinsMap.set(m1, (careerWinsMap.get(m1) || 0) + 1);
                }
                if (m2) {
                    careerPfMap.set(m2, (careerPfMap.get(m2) || 0) + p2);
                    if (p2 > p1) careerWinsMap.set(m2, (careerWinsMap.get(m2) || 0) + 1);
                }
            }
        });

        careerPfMap.forEach((pf, mid) => {
            const milestones = [8000, 10000, 12000, 14000, 15000, 16000, 18000, 20000];
            
            // Find current week opponent name
            const currentMatchup = currentMatchups.find(m => 
                String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase() === mid || 
                String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase() === mid
            );
            let oppName = 'their opponent';
            if (currentMatchup) {
                const isT1 = String(currentMatchup.team_1_manager_id || currentMatchup.home_manager_id || '').toLowerCase() === mid;
                const oppId = isT1 ? (currentMatchup.team_2_manager_id || currentMatchup.away_manager_id) : (currentMatchup.team_1_manager_id || currentMatchup.home_manager_id);
                oppName = this.getManagerName(oppId);
            }

            milestones.forEach(ms => {
                const diff = ms - pf;
                if (diff > 0 && diff <= 200) {
                    candidates.push({
                        trigger_id: 'CENTURY_CLUB',
                        timing: 'PROSPECTIVE',
                        category: 'ALL_TIME_RECORD',
                        involved_manager_ids: [mid],
                        z_score: 3.5,
                        tokens: {
                            manager_name: this.getManagerName(mid),
                            pts_needed: diff.toFixed(1),
                            milestone_pts: ms.toLocaleString(),
                            career_pf: pf.toFixed(1),
                            opponent_name: oppName,
                            member_rank: 'elite',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.CENTURY_CLUB
                    });
                }
            });
        });
    }

    // ==========================================
    // MODULE 11 EVALUATION: PROSPECTIVE PREVIEWS
    // ==========================================
    evaluateModule11(candidates, currentMatchups, currentStats) {
        // 11.1 Title Defense Kickoff
        const prevSeason = this.season - 1;
        const prevStandings = this.standings.filter(s => Number(s.season || s.year) === prevSeason);
        const champ = prevStandings.find(s => Number(s.rank || s.final_rank) === 1);
        if (champ) {
            const champId = String(champ.manager_id || champ.id).toLowerCase();
            const champMatchup = currentMatchups.find(m => 
                String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === champId || 
                String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === champId
            );
            if (champMatchup) {
                const isT1 = String(champMatchup.team_1_manager_id || champMatchup.home_manager_id).toLowerCase() === champId;
                const oppId = String(isT1 ? (champMatchup.team_2_manager_id || champMatchup.away_manager_id) : (champMatchup.team_1_manager_id || champMatchup.home_manager_id)).toLowerCase();
                
                // Lifetime H2H between champion and challenger
                const lifetimeGames = this.matchups.filter(m => {
                    const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                    const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                    return Number(m.season) < this.season && ((m1 === champId && m2 === oppId) || (m2 === champId && m1 === oppId));
                });
                let wChamp = 0;
                let wChallenger = 0;
                lifetimeGames.forEach(g => {
                    const isC1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === champId;
                    const pC = Number(isC1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                    const pO = Number(isC1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                    if (pC > pO) wChamp++;
                    else if (pO > pC) wChallenger++;
                });
                const h2hRecord = wChallenger > wChamp ? \`\${wChallenger}-\${wChamp}\` : \`\${wChamp}-\${wChallenger}\`;

                // Calculate challenger's Week 1 streak across past completed seasons
                const challengerW1Games = this.matchups.filter(m => {
                    const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                    const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                    return Number(m.season) < this.season && Number(m.week) === 1 && (m1 === oppId || m2 === oppId);
                });
                challengerW1Games.sort((a, b) => Number(b.season) - Number(a.season)); // Descending by season

                let w1LossStreak = 0;
                let lastW1WinYear = null;
                let lastW1WinOpp = null;

                for (const g of challengerW1Games) {
                    const isOppT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === oppId;
                    const pMe = Number(isOppT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                    const pRival = Number(isOppT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                    const won = pMe > pRival;

                    if (!won && lastW1WinYear === null) {
                        w1LossStreak++;
                    } else if (won && lastW1WinYear === null) {
                        lastW1WinYear = Number(g.season);
                        const rivalId = isOppT1 ? (g.team_2_manager_id || g.away_manager_id) : (g.team_1_manager_id || g.home_manager_id);
                        lastW1WinOpp = this.getManagerName(rivalId);
                    }
                }

                const streakPhrase = w1LossStreak >= 3 
                    ? \`a \${w1LossStreak}-year Week 1 losing streak (0-\${w1LossStreak} since \${lastW1WinYear || prevSeason - w1LossStreak + 1})\`
                    : \`a \${w1LossStreak}-game opening-day skid\`;
                const lastWinPhrase = lastW1WinYear ? \`September \${lastW1WinYear} against \${lastW1WinOpp}\` : 'years past';

                candidates.push({
                    trigger_id: 'TITLE_DEFENSE_KICKOFF',
                    timing: 'PROSPECTIVE',
                    category: 'PLAYOFF_LEVERAGE',
                    involved_manager_ids: [champId, oppId],
                    z_score: 3.6,
                    tokens: {
                        champion_name: this.getManagerName(champId),
                        challenger_name: this.getManagerName(oppId),
                        h2h_record: h2hRecord,
                        challenger_w1_streak: streakPhrase,
                        last_w1_win: lastWinPhrase,
                        season: this.season,
                        prev_season: prevSeason,
                        week_num: this.week
                    },
                    templates: TRIGGER_TEMPLATES.TITLE_DEFENSE_KICKOFF
                });
            }
        }

        // 11.2 Marquee Matchup Preview Showdown
        let tightestMatchup = null;
        let minSpread = 999;
        currentMatchups.forEach(m => {
            const p1 = Number(m.team_1_projected_points || m.home_projected || 105);
            const p2 = Number(m.team_2_projected_points || m.away_projected || 105);
            const spread = Math.abs(p1 - p2);
            if (spread < minSpread) {
                minSpread = spread;
                tightestMatchup = m;
            }
        });

        if (tightestMatchup) {
            const p1 = Number(tightestMatchup.team_1_projected_points || tightestMatchup.home_projected || 105);
            const p2 = Number(tightestMatchup.team_2_projected_points || tightestMatchup.away_projected || 105);
            const isFav1 = p1 >= p2;
            const favId = isFav1 ? (tightestMatchup.team_1_manager_id || tightestMatchup.home_manager_id) : (tightestMatchup.team_2_manager_id || tightestMatchup.away_manager_id);
            const dogId = isFav1 ? (tightestMatchup.team_2_manager_id || tightestMatchup.away_manager_id) : (tightestMatchup.team_1_manager_id || tightestMatchup.home_manager_id);
            const favProj = Math.max(p1, p2).toFixed(1);
            const dogProj = Math.min(p1, p2).toFixed(1);
            const spread = minSpread.toFixed(1);
            const gameTotal = (p1 + p2).toFixed(1);

            // Compute lifetime H2H and count of games decided by <= 5 points
            const pastH2h = this.matchups.filter(m => {
                const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                return Number(m.season) < this.season && ((m1 === String(favId).toLowerCase() && m2 === String(dogId).toLowerCase()) || (m2 === String(favId).toLowerCase() && m1 === String(dogId).toLowerCase()));
            });

            let wFav = 0;
            let wDog = 0;
            let closeGamesCount = 0;
            pastH2h.forEach(g => {
                const isFavT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === String(favId).toLowerCase();
                const pF = Number(isFavT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                const pD = Number(isFavT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                if (pF > pD) wFav++;
                else if (pD > pF) wDog++;
                if (Math.abs(pF - pD) <= 5.0 && pF > 0 && pD > 0) closeGamesCount++;
            });

            const h2hRecord = \`\${wFav}-\${wDog}\`;
            const closeGamesPhrase = closeGamesCount >= 2 
                ? \`\${closeGamesCount} career meetings decided by five points or fewer\`
                : 'multiple hard-fought battles decided in the final minutes';

            candidates.push({
                trigger_id: 'MATCHUP_PREVIEW_SHOWDOWN',
                timing: 'PROSPECTIVE',
                category: 'RIVALRY',
                involved_manager_ids: [favId, dogId],
                z_score: Math.max(2.4, 3.3 - minSpread * 0.15),
                tokens: {
                    favorite_name: this.getManagerName(favId),
                    underdog_name: this.getManagerName(dogId),
                    fav_proj: favProj,
                    dog_proj: dogProj,
                    spread,
                    game_total: gameTotal,
                    h2h_record: h2hRecord,
                    close_games: closeGamesPhrase,
                    week_num: this.week
                },
                templates: TRIGGER_TEMPLATES.MATCHUP_PREVIEW_SHOWDOWN
            });
        }

        // 11.3 Revenge Game Radar
        currentMatchups.forEach(m => {
            const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            const pastH2h = this.matchups.filter(oldM => 
                Number(oldM.season) < this.season &&
                ((String(oldM.team_1_manager_id || oldM.home_manager_id).toLowerCase() === m1 && String(oldM.team_2_manager_id || oldM.away_manager_id).toLowerCase() === m2) ||
                 (String(oldM.team_2_manager_id || oldM.away_manager_id).toLowerCase() === m1 && String(oldM.team_1_manager_id || oldM.home_manager_id).toLowerCase() === m2))
            );
            if (pastH2h.length >= 4) {
                pastH2h.sort((a, b) => (Number(b.season) - Number(a.season)) || (Number(b.week) - Number(a.week)));
                let w1 = 0, w2 = 0;
                let sum1 = 0, sum2 = 0;
                let lastResultPhrase = '';

                pastH2h.forEach((g, idx) => {
                    const isT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === m1;
                    const pMe = Number(isT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                    const pOpp = Number(isT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                    sum1 += pMe;
                    sum2 += pOpp;
                    if (pMe > pOpp) w1++;
                    else if (pOpp > pMe) w2++;

                    if (idx === 0) {
                        lastResultPhrase = \`a \${Math.max(pMe, pOpp).toFixed(1)} to \${Math.min(pMe, pOpp).toFixed(1)} victory last December\`;
                    }
                });

                const marginPpg = Math.abs((sum1 - sum2) / pastH2h.length).toFixed(1);

                if (w2 > w1 && (w2 - w1) >= 2) {
                    candidates.push({
                        trigger_id: 'REVENGE_GAME_RADAR',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [m1, m2],
                        z_score: 2.5 + (w2 - w1) * 0.15,
                        tokens: {
                            avenger_name: this.getManagerName(m1),
                            target_name: this.getManagerName(m2),
                            h2h_record: \`\${w1}-\${w2}\`,
                            h2h_losses: w2,
                            margin_ppg: marginPpg,
                            last_margin: lastResultPhrase || 'their most recent matchup',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.REVENGE_GAME_RADAR
                    });
                } else if (w1 > w2 && (w1 - w2) >= 2) {
                    candidates.push({
                        trigger_id: 'REVENGE_GAME_RADAR',
                        timing: 'PROSPECTIVE',
                        category: 'RIVALRY',
                        involved_manager_ids: [m2, m1],
                        z_score: 2.5 + (w1 - w2) * 0.15,
                        tokens: {
                            avenger_name: this.getManagerName(m2),
                            target_name: this.getManagerName(m1),
                            h2h_record: \`\${w2}-\${w1}\`,
                            h2h_losses: w1,
                            margin_ppg: marginPpg,
                            last_margin: lastResultPhrase || 'their most recent matchup',
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.REVENGE_GAME_RADAR
                    });
                }
            }
        });

        // 11.4 Franchise Cornerstone Clash (Low Priority Fallback)
        const seasonDraft = this.draftResults.filter(d => Number(d.season || d.year) === this.season);
        const round1Picks = seasonDraft.filter(d => Number(d.round) === 1 || Number(d.overall_pick || d.pick) <= 12);
        currentMatchups.forEach(m => {
            const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            const pick1 = round1Picks.find(p => String(p.manager_id).toLowerCase() === m1);
            const pick2 = round1Picks.find(p => String(p.manager_id).toLowerCase() === m2);
            if (pick1 && pick2) {
                candidates.push({
                    trigger_id: 'CORNERSTONE_CLASH',
                    timing: 'PROSPECTIVE',
                    category: 'DRAFT_LORE',
                    involved_manager_ids: [m1, m2],
                    z_score: 1.1,
                    tokens: {
                        manager_a: this.getManagerName(m1),
                        player_a: pick1.player_name,
                        manager_b: this.getManagerName(m2),
                        player_b: pick2.player_name,
                        week_num: this.week
                    },
                    templates: TRIGGER_TEMPLATES.CORNERSTONE_CLASH
                });
            }
        });

        // 11.5 Draft Stack Dependency
        this.managers.forEach(mgr => {
            const mid = String(mgr.id || mgr.manager_id).toLowerCase();
            const myStarters = currentStats.filter(s => String(s.manager_id).toLowerCase() === mid && s.is_starter);
            const qb = myStarters.find(s => s.roster_slot === 'QB' || s.position === 'QB');
            if (qb && qb.nfl_team) {
                const stackPartners = myStarters.filter(s => s !== qb && s.nfl_team === qb.nfl_team && (s.position === 'WR' || s.position === 'TE' || s.roster_slot === 'WR' || s.roster_slot === 'TE' || s.roster_slot === 'W/R/T'));
                if (stackPartners.length > 0) {
                    const partner = stackPartners[0];
                    const oppMatchup = currentMatchups.find(m => 
                        String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid || 
                        String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid
                    );
                    let oppName = 'their opponent';
                    if (oppMatchup) {
                        const isT1 = String(oppMatchup.team_1_manager_id || oppMatchup.home_manager_id).toLowerCase() === mid;
                        const oppId = isT1 ? (oppMatchup.team_2_manager_id || oppMatchup.away_manager_id) : (oppMatchup.team_1_manager_id || oppMatchup.home_manager_id);
                        oppName = this.getManagerName(oppId);
                    }

                    candidates.push({
                        trigger_id: 'DRAFT_STACK_DEPENDENCY',
                        timing: 'PROSPECTIVE',
                        category: 'SITUATIONAL',
                        involved_manager_ids: [mid],
                        z_score: 2.2,
                        tokens: {
                            manager_name: this.getManagerName(mid),
                            qb_name: qb.player_name,
                            pass_catcher: partner.player_name,
                            nfl_team: NFL_TEAM_NAMES[normalizeTeamAbbr(qb.nfl_team)] || qb.nfl_team,
                            opponent_name: oppName,
                            week_num: this.week
                        },
                        templates: TRIGGER_TEMPLATES.DRAFT_STACK_DEPENDENCY
                    });
                }
            }
        });

        // 11.6 Rookie Gamble Radar (Breaking Veteran Tradition)
        const pastDraftNames = new Set(this.draftResults.filter(d => Number(d.season || d.year) < this.season).map(d => normalizeName(d.player_name)));
        this.managers.forEach(mgr => {
            const mid = String(mgr.id || mgr.manager_id).toLowerCase();
            const myStarters = currentStats.filter(s => String(s.manager_id).toLowerCase() === mid && s.is_starter);
            const rookieStarters = myStarters.filter(s => s.position !== 'DEF' && s.position !== 'K' && !pastDraftNames.has(normalizeName(s.player_name)));
            if (rookieStarters.length > 0) {
                const rookie = rookieStarters[0];
                const rPos = rookie.position || rookie.roster_slot || 'RB';

                // Check historical Week 1 rookie starts for this manager at this position
                const pastW1StartsAtPos = this.playerStats.filter(s => 
                    String(s.manager_id).toLowerCase() === mid &&
                    Number(s.season) < this.season &&
                    Number(s.week) === 1 &&
                    s.is_starter &&
                    (s.position === rPos || s.roster_slot === rPos)
                );
                const pastRookieW1Starts = pastW1StartsAtPos.filter(s => !pastDraftNames.has(normalizeName(s.player_name)));
                const hasNeverStartedRookie = pastRookieW1Starts.length === 0 && pastW1StartsAtPos.length >= 4;

                const oppMatchup = currentMatchups.find(m => 
                    String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid || 
                    String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid
                );
                let oppName = 'their opponent';
                if (oppMatchup) {
                    const isT1 = String(oppMatchup.team_1_manager_id || oppMatchup.home_manager_id).toLowerCase() === mid;
                    const oppId = isT1 ? (oppMatchup.team_2_manager_id || oppMatchup.away_manager_id) : (oppMatchup.team_1_manager_id || oppMatchup.home_manager_id);
                    oppName = this.getManagerName(oppId);
                }

                candidates.push({
                    trigger_id: 'ROOKIE_GAMBLE_RADAR',
                    timing: 'PROSPECTIVE',
                    category: 'DRAFT_LORE',
                    involved_manager_ids: [mid],
                    z_score: hasNeverStartedRookie ? 2.8 : 2.1,
                    tokens: {
                        manager_name: this.getManagerName(mid),
                        rookie_name: rookie.player_name,
                        rookie_pos: rPos,
                        nfl_team: NFL_TEAM_NAMES[normalizeTeamAbbr(rookie.nfl_team)] || rookie.nfl_team,
                        opponent_name: oppName,
                        veteran_years: '2019 to 2026',
                        streak_context: \`zero rookie \${rPos}s started in Week 1 over eight seasons\`,
                        week_num: this.week
                    },
                    templates: TRIGGER_TEMPLATES.ROOKIE_GAMBLE_RADAR
                });
            }
        });

        // 11.7 Preseason LPI Title Favorite & 11.8 Sacko Hazard
        const teamProjs = [];
        currentMatchups.forEach(m => {
            const t1Id = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
            const t2Id = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
            if (t1Id) teamProjs.push({ id: t1Id, proj: Number(m.team_1_projected_points || m.home_projected || 105) });
            if (t2Id) teamProjs.push({ id: t2Id, proj: Number(m.team_2_projected_points || m.away_projected || 105) });
        });
        teamProjs.sort((a, b) => b.proj - a.proj);

        if (teamProjs.length >= 4) {
            const topTeam = teamProjs[0];
            const secondTeam = teamProjs[1];
            const bottomTeam = teamProjs[teamProjs.length - 1];
            const secondBottom = teamProjs[teamProjs.length - 2];

            candidates.push({
                trigger_id: 'LPI_PRESEASON_FAVORITE',
                timing: 'PROSPECTIVE',
                category: 'PLAYOFF_LEVERAGE',
                involved_manager_ids: [topTeam.id],
                z_score: 2.6,
                tokens: {
                    favorite_name: this.getManagerName(topTeam.id),
                    proj_ppg: topTeam.proj.toFixed(1),
                    title_prob: '22.4',
                    runner_up_name: this.getManagerName(secondTeam.id),
                    season: this.season
                },
                templates: TRIGGER_TEMPLATES.LPI_PRESEASON_FAVORITE
            });

            candidates.push({
                trigger_id: 'LPI_SACKO_HAZARD',
                timing: 'PROSPECTIVE',
                category: 'PLAYOFF_LEVERAGE',
                involved_manager_ids: [bottomTeam.id],
                z_score: 2.4,
                tokens: {
                    manager_name: this.getManagerName(bottomTeam.id),
                    sacko_prob: '26.8',
                    proj_ppg: bottomTeam.proj.toFixed(1),
                    rival_name: this.getManagerName(secondBottom.id),
                    season: this.season
                },
                templates: TRIGGER_TEMPLATES.LPI_SACKO_HAZARD
            });
        }

        // 11.9 Preseason Fandom Treason Alert
        this.managers.forEach(mgr => {
            const mid = String(mgr.id || mgr.manager_id).toLowerCase();
            const favTeam = this.getManagerTeam(mid);
            if (!favTeam) return;
            const myDiv = NFL_DIVISIONS[favTeam];
            if (!myDiv) return;

            const myStarters = currentStats.filter(s => String(s.manager_id).toLowerCase() === mid && s.is_starter);
            const rivalStarters = myStarters.filter(s => {
                const t = normalizeTeamAbbr(s.nfl_team);
                return t && t !== favTeam && NFL_DIVISIONS[t] === myDiv;
            });

            if (rivalStarters.length > 0) {
                const star = rivalStarters[0];
                const divRivalAbbr = normalizeTeamAbbr(star.nfl_team);
                candidates.push({
                    trigger_id: 'PRESEASON_TREASON_ALERT',
                    timing: 'PROSPECTIVE',
                    category: 'FANDOM_TREASON',
                    involved_manager_ids: [mid],
                    z_score: 2.6,
                    tokens: {
                        manager_name: this.getManagerName(mid),
                        fan_team: NFL_TEAM_NAMES[favTeam] || favTeam,
                        div_rival: NFL_TEAM_NAMES[divRivalAbbr] || divRivalAbbr,
                        rival_star: star.player_name,
                        week_num: this.week
                    },
                    templates: TRIGGER_TEMPLATES.PRESEASON_TREASON_ALERT
                });
            }
        });

        // 11.10 Historical Week 1 Streaks (The September Hex & Specialists)
        if (this.week === 1) {
            this.managers.forEach(mgr => {
                const mid = String(mgr.id || mgr.manager_id).toLowerCase();
                const pastW1 = this.matchups.filter(m => {
                    const m1 = String(m.team_1_manager_id || m.home_manager_id || '').toLowerCase();
                    const m2 = String(m.team_2_manager_id || m.away_manager_id || '').toLowerCase();
                    return Number(m.season) < this.season && Number(m.week) === 1 && (m1 === mid || m2 === mid);
                });

                if (pastW1.length >= 4) {
                    pastW1.sort((a, b) => Number(b.season) - Number(a.season)); // Most recent first
                    let wCount = 0;
                    let lCount = 0;
                    pastW1.forEach(g => {
                        const isT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === mid;
                        const pMe = Number(isT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                        const pOpp = Number(isT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                        if (pMe > pOpp) wCount++;
                        else if (pOpp > pMe) lCount++;
                    });

                    // Check active losing streak from most recent season
                    let streakLen = 0;
                    let lastWinYear = null;
                    let lastWinOpp = null;
                    for (const g of pastW1) {
                        const isT1 = String(g.team_1_manager_id || g.home_manager_id).toLowerCase() === mid;
                        const pMe = Number(isT1 ? (g.team_1_actual_points || g.home_score) : (g.team_2_actual_points || g.away_score)) || 0;
                        const pOpp = Number(isT1 ? (g.team_2_actual_points || g.away_score) : (g.team_1_actual_points || g.home_score)) || 0;
                        const won = pMe > pOpp;
                        if (!won && lastWinYear === null) {
                            streakLen++;
                        } else if (won && lastWinYear === null) {
                            lastWinYear = Number(g.season);
                            const oppId = isT1 ? (g.team_2_manager_id || g.away_manager_id) : (g.team_1_manager_id || g.home_manager_id);
                            lastWinOpp = this.getManagerName(oppId);
                        }
                    }

                    if (streakLen >= 3) {
                        const oppMatchup = currentMatchups.find(m => 
                            String(m.team_1_manager_id || m.home_manager_id).toLowerCase() === mid || 
                            String(m.team_2_manager_id || m.away_manager_id).toLowerCase() === mid
                        );
                        let curOppName = 'their opponent';
                        if (oppMatchup) {
                            const isT1 = String(oppMatchup.team_1_manager_id || oppMatchup.home_manager_id).toLowerCase() === mid;
                            const oppId = isT1 ? (oppMatchup.team_2_manager_id || oppMatchup.away_manager_id) : (oppMatchup.team_1_manager_id || oppMatchup.home_manager_id);
                            curOppName = this.getManagerName(oppId);
                        }

                        candidates.push({
                            trigger_id: 'WEEK1_HISTORICAL_STREAK',
                            timing: 'PROSPECTIVE',
                            category: 'ALL_TIME_RECORD',
                            involved_manager_ids: [mid],
                            z_score: 3.3,
                            tokens: {
                                manager_name: this.getManagerName(mid),
                                streak_len: streakLen,
                                start_year: (this.season - streakLen),
                                last_win_year: lastWinYear || (this.season - streakLen - 1),
                                last_win_opp: lastWinOpp || 'their opponent',
                                opponent_name: curOppName,
                                w1_record: \`\${wCount}-\${lCount}\`,
                                week_num: this.week
                            },
                            templates: TRIGGER_TEMPLATES.WEEK1_HISTORICAL_STREAK
                        });
                    }
                }
            });
        }
    }
`;

const mod10Start = content.indexOf('    evaluateModule10(');
const standingsCalcStart = content.indexOf('    // Standings calculation helper');

if (mod10Start !== -1 && standingsCalcStart !== -1) {
  content = content.substring(0, mod10Start) + updatedEval10And11 + content.substring(standingsCalcStart);
  fs.writeFileSync(triggersPath, content, 'utf8');
  console.log('Successfully patched Module 10 and 11 in newsletter_triggers.js');
} else {
  console.error('Could not locate module 10 and standings start positions!');
}
