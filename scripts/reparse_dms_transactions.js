// scripts/reparse_dms_transactions.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const managersData = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'managers.json'), 'utf8'));
const currentTxs = JSON.parse(fs.readFileSync(path.join(rootDir, 'dmsfantasy', 'data', 'transactions.json'), 'utf8'));

// Build team_name -> manager lookup
const teamLookup = new Map();
const managerNameMap = new Map();

(managersData.managers || []).forEach(m => {
  managerNameMap.set(m.id, m.name);
});

(managersData.team_mappings || []).forEach(tm => {
  const normName = tm.team_name.toLowerCase().replace(/['’]/g, "'").trim();
  const key = `${tm.year}_${normName}`;
  const mName = managerNameMap.get(tm.manager_id) || tm.manager_id;
  teamLookup.set(key, { id: tm.manager_id, name: mName, teamName: tm.team_name });
});

function findManager(year, rawTeamName) {
  if (!rawTeamName) return { id: '', name: '', teamName: '' };
  const norm = rawTeamName.toLowerCase().replace(/['’]/g, "'").trim();
  const key = `${year}_${norm}`;
  if (teamLookup.has(key)) return teamLookup.get(key);

  // Fallback fuzzy search across that year
  for (const [k, v] of teamLookup.entries()) {
    if (k.startsWith(`${year}_`)) {
      const teamPart = k.replace(`${year}_`, '');
      if (teamPart.includes(norm) || norm.includes(teamPart)) {
        return v;
      }
    }
  }

  // Fallback across any year
  for (const [k, v] of teamLookup.entries()) {
    const teamPart = k.split('_').slice(1).join('_');
    if (teamPart === norm || teamPart.includes(norm) || norm.includes(teamPart)) {
      return v;
    }
  }

  return { id: '', name: rawTeamName, teamName: rawTeamName };
}

function cleanText(str) {
  return str ? str.replace(/\s+/g, ' ').trim() : '';
}

function parseYahooTrades() {
  const years = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027];
  const parsedTrades = [];

  for (const year of years) {
    const txDir = path.join(rootDir, 'scraper', 'raw_data', String(year), 'transactions');
    if (!fs.existsSync(txDir)) continue;

    const files = fs.readdirSync(txDir).filter(f => f.endsWith('.html'));
    // Sort count files ascending
    files.sort((a, b) => {
      const na = parseInt((a.match(/\d+/) || [0])[0]);
      const nb = parseInt((b.match(/\d+/) || [0])[0]);
      return na - nb;
    });

    for (const f of files) {
      const html = fs.readFileSync(path.join(txDir, f), 'utf8');
      const tableStart = html.indexOf('<table');
      const tableEnd = html.indexOf('</table>');
      if (tableStart === -1 || tableEnd === -1) continue;

      const tableHtml = html.slice(tableStart, tableEnd + 8);
      const trs = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m => m[0]);

      for (let i = 0; i < trs.length; i++) {
        const tr = trs[i];
        if (tr.includes('<th')) continue;

        if (tr.includes('Traded to') || tr.includes('F-trade')) {
          // Extract players who have actual sports.yahoo.com links
          const playerMatches1 = [...tr.matchAll(/<a[^>]+href="([^"]*sports\.yahoo\.com\/nfl\/(?:players|teams)\/[^"]*)"[^>]*>([^<]+)<\/a>/gi)].map(m => cleanText(m[2]));
          const teamMatch1 = tr.match(/f1\/\d+\/\d+">([^<]+)<\/a>/i);
          const timeMatch1 = tr.match(/F-timestamp[^>]*>([^<]+)<\/span>/i);
          const team1 = cleanText(teamMatch1 ? teamMatch1[1] : '');
          const time1 = cleanText(timeMatch1 ? timeMatch1[1] : '');

          // Lookahead for side 2
          const nextTr = trs[i + 1];
          if (nextTr && (nextTr.includes('Traded to') || (nextTr.includes('f1/') && nextTr.includes('F-timestamp')))) {
            const playerMatches2 = [...nextTr.matchAll(/<a[^>]+href="([^"]*sports\.yahoo\.com\/nfl\/(?:players|teams)\/[^"]*)"[^>]*>([^<]+)<\/a>/gi)].map(m => cleanText(m[2]));
            const teamMatch2 = nextTr.match(/f1\/\d+\/\d+">([^<]+)<\/a>/i);
            const timeMatch2 = nextTr.match(/F-timestamp[^>]*>([^<]+)<\/span>/i);
            const team2 = cleanText(teamMatch2 ? teamMatch2[1] : '');
            const time2 = cleanText(timeMatch2 ? timeMatch2[1] : '');

            const mgr1 = findManager(year, team1);
            const mgr2 = findManager(year, team2);

            const allTraded = [...new Set([...playerMatches1, ...playerMatches2])];

            // Record Side 1 (Team 1)
            parsedTrades.push({
              season: year,
              type: 'trade',
              action_type: 'TRADE',
              timestamp: time1 || time2,
              team_name: mgr1.teamName || team1,
              manager_id: mgr1.id,
              manager_name: mgr1.name,
              trade_partner_team: mgr2.teamName || team2,
              trade_partner_manager_id: mgr2.id,
              trade_partner_manager_name: mgr2.name,
              added_players: playerMatches1,
              dropped_players: playerMatches2,
              traded_players: allTraded,
              partner_added_players: playerMatches2,
              partner_dropped_players: playerMatches1,
              faab_bid: 0,
              details: `${mgr1.name} received ${playerMatches1.join(', ') || 'picks'}; ${mgr2.name} received ${playerMatches2.join(', ') || 'picks'}`
            });

            // Record Side 2 (Team 2)
            parsedTrades.push({
              season: year,
              type: 'trade',
              action_type: 'TRADE',
              timestamp: time2 || time1,
              team_name: mgr2.teamName || team2,
              manager_id: mgr2.id,
              manager_name: mgr2.name,
              trade_partner_team: mgr1.teamName || team1,
              trade_partner_manager_id: mgr1.id,
              trade_partner_manager_name: mgr1.name,
              added_players: playerMatches2,
              dropped_players: playerMatches1,
              traded_players: allTraded,
              partner_added_players: playerMatches1,
              partner_dropped_players: playerMatches2,
              faab_bid: 0,
              details: `${mgr2.name} received ${playerMatches2.join(', ') || 'picks'}; ${mgr1.name} received ${playerMatches1.join(', ') || 'picks'}`
            });

            i++; // skip side 2 row
          }
        }
      }
    }
  }

  return parsedTrades;
}

const rawParsedTrades = parseYahooTrades();
console.log(`Parsed ${rawParsedTrades.length} trade sides (${rawParsedTrades.length / 2} distinct trades) from raw HTML files.`);

// Filter out existing broken trades from currentTxs (where type === 'trade')
const nonTrades = currentTxs.filter(t => t.type !== 'trade');
console.log(`Retained ${nonTrades.length} existing waiver and free agent transactions.`);

// Combine non-trades and the cleanly parsed trades
const cleanTransactions = [...nonTrades, ...rawParsedTrades];

// Sort chronologically or by season descending
cleanTransactions.sort((a, b) => (b.season || 0) - (a.season || 0));

console.log(`Total clean transactions: ${cleanTransactions.length}`);

// Write back to dmsfantasy/data/transactions.json
fs.writeFileSync(
  path.join(rootDir, 'dmsfantasy', 'data', 'transactions.json'),
  JSON.stringify(cleanTransactions, null, 2),
  'utf8'
);
console.log('Successfully updated dmsfantasy/data/transactions.json!');

// Sample check
const sampleTrades = cleanTransactions.filter(t => t.type === 'trade');
console.log('Sample updated trade:', JSON.stringify(sampleTrades[0], null, 2));
