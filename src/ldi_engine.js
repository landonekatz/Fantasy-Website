/**
 * Landon Draft Index (LDI) Engine
 * Full implementation according to landon_draft_index_framework.md
 */

import ldiModelData from './ldi_model_data.json';

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
        this.posModels = this.model?.pos_models || {};
        this.overallVorpModel = this.model?.overall_vorp_model || {};
        this.winsorCapsByPos = this.model?.winsor_caps_by_pos || {};
        this.pooledManagerScores = this.model?.pooled_manager_scores || [];
        this.weeklyLogsCache = this.model?.weekly_logs_cache || {};

        // Founder Tuning Parameters (Live scoring-time)
        this.params = {
            lambda: this.model?.defaults?.lambda ?? 0.70,
            alpha: this.model?.defaults?.alpha ?? 0.85,
            winsor_percentile: this.model?.defaults?.winsor_percentile ?? 0.90,
            t_bust: this.model?.defaults?.t_bust ?? 0.50,
            games_missed_threshold: this.model?.defaults?.games_missed_threshold ?? 4
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
            lambda: this.model?.defaults?.lambda ?? 0.70,
            alpha: this.model?.defaults?.alpha ?? 0.85,
            winsor_percentile: this.model?.defaults?.winsor_percentile ?? 0.90,
            t_bust: this.model?.defaults?.t_bust ?? 0.50,
            games_missed_threshold: this.model?.defaults?.games_missed_threshold ?? 4
        };
        this.notifyListeners();
    }

    // Evaluate Positional GAM Curve E_pts(P_r) and SD_pts(P_r)
    getPosExpected(pos, rank) {
        const m = this.posModels[pos];
        if (!m || !m.E_pts || m.E_pts.length === 0) {
            return { ePts: 100, sdPts: 50, isOutOfRange: false };
        }
        const r = Math.max(1.0, Math.min(Number(rank) || 1.0, 60.0));
        const idx = Math.floor(r) - 1;
        const frac = r - Math.floor(r);

        const isOutOfRange = (Number(rank) > (m.max_observed_rank || 50));

        if (idx >= 59) {
            return {
                ePts: m.E_pts[59],
                sdPts: m.SD_pts[59],
                isOutOfRange
            };
        }

        const ePts = m.E_pts[idx] * (1 - frac) + m.E_pts[idx + 1] * frac;
        const sdPts = m.SD_pts[idx] * (1 - frac) + m.SD_pts[idx + 1] * frac;

        return { ePts, sdPts, isOutOfRange };
    }

    // Evaluate Overall-Slot VORP GAM Curve V_expected(P_overall) and SD_VORP(P_overall)
    getVorpExpected(overallPick) {
        const m = this.overallVorpModel;
        if (!m || !m.V_expected || m.V_expected.length === 0) {
            return { vExp: 0, sdVorp: 50, isOutOfRange: false };
        }
        const ov = Math.max(1.0, Math.min(Number(overallPick) || 1.0, 200.0));
        const idx = Math.floor(ov) - 1;
        const frac = ov - Math.floor(ov);

        const isOutOfRange = (Number(overallPick) > 200);

        if (idx >= 199) {
            return {
                vExp: m.V_expected[199],
                sdVorp: m.SD_VORP[199],
                isOutOfRange
            };
        }

        const vExp = m.V_expected[idx] * (1 - frac) + m.V_expected[idx + 1] * frac;
        const sdVorp = m.SD_VORP[idx] * (1 - frac) + m.SD_VORP[idx + 1] * frac;

        return { vExp, sdVorp, isOutOfRange };
    }

    // Get Winsorization Cap for a position at current slider percentile
    getWinsorCap(pos, percentile = this.params.winsor_percentile) {
        const caps = this.winsorCapsByPos[pos];
        if (!caps) return 20.0;
        const key = Number(percentile).toFixed(2);
        if (caps[key] !== undefined) return caps[key];
        
        // Closest match fallback
        const keys = Object.keys(caps).map(Number).sort((a, b) => a - b);
        let closest = keys[0];
        let minDiff = Math.abs(percentile - closest);
        for (const k of keys) {
            const diff = Math.abs(percentile - k);
            if (diff < minDiff) {
                minDiff = diff;
                closest = k;
            }
        }
        return caps[closest.toFixed(2)] ?? 20.0;
    }

    // Lookup weekly logs from precomputed cache
    getPlayerWeeklyLogs(playerName, seasonYear) {
        const key = `${normalizeName(playerName)}_${seasonYear}`;
        return this.weeklyLogsCache[key] || null;
    }

    /**
     * Score a single pick (Sections 4 & 7)
     */
    scorePick(pick, settings = {}, tuningOverride = null) {
        const params = tuningOverride ? { ...this.params, ...tuningOverride } : this.params;
        const pos = pick.position || pick.pos;
        const isSkill = ['QB', 'RB', 'WR', 'TE'].includes(pos);

        // K and DST are excluded from LDI scoring
        if (!isSkill) {
            return {
                isScored: false,
                reason: 'K/DST excluded from LDI scoring',
                position: pos,
                overallPickNumber: pick.overall_pick_number || pick.overall_pick || pick.overallPick
            };
        }

        const seasonYear = Number(pick.season_year || pick.year || pick.season || 2024);
        const overallPick = Number(pick.overall_pick_number || pick.overall_pick || pick.overallPick || 1);
        const posRank = Number(pick.positional_draft_rank || pick.drafted_pos_num || pick.posRankNum || 1);
        const numTeams = Number(settings.num_teams || settings.numTeams || 12);
        const totalSeasonWeeks = Number(settings.total_season_weeks || (seasonYear >= 2021 ? 17 : 16));
        const G = Math.max(1, totalSeasonWeeks - 1);

        // Percentile-normalized positional rank (P_r / num_teams * 12)
        const normPosRank = (posRank / numTeams) * 12.0;

        // Step 1: Game availability & weekly logs
        const cachedLogs = this.getPlayerWeeklyLogs(pick.player_name || pick.playerName, seasonYear);
        let weeklyPoints = pick.weekly_points || cachedLogs?.weekly_points || [];
        let gamesPlayed = (pick.games_played !== undefined && pick.games_played !== null) ? Number(pick.games_played) : (weeklyPoints.length > 0 ? weeklyPoints.length : (cachedLogs?.games_played ?? 0));
        let gamesMissed = (pick.games_missed !== undefined && pick.games_missed !== null) ? Number(pick.games_missed) : (cachedLogs?.games_missed ?? Math.max(0, G - gamesPlayed));
        let unwinsorizedPoints = (pick.unwinsorized_points !== undefined && pick.unwinsorized_points !== null) ? Number(pick.unwinsorized_points) : (pick.total_points !== undefined ? Number(pick.total_points) : (cachedLogs?.unwinsorized_points ?? 0));

        if (gamesPlayed === 0) {
            gamesMissed = G;
            unwinsorizedPoints = 0.0;
            weeklyPoints = [];
        }

        // If weekly points are missing, estimate from total points and games played
        if (weeklyPoints.length === 0 && gamesPlayed > 0 && unwinsorizedPoints > 0) {
            const avgPerGame = unwinsorizedPoints / gamesPlayed;
            weeklyPoints = Array(gamesPlayed).fill(avgPerGame);
        }

        // Step 2: Winsorized actual points A_pts
        const winsorCap = this.getWinsorCap(pos, params.winsor_percentile);
        const A_pts = weeklyPoints.length > 0
            ? weeklyPoints.reduce((sum, pts) => sum + Math.min(pts, winsorCap), 0)
            : unwinsorizedPoints;

        // Step 3: Games-missed-adjusted expected points E_adj (Section 4.3 & 10)
        const { ePts, sdPts, isOutOfRange: posOutOfRange } = this.getPosExpected(pos, normPosRank);
        let E_adj = ePts;
        if (gamesPlayed === 0) {
            E_adj = 0.0;
        } else if (gamesMissed >= params.games_missed_threshold) {
            E_adj = ePts * Math.max(0, (G - gamesMissed)) / G;
        }

        // Full-Season Pace (over G possible non-bye regular season games)
        const fullSeasonPace = gamesPlayed > 0 ? ((unwinsorizedPoints / gamesPlayed) * G) : 0.0;

        // Step 4: Residual and standardized Z
        const residual = A_pts - E_adj;
        const Z = residual / (sdPts > 0 ? sdPts : 30.0);

        // Step 5: Asymmetry layer
        const adjusted = Z >= 0 ? Z : (Z * params.lambda);

        // Step 6: Replacement level & VORP
        let startersAtPos = 2;
        if (pos === 'QB' || pos === 'TE') startersAtPos = 1;
        if (pos === 'WR') startersAtPos = (settings.starters_wr !== undefined ? settings.starters_wr : (seasonYear <= 2019 && settings.league_id === 'dms' ? 3 : 2));

        const startersFlex = settings.starters_flex !== undefined ? settings.starters_flex : (seasonYear <= 2019 && settings.league_id === 'dms' ? 0 : 1);
        const flexShares = { QB: 0.0, RB: 0.55, WR: 0.40, TE: 0.05 };
        const replacementRank = (numTeams * startersAtPos) + (numTeams * startersFlex * (flexShares[pos] || 0));
        const normRepRank = (replacementRank / numTeams) * 12.0;

        const { ePts: repPoints } = this.getPosExpected(pos, normRepRank);
        const VORP_actual = A_pts - repPoints;

        const { vExp, sdVorp, isOutOfRange: vorpOutOfRange } = this.getVorpExpected(overallPick);
        const VORP_z = (VORP_actual - vExp) / (sdVorp > 0 ? sdVorp : 30.0);

        // Step 7: Blend into LDI_raw
        const LDI_raw = params.alpha * adjusted + (1.0 - params.alpha) * VORP_z;

        // Step 8: Pick display score Phi(LDI_raw) * 100
        const rawPercentile = standardNormalCdf(LDI_raw) * 100.0;
        const pickDisplayScore = Math.max(1, Math.min(99, Math.round(rawPercentile)));

        // Diagnostic Inconsistent Producer Pill (Section 7.2)
        // Minimum sample gate: only evaluate if games_played >= 6
        let showInconsistent = false;
        let concentrationRatio = 0.0;
        const nTop = Math.max(1, Math.ceil(0.25 * gamesPlayed));

        if (gamesPlayed >= 6 && unwinsorizedPoints > 0 && weeklyPoints.length > 0) {
            const sortedWk = [...weeklyPoints].sort((a, b) => b - a);
            const topPts = sortedWk.slice(0, nTop).reduce((sum, p) => sum + p, 0);
            concentrationRatio = topPts / unwinsorizedPoints;
            if (concentrationRatio > params.t_bust) {
                showInconsistent = true;
            }
        }

        const playerName = pick.player_name || pick.playerName || 'Player';
        const inconsistentTooltip = `About ${Math.round(concentrationRatio * 100)}% of ${playerName}'s fantasy points came from his ${nTop} best games.`;

        return {
            isScored: true,
            position: pos,
            overallPickNumber: overallPick,
            positionalDraftRank: posRank,
            normalizedDraftRank: normPosRank,
            gamesPlayed,
            gamesMissed,
            possibleGames: G,
            unwinsorizedPoints: Math.round(unwinsorizedPoints * 10) / 10,
            A_pts: Math.round(A_pts * 10) / 10,
            ePts: Math.round(ePts * 10) / 10,
            sdPts: Math.round(sdPts * 10) / 10,
            E_adj: Math.round(E_adj * 10) / 10,
            fullSeasonPace: Math.round(fullSeasonPace * 10) / 10,
            residual: Math.round(residual * 10) / 10,
            Z: Math.round(Z * 1000) / 1000,
            adjusted: Math.round(adjusted * 1000) / 1000,
            replacementRank,
            repPoints: Math.round(repPoints * 10) / 10,
            VORP_actual: Math.round(VORP_actual * 10) / 10,
            vExp: Math.round(vExp * 10) / 10,
            sdVorp: Math.round(sdVorp * 10) / 10,
            VORP_z: Math.round(VORP_z * 1000) / 1000,
            LDI_raw: Math.round(LDI_raw * 10000) / 10000,
            pickDisplayScore,
            inconsistentProducer: showInconsistent,
            concentrationRatio: Math.round(concentrationRatio * 1000) / 1000,
            nTopGames: nTop,
            inconsistentTooltip,
            isLowConfidence: Boolean(posOutOfRange || vorpOutOfRange)
        };
    }

    /**
     * Compute manager draft rollup and empirical percentile grade (Sections 5 & 6)
     */
    computeManagerRollup(scoredPicks = []) {
        const validPicks = scoredPicks.filter(p => p && p.isScored && p.LDI_raw !== undefined);
        if (validPicks.length === 0) {
            return {
                meanLdiRaw: 0.0,
                managerDisplayScore: 50,
                scoredPicksCount: 0
            };
        }

        // Equal weight per pick (mean LDI_raw)
        const meanLdiRaw = validPicks.reduce((sum, p) => sum + p.LDI_raw, 0) / validPicks.length;

        // Nonparametric empirical percentile rank against full pooled manager population
        const pop = this.pooledManagerScores;
        let percentile = 50;

        if (pop && pop.length > 0) {
            // Count how many scores in population are <= meanLdiRaw
            let rankCount = 0;
            for (let i = 0; i < pop.length; i++) {
                if (pop[i] <= meanLdiRaw) {
                    rankCount++;
                } else {
                    break;
                }
            }
            percentile = (rankCount / pop.length) * 100.0;
        }

        const managerDisplayScore = Math.max(1, Math.min(99, Math.round(percentile)));

        return {
            meanLdiRaw: Math.round(meanLdiRaw * 10000) / 10000,
            managerDisplayScore,
            scoredPicksCount: validPicks.length
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
}

export const ldiEngine = new LDIEngine();
if (typeof window !== 'undefined') {
    window.LDIEngine = ldiEngine;
}
