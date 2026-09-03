/**
 * Landon Draft Index (LDI) Engine
 * Full implementation according to landon_draft_index_framework.md
 * Sole source of truth:
 * - 4 GAM Curve Families fit as PER-GAME RATES (Positional, VORP, T_bust, Floor-PPG)
 * - Effective_games scaling for E_adj and SD_pts (Section 4.3, 4.4)
 * - Full-season G scaling for Replacement Level and VORP (Section 4.6)
 * - Genuine Two-Stage Consistency Classification (Gate -> Reliable Starter Check) (Section 4.7)
 * - Dynamic & Flat Multiplier Modes gated strictly on Adjusted > 0 (Section 4.8)
 * - Composite LDI_raw = alpha * Adjusted_final + (1 - alpha) * VORP_z (Section 4.9)
 * - Equal-weight Manager Rollup & Empirical Percentile Display (Sections 5, 6)
 * - Exactly two UI pills (Consistent with Booms / Inconsistent Producer) (Section 7)
 */

import ldiModelData from './ldi_model_data.json' with { type: 'json' };

// High-precision standard normal Cumulative Distribution Function Phi(x)
export function standardNormalCdf(x) {
    if (x === null || x === undefined || isNaN(x)) return 0.5;
    // Error function approximation (Abramowitz & Stegun 7.1.26)
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2.0);

    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

    return 0.5 * (1.0 + sign * y);
}

// Acklam's algorithm for Inverse Standard Normal CDF (Probit transform: Phi^-1(p))
export function inverseStandardNormalCdf(p) {
    if (p === null || p === undefined || isNaN(p)) return 0.0;
    if (p <= 0.0001) return -3.719;
    if (p >= 0.9999) return 3.719;

    const a = [
        -3.969683028665376e+01,
         2.209460984245205e+02,
        -2.759285104469687e+02,
         1.383577518672690e+02,
        -3.066479806614716e+01,
         2.506628277459239e+00
    ];
    const b = [
        -5.447609879822406e+01,
         1.615858368580409e+02,
        -1.556989798598866e+02,
         6.680131188771972e+01,
        -1.328068155288572e+01
    ];
    const c = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e+00,
        -2.549732539343734e+00,
         4.374664141464968e+00,
         2.938163982698783e+00
    ];
    const d = [
         7.784695709041462e-03,
         3.224671290700398e-01,
         2.445134137142996e+00,
         3.754408661907416e+00
    ];

    const p_low = 0.02425;
    const p_high = 1.0 - p_low;

    if (p < p_low) {
        const q = Math.sqrt(-2.0 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
               ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0);
    }
    if (p > p_high) {
        const q = Math.sqrt(-2.0 * Math.log(1.0 - p));
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1.0);
    }

    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1.0);
}

export function normalizeName(name) {
    if (!name) return '';
    return String(name)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export class LDIEngine {
    constructor(modelData = ldiModelData) {
        this.model = modelData || ldiModelData;
        this.posCurves = this.model?.pos_curves || {};
        this.vorpCurves = this.model?.vorp_curves || {};
        this.tBustTables = this.model?.t_bust_tables || {};
        this.concentrationDistributions = this.model?.concentration_distributions || {};
        this.floorPpgDistributions = this.model?.floor_ppg_distributions || {};
        this.stage1FlaggedPercentiles = this.model?.stage1_flagged_percentiles || [];
        this.pooledManagerScores = this.model?.pooled_manager_scores || [];
        this.weeklyLogsCache = this.model?.weekly_logs_cache || {};

        // Founder Tuning Parameters (Final Calibrated Parameters)
        this.params = {
            lambda: this.model?.defaults?.lambda ?? 0.60,
            alpha: this.model?.defaults?.alpha ?? 0.85,
            sensitivity: this.model?.defaults?.sensitivity ?? 0.85,
            reliable_starter_threshold: this.model?.defaults?.reliable_starter_threshold ?? 20,
            mode: this.model?.defaults?.mode ?? 'dynamic', // 'dynamic' | 'flat'
            penalty_intensity: this.model?.defaults?.penalty_intensity ?? 1.5,
            penalty_cap: this.model?.defaults?.penalty_cap ?? 0.25,
            reward_intensity: this.model?.defaults?.reward_intensity ?? 2.5,
            reward_cap: this.model?.defaults?.reward_cap ?? 0.50,
            mu_penalty: this.model?.defaults?.mu_penalty ?? 0.70,
            mu_reward: this.model?.defaults?.mu_reward ?? 1.20,
            games_missed_threshold: this.model?.defaults?.games_missed_threshold ?? 4,
            min_games_for_pill: this.model?.defaults?.min_games_for_pill ?? 4
        };

        this.listeners = new Set();
    }

    // Subscribe to tuning parameter changes
    subscribe(callback) {
        if (typeof callback === 'function') {
            this.listeners.add(callback);
        }
        return () => this.listeners.delete(callback);
    }

    notifyListeners() {
        this.listeners.forEach(cb => {
            try {
                cb(this.params);
            } catch (e) {
                console.error('[LDIEngine] Listener error:', e);
            }
        });
    }

    updateParams(newParams) {
        this.params = { ...this.params, ...newParams };
        this.notifyListeners();
    }

    resetDefaults() {
        this.params = {
            lambda: this.model?.defaults?.lambda ?? 0.60,
            alpha: this.model?.defaults?.alpha ?? 0.85,
            sensitivity: this.model?.defaults?.sensitivity ?? 0.85,
            reliable_starter_threshold: this.model?.defaults?.reliable_starter_threshold ?? 20,
            mode: this.model?.defaults?.mode ?? 'dynamic',
            penalty_intensity: this.model?.defaults?.penalty_intensity ?? 1.5,
            penalty_cap: this.model?.defaults?.penalty_cap ?? 0.25,
            reward_intensity: this.model?.defaults?.reward_intensity ?? 2.5,
            reward_cap: this.model?.defaults?.reward_cap ?? 0.50,
            mu_penalty: this.model?.defaults?.mu_penalty ?? 0.70,
            mu_reward: this.model?.defaults?.mu_reward ?? 1.20,
            games_missed_threshold: this.model?.defaults?.games_missed_threshold ?? 4,
            min_games_for_pill: this.model?.defaults?.min_games_for_pill ?? 4
        };
        this.notifyListeners();
    }

    // Section 3.1: Positional Rate Curves E_pts_per_game(P_r) & SD_pts_per_game(P_r)
    getPosExpectedRate(pos, rank) {
        const m = this.posCurves[pos];
        if (!m || !m.E_pts_per_game || m.E_pts_per_game.length === 0) {
            return { eRate: 8.0, sdRate: 3.5, isOutOfRange: false };
        }
        const r = Math.max(1.0, Math.min(Number(rank) || 1.0, 60.0));
        const idx = Math.floor(r) - 1;
        const frac = r - Math.floor(r);
        const isOutOfRange = Number(rank) > (m.max_observed_rank || 50);

        if (idx >= 59) {
            return {
                eRate: m.E_pts_per_game[59],
                sdRate: m.SD_pts_per_game[59],
                isOutOfRange
            };
        }

        const eRate = m.E_pts_per_game[idx] * (1 - frac) + m.E_pts_per_game[idx + 1] * frac;
        const sdRate = m.SD_pts_per_game[idx] * (1 - frac) + m.SD_pts_per_game[idx + 1] * frac;

        return { eRate, sdRate, isOutOfRange };
    }

    // Section 3.2: Overall-Slot VORP Curves V_expected_per_game(P_overall) & SD_VORP_per_game(P_overall)
    getVorpExpectedRate(overallPick) {
        const m = this.vorpCurves;
        if (!m || !m.V_expected_per_game || m.V_expected_per_game.length === 0) {
            return { vExpectedRate: 1.0, sdVorpRate: 3.0, isOutOfRange: false };
        }
        const maxPick = m.V_expected_per_game.length;
        const p = Math.max(1.0, Math.min(Number(overallPick) || 1.0, maxPick));
        const idx = Math.floor(p) - 1;
        const frac = p - Math.floor(p);
        const isOutOfRange = Number(overallPick) > (m.max_observed_pick || 180);

        if (idx >= maxPick - 1) {
            return {
                vExpectedRate: m.V_expected_per_game[maxPick - 1],
                sdVorpRate: m.SD_VORP_per_game[maxPick - 1],
                isOutOfRange
            };
        }

        const vExpectedRate = m.V_expected_per_game[idx] * (1 - frac) + m.V_expected_per_game[idx + 1] * frac;
        const sdVorpRate = m.SD_VORP_per_game[idx] * (1 - frac) + m.SD_VORP_per_game[idx + 1] * frac;

        return { vExpectedRate, sdVorpRate, isOutOfRange };
    }

    // Section 3.3 & 8: Concentration-ratio baseline T_bust(position, tier, sensitivity)
    getTBust(pos, gamesPlayed, sensitivity = null) {
        const sens = (sensitivity !== null && sensitivity !== undefined) ? Number(sensitivity) : (this.params.sensitivity ?? 0.85);
        const gp = Number(gamesPlayed) || 16;
        let tierKey = '14-17';
        if (gp <= 8) tierKey = '4-8';
        else if (gp <= 13) tierKey = '9-13';

        const dist = this.concentrationDistributions?.[pos]?.[tierKey];
        if (Array.isArray(dist) && dist.length > 0) {
            const idx = Math.max(0, Math.min(dist.length - 1, Math.round(sens * (dist.length - 1))));
            return dist[idx];
        }

        const tiers = this.tBustTables[pos] || {};
        return tiers[tierKey] ?? 0.70;
    }

    // Section 3.4: Floor-PPG empirical percentile rank lookup
    getFloorPpgPercentile(pos, floorPpg) {
        const pop = this.floorPpgDistributions[pos] || [];
        if (pop.length === 0) return 50.0;
        const val = Number(floorPpg) || 0.0;
        let countLess = 0;
        for (let i = 0; i < pop.length; i++) {
            if (pop[i] < val) countLess++;
            else break;
        }
        return (countLess / pop.length) * 100.0;
    }

    // Section 8 & 9.2: Live as-you-drag reclassification % preview helper
    getReclassificationFraction(threshold) {
        const thresh = Number(threshold) || 50;
        const pcts = this.stage1FlaggedPercentiles;
        if (!pcts || pcts.length === 0) return 50.0;
        const reclassCount = pcts.filter(p => p >= thresh).length;
        return (reclassCount / pcts.length) * 100.0;
    }

    // Lookup weekly logs from precomputed cache
    getPlayerWeeklyLogs(playerName, nflYear) {
        const key = `${normalizeName(playerName)}_${nflYear}`;
        return this.weeklyLogsCache[key] || null;
    }

    /**
     * Score a single pick (Section 4)
     */
    scorePick(pick, settings = {}, tuningOverride = null) {
        const params = tuningOverride ? { ...this.params, ...tuningOverride } : this.params;
        const pos = pick.position || pick.pos;
        const isSkill = ['QB', 'RB', 'WR', 'TE'].includes(pos);

        // K and DST are excluded from LDI scoring (Section 1)
        if (!isSkill) {
            return {
                isScored: false,
                reason: 'K/DST excluded from LDI scoring',
                position: pos,
                overallPickNumber: pick.overall_pick_number || pick.overall_pick || pick.overallPick
            };
        }

        const seasonYear = Number(pick.season_year || pick.year || pick.season || 2024);
        const nflYear = Number(settings.nfl_year || seasonYear);
        const overallPick = Number(pick.overall_pick_number || pick.overall_pick || pick.overallPick || 1);
        const posRank = Number(pick.positional_draft_rank || pick.drafted_pos_num || pick.posRankNum || 1);
        const numTeams = Number(settings.num_teams || settings.numTeams || 12);
        const totalSeasonWeeks = Number(settings.total_season_weeks || (nflYear >= 2021 ? 17 : 16));
        
        // G = total_season_weeks - 1 (subtract exactly one week for bye, Section 4.1; unless in-progress season)
        const isProgress = Boolean(settings.is_in_progress);
        const G = Math.max(1, isProgress ? totalSeasonWeeks : (totalSeasonWeeks - 1));

        // Percentile-normalized positional rank (P_r / num_teams * 12.0, Section 3.1)
        const normPosRank = (posRank / numTeams) * 12.0;

        // Step 4.1: Game availability & weekly logs
        const cachedLogs = this.getPlayerWeeklyLogs(pick.player_name || pick.playerName, nflYear);
        let weeklyPoints = pick.weekly_points || cachedLogs?.weekly_points || [];
        let gamesPlayed = (pick.games_played !== undefined && pick.games_played !== null) ? Number(pick.games_played) : (weeklyPoints.length > 0 ? weeklyPoints.length : (cachedLogs?.games_played ?? 0));
        let gamesMissed = (pick.games_missed !== undefined && pick.games_missed !== null) ? Number(pick.games_missed) : (cachedLogs?.games_missed ?? Math.max(0, G - gamesPlayed));
        let totalPoints = (pick.unwinsorized_points !== undefined && pick.unwinsorized_points !== null) ? Number(pick.unwinsorized_points) : (pick.total_points !== undefined ? Number(pick.total_points) : (cachedLogs?.A_pts ?? 0));

        // Step 10: Player never plays a single game guard
        if (gamesPlayed === 0) {
            gamesMissed = G;
            totalPoints = 0.0;
            weeklyPoints = [];
        }

        if (weeklyPoints.length === 0 && gamesPlayed > 0 && totalPoints > 0) {
            const avgPerGame = totalPoints / gamesPlayed;
            weeklyPoints = Array(gamesPlayed).fill(avgPerGame);
        }

        // Step 4.2: Actual Points A_pts (uncapped sum)
        const A_pts = weeklyPoints.length > 0
            ? weeklyPoints.reduce((sum, pts) => sum + pts, 0)
            : totalPoints;
        const ppg = gamesPlayed > 0 ? (A_pts / gamesPlayed) : 0.0;

        // Step 4.3: Effective games and games-missed-adjusted expected points E_adj
        let Effective_games = G;
        if (gamesPlayed === 0) {
            Effective_games = 0;
        } else if (gamesMissed >= params.games_missed_threshold) {
            Effective_games = G - gamesMissed;
        }

        const { eRate, sdRate, isOutOfRange: posOutOfRange } = this.getPosExpectedRate(pos, normPosRank);
        const E_adj = eRate * Effective_games;

        // Step 4.4: Residual and standardized Z (Section 4.4 - linear scaling for cross-player rate SD)
        const Residual = A_pts - E_adj;
        const SD_pts = Effective_games > 0 ? (sdRate * Effective_games) : 1.0;
        // Edge case: Z is 0 if Effective_games = 0 (Section 10)
        const Z = Effective_games > 0 ? (Residual / SD_pts) : 0.0;

        // Step 4.5: Asymmetry layer
        const Adjusted = Z >= 0 ? Z : (Z * params.lambda);

        // Step 4.6: Replacement level and VORP (always scaled by full season G)
        const startersPos = (pos === 'QB' || pos === 'TE') ? 1 : 2;
        const startersFlex = settings.starters_flex ?? 1;
        const flexSharePos = (pos === 'RB' || pos === 'WR') ? 0.45 : (pos === 'TE' ? 0.10 : 0.0);
        
        let replRank = numTeams * startersPos;
        if (settings.tracks_starting_lineups) {
            replRank = (numTeams * startersPos) + (numTeams * startersFlex * flexSharePos);
        }
        const normReplRank = (replRank / numTeams) * 12.0;
        const { eRate: eReplRate } = this.getPosExpectedRate(pos, normReplRank);
        const replacement_level_points = eReplRate * G;
        const VORP_actual = A_pts - replacement_level_points;

        const { vExpectedRate, sdVorpRate, isOutOfRange: vorpOutOfRange } = this.getVorpExpectedRate(overallPick);
        const V_expected = vExpectedRate * G;
        const SD_VORP = sdVorpRate * G;
        const VORP_z = SD_VORP > 0 ? ((VORP_actual - V_expected) / SD_VORP) : 0.0;

        // Step 4.7: Two-Stage Consistency Classification
        const minGamesForPill = params.min_games_for_pill ?? 4;
        let provisional_flag = 'none';
        let final_label = 'none';
        let C = 0.0;
        let n_top = 0;
        let floorPpg = 0.0;
        let floorPpgPercentile = 0.0;
        let topPoints = 0.0;

        if (gamesPlayed >= minGamesForPill && A_pts > 0 && weeklyPoints.length >= minGamesForPill) {
            n_top = Math.max(1, Math.ceil(0.25 * gamesPlayed));
            const sortedWeekly = [...weeklyPoints].sort((a, b) => b - a);
            topPoints = sortedWeekly.slice(0, n_top).reduce((s, x) => s + x, 0);
            C = topPoints / A_pts;

            // Stage 1 Gate (Section 3.3, dynamically evaluated at params.sensitivity quantile)
            const tBust = this.getTBust(pos, gamesPlayed, params.sensitivity);
            if (C > tBust) {
                provisional_flag = 'inconsistent';

                // Stage 2: Reliable Starter Check
                const floorGamesCount = gamesPlayed - n_top;
                const floorPoints = A_pts - topPoints;
                floorPpg = floorGamesCount > 0 ? (floorPoints / floorGamesCount) : 0.0;
                floorPpgPercentile = this.getFloorPpgPercentile(pos, floorPpg);

                if (floorPpgPercentile >= params.reliable_starter_threshold) {
                    final_label = 'consistent_with_booms';
                } else {
                    final_label = 'inconsistent_producer';
                }
            }
        }

        // Step 4.8: Score Multiplier (strictly applied only when Adjusted > 0)
        let multiplier = 1.00;
        let boomMagnitude = 0.0;
        let boomShare = 0.0;

        if (Adjusted > 0) {
            if (params.mode === 'flat') {
                if (final_label === 'inconsistent_producer') {
                    multiplier = params.mu_penalty;
                } else if (final_label === 'consistent_with_booms') {
                    multiplier = params.mu_reward;
                }
            } else {
                // Dynamic mode (default)
                boomMagnitude = Math.max(0.0, topPoints - (n_top * floorPpg));
                boomShare = A_pts > 0 ? (boomMagnitude / A_pts) : 0.0;

                if (final_label === 'inconsistent_producer') {
                    const penalty = Math.min(params.penalty_cap, Math.max(0.0, boomShare * params.penalty_intensity));
                    multiplier = 1.0 - penalty;
                } else if (final_label === 'consistent_with_booms') {
                    const reward = Math.min(params.reward_cap, Math.max(0.0, boomShare * params.reward_intensity));
                    multiplier = 1.0 + reward;
                }
            }
        }

        const Adjusted_final = Adjusted > 0 ? (Adjusted * multiplier) : Adjusted;

        // Step 4.9: Blend into LDI_raw
        const LDI_raw = (params.alpha * Adjusted_final) + ((1.0 - params.alpha) * VORP_z);

        // Step 4.10: Pick-level display score Phi(LDI_raw) * 100
        const pickDisplayScore = Math.max(1, Math.min(99, Math.round(standardNormalCdf(LDI_raw) * 100.0)));

        const playerNameStr = pick.player_name || pick.playerName || 'Player';
        const cPctRounded = Math.round(C * 100);

        // Section 7.2: Tooltips copy (plain language, strictly no em-dashes)
        let consistentBoomsTooltip = '';
        let inconsistentTooltip = '';
        if (final_label === 'consistent_with_booms') {
            consistentBoomsTooltip = `Consistent with booms: ${playerNameStr} was a reliable starter outside of his ${n_top} standout games.`;
        } else if (final_label === 'inconsistent_producer') {
            inconsistentTooltip = `Boom-or-bust: about ${cPctRounded}% of ${playerNameStr}'s points came from his ${n_top} best games, and the rest of his season wasn't reliable starter production.`;
        }

        return {
            isScored: true,
            position: pos,
            overallPickNumber: overallPick,
            positionalDraftRank: posRank,
            normalizedDraftRank: Math.round(normPosRank * 10) / 10,
            gamesPlayed,
            gamesMissed,
            possibleGames: G,
            Effective_games,
            A_pts: Math.round(A_pts * 10) / 10,
            ppg: Math.round(ppg * 10) / 10,
            eRate: Math.round(eRate * 100) / 100,
            sdRate: Math.round(sdRate * 100) / 100,
            E_adj: Math.round(E_adj * 10) / 10,
            Residual: Math.round(Residual * 10) / 10,
            SD_pts: Math.round(SD_pts * 10) / 10,
            Z: Math.round(Z * 100) / 100,
            Adjusted: Math.round(Adjusted * 100) / 100,
            replacement_level_points: Math.round(replacement_level_points * 10) / 10,
            VORP_actual: Math.round(VORP_actual * 10) / 10,
            VORP_z: Math.round(VORP_z * 100) / 100,
            final_label,
            provisional_flag,
            C: Math.round(C * 1000) / 1000,
            n_top,
            floorPpg: Math.round(floorPpg * 10) / 10,
            floorPpgPercentile: Math.round(floorPpgPercentile * 10) / 10,
            boom_share: Math.round(boomShare * 1000) / 1000,
            multiplier: Math.round(multiplier * 100) / 100,
            Adjusted_final: Math.round(Adjusted_final * 100) / 100,
            LDI_raw: Math.round(LDI_raw * 100) / 100,
            LDI_pick: Math.round(LDI_raw * 100) / 100,
            pickDisplayScore,
            consistentBooms: (final_label === 'consistent_with_booms'),
            inconsistentProducer: (final_label === 'inconsistent_producer'),
            consistentBoomsTooltip,
            inconsistentTooltip,
            isLowConfidence: Boolean(posOutOfRange || vorpOutOfRange)
        };
    }

    /**
     * Compute manager draft rollup and standardized 1-100 grade (Sections 5, 6)
     */
    computeManagerRollup(scoredPicks = []) {
        const validPicks = scoredPicks.filter(p => p && p.isScored && p.LDI_raw !== undefined);
        if (validPicks.length === 0) {
            return {
                LDI_manager_season: 0.0,
                compositeLdi: 0.0,
                meanLdi: 0.0,
                managerDisplayScore: 50,
                scoredPicksCount: 0
            };
        }

        // Section 5: Equal weight per pick
        const sumRaw = validPicks.reduce((acc, p) => acc + p.LDI_raw, 0);
        const LDI_manager_season = sumRaw / validPicks.length;

        // Section 6.2: Nonparametric empirical percentile rank in pooled database
        const pop = this.pooledManagerScores || [];
        let percentile = 50.0;
        if (pop.length > 0) {
            let countLess = 0;
            for (let i = 0; i < pop.length; i++) {
                if (pop[i] < LDI_manager_season) countLess++;
                else break;
            }
            percentile = (countLess / pop.length) * 100.0;
        }

        const managerDisplayScore = Math.max(1, Math.min(99, Math.round(percentile)));

        return {
            LDI_manager_season: Math.round(LDI_manager_season * 1000) / 1000,
            compositeLdi: Math.round(sumRaw * 10) / 10,
            meanLdi: Math.round(LDI_manager_season * 100) / 100,
            managerDisplayScore,
            scoredPicksCount: validPicks.length
        };
    }

    /**
     * Compute manager multi-year career composite LDI
     * Statistically robust:
     * 1. Aggregates all scored picks across completed seasons
     * 2. Computes unweighted career mean LDI_raw per pick
     * 3. Applies Empirical Bayes shrinkage toward 0 with prior sample size N0 = 15 (1 full draft)
     * 4. Evaluates against empirical population distribution to produce 1-99 composite score
     * 5. Computes diagnostic metrics: hit rate, bust rate, season standard deviation
     */
    computeCareerComposite(scoredPicks = [], seasonRollups = []) {
        const validPicks = scoredPicks.filter(p => p && (p.isScored || p.LDI_raw !== undefined || p.ldiResult?.isScored));
        const totalPicks = validPicks.length;
        if (totalPicks === 0) {
            return {
                compositeScore: 50,
                careerMeanLdi: 0.0,
                shrunkLdi: 0.0,
                gradeInfo: LDIEngine.getScoreGrade(50),
                totalPicks: 0,
                seasonsCount: seasonRollups.length,
                hitCount: 0,
                hitRate: 0.0,
                bustCount: 0,
                bustRate: 0.0,
                seasonStdDev: 0.0
            };
        }

        const sumRaw = validPicks.reduce((acc, p) => {
            const rawVal = p.LDI_raw ?? p.LDI_pick ?? p.ldiResult?.LDI_raw ?? p.ldiResult?.LDI_pick ?? 0;
            return acc + Number(rawVal);
        }, 0);
        const careerMeanLdi = sumRaw / totalPicks;

        // Empirical Bayesian Shrinkage with prior sample size N0 = 15
        const N0 = 15;
        const wShrink = totalPicks / (totalPicks + N0);
        const shrunkLdi = wShrink * careerMeanLdi; // prior mean mu_0 = 0

        // Empirical percentile ranking against pooled manager population
        const pop = this.pooledManagerScores || [];
        let percentile = 50.0;
        if (pop.length > 0) {
            let countLess = 0;
            for (let i = 0; i < pop.length; i++) {
                if (pop[i] < shrunkLdi) countLess++;
                else break;
            }
            percentile = (countLess / pop.length) * 100.0;
        } else {
            percentile = standardNormalCdf(shrunkLdi) * 100.0;
        }

        const compositeScore = Math.max(1, Math.min(99, Math.round(percentile)));
        const gradeInfo = LDIEngine.getScoreGrade(compositeScore);

        const hits = validPicks.filter(p => {
            const score = p.pickDisplayScore ?? p.ldiResult?.pickDisplayScore ?? 50;
            return score >= 75;
        }).length;
        const busts = validPicks.filter(p => {
            const score = p.pickDisplayScore ?? p.ldiResult?.pickDisplayScore ?? 50;
            return score <= 25;
        }).length;
        const hitRate = Math.round((hits / totalPicks) * 1000) / 10;
        const bustRate = Math.round((busts / totalPicks) * 1000) / 10;

        // Season-to-season standard deviation
        let seasonStdDev = 0.0;
        if (seasonRollups.length > 1) {
            const sMeans = seasonRollups.map(s => s.LDI_manager_season ?? s.meanLdi ?? 0);
            const avgSMean = sMeans.reduce((a, b) => a + b, 0) / sMeans.length;
            const varS = sMeans.reduce((a, b) => a + Math.pow(b - avgSMean, 2), 0) / (sMeans.length - 1);
            seasonStdDev = Math.round(Math.sqrt(varS) * 100) / 100;
        }

        return {
            compositeScore,
            careerMeanLdi: Math.round(careerMeanLdi * 1000) / 1000,
            shrunkLdi: Math.round(shrunkLdi * 1000) / 1000,
            gradeInfo,
            totalPicks,
            seasonsCount: seasonRollups.length,
            hitCount: hits,
            hitRate,
            bustCount: busts,
            bustRate,
            seasonStdDev
        };
    }

    /**
     * Get Grade Tier & Color Palette
     */
    static getScoreGrade(score) {
        const s = Number(score) || 0;
        if (s >= 95) return { grade: 'A+', tier: 'elite', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
        if (s >= 85) return { grade: 'A', tier: 'elite', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' };
        if (s >= 75) return { grade: 'A-', tier: 'great', color: '#34d399', bg: 'rgba(52, 211, 153, 0.12)', border: 'rgba(52, 211, 153, 0.25)' };
        if (s >= 65) return { grade: 'B+', tier: 'good', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.25)' };
        if (s >= 55) return { grade: 'B', tier: 'above_avg', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.12)', border: 'rgba(96, 165, 250, 0.25)' };
        if (s >= 45) return { grade: 'C+', tier: 'average', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)', border: 'rgba(167, 139, 250, 0.25)' };
        if (s >= 35) return { grade: 'C', tier: 'below_avg', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.25)' };
        if (s >= 25) return { grade: 'D+', tier: 'poor', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.12)', border: 'rgba(251, 146, 60, 0.25)' };
        if (s >= 15) return { grade: 'D', tier: 'bust', color: '#f87171', bg: 'rgba(248, 113, 113, 0.12)', border: 'rgba(248, 113, 113, 0.25)' };
        return { grade: 'F', tier: 'bust', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
    }

    getScoreGrade(score) {
        return LDIEngine.getScoreGrade(score);
    }
}

// Singleton instance for global import
export const ldiEngine = new LDIEngine();
if (typeof window !== 'undefined') {
    window.LDIEngine = ldiEngine;
    window.LDIEngineClass = LDIEngine;
}
export default ldiEngine;
