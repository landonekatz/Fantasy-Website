# The Landon Prospective Index (LPI)
## Full Implementation Specification

This document is a complete, standalone build spec for the prospective (pre-season) draft grading system. It assumes no prior context, but depends on the already-built retrospective **Landon Draft Index (LDI)** system — LPI reuses several of LDI's trained curves and definitions rather than reinventing them, and those dependencies are called out explicitly wherever they occur. LDI itself is not modified anywhere in this document.

### Contents
1. Purpose & Relationship to Retrospective LDI
2. Target Variable & Prediction Task
3. Required Data — Full Schema
4. Data Sourcing
5. Covariate Definitions
6. Feature Engineering & Preprocessing
7. Model: Elastic Net
8. Validation & Statistical Rigor
9. Output Pipeline
10. Historical Backfill Plan
11. Edge Cases & Validation Rules
12. Full Pipeline Reference
13. Glossary

---

## 1. Purpose & Relationship to Retrospective LDI

LDI grades a draft pick after the season is over, by comparing what actually happened to what was expected at that draft slot. LPI predicts, *before* a season starts, how a player is likely to perform — using that player's LDI history as one input among many — and expresses the result on the same conceptual scale LDI already uses, so the two systems feel like one product rather than two unrelated tools.

LPI does not change how LDI computes anything. It reuses two specific trained artifacts from the LDI system as-is: the positional expectation curves `E_pts_per_game(P_r)` / `SD_pts_per_game(P_r)` (LDI spec, Section 3.1), used here only in the output stage (Section 9) to convert a raw prediction into a draft-slot-relative grade.

---

## 2. Target Variable & Prediction Task

**Prediction task:** for a given player entering a given season, predict `target_ppg` — that player's actual points-per-game-played for the season about to happen — using only information available before that season starts.

**Why points-per-game, not season totals:** this mirrors the season-length fix already made to LDI's own training (LDI spec, Section 3.1) for the same reason — training on raw season totals would implicitly reward or punish players based on how many matchup weeks their league happened to have that year, which has nothing to do with talent or opportunity.

**Why LDI alone isn't the predictor, and what replaces the "decay" idea:** LDI is deliberately built to discard absolute production level — it only measures how surprising an outcome was relative to draft-slot expectation, which is exactly right for grading a draft decision and exactly wrong for predicting future talent on its own. A round-10 player who far exceeded a low bar and a round-1 player who matched a high bar can carry the same LDI despite very different absolute quality. Rather than inventing a hand-tuned decay function to fix this, LPI feeds the model `prior_ldi` **and** `prior_ppg` (raw absolute output) **and** `prior_draft_slot` as separate covariates (Section 5) — the model learns the right combination empirically instead of a decay curve imposing one.

**Position-specific models:** QB, RB, WR, and TE are modeled **separately** — the covariates that matter and how they interact differ enough by position that a single pooled model would blur real signal. If a given position's training sample proves too thin for a stable fit (Section 8 sets the bar for "too thin"), the documented fallback is a single pooled model across positions with position included as a covariate — not the default, but not something to be silently stuck without an escape hatch either.

---

## 3. Required Data — Full Schema

Three new record types, plus reuse of `PlayerSeasonPick` and `LeagueSeasonSettings` from the LDI schema (LDI spec, Sections 1.1-1.2).

### 3.1 `PlayerBio` — one row per player

| Field | Type | Notes |
|---|---|---|
| player_id | string | |
| birthdate | date | used to compute age as of September 1 of the season being predicted |
| nfl_draft_year | integer | real-NFL draft year, null if undrafted |
| nfl_draft_round | integer | 1-7; use 8 as a convention for undrafted players, not null, so it sorts meaningfully alongside drafted rounds |

### 3.2 `TeamSeasonContext` — one row per NFL team per season

| Field | Type | Notes |
|---|---|---|
| nfl_team_id, season_year | — | composite key |
| head_coach_id | string | |
| offensive_coordinator_id | string | |
| win_pct | float | prior-season record |
| point_differential | float | prior-season |
| primary_qb_player_id | string | the QB with the most starts/snaps for this team-season — derived from usage data (Section 3.3), not manually curated |
| ol_returning_starter_count | integer | number of the prior season's offensive line starters (by games started) still on this team's roster this season |

### 3.3 `PlayerUsageStats` — one row per player per season

Sourced primarily from nflverse (Section 4).

| Field | Type | Notes |
|---|---|---|
| player_id, season_year | — | composite key |
| nfl_team_id | string | |
| target_share | float | WR/TE primarily; null/not applicable for QB |
| carry_share | float | RB primarily |
| snap_share | float | all positions |
| redzone_share | float | share of team red-zone touches/targets |
| pass_attempts_per_game | float | QB-specific usage measure |
| games_started | integer | used for `ol_returning_starter_count` and `primary_qb_player_id` derivation |

### 3.4 `ProspectiveCovariates` (derived, one row per player-season — the model's feature matrix)

Built from `PlayerSeasonPick`, `PlayerBio`, `TeamSeasonContext`, `PlayerUsageStats`, and LDI's own outputs. Field-by-field definitions are in Section 5. This table holds one row per player per season being used as either a training example (with `target_ppg` populated after that season concludes) or a live prediction input (with `target_ppg` null).

---

## 4. Data Sourcing

**Primary backbone: nflverse / nflfastR.** Free, well-maintained, and covers play-by-play, snap counts, target/carry/red-zone share, rosters, schedules, and team results well past the 24-season training window. This is where the large majority of covariates should come from, and it's the reason the covariate list in Section 5 can be as wide as it is without a large custom-scraping effort.

**Supplementary sources:**
- **Pro Football Reference** — coaching staff history (head coach, offensive coordinator by team-season), team records, games-missed data.
- **Spotrac / Over The Cap** — free agency signing details, if signing-specific granularity beyond what roster-change detection (Section 5) already implies is wanted later.

**Note on scope, per your instruction not to strain for this:** preseason injury designations and offensive-coordinator scheme tendencies (run-heavy vs. pass-heavy history) are the two categories most likely to be inconsistently available for older seasons. Both are included in Section 5 as **best-effort** covariates — populate them where reasonably available, accept missing data further back (Section 6 covers how the model handles that), and do not treat incomplete historical coverage of these two as a blocker.

**On the earlier decision not to use external ADP data:** that decision was specific to the *retrospective* LDI training pool. It doesn't apply here — LPI's entire premise is external contextual data about teams, coaching, and usage, which is a different question from what LDI's own expectation curves should be trained on.

---

## 5. Covariate Definitions

Organized by category. "Source tier" indicates how readily available the data is (Tier 1 = nflverse/PFR direct, Tier 2 = derived from Tier 1 data without additional manual curation, Tier 3 = best-effort, may have historical gaps).

### Prior performance
| Covariate | Definition | Tier |
|---|---|---|
| `prior_ldi` | player's LDI from the most recently completed season | 1 (from LDI system) |
| `prior_ldi_trend` | `prior_ldi` minus LDI from two seasons prior; null if not applicable | 1 |
| `prior_ppg` | points scored ÷ games played (played weeks only), most recent season | 1 |
| `prior_positional_finish_rank` | this player's rank among all players at their position that season, by `prior_ppg`, descending | 2 (derived) |
| `prior_vorp` | `VORP_actual` from LDI (LDI spec, Section 4.6), most recent season | 1 (from LDI system) |
| `prior_draft_slot` | `positional_draft_rank` from that season's draft | 1 |
| `prior_games_missed` | `games_missed`, most recent season | 1 |
| `prior_consistency_label` | `final_label` from LDI (LDI spec, Section 4.7): inconsistent_producer / consistent_with_booms / none | 1 (from LDI system) |
| `age` | as of September 1 of the season being predicted, from `PlayerBio.birthdate` | 1 |

### Team and role context
| Covariate | Definition | Tier |
|---|---|---|
| `team_changed` | boolean — different `nfl_team_id` than the prior season | 1 |
| `new_hc` | boolean — `TeamSeasonContext.head_coach_id` differs from prior season, for this player's current team | 1 |
| `new_oc` | boolean — same, for `offensive_coordinator_id` | 1 |
| `qb_changed` | boolean, non-QB positions only — `primary_qb_player_id` differs from prior season | 2 |
| `departed_qb_ldi` | if `qb_changed`, the departed QB's LDI from the prior season; null otherwise | 2 |
| `vacated_opportunity_share` | sum of prior-season usage share (target_share for WR/TE, carry_share for RB) belonging to same-position teammates no longer on this team's roster | 2 |
| `added_competition_score` | composite: presence and real-NFL-draft-round of a same-position rookie added, combined with prior-season usage share of any same-position free-agent addition (definition intentionally loose — treat this as a first-pass composite to be tested and possibly split into separate covariates once real data is in hand, per Section 8) | 2 |
| `team_prior_win_pct` / `team_prior_point_diff` | from `TeamSeasonContext` | 1 |
| `ol_continuity_score` | `TeamSeasonContext.ol_returning_starter_count`, most relevant for RB and QB models | 1 |

### Usage stats (trailing season, from `PlayerUsageStats`)
| Covariate | Definition | Tier |
|---|---|---|
| `target_share` | WR/TE models | 1 |
| `carry_share` | RB models | 1 |
| `snap_share` | all positions | 1 |
| `redzone_share` | all positions | 1 |
| `pass_attempts_per_game` | QB models | 1 |

### Draft capital and injury
| Covariate | Definition | Tier |
|---|---|---|
| `nfl_draft_capital` | `PlayerBio.nfl_draft_round` (8 = undrafted convention) — most informative for early-career players | 1 |
| `preseason_injury_flag` | categorical: healthy / minor concern / significant concern, entering the season being predicted | 3 (best-effort) |

### Outcome
| Covariate | Definition |
|---|---|
| `target_ppg` | the actual points-per-game-played for the season being predicted — populated after that season concludes for training rows; null for live prediction rows |

---

## 6. Feature Engineering & Preprocessing

**Standardization is required.** Elastic net's penalty is scale-sensitive — center and scale every numeric covariate (zero mean, unit variance) before fitting, computed from the training set only (never refit standardization on validation/test folds, or information leaks across the fold boundary).

**Missing data.** Several Tier 2/3 covariates will have gaps, especially in older seasons (`preseason_injury_flag` most of all, `added_competition_score` and `departed_qb_ldi` to a lesser degree). For every covariate with missing values: impute with the training-set median (numeric) or mode (categorical), **and** add a companion binary `<covariate>_was_missing` indicator column. This lets the model learn if missingness itself carries signal (it often does in this kind of data — e.g., a covariate that's more often missing in older seasons could be picking up an era effect rather than the thing it's nominally measuring) rather than silently treating an imputed value as if it were observed.

**Categorical encoding.** `prior_consistency_label` and `preseason_injury_flag` are categorical — one-hot encode them (drop one level to avoid the dummy-variable trap) before fitting.

**Per-position feature sets.** Not every covariate applies to every position — `target_share`/`carry_share` don't both make sense for a given position's model, and `pass_attempts_per_game` is QB-specific. Build each position's feature set from the covariates that are actually meaningful for that position (Section 5's tables largely delineate this already) rather than feeding every position the full undifferentiated list.

---

## 7. Model: Elastic Net

For each position, fit:

```
target_ppg ~ elastic_net(standardized covariates for that position)
```

Elastic net combines an L1 penalty (drives weak covariates' coefficients to exactly zero — automatic variable selection) and an L2 penalty (shrinks correlated covariates' coefficients together rather than arbitrarily picking one, which matters here since several covariates — e.g., `snap_share` and `prior_ppg` — are likely correlated). Two hyperparameters, tuned via cross-validation (Section 8), using names distinct from any symbol in the LDI spec to avoid confusion between the two documents:

- `en_strength` — overall regularization strength (higher = more shrinkage, sparser model)
- `en_l1_ratio` — the L1/L2 mix (0 = pure ridge, 1 = pure LASSO)

Grid search both simultaneously over a reasonable range (e.g., `en_strength` on a log scale from 0.001 to 10, `en_l1_ratio` in {0.1, 0.3, 0.5, 0.7, 0.9, 1.0}) — do not fix `en_l1_ratio` to a single value without checking whether the data prefers more ridge-like or more LASSO-like behavior.

---

## 8. Validation & Statistical Rigor

**Rolling-origin (time-respecting) cross-validation — never random k-fold.** Same principle as `ρ`'s calibration in the LDI spec (Section 9.1 there): order seasons chronologically, fit on seasons 1 through k, validate on season k+1, roll forward, and average performance across folds. Shuffling seasons into folds would let the model "see the future" when predicting the past.

**Nested CV, in principle.** The statistically correct structure uses an outer loop for honest performance estimation and an inner loop for hyperparameter tuning, so the reported accuracy isn't inflated by having used the same folds to both tune and evaluate. Given the sample size here, full nested CV may slice the data thinner than is practical — a single rolling-origin loop used for both tuning and reporting is an acceptable simplification, but if you do simplify this way, say so plainly wherever performance numbers are reported, rather than presenting them as if from a fully honest nested procedure.

**Headline metric: out-of-sample, not in-sample.** Report RMSE and R² computed only on held-out folds. In-sample fit statistics are not evidence of predictive validity for this kind of model and shouldn't be presented as the primary result.

**What "too thin to model separately" means, concretely (Section 2's fallback trigger):** if a position's training set has fewer players-per-covariate than is reasonable for stable elastic net fitting (a common rough guideline is at least 10-20 observations per candidate covariate, though elastic net's regularization is somewhat more forgiving than unregularized regression here) — check this explicitly for each position before trusting its model, and fall back to the pooled cross-position model (Section 2) for any position that fails this check.

**Multiple-comparisons discipline, if used.** If coefficients are also examined for traditional statistical significance (rather than relying purely on elastic net's built-in shrinkage/selection), apply a Benjamini-Hochberg false discovery rate correction across the full covariate set being tested — not a raw per-covariate p<0.05 threshold, which will produce false positives given how many covariates are in play here.

---

## 9. Output Pipeline

Two distinct outputs, both from the same fitted model:

### 9.1 Predicted Value ranking (static, pre-draft)

```
predicted_ppg = elastic_net_model_for_position(covariates)
```

Rank all players at a position by `predicted_ppg` for a pre-draft cheat-sheet or rankings view. This output doesn't depend on where anyone is actually drafted — it's a pure talent/opportunity forecast.

### 9.2 Live Prospective Grade (computed pick-by-pick, during an actual draft)

This is the LDI-comparable grade, and it can only be computed once a pick actually happens, because it needs that pick's real `positional_draft_rank` at the moment it's made:

```
predicted_season_total = predicted_ppg × G     (this league-season's own G, from LeagueSeasonSettings — same season-length awareness as LDI)
prospective_residual = predicted_season_total − E_pts(P_r)          (LDI spec, Section 3.1 curve, at this pick's actual positional_draft_rank)
prospective_z = prospective_residual / SD_pts(P_r)                   (same LDI curve)
prospective_grade = Φ(prospective_z) × 100
```

This reuses LDI's already-trained expectation curves directly — no separate curve-fitting needed for this step. The result is on the same 0-100 scale as retrospective `pick_display_score` (LDI spec, Section 4.10), so a manager sees a comparable number before and after the season, even though one is a forecast and the other is a completed grade — display them with distinct labeling (e.g., "Projected Grade" vs. "Final Grade") so it's never ambiguous which is which.

---

## 10. Historical Backfill Plan

Tier 1 and Tier 2 covariates (Section 5) should be backfillable across the full 24-season pooled training window — nflverse's coverage extends well past this range. Build the model's primary training set on Tier 1+2 covariates over the full window.

Tier 3 covariates (`preseason_injury_flag` chiefly) should be treated as an optional enhancement layer, not a blocker: populate them for whatever years are reasonably available, rely on the missing-data handling in Section 6 to let the model use them where present without requiring full historical coverage, and don't hold up shipping the first version of LPI on getting this tier complete.

---

## 11. Edge Cases & Validation Rules

- **Rookie players:** most `prior_*` covariates are undefined (no prior LDI, PPG, VORP, draft slot). Treat these as a structurally missing block (Section 6's missing-indicator approach) rather than trying to impute a "typical rookie" value that would obscure the fact that the player has no history — `nfl_draft_capital` and (if available) college-production proxies become the primary signal for this subgroup, and it may be worth a rookie-specific position model if volume justifies it, though this isn't required for a first version.
- **Player who missed the entire prior season (season-ending injury):** `prior_ppg` and `prior_positional_finish_rank` are undefined for that season specifically — fall back to the next-most-recent season with games played, with a missing-indicator flag noting the gap, rather than silently treating a zero-games season as a zero-production season.
- **`added_competition_score`'s intentionally loose definition:** flagged in Section 5 as a first-pass composite. Once real data is in hand, check whether its two components (rookie draft capital vs. veteran free-agent signing) behave similarly enough to justify staying combined, or whether splitting them into separate covariates produces a meaningfully better fit — don't treat the combined definition as final without checking.
- **Position models with too few observations (Section 8):** fall back to the pooled cross-position model with position as a covariate, per Section 2, rather than shipping an unstable position-specific fit.
- **A league-season with an unusual number of teams or a mid-season roster rule change:** exclude from training the same way LDI's own training excludes seasons with unclear scoring rules (LDI spec, Section 2) — better to have a cleaner, smaller training set than one with silently inconsistent conditions.

---

## 12. Full Pipeline Reference

```
DATA PREP (batch):
1. Pull Tier 1/2 covariates from nflverse + PFR across the full 24-season pool (both leagues).
2. Best-effort populate Tier 3 covariates where available.
3. Compute derived fields (primary_qb_player_id, ol_returning_starter_count, vacated_opportunity_share, etc.) from raw usage/roster data.
4. Assemble ProspectiveCovariates: one row per player-season, joining PlayerSeasonPick + PlayerBio + TeamSeasonContext + PlayerUsageStats + LDI outputs.
5. For training rows, populate target_ppg from that season's actual results once concluded.

TRAINING (per position, on refit):
6. Standardize numeric covariates (mean 0, SD 1, fit on training data only).
7. Impute missing values (median/mode) with companion was_missing indicators.
8. One-hot encode categorical covariates.
9. Grid-search en_strength and en_l1_ratio via rolling-origin CV; select the combination minimizing out-of-sample RMSE.
10. Check per-position sample-size adequacy (Section 8); fall back to pooled model if a position fails the check.
11. Fit final elastic net model per position (or pooled) on the full training window with the selected hyperparameters.

OUTPUT (per player, per use case):
12. Predicted Value ranking: predicted_ppg from the fitted model, ranked within position.
13. Live Prospective Grade (per actual pick, during a draft): predicted_season_total = predicted_ppg × G; compare against LDI's E_pts(P_r)/SD_pts(P_r) at the pick's real positional_draft_rank; prospective_grade = Φ(prospective_z) × 100.
```

---

## 13. Glossary

| Term | Meaning |
|---|---|
| `target_ppg` | the outcome variable — actual points-per-game-played for the season being predicted |
| `prior_ldi` / `prior_ppg` / `prior_vorp` / `prior_draft_slot` | the "LDI needs a partner" group — relative surprise, absolute level, and context, fed as separate covariates rather than one decayed number |
| `vacated_opportunity_share` / `added_competition_score` | continuous proxies for teammate departure/arrival, built from usage-share data rather than manually flagged transactions |
| `en_strength` / `en_l1_ratio` | elastic net's regularization strength and L1/L2 mix — named distinctly from any LDI symbol to avoid cross-document confusion |
| `predicted_ppg` | the model's raw forecast — feeds both outputs in Section 9 |
| `prospective_grade` | the LDI-comparable 0-100 output, only computable once a pick's real draft slot is known |
| `E_pts(P_r)` / `SD_pts(P_r)` | reused directly from the LDI system (LDI spec, Section 3.1) — not refit here |
