/**
 * Historical NFL Teams Lookup Service
 * Resolves season-accurate NFL teams at the time of fantasy drafts (2015-2027)
 */
import historicalTeamsData from './nfl_historical_teams_data.json';

const DEFENSE_MAP = {
  'patriots': 'NE', 'new england patriots': 'NE', 'patriots dst': 'NE', 'new england patriots dst': 'NE', 'patriots d/st': 'NE',
  'broncos': 'DEN', 'denver broncos': 'DEN', 'broncos dst': 'DEN', 'denver broncos dst': 'DEN', 'broncos d/st': 'DEN',
  'chiefs': 'KC', 'kansas city chiefs': 'KC', 'chiefs dst': 'KC', 'kansas city chiefs dst': 'KC', 'chiefs d/st': 'KC',
  'seahawks': 'SEA', 'seattle seahawks': 'SEA', 'seahawks dst': 'SEA', 'seattle seahawks dst': 'SEA', 'seahawks d/st': 'SEA',
  'texans': 'HOU', 'houston texans': 'HOU', 'texans dst': 'HOU', 'houston texans dst': 'HOU', 'texans d/st': 'HOU',
  'ravens': 'BAL', 'baltimore ravens': 'BAL', 'ravens dst': 'BAL', 'baltimore ravens dst': 'BAL', 'ravens d/st': 'BAL',
  'steelers': 'PIT', 'pittsburgh steelers': 'PIT', 'steelers dst': 'PIT', 'pittsburgh steelers dst': 'PIT', 'steelers d/st': 'PIT',
  'rams': 'LAR', 'los angeles rams': 'LAR', 'st louis rams': 'LAR', 'rams dst': 'LAR', 'los angeles rams dst': 'LAR', 'rams d/st': 'LAR',
  'chargers': 'LAC', 'los angeles chargers': 'LAC', 'san diego chargers': 'LAC', 'chargers dst': 'LAC', 'los angeles chargers dst': 'LAC', 'chargers d/st': 'LAC',
  'eagles': 'PHI', 'philadelphia eagles': 'PHI', 'eagles dst': 'PHI', 'philadelphia eagles dst': 'PHI', 'eagles d/st': 'PHI',
  'cowboys': 'DAL', 'dallas cowboys': 'DAL', 'cowboys dst': 'DAL', 'dallas cowboys dst': 'DAL', 'cowboys d/st': 'DAL',
  '49ers': 'SF', 'san francisco 49ers': 'SF', '49ers dst': 'SF', 'san francisco 49ers dst': 'SF', '49ers d/st': 'SF',
  'bills': 'BUF', 'buffalo bills': 'BUF', 'bills dst': 'BUF', 'buffalo bills dst': 'BUF', 'bills d/st': 'BUF',
  'dolphins': 'MIA', 'miami dolphins': 'MIA', 'dolphins dst': 'MIA', 'miami dolphins dst': 'MIA', 'dolphins d/st': 'MIA',
  'jets': 'NYJ', 'new york jets': 'NYJ', 'jets dst': 'NYJ', 'new york jets dst': 'NYJ', 'jets d/st': 'NYJ',
  'giants': 'NYG', 'new york giants': 'NYG', 'giants dst': 'NYG', 'new york giants dst': 'NYG', 'giants d/st': 'NYG',
  'commanders': 'WAS', 'washington commanders': 'WAS', 'washington football team': 'WAS', 'redskins': 'WAS', 'washington redskins': 'WAS', 'commanders dst': 'WAS', 'washington dst': 'WAS', 'commanders d/st': 'WAS',
  'vikings': 'MIN', 'minnesota vikings': 'MIN', 'vikings dst': 'MIN', 'minnesota vikings dst': 'MIN', 'vikings d/st': 'MIN',
  'packers': 'GB', 'green bay packers': 'GB', 'packers dst': 'GB', 'green bay packers dst': 'GB', 'packers d/st': 'GB',
  'bears': 'CHI', 'chicago bears': 'CHI', 'bears dst': 'CHI', 'chicago bears dst': 'CHI', 'bears d/st': 'CHI',
  'lions': 'DET', 'detroit lions': 'DET', 'lions dst': 'DET', 'detroit lions dst': 'DET', 'lions d/st': 'DET',
  'saints': 'NO', 'new orleans saints': 'NO', 'saints dst': 'NO', 'new orleans saints dst': 'NO', 'saints d/st': 'NO',
  'buccaneers': 'TB', 'tampa bay buccaneers': 'TB', 'buccaneers dst': 'TB', 'tampa bay buccaneers dst': 'TB', 'buccaneers d/st': 'TB',
  'falcons': 'ATL', 'atlanta falcons': 'ATL', 'falcons dst': 'ATL', 'atlanta falcons dst': 'ATL', 'falcons d/st': 'ATL',
  'panthers': 'CAR', 'carolina panthers': 'CAR', 'panthers dst': 'CAR', 'carolina panthers dst': 'CAR', 'panthers d/st': 'CAR',
  'cardinals': 'ARI', 'arizona cardinals': 'ARI', 'cardinals dst': 'ARI', 'arizona cardinals dst': 'ARI', 'cardinals d/st': 'ARI',
  'jaguars': 'JAX', 'jacksonville jaguars': 'JAX', 'jaguars dst': 'JAX', 'jacksonville jaguars dst': 'JAX', 'jaguars d/st': 'JAX',
  'titans': 'TEN', 'tennessee titans': 'TEN', 'titans dst': 'TEN', 'tennessee titans dst': 'TEN', 'titans d/st': 'TEN',
  'colts': 'IND', 'indianapolis colts': 'IND', 'colts dst': 'IND', 'indianapolis colts dst': 'IND', 'colts d/st': 'IND',
  'browns': 'CLE', 'cleveland browns': 'CLE', 'browns dst': 'CLE', 'cleveland browns dst': 'CLE', 'browns d/st': 'CLE',
  'bengals': 'CIN', 'cincinnati bengals': 'CIN', 'bengals dst': 'CIN', 'bengals dst': 'CIN', 'bengals d/st': 'CIN',
  'raiders': 'LV', 'las vegas raiders': 'LV', 'oakland raiders': 'LV', 'raiders dst': 'LV', 'oakland raiders dst': 'LV', 'raiders d/st': 'LV'
};

const ALIASES = {
  'hollywood brown': 'marquise brown',
  'robby anderson': 'robbie chosen',
  'chosen anderson': 'robbie chosen',
  'mitch trubisky': 'mitchell trubisky',
  'gabriel davis': 'gabe davis',
  'josh palmer': 'joshua palmer',
  'chigoziem okonkwo': 'chig okonkwo',
  'ken walker': 'kenneth walker',
  'deandre swift': 'dandre swift',
  'cameron akers': 'cam akers',
  'matt stafford': 'matthew stafford',
  'christopher godwin': 'chris godwin',
  'will fuller': 'william fuller',
  'kenneth gainwell': 'kenny gainwell',
  'jeffrey wilson': 'jeff wilson',
  'ben watson': 'benjamin watson',
  'eli mitchell': 'elijah mitchell',
  'nyheim millerhines': 'nyheim hines'
};

class HistoricalTeamsService {
  constructor() {
    this.data = historicalTeamsData || {};
  }

  cleanName(name) {
    if (!name) return '';
    const norm = String(name)
      .toLowerCase()
      .replace(/\b(dst|d\/st|defense)\b/g, '')
      .replace(/\b(jr|sr|ii|iii|iv|v|\.|\')\b/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return ALIASES[norm] || norm;
  }

  getTeam(playerName, year, position = '') {
    if (!playerName || playerName.includes('Player #-1') || playerName.includes('Pass / Empty Slot')) {
      return '';
    }
    const yr = Number(year);
    const pos = String(position || '').toUpperCase();
    const cName = this.cleanName(playerName);

    // 1. Defenses
    if (pos === 'DEF' || pos === 'D/ST' || DEFENSE_MAP[cName] || DEFENSE_MAP[playerName.toLowerCase()]) {
      const dTeam = DEFENSE_MAP[cName] || DEFENSE_MAP[playerName.toLowerCase()];
      if (dTeam) return dTeam;
    }

    // 2. Exact year match
    const yearData = this.data[yr];
    if (yearData) {
      const team = yearData[cName + (pos ? '_' + pos.toLowerCase() : '')] || yearData[cName];
      if (team) return team;
    }

    // 3. Fallback to previous seasons (last active NFL team before retirement / draft)
    for (let prevYr = yr - 1; prevYr >= 2015; prevYr--) {
      const prevData = this.data[prevYr];
      if (prevData) {
        const prevTeam = prevData[cName + (pos ? '_' + pos.toLowerCase() : '')] || prevData[cName];
        if (prevTeam) return prevTeam;
      }
    }

    // 4. Fallback to subsequent seasons (rookie drafted before final roster cut)
    for (let nextYr = yr + 1; nextYr <= 2027; nextYr++) {
      const nextData = this.data[nextYr];
      if (nextData) {
        const nextTeam = nextData[cName + (pos ? '_' + pos.toLowerCase() : '')] || nextData[cName];
        if (nextTeam) return nextTeam;
      }
    }

    return '';
  }
}

export const nflHistoricalTeams = new HistoricalTeamsService();
if (typeof window !== 'undefined') {
  window.NFLHistoricalTeams = nflHistoricalTeams;
}
