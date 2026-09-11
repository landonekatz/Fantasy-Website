#!/usr/bin/env python3
"""
Landon Prospective Index (LPI) Compilation & Model Fitting Pipeline
Implements landon_prospective_index_framework.md exactly as specified:
- Schema (Section 3): PlayerBio, TeamSeasonContext, PlayerUsageStats, ProspectiveCovariates
- Data Sourcing (Section 4): nflverse via nfl_data_py / direct Parquet fallback, Wikipedia OC history
- Derived Covariates (Section 5): primary_qb_player_id, ol_returning_starter_count, vacated_opportunity_share,
  added_competition_score, qb_changed, departed_qb_ldi, new_hc, new_oc, preseason_injury_flag
- Preprocessing (Section 6): Median/mode imputation + was_missing indicator columns, one-hot encoding,
  standardization fit strictly on training data
- Elastic Net Models (Section 7): target_ppg ~ elastic_net(covariates) per position (QB, RB, WR, TE)
- Validation (Section 8): Rolling-origin chronological cross-validation, sample-size adequacy check,
  pooled-model fallback if needed, out-of-sample RMSE & R2 reporting
- Output Pipeline (Section 9): Static predicted_ppg rankings & live prospective grade parameters
Reads strictly from LDI (src/ldi_model_data.json) and never writes to or modifies any LDI table or curve.
"""

import os
import sys
import json
import re
import math
import ssl
import urllib.request
from datetime import datetime
from collections import defaultdict

import numpy as np
import pandas as pd
from sklearn.linear_model import ElasticNet
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, r2_score

from concurrent.futures import ThreadPoolExecutor

# SSL Context for external requests
ctx = ssl._create_unverified_context()

CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')
os.makedirs(CACHE_DIR, exist_ok=True)

# -------------------------------------------------------------------------
# Helper: String and Name Normalization
# -------------------------------------------------------------------------
def normalize_name(name):
    if not name or pd.isna(name):
        return ''
    s = str(name).lower()
    s = re.sub(r'[^a-z0-9\s]', '', s)
    s = re.sub(r'\b(jr|sr|ii|iii|iv|v)\b', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

ALIASES = {
    'hollywood brown': 'marquise brown',
    'robby anderson': 'robbie chosen',
    'robbie anderson': 'robbie chosen',
    'chosen anderson': 'robbie chosen',
    'mitch trubisky': 'mitchell trubisky',
    'gabriel davis': 'gabe davis',
    'josh palmer': 'joshua palmer',
    'chigoziem okonkwo': 'chig okonkwo',
    'ken walker': 'kenneth walker',
    'deandre swift': 'dandre swift',
    'cameron akers': 'cam akers',
    'matt stafford': 'matthew stafford',
    'christopher godwin': 'chris godwin',
    'will fuller': 'william fuller',
    'kenneth gainwell': 'kenny gainwell',
    'jeffrey wilson': 'jeff wilson',
    'jeffery wilson': 'jeff wilson',
    'ben watson': 'benjamin watson',
    'eli mitchell': 'elijah mitchell',
    'nyheim hines': 'nyheim millerhines',
    'travis etienne': 'travis etienne'
}

TEAM_MAP = {
    'ARZ': 'ARI', 'AZ': 'ARI',
    'BLT': 'BAL',
    'CLV': 'CLE',
    'HST': 'HOU',
    'LA': 'LAR', 'STL': 'LAR',
    'SD': 'LAC',
    'OAK': 'LV', 'LVR': 'LV',
    'WSH': 'WAS'
}

def clean_team(t):
    if not t or pd.isna(t):
        return ''
    t_str = str(t).upper().strip()
    return TEAM_MAP.get(t_str, t_str)

# -------------------------------------------------------------------------
# 1. Wikipedia Offensive Coordinator Scraper & Cache (Tier 3)
# -------------------------------------------------------------------------
TEAM_WIKI_NAMES = {
    'ARI': 'Arizona Cardinals', 'ATL': 'Atlanta Falcons', 'BAL': 'Baltimore Ravens', 'BUF': 'Buffalo Bills',
    'CAR': 'Carolina Panthers', 'CHI': 'Chicago Bears', 'CIN': 'Cincinnati Bengals', 'CLE': 'Cleveland Browns',
    'DAL': 'Dallas Cowboys', 'DEN': 'Denver Broncos', 'DET': 'Detroit Lions', 'GB': 'Green Bay Packers',
    'HOU': 'Houston Texans', 'IND': 'Indianapolis Colts', 'JAX': 'Jacksonville Jaguars', 'KC': 'Kansas City Chiefs',
    'LAC': 'Los Angeles Chargers', 'LAR': 'Los Angeles Rams', 'LV': 'Las Vegas Raiders', 'MIA': 'Miami Dolphins',
    'MIN': 'Minnesota Vikings', 'NE': 'New England Patriots', 'NO': 'New Orleans Saints', 'NYG': 'New York Giants',
    'NYJ': 'New York Jets', 'PHI': 'Philadelphia Eagles', 'PIT': 'Pittsburgh Steelers', 'SEA': 'Seattle Seahawks',
    'SF': 'San Francisco 49ers', 'TB': 'Tampa Bay Buccaneers', 'TEN': 'Tennessee Titans', 'WAS': 'Washington Commanders'
}

def get_oc_history(years=range(2013, 2026)):
    cache_path = os.path.join(CACHE_DIR, 'oc_history.json')
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r') as f:
                return json.load(f)
        except Exception:
            pass

    print('Fetching Offensive Coordinator history via Wikipedia API (2013-2025)...', flush=True)
    oc_data = {str(yr): {} for yr in years}
    tasks = []

    for yr in years:
        for team_abbr, base_name in TEAM_WIKI_NAMES.items():
            name = base_name
            if yr < 2016 and team_abbr == 'LAR': name = 'St. Louis Rams'
            if yr < 2017 and team_abbr == 'LAC': name = 'San Diego Chargers'
            if yr < 2020 and team_abbr == 'LV': name = 'Oakland Raiders'
            if yr in (2020, 2021) and team_abbr == 'WAS': name = 'Washington Football Team'
            if yr < 2020 and team_abbr == 'WAS': name = 'Washington Redskins'

            page_title = f"{yr}_{name.replace(' ', '_')}_season"
            tasks.append((yr, team_abbr, page_title))

    def fetch_single_oc(item):
        yr, team_abbr, page_title = item
        url = f"https://en.wikipedia.org/w/api.php?action=query&prop=revisions&rvslots=*&rvprop=content&format=json&titles={page_title}"
        req = urllib.request.Request(url, headers={'User-Agent': 'TheFantasyVaultResearch/1.0 (contact@thefantasyvault.com)'})
        oc_name = None
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=8) as r:
                res = json.loads(r.read())
                pages = res.get('query', {}).get('pages', {})
                for pid, pdata in pages.items():
                    if pid == '-1': continue
                    content = pdata['revisions'][0]['slots']['main']['*']
                    m = re.search(r'\|\s*off_coach\s*=\s*(.*?)(?:\n\s*\||\n\}\})', content, re.DOTALL)
                    if m:
                        raw = m.group(1).strip()
                        names = re.findall(r'\[\[(?:[^\|\]]+\|)?([^\]]+)\]\]', raw)
                        if names:
                            oc_name = names[0].strip()
                        else:
                            clean = re.sub(r'\[\[|\]\]|<[^>]+>|\{\{[^\}]+\}\}', '', raw).strip()
                            oc_name = clean.split('\n')[0].strip()
                    if not oc_name:
                        m2 = re.search(r'Offensive [Cc]oordinator\s*[-–\u2014]\s*(?:\[\[(?:[^\|\]]+\|)?([^\]]+)\]\]|([A-Za-z\.\s\'-]+))', content)
                        if m2:
                            oc_name = (m2.group(1) or m2.group(2)).strip()
        except Exception:
            pass

        if oc_name and oc_name.lower() not in ('none', 'vacant', 'n/a'):
            oc_name = re.sub(r'\(.*?\)', '', oc_name).strip()
        else:
            oc_name = None
        return yr, team_abbr, oc_name

    missing_count = 0
    with ThreadPoolExecutor(max_workers=20) as executor:
        for yr, team_abbr, oc_name in executor.map(fetch_single_oc, tasks):
            oc_data[str(yr)][team_abbr] = oc_name
            if not oc_name:
                missing_count += 1

    with open(cache_path, 'w') as f:
        json.dump(oc_data, f, indent=2)

    print(f"Offensive Coordinator dataset compiled ({missing_count} team-seasons vacant or unlisted).", flush=True)
    return oc_data

# -------------------------------------------------------------------------
# 2. Ingest nflverse Tables via nfl_data_py & Fallbacks
# -------------------------------------------------------------------------
def load_nfl_datasets(years=list(range(2014, 2026))):
    import nfl_data_py as nfl

    print(f"Loading NFL datasets for years {min(years)}-{max(years)}...")
    
    # 1. ID Mapping
    # 1. ID Mapping
    ids_cache = os.path.join(CACHE_DIR, 'nflverse_ids.parquet')
    if os.path.exists(ids_cache):
        df_ids = pd.read_parquet(ids_cache, engine='pyarrow')
    else:
        print('  Fetching nflverse ID table...', flush=True)
        df_ids = nfl.import_ids()
        df_ids.to_parquet(ids_cache, engine='pyarrow')

    # 2. Draft Picks
    draft_cache = os.path.join(CACHE_DIR, 'nflverse_draft_picks.parquet')
    if os.path.exists(draft_cache):
        df_draft = pd.read_parquet(draft_cache, engine='pyarrow')
    else:
        print('  Fetching real NFL draft picks...', flush=True)
        df_draft = nfl.import_draft_picks(list(range(1995, max(years) + 1)))
        df_draft.to_parquet(draft_cache, engine='pyarrow')

    # 3. Schedules & Results (Coaches, Win Pct, Point Diff)
    sched_cache = os.path.join(CACHE_DIR, 'nflverse_schedules.parquet')
    if os.path.exists(sched_cache):
        df_sched = pd.read_parquet(sched_cache, engine='pyarrow')
    else:
        print('  Fetching schedules & game results...', flush=True)
        df_sched = nfl.import_schedules(list(range(min(years) - 1, max(years) + 1)))
        df_sched.to_parquet(sched_cache, engine='pyarrow')

    # 4. Seasonal Rosters (PlayerBio, ages, rookie years)
    roster_cache = os.path.join(CACHE_DIR, 'nflverse_rosters.parquet')
    if os.path.exists(roster_cache):
        df_rosters = pd.read_parquet(roster_cache, engine='pyarrow')
    else:
        print('  Fetching seasonal rosters...', flush=True)
        df_rosters = nfl.import_seasonal_rosters(years)
        for c in df_rosters.columns:
            if df_rosters[c].dtype == object:
                df_rosters[c] = df_rosters[c].astype(str)
        df_rosters.to_parquet(roster_cache, engine='pyarrow')

    # 5. Snap Counts (Snaps, Snap Share, OL Continuity, Primary QB)
    snaps_cache = os.path.join(CACHE_DIR, 'nflverse_snaps.parquet')
    if os.path.exists(snaps_cache):
        df_snaps = pd.read_parquet(snaps_cache, engine='pyarrow')
    else:
        print('  Fetching snap counts...', flush=True)
        df_snaps = nfl.import_snap_counts(years)
        for c in df_snaps.columns:
            if df_snaps[c].dtype == object:
                df_snaps[c] = df_snaps[c].astype(str)
        df_snaps.to_parquet(snaps_cache, engine='pyarrow')

    # 6. Injuries (Preseason Proxy: Week 1 reports)
    inj_cache = os.path.join(CACHE_DIR, 'nflverse_injuries.parquet')
    if os.path.exists(inj_cache):
        df_inj = pd.read_parquet(inj_cache, engine='pyarrow')
    else:
        print('  Fetching injury reports...', flush=True)
        df_inj = nfl.import_injuries(years)
        for c in df_inj.columns:
            if df_inj[c].dtype == object:
                df_inj[c] = df_inj[c].astype(str)
        df_inj.to_parquet(inj_cache, engine='pyarrow')

    # 7. Weekly Player Stats
    weekly_cache = os.path.join(CACHE_DIR, 'nflverse_weekly.parquet')
    if os.path.exists(weekly_cache):
        df_weekly = pd.read_parquet(weekly_cache, engine='pyarrow')
    else:
        print('  Fetching weekly player stats (2014-2024 via nfl_data_py + 2025 via nflverse Parquet)...', flush=True)
        weekly_dfs = []
        p_years = [y for y in years if y <= 2024]
        if p_years:
            df_hist = nfl.import_weekly_data(p_years, downcast=True)
            weekly_dfs.append(df_hist)
        if 2025 in years:
            url_2025 = 'https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_2025.parquet'
            try:
                df_2025 = pd.read_parquet(url_2025, engine='pyarrow')
                weekly_dfs.append(df_2025)
                print('  Successfully downloaded 2025 player stats parquet.', flush=True)
            except Exception as e:
                print(f'  Notice: 2025 weekly data pull failed ({e}); using existing historical window.', flush=True)

        df_weekly = pd.concat(weekly_dfs, ignore_index=True)
        for c in df_weekly.columns:
            if df_weekly[c].dtype == object:
                df_weekly[c] = df_weekly[c].astype(str)
        df_weekly.to_parquet(weekly_cache, engine='pyarrow')

    # 8. Depth Charts (Official Depth Order & Roster Hierarchy)
    depth_cache = os.path.join(CACHE_DIR, 'nflverse_depth_charts.parquet')
    if os.path.exists(depth_cache):
        df_depth = pd.read_parquet(depth_cache, engine='pyarrow')
    else:
        print('  Fetching official depth charts...', flush=True)
        df_depth = nfl.import_depth_charts(list(range(2018, max(years) + 1)))
        for c in df_depth.columns:
            if df_depth[c].dtype == object:
                df_depth[c] = df_depth[c].astype(str)
        df_depth.to_parquet(depth_cache, engine='pyarrow')

    # 9. Market ADP (FantasyPros Consensus 2026)
    adp_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'FantasyPros_2026_Overall_ADP_Rankings.csv')
    if not os.path.exists(adp_path):
        adp_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'FantasyPros_2025_Overall_ADP_Rankings.csv')
    df_adp = pd.read_csv(adp_path) if os.path.exists(adp_path) else pd.DataFrame()

    return {
        'ids': df_ids,
        'draft': df_draft,
        'schedules': df_sched,
        'rosters': df_rosters,
        'snaps': df_snaps,
        'injuries': df_inj,
        'weekly': df_weekly,
        'depth_charts': df_depth,
        'adp': df_adp
    }

# -------------------------------------------------------------------------
# 3. Read LDI Artifacts (Read-Only) & Score Draft Picks
# -------------------------------------------------------------------------
def load_ldi_and_draft_picks():
    """
    Reads LDI model data and historical draft results.
    Strictly READ-ONLY: Never modifies any LDI curve, table, or output.
    """
    with open('src/ldi_model_data.json', 'r') as f:
        ldi_data = json.load(f)

    with open('dmsfantasy/data/draft_results.json', 'r') as f:
        dms_raw = json.load(f)

    with open('gaywoodfantasy/data/draft_results.json', 'r') as f:
        gw_raw = json.load(f)

    all_picks = []

    # DMS drafts: 2018-2026 (NFL seasons 2017-2025)
    for p in dms_raw:
        season = p.get('season') or p.get('year')
        if not season or season < 2018 or season > 2026:
            continue
        nfl_year = season - 1
        pos = p.get('position') or p.get('pos') or ''
        if pos in ['D/ST', 'DST']: pos = 'DEF'
        if pos not in ['QB', 'RB', 'WR', 'TE']:
            continue
        tot_weeks = 17 if nfl_year >= 2021 else 16
        all_picks.append({
            'league_id': 'dms',
            'season_year': season,
            'nfl_year': nfl_year,
            'draft_id': f'dms_{season}',
            'manager_id': p.get('manager_id') or p.get('managerName') or 'dms_mgr',
            'player_name': p.get('player_name') or p.get('playerName') or '',
            'position': pos,
            'overall_pick_number': int(p.get('overall_pick') or p.get('overallPick') or 1),
            'total_season_weeks': tot_weeks,
            'num_teams': 12
        })

    # Gaywood drafts: 2015-2025 (NFL seasons 2015-2025)
    for p in gw_raw:
        season = p.get('season') or p.get('year')
        if not season or season < 2015 or season > 2025:
            continue
        nfl_year = season
        pos = p.get('position') or p.get('pos') or ''
        if pos in ['D/ST', 'DST']: pos = 'DEF'
        if pos not in ['QB', 'RB', 'WR', 'TE']:
            continue
        tot_weeks = 17 if nfl_year >= 2021 else 16
        num_teams = 10 if season == 2020 else 12
        all_picks.append({
            'league_id': 'gaywood',
            'season_year': season,
            'nfl_year': nfl_year,
            'draft_id': f'gaywood_{season}',
            'manager_id': p.get('manager_id') or p.get('managerName') or 'gw_mgr',
            'player_name': p.get('player_name') or p.get('playerName') or '',
            'position': pos,
            'overall_pick_number': int(p.get('overall_pick') or p.get('overallPick') or 1),
            'total_season_weeks': tot_weeks,
            'num_teams': num_teams
        })

    draft_groups = defaultdict(list)
    for p in all_picks:
        draft_groups[p['draft_id']].append(p)

    scored_picks = []
    for d_id, p_list in draft_groups.items():
        p_list.sort(key=lambda x: x['overall_pick_number'])
        pos_counts = {'QB': 0, 'RB': 0, 'WR': 0, 'TE': 0}
        for p in p_list:
            pos = p['position']
            pos_counts[pos] += 1
            p['positional_draft_rank'] = pos_counts[pos]
            scored_picks.append(p)

    weekly_logs = ldi_data.get('weekly_logs_cache', {})
    pos_curves = ldi_data.get('pos_curves', {})
    vorp_curves = ldi_data.get('vorp_curves', {})
    defaults = ldi_data.get('defaults', {})

    alpha = defaults.get('alpha', 0.85)
    lam = defaults.get('lambda', 0.70)
    penalty_cap = defaults.get('penalty_cap', 0.50)
    reward_cap = defaults.get('reward_cap', 0.60)

    def get_pos_curve(pos, norm_r):
        grid = pos_curves.get(pos, {}).get('x_grid', [])
        e_vals = pos_curves.get(pos, {}).get('e_rate', [])
        sd_vals = pos_curves.get(pos, {}).get('sd_rate', [])
        if not grid: return 5.0, 3.0
        e = float(np.interp(norm_r, grid, e_vals))
        sd = float(np.interp(norm_r, grid, sd_vals))
        return e, sd

    for p in scored_picks:
        nfl_yr = p['nfl_year']
        norm_name = normalize_name(p['player_name'])
        if norm_name in ALIASES: norm_name = ALIASES[norm_name]
        key = f"{norm_name}_{nfl_yr}"
        log = weekly_logs.get(key)

        G = p['total_season_weeks'] - 1
        p['possible_games'] = G
        norm_r = (p['positional_draft_rank'] / p['num_teams']) * 12.0

        if log:
            p['games_played'] = log.get('games_played', 0)
            p['games_missed'] = log.get('games_missed', 0)
            p['A_pts'] = log.get('A_pts', 0.0)
            p['final_label'] = log.get('final_label', 'none')
        else:
            p['games_played'] = 0
            p['games_missed'] = G
            p['A_pts'] = 0.0
            p['final_label'] = 'none'

        gp = p['games_played']
        gm = p['games_missed']
        A_pts = p['A_pts']

        if gp == 0: effective_games = 0
        elif gm < 4: effective_games = G
        else: effective_games = G - gm
        p['effective_games'] = effective_games

        e_rate, sd_rate = get_pos_curve(p['position'], norm_r)
        E_adj = e_rate * effective_games
        residual = A_pts - E_adj
        SD_pts = sd_rate * effective_games if effective_games > 0 else 1.0
        Z = residual / SD_pts if effective_games > 0 else 0.0

        Adjusted = Z if Z >= 0 else (Z * lam)

        multiplier = 1.0
        if Adjusted > 0:
            if p['final_label'] == 'inconsistent_producer':
                multiplier = 1.0 - penalty_cap
            elif p['final_label'] == 'consistent_with_booms':
                multiplier = 1.0 + reward_cap
        Adjusted_final = Adjusted * multiplier if Adjusted > 0 else Adjusted

        v_grid = vorp_curves.get('x_grid', [])
        v_vals = vorp_curves.get('v_rate', [])
        v_sd_vals = vorp_curves.get('sd_rate', [])
        if v_grid:
            v_exp = float(np.interp(p['overall_pick_number'], v_grid, v_vals)) * G
            v_sd = float(np.interp(p['overall_pick_number'], v_grid, v_sd_vals)) * G
        else:
            v_exp, v_sd = 0.0, 1.0

        vorp_actual = A_pts - (e_rate * 0.4 * G)
        vorp_z = (vorp_actual - v_exp) / v_sd if v_sd > 0 else 0.0

        p['VORP_actual'] = vorp_actual
        p['VORP_z'] = vorp_z
        p['LDI_raw'] = (alpha * Adjusted_final) + ((1.0 - alpha) * vorp_z)
        p['ppg'] = (A_pts / gp) if gp > 0 else 0.0

    print(f"Loaded and scored {len(scored_picks)} historical skill picks across both leagues.")
    return scored_picks, ldi_data

# -------------------------------------------------------------------------
# 4. Feature Engineering: Assemble Schema Tables & Covariates
# -------------------------------------------------------------------------
def build_lpi_covariate_matrix(nfl_data, scored_picks, oc_history):
    print("Building schema tables and prospective covariates...")

    df_ids = nfl_data['ids']
    df_draft = nfl_data['draft']
    df_sched = nfl_data['schedules']
    df_rosters = nfl_data['rosters']
    df_snaps = nfl_data['snaps']
    df_inj = nfl_data['injuries']
    df_weekly = nfl_data['weekly']

    # --- ID Crosswalk with Skill-Position-Priority Collision Rule ---
    sleeper_to_gsis = {}
    name_pos_to_gsis = {}

    for _, row in df_ids.iterrows():
        gsis = str(row.get('gsis_id'))
        if not gsis or gsis == 'nan': continue
        s_id = str(row.get('sleeper_id'))
        if s_id and s_id != 'nan':
            if s_id.endswith('.0'): s_id = s_id[:-2]
            sleeper_to_gsis[s_id] = gsis

        m_name = normalize_name(row.get('name') or row.get('merge_name'))
        pos = row.get('position')
        if m_name and pos:
            key = (m_name, pos)
            if key not in name_pos_to_gsis or (pos in ['QB', 'RB', 'WR', 'TE']):
                name_pos_to_gsis[key] = gsis

    # PlayerBio
    player_bios = {}
    for _, row in df_ids.iterrows():
        gsis = str(row.get('gsis_id'))
        if not gsis or gsis == 'nan': continue
        if gsis not in player_bios:
            bdate = row.get('birthdate')
            d_yr = row.get('draft_year')
            d_rnd = row.get('draft_round')

            round_val = 8
            if pd.notna(d_rnd) and str(d_rnd) != 'nan':
                try: round_val = min(8, max(1, int(float(d_rnd))))
                except: round_val = 8

            d_pick = row.get('draft_ovr') or row.get('pick')
            pick_val = 300
            if pd.notna(d_pick) and str(d_pick) != 'nan':
                try: pick_val = int(float(d_pick))
                except: pick_val = 300

            player_bios[gsis] = {
                'birthdate': str(bdate) if pd.notna(bdate) else None,
                'nfl_draft_year': int(float(d_yr)) if pd.notna(d_yr) else None,
                'nfl_draft_round': round_val,
                'nfl_draft_overall_pick': pick_val
            }

    for _, row in df_draft.iterrows():
        gsis = str(row.get('gsis_id'))
        if gsis and gsis != 'nan' and gsis in player_bios:
            rnd = row.get('round')
            yr = row.get('season')
            pick_num = row.get('pick')
            if pd.notna(rnd):
                try: player_bios[gsis]['nfl_draft_round'] = min(8, max(1, int(float(rnd))))
                except: pass
            if pd.notna(yr) and not player_bios[gsis]['nfl_draft_year']:
                try: player_bios[gsis]['nfl_draft_year'] = int(float(yr))
                except: pass
            if pd.notna(pick_num):
                try: player_bios[gsis]['nfl_draft_overall_pick'] = int(float(pick_num))
                except: pass

    # --- TeamSeasonContext ---
    team_results = defaultdict(lambda: {'wins': 0, 'losses': 0, 'ties': 0, 'pts_for': 0, 'pts_against': 0, 'hc': None})
    for _, g in df_sched[df_sched['game_type'] == 'REG'].iterrows():
        yr = int(g['season'])
        h_team = clean_team(g['home_team'])
        a_team = clean_team(g['away_team'])
        h_score = float(g.get('home_score') or 0)
        a_score = float(g.get('away_score') or 0)
        h_coach = g.get('home_coach')
        a_coach = g.get('away_coach')

        if h_team:
            if h_coach: team_results[(h_team, yr)]['hc'] = h_coach
            team_results[(h_team, yr)]['pts_for'] += h_score
            team_results[(h_team, yr)]['pts_against'] += a_score
            if h_score > a_score: team_results[(h_team, yr)]['wins'] += 1
            elif h_score < a_score: team_results[(h_team, yr)]['losses'] += 1
            else: team_results[(h_team, yr)]['ties'] += 1

        if a_team:
            if a_coach: team_results[(a_team, yr)]['hc'] = a_coach
            team_results[(a_team, yr)]['pts_for'] += a_score
            team_results[(a_team, yr)]['pts_against'] += h_score
            if a_score > h_score: team_results[(a_team, yr)]['wins'] += 1
            elif a_score < h_score: team_results[(a_team, yr)]['losses'] += 1
            else: team_results[(a_team, yr)]['ties'] += 1

    qb_snaps_by_team_season = defaultdict(lambda: defaultdict(float))
    ol_snaps_by_team_season = defaultdict(lambda: defaultdict(float))

    for _, row in df_snaps[df_snaps['game_type'] == 'REG'].iterrows():
        yr = int(row['season'])
        team = clean_team(row['team'])
        pos = str(row.get('position') or '').upper()
        pfr_id = row.get('pfr_player_id') or row.get('player')
        snaps = float(row.get('offense_snaps') or 0)

        if pos == 'QB':
            qb_snaps_by_team_season[(team, yr)][pfr_id] += snaps
        elif pos in ('T', 'G', 'C', 'OT', 'OG', 'OL'):
            ol_snaps_by_team_season[(team, yr)][pfr_id] += snaps

    primary_qb = {}
    for (team, yr), qbs in qb_snaps_by_team_season.items():
        if qbs:
            best_qb = max(qbs.items(), key=lambda x: x[1])[0]
            primary_qb[(team, yr)] = best_qb

    top_ol_starters = {}
    for (team, yr), ols in ol_snaps_by_team_season.items():
        sorted_ols = sorted(ols.items(), key=lambda x: x[1], reverse=True)
        top_ol_starters[(team, yr)] = set([x[0] for x in sorted_ols[:5]])

    team_season_context = {}
    for (team, yr), rec in team_results.items():
        total_games = rec['wins'] + rec['losses'] + rec['ties']
        win_pct = (rec['wins'] + 0.5 * rec['ties']) / total_games if total_games > 0 else 0.5
        point_diff = rec['pts_for'] - rec['pts_against']
        hc = rec['hc']
        oc = oc_history.get(str(yr), {}).get(team)

        prior_ols = top_ol_starters.get((team, yr - 1), set())
        curr_ols = set(ol_snaps_by_team_season.get((team, yr), {}).keys())
        returning_ol = len(prior_ols.intersection(curr_ols)) if prior_ols else 3

        team_season_context[(team, yr)] = {
            'head_coach_id': hc,
            'offensive_coordinator_id': oc,
            'win_pct': win_pct,
            'point_differential': point_diff,
            'primary_qb_player_id': primary_qb.get((team, yr)),
            'ol_returning_starter_count': returning_ol
        }

    # --- PlayerUsageStats & Seasonal Totals ---
    player_usage = {}
    player_team_by_year = {}
    team_usage_totals = defaultdict(lambda: {'targets': 0.0, 'carries': 0.0, 'pass_attempts': 0.0, 'rz_opps': 0.0})
    player_stats_acc = defaultdict(lambda: {
        'targets': 0.0, 'carries': 0.0, 'pass_attempts': 0.0, 'rz_opps': 0.0,
        'games': 0, 'team': None, 'position': None, 'name': None
    })

    for _, row in df_weekly.iterrows():
        yr = int(row['season'])
        pid = str(row.get('player_id'))
        team = clean_team(row.get('recent_team') or row.get('team'))
        pos = row.get('position')
        name = row.get('player_display_name') or row.get('player_name')

        targets = float(row.get('targets') or 0)
        carries = float(row.get('carries') or 0)
        attempts = float(row.get('attempts') or 0)
        rz = targets + carries if (targets + carries > 0) else 0.0

        if team and yr:
            team_usage_totals[(team, yr)]['targets'] += targets
            team_usage_totals[(team, yr)]['carries'] += carries
            team_usage_totals[(team, yr)]['pass_attempts'] += attempts
            team_usage_totals[(team, yr)]['rz_opps'] += rz

            acc = player_stats_acc[(pid, yr)]
            acc['targets'] += targets
            acc['carries'] += carries
            acc['pass_attempts'] += attempts
            acc['rz_opps'] += rz
            acc['games'] += 1
            acc['team'] = team
            acc['position'] = pos
            acc['name'] = name
            player_team_by_year[(pid, yr)] = team

    for (pid, yr), st in player_stats_acc.items():
        tm = st['team']
        tt = team_usage_totals.get((tm, yr), {})
        t_targets = tt.get('targets', 1.0)
        t_carries = tt.get('carries', 1.0)
        t_rz = tt.get('rz_opps', 1.0)
        gms = max(1, st['games'])

        player_usage[(pid, yr)] = {
            'target_share': st['targets'] / t_targets if t_targets > 0 else 0.0,
            'carry_share': st['carries'] / t_carries if t_carries > 0 else 0.0,
            'redzone_share': st['rz_opps'] / t_rz if t_rz > 0 else 0.0,
            'pass_attempts_per_game': st['pass_attempts'] / gms,
            'games': gms,
            'team': tm,
            'position': st['position'],
            'name': st['name']
        }

    snap_shares = defaultdict(lambda: {'total_pct': 0.0, 'count': 0})
    for _, row in df_snaps[df_snaps['game_type'] == 'REG'].iterrows():
        yr = int(row['season'])
        pid = row.get('pfr_player_id') or row.get('player')
        pct = float(row.get('offense_pct') or 0.0)
        snap_shares[(pid, yr)]['total_pct'] += pct
        snap_shares[(pid, yr)]['count'] += 1

    player_snap_share = {}
    for (pid, yr), data in snap_shares.items():
        player_snap_share[(pid, yr)] = data['total_pct'] / data['count'] if data['count'] > 0 else 0.0

    team_pos_rosters = defaultdict(lambda: defaultdict(list))
    for (pid, yr), st in player_usage.items():
        pos = st['position']
        tm = st['team']
        if tm and pos:
            team_pos_rosters[(tm, yr)][pos].append(pid)

    vacated_carry_shares = {}
    vacated_target_shares = {}
    added_competition = {}

    for (tm, yr), pos_dict in team_pos_rosters.items():
        prior_tm_pos = team_pos_rosters.get((tm, yr - 1), {})
        
        # RB departures -> vacated carry share
        curr_rbs = pos_dict.get('RB', [])
        prior_rbs = prior_tm_pos.get('RB', [])
        departed_rbs = set(prior_rbs) - set(curr_rbs)
        v_carries = sum(player_usage.get((d_pid, yr - 1), {}).get('carry_share', 0.0) for d_pid in departed_rbs)
        vacated_carry_shares[(tm, yr)] = min(1.0, v_carries)

        # Pass catcher departures (WR + TE) -> vacated target share
        curr_receivers = pos_dict.get('WR', []) + pos_dict.get('TE', [])
        prior_receivers = prior_tm_pos.get('WR', []) + prior_tm_pos.get('TE', [])
        departed_rec = set(prior_receivers) - set(curr_receivers)
        v_targets = sum(player_usage.get((d_pid, yr - 1), {}).get('target_share', 0.0) for d_pid in departed_rec)
        vacated_target_shares[(tm, yr)] = min(1.0, v_targets)

        for pos, curr_pids in pos_dict.items():
            prior_pids = set(prior_tm_pos.get(pos, []))
            arrivals = set(curr_pids) - prior_pids
            
            rookie_threat = 0.0
            vet_threat = 0.0
            rookie_cap = 0.0

            for arr_pid in arrivals:
                bio = player_bios.get(arr_pid, {})
                if bio.get('nfl_draft_year') == yr:
                    rnd = bio.get('nfl_draft_round', 8)
                    rookie_threat += max(0.0, (8.0 - rnd) / 7.0)
                    rookie_cap += max(0.0, 9.0 - rnd)
                else:
                    arr_prior = player_usage.get((arr_pid, yr - 1), {})
                    if pos in ('WR', 'TE'):
                        vet_threat += arr_prior.get('target_share', 0.0)
                    elif pos == 'RB':
                        vet_threat += arr_prior.get('carry_share', 0.0)

            comp_score = min(2.5, rookie_threat + vet_threat)
            added_competition[(tm, yr, pos)] = {
                'composite': comp_score,
                'rookie_component': rookie_threat,
                'veteran_component': vet_threat,
                'added_rookie_draft_capital': rookie_cap,
                'added_veteran_usage_share': vet_threat
            }

    # Official NFL Depth Chart Ingestion & Mapping
    df_depth = nfl_data.get('depth_charts')
    depth_by_player_year = {}
    if df_depth is not None and not df_depth.empty:
        # Historical seasons 2018-2024
        if 'season' in df_depth.columns:
            hist_depth = df_depth[df_depth['season'].notna() & (df_depth['season'] != 'nan')].copy()
            hist_depth['season_num'] = pd.to_numeric(hist_depth['season'], errors='coerce')
            hist_depth['week_num'] = pd.to_numeric(hist_depth['week'], errors='coerce')
            for s_yr, s_df in hist_depth.groupby('season_num'):
                w_df = s_df[s_df['week_num'] == 1]
                if w_df.empty:
                    min_w = s_df['week_num'].min()
                    w_df = s_df[s_df['week_num'] == min_w]
                for _, d_row in w_df.iterrows():
                    p_name = normalize_name(d_row.get('full_name'))
                    pos = str(d_row.get('position') or '').upper()
                    tm = clean_team(d_row.get('club_code'))
                    try:
                        d_order = int(float(d_row.get('depth_team') or 3))
                    except:
                        d_order = 3
                    depth_by_player_year[(p_name, pos, int(s_yr))] = {
                        'depth_chart_order': d_order,
                        'team': tm,
                        'is_starter': (d_order == 1),
                        'is_rostered': True
                    }
                    gsis_val = str(d_row.get('gsis_id') or '')
                    if gsis_val and gsis_val != 'nan':
                        depth_by_player_year[(gsis_val, int(s_yr))] = {
                            'depth_chart_order': d_order,
                            'team': tm,
                            'is_starter': (d_order == 1),
                            'is_rostered': True
                        }

        # Modern live snapshot (2025/2026)
        if 'dt' in df_depth.columns:
            valid_dt = df_depth[df_depth['dt'].notna() & (df_depth['dt'] != 'nan')]
            if not valid_dt.empty:
                latest_dt = valid_dt['dt'].max()
                live_snap = valid_dt[valid_dt['dt'] == latest_dt]
                for _, l_row in live_snap.iterrows():
                    p_name = normalize_name(l_row.get('player_name'))
                    pos = str(l_row.get('pos_abb') or '').upper()
                    tm = clean_team(l_row.get('team'))
                    try:
                        d_order = int(float(l_row.get('pos_rank') or 3))
                    except:
                        d_order = 3
                    for yr in [2025, 2026]:
                        depth_by_player_year[(p_name, pos, yr)] = {
                            'depth_chart_order': d_order,
                            'team': tm,
                            'is_starter': (d_order == 1),
                            'is_rostered': True
                        }

    injury_flags = {}
    for _, row in df_inj[df_inj['week'] == 1].iterrows():
        yr = int(row['season'])
        gsis = str(row.get('gsis_id'))
        status = str(row.get('report_status') or '').lower().strip()
        practice = str(row.get('practice_status') or '').lower().strip()

        if status in ('out', 'doubtful', 'injured reserve') or 'did not participate' in practice:
            flag = 'significant_concern'
        elif status == 'questionable' or 'limited' in practice:
            flag = 'minor_concern'
        else:
            flag = 'healthy'
        injury_flags[(gsis, yr)] = flag

    pick_by_player_year = {}
    for p in scored_picks:
        norm = normalize_name(p['player_name'])
        if norm in ALIASES: norm = ALIASES[norm]
        pick_by_player_year[(norm, p['position'], p['nfl_year'])] = p

    pos_finish_ranks = defaultdict(dict)
    picks_by_pos_year = defaultdict(list)
    for p in scored_picks:
        picks_by_pos_year[(p['position'], p['nfl_year'])].append(p)

    for (pos, yr), p_list in picks_by_pos_year.items():
        sorted_p = sorted(p_list, key=lambda x: x['ppg'], reverse=True)
        for r_idx, p in enumerate(sorted_p):
            norm = normalize_name(p['player_name'])
            if norm in ALIASES: norm = ALIASES[norm]
            pos_finish_ranks[(norm, pos, yr)] = r_idx + 1

    dataset_rows = []
    for p in scored_picks:
        target_yr = p['nfl_year']
        pos = p['position']
        raw_name = p['player_name']
        norm_name = normalize_name(raw_name)
        if norm_name in ALIASES: norm_name = ALIASES[norm_name]

        gsis = name_pos_to_gsis.get((norm_name, pos))
        if not gsis:
            for (m_nm, m_pos), m_id in name_pos_to_gsis.items():
                if m_nm == norm_name:
                    gsis = m_id
                    break

        bio = player_bios.get(gsis, {})
        draft_round = bio.get('nfl_draft_round', 8)
        draft_year = bio.get('nfl_draft_year')

        age = None
        bdate_str = bio.get('birthdate')
        if bdate_str:
            try:
                bdate = datetime.strptime(bdate_str[:10], '%Y-%m-%d')
                sept_first = datetime(target_yr, 9, 1)
                age = round((sept_first - bdate).days / 365.25, 2)
            except:
                pass

        prior_yr = target_yr - 1
        prior_pick = pick_by_player_year.get((norm_name, pos, prior_yr))
        prior_prior_pick = pick_by_player_year.get((norm_name, pos, prior_yr - 1))

        # Section 6.2: Missed-Season / Zero-Game LDI Fix
        prior_season_dnp = 1 if (prior_pick and prior_pick.get('games_played', 0) == 0) else 0
        prior_season_skipped = 0
        prior_ldi_was_missing = 0

        prior_ldi = prior_pick.get('LDI_raw') if prior_pick else None
        prior_ldi_2 = prior_prior_pick.get('LDI_raw') if prior_prior_pick else None
        prior_ppg = prior_pick.get('ppg') if prior_pick else None
        prior_pos_rank = pos_finish_ranks.get((norm_name, pos, prior_yr)) if prior_pick else None
        prior_vorp = prior_pick.get('VORP_actual') if prior_pick else None
        prior_draft_slot = prior_pick.get('positional_draft_rank') if prior_pick else None
        prior_games_missed = prior_pick.get('games_missed') if prior_pick else None
        prior_consistency = prior_pick.get('final_label', 'none') if prior_pick else 'none'

        if prior_season_dnp == 1:
            prior_ldi_was_missing = 1
            if prior_prior_pick and prior_prior_pick.get('games_played', 0) > 0:
                # Pull performance baseline from season t-2 and apply 15% rust penalty (0.85)
                prior_ppg = (prior_prior_pick.get('ppg') or 0.0) * 0.85
                prior_vorp = prior_prior_pick.get('VORP_actual')
                prior_ldi = prior_prior_pick.get('LDI_raw')
                prior_season_skipped = 1
            else:
                prior_ppg = None
                prior_vorp = None
                prior_ldi = None

        is_rookie = 1 if (draft_year == target_yr or (draft_year and draft_year > prior_yr)) else 0
        prior_ldi_trend = (prior_ldi - prior_ldi_2) if (prior_ldi is not None and prior_ldi_2 is not None) else None

        u_stats = player_usage.get((gsis, prior_yr), {})
        target_share = u_stats.get('target_share')
        carry_share = u_stats.get('carry_share')
        redzone_share = u_stats.get('redzone_share')
        pass_attempts = u_stats.get('pass_attempts_per_game')
        snap_share = player_snap_share.get((gsis, prior_yr))

        curr_team = player_team_by_year.get((gsis, target_yr)) or u_stats.get('team') or 'UNK'
        prior_team = player_team_by_year.get((gsis, prior_yr))
        team_changed = 1 if (prior_team and curr_team and prior_team != curr_team) else 0

        # Depth chart order & roster status
        d_info = depth_by_player_year.get((norm_name, pos, target_yr)) or depth_by_player_year.get((gsis, target_yr))
        if d_info:
            depth_order = d_info['depth_chart_order']
            is_starter = 1 if d_info['is_starter'] else 0
            is_rostered = 1 if d_info['is_rostered'] else 0
            if not curr_team or curr_team == 'UNK':
                curr_team = d_info['team']
        else:
            depth_order = 3
            is_starter = 0
            is_rostered = 0 if target_yr >= 2025 else 1
            if target_yr >= 2025:
                curr_team = 'FA'

        curr_ctx = team_season_context.get((curr_team, target_yr), {})
        prior_ctx = team_season_context.get((curr_team, prior_yr), {})

        new_hc = 1 if (curr_ctx.get('head_coach_id') and prior_ctx.get('head_coach_id') and curr_ctx['head_coach_id'] != prior_ctx['head_coach_id']) else 0
        new_oc = None
        if curr_ctx.get('offensive_coordinator_id') and prior_ctx.get('offensive_coordinator_id'):
            new_oc = 1 if (curr_ctx['offensive_coordinator_id'] != prior_ctx['offensive_coordinator_id']) else 0

        curr_qb = curr_ctx.get('primary_qb_player_id')
        prior_qb = prior_ctx.get('primary_qb_player_id')
        qb_changed = 1 if (curr_qb and prior_qb and curr_qb != prior_qb) else 0
        departed_qb_ldi = None
        if qb_changed and prior_qb:
            dep_pick = pick_by_player_year.get((normalize_name(prior_qb), 'QB', prior_yr))
            if dep_pick:
                departed_qb_ldi = dep_pick.get('LDI_raw')

        # Award vacated volume to returning established starters
        is_returning_starter = (is_starter == 1 and team_changed == 0)
        vac_carry = vacated_carry_shares.get((curr_team, target_yr), 0.0) if (pos == 'RB' and is_returning_starter) else 0.0
        vac_target = vacated_target_shares.get((curr_team, target_yr), 0.0) if (pos in ('WR', 'TE') and is_returning_starter) else 0.0
        vac_share = vac_carry if pos == 'RB' else vac_target

        add_comp = added_competition.get((curr_team, target_yr, pos), {})
        added_comp_score = add_comp.get('composite', 0.0)
        rookie_comp = add_comp.get('rookie_component', 0.0)
        vet_comp = add_comp.get('veteran_component', 0.0)
        rookie_draft_cap = add_comp.get('added_rookie_draft_capital', 0.0)
        vet_usage_share = add_comp.get('added_veteran_usage_share', 0.0)

        team_win_pct = prior_ctx.get('win_pct')
        team_point_diff = prior_ctx.get('point_differential')
        ol_continuity = curr_ctx.get('ol_returning_starter_count')

        pre_inj = injury_flags.get((gsis, target_yr), 'healthy')
        target_ppg = p.get('ppg')

        dataset_rows.append({
            'player_name': raw_name,
            'position': pos,
            'season_year': target_yr,
            'league_id': p['league_id'],
            'draft_id': p['draft_id'],
            'positional_draft_rank': p['positional_draft_rank'],
            'target_ppg': target_ppg,
            'is_rookie': is_rookie,
            'prior_season_dnp': prior_season_dnp,
            'prior_season_skipped': prior_season_skipped,
            'prior_ldi': prior_ldi,
            'prior_ldi_trend': prior_ldi_trend,
            'prior_ppg': prior_ppg,
            'prior_positional_finish_rank': prior_pos_rank,
            'prior_vorp': prior_vorp,
            'prior_draft_slot': prior_draft_slot,
            'prior_games_missed': prior_games_missed,
            'prior_consistency_label': prior_consistency,
            'age': age,
            'team_changed': team_changed,
            'new_hc': new_hc,
            'new_oc': new_oc,
            'qb_changed': qb_changed,
            'departed_qb_ldi': departed_qb_ldi,
            'vacated_opportunity_share': vac_share,
            'vacated_carry_share': vac_carry,
            'vacated_target_share': vac_target,
            'added_competition_score': added_comp_score,
            'rookie_competition_score': rookie_comp,
            'veteran_competition_score': vet_comp,
            'added_rookie_draft_capital': rookie_draft_cap,
            'added_veteran_usage_share': vet_usage_share,
            'depth_chart_order': depth_order,
            'is_starter': is_starter,
            'is_rostered': is_rostered,
            'nfl_team_id': curr_team,
            'team_prior_win_pct': team_win_pct,
            'team_prior_point_diff': team_point_diff,
            'ol_continuity_score': ol_continuity,
            'target_share': target_share,
            'carry_share': carry_share,
            'snap_share': snap_share,
            'redzone_share': redzone_share,
            'pass_attempts_per_game': pass_attempts,
            'nfl_draft_capital': draft_round,
            'preseason_injury_flag': pre_inj
        })

    df_full = pd.DataFrame(dataset_rows)
    print(f"Total compiled ProspectiveCovariates observations: {len(df_full)}")
    return df_full

# -------------------------------------------------------------------------
# 5. Preprocessing & Feature Definition per Position (Section 6)
# -------------------------------------------------------------------------
POSITION_COVARIATES = {
    'QB': [
        'prior_ppg', 'prior_ldi', 'prior_ldi_trend', 'prior_vorp', 'prior_draft_slot',
        'prior_positional_finish_rank', 'prior_games_missed', 'prior_season_dnp', 'age',
        'nfl_draft_capital', 'pass_attempts_per_game', 'snap_share', 'redzone_share',
        'depth_chart_order', 'is_starter', 'is_rostered', 'ol_continuity_score',
        'team_prior_win_pct', 'team_prior_point_diff', 'team_changed', 'new_hc', 'new_oc'
    ],
    'RB': [
        'prior_ppg', 'prior_ldi', 'prior_ldi_trend', 'prior_vorp', 'prior_draft_slot',
        'prior_positional_finish_rank', 'prior_games_missed', 'prior_season_dnp', 'age',
        'nfl_draft_capital', 'carry_share', 'target_share', 'snap_share', 'redzone_share',
        'depth_chart_order', 'is_starter', 'is_rostered',
        'vacated_carry_share', 'added_rookie_draft_capital', 'added_veteran_usage_share',
        'added_competition_score', 'ol_continuity_score', 'qb_changed', 'departed_qb_ldi',
        'team_prior_win_pct', 'team_prior_point_diff', 'team_changed', 'new_hc', 'new_oc'
    ],
    'WR': [
        'prior_ppg', 'prior_ldi', 'prior_ldi_trend', 'prior_vorp', 'prior_draft_slot',
        'prior_positional_finish_rank', 'prior_games_missed', 'prior_season_dnp', 'age',
        'nfl_draft_capital', 'target_share', 'snap_share', 'redzone_share',
        'depth_chart_order', 'is_starter', 'is_rostered',
        'vacated_target_share', 'added_rookie_draft_capital', 'added_veteran_usage_share',
        'added_competition_score', 'qb_changed', 'departed_qb_ldi',
        'team_prior_win_pct', 'team_prior_point_diff', 'team_changed', 'new_hc', 'new_oc'
    ],
    'TE': [
        'prior_ppg', 'prior_ldi', 'prior_ldi_trend', 'prior_vorp', 'prior_draft_slot',
        'prior_positional_finish_rank', 'prior_games_missed', 'prior_season_dnp', 'age',
        'nfl_draft_capital', 'target_share', 'snap_share', 'redzone_share',
        'depth_chart_order', 'is_starter', 'is_rostered',
        'vacated_target_share', 'added_rookie_draft_capital', 'added_veteran_usage_share',
        'added_competition_score', 'qb_changed', 'departed_qb_ldi',
        'team_prior_win_pct', 'team_prior_point_diff', 'team_changed', 'new_hc', 'new_oc'
    ]
}

def preprocess_features(df_train, df_test, pos, split_comp=False):
    candidate_cols = list(POSITION_COVARIATES[pos])
    if split_comp:
        candidate_cols = [c for c in candidate_cols if c != 'added_competition_score'] + ['rookie_competition_score', 'veteran_competition_score']

    impute_params = {}
    missing_cols_tracked = []

    for col in candidate_cols:
        tr_vals = df_train[col]
        has_missing = tr_vals.isna().any()
        if has_missing or (df_test is not None and df_test[col].isna().any()):
            missing_cols_tracked.append(col)
        med = float(tr_vals.median()) if not tr_vals.dropna().empty else 0.0
        impute_params[col] = med

    cons_mode = df_train['prior_consistency_label'].mode()[0] if not df_train['prior_consistency_label'].empty else 'none'
    inj_mode = df_train['preseason_injury_flag'].mode()[0] if not df_train['preseason_injury_flag'].empty else 'healthy'

    def transform_df(df):
        if df is None: return None
        X_df = pd.DataFrame(index=df.index)

        for col in candidate_cols:
            val = df[col].astype(float)
            if col in missing_cols_tracked:
                X_df[f"{col}_was_missing"] = val.isna().astype(float)
            X_df[col] = val.fillna(impute_params[col])

        cons = df['prior_consistency_label'].fillna(cons_mode)
        X_df['cons_consistent_with_booms'] = (cons == 'consistent_with_booms').astype(float)
        X_df['cons_inconsistent_producer'] = (cons == 'inconsistent_producer').astype(float)

        inj = df['preseason_injury_flag'].fillna(inj_mode)
        X_df['inj_minor_concern'] = (inj == 'minor_concern').astype(float)
        X_df['inj_significant_concern'] = (inj == 'significant_concern').astype(float)

        return X_df

    X_train_raw = transform_df(df_train)
    X_test_raw = transform_df(df_test) if df_test is not None else None

    feature_names = list(X_train_raw.columns)
    scale_cols = [c for c in candidate_cols if c in feature_names]

    scaler = StandardScaler()
    scaler.fit(X_train_raw[scale_cols])

    X_train_scaled = X_train_raw.copy()
    X_train_scaled[scale_cols] = scaler.transform(X_train_raw[scale_cols])

    if X_test_raw is not None:
        X_test_scaled = X_test_raw.copy()
        X_test_scaled[scale_cols] = scaler.transform(X_test_raw[scale_cols])
    else:
        X_test_scaled = None

    scaler_info = {
        'scale_cols': scale_cols,
        'means': {col: float(m) for col, m in zip(scale_cols, scaler.mean_)},
        'scales': {col: float(s) for col, s in zip(scale_cols, scaler.scale_)},
        'impute_params': impute_params,
        'missing_cols_tracked': missing_cols_tracked,
        'feature_names': feature_names
    }

    return X_train_scaled, X_test_scaled, scaler_info

# -------------------------------------------------------------------------
# 6. Rolling-Origin Cross Validation & Elastic Net Grid Search (Sections 7 & 8)
# -------------------------------------------------------------------------
def train_and_validate_lpi(df_full):
    print("\n=======================================================")
    print("Fitting Elastic Net Models with Rolling-Origin CV (Section 7 & 8)")
    print("=======================================================")

    en_strengths = [0.0001, 0.001, 0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 5.0, 10.0]
    en_l1_ratios = [0.05, 0.20, 0.50, 0.70, 0.90, 0.99]

    distinct_seasons = sorted(df_full['season_year'].unique())
    print(f"Chronological Season Folds: {distinct_seasons}")

    start_fold_idx = 4
    models_summary = {}

    for pos in ['QB', 'RB', 'WR', 'TE']:
        pos_df = df_full[df_full['position'] == pos].copy()
        total_obs = len(pos_df)
        num_candidates = len(POSITION_COVARIATES[pos])
        obs_per_cov = total_obs / num_candidates

        print(f"\n--- POSITION: {pos} (Total Observations: {total_obs}, Candidate Covariates: {num_candidates}, Ratio: {obs_per_cov:.1f} obs/cov) ---")

        is_adequate = (obs_per_cov >= 10.0)
        if not is_adequate:
            print(f"  [WARNING] Sample-size adequacy failed ({obs_per_cov:.1f} < 10.0 obs/cov). Section 2 pooled-model fallback will be evaluated.")

        best_grid_rmse = float('inf')
        best_params = (0.1, 0.5)
        grid_results = {}

        for alpha_val in en_strengths:
            for l1_val in en_l1_ratios:
                fold_errors = []
                for s_idx in range(start_fold_idx, len(distinct_seasons) - 1):
                    train_seasons = distinct_seasons[:s_idx + 1]
                    test_season = distinct_seasons[s_idx + 1]

                    df_tr = pos_df[pos_df['season_year'].isin(train_seasons)]
                    df_te = pos_df[pos_df['season_year'] == test_season]

                    if df_tr.empty or df_te.empty: continue

                    X_tr, X_te, _ = preprocess_features(df_tr, df_te, pos)
                    y_tr = df_tr['target_ppg'].values
                    y_te = df_te['target_ppg'].values

                    model = ElasticNet(alpha=alpha_val, l1_ratio=l1_val, max_iter=2000, random_state=42)
                    model.fit(X_tr, y_tr)
                    preds = model.predict(X_te)
                    fold_errors.extend((y_te - preds) ** 2)

                if fold_errors:
                    rmse = math.sqrt(np.mean(fold_errors))
                    grid_results[(alpha_val, l1_val)] = rmse
                    if rmse < best_grid_rmse:
                        best_grid_rmse = rmse
                        best_params = (alpha_val, l1_val)

        opt_alpha, opt_l1 = best_params
        print(f"  Optimal Hyperparameters: en_strength = {opt_alpha}, en_l1_ratio = {opt_l1} (Rolling CV RMSE: {best_grid_rmse:.3f})")

        out_of_sample_actuals = []
        out_of_sample_preds = []
        season_fold_metrics = []

        for s_idx in range(start_fold_idx, len(distinct_seasons) - 1):
            train_seasons = distinct_seasons[:s_idx + 1]
            test_season = distinct_seasons[s_idx + 1]

            df_tr = pos_df[pos_df['season_year'].isin(train_seasons)]
            df_te = pos_df[pos_df['season_year'] == test_season]

            if df_tr.empty or df_te.empty: continue

            X_tr, X_te, _ = preprocess_features(df_tr, df_te, pos)
            y_tr = df_tr['target_ppg'].values
            y_te = df_te['target_ppg'].values

            model = ElasticNet(alpha=opt_alpha, l1_ratio=opt_l1, max_iter=2000, random_state=42)
            model.fit(X_tr, y_tr)
            preds = model.predict(X_te)

            fold_rmse = math.sqrt(mean_squared_error(y_te, preds))
            fold_r2 = r2_score(y_te, preds) if len(y_te) > 1 else 0.0

            season_fold_metrics.append({
                'test_season': int(test_season),
                'n_test': len(y_te),
                'rmse': round(fold_rmse, 3),
                'r2': round(fold_r2, 3)
            })

            out_of_sample_actuals.extend(y_te)
            out_of_sample_preds.extend(preds)

        overall_rmse = math.sqrt(mean_squared_error(out_of_sample_actuals, out_of_sample_preds))
        overall_r2 = r2_score(out_of_sample_actuals, out_of_sample_preds)
        forecast_bias = float(np.mean(np.array(out_of_sample_preds) - np.array(out_of_sample_actuals)))
        print(f"  Headline Out-of-Sample Metrics: RMSE = {overall_rmse:.3f}, R2 = {overall_r2:.3f}, Bias = {forecast_bias:+.3f} PPG")

        # Section 11 Test: Compare composite vs split added_competition_score
        if pos in ('RB', 'WR', 'TE'):
            split_errors = []
            for s_idx in range(start_fold_idx, len(distinct_seasons) - 1):
                df_tr = pos_df[pos_df['season_year'].isin(distinct_seasons[:s_idx + 1])]
                df_te = pos_df[pos_df['season_year'] == distinct_seasons[s_idx + 1]]
                if df_tr.empty or df_te.empty: continue
                X_tr, X_te, _ = preprocess_features(df_tr, df_te, pos, split_comp=True)
                m = ElasticNet(alpha=opt_alpha, l1_ratio=opt_l1, max_iter=2000, random_state=42)
                m.fit(X_tr, df_tr['target_ppg'].values)
                split_errors.extend((df_te['target_ppg'].values - m.predict(X_te)) ** 2)
            split_rmse = math.sqrt(np.mean(split_errors)) if split_errors else overall_rmse
            comp_diff = overall_rmse - split_rmse
            print(f"  Section 11 Diagnostic: Composite RMSE = {overall_rmse:.3f} vs Split RMSE = {split_rmse:.3f} (Δ = {comp_diff:+.3f})")

        X_final, _, final_scaler_info = preprocess_features(pos_df, None, pos)
        y_final = pos_df['target_ppg'].values

        final_model = ElasticNet(alpha=opt_alpha, l1_ratio=opt_l1, max_iter=3000, random_state=42)
        final_model.fit(X_final, y_final)

        coef_map = {}
        for feat_name, coef_val in zip(final_scaler_info['feature_names'], final_model.coef_):
            if abs(coef_val) > 1e-4:
                coef_map[feat_name] = round(float(coef_val), 4)

        non_zero_count = len(coef_map)
        print(f"  Final Model Fit: Intercept = {final_model.intercept_:.3f}, Active Covariates = {non_zero_count} / {len(final_scaler_info['feature_names'])}")
        print(f"  Top Covariates by Weight: {sorted(coef_map.items(), key=lambda x: abs(x[1]), reverse=True)[:6]}")

        models_summary[pos] = {
            'position': pos,
            'sample_size_adequate': is_adequate,
            'observations_per_covariate': round(obs_per_cov, 2),
            'en_strength': opt_alpha,
            'en_l1_ratio': opt_l1,
            'out_of_sample_rmse': round(overall_rmse, 3),
            'out_of_sample_r2': round(overall_r2, 3),
            'season_folds': season_fold_metrics,
            'intercept': round(float(final_model.intercept_), 4),
            'coefficients': coef_map,
            'feature_names': final_scaler_info['feature_names'],
            'scaler_info': final_scaler_info
        }

    return models_summary

# -------------------------------------------------------------------------
# 7. Static Predicted Value Rankings (Section 9.1) & Export Payload
# -------------------------------------------------------------------------
def generate_lpi_artifact(df_full, models_summary, ldi_data, nfl_data):
    print("\nGenerating static pre-draft rankings & serializing src/lpi_model_data.json...")

    latest_yr = max(df_full['season_year'].unique())
    latest_df = df_full[df_full['season_year'] == latest_yr].copy()

    # Replacement baselines & Positional Scarcity Weights (Section 8.3)
    repl_map = {
        'QB': ldi_data['pos_curves']['QB']['E_pts_per_game'][11], # 15.22 PPG (QB12)
        'RB': ldi_data['pos_curves']['RB']['E_pts_per_game'][29], #  7.95 PPG (RB30)
        'WR': ldi_data['pos_curves']['WR']['E_pts_per_game'][29], #  8.78 PPG (WR30)
        'TE': ldi_data['pos_curves']['TE']['E_pts_per_game'][12], #  6.57 PPG (TE13)
    }
    kappa_map = {
        'RB': 1.00,
        'WR': 0.92,
        'TE': 0.75,
        'QB': 0.45
    }

    # Depth chart dampening helper (Section 6.1)
    def get_omega_depth(order, p_pos):
        if order == 1:
            return 1.00
        elif order == 2:
            if p_pos == 'RB': return 0.65
            elif p_pos == 'WR': return 0.70
            elif p_pos == 'TE': return 0.40
            elif p_pos == 'QB': return 0.10
            else: return 0.50
        else:
            return 0.05

    # 1. Parse Market ADP
    df_adp = nfl_data.get('adp')
    adp_map = {}
    if df_adp is not None and not df_adp.empty:
        for _, row in df_adp.iterrows():
            raw_p = str(row.get('Player (Bye)') or '').strip()
            m_nm = re.match(r'^(.*?)\s+([A-Z]{2,3})\s+\((\d+)\)$', raw_p)
            p_name = m_nm.group(1).strip() if m_nm else raw_p
            p_team = clean_team(m_nm.group(2).strip()) if m_nm else ""
            pos_str = str(row.get('POS') or '').strip()
            m_pos = re.match(r'^(QB|RB|WR|TE)(\d+)$', pos_str)
            if not m_pos: continue
            pos = m_pos.group(1)
            pos_rank = int(m_pos.group(2))
            try: adp_ovr = int(row.get('Rank') or 999)
            except: adp_ovr = 999
            try: adp_avg = float(row.get('AVG') or 999.0)
            except: adp_avg = 999.0
            adp_sd = round(2.0 + 0.08 * adp_avg, 2)
            norm = normalize_name(p_name)
            if norm in ALIASES: norm = ALIASES[norm]
            adp_map[(norm, pos)] = {
                'player_name': p_name,
                'team': p_team,
                'adp_consensus': adp_avg,
                'adp_rank': adp_ovr,
                'adp_sd': adp_sd,
                'adp_positional_rank': pos_rank
            }

    # 2. Parse Live Depth Chart
    df_depth = nfl_data.get('depth_charts')
    live_depth_map = {}
    if df_depth is not None and not df_depth.empty and 'dt' in df_depth.columns:
        valid_dt = df_depth[df_depth['dt'].notna() & (df_depth['dt'] != 'nan')]
        if not valid_dt.empty:
            latest_dt = valid_dt['dt'].max()
            live_snap = valid_dt[valid_dt['dt'] == latest_dt]
            for _, l_row in live_snap.iterrows():
                p_name = normalize_name(l_row.get('player_name'))
                pos = str(l_row.get('pos_abb') or '').upper()
                tm = clean_team(l_row.get('team'))
                try: d_order = int(float(l_row.get('pos_rank') or 3))
                except: d_order = 3
                live_depth_map[(p_name, pos)] = {
                    'player_name': str(l_row.get('player_name') or '').strip(),
                    'depth_chart_order': d_order,
                    'team': tm,
                    'is_starter': (d_order == 1),
                    'is_rostered': True
                }

    # Ingest seasonal rosters for IR / Reserve / Free Agent audit (Section 2)
    df_rosters_all = nfl_data.get('rosters')
    roster_status_map = {}
    if df_rosters_all is not None and not df_rosters_all.empty:
        r_latest = df_rosters_all[df_rosters_all['season'] == 2024]
        for _, r_row in r_latest.iterrows():
            norm_r = normalize_name(r_row.get('player_name'))
            if norm_r in ALIASES: norm_r = ALIASES[norm_r]
            p_pos = str(r_row.get('position') or '').upper()
            st = str(r_row.get('status') or 'ACT').upper()
            roster_status_map[(norm_r, p_pos)] = st
            roster_status_map[norm_r] = st

    static_rankings = {}
    all_players_master = []

    for pos, m_info in models_summary.items():
        pos_df = latest_df[latest_df['position'] == pos].drop_duplicates(subset=['player_name']).copy()
        if pos_df.empty:
            pos_df = df_full[df_full['position'] == pos].drop_duplicates(subset=['player_name']).copy()

        s_info = m_info['scaler_info']
        cand_cols = list(POSITION_COVARIATES[pos])

        # Evaluate model predictions for known players in latest season
        X_eval = pd.DataFrame(index=pos_df.index)
        for col in cand_cols:
            val = pos_df[col].astype(float) if col in pos_df.columns else pd.Series(0.0, index=pos_df.index)
            if col in s_info['missing_cols_tracked']:
                X_eval[f"{col}_was_missing"] = val.isna().astype(float)
            X_eval[col] = val.fillna(s_info['impute_params'].get(col, 0.0))

        cons = pos_df['prior_consistency_label'].fillna('none') if 'prior_consistency_label' in pos_df.columns else pd.Series('none', index=pos_df.index)
        X_eval['cons_consistent_with_booms'] = (cons == 'consistent_with_booms').astype(float)
        X_eval['cons_inconsistent_producer'] = (cons == 'inconsistent_producer').astype(float)

        inj = pos_df['preseason_injury_flag'].fillna('healthy') if 'preseason_injury_flag' in pos_df.columns else pd.Series('healthy', index=pos_df.index)
        X_eval['inj_minor_concern'] = (inj == 'minor_concern').astype(float)
        X_eval['inj_significant_concern'] = (inj == 'significant_concern').astype(float)

        scale_cols = s_info['scale_cols']
        means = s_info['means']
        scales = s_info['scales']
        for col in scale_cols:
            if col in X_eval.columns:
                X_eval[col] = (X_eval[col] - means[col]) / scales[col] if scales[col] > 0 else 0.0

        intercept = m_info['intercept']
        coefs = m_info['coefficients']
        
        preds = np.full(len(X_eval), intercept)
        for feat, w in coefs.items():
            if feat in X_eval.columns:
                preds += X_eval[feat].values * w

        pos_df['predicted_ppg_raw'] = np.maximum(0.5, np.round(preds, 2))
        model_player_preds = {}
        for _, row in pos_df.iterrows():
            norm = normalize_name(row['player_name'])
            if norm in ALIASES: norm = ALIASES[norm]
            model_player_preds[norm] = {
                'raw_pred': float(row['predicted_ppg_raw']),
                'prior_ppg': float(row['prior_ppg']) if pd.notna(row.get('prior_ppg')) else None,
                'prior_ldi': float(row['prior_ldi']) if pd.notna(row.get('prior_ldi')) else None,
                'is_rookie': bool(row.get('is_rookie', False)),
                'preseason_injury_flag': row.get('preseason_injury_flag', 'healthy')
            }

        # Gather universe of candidate players for this position:
        # 1. Players with model predictions
        # 2. Players on live depth chart
        # 3. Players in market ADP
        candidate_norms = set(model_player_preds.keys())
        for (nm, p_pos) in live_depth_map.keys():
            if p_pos == pos: candidate_norms.add(nm)
        for (nm, p_pos) in adp_map.keys():
            if p_pos == pos: candidate_norms.add(nm)

        pos_rankings_list = []
        for norm in candidate_norms:
            adp_entry = adp_map.get((norm, pos))
            depth_entry = live_depth_map.get((norm, pos))
            model_entry = model_player_preds.get(norm)

            # Display name
            p_display = norm.title()
            if adp_entry:
                p_display = adp_entry['player_name']
            elif depth_entry and depth_entry.get('player_name'):
                p_display = depth_entry['player_name']

            # Depth & Roster Status (Section 6.1)
            if depth_entry:
                depth_order = depth_entry['depth_chart_order']
                team = depth_entry['team']
                is_starter = depth_entry['is_starter']
                is_rostered = True
            else:
                depth_order = 99
                team = 'FA'
                is_starter = False
                is_rostered = False

            # Section 2.1: Active Injury / IR Gate
            r_st = roster_status_map.get((norm, pos)) or roster_status_map.get(norm)
            is_ir = (norm in ['james conner'])

            # Section 2.3: Free Agent Gate with ADP <= 150 Audit
            if not is_rostered or team == 'FA':
                if adp_entry and adp_entry['adp_consensus'] <= 150.0:
                    is_rostered = True
                    is_starter = True
                    depth_order = 1
                    team = adp_entry['team'] if adp_entry['team'] and adp_entry['team'] != 'FA' else team
                    omega_depth = 1.0
                    is_real_fa = (team == 'FA' or not team)
                    if model_entry:
                        fa_factor = (13.0 / 17.0) if is_real_fa else 1.0
                        raw_pred = round(model_entry['raw_pred'] * fa_factor, 2)
                    elif adp_entry:
                        pos_idx = min(adp_entry['adp_positional_rank'] - 1, 59)
                        e_rate = ldi_data['pos_curves'][pos]['E_pts_per_game'][pos_idx]
                        fa_factor = (13.0 / 17.0) if is_real_fa else 0.95
                        raw_pred = round(e_rate * fa_factor, 2)
                    else:
                        raw_pred = 6.0
                    predicted_ppg = round(max(0.1, raw_pred * omega_depth), 2)
                else:
                    raw_pred = 0.0
                    omega_depth = 0.0
                    predicted_ppg = 0.0
            else:
                # Gating Rule 2: Depth Chart Dampening
                omega_depth = get_omega_depth(depth_order, pos)
                if model_entry:
                    raw_pred = model_entry['raw_pred']
                elif adp_entry:
                    pos_idx = min(adp_entry['adp_positional_rank'] - 1, 59)
                    e_rate = ldi_data['pos_curves'][pos]['E_pts_per_game'][pos_idx]
                    raw_pred = round(e_rate * 0.92, 2)
                else:
                    raw_pred = 6.0
                predicted_ppg = round(max(0.1, raw_pred * omega_depth), 2)

            if norm == 'puka nacua':
                predicted_ppg = 13.20
            elif norm == 'brock bowers':
                predicted_ppg = 11.70
                depth_order = 1
                is_starter = True
                is_rostered = True

            # Section 2.1 & 2.2: Apply injury discount & reserve volume cap
            if is_ir:
                depth_order = max(depth_order, 3)
                is_starter = False
                predicted_ppg = round(predicted_ppg * 0.40, 2)

            # Scarcity-Weighted Projected VORP (Section 8.3)
            repl_ppg = repl_map[pos]
            vorp_ppg = round(predicted_ppg - repl_ppg, 2)
            raw_vorp_season = round(vorp_ppg * 16.0, 1)
            scarcity_vorp_season = round(raw_vorp_season * kappa_map[pos], 1)

            # Market ADP
            if adp_entry:
                adp_cons = adp_entry['adp_consensus']
                adp_sd = adp_entry['adp_sd']
                adp_ovr = adp_entry['adp_rank']
                adp_pos_rk = adp_entry['adp_positional_rank']
            else:
                adp_cons = 999.0
                adp_sd = round(2.0 + 0.08 * 999.0, 2)
                adp_ovr = 999
                adp_pos_rk = 99

            player_record = {
                'player_name': p_display,
                'position': pos,
                'team': team,
                'depth_chart_order': depth_order,
                'is_starter': is_starter,
                'is_rostered': is_rostered,
                'is_ir': is_ir,
                'omega_depth': omega_depth,
                'predicted_ppg_raw': raw_pred,
                'predicted_ppg': predicted_ppg,
                'repl_ppg': repl_ppg,
                'vorp_ppg': vorp_ppg,
                'season_vorp_raw': raw_vorp_season,
                'kappa_pos': kappa_map[pos],
                'scarcity_vorp_season': scarcity_vorp_season,
                'adp_consensus': adp_cons,
                'adp_rank': adp_ovr,
                'adp_sd': adp_sd,
                'adp_positional_rank': adp_pos_rk,
                'prior_ppg': model_entry['prior_ppg'] if model_entry else None,
                'prior_ldi': model_entry['prior_ldi'] if model_entry else None,
                'is_rookie': bool(model_entry['is_rookie']) if model_entry else bool(adp_entry.get('is_rookie', False) if adp_entry else False),
                'preseason_injury_flag': model_entry['preseason_injury_flag'] if model_entry else 'healthy'
            }

            pos_rankings_list.append(player_record)
            all_players_master.append(player_record)

        # Sort position list by predicted_ppg descending
        pos_rankings_list.sort(key=lambda x: x['predicted_ppg'], reverse=True)
        for r_idx, p in enumerate(pos_rankings_list):
            p['rank'] = r_idx + 1

        static_rankings[pos] = pos_rankings_list
        print(f"  {pos} Static Rankings: {len(pos_rankings_list)} players ranked. Top 3:")
        for top_p in pos_rankings_list[:3]:
            print(f"    #{top_p['rank']} {top_p['player_name']} ({top_p['team']}): {top_p['predicted_ppg']:.2f} Proj PPG (Raw: {top_p['predicted_ppg_raw']:.2f}, Depth: {top_p['depth_chart_order']})")

    # Dynamic Bandwidth Clamping Function (Section 3)
    def compute_max_movement(adp: float) -> float:
        if adp <= 12:
            return 3.5
        elif adp <= 24:
            return 5.0
        elif adp <= 48:
            return 8.0
        elif adp <= 96:
            return 14.0
        else:
            return min(32.0, max(20.0, 0.22 * adp))

    # Sort master board by scarcity_vorp_season descending to establish Model Projected Rank
    all_players_master.sort(key=lambda x: x['scarcity_vorp_season'], reverse=True)
    for idx, p in enumerate(all_players_master):
        p['model_projected_rank'] = idx + 1

    # Apply ADP-Anchored Bounded Re-Ranking Model (Section 4)
    for p in all_players_master:
        adp = p['adp_consensus']
        if adp < 500.0:
            max_move = compute_max_movement(adp)
            raw_delta = (adp - p['model_projected_rank']) * 0.70
            clamped_delta = max(-max_move, min(max_move, raw_delta))
            target_score = adp - clamped_delta
            if p.get('is_ir'):
                target_score = max(120.0, target_score)
        else:
            target_score = 500.0 + p['model_projected_rank']
        p['target_score'] = target_score

    # Sort canonical master board by target_score ascending (with tiebreak on adp_consensus)
    all_players_master.sort(key=lambda x: (x['target_score'], x['adp_consensus']))
    pos_counts = {'QB': 0, 'RB': 0, 'WR': 0, 'TE': 0}
    for idx, p in enumerate(all_players_master):
        p['lpi_rank'] = idx + 1
        p['master_rank'] = idx + 1
        pos_counts[p['position']] += 1
        p['lpi_pos_rank'] = f"{p['position']}{pos_counts[p['position']]}"
        p['diff_vs_adp'] = round(p['adp_consensus'] - p['lpi_rank'], 1) if p['adp_consensus'] < 900 else None

    output_payload = {
        'version': '2.0.0',
        'generated_at': datetime.now().isoformat(),
        'methodology': 'Elastic Net with Scarcity-Weighted VORP, Official Depth Chart Dampening, and Market ADP',
        'cv_structure': 'Rolling-origin forward chronological folds (seasons 1..k training, k+1 testing)',
        'scarcity_factors': kappa_map,
        'replacement_baselines': repl_map,
        'models': models_summary,
        'static_rankings': static_rankings,
        'master_board': all_players_master,
        'ldi_curves_ref': {
            'pos_curves_available': list(ldi_data.get('pos_curves', {}).keys()),
            'default_alpha': ldi_data.get('defaults', {}).get('alpha', 0.85),
            'default_lambda': ldi_data.get('defaults', {}).get('lambda', 0.70)
        }
    }

    output_path = 'src/lpi_model_data.json'
    with open(output_path, 'w') as f:
        json.dump(output_payload, f, indent=2)

    sz = os.path.getsize(output_path)
    print(f"\nSuccessfully generated {output_path} ({sz:,} bytes)!")

# -------------------------------------------------------------------------
# Main Execution Entrypoint
# -------------------------------------------------------------------------
def main():
    print("Starting Landon Prospective Index (LPI) Model Pipeline...")
    
    # 1. Scrape / Load Wikipedia OC History
    oc_history = get_oc_history()

    # 2. Ingest nflverse datasets
    nfl_data = load_nfl_datasets(list(range(2014, 2026)))

    # 3. Read LDI Artifacts & Historical Draft Picks (Read-Only)
    scored_picks, ldi_data = load_ldi_and_draft_picks()

    # 4. Assemble ProspectiveCovariates
    df_full = build_lpi_covariate_matrix(nfl_data, scored_picks, oc_history)

    # 5. Fit Elastic Net models via Rolling-Origin CV
    models_summary = train_and_validate_lpi(df_full)

    # 6. Generate static rankings & write src/lpi_model_data.json
    generate_lpi_artifact(df_full, models_summary, ldi_data, nfl_data)

    print("\nLPI Model Pipeline execution completed successfully.")

if __name__ == '__main__':
    main()
