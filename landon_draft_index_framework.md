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

Four record types are needed. K and DST are never scored by LDI and should be excluded from the `PlayerSeasonPick` table entirely — but see the note in 1.1 about pick numbering.

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
| total_season_weeks | integer | typically 17 |

### 1.3 `WeeklyGameLog` — one row per player per week per season

| Field | Type | Notes |
|---|---|---|
| league_id, season_year, player_id, week_number | — | composite key |
| status | enum: `played`, `bye`, `missed` | see 4.1 for exact definitions — this distinction is required, do not collapse it into a single points field with nulls |
| points | float | present only when status = `played`; omit or null otherwise |

### 1.4 `ManagerDraft` (derived)

Grouping of a manager's `PlayerSeasonPick` rows for one league-season draft — used for the rollup in Section 5. Can be computed on the fly (group by manager_id + league_id + season_year) rather than stored.

---

## 2. Training Data Sourcing

**Two leagues, pooled together into one training set. No external ADP or market data of any kind.**

- **DMS league:** use the first 9 complete seasons. Exclude DMS's most recent draft — its season results aren't final yet, so there's no actual value (AV) to train against. Once that season concludes, include it in the next scheduled refit (Section 9.2).
- **Gaywood league:** use the most recent 15 complete seasons.

General rule going forward: **only fully-concluded seasons enter the training pool.** A league's current, in-progress draft is always excluded from training, but is still scored live by the model already fit from prior seasons — that's the entire point of the population-model architecture (Section 3).

**Do not apply any positional-mix normalization or detrending across seasons.** If in some season(s) QBs were drafted unusually early (a "QB run" year), leave that data exactly as it is when pooling. The percentile-within-position normalization referenced in Section 3.1 exists *only* to reconcile league-size differences (e.g., aligning a 10-team league's "RB1" pick with a 12-team league's "RB1" pick) — it must never be used to adjust, smooth, or dampen genuine season-to-season shifts in which positions get drafted early. That variation is real signal the GAM is meant to learn, not noise to correct for.

**Scoring-format consistency check, required before fitting:** if either league changed scoring rules at any point in its history (standard → PPR, flex eligibility changes, etc.), re-derive every historical week's points under that league's *current* scoring rules before pooling. Do not mix seasons computed under different scoring rules — this would corrupt the point totals independently of, and before, anything else in this pipeline runs.

---

## 3. Fitting the Population Model (GAM)

Two families of curves, fit separately, both from the same pooled 24-season dataset (DMS 9 + Gaywood 15).

### 3.1 Positional curves — `E_pts(P_r)` and `SD_pts(P_r)`, per position

Fit one GAM per position (QB, RB, WR, TE — four models total). Each models season points as a smooth function of `positional_draft_rank (P_r)`:

- `E_pts(P_r)` — mean smooth term (thin-plate or cubic spline basis) predicting expected season points at positional rank `P_r`
- `SD_pts(P_r)` — a second smooth term modeling the standard deviation of outcomes at that same rank (heteroskedastic variance component, fit alongside the mean, not as a separate afterthought)

If DMS and Gaywood have different team counts, express `P_r` on a common percentile-within-position basis before pooling the two leagues' rows into one fit (see the normalization note in Section 2 — this is size-only normalization, not positional-mix normalization).

Fit only over the range of `P_r` actually observed in the data for each position — do not extrapolate the curve materially beyond the deepest positional rank seen in the pool (e.g., if the deepest QB ever drafted was QB22, don't trust or display predictions past that point without an explicit "outside training range" flag).

### 3.2 Overall-slot VORP curves — `V_expected(P_overall)` and `SD_VORP(P_overall)`

A second pair of GAM curves, this time as a function of `overall_pick_number (P_overall)`, pooled **across all positions together** (not fit per-position) — this is what captures positional scarcity cost. For every drafted skill-position player in the pool, compute their season's VORP (Section 4.6) and fit:

- `V_expected(P_overall)` — expected VORP for *any* position taken at that overall pick number
- `SD_VORP(P_overall)` — spread of VORP outcomes at that overall pick number

Same recency weighting (3.3) and same rule against positional-mix normalization applies here too — if a season had QBs going unusually early, the resulting VORP outcomes at those overall picks are real training signal.

### 3.3 Recency-decay weighting

Every row in the pool gets a training weight based on how many years old that season is:

```
weight(season) = ρ ^ (current_year − season_year)
```

`ρ` is a decay rate between 0 and 1, applied identically to both curve families in 3.1 and 3.2. Starting default: `ρ = 0.87`. Do not hand-tune this by feel — calibrate it (Section 9.1).

### 3.4 Refit cadence

Refit both curve families once per year, immediately following the conclusion of each NFL regular season, incorporating the newly-completed season into the pool and rolling the recency weights forward by one year. This is a batch/offline process, distinct from the live founder panel in Section 8.

---

## 4. Scoring a Single Pick (step by step)

Run this pipeline for every `PlayerSeasonPick` row, once its season has concluded.

### 4.1 Games played / missed / bye — exact definitions

From `WeeklyGameLog`:

```
G = total_season_weeks − 1   (subtract exactly one week for the player's own bye)
games_missed = count of weeks with status = "missed"
```

**Do not count the bye week as a missed game.** A bye is not unavailability — every player has one, healthy or not, and counting it as a "miss" would incorrectly ding every single player's proration by one game regardless of health. Only `status = "missed"` (inactive, injured, healthy scratch, etc.) counts toward `games_missed`. A week where the player was active and recorded 0 points is `status = "played"`, not missed.

### 4.2 Winsorized actual points — `A_pts`

Take every week with `status = "played"` for this player. Cap each individual week's points at the position's Winsorization threshold (a percentile of that position's pooled weekly-scoring distribution — computed from the same training pool as Section 3, refreshed on the same refit cadence, default 90th percentile, founder-tunable per Section 8). Sum the capped weekly values:

```
A_pts = Σ [ min(week_points, winsor_cap_for_position) ]   over all played weeks
```

### 4.3 Games-missed-adjusted expected points — `E_adj`

```
If games_missed < 4:  E_adj = E_pts(P_r)
If games_missed ≥ 4:  E_adj = E_pts(P_r) × (G − games_missed) / G
```

`E_pts(P_r)` comes from the fitted curve for this player's position (Section 3.1), evaluated at this pick's `positional_draft_rank`.

### 4.4 Residual and standardized Z

```
Residual = A_pts − E_adj
Z = Residual / SD_pts(P_r)
```

`SD_pts(P_r)` comes from the same fitted curve (Section 3.1), same position, same rank.

### 4.5 Asymmetry layer

```
Adjusted = Z                if Z ≥ 0
Adjusted = Z × λ             if Z < 0     (default λ = 0.70, founder-tunable)
```

### 4.6 Replacement level and VORP

Replacement rank for this player's position, computed from that season's `LeagueSeasonSettings`:

**If the site tracks actual weekly starting lineups (which position filled the flex slot, week by week):**
```
flex_share_at_position = empirically observed fraction of flex-spot starts historically occupied by that position, derived from the training pool's tracked lineup data
replacement_rank = (num_teams × starters_at_position) + (num_teams × starters_flex × flex_share_at_position)
```

**If flex usage by position is not tracked:** do not estimate or assume a flex share — exclude flex spots from the replacement-level calculation entirely for that position:
```
replacement_rank = num_teams × starters_at_position
```
This is a known, accepted simplification, not an error: since flex spots do get filled by RB/WR/TE in practice, excluding them means `replacement_rank` counts fewer startable slots than actually exist, which sets the replacement-level points bar a bit high and modestly deflates VORP for flex-eligible positions. That's the honest tradeoff of not tracking lineup data — it should not be papered over with an assumed constant.

```
replacement_level_points = E_pts(replacement_rank)     — read directly off the Section 3.1 curve, fractional ranks allowed
VORP_actual = A_pts − replacement_level_points
```

Then standardize against the overall-slot curve (Section 3.2), evaluated at this pick's `overall_pick_number`:

```
VORP_z = (VORP_actual − V_expected(P_overall)) / SD_VORP(P_overall)
```

### 4.7 Blend into `LDI_raw`

```
LDI_raw = α × Adjusted + (1 − α) × VORP_z        (default α = 0.85, founder-tunable)
```

### 4.8 Pick-level display score

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
As in 4.8 — `Φ(LDI_raw) × 100`, or letter grade off the same distribution.

### 6.2 Manager-level (1-100 scale)

Use **empirical percentile rank against the full pooled population of manager-drafts** — every manager-season across every league on the site — not a normal-CDF formula. This is nonparametric (no assumption that aggregate scores are normally distributed) and directly interpretable.

```
percentile = (rank of this LDI_manager_season within the full pooled manager-draft population) / N × 100
```

Clip the displayed value to the range [1, 99] (never show a literal 0 or 100), round to the nearest integer, and re-rank on a batch cadence (e.g., nightly) rather than live per page load. This also resolves the "new league" case automatically: a brand-new league's manager is ranked against the full existing site-wide pool immediately, with no separate bootstrapping needed for that specific league.

---

## 7. UI: Pick Pills

### 7.1 Existing pills
- **Traded/dropped** — informational only, no relationship to LDI scoring. LDI always grades the originally drafted player's own season output, regardless of any later roster move. No calculation dependency.
- **Games missed** — should read from the same `games_missed` field defined in Section 4.1, so the pill and the score are never based on inconsistent counts.

### 7.2 New: Inconsistent Producer pill

**Concentration ratio:**
```
C = (points scored in the player's top 25% of played games) / (total season points, unwinsorized)
n_top = ceil(0.25 × games_played), minimum 1
```

**Minimum sample gate:** only evaluate this pill if `games_played ≥ 6`. Below that, the ratio is too noisy on so few games to mean anything, and the pill must not display regardless of the computed `C` value.

**Trigger:**
```
If games_played ≥ 6 AND C > T_bust:  show pill
(default T_bust = 0.50, founder-tunable)
```

**Tooltip copy (template, plain language, no statistical terms):**
> "Boom-or-bust: about [C×100, rounded]% of [player_name]'s fantasy points came from his [n_top] best games. Steadier weeks would've made this an even better pick."

This pill is purely diagnostic/informational. It does not add any additional scoring penalty — the same underlying signal is already reflected in the score via Winsorization (4.2). Do not subtract anything further from `LDI_raw` when this pill is shown, or the same signal gets penalized twice.

---

## 8. Founder Tuning Panel (live, scoring-time)

Exposed as sliders in an admin UI. Changing any of these should be reflected immediately in newly computed scores.

| Parameter | Symbol | Default | Range | Step |
|---|---|---|---|---|
| Miss dampening | λ | 0.70 | 0.00 – 1.00 | 0.05 |
| VORP blend weight | α | 0.85 | 0.50 – 1.00 | 0.05 |
| Winsorization cap (percentile) | — | 0.90 | 0.70 – 0.99 | 0.05 |
| Inconsistency threshold | T_bust | 0.50 | 0.30 – 0.70 | 0.05 |

Games-missed threshold (currently 4) is a separate integer stepper (range 1-8, step 1) — not part of this 0.05-increment panel.

**Recompute behavior (required):** stamp every computed `LDI_raw` and every derived display score with the parameter set (version or timestamp) used to produce it, and cache accordingly. Changing any slider must trigger a recompute across *all* stored picks and manager-season rollups, not just newly scored ones going forward — otherwise historical grades silently drift out of sync with current-parameter grades, and a manager's displayed score could change with no visible cause. Provide a "preview on a sample draft" mode before applying a slider change site-wide, given how much λ or α can move already-published grades.

---

## 9. Model Training Configuration (admin-only, batch — distinct from Section 8)

These parameters govern the population-curve fitting process (Section 3), not live scoring. They require a full refit to take effect, not an instant recompute, and should live in a separate admin area from the founder panel.

### 9.1 Calibrating `ρ` (recency decay)

**Use rolling-origin (time-respecting) cross-validation — never ordinary random k-fold CV.** Shuffling seasons into folds would let the model "see the future" when predicting the past, which defeats the purpose of a recency weight entirely.

Procedure:
1. Order all 24 pooled seasons chronologically.
2. For each candidate `ρ` in {0.75, 0.85, 0.90, 0.95, 1.00}: fit the curves in Section 3 using seasons 1 through k, then evaluate prediction error against season k+1's actual outcomes. Roll k forward one season at a time and repeat.
3. Average prediction error (e.g., RMSE between predicted and actual season points) across all folds, for each candidate `ρ`.
4. Select the `ρ` with the lowest average out-of-sample error.

Starting default before calibration completes: `ρ = 0.87`.

### 9.2 Refit cadence
Annually, immediately following the conclusion of each NFL regular season (Section 3.4). At each refit, re-run the `ρ` calibration in 9.1 if enough new data has accumulated to justify re-checking it; otherwise reuse the last-calibrated value.

---

## 10. Edge Cases & Validation Rules

- **Player never plays a single game (season-ending injury before Week 1, practice squad all year, etc.):** `games_missed = G`, `E_adj = 0`, `A_pts = 0` → `Residual ≈ 0`, `Z ≈ 0`. Correctly produces no penalty for the lost season, consistent with the games-missed philosophy.
- **K/DST pick numbering:** never exclude K/DST picks from `overall_pick_number` counting. They're excluded from the scored player pool, not from the draft's pick sequence.
- **Extrapolation beyond observed data:** if a live pick's `positional_draft_rank` or `overall_pick_number` falls outside the range covered by the training pool, flag it as low-confidence in the UI rather than silently extrapolating the GAM curve.
- **Thin-sample slots:** rely on the GAM's smoothing to avoid degenerate (near-zero) `SD_pts` or `SD_VORP` estimates at sparsely-drafted ranks; do not divide by a raw, unsmoothed sample SD computed from a handful of observations.
- **Mid-season scoring-rule questions:** if a season's scoring rules are themselves in question or incompletely recorded, exclude that season from the training pool rather than guessing at its ruleset (better to have less clean data than silently mixed units).
- **Manager with very few picks in a season** (e.g., due to a bye-week draft slot quirk or a partial-season league): the equal-weight average in Section 5 still applies as-is; no special handling required, but consider a minimum pick-count note in the UI if a manager-season has an unusually small pool size.

---

## 11. Worked Example (illustrative numbers only, not fitted from real data)

RB drafted as the 5th RB off the board (`P_r = 5`), overall pick 52.

```
E_pts(5) = 220,  SD_pts(5) = 45     (from the fitted RB curve)
games_missed = 6  →  E_adj = 220 × (16 − 6) / 16 = 137.5
A_pts (Winsorized) = 160
Residual = 160 − 137.5 = 22.5
Z = 22.5 / 45 = 0.50
Adjusted = 0.50   (Z ≥ 0, no dampening)

replacement_level_points = 130   (E_pts at that season's RB replacement rank)
VORP_actual = 160 − 130 = 30
V_expected(52) = 25,  SD_VORP(52) = 12
VORP_z = (30 − 25) / 12 = 0.417

LDI_raw = 0.85 × 0.50 + 0.15 × 0.417 = 0.425 + 0.0625 = 0.4875
pick_display_score = Φ(0.4875) × 100 ≈ 69
```

---

## 12. Full Pipeline Reference

```
TRAINING (batch, annual):
1. Pool DMS (first 9 complete seasons) + Gaywood (most recent 15 complete seasons). No external data.
2. Apply recency weight: weight(season) = ρ ^ (current_year − season_year), ρ calibrated via rolling-origin CV.
3. Fit E_pts(P_r), SD_pts(P_r) per position (QB/RB/WR/TE), from percentile-normalized positional rank.
4. Fit V_expected(P_overall), SD_VORP(P_overall) pooled across positions, by true overall pick number.
5. Fit position-specific weekly-score Winsorization cap thresholds from the same pool.
   → No positional-mix normalization applied at any point in training.

SCORING (per pick, once season concludes):
1. G = total_season_weeks − 1 (exclude bye)
2. A_pts = sum of Winsorized weekly points (played weeks only)
3. E_adj = E_pts(P_r), prorated by games_missed if ≥ 4
4. Residual = A_pts − E_adj;  Z = Residual / SD_pts(P_r)
5. Adjusted = Z if Z≥0, else Z×λ
6. VORP_actual = A_pts − replacement_level_points(position, season settings)
7. VORP_z = (VORP_actual − V_expected(P_overall)) / SD_VORP(P_overall)
8. LDI_raw = α×Adjusted + (1−α)×VORP_z
9. pick_display_score = Φ(LDI_raw) × 100

ROLLUP (per manager, per season):
10. LDI_manager_season = mean(LDI_raw) over all that manager's scored picks — equal weight
11. manager_display_score (1-100) = empirical percentile rank of LDI_manager_season vs. pooled manager-draft population, clipped to [1,99]
```

---

## 13. Glossary

| Symbol | Meaning |
|---|---|
| `P_r` | positional draft rank (e.g., 5th RB taken = 5) |
| `P_overall` | true overall draft pick number |
| `E_pts(P_r)` | expected season points for a player taken at positional rank P_r |
| `SD_pts(P_r)` | expected spread (SD) of outcomes at that positional rank |
| `G` | possible games in a season, excluding the player's bye |
| `A_pts` | actual (Winsorized) season points |
| `E_adj` | expected points, prorated for games missed |
| `Z` | standardized residual (Adjusted before asymmetry) |
| `λ` | miss-dampening constant (asymmetry layer) |
| `V_expected(P_overall)` / `SD_VORP(P_overall)` | expected VORP and spread for any position taken at a given overall pick |
| `α` | blend weight between positional performance and VORP |
| `ρ` | recency-decay rate used in training |
| `T_bust` | inconsistency-pill trigger threshold |
| `Φ` | standard normal cumulative distribution function |
