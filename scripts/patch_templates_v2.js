import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const templatePath = path.join(rootDir, 'src', 'newsletter_templates.js');

let content = fs.readFileSync(templatePath, 'utf8');

// 1. Update MARGIN_OUTLIER in TRIGGER_TEMPLATES
const oldMarginTemplates = `    // 2.4 Margin of Victory Outlier
    MARGIN_OUTLIER: [
        "Cardiac series alert: matchups between {manager_a} and {manager_b} are decided by an average of just {avg_margin} points, making every possession terrifying.",
        "Never schedule plans when these two meet: {manager_a} and {manager_b} boast an average margin of victory of {avg_margin} points across their series history.",
        "Perpetual beatdown: the historical margin between {manager_a} and {manager_b} sits at an astonishing {avg_margin} points. Blowouts are the standard.",
        "Nail-biters only: {manager_a} and {manager_b} have staged {game_count} matchups where the final spread averaged a razor-thin {avg_margin} points.",
        "No mercy in this rivalry: {manager_a} and {manager_b} rarely play close games, with their career meetings swinging by an average of {avg_margin} points.",
        "The tightest rivalry on the ledger: {manager_a} and {manager_b} average a {avg_margin}-point margin of victory, coming down to decimal points almost every time.",
        "Lopsided warfare: {manager_a} versus {manager_b} is an all-time anomaly, producing an average scoring gap of {avg_margin} points.",
        "Prepare for overtime nerves: {manager_a} and {manager_b} historically decide their matchups by an average of {avg_margin} points.",
        "Total separation: history shows that when {manager_a} and {manager_b} clash, one walks away with a decisive {avg_margin}-point rout.",
        "A series built on cardiac finishes: {manager_a} and {manager_b} bring a {avg_margin}-point historical average margin into their Week {week_num} duel."
    ],`;

const newMarginTemplates = `    // 2.4 Margin of Victory Outlier
    MARGIN_OUTLIER: [
        "Lopsided warfare: {manager_a} versus {manager_b} is an all-time anomaly, producing an average scoring gap of {avg_margin} points, {rank_context}.",
        "Perpetual beatdown: the historical margin between {manager_a} and {manager_b} sits at an astonishing {avg_margin} points ({league_rank}), where blowouts are the standard.",
        "Never schedule plans when these two meet: {manager_a} and {manager_b} boast an average margin of victory of {avg_margin} points across their series history ({rank_context}).",
        "No mercy in this rivalry: {manager_a} and {manager_b} rarely play close games, with their career meetings swinging by an average of {avg_margin} points ({league_rank}).",
        "Total separation: history shows that when {manager_a} and {manager_b} clash, one walks away with a decisive {avg_margin}-point rout, {rank_context}.",
        "Cardiac series alert: matchups between {manager_a} and {manager_b} are decided by an average of just {avg_margin} points ({league_rank}), making every possession terrifying.",
        "The tightest rivalry on the ledger: {manager_a} and {manager_b} average a {avg_margin}-point margin of victory, {rank_context}.",
        "Nail-biters only: {manager_a} and {manager_b} bring an average spread of just {avg_margin} points into Week {week_num}, {rank_context}.",
        "Prepare for overtime nerves: {manager_a} and {manager_b} historically decide their matchups by an average of {avg_margin} points ({league_rank}).",
        "A series built on cardiac finishes: {manager_a} and {manager_b} bring a {avg_margin}-point historical average margin into their duel, {rank_context}."
    ],`;

// 2. Update MARGIN_OUTLIER in TRIGGER_HEADLINES
const oldMarginHeadlines = `    MARGIN_OUTLIER: [
        "Decided by Inches: {winner_name} Edges {loser_name} in Wild Nail-Biter",
        "Razor-Thin Outlier: {winner_name} Escapes With Microscopic Margin",
        "Down to the Wire: {winner_name} and {loser_name} Settle Thriller",
        "Heart-Stopping Finish: {winner_name} Sneaks Past {loser_name}",
        "A Contest of Decimals: {winner_name} Prevails in Wild Head-to-Head",
        "Nail-Biter in the Books: {winner_name} Denies {loser_name} on Final Play",
        "Microscopic Separation: {winner_name} and {loser_name} Battle to the End",
        "The Narrowest Escape: {winner_name} Takes Instant Classic vs. {loser_name}",
        "Every Stat Correction Matters: {winner_name} Tops {loser_name}",
        "Wild Finish on Sunday: {winner_name} Emerges Victorious Over {loser_name}"
    ],`;

const newMarginHeadlines = `    MARGIN_OUTLIER: [
        "Lopsided History: {manager_a} and {manager_b} Clash in High-Margin Outlier",
        "Perpetual Beatdown: {manager_a} vs. {manager_b} Features {avg_margin}-Point Spread",
        "No Mercy on the Ledger: Historic Blowout Rivalry Returns for {manager_a} and {manager_b}",
        "Separation by Design: {manager_a} and {manager_b} Renew Series Defined by Rout",
        "Runaway Freight Train: {manager_a} and {manager_b} Bring High-Margin Lore Into Sunday",
        "Cardiac Series Alert: {manager_a} and {manager_b} Collide in Decimal-Point Showdown",
        "Down to the Final Snap: {manager_a} and {manager_b} Renew League's Tightest Rivalry",
        "Razor-Thin History: {manager_a} and {manager_b} Separated by Microscopic Margin",
        "Nail-Biters Guaranteed: {manager_a} and {manager_b} Bring Cardiac Ledger Into Week {week_num}",
        "Every Decimal Matters: {manager_a} and {manager_b} Stage Instant Classic"
    ],`;

// 3. Update REVENGE_GAME_RADAR in TRIGGER_TEMPLATES
const oldRevengeTemplates = `    // 11.3 Revenge Game Radar
    REVENGE_GAME_RADAR: [
        "A long-awaited rematch with serious pride on the line: {dominant_manager} enters Sunday having taken {h2h_wins} games from {subordinate_manager} all-time while averaging a {margin_ppg} point surplus. {last_margin}, {dominant_manager} looks to maintain complete psychological control over their rival.",
        "One-sided history resumed: {dominant_manager} brings a {h2h_wins}-win lifetime advantage over {subordinate_manager} into Week {week_num}. {last_margin}.",
        "Chasing franchise supremacy: {dominant_manager} has dominated {subordinate_manager} with {h2h_wins} career wins, looking to add another chapter to this lopsided affair.",
        "Historical landlord: {dominant_manager} enters having defeated {subordinate_manager} {h2h_wins} times, aiming to extend a mastery that spans {sample_size} total meetings.",
        "A psychological hurdle: {subordinate_manager} enters Week {week_num} desperate to chip away at {dominant_manager}'s {h2h_wins}-win stranglehold.",
        "The rivalry ledger tilts heavily: {dominant_manager} has won {h2h_wins} of their {sample_size} career clashes against {subordinate_manager}.",
        "Pride on the scoreboard: {dominant_manager} meets {subordinate_manager} on Sunday, holding {h2h_wins} all-time victories and an average winning margin of {margin_ppg} points.",
        "History demands an answer: {subordinate_manager} faces their biggest personal nemesis in {dominant_manager}, who has claimed {h2h_wins} career victories in this series.",
        "The masterclass continues: {dominant_manager} looks to build upon an emphatic {h2h_wins}-win historical mark against {subordinate_manager}.",
        "Extending the reign: {dominant_manager} brings {h2h_wins} lifetime wins over {subordinate_manager} into Sunday's tilt."
    ],`;

const newRevengeTemplates = `    // 11.3 Revenge Game Radar
    REVENGE_GAME_RADAR: [
        "A long-awaited rematch with serious pride on the line: {dominant_manager} enters Sunday having taken {h2h_wins} games from {subordinate_manager} all-time ({h2h_league_rank}), while averaging a {margin_ppg} point surplus. {last_margin}, {dominant_manager} looks to maintain complete psychological control over their rival.",
        "One-sided history resumed: {dominant_manager} brings a {h2h_wins}-win lifetime advantage over {subordinate_manager} into Week {week_num}, {h2h_league_rank}. {last_margin}.",
        "Chasing franchise supremacy: {dominant_manager} has dominated {subordinate_manager} with {h2h_wins} career wins ({h2h_league_rank}), looking to add another chapter to this lopsided affair.",
        "Historical landlord: {dominant_manager} enters having defeated {subordinate_manager} {h2h_wins} times ({h2h_league_rank}), aiming to extend a mastery that spans {sample_size} total meetings.",
        "A psychological hurdle: {subordinate_manager} enters Week {week_num} desperate to chip away at {dominant_manager}'s {h2h_wins}-win stranglehold ({h2h_league_rank}).",
        "The rivalry ledger tilts heavily: {dominant_manager} has won {h2h_wins} of their {sample_size} career clashes against {subordinate_manager}, {h2h_league_rank}.",
        "Pride on the scoreboard: {dominant_manager} meets {subordinate_manager} on Sunday, holding {h2h_wins} all-time victories ({h2h_league_rank}) and an average winning margin of {margin_ppg} points.",
        "History demands an answer: {subordinate_manager} faces their biggest personal nemesis in {dominant_manager}, who has claimed {h2h_wins} career victories in this series ({h2h_league_rank}).",
        "The masterclass continues: {dominant_manager} looks to build upon an emphatic {h2h_wins}-win historical mark against {subordinate_manager}, {h2h_league_rank}.",
        "Extending the reign: {dominant_manager} brings {h2h_wins} lifetime wins over {subordinate_manager} into Sunday's tilt, {h2h_league_rank}."
    ],`;

// 4. Update JUDAS_STARTER in TRIGGER_TEMPLATES & add DIRECT_OPPONENT_TREASON
const oldJudasTemplates = `    // 8.3 Judas Starter (Division Treason)
    JUDAS_STARTER: [
        "Judas in the lineup: {fan_team} supporter {manager_name} is starting star player {rival_star} from their bitter division rival {div_rival} on Sunday.",
        "Unforgivable division treason: {manager_name} has crossed enemy lines to start {rival_star} of the hated {div_rival}.",
        "Sleeping with the enemy: {manager_name} puts aside generations of bad blood to rely on {div_rival}'s {rival_star} for Week {week_num} points.",
        "Moral compromise at its peak: {manager_name} will be openly rooting for {div_rival}'s {rival_star} on Sunday afternoon.",
        "The ultimate betrayal: a proud {fan_team} fan starting {rival_star} in a division showdown represents peak fantasy moral bankruptcy.",
        "Treason in broad daylight: {manager_name} fields {rival_star} from arch-rival {div_rival}, selling out their fandom for a few projected points.",
        "Rooting for the villain: {manager_name} will cheer every yard gained by {div_rival}'s {rival_star}, alienating fellow {fan_team} supporters.",
        "Division rivalries mean nothing: {manager_name} starts {rival_star} of {div_rival}, demonstrating that fantasy points easily erase real-life hatred.",
        "A disgraceful team sheet: {fan_team} faithful will weep seeing {manager_name} depend on {rival_star} ({div_rival}) for a victory on Sunday.",
        "The Judas special: {manager_name} embraces the enemy, locking in {div_rival} standout {rival_star} to lead their fantasy attack."
    ],`;

const newJudasTemplates = `    // 8.3 Judas Starter (Division Treason)
    JUDAS_STARTER: [
        "Triple treason in the lineup: {fan_team} supporter {manager_name} is starting {rival_count} players ({rival_stars}) from bitter division rivals on Sunday.",
        "Unforgivable division treason: {manager_name} has crossed enemy lines to start {rival_count} division rivals ({rival_stars}) in Week {week_num}.",
        "Sleeping with the enemy: {manager_name} puts aside real-world loyalty to rely on {rival_count} division adversaries ({rival_stars}) for points.",
        "Moral compromise at its peak: {manager_name} will be openly rooting for division foes ({rival_stars}) throughout Sunday afternoon.",
        "The ultimate betrayal: a proud {fan_team} supporter starting {rival_count} division enemies ({rival_stars}) represents peak fantasy pragmatism.",
        "Treason in broad daylight: {manager_name} fields {rival_stars}, selling out {fan_team} pride for fantasy point totals.",
        "Rooting for the villains: {manager_name} will cheer every yard gained by division rivals {rival_stars}, testing fellow fans' patience.",
        "Division rivalries mean nothing: {manager_name} starts {rival_count} division stars ({rival_stars}), proving fantasy wins trump real-life rivalries.",
        "A disgraceful team sheet: {fan_team} faithful will wince seeing {manager_name} depend on {rival_stars} for a Sunday victory.",
        "The Judas special: {manager_name} embraces the enemy division, locking in {rival_stars} to anchor their starting unit."
    ],

    // 8.10 Direct Opponent Treason (Sunday Treason)
    DIRECT_OPPONENT_TREASON: [
        "Sunday treason alert: {manager_name} enters Week {week_num} with {traitor_count} starters ({traitor_list}) playing directly against the beloved {fan_team}.",
        "The ultimate emotional conflict: diehard {fan_team} fan {manager_name} is actively starting {traitor_list} as they battle {fan_team} on Sunday.",
        "Divided loyalties on Sunday afternoon: {manager_name} has inserted {traitor_list} into the starting lineup against {fan_team}, putting fantasy points ahead of real-world fandom.",
        "Cheering with both hands: {manager_name} faces a brutal Sunday rooting dilemma, fielding {traitor_count} key starters directly opposing {fan_team}.",
        "Fandom on the line: {manager_name} cannot escape heartbreak or celebration, relying on {traitor_list} to produce against their favorite {fan_team}.",
        "A conflicted watch party: {manager_name} will be glued to {fan_team} versus {nfl_opponent}, secretly rooting for {traitor_list} while wearing team colors.",
        "The Sunday sacrifice: {manager_name} is starting {traitor_count} weapons from {nfl_opponent}, risking {fan_team} heartbreak in pursuit of a fantasy victory.",
        "Priorities tested in Week {week_num}: {manager_name} backs {traitor_list} on Sunday, setting up an agonizing 60 minutes against {fan_team}.",
        "No room for sentimentality: {manager_name} turns their back on {fan_team} by starting {traitor_list} in Sunday's critical matchup.",
        "The weekly contradiction: {manager_name} needs big fantasy numbers from {traitor_list}, even if it means watching {fan_team} take a loss."
    ],`;

// 5. Update TRADE_REMORSE_HOMECOMING in TRIGGER_TEMPLATES
const oldTradeRemorseTemplates = `    // 4.2 Trade Remorse Homecoming
    TRADE_REMORSE_HOMECOMING: [
        "The trade remorse bowl arrives: {former_manager} meets {new_manager} in a showdown featuring {player_name}, who was shipped away in past transactions.",
        "Facing the ghost of trades past: {former_manager} collides with {new_manager} and {player_name}, looking to prove the deal was justified.",
        "A bitter reunion on Sunday: {player_name} lines up against {former_manager}, eager to make their former club regret letting them go.",
        "Trade ledger returns to haunt: {former_manager} must watch {player_name} lead {new_manager}'s attack on Sunday afternoon.",
        "The asset that got away: {player_name} returns to face {former_manager}, providing a direct referendum on past front-office decisions.",
        "Sunday reckoning: {player_name} squares off against {former_manager}, carrying {ppg} PPG of pure regret for the old regime.",
        "Seller's remorse on trial: {former_manager} takes on {new_manager} with {player_name} occupying center stage in Week {week_num}.",
        "No love lost in this reunion: {player_name} looks to torch {former_manager}, who famously parted ways with the playmaker.",
        "The cost of the trade: {former_manager} watches {player_name} start for {new_manager}, knowing every point scored is an indictment of the past deal.",
        "Revenge on the transaction wire: {player_name} meets {former_manager} for the first time since being dealt away, ready to deliver payback."
    ],`;

const newTradeRemorseTemplates = `    // 4.2 Trade Remorse Homecoming
    TRADE_REMORSE_HOMECOMING: [
        "A blockbuster reunion with heavy emotional baggage: {former_manager} squares off against former cornerstone {player_name} on Sunday. {acquisition_story} before {departure_story}. Now, {player_name} lines up on the other side averaging {ppg} points per game.",
        "The trade remorse bowl arrives: {former_manager} meets {new_manager} in a showdown featuring {player_name}, who was {departure_story}. With {player_name} flourishing as an undisputed starter, the pressure on {former_manager} is suffocating.",
        "Memories of transactions past: {former_manager} must watch {player_name} lead {new_manager}'s attack on Sunday, {tenure_context}. {departure_story}.",
        "Facing the ghost of trades past: {former_manager} collides with {new_manager} and {player_name}, {acquisition_story}. Sunday offers {player_name} the ultimate chance for on-field revenge.",
        "The asset that got away: {player_name} returns to haunt {former_manager} in Week {week_num}, {departure_story}. Now starting for {new_manager}, {player_name} looks to make his former manager pay.",
        "Regret on the scoreboard: {former_manager} takes on {new_manager} with {player_name} occupying center stage, {tenure_context}. {departure_story}.",
        "Sunday reckoning: {player_name} faces his former squad after {departure_story}. For {former_manager}, keeping {player_name} out of the end zone is a matter of franchise pride.",
        "The cost of the deal: {former_manager} parted ways with {player_name} when {departure_story}. On Sunday, {new_manager} deploys {player_name} as a featured weapon looking to prove the transaction fatal.",
        "Bitter reunion in Week {week_num}: {former_manager} must game-plan against {player_name}, {tenure_context}. {departure_story}.",
        "When trades come back to bite: {player_name} squares off against {former_manager} after {departure_story}. A big Sunday performance would cement this as one of the league's most painful trade memories."
    ],`;

// 6. Update UNLUCKIEST_TEAM in TRIGGER_TEMPLATES
const oldUnluckiestTemplates = `    // 10.2 The Unluckiest Team
    UNLUCKIEST_TEAM: [
        "The unluckiest franchise in existence: {manager_name} has piled up {career_pf} career points, only to be undone by the league's highest historical Points Against.",
        "Cruelty over multi-year samples: {manager_name}'s {all_time_win_pct}% winning percentage completely betrays an offense that consistently ranks near the top of the league.",
        "All firepower, zero fortune: {manager_name} continues to play the role of the league's premier glass cannon, generating elite points with tragic results.",
        "A statistical injustice: {manager_name} sits among the league's top all-time scorers, yet holds an all-time record of {h2h_record} due to relentless opponent booms.",
        "The ultimate hard-luck franchise: {manager_name}'s career trajectory proves that in fantasy football, schedule timing always trumps raw point totals.",
        "Scoring without the wins: {manager_name} has produced {career_pf} all-time points, but has been held to a {all_time_win_pct}% career win rate.",
        "A multi-year tragedy: {manager_name} brings one of the league's most potent historical offenses into Week {week_num}, still fighting a cursed win-loss ledger.",
        "The Glass Cannon award: {manager_name} has spent years lighting up the scoreboard ({career_pf} pts), only to watch opponents average an ungodly {opp_avg_pf} PPG against them."
    ],`;

const newUnluckiestTemplates = `    // 10.2 The Unluckiest Team
    UNLUCKIEST_TEAM: [
        "The Schedule Hex: {manager_name} holds an all-time all-play record of {all_play_record} ({all_play_pct}%), yet sits at an actual {actual_record} due to a league-worst Luck Index of {luck_index} games ({luck_rank}). On opening day, that cruelty peaks: a {wk1_all_play_record} mark against the field saddled with an actual {wk1_actual_record} ledger.",
        "A statistical injustice spanning years: {manager_name} has compiled {career_pf} career points and a {all_play_pct}% all-play win rate, but has been held to {actual_record} due to relentless opponent fireworks ({luck_rank}).",
        "All firepower, zero fortune: {manager_name} ranks as the premier glass cannon in league archives, producing an all-play record of {all_play_record} while suffering a career schedule deficit of {luck_index} wins.",
        "The Glass Cannon award: {manager_name} has spent years lighting up the scoreboard ({career_pf} pts), only to watch opponents average an ungodly {opp_avg_pf} PPG against them, generating an all-time Luck Index of {luck_index} games.",
        "The ultimate hard-luck franchise: {manager_name}'s career trajectory proves that in fantasy football, schedule timing trumps raw points. With a {all_play_record} record against the field, {manager_name} ranks {luck_rank} in schedule luck.",
        "Scoring without the wins: {manager_name} has produced {career_pf} all-time points ({all_play_pct}% all-play), but has been denied {luck_index} expected wins by the scheduling gods.",
        "Cruelty over multi-year samples: {manager_name}'s {all_time_win_pct}% winning percentage completely betrays an offense that consistently outscores the field ({all_play_record} all-play, {luck_rank}).",
        "A multi-year tragedy on opening day: {manager_name} enters Week {week_num} with a {wk1_all_play_record} career all-play mark in Week 1, yet holds a painful {wk1_actual_record} opening week record.",
        "Schedule variance at its cruelest: {manager_name} sits among the league's top all-time scorers, yet ranks {luck_rank} in career luck with a suffocating {luck_index}-game deficit against expected all-play wins.",
        "Defying the laws of probability: {manager_name} brings a {all_play_pct}% all-play win rate into Sunday, still battling an enduring {luck_index}-game schedule penalty."
    ],`;

// 7. Update JUDAS_STARTER in TRIGGER_HEADLINES & add DIRECT_OPPONENT_TREASON
const oldJudasHeadlines = `    JUDAS_STARTER: [
        "Judas Starter: {manager_name} Starts Division Rival {rival_star}",
        "Betrayal in the Lineup: {manager_name} Backs Hated {div_rival} Star",
        "Divided Loyalties: {fan_team} Devotee Starts Nemesis {rival_star}",
        "Points Over Pride: {manager_name} Entrusts Lineup to {div_rival} Weapon",
        "The Judas Starter Gambit: Cheering for Enemy Scores on Sunday",
        "Fandom Betrayal: {manager_name} Starts Key Playmaker From {div_rival}",
        "A Crisis of Conscience: {fan_team} Fan Starts {div_rival}'s {rival_star}",
        "Sacrificing Fan Dignity: {manager_name} Rides {rival_star} to Victory",
        "Rooting for the Enemy: Judas Starter Deployed by {manager_name}",
        "Treason on the Field: {manager_name} Backs Division Rival {rival_star}"
    ],`;

const newJudasHeadlines = `    JUDAS_STARTER: [
        "Division Treason: {manager_name} Starts {rival_count} Bitter Rivals",
        "Betrayal in the Lineup: {manager_name} Backs Hated Division Foes",
        "Divided Loyalties: {fan_team} Devotee Starts {rival_count} Division Stars",
        "Points Over Pride: {manager_name} Entrusts Lineup to Rival Weapons",
        "The Judas Starter Gambit: Cheering for Division Enemies on Sunday",
        "Fandom Betrayal: {manager_name} Starts Key Playmakers From Enemy Ranks",
        "A Crisis of Conscience: {fan_team} Fan Loads Up on Division Adversaries",
        "Sacrificing Fan Dignity: {manager_name} Rides Bitter Rivals to Victory",
        "Rooting for the Enemy: Multiple Division Foes Deployed by {manager_name}",
        "Treason on the Field: {manager_name} Backs Sworn Division Adversaries"
    ],
    DIRECT_OPPONENT_TREASON: [
        "Sunday Treason: {manager_name} Starts Key Weapons Against {fan_team}",
        "Divided Loyalties: {manager_name} Fields {traitor_list} vs. {fan_team}",
        "The Agonizing Sunday Dilemma: {manager_name} Risks Heartbreak vs. {fan_team}",
        "Emotional Conflict: {manager_name} Bets on Rivals to Torch {fan_team}",
        "Cheering With Both Hands: {manager_name} Backs {nfl_opponent} Stars Against {fan_team}",
        "Fandom Put to the Test: {manager_name} Starts Multiple Foes vs. {fan_team}",
        "Conflicted Watch Party: {manager_name} Pulls for {traitor_list} Over {fan_team}",
        "Fantasy Over Franchise: {manager_name} Relies on Rivals Against {fan_team}",
        "Sunday Rooting Crisis: {manager_name} Starts {traitor_count} Against {fan_team}",
        "The Ultimate Betrayal: {manager_name} Backs {nfl_opponent} Weapons Against {fan_team}"
    ],`;

content = content.replace(oldMarginTemplates, newMarginTemplates);
content = content.replace(oldMarginHeadlines, newMarginHeadlines);
content = content.replace(oldRevengeTemplates, newRevengeTemplates);
content = content.replace(oldJudasTemplates, newJudasTemplates);
content = content.replace(oldTradeRemorseTemplates, newTradeRemorseTemplates);
content = content.replace(oldUnluckiestTemplates, newUnluckiestTemplates);
content = content.replace(oldJudasHeadlines, newJudasHeadlines);

fs.writeFileSync(templatePath, content, 'utf8');
console.log('Successfully patched src/newsletter_templates.js');
