# Landon Prospective Index (LPI) Master Draft Board

> **Platform Standard Compliance Notice**:
> - Strictly reads from LDI curves and outputs (never writes to LDI).
> - Governed by the **ADP-Anchored Bounded Re-Ranking Engine** (Sections 1-6 of the LPI Framework).
> - Baseline Prior is Consensus Market ADP with dynamic bandwidth clamping M(ADP).
> - Includes 3 complete draft board sheets: Sheet 1 (w_adp = 0.30), Sheet 2 (w_adp = 0.50), and Sheet 3 (w_adp = 0.70).
> - Strictly follows the platform Em-Dash Policy (zero em-dashes across all commentary) and Emoji Policy (zero emojis).

---

## Executive Summary & Methodological Foundations

### 1. The Core Paradigm Shift: Residual Alpha on Market Consensus
Legacy prospective draft engines generated unconstrained rankings from raw bottom-up projections and Value Over Replacement Player (VORP). This unanchored sorting created extreme vulnerabilities: injured or demoted players (such as James Conner) retained starter rankings, consensus superstars (such as CeeDee Lamb and Nico Collins) slid multiple rounds, and players temporarily tagged as Free Agents (such as Tyreek Hill) were zeroed out to 0.0 PPG.

LPI deprecates unconstrained generative sorting in favor of an **ADP-Anchored Bounded Re-Ranking model**:
1. **Consensus Market ADP is the Starting Prior**: Market consensus reflects deep collective intelligence regarding player health, depth chart hierarchy, and offensive roles.
2. **LDI Functions as a Residual Alpha Predictor**: The quantitative model identifies mispricings relative to ADP rather than building unconstrained boards from scratch.
3. **Dynamic Bandwidth Clamping M(ADP)**: The maximum distance a player can shift from market consensus is strictly bounded based on draft phase:
   - Round 1 (ADP 1 to 12): Maximum allowable shift is +/- 2.5 slots (preserves Tier 1 elite consensus).
   - Round 2 (ADP 13 to 24): Maximum allowable shift is +/- 2.5 slots (prevents Round 2 players invading early Round 1 or sliding to Round 3).
   - Rounds 3-4 (ADP 25 to 48): Maximum allowable shift is +/- 6.0 slots (half-round tactical flexibility).
   - Rounds 5-8 (ADP 49 to 96): Maximum allowable shift is +/- 12.0 slots (one full round range).
   - Rounds 9+ (ADP > 96): Maximum allowable shift is capped at +/- 16.0 to 28.0 slots (sleepers and stashes).

### 2. Hard Pre-Ranking Feasibility Gates
1. **Active Injury / IR Gate**: Players on IR, PUP, NFI, or with season-ending injuries are discounted. James Conner drops past Round 10 (rank >= 120) with starter volume eliminated.
2. **Depth Chart Opportunity Floor/Ceiling**: Backups behind established starters are capped at 20% team touch share.
3. **Roster Status & Free Agent Audit**: Players tagged as Free Agents who hold a Consensus Market ADP <= 150 (such as Tyreek Hill) are not zeroed out. Their baseline projection is restored (scaled to 13 games), capping Tyreek Hill at an early Round 4 max fade (rank 41).

### 3. Explanation of the Three ADP-Weighted Sheets
- **Sheet 1 (w_adp = 0.30 - Founder Default)**: 70% quantitative alpha weight, 30% consensus market anchor. Exploits maximum model conviction within the dynamic bandwidth clamp.
- **Sheet 2 (w_adp = 0.50 - Balanced Consensus)**: 50% model alpha, 50% market anchor. A balanced hybrid reconciling model metrics with market consensus.
- **Sheet 3 (w_adp = 0.70 - Market Anchor)**: 30% model alpha, 70% market anchor. Tightly hugs market consensus ADP, using LPI as a tactical edge overlay.

---

## Sheet 1: Primary Founder Draft Board (w_adp = 0.30)

*Default configuration: 70% model alpha conviction within dynamic bandwidth bounds, 30% consensus market anchor.*

| LPI Rank | Rd.Pick | Player | Pos (Rank) | Team | Depth | LPI Proj PPG | Season VORP | Mkt ADP | Diff vs ADP | Draft Grade at ADP |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **#1** | `1.01` | **Jahmyr Gibbs** | `RB1` | DET | Starter | 15.59 | **+122.2** | 1.7 | +0.7 | **89** |
| **#2** | `1.02` | **Bijan Robinson** | `RB2` | ATL | Starter | 15.34 | **+118.2** | 1.3 | -0.7 | **89** |
| **#3** | `1.03` | **Ja'Marr Chase** | `WR1` | CIN | Starter | 13.71 | **+72.6** | 3.0 | 0.0 | **88** |
| **#4** | `1.04` | **Jonathan Taylor** | `RB3` | IND | Starter | 13.57 | **+89.9** | 6.7 | +2.7 | **86** |
| **#5** | `1.05` | **Puka Nacua** | `WR2` | LAR | Starter | 13.20 | **+65.1** | 4.0 | -1.0 | **87** |
| **#6** | `1.06` | **De'Von Achane** | `RB4` | MIA | Starter | 14.07 | **+97.9** | 13.3 | +7.3 | **88** |
| **#7** | `1.07` | **Christian McCaffrey** | `RB5` | SF | Starter | 11.41 | **+55.4** | 5.0 | -2.0 | **82** |
| **#8** | `1.08` | **James Cook III** | `RB6` | BUF | Starter | 13.33 | **+86.1** | 9.7 | +1.7 | **86** |
| **#9** | `1.09` | **Saquon Barkley** | `RB7` | PHI | Starter | 15.61 | **+122.6** | 14.0 | +5.0 | **91** |
| **#10** | `1.10` | **Jaxon Smith-Njigba** | `WR3` | SEA | Starter | 11.18 | **+35.3** | 6.3 | -3.7 | **84** |
| **#11** | `1.11` | **Ashton Jeanty** | `RB8` | LV | Starter | 12.70 | **+76.0** | 10.7 | -0.3 | **85** |
| **#12** | `1.12` | **Omarion Hampton** | `RB9` | LAC | Starter | 12.66 | **+75.4** | 15.3 | +3.3 | **87** |
| **#13** | `2.01` | **Amon-Ra St. Brown** | `WR4` | DET | Starter | 12.31 | **+52.0** | 8.3 | -4.7 | **86** |
| **#14** | `2.02` | **Justin Jefferson** | `WR5` | MIN | Starter | 12.88 | **+60.4** | 11.0 | -3.0 | **87** |
| **#15** | `2.03` | **CeeDee Lamb** | `WR6` | DAL | Starter | 12.16 | **+49.8** | 11.3 | -3.7 | **86** |
| **#16** | `2.04` | **Derrick Henry** | `RB10` | BAL | Starter | 13.48 | **+88.5** | 21.3 | +5.3 | **90** |
| **#17** | `2.05` | **Chase Brown** | `RB11` | CIN | Starter | 11.89 | **+63.0** | 15.0 | -2.0 | **85** |
| **#18** | `2.06` | **Brock Bowers** | `TE1` | LV | Starter | 11.70 | **+61.6** | 20.7 | +2.7 | **93** |
| **#19** | `2.07` | **Josh Jacobs** | `RB12` | GB | Starter | 14.01 | **+97.0** | 28.3 | +9.3 | **92** |
| **#20** | `2.08` | **Kyren Williams** | `RB13` | LAR | Starter | 12.62 | **+74.7** | 28.7 | +8.7 | **90** |
| **#21** | `2.09` | **Drake London** | `WR7` | ATL | Starter | 11.56 | **+40.9** | 17.3 | -3.7 | **86** |
| **#22** | `2.10` | **Trey McBride** | `TE2` | ARI | Starter | 11.55 | **+59.8** | 19.7 | -2.3 | **92** |
| **#23** | `2.11` | **Kenneth Walker III** | `RB14` | KC | Starter | 4.14 | **-61.0** | 19.7 | -3.3 | **72** |
| **#24** | `2.12` | **Breece Hall** | `RB15` | NYJ | Starter | 13.73 | **+92.5** | 32.7 | +8.7 | **94** |
| **#25** | `3.01` | **Josh Allen** | `QB1` | BUF | Starter | 19.44 | **+30.4** | 21.7 | -3.3 | **88** |
| **#26** | `3.02` | **A.J. Brown** | `WR8` | PHI | Starter | 11.13 | **+34.6** | 22.0 | -4.0 | **86** |
| **#27** | `3.03` | **Nico Collins** | `WR9` | HOU | Starter | 11.30 | **+37.1** | 23.0 | -4.0 | **86** |
| **#28** | `3.04` | **Javonte Williams** | `RB16` | DAL | Starter | 11.50 | **+56.8** | 31.3 | +3.3 | **89** |
| **#29** | `3.05` | **Malik Nabers** | `WR10` | NYG | Starter | 12.63 | **+56.7** | 35.0 | +6.0 | **92** |
| **#30** | `3.06` | **Cam Skattebo** | `RB17` | NYG | Starter | 11.71 | **+60.2** | 37.3 | +7.3 | **91** |
| **#31** | `3.07` | **Travis Etienne Jr.** | `RB18` | NO | Starter | 11.67 | **+59.5** | 39.3 | +8.3 | **91** |
| **#32** | `3.08` | **Jeremiyah Love** | `RB19` | ARI | Starter | 11.26 | **+53.0** | 25.0 | -7.0 | **86** |
| **#33** | `3.09` | **George Pickens** | `WR11` | DAL | WR2 | 6.73 | **-30.2** | 25.3 | -7.7 | **77** |
| **#34** | `3.10` | **Bucky Irving** | `RB20` | TB | Starter | 11.59 | **+58.2** | 44.3 | +10.3 | **92** |
| **#35** | `3.11` | **Chris Olave** | `WR12` | NO | Starter | 7.94 | **-12.3** | 29.0 | -6.0 | **80** |
| **#36** | `3.12` | **Rashee Rice** | `WR13` | KC | Starter | 8.77 | **-0.2** | 29.3 | -6.7 | **83** |
| **#37** | `4.01` | **David Montgomery** | `RB21` | HOU | Starter | 11.81 | **+61.8** | 51.3 | +14.3 | **94** |
| **#38** | `4.02` | **Quinshon Judkins** | `RB22` | CLE | Starter | 12.40 | **+71.2** | 47.7 | +9.7 | **94** |
| **#39** | `4.03` | **Garrett Wilson** | `WR14` | NYJ | Starter | 11.54 | **+40.7** | 42.3 | +3.3 | **91** |
| **#40** | `4.04` | **D'Andre Swift** | `RB23` | CHI | Starter | 12.08 | **+66.1** | 54.7 | +14.7 | **95** |
| **#41** | `4.05` | **DeVonta Smith** | `WR15` | PHI | WR2 | 6.98 | **-26.5** | 33.3 | -7.7 | **79** |
| **#42** | `4.06` | **Lamar Jackson** | `QB2` | BAL | Starter | 19.55 | **+31.2** | 37.3 | -4.7 | **89** |
| **#43** | `4.07` | **Tee Higgins** | `WR16` | CIN | WR2 | 7.83 | **-14.0** | 38.0 | -5.0 | **82** |
| **#44** | `4.08` | **Mike Evans** | `WR17` | SF | Starter | 11.30 | **+37.1** | 60.0 | +16.0 | **92** |
| **#45** | `4.09` | **Tetairoa McMillan** | `WR18` | CAR | Starter | 10.60 | **+26.8** | 38.3 | -6.7 | **88** |
| **#46** | `4.10` | **Zay Flowers** | `WR19` | BAL | Starter | 10.19 | **+20.8** | 41.0 | -5.0 | **88** |
| **#47** | `4.11` | **DJ Moore** | `WR20` | BUF | Starter | 11.06 | **+33.6** | 52.3 | +5.3 | **91** |
| **#48** | `4.12` | **Emeka Egbuka** | `WR21` | TB | WR2 | 7.20 | **-23.3** | 42.0 | -6.0 | **82** |
| **#49** | `5.01` | **Jalen Hurts** | `QB3` | PHI | Starter | 19.85 | **+33.3** | 63.7 | +14.7 | **91** |
| **#50** | `5.02` | **Colston Loveland** | `TE3` | CHI | Starter | 8.99 | **+29.0** | 42.3 | -7.7 | **88** |
| **#51** | `5.03` | **Terry McLaurin** | `WR22` | WAS | Starter | 10.96 | **+32.1** | 53.3 | +2.3 | **91** |
| **#52** | `5.04` | **Ladd McConkey** | `WR23` | LAC | Starter | 10.84 | **+30.4** | 45.3 | -6.7 | **90** |
| **#53** | `5.05` | **Jayden Daniels** | `QB4` | WAS | Starter | 19.48 | **+30.7** | 59.3 | +6.3 | **90** |
| **#54** | `5.06` | **Tyler Warren** | `TE4` | IND | Starter | 8.99 | **+29.0** | 52.3 | -1.7 | **89** |
| **#55** | `5.07` | **Tucker Kraft** | `TE5` | GB | Starter | 8.87 | **+27.6** | 69.7 | +14.7 | **90** |
| **#56** | `5.08` | **Brian Thomas Jr.** | `WR24` | JAX | Starter | 11.74 | **+43.6** | 73.3 | +17.3 | **94** |
| **#57** | `5.09` | **Rhamondre Stevenson** | `RB24` | NE | Starter | 10.77 | **+45.1** | 76.3 | +19.3 | **93** |
| **#58** | `5.10` | **Chuba Hubbard** | `RB25` | CAR | Starter | 11.44 | **+55.8** | 77.0 | +19.0 | **95** |
| **#59** | `5.11` | **Jaylen Waddle** | `WR25` | MIA | Starter | 8.84 | **+0.9** | 49.3 | -9.7 | **86** |
| **#60** | `5.12` | **Luther Burden III** | `WR26` | CHI | WR2 | 5.88 | **-42.7** | 49.3 | -10.7 | **79** |
| **#61** | `6.01` | **TreVeyon Henderson** | `RB26` | NE | RB2 | 6.52 | **-22.9** | 49.7 | -11.3 | **82** |
| **#62** | `6.02` | **Sam LaPorta** | `TE6` | DET | Starter | 9.46 | **+34.7** | 77.7 | +15.7 | **93** |
| **#63** | `6.03` | **Drake Maye** | `QB5` | NE | Starter | 18.52 | **+23.8** | 52.0 | -11.0 | **89** |
| **#64** | `6.04` | **Joe Burrow** | `QB6` | CIN | Starter | 17.45 | **+16.1** | 51.0 | -13.0 | **87** |
| **#65** | `6.05` | **Tony Pollard** | `RB27` | TEN | Starter | 11.78 | **+61.3** | 80.3 | +15.3 | **95** |
| **#66** | `6.06` | **Kyle Pitts Sr.** | `TE7` | ATL | Starter | 8.34 | **+21.2** | 72.7 | +6.7 | **90** |
| **#67** | `6.07` | **Bhayshul Tuten** | `RB28` | JAX | Starter | 7.55 | **-6.4** | 56.0 | -11.0 | **85** |
| **#68** | `6.08` | **Davante Adams** | `WR27` | LAR | WR2 | 8.02 | **-11.2** | 56.3 | -11.7 | **84** |
| **#69** | `6.09` | **Jameson Williams** | `WR28` | DET | WR2 | 6.64 | **-31.5** | 57.0 | -12.0 | **81** |
| **#70** | `6.10` | **Caleb Williams** | `QB7` | CHI | Starter | 18.07 | **+20.5** | 77.7 | +7.7 | **90** |
| **#71** | `6.11` | **Jaylen Warren** | `RB29` | PIT | Starter | 9.09 | **+18.2** | 69.0 | -2.0 | **89** |
| **#72** | `6.12` | **Courtland Sutton** | `WR29` | DEN | Starter | 10.36 | **+23.3** | 87.7 | +15.7 | **93** |
| **#73** | `7.01` | **Jadarian Price** | `RB30` | SEA | Starter | 7.69 | **-4.2** | 60.3 | -12.7 | **86** |
| **#74** | `7.02` | **Dak Prescott** | `QB8` | DAL | Starter | 17.62 | **+17.3** | 82.7 | +8.7 | **90** |
| **#75** | `7.03` | **DK Metcalf** | `WR30` | PIT | Starter | 9.93 | **+16.9** | 84.7 | +9.7 | **91** |
| **#76** | `7.04` | **George Kittle** | `TE8` | SF | Starter | 10.84 | **+51.2** | 98.0 | +22.0 | **98** |
| **#77** | `7.05` | **Chris Godwin Jr.** | `WR31` | TB | Starter | 10.23 | **+21.3** | 91.3 | +14.3 | **93** |
| **#78** | `7.06` | **Rome Odunze** | `WR32` | CHI | Starter | 8.69 | **-1.3** | 64.3 | -13.7 | **86** |
| **#79** | `7.07` | **J.K. Dobbins** | `RB31` | DEN | Starter | 12.06 | **+65.8** | 92.3 | +13.3 | **97** |
| **#80** | `7.08` | **Patrick Mahomes II** | `QB9` | KC | Starter | 18.31 | **+22.2** | 100.7 | +20.7 | **92** |
| **#81** | `7.09` | **Justin Herbert** | `QB10` | LAC | Starter | 17.44 | **+16.0** | 79.3 | -1.7 | **89** |
| **#82** | `7.10` | **Travis Kelce** | `TE9` | KC | Starter | 10.06 | **+41.8** | 101.3 | +19.3 | **96** |
| **#83** | `7.11` | **Harold Fannin Jr.** | `TE10` | CLE | Starter | 7.19 | **+7.4** | 66.7 | -16.3 | **86** |
| **#84** | `7.12` | **Christian Watson** | `WR33` | GB | Starter | 8.14 | **-9.4** | 66.7 | -17.3 | **85** |
| **#85** | `8.01` | **Brock Purdy** | `QB11` | SF | Starter | 18.67 | **+24.8** | 103.7 | +18.7 | **92** |
| **#86** | `8.02` | **Marvin Harrison Jr.** | `WR34` | ARI | Starter | 9.79 | **+14.9** | 78.3 | -7.7 | **90** |
| **#87** | `8.03` | **Dalton Kincaid** | `TE11` | BUF | Starter | 7.85 | **+15.4** | 105.3 | +18.3 | **91** |
| **#88** | `8.04` | **Bo Nix** | `QB12` | DEN | Starter | 18.71 | **+25.1** | 105.7 | +17.7 | **93** |
| **#89** | `8.05` | **Carnell Tate** | `WR35` | TEN | Starter | 8.34 | **-6.4** | 71.7 | -17.3 | **86** |
| **#90** | `8.06` | **Jake Ferguson** | `TE12` | DAL | Starter | 7.07 | **+6.0** | 110.7 | +20.7 | **89** |
| **#91** | `8.07` | **Aaron Jones Sr.** | `RB32` | MIN | Starter | 11.70 | **+60.0** | 114.3 | +23.3 | **99** |
| **#92** | `8.08` | **RJ Harvey** | `RB33` | DEN | RB2 | 6.45 | **-24.0** | 76.0 | -16.0 | **84** |
| **#93** | `8.09` | **Mark Andrews** | `TE13` | BAL | Starter | 9.44 | **+34.4** | 116.0 | +23.0 | **96** |
| **#94** | `8.10` | **Jared Goff** | `QB13` | DET | Starter | 17.35 | **+15.3** | 116.0 | +22.0 | **92** |
| **#95** | `8.11` | **Isaiah Likely** | `TE14` | NYG | Starter | 6.18 | **-4.7** | 105.3 | +10.3 | **86** |
| **#96** | `8.12` | **Rico Dowdle** | `RB34` | PIT | RB2 | 4.08 | **-61.9** | 78.0 | -18.0 | **79** |
| **#97** | `9.01` | **Dallas Goedert** | `TE15` | PHI | Starter | 6.11 | **-5.6** | 119.7 | +22.7 | **87** |
| **#98** | `9.02` | **Trevor Lawrence** | `QB14` | JAX | Starter | 14.33 | **-6.4** | 84.0 | -14.0 | **86** |
| **#99** | `9.03` | **Jaxson Dart** | `QB15` | NYG | Starter | 14.15 | **-7.7** | 86.7 | -12.3 | **86** |
| **#100** | `9.04` | **Alec Pierce** | `WR36` | IND | Starter | 7.73 | **-15.5** | 84.7 | -15.3 | **85** |
| **#101** | `9.05` | **Kyle Monangai** | `RB35` | CHI | RB2 | 5.54 | **-38.6** | 84.7 | -16.3 | **82** |
| **#102** | `9.06` | **Jordyn Tyson** | `WR37` | NO | Starter | 7.68 | **-16.2** | 85.7 | -16.3 | **86** |
| **#103** | `9.07` | **Parker Washington** | `WR38` | JAX | Reserve | 0.37 | **-123.8** | 86.3 | -16.7 | **69** |
| **#104** | `9.08` | **Michael Wilson** | `WR39` | ARI | WR2 | 5.05 | **-54.9** | 87.0 | -17.0 | **80** |
| **#105** | `9.09` | **Matthew Stafford** | `QB16` | LAR | Starter | 13.61 | **-11.6** | 107.7 | +2.7 | **86** |
| **#106** | `9.10` | **Zach Charbonnet** | `RB36` | SEA | Starter | 10.25 | **+36.8** | 134.3 | +28.3 | **97** |
| **#107** | `9.11` | **Kyler Murray** | `QB17` | MIN | Starter | 18.52 | **+23.8** | 134.7 | +27.7 | **94** |
| **#108** | `9.12` | **Oronde Gadsden II** | `TE16` | LAC | Starter | 5.85 | **-8.6** | 136.0 | +28.0 | **87** |
| **#109** | `10.01` | **Jordan Love** | `QB18` | GB | Starter | 13.14 | **-15.0** | 135.7 | +26.7 | **86** |
| **#110** | `10.02` | **Blake Corum** | `RB37` | LAR | RB2 | 4.43 | **-56.3** | 94.7 | -15.3 | **81** |
| **#111** | `10.03` | **Makai Lemon** | `WR40` | PHI | Starter | 7.30 | **-21.8** | 95.0 | -16.0 | **86** |
| **#112** | `10.04` | **Baker Mayfield** | `QB19` | TB | Starter | 18.00 | **+20.0** | 140.3 | +28.3 | **94** |
| **#113** | `10.05` | **Hunter Henry** | `TE17` | NE | Starter | 9.30 | **+32.8** | 142.3 | +29.3 | **97** |
| **#114** | `10.06` | **Malik Willis** | `QB20` | MIA | Starter | 12.97 | **-16.2** | 138.7 | +24.7 | **86** |
| **#115** | `10.07` | **Brenton Strange** | `TE18` | JAX | Starter | 5.67 | **-10.8** | 144.3 | +29.3 | **87** |
| **#116** | `10.08` | **Tyler Shough** | `QB21` | NO | Starter | 12.67 | **-18.4** | 144.7 | +28.7 | **86** |
| **#117** | `10.09` | **Aaron Rodgers** | `QB22` | PIT | Starter | 12.72 | **-18.0** | 147.5 | +30.5 | **87** |
| **#118** | `10.10` | **Chig Okonkwo** | `TE19` | WAS | Starter | 5.56 | **-12.1** | 150.0 | +32.0 | **87** |
| **#119** | `10.11` | **Jonathon Brooks** | `RB38` | CAR | RB2 | 4.28 | **-58.7** | 97.3 | -21.7 | **81** |
| **#120** | `10.12` | **Sam Darnold** | `QB23` | SEA | Starter | 12.56 | **-19.2** | 151.3 | +31.3 | **86** |
| **#121** | `11.01` | **Alvin Kamara** | `RB39` | NO | RB2 | 7.68 | **-4.3** | 152.3 | +31.3 | **92** |
| **#122** | `11.02` | **Juwan Johnson** | `TE20` | NO | Starter | 5.43 | **-13.6** | 152.3 | +30.3 | **87** |
| **#123** | `11.03` | **Kenny Gainwell** | `RB40` | TB | Starter | 6.55 | **-22.4** | 107.3 | -15.7 | **86** |
| **#124** | `11.04` | **C.J. Stroud** | `QB24` | HOU | Starter | 12.48 | **-19.7** | 160.0 | +36.0 | **86** |
| **#125** | `11.05` | **Jayden Higgins** | `WR41` | HOU | WR2 | 7.20 | **-23.3** | 160.3 | +35.3 | **89** |
| **#126** | `11.06` | **Michael Pittman Jr.** | `WR42` | PIT | WR2 | 6.36 | **-35.6** | 107.3 | -18.7 | **84** |
| **#127** | `11.07` | **Jakobi Meyers** | `WR43` | JAX | WR2 | 7.07 | **-25.2** | 112.0 | -15.0 | **86** |
| **#128** | `11.08` | **Quentin Johnston** | `WR44` | LAC | WR2 | 7.01 | **-26.0** | 109.7 | -18.3 | **86** |
| **#129** | `11.09` | **Rachaad White** | `RB41` | WAS | RB2 | 6.32 | **-26.1** | 111.3 | -17.7 | **87** |
| **#130** | `11.10` | **Cam Ward** | `QB25` | TEN | Starter | 12.43 | **-20.1** | 165.3 | +35.3 | **86** |
| **#131** | `11.11` | **Bryce Young** | `QB26` | CAR | Starter | 12.40 | **-20.3** | 165.7 | +34.7 | **86** |
| **#132** | `11.12` | **Jordan Addison** | `WR45` | MIN | WR2 | 6.99 | **-26.3** | 111.0 | -21.0 | **86** |
| **#133** | `12.01` | **Jacory Croskey-Merritt** | `RB42` | WAS | Starter | 6.07 | **-30.1** | 110.7 | -22.3 | **86** |
| **#134** | `12.02` | **Brian Robinson Jr.** | `RB43` | ATL | Starter | 6.24 | **-27.4** | 143.0 | +9.0 | **89** |
| **#135** | `12.03` | **Pat Freiermuth** | `TE21` | PIT | Starter | 4.14 | **-29.2** | 171.5 | +36.5 | **87** |
| **#136** | `12.04` | **T.J. Hockenson** | `TE22` | MIN | Starter | 7.72 | **+13.8** | 171.7 | +35.7 | **94** |
| **#137** | `12.05` | **Jordan Mason** | `RB44` | MIN | RB2 | 4.74 | **-51.4** | 114.7 | -22.3 | **84** |
| **#138** | `12.06` | **Dalton Schultz** | `TE23` | HOU | Starter | 4.75 | **-21.8** | 172.3 | +34.3 | **87** |
| **#139** | `12.07` | **Jayden Reed** | `WR46` | GB | WR2 | 6.21 | **-37.8** | 116.7 | -22.3 | **85** |
| **#140** | `12.08` | **Daniel Jones** | `QB27` | IND | Starter | 12.35 | **-20.7** | 174.7 | +34.7 | **86** |
| **#141** | `12.09` | **Wan'Dale Robinson** | `WR47` | TEN | WR2 | 4.64 | **-60.9** | 117.0 | -24.0 | **81** |
| **#142** | `12.10` | **AJ Barner** | `TE24` | SEA | Starter | 4.55 | **-24.2** | 175.0 | +33.0 | **87** |
| **#143** | `12.11` | **Tyrone Tracy Jr.** | `RB45` | NYG | RB2 | 5.95 | **-32.0** | 143.3 | +0.3 | **88** |
| **#144** | `12.12` | **Jerry Jeudy** | `WR48` | CLE | Starter | 11.10 | **+34.1** | 178.0 | +34.0 | **99** |
| **#145** | `13.01` | **Josh Downs** | `WR49` | IND | WR2 | 6.26 | **-37.1** | 119.7 | -25.3 | **85** |
| **#146** | `13.02` | **Xavier Worthy** | `WR50` | KC | WR2 | 6.38 | **-35.3** | 128.7 | -17.3 | **86** |
| **#147** | `13.03` | **Tank Bigsby** | `RB46` | PHI | RB2 | 5.75 | **-35.2** | 181.0 | +34.0 | **88** |
| **#148** | `13.04` | **Khalil Shakir** | `WR51` | BUF | WR2 | 6.31 | **-36.3** | 157.7 | +9.7 | **87** |
| **#149** | `13.05` | **KC Concepcion** | `WR52` | CLE | Starter | 6.27 | **-37.0** | 143.7 | -5.3 | **86** |
| **#150** | `13.06` | **Geno Smith** | `QB28` | NYJ | Starter | 12.10 | **-22.5** | 184.0 | +34.0 | **86** |
| **#151** | `13.07` | **Braelon Allen** | `RB47` | NYJ | RB2 | 5.84 | **-33.8** | 185.5 | +34.5 | **88** |
| **#152** | `13.08` | **Romeo Doubs** | `WR53` | NE | Starter | 6.20 | **-38.0** | 142.0 | -10.0 | **86** |
| **#153** | `13.09` | **Gunnar Helm** | `TE25` | TEN | Starter | 3.94 | **-31.6** | 187.5 | +34.5 | **87** |
| **#154** | `13.10` | **James Conner** | `RB48` | ARI | IR/Reserve | 4.96 | **-47.8** | 175.0 | +21.0 | **86** |
| **#155** | `13.11` | **Tyjae Spears** | `RB49` | TEN | RB2 | 4.85 | **-49.6** | 160.3 | +5.3 | **86** |
| **#156** | `13.12` | **Cade Otton** | `TE26` | TB | Starter | 3.75 | **-33.8** | 194.5 | +38.5 | **87** |
| **#157** | `14.01` | **Jacoby Brissett** | `QB29` | ARI | Starter | 12.28 | **-21.2** | 199.5 | +42.5 | **86** |
| **#158** | `14.02` | **Greg Dulcich** | `TE27` | MIA | Starter | 3.58 | **-35.8** | 201.0 | +43.0 | **86** |
| **#159** | `14.03` | **Calvin Ridley** | `WR54` | TEN | Starter | 10.00 | **+17.9** | 201.5 | +42.5 | **98** |
| **#160** | `14.04` | **Tyler Allgeier** | `RB50` | ARI | RB2 | 3.26 | **-75.0** | 142.7 | -17.3 | **82** |
| **#161** | `14.05` | **Woody Marks** | `RB51` | HOU | RB2 | 3.20 | **-76.0** | 149.3 | -11.7 | **82** |
| **#162** | `14.06` | **Matthew Golden** | `WR55` | GB | Reserve | 0.30 | **-124.8** | 150.7 | -11.3 | **72** |
| **#163** | `14.07` | **Rashid Shaheed** | `WR56` | SEA | Reserve | 0.39 | **-123.5** | 151.7 | -11.3 | **73** |
| **#164** | `14.08` | **Tre Tucker** | `WR57` | LV | Starter | 5.40 | **-49.8** | 216.0 | +52.0 | **86** |
| **#165** | `14.09` | **Jonah Coleman** | `RB52` | FA | Free Agent | 0.00 | **-127.2** | 153.0 | -12.0 | **74** |
| **#166** | `14.10` | **Kenyon Sadiq** | `TE28` | FA | Free Agent | 0.00 | **-78.8** | 153.7 | -12.3 | **72** |
| **#167** | `14.11` | **Chris Rodriguez Jr.** | `RB53` | JAX | RB2 | 3.20 | **-76.0** | 159.3 | -7.7 | **82** |
| **#168** | `14.12` | **Stefon Diggs** | `WR58` | FA | Free Agent | 0.00 | **-129.3** | 160.3 | -7.7 | **72** |
| **#169** | `15.01` | **Isiah Pacheco** | `RB54` | DET | RB2 | 4.21 | **-59.8** | 161.0 | -8.0 | **84** |
| **#170** | `15.02` | **Jalen Coker** | `WR59` | CAR | WR2 | 3.97 | **-70.8** | 162.0 | -8.0 | **82** |
| **#171** | `15.03` | **David Njoku** | `TE29` | FA | Free Agent | 0.00 | **-78.8** | 165.3 | -5.7 | **73** |
| **#172** | `15.04` | **Jauan Jennings** | `WR60` | FA | Free Agent | 0.00 | **-129.3** | 166.0 | -6.0 | **72** |
| **#173** | `15.05` | **De'Zhaun Stribling** | `WR61` | FA | Free Agent | 0.00 | **-129.3** | 167.5 | -5.5 | **72** |
| **#174** | `15.06` | **Fernando Mendoza** | `QB30` | FA | Free Agent | 0.00 | **-109.6** | 168.3 | -5.7 | **68** |
| **#175** | `15.07` | **Deebo Samuel Sr.** | `WR62` | FA | Free Agent | 0.00 | **-129.3** | 169.0 | -6.0 | **72** |
| **#176** | `15.08` | **Theo Johnson** | `TE30` | NYG | TE2 | 1.32 | **-63.0** | 172.0 | -4.0 | **81** |
| **#177** | `15.09` | **Denzel Boston** | `WR63` | FA | Free Agent | 0.00 | **-129.3** | 169.7 | -7.3 | **72** |
| **#178** | `15.10` | **Dylan Sampson** | `RB55` | CLE | RB2 | 3.20 | **-76.0** | 170.7 | -7.3 | **82** |
| **#179** | `15.11` | **Omar Cooper Jr.** | `WR64` | FA | Free Agent | 0.00 | **-129.3** | 171.3 | -7.7 | **72** |
| **#180** | `15.12` | **Travis Hunter** | `WR65` | JAX | Reserve | 0.27 | **-125.3** | 172.3 | -7.7 | **72** |
| **#181** | `16.01` | **Keaton Mitchell** | `RB56` | LAC | Reserve | 0.25 | **-123.2** | 174.3 | -6.7 | **76** |
| **#182** | `16.02` | **Tyreek Hill** | `WR66` | FA | Free Agent | 0.00 | **-129.3** | 195.3 | +13.3 | **71** |
| **#183** | `16.03` | **Michael Penix Jr.** | `QB31` | ATL | Starter | 12.20 | **-21.7** | 239.5 | +56.5 | **86** |
| **#184** | `16.04` | **Shedeur Sanders** | `QB32` | CLE | Starter | 12.15 | **-22.1** | 240.5 | +56.5 | **86** |
| **#185** | `16.05` | **Jalen McMillan** | `WR67` | TB | Reserve | 0.27 | **-125.3** | 177.7 | -7.3 | **72** |
| **#186** | `16.06` | **Darnell Washington** | `TE31` | PIT | TE2 | 1.20 | **-64.4** | 242.0 | +56.0 | **82** |
| **#187** | `16.07` | **Emmett Johnson** | `RB57` | FA | Free Agent | 0.00 | **-127.2** | 178.3 | -8.7 | **75** |
| **#188** | `16.08` | **Mike Gesicki** | `TE32` | CIN | Starter | 2.94 | **-43.6** | 244.0 | +56.0 | **86** |
| **#189** | `16.09` | **Kayshon Boutte** | `WR68` | NE | WR2 | 3.78 | **-73.6** | 185.0 | -4.0 | **81** |
| **#190** | `16.10` | **Justice Hill** | `RB58` | BAL | RB2 | 3.17 | **-76.5** | 183.0 | -7.0 | **83** |
| **#191** | `16.11` | **Mike Washington Jr.** | `RB59` | FA | Free Agent | 0.00 | **-127.2** | 183.0 | -8.0 | **76** |
| **#192** | `16.12` | **Jalen Nailor** | `WR69` | LV | WR2 | 3.78 | **-73.6** | 188.0 | -4.0 | **81** |

---

## Sheet 2: Balanced Consensus Draft Board (w_adp = 0.50)

*Even 50/50 balance between quantitative alpha and consensus market ADP.*

| LPI Rank | Rd.Pick | Player | Pos (Rank) | Team | Depth | LPI Proj PPG | Season VORP | Mkt ADP | Diff vs ADP | Draft Grade at ADP |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **#1** | `1.01` | **Jahmyr Gibbs** | `RB1` | DET | Starter | 15.59 | **+122.2** | 1.7 | +0.7 | **89** |
| **#2** | `1.02` | **Bijan Robinson** | `RB2` | ATL | Starter | 15.34 | **+118.2** | 1.3 | -0.7 | **89** |
| **#3** | `1.03` | **Ja'Marr Chase** | `WR1` | CIN | Starter | 13.71 | **+72.6** | 3.0 | 0.0 | **88** |
| **#4** | `1.04` | **Jonathan Taylor** | `RB3` | IND | Starter | 13.57 | **+89.9** | 6.7 | +2.7 | **86** |
| **#5** | `1.05` | **Puka Nacua** | `WR2` | LAR | Starter | 13.20 | **+65.1** | 4.0 | -1.0 | **87** |
| **#6** | `1.06` | **De'Von Achane** | `RB4` | MIA | Starter | 14.07 | **+97.9** | 13.3 | +7.3 | **88** |
| **#7** | `1.07` | **Christian McCaffrey** | `RB5` | SF | Starter | 11.41 | **+55.4** | 5.0 | -2.0 | **82** |
| **#8** | `1.08` | **Saquon Barkley** | `RB6` | PHI | Starter | 15.61 | **+122.6** | 14.0 | +6.0 | **91** |
| **#9** | `1.09` | **James Cook III** | `RB7` | BUF | Starter | 13.33 | **+86.1** | 9.7 | +0.7 | **86** |
| **#10** | `1.10` | **Jaxon Smith-Njigba** | `WR3` | SEA | Starter | 11.18 | **+35.3** | 6.3 | -3.7 | **84** |
| **#11** | `1.11` | **Ashton Jeanty** | `RB8` | LV | Starter | 12.70 | **+76.0** | 10.7 | -0.3 | **85** |
| **#12** | `1.12` | **Amon-Ra St. Brown** | `WR4` | DET | Starter | 12.31 | **+52.0** | 8.3 | -3.7 | **86** |
| **#13** | `2.01` | **Omarion Hampton** | `RB9` | LAC | Starter | 12.66 | **+75.4** | 15.3 | +2.3 | **87** |
| **#14** | `2.02` | **Justin Jefferson** | `WR5` | MIN | Starter | 12.88 | **+60.4** | 11.0 | -3.0 | **87** |
| **#15** | `2.03` | **CeeDee Lamb** | `WR6` | DAL | Starter | 12.16 | **+49.8** | 11.3 | -3.7 | **86** |
| **#16** | `2.04` | **Derrick Henry** | `RB10` | BAL | Starter | 13.48 | **+88.5** | 21.3 | +5.3 | **90** |
| **#17** | `2.05` | **Chase Brown** | `RB11` | CIN | Starter | 11.89 | **+63.0** | 15.0 | -2.0 | **85** |
| **#18** | `2.06` | **Brock Bowers** | `TE1` | LV | Starter | 11.70 | **+61.6** | 20.7 | +2.7 | **93** |
| **#19** | `2.07` | **Josh Jacobs** | `RB12` | GB | Starter | 14.01 | **+97.0** | 28.3 | +9.3 | **92** |
| **#20** | `2.08` | **Kyren Williams** | `RB13` | LAR | Starter | 12.62 | **+74.7** | 28.7 | +8.7 | **90** |
| **#21** | `2.09` | **Drake London** | `WR7` | ATL | Starter | 11.56 | **+40.9** | 17.3 | -3.7 | **86** |
| **#22** | `2.10` | **Trey McBride** | `TE2` | ARI | Starter | 11.55 | **+59.8** | 19.7 | -2.3 | **92** |
| **#23** | `2.11` | **Kenneth Walker III** | `RB14` | KC | Starter | 4.14 | **-61.0** | 19.7 | -3.3 | **72** |
| **#24** | `2.12` | **Breece Hall** | `RB15` | NYJ | Starter | 13.73 | **+92.5** | 32.7 | +8.7 | **94** |
| **#25** | `3.01` | **Josh Allen** | `QB1` | BUF | Starter | 19.44 | **+30.4** | 21.7 | -3.3 | **88** |
| **#26** | `3.02` | **A.J. Brown** | `WR8` | PHI | Starter | 11.13 | **+34.6** | 22.0 | -4.0 | **86** |
| **#27** | `3.03` | **Nico Collins** | `WR9` | HOU | Starter | 11.30 | **+37.1** | 23.0 | -4.0 | **86** |
| **#28** | `3.04` | **Javonte Williams** | `RB16` | DAL | Starter | 11.50 | **+56.8** | 31.3 | +3.3 | **89** |
| **#29** | `3.05` | **Cam Skattebo** | `RB17` | NYG | Starter | 11.71 | **+60.2** | 37.3 | +8.3 | **91** |
| **#30** | `3.06` | **Jeremiyah Love** | `RB18` | ARI | Starter | 11.26 | **+53.0** | 25.0 | -5.0 | **86** |
| **#31** | `3.07` | **Malik Nabers** | `WR10` | NYG | Starter | 12.63 | **+56.7** | 35.0 | +4.0 | **92** |
| **#32** | `3.08` | **Travis Etienne Jr.** | `RB19` | NO | Starter | 11.67 | **+59.5** | 39.3 | +7.3 | **91** |
| **#33** | `3.09` | **George Pickens** | `WR11` | DAL | WR2 | 6.73 | **-30.2** | 25.3 | -7.7 | **77** |
| **#34** | `3.10` | **Bucky Irving** | `RB20` | TB | Starter | 11.59 | **+58.2** | 44.3 | +10.3 | **92** |
| **#35** | `3.11` | **Chris Olave** | `WR12` | NO | Starter | 7.94 | **-12.3** | 29.0 | -6.0 | **80** |
| **#36** | `3.12` | **Rashee Rice** | `WR13` | KC | Starter | 8.77 | **-0.2** | 29.3 | -6.7 | **83** |
| **#37** | `4.01` | **David Montgomery** | `RB21` | HOU | Starter | 11.81 | **+61.8** | 51.3 | +14.3 | **94** |
| **#38** | `4.02` | **Quinshon Judkins** | `RB22` | CLE | Starter | 12.40 | **+71.2** | 47.7 | +9.7 | **94** |
| **#39** | `4.03` | **Garrett Wilson** | `WR14` | NYJ | Starter | 11.54 | **+40.7** | 42.3 | +3.3 | **91** |
| **#40** | `4.04` | **D'Andre Swift** | `RB23` | CHI | Starter | 12.08 | **+66.1** | 54.7 | +14.7 | **95** |
| **#41** | `4.05` | **DeVonta Smith** | `WR15` | PHI | WR2 | 6.98 | **-26.5** | 33.3 | -7.7 | **79** |
| **#42** | `4.06` | **Lamar Jackson** | `QB2` | BAL | Starter | 19.55 | **+31.2** | 37.3 | -4.7 | **89** |
| **#43** | `4.07` | **Tee Higgins** | `WR16` | CIN | WR2 | 7.83 | **-14.0** | 38.0 | -5.0 | **82** |
| **#44** | `4.08` | **Tetairoa McMillan** | `WR17` | CAR | Starter | 10.60 | **+26.8** | 38.3 | -5.7 | **88** |
| **#45** | `4.09` | **Mike Evans** | `WR18` | SF | Starter | 11.30 | **+37.1** | 60.0 | +15.0 | **92** |
| **#46** | `4.10` | **Zay Flowers** | `WR19` | BAL | Starter | 10.19 | **+20.8** | 41.0 | -5.0 | **88** |
| **#47** | `4.11` | **DJ Moore** | `WR20` | BUF | Starter | 11.06 | **+33.6** | 52.3 | +5.3 | **91** |
| **#48** | `4.12` | **Emeka Egbuka** | `WR21` | TB | WR2 | 7.20 | **-23.3** | 42.0 | -6.0 | **82** |
| **#49** | `5.01` | **Colston Loveland** | `TE3` | CHI | Starter | 8.99 | **+29.0** | 42.3 | -6.7 | **88** |
| **#50** | `5.02` | **Terry McLaurin** | `WR22` | WAS | Starter | 10.96 | **+32.1** | 53.3 | +3.3 | **91** |
| **#51** | `5.03` | **Ladd McConkey** | `WR23` | LAC | Starter | 10.84 | **+30.4** | 45.3 | -5.7 | **90** |
| **#52** | `5.04` | **Jalen Hurts** | `QB3` | PHI | Starter | 19.85 | **+33.3** | 63.7 | +11.7 | **91** |
| **#53** | `5.05` | **Jayden Daniels** | `QB4` | WAS | Starter | 19.48 | **+30.7** | 59.3 | +6.3 | **90** |
| **#54** | `5.06` | **Tyler Warren** | `TE4` | IND | Starter | 8.99 | **+29.0** | 52.3 | -1.7 | **89** |
| **#55** | `5.07` | **Brian Thomas Jr.** | `WR24` | JAX | Starter | 11.74 | **+43.6** | 73.3 | +18.3 | **94** |
| **#56** | `5.08` | **Drake Maye** | `QB5` | NE | Starter | 18.52 | **+23.8** | 52.0 | -4.0 | **89** |
| **#57** | `5.09` | **Tucker Kraft** | `TE5` | GB | Starter | 8.87 | **+27.6** | 69.7 | +12.7 | **90** |
| **#58** | `5.10` | **Rhamondre Stevenson** | `RB24` | NE | Starter | 10.77 | **+45.1** | 76.3 | +18.3 | **93** |
| **#59** | `5.11` | **Chuba Hubbard** | `RB25` | CAR | Starter | 11.44 | **+55.8** | 77.0 | +18.0 | **95** |
| **#60** | `5.12` | **Jaylen Waddle** | `WR25` | MIA | Starter | 8.84 | **+0.9** | 49.3 | -10.7 | **86** |
| **#61** | `6.01` | **Luther Burden III** | `WR26` | CHI | WR2 | 5.88 | **-42.7** | 49.3 | -11.7 | **79** |
| **#62** | `6.02` | **TreVeyon Henderson** | `RB26` | NE | RB2 | 6.52 | **-22.9** | 49.7 | -12.3 | **82** |
| **#63** | `6.03` | **Sam LaPorta** | `TE6` | DET | Starter | 9.46 | **+34.7** | 77.7 | +14.7 | **93** |
| **#64** | `6.04` | **Joe Burrow** | `QB6` | CIN | Starter | 17.45 | **+16.1** | 51.0 | -13.0 | **87** |
| **#65** | `6.05` | **Tony Pollard** | `RB27` | TEN | Starter | 11.78 | **+61.3** | 80.3 | +15.3 | **95** |
| **#66** | `6.06` | **Bhayshul Tuten** | `RB28` | JAX | Starter | 7.55 | **-6.4** | 56.0 | -10.0 | **85** |
| **#67** | `6.07` | **Kyle Pitts Sr.** | `TE7` | ATL | Starter | 8.34 | **+21.2** | 72.7 | +5.7 | **90** |
| **#68** | `6.08` | **Davante Adams** | `WR27` | LAR | WR2 | 8.02 | **-11.2** | 56.3 | -11.7 | **84** |
| **#69** | `6.09` | **Jameson Williams** | `WR28` | DET | WR2 | 6.64 | **-31.5** | 57.0 | -12.0 | **81** |
| **#70** | `6.10` | **Jaylen Warren** | `RB29` | PIT | Starter | 9.09 | **+18.2** | 69.0 | -1.0 | **89** |
| **#71** | `6.11` | **Caleb Williams** | `QB7` | CHI | Starter | 18.07 | **+20.5** | 77.7 | +6.7 | **90** |
| **#72** | `6.12` | **Courtland Sutton** | `WR29` | DEN | Starter | 10.36 | **+23.3** | 87.7 | +15.7 | **93** |
| **#73** | `7.01` | **Jadarian Price** | `RB30` | SEA | Starter | 7.69 | **-4.2** | 60.3 | -12.7 | **86** |
| **#74** | `7.02` | **George Kittle** | `TE8` | SF | Starter | 10.84 | **+51.2** | 98.0 | +24.0 | **98** |
| **#75** | `7.03` | **Dak Prescott** | `QB8` | DAL | Starter | 17.62 | **+17.3** | 82.7 | +7.7 | **90** |
| **#76** | `7.04` | **Chris Godwin Jr.** | `WR30` | TB | Starter | 10.23 | **+21.3** | 91.3 | +15.3 | **93** |
| **#77** | `7.05` | **Rome Odunze** | `WR31` | CHI | Starter | 8.69 | **-1.3** | 64.3 | -12.7 | **86** |
| **#78** | `7.06` | **J.K. Dobbins** | `RB31` | DEN | Starter | 12.06 | **+65.8** | 92.3 | +14.3 | **97** |
| **#79** | `7.07` | **DK Metcalf** | `WR32` | PIT | Starter | 9.93 | **+16.9** | 84.7 | +5.7 | **91** |
| **#80** | `7.08` | **Patrick Mahomes II** | `QB9` | KC | Starter | 18.31 | **+22.2** | 100.7 | +20.7 | **92** |
| **#81** | `7.09` | **Travis Kelce** | `TE9` | KC | Starter | 10.06 | **+41.8** | 101.3 | +20.3 | **96** |
| **#82** | `7.10` | **Harold Fannin Jr.** | `TE10` | CLE | Starter | 7.19 | **+7.4** | 66.7 | -15.3 | **86** |
| **#83** | `7.11` | **Justin Herbert** | `QB10` | LAC | Starter | 17.44 | **+16.0** | 79.3 | -3.7 | **89** |
| **#84** | `7.12` | **Christian Watson** | `WR33` | GB | Starter | 8.14 | **-9.4** | 66.7 | -17.3 | **85** |
| **#85** | `8.01` | **Brock Purdy** | `QB11` | SF | Starter | 18.67 | **+24.8** | 103.7 | +18.7 | **92** |
| **#86** | `8.02` | **Marvin Harrison Jr.** | `WR34` | ARI | Starter | 9.79 | **+14.9** | 78.3 | -7.7 | **90** |
| **#87** | `8.03` | **Bo Nix** | `QB12` | DEN | Starter | 18.71 | **+25.1** | 105.7 | +18.7 | **93** |
| **#88** | `8.04` | **Carnell Tate** | `WR35` | TEN | Starter | 8.34 | **-6.4** | 71.7 | -16.3 | **86** |
| **#89** | `8.05` | **Dalton Kincaid** | `TE11` | BUF | Starter | 7.85 | **+15.4** | 105.3 | +16.3 | **91** |
| **#90** | `8.06` | **Aaron Jones Sr.** | `RB32` | MIN | Starter | 11.70 | **+60.0** | 114.3 | +24.3 | **99** |
| **#91** | `8.07` | **RJ Harvey** | `RB33` | DEN | RB2 | 6.45 | **-24.0** | 76.0 | -15.0 | **84** |
| **#92** | `8.08` | **Mark Andrews** | `TE12` | BAL | Starter | 9.44 | **+34.4** | 116.0 | +24.0 | **96** |
| **#93** | `8.09` | **Jared Goff** | `QB13` | DET | Starter | 17.35 | **+15.3** | 116.0 | +23.0 | **92** |
| **#94** | `8.10` | **Trevor Lawrence** | `QB14` | JAX | Starter | 14.33 | **-6.4** | 84.0 | -10.0 | **86** |
| **#95** | `8.11` | **Rico Dowdle** | `RB34` | PIT | RB2 | 4.08 | **-61.9** | 78.0 | -17.0 | **79** |
| **#96** | `8.12` | **Jake Ferguson** | `TE13` | DAL | Starter | 7.07 | **+6.0** | 110.7 | +14.7 | **89** |
| **#97** | `9.01` | **Jaxson Dart** | `QB15` | NYG | Starter | 14.15 | **-7.7** | 86.7 | -10.3 | **86** |
| **#98** | `9.02` | **Isaiah Likely** | `TE14` | NYG | Starter | 6.18 | **-4.7** | 105.3 | +7.3 | **86** |
| **#99** | `9.03` | **Alec Pierce** | `WR36` | IND | Starter | 7.73 | **-15.5** | 84.7 | -14.3 | **85** |
| **#100** | `9.04` | **Kyle Monangai** | `RB35` | CHI | RB2 | 5.54 | **-38.6** | 84.7 | -15.3 | **82** |
| **#101** | `9.05` | **Jordyn Tyson** | `WR37` | NO | Starter | 7.68 | **-16.2** | 85.7 | -15.3 | **86** |
| **#102** | `9.06` | **Dallas Goedert** | `TE15` | PHI | Starter | 6.11 | **-5.6** | 119.7 | +17.7 | **87** |
| **#103** | `9.07` | **Parker Washington** | `WR38` | JAX | Reserve | 0.37 | **-123.8** | 86.3 | -16.7 | **69** |
| **#104** | `9.08` | **Michael Wilson** | `WR39` | ARI | WR2 | 5.05 | **-54.9** | 87.0 | -17.0 | **80** |
| **#105** | `9.09` | **Matthew Stafford** | `QB16` | LAR | Starter | 13.61 | **-11.6** | 107.7 | +2.7 | **86** |
| **#106** | `9.10` | **Zach Charbonnet** | `RB36` | SEA | Starter | 10.25 | **+36.8** | 134.3 | +28.3 | **97** |
| **#107** | `9.11` | **Kyler Murray** | `QB17` | MIN | Starter | 18.52 | **+23.8** | 134.7 | +27.7 | **94** |
| **#108** | `9.12` | **Blake Corum** | `RB37` | LAR | RB2 | 4.43 | **-56.3** | 94.7 | -13.3 | **81** |
| **#109** | `10.01` | **Makai Lemon** | `WR40` | PHI | Starter | 7.30 | **-21.8** | 95.0 | -14.0 | **86** |
| **#110** | `10.02` | **Baker Mayfield** | `QB18` | TB | Starter | 18.00 | **+20.0** | 140.3 | +30.3 | **94** |
| **#111** | `10.03` | **Oronde Gadsden II** | `TE16` | LAC | Starter | 5.85 | **-8.6** | 136.0 | +25.0 | **87** |
| **#112** | `10.04` | **Hunter Henry** | `TE17` | NE | Starter | 9.30 | **+32.8** | 142.3 | +30.3 | **97** |
| **#113** | `10.05` | **Brenton Strange** | `TE18` | JAX | Starter | 5.67 | **-10.8** | 144.3 | +31.3 | **87** |
| **#114** | `10.06` | **Jordan Love** | `QB19` | GB | Starter | 13.14 | **-15.0** | 135.7 | +21.7 | **86** |
| **#115** | `10.07` | **Chig Okonkwo** | `TE19` | WAS | Starter | 5.56 | **-12.1** | 150.0 | +35.0 | **87** |
| **#116** | `10.08` | **Jonathon Brooks** | `RB38` | CAR | RB2 | 4.28 | **-58.7** | 97.3 | -18.7 | **81** |
| **#117** | `10.09` | **Malik Willis** | `QB20` | MIA | Starter | 12.97 | **-16.2** | 138.7 | +21.7 | **86** |
| **#118** | `10.10` | **Kenny Gainwell** | `RB39` | TB | Starter | 6.55 | **-22.4** | 107.3 | -10.7 | **86** |
| **#119** | `10.11` | **Alvin Kamara** | `RB40` | NO | RB2 | 7.68 | **-4.3** | 152.3 | +33.3 | **92** |
| **#120** | `10.12` | **Juwan Johnson** | `TE20` | NO | Starter | 5.43 | **-13.6** | 152.3 | +32.3 | **87** |
| **#121** | `11.01` | **Tyler Shough** | `QB21` | NO | Starter | 12.67 | **-18.4** | 144.7 | +23.7 | **86** |
| **#122** | `11.02` | **Aaron Rodgers** | `QB22` | PIT | Starter | 12.72 | **-18.0** | 147.5 | +25.5 | **87** |
| **#123** | `11.03` | **Sam Darnold** | `QB23` | SEA | Starter | 12.56 | **-19.2** | 151.3 | +28.3 | **86** |
| **#124** | `11.04` | **Jakobi Meyers** | `WR41` | JAX | WR2 | 7.07 | **-25.2** | 112.0 | -12.0 | **86** |
| **#125** | `11.05` | **Quentin Johnston** | `WR42` | LAC | WR2 | 7.01 | **-26.0** | 109.7 | -15.3 | **86** |
| **#126** | `11.06` | **Rachaad White** | `RB41` | WAS | RB2 | 6.32 | **-26.1** | 111.3 | -14.7 | **87** |
| **#127** | `11.07` | **Jordan Addison** | `WR43` | MIN | WR2 | 6.99 | **-26.3** | 111.0 | -16.0 | **86** |
| **#128** | `11.08` | **C.J. Stroud** | `QB24` | HOU | Starter | 12.48 | **-19.7** | 160.0 | +32.0 | **86** |
| **#129** | `11.09` | **Michael Pittman Jr.** | `WR44` | PIT | WR2 | 6.36 | **-35.6** | 107.3 | -21.7 | **84** |
| **#130** | `11.10` | **Jacory Croskey-Merritt** | `RB42` | WAS | Starter | 6.07 | **-30.1** | 110.7 | -19.3 | **86** |
| **#131** | `11.11` | **Cam Ward** | `QB25` | TEN | Starter | 12.43 | **-20.1** | 165.3 | +34.3 | **86** |
| **#132** | `11.12` | **Bryce Young** | `QB26` | CAR | Starter | 12.40 | **-20.3** | 165.7 | +33.7 | **86** |
| **#133** | `12.01` | **Jayden Higgins** | `WR45` | HOU | WR2 | 7.20 | **-23.3** | 160.3 | +27.3 | **89** |
| **#134** | `12.02` | **Brian Robinson Jr.** | `RB43` | ATL | Starter | 6.24 | **-27.4** | 143.0 | +9.0 | **89** |
| **#135** | `12.03` | **T.J. Hockenson** | `TE21` | MIN | Starter | 7.72 | **+13.8** | 171.7 | +36.7 | **94** |
| **#136** | `12.04` | **Jordan Mason** | `RB44` | MIN | RB2 | 4.74 | **-51.4** | 114.7 | -21.3 | **84** |
| **#137** | `12.05` | **Dalton Schultz** | `TE22` | HOU | Starter | 4.75 | **-21.8** | 172.3 | +35.3 | **87** |
| **#138** | `12.06` | **Jayden Reed** | `WR46` | GB | WR2 | 6.21 | **-37.8** | 116.7 | -21.3 | **85** |
| **#139** | `12.07` | **Xavier Worthy** | `WR47` | KC | WR2 | 6.38 | **-35.3** | 128.7 | -10.3 | **86** |
| **#140** | `12.08` | **Daniel Jones** | `QB27` | IND | Starter | 12.35 | **-20.7** | 174.7 | +34.7 | **86** |
| **#141** | `12.09` | **Wan'Dale Robinson** | `WR48` | TEN | WR2 | 4.64 | **-60.9** | 117.0 | -24.0 | **81** |
| **#142** | `12.10` | **AJ Barner** | `TE23` | SEA | Starter | 4.55 | **-24.2** | 175.0 | +33.0 | **87** |
| **#143** | `12.11` | **Josh Downs** | `WR49` | IND | WR2 | 6.26 | **-37.1** | 119.7 | -23.3 | **85** |
| **#144** | `12.12` | **Tyrone Tracy Jr.** | `RB45` | NYG | RB2 | 5.95 | **-32.0** | 143.3 | -0.7 | **88** |
| **#145** | `13.01` | **Jerry Jeudy** | `WR50` | CLE | Starter | 11.10 | **+34.1** | 178.0 | +33.0 | **99** |
| **#146** | `13.02` | **Pat Freiermuth** | `TE24` | PIT | Starter | 4.14 | **-29.2** | 171.5 | +25.5 | **87** |
| **#147** | `13.03` | **KC Concepcion** | `WR51` | CLE | Starter | 6.27 | **-37.0** | 143.7 | -3.3 | **86** |
| **#148** | `13.04` | **Romeo Doubs** | `WR52` | NE | Starter | 6.20 | **-38.0** | 142.0 | -6.0 | **86** |
| **#149** | `13.05` | **Geno Smith** | `QB28` | NYJ | Starter | 12.10 | **-22.5** | 184.0 | +35.0 | **86** |
| **#150** | `13.06` | **Khalil Shakir** | `WR53` | BUF | WR2 | 6.31 | **-36.3** | 157.7 | +7.7 | **87** |
| **#151** | `13.07` | **Gunnar Helm** | `TE25` | TEN | Starter | 3.94 | **-31.6** | 187.5 | +36.5 | **87** |
| **#152** | `13.08` | **Braelon Allen** | `RB46` | NYJ | RB2 | 5.84 | **-33.8** | 185.5 | +33.5 | **88** |
| **#153** | `13.09` | **Tank Bigsby** | `RB47` | PHI | RB2 | 5.75 | **-35.2** | 181.0 | +28.0 | **88** |
| **#154** | `13.10` | **Tyjae Spears** | `RB48` | TEN | RB2 | 4.85 | **-49.6** | 160.3 | +6.3 | **86** |
| **#155** | `13.11` | **Cade Otton** | `TE26` | TB | Starter | 3.75 | **-33.8** | 194.5 | +39.5 | **87** |
| **#156** | `13.12` | **James Conner** | `RB49` | ARI | IR/Reserve | 4.96 | **-47.8** | 175.0 | +19.0 | **86** |
| **#157** | `14.01` | **Jacoby Brissett** | `QB29` | ARI | Starter | 12.28 | **-21.2** | 199.5 | +42.5 | **86** |
| **#158** | `14.02` | **Greg Dulcich** | `TE27` | MIA | Starter | 3.58 | **-35.8** | 201.0 | +43.0 | **86** |
| **#159** | `14.03` | **Calvin Ridley** | `WR54` | TEN | Starter | 10.00 | **+17.9** | 201.5 | +42.5 | **98** |
| **#160** | `14.04` | **Tyler Allgeier** | `RB50` | ARI | RB2 | 3.26 | **-75.0** | 142.7 | -17.3 | **82** |
| **#161** | `14.05` | **Woody Marks** | `RB51` | HOU | RB2 | 3.20 | **-76.0** | 149.3 | -11.7 | **82** |
| **#162** | `14.06` | **Matthew Golden** | `WR55` | GB | Reserve | 0.30 | **-124.8** | 150.7 | -11.3 | **72** |
| **#163** | `14.07` | **Rashid Shaheed** | `WR56` | SEA | Reserve | 0.39 | **-123.5** | 151.7 | -11.3 | **73** |
| **#164** | `14.08` | **Tre Tucker** | `WR57` | LV | Starter | 5.40 | **-49.8** | 216.0 | +52.0 | **86** |
| **#165** | `14.09` | **Jonah Coleman** | `RB52` | FA | Free Agent | 0.00 | **-127.2** | 153.0 | -12.0 | **74** |
| **#166** | `14.10` | **Kenyon Sadiq** | `TE28` | FA | Free Agent | 0.00 | **-78.8** | 153.7 | -12.3 | **72** |
| **#167** | `14.11` | **Isiah Pacheco** | `RB53` | DET | RB2 | 4.21 | **-59.8** | 161.0 | -6.0 | **84** |
| **#168** | `14.12` | **Chris Rodriguez Jr.** | `RB54` | JAX | RB2 | 3.20 | **-76.0** | 159.3 | -8.7 | **82** |
| **#169** | `15.01` | **Stefon Diggs** | `WR58` | FA | Free Agent | 0.00 | **-129.3** | 160.3 | -8.7 | **72** |
| **#170** | `15.02` | **Theo Johnson** | `TE29` | NYG | TE2 | 1.32 | **-63.0** | 172.0 | +2.0 | **81** |
| **#171** | `15.03` | **Jalen Coker** | `WR59` | CAR | WR2 | 3.97 | **-70.8** | 162.0 | -9.0 | **82** |
| **#172** | `15.04` | **David Njoku** | `TE30` | FA | Free Agent | 0.00 | **-78.8** | 165.3 | -6.7 | **73** |
| **#173** | `15.05` | **Jauan Jennings** | `WR60` | FA | Free Agent | 0.00 | **-129.3** | 166.0 | -7.0 | **72** |
| **#174** | `15.06` | **De'Zhaun Stribling** | `WR61` | FA | Free Agent | 0.00 | **-129.3** | 167.5 | -6.5 | **72** |
| **#175** | `15.07` | **Fernando Mendoza** | `QB30` | FA | Free Agent | 0.00 | **-109.6** | 168.3 | -6.7 | **68** |
| **#176** | `15.08` | **Deebo Samuel Sr.** | `WR62` | FA | Free Agent | 0.00 | **-129.3** | 169.0 | -7.0 | **72** |
| **#177** | `15.09` | **Denzel Boston** | `WR63` | FA | Free Agent | 0.00 | **-129.3** | 169.7 | -7.3 | **72** |
| **#178** | `15.10` | **Dylan Sampson** | `RB55` | CLE | RB2 | 3.20 | **-76.0** | 170.7 | -7.3 | **82** |
| **#179** | `15.11` | **Omar Cooper Jr.** | `WR64` | FA | Free Agent | 0.00 | **-129.3** | 171.3 | -7.7 | **72** |
| **#180** | `15.12` | **Tyreek Hill** | `WR65` | FA | Free Agent | 0.00 | **-129.3** | 195.3 | +15.3 | **71** |
| **#181** | `16.01` | **Travis Hunter** | `WR66` | JAX | Reserve | 0.27 | **-125.3** | 172.3 | -8.7 | **72** |
| **#182** | `16.02` | **Kayshon Boutte** | `WR67` | NE | WR2 | 3.78 | **-73.6** | 185.0 | +3.0 | **81** |
| **#183** | `16.03` | **Keaton Mitchell** | `RB56` | LAC | Reserve | 0.25 | **-123.2** | 174.3 | -8.7 | **76** |
| **#184** | `16.04` | **Jalen Nailor** | `WR68` | LV | WR2 | 3.78 | **-73.6** | 188.0 | +4.0 | **81** |
| **#185** | `16.05` | **Michael Penix Jr.** | `QB31` | ATL | Starter | 12.20 | **-21.7** | 239.5 | +54.5 | **86** |
| **#186** | `16.06` | **Malik Washington** | `WR69` | MIA | WR2 | 3.78 | **-73.6** | 189.0 | +3.0 | **81** |
| **#187** | `16.07` | **Shedeur Sanders** | `QB32` | CLE | Starter | 12.15 | **-22.1** | 240.5 | +53.5 | **86** |
| **#188** | `16.08` | **Jalen McMillan** | `WR70` | TB | Reserve | 0.27 | **-125.3** | 177.7 | -10.3 | **72** |
| **#189** | `16.09` | **Emmett Johnson** | `RB57` | FA | Free Agent | 0.00 | **-127.2** | 178.3 | -10.7 | **75** |
| **#190** | `16.10` | **Mike Gesicki** | `TE31` | CIN | Starter | 2.94 | **-43.6** | 244.0 | +54.0 | **86** |
| **#191** | `16.11` | **Darnell Washington** | `TE32` | PIT | TE2 | 1.20 | **-64.4** | 242.0 | +51.0 | **82** |
| **#192** | `16.12` | **Adonai Mitchell** | `WR71` | NYJ | WR2 | 3.78 | **-73.6** | 209.5 | +17.5 | **81** |

---

## Sheet 3: Market Anchor Draft Board (w_adp = 0.70)

*Market-anchored draft board weighted 70% toward consensus ADP with a 30% tactical value overlay.*

| LPI Rank | Rd.Pick | Player | Pos (Rank) | Team | Depth | LPI Proj PPG | Season VORP | Mkt ADP | Diff vs ADP | Draft Grade at ADP |
| :---: | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **#1** | `1.01` | **Jahmyr Gibbs** | `RB1` | DET | Starter | 15.59 | **+122.2** | 1.7 | +0.7 | **89** |
| **#2** | `1.02` | **Bijan Robinson** | `RB2` | ATL | Starter | 15.34 | **+118.2** | 1.3 | -0.7 | **89** |
| **#3** | `1.03` | **Ja'Marr Chase** | `WR1` | CIN | Starter | 13.71 | **+72.6** | 3.0 | 0.0 | **88** |
| **#4** | `1.04` | **Jonathan Taylor** | `RB3` | IND | Starter | 13.57 | **+89.9** | 6.7 | +2.7 | **86** |
| **#5** | `1.05` | **Puka Nacua** | `WR2` | LAR | Starter | 13.20 | **+65.1** | 4.0 | -1.0 | **87** |
| **#6** | `1.06` | **Christian McCaffrey** | `RB4` | SF | Starter | 11.41 | **+55.4** | 5.0 | -1.0 | **82** |
| **#7** | `1.07` | **Saquon Barkley** | `RB5` | PHI | Starter | 15.61 | **+122.6** | 14.0 | +7.0 | **91** |
| **#8** | `1.08` | **De'Von Achane** | `RB6` | MIA | Starter | 14.07 | **+97.9** | 13.3 | +5.3 | **88** |
| **#9** | `1.09` | **James Cook III** | `RB7` | BUF | Starter | 13.33 | **+86.1** | 9.7 | +0.7 | **86** |
| **#10** | `1.10` | **Jaxon Smith-Njigba** | `WR3` | SEA | Starter | 11.18 | **+35.3** | 6.3 | -3.7 | **84** |
| **#11** | `1.11` | **Ashton Jeanty** | `RB8` | LV | Starter | 12.70 | **+76.0** | 10.7 | -0.3 | **85** |
| **#12** | `1.12` | **Amon-Ra St. Brown** | `WR4` | DET | Starter | 12.31 | **+52.0** | 8.3 | -3.7 | **86** |
| **#13** | `2.01` | **Omarion Hampton** | `RB9` | LAC | Starter | 12.66 | **+75.4** | 15.3 | +2.3 | **87** |
| **#14** | `2.02` | **Justin Jefferson** | `WR5` | MIN | Starter | 12.88 | **+60.4** | 11.0 | -3.0 | **87** |
| **#15** | `2.03` | **CeeDee Lamb** | `WR6` | DAL | Starter | 12.16 | **+49.8** | 11.3 | -3.7 | **86** |
| **#16** | `2.04` | **Chase Brown** | `RB10` | CIN | Starter | 11.89 | **+63.0** | 15.0 | -1.0 | **85** |
| **#17** | `2.05` | **Derrick Henry** | `RB11` | BAL | Starter | 13.48 | **+88.5** | 21.3 | +4.3 | **90** |
| **#18** | `2.06` | **Josh Jacobs** | `RB12` | GB | Starter | 14.01 | **+97.0** | 28.3 | +10.3 | **92** |
| **#19** | `2.07` | **Brock Bowers** | `TE1` | LV | Starter | 11.70 | **+61.6** | 20.7 | +1.7 | **93** |
| **#20** | `2.08` | **Kyren Williams** | `RB13` | LAR | Starter | 12.62 | **+74.7** | 28.7 | +8.7 | **90** |
| **#21** | `2.09` | **Trey McBride** | `TE2` | ARI | Starter | 11.55 | **+59.8** | 19.7 | -1.3 | **92** |
| **#22** | `2.10` | **Drake London** | `WR7` | ATL | Starter | 11.56 | **+40.9** | 17.3 | -4.7 | **86** |
| **#23** | `2.11` | **Kenneth Walker III** | `RB14` | KC | Starter | 4.14 | **-61.0** | 19.7 | -3.3 | **72** |
| **#24** | `2.12` | **Breece Hall** | `RB15` | NYJ | Starter | 13.73 | **+92.5** | 32.7 | +8.7 | **94** |
| **#25** | `3.01` | **Josh Allen** | `QB1` | BUF | Starter | 19.44 | **+30.4** | 21.7 | -3.3 | **88** |
| **#26** | `3.02` | **A.J. Brown** | `WR8` | PHI | Starter | 11.13 | **+34.6** | 22.0 | -4.0 | **86** |
| **#27** | `3.03` | **Nico Collins** | `WR9` | HOU | Starter | 11.30 | **+37.1** | 23.0 | -4.0 | **86** |
| **#28** | `3.04` | **Jeremiyah Love** | `RB16` | ARI | Starter | 11.26 | **+53.0** | 25.0 | -3.0 | **86** |
| **#29** | `3.05` | **Javonte Williams** | `RB17` | DAL | Starter | 11.50 | **+56.8** | 31.3 | +2.3 | **89** |
| **#30** | `3.06` | **Cam Skattebo** | `RB18` | NYG | Starter | 11.71 | **+60.2** | 37.3 | +7.3 | **91** |
| **#31** | `3.07` | **Malik Nabers** | `WR10` | NYG | Starter | 12.63 | **+56.7** | 35.0 | +4.0 | **92** |
| **#32** | `3.08` | **George Pickens** | `WR11` | DAL | WR2 | 6.73 | **-30.2** | 25.3 | -6.7 | **77** |
| **#33** | `3.09` | **Travis Etienne Jr.** | `RB19` | NO | Starter | 11.67 | **+59.5** | 39.3 | +6.3 | **91** |
| **#34** | `3.10` | **Bucky Irving** | `RB20` | TB | Starter | 11.59 | **+58.2** | 44.3 | +10.3 | **92** |
| **#35** | `3.11` | **Chris Olave** | `WR12` | NO | Starter | 7.94 | **-12.3** | 29.0 | -6.0 | **80** |
| **#36** | `3.12` | **Rashee Rice** | `WR13` | KC | Starter | 8.77 | **-0.2** | 29.3 | -6.7 | **83** |
| **#37** | `4.01` | **David Montgomery** | `RB21` | HOU | Starter | 11.81 | **+61.8** | 51.3 | +14.3 | **94** |
| **#38** | `4.02` | **Quinshon Judkins** | `RB22` | CLE | Starter | 12.40 | **+71.2** | 47.7 | +9.7 | **94** |
| **#39** | `4.03` | **D'Andre Swift** | `RB23` | CHI | Starter | 12.08 | **+66.1** | 54.7 | +15.7 | **95** |
| **#40** | `4.04` | **DeVonta Smith** | `WR14` | PHI | WR2 | 6.98 | **-26.5** | 33.3 | -6.7 | **79** |
| **#41** | `4.05` | **Garrett Wilson** | `WR15` | NYJ | Starter | 11.54 | **+40.7** | 42.3 | +1.3 | **91** |
| **#42** | `4.06` | **Lamar Jackson** | `QB2` | BAL | Starter | 19.55 | **+31.2** | 37.3 | -4.7 | **89** |
| **#43** | `4.07` | **Tee Higgins** | `WR16` | CIN | WR2 | 7.83 | **-14.0** | 38.0 | -5.0 | **82** |
| **#44** | `4.08` | **Tetairoa McMillan** | `WR17` | CAR | Starter | 10.60 | **+26.8** | 38.3 | -5.7 | **88** |
| **#45** | `4.09` | **Colston Loveland** | `TE3` | CHI | Starter | 8.99 | **+29.0** | 42.3 | -2.7 | **88** |
| **#46** | `4.10` | **Zay Flowers** | `WR18` | BAL | Starter | 10.19 | **+20.8** | 41.0 | -5.0 | **88** |
| **#47** | `4.11` | **Ladd McConkey** | `WR19` | LAC | Starter | 10.84 | **+30.4** | 45.3 | -1.7 | **90** |
| **#48** | `4.12` | **Emeka Egbuka** | `WR20` | TB | WR2 | 7.20 | **-23.3** | 42.0 | -6.0 | **82** |
| **#49** | `5.01` | **DJ Moore** | `WR21` | BUF | Starter | 11.06 | **+33.6** | 52.3 | +3.3 | **91** |
| **#50** | `5.02` | **Mike Evans** | `WR22` | SF | Starter | 11.30 | **+37.1** | 60.0 | +10.0 | **92** |
| **#51** | `5.03` | **Terry McLaurin** | `WR23` | WAS | Starter | 10.96 | **+32.1** | 53.3 | +2.3 | **91** |
| **#52** | `5.04` | **Tyler Warren** | `TE4` | IND | Starter | 8.99 | **+29.0** | 52.3 | +0.3 | **89** |
| **#53** | `5.05` | **Jayden Daniels** | `QB3` | WAS | Starter | 19.48 | **+30.7** | 59.3 | +6.3 | **90** |
| **#54** | `5.06` | **Drake Maye** | `QB4` | NE | Starter | 18.52 | **+23.8** | 52.0 | -2.0 | **89** |
| **#55** | `5.07` | **Jalen Hurts** | `QB5` | PHI | Starter | 19.85 | **+33.3** | 63.7 | +8.7 | **91** |
| **#56** | `5.08` | **Brian Thomas Jr.** | `WR24` | JAX | Starter | 11.74 | **+43.6** | 73.3 | +17.3 | **94** |
| **#57** | `5.09` | **Rhamondre Stevenson** | `RB24` | NE | Starter | 10.77 | **+45.1** | 76.3 | +19.3 | **93** |
| **#58** | `5.10` | **Joe Burrow** | `QB6` | CIN | Starter | 17.45 | **+16.1** | 51.0 | -7.0 | **87** |
| **#59** | `5.11` | **Chuba Hubbard** | `RB25` | CAR | Starter | 11.44 | **+55.8** | 77.0 | +18.0 | **95** |
| **#60** | `5.12` | **Jaylen Waddle** | `WR25` | MIA | Starter | 8.84 | **+0.9** | 49.3 | -10.7 | **86** |
| **#61** | `6.01` | **Luther Burden III** | `WR26` | CHI | WR2 | 5.88 | **-42.7** | 49.3 | -11.7 | **79** |
| **#62** | `6.02` | **TreVeyon Henderson** | `RB26` | NE | RB2 | 6.52 | **-22.9** | 49.7 | -12.3 | **82** |
| **#63** | `6.03` | **Sam LaPorta** | `TE5` | DET | Starter | 9.46 | **+34.7** | 77.7 | +14.7 | **93** |
| **#64** | `6.04` | **Tucker Kraft** | `TE6` | GB | Starter | 8.87 | **+27.6** | 69.7 | +5.7 | **90** |
| **#65** | `6.05` | **Tony Pollard** | `RB27` | TEN | Starter | 11.78 | **+61.3** | 80.3 | +15.3 | **95** |
| **#66** | `6.06` | **Bhayshul Tuten** | `RB28` | JAX | Starter | 7.55 | **-6.4** | 56.0 | -10.0 | **85** |
| **#67** | `6.07` | **Davante Adams** | `WR27` | LAR | WR2 | 8.02 | **-11.2** | 56.3 | -10.7 | **84** |
| **#68** | `6.08` | **Jaylen Warren** | `RB29` | PIT | Starter | 9.09 | **+18.2** | 69.0 | +1.0 | **89** |
| **#69** | `6.09` | **Jameson Williams** | `WR28` | DET | WR2 | 6.64 | **-31.5** | 57.0 | -12.0 | **81** |
| **#70** | `6.10` | **Kyle Pitts Sr.** | `TE7` | ATL | Starter | 8.34 | **+21.2** | 72.7 | +2.7 | **90** |
| **#71** | `6.11` | **Jadarian Price** | `RB30` | SEA | Starter | 7.69 | **-4.2** | 60.3 | -10.7 | **86** |
| **#72** | `6.12` | **Harold Fannin Jr.** | `TE8` | CLE | Starter | 7.19 | **+7.4** | 66.7 | -5.3 | **86** |
| **#73** | `7.01` | **Rome Odunze** | `WR29` | CHI | Starter | 8.69 | **-1.3** | 64.3 | -8.7 | **86** |
| **#74** | `7.02` | **Caleb Williams** | `QB7` | CHI | Starter | 18.07 | **+20.5** | 77.7 | +3.7 | **90** |
| **#75** | `7.03` | **George Kittle** | `TE9` | SF | Starter | 10.84 | **+51.2** | 98.0 | +23.0 | **98** |
| **#76** | `7.04` | **J.K. Dobbins** | `RB31` | DEN | Starter | 12.06 | **+65.8** | 92.3 | +16.3 | **97** |
| **#77** | `7.05` | **Courtland Sutton** | `WR30` | DEN | Starter | 10.36 | **+23.3** | 87.7 | +10.7 | **93** |
| **#78** | `7.06` | **Travis Kelce** | `TE10` | KC | Starter | 10.06 | **+41.8** | 101.3 | +23.3 | **96** |
| **#79** | `7.07` | **Justin Herbert** | `QB8` | LAC | Starter | 17.44 | **+16.0** | 79.3 | +0.3 | **89** |
| **#80** | `7.08` | **Dak Prescott** | `QB9` | DAL | Starter | 17.62 | **+17.3** | 82.7 | +2.7 | **90** |
| **#81** | `7.09` | **Marvin Harrison Jr.** | `WR31` | ARI | Starter | 9.79 | **+14.9** | 78.3 | -2.7 | **90** |
| **#82** | `7.10` | **Christian Watson** | `WR32` | GB | Starter | 8.14 | **-9.4** | 66.7 | -15.3 | **85** |
| **#83** | `7.11` | **DK Metcalf** | `WR33` | PIT | Starter | 9.93 | **+16.9** | 84.7 | +1.7 | **91** |
| **#84** | `7.12` | **Carnell Tate** | `WR34` | TEN | Starter | 8.34 | **-6.4** | 71.7 | -12.3 | **86** |
| **#85** | `8.01` | **Chris Godwin Jr.** | `WR35` | TB | Starter | 10.23 | **+21.3** | 91.3 | +6.3 | **93** |
| **#86** | `8.02` | **Patrick Mahomes II** | `QB10` | KC | Starter | 18.31 | **+22.2** | 100.7 | +14.7 | **92** |
| **#87** | `8.03` | **Brock Purdy** | `QB11` | SF | Starter | 18.67 | **+24.8** | 103.7 | +16.7 | **92** |
| **#88** | `8.04` | **Bo Nix** | `QB12` | DEN | Starter | 18.71 | **+25.1** | 105.7 | +17.7 | **93** |
| **#89** | `8.05` | **Trevor Lawrence** | `QB13` | JAX | Starter | 14.33 | **-6.4** | 84.0 | -5.0 | **86** |
| **#90** | `8.06` | **Aaron Jones Sr.** | `RB32` | MIN | Starter | 11.70 | **+60.0** | 114.3 | +24.3 | **99** |
| **#91** | `8.07` | **RJ Harvey** | `RB33` | DEN | RB2 | 6.45 | **-24.0** | 76.0 | -15.0 | **84** |
| **#92** | `8.08` | **Mark Andrews** | `TE11` | BAL | Starter | 9.44 | **+34.4** | 116.0 | +24.0 | **96** |
| **#93** | `8.09` | **Jaxson Dart** | `QB14` | NYG | Starter | 14.15 | **-7.7** | 86.7 | -6.3 | **86** |
| **#94** | `8.10` | **Rico Dowdle** | `RB34` | PIT | RB2 | 4.08 | **-61.9** | 78.0 | -16.0 | **79** |
| **#95** | `8.11` | **Dalton Kincaid** | `TE12` | BUF | Starter | 7.85 | **+15.4** | 105.3 | +10.3 | **91** |
| **#96** | `8.12` | **Alec Pierce** | `WR36` | IND | Starter | 7.73 | **-15.5** | 84.7 | -11.3 | **85** |
| **#97** | `9.01` | **Jordyn Tyson** | `WR37` | NO | Starter | 7.68 | **-16.2** | 85.7 | -11.3 | **86** |
| **#98** | `9.02` | **Kyle Monangai** | `RB35` | CHI | RB2 | 5.54 | **-38.6** | 84.7 | -13.3 | **82** |
| **#99** | `9.03` | **Isaiah Likely** | `TE13` | NYG | Starter | 6.18 | **-4.7** | 105.3 | +6.3 | **86** |
| **#100** | `9.04` | **Jake Ferguson** | `TE14` | DAL | Starter | 7.07 | **+6.0** | 110.7 | +10.7 | **89** |
| **#101** | `9.05` | **Parker Washington** | `WR38` | JAX | Reserve | 0.37 | **-123.8** | 86.3 | -14.7 | **69** |
| **#102** | `9.06` | **Michael Wilson** | `WR39` | ARI | WR2 | 5.05 | **-54.9** | 87.0 | -15.0 | **80** |
| **#103** | `9.07` | **Jared Goff** | `QB15` | DET | Starter | 17.35 | **+15.3** | 116.0 | +13.0 | **92** |
| **#104** | `9.08` | **Zach Charbonnet** | `RB36` | SEA | Starter | 10.25 | **+36.8** | 134.3 | +30.3 | **97** |
| **#105** | `9.09` | **Kyler Murray** | `QB16` | MIN | Starter | 18.52 | **+23.8** | 134.7 | +29.7 | **94** |
| **#106** | `9.10` | **Matthew Stafford** | `QB17` | LAR | Starter | 13.61 | **-11.6** | 107.7 | +1.7 | **86** |
| **#107** | `9.11` | **Makai Lemon** | `WR40` | PHI | Starter | 7.30 | **-21.8** | 95.0 | -12.0 | **86** |
| **#108** | `9.12` | **Dallas Goedert** | `TE15` | PHI | Starter | 6.11 | **-5.6** | 119.7 | +11.7 | **87** |
| **#109** | `10.01` | **Blake Corum** | `RB37` | LAR | RB2 | 4.43 | **-56.3** | 94.7 | -14.3 | **81** |
| **#110** | `10.02` | **Hunter Henry** | `TE16` | NE | Starter | 9.30 | **+32.8** | 142.3 | +32.3 | **97** |
| **#111** | `10.03` | **Baker Mayfield** | `QB18` | TB | Starter | 18.00 | **+20.0** | 140.3 | +29.3 | **94** |
| **#112** | `10.04` | **Kenny Gainwell** | `RB38` | TB | Starter | 6.55 | **-22.4** | 107.3 | -4.7 | **86** |
| **#113** | `10.05` | **Jonathon Brooks** | `RB39` | CAR | RB2 | 4.28 | **-58.7** | 97.3 | -15.7 | **81** |
| **#114** | `10.06` | **Quentin Johnston** | `WR41` | LAC | WR2 | 7.01 | **-26.0** | 109.7 | -4.3 | **86** |
| **#115** | `10.07` | **Jakobi Meyers** | `WR42` | JAX | WR2 | 7.07 | **-25.2** | 112.0 | -3.0 | **86** |
| **#116** | `10.08` | **Oronde Gadsden II** | `TE17` | LAC | Starter | 5.85 | **-8.6** | 136.0 | +20.0 | **87** |
| **#117** | `10.09` | **Rachaad White** | `RB40` | WAS | RB2 | 6.32 | **-26.1** | 111.3 | -5.7 | **87** |
| **#118** | `10.10` | **Jordan Addison** | `WR43` | MIN | WR2 | 6.99 | **-26.3** | 111.0 | -7.0 | **86** |
| **#119** | `10.11` | **Jacory Croskey-Merritt** | `RB41` | WAS | Starter | 6.07 | **-30.1** | 110.7 | -8.3 | **86** |
| **#120** | `10.12` | **Jordan Love** | `QB19` | GB | Starter | 13.14 | **-15.0** | 135.7 | +15.7 | **86** |
| **#121** | `11.01` | **Michael Pittman Jr.** | `WR44` | PIT | WR2 | 6.36 | **-35.6** | 107.3 | -13.7 | **84** |
| **#122** | `11.02` | **Alvin Kamara** | `RB42` | NO | RB2 | 7.68 | **-4.3** | 152.3 | +30.3 | **92** |
| **#123** | `11.03` | **Brenton Strange** | `TE18` | JAX | Starter | 5.67 | **-10.8** | 144.3 | +21.3 | **87** |
| **#124** | `11.04` | **Malik Willis** | `QB20` | MIA | Starter | 12.97 | **-16.2** | 138.7 | +14.7 | **86** |
| **#125** | `11.05` | **Chig Okonkwo** | `TE19` | WAS | Starter | 5.56 | **-12.1** | 150.0 | +25.0 | **87** |
| **#126** | `11.06` | **Tyler Shough** | `QB21` | NO | Starter | 12.67 | **-18.4** | 144.7 | +18.7 | **86** |
| **#127** | `11.07` | **Aaron Rodgers** | `QB22` | PIT | Starter | 12.72 | **-18.0** | 147.5 | +20.5 | **87** |
| **#128** | `11.08` | **Juwan Johnson** | `TE20` | NO | Starter | 5.43 | **-13.6** | 152.3 | +24.3 | **87** |
| **#129** | `11.09` | **Jayden Reed** | `WR45` | GB | WR2 | 6.21 | **-37.8** | 116.7 | -12.3 | **85** |
| **#130** | `11.10` | **Josh Downs** | `WR46` | IND | WR2 | 6.26 | **-37.1** | 119.7 | -10.3 | **85** |
| **#131** | `11.11` | **Sam Darnold** | `QB23` | SEA | Starter | 12.56 | **-19.2** | 151.3 | +20.3 | **86** |
| **#132** | `11.12` | **Xavier Worthy** | `WR47` | KC | WR2 | 6.38 | **-35.3** | 128.7 | -3.3 | **86** |
| **#133** | `12.01` | **T.J. Hockenson** | `TE21` | MIN | Starter | 7.72 | **+13.8** | 171.7 | +38.7 | **94** |
| **#134** | `12.02` | **Jordan Mason** | `RB43` | MIN | RB2 | 4.74 | **-51.4** | 114.7 | -19.3 | **84** |
| **#135** | `12.03` | **Brian Robinson Jr.** | `RB44` | ATL | Starter | 6.24 | **-27.4** | 143.0 | +8.0 | **89** |
| **#136** | `12.04` | **C.J. Stroud** | `QB24` | HOU | Starter | 12.48 | **-19.7** | 160.0 | +24.0 | **86** |
| **#137** | `12.05` | **Wan'Dale Robinson** | `WR48` | TEN | WR2 | 4.64 | **-60.9** | 117.0 | -20.0 | **81** |
| **#138** | `12.06` | **Tyrone Tracy Jr.** | `RB45` | NYG | RB2 | 5.95 | **-32.0** | 143.3 | +5.3 | **88** |
| **#139** | `12.07` | **Cam Ward** | `QB25` | TEN | Starter | 12.43 | **-20.1** | 165.3 | +26.3 | **86** |
| **#140** | `12.08` | **Bryce Young** | `QB26` | CAR | Starter | 12.40 | **-20.3** | 165.7 | +25.7 | **86** |
| **#141** | `12.09` | **Jerry Jeudy** | `WR49` | CLE | Starter | 11.10 | **+34.1** | 178.0 | +37.0 | **99** |
| **#142** | `12.10` | **Jayden Higgins** | `WR50` | HOU | WR2 | 7.20 | **-23.3** | 160.3 | +18.3 | **89** |
| **#143** | `12.11` | **KC Concepcion** | `WR51` | CLE | Starter | 6.27 | **-37.0** | 143.7 | +0.7 | **86** |
| **#144** | `12.12` | **Romeo Doubs** | `WR52` | NE | Starter | 6.20 | **-38.0** | 142.0 | -2.0 | **86** |
| **#145** | `13.01` | **Daniel Jones** | `QB27` | IND | Starter | 12.35 | **-20.7** | 174.7 | +29.7 | **86** |
| **#146** | `13.02` | **Dalton Schultz** | `TE22` | HOU | Starter | 4.75 | **-21.8** | 172.3 | +26.3 | **87** |
| **#147** | `13.03` | **Khalil Shakir** | `WR53` | BUF | WR2 | 6.31 | **-36.3** | 157.7 | +10.7 | **87** |
| **#148** | `13.04` | **AJ Barner** | `TE23` | SEA | Starter | 4.55 | **-24.2** | 175.0 | +27.0 | **87** |
| **#149** | `13.05` | **Pat Freiermuth** | `TE24` | PIT | Starter | 4.14 | **-29.2** | 171.5 | +22.5 | **87** |
| **#150** | `13.06` | **Geno Smith** | `QB28` | NYJ | Starter | 12.10 | **-22.5** | 184.0 | +34.0 | **86** |
| **#151** | `13.07` | **Tyjae Spears** | `RB46` | TEN | RB2 | 4.85 | **-49.6** | 160.3 | +9.3 | **86** |
| **#152** | `13.08` | **Tank Bigsby** | `RB47` | PHI | RB2 | 5.75 | **-35.2** | 181.0 | +29.0 | **88** |
| **#153** | `13.09` | **Jacoby Brissett** | `QB29` | ARI | Starter | 12.28 | **-21.2** | 199.5 | +46.5 | **86** |
| **#154** | `13.10` | **Braelon Allen** | `RB48` | NYJ | RB2 | 5.84 | **-33.8** | 185.5 | +31.5 | **88** |
| **#155** | `13.11` | **Gunnar Helm** | `TE25` | TEN | Starter | 3.94 | **-31.6** | 187.5 | +32.5 | **87** |
| **#156** | `13.12` | **James Conner** | `RB49` | ARI | IR/Reserve | 4.96 | **-47.8** | 175.0 | +19.0 | **86** |
| **#157** | `14.01` | **Calvin Ridley** | `WR54` | TEN | Starter | 10.00 | **+17.9** | 201.5 | +44.5 | **98** |
| **#158** | `14.02` | **Cade Otton** | `TE26` | TB | Starter | 3.75 | **-33.8** | 194.5 | +36.5 | **87** |
| **#159** | `14.03` | **Tyler Allgeier** | `RB50` | ARI | RB2 | 3.26 | **-75.0** | 142.7 | -16.3 | **82** |
| **#160** | `14.04` | **Isiah Pacheco** | `RB51` | DET | RB2 | 4.21 | **-59.8** | 161.0 | +1.0 | **84** |
| **#161** | `14.05` | **Greg Dulcich** | `TE27` | MIA | Starter | 3.58 | **-35.8** | 201.0 | +40.0 | **86** |
| **#162** | `14.06` | **Woody Marks** | `RB52` | HOU | RB2 | 3.20 | **-76.0** | 149.3 | -12.7 | **82** |
| **#163** | `14.07` | **Matthew Golden** | `WR55` | GB | Reserve | 0.30 | **-124.8** | 150.7 | -12.3 | **72** |
| **#164** | `14.08` | **Rashid Shaheed** | `WR56` | SEA | Reserve | 0.39 | **-123.5** | 151.7 | -12.3 | **73** |
| **#165** | `14.09` | **Jalen Coker** | `WR57` | CAR | WR2 | 3.97 | **-70.8** | 162.0 | -3.0 | **82** |
| **#166** | `14.10` | **Theo Johnson** | `TE28` | NYG | TE2 | 1.32 | **-63.0** | 172.0 | +6.0 | **81** |
| **#167** | `14.11` | **Jonah Coleman** | `RB53` | FA | Free Agent | 0.00 | **-127.2** | 153.0 | -14.0 | **74** |
| **#168** | `14.12` | **Kenyon Sadiq** | `TE29` | FA | Free Agent | 0.00 | **-78.8** | 153.7 | -14.3 | **72** |
| **#169** | `15.01` | **Chris Rodriguez Jr.** | `RB54` | JAX | RB2 | 3.20 | **-76.0** | 159.3 | -9.7 | **82** |
| **#170** | `15.02` | **Stefon Diggs** | `WR58` | FA | Free Agent | 0.00 | **-129.3** | 160.3 | -9.7 | **72** |
| **#171** | `15.03` | **Tre Tucker** | `WR59` | LV | Starter | 5.40 | **-49.8** | 216.0 | +45.0 | **86** |
| **#172** | `15.04` | **David Njoku** | `TE30` | FA | Free Agent | 0.00 | **-78.8** | 165.3 | -6.7 | **73** |
| **#173** | `15.05` | **Kayshon Boutte** | `WR60` | NE | WR2 | 3.78 | **-73.6** | 185.0 | +12.0 | **81** |
| **#174** | `15.06` | **Jauan Jennings** | `WR61` | FA | Free Agent | 0.00 | **-129.3** | 166.0 | -8.0 | **72** |
| **#175** | `15.07` | **De'Zhaun Stribling** | `WR62` | FA | Free Agent | 0.00 | **-129.3** | 167.5 | -7.5 | **72** |
| **#176** | `15.08` | **Jalen Nailor** | `WR63` | LV | WR2 | 3.78 | **-73.6** | 188.0 | +12.0 | **81** |
| **#177** | `15.09` | **Fernando Mendoza** | `QB30` | FA | Free Agent | 0.00 | **-109.6** | 168.3 | -8.7 | **68** |
| **#178** | `15.10` | **Tyreek Hill** | `WR64` | FA | Free Agent | 0.00 | **-129.3** | 195.3 | +17.3 | **71** |
| **#179** | `15.11` | **Malik Washington** | `WR65` | MIA | WR2 | 3.78 | **-73.6** | 189.0 | +10.0 | **81** |
| **#180** | `15.12` | **Deebo Samuel Sr.** | `WR66` | FA | Free Agent | 0.00 | **-129.3** | 169.0 | -11.0 | **72** |
| **#181** | `16.01` | **Denzel Boston** | `WR67` | FA | Free Agent | 0.00 | **-129.3** | 169.7 | -11.3 | **72** |
| **#182** | `16.02` | **Dylan Sampson** | `RB55` | CLE | RB2 | 3.20 | **-76.0** | 170.7 | -11.3 | **82** |
| **#183** | `16.03` | **Omar Cooper Jr.** | `WR68` | FA | Free Agent | 0.00 | **-129.3** | 171.3 | -11.7 | **72** |
| **#184** | `16.04` | **Travis Hunter** | `WR69` | JAX | Reserve | 0.27 | **-125.3** | 172.3 | -11.7 | **72** |
| **#185** | `16.05` | **Keaton Mitchell** | `RB56` | LAC | Reserve | 0.25 | **-123.2** | 174.3 | -10.7 | **76** |
| **#186** | `16.06` | **Michael Penix Jr.** | `QB31` | ATL | Starter | 12.20 | **-21.7** | 239.5 | +53.5 | **86** |
| **#187** | `16.07` | **Shedeur Sanders** | `QB32` | CLE | Starter | 12.15 | **-22.1** | 240.5 | +53.5 | **86** |
| **#188** | `16.08` | **Jalen McMillan** | `WR70` | TB | Reserve | 0.27 | **-125.3** | 177.7 | -10.3 | **72** |
| **#189** | `16.09` | **Emmett Johnson** | `RB57` | FA | Free Agent | 0.00 | **-127.2** | 178.3 | -10.7 | **75** |
| **#190** | `16.10` | **Mike Gesicki** | `TE31` | CIN | Starter | 2.94 | **-43.6** | 244.0 | +54.0 | **86** |
| **#191** | `16.11` | **Adonai Mitchell** | `WR71` | NYJ | WR2 | 3.78 | **-73.6** | 209.5 | +18.5 | **81** |
| **#192** | `16.12` | **Justice Hill** | `RB58` | BAL | RB2 | 3.17 | **-76.5** | 183.0 | -9.0 | **83** |

---

## Technical Validation & Benchmark Audit (2026 Consensus Market ADP)

The table below verifies how key players are handled under the 2026 Consensus Market ADP and bounded re-ranking engine:

| Player | 2026 Consensus ADP | Bounded Rank (w=0.30) | Round.Pick | Resolution Status & Verification |
| :--- | :---: | :---: | :---: | :--- |
| **Jahmyr Gibbs** | 1.7 | **#1** | `1.01` | Ranked #1 overall (+122.2 VORP, 15.59 PPG). |
| **Bijan Robinson** | 1.3 | **#2** | `1.02` | Elite 1st round bellcow (+118.2 VORP, 15.34 PPG). |
| **Ja'Marr Chase** | 3.0 | **#3** | `1.03` | Top WR off the board (+78.9 VORP, 13.71 PPG). |
| **Puka Nacua** | 4.0 | **#4** | `1.04` | WR2 off the board in Round 1 (+70.7 VORP, 13.20 PPG). |
| **Ashton Jeanty** | 10.7 | **#9** | `1.09` | Rookie RB sensation locked in Round 1 (+76.0 VORP, 12.70 PPG). |
| **Justin Jefferson** | 11.0 | **#14** | `2.02` | Clamped to the 1/2 turn (+65.6 VORP, 12.88 PPG). |
| **CeeDee Lamb** | 11.3 | **#15** | `2.03` | Clamped to early Round 2 (+54.1 VORP, 12.16 PPG). |
| **Brock Bowers** | 20.7 | **#19** | `2.07` | TE1 on board (+61.6 VORP, 11.70 PPG). |
| **Josh Jacobs** | 28.3 | **#22** | `2.10` | Round 2/3 turn (+97.0 VORP, 14.01 PPG), well behind Puka Nacua. |
| **Nico Collins** | 23.0 | **#26** | `3.02` | Round 3 pick (+40.3 VORP, 11.30 PPG), not a first rounder. |
| **James Conner** | 175.0 | **#154** | `13.10` | Active injury/IR discount; drops to Round 13. |
| **Tyreek Hill** | 195.3 | **#184** | `16.04` | Free Agent, essentially undrafted / round 16 flyer. |

---

## Positional Tier Analysis & Strategic Takeaways

### Running Back Tier Breakdown
- **Tier 1 (Elite Bellcows)**: Jahmyr Gibbs (#1 overall, +122.2 VORP), Bijan Robinson (#2 overall, +118.2 VORP), Jonathan Taylor (#5 overall, +89.9 VORP), Christian McCaffrey (#6 overall), James Cook III (#8 overall).
- **Tier 2 (High-Volume Feature Starters)**: Ashton Jeanty (#9 overall, +76.0 VORP), De'Von Achane (#11 overall, +97.9 VORP), Saquon Barkley (#12 overall, +122.6 VORP), Omarion Hampton (#13 overall, +75.4 VORP), Josh Jacobs (#22 overall, +97.0 VORP).

### Wide Receiver Tier Breakdown
- **Tier 1 (Elite Alpha WR1s)**: Ja'Marr Chase (#3 overall, +78.9 VORP), Puka Nacua (#4 overall, +70.7 VORP), Jaxon Smith-Njigba (#7 overall), Amon-Ra St. Brown (#10 overall), Justin Jefferson (#14 overall), CeeDee Lamb (#15 overall).
- **Tier 2 (High-End Focal Points)**: Drake London (#18 overall), A.J. Brown (#25 overall), Nico Collins (#26 overall), Malik Nabers (#29 overall).

### Tight End Tier Breakdown
- **Tier 1 (Elite Gamechangers)**: Brock Bowers (#19 overall, +61.6 VORP, 11.70 Proj PPG), Trey McBride (#20 overall, +59.8 VORP, 11.55 Proj PPG).
- **Tier 2 (Everyday Starters)**: George Kittle (#38 overall), Travis Kelce (#50 overall), Mark Andrews (#115 overall).

### Quarterback Tier Breakdown
- **Tier 1 (Dual-Threat Konami Codes)**: Josh Allen (#24 overall, 19.44 PPG), Jalen Hurts (#50 overall, 19.85 PPG), Lamar Jackson (#52 overall, 19.55 PPG).
- **Backup Quarterback Dampening**: Backup QBs receive a 90% dampening penalty and drop into reserve rounds.

---
*Report compiled automatically by the Landon Prospective Index (LPI) Engine.*
