/**
 * sync_2027_yahoo_data.js
 * Ingests live 2027 scheduled matchups and active rosters from Yahoo Fantasy Sports API
 * for The Dumbarton Fantasy Football League (470.l.52841).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { refreshAccessToken, fetchYahooApi } from '../api/yahoo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env.local');

const LEAGUE_KEY = '470.l.52841';
const DISPLAY_SEASON = 2027;
const FIREBASE_DB_URL = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';

function loadEnv() {
    if (!fs.existsSync(envPath)) return {};
    const content = fs.readFileSync(envPath, 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
            env[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
        }
    });
    return env;
}

const TEAM_TO_MGR = {
    '470.l.52841.t.1': { id: 'alex', name: 'Alex' },
    '470.l.52841.t.2': { id: 'luke', name: 'Luke' },
    '470.l.52841.t.3': { id: 'jake', name: 'Jake' },
    '470.l.52841.t.4': { id: 'landon', name: 'Landon' },
    '470.l.52841.t.5': { id: 'isabella', name: 'Isabella' },
    '470.l.52841.t.6': { id: 'mike', name: 'Mike' },
    '470.l.52841.t.7': { id: 'will', name: 'Will' },
    '470.l.52841.t.8': { id: 'benjamin', name: 'Benjamin' },
    '470.l.52841.t.9': { id: 'ryan', name: 'Ryan' },
    '470.l.52841.t.10': { id: 'madoc', name: 'Madoc' },
    '470.l.52841.t.11': { id: 'jordan', name: 'Jordan' },
    '470.l.52841.t.12': { id: 'carson', name: 'Carson' }
};

async function sync() {
    console.log('--- SYNCING LIVE 2027 YAHOO DATA ---');
    const env = loadEnv();
    process.env.YAHOO_CLIENT_ID = env.YAHOO_CLIENT_ID;
    process.env.YAHOO_CLIENT_SECRET = env.YAHOO_CLIENT_SECRET;

    const refreshed = await refreshAccessToken(env.YAHOO_REFRESH_TOKEN);
    const token = refreshed.access_token;
    console.log('Refreshed Yahoo Access Token acquired.');

    // 1. Fetch Teams
    const teamsRes = await fetchYahooApi(`league/${LEAGUE_KEY}/teams`, token);
    const rawTeams = teamsRes?.fantasy_content?.league?.[1]?.teams;
    const teamMap = {};
    for (let i = 0; i < (rawTeams?.count || 0); i++) {
        const t = rawTeams[i]?.team?.[0];
        const key = t?.find(x => x && x.team_key)?.team_key;
        const name = t?.find(x => x && x.name)?.name;
        const tId = parseInt(t?.find(x => x && x.team_id)?.team_id || (i + 1));
        const mgr = TEAM_TO_MGR[key] || { id: `team_${tId}`, name: name };
        teamMap[key] = { key, id: tId, name, manager_id: mgr.id, manager_name: mgr.name };
        teamMap[tId] = teamMap[key];
    }
    console.log(`Mapped ${Object.keys(teamMap).length / 2} teams.`);

    // 2. Fetch Scoreboard (Weeks 1 to 14)
    const newMatchups = [];
    for (let w = 1; w <= 14; w++) {
        const sbRes = await fetchYahooApi(`league/${LEAGUE_KEY}/scoreboard;week=${w}`, token);
        const matchupsObj = sbRes?.fantasy_content?.league?.[1]?.scoreboard?.[0]?.matchups;
        const mCount = matchupsObj?.count || 0;
        for (let m = 0; m < mCount; m++) {
            const match = matchupsObj[m]?.matchup;
            if (!match) continue;
            const t1 = match[0]?.teams?.[0]?.team;
            const t2 = match[0]?.teams?.[1]?.team;
            if (!t1 || !t2) continue;

            const t1Key = t1[0]?.find(x => x && x.team_key)?.team_key;
            const t2Key = t2[0]?.find(x => x && x.team_key)?.team_key;
            const t1Info = teamMap[t1Key] || {};
            const t2Info = teamMap[t2Key] || {};

            const t1Pts = parseFloat(t1[1]?.team_points?.total || 0);
            const t2Pts = parseFloat(t2[1]?.team_points?.total || 0);
            const t1Proj = parseFloat(t1[1]?.team_projected_points?.total || 0);
            const t2Proj = parseFloat(t2[1]?.team_projected_points?.total || 0);

            newMatchups.push({
                season: DISPLAY_SEASON,
                week: w,
                year: DISPLAY_SEASON,
                matchup_id: `${DISPLAY_SEASON}_w${w}_m${m + 1}`,
                game_type: 'Regular Season',
                is_playoff: false,
                is_consolation: false,
                home_team_id: t1Info.id || 1,
                home_team_name: t1Info.name || '',
                home_manager_id: t1Info.manager_id || '',
                home_manager_name: t1Info.manager_name || '',
                home_score: t1Pts,
                home_projected: t1Proj,
                team_1_id: t1Info.id || 1,
                team_1_name: t1Info.name || '',
                team_1_manager_id: t1Info.manager_id || '',
                team_1_manager_name: t1Info.manager_name || '',
                team_1_actual_points: t1Pts,
                team_1_projected_points: t1Proj,
                away_team_id: t2Info.id || 2,
                away_team_name: t2Info.name || '',
                away_manager_id: t2Info.manager_id || '',
                away_manager_name: t2Info.manager_name || '',
                away_score: t2Pts,
                away_projected: t2Proj,
                team_2_id: t2Info.id || 2,
                team_2_name: t2Info.name || '',
                team_2_manager_id: t2Info.manager_id || '',
                team_2_manager_name: t2Info.manager_name || '',
                team_2_actual_points: t2Pts,
                team_2_projected_points: t2Proj,
                winner: t1Pts > t2Pts ? t1Info.manager_id : (t2Pts > t1Pts ? t2Info.manager_id : 'UNDECIDED')
            });
        }
    }
    console.log(`Ingested ${newMatchups.length} scheduled matchups for 2027.`);

    // 3. Fetch Week 1 Active Rosters
    const teamKeys = Array.from({ length: 12 }, (_, i) => `${LEAGUE_KEY}.t.${i + 1}`).join(',');
    const rostersRes = await fetchYahooApi(`teams;team_keys=${teamKeys}/roster;week=1/players`, token);
    const teamsRosterObj = rostersRes?.fantasy_content?.teams;
    const newPlayerStats = [];

    for (let i = 0; i < (teamsRosterObj?.count || 0); i++) {
        const teamData = teamsRosterObj[i]?.team;
        const tMeta = teamData?.[0];
        const tKey = tMeta?.find(x => x && x.team_key)?.team_key;
        const tInfo = teamMap[tKey] || {};
        const playersObj = teamData?.[1]?.roster?.[0]?.players;
        const pCount = playersObj?.count || 0;

        for (let p = 0; p < pCount; p++) {
            const pArr = playersObj[p]?.player;
            const pMeta = pArr?.[0];
            const pId = pMeta?.find(x => x && x.player_id)?.player_id || `${i}_${p}`;
            const pName = pMeta?.find(x => x && x.name)?.name?.full || '';
            const pos = pMeta?.find(x => x && x.display_position)?.display_position || 'FLEX';
            const nflTeam = pMeta?.find(x => x && x.editorial_team_abbr)?.editorial_team_abbr || '';
            const slot = pArr?.[1]?.selected_position?.[1]?.position || 'BN';
            const isStarter = slot !== 'BN' && slot !== 'IR';

            newPlayerStats.push({
                season: DISPLAY_SEASON,
                year: DISPLAY_SEASON,
                week: 1,
                team_id: tInfo.id || (i + 1),
                team_name: tInfo.name || '',
                manager_id: tInfo.manager_id || '',
                manager_name: tInfo.manager_name || '',
                player_id: pId,
                player_name: pName,
                position: pos,
                nfl_team: nflTeam.toUpperCase(),
                roster_slot: slot,
                is_starter: isStarter,
                fantasy_points: 0,
                projected_points: 10.0
            });
        }
    }
    console.log(`Ingested ${newPlayerStats.length} player roster entries for Week 1.`);

    // 4. Update local dmsfantasy/data/ files
    const matchupsPath = path.join(rootDir, 'dmsfantasy', 'data', 'matchups.json');
    const existingMatchups = JSON.parse(fs.readFileSync(matchupsPath, 'utf8'));
    const updatedMatchups = existingMatchups.filter(m => Number(m.season || m.year) !== DISPLAY_SEASON).concat(newMatchups);
    fs.writeFileSync(matchupsPath, JSON.stringify(updatedMatchups, null, 2));
    console.log(`Updated ${matchupsPath} (total: ${updatedMatchups.length} matchups).`);

    const statsPath = path.join(rootDir, 'dmsfantasy', 'data', 'weekly_player_stats.json');
    const existingStats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
    const updatedStats = existingStats.filter(s => Number(s.season || s.year) !== DISPLAY_SEASON).concat(newPlayerStats);
    fs.writeFileSync(statsPath, JSON.stringify(updatedStats, null, 2));
    console.log(`Updated ${statsPath} (total: ${updatedStats.length} player stats).`);

    const metaPath = path.join(rootDir, 'dmsfantasy', 'data', 'seasons_metadata.json');
    const existingMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const meta2027 = existingMeta.find(s => s.season === DISPLAY_SEASON);
    if (meta2027) {
        meta2027.num_teams = 12;
        meta2027.regular_season_weeks = 14;
        meta2027.total_weeks_scraped = 0;
    }
    fs.writeFileSync(metaPath, JSON.stringify(existingMeta, null, 2));
    console.log(`Updated ${metaPath}.`);

    // 5. Push to Firebase RTDB
    console.log('Writing updated matchups and stats to Firebase RTDB...');
    await fetch(`${FIREBASE_DB_URL}/leagues/dmsfantasy/matchups.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedMatchups)
    });
    console.log('Firebase matchups updated.');

    await fetch(`${FIREBASE_DB_URL}/leagues/dmsfantasy/weekly_player_stats.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedStats)
    });
    console.log('Firebase weekly_player_stats updated.');

    console.log('--- SYNC COMPLETED SUCCESSFULLY ---');
}

sync().catch(console.error);
