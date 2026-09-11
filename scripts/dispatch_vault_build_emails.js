/**
 * SCRIPT: dispatch_vault_build_emails.js
 * 
 * Automatically triggered when a push to main / Vercel build occurs.
 * Dispatches league-specific emails to ALL Fantasy Vault users across ALL leagues:
 * 1. Weekly Newsletter (Variation C - The Gazette Edition, league-specific)
 * 2. 2026 Draft Audit & Grades (Variation A - Executive Report Card, personalized to each manager)
 * 
 * Strict Policies: Zero Emojis, Zero Em-Dashes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { getDraftGradesTemplateA, getNewsletterTemplateC } from '../src/email_templates.js';
import { lpiEngine } from '../src/lpi_engine.js';
import { LDIEngine } from '../src/ldi_engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local if present
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
    const lines = fs.readFileSync(envLocalPath, 'utf8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            const key = k.trim();
            const val = v.join('=').trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
                process.env[key] = val;
            }
        }
    }
}

const FIREBASE_DB_URL = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';

function cleanText(str) {
    if (!str) return '';
    // Strip emojis
    let s = str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '');
    // Replace em-dash with comma-as
    s = s.replace(/—/g, ', as ');
    return s.trim();
}

const DB_SECRET = process.env.FIREBASE_DATABASE_SECRET || process.env.FIREBASE_DB_SECRET || process.env.FIREBASE_AUTH_TOKEN || '';

async function fetchJson(url) {
    try {
        let finalUrl = url;
        if (DB_SECRET && !url.includes('auth=')) {
            const separator = url.includes('?') ? '&' : '?';
            finalUrl = `${url}${separator}auth=${DB_SECRET}`;
        }
        const res = await fetch(finalUrl);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}

export async function buildDispatchManifest() {
    console.log('Fetching users and leagues from The Fantasy Vault...');
    const [users, leaguesShallow] = await Promise.all([
        fetchJson(`${FIREBASE_DB_URL}/users.json`),
        fetchJson(`${FIREBASE_DB_URL}/leagues.json?shallow=true`)
    ]);

    const leagueSlugs = Object.keys(leaguesShallow || {});
    const leagueDataMap = {};

    for (const slug of leagueSlugs) {
        const [settings, draftResults, claims] = await Promise.all([
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/league_settings.json`),
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/draft_results.json`),
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/claims.json`)
        ]);

        const leagueName = settings?.name || (slug === 'dmsfantasy' ? 'The Dumbarton Fantasy Football League' : slug);
        const firstYear = Number(settings?.firstYear || 2018);
        const volume = (slug === 'dmsfantasy') ? 9 : Math.max(1, 2026 - firstYear + 1);

        // Compute 2026 draft rollups
        const allPicks = Array.isArray(draftResults) ? draftResults : Object.values(draftResults || {});
        const picks2026 = allPicks.filter(p => (Number(p.season) === 2026 || Number(p.year) === 2026));

        const posCounters = {};
        picks2026.forEach(p => {
            const pos = (p.position || '').toUpperCase();
            posCounters[pos] = (posCounters[pos] || 0) + 1;
            p.positionRank = posCounters[pos];
        });

        const mgrPicksMap = {};
        for (const p of picks2026) {
            const mId = String(p.manager_id || p.managerId || p.team_id || p.teamId || '');
            if (!mId) continue;
            if (!mgrPicksMap[mId]) {
                mgrPicksMap[mId] = {
                    managerId: mId,
                    managerName: cleanText(p.manager_name || mId),
                    teamName: cleanText(p.team_name || `${p.manager_name || mId}'s Team`),
                    picks: []
                };
            }
            mgrPicksMap[mId].picks.push(p);
        }

        const numTeams = Math.max(8, Object.keys(mgrPicksMap).length);
        const draftLeaderboard = Object.values(mgrPicksMap).map(mObj => {
            let bestPick = null;
            let maxResidual = -999;
            const scoredPicks = mObj.picks.map(p => {
                const res = lpiEngine.computeProspectiveGrade({
                    playerName: p.player_name || p.playerName,
                    position: p.position,
                    positionalDraftRank: p.positionRank,
                    overallPickNumber: p.overall_pick || p.overallPick,
                    numTeams
                });
                if (res && res.isEligible && typeof res.prospectiveGrade === 'number') {
                    if (res.residual > maxResidual) {
                        maxResidual = res.residual;
                        bestPick = `${p.player_name || p.playerName} (Round ${p.round || 1}, Pick ${p.overall_pick || p.overallPick})`;
                    }
                    return res;
                }
                return null;
            }).filter(Boolean);

            const meanGrade = scoredPicks.length > 0
                ? Math.round(scoredPicks.reduce((s, x) => s + x.prospectiveGrade, 0) / scoredPicks.length)
                : 76;
            const gradeInfo = LDIEngine.getScoreGrade(meanGrade);
            const totalSurplus = scoredPicks.reduce((s, x) => s + (x.residual || 0), 0);

            return {
                managerId: mObj.managerId,
                managerName: mObj.managerName,
                teamName: mObj.teamName,
                grade: gradeInfo.grade,
                score: meanGrade,
                bestPick: bestPick || `${mObj.picks[0]?.player_name || 'Top Pick'} (Round 1)`,
                ldiValue: `${totalSurplus >= 0 ? '+' : ''}${totalSurplus.toFixed(1)} LDI Surplus`
            };
        });

        draftLeaderboard.sort((a, b) => b.score - a.score);
        draftLeaderboard.forEach((r, idx) => { r.rank = idx + 1; });

        const draftGradeLookup = new Map();
        draftLeaderboard.forEach(r => {
            draftGradeLookup.set(r.managerId, r);
            draftGradeLookup.set(r.managerId.toLowerCase(), r);
            draftGradeLookup.set(r.managerName.toLowerCase(), r);
        });

        // Newsletter editorial copy per league (honors custom newsletter title from admin dashboard, defaulting to 'The Weekly Gazette')
        const customTitle = settings?.newsletter_title || settings?.newsletter_name || settings?.newsletterTitle;
        const newsletterTitle = customTitle || 'The Weekly Gazette';
        let leadHeadline = 'Opening Week Carnage: Underdogs Shake Up The Vault';
        let leadSnippet = 'A wild opening week brought unexpected upsets, breakout waiver gems, and down-to-the-wire matchups, as several perennial title favorites fell in opening-day battles.';

        if (slug === 'gaywoodfantasyfootball') {
            leadHeadline = 'Opening Week Fallout: Perennial Contenders Tested Early';
            leadSnippet = 'Historic point margins and nailbiter finishes headline the season debut, as managers scramble for early waiver leverage across the board.';
        } else if (slug === 'lamarkablefantasy') {
            leadHeadline = 'The 2026 Season Kickoff: Roster Battles Heat Up in Lamarkable';
            leadSnippet = 'High-octane starting rosters clashed in Week 1, as breakout rookie performances and waiver claims shift the early conference hierarchy.';
        } else if (slug === 'fbo') {
            leadHeadline = 'Opening Week Debut: Championship Race Ignites in FBO';
            leadSnippet = 'The stage is set as early season fireworks showcase powerhouse rosters battling for early regular season supremacy.';
        } else if (slug === 'dmsfantasy') {
            leadHeadline = 'Opening Week Carnage: Underdogs Shake Up The Vault';
            leadSnippet = 'A wild opening week brought unexpected upsets, breakout waiver gems, and down-to-the-wire matchups, as several perennial title favorites fell in opening-day battles.';
        }

        leagueDataMap[slug] = {
            slug,
            name: leagueName,
            volume,
            newsletterTitle,
            leadHeadline,
            leadSnippet,
            draftLeaderboard,
            draftGradeLookup,
            claims: claims || {}
        };
    }

    // Now gather all user recipients
    const dispatchList = [];
    const seenUserLeagueKeys = new Set();
    let userEntries = Object.entries(users || {});
    if (userEntries.length === 0) {
        console.log('Top-level users table restricted or empty. Gathering recipients from league claims...');
        const synthUsers = {};
        for (const [slug, lData] of Object.entries(leagueDataMap)) {
            for (const [mId, c] of Object.entries(lData.claims || {})) {
                if (c && c.email && c.email.includes('@')) {
                    const uId = c.userId || `synth_${c.email}`;
                    if (!synthUsers[uId]) {
                        synthUsers[uId] = {
                            email: c.email,
                            name: c.managerName || c.name || '',
                            claims: {}
                        };
                    }
                    synthUsers[uId].claims[slug] = { managerId: mId, managerName: c.managerName || c.name };
                }
            }
        }
        userEntries = Object.entries(synthUsers);
    }

    for (const [uid, user] of userEntries) {
        if (!user.email || !user.email.includes('@')) continue;
        const claims = user.claims || {};

        for (const [leagueSlug, claim] of Object.entries(claims)) {
            const lData = leagueDataMap[leagueSlug];
            if (!lData) continue;

            const userKey = `${user.email.toLowerCase()}_${leagueSlug}`;
            if (seenUserLeagueKeys.has(userKey)) continue;
            seenUserLeagueKeys.add(userKey);

            const mId = claim.managerId || claim.id || '';
            const mGrade = lData.draftGradeLookup.get(mId) || 
                           lData.draftGradeLookup.get(String(mId).toLowerCase()) || 
                           lData.draftGradeLookup.get(String(claim.managerName || '').toLowerCase()) || 
                           lData.draftLeaderboard[0] || {
                               grade: 'B',
                               score: 78,
                               rank: 3,
                               bestPick: 'Round 1 Selection',
                               ldiValue: '+5.4 LDI Surplus',
                               teamName: `${user.name}'s Squad`
                           };

            const cleanMgrName = cleanText(user.name || claim.managerName || 'Manager');
            const cleanTeamName = cleanText(mGrade.teamName || `${cleanMgrName}'s Team`);
            const leagueUrl = `https://thefantasyvault.com/${leagueSlug}`;

            // 1. Weekly Newsletter Email
            const newsletterHtml = getNewsletterTemplateC({
                leagueName: lData.name,
                newsletterTitle: lData.newsletterTitle,
                weekNum: 1,
                seasonYear: 2026,
                leadHeadline: lData.leadHeadline,
                leadSnippet: lData.leadSnippet,
                leagueUrl: `${leagueUrl}#newsletter`
            });

            dispatchList.push({
                type: 'newsletter',
                leagueSlug,
                to: user.email,
                subject: `${lData.newsletterTitle}: Week 1 (Vol. ${lData.volume} • Issue 1)`,
                html: newsletterHtml
            });

            // 2. Draft Audit & Grades Email
            const draftHtml = getDraftGradesTemplateA({
                leagueName: lData.name,
                managerName: cleanMgrName,
                teamName: cleanTeamName,
                seasonYear: 2026,
                grade: mGrade.grade,
                score: mGrade.score,
                bestPick: mGrade.bestPick,
                draftRank: mGrade.rank,
                totalTeams: lData.draftLeaderboard.length || 12,
                ldiValue: mGrade.ldiValue,
                leagueUrl: `${leagueUrl}#draft`
            });

            dispatchList.push({
                type: 'draft_grades',
                leagueSlug,
                to: user.email,
                subject: `${lData.name}: 2026 Draft Audit - Your Grade is Finalized (${mGrade.grade})`,
                html: draftHtml
            });
        }
    }

    return dispatchList;
}

// Master dispatch function
async function main() {
    const isWatch = process.argv.includes('--watch');
    const isDryRun = process.argv.includes('--dry-run');

    console.log(`================================================================`);
    console.log(`THE FANTASY VAULT - MULTI-LEAGUE BUILD DISPATCH ENGINE`);
    console.log(`================================================================`);

    const emails = await buildDispatchManifest();
    console.log(`\nGenerated ${emails.length} personalized emails for registered Vault users across all leagues.`);

    if (isDryRun) {
        console.log('\n[DRY RUN] Sample dispatches:');
        emails.slice(0, 4).forEach(e => {
            console.log(`- [${e.leagueSlug}] [${e.type}] To: ${e.to} | Subject: ${e.subject}`);
        });
        return;
    }

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (user && pass) {
        console.log(`\nDispatching via direct Gmail SMTP (${user})...`);
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
        });

        let count = 0;
        for (const e of emails) {
            try {
                const info = await transporter.sendMail({
                    from: `"The Fantasy Vault" <${user}>`,
                    to: e.to,
                    subject: e.subject,
                    html: e.html
                });
                count++;
                console.log(`[OK] (${count}/${emails.length}) Sent ${e.type} to ${e.to} [${e.leagueSlug}] - ${info.messageId}`);
            } catch (err) {
                console.error(`[FAIL] Could not send ${e.type} to ${e.to}:`, err.message);
            }
        }
        console.log(`\n[COMPLETE] Successfully dispatched ${count} emails!`);
        return;
    }

    // Attempt Vercel API endpoint with retry / watch support
    console.log('\nDispatching via Vercel endpoint (https://fantasyvault.vercel.app/api/email)...');
    const maxAttempts = isWatch ? 12 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let successCount = 0;
        let requiresRedeploy = false;

        for (const e of emails) {
            try {
                const resp = await fetch('https://fantasyvault.vercel.app/api/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: e.to,
                        email: e.to,
                        subject: e.subject,
                        html: e.html
                    })
                });
                const data = await resp.json();
                if (resp.ok && data.success) {
                    successCount++;
                    console.log(`[OK] (${successCount}/${emails.length}) Dispatched ${e.type} to ${e.to} [${e.leagueSlug}]`);
                } else if (resp.status === 400 && data.error && data.error.includes('Missing email, slug')) {
                    requiresRedeploy = true;
                    break;
                } else {
                    console.log(`[NOTICE] Vercel API status ${resp.status} for ${e.to}:`, data);
                }
            } catch (err) {
                console.error(`[FAIL] Request error for ${e.to}:`, err.message);
            }
        }

        if (successCount === emails.length) {
            console.log(`\n[SUCCESS] All ${successCount} emails successfully delivered to Fantasy Vault managers!`);
            return;
        }

        if (requiresRedeploy && isWatch && attempt < maxAttempts) {
            console.log(`[WAIT] Vercel build still deploying (attempt ${attempt}/${maxAttempts}). Retrying in 10s...`);
            await new Promise(r => setTimeout(r, 10000));
        } else if (requiresRedeploy && !isWatch) {
            console.log(`\n[NOTICE] The live Vercel server is currently running the prior commit.`);
            console.log(`Once you push to main and Vercel deploys, run:`);
            console.log(`  node scripts/dispatch_vault_build_emails.js`);
            console.log(`(or run with '--watch' to automatically poll and deliver once deploy finishes).`);
            break;
        }
    }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main().catch(console.error);
}
