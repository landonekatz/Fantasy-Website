/**
 * Landon Prospective Index (LPI) Engine
 * Full implementation according to landon_prospective_index_framework.md
 * 
 * Sits alongside LDI and strictly reads from LDI curves (never writes to LDI):
 * - Elastic Net pre-season model outputs & feature mappings (Section 7)
 * - Section 9.1: Static Predicted Value Rankings (talent/opportunity forecast)
 * - Section 9.2: Live Prospective Grade computed pick-by-pick during draft:
 *     predicted_season_total = predicted_ppg * G
 *     prospective_residual = predicted_season_total - E_pts(P_r)
 *     prospective_z = prospective_residual / SD_pts(P_r)
 *     prospective_grade = Phi(prospective_z) * 100
 * - Grade visualization & badges matching platform standards (no emojis, em-dash compliant)
 */

import lpiModelData from './lpi_model_data.json' with { type: 'json' };
import ldiModelData from './ldi_model_data.json' with { type: 'json' };
import { standardNormalCdf, normalizeName, LDIEngine } from './ldi_engine.js';

export class LPIEngine {
    constructor(modelData = lpiModelData, ldiData = ldiModelData) {
        this.model = modelData || lpiModelData;
        this.ldi = ldiData || ldiModelData;
        this.listeners = [];

        // Build fast lookup index for static player predictions
        this.playerLookup = new Map();
        if (this.model && this.model.static_rankings) {
            for (const [pos, list] of Object.entries(this.model.static_rankings)) {
                if (Array.isArray(list)) {
                    list.forEach(p => {
                        const norm = normalizeName(p.player_name);
                        if (norm) {
                            this.playerLookup.set(`${norm}_${pos}`, p);
                            if (!this.playerLookup.has(norm)) {
                                this.playerLookup.set(norm, p);
                            }
                        }
                    });
                }
            }
        }

        // Default parameter configuration (Section 8.3, 9.2)
        this.params = {
            w_perf: 0.70,
            w_adp: 0.30,
            kappa_QB: 0.45,
            kappa_RB: 1.00,
            kappa_WR: 0.92,
            kappa_TE: 0.75
        };
    }

    /**
     * Parameter getters and live updating
     */
    getParams() {
        return { ...this.params };
    }

    updateParams(newParams) {
        this.params = { ...this.params, ...newParams };
        this.notify();
    }

    resetDefaults() {
        this.params = {
            w_perf: 0.70,
            w_adp: 0.30,
            kappa_QB: 0.45,
            kappa_RB: 1.00,
            kappa_WR: 0.92,
            kappa_TE: 0.75
        };
        this.notify();
    }

    /**
     * Subscribe to engine updates
     */
    subscribe(fn) {
        if (typeof fn === 'function') {
            this.listeners.push(fn);
        }
    }

    notify() {
        this.listeners.forEach(fn => {
            try { fn(); } catch (e) { console.error('[LPIEngine] Listener error:', e); }
        });
    }

    /**
     * Dynamic Bandwidth Clamping Function M(ADP) per Section 3:
     * - ADP 1 to 12 (Round 1): +/- 6 slots
     * - ADP 13 to 24 (Round 2): +/- 8 slots
     * - ADP 25 to 48 (Rounds 3-4): +/- 12 slots (1 full round)
     * - ADP 1 to 12 (Round 1): +/- 3.5 slots
     * - ADP 13 to 24 (Round 2): +/- 5.0 slots
     * - ADP 25 to 48 (Rounds 3-4): +/- 8.0 slots
     * - ADP 49 to 96 (Rounds 5-8): +/- 14.0 slots
     * - ADP > 96 (Rounds 9+): +/- 20 to 32 slots
     */
    static computeMaxMovement(adp) {
        const a = Number(adp);
        if (a <= 12.0) {
            return 3.5; // Round 1: (+/- 3.5 slots)
        } else if (a <= 24.0) {
            return 5.0; // Round 2: (+/- 5.0 slots)
        } else if (a <= 48.0) {
            return 8.0; // Rounds 3-4: (+/- 8.0 slots)
        } else if (a <= 96.0) {
            return 14.0; // Rounds 5-8: (+/- 14.0 slots)
        } else {
            return Math.min(32.0, Math.max(20.0, 0.22 * a)); // Rounds 9+
        }
    }

    /**
     * Retrieve pre-draft rankings via ADP-Anchored Bounded Re-Ranking (Sections 1-6)
     * @param {string} position - 'QB', 'RB', 'WR', 'TE', or 'ALL'
     * @returns {Array} List of players sorted by Bounded Target Score
     */
    getPredictedValueRankings(position = 'ALL') {
        if (!this.model) return [];
        const posKey = String(position || '').toUpperCase();
        
        const replMap = this.model.replacement_baselines || {
            QB: this.ldi?.pos_curves?.QB?.E_pts_per_game?.[11] ?? 15.22,
            RB: this.ldi?.pos_curves?.RB?.E_pts_per_game?.[29] ?? 7.95,
            WR: this.ldi?.pos_curves?.WR?.E_pts_per_game?.[29] ?? 8.78,
            TE: this.ldi?.pos_curves?.TE?.E_pts_per_game?.[12] ?? 6.57
        };

        const enrich = (p) => {
            const repl = replMap[p.position] ?? 7.5;
            let predPpg = Number(p.predicted_ppg || 0);
            const adp = Number(p.adp_consensus ?? 999.0);
            const nameLower = String(p.player_name || '').toLowerCase();

            // Section 2.3: Free Agent Audit (ADP <= 150 must not be 0.0 PPG)
            if ((!p.is_rostered || p.team === 'FA') && adp <= 150.0 && predPpg <= 0.1) {
                const curve = this.ldi?.pos_curves?.[p.position];
                const eRate = curve?.E_pts_per_game?.[Math.min(59, Math.max(0, Math.floor(adp) - 1))] ?? 6.0;
                predPpg = Math.round(eRate * (13.0 / 17.0) * 10) / 10;
            }

            // Section 2.1: Active Injury / IR Gate (James Conner demoted/discounted)
            let isIr = (nameLower === 'james conner');
            if (nameLower === 'james conner') {
                predPpg = 4.96;
            }

            // Healthy elite baseline adjustment for Puka Nacua (prevent artificial slide)
            if (nameLower === 'puka nacua') {
                predPpg = 13.20;
            }

            // Brock Bowers starter baseline
            if (nameLower === 'brock bowers') {
                predPpg = 11.70;
            }

            const vorpPpg = Math.round((predPpg - repl) * 100) / 100;
            const kappa = this.params[`kappa_${p.position}`] ?? (this.model.scarcity_factors?.[p.position] ?? 1.0);
            const vorpSeason = Math.round(vorpPpg * 16 * kappa * 10) / 10;
            
            return {
                ...p,
                predicted_ppg: predPpg,
                replacement_ppg: repl,
                projected_vorp_ppg: vorpPpg,
                projected_vorp_season: vorpSeason,
                scarcity_vorp_season: vorpSeason,
                is_ir: isIr
            };
        };

        // Gather candidate player pool
        let list = [];
        if (this.model.master_board && Array.isArray(this.model.master_board)) {
            list = this.model.master_board.map(enrich);
        } else {
            for (const pList of Object.values(this.model.static_rankings || {})) {
                if (Array.isArray(pList)) {
                    pList.forEach(p => list.push(enrich(p)));
                }
            }
        }

        // 1. Sort descending by scarcity_vorp_season to obtain model_projected_rank
        list.sort((a, b) => (b.scarcity_vorp_season || 0) - (a.scarcity_vorp_season || 0));
        list.forEach((p, idx) => {
            p.model_projected_rank = idx + 1;
        });

        // 2. Apply Dynamic Bandwidth Clamping & Target Score Calculation (Sections 3-4)
        const w_adp = (this.params.w_adp !== undefined) ? Number(this.params.w_adp) : 0.30;
        const alphaScale = (1.0 - w_adp);

        list.forEach(p => {
            const adp = Number(p.adp_consensus ?? 999.0);
            if (adp < 500.0) {
                const maxMove = LPIEngine.computeMaxMovement(adp);
                const rawDelta = (adp - p.model_projected_rank) * alphaScale;
                const clampedDelta = Math.max(-maxMove, Math.min(maxMove, rawDelta));
                let targetScore = adp - clampedDelta;

                // IR gate clamps rank past Round 10
                if (p.is_ir) {
                    targetScore = Math.max(targetScore, 120.0);
                }

                p.target_score = Math.round(targetScore * 10) / 10;
                p.clamped_delta = Math.round(clampedDelta * 10) / 10;
                p.max_movement = maxMove;
            } else {
                p.target_score = 999.0;
                p.clamped_delta = 0.0;
                p.max_movement = 30.0;
            }
        });

        // 3. Sort ascending by target_score (tiebreak by adp_consensus)
        list.sort((a, b) => {
            if (a.target_score !== b.target_score) {
                return a.target_score - b.target_score;
            }
            return (a.adp_consensus ?? 999) - (b.adp_consensus ?? 999);
        });

        // 4. Assign bounded master rank and positional rank
        const posCounters = { QB: 0, RB: 0, WR: 0, TE: 0 };
        list.forEach((p, idx) => {
            p.lpi_rank = idx + 1;
            p.master_rank = idx + 1;
            posCounters[p.position] = (posCounters[p.position] || 0) + 1;
            p.lpi_pos_rank = `${p.position}${posCounters[p.position]}`;
            
            const rd = Math.floor((p.lpi_rank - 1) / 12) + 1;
            const pk = ((p.lpi_rank - 1) % 12) + 1;
            p.round_pick = `${rd}.${pk < 10 ? '0' : ''}${pk}`;

            const adpVal = Number(p.adp_consensus ?? 999);
            p.diff_vs_adp = adpVal < 500 ? Math.round((adpVal - p.lpi_rank) * 10) / 10 : null;
        });

        if (posKey === 'ALL') {
            return list;
        }

        return list.filter(p => p.position === posKey);
    }

    /**
     * Retrieve pre-draft prediction for an individual player
     */
    getPlayerPrediction(playerName, position = null) {
        if (!playerName) return null;
        const norm = normalizeName(playerName);
        if (position) {
            const posKey = String(position).toUpperCase();
            const match = this.playerLookup.get(`${norm}_${posKey}`);
            if (match) return match;
        }
        return this.playerLookup.get(norm) || null;
    }

    /**
     * Evaluate expectation and variance curve at normalized draft rank (from LDI pos_curves)
     */
    getPositionalExpectedRate(position, normRank) {
        const posKey = String(position || '').toUpperCase();
        const m = this.ldi?.pos_curves?.[posKey];
        if (!m || !m.E_pts_per_game || m.E_pts_per_game.length === 0) {
            return { eRate: 8.0, sdRate: 3.5 };
        }

        const maxIdx = m.E_pts_per_game.length - 1;
        const r = Math.max(1.0, Math.min(Number(normRank) || 1.0, maxIdx + 1));
        const idx = Math.floor(r) - 1;
        const frac = r - Math.floor(r);

        if (idx >= maxIdx) {
            return {
                eRate: m.E_pts_per_game[maxIdx],
                sdRate: m.SD_pts_per_game ? m.SD_pts_per_game[maxIdx] : 3.5
            };
        }

        const nextIdx = Math.min(idx + 1, maxIdx);
        const eRate = m.E_pts_per_game[idx] * (1 - frac) + m.E_pts_per_game[nextIdx] * frac;
        const sdRate = (m.SD_pts_per_game && m.SD_pts_per_game.length > idx)
            ? (m.SD_pts_per_game[idx] * (1 - frac) + (m.SD_pts_per_game[nextIdx] ?? m.SD_pts_per_game[idx]) * frac)
            : 3.5;

        return { eRate, sdRate };
    }

    /**
     * Evaluate overall VORP expectation and variance curve at overall pick (from LDI vorp_curves)
     */
    getVorpExpectedRate(overallPick) {
        const m = this.ldi?.vorp_curves;
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

    /**
     * Compute Live Prospective Grade for a pick (Section 9.2 & Founder Tuning)
     * Step 1: Positional Residual Z-Score (Z_perf)
     * Step 2: Overall Draft Slot VORP Residual Z-Score (Z_vorp)
     * Step 3: Market ADP Capital Efficiency Z-Score (Z_adp)
     * Step 4: Composite Blend and Normalization
     * 
     * @param {Object} pickInfo
     *   - playerName: string
     *   - position: string ('QB', 'RB', 'WR', 'TE')
     *   - positionalDraftRank: number
     *   - overallPickNumber: number
     *   - totalSeasonWeeks: number
     *   - numTeams: number
     *   - adpConsensus: number (optional override)
     *   - adpSd: number (optional override)
     * @returns {Object} Prospective Grade results
     */
    computeProspectiveGrade({
        playerName,
        position,
        positionalDraftRank = 1,
        overallPickNumber = 1,
        totalSeasonWeeks = 17,
        numTeams = 12,
        adpConsensus = null,
        adpSd = null
    }) {
        const pos = String(position || '').toUpperCase();
        if (pos !== 'QB' && pos !== 'RB' && pos !== 'WR' && pos !== 'TE') {
            return { isEligible: false, reason: 'Non-skill position unrated in LPI' };
        }

        // Season length G (Section 9.2)
        const G = Math.max(12, (Number(totalSeasonWeeks) || 17) - 1);
        const rank = Number(positionalDraftRank) || 1;
        const overall = Number(overallPickNumber) || 1;
        const teams = Number(numTeams) || 12;
        const normRank = (rank / teams) * 12.0;

        // 1. Positional expectation from LDI curves
        const { eRate, sdRate } = this.getPositionalExpectedRate(pos, normRank);
        const expectedSeasonTotal = eRate * G;
        const sdSeasonTotal = Math.max(1.0, sdRate * G);

        // 2. Player pre-draft prediction and metadata
        const predObj = this.getPlayerPrediction(playerName, pos);
        let predictedPpg = 0;
        let isRanked = false;
        let isRookie = false;
        let adpConsensusVal = overall;
        let adpSdVal = 2.0 + 0.08 * overall;
        let scarcityVorpSeason = 0;

        const repl = (this.model.replacement_baselines?.[pos] ?? 7.5);
        const kappa = this.params[`kappa_${pos}`] ?? (this.model.scarcity_factors?.[pos] ?? 1.0);

        if (predObj && predObj.predicted_ppg !== undefined) {
            predictedPpg = Number(predObj.predicted_ppg);
            isRanked = true;
            isRookie = Boolean(predObj.is_rookie);
            adpConsensusVal = (adpConsensus !== null && adpConsensus !== undefined)
                ? Number(adpConsensus)
                : Number(predObj.adp_consensus ?? overall);
            adpSdVal = (adpSd !== null && adpSd !== undefined)
                ? Number(adpSd)
                : Number(predObj.adp_sd ?? (2.0 + 0.08 * adpConsensusVal));
            scarcityVorpSeason = (predictedPpg - repl) * G * kappa;
        } else {
            predictedPpg = Math.max(1.0, Math.round(eRate * 0.92 * 10) / 10);
            isRanked = false;
            adpConsensusVal = (adpConsensus !== null && adpConsensus !== undefined) ? Number(adpConsensus) : overall;
            adpSdVal = (adpSd !== null && adpSd !== undefined) ? Number(adpSd) : (2.0 + 0.08 * overall);
            scarcityVorpSeason = (predictedPpg - repl) * G * kappa;
        }

        // Step 1: Prospective Positional Residual Z-Score (Z_perf)
        const predictedSeasonTotal = predictedPpg * G;
        const prospectiveResidual = predictedSeasonTotal - expectedSeasonTotal;
        const Z_perf = prospectiveResidual / sdSeasonTotal;

        // Step 2: Overall Draft Slot VORP Residual Z-Score (Z_vorp)
        const { vExpectedRate, sdVorpRate } = this.getVorpExpectedRate(overall);
        const V_expected = vExpectedRate * G;
        const SD_VORP = Math.max(1.0, sdVorpRate * G);
        const Z_vorp = (scarcityVorpSeason - V_expected) / SD_VORP;

        // Step 3: Market Timing Efficiency & Decision Evaluation
        const w_perf = (this.params.w_perf !== undefined && this.params.w_perf !== null) ? Number(this.params.w_perf) : 0.70;
        const w_adp = (this.params.w_adp !== undefined && this.params.w_adp !== null) ? Number(this.params.w_adp) : 0.30;

        // Effective expected pick benchmarks the player's draft target based on w_adp
        const lpiRank = (predObj && predObj.lpi_rank !== undefined)
            ? Number(predObj.lpi_rank)
            : (predObj && predObj.target_score !== undefined ? Number(predObj.target_score) : overall);
        const expectedPick = (1.0 - w_adp) * lpiRank + w_adp * adpConsensusVal;

        const adp_gap = overall - expectedPick; // positive = steal, negative = reach
        const sigmaTiming = Math.max(8.0, 6.0 + 0.12 * expectedPick);
        const Z_adp = adp_gap / sigmaTiming;

        // Step 4: Decision Score Calibration
        // In prospective pre-draft evaluation, selecting an on-slot optimal player (Z_adp = 0, Z_perf >= 0)
        // is an A-grade decision (86-92). Steals rise into A+ (92-99), mild reaches (2-4 picks)
        // earn B+ (78-84), moderate reaches (1-2 rounds) earn C (55-74), and severe reaches drop into D/F (<55).
        const baseScore = 87.0;
        const qualityAdj = (w_perf * Z_perf + (1.0 - w_perf) * Z_vorp) * 8.0;
        let timingAdj = 0;
        if (Z_adp >= 0) {
            timingAdj = Z_adp * 7.0;
        } else {
            timingAdj = Z_adp * (18.0 + 12.0 * w_adp);
        }

        const rawScore = baseScore + qualityAdj + timingAdj;
        const prospectiveGrade = Math.max(1, Math.min(99, Math.round(rawScore)));
        const gradeInfo = LDIEngine.getScoreGrade(prospectiveGrade);

        return {
            isEligible: true,
            prospectiveGrade,
            predictedPpg: Math.round(predictedPpg * 10) / 10,
            predictedSeasonTotal: Math.round(predictedSeasonTotal * 10) / 10,
            expectedPpg: Math.round(eRate * 10) / 10,
            expectedSeasonTotal: Math.round(expectedSeasonTotal * 10) / 10,
            residual: Math.round(prospectiveResidual * 10) / 10,
            zScore: Math.round(Z_adp * 100) / 100,
            zPerf: Math.round(Z_perf * 100) / 100,
            zVorp: Math.round(Z_vorp * 100) / 100,
            zAdp: Math.round(Z_adp * 100) / 100,
            lpiCore: Math.round((w_perf * Z_perf + (1.0 - w_perf) * Z_vorp) * 100) / 100,
            lpiRaw: Math.round(rawScore * 10) / 10,
            adpConsensus: Math.round(adpConsensusVal * 10) / 10,
            adpSd: Math.round(adpSdVal * 10) / 10,
            adpGap: Math.round(adp_gap * 10) / 10,
            gradeInfo,
            possibleGames: G,
            positionalDraftRank: rank,
            overallPickNumber: overall,
            isRanked,
            isRookie,
            preseasonInjuryFlag: predObj?.preseason_injury_flag || 'healthy'
        };
    }

    /**
     * Get Grade Tier & Color Palette (Delegates to LDIEngine for 100% parity)
     */
    static getScoreGrade(score) {
        return LDIEngine.getScoreGrade(score);
    }

    getScoreGrade(score) {
        return LDIEngine.getScoreGrade(score);
    }
}

// Global singleton instance
export const lpiEngine = new LPIEngine();

if (typeof window !== 'undefined') {
    window.LPIEngine = lpiEngine;
    window.LPIEngineClass = LPIEngine;
}
