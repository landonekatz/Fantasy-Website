# The Landon Draft Index (LDI)
## Full Implementation Specification

This document is a complete, standalone build spec. It assumes no prior context — every calculation, threshold, data field, and default value needed to implement LDI is defined here.

### Contents
1. Required Data (full schema)
2. Training Data Sourcing
3. Fitting the Population Model (GAM)
4. Scoring a Single Pick (step by step)
5. Manager-Level Rollup
6. Display Scaling
7. UI: Pick Pills
8. Founder Tuning Panel (live)
9. Model Training Configuration (admin-only, batch)
10. Edge Cases & Validation Rules
11. Worked Example
12. Full Pipeline Reference
13. Glossary

---

## 1. Required Data (Full Schema)

Five record types are needed. K and DST are never scored by LDI and should be excluded from the `PlayerSeasonPick` table entirely — but see the note in 1.1 about pick numbering. `WeeklyStartingLineup` is only available for some league-seasons — Section 4.6 branches on its availability rather than assuming it always exists.

### 1.1 `PlayerSeasonPick` — one row per drafted QB/RB/WR/TE

| Field | Type | Notes |
|---|---|---|
| league_id | string | |
| season_year | integer | e.g. 2024 |
| draft_id | string | unique per league-season draft event |
| manager_id | string | who drafted the player |
| player_id | string | |
| player_name | string | |
| position | enum: QB, RB, WR, TE | K/DST never appear in this table |
| overall_pick_number | integer | **the true literal pick number in the draft, including K/DST picks in the count.** Do not renumber around excluded positions — if a kicker goes at pick 130, the next skill player is still pick 131, not a compressed number. This matters because Section 3.2's overall-slot curve needs real draft capital cost. |
| positional_draft_rank | integer | the order this player was taken among players at their own position in this specific draft (1st RB off the board = 1, 2nd = 2, etc.). Computed at ingestion, independently per draft. |

### 1.2 `LeagueSeasonSettings` — one row per league per season

| Field | Type | Notes |
|---|---|---|
| league_id | string | |
| season_year | integer | |
| num_teams | integer | can change year to year |
| starters_qb / starters_rb / starters_wr / starters_te | integer each | required starters per position |
| starters_flex | integer | number of flex spots |
| flex_eligible_positions | list | which positions can fill flex (e.g. [RB, WR, TE]) |
| scoring_ruleset_id | string | identifies the scoring rules in effect that season (PPR value, TE premium, etc.) |
| total_season_weeks | integer | **the number of regular-season fantasy matchup weeks for this specific league in this specific season — not assumed constant across leagues or years.** This is what Section 3.1's season-length normalization depends on; get it right per league-season, not as a global constant. |
| tracks_starting_lineups | boolean | whether `WeeklyStartingLineup` data exists and is reliable for this league-season |

### 1.3 `WeeklyGameLog` — one row per player per week per season

| Field | Type | Notes |
|---|---|---|
| league_id, season_year, player_id, week_number | — | composite key |
| status | enum: `played`, `bye`, `missed` | see 4.1 for exact definitions — this distinction is required, do not collapse it into a single points field with nulls |
| points | float | present only when status = `played`; omit or null otherwise |

### 1.4 `WeeklyStartingLineup` — one row per roster slot per manager per week per season

Only populated for league-seasons where `tracks_starting_lineups` is true. Used for the flex-share calculation in Section 4.6.

| Field | Type | Notes |
|---|---|---|
| league_id, season_year, manager_id, week_number, position_slot | — | composite key. `position_slot` is the roster slot (e.g. "QB", "RB1", "RB2", "FLEX", "TE") |
| player_id | string | which player filled that slot that week |

### 1.5 `ManagerDraft` (derived)

Grouping of a manager's `PlayerSeasonPick` rows for one league-season draft — used for the rollup in Section 5. Can be computed on the fly (group by manager_id + league_id + season_year) rather than stored.

---

## 2. Training Data Sourcing

**Two leagues, pooled together into one training set. No external ADP or market data of any kind.**

- **DMS league:** use the first 9 complete seasons. Exclude DMS's most recent draft — its season results aren't final yet, so there's no actual value (AV) to train against. Once that season concludes, include it in the next scheduled refit (Section 9.3).
- **Gaywood league:** use the most recent 15 complete seasons.

General rule going forward: **only fully-concluded seasons enter the training pool.** A league's current, in-progress draft is always excluded from training, but is still scored live by the model already fit from prior seasons — that's the entire point of the population-model architecture (Section 3).

**Do not apply any positional-mix normalization or detrending across seasons.** If in some season(s) QBs were drafted unusually early (a "QB run" year), leave that data exactly as it is when pooling. The percentile-within-position normalization referenced in Section 3.1 exists *only* to reconcile league-size differences (e.g., aligning a 10-team league's "RB1" pick with a 12-team league's "RB1" pick) — it must never be used to adjust, smooth, or dampen genuine season-to-season shifts in which positions get drafted early. That variation is real signal the GAM is meant to learn, not noise to correct for.

**Scoring-format consistency check, required before fitting:** if either league changed scoring rules at any point in its history (standard → PPR, flex eligibility changes, etc.), re-derive every historical week's points under that league's *current* scoring rules before pooling. Do not mix seasons computed under different scoring rules — this would corrupt the point totals independently of, and before, anything else in this pipeline runs.

---

## 3. Fitting the Population Model (GAM)

Four families of curves, fit separately, all from the same pooled 24-season dataset (DMS 9 + Gaywood 15).

### 3.1 Positional curves — `E_pts_per_game(P_r)` and `SD_pts_per_game(P_r)`, per position

Fit one GAM per position (QB, RB, WR, TE — four models total). Each models **points per game**, not raw season totals, as a smooth function of `positional_draft_rank (P_r)` — every historical player-season contributes `season_total_points / that season's total_season_weeks-minus-bye` as its training response, not the raw season total.

**Why per-game, not per-season:** the training pool spans seasons with different numbers of regular-season fantasy weeks (DMS and Gaywood need not share the same season length in every year, and future leagues added to the pool may differ further). Fitting on raw season totals implicitly blends different-length seasons into one curve, systematically biasing any season whose length differs from the pool's typical length — a 13-matchup-week season would grade every draft in it as worse than a 14-week season purely because there were fewer weeks to accumulate points, not because the drafting or the players were worse. Fitting the *rate* and rescaling to each pick's own season length at scoring time removes that confound entirely.

- `E_pts_per_game(P_r)` — mean smooth term (thin-plate or cubic spline basis)
- `SD_pts_per_game(P_r)` — heteroskedastic variance smooth term, fit alongside the mean. Trained as the **cross-player** spread of season-average rates (i.e., the residual SD of `A_pts/G` around the GAM mean across all player-seasons at rank `P_r`) — **not** within-player weekly noise. This quantity captures outcome heterogeneity driven by role and opportunity differences between different players landing at the same draft slot, which is the dominant source of variance in fantasy drafting.

These are converted to season-scale values at scoring time (Sections 4.3, 4.4) using `Effective_games`.

**Scaling note — why linear, not square-root:** `SD_pts_per_game(P_r)` is a cross-player rate SD. Season totals for players at the same draft slot vary because different players occupy different roles — a breakout workhorse vs. a backup — and that role difference multiplies across every game of the season. Under this model, `Var(A_pts) ≈ Var(rate) × Effective_games²`, so `SD(A_pts) = SD_pts_per_game × Effective_games` (linear). Square-root scaling is appropriate only when accumulating G i.i.d. draws from a fixed per-game distribution, which is the within-player noise model — not the cross-player talent model. Mixing linear scaling for the mean (`E_adj = E_pts_per_game × Effective_games`) with square-root scaling for the SD would silently shrink the effective Z-score denominator by a factor of `√Effective_games`, systematically over-stating how surprising any seasonal outcome is.

If DMS and Gaywood have different team counts, express `P_r` on a common percentile-within-position basis before pooling the two leagues' rows into one fit (see the normalization note in Section 2 — this is size-only normalization, not positional-mix normalization).

Fit only over the range of `P_r` actually observed in the data for each position — do not extrapolate the curve materially beyond the deepest positional rank seen in the pool (e.g., if the deepest QB ever drafted was QB22, don't trust or display predictions past that point without an explicit "outside training range" flag).

### 3.2 Overall-slot VORP curves — `V_expected_per_game(P_overall)` and `SD_VORP_per_game(P_overall)`

Same per-game-rate reasoning as 3.1, applied to VORP. A second pair of GAM curves, as a function of `overall_pick_number (P_overall)`, pooled **across all positions together** (not fit per-position) — this is what captures positional scarcity cost. For every drafted skill-position player-season in the pool, compute `VORP_actual / that season's total_season_weeks-minus-bye` (VORP_actual per Section 4.6) and fit:

- `V_expected_per_game(P_overall)` — expected VORP rate for *any* position taken at that overall pick number
- `SD_VORP_per_game(P_overall)` — spread of that rate, trained as the **cross-player** residual SD of VORP rates (same population reasoning as Section 3.1)

At scoring time (Section 4.6), convert using this pick's own season's full game count `G` (not `Effective_games` — VORP reflects total value actually contributed, which is legitimately reduced by a player's own missed games, unlike the Z-score in 4.4, which is deliberately insulated from that):
```
V_expected(P_overall) = V_expected_per_game(P_overall) × G
SD_VORP(P_overall) = SD_VORP_per_game(P_overall) × G
```

**Linear scaling for the same reason as 3.1:** `SD_VORP_per_game` is a cross-player rate SD, so the season-total SD scales linearly with `G`, not as `√G`. Using `√G` here would silently understate the VORP spread by a factor of `√G`, over-rewarding good outcomes and over-penalizing bad ones in the VORP component.

Same recency weighting (3.5) and same rule against positional-mix normalization applies here too — if a season had QBs going unusually early, the resulting VORP outcomes at those overall picks are real training signal.

### 3.3 Concentration-ratio baseline — `T_bust(position, games_played_tier)`

For every player-season in the pool with at least 4 played games, compute:
```
n_top = ceil(0.25 × games_played), minimum 1
C = points(top n_top games, by weekly score) / A_pts
```

Bin by `(position, games_played_tier)` — **wide tiers, not exact integer game counts** (e.g., 4-8 / 9-13 / 14-17 games played). With only 24 pooled draft-seasons across four positions, exact-integer bins leave too few historical comparables in many bins, producing coarse, clustered thresholds rather than a meaningful cutoff. Wider tiers trade a little precision for a population large enough to be worth ranking against. Within each bin:

```
T_bust(position, tier) = the [sensitivity]-th percentile of C within that bin
```

Default sensitivity: 85th percentile, founder-tunable (Section 8).

### 3.4 Floor-PPG population — `floor_ppg` distribution by position

For every player-season in the pool with at least 4 played games, compute the same split Section 4.7 will use at scoring time:
```
floor_games = the games NOT in the top n_top (from 3.3)
floor_ppg = mean(points, floor_games)
```

Pool by position — games-played conditioning isn't needed here the way it is for `T_bust`, since `floor_ppg` is already a per-game rate rather than a total, and is naturally comparable across different games-played counts. Store the distribution (sorted values or percentile breakpoints) needed to compute an empirical percentile rank for a new player's `floor_ppg` at scoring time (Section 4.7).

### 3.5 Recency-decay weighting

Every row in the pool gets a training weight based on how many years old that season is:

```
weight(season) = ρ ^ (current_year − season_year)
```

`ρ` is a decay rate between 0 and 1, applied identically to all four curve families in 3.1, 3.2, 3.3, and 3.4. Starting default: `ρ = 0.87`. Do not hand-tune this by feel — calibrate it (Section 9.1).

### 3.6 Refit cadence

Refit all curve families once per year, immediately following the conclusion of each NFL regular season, incorporating the newly-completed season into the pool and rolling the recency weights forward by one year. This is a batch/offline process, distinct from the live founder panel in Section 8.

---

## 4. Scoring a Single Pick (step by step)

Run this pipeline for every `PlayerSeasonPick` row, once its season has concluded.

### 4.1 Games played / missed / bye — exact definitions

From `WeeklyGameLog`, using this league-season's own `total_season_weeks` (Section 1.2):

```
G = total_season_weeks − 1   (subtract exactly one week for the player's own bye)
games_missed = count of weeks with status = "missed"
games_played = count of weeks with status = "played"
```

**Do not count the bye week as a missed game.** A bye is not unavailability — every player has one, healthy or not, and counting it as a "miss" would incorrectly ding every single player's proration by one game regardless of health. Only `status = "missed"` (inactive, injured, healthy scratch, etc.) counts toward `games_missed`. A week where the player was active and recorded 0 points is `status = "played"`, not missed.

### 4.2 Actual points — `A_pts`

Take every week with `status = "played"` for this player and sum the points, uncapped:

```
A_pts = Σ [ week_points ]   over all played weeks
```

No Winsorization or other capping is applied. Big weeks are handled downstream by the consistency classification (4.7) and its multiplier (4.8), which distinguish a reliable floor with legitimate upside from a season propped up by outlier weeks — a distinction a blind point cap can't make.

### 4.3 Effective games and games-missed-adjusted expected points — `E_adj`

```
If games_missed < 4:  Effective_games = G
If games_missed ≥ 4:  Effective_games = G − games_missed

E_adj = E_pts_per_game(P_r) × Effective_games
```

`E_pts_per_game(P_r)` comes from the fitted curve for this player's position (Section 3.1), evaluated at this pick's `positional_draft_rank`. `Effective_games` is also used for the SD scaling in 4.4, and nowhere else in this pipeline — replacement-level calculations (4.6) always use the season's full `G`, since replacement level is a fixed positional baseline unrelated to any individual pick's own missed games.

### 4.4 Residual and standardized Z

```
Residual = A_pts − E_adj
SD_pts(P_r) = SD_pts_per_game(P_r) × Effective_games     (Section 3.1, same Effective_games as 4.3)
Z = Residual / SD_pts(P_r)
```

Scaling the SD by the same `Effective_games` used for `E_adj`, rather than always by the full season, matters: `Residual` is already a difference of two `Effective_games`-scaled quantities, so the variance used to standardize it needs to be on that same scale, not the full season's.

**Linear, not square-root:** `SD_pts_per_game` is a cross-player rate SD (see Section 3.1). Season-total spread scales linearly with games under the cross-player model, exactly as the mean does. Using `√Effective_games` would silently shrink the denominator — making every outcome look more surprising than it actually is relative to the historical population at that draft slot.

### 4.5 Asymmetry layer

```
Adjusted = Z                if Z ≥ 0
Adjusted = Z × λ             if Z < 0     (default λ = 0.70, founder-tunable)
```

### 4.6 Replacement level and VORP

Replacement rank for this player's position, computed from that season's `LeagueSeasonSettings`:

**If `tracks_starting_lineups` is true for this season:**
```
flex_share_at_position = empirically observed fraction of flex-spot starts historically occupied by that position, derived from `WeeklyStartingLineup`
replacement_rank = (num_teams × starters_at_position) + (num_teams × starters_flex × flex_share_at_position)
```

**If `tracks_starting_lineups` is false:** do not estimate or assume a flex share — exclude flex spots from the replacement-level calculation entirely for that position:
```
replacement_rank = num_teams × starters_at_position
```
This is a known, accepted simplification, not an error: since flex spots do get filled by RB/WR/TE in practice, excluding them means `replacement_rank` counts fewer startable slots than actually exist, which sets the replacement-level points bar a bit high and modestly deflates VORP for flex-eligible positions. That's the honest tradeoff of not tracking lineup data — it should not be papered over with an assumed constant.

```
replacement_level_points = E_pts_per_game(replacement_rank) × G     — full season G, not Effective_games
VORP_actual = A_pts − replacement_level_points
```

Then standardize against the overall-slot curve (Section 3.2), converted to this season's `G`:

```
V_expected(P_overall) = V_expected_per_game(P_overall) × G
SD_VORP(P_overall) = SD_VORP_per_game(P_overall) × √G
VORP_z = (VORP_actual − V_expected(P_overall)) / SD_VORP(P_overall)
```

### 4.7 Consistency classification (two-stage)

**Stage 1 — concentration gate.** If `games_played < 4`, `provisional_flag = none` (absolute floor — too small a sample for this to mean anything). Otherwise:

```
n_top = ceil(0.25 × games_played), minimum 1
C = points(top n_top games, by weekly score) / A_pts
gate = C > T_bust(position, games_played_tier)     (Section 3.3, default sensitivity 85th percentile, founder-tunable)
provisional_flag = inconsistent if gate, else none
```

If `A_pts = 0` despite `games_played ≥ 4`, `provisional_flag = none` — see Section 10.

**Stage 2 — reliable-starter check.** Only evaluated if `provisional_flag = inconsistent`:

```
floor_games = the games_played games NOT in the top n_top
floor_ppg = mean(points, floor_games)
floor_ppg_percentile = this player's empirical percentile rank for floor_ppg against the position's floor_ppg population (Section 3.4)

If floor_ppg_percentile ≥ reliable_starter_threshold:  final_label = consistent_with_booms
Else:                                                     final_label = inconsistent_producer
```

If `provisional_flag = none`: `final_label = none`.

`reliable_starter_threshold` is founder-tunable with live feedback and an auto-calibration routine — see Section 8 and Section 9.2.

### 4.8 Score multiplier

Two modes, founder-selectable (Section 8). Applies only when `Adjusted > 0` (Section 4.5) — same reasoning as always: dampening or boosting an already-negative pick based on its consistency pattern would either double-penalize a bust that's already scored correctly, or let reliability paper over a real shortfall relative to draft slot.

**Dynamic mode (default)** — the size of the adjustment scales with how large the boom weeks actually were, not a flat amount regardless of magnitude:

```
boom_magnitude = points(top n_top games) − n_top × floor_ppg     — how far the top games exceeded what the floor rate would predict for that many games
boom_share = boom_magnitude / A_pts

If final_label = inconsistent_producer:  multiplier = 1 − clip(boom_share × penalty_intensity, 0, penalty_cap)
If final_label = consistent_with_booms:   multiplier = 1 + clip(boom_share × reward_intensity, 0, reward_cap)
If final_label = none:                     multiplier = 1.00
```

Defaults: `penalty_intensity = 2.0`, `penalty_cap = 0.50`, `reward_intensity = 2.5`, `reward_cap = 0.60` — all four founder-tunable (Section 8).

**Flat mode** — a fixed adjustment regardless of magnitude, for a simpler, more predictable alternative:

```
If final_label = inconsistent_producer:  multiplier = μ_penalty     (default 0.70)
If final_label = consistent_with_booms:   multiplier = μ_reward      (default 1.20)
If final_label = none:                     multiplier = 1.00
```

Either mode:
```
Adjusted_final = Adjusted × multiplier
```

### 4.9 Blend into `LDI_raw`

```
LDI_raw = α × Adjusted_final + (1 − α) × VORP_z        (default α = 0.85, founder-tunable)
```

This is the pick's final score — there is no further blend stage.

### 4.10 Pick-level display score

```
pick_display_score = Φ(LDI_raw) × 100     — Φ = standard normal CDF
```

Round to the nearest integer for display. A letter grade may be derived from the same distribution if the site wants one (e.g., A+ above 97, F below 10) but is not required.

---

## 5. Manager-Level Rollup

**Equal weight per pick, confirmed.** Every scored pick counts the same toward a manager's season draft grade, regardless of round:

```
LDI_manager_season = mean(LDI_raw_i)   over all of that manager's scored (non-K/DST) picks that season
```

Do not weight by VORP magnitude, round, or overall pick number — every pick contributes equally to the average.

---

## 6. Display Scaling

### 6.1 Pick-level
As in 4.10 — `Φ(LDI_raw) × 100`, or letter grade off the same distribution.

### 6.2 Manager-level (1-100 scale)

Use **empirical percentile rank against the full pooled population of manager-drafts** — every manager-season across every league on the site, not a normal-CDF formula. This is nonparametric (no assumption that aggregate scores are normally distributed) and directly interpretable.

```
percentile = (rank of this LDI_manager_season within the full pooled manager-draft population) / N × 100
```

Clip the displayed value to the range [1, 99] (never show a literal 0 or 100), round to the nearest integer, and re-rank on a batch cadence (e.g., nightly) rather than live per page load. This also resolves the "new league" case automatically: a brand-new league's manager is ranked against the full existing site-wide pool immediately, with no separate bootstrapping needed for that specific league.

---

## 7. UI: Pick Pills

### 7.1 Existing pills
- **Traded/dropped** — informational only, no relationship to LDI scoring. LDI always grades the originally drafted player's own season output, regardless of any later roster move. No calculation dependency.
- **Games missed** — should read from the same `games_missed` field defined in Section 4.1, so the pill and the score are never based on inconsistent counts.

### 7.2 Consistent with Booms / Inconsistent Producer pills

Driven directly by `final_label` from Section 4.7, as do not recompute `C`, `T_bust`, or `floor_ppg_percentile` separately for the UI. Show the matching pill if `final_label ≠ none`; show neither otherwise. Both pills are read off the same two-stage classification, so a pick can't satisfy contradictory conditions.

**Tooltip copy (template, plain language, no statistical terms):**

Inconsistent Producer:
> "Boom-or-bust: about [C×100, rounded]% of [player_name]'s points came from his [n_top] best games, and the rest of his season wasn't reliable starter production."

Consistent with Booms:
> "Consistent with booms: [player_name] was a reliable starter outside of his [n_top] standout games."

Neither pill adjusts anything further beyond what Section 4.8 already applied, as do not add or subtract from `LDI_raw` again at the display layer.

---

## 8. Founder Tuning Panel (live, scoring-time)

Exposed as sliders in an admin UI. Changing any of these should be reflected immediately in newly computed scores.

| Parameter | Symbol | Default | Range | Step |
|---|---|---|---|---|
| Miss multiplier | λ | 0.70 | 0.00 – 1.00 | 0.05 |
| VORP blend weight | α | 0.85 | 0.50 – 1.00 | 0.05 |
| Concentration gate sensitivity | sensitivity | 0.85 | 0.70 – 0.95 | 0.05 |
| Reliable-starter threshold | reliable_starter_threshold | auto-calibrated (≈10 fallback) | 5 – 95 | 5 |
| Multiplier mode | mode | dynamic | dynamic / flat | N/A |

**Dynamic-mode parameters** (shown when `mode = dynamic`):

| Parameter | Symbol | Default | Range | Step |
|---|---|---|---|---|
| Penalty intensity | penalty_intensity | 2.0 | 0.5 – 4.0 | 0.5 |
| Penalty cap | penalty_cap | 0.50 | 0.20 – 0.90 | 0.05 |
| Reward intensity | reward_intensity | 2.5 | 0.5 – 4.0 | 0.5 |
| Reward cap | reward_cap | 0.60 | 0.20 – 0.90 | 0.05 |

**Flat-mode parameters** (shown when `mode = flat`):

| Parameter | Symbol | Default | Range | Step |
|---|---|---|---|---|
| Inconsistent-hit multiplier | μ_penalty | 0.70 | 0.00 – 1.00 | 0.05 |
| Consistent-with-booms multiplier | μ_reward | 1.20 | 1.00 – 1.50 | 0.05 |

Games-missed threshold (currently 4) and the minimum-games floor for the concentration gate (currently 4, Section 4.7) are separate integer steppers (range 1-8, step 1) — not part of either panel above.

**`reliable_starter_threshold` needs a live preview, not just a static default.** As the founder drags this slider, show — recomputed live, not on a delay — what fraction of currently stage-1-flagged players would reclassify to `consistent_with_booms` at the current slider position. That live number is what lets the founder converge on their own target (e.g., "roughly half") by feel, the same way the auto-calibration in Section 9.2 does it programmatically as a default starting point.

**Recompute behavior (required):** stamp every computed `LDI_raw` and every derived display score with the parameter set (version or timestamp) used to produce it, and cache accordingly. Changing any slider — including `mode` itself — must trigger a recompute across *all* stored picks and manager-season rollups, not just newly scored ones going forward. Provide a "preview on a sample draft" mode before applying a slider change site-wide, given how much any of these can move already-published grades.

**Where to actually look when tuning these:** a slider's effect on the site's headline manager-level 1-100 score will often look small even when the underlying per-pick math moved a lot. Two reasons, both expected, not bugs: (1) the manager score is an *average* across roughly 15-16 picks, so any one slider's effect gets diluted across picks it doesn't touch; (2) the manager display score (Section 6.2) is an *empirical percentile rank* against every other manager-draft, not a direct transform of the raw number — since a global slider change shifts every manager's picks in a correlated way, relative rank often moves less than the raw score does. When calibrating, watch the individual `pick_display_score` (Section 4.10) on a handful of known picks, not the manager-level rollup — that's where each slider's effect is direct and undiluted. The "preview on a sample draft" mode above should surface pick-level scores for exactly this reason.

---

## 9. Model Training Configuration (admin-only, batch — distinct from Section 8)

These parameters govern the population-curve fitting process (Section 3), not live scoring. They require a full refit to take effect, not an instant recompute, and should live in a separate admin area from the founder panel.

### 9.1 Calibrating `ρ` (recency decay)

**Use rolling-origin (time-respecting) cross-validation — never ordinary random k-fold CV.** Shuffling seasons into folds would let the model "see the future" when predicting the past, which defeats the purpose of a recency weight entirely.

Procedure:
1. Order all 24 pooled seasons chronologically.
2. For each candidate `ρ` in {0.75, 0.85, 0.90, 0.95, 1.00}: fit the curves in Section 3 using seasons 1 through k, then evaluate prediction error against season k+1's actual outcomes. Roll k forward one season at a time and repeat.
3. Average prediction error (e.g., RMSE between predicted and actual points-per-game) across all folds, for each candidate `ρ`.
4. Select the `ρ` with the lowest average out-of-sample error.

Starting default before calibration completes: `ρ = 0.87`.

### 9.2 Calibrating `reliable_starter_threshold`

This one doesn't need cross-validation — it's a descriptive calibration against the training pool itself, not a predictive one:

1. Identify every training-pool player-season that clears Section 3.3's gate (`C > T_bust`) — the pool of "provisionally inconsistent" seasons.
2. For a candidate threshold, compute what fraction of that pool would reclassify to `consistent_with_booms` (i.e., has `floor_ppg_percentile ≥` the candidate).
3. Raising the threshold strictly decreases that fraction (a monotonic relationship) — solve via binary search for the threshold landing as close to 50% as possible.
4. This becomes the default shown on the founder panel slider (Section 8) at the next refit. The founder can override it manually at any time, with the live reclassification-percentage preview described in Section 8 for hands-on tuning.

### 9.3 Refit cadence

Annually, immediately following the conclusion of each NFL regular season. At each refit, re-run both 9.1 and 9.2 if enough new data has accumulated to justify re-checking them; otherwise reuse the last-calibrated values.

---

## 10. Edge Cases & Validation Rules

- **Player never plays a single game (season-ending injury before Week 1, practice squad all year, etc.):** `games_missed = G`, `Effective_games = 0`, `E_adj = 0`, `A_pts = 0` → `Residual = 0`, and `Z` is undefined (0/0) — treat as `Z = 0` explicitly rather than computing it. `games_played = 0` also falls below the consistency classification's minimum-sample gate (Section 4.7), so no pill shows either. Correctly produces no penalty for the lost season.
- **Player played every counted week but scored zero points every time:** `A_pts = 0` despite `games_played ≥ 4` — `provisional_flag = none` (Section 4.7); `C`'s denominator would otherwise be a division by zero.
- **K/DST pick numbering:** never exclude K/DST picks from `overall_pick_number` counting. They're excluded from the scored player pool, not from the draft's pick sequence.
- **Extrapolation beyond observed data:** if a live pick's `positional_draft_rank` or `overall_pick_number` falls outside the range covered by the training pool, flag it as low-confidence in the UI rather than silently extrapolating any curve.
- **Thin-sample bins:** rely on the smoothing/pooling in each curve family (Section 3) to avoid degenerate estimates at sparsely-populated bins — this applies to `SD_pts_per_game`, `SD_VORP_per_game`, `T_bust`, and the `floor_ppg` distribution alike. The wide `games_played` tiers in 3.3 exist specifically to keep `T_bust` estimates from this problem.
- **`reliable_starter_threshold` auto-calibration on a thin flagged pool:** if very few player-seasons ever clear the Section 3.3 gate in a given refit, the 50%-target calibration in 9.2 is estimated from a small sample and may be unstable year to year. Consider a minimum-pool-size floor before trusting a fresh auto-calibrated value over the previous one.
- **Mid-season scoring-rule questions:** if a season's scoring rules are themselves in question or incompletely recorded, exclude that season from the training pool rather than guessing at its ruleset (better to have less clean data than silently mixed units).
- **Manager with very few picks in a season** (e.g., due to a bye-week draft slot quirk or a partial-season league): the equal-weight average in Section 5 still applies as-is; no special handling required, but consider a minimum pick-count note in the UI if a manager-season has an unusually small pool size.
- **Extreme data-entry outliers:** since `A_pts` is never capped (Section 4.2), a single wildly erroneous weekly score — a data-entry error, not a real big game — could distort `A_pts`, the classification, `boom_share`, and, if that season is later folded into a refit, the training curves themselves. This is a data-integrity concern, not a statistical one: flag any weekly score more than some multiple of that position's historical max for manual review before it enters scoring or training. Do not silently cap or auto-correct a flagged value — surface it. Note that the dynamic-mode multiplier (4.8) already scales continuously with `boom_share`, so a single legitimately extreme (but real) week is handled proportionally rather than needing a separate capping mechanism the way earlier versions of this system did — this concern is specifically about corrupted *data*, not about extreme but real performances.

---

## 11. Worked Example (illustrative numbers only, not fitted from real data)

RB drafted as the 5th RB off the board (`P_r = 5`), overall pick 52 — a reliable back with one standout game (the kind of profile a Jahmyr-Gibbs-style back would show).

```
E_pts_per_game(5) = 15.0,  SD_pts_per_game(5) = 6.0     (from the fitted RB curve)
games_missed = 6  →  Effective_games = G − 6 = 10  (G = 16)
E_adj = 15.0 × 10 = 150

Weekly points (10 played games): 13, 14, 15, 13, 14, 13, 14, 13, 55, 11   →   A_pts = 175
Residual = 175 − 150 = 25
SD_pts(P_r) = 6.0 × 10 = 60.0
Z = 25 / 60.0 ≈ 0.42
Adjusted = 0.42   (Z ≥ 0, no dampening)

n_top = ceil(0.25 × 10) = 3
Top 3 games: 55, 15, 14  →  sum = 84   →   C = 84 / 175 = 0.48
T_bust(RB, tier 9–13) = 0.42   (illustrative)   →   0.48 > 0.42, gate triggers, provisional_flag = inconsistent

floor_games (remaining 7): 15, 14, 14, 14, 13, 13, 11   →   floor_ppg = 94 / 7 ≈ 13.4
   (note: one of the two "15"s is in the top 3, the other sits in floor_games)
floor_ppg_percentile = 78   (illustrative)
reliable_starter_threshold = 65   (current slider position)
78 ≥ 65   →   final_label = consistent_with_booms

boom_magnitude = 84 − (3 × 13.4) = 84 − 40.2 = 43.8
boom_share = 43.8 / 175 ≈ 0.250

Dynamic mode: reward_intensity = 2.5, reward_cap = 0.60
raw_boost = 0.250 × 2.5 = 0.625   →   clipped to reward_cap: 0.60
multiplier = 1 + 0.60 = 1.60
Adjusted_final = 0.42 × 1.60 = 0.67

replacement_level_points = 8.5 × 16 = 136
VORP_actual = 175 − 136 = 39
V_expected(52) = 2.0 × 16 = 32,  SD_VORP(52) = 1.5 × 16 = 24.0
VORP_z = (39 − 32) / 24.0 ≈ 0.29

LDI_raw = 0.85 × 0.67 + 0.15 × 0.29 = 0.5695 + 0.0435 ≈ 0.61
pick_display_score = Φ(0.61) × 100 ≈ 73
```

Two things worth noting about this result. First, the reward cap actually bound here (`raw_boost` of 0.625 exceeded `reward_cap` of 0.60) — worth seeing in a worked example, since it shows the cap doing its job of bounding how far a single extreme boom_share can push the multiplier, rather than letting one input dominate without limit. Second, this is the specific case the whole redesign needed to get right: one standout week (55, about 4x his typical week) sits on top of an otherwise tight floor (11-15 every other game). Stage 1 correctly flags the concentration as unusual (`C = 0.48` clears the bar), but stage 2 checks what the *rest* of the season looked like — a floor of 13.4 PPG lands at the 78th percentile among RBs, comfortably clearing the reliable-starter bar — so the classification correctly resolves to Consistent with Booms rather than Inconsistent Producer, and the dynamic multiplier rewards the outcome rather than discounting it.

---

## 12. Full Pipeline Reference

```
TRAINING (batch, annual):
1. Pool DMS (first 9 complete seasons) + Gaywood (most recent 15 complete seasons). No external data.
2. Apply recency weight: weight(season) = ρ ^ (current_year − season_year), ρ calibrated via rolling-origin CV.
3. Fit E_pts_per_game(P_r), SD_pts_per_game(P_r) per position (QB/RB/WR/TE), from percentile-normalized positional rank, on points-per-game (not season totals).
4. Fit V_expected_per_game(P_overall), SD_VORP_per_game(P_overall) pooled across positions, by true overall pick number, on VORP-per-game.
5. Fit T_bust(position, games_played_tier) — concentration-ratio baseline, binned by wide games-played tiers.
6. Fit the floor_ppg population distribution per position.
7. Calibrate reliable_starter_threshold to a ~50% reclassification target among stage-1-flagged player-seasons (Section 9.2).
   → No positional-mix normalization applied at any point in training.

SCORING (per pick, once season concludes):
1. G = total_season_weeks − 1 (exclude bye); games_missed, games_played from WeeklyGameLog
2. A_pts = sum of raw weekly points (played weeks only, uncapped)
3. Effective_games = G if games_missed<4, else G−games_missed;  E_adj = E_pts_per_game(P_r) × Effective_games
4. Residual = A_pts − E_adj;  SD_pts(P_r) = SD_pts_per_game(P_r) × Effective_games;  Z = Residual / SD_pts(P_r)
5. Adjusted = Z if Z≥0, else Z×λ
6. replacement_level_points = E_pts_per_game(replacement_rank) × G;  VORP_actual = A_pts − replacement_level_points;  V_expected/SD_VORP converted using G;  VORP_z computed
7. Stage 1: C, T_bust(position, tier) → provisional_flag.  Stage 2 (if flagged): floor_ppg, floor_ppg_percentile vs. reliable_starter_threshold → final_label
8. multiplier from Section 4.8 (dynamic or flat mode, per final_label and Adjusted's sign);  Adjusted_final = Adjusted × multiplier
9. LDI_raw = α×Adjusted_final + (1−α)×VORP_z
10. pick_display_score = Φ(LDI_raw) × 100
11. Display pills: Consistent with Booms / Inconsistent Producer per final_label (Section 7)

ROLLUP (per manager, per season):
12. LDI_manager_season = mean(LDI_raw) over all that manager's scored picks — equal weight
13. manager_display_score (1-100) = empirical percentile rank of LDI_manager_season vs. pooled manager-draft population, clipped to [1,99]
```

---

## 13. Glossary

| Symbol | Meaning |
|---|---|
| `P_r` | positional draft rank (e.g., 5th RB taken = 5) |
| `P_overall` | true overall draft pick number |
| `G` | possible games in a season, excluding the player's bye |
| `Effective_games` | the game count used to scale `E_adj` and `SD_pts` — the full season `G` if games_missed<4, otherwise `G − games_missed` |
| `E_pts_per_game(P_r)` / `SD_pts_per_game(P_r)` | expected points per game and its **cross-player** spread at positional rank P_r — fit as rates on `A_pts/G` across all player-seasons at that rank, scaled to a season by multiplying by `Effective_games` (linear, not sqrt) |
| `A_pts` | actual season points, raw (uncapped) |
| `E_adj` | expected points, scaled to `Effective_games` |
| `Z` | standardized residual |
| `Adjusted` | `Z`, dampened by `λ` if negative |
| `λ` | multiplier applied when `Z < 0` (a miss) |
| `V_expected_per_game(P_overall)` / `SD_VORP_per_game(P_overall)` | expected VORP rate and its **cross-player** spread at a given overall pick — scaled to a season by multiplying by `G` (linear, not sqrt) |
| `replacement_level_points` | full-season expected points at the position's replacement rank |
| `VORP_actual` / `VORP_z` | value over replacement, raw and standardized |
| `α` | blend weight between positional performance and VORP |
| `ρ` | recency-decay rate used in training |
| `n_top` | number of "top" games counted toward `C` (ceil(0.25 × games_played)) |
| `C` | concentration ratio — share of a player's season points from their top `n_top` games |
| `T_bust(position, tier)` | games-played-tier-conditional concentration threshold gating Stage 1 |
| `provisional_flag` | Stage 1 output: `inconsistent` or `none` |
| `floor_games` / `floor_ppg` | the non-top games, and the player's average points per game across them |
| `floor_ppg_percentile` | this player's percentile rank for `floor_ppg` against the position's population (Section 3.4) |
| `reliable_starter_threshold` | the Stage 2 cutoff on `floor_ppg_percentile`, founder-tunable with live-feedback calibration |
| `final_label` | the resolved classification: `inconsistent_producer`, `consistent_with_booms`, or `none` |
| `boom_magnitude` / `boom_share` | how far the top games exceeded what the floor rate predicted, in points and as a fraction of `A_pts` |
| `penalty_intensity` / `reward_intensity` / `penalty_cap` / `reward_cap` | dynamic-mode multiplier parameters |
| `μ_penalty` / `μ_reward` | flat-mode multiplier constants |
| `mode` | `dynamic` or `flat` — which multiplier calculation is active |
| `Adjusted_final` | `Adjusted × multiplier` — feeds `LDI_raw` |
| `LDI_raw` | the pick's final score — feeds pick display (4.10) and the manager rollup (Section 5) |
| `Φ` | standard normal cumulative distribution function |
