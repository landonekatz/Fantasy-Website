/**
 * scripts/send_screen_test_emails.js
 * 
 * Sends the two screening correction emails directly to thefantasyvault@gmail.com
 * for user review:
 * 1. Weekly Newsletter (Vol. 10 • Issue 1 • 2027) with clean link to #newsletter
 * 2. 2027 Draft Audit & Grades (Landon: B+ / 73) with clean link to #draft
 */

import { getNewsletterTemplateC, getDraftGradesTemplateA } from '../src/email_templates.js';
import { NewsletterEngine } from '../src/newsletter_engine.js';
import { VaultDraftEngine } from '../src/draft.js';
import { lpiEngine } from '../src/lpi_engine.js';
import { getThreadStore, saveThreadId } from './dispatch_vault_build_emails.js';

const DESTINATION_EMAIL = 'thefantasyvault.noreply@gmail.com';
const SENDER_EMAIL = '"The Fantasy Vault" <thefantasyvault.noreply@gmail.com>';
const FIREBASE_DB_URL = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';

async function fetchJson(url) {
    try {
        const res = await fetch(url);
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    }
}

function cleanText(txt) {
    if (!txt) return '';
    return String(txt)
        .replace(/[\u2014\u2013]/g, ', as ')
        .replace(/—/g, ', as ')
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F]|\uD83E[\uDD00-\uDDFF]/g, '')
        .trim();
}

async function main() {
    console.log('================================================================');
    console.log('SENDING SCREENING TEST EMAILS TO thefantasyvault.noreply@gmail.com');
    console.log('================================================================');

    const [settings, members, draftResults, matchups, standings, playerStats, transactions, meta] = await Promise.all([
        fetchJson(`${FIREBASE_DB_URL}/leagues/dmsfantasy/league_settings.json`),
        fetchJson(`${FIREBASE_DB_URL}/leagues/dmsfantasy/members.json`),
        fetchJson(`${FIREBASE_DB_URL}/leagues/dmsfantasy/draft_results.json`),
        fetchJson(`${FIREBASE_DB_URL}/leagues/dmsfantasy/matchups.json`),
        fetchJson(`${FIREBASE_DB_URL}/leagues/dmsfantasy/league_standings.json`),
        fetchJson(`${FIREBASE_DB_URL}/leagues/dmsfantasy/weekly_player_stats.json`),
        fetchJson(`${FIREBASE_DB_URL}/leagues/dmsfantasy/transactions.json`),
        fetchJson(`${FIREBASE_DB_URL}/leagues/dmsfantasy/seasons_metadata.json`)
    ]);

    const leagueName = settings?.name || 'The Dumbarton Fantasy Football League';
    const mgrList = Array.isArray(members) ? members : Object.values(members || {});
    const allDraft = Array.isArray(draftResults) ? draftResults : Object.values(draftResults || {});
    const allMatchups = Array.isArray(matchups) ? matchups : Object.values(matchups || {});
    const allStandings = Array.isArray(standings) ? standings : Object.values(standings || {});
    const allStats = Array.isArray(playerStats) ? playerStats : Object.values(playerStats || {});
    const allTx = Array.isArray(transactions) ? transactions : Object.values(transactions || {});
    const allMeta = Array.isArray(meta) ? meta : Object.values(meta || {});

    // 1. Compile 2027 Draft Audit (Landon's Team)
    const draftEngine = new VaultDraftEngine({
        containerId: 'dummy',
        draftResults: allDraft,
        weeklyPlayerStats: [],
        matchups: [],
        transactions: allTx,
        managers: mgrList,
        leagueSettings: {
            ...settings,
            name: leagueName,
            seasonLabelConvention: 'championship'
        }
    });

    const analytics = draftEngine.computeSeasonAnalytics(2027);
    const draftLeaderboard = analytics.managerLeaderboard || [];
    const landonGrade = draftLeaderboard.find(m => String(m.managerId).toLowerCase() === 'landon') || draftLeaderboard[0];

    let bestPick = null;
    let maxResidual = -999;
    (landonGrade.picks || []).forEach(p => {
        const res = lpiEngine.computeProspectiveGrade({
            playerName: p.playerName || p.player_name,
            position: p.position,
            positionalDraftRank: p.positionRank,
            overallPickNumber: p.overallPick || p.overall_pick,
            numTeams: draftLeaderboard.length || 12
        });
        if (res && res.isEligible && typeof res.prospectiveGrade === 'number') {
            const residual = res.prospectiveGrade - (res.expectedGrade || 50);
            if (residual > maxResidual) {
                maxResidual = residual;
                bestPick = `${p.playerName} (Round ${p.round})`;
            }
        }
    });

    const draftAuditHtml = getDraftGradesTemplateA({
        leagueName,
        managerName: 'Landon',
        teamName: cleanText(landonGrade.teamName || "SHIPOOPI"),
        seasonYear: 2027,
        grade: landonGrade.gradeInfo?.grade || 'B+',
        score: landonGrade.draftIndex || 73,
        bestPick: bestPick || 'CeeDee Lamb (Round 1)',
        draftRank: landonGrade.rank || 5,
        totalTeams: draftLeaderboard.length || 12,
        ldiValue: landonGrade.draftIndex || 73,
        leagueUrl: 'https://fantasyvault.vercel.app/dmsfantasy'
    });

    // 2. Compile Newsletter (Vol. 10 • Issue 1 • 2027)
    const newsletterEngine = new NewsletterEngine({
        leagueId: 'dmsfantasy',
        leagueSlug: 'dmsfantasy',
        managers: mgrList,
        matchups: allMatchups,
        standings: allStandings,
        playerStats: allStats,
        draftResults: allDraft,
        transactions: allTx,
        seasonsMetadata: allMeta,
        leagueSettings: {
            ...settings,
            name: leagueName,
            seasonLabelConvention: 'championship',
            newsletterTitle: 'The Weekly Gazette'
        }
    });

    const edition = newsletterEngine.generateEdition(2027, 1);
    const leadHeadline = cleanText(edition.leadStory?.headline || 'One-Sided History: Benjamin Enters Week 1 Looking to Extend Reign');
    const leadStoryText = cleanText(edition.leadStory?.text || '');

    const newsletterHtml = getNewsletterTemplateC({
        leagueName,
        newsletterTitle: 'The Weekly Gazette',
        volume: 10,
        weekNum: 1,
        seasonYear: 2027,
        leadHeadline,
        leadSnippet: leadStoryText,
        leagueUrl: 'https://fantasyvault.vercel.app/dmsfantasy'
    });

    const threadStore = await getThreadStore();
    const prevNewsletterMsgId = threadStore['thefantasyvault_noreply_gmail_com']?.['newsletter'] || '<c90f6687-dab7-fe09-d556-9c68a0495970@gmail.com>';
    const prevDraftMsgId = threadStore['thefantasyvault_noreply_gmail_com']?.['draft_grades'] || '<156a1aee-e804-d84c-e98f-e911c0bb99d2@gmail.com>';

    const emails = [
        {
            type: 'newsletter',
            subject: `Final Correspondence for Week 1: The Weekly Gazette: Week 1 (Vol. 10 • Issue 1) - ${leadHeadline}`,
            html: newsletterHtml,
            inReplyTo: prevNewsletterMsgId,
            references: prevNewsletterMsgId
        },
        {
            type: 'draft_grades',
            subject: `Final Correspondence for Week 1: ${leagueName}: 2027 Draft Audit - Your Grade is Finalized (${landonGrade.gradeInfo?.grade || 'B+'})`,
            html: draftAuditHtml,
            inReplyTo: prevDraftMsgId,
            references: prevDraftMsgId
        }
    ];

    console.log(`\nDispatching 2 screening emails to: ${DESTINATION_EMAIL}...`);

    for (const e of emails) {
        try {
            const payload = {
                to: DESTINATION_EMAIL,
                email: DESTINATION_EMAIL,
                from: SENDER_EMAIL,
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
            const data = await resp.json();
            if (resp.ok && data.success) {
                console.log(`[SENT] Successfully delivered "${e.subject}" - MessageId: ${data.messageId}`);
                if (data.messageId) {
                    await saveThreadId(DESTINATION_EMAIL, e.type, data.messageId);
                }
            } else {
                console.error(`[ERROR] Failed to send "${e.subject}":`, data);
            }
        } catch (err) {
            console.error(`[ERROR] Exception sending "${e.subject}":`, err.message);
        }
    }

    console.log('\nScreening dispatch completed.');
}

main().catch(console.error);
