#!/usr/bin/env python3
"""
Diagnostic Script: Rolling-Origin CV Bias Check on Quarterbacks (LPI Spec Section 8)
===================================================================================
Tests whether LPI's Elastic Net model systematically over-forecasts or under-forecasts
Quarterbacks out-of-sample across rolling-origin chronological folds (2018-2025).

Evaluates:
  1. Overall out-of-sample Bias (Mean Prediction Error = y_pred - y_actual)
  2. Hypothesis test for non-zero bias (p-value, t-stat)
  3. Season-by-season fold bias (2018 through 2025)
  4. Tier-specific bias (Top-12 Starters vs Backups vs High-Projection QBs >= 17 PPG)
  5. Cross-positional benchmark (QB vs RB vs WR vs TE)
  6. Direct comparison of top dual-threat QBs (Hurts, Jackson, Allen, Daniels)
"""

import sys
import os
import math
import numpy as np
import pandas as pd
from scipy import stats
from sklearn.linear_model import ElasticNet
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

# Add scripts directory to path
sys.path.append(os.path.join(os.path.dirname(__file__)))
from compile_lpi_model import (
    get_oc_history,
    load_nfl_datasets,
    load_ldi_and_draft_picks,
    build_lpi_covariate_matrix,
    preprocess_features,
    POSITION_COVARIATES
)

def run_qb_bias_diagnostic():
    print("=" * 80)
    print("LANDON PROSPECTIVE INDEX (LPI) - SECTION 8 ROLLING-ORIGIN CV BIAS CHECK (QB)")
    print("=" * 80)

    # 1. Load data
    print("\n[1/4] Loading cached NFL datasets and compiling covariate matrix...")
    oc_history = get_oc_history()
    nfl_data = load_nfl_datasets(list(range(2014, 2026)))
    scored_picks, ldi_data = load_ldi_and_draft_picks()
    df_full = build_lpi_covariate_matrix(nfl_data, scored_picks, oc_history)

    # 2. Optimal hyperparameters from LPI spec / training (opt_alpha=1.0, opt_l1=0.1 for QB)
    distinct_seasons = sorted(df_full['season_year'].unique())
    start_fold_idx = 4 # Training on 2014..2017, first test fold is 2018

    # Store results for all positions for comparative context
    pos_results = {}

    for pos in ['QB', 'RB', 'WR', 'TE']:
        pos_df = df_full[df_full['position'] == pos].copy()
        opt_alpha = 1.0 if pos == 'QB' else (0.25 if pos in ('RB', 'WR') else 0.5)
        opt_l1 = 0.1 if pos in ('QB', 'TE') else (0.9 if pos == 'RB' else 0.3)

        fold_records = []

        for s_idx in range(start_fold_idx, len(distinct_seasons) - 1):
            train_seasons = distinct_seasons[:s_idx + 1]
            test_season = distinct_seasons[s_idx + 1]

            df_tr = pos_df[pos_df['season_year'].isin(train_seasons)]
            df_te = pos_df[pos_df['season_year'] == test_season]

            if df_tr.empty or df_te.empty:
                continue

            X_tr, X_te, _ = preprocess_features(df_tr, df_te, pos)
            y_tr = df_tr['target_ppg'].values
            y_te = df_te['target_ppg'].values

            model = ElasticNet(alpha=opt_alpha, l1_ratio=opt_l1, max_iter=3000, random_state=42)
            model.fit(X_tr, y_tr)
            preds = model.predict(X_te)

            for p_name, y_true, y_hat in zip(df_te['player_name'], y_te, preds):
                fold_records.append({
                    'season': int(test_season),
                    'player_name': p_name,
                    'actual_ppg': float(y_true),
                    'predicted_ppg': float(y_hat),
                    'error': float(y_hat - y_true), # Positive = Over-forecast, Negative = Under-forecast
                    'abs_error': float(abs(y_hat - y_true))
                })

        pos_results[pos] = pd.DataFrame(fold_records)

    # 3. Analyze QB Specific Bias
    df_qb = pos_results['QB']
    n_obs = len(df_qb)
    mean_actual = df_qb['actual_ppg'].mean()
    mean_pred = df_qb['predicted_ppg'].mean()
    mean_bias = df_qb['error'].mean() # mean(pred - actual)
    median_bias = df_qb['error'].median()
    mae = df_qb['abs_error'].mean()
    rmse = math.sqrt(mean_squared_error(df_qb['actual_ppg'], df_qb['predicted_ppg']))
    r2 = r2_score(df_qb['actual_ppg'], df_qb['predicted_ppg'])

    # Statistical significance of bias: Paired t-test (H0: bias == 0)
    t_stat, p_val = stats.ttest_1samp(df_qb['error'], 0.0)

    print("\n" + "=" * 80)
    print("--- HEADLINE QB ROLLING-ORIGIN CV BIAS METRICS (N = %d) ---" % n_obs)
    print("=" * 80)
    print(f"Mean Actual PPG:          {mean_actual:6.2f} PPG")
    print(f"Mean Predicted PPG:       {mean_pred:6.2f} PPG")
    print(f"Mean Prediction Bias:     {mean_bias:+6.3f} PPG  (pred - actual)")
    print(f"Median Prediction Bias:   {median_bias:+6.3f} PPG")
    print(f"Mean Absolute Error (MAE): {mae:6.3f} PPG")
    print(f"Root Mean Sq Error (RMSE): {rmse:6.3f} PPG")
    print(f"Out-of-Sample R²:          {r2:6.3f}")
    print(f"T-statistic (Bias != 0):   {t_stat:+6.3f} (p-value = {p_val:.4f})")
    
    if p_val > 0.05:
        print(">> STATISTICAL CONCLUSION: No statistically significant bias detected in QB predictions (p > 0.05).")
        print("   The model does NOT systematically over-forecast or under-forecast Quarterbacks overall.")
    elif mean_bias > 0:
        print(">> STATISTICAL CONCLUSION: Statistically significant OVER-forecasting bias detected (p <= 0.05).")
    else:
        print(">> STATISTICAL CONCLUSION: Statistically significant UNDER-forecasting bias detected (p <= 0.05).")

    # 4. Season-by-Season Breakdown
    print("\n" + "-" * 80)
    print("--- SEASON-BY-SEASON OUT-OF-SAMPLE QB BIAS BREAKDOWN ---")
    print("-" * 80)
    print(f"{'Season':<8} {'N':<4} {'Actual Mean':<12} {'Pred Mean':<12} {'Bias (Pred-Act)':<16} {'MAE':<8} {'RMSE':<8} {'R²':<6}")
    print("-" * 80)

    season_rows = []
    for yr, group in df_qb.groupby('season'):
        yr_act = group['actual_ppg'].mean()
        yr_pred = group['predicted_ppg'].mean()
        yr_bias = group['error'].mean()
        yr_mae = group['abs_error'].mean()
        yr_rmse = math.sqrt(mean_squared_error(group['actual_ppg'], group['predicted_ppg']))
        yr_r2 = r2_score(group['actual_ppg'], group['predicted_ppg']) if len(group) > 1 else 0.0
        print(f"{yr:<8} {len(group):<4} {yr_act:8.2f} PPG  {yr_pred:8.2f} PPG  {yr_bias:+8.3f} PPG       {yr_mae:6.2f}   {yr_rmse:6.2f}   {yr_r2:+5.2f}")
        season_rows.append({
            'Season': yr, 'N': len(group), 'Actual_Mean': yr_act,
            'Pred_Mean': yr_pred, 'Bias': yr_bias, 'MAE': yr_mae, 'RMSE': yr_rmse, 'R2': yr_r2
        })

    # 5. Tier-Specific QB Bias Breakdown
    print("\n" + "-" * 80)
    print("--- TIER-SPECIFIC QB BIAS BREAKDOWN ---")
    print("-" * 80)

    # Segment by predicted tier
    high_proj = df_qb[df_qb['predicted_ppg'] >= 17.0]
    mid_proj = df_qb[(df_qb['predicted_ppg'] >= 14.0) & (df_qb['predicted_ppg'] < 17.0)]
    low_proj = df_qb[df_qb['predicted_ppg'] < 14.0]

    # Starters vs Backups (Top 12 in actual scoring per season)
    starters = []
    backups = []
    for yr, group in df_qb.groupby('season'):
        sorted_g = group.sort_values(by='actual_ppg', ascending=False)
        starters.append(sorted_g.head(12))
        if len(sorted_g) > 12:
            backups.append(sorted_g.iloc[12:])
    df_starters = pd.concat(starters) if starters else pd.DataFrame()
    df_backups = pd.concat(backups) if backups else pd.DataFrame()

    print(f"Tier: High Projections (Pred >= 17.0 PPG, N = {len(high_proj)}):")
    if len(high_proj) > 0:
        h_bias = high_proj['error'].mean()
        h_act = high_proj['actual_ppg'].mean()
        h_pred = high_proj['predicted_ppg'].mean()
        print(f"  Actual: {h_act:.2f} PPG | Predicted: {h_pred:.2f} PPG | Bias: {h_bias:+.3f} PPG (p = {stats.ttest_1samp(high_proj['error'], 0)[1]:.3f})")

    print(f"\nTier: Mid Projections (14.0 <= Pred < 17.0 PPG, N = {len(mid_proj)}):")
    if len(mid_proj) > 0:
        m_bias = mid_proj['error'].mean()
        m_act = mid_proj['actual_ppg'].mean()
        m_pred = mid_proj['predicted_ppg'].mean()
        print(f"  Actual: {m_act:.2f} PPG | Predicted: {m_pred:.2f} PPG | Bias: {m_bias:+.3f} PPG (p = {stats.ttest_1samp(mid_proj['error'], 0)[1]:.3f})")

    print(f"\nTier: Low Projections (Pred < 14.0 PPG, N = {len(low_proj)}):")
    if len(low_proj) > 0:
        l_bias = low_proj['error'].mean()
        l_act = low_proj['actual_ppg'].mean()
        l_pred = low_proj['predicted_ppg'].mean()
        print(f"  Actual: {l_act:.2f} PPG | Predicted: {l_pred:.2f} PPG | Bias: {l_bias:+.3f} PPG (p = {stats.ttest_1samp(low_proj['error'], 0)[1]:.3f})")

    print(f"\nTier: Top-12 Fantasy Starters (Per Season, N = {len(df_starters)}):")
    if len(df_starters) > 0:
        st_bias = df_starters['error'].mean()
        st_act = df_starters['actual_ppg'].mean()
        st_pred = df_starters['predicted_ppg'].mean()
        print(f"  Actual: {st_act:.2f} PPG | Predicted: {st_pred:.2f} PPG | Bias: {st_bias:+.3f} PPG (p = {stats.ttest_1samp(df_starters['error'], 0)[1]:.3f})")

    # 6. Cross-Positional Bias Comparison
    print("\n" + "=" * 80)
    print("--- CROSS-POSITIONAL BIAS BENCHMARK (QB vs RB vs WR vs TE) ---")
    print("=" * 80)
    print(f"{'Position':<10} {'N':<6} {'Actual Mean':<12} {'Pred Mean':<12} {'Mean Bias':<14} {'Median Bias':<14} {'MAE':<8} {'RMSE':<8} {'R²':<6}")
    print("-" * 80)

    for pos in ['QB', 'RB', 'WR', 'TE']:
        df_p = pos_results[pos]
        p_n = len(df_p)
        p_act = df_p['actual_ppg'].mean()
        p_pred = df_p['predicted_ppg'].mean()
        p_bias = df_p['error'].mean()
        p_med_bias = df_p['error'].median()
        p_mae = df_p['abs_error'].mean()
        p_rmse = math.sqrt(mean_squared_error(df_p['actual_ppg'], df_p['predicted_ppg']))
        p_r2 = r2_score(df_p['actual_ppg'], df_p['predicted_ppg'])
        print(f"{pos:<10} {p_n:<6} {p_act:8.2f} PPG  {p_pred:8.2f} PPG  {p_bias:+8.3f} PPG    {p_med_bias:+8.3f} PPG    {p_mae:6.2f}   {p_rmse:6.2f}   {p_r2:+5.2f}")

    # 7. Elite QB Historical Track Record (Hurts, Allen, Jackson, Daniels)
    print("\n" + "=" * 80)
    print("--- HISTORICAL OUT-OF-SAMPLE PREDICTIONS FOR ELITE DUAL-THREAT QBS ---")
    print("=" * 80)
    target_qbs = ['Jalen Hurts', 'Josh Allen', 'Lamar Jackson', 'Jayden Daniels', 'Patrick Mahomes']
    df_elite = df_qb[df_qb['player_name'].isin(target_qbs)].sort_values(by=['player_name', 'season'])
    
    print(f"{'Player Name':<20} {'Season':<8} {'Predicted PPG':<15} {'Actual PPG':<15} {'Residual (Pred-Act)':<20}")
    print("-" * 80)
    for _, r in df_elite.iterrows():
        print(f"{r['player_name']:<20} {r['season']:<8} {r['predicted_ppg']:8.2f} PPG       {r['actual_ppg']:8.2f} PPG       {r['error']:+8.2f} PPG")

if __name__ == '__main__':
    run_qb_bias_diagnostic()
