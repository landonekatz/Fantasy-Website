/**
 * NFLGamesService
 * Live and historical NFL game scores and schedule service.
 * Ingests live regular season scores from ESPN's public Scoreboard API
 * and falls back to local historical master data for past seasons.
 */

const TEAM_ABBREV_ALIASES = {
  'WSH': 'WAS',
  'JAC': 'JAX',
  'LA': 'LAR',
  'SD': 'LAC',
  'OAK': 'LV',
  'STL': 'LAR'
};

export class NFLGamesService {
  constructor() {
    this.gamesCache = new Map(); // key: `${season}_${week}_${team}` -> result string
    this.allGames = []; // Array of game objects { season, week, home, home_score, away, away_score, status }
    this.fetchedWeeks = new Set(); // Set of `${season}_${week}`
  }

  normalizeTeam(team) {
    if (!team) return '';
    const upper = String(team).toUpperCase().trim();
    return TEAM_ABBREV_ALIASES[upper] || upper;
  }

  /**
   * Load historical CSV data as baseline.
   * Works with raw CSV text string from nfl_all_games_master.csv.
   */
  loadCsvData(csvText) {
    if (!csvText) return;
    const lines = csvText.split('\n');
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length >= 8) {
        const season = parseInt(parts[1], 10);
        const week = parseInt(parts[2], 10);
        const home = this.normalizeTeam(parts[4]);
        const home_score = parseInt(parts[5], 10);
        const away = this.normalizeTeam(parts[6]);
        const away_score = parseInt(parts[7], 10);

        if (!isNaN(season) && !isNaN(week)) {
          this.addGame({
            season,
            week,
            home,
            home_score,
            away,
            away_score,
            status: 'post'
          });
        }
      }
    }
  }

  addGame(game) {
    this.allGames.push(game);
    const { season, week, home, home_score, away, away_score, status } = game;
    
    // Index home team result
    const homeResult = this.formatResult(home_score, away_score, away, status);
    this.gamesCache.set(`${season}_${week}_${home}`, homeResult);

    // Index away team result
    const awayResult = this.formatResult(away_score, home_score, home, status);
    this.gamesCache.set(`${season}_${week}_${away}`, awayResult);
  }

  formatResult(teamScore, oppScore, oppTeam, status) {
    if (status === 'in') {
      return `${teamScore}-${oppScore} vs ${oppTeam} (Live)`;
    }
    if (status === 'pre') {
      return `vs ${oppTeam}`;
    }
    if (teamScore > oppScore) return `W ${teamScore}-${oppScore} vs ${oppTeam}`;
    if (teamScore < oppScore) return `L ${teamScore}-${oppScore} vs ${oppTeam}`;
    return `T ${teamScore}-${oppScore} vs ${oppTeam}`;
  }

  /**
   * Fetches official live game schedule and scores for a specific NFL season and week from ESPN Scoreboard API.
   */
  async fetchWeeklyGames(season, week) {
    const yr = Number(season);
    const wk = Number(week);
    const key = `${yr}_${wk}`;
    if (this.fetchedWeeks.has(key)) return;

    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${yr}&seasontype=2&week=${wk}`;
      const res = await fetch(url);
      if (!res.ok) return;

      const data = await res.json();
      const events = data.events || [];

      for (const ev of events) {
        const comp = (ev.competitions && ev.competitions[0]) || {};
        const comps = comp.competitors || [];
        const homeComp = comps.find(c => c.homeAway === 'home') || {};
        const awayComp = comps.find(c => c.homeAway === 'away') || {};

        const home = this.normalizeTeam(homeComp.team?.abbreviation);
        const away = this.normalizeTeam(awayComp.team?.abbreviation);
        const home_score = parseInt(homeComp.score || 0, 10);
        const away_score = parseInt(awayComp.score || 0, 10);
        const status = ev.status?.type?.state || 'post'; // 'pre', 'in', 'post'

        if (home && away) {
          this.addGame({
            season: yr,
            week: wk,
            home,
            home_score,
            away,
            away_score,
            status
          });
        }
      }

      this.fetchedWeeks.add(key);
    } catch (e) {
      console.warn(`[NFLGamesService] Failed to fetch live games for ${yr} Week ${wk}:`, e.message);
    }
  }

  /**
   * Pre-fetches an entire season's weekly games from ESPN in parallel.
   */
  async fetchSeasonGames(season, maxWeeks = 18) {
    const yr = Number(season);
    const promises = [];
    for (let w = 1; w <= maxWeeks; w++) {
      promises.push(this.fetchWeeklyGames(yr, w));
    }
    await Promise.allSettled(promises);
  }

  /**
   * Returns formatted game result string e.g. "W 27-20 vs BAL" for a team in a given season & week.
   */
  getGameResult(season, week, team) {
    const norm = this.normalizeTeam(team);
    const key = `${Number(season)}_${Number(week)}_${norm}`;
    return this.gamesCache.get(key) || null;
  }
}

// Export singleton instance
export const nflGamesService = new NFLGamesService();
