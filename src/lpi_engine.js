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
     * Retrieve static pre-draft rankings for a position (Section 9.1)
     * @param {string} position - 'QB', 'RB', 'WR', 'TE', or 'ALL'
     * @returns {Array} List of players sorted by predicted_ppg descending
     */
    getPredictedValueRankings(position = 'ALL') {
        if (!this.model || !this.model.static_rankings) return [];
        const posKey = String(position || '').toUpperCase();
        
        // Positional replacement baselines (12-team standard):
        // QB: rank 12, RB: rank 30, WR: rank 30, TE: rank 13
        const replMap = {
            QB: this.ldi?.pos_curves?.QB?.E_pts_per_game?.[11] ?? 15.22,
            RB: this.ldi?.pos_curves?.RB?.E_pts_per_game?.[29] ?? 7.95,
            WR: this.ldi?.pos_curves?.WR?.E_pts_per_game?.[29] ?? 8.78,
            TE: this.ldi?.pos_curves?.TE?.E_pts_per_game?.[12] ?? 6.57
        };

        const enrich = (p) => {
            const repl = replMap[p.position] ?? 7.5;
            const vorpPpg = Math.round(((p.predicted_ppg || 0) - repl) * 100) / 100;
            const vorpSeason = Math.round(vorpPpg * 16 * 10) / 10;
            return {
                ...p,
                replacement_ppg: repl,
                projected_vorp_ppg: vorpPpg,
                projected_vorp_season: vorpSeason
            };
        };

        if (posKey === 'ALL') {
            const combined = [];
            for (const list of Object.values(this.model.static_rankings)) {
                if (Array.isArray(list)) {
                    list.forEach(p => combined.push(enrich(p)));
                }
            }
            // Multi-positional draft ordering is governed by Value Over Replacement Player (VORP)
            return combined.sort((a, b) => (b.projected_vorp_season || 0) - (a.projected_vorp_season || 0));
        }

        const list = this.model.static_rankings[posKey] || [];
        return list.map(enrich).sort((a, b) => (b.predicted_ppg || 0) - (a.predicted_ppg || 0));
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
     * Compute Live Prospective Grade for a pick (Section 9.2)
     * @param {Object} pickInfo
     *   - playerName: string
     *   - position: string ('QB', 'RB', 'WR', 'TE')
     *   - positionalDraftRank: number
     *   - overallPickNumber: number
     *   - totalSeasonWeeks: number
     *   - numTeams: number
     * @returns {Object} Prospective Grade results
     */
    computeProspectiveGrade({
        playerName,
        position,
        positionalDraftRank = 1,
        overallPickNumber = 1,
        totalSeasonWeeks = 17,
        numTeams = 12
    }) {
        const pos = String(position || '').toUpperCase();
        if (pos !== 'QB' && pos !== 'RB' && pos !== 'WR' && pos !== 'TE') {
            return { isEligible: false, reason: 'Non-skill position unrated in LPI' };
        }

        // Season length G (Section 9.2)
        const G = Math.max(12, (Number(totalSeasonWeeks) || 17) - 1);
        const rank = Number(positionalDraftRank) || 1;
        const teams = Number(numTeams) || 12;
        const normRank = (rank / teams) * 12.0;

        // 1. Get LDI expectation curve at this draft slot
        const { eRate, sdRate } = this.getPositionalExpectedRate(pos, normRank);
        const expectedSeasonTotal = eRate * G;
        const sdSeasonTotal = sdRate * G;

        // 2. Get player's model-predicted PPG
        const predObj = this.getPlayerPrediction(playerName, pos);
        let predictedPpg = 0;
        let isRanked = false;
        let isRookie = false;

        if (predObj && predObj.predicted_ppg !== undefined) {
            predictedPpg = Number(predObj.predicted_ppg);
            isRanked = true;
            isRookie = Boolean(predObj.is_rookie);
        } else {
            // Unranked fallback: slot expectation with mild rookie/unknown discount
            predictedPpg = Math.max(1.0, Math.round(eRate * 0.92 * 10) / 10);
            isRanked = false;
        }

        // 3. Section 9.2: Formulas
        // predicted_season_total = predicted_ppg * G
        const predictedSeasonTotal = predictedPpg * G;

        // prospective_residual = predicted_season_total - E_pts(P_r)
        const prospectiveResidual = predictedSeasonTotal - expectedSeasonTotal;

        // prospective_z = prospective_residual / SD_pts(P_r)
        const prospectiveZ = prospectiveResidual / Math.max(1.0, sdSeasonTotal);

        // prospective_grade = Phi(prospective_z) * 100, clipped to [1, 99]
        const prospectiveGrade = Math.max(1, Math.min(99, Math.round(standardNormalCdf(prospectiveZ) * 100.0)));

        const gradeInfo = LDIEngine.getScoreGrade(prospectiveGrade);

        return {
            isEligible: true,
            prospectiveGrade,
            predictedPpg: Math.round(predictedPpg * 10) / 10,
            predictedSeasonTotal: Math.round(predictedSeasonTotal * 10) / 10,
            expectedPpg: Math.round(eRate * 10) / 10,
            expectedSeasonTotal: Math.round(expectedSeasonTotal * 10) / 10,
            residual: Math.round(prospectiveResidual * 10) / 10,
            zScore: Math.round(prospectiveZ * 100) / 100,
            gradeInfo,
            possibleGames: G,
            positionalDraftRank: rank,
            overallPickNumber: Number(overallPickNumber) || 1,
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
