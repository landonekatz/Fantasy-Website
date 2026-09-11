# Technical Specification: ADP-Anchored Bounded Re-Ranking Engine (LDI Residual Model)

## 1. Executive Summary & Core Paradigm Shift
The current draft board ranking pipeline relies on unconstrained bottom-up projections and Value Over Replacement Player (VORP) calculations. This approach produces extreme volatility:
* Injured or demoted players with legacy volume profiles (e.g., James Conner) receive unearned high rankings.
* Consensus Round 1/2 players slip significantly due to model discrepancies (e.g., CeeDee Lamb falling to 17, Nico Collins to 25).
* Mid-tier tight ends (e.g., Mark Andrews) are artificially boosted into early rounds.
* Players with roster status tags like Free Agent (FA) project for 0.0 PPG and fall 200+ spots below market value (e.g., Tyreek Hill).

### The Solution: Residual Alpha on Market Consensus
Market Consensus Average Draft Position (ADP) aggregates extensive market knowledge regarding player health, depth chart positioning, and offensive schemes. 

Rather than generating rankings *de novo*, the system will establish **Consensus ADP as the prior anchor**. The Landon Draft Index (LDI) and its covariates will act strictly as an **alpha predictor of market mispricing ($\widehat{\Delta}_i$)**, subject to **dynamic bandwidth clamping ($M(\text{ADP})$)** based on draft phase.

---

## 2. Hard Pre-Ranking Feasibility Gates (Data Sanitization)
Before any delta calculation or ranking occurs, raw player inputs must pass three deterministic sanity checks:

### 2.1. Active Injury / IR Gate
If a player's official status is `IR`, `PUP`, `NFI`, or `Suspended`:
* Apply an expected games-missed discount:
  $$\text{PPG}_{\text{adj}} = \text{PPG}_{\text{proj}} \times \left(\frac{17 - \text{Expected Games Missed}}{17}\right)$$
* If the injury is season-ending or the return date is past Week 10, clamp their maximum rank to $\ge 180.0$ or flag them as undraftable.

### 2.2. Depth Chart Opportunity Floor/Ceiling
* If a player is designated as `RB3`, `WR4+`, or `Reserve` behind healthy starters:
  * Maximum projected team opportunity share is capped at **20%**.
  * A backup cannot retain RB1/RB2 tier volume projections simply because of historical efficiency.

### 2.3. Roster Status & FA Audit
* If a player is marked as `FA` (Free Agent) but possesses a Market ADP $\le 150$:
  * **Do not assign 0.0 PPG.** 
  * Fall back to baseline historical per-game efficiency scaled to 13 games (accounting for missed camp/late signing), or hold consensus ADP as the default until signed.

---

## 3. The Dynamic Bandwidth Clamping Function: $M(\text{ADP})$
Market efficiency is highest in early rounds and decays non-linearly. The maximum allowable rank deviation ($M$) a player can move away from consensus ADP is governed by a piecewise monotonic step function:

$$M(\text{ADP}) = \begin{cases} \pm 3.5 \text{ slots} & \text{for } \text{ADP} \le 12 \quad (\text{Round 1: High Market Efficiency, Tier Integrity Preserved}) \\ \pm 5.0 \text{ slots} & \text{for } 12 < \text{ADP} \le 24 \quad (\text{Round 2: Turn Boundary Locked}) \\ \pm 8.0 \text{ slots} & \text{for } 24 < \text{ADP} \le 48 \quad (\text{Rounds 3-4: Half-Round Range}) \\ \pm 14.0 \text{ slots} & \text{for } 48 < \text{ADP} \le 96 \quad (\text{Rounds 5-8: 1 Round Range}) \\ \pm 20.0 \text{ to } 32.0 \text{ slots} & \text{for } \text{ADP} > 96 \quad (\text{Rounds 9+: High Variance Sleepers}) \end{cases}$$

---

## 4. Residual Delta Formulation
The expected mispricing ($\widehat{\Delta}_i$) is calculated via regression against historical draft outcomes using LDI and key contextual variables:

$$\widehat{\Delta}_i = \beta_0 + \beta_1 \left(\text{LDI}_i - \overline{\text{LDI}}_{\text{ADP}_i}\right) + \beta_2 (\text{Age}_i) + \beta_3 (\text{Team Win Total}_i) + \beta_4 (\text{Depth Tier}_i)$$

Where:
* $\widehat{\Delta}_i > 0$: The player is historically undervalued at current ADP (Target to rise).
* $\widehat{\Delta}_i < 0$: The player is historically overvalued at current ADP (Target to fall).

### Clamping and Final Sorting Score
1. Clamp the predicted delta within the dynamic bandwidth:
   $$\Delta_i^{\text{clamped}} = \max\left(-M(\text{ADP}_i), \; \min\left(M(\text{ADP}_i), \; \widehat{\Delta}_i\right)\right)$$

2. Compute the final target scoring metric:
   $$\text{Final Target Score}_i = \text{ADP}_i - \Delta_i^{\text{clamped}}$$

3. Sort all draft-eligible players by $\text{Final Target Score}_i$ ascending to establish the canonical master draft board.

---

## 5. Audit & Validation Benchmarks (2026 Consensus Market ADP)

| Player | 2026 Consensus ADP | Legacy Model Rank | Proposed Bounded Rank | Resolution Description |
| :--- | :---: | :---: | :---: | :--- |
| **Jahmyr Gibbs** | 1.7 | 4 | **1** | Ranked #1 overall (+122.2 VORP, 15.59 PPG). |
| **Bijan Robinson** | 1.3 | 2 | **2** | Elite 1st round bellcow (+118.2 VORP, 15.34 PPG). |
| **Ja'Marr Chase** | 3.0 | 6 | **3** | Top WR off the board (+78.9 VORP, 13.71 PPG). |
| **Puka Nacua** | 4.0 | 12 | **4** | Elite WR2 off the board in Round 1 (+70.7 VORP, 13.20 PPG). |
| **Ashton Jeanty** | 10.7 | Rookie | **9** | Rookie RB sensation locked in Round 1 (+76.0 VORP, 12.70 PPG). |
| **Justin Jefferson** | 11.0 | 18 | **14** | Clamped to the 1/2 turn (+65.6 VORP, 12.88 PPG). |
| **CeeDee Lamb** | 11.3 | 24 | **15** | Clamped to early Round 2 (+54.1 VORP, 12.16 PPG). |
| **Josh Jacobs** | 28.3 | 6 | **22** | Round 2/3 turn (+97.0 VORP, 14.01 PPG), well behind Puka Nacua. |
| **Nico Collins** | 23.0 | 25 | **26** | Round 3 pick (+40.3 VORP, 11.30 PPG), not a first rounder. |
| **James Conner** | 175.0 | 27 | **154** | Feasibility Gate eliminates starter volume; drops to Round 13. |
| **Tyreek Hill** | 195.3 | 235 | **184** | Free Agent, essentially undrafted / round 16 flyer. |

---

## 6. Python Implementation Reference

```python
import numpy as np
import pandas as pd

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

def build_bounded_master_board(df: pd.DataFrame) -> pd.DataFrame:
    # 1. Enforce Data Feasibility Gates
    # Gating IR / PUP
    ir_mask = df['Depth'].str.contains('IR|PUP|Reserve', case=False, na=False)
    df.loc[ir_mask, 'LPI Proj PPG'] = df.loc[ir_mask, 'LPI Proj PPG'] * 0.40
    
    # 2. Compute Raw Delta vs Consensus ADP
    # Positive delta means model rates player better (lower number) than ADP
    df['Raw_Delta'] = df['Mkt ADP'] - df['LPI Rank']
    
    # 3. Apply Dynamic Bandwidth Clamping
    df['Max_Move'] = df['Mkt ADP'].apply(compute_max_movement)
    df['Clamped_Delta'] = np.clip(df['Raw_Delta'], -df['Max_Move'], df['Max_Move'])
    
    # 4. Calculate Final Target Score and Re-Rank
    df['Target_Score'] = df['Mkt ADP'] - df['Clamped_Delta']
    df = df.sort_values(by=['Target_Score', 'Mkt ADP']).reset_index(drop=True)
    df['Master_Rank'] = df.index + 1
    
    return df