const fs = require('fs');
const matchups = JSON.parse(fs.readFileSync('/Users/Landon/Documents/Fantasy-Website/dad-league/data/matchups.json'));
const standings = JSON.parse(fs.readFileSync('/Users/Landon/Documents/Fantasy-Website/dad-league/data/league_standings.json'));

const m = matchups.find(x => x.year === 2015 && x.home_manager_id);
console.log("Matchup home_manager_id:", m.home_manager_id);

const s = standings.find(row => row.year === 2015 && row.manager_id === m.home_manager_id);
console.log("Found standing:", s ? s.final_rank : "NOT FOUND");
