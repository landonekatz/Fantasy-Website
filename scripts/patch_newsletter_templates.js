// scripts/patch_newsletter_templates.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const templatePath = path.join(rootDir, 'src', 'newsletter_templates.js');
let content = fs.readFileSync(templatePath, 'utf8');

// 1. Refactor Module 11 templates in TRIGGER_TEMPLATES
const updatedModule11 = `    // ==========================================
    // MODULE 11: PROSPECTIVE & PRE-WEEK PREVIEWS
    // ==========================================

    // 11.1 Title Defense Kickoff
    TITLE_DEFENSE_KICKOFF: [
        "Reigning league champion {champion_name} raises the championship banner in Week {week_num}, but faces an immediate test against {challenger_name}. While {challenger_name} holds a {h2h_record} lifetime edge, they enter Sunday burdened by {challenger_w1_streak}. Eerily, {challenger_name}'s last opening-week triumph came back in {last_w1_win}, as {champion_name} looks to defend the crown and keep {challenger_name}'s September hex alive.",
        "The target on the champion's back is massive as {champion_name} kicks off their title defense against {challenger_name}. The historical ledger shows an evenly matched {h2h_record} rivalry, but {challenger_name} must conquer {challenger_w1_streak} to spoil opening night. With {challenger_name}'s last Week 1 victory dating back to {last_w1_win}, {champion_name} aims to deliver an early statement to the league.",
        "Fresh off hoisting the {prev_season} trophy, {champion_name} begins the new campaign facing long-time foil {challenger_name}. Despite {challenger_name}'s {h2h_record} career advantage, {challenger_name} has struggled mightily in September, dealing with {challenger_w1_streak}. {champion_name} knows opening-day rust can derail anyone, as making this marquee tilt personal from the jump.",
        "A heavyweight clash to open the season: defending champion {champion_name} squares off with {challenger_name} in a matchup carrying significant psychological stakes. {challenger_name} enters Sunday seeking to end {challenger_w1_streak}, with their last opening triumph occurring in {last_w1_win}. For {champion_name}, surviving this opening gauntlet is step one toward back-to-back glory.",
        "Dynasty dreams or opening-day ambush, as {champion_name} puts their title pedigree on the line against {challenger_name}. Across their storied rivalry, {challenger_name} leads {h2h_record}, yet carries the baggage of {challenger_w1_streak}. If {champion_name} can exploit {challenger_name}'s early-season struggles, the championship tour starts with immediate authority.",
        "The throne is under siege from day one. {champion_name} opens their title defense against {challenger_name}, who arrives hungry to snap {challenger_w1_streak}. The series sits at {h2h_record}, with {challenger_name}'s last Week 1 win coming against {champion_name} in {last_w1_win}. Sunday offers either vindication for the champion or long-awaited September redemption for the challenger.",
        "Week {week_num} brings no soft landing for the reigning king. {champion_name} faces {challenger_name} in a grudge match that pits title prestige against {challenger_w1_streak}. While {challenger_name} owns {h2h_record} bragging rights, {champion_name} holds the hardware, as both sides look to establish early dominance.",
        "Opening-week volatility arrives in force as champion {champion_name} meets {challenger_name}. The challenger has been trapped in {challenger_w1_streak}, but history proves {challenger_name} knows how to play {champion_name}, holding an all-time {h2h_record} mark. {champion_name} must bring playoff intensity to survive this opening bell.",
        "Banner night comes with serious danger, as {champion_name} squares off with {challenger_name} in a clash of longstanding rivals. With {challenger_name} desperate to snap {challenger_w1_streak} dating back to {last_w1_win}, every starting decision and waiver holdover will carry immense weight under the lights.",
        "The road to the championship runs through {champion_name}, who begins the defense against {challenger_name}. Carrying a {h2h_record} all-time record but seeking to erase {challenger_w1_streak}, {challenger_name} brings maximum motivation into Sunday, setting up an explosive Week {week_num} headline."
    ],

    // 11.2 Marquee Matchup Preview Showdown
    MATCHUP_PREVIEW_SHOWDOWN: [
        "Separated by a microscopic {spread}-point margin on paper, {favorite_name} ({fav_proj} proj) and {underdog_name} ({dog_proj} proj) represent the tightest battle of opening weekend. The pair carry an evenly matched {h2h_record} lifetime ledger featuring {close_games}, as neither manager can afford a blown coverage or empty flex spot in a contest projected at {game_total} aggregate points.",
        "Opening weekend features an absolute dead heat, as {favorite_name} enters with a razor-thin {spread}-point advantage over {underdog_name}. Their history is defined by heart-stopping finishes, including {close_games} decided in the final minutes. With both rosters projected within striking distance ({fav_proj} vs {dog_proj}), this matchup will likely be decided on Monday night.",
        "No matchup on the Week {week_num} schedule is tighter than {favorite_name} taking on {underdog_name}. Forecasted for an aggregate {game_total} points, the two rivals enter tied to a {h2h_record} lifetime series. A single reception or missed extra point could swing the {spread}-point spread, as both managers face maximum opening-day tension.",
        "A coin flip in the truest sense: {favorite_name} ({fav_proj} projected) and {underdog_name} ({dog_proj} projected) square off in a contest separated by just {spread} points. Having traded blows across {h2h_record} career meetings with {close_games}, Sunday's clash promises another chapter of drama between two of the league's most evenly matched franchises.",
        "Margins do not get any tighter than this. {favorite_name} and {underdog_name} collide under a razor-thin {spread}-point spread, carrying combined projected scoring of {game_total} points. With their lifetime series standing at {h2h_record}, both managers know that roster optimization and injury timing will determine the victor.",
        "Opening night fireworks are anticipated as {favorite_name} meets {underdog_name} in a matchup carrying a negligible {spread}-point projection gap. Across their career series ({h2h_record}), the rivals have produced {close_games}, meaning bench discipline and kicker variance could easily tip the scales.",
        "The premier dogfight of Week {week_num}: {favorite_name} holds an edge of just {spread} points over {underdog_name} on the projection sheet. Their historical record of {h2h_record} highlights how evenly matched these two franchises have been, as this opening collision carries immense psychological bragging rights.",
        "High-wire offensive drama awaits {favorite_name} and {underdog_name}, who enter Sunday separated by an almost nonexistent {spread} points. With {close_games} in their shared ledger ({h2h_record} all-time), every red-zone target and defensive sack will carry championship-level gravity.",
        "Sunday's marquee spotlight falls on {favorite_name} ({fav_proj}) and {underdog_name} ({dog_proj}), locked in a {spread}-point stalemate before kickoff. The two have fought to a {h2h_record} career ledger, as neither manager is expected to concede an inch across 60 minutes of football.",
        "A razor-thin margin separates rivals in Week {week_num}, as {favorite_name} and {underdog_name} bring combined firepower projected at {game_total} points into battle. With {close_games} decided by razor-thin margins in their past, Sunday's showdown is destined to be a classic."
    ],

    // 11.3 Revenge Game Radar
    REVENGE_GAME_RADAR: [
        "{target_name} enters Week {week_num} holding an overwhelming {h2h_record} career stranglehold over {avenger_name}, outscoring his rival by an eye-popping {margin_ppg} points per game across their lifetime series. Their most recent clash was an unmitigated massacre, as {target_name} cruised to victory in {last_margin}. With years of psychological scar tissue on the line, {avenger_name} gets a clean slate to begin chipping away at the deficit.",
        "Few rivalries in league lore are as lopsided as {target_name} versus {avenger_name}. {target_name} boasts a {h2h_record} all-time record with an average scoring cushion of {margin_ppg} PPG, punctuated by {last_margin}. For {avenger_name}, Week {week_num} represents more than a regular season win, as it is an exorcism of historical dominance.",
        "The grudge match arrives early, as {avenger_name} squares off against nemesis {target_name} carrying the burden of {h2h_losses} career defeats. {target_name} has turned this matchup into an annual clinic, beating {avenger_name} by an average of {margin_ppg} points. Following {last_margin}, {avenger_name} needs a vintage performance to alter the narrative.",
        "A decade of frustration hangs over {avenger_name} entering Sunday against {target_name}. The lifetime {h2h_record} ledger is brutal, as {target_name} has maintained a decisive {margin_ppg} PPG scoring gap throughout their meetings. Coming off {last_margin}, {avenger_name} enters as a proud underdog hunting for long-delayed retribution.",
        "Bad blood and deep scars define this Week {week_num} tilt. {target_name} has owned {avenger_name} across {h2h_record} meetings, outproducing his adversary by {margin_ppg} points per tilt and delivering a beatdown in {last_margin}. {avenger_name} has spent nine months stewing over that defeat, setting up an intense opening duel.",
        "Redemption is on the table for {avenger_name}, but history paints a daunting picture against {target_name}. Holding an imposing {h2h_record} record and a +{margin_ppg} PPG scoring margin, {target_name} has enjoyed total mastery in this series, including {last_margin}. Sunday offers {avenger_name} the ultimate chance to silence the trash talk.",
        "The league's most one-sided rivalry resumes in Week {week_num}, with {target_name} defending a dominant {h2h_record} ledger against {avenger_name}. Averaging {margin_ppg} more points per contest, {target_name} routed {avenger_name} in {last_margin}, meaning {avenger_name} must summon a flawless lineup to turn the tide.",
        "Scoreboard vengeance is on deck for {avenger_name}, who faces the daunting task of toppling long-time tormentor {target_name}. With {target_name} holding a commanding {h2h_record} edge and a {margin_ppg} PPG scoring disparity, {avenger_name} will need every starter firing to avoid a repeat of {last_margin}.",
        "A long-awaited rematch with serious pride on the line: {target_name} enters Sunday having taken {h2h_losses} games from {avenger_name} all-time while averaging a {margin_ppg} point surplus. Fresh off {last_margin}, {target_name} looks to maintain complete psychological control over his rival.",
        "Can the underdog finally strike back, as {avenger_name} takes the field against nemesis {target_name}? The historical {h2h_record} ledger and +{margin_ppg} PPG margin heavily favor {target_name}, who won their last meeting in {last_margin}. Week {week_num} provides {avenger_name} a golden opportunity to rewrite the script."
    ],

    // 11.4 Franchise Cornerstone Clash
    CORNERSTONE_CLASH: [
        "Heavyweight anchors collide: {manager_a}'s first-round cornerstone {player_a} goes head-to-head with {manager_b}'s anchor {player_b} in Week {week_num}.",
        "The battle of franchise cornerstones: {manager_a} rides {player_a} into Sunday, while {manager_b} counters with elite first-rounder {player_b}.",
        "Draft-capital supremacy on the line, as {manager_a} ({player_a}) and {manager_b} ({player_b}) let their marquee draft assets decide the outcome.",
        "Top-tier firepower collision: {player_a} leads the charge for {manager_a}, matched against {manager_b}'s blue-chip bellcow {player_b}.",
        "When draft day titans collide: {manager_a} and {manager_b} rely on their cornerstone selections ({player_a} vs {player_b}) to anchor opening week.",
        "First-round bragging rights: {manager_a}'s offense revolves around {player_a}, while {manager_b} counters with elite playmaker {player_b}.",
        "A premier individual duel: the Week {week_num} clash between {manager_a} and {manager_b} hinges on the production of superstars {player_a} and {player_b}.",
        "Franchise cornerstones in the spotlight, as {manager_a} trusts {player_a} to outduel {manager_b}'s top weapon {player_b}.",
        "High-stakes draft verification: {manager_a}'s anchor {player_a} and {manager_b}'s anchor {player_b} square off in an immediate Week {week_num} test.",
        "Blue-chip showcase: {player_a} and {player_b} carry their respective franchises into battle, headlining {manager_a} versus {manager_b}."
    ],

    // 11.5 Draft Stack Dependency
    DRAFT_STACK_DEPENDENCY: [
        "High-variance aerial gambit: {manager_name} enters Week {week_num} tethering their fortunes to a full {nfl_team} stack featuring {qb_name} and {pass_catcher}.",
        "Double down or bust: {manager_name} starts the dangerous {qb_name} and {pass_catcher} ({nfl_team}) stack against {opponent_name} on Sunday.",
        "Correlation over safety, as {manager_name} rides the {nfl_team} passing battery of {qb_name} and {pass_catcher} into opening weekend.",
        "A boom-or-bust offensive stack: {manager_name} relies on {qb_name} feeding {pass_catcher} for an explosive Week {week_num} ceiling.",
        "All aerial eggs in one basket: {manager_name} rolls out the {nfl_team} combo of {qb_name} and {pass_catcher}, embracing maximum variance.",
        "The stack dependency strategy: {manager_name} needs fireworks from {nfl_team} this weekend, starting {qb_name} alongside target hog {pass_catcher}.",
        "High-wire chemistry test: {manager_name} deploys {qb_name} and {pass_catcher} in tandem, looking for multiple end zone connections.",
        "Tethered to the {nfl_team} game plan: {manager_name}'s Week {week_num} fate against {opponent_name} will rise and fall with {qb_name} and {pass_catcher}.",
        "Calculated stack synergy: {manager_name} pairs {qb_name} with primary receiver {pass_catcher}, aiming to overpower {opponent_name}.",
        "Aerial leverage play: {manager_name} starts {qb_name} and {pass_catcher}, counting on {nfl_team}'s offensive script to deliver a Week {week_num} victory."
    ],

    // 11.6 Rookie Gamble Radar
    ROOKIE_GAMBLE_RADAR: [
        "In an unprecedented departure from his established draft doctrine, {manager_name} is starting rookie {rookie_pos} {rookie_name} in Week {week_num} against {opponent_name}. Over the past eight seasons, {manager_name} never once trusted a first-year running back with an opening-day start, as relying instead on a proven stable of seasoned veterans. Starting {rookie_name} represents a major tactical wager that could reshape his franchise identity if the youngster produces early.",
        "Franchise traditions get tossed aside in Week {week_num} as {manager_name} inserts rookie {rookie_name} directly into the starting lineup. In eight consecutive seasons, {manager_name} strictly started veteran running backs in Week 1, making this debut a historic milestone for his franchise. Daring {opponent_name} to stop the newcomer, {manager_name} is hunting for instant league-winning leverage.",
        "A startling philosophical pivot unfolds on {manager_name}'s roster, as rookie {rookie_name} earns the Week 1 nod against {opponent_name}. {manager_name}'s historical ledger features zero rookie running back starts in opening week over eight seasons, preferring veteran stability above all else. Locking {rookie_name} into the lineup signals supreme confidence in the rookie's immediate ceiling.",
        "Youth takes center stage for {manager_name}, who breaks an eight-year veteran doctrine by starting rookie {rookie_pos} {rookie_name} against {opponent_name}. Having exclusively rolled out established stars in past Septembers, {manager_name} embraces volatile youth in a bold opening gambit.",
        "Trial by fire for rookie sensation {rookie_name}, as {manager_name} awards the newcomer an immediate start in Week {week_num}. Across eight completed campaigns, {manager_name} had never once started a rookie rusher on kickoff weekend, as choosing instead to let draft picks season on the bench. His faith in {rookie_name} will be tested immediately.",
        "The rookie leap of faith is official: {manager_name} bypasses seasoned depth to start {rookie_name} ({rookie_pos}, {nfl_team}) against {opponent_name}. With an eight-year historical precedent of starting only veteran running backs in Week 1, {manager_name} signals a new era of risk tolerance that has rivals taking notice.",
        "Opening day arrives with a major tactical surprise, as {manager_name} starts rookie {rookie_name} in Week {week_num}. Over eight seasons from 2019 to 2026, {manager_name} maintained a 100% veteran starter rate in the backfield on opening weekend, as making {rookie_name}'s debut a true historic anomaly for the club.",
        "Gambling on pedigree over tenure: {manager_name} locks rookie {rookie_name} into the starting lineup against {opponent_name}. For eight straight seasons, {manager_name}'s September lineups featured only seasoned pros, making this opening nod a radical departure from proven championship blueprints.",
        "A dramatic shift in roster philosophy: {manager_name} entrusts his Week {week_num} fate to rookie {rookie_name}. Having gone eight consecutive years without starting a rookie running back on kickoff weekend, {manager_name} is betting that {rookie_name}'s athletic ceiling will overpower {opponent_name}'s defense.",
        "Unproven talent in prime time, as {manager_name} makes history within his own franchise by starting rookie {rookie_name}. Breaking an eight-year streak of starting exclusively veteran running backs in Week 1, {manager_name} bets that his draft evaluation will pay immediate dividends on Sunday."
    ],

    // 11.7 Preseason LPI Title Favorite
    LPI_PRESEASON_FAVORITE: [
        "The preseason analytics have spoken: {favorite_name} emerges as the title frontrunner with a {title_prob}% championship probability.",
        "Setting the benchmark: algorithmic simulations rate {favorite_name}'s roster as the strongest in the league ({proj_ppg} projected PPG).",
        "Championship favorites on paper, as {favorite_name} claims pole position entering the campaign with {title_prob}% title odds.",
        "The analytical darling of draft season: {favorite_name} boasts the deepest roster in the league, leading all franchises in projected efficiency.",
        "Title pedigree and depth: {favorite_name} leads the preseason board with a projected {proj_ppg} PPG average, setting the standard for the field.",
        "Target on the frontrunner: {favorite_name} enters the season as the undisputed analytical favorite, shadowed closely by {runner_up_name}.",
        "Preseason power rankings crown a leader, as {favorite_name} sits atop the board with {title_prob}% odds to hoist the championship trophy.",
        "Roster construction excellence: {favorite_name}'s balanced draft outputs an elite {proj_ppg} projected scoring baseline.",
        "The gold standard entering Week 1: {favorite_name} claims the top tier of preseason projections with {title_prob}% championship equity.",
        "High expectations from day one: {favorite_name} leads the league in preseason simulations, carrying immense pressure into opening week."
    ],

    // 11.8 Preseason LPI Sacko Hazard
    LPI_SACKO_HAZARD: [
        "Basement anxiety begins before kickoff: {manager_name} faces a {sacko_prob}% preseason probability of enduring the Sacko Bowl.",
        "A daunting path to survival, as preseason projections peg {manager_name} with an uphill climb at {proj_ppg} projected PPG.",
        "The analytical basement warning: {manager_name} enters the season with the league's most precarious projection profile ({sacko_prob}% hazard).",
        "Escaping the bottom tier: {manager_name} must defy preseason projections ({proj_ppg} PPG) to steer clear of the punishment gauntlet.",
        "Immediate pressure in the cellar: simulation algorithms flag {manager_name} as the prime preseason candidate for last place.",
        "Basement hazard alarm: {manager_name} and {rival_name} project near the bottom of the table, separated by razor-thin margin.",
        "The race to avoid the toilet bowl begins now, as {manager_name} carries a league-high {sacko_prob}% risk into Week 1.",
        "Projections demand roster movement: {manager_name}'s current lineup sits at {proj_ppg} projected PPG, raising early red flags.",
        "Fighting the algorithms: {manager_name} looks to disprove a {sacko_prob}% projected probability of facing the annual punishment.",
        "The cellar watch is active from kickoff: {manager_name} must punch above their weight class to overturn modest preseason projections."
    ],

    // 11.9 Preseason Fandom Treason Alert
    PRESEASON_TREASON_ALERT: [
        "Lifelong allegiances take a backseat to fantasy aspirations in Week {week_num}, as diehard {fan_team} supporter {manager_name} is starting {rival_star} of the hated division rival {div_rival}. With critical opening-week points on the line, {manager_name} will have to stomach cheering for enemy touchdowns on Sunday afternoon.",
        "A true crisis of conscience unfolds for {manager_name}, who pledges loyalty to the {fan_team} on Sundays but relies on {div_rival} playmaker {rival_star} for fantasy scoring. If {rival_star} goes off, {manager_name} wins in fantasy, as but watches their real-life team suffer divisional damage.",
        "Fantasy football forces bitter compromises, and none is harsher than {manager_name} starting {rival_star} of the despised {div_rival}. Despite years of vocal devotion to the {fan_team}, {manager_name} has placed regular season victory ahead of team pride on opening weekend.",
        "The ultimate rooting dilemma arrives in Week {week_num}: {manager_name} wants the {fan_team} to dominate, yet needs explosive production from {div_rival} standout {rival_star}. Every yard gained by {rival_star} will sting the heart, as while padding the fantasy box score.",
        "Fandom treason is alive and well in Week {week_num}, as {manager_name} locks {div_rival} star {rival_star} into the starting lineup. Known across the league as an ardent {fan_team} fan, {manager_name} will be secretly praying for division rival explosive plays on Sunday.",
        "Sunday afternoon promises emotional turmoil for {manager_name}, who is banking on {rival_star} ({div_rival}) to deliver a Week {week_num} win. Benching conscience for projected volume, the {fan_team} backer must navigate 60 minutes of conflicting rooting interests.",
        "Betrayal on opening weekend: {manager_name} entrusts a starting roster spot to {rival_star}, a key weapon for hated division rival {div_rival}. The {fan_team} faithful will surely hold this against {manager_name} if {rival_star} produces a game-winning score.",
        "Pride takes a back seat to points, as {fan_team} supporter {manager_name} starts {rival_star} ({div_rival}) in Week {week_num}. Watching rival highlights with nervous excitement is the price {manager_name} must pay in pursuit of early-season standings leverage.",
        "Divided loyalties on game day: {manager_name} roots passionately for the {fan_team}, but needs a monster stat line from {div_rival} weapon {rival_star} to secure victory. Roster pragmatism has completely overwhelmed real-world sports devotion.",
        "The bitter taste of compromise: {manager_name} has deployed {rival_star} of division foe {div_rival} in the opening-day lineup. Should {rival_star} torch the defense, {manager_name} will celebrate the fantasy triumph, as quietly burying their {fan_team} gear in the closet."
    ],

    // 11.10 Historical Week 1 Streak (The September Hex & Specialists)
    WEEK1_HISTORICAL_STREAK: [
        "Opening week has been a house of horrors for {manager_name}, who enters Sunday mired in a {streak_len}-year Week 1 losing streak dating back to {start_year}. In an eerie twist of fate, {manager_name}'s last Week 1 triumph came back in September {last_win_year}, against none other than upcoming opponent {opponent_name}. With an all-time opening week record of {w1_record}, the pressure to finally exorcise the September demons is at a fever pitch.",
        "Few calendar trends are more confounding than {manager_name}'s opening-day struggles, having dropped {streak_len} consecutive Week 1 contests since {start_year}. While {manager_name} has regularly rebounded to make playoff runs, starting {w1_record} all-time on opening day means facing {opponent_name} carries extra urgency to avoid falling behind the field.",
        "The September hex strikes again, as {manager_name} looks to halt a {streak_len}-year Week 1 losing streak on Sunday. Having not tasted victory on kickoff weekend since September {last_win_year} when defeating {last_win_opp}, {manager_name} must break through against {opponent_name} to stop the narrative in its tracks.",
        "A frustrating tradition {manager_name} is desperate to end: {streak_len} straight seasons starting 0-1. Dating back to {start_year}, opening week has repeatedly produced bizarre duds and bad breaks, leaving {manager_name} with a {w1_record} lifetime mark in Week 1. Defeating {opponent_name} would lift a massive psychological weight.",
        "September anxiety is real for {manager_name}, who hasn't celebrated a Week 1 triumph in {streak_len} calendar years. The last opening win came in {last_win_year} over {last_win_opp}, as {manager_name} now faces {opponent_name} hoping that renewed draft capital will finally put an end to the league's longest active opening-day drought.",
        "Haunted by past kickoff weekends, {manager_name} enters Week {week_num} looking to reverse a {streak_len}-season skid. Despite boasting strong rosters year after year, {manager_name} sits at {w1_record} all-time in season openers, as making Sunday's contest against {opponent_name} a crucial test of early-season preparation.",
        "Can {manager_name} finally escape the opening-day trap, having dropped {streak_len} consecutive season openers dating back to {start_year}? His last Week 1 victory occurred in {last_win_year} against {last_win_opp}, as {opponent_name} aims to keep {manager_name} searching for answers for another year.",
        "The calendar turns to September, and with it comes {manager_name}'s most frustrating historical hurdle: a {streak_len}-year Week 1 losing streak. Carrying an all-time opening record of {w1_record}, {manager_name} faces {opponent_name} knowing that a fast start is overdue.",
        "Exorcising September demons is the primary objective for {manager_name}, who enters Sunday with {streak_len} straight Week 1 losses on his ledger. With the last opening win arriving in {last_win_year} against {last_win_opp}, {manager_name} takes the field against {opponent_name} determined to write a different chapter.",
        "A {streak_len}-year opening drought hangs over {manager_name} entering Week {week_num}. Having dropped every season opener since {start_year} to slide to {w1_record} all-time in Week 1, {manager_name} must summon a complete performance against {opponent_name} to finally crack the win column in September."
    ]
};
`;

// Replace Module 11 in content
const mod11Start = content.indexOf('    // MODULE 11: PROSPECTIVE');
if (mod11Start !== -1) {
  content = content.substring(0, mod11Start) + updatedModule11;
}

fs.writeFileSync(templatePath, content, 'utf8');
console.log('Successfully patched Module 11 templates in newsletter_templates.js');
