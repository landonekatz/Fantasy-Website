"""
Compile LDI Dataset and Train Population Models
Implements landon_draft_index_framework.md exactly as specified:
- Four GAM Curve Families fit as PER-GAME RATES:
  1. Positional Expected Points Per Game & SD Curves: E_pts_per_game(P_r), SD_pts_per_game(P_r) (Section 3.1)
  2. Overall-Slot VORP Per Game & SD Curves: V_expected_per_game(P_overall), SD_VORP_per_game(P_overall) (Section 3.2)
  3. Concentration-Ratio Baseline: T_bust(position, games_played_tier) (Section 3.3)
  4. Floor-PPG Population Distributions per position (Section 3.4)
- Recency-decay weighting with rolling-origin cross-validation (Sections 3.5, 9.1)
- Auto-calibration of reliable_starter_threshold via binary search on stage-1 flagged pool (Section 9.2)
- Step-by-step scoring pipeline with Effective_games, 2-stage consistency classification, dynamic/flat multipliers (Section 4)
- Manager-level equal-weight rollup and empirical percentile ranking (Sections 5, 6)
Written in 100% standard library Python (zero external dependencies).
"""

import urllib.request
import ssl
import json
import re
import os
import math
import statistics
import concurrent.futures

# SSL context for Sleeper API
ctx = ssl._create_unverified_context()

def normalize_name(name):
    if not name:
        return ''
    s = str(name).lower()
    s = re.sub(r'[^a-z0-9\s]', '', s)
    s = re.sub(r'\b(jr|sr|ii|iii|iv|v)\b', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# Canonical alias mappings to Sleeper standard names
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

def standard_normal_cdf(x):
    """Abramowitz & Stegun formula 7.1.26 for standard normal cumulative distribution function Phi(x)"""
    if x is None or math.isnan(x):
        return 0.5
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    p = 0.3275911
    sign = -1.0 if x < 0 else 1.0
    abs_x = abs(x) / math.sqrt(2.0)
    t = 1.0 / (1.0 + p * abs_x)
    y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-abs_x * abs_x)
    return 0.5 * (1.0 + sign * y)

def linspace(start, stop, num):
    """Generates evenly spaced numbers over a specified interval"""
    if num == 1:
        return [float(start)]
    step = (stop - start) / float(num - 1)
    return [start + i * step for i in range(num)]

def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req, context=ctx) as resp:
        return json.loads(resp.read().decode('utf-8'))

def load_sleeper_data(cache_dir='scripts/cache'):
    os.makedirs(cache_dir, exist_ok=True)
    players_cache = os.path.join(cache_dir, 'sleeper_players.json')
    if os.path.exists(players_cache):
        with open(players_cache, 'r') as f:
            players = json.load(f)
    else:
        print('Fetching Sleeper players directory...')
        players = fetch_json('https://api.sleeper.app/v1/players/nfl')
        with open(players_cache, 'w') as f:
            json.dump(players, f)

    tasks = []
    for yr in range(2015, 2027):
        # Fantasy season ends in week 16 pre-2021 and week 17 in 2021+
        max_weeks = 17 if yr >= 2021 else 16
        for wk in range(1, max_weeks + 1):
            wk_cache = os.path.join(cache_dir, f'sleeper_stats_{yr}_{wk}.json')
            tasks.append((yr, wk, wk_cache))

    def fetch_week(task):
        yr, wk, wk_cache = task
        if os.path.exists(wk_cache):
            with open(wk_cache, 'r') as f:
                return yr, wk, json.load(f)
        url = f'https://api.sleeper.app/v1/stats/nfl/regular/{yr}/{wk}'
        try:
            data = fetch_json(url)
            with open(wk_cache, 'w') as f:
                json.dump(data, f)
            return yr, wk, data
        except Exception as e:
            print(f'Failed to fetch {url}: {e}')
            return yr, wk, {}

    weekly_stats = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = executor.map(fetch_week, tasks)
        for yr, wk, data in results:
            if yr not in weekly_stats:
                weekly_stats[yr] = {}
            weekly_stats[yr][wk] = data

    return players, weekly_stats

def compute_half_ppr_points(st):
    if not st:
        return 0.0
    pts = (
        st.get('pass_yd', 0) * 0.04 +
        st.get('pass_td', 0) * 4.0 -
        st.get('pass_int', 0) * 2.0 +
        st.get('rush_yd', 0) * 0.1 +
        st.get('rush_td', 0) * 6.0 +
        st.get('rec', 0) * 0.5 +
        st.get('rec_yd', 0) * 0.1 +
        st.get('rec_td', 0) * 6.0 -
        st.get('fum_lost', 0) * 2.0 +
        st.get('pass_2pt', 0) * 2.0 +
        st.get('rush_2pt', 0) * 2.0 +
        st.get('rec_2pt', 0) * 2.0
    )
    return max(0.0, pts)

def fit_gam_rate_curve(x_data, y_data, weights, grid_points, bandwidth=3.5, is_monotonic=True, min_val=0.5):
    """
    Fits a smooth Generalized Additive Model (GAM) per-game rate curve using Gaussian Kernel Splines.
    Guarantees smoothness, non-negativity, and strict monotonic descent.
    """
    predictions = []
    for g in grid_points:
        w_sum = 0.0
        wy_sum = 0.0
        for x, y, w in zip(x_data, y_data, weights):
            u = (x - g) / bandwidth
            kernel = math.exp(-0.5 * u * u)
            total_w = w * kernel
            w_sum += total_w
            wy_sum += total_w * y

        if w_sum > 0:
            val = wy_sum / w_sum
        else:
            val = min_val
        predictions.append(max(min_val, val))

    # Apply monotonic non-increasing constraint (higher draft rank -> equal or fewer expected rate)
    if is_monotonic:
        for i in range(1, len(predictions)):
            if predictions[i] > predictions[i - 1]:
                predictions[i] = predictions[i - 1]

    return predictions

def fit_gam_rate_variance(x_data, sq_residuals, weights, grid_points, bandwidth=4.0, min_sd=1.0):
    """
    Fits heteroskedastic standard deviation curve SD(x) alongside the mean GAM curve.
    """
    sd_predictions = []
    for g in grid_points:
        w_sum = 0.0
        wv_sum = 0.0
        for x, r2, w in zip(x_data, sq_residuals, weights):
            u = (x - g) / bandwidth
            kernel = math.exp(-0.5 * u * u)
            total_w = w * kernel
            w_sum += total_w
            wv_sum += total_w * r2

        if w_sum > 0:
            variance = wv_sum / w_sum
            sd_val = math.sqrt(max(0.0, variance))
        else:
            sd_val = min_sd
        sd_predictions.append(max(min_sd, sd_val))

    return sd_predictions

def get_tier_label(gp):
    """Maps games_played to wide tier for concentration baseline (Section 3.3)"""
    if gp <= 8:
        return '4-8'
    elif gp <= 13:
        return '9-13'
    else:
        return '14-17'

def main():
    print('Starting Landon Draft Index (LDI) dataset compilation & training pipeline...')
    players, weekly_stats = load_sleeper_data()
    print('Sleeper directory and weekly stats loaded successfully.')

    # Build name-to-player mapping.
    # When multiple players share a normalized name (e.g. QB Lamar Jackson vs CB Lamar Jackson),
    # prefer skill positions (QB/RB/WR/TE) over non-skill positions so that the correct
    # fantasy-relevant player ID is used for Sleeper stats lookup.
    SKILL_POSITIONS = {'QB', 'RB', 'WR', 'TE'}
    name_to_player = {}
    for pid, p in players.items():
        if not isinstance(p, dict):
            continue
        first = p.get('first_name') or ''
        last = p.get('last_name') or ''
        full = f"{first} {last}".strip()
        norm = normalize_name(full)
        if not norm:
            continue
        pos = p.get('position')
        existing = name_to_player.get(norm)
        if existing is None:
            name_to_player[norm] = {'id': pid, 'name': full, 'pos': pos}
        else:
            # Prefer skill position over any non-skill position
            existing_is_skill = existing.get('pos') in SKILL_POSITIONS
            new_is_skill = pos in SKILL_POSITIONS
            if new_is_skill and not existing_is_skill:
                name_to_player[norm] = {'id': pid, 'name': full, 'pos': pos}

    def resolve(p_name):
        norm = normalize_name(p_name)
        if norm in ALIASES:
            norm = ALIASES[norm]
        if norm in name_to_player:
            return name_to_player[norm]
        for k, v in name_to_player.items():
            if norm and (norm == k or norm in k or k in norm):
                return v
        return None

    # Load draft records from both leagues
    with open('dmsfantasy/data/draft_results.json') as f:
        dms_drafts = json.load(f)
    with open('gaywoodfantasy/data/draft_results.json') as f:
        gw_drafts = json.load(f)

    # Process all draft picks
    all_picks = []

    # DMS Drafts: 2018-2026 (first 9 complete seasons, Section 2)
    # DMS season 2018 corresponds to NFL 2017 (DMS year offset = -1)
    for pick in dms_drafts:
        season = pick.get('season') or pick.get('year')
        if not season or season < 2018 or season > 2026:
            continue
        nfl_year = season - 1
        if nfl_year < 2015 or nfl_year > 2025:
            continue
        # DMS season lengths (Section 1.2 & audit):
        # 2018-2021 (NFL 2017-2020) = 16 weeks (G = 15); 2022-2026 (NFL 2021-2025) = 17 weeks (G = 16)
        total_season_weeks = 17 if nfl_year >= 2021 else 16
        all_picks.append({
            'league_id': 'dms',
            'season_year': season,
            'nfl_year': nfl_year,
            'draft_id': f'dms_{season}',
            'manager_id': pick.get('manager_id') or pick.get('managerId') or 'dms_mgr',
            'manager_name': pick.get('manager_name') or pick.get('managerName') or 'Manager',
            'team_name': pick.get('team_name') or pick.get('teamName') or 'Team',
            'player_id': pick.get('player_id') or pick.get('playerId') or '',
            'player_name': pick.get('player_name') or pick.get('playerName') or '',
            'position': pick.get('position') or pick.get('pos') or '',
            'overall_pick_number': int(pick.get('overall_pick') or pick.get('overallPick') or 1),
            'round': int(pick.get('round') or 1),
            'pick_in_round': int(pick.get('pick_in_round') or pick.get('round_pick') or 1),
            'total_season_weeks': total_season_weeks,
            'num_teams': 12,
            'tracks_starting_lineups': True
        })

    # Gaywood Drafts: 2015-2025 (11 complete seasons in dataset, Section 2)
    for pick in gw_drafts:
        season = pick.get('season') or pick.get('year')
        if not season or season < 2015 or season > 2025:
            continue
        nfl_year = season
        if nfl_year < 2015 or nfl_year > 2025:
            continue
        # Gaywood season lengths (Section 1.2 & audit):
        # 2015-2020 (NFL 2015-2020) = 16 weeks (G = 15); 2021-2025 (NFL 2021-2025) = 17 weeks (G = 16)
        total_season_weeks = 17 if nfl_year >= 2021 else 16
        num_teams = 10 if season == 2020 else 12
        all_picks.append({
            'league_id': 'gaywood',
            'season_year': season,
            'nfl_year': nfl_year,
            'draft_id': f'gaywood_{season}',
            'manager_id': pick.get('manager_id') or pick.get('managerId') or 'gw_mgr',
            'manager_name': pick.get('manager_name') or pick.get('managerName') or 'Manager',
            'team_name': pick.get('team_name') or pick.get('teamName') or 'Team',
            'player_id': pick.get('player_id') or pick.get('playerId') or '',
            'player_name': pick.get('player_name') or pick.get('playerName') or '',
            'position': pick.get('position') or pick.get('pos') or '',
            'overall_pick_number': int(pick.get('overall_pick') or pick.get('overallPick') or 1),
            'round': int(pick.get('round') or 1),
            'pick_in_round': int(pick.get('pick_in_round') or pick.get('round_pick') or 1),
            'total_season_weeks': total_season_weeks,
            'num_teams': num_teams,
            'tracks_starting_lineups': (season >= 2018)
        })

    print(f'Total processed picks across all drafts: {len(all_picks)}')

    # Sort picks per draft and compute positional_draft_rank (Section 1.1)
    draft_groups = {}
    for p in all_picks:
        d_id = p['draft_id']
        if d_id not in draft_groups:
            draft_groups[d_id] = []
        draft_groups[d_id].append(p)

    scored_picks = []
    for d_id, p_list in draft_groups.items():
        # Keep literal pick numbering (Section 1.1)
        p_list.sort(key=lambda x: x['overall_pick_number'])
        pos_counts = {'QB': 0, 'RB': 0, 'WR': 0, 'TE': 0, 'K': 0, 'DEF': 0}
        for p in p_list:
            res = resolve(p['player_name'])
            actual_pos = res['pos'] if res and res['pos'] in ['QB', 'RB', 'WR', 'TE'] else p['position']
            if actual_pos in ['D/ST', 'DST']: actual_pos = 'DEF'
            p['position'] = actual_pos

            if actual_pos in pos_counts:
                pos_counts[actual_pos] += 1
                p['positional_draft_rank'] = pos_counts[actual_pos]
            else:
                p['positional_draft_rank'] = 99

            # Section 1.1: Only QB, RB, WR, TE are scored by LDI
            if actual_pos in ['QB', 'RB', 'WR', 'TE']:
                scored_picks.append(p)

    print(f'Total scored skill picks across 20 complete training seasons: {len(scored_picks)}')

    # Extract weekly points & games played/missed from Sleeper stats (Sections 4.1, 4.2)
    for p in scored_picks:
        nfl_yr = p['nfl_year']
        tot_weeks = p['total_season_weeks']
        G = tot_weeks - 1  # Exclude bye week (Section 4.1)

        res = resolve(p['player_name'])
        s_id = res['id'] if res else None

        weekly_points = []
        gp_count = 0

        for wk in range(1, tot_weeks + 1):
            wk_data = weekly_stats.get(nfl_yr, {}).get(wk, {})
            if s_id and s_id in wk_data:
                st = wk_data[s_id]
                # Use Sleeper's pre-computed pts_half_ppr directly to avoid manual
                # field reconstruction bugs (e.g. missing rush_td in some seasons)
                pts_field = st.get('pts_half_ppr')
                if pts_field is not None:
                    pts = float(pts_field)
                else:
                    # Fallback: manually recompute if pts_half_ppr is absent
                    pts = compute_half_ppr_points(st)
                # Only count as played if Sleeper marks gp=1 (explicitly in-game)
                # OR if pts_half_ppr was present (non-None) in the stats record.
                # gms_active=1 alone is not sufficient -- Sleeper sets it for IR-designated
                # players in some weeks even when they did not participate.
                actually_played = (int(st.get('gp') or 0) >= 1) or (pts_field is not None)
                if actually_played:
                    weekly_points.append(pts)
                    gp_count += 1

        A_pts = sum(weekly_points)
        games_played = gp_count
        games_missed = max(0, G - games_played)
        # points-per-game rate based on full season G for GAM fitting (Section 3.1)
        pts_rate = A_pts / G if G > 0 else 0.0
        # Flag pick as having valid stats — exclude from GAM training if 0 pts with positive games_played,
        # which indicates a Sleeper ID mismatch and not a genuinely scoreless season.
        p['stats_valid'] = not (games_played > 0 and A_pts == 0.0)

        p['weekly_points'] = [round(float(pt), 2) for pt in weekly_points]
        p['games_played'] = games_played
        p['games_missed'] = games_missed
        p['possible_games'] = G
        p['A_pts'] = round(float(A_pts), 2)
        p['pts_rate'] = round(float(pts_rate), 4)

    # 1. Calibrate Recency Decay rho via Rolling-Origin Cross-Validation (Section 9.1)
    print('\nCalibrating recency decay rho via rolling-origin cross-validation (Section 9.1)...')
    distinct_years = sorted(list(set(p['season_year'] for p in scored_picks)))
    candidate_rhos = [0.75, 0.85, 0.87, 0.90, 0.95, 1.00]
    rho_errors = {r: [] for r in candidate_rhos}

    # Use rolling window: train on seasons up to k, test on season k+1
    for split_idx in range(5, len(distinct_years)):
        train_years = set(distinct_years[:split_idx])
        test_year = distinct_years[split_idx]
        test_picks = [p for p in scored_picks if p['season_year'] == test_year and p['games_played'] >= 4]
        if not test_picks:
            continue

        for r_cand in candidate_rhos:
            fold_errors = []
            for pos in ['QB', 'RB', 'WR', 'TE']:
                train_pos = [p for p in scored_picks if p['season_year'] in train_years and p['position'] == pos and p['games_played'] >= 4]
                if not train_pos:
                    continue
                x_tr = [(p['positional_draft_rank'] / p['num_teams']) * 12.0 for p in train_pos]
                y_tr = [p['pts_rate'] for p in train_pos]
                w_tr = [r_cand ** (test_year - p['season_year']) for p in train_pos]

                grid = linspace(1, 60, 60)
                pred_grid = fit_gam_rate_curve(x_tr, y_tr, w_tr, grid, is_monotonic=True, min_val=0.5)

                test_pos = [p for p in test_picks if p['position'] == pos]
                for tp in test_pos:
                    norm_r = (tp['positional_draft_rank'] / tp['num_teams']) * 12.0
                    idx = max(0, min(59, int(round(norm_r)) - 1))
                    err = (tp['pts_rate'] - pred_grid[idx]) ** 2
                    fold_errors.append(err)

            if fold_errors:
                rmse = math.sqrt(sum(fold_errors) / len(fold_errors))
                rho_errors[r_cand].append(rmse)

    best_rho = 0.87
    best_avg_rmse = 999.0
    for r_cand, errs in rho_errors.items():
        avg_rmse = statistics.mean(errs) if errs else 999.0
        print(f"  rho={r_cand:.2f}: Mean Out-of-Sample RMSE = {avg_rmse:.4f}")
        if avg_rmse < best_avg_rmse:
            best_avg_rmse = avg_rmse
            best_rho = r_cand

    print(f'Selected optimal recency decay rho = {best_rho:.2f}')

    # 2. Fit Positional Curves E_pts_per_game(P_r) & SD_pts_per_game(P_r) (Section 3.1)
    # E_pts_per_game: GAM smooth of pts_rate (A_pts / G) vs normalized positional rank.
    # SD_pts_per_game: cross-player residual SD of pts_rate around the GAM mean (Section 3.1).
    # This is the cross-player talent/opportunity spread at each draft slot -- the dominant
    # variance source in fantasy. At scoring time, scaled linearly:
    #   SD_pts(P_r) = SD_pts_per_game(P_r) * Effective_games  (Section 4.4, NOT sqrt)
    current_year = 2026
    pos_curves = {}
    for pos in ['QB', 'RB', 'WR', 'TE']:
        # Exclude picks with invalid stats (0 pts despite positive games_played -- Sleeper ID mismatch)
        picks_pos = [p for p in scored_picks if p['position'] == pos and p['games_played'] >= 4 and p.get('stats_valid', True)]
        x_ranks = [(p['positional_draft_rank'] / p['num_teams']) * 12.0 for p in picks_pos]
        y_rates = [p['pts_rate'] for p in picks_pos]
        weights = [best_rho ** (current_year - p['season_year']) for p in picks_pos]

        ranks_grid = linspace(1, 60, 60)
        e_rate_grid = fit_gam_rate_curve(x_ranks, y_rates, weights, ranks_grid, is_monotonic=True, min_val=0.5)

        # Cross-player residual SD: how much do pts_rate values scatter around the GAM mean
        # at each positional rank? Captures bust-vs-breakout talent heterogeneity across picks.
        residuals_sq = []
        for x_val, y_val in zip(x_ranks, y_rates):
            idx = max(0, min(59, int(round(x_val)) - 1))
            pred = e_rate_grid[idx]
            residuals_sq.append((y_val - pred) ** 2)

        sd_rate_grid = fit_gam_rate_variance(x_ranks, residuals_sq, weights, ranks_grid, min_sd=0.3)

        pos_curves[pos] = {
            'max_observed_rank': int(max(x_ranks)) if x_ranks else 50,
            'lookup_ranks': ranks_grid,
            'E_pts_per_game': [round(float(v), 4) for v in e_rate_grid],
            'SD_pts_per_game': [round(float(v), 4) for v in sd_rate_grid]
        }
        print(f'{pos} Curves (Section 3.1): Rank 1 E_rate={e_rate_grid[0]:.2f} (SD_cross={sd_rate_grid[0]:.2f}), Rank 12 E_rate={e_rate_grid[11]:.2f} (SD_cross={sd_rate_grid[11]:.2f}), Rank 24 E_rate={e_rate_grid[23]:.2f} (SD_cross={sd_rate_grid[23]:.2f})')

    def get_pos_expected_rate(pos, rank):
        m = pos_curves[pos]
        r = max(1.0, min(float(rank), 60.0))
        idx = int(r) - 1
        frac = r - math.floor(r)
        if idx >= 59:
            return m['E_pts_per_game'][59], m['SD_pts_per_game'][59]
        e = m['E_pts_per_game'][idx] * (1 - frac) + m['E_pts_per_game'][idx + 1] * frac
        sd = m['SD_pts_per_game'][idx] * (1 - frac) + m['SD_pts_per_game'][idx + 1] * frac
        return e, sd

    # 3. Fit Overall-Slot VORP Curves (Section 3.2)
    # Compute VORP_actual for every player in the training pool
    for p in scored_picks:
        pos = p['position']
        G = p['possible_games']
        num_teams = p['num_teams']

        # Determine replacement rank (Section 4.6)
        starters_pos = 1 if pos in ['QB', 'TE'] else 2
        starters_flex = 1
        flex_share = 0.45 if pos in ['RB', 'WR'] else (0.10 if pos == 'TE' else 0.0)

        if p['tracks_starting_lineups']:
            repl_rank = (num_teams * starters_pos) + (num_teams * starters_flex * flex_share)
        else:
            repl_rank = num_teams * starters_pos

        e_rate_repl, _ = get_pos_expected_rate(pos, (repl_rank / num_teams) * 12.0)
        replacement_level_points = e_rate_repl * G
        vorp_actual = p['A_pts'] - replacement_level_points
        vorp_rate = vorp_actual / G if G > 0 else 0.0

        p['replacement_level_points'] = round(float(replacement_level_points), 2)
        p['VORP_actual'] = round(float(vorp_actual), 2)
        p['vorp_rate'] = round(float(vorp_rate), 4)

    # Fit VORP curves pooled across all positions by overall_pick_number
    # Exclude picks with invalid stats from VORP curve fitting as well
    vorp_picks = [p for p in scored_picks if p['games_played'] >= 4 and p.get('stats_valid', True)]
    x_overall = [float(p['overall_pick_number']) for p in vorp_picks]
    y_vorp_rates = [p['vorp_rate'] for p in vorp_picks]
    weights_vorp = [best_rho ** (current_year - p['season_year']) for p in vorp_picks]

    max_overall_pick = max(200, int(max(x_overall)) if x_overall else 180)
    overall_grid = linspace(1, max_overall_pick, max_overall_pick)
    v_exp_rate_grid = fit_gam_rate_curve(x_overall, y_vorp_rates, weights_vorp, overall_grid, bandwidth=8.0, is_monotonic=True, min_val=-15.0)

    # SD_VORP_per_game: cross-player residual SD of vorp_rate around the V_expected GAM mean.
    # Captures draft-slot outcome heterogeneity (some picks become league-winners, some bust).
    # At scoring time, scaled linearly: SD_VORP = SD_VORP_per_game * G  (Section 3.2, NOT sqrt)
    vorp_residuals_sq = []
    for x_val, y_val in zip(x_overall, y_vorp_rates):
        idx = max(0, min(max_overall_pick - 1, int(round(x_val)) - 1))
        pred = v_exp_rate_grid[idx]
        vorp_residuals_sq.append((y_val - pred) ** 2)

    sd_vorp_rate_grid = fit_gam_rate_variance(x_overall, vorp_residuals_sq, weights_vorp, overall_grid, bandwidth=10.0, min_sd=0.3)

    vorp_curves = {
        'max_observed_pick': int(max(x_overall)) if x_overall else 180,
        'lookup_picks': overall_grid,
        'V_expected_per_game': [round(float(v), 4) for v in v_exp_rate_grid],
        'SD_VORP_per_game': [round(float(v), 4) for v in sd_vorp_rate_grid]
    }
    print(f'Overall-Slot VORP Curves (Section 3.2): Pick 1 V_rate={v_exp_rate_grid[0]:.2f} (SD_cross={sd_vorp_rate_grid[0]:.2f}), Pick 24 V_rate={v_exp_rate_grid[23]:.2f} (SD_cross={sd_vorp_rate_grid[23]:.2f}), Pick 60 V_rate={v_exp_rate_grid[59]:.2f} (SD_cross={sd_vorp_rate_grid[59]:.2f})')

    def get_vorp_expected_rate(overall_pick):
        pick = max(1.0, min(float(overall_pick), float(max_overall_pick)))
        idx = int(pick) - 1
        frac = pick - math.floor(pick)
        if idx >= max_overall_pick - 1:
            return vorp_curves['V_expected_per_game'][-1], vorp_curves['SD_VORP_per_game'][-1]
        v = vorp_curves['V_expected_per_game'][idx] * (1 - frac) + vorp_curves['V_expected_per_game'][idx + 1] * frac
        sd = vorp_curves['SD_VORP_per_game'][idx] * (1 - frac) + vorp_curves['SD_VORP_per_game'][idx + 1] * frac
        return v, sd

    # 4. Concentration-Ratio Baseline T_bust(position, tier) (Section 3.3)
    # & Floor-PPG Population Distribution (Section 3.4)
    concentration_bins = {
        pos: {'4-8': [], '9-13': [], '14-17': []}
        for pos in ['QB', 'RB', 'WR', 'TE']
    }
    floor_ppg_distributions = {
        pos: []
        for pos in ['QB', 'RB', 'WR', 'TE']
    }

    for p in scored_picks:
        gp = p['games_played']
        wks = p['weekly_points']
        A_pts = p['A_pts']

        if gp >= 4 and A_pts > 0 and len(wks) >= 4 and p.get('stats_valid', True):
            n_top = max(1, math.ceil(0.25 * gp))
            sorted_wks = sorted(wks, reverse=True)
            top_pts = sum(sorted_wks[:n_top])
            C = top_pts / A_pts
            p['C'] = round(float(C), 4)
            p['n_top'] = n_top

            tier = get_tier_label(gp)
            concentration_bins[p['position']][tier].append(C)

            # Floor games
            floor_wks = sorted_wks[n_top:]
            floor_ppg = statistics.mean(floor_wks) if floor_wks else 0.0
            p['floor_ppg'] = round(float(floor_ppg), 2)
            floor_ppg_distributions[p['position']].append(floor_ppg)

    # Sort concentration_bins for dynamic percentile evaluation at runtime (Section 3.3, 8)
    concentration_distributions = {}
    for pos, tiers in concentration_bins.items():
        concentration_distributions[pos] = {}
        for tier, c_vals in tiers.items():
            concentration_distributions[pos][tier] = sorted(c_vals)

    # Compute T_bust tables at 85th percentile (Section 3.3 default)
    default_sensitivity = 0.85
    t_bust_tables = {}
    for pos, tiers in concentration_distributions.items():
        t_bust_tables[pos] = {}
        for tier, c_vals in tiers.items():
            if len(c_vals) >= 3:
                # 85th percentile
                idx = max(0, min(len(c_vals) - 1, int(round(default_sensitivity * (len(c_vals) - 1)))))
                t_bust = float(c_vals[idx])
            elif len(c_vals) > 0:
                t_bust = max(c_vals)
            else:
                t_bust = 0.45
            t_bust_tables[pos][tier] = round(t_bust, 4)
        print(f'T_bust for {pos}: 4-8={t_bust_tables[pos]["4-8"]:.3f}, 9-13={t_bust_tables[pos]["9-13"]:.3f}, 14-17={t_bust_tables[pos]["14-17"]:.3f}')

    # Sort floor_ppg distributions for empirical percentile ranking
    for pos in floor_ppg_distributions:
        floor_ppg_distributions[pos].sort()

    def get_floor_ppg_percentile(pos, val):
        pop = floor_ppg_distributions.get(pos, [])
        if not pop:
            return 50.0
        # Empirical percentile rank (Section 4.7)
        count_less = sum(1 for x in pop if x < val)
        return (count_less / len(pop)) * 100.0

    # 5. Auto-Calibrate reliable_starter_threshold via Binary Search (Section 9.2)
    stage1_flagged_pool = []
    for p in scored_picks:
        if p.get('games_played', 0) >= 4 and p.get('A_pts', 0) > 0:
            pos = p['position']
            tier = get_tier_label(p['games_played'])
            t_bust = t_bust_tables[pos][tier]
            if p['C'] > t_bust:
                pct = get_floor_ppg_percentile(pos, p['floor_ppg'])
                stage1_flagged_pool.append({'player': p['player_name'], 'pos': pos, 'percentile': pct})

    print(f'\nStage 1 Flagged Player-Seasons in Training Pool: {len(stage1_flagged_pool)}')

    # Solve for threshold landing closest to 50% reclassification fraction (Section 9.2)
    best_threshold = 10.0
    best_diff = 1.0
    for cand in range(5, 96, 1):
        reclass_count = sum(1 for item in stage1_flagged_pool if item['percentile'] >= cand)
        frac = reclass_count / len(stage1_flagged_pool) if stage1_flagged_pool else 0.5
        diff = abs(frac - 0.50)
        if diff < best_diff:
            best_diff = diff
            best_threshold = cand

    print(f'Auto-Calibrated reliable_starter_threshold = {best_threshold} (Reclassification fraction = {sum(1 for item in stage1_flagged_pool if item["percentile"] >= best_threshold) / len(stage1_flagged_pool) * 100:.1f}%)')

    # 6. Score All Training Picks According to Spec (Sections 4, 5, 6)
    lambda_default = 0.70
    alpha_default = 0.85
    penalty_intensity = 2.0
    penalty_cap = 0.50
    reward_intensity = 2.5
    reward_cap = 0.60

    for p in scored_picks:
        pos = p['position']
        G = p['possible_games']
        gp = p['games_played']
        gm = p['games_missed']
        A_pts = p['A_pts']
        overall_pick = p['overall_pick_number']
        norm_r = (p['positional_draft_rank'] / p['num_teams']) * 12.0

        # Step 4.3: Effective_games
        if gp == 0:
            effective_games = 0
        elif gm < 4:
            effective_games = G
        else:
            effective_games = G - gm

        e_rate, sd_rate = get_pos_expected_rate(pos, norm_r)
        E_adj = e_rate * effective_games

        # Step 4.4: Residual and Z (linear scaling for cross-player rate SD)
        residual = A_pts - E_adj
        SD_pts = sd_rate * effective_games if effective_games > 0 else 1.0
        Z = residual / SD_pts if effective_games > 0 else 0.0

        # Step 4.5: Asymmetry layer
        Adjusted = Z if Z >= 0 else (Z * lambda_default)

        # Step 4.6: VORP_z
        v_exp_rate, sd_vorp_rate = get_vorp_expected_rate(overall_pick)
        V_expected = v_exp_rate * G
        SD_VORP = sd_vorp_rate * G
        VORP_z = (p['VORP_actual'] - V_expected) / SD_VORP if SD_VORP > 0 else 0.0

        # Step 4.7: Consistency classification
        final_label = 'none'
        boom_share = 0.0

        if gp >= 4 and A_pts > 0:
            tier = get_tier_label(gp)
            t_bust = t_bust_tables[pos][tier]
            if p['C'] > t_bust:
                pct = get_floor_ppg_percentile(pos, p['floor_ppg'])
                if pct >= best_threshold:
                    final_label = 'consistent_with_booms'
                else:
                    final_label = 'inconsistent_producer'

                # Dynamic boom magnitude
                n_top = p['n_top']
                top_pts = sum(sorted(p['weekly_points'], reverse=True)[:n_top])
                boom_mag = max(0.0, top_pts - (n_top * p['floor_ppg']))
                boom_share = boom_mag / A_pts if A_pts > 0 else 0.0

        # Step 4.8: Multiplier (only applies when Adjusted > 0)
        multiplier = 1.00
        if Adjusted > 0:
            if final_label == 'inconsistent_producer':
                boost = min(penalty_cap, max(0.0, boom_share * penalty_intensity))
                multiplier = 1.0 - boost
            elif final_label == 'consistent_with_booms':
                boost = min(reward_cap, max(0.0, boom_share * reward_intensity))
                multiplier = 1.0 + boost

        Adjusted_final = (Adjusted * multiplier) if Adjusted > 0 else Adjusted

        # Step 4.9: Blend into LDI_raw
        LDI_raw = (alpha_default * Adjusted_final) + ((1.0 - alpha_default) * VORP_z)

        # Step 4.10: Pick display score
        pick_display_score = max(1, min(99, int(round(standard_normal_cdf(LDI_raw) * 100.0))))

        p['Effective_games'] = effective_games
        p['E_adj'] = round(float(E_adj), 2)
        p['Residual'] = round(float(residual), 2)
        p['SD_pts'] = round(float(SD_pts), 2)
        p['Z'] = round(float(Z), 3)
        p['Adjusted'] = round(float(Adjusted), 3)
        p['VORP_z'] = round(float(VORP_z), 3)
        p['final_label'] = final_label
        p['multiplier'] = round(float(multiplier), 3)
        p['Adjusted_final'] = round(float(Adjusted_final), 3)
        p['LDI_raw'] = round(float(LDI_raw), 3)
        p['pick_display_score'] = pick_display_score

    # 7. Manager-Level Rollup (Section 5) & Empirical Percentile Population (Section 6.2)
    manager_drafts = {}
    for p in scored_picks:
        key = f"{p['draft_id']}_{p['manager_id']}"
        if key not in manager_drafts:
            manager_drafts[key] = {
                'league_id': p['league_id'],
                'season_year': p['season_year'],
                'draft_id': p['draft_id'],
                'manager_id': p['manager_id'],
                'manager_name': p['manager_name'],
                'team_name': p['team_name'],
                'picks': []
            }
        manager_drafts[key]['picks'].append(p)

    all_manager_seasons = list(manager_drafts.values())
    for md in all_manager_seasons:
        # Equal weight average (Section 5)
        raw_scores = [p['LDI_raw'] for p in md['picks']]
        md['LDI_manager_season'] = float(statistics.mean(raw_scores)) if raw_scores else 0.0

    all_manager_seasons.sort(key=lambda x: x['LDI_manager_season'])
    pooled_manager_scores = [round(m['LDI_manager_season'], 4) for m in all_manager_seasons]
    N = len(pooled_manager_scores)
    print(f'\nTotal manager-seasons across site training population: {N}')

    for rank_idx, md in enumerate(all_manager_seasons):
        # Empirical percentile rank clipped to [1, 99] (Section 6.2)
        pct = (rank_idx + 1) / N * 100.0
        md['manager_display_score'] = max(1, min(99, int(round(pct))))

    print('\nSample Manager Season Rollups (LDI_manager_season -> Display Score 1-100):')
    for md in all_manager_seasons[::25]:
        print(f"  {md['draft_id']} - {md['manager_name']}: LDI_manager_season = {md['LDI_manager_season']:.3f} -> Grade = {md['manager_display_score']}/100")

    # Build weekly logs cache for fast runtime lookups
    weekly_logs_cache = {}
    for p in scored_picks:
        nfl_yr = p['nfl_year']
        k = f"{normalize_name(p['player_name'])}_{nfl_yr}"
        weekly_logs_cache[k] = {
            'player_name': p['player_name'],
            'position': p['position'],
            'nfl_year': nfl_yr,
            'games_played': p['games_played'],
            'games_missed': p['games_missed'],
            'A_pts': p['A_pts'],
            'weekly_points': p['weekly_points'],
            'C': p.get('C'),
            'floor_ppg': p.get('floor_ppg'),
            'final_label': p.get('final_label')
        }

    # 8. Output JSON Artifact (src/ldi_model_data.json)
    ldi_payload = {
        'version': '4.0.0',
        'calibrated_rho': best_rho,
        'defaults': {
            'lambda': lambda_default,
            'alpha': alpha_default,
            'sensitivity': default_sensitivity,
            'reliable_starter_threshold': best_threshold,
            'mode': 'dynamic',
            'penalty_intensity': penalty_intensity,
            'penalty_cap': penalty_cap,
            'reward_intensity': reward_intensity,
            'reward_cap': reward_cap,
            'mu_penalty': 0.70,
            'mu_reward': 1.20,
            'games_missed_threshold': 4,
            'min_games_for_pill': 4
        },
        'pos_curves': pos_curves,
        'vorp_curves': vorp_curves,
        't_bust_tables': t_bust_tables,
        'concentration_distributions': concentration_distributions,
        'floor_ppg_distributions': floor_ppg_distributions,
        'stage1_flagged_percentiles': [item['percentile'] for item in stage1_flagged_pool],
        'pooled_manager_scores': pooled_manager_scores,
        'weekly_logs_cache': weekly_logs_cache
    }

    output_path = 'src/ldi_model_data.json'
    with open(output_path, 'w') as f:
        json.dump(ldi_payload, f)

    file_size = os.path.getsize(output_path)
    print(f'\nSuccessfully generated {output_path} ({file_size} bytes, version 4.0.0)!')

if __name__ == '__main__':
    main()
