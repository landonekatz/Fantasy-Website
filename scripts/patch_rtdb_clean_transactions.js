import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import espnAthletesData from '../src/espn_athletes_data.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RTDB_BASE = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';

const fixPlayerName = (name) => {
  if (!name) return '';
  const match = String(name).match(/Player ID\s*(\d+)/i);
  if (match && espnAthletesData[match[1]]) {
    return espnAthletesData[match[1]].name;
  }
  return name;
};

async function patchTransactions(leagueSlug) {
  console.log(`\n--- Patching Transactions for ${leagueSlug} ---`);
  const url = `${RTDB_BASE}/leagues/${leagueSlug}/transactions.json`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch transactions for ${leagueSlug}: ${res.status}`);
    return;
  }
  const data = await res.json();
  const txList = Array.isArray(data) ? data : Object.values(data || {});
  console.log(`Original count: ${txList.length}`);

  const cleaned = txList.filter(t => {
    if (!t) return false;
    if (t.action_type === 'DRAFT' || t.type === 'DRAFT') return false;
    const adds = (t.added_players || []).filter(Boolean);
    const drops = (t.dropped_players || []).filter(Boolean);
    const traded = (t.traded_players || []).filter(Boolean);
    const picks = (t.draft_picks || []).filter(Boolean);
    return adds.length > 0 || drops.length > 0 || traded.length > 0 || picks.length > 0;
  }).map(t => {
    let details = t.details || '';
    if (details) {
      details = details.replace(/Player ID\s*(\d+)/gi, (m, id) => espnAthletesData[id]?.name || m);
    }

    const added_players = (t.added_players || []).map(fixPlayerName);
    const dropped_players = (t.dropped_players || []).map(fixPlayerName);
    const traded_players = (t.traded_players || []).map(fixPlayerName);

    const items = (t.items || []).map(it => ({
      ...it,
      player_name: fixPlayerName(it.player_name)
    }));

    return {
      ...t,
      added_players,
      dropped_players,
      traded_players,
      details,
      items
    };
  });

  console.log(`Cleaned count: ${cleaned.length} (removed ${txList.length - cleaned.length} empty/draft rows)`);
  const remainingPlayerId = JSON.stringify(cleaned).match(/Player ID \d+/g);
  console.log(`Remaining Player ID strings: ${remainingPlayerId ? [...new Set(remainingPlayerId)] : '0'}`);

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleaned)
  });
  console.log(`Firebase PUT status: ${putRes.status} (${putRes.statusText})`);
}

async function patchDraftResults(leagueSlug) {
  console.log(`\n--- Patching Draft Results for ${leagueSlug} ---`);
  const url = `${RTDB_BASE}/leagues/${leagueSlug}/draft_results.json`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Failed to fetch draft results for ${leagueSlug}: ${res.status}`);
    return;
  }
  const data = await res.json();
  const draftList = Array.isArray(data) ? data : Object.values(data || {});
  console.log(`Original draft picks count: ${draftList.length}`);

  let fixedCount = 0;
  const cleaned = draftList.map(p => {
    const match = String(p.player_name || '').match(/Player ID\s*(\d+)/i);
    if (match && espnAthletesData[match[1]]) {
      fixedCount++;
      return {
        ...p,
        player_name: espnAthletesData[match[1]].name,
        position: p.position || espnAthletesData[match[1]].pos || ''
      };
    }
    return p;
  });

  console.log(`Fixed draft picks: ${fixedCount}`);
  const remainingPlayerId = JSON.stringify(cleaned).match(/Player ID \d+/g);
  console.log(`Remaining Player ID strings: ${remainingPlayerId ? [...new Set(remainingPlayerId)] : '0'}`);

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleaned)
  });
  console.log(`Firebase PUT status: ${putRes.status} (${putRes.statusText})`);
}

async function run() {
  await patchTransactions('gaywoodfantasyfootball');
  await patchDraftResults('gaywoodfantasyfootball');

  await patchTransactions('abtherapyleague');
  await patchTransactions('fbo');
  await patchTransactions('dmsfantasy');

  console.log('\nAll league transactions and draft results patched successfully in RTDB!');
}

run().catch(err => {
  console.error('Fatal patch error:', err);
  process.exit(1);
});
