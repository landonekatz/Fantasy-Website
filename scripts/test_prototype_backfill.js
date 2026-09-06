import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const NICKNAME_TO_ABBR = {
  '49ers': 'SF', 'bears': 'CHI', 'bengals': 'CIN', 'bills': 'BUF',
  'broncos': 'DEN', 'browns': 'CLE', 'buccaneers': 'TB', 'cardinals': 'ARI',
  'chargers': 'LAC', 'chiefs': 'KC', 'colts': 'IND', 'commanders': 'WAS',
  'cowboys': 'DAL', 'dolphins': 'MIA', 'eagles': 'PHI', 'falcons': 'ATL',
  'giants': 'NYG', 'jaguars': 'JAX', 'jets': 'NYJ', 'lions': 'DET',
  'packers': 'GB', 'panthers': 'CAR', 'patriots': 'NE', 'raiders': 'OAK',
  'rams': 'LAR', 'ravens': 'BAL', 'saints': 'NO', 'seahawks': 'SEA',
  'steelers': 'PIT', 'texans': 'HOU', 'titans': 'TEN', 'vikings': 'MIN'
};

function clean(n) {
  return String(n || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatSleeperStats(stats, pos) {
  if (!stats) return '';
  let out = [];

  // DEFENSE / SPECIAL TEAMS
  if (pos === 'D/ST' || pos === 'DEF') {
    const ptsAllowed = stats.pts_allow;
    const ydsAllowed = stats.yds_allow;
    const sacks = Math.round(stats.sack || 0);
    const ints = Math.round(stats.int || 0);
    const fumRec = Math.round(stats.fum_rec || 0);
    const safeties = Math.round(stats.safety || 0);
    const blocks = Math.round(stats.blk_kick || 0);
    const defTD = Math.round((stats.def_td || 0) + (stats.st_td || 0));

    if (defTD > 0) out.push(`${defTD} TD`);
    if (ptsAllowed != null) {
      if (ptsAllowed >= 35) out.push('Pts Allow 35+');
      else if (ptsAllowed >= 28) out.push('Pts Allow 28-34');
      else if (ptsAllowed === 0) out.push('Pts Allow 0');
      else out.push(`PA: ${ptsAllowed}`);
    }
    if (sacks > 0) out.push(`${sacks} Sack${sacks > 1 ? 's' : ''}`);
    if (ints > 0) out.push(`${ints} Int`);
    if (fumRec > 0) out.push(`${fumRec} Fum Rec`);
    if (safeties > 0) out.push(`${safeties} Safety`);
    if (blocks > 0) out.push(`${blocks} Blk`);
    return out.join(', ');
  }

  // KICKER
  if (pos === 'K') {
    const fgMade = Math.round(stats.fgm || 0);
    const fgAtt = Math.round(stats.fga || 0);
    const patMade = Math.round(stats.xpm || 0);
    const patAtt = Math.round(stats.xpa || 0);
    const fg50 = Math.round(stats.fgm_50p || 0);
    
    if (fgMade > 0 || fgAtt > 0) {
      let fgStr = `${fgMade}/${Math.max(fgMade, fgAtt)} FG`;
      if (fg50 > 0) fgStr += ` (${fg50} 50+)`;
      out.push(fgStr);
    }
    if (patMade > 0 || patAtt > 0) {
      out.push(`${patMade}/${Math.max(patMade, patAtt)} XP`);
    }
    return out.join(', ');
  }

  // OFFENSE: QB, RB, WR, TE
  const passYd = Math.round(stats.pass_yd || 0);
  const passTd = Math.round(stats.pass_td || 0);
  const passInt = Math.round(stats.pass_int || 0);
  const passCmp = Math.round(stats.pass_cmp || 0);
  const passAtt = Math.round(stats.pass_att || 0);

  if (passYd !== 0 || passTd > 0 || passAtt > 0) {
    if (passYd !== 0) out.push(`${passYd} Pass Yds`);
    if (passTd > 0) out.push(`${passTd} Pass TD`);
    if (passInt > 0) out.push(`${passInt} INT`);
  }

  const rushYd = Math.round(stats.rush_yd || 0);
  const rushAtt = Math.round(stats.rush_att || 0);
  const rushTd = Math.round(stats.rush_td || 0);
  if (rushYd !== 0) out.push(`${rushYd} Rush Yds`);
  if (rushTd > 0) out.push(`${rushTd} Rush TD`);
  if (rushAtt > 0 && pos === 'RB') out.push(`${rushAtt} Att`);

  const recYd = Math.round(stats.rec_yd || 0);
  const recs = Math.round(stats.rec || 0);
  const recTd = Math.round(stats.rec_td || 0);
  if (recYd !== 0) out.push(`${recYd} Rec Yds`);
  if (recs > 0) out.push(`${recs} Rec`);
  if (recTd > 0) out.push(`${recTd} Rec TD`);

  const fumLost = Math.round(stats.fum_lost || 0);
  if (fumLost > 0) {
    out.push(`${fumLost} Fum`);
  }

  return out.join(', ');
}

async function run() {
  console.log('Testing prototype backfill on 2019 Week 1...');
  const sleeperW1 = await fetch('https://api.sleeper.app/v1/stats/nfl/regular/2018/1').then(r => r.json());
  const espnW1 = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=1&dates=2018').then(r => r.json());

  const teamGameMap = {};
  espnW1.events.forEach(e => {
    const comp = e.competitions[0];
    const home = comp.competitors.find(c => c.homeAway === 'home');
    const away = comp.competitors.find(c => c.homeAway === 'away');
    let hTeam = home.team.abbreviation;
    let aTeam = away.team.abbreviation;
    if (hTeam === 'WSH') hTeam = 'WAS';
    if (aTeam === 'WSH') aTeam = 'WAS';
    if (hTeam === 'JAC') hTeam = 'JAX';
    if (aTeam === 'JAC') aTeam = 'JAX';
    const hScore = Number(home.score);
    const aScore = Number(away.score);
    const hWin = hScore > aScore ? 'W' : (hScore < aScore ? 'L' : 'T');
    const aWin = aScore > hScore ? 'W' : (aScore < hScore ? 'L' : 'T');
    teamGameMap[hTeam] = { opp: aTeam, res: `Final ${hWin} ${hScore}-${aScore}            vs` };
    teamGameMap[aTeam] = { opp: hTeam, res: `Final ${aWin} ${aScore}-${hScore}            @` };
  });

  const sleeperPlayers = await fetch('https://api.sleeper.app/v1/players/nfl').then(r => r.json());
  const nameToPlayer = {};
  Object.values(sleeperPlayers).forEach(p => {
    const k = clean((p.first_name || '') + ' ' + (p.last_name || ''));
    if (k) {
      if (!nameToPlayer[k]) nameToPlayer[k] = [];
      nameToPlayer[k].push(p);
    }
  });

  const stats = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'weekly_player_stats.json'), 'utf8'));
  const dmsDraft = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'draft_results.json'), 'utf8'));
  const draftMap = new Map();
  dmsDraft.forEach(p => {
    const yr = p.year || p.season;
    const k = `${yr}_${clean(p.player_name)}`;
    if (!draftMap.has(k) && p.nfl_team) draftMap.set(k, p.nfl_team);
  });

  const game = stats.filter(p => p.season === 2019 && p.week === 1 && p.team_id === 1 && p.is_starter);
  console.log('Results for 2019 Week 1 Team 1:');
  game.forEach(p => {
    const isDef = p.position === 'DEF' || p.roster_slot === 'DEF';
    let teamAbbr = '';
    let statObj = null;

    if (isDef) {
      const nick = clean(p.player_name);
      teamAbbr = NICKNAME_TO_ABBR[nick] || 'CAR';
      statObj = sleeperW1[teamAbbr];
    } else {
      const k = clean(p.player_name);
      const cands = nameToPlayer[k] || [];
      const match = cands.find(c => c.player_id && sleeperW1[c.player_id]) || cands[0];
      if (match) {
        statObj = sleeperW1[match.player_id];
        teamAbbr = draftMap.get(`2019_${k}`) || match.team;
      }
    }

    const statLine = formatSleeperStats(statObj, p.position || p.roster_slot);
    const gameInfo = teamAbbr && teamGameMap[teamAbbr] ? teamGameMap[teamAbbr] : null;

    console.log(`${p.roster_slot} ${p.player_name} (${p.fantasy_points} pts):`);
    console.log(`  nfl_team: "${gameInfo?.opp || teamAbbr || ''}"`);
    console.log(`  nfl_game_result: "${gameInfo?.res || ''}"`);
    console.log(`  nfl_stat_line: "${statLine}"`);
  });
}

run();
