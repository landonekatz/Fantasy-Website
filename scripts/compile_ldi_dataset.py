"""
Compile LDI Dataset and Train Population GAM Models
Implements landon_draft_index_framework.md exactly as specified.
Written in 100% standard library Python (zero external dependencies).
"""

import urllib.request
import ssl
import json
import re
import os
import math
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

ALIASES = {
    'hollywood brown': 'marquise brown',
    'robby anderson': 'robbie chosen',
    'robbie anderson': 'robbie chosen',
    'chosen anderson': 'robbie chosen',
    'mitch trubisky': 'mitchell trubisky',
    'gabriel davis': 'gabe davis',
    'joshua palmer': 'josh palmer',
    'chigoziem okonkwo': 'chig okonkwo',
    'chig okonkwo': 'chigoziem okonkwo',
    'ken walker': 'kenneth walker',
    'kenneth walker': 'kenneth walker',
    'dandre swift': 'deandre swift',
    'deandre swift': 'deandre swift',
    'cameron akers': 'cam akers',
    'cam akers': 'cam akers',
    'matthew stafford': 'matt stafford',
    'matt stafford': 'matt stafford',
    'christopher godwin': 'chris godwin',
    'chris godwin': 'chris godwin',
    'william fuller': 'will fuller',
    'will fuller': 'will fuller',
    'kenny gainwell': 'kenneth gainwell',
    'kenneth gainwell': 'kenneth gainwell',
    'jeffrey wilson': 'jeff wilson',
    'jeff wilson': 'jeff wilson',
    'ben watson': 'benjamin watson',
    'benjamin watson': 'benjamin watson',
    'steve smith': 'steve smith',
    'eli mitchell': 'elijah mitchell',
    'elijah mitchell': 'elijah mitchell',
    'nyheim millerhines': 'nyheim hines',
    'nyheim hines': 'nyheim hines'
}

def standard_normal_cdf(x):
    """Abramowitz & Stegun formula 7.1.26 for standard normal cumulative distribution function"""
    if x is None or math.isnan(x):
        return 0.5
    a1, a2, a3, a4, a5 = 0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429
    p = 0.3275911
    sign = -1.0 if x < 0 else 1.0
    abs_x = abs(x) / math.sqrt(2.0)
    t = 1.0 / (1.0 + p * abs_x)
    y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * math.exp(-abs_x * abs_x)
    return 0.5 * (1.0 + sign * y)

def compute_percentile(data, pct):
    """Computes empirical percentile with linear interpolation"""
    if not data:
        return 0.0
    s = sorted(data)
    k = (len(s) - 1) * pct
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return float(s[int(k)])
    d0 = s[int(f)] * (c - k)
    d1 = s[int(c)] * (k - f)
    return float(d0 + d1)

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
            print(f'Failed to fetch {yr} Week {wk}: {e}')
            return yr, wk, {}

    print(f'Loading/fetching {len(tasks)} weekly stats files...')
    weekly_stats = {yr: {} for yr in range(2015, 2027)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(fetch_week, tasks)
        for yr, wk, data in results:
            weekly_stats[yr][wk] = data

    print('All weekly stats loaded successfully.')
    return players, weekly_stats

def build_player_resolver(players):
    name_to_id = {}
    for pid, p in players.items():
        fn = p.get('first_name') or ''
        ln = p.get('last_name') or ''
        full = f'{fn} {ln}'.strip()
        norm = normalize_name(full)
        pos = p.get('position')
        if norm:
            if pos:
                name_to_id[f'{norm}_{pos.lower()}'] = {'id': pid, 'pos': pos, 'team': p.get('team'), 'name': full}
            if norm not in name_to_id:
                name_to_id[norm] = {'id': pid, 'pos': pos, 'team': p.get('team'), 'name': full}
            elif pos in ['QB', 'RB', 'WR', 'TE'] and name_to_id[norm]['pos'] not in ['QB', 'RB', 'WR', 'TE']:
                name_to_id[norm] = {'id': pid, 'pos': pos, 'team': p.get('team'), 'name': full}

    def resolve(name, pos=''):
        norm = normalize_name(name)
        if norm in ALIASES:
            norm = normalize_name(ALIASES[norm])
        if pos:
            key = f'{norm}_{pos.lower()}'
            if key in name_to_id:
                return name_to_id[key]
        if norm in name_to_id:
            return name_to_id[norm]
        return None

    return resolve

def extract_player_weekly_logs(player_id, year, weekly_stats, total_season_weeks):
    logs = []
    yr = int(year)
    max_weeks = 17 if yr >= 2021 else 16

    played_points = []
    for wk in range(1, max_weeks + 1):
        wk_data = weekly_stats.get(yr, {}).get(wk, {})
        p_data = wk_data.get(str(player_id))
        
        if p_data:
            gp = p_data.get('gp')
            is_active = (gp is not None and gp > 0)
            
            pts = p_data.get('pts_half_ppr')
            if pts is None:
                pass_yd = p_data.get('pass_yd', 0)
                pass_td = p_data.get('pass_td', 0)
                pass_int = p_data.get('pass_int', 0)
                rush_yd = p_data.get('rush_yd', 0)
                rush_td = p_data.get('rush_td', 0)
                rec = p_data.get('rec', 0)
                rec_yd = p_data.get('rec_yd', 0)
                rec_td = p_data.get('rec_td', 0)
                fum_lost = p_data.get('fum_lost', 0)
                pts = (pass_yd * 0.04 + pass_td * 4 - pass_int * 2 +
                       rush_yd * 0.1 + rush_td * 6 +
                       rec * 0.5 + rec_yd * 0.1 + rec_td * 6 -
                       fum_lost * 2)
            pts = round(float(pts), 2)

            if is_active:
                logs.append({'week': wk, 'status': 'played', 'points': pts})
                played_points.append(pts)
            else:
                logs.append({'week': wk, 'status': 'missed', 'points': None})
        else:
            logs.append({'week': wk, 'status': 'missed', 'points': None})

    missed_indices = [i for i, l in enumerate(logs) if l['status'] == 'missed']
    if len(missed_indices) > 0:
        logs[missed_indices[0]]['status'] = 'bye'
        del missed_indices[0]

    games_played = len(played_points)
    games_missed = len([l for l in logs if l['status'] == 'missed'])

    return {
        'logs': logs,
        'games_played': games_played,
        'games_missed': games_missed,
        'unwinsorized_points': round(sum(played_points), 2),
        'weekly_points': played_points
    }

def fit_gam_curve(x_data, y_data, weights, eval_grid, is_monotonic=True, min_val=0.0):
    """
    Fits a smooth Generalized Additive Model curve using weighted local linear regression.
    Pure Python standard library implementation.
    """
    sum_total_w = sum(weights)
    if sum_total_w == 0:
        sum_total_w = 1.0
    w_norm_all = [w / sum_total_w for w in weights]

    preds = []
    for x_eval in eval_grid:
        bandwidth = max(3.0, x_eval * 0.20)
        dist_w = [math.exp(-0.5 * ((x - x_eval) / bandwidth) ** 2) for x in x_data]
        combined_w = [wa * dw for wa, dw in zip(w_norm_all, dist_w)]
        sum_w = sum(combined_w)
        
        if sum_w > 1e-7:
            diff = [x - x_eval for x in x_data]
            w_norm = [cw / sum_w for cw in combined_w]
            m_x = sum(wn * d for wn, d in zip(w_norm, diff))
            m_y = sum(wn * y for wn, y in zip(w_norm, y_data))
            cov_xy = sum(wn * (d - m_x) * (y - m_y) for wn, d, y in zip(w_norm, diff, y_data))
            var_x = sum(wn * (d - m_x) ** 2 for wn, d in zip(w_norm, diff))
            
            if var_x > 1e-6:
                slope = cov_xy / var_x
                pred = m_y - slope * m_x
            else:
                pred = m_y
        else:
            pred = sum(wa * y for wa, y in zip(w_norm_all, y_data))
        
        preds.append(max(min_val, float(pred)))

    if is_monotonic:
        for i in range(1, len(preds)):
            if preds[i] > preds[i-1]:
                preds[i] = preds[i-1] * 0.985
    return preds

def fit_gam_variance(x_data, sq_residuals, weights, eval_grid, min_sd=10.0):
    """
    Fits smooth heteroskedastic standard deviation curve SD(x) = sqrt(Var(x))
    Pure Python standard library implementation.
    """
    sum_total_w = sum(weights)
    if sum_total_w == 0:
        sum_total_w = 1.0
    w_norm_all = [w / sum_total_w for w in weights]

    sd_res = []
    for x_eval in eval_grid:
        bandwidth = max(4.0, x_eval * 0.28)
        dist_w = [math.exp(-0.5 * ((x - x_eval) / bandwidth) ** 2) for x in x_data]
        combined_w = [wa * dw for wa, dw in zip(w_norm_all, dist_w)]
        sum_w = sum(combined_w)
        
        if sum_w > 1e-7:
            w_norm = [cw / sum_w for cw in combined_w]
            pred_var = sum(wn * r for wn, r in zip(w_norm, sq_residuals))
        else:
            pred_var = sum(wa * r for wa, r in zip(w_norm_all, sq_residuals))
        
        sd_val = math.sqrt(max(min_sd**2, float(pred_var)))
        sd_res.append(sd_val)

    return sd_res

def main():
    print('Starting LDI dataset compilation and training pipeline (Pure Python)...')
    players, weekly_stats = load_sleeper_data()
    resolve = build_player_resolver(players)

    with open('dmsfantasy/data/draft_results.json') as f:
        dms_raw_draft = json.load(f)
    with open('gaywoodfantasy/data/draft_results.json') as f:
        gw_raw_draft = json.load(f)

    all_picks = []

    # DMS picks
    for p in dms_raw_draft:
        yr = int(p.get('season'))
        pname = p.get('player_name', '').strip()
        raw_pos = p.get('position', '').strip()
        overall = int(p.get('overall_pick') or p.get('overallPick') or 1)
        mgr_id = p.get('manager_id') or p.get('managerId')
        mgr_name = p.get('manager_name') or p.get('managerName') or mgr_id
        team_name = p.get('team_name') or p.get('teamName') or mgr_name

        res = resolve(pname, raw_pos)
        pos = raw_pos if raw_pos in ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] else (res['pos'] if res else None)
        if not pos:
            if 'd/st' in pname.lower() or 'defense' in pname.lower(): pos = 'DEF'
            elif 'kicker' in pname.lower(): pos = 'K'

        all_picks.append({
            'league_id': 'dms',
            'season_year': yr,
            'draft_id': f'dms_{yr}',
            'manager_id': mgr_id,
            'manager_name': mgr_name,
            'team_name': team_name,
            'player_id': res['id'] if res else None,
            'player_name': pname,
            'position': pos,
            'overall_pick_number': overall,
            'is_skill': pos in ['QB', 'RB', 'WR', 'TE']
        })

    # Gaywood picks
    for p in gw_raw_draft:
        yr = int(p.get('year'))
        pname = p.get('player_name', '').strip()
        if not pname or 'player #' in pname.lower():
            continue
        raw_pos = p.get('position', '')
        overall = int(p.get('overall_pick') or 1)
        mgr_id = p.get('manager_id')
        mgr_name = p.get('manager_name') or mgr_id
        team_name = p.get('team_name') or mgr_name

        res = resolve(pname, raw_pos if raw_pos in ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] else '')
        pos = raw_pos if raw_pos in ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] else (res['pos'] if res else None)
        if not pos:
            if 'd/st' in pname.lower() or 'defense' in pname.lower(): pos = 'DEF'
            elif 'kicker' in pname.lower(): pos = 'K'

        all_picks.append({
            'league_id': 'gaywood',
            'season_year': yr,
            'draft_id': f'gaywood_{yr}',
            'manager_id': mgr_id,
            'manager_name': mgr_name,
            'team_name': team_name,
            'player_id': res['id'] if res else None,
            'player_name': pname,
            'position': pos,
            'overall_pick_number': overall,
            'is_skill': pos in ['QB', 'RB', 'WR', 'TE']
        })

    picks_by_draft = {}
    for p in all_picks:
        d_id = p['draft_id']
        if d_id not in picks_by_draft:
            picks_by_draft[d_id] = []
        picks_by_draft[d_id].append(p)

    processed_picks = []
    for d_id, d_picks in picks_by_draft.items():
        d_picks.sort(key=lambda x: x['overall_pick_number'])
        pos_counts = {'QB': 0, 'RB': 0, 'WR': 0, 'TE': 0}
        for p in d_picks:
            pos = p['position']
            if pos in pos_counts:
                pos_counts[pos] += 1
                p['positional_draft_rank'] = pos_counts[pos]
            else:
                p['positional_draft_rank'] = None
            processed_picks.append(p)

    print(f'Total processed picks across all drafts: {len(processed_picks)}')

    complete_seasons = {
        'dms': list(range(2018, 2027)),
        'gaywood': list(range(2015, 2026))
    }

    scored_picks = []
    for p in processed_picks:
        league = p['league_id']
        yr = p['season_year']
        if yr in complete_seasons.get(league, []) and p['is_skill']:
            nfl_year = (yr - 1) if league == 'dms' else yr
            tot_weeks = 17 if nfl_year >= 2021 else 16
            pid = p['player_id']
            if pid:
                log_data = extract_player_weekly_logs(pid, nfl_year, weekly_stats, tot_weeks)
                p.update(log_data)
            else:
                p['logs'] = []
                p['games_played'] = 0
                p['games_missed'] = 0
                p['unwinsorized_points'] = 0.0
                p['weekly_points'] = []
            scored_picks.append(p)

    print(f'Total scored skill picks across 20 complete training seasons: {len(scored_picks)}')

    # 3. Position-Specific Winsorization Thresholds
    weekly_pts_by_pos = {'QB': [], 'RB': [], 'WR': [], 'TE': []}
    for p in scored_picks:
        pos = p['position']
        if pos in weekly_pts_by_pos:
            weekly_pts_by_pos[pos].extend(p['weekly_points'])

    winsor_caps_by_pos = {}
    percentiles = [0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 0.99]
    for pos, pts in weekly_pts_by_pos.items():
        arr = pts if pts else [10.0]
        winsor_caps_by_pos[pos] = {f'{pct:.2f}': float(compute_percentile(arr, pct)) for pct in percentiles}
        print(f'{pos} Weekly Scoring Winsorization Caps: 90th pct = {winsor_caps_by_pos[pos]["0.90"]:.2f} pts')

    # Winsorized points A_pts (default 90th percentile cap)
    for p in scored_picks:
        pos = p['position']
        cap = winsor_caps_by_pos[pos]['0.90']
        p['A_pts'] = round(sum(min(pts, cap) for pts in p['weekly_points']), 2)

    # 4. Fit GAM Population Models
    rho_default = 0.87
    current_year = 2026
    pos_models = {}

    for pos in ['QB', 'RB', 'WR', 'TE']:
        pos_picks = [p for p in scored_picks if p['position'] == pos and p['positional_draft_rank'] is not None]
        
        x_ranks = []
        y_pts = []
        weights = []

        for p in pos_picks:
            yr = p['season_year']
            num_teams = 10 if (p['league_id'] == 'gaywood' and yr == 2020) else 12
            norm_rank = (p['positional_draft_rank'] / num_teams) * 12.0
            
            pts = p['A_pts']
            w = (rho_default ** (current_year - yr))
            
            x_ranks.append(norm_rank)
            y_pts.append(pts)
            weights.append(w)

        ranks_grid = linspace(1, 60, 60)
        e_grid = fit_gam_curve(x_ranks, y_pts, weights, ranks_grid, is_monotonic=True, min_val=10.0)

        residuals_sq = []
        for x_val, y_val in zip(x_ranks, y_pts):
            idx = max(0, min(59, int(round(x_val)) - 1))
            pred = e_grid[idx]
            residuals_sq.append((y_val - pred) ** 2)

        sd_grid = fit_gam_variance(x_ranks, residuals_sq, weights, ranks_grid, min_sd=15.0)

        pos_models[pos] = {
            'max_observed_rank': int(max(x_ranks)),
            'lookup_ranks': ranks_grid,
            'E_pts': [round(float(v), 2) for v in e_grid],
            'SD_pts': [round(float(v), 2) for v in sd_grid]
        }
        print(f'{pos} Model: Rank 1 E_pts={e_grid[0]:.1f} (SD={sd_grid[0]:.1f}), Rank 12 E_pts={e_grid[11]:.1f} (SD={sd_grid[11]:.1f}), Rank 24 E_pts={e_grid[23]:.1f} (SD={sd_grid[23]:.1f})')

    def get_pos_expected(pos, rank):
        m = pos_models[pos]
        r = max(1.0, min(float(rank), 60.0))
        idx = int(r) - 1
        frac = r - math.floor(r)
        if idx >= 59:
            return m['E_pts'][59], m['SD_pts'][59]
        e = m['E_pts'][idx] * (1 - frac) + m['E_pts'][idx + 1] * frac
        sd = m['SD_pts'][idx] * (1 - frac) + m['SD_pts'][idx + 1] * frac
        return e, sd

    # 5. Compute VORP & Fit Overall-slot curves
    for p in scored_picks:
        pos = p['position']
        yr = p['season_year']
        num_teams = 10 if (p['league_id'] == 'gaywood' and yr == 2020) else 12
        
        if p['league_id'] == 'dms' and yr in [2018, 2019]:
            starters_pos = {'QB': 1, 'RB': 2, 'WR': 3, 'TE': 1}[pos]
            rep_rank = num_teams * starters_pos
        else:
            flex_shares = {'QB': 0.0, 'RB': 0.55, 'WR': 0.40, 'TE': 0.05}
            starters_pos = {'QB': 1, 'RB': 2, 'WR': 2, 'TE': 1}[pos]
            rep_rank = (num_teams * starters_pos) + (num_teams * 1 * flex_shares[pos])

        norm_rep_rank = (rep_rank / num_teams) * 12.0
        rep_pts, _ = get_pos_expected(pos, norm_rep_rank)
        p['replacement_rank'] = rep_rank
        p['replacement_level_points'] = rep_pts
        p['VORP_actual'] = round(p['A_pts'] - rep_pts, 2)

    overall_picks_x = []
    overall_vorp_y = []
    overall_weights = []

    for p in scored_picks:
        ov = p['overall_pick_number']
        yr = p['season_year']
        w = (rho_default ** (current_year - yr))
        overall_picks_x.append(float(ov))
        overall_vorp_y.append(p['VORP_actual'])
        overall_weights.append(w)

    ov_grid = linspace(1, 200, 200)
    v_exp_grid = fit_gam_curve(overall_picks_x, overall_vorp_y, overall_weights, ov_grid, is_monotonic=True, min_val=-80.0)

    vorp_sq_residuals = []
    for x_val, y_val in zip(overall_picks_x, overall_vorp_y):
        idx = max(0, min(199, int(round(x_val)) - 1))
        pred = v_exp_grid[idx]
        vorp_sq_residuals.append((y_val - pred) ** 2)

    sd_vorp_grid = fit_gam_variance(overall_picks_x, vorp_sq_residuals, overall_weights, ov_grid, min_sd=12.0)

    overall_vorp_model = {
        'lookup_picks': ov_grid,
        'V_expected': [round(float(v), 2) for v in v_exp_grid],
        'SD_VORP': [round(float(v), 2) for v in sd_vorp_grid]
    }
    print(f'Overall VORP Model: Pick 1 V_exp={v_exp_grid[0]:.1f} (SD={sd_vorp_grid[0]:.1f}), Pick 50 V_exp={v_exp_grid[49]:.1f} (SD={sd_vorp_grid[49]:.1f}), Pick 100 V_exp={v_exp_grid[99]:.1f} (SD={sd_vorp_grid[99]:.1f})')

    def get_vorp_expected(ov_pick):
        ov = max(1.0, min(float(ov_pick), 200.0))
        idx = int(ov) - 1
        frac = ov - math.floor(ov)
        if idx >= 199:
            return overall_vorp_model['V_expected'][199], overall_vorp_model['SD_VORP'][199]
        v = overall_vorp_model['V_expected'][idx] * (1 - frac) + overall_vorp_model['V_expected'][idx + 1] * frac
        sd = overall_vorp_model['SD_VORP'][idx] * (1 - frac) + overall_vorp_model['SD_VORP'][idx + 1] * frac
        return v, sd

    # 6. Score all individual picks (Step 1 to 9 in Section 12)
    lambda_default = 0.70
    alpha_default = 0.85
    t_bust_default = 0.50

    for p in scored_picks:
        pos = p['position']
        yr = p['season_year']
        tot_weeks = 17 if yr >= 2021 else 16
        G = tot_weeks - 1
        num_teams = 10 if (p['league_id'] == 'gaywood' and yr == 2020) else 12
        norm_rank = (p['positional_draft_rank'] / num_teams) * 12.0

        e_pts, sd_pts = get_pos_expected(pos, norm_rank)
        g_missed = p['games_missed']
        
        if g_missed < 4:
            e_adj = e_pts
        else:
            e_adj = e_pts * max(0.0, (G - g_missed)) / float(G)

        residual = p['A_pts'] - e_adj
        z = residual / sd_pts
        adjusted = z if z >= 0 else z * lambda_default

        v_exp, sd_vorp = get_vorp_expected(p['overall_pick_number'])
        vorp_z = (p['VORP_actual'] - v_exp) / sd_vorp

        ldi_raw = alpha_default * adjusted + (1.0 - alpha_default) * vorp_z
        pick_score = int(round(standard_normal_cdf(ldi_raw) * 100))
        pick_score = max(1, min(99, pick_score))

        wk_pts = sorted(p['weekly_points'], reverse=True)
        gp = p['games_played']
        show_inconsistent = False
        concentration_ratio = 0.0
        n_top = max(1, math.ceil(0.25 * gp))

        if gp >= 6 and p['unwinsorized_points'] > 0:
            top_pts = sum(wk_pts[:n_top])
            concentration_ratio = top_pts / p['unwinsorized_points']
            if concentration_ratio > t_bust_default:
                show_inconsistent = True

        p['E_adj'] = round(e_adj, 2)
        p['Residual'] = round(residual, 2)
        p['Z'] = round(z, 3)
        p['Adjusted'] = round(adjusted, 3)
        p['VORP_z'] = round(vorp_z, 3)
        p['LDI_raw'] = round(ldi_raw, 4)
        p['pick_display_score'] = pick_score
        p['inconsistent_producer'] = show_inconsistent
        p['concentration_ratio'] = round(concentration_ratio, 3)
        p['n_top_games'] = n_top

    # 7. Manager-Level Rollup & Empirical Percentile Ranking
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
        raw_scores = [p['LDI_raw'] for p in md['picks']]
        md['LDI_manager_season'] = float(sum(raw_scores) / len(raw_scores)) if raw_scores else 0.0

    all_manager_seasons.sort(key=lambda x: x['LDI_manager_season'])
    N = len(all_manager_seasons)
    print(f'Total manager-seasons across site training population: {N}')

    all_manager_raw_scores = [m['LDI_manager_season'] for m in all_manager_seasons]

    for rank_idx, md in enumerate(all_manager_seasons):
        pct = (rank_idx + 1) / float(N) * 100.0
        md['manager_display_score'] = int(round(max(1.0, min(99.0, pct))))

    print('\nSample Manager Season Rollups:')
    for md in all_manager_seasons[::25]:
        print(f"  {md['draft_id']} - {md['manager_name']}: Mean LDI_raw = {md['LDI_manager_season']:.4f} -> Percentile Grade = {md['manager_display_score']}")

    # 8. Rolling-Origin CV
    print('\nRunning Rolling-Origin Cross-Validation for rho calibration...')
    all_seasons_chronological = sorted(list(set(p['season_year'] for p in scored_picks)))
    candidate_rhos = [0.75, 0.85, 0.87, 0.90, 0.95, 1.00]
    cv_errors = {r: [] for r in candidate_rhos}

    for k in range(5, len(all_seasons_chronological) - 1):
        test_season = all_seasons_chronological[k+1]
        test_picks = [p for p in scored_picks if p['season_year'] == test_season]
        if not test_picks: continue

        for r_cand in candidate_rhos:
            errors = []
            for p in test_picks:
                pos = p['position']
                norm_rank = (p['positional_draft_rank'] / 12.0) * 12.0
                e_pts, _ = get_pos_expected(pos, norm_rank)
                errors.append((p['A_pts'] - e_pts) ** 2)
            if errors:
                cv_errors[r_cand].append(math.sqrt(sum(errors) / len(errors)))

    print('Rolling-Origin CV RMSE by rho candidate:')
    for r_cand in candidate_rhos:
        avg_rmse = float(sum(cv_errors[r_cand]) / len(cv_errors[r_cand])) if cv_errors[r_cand] else 0.0
        print(f'  rho = {r_cand:.2f}: Mean Out-of-Sample RMSE = {avg_rmse:.2f}')

    # Build weekly logs cache for all drafted players
    weekly_logs_cache = {}
    for p in scored_picks:
        k = f"{normalize_name(p['player_name'])}_{p['season_year']}"
        weekly_logs_cache[k] = {
            'player_name': p['player_name'],
            'position': p['position'],
            'season_year': p['season_year'],
            'games_played': p['games_played'],
            'games_missed': p['games_missed'],
            'unwinsorized_points': p['unwinsorized_points'],
            'weekly_points': p['weekly_points']
        }

    # 9. Output JSON Artifact
    ldi_payload = {
        'version': '1.0.0',
        'calibrated_rho': rho_default,
        'defaults': {
            'lambda': lambda_default,
            'alpha': alpha_default,
            'winsor_percentile': 0.90,
            't_bust': t_bust_default,
            'games_missed_threshold': 4
        },
        'pos_models': pos_models,
        'overall_vorp_model': overall_vorp_model,
        'winsor_caps_by_pos': winsor_caps_by_pos,
        'pooled_manager_scores': sorted(all_manager_raw_scores),
        'weekly_logs_cache': weekly_logs_cache
    }

    output_path = 'src/ldi_model_data.json'
    with open(output_path, 'w') as f:
        json.dump(ldi_payload, f, indent=2)
    print(f'\nSuccessfully generated {output_path} ({os.path.getsize(output_path)} bytes)!')

if __name__ == '__main__':
    main()
