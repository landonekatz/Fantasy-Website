# Engineering Specification: Deterministic Fantasy League Newsletter Engine

## 1. System Overview & Ingestion Cadence

The newsletter engine functions as a deterministic anomaly-detection and narrative-generation pipeline. It scans the complete historical and contemporary state of the league database, calculates statistical deviations ($Z$-scores), enforces narrative decay and managerial equity rules, and outputs editorial copy using tokenized templates.

### 1.1 Ingestion & Dispatch Schedule

```
                 [Normal Week]
```

Tuesday 20:00 UTC: Official NFL/Elias Stat Corrections Finalized  
Wednesday 04:00 UTC: League Waivers / FAAB Processed  
Wednesday 06:00 UTC: Newsletter Engine Executes & Dispatches  
Thursday 00:15 UTC: Thursday Night Football Locks Lineups

```
             [Wednesday Kickoff Week]
```

Tuesday 20:00 UTC: Official Stat Corrections Finalized  
Tuesday 22:00 UTC: Emergency/Early Waiver Processing (if configured)  
Tuesday 23:00 UTC OR Wednesday 12:00 PM Local: Newsletter Dispatched  
Wednesday Kickoff: Lineups Lock for Active Wednesday Players

#### Dispatch Scheduling Logic

$$\text{Dispatch Timestamp} = \min\left(\text{Wednesday 06:00 UTC}, \; T_{\text{first\_kickoff}} - 3\text{ hours}\right)$$

*Condition:* If $\text{Dispatch Timestamp} \le \text{Wednesday 06:00 UTC}$, the engine pulls from the Tuesday 20:00 UTC stat-correction snapshot and whatever waiver wire transactions cleared prior to execution.

---

## 2. Proprietary Metric Definitions

* **LDI (Landon Draft Index):** Retrospective metric evaluating historical drafts. Grades return on draft capital by comparing actual fantasy point output against historical positional draft position baselines.
* **LPI (Landon Prospect / Pre-Season Index):** Forward-looking metric used during the pre-season and pre-kickoff phases when zero regular season games have been played. Evaluates initial roster strength, schedule strength, and player opportunity projections.
* **LTI (Landon Transaction Index):** Transactional grading metric evaluating waiver adds, FAAB spending efficiency, and trades. Calculates the net surplus value gained or conceded in any asset exchange.

---

## 3. Mathematical Scoring, Anomaly Detection & Curation Budget

To prevent newsletter fatigue and eliminate robotic repetition, all candidate storylines are scored, penalized for recency, balanced for managerial representation, and filtered into a strict publication budget.

### 3.1 The Anomaly Score ($Z$)

For any metric $x$ with an all-time league historical mean $\mu$ and standard deviation $\sigma$:

$$Z = \frac{x - \mu}{\sigma}$$

### 3.2 The Narrative Fatigue & Recency Penalty ($D(t)$)

To ensure the same storyline does not dominate consecutive weeks:

$$D(t) = \exp(-\lambda \cdot \Delta t)$$

* $\Delta t$: Number of weeks since this specific trigger archetype was featured.
* $\lambda = 0.693$ (Half-life = 1 week. A trigger featured last week receives an automatic 50% score penalty).

### 3.3 Manager Exposure Equity Multiplier ($E(m)$)

To guarantee every manager is featured throughout the season:

$$E(m) = 1.0 + \gamma \cdot \left(\overline{F} - F_m\right)$$

* $F_m$: Number of times Manager $m$ has been featured in a headline or spotlight this season.
* $\overline{F}$: League-wide average features per manager.
* $\gamma = 0.25$: Sensitivity coefficient.

### 3.4 Master Composite Narrative Score ($S$)

$$S = |Z| \times W_{\text{category}} \times D(t) \times \prod_{m \in \text{Managers}} E(m)$$

#### Category Base Weights ($W_{\text{category}}$)

* **Late-Season Playoff / Toilet Bowl Leverage:** $2.5$
* **Fandom Betrayal / Treason Fallout:** $2.0$
* **All-Time Historical Record Breached:** $2.0$
* **Rivalry / Bogey / Revenge Matchups:** $1.7$
* **Bad Beats & Coaching Inefficiency:** $1.4$
* **LTI Transactions & FAAB Autopsies:** $1.3$
* **Draft Capital & LDI Retrospectives:** $1.1$
* **Situational / Game-Window Quirks:** $1.0$

### 3.5 Publication Budget

The engine selects exactly:

1. **Lead Headline (Slot 1):** Highest composite score overall.
2. **Matchup Spotlights (Slots 2 & 3):** Top two highest-scoring matchup previews from distinct games.
3. **The Transaction / Wire Desk (Slot 4):** Top-scoring LTI/FAAB event.
4. **Deep League Lore & Records (Slot 5):** Top-scoring historical record, milestone, or multi-year anomaly.
5. **Personalized "My Dossier" (Slot 6):** User-isolated analytical intelligence.

---

## 4. Master Trigger Catalog & Narrative Archetypes

### Module 1: Late-Season Leverage & Playoff Permutations (Weeks 10–17)

#### 1.1 The Playoff Leverage Index (PLI)

* **Trigger:** Monte Carlo simulation identifying the matchup with the largest aggregate swing in postseason probability ($\Delta P(\text{Playoffs})$).
* **Angle:** Highlights the single game on which the entire postseason bracket hinges.

#### 1.2 The "Chaos Agent" / Spoiler Alert

* **Trigger:** Mathematically eliminated manager playing a bubble manager ($0.25 \le P(\text{Playoffs}) \le 0.75$).
* **Angle:** Unburdened cellar team playing strictly for spite to ruin a rival's season.

#### 1.3 The Clinch Matrix (Exact Arithmetic)

* **Trigger:** Team can clinch a playoff spot or bye based on exact mathematical conditions in the upcoming week.
* **Angle:** Replaces vague generalities with explicit scenarios: "Clinches with a win OR [Loss + Team B Loss + Scoring $\ge 92.4$ PF]."

#### 1.4 The Points-Tiebreaker Armageddon

* **Trigger:** Standings seeds 4 through 7 separated by $\le 1$ win where total Points For (PF) is separated by $< 20$ aggregate points.
* **Angle:** Explains that the final playoff spots will not be determined by wins, but by decimal points on Sunday afternoon.

#### 1.5 The Sacko / Toilet Bowl Watch

* **Trigger:** Bottom 3 teams; calculates mathematical risk of finishing in last place and enduring the league punishment.
* **Angle:** Quantifies survival odds, tracking managers who historically escape the cellar by narrow margins.

#### 1.6 The Playoff Bracket Heartbreak

* **Trigger:** Postseason game decided by $< 3.0$ points, or the #1 seed eliminated by the lowest seed.
* **Angle:** Recaps postseason agony, failed dynasty runs, and bracket-busting upsets.

#### 1.7 The Sacko Bowl of Shame (Consolation Finals)

* **Trigger:** Final matchup of the consolation bracket; loser receives the league punishment.
* **Angle:** The game nobody wants to win, but nobody can afford to lose.

#### 1.8 Championship Coronation

* **Trigger:** Championship game concludes; winner claims the trophy.
* **Angle:** Comprehensive retrospective of the champion’s path, LDI draft grade, LTI transactions, and all-time title count.

---

### Module 2: Historical Matchup & Rivalry Dynamics

#### 2.1 The Bogey Opponent (The Kryptonite)

* **Trigger:** Manager A career win rate $\ge 60\%$, Manager B career win rate $\le 45\%$, but Manager B leads the head-to-head series by $\ge 3$ games.
* **Angle:** An otherwise dominant powerhouse who inexplicably loses to a bottom-tier manager.

#### 2.2 The Scoring Paradox

* **Trigger:** Manager A leads the head-to-head series (e.g., 7–3), but Manager B has scored more aggregate points across those matchups.
* **Angle:** Demonstrates how schedule luck has inverted a multi-year rivalry.

#### 2.3 The Historic Drought

* **Trigger:** Winless streak against an opponent spanning $\ge 3$ distinct seasons or $\ge 1,000$ calendar days.
* **Angle:** Focuses on the psychological weight of a multi-year losing streak.

#### 2.4 The Margin of Victory Outlier

* **Trigger:** Average head-to-head margin of victory is either $< 4.5$ points ("Cardiac Series") or $> 35.0$ points ("Perpetual Beatdown").
* **Angle:** Examines whether two managers historically stage nail-biters or blowouts.

#### 2.5 The Post-Season Revenge Game / Knockout Anniversary

* **Trigger:** First regular-season meeting between two managers since one eliminated the other from the playoffs in a previous season.
* **Angle:** Re-ignites past postseason bad blood and highlights the opportunity for payback.

#### 2.6 The Title Deed (Master vs. Apprentice)

* **Trigger:** Head-to-head career win rate $\ge 75\%$ over a minimum sample of 6 games.
* **Angle:** Highlights absolute ownership between two managers over league history.

#### 2.7 The Stat-Correction Trauma Unit

* **Trigger:** Upcoming matchup features managers whose last meeting was decided by Tuesday official stat corrections ($< 1.0$ point margin flip).
* **Angle:** Recalls the trauma of waking up to a reversed outcome.

---

### Module 3: Managerial Competence & "Coaching" Decisions

#### 3.1 The Bench Warmer Hall of Fame

* **Trigger:** Total Bench PF $>$ Total Starting PF, OR a single benched player outscores the starter at the same position by $\ge 20.0$ points.
* **Angle:** Highlights coaching malpractice where the winning points were stranded on the bench.

#### 3.2 Lineup Optimization Rating (Coaching Efficiency)

* **Trigger:** $(\text{Actual PF} / \text{Optimal PF}) \times 100$. Fires for either perfection ($100\%$) or catastrophe ($< 70\%$).
* **Angle:** Quantifies how much potential a manager extracted from their available roster.

#### 3.3 The Sunday 12:55 PM Tinkering Penalty

* **Trigger:** A starter swapped out $< 30$ minutes before kickoff; removed player outscores the inserted player by enough to flip the matchup result.
* **Angle:** Details self-sabotage caused by last-second panic.

#### 3.4 The Empty Suit (Floor/Ceiling Divergence)

* **Trigger:** A starter scores $\le 0.0$ points while the team still wins, OR a single player accounts for $\ge 40\%$ of the team's entire starting score.
* **Angle:** Analyzes winning with dead weight versus one-man-army performances.

---

### Module 4: Transactions, FAAB & The Trade Economy (LTI & LDI)

#### 4.1 The All-Time LTI Trade Ledger

* **Trigger:** Two managers trade or face each other after historical trades; query sums net career LTI surplus value exchanged.
* **Angle:** Evaluates who has won the long-term trade war between two franchises.

#### 4.2 Trade Remorse / The Homecoming Game

* **Trigger:** Upcoming matchup features a player facing the manager who traded or dropped them earlier that season.
* **Angle:** The psychological revenge game: will the cast-off asset end their former manager's week?

#### 4.3 FAAB Splurge Autopsy (Bidder Paranoia)

* **Trigger:** Single bid $\ge 30\%$ of total starting budget where the next closest bid was $\le 10\%$ or $\$0$.
* **Angle:** Exposes a manager bidding heavily against their own shadow.

#### 4.4 The $0 FAAB Hero

* **Trigger:** A $\$0$ waiver claim or free agent pickup finishes inside the top 12 at their position that week.
* **Angle:** Praises budget discipline and finding gold in the garbage bin.

#### 4.5 The Veto Ghost / Rejected Trade Karma

* **Trigger:** A proposed-and-rejected trade where the rejected assets heavily outscore the manager who declined them.
* **Angle:** Exposes missed opportunities and the consequences of trade stubbornness.

#### 4.6 The Panic Seller / Roster Burn Index

* **Trigger:** A player cut or traded away exceeds their prior scoring average by $\ge 30\%$ over the following 3 weeks on a rival roster.
* **Angle:** Sums the total points former assets have scored against the league since being discarded.

---

### Module 5: Draft Capital, Pedigree & Long-Term Roster Construction

#### 5.1 The Ship of Theseus Index

* **Trigger:** Ratio of drafted players currently remaining on the active roster.
* **Angle:** Compares the "Draft Purist" ($> 80\%$ retained) against the "Chaos Manager" ($< 25\%$ retained).

#### 5.2 Draft Remorse / The Bust Benchmark (LDI Retro)

* **Trigger:** Round 1 or 2 pick performing below the 20th percentile of their position, or a Round 10+ pick leading the team in scoring.
* **Angle:** Connects weekly outcomes back to draft-day capital allocation using LDI scores.

#### 5.3 Draft Loyalty

* **Trigger:** Player drafted in Rounds 10–16 rostered through Week 8+ while averaging $< 3.0$ PPG and never being started.
* **Angle:** Mocks stubborn emotional attachment to unproductive late-round picks.

#### 5.4 The "Draft Class of [Year]" Legacy

* **Trigger:** Head-to-head matchup featuring opposing starters from the same NFL draft class at the same position.
* **Angle:** Frames the matchup around collegiate or real-life NFL draft class rivalries.

---

### Module 6: Schedule Luck, Karma & The "Illusion of Skill"

#### 6.1 The Fraud Alert (Expected vs. Actual Record)

* **Trigger:** Substantial divergence between standings rank and All-Play record rank ($11 \times \text{Weeks}$).
* **Angle:** Identifies top-tier teams coasting on low opponent scoring versus juggernauts trapped at the bottom.

#### 6.2 The "Wrong Place, Wrong Time" Award

* **Trigger:** Opponents' weekly scores against Manager A exceed those opponents' season-long scoring medians by $\ge 15.0$ PPG.
* **Angle:** Proves mathematically that a manager is the league's primary lightning rod for opponent boom games.

#### 6.3 The Zombie Win

* **Trigger:** A team wins their weekly matchup with a score that ranks in the bottom 20th percentile of league scoring for that week.
* **Angle:** Roasts an ugly, undeserved win that would have lost to almost every other team.

#### 6.4 The Highest-Scoring Loser (Hard Luck Trophy)

* **Trigger:** A team finishes 2nd in league-wide weekly scoring but loses to the #1 scorer.
* **Angle:** Commemorates elite point totals wasted against an unstoppable opponent.

#### 6.5 The Median Reality Check & Whiplash

* **Trigger:** Calculates standings deltas if the league used an extra weekly matchup against the median.
* **Angle:** Shows which teams would plummet without schedule protection and which would surge.

---

### Module 7: Game-Window Dynamics, Calendar Quirks & Situational Traps

#### 7.1 The Monday Night Miracle Index (The Cardiac Ledger)

* **Trigger:** Matchups entering Monday night with a margin $\le 15.0$ points where active players remain.
* **Angle:** Ranks managers by their career win-loss record and clutch rating in Monday night finishes.

#### 7.2 The Monday Night Sweat Factor (Sitting Duck vs. The Hunt)

* **Trigger:** Team A completes all games by Sunday afternoon, while Team B enters Sunday night / Monday night trailing with multiple starters active.
* **Angle:** Calculates the historical survival rate of the "sitting duck" waiting out an opponent's final players.

#### 7.3 The 9:30 AM London Trap

* **Trigger:** Starter playing in an overseas morning game; evaluates historical manager alertness.
* **Angle:** Flags instances where managers started inactive/injured players due to early morning lockout times.

#### 7.4 The Thursday Night Trap

* **Trigger:** Roster analysis of upcoming Thursday night starters; compares historical performance on Thursday vs. Sunday/Monday.
* **Angle:** Quantifies whether a manager historically falls into the trap of Thursday night duds.

#### 7.5 The Thursday Night Hangover

* **Trigger:** A manager starts a Thursday player who scores $< 5.0$ points.
* **Angle:** Tracks whether starting the week in a hole induces panicked weekend lineup shuffling.

#### 7.6 Bye-Week Triage

* **Trigger:** Current starting roster features $\ge 3$ core starters on bye.
* **Angle:** Analyzes the manager's career record when navigating severe bye-week roster holes.

#### 7.7 The Daylight Savings / Post-Halloween Cliff

* **Trigger:** Compares career winning percentage in Weeks 1–7 versus Weeks 8–14 across all seasons.
* **Angle:** Highlights historical second-half collapses or late-season surges.

#### 7.8 The Wednesday Kickoff Anomaly

* **Trigger:** NFL game scheduled for Wednesday; triggers compressed waiver and preview workflows.
* **Angle:** Highlights the strange pacing, short turnaround times, and early roster lockouts.

---

### Module 8: The Real-Life Fandom & Betrayal Matrix

#### 8.1 The Emotional Hedge / Hostile Takeover (Pre-Game)

* **Trigger:** Manager starts $\ge 2$ skill players (or starting QB) playing against their declared favorite NFL team.
* **Angle:** Calling out the manager for financially and emotionally hedging against their own franchise.

#### 8.2 The Serial Traitor (3+ Weeks Running)

* **Trigger:** Manager starts players opposing their favorite NFL team for $\ge 3$ consecutive weeks.
* **Angle:** Suggests the manager is actively targeting their own team's defensive weaknesses for fantasy gain.

#### 8.3 The Judas Starter (Division Treason)

* **Trigger:** Manager starts a star player from their favorite NFL team's primary division rival (e.g., Packers fan starting a Bears QB).
* **Angle:** Highlights moral compromises in the pursuit of fantasy points.

#### 8.4 The Masochist Special (Opposing Defense)

* **Trigger:** Manager starts the D/ST playing directly against their favorite NFL team.
* **Angle:** Tracks a manager actively cheering for pick-sixes against their own real-life quarterback.

#### 8.5 The Homer Tax

* **Trigger:** Manager starts $\ge 2$ players from their favorite NFL team; compares win rates with vs. without them.
* **Angle:** Measures the financial and competitive cost of unyielding real-world loyalty.

#### 8.6 Fandom Fallout: "Worst of Both Worlds" (Post-Game)

* **Trigger:** Real NFL team lost; fantasy matchup was lost; hedge players started.
* **Angle:** Complete catastrophe: real team loses, fantasy team loses, zero return on betrayal.

#### 8.7 Fandom Fallout: "The Deal with the Devil" (Post-Game)

* **Trigger:** Real NFL team lost; fantasy matchup was won with hedge players contributing $\ge 20\%$ of team scoring.
* **Angle:** Blood money victory: sold out the real-life team, but collected the win in the standings.

#### 8.8 Fandom Fallout: "Suffering from Success" (Post-Game)

* **Trigger:** Real NFL team won; fantasy matchup was lost because favorite defense shut down the manager's hedge players.
* **Angle:** Real team won, but shut down the manager's fantasy assets in the process.

#### 8.9 Fandom Fallout: "Cake and Eating It" (Post-Game)

* **Trigger:** Real NFL team won; fantasy matchup was won despite hedge players being active.
* **Angle:** Flawless escape: celebrated the real-life win and cashed the fantasy check with zero consequences.

---

### Module 9: Roster Chemistry, Stacks & Positional Archetypes

#### 9.1 The QB/WR Stack Dependency Index

* **Trigger:** Manager starts a same-team QB + Pass Catcher stack.
* **Angle:** Calculates the team's historical record when the stack hits ($> 35$ pts) versus when it duds ($< 25$ pts).

#### 9.2 The Positional Graveyard

* **Trigger:** Career analysis showing a manager has consistently underperformed league averages at a specific position (e.g., TE) for $\ge 2$ seasons.
* **Angle:** Highlights an inability to solve a specific roster spot across multiple years.

#### 9.3 The Iron Horse vs. The Glass House

* **Trigger:** Tracks total starter games lost to injury/IR across multi-year histories.
* **Angle:** Contrasts exceptionally durable rosters against injury-riddled triage units.

#### 9.4 The Hoarder vs. Streamer Archetype

* **Trigger:** Compares add/drop frequency at Kicker and D/ST across seasons.
* **Angle:** Pits the active streaming tactician against the set-and-forget lazy manager.

---

### Module 10: Deep Lore, Dynasties & All-Time Milestones

#### 10.1 The Century Club / Point Milestones

* **Trigger:** Manager within 100 points of major career scoring milestones (10k, 15k, 20k PF).
* **Angle:** Calculates exact points needed in the upcoming game to cross historical round numbers.

#### 10.2 The "Unluckiest Team in League History" (The Glass Cannon)

* **Trigger:** Manager ranks in top 20% of all-time Points For, but bottom 30% of all-time Win Percentage.
* **Angle:** Quantifies long-term schedule cruelty over multi-year samples.

#### 10.3 Record Book Breachers

* **Trigger:** A weekly score, player performance, or margin enters the platform's all-time Top 5 or Bottom 5.
* **Angle:** Puts contemporary games in context with historic league milestones.

#### 10.4 The Dynasty / Era Tracker

* **Trigger:** Rolling 20-game win percentage across multiple seasons.
* **Angle:** Tracks historically dominant multi-year runs or generational slumps.

---

## 5. Tokenized 10-Variant Copy Banks

The engine deterministically selects 1 of 10 variants using:

$$\text{Variant Index} = \left(\text{Hash}(\text{LeagueID} + \text{Season} + \text{Week} + \text{TriggerID}) + \sum \text{ManagerIDs}\right) \pmod{10}$$

### Archetype 1: The Sunday 12:55 PM Tinkering Penalty (Trigger 3.3)

* **Variant 0:** "Step away from the phone. At {swap_time} on Sunday—just minutes before kickoff—{manager_name} pulled {benched_player} for {started_player}. {benched_player} scored {benched_pts}, {started_player} put up {started_pts}, and {manager_name} dropped the matchup by {margin}."
* **Variant 1:** "The Sunday morning overthink claims another victim. {manager_name} couldn't resist tinkering at {swap_time}, swapping {benched_player} for {started_player}. That single impulse decision cost {point_delta} points and a win."
* **Variant 2:** "A fatal last-second panic. {manager_name} pulled {benched_player} in favor of {started_player} right before lock. The result? A {margin}-point loss to {opponent_name} that rests entirely on coaching self-sabotage."
* **Variant 3:** "Do not tinker. {manager_name} had the winning lineup locked in until {swap_time}, when they subbed in {started_player} ({started_pts} pts) over {benched_player} ({benched_pts} pts). {opponent_name} collects the victory as a result."
* **Variant 4:** "A self-inflicted {point_delta}-point disaster. {manager_name} talked themselves into {started_player} at the eleventh hour, stranding {benched_player}'s {benched_pts} points on the pine."
* **Variant 5:** "The 12:55 PM itch proved catastrophic. Swapping out {benched_player} at the buzzer turned a projected {proj_margin}-point victory into an agonizing {margin}-point defeat."
* **Variant 6:** "Coaching malpractice at {swap_time}. {manager_name} over-analyzed the matchup, benched {benched_player}, and started {started_player}. Final deficit: {margin} points."
* **Variant 7:** "{opponent_name} owes {manager_name} a drink. Had {manager_name} simply left the lineup alone at {swap_time}, {benched_player}'s {benched_pts} points would have sealed the win."
* **Variant 8:** "The last-minute lineup swap strikes again. {manager_name} moved {benched_player} to the bench right before lock, leaving the winning points stranded."
* **Variant 9:** "Tinkering is a dangerous habit, and {manager_name} learned that the hard way on Sunday. Pulling {benched_player} at {swap_time} cost the matchup, the points, and the bragging rights."

### Archetype 2: The Monday Night Miracle Index (Trigger 7.1)

* **Variant 0:** "Monday Night Drama: {winner_name} trailed by {pre_mnf_deficit} entering Monday night, but rode {mnf_hero}'s {mnf_hero_pts}-point performance to snatch a {margin}-point victory from {loser_name}."
* **Variant 1:** "A gut-wrenching Monday finish for {loser_name}. Holding a {pre_mnf_lead}-point lead with only {winner_name}'s {mnf_hero} left to play, {loser_name} watched their victory slip away in the fourth quarter."
* **Variant 2:** "{winner_name} pulls off the Monday night escape. Down {pre_mnf_deficit} points with zero margin for error, {mnf_hero} posted {mnf_hero_pts} points to secure a {margin}-point comeback over {loser_name}."
* **Variant 3:** "The Monday night sweat ended in heartbreak for {loser_name}. A {pre_mnf_lead}-point cushion wasn't enough to withstand {winner_name}'s {mnf_hero}, who sealed the comeback late."
* **Variant 4:** "Late-window volatility at its finest: {winner_name} and {loser_name} traded the lead {lead_changes} times on Monday night before {winner_name} closed out the {margin}-point victory."
* **Variant 5:** "{loser_name} entered Monday night with a {pre_mnf_prob}% projected win probability, only to watch {winner_name}'s {mnf_hero} erase the deficit drive by drive."
* **Variant 6:** "A Monday night robbery. {winner_name} takes the win by {margin} points behind {mnf_hero}, leaving {loser_name} stunned after leading all weekend."
* **Variant 7:** "The ultimate Monday sweat: {winner_name} entered the final window needing {pts_needed} points, securing the victory on {mnf_hero}'s final reception."
* **Variant 8:** "{loser_name} endured peak fantasy frustration on Monday night, watching a {pre_mnf_lead}-point lead evaporate on national television to hand {winner_name} the win."
* **Variant 9:** "Never count out {winner_name} on Monday night. Trailing by {pre_mnf_deficit}, they leaned on {mnf_hero} to complete a {margin}-point comeback over {loser_name}."

### Archetype 3: The Empty Suit (Trigger 3.4)

* **Variant 0:** "Winning with dead weight: {winner_name} secured a victory over {loser_name} despite starting {dud_player}, who contributed exactly {dud_pts} points to the cause."
* **Variant 1:** "{winner_name} managed to win playing 8-on-9. Starting {dud_player} ({dud_pts} points) didn't prevent them from collecting a {margin}-point win over {loser_name}."
* **Variant 2:** "A complete zero in the starting lineup. {winner_name} survived an empty {dud_pts}-point outing from {dud_player}, taking down {loser_name} anyway."
* **Variant 3:** "{loser_name} will be frustrated watching this tape. {winner_name} fielded {dud_player} for zero production and still walked away with the W."
* **Variant 4:** "Carried across the finish line: {winner_name}'s lineup overcame an absolute bagel from {dud_player} ({dud_pts} pts) to defeat {loser_name} by {margin}."
* **Variant 5:** "Starting an empty suit and getting away with it. {winner_name} absorbed {dud_player}'s zero and still out-pointed {loser_name} on Sunday."
* **Variant 6:** "{loser_name} had every opportunity to steal this matchup after {winner_name}'s {dud_player} put up {dud_pts} points, but failed to capitalize."
* **Variant 7:** "Overcoming dead weight: {winner_name} survived a {dud_pts}-point dud from {dud_player}, proving the rest of their starting roster had enough firepower to close the deal."
* **Variant 8:** "You don't often win in this league when a starter gives you {dud_pts} points, but {winner_name} managed to pull it off against {loser_name}."
* **Variant 9:** "Zero points, full credit: {dud_player} did nothing on Sunday, but {winner_name} collects the victory over {loser_name} regardless."

### Archetype 4: The Fraud Alert (Trigger 6.1)

* **Variant 0:** "Smoke and mirrors in the standings: {manager_name} sits at {actual_record} (Rank {standings_rank}), but their All-Play record is a fraudulent {all_play_record} (Rank {all_play_rank}). Regression is coming."
* **Variant 1:** "Schedule luck defined: {manager_name} has ridden the league's lowest Points Against to a {actual_record} start, despite an All-Play record that ranks {all_play_rank} across the league."
* **Variant 2:** "Don't let the standings fool you. {manager_name}'s {actual_record} record masks an All-Play record of {all_play_record}. They are surviving on opponent misfires."
* **Variant 3:** "The luckiest team in the league? {manager_name} holds the #{standings_rank} seed with a {actual_record} record, but ranks #{all_play_rank} in true All-Play winning percentage."
* **Variant 4:** "A masterclass in schedule evasion: {manager_name} has accumulated {wins} wins despite an All-Play record of {all_play_record}. The peripheral numbers suggest trouble ahead."
* **Variant 5:** "Paper Tiger alert: {manager_name} continues to pile up wins ({actual_record}), but if they had played every team every week, they'd sit at an ugly {all_play_record}."
* **Variant 6:** "The standings say contender; the numbers say pretender. {manager_name} is {actual_record}, but their All-Play rank of #{all_play_rank} tells the real story."
* **Variant 7:** "Living on borrowed time: {manager_name} enjoys a {actual_record} record despite posting an All-Play mark of {all_play_record}. Expect the schedule luck to balance out."
* **Variant 8:** "A tale of two records: {manager_name} is {actual_record} in the official standings, but {all_play_record} against the full league field. A reckoning looms."
* **Variant 9:** "Schedule fortune at its peak: {manager_name} has parlayed an All-Play record of {all_play_record} into a comfortable {actual_record} standing. Enjoy the ride while it lasts."

### Archetype 5: The Points-Tiebreaker Armageddon (Trigger 1.4)

* **Variant 0:** "Armageddon at the cutline: Seeds 4 through 7 are separated by just one win, with total Points For separated by an aggregate {pf_spread} points. Every decimal point matters."
* **Variant 1:** "Forget the win column—the final playoff spots are coming down to math. {team_list} enter Week {week_num} within {pf_spread} points of each other in the tiebreaker chase."
* **Variant 2:** "The points tiebreaker is about to break someone's heart. Four teams sit within {pf_spread} aggregate points of the final postseason seed."
* **Variant 3:** "High-wire scoring battle: With standings records tied, {manager_a} leads {manager_b} by just {pf_diff} total points for the final playoff spot."
* **Variant 4:** "Decimal point drama: Seeds {seed_start} through {seed_end} are locked in a standings gridlock, separated by fewer than {pf_spread} points on the season."
* **Variant 5:** "The tiebreaker race is officially on. With records deadlocked, the postseason field will be decided by who runs up the score in Week {week_num}."
* **Variant 6:** "Every yard counts on Sunday. {manager_a} and {manager_b} enter the weekend separated by {pf_diff} season points with identical records on the bubble."
* **Variant 7:** "Tiebreaker Armageddon: A four-team race for two playoff spots where the total separation is just {pf_spread} Points For. Roster every kicker and defense wisely."
* **Variant 8:** "The standings board is completely jammed. {team_list} are battling for postseason positioning where a single 10-yard run could flip the tiebreaker."
* **Variant 9:** "Postseason arithmetic: With records deadlocked near the playoff line, total Points For ({pf_spread}-point spread across four teams) will decide who advances."

---

## 6. Authenticated "My Dossier" Module Architecture

When an authenticated user loads the newsletter, Slot 6 is dynamically rendered using that manager's specific canonical ID:

```
+-----------------------------------------------------------------------+
|                      [MY DOSSIER: WEEK 8 - DAN]                       |
|                                                                       |
|  1. OPPONENT PROFILE: vs. Sarah                                       |
|     - Lifetime Head-to-Head: 5-8 (Streak: Lost 2)                     |
|     - Career Scoring Margin: -6.4 PPG against Sarah                   |
|     - The Trap: Sarah's WRs average +5.8 PPG above their projections   |
|       when playing you.                                               |
|     - Drought Watch: 714 days since your last win against Sarah.      |
|                                                                       |
|  2. FANDOM CONFLICT WARNING                                           |
|     - You are starting 2 players opposing your team (Eagles):         |
|       Patrick Mahomes (QB) & Travis Kelce (TE).                       |
|     - Career win rate when hedging against PHI: 37.5% (3-5 all-time). |
|                                                                       |
|  3. COACHING EFFICIENCY AUDIT                                         |
|     - Week 7 Optimization: 81.2% (Left 22.4 points on the bench).     |
|     - Season Optimization Rank: 9th of 10 (Coaching Liability).       |
|                                                                       |
|  4. HISTORICAL CALENDAR SPLIT                                         |
|     - All-Time Week 8 Record: 6-1 (Your highest win-rate week).       |
|     - Average Week 8 Output: 124.6 PF.                                |
|                                                                       |
|  5. ALL-TIME MILESTONE WATCH                                          |
|     - Career Regular Season Points: 11,942.8                          |
|     - Target: 12,000 Career Points                                    |
|     - Points Needed This Week: 57.2                                   |
+-----------------------------------------------------------------------+
```

---

## 7. Database Schema & Data Models

```sql
-- Tracks historical features to balance manager representation
CREATE TABLE newsletter_manager_features (
    id SERIAL PRIMARY KEY,
    league_id VARCHAR(64) NOT NULL,
    season INT NOT NULL,
    week INT NOT NULL,
    manager_id VARCHAR(64) NOT NULL,
    feature_slot VARCHAR(32) NOT NULL, -- 'HEADLINE', 'SPOTLIGHT_1', 'SPOTLIGHT_2', 'WIRE', 'LORE'
    trigger_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tracks trigger history to enforce recency decay
CREATE TABLE newsletter_published_triggers (
    id SERIAL PRIMARY KEY,
    league_id VARCHAR(64) NOT NULL,
    season INT NOT NULL,
    week INT NOT NULL,
    trigger_id VARCHAR(64) NOT NULL,
    published_slot VARCHAR(32) NOT NULL,
    selected_variant_index INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stores published newsletter editions
CREATE TABLE newsletter_editions (
    id SERIAL PRIMARY KEY,
    league_id VARCHAR(64) NOT NULL,
    season INT NOT NULL,
    week INT NOT NULL,
    lead_story_html TEXT NOT NULL,
    spotlight_1_html TEXT NOT NULL,
    spotlight_2_html TEXT NOT NULL,
    wire_html TEXT NOT NULL,
    lore_html TEXT NOT NULL,
    dispatch_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_id, season, week)
);
```

## 8. Master Orchestrator Implementation (Python 3.11+)

```python
import hashlib
import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

class NewsletterOrchestrator:
    def __init__(self, db_conn, league_id: str, season: int, week: int):
        self.db = db_conn
        self.league_id = league_id
        self.season = season
        self.week = week
        self.category_weights = {
            "PLAYOFF_LEVERAGE": 2.5,
            "FANDOM_TREASON": 2.0,
            "ALL_TIME_RECORD": 2.0,
            "RIVALRY": 1.7,
            "BAD_BEAT": 1.4,
            "TRANSACTION": 1.3,
            "DRAFT_LORE": 1.1,
            "SITUATIONAL": 1.0
        }

    def resolve_dispatch_timestamp(self, first_kickoff_utc: datetime) -> datetime:
        """Determines dispatch time, accounting for Wednesday games."""
        standard_wednesday_0600 = datetime(
            first_kickoff_utc.year, first_kickoff_utc.month, first_kickoff_utc.day,
            6, 0, 0, tzinfo=timezone.utc
        )
        early_kickoff_cutoff = first_kickoff_utc - timedelta(hours=3)
        return min(standard_wednesday_0600, early_kickoff_cutoff)

    def get_manager_equity(self, manager_ids: List[str]) -> float:
        cursor = self.db.cursor()
        cursor.execute(
            """SELECT manager_id, COUNT(*) FROM newsletter_manager_features 
               WHERE league_id = %s AND season = %s GROUP BY manager_id""",
            (self.league_id, self.season)
        )
        counts = dict(cursor.fetchall())
        cursor.execute("SELECT DISTINCT manager_id FROM league_managers WHERE league_id = %s", (self.league_id,))
        all_managers = [r[0] for r in cursor.fetchall()]

        feature_counts = [counts.get(m, 0) for m in all_managers]
        avg_features = sum(feature_counts) / max(len(feature_counts), 1)

        multiplier = 1.0
        for m in manager_ids:
            m_feat = counts.get(m, 0)
            multiplier *= (1.0 + 0.25 * (avg_features - m_feat))
        return max(0.2, multiplier)

    def get_recency_decay(self, trigger_id: str) -> float:
        cursor = self.db.cursor()
        cursor.execute(
            """SELECT MAX(week) FROM newsletter_published_triggers 
               WHERE league_id = %s AND season = %s AND trigger_id = %s""",
            (self.league_id, self.season, trigger_id)
        )
        res = cursor.fetchone()
        last_week = res[0] if res else None
        if last_week is None:
            return 1.0
        delta_t = self.week - last_week
        return math.exp(-0.693 * delta_t)

    def compute_composite_score(self, candidate: Dict[str, Any]) -> float:
        z = abs(candidate.get("z_score", 1.0))
        w = self.category_weights.get(candidate["category"], 1.0)
        d = self.get_recency_decay(candidate["trigger_id"])
        e = self.get_manager_equity(candidate["involved_manager_ids"])
        return z * w * d * e

    def resolve_template(self, candidate: Dict[str, Any]) -> tuple[str, int]:
        seed_str = f"{self.league_id}_{self.season}_{self.week}_{candidate['trigger_id']}"
        for mid in sorted(candidate["involved_manager_ids"]):
            seed_str += f"_{mid}"
        hash_val = int(hashlib.sha256(seed_str.encode('utf-8')).hexdigest(), 16)
        variant_idx = hash_val % len(candidate["templates"])
        text = candidate["templates"][variant_idx].format(**candidate["tokens"])
        return text, variant_idx

    def generate_edition(self, first_kickoff_utc: datetime) -> Dict[str, Any]:
        dispatch_time = self.resolve_dispatch_timestamp(first_kickoff_utc)
        candidates = self.evaluate_all_triggers()

        for c in candidates:
            c["score"] = self.compute_composite_score(c)

        candidates.sort(key=lambda x: x["score"], reverse=True)
        lead_story = candidates[0]

        spotlights = []
        for c in candidates[1:]:
            if len(spotlights) == 2:
                break
            if c["category"] in ["RIVALRY", "BAD_BEAT", "FANDOM_TREASON", "PLAYOFF_LEVERAGE"]:
                if set(c["involved_manager_ids"]) != set(lead_story["involved_manager_ids"]):
                    spotlights.append(c)

        wire_story = next((c for c in candidates if c["category"] == "TRANSACTION"), None)
        lore_story = next((c for c in candidates if c["category"] in ["ALL_TIME_RECORD", "DRAFT_LORE"]), None)

        lead_text, lead_idx = self.resolve_template(lead_story)
        s1_text, s1_idx = self.resolve_template(spotlights[0]) if len(spotlights) > 0 else ("", 0)
        s2_text, s2_idx = self.resolve_template(spotlights[1]) if len(spotlights) > 1 else ("", 0)
        wire_text, w_idx = self.resolve_template(wire_story) if wire_story else ("", 0)
        lore_text, l_idx = self.resolve_template(lore_story) if lore_story else ("", 0)

        return {
            "dispatch_timestamp": dispatch_time.isoformat(),
            "lead": {"text": lead_text, "trigger_id": lead_story["trigger_id"], "variant": lead_idx},
            "spotlight_1": {"text": s1_text, "trigger_id": spotlights[0]["trigger_id"] if spotlights else None, "variant": s1_idx},
            "spotlight_2": {"text": s2_text, "trigger_id": spotlights[1]["trigger_id"] if len(spotlights) > 1 else None, "variant": s2_idx},
            "wire": {"text": wire_text, "trigger_id": wire_story["trigger_id"] if wire_story else None, "variant": w_idx},
            "lore": {"text": lore_text, "trigger_id": lore_story["trigger_id"] if lore_story else None, "variant": l_idx}
        }
```
