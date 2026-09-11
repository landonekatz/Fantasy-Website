/**
 * SCRIPT: send_sample_templates.js
 * 
 * Generates and saves the updated light editorial email templates to public/email_previews/
 * and dispatches the user-selected production templates directly to thefantasyvault@gmail.com.
 * 
 * Selected Templates:
 * - Power Rankings: Variation B (Board Is Set / Personal Position Focus)
 * - Draft Grades: Variation A (Executive Report Card & LDI Surplus Audit)
 * - Weekly Newsletter: Variation C (Gazette Masthead, Vol/Issue, Clean Headline, No Recap Box)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import {
    getPowerRankingsTemplateA,
    getPowerRankingsTemplateB,
    getPowerRankingsTemplateC,
    getDraftGradesTemplateA,
    getDraftGradesTemplateB,
    getDraftGradesTemplateC,
    getNewsletterTemplateA,
    getNewsletterTemplateB,
    getNewsletterTemplateC
} from '../src/email_templates.js';

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

// User specified destination: thefantasyvault@gmail.com (send to itself)
const RECIPIENT = process.env.EMAIL_TO || 'thefantasyvault@gmail.com';

// 1. Compile the 9 templates
const allTemplates = [
    // Power Rankings
    {
        id: 'power_rankings_b',
        category: 'Power Rankings',
        variation: 'Variation B (Selected)',
        isSelected: true,
        subject: 'Week 1 Power Rankings: Official Standings Released',
        html: getPowerRankingsTemplateB({
            managerName: 'Landon',
            teamName: 'Katz in the Cradle',
            weekNum: 1,
            rank: 2,
            prevRank: 1,
            riser: { name: 'Seb', move: '+3 spots' },
            faller: { name: 'Kevin', move: '-2 spots' }
        })
    },
    {
        id: 'power_rankings_a',
        category: 'Power Rankings',
        variation: 'Variation A - Executive Grid',
        isSelected: false,
        subject: 'Week 1 Power Rankings: Katz in the Cradle (#2)',
        html: getPowerRankingsTemplateA({
            managerName: 'Landon',
            teamName: 'Katz in the Cradle',
            weekNum: 1,
            seasonYear: 2026,
            rank: 2,
            prevRank: 1,
            tier: 'Championship Contender',
            blurbSnippet: 'Steady scoring and proven depth keep this roster in prime contention, as Week 1 revealed immense positional strength across starting slots.',
            topTeams: [
                { rank: 1, name: 'Madoc', trend: '+1' },
                { rank: 2, name: 'Landon', trend: '-1' },
                { rank: 3, name: 'Jake', trend: 'SAME' }
            ]
        })
    },
    {
        id: 'power_rankings_c',
        category: 'Power Rankings',
        variation: 'Variation C - Broadcast Edition',
        isSelected: false,
        subject: 'Vault Intel: Week 1 Power Rankings Released',
        html: getPowerRankingsTemplateC({
            managerName: 'Landon',
            teamName: 'Katz in the Cradle',
            weekNum: 1,
            rank: 2,
            commishQuote: 'Week 1 showed us that projections mean nothing until the whistle blows, as early roster management will dictate the championship bracket.'
        })
    },

    // Draft Grades
    {
        id: 'draft_grades_a',
        category: 'Draft Grades',
        variation: 'Variation A (Selected)',
        isSelected: true,
        subject: '2026 Draft Audit: Your Grade is Finalized (A)',
        html: getDraftGradesTemplateA({
            managerName: 'Landon',
            teamName: 'Katz in the Cradle',
            seasonYear: 2026,
            grade: 'A',
            score: 94.2,
            bestPick: 'CeeDee Lamb (Round 1, Pick 6)',
            draftRank: 2,
            totalTeams: 12,
            ldiValue: '+14.2 LDI Surplus'
        })
    },
    {
        id: 'draft_grades_b',
        category: 'Draft Grades',
        variation: 'Variation B - LDI Analytics Pro',
        isSelected: false,
        subject: '2026 Draft Class Evaluation & Grades',
        html: getDraftGradesTemplateB({
            managerName: 'Landon',
            seasonYear: 2026,
            grade: 'A-',
            bestPick: 'CeeDee Lamb',
            bestPickRound: 'Round 1, Pick 6',
            stealPick: 'Trey McBride (Round 6, Pick 66)'
        })
    },
    {
        id: 'draft_grades_c',
        category: 'Draft Grades',
        variation: 'Variation C - War Room Summary',
        isSelected: false,
        subject: '2026 War Room Recap & Draft Grades',
        html: getDraftGradesTemplateC({
            managerName: 'Landon',
            teamName: 'Katz in the Cradle',
            seasonYear: 2026,
            grade: 'A',
            summaryBlurb: 'Exceptional draft execution, as elite anchors in the opening frames provided immediate surplus value across starting roster positions.',
            bestPick: 'CeeDee Lamb (Pick 6)'
        })
    },

    // Weekly Newsletter
    {
        id: 'newsletter_c',
        category: 'Weekly Newsletter',
        variation: 'Variation C (Selected)',
        isSelected: true,
        subject: 'The Weekly Gazette: Week 1 (Vol. 9 • Issue 1)',
        html: getNewsletterTemplateC({
            newsletterTitle: 'The Weekly Gazette',
            weekNum: 1,
            seasonYear: 2026,
            leadHeadline: 'Opening Week Carnage: Underdogs Shake Up The Vault',
            leadSnippet: 'Historic point margins and nailbiter finishes headline the season debut, as managers scramble for early waiver leverage across the board.'
        })
    },
    {
        id: 'newsletter_a',
        category: 'Weekly Newsletter',
        variation: 'Variation A - The Vault Gazette',
        isSelected: false,
        subject: 'The Vault Gazette: Week 1 Fallout Across the League',
        html: getNewsletterTemplateA({
            weekNum: 1,
            seasonYear: 2026,
            leadHeadline: 'Opening Week Carnage: Underdogs Shake Up The Vault',
            leadSnippet: 'A wild opening week brought unexpected upsets, breakout waiver gems, and down-to-the-wire matchups, as several perennial title favorites fell in opening-day battles.',
            highScorer: { name: 'Jake', points: 148.6 },
            gameOfTheWeek: { teamA: 'Katz in the Cradle', scoreA: 132.4, teamB: 'Madoc', scoreB: 130.1 }
        })
    },
    {
        id: 'newsletter_b',
        category: 'Weekly Newsletter',
        variation: 'Variation B - Sunday Recap Dispatch',
        isSelected: false,
        subject: 'The Sunday Recap: Week 1 Breakdown & Headlines',
        html: getNewsletterTemplateB({
            weekNum: 1,
            seasonYear: 2026,
            leadHeadline: 'Opening Week Carnage: Underdogs Shake Up The Vault',
            leadSnippet: 'The dust has settled on Week 1, as injury fallout, waiver priorities, and early power shifts reshape the championship race.'
        })
    }
];

// 2. Save local HTML preview files
const outputDir = path.resolve(__dirname, '../public/email_previews');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

allTemplates.forEach(t => {
    fs.writeFileSync(path.join(outputDir, `${t.id}.html`), t.html, 'utf8');
});

// Create an index preview dashboard matching Vault aesthetic
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>The Fantasy Vault - Email Templates Suite</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Newsreader:wght@600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #f8fafc; color: #0f172a; padding: 40px 20px; max-width: 960px; margin: 0 auto; line-height: 1.5; }
    .masthead { border-bottom: 3px double #0f172a; padding-bottom: 20px; margin-bottom: 32px; }
    .kicker { font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #991b1b; }
    h1 { font-family: 'Newsreader', Georgia, serif; font-size: 32px; font-weight: 700; color: #0f172a; margin: 6px 0 4px 0; }
    p.sub { color: #64748b; font-size: 14px; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 40px; }
    .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 22px; transition: transform 0.15s ease, box-shadow 0.15s ease; box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative; }
    .card.selected { border: 2px solid #0f172a; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.12); }
    .card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.08); }
    .badge-selected { display: inline-block; background: #0f172a; color: #ffffff; font-size: 9px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; margin-bottom: 10px; }
    .cat { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
    .title { font-size: 17px; font-weight: 700; color: #0f172a; margin: 6px 0 10px 0; }
    .btn { display: inline-block; padding: 9px 18px; background: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; transition: background 0.15s ease; }
    .btn:hover { background: #1e293b; }
    .btn-secondary { background: #f1f5f9; color: #0f172a; border: 1px solid #cbd5e1; }
    .btn-secondary:hover { background: #e2e8f0; }
  </style>
</head>
<body>
  <div class="masthead">
    <div class="kicker">THE FANTASY VAULT PLATFORM</div>
    <h1>Email Templates Suite</h1>
    <p class="sub">Re-skinned in the authentic Light Editorial Vault design. Production selections: Power Rankings (B), Draft Grades (A), Weekly Newsletter (C).</p>
  </div>

  <div class="grid">
    ${allTemplates.map(t => `
      <div class="card ${t.isSelected ? 'selected' : ''}">
        ${t.isSelected ? '<div class="badge-selected">SELECTED PRODUCTION TEMPLATE</div>' : ''}
        <div class="cat">${t.category}</div>
        <div class="title">${t.variation}</div>
        <div style="font-size: 12px; color: #64748b; margin-bottom: 16px; line-height: 1.4;">${t.subject}</div>
        <a class="btn ${t.isSelected ? '' : 'btn-secondary'}" href="${t.id}.html" target="_blank">Preview Template &rarr;</a>
      </div>
    `).join('')}
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(outputDir, 'index.html'), indexHtml, 'utf8');
console.log(`[OK] Generated 9 updated Light-Themed HTML previews in: ${outputDir}`);

// 3. Dispatch function
async function dispatch() {
    const sendAll = process.argv.includes('--all');
    const isWatch = process.argv.includes('--watch');
    const templatesToDispatch = sendAll ? allTemplates : allTemplates.filter(t => t.isSelected);

    console.log(`\n======================================================`);
    console.log(`Preparing to dispatch ${templatesToDispatch.length} templates to: ${RECIPIENT}`);
    console.log(`Mode: ${sendAll ? 'All 9 Variations' : '3 Selected Production Variations (B, A, C)'}`);
    if (isWatch) console.log(`Watch Mode: ON (Will poll until Vercel deploy finishes)`);
    console.log(`======================================================\n`);

    // Check if we have nodemailer credentials directly in env
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (user && pass) {
        console.log(`Sending via direct Gmail SMTP (${user})...`);
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user, pass }
        });

        for (const t of templatesToDispatch) {
            try {
                const info = await transporter.sendMail({
                    from: `"The Fantasy Vault" <${user}>`,
                    to: RECIPIENT,
                    subject: t.subject,
                    html: t.html
                });
                console.log(`[OK] Dispatched "${t.variation}" (${t.category}) - MessageId: ${info.messageId}`);
            } catch (err) {
                console.error(`[FAIL] Could not send "${t.variation}":`, err.message);
            }
        }
        return;
    }

    // Attempt Vercel API endpoint with optional watch/retry
    console.log('Dispatching via Vercel endpoint (https://fantasyvault.vercel.app/api/email)...');
    
    const maxAttempts = isWatch ? 12 : 1; // In watch mode, poll for up to 2 minutes
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let vercelSuccessCount = 0;
        let requiresRedeploy = false;

        for (const t of templatesToDispatch) {
            try {
                const resp = await fetch('https://fantasyvault.vercel.app/api/email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: RECIPIENT,
                        email: RECIPIENT,
                        subject: t.subject,
                        html: t.html
                    })
                });
                const data = await resp.json();
                if (resp.ok && data.success) {
                    console.log(`[OK] Dispatched "${t.variation}" (${t.category}) via Vercel - MessageId: ${data.messageId}`);
                    vercelSuccessCount++;
                } else if (resp.status === 400 && data.error && data.error.includes('Missing email, slug')) {
                    requiresRedeploy = true;
                } else {
                    console.log(`[NOTICE] Vercel API returned status ${resp.status}:`, data);
                }
            } catch (err) {
                console.error(`[FAIL] Vercel API request error for "${t.variation}":`, err.message);
            }
        }

        if (vercelSuccessCount === templatesToDispatch.length) {
            console.log(`\n[SUCCESS] All ${vercelSuccessCount} production templates successfully delivered to ${RECIPIENT}!`);
            return;
        }

        if (requiresRedeploy && isWatch && attempt < maxAttempts) {
            console.log(`[WAIT] Vercel build still deploying (attempt ${attempt}/${maxAttempts}). Checking again in 10s...`);
            await new Promise(r => setTimeout(r, 10000));
        } else if (requiresRedeploy && !isWatch) {
            console.log(`\n[NOTICE] The live Vercel server is currently running the prior commit.`);
            console.log(`As soon as you push to main and Vercel builds, run:`);
            console.log(`  node scripts/send_sample_templates.js`);
            console.log(`(or run with '--watch' to automatically send as soon as Vercel finishes building).`);
            break;
        }
    }
}

dispatch().catch(err => {
    console.error('Fatal dispatch error:', err);
});

