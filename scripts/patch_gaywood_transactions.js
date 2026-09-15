import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const standingsPath = path.join(rootDir, 'gaywoodfantasy', 'data', 'league_standings.json');
const transactionsPath = path.join(rootDir, 'gaywoodfantasy', 'data', 'transactions.json');

const standings = JSON.parse(fs.readFileSync(standingsPath, 'utf8'));
const transactions = JSON.parse(fs.readFileSync(transactionsPath, 'utf8'));

// Build mappings: `${year}_${manager_id.toLowerCase()}` -> team_name
const teamMapByYear = new Map();
const latestTeamMap = new Map();

// Sort standings by year ascending so latest ends up in latestTeamMap
const sortedStandings = [...standings].sort((a, b) => Number(a.year || a.season) - Number(b.year || b.season));

sortedStandings.forEach(s => {
  const yr = Number(s.year || s.season);
  const mid = String(s.manager_id || s.managerId || '').toLowerCase().trim();
  const tName = s.team_name || s.teamName;
  if (!mid || !tName || tName.endsWith("'s Team") || tName.startsWith("Team ")) return;

  teamMapByYear.set(`${yr}_${mid}`, tName);
  latestTeamMap.set(mid, tName);
});

console.log(`Loaded ${teamMapByYear.size} year-specific team name mappings across ${latestTeamMap.size} managers.`);

let updatedCount = 0;
let partnerUpdatedCount = 0;

transactions.forEach(tx => {
  const yr = Number(tx.season || tx.year);
  const mid = String(tx.manager_id || '').toLowerCase().trim();
  const partnerMid = String(tx.trade_partner_manager_id || '').toLowerCase().trim();

  // Check team_name
  if (!tx.team_name || tx.team_name.endsWith("'s Team") || tx.team_name.startsWith("Team ")) {
    const realName = teamMapByYear.get(`${yr}_${mid}`) || latestTeamMap.get(mid);
    if (realName) {
      tx.team_name = realName;
      updatedCount++;
    }
  }

  // Check trade_partner_team
  if (tx.trade_partner_team && (tx.trade_partner_team.endsWith("'s Team") || tx.trade_partner_team.startsWith("Team "))) {
    const realPartnerName = teamMapByYear.get(`${yr}_${partnerMid}`) || latestTeamMap.get(partnerMid);
    if (realPartnerName) {
      tx.trade_partner_team = realPartnerName;
      partnerUpdatedCount++;
    }
  }
});

fs.writeFileSync(transactionsPath, JSON.stringify(transactions, null, 2), 'utf8');
console.log(`Successfully updated ${updatedCount} transactions and ${partnerUpdatedCount} trade partners in gaywoodfantasy/data/transactions.json!`);
