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
import { NewsletterEngine } from '../src/newsletter_engine.js';

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

import { VaultDraftEngine } from '../src/draft.js';

export async function getThreadStore() {
    const localCacheDir = path.join(__dirname, 'cache');
    const localCachePath = path.join(localCacheDir, 'sent_message_threads.json');
    let localThreads = {};
    if (fs.existsSync(localCachePath)) {
        try { localThreads = JSON.parse(fs.readFileSync(localCachePath, 'utf8')); } catch (_) {}
    }
    // Fetch remote threads if available
    let remoteThreads = await fetchJson(`${FIREBASE_DB_URL}/sent_email_threads.json`);
    const merged = { ...localThreads, ...(remoteThreads || {}) };

    // Pre-seed known test message IDs for thefantasyvault.noreply@gmail.com
    const testKey = 'thefantasyvault_noreply_gmail_com';
    if (!merged[testKey]) merged[testKey] = {};
    if (!merged[testKey]['newsletter']) merged[testKey]['newsletter'] = '<c90f6687-dab7-fe09-d556-9c68a0495970@gmail.com>';
    if (!merged[testKey]['draft_grades']) merged[testKey]['draft_grades'] = '<156a1aee-e804-d84c-e98f-e911c0bb99d2@gmail.com>';

    return merged;
}

export async function saveThreadId(email, type, messageId) {
    if (!email || !type || !messageId) return;
    const sanitizedEmail = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const localCacheDir = path.join(__dirname, 'cache');
    if (!fs.existsSync(localCacheDir)) fs.mkdirSync(localCacheDir, { recursive: true });
    const localCachePath = path.join(localCacheDir, 'sent_message_threads.json');
    let localThreads = {};
    if (fs.existsSync(localCachePath)) {
        try { localThreads = JSON.parse(fs.readFileSync(localCachePath, 'utf8')); } catch (_) {}
    }
    if (!localThreads[sanitizedEmail]) localThreads[sanitizedEmail] = {};
    localThreads[sanitizedEmail][type] = messageId;
    try { fs.writeFileSync(localCachePath, JSON.stringify(localThreads, null, 2), 'utf8'); } catch (_) {}

    if (DB_SECRET) {
        try {
            await fetch(`${FIREBASE_DB_URL}/sent_email_threads/${sanitizedEmail}/${type}.json?auth=${DB_SECRET}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(messageId)
            });
        } catch (_) {}
    }
}

export async function buildDispatchManifest() {
    const isCorrection = process.env.CORRECTION_MODE !== 'false';
    const subjectPrefix = isCorrection ? 'Final Correspondence for Week 1: ' : '';

    console.log('Fetching users, leagues, and email thread history from The Fantasy Vault...');
    const [users, leaguesShallow, threadStore] = await Promise.all([
        fetchJson(`${FIREBASE_DB_URL}/users.json`),
        fetchJson(`${FIREBASE_DB_URL}/leagues.json?shallow=true`),
        getThreadStore()
    ]);

    const leagueSlugs = Object.keys(leaguesShallow || {});
    const leagueDataMap = {};

    for (const slug of leagueSlugs) {
        const [settings, draftResults, claims, managers, matchups, weeklyPlayerStats, transactions, standings, metadata] = await Promise.all([
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/league_settings.json`),
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/draft_results.json`),
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/claims.json`),
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/managers.json`),
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/matchups.json`),
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/weekly_player_stats.json`),
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/transactions.json`),
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/league_standings.json`),
            fetchJson(`${FIREBASE_DB_URL}/leagues/${slug}/seasons_metadata.json`)
        ]);

        const leagueName = settings?.name || (slug === 'dmsfantasy' ? 'The Dumbarton Fantasy Football League' : slug);
        const convention = settings?.seasonLabelConvention || (slug === 'dmsfantasy' ? 'championship' : 'kickoff');

        const allDraft = Array.isArray(draftResults) ? draftResults : Object.values(draftResults || {});
        const mgrList = Array.isArray(managers) ? managers : (managers?.managers || Object.values(managers || {}));

        // Instantiate VaultDraftEngine for 100% parity with live website prospective draft room
        const engine = new VaultDraftEngine({
            containerId: 'dummy',
            draftResults: allDraft,
            weeklyPlayerStats: [], // Evaluates prospective pre-season draft audit
            matchups: [],
            transactions: Array.isArray(transactions) ? transactions : Object.values(transactions || {}),
            managers: mgrList,
            leagueSettings: {
                ...(settings || {}),
                name: leagueName,
                seasonLabelConvention: convention
            }
        });

        // Resolve latest draft season (2027 for DMS, 2026 for others)
        const latestSeason = engine.seasons[0] || 2026;
        const seasonDisplayYear = Number(engine.formatSeasonYear(latestSeason)) || latestSeason;
        const firstYear = Number(settings?.firstYear || 2018);
        const volume = Math.max(1, seasonDisplayYear - firstYear + 1);

        const analytics = engine.computeSeasonAnalytics(latestSeason);
        const draftLeaderboard = analytics.managerLeaderboard || [];

        const draftGradeLookup = new Map();
        draftLeaderboard.forEach((m, idx) => {
            m.rank = idx + 1;
            m.score = m.draftIndex;
            m.grade = m.gradeInfo?.grade || 'B';

            let bestPick = null;
            let maxResidual = -999;
            (m.picks || []).forEach(p => {
                const res = lpiEngine.computeProspectiveGrade({
                    playerName: p.playerName || p.player_name,
                    position: p.position,
                    positionalDraftRank: p.positionRank, // 100% exact parity with engine baseline
                    overallPickNumber: p.overallPick || p.overall_pick,
                    numTeams: draftLeaderboard.length || 12
                });
                if (res && res.isEligible && typeof res.prospectiveGrade === 'number') {
                    if (res.residual > maxResidual) {
                        maxResidual = res.residual;
                        bestPick = `${p.playerName || p.player_name} (Round ${p.round || 1}, Pick ${p.overallPick || p.overall_pick})`;
                    }
                }
            });
            m.bestPick = bestPick || `${m.picks[0]?.playerName || 'Top Pick'} (Round 1)`;
            m.ldiValue = `${maxResidual >= 0 ? '+' : ''}${maxResidual.toFixed(1)} LDI Surplus`;

            draftGradeLookup.set(m.managerId, m);
            draftGradeLookup.set(String(m.managerId).toLowerCase(), m);
            draftGradeLookup.set(String(m.managerName).toLowerCase(), m);
            const cleanFirst = String(m.managerName).toLowerCase().split(' ')[0];
            if (cleanFirst) draftGradeLookup.set(cleanFirst, m);
            const cleanRawId = String(m.managerId).replace(/[{}]/g, '').toLowerCase();
            if (cleanRawId) draftGradeLookup.set(cleanRawId, m);
        });

        // Newsletter editorial copy per league (honors custom newsletter title from admin dashboard, defaulting to 'The Weekly Gazette')
        const customTitle = settings?.newsletter_title || settings?.newsletter_name || settings?.newsletterTitle;
        const newsletterTitle = customTitle || 'The Weekly Gazette';

        let leadHeadline = 'Opening Week Kickoff: Powerhouse Rosters Collide';
        let leadSnippet = 'The regular season battle lines are drawn as managers across the league chase opening week momentum, as early statement victories reshape expectations.';

        try {
            const allMatchups = Array.isArray(matchups) ? matchups : Object.values(matchups || {});
            const allStandings = Array.isArray(standings) ? standings : Object.values(standings || {});
            const allStats = Array.isArray(weeklyPlayerStats) ? weeklyPlayerStats : Object.values(weeklyPlayerStats || {});
            const allTx = Array.isArray(transactions) ? transactions : Object.values(transactions || {});
            const allMeta = Array.isArray(metadata) ? metadata : Object.values(metadata || {});

            const newsletterEngine = new NewsletterEngine({
                leagueId: slug,
                matchups: allMatchups,
                standings: allStandings,
                playerStats: allStats,
                transactions: allTx,
                seasonsMetadata: allMeta,
                managers: mgrList,
                claims: claims || {},
                leagueSettings: {
                    ...(settings || {}),
                    name: leagueName,
                    seasonLabelConvention: convention,
                    newsletterTitle: newsletterTitle
                }
            });

            const edition = newsletterEngine.generateEdition(latestSeason, 1);
            if (edition && edition.leadStory && edition.leadStory.headline) {
                leadHeadline = cleanText(edition.leadStory.headline);
                if (edition.leadStory.text) {
                    leadSnippet = cleanText(edition.leadStory.text);
                }
            }
        } catch (e) {
            console.warn(`[NewsletterEngine] Could not generate dynamic edition for /${slug}:`, e.message);
        }

        leagueDataMap[slug] = {
            slug,
            name: leagueName,
            seasonDisplayYear,
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
    const recipientPairs = [];

    // From users table:
    for (const [uid, user] of Object.entries(users || {})) {
        if (!user.email || !user.email.includes('@')) continue;
        const claims = user.claims || {};
        for (const [leagueSlug, claim] of Object.entries(claims)) {
            recipientPairs.push({
                email: user.email.trim(),
                user,
                leagueSlug,
                claim: claim || {},
                claimKey: claim.managerId || claim.id || ''
            });
        }
    }

    // From league claims table (ensuring no claimed manager is missed):
    for (const [slug, lData] of Object.entries(leagueDataMap)) {
        for (const [mId, c] of Object.entries(lData.claims || {})) {
            if (c && c.email && c.email.includes('@')) {
                recipientPairs.push({
                    email: c.email.trim(),
                    user: { name: c.name || c.managerName || '' },
                    leagueSlug: slug,
                    claim: c,
                    claimKey: mId
                });
            }
        }
    }

    for (const { email, user, leagueSlug, claim, claimKey } of recipientPairs) {
        const lData = leagueDataMap[leagueSlug];
        if (!lData) continue;

        const userKey = `${email.toLowerCase()}_${leagueSlug}`;
        if (seenUserLeagueKeys.has(userKey)) continue;
        seenUserLeagueKeys.add(userKey);

        const mId = claim.managerId || claim.id || claimKey || '';
        const cleanClaimName = String(claim.managerName || claim.name || '').toLowerCase();
        const cleanFirst = cleanClaimName.split(/[\s@._-]+/)[0];
        const cleanRawId = String(mId).replace(/[{}]/g, '').toLowerCase();

        const mGrade = lData.draftGradeLookup.get(mId) || 
                       lData.draftGradeLookup.get(String(mId).toLowerCase()) || 
                       lData.draftGradeLookup.get(cleanRawId) ||
                       lData.draftGradeLookup.get(cleanClaimName) || 
                       lData.draftGradeLookup.get(cleanFirst) || 
                       lData.draftLeaderboard[0];

        // Strict manager name single source of truth: use admin-defined alias
        const cleanMgrName = cleanText(mGrade.managerName || claim.managerName || user.name || 'Manager');
        const cleanTeamName = cleanText(mGrade.teamName || `${cleanMgrName}'s Team`);
        const leagueUrl = `https://fantasyvault.vercel.app/${leagueSlug}`;

        // Thread lookup
        const sanitizedTo = email.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const prevNewsletterMsgId = threadStore[sanitizedTo]?.['newsletter'] || threadStore['thefantasyvault_noreply_gmail_com']?.['newsletter'];
        const prevDraftMsgId = threadStore[sanitizedTo]?.['draft_grades'] || threadStore['thefantasyvault_noreply_gmail_com']?.['draft_grades'];

        // 1. Weekly Newsletter Email
        const newsletterHtml = getNewsletterTemplateC({
            leagueName: lData.name,
            newsletterTitle: lData.newsletterTitle,
            volume: lData.volume,
            weekNum: 1,
            seasonYear: lData.seasonDisplayYear,
            leadHeadline: lData.leadHeadline,
            leadSnippet: lData.leadSnippet,
            leagueUrl: leagueUrl
        });

        dispatchList.push({
            type: 'newsletter',
            leagueSlug,
            to: email,
            subject: `${subjectPrefix}${lData.newsletterTitle}: Week 1 (Vol. ${lData.volume} • Issue 1) - ${lData.leadHeadline}`,
            html: newsletterHtml,
            inReplyTo: prevNewsletterMsgId,
            references: prevNewsletterMsgId
        });

        // 2. Draft Audit & Grades Email
        const draftHtml = getDraftGradesTemplateA({
            leagueName: lData.name,
            managerName: cleanMgrName,
            teamName: cleanTeamName,
            seasonYear: lData.seasonDisplayYear,
            grade: mGrade.grade,
            score: mGrade.score,
            bestPick: mGrade.bestPick,
            draftRank: mGrade.rank,
            totalTeams: lData.draftLeaderboard.length || 12,
            ldiValue: mGrade.ldiValue,
            leagueUrl: leagueUrl
        });

        dispatchList.push({
            type: 'draft_grades',
            leagueSlug,
            to: email,
            subject: `${subjectPrefix}${lData.name}: ${lData.seasonDisplayYear} Draft Audit - Your Grade is Finalized (${mGrade.grade})`,
            html: draftHtml,
            inReplyTo: prevDraftMsgId,
            references: prevDraftMsgId
        });
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
            console.log(`- [${e.leagueSlug}] [${e.type}] To: ${e.to} | In-Reply-To: ${e.inReplyTo || 'none'} | Subject: ${e.subject}`);
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
                const mailOptions = {
                    from: `"The Fantasy Vault" <${user}>`,
                    to: e.to,
                    subject: e.subject,
                    html: e.html
                };
                if (e.inReplyTo) {
                    mailOptions.inReplyTo = e.inReplyTo;
                    mailOptions.references = e.references || e.inReplyTo;
                }
                const info = await transporter.sendMail(mailOptions);
                count++;
                console.log(`[OK] (${count}/${emails.length}) Sent ${e.type} to ${e.to} [${e.leagueSlug}] - ${info.messageId}`);
                if (info.messageId) {
                    await saveThreadId(e.to, e.type, info.messageId);
                }
            } catch (err) {
                console.error(`[FAIL] Could not send ${e.type} to ${e.to}:`, err.message);
            }
        }
        console.log(`\n[COMPLETE] Successfully dispatched ${count} emails!`);
        return;
    }

    // Attempt Vercel API endpoint with retry / watch support
    console.log('\nDispatching via Vercel endpoint (https://fantasyvault.vercel.app/api/email)...');
    const maxAttempts = isWatch ? 30 : 1;
    const sentIds = new Set();

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let requiresRedeploy = false;

        for (const e of emails) {
            const emailId = `${e.leagueSlug}:${e.type}:${e.to}`;
            if (sentIds.has(emailId)) continue;

            try {
                const payload = {
                    to: e.to,
                    email: e.to,
                    from: '"The Fantasy Vault" <thefantasyvault.noreply@gmail.com>',
                    subject: e.subject,
                    html: e.html
                };
                if (e.inReplyTo) {
                    payload.inReplyTo = e.inReplyTo;
                    payload.references = e.references || e.inReplyTo;
                }
                const resp = await fetch('https://fantasyvault.vercel.app/api/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                let data = {};
                try {
                    data = await resp.json();
                } catch (_) {
                    data = { error: 'Non-JSON response from endpoint' };
                }

                if (resp.ok && data.success) {
                    sentIds.add(emailId);
                    console.log(`[OK] (${sentIds.size}/${emails.length}) Dispatched ${e.type} to ${e.to} [${e.leagueSlug}]`);
                    if (data.messageId) {
                        await saveThreadId(e.to, e.type, data.messageId);
                    }
                } else if (resp.status === 400 && data.error && data.error.includes('Missing email, slug')) {
                    requiresRedeploy = true;
                    break;
                } else if (resp.status >= 500 || resp.status === 404) {
                    requiresRedeploy = true;
                    break;
                } else {
                    console.log(`[NOTICE] Vercel API status ${resp.status} for ${e.to}:`, data);
                }
            } catch (err) {
                console.error(`[FAIL] Request error for ${e.to}:`, err.message);
                requiresRedeploy = true;
                break;
            }
        }

        if (sentIds.size === emails.length) {
            console.log(`\n[SUCCESS] All ${sentIds.size} emails successfully delivered to Fantasy Vault managers!`);
            return;
        }

        if ((requiresRedeploy || sentIds.size < emails.length) && isWatch && attempt < maxAttempts) {
            console.log(`[WAIT] Vercel deploy in progress (attempt ${attempt}/${maxAttempts}, dispatched ${sentIds.size}/${emails.length}). Retrying in 10s...`);
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
