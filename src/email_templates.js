/**
 * THE FANTASY VAULT - EMAIL TEMPLATES SUITE
 * 
 * Re-aligned to the authentic light editorial aesthetic of The Fantasy Vault:
 * - Clean off-white canvas (#f8fafc) and crisp white cards (#ffffff)
 * - Deep navy/slate typography (#0f172a, #334155, #64748b)
 * - Double border mastheads and Newsreader/Georgia serif headlines
 * - Streamlined minimal footers (zero clutter)
 * - STRICT POLICY: Zero emojis anywhere (clean typography & SVGs only)
 * - STRICT POLICY: Zero em-dashes anywhere (use comma-as instead)
 * 
 * Selected Production Variations:
 * - Power Rankings: Variation B (Board Is Set / Personal Position Focus)
 * - Draft Grades: Variation A (Executive Report Card & LDI Surplus Audit)
 * - Weekly Newsletter: Variation C (Gazette Masthead, Vol/Issue, Clean Headline, No Recap Box)
 */

// Shared base styles and light editorial shell
function emailShell({ title, previewText, bodyContent, leagueName = 'The Dumbarton League', leagueUrl = 'https://fantasyvault.vercel.app/dmsfantasy', topBorder = '3px double #0f172a' }) {
    const cleanLeagueUrl = String(leagueUrl || '').replace(/#.*$/, '').replace(/\/$/, '');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
  <!-- Hidden preview text for inbox teaser -->
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${previewText}
  </div>

  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; min-height: 100vh; padding: 24px 12px 48px 12px;">
    <tr>
      <td align="center" valign="top">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);">
          
          <!-- Top Accent Stripe & Masthead Brand Bar -->
          <tr>
            <td style="padding: 20px 28px 16px 28px; background-color: #ffffff; border-bottom: 1px solid #e2e8f0; border-top: ${topBorder};">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="left" valign="middle">
                    <div style="font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #64748b;">THE FANTASY VAULT</div>
                    <div style="font-family: 'Newsreader', Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 2px; letter-spacing: -0.3px;">${leagueName}</div>
                  </td>
                  <td align="right" valign="middle">
                    <a href="${cleanLeagueUrl}" style="display: inline-block; font-size: 11px; font-weight: 700; color: #0f172a; text-decoration: none; padding: 6px 12px; border-radius: 4px; background-color: #f8fafc; border: 1px solid #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px;">League HQ</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content Slot -->
          <tr>
            <td style="padding: 28px 28px 24px 28px; background-color: #ffffff;">
              ${bodyContent}
            </td>
          </tr>

          <!-- Minimal Clean Footer (No Redundant Links) -->
          <tr>
            <td style="padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
              <div style="font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 4px;">The Fantasy Vault &bull; ${leagueName}</div>
              <p style="font-size: 11px; color: #64748b; line-height: 1.5; margin: 0 0 10px 0;">
                Automated league intelligence dispatch for registered managers.
              </p>
              <a href="${cleanLeagueUrl}" style="font-size: 11px; color: #1d4ed8; text-decoration: none; font-weight: 700;">Open League Portal &rarr;</a>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ==========================================
// 1. POWER RANKINGS TEMPLATES
// ==========================================

/**
 * Power Rankings Variation A: Executive Grid
 */
export function getPowerRankingsTemplateA({
    leagueName = 'The Dumbarton League',
    managerName = 'Landon',
    teamName = 'Katz in the Cradle',
    weekNum = 1,
    seasonYear = 2026,
    rank = 2,
    prevRank = 1,
    tier = 'Championship Tier',
    blurbSnippet = 'Steady scoring and proved depth keep this roster in prime contention, as Week 1 revealed immense positional strength across starting slots.',
    leagueUrl = 'https://fantasyvault.vercel.app/dmsfantasy',
    topTeams = [
        { rank: 1, name: 'Madoc', trend: '+1' },
        { rank: 2, name: 'Landon', trend: '-1' },
        { rank: 3, name: 'Jake', trend: 'SAME' }
    ]
} = {}) {
    const title = `Week ${weekNum} Power Rankings Are Live`;
    const previewText = `Official Week ${weekNum} Power Rankings: ${managerName} is ranked #${rank} (${tier}).`;
    const trendText = prevRank ? (prevRank > rank ? `Up +${prevRank - rank} from #${prevRank}` : prevRank < rank ? `Down ${rank - prevRank} from #${prevRank}` : `Unchanged from #${prevRank}`) : 'New Entry';
    const trendColor = prevRank && prevRank > rank ? '#15803d' : prevRank && prevRank < rank ? '#dc2626' : '#64748b';

    const bodyContent = `
      <div style="margin-bottom: 22px;">
        <span style="font-size: 11px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #991b1b;">OFFICIAL VAULT RANKINGS &bull; WEEK ${weekNum}</span>
        <h1 style="font-family: 'Newsreader', Georgia, serif; font-size: 26px; font-weight: 700; color: #0f172a; margin: 6px 0 8px 0; line-height: 1.25;">
          Week ${weekNum} Power Rankings Are Live
        </h1>
        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0;">
          The commissioner board has finalized Week ${weekNum} evaluations, roster adjustments, and scoring expectations across ${leagueName}.
        </p>
      </div>

      <!-- Highlight Card -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td valign="top" style="width: 84px; text-align: center; border-right: 1px solid #e2e8f0; padding-right: 16px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">YOUR RANK</div>
              <div style="font-size: 44px; font-weight: 900; color: #0f172a; line-height: 1; margin: 6px 0 4px 0;">#${rank}</div>
              <div style="font-size: 11px; font-weight: 700; color: ${trendColor};">${trendText}</div>
            </td>
            <td valign="top" style="padding-left: 18px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #1d4ed8;">${tier}</div>
              <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 2px 0 6px 0;">${teamName} (${managerName})</div>
              <div style="font-size: 13px; color: #334155; line-height: 1.5; font-style: italic;">
                "${blurbSnippet}"
              </div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Top 3 Preview -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.2px; color: #64748b; margin-bottom: 10px;">Top Standings Preview</div>
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden;">
          ${topTeams.map((t, i) => `
            <tr>
              <td style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #0f172a; width: 36px; border-bottom: ${i < topTeams.length - 1 ? '1px solid #f1f5f9' : 'none'};">
                #${t.rank}
              </td>
              <td style="padding: 10px 8px; font-size: 13px; font-weight: 700; color: #334155; border-bottom: ${i < topTeams.length - 1 ? '1px solid #f1f5f9' : 'none'};">
                ${t.name}
              </td>
              <td align="right" style="padding: 10px 14px; font-size: 11px; font-weight: 700; color: #64748b; border-bottom: ${i < topTeams.length - 1 ? '1px solid #f1f5f9' : 'none'};">
                ${t.trend}
              </td>
            </tr>
          `).join('')}
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${String(leagueUrl || '').replace(/#.*$/, '').replace(/\/$/, '')}" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px; letter-spacing: 0.5px;">
          View Full Power Rankings &rarr;
        </a>
      </div>
    `;

    return emailShell({ title, previewText, bodyContent, leagueName, leagueUrl });
}

/**
 * Power Rankings Variation B: SELECTED PRODUCTION TEMPLATE
 * Matches The Fantasy Vault's clean editorial design
 */
export function getPowerRankingsTemplateB({
    leagueName = 'The Dumbarton League',
    managerName = 'Landon',
    teamName = 'Katz in the Cradle',
    weekNum = 1,
    rank = 2,
    prevRank = 1,
    leagueUrl = 'https://fantasyvault.vercel.app/dmsfantasy',
    riser = { name: 'Seb', move: '+3 spots' },
    faller = { name: 'Kevin', move: '-2 spots' }
} = {}) {
    const title = `Week ${weekNum} Power Rankings Published`;
    const previewText = `Week ${weekNum} Power Rankings: ${managerName} is slotted at #${rank} this week.`;

    const bodyContent = `
      <div style="text-align: center; margin-bottom: 24px;">
        <span style="font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #991b1b;">WEEKLY DISPATCH</span>
        <h1 style="font-family: 'Newsreader', Georgia, serif; font-size: 28px; font-weight: 700; color: #0f172a; letter-spacing: -0.5px; margin: 6px 0 8px 0; line-height: 1.2;">
          The Week ${weekNum} Board Is Set
        </h1>
        <p style="font-size: 14px; color: #64748b; max-width: 460px; margin: 0 auto; line-height: 1.6;">
          Updated rankings, movement tiers, and commissioner breakdowns are now unlocked in The Fantasy Vault.
        </p>
      </div>

      <!-- Spotlight Position Card -->
      <div style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; padding: 22px; text-align: center; margin-bottom: 22px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b;">YOUR PERSONAL POSITION</div>
        <div style="font-size: 52px; font-weight: 900; color: #0f172a; line-height: 1.1; margin: 6px 0 2px 0;">#${rank}</div>
        <div style="font-size: 17px; font-weight: 700; color: #0f172a;">${teamName}</div>
        <div style="font-size: 13px; color: #64748b; margin-top: 2px;">Manager: ${managerName}</div>
      </div>

      <!-- Quick Shifts Grid -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
        <tr>
          <td width="48%" style="background-color: rgba(21, 128, 61, 0.05); border: 1px solid rgba(21, 128, 61, 0.22); border-radius: 6px; padding: 14px; text-align: center;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #15803d; letter-spacing: 1px;">BIGGEST RISER</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 3px;">${riser.name}</div>
            <div style="font-size: 12px; color: #15803d; font-weight: 700;">${riser.move}</div>
          </td>
          <td width="4%"></td>
          <td width="48%" style="background-color: rgba(220, 38, 38, 0.05); border: 1px solid rgba(220, 38, 38, 0.22); border-radius: 6px; padding: 14px; text-align: center;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #dc2626; letter-spacing: 1px;">BIGGEST FALLER</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 3px;">${faller.name}</div>
            <div style="font-size: 12px; color: #dc2626; font-weight: 700;">${faller.move}</div>
          </td>
        </tr>
      </table>

      <div style="text-align: center;">
        <a href="${String(leagueUrl || '').replace(/#.*$/, '').replace(/\/$/, '')}" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px; letter-spacing: 0.5px;">
          View Full Power Rankings &rarr;
        </a>
      </div>
    `;

    return emailShell({ title, previewText, bodyContent, leagueName, leagueUrl });
}

/**
 * Power Rankings Variation C: Broadcast Edition
 */
export function getPowerRankingsTemplateC({
    leagueName = 'The Dumbarton League',
    managerName = 'Landon',
    teamName = 'Katz in the Cradle',
    weekNum = 1,
    rank = 2,
    commishQuote = 'Week 1 showed us that projections mean nothing until the whistle blows, as early roster management will dictate the championship bracket.',
    leagueUrl = 'https://fantasyvault.vercel.app/dmsfantasy'
} = {}) {
    const title = `Vault Intel: Week ${weekNum} Power Rankings`;
    const previewText = `Intel Report: ${managerName} checks in at #${rank} for Week ${weekNum}.`;

    const bodyContent = `
      <div style="border-left: 3px solid #0f172a; padding-left: 16px; margin-bottom: 22px;">
        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #991b1b;">BROADCAST WIRE</div>
        <h1 style="font-family: 'Newsreader', Georgia, serif; font-size: 25px; font-weight: 700; color: #0f172a; margin: 4px 0 0 0;">
          Week ${weekNum} Power Rankings Released
        </h1>
      </div>

      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
        The weekly board has been calibrated. ${managerName}'s squad (<strong>${teamName}</strong>) enters the Week ${weekNum} rankings positioned at <strong>#${rank}</strong>.
      </p>

      <!-- Quote Box -->
      <div style="background-color: #f8fafc; border-left: 3px solid #cbd5e1; padding: 16px 18px; margin-bottom: 24px; font-style: italic; color: #334155; font-size: 13px; line-height: 1.6;">
        "${commishQuote}"
        <div style="font-style: normal; font-size: 11px; font-weight: 700; color: #64748b; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px;">
          Office of the Commissioner &bull; ${leagueName}
        </div>
      </div>

      <div style="text-align: left;">
        <a href="${String(leagueUrl || '').replace(/#.*$/, '').replace(/\/$/, '')}" style="display: inline-block; padding: 11px 22px; background-color: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px;">
          Open Power Rankings &rarr;
        </a>
      </div>
    `;

    return emailShell({ title, previewText, bodyContent, leagueName, leagueUrl });
}

// ==========================================
// 2. DRAFT GRADES TEMPLATES
// ==========================================

/**
 * Draft Grades Variation A: SELECTED PRODUCTION TEMPLATE
 * Executive Report Card with LDI Value Surplus Audit
 */
export function getDraftGradesTemplateA({
    leagueName = 'The Dumbarton League',
    managerName = 'Landon',
    teamName = 'Katz in the Cradle',
    seasonYear = 2026,
    grade = 'A',
    score = 94.2,
    bestPick = 'CeeDee Lamb (Round 1, Pick 6)',
    draftRank = 2,
    totalTeams = 12,
    ldiValue = '+14.2 LDI Surplus',
    leagueUrl = 'https://fantasyvault.vercel.app/dmsfantasy'
} = {}) {
    const title = `${seasonYear} Draft Audit & Grades Finalized`;
    const previewText = `Your ${seasonYear} Draft Grade is ${grade} (${score}/100) - Ranked #${draftRank} in ${leagueName}.`;

    const bodyContent = `
      <div style="margin-bottom: 22px;">
        <span style="font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; color: #991b1b;">OFFICIAL DRAFT AUDIT &bull; ${seasonYear} SEASON</span>
        <h1 style="font-family: 'Newsreader', Georgia, serif; font-size: 26px; font-weight: 700; color: #0f172a; margin: 6px 0 6px 0; line-height: 1.25;">
          ${seasonYear} Draft Grades Are Finalized
        </h1>
        <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0;">
          The Landon Draft Index (LDI) framework has processed pick valuations, capital efficiency, and roster balance across all ${totalTeams} franchises.
        </p>
      </div>

      <!-- Report Card Box -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 22px; margin-bottom: 24px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td valign="middle" style="width: 110px; text-align: center; border-right: 1px solid #e2e8f0; padding-right: 18px;">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b;">FINAL GRADE</div>
              <div style="font-size: 54px; font-weight: 900; color: #0f172a; line-height: 1; margin: 4px 0 2px 0;">${grade}</div>
              <div style="font-size: 12px; font-weight: 700; color: #64748b;">${score} / 100</div>
            </td>
            <td valign="middle" style="padding-left: 20px;">
              <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">${teamName}</div>
              <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">Manager: ${managerName}</div>
              
              <div style="font-size: 12px; color: #334155; margin-bottom: 4px;">
                <strong>Draft Board Rank:</strong> #${draftRank} of ${totalTeams} Teams
              </div>
              <div style="font-size: 12px; color: #334155; margin-bottom: 4px;">
                <strong>Top Value Selection:</strong> ${bestPick}
              </div>
              <div style="font-size: 12px; color: #334155;">
                <strong>LDI Capital Return:</strong> <span style="color: #15803d; font-weight: 700;">${ldiValue}</span>
              </div>
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center;">
        <a href="${String(leagueUrl || '').replace(/#.*$/, '').replace(/\/$/, '')}/draft" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px; letter-spacing: 0.5px;">
          View Full Draft Board &amp; Analysis &rarr;
        </a>
      </div>
    `;

    return emailShell({ title, previewText, bodyContent, leagueName, leagueUrl });
}

/**
 * Draft Grades Variation B: LDI Analytics Pro
 */
export function getDraftGradesTemplateB({
    leagueName = 'The Dumbarton League',
    managerName = 'Landon',
    seasonYear = 2026,
    grade = 'A-',
    bestPick = 'CeeDee Lamb',
    bestPickRound = 'Round 1, Pick 6',
    stealPick = 'Trey McBride (Round 6, Pick 66)',
    leagueUrl = 'https://fantasyvault.vercel.app/dmsfantasy'
} = {}) {
    const title = `${seasonYear} Draft Class Evaluation`;
    const previewText = `Draft Audit: ${managerName} earned an ${grade} in the ${seasonYear} Draft.`;

    const bodyContent = `
      <div style="margin-bottom: 22px;">
        <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #1d4ed8;">ANALYTICS DISPATCH</span>
        <h1 style="font-family: 'Newsreader', Georgia, serif; font-size: 25px; font-weight: 700; color: #0f172a; margin: 4px 0;">
          ${seasonYear} Draft Evaluation
        </h1>
        <p style="font-size: 13px; color: #64748b; margin: 0;">Comprehensive breakdown for manager ${managerName}.</p>
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">COMPOSITE RATING</div>
        <div style="font-size: 40px; font-weight: 900; color: #0f172a;">${grade}</div>
      </div>

      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
        <tr>
          <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">CORNERSTONE PICK</div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">${bestPick}</div>
            <div style="font-size: 11px; color: #64748b;">${bestPickRound}</div>
          </td>
          <td width="4%"></td>
          <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #15803d;">BEST VALUE STEAL</div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">${stealPick}</div>
            <div style="font-size: 11px; color: #15803d; font-weight: 600;">High Surplus</div>
          </td>
        </tr>
      </table>

      <div style="text-align: center;">
        <a href="${String(leagueUrl || '').replace(/#.*$/, '').replace(/\/$/, '')}/draft" style="display: inline-block; padding: 11px 22px; background-color: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px;">
          View Full Draft Analysis &rarr;
        </a>
      </div>
    `;

    return emailShell({ title, previewText, bodyContent, leagueName, leagueUrl });
}

/**
 * Draft Grades Variation C: War Room Summary
 */
export function getDraftGradesTemplateC({
    leagueName = 'The Dumbarton League',
    managerName = 'Landon',
    teamName = 'Katz in the Cradle',
    seasonYear = 2026,
    grade = 'A',
    summaryBlurb = 'Exceptional draft execution, as elite anchors in the opening frames provided immediate surplus value across starting roster positions.',
    bestPick = 'CeeDee Lamb (Pick 6)',
    leagueUrl = 'https://fantasyvault.vercel.app/dmsfantasy'
} = {}) {
    const title = `${seasonYear} War Room Recap`;
    const previewText = `War Room Audit: ${teamName} posted an ${grade} in the ${seasonYear} draft.`;

    const bodyContent = `
      <div style="border-left: 3px solid #0f172a; padding-left: 16px; margin-bottom: 20px;">
        <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b;">WAR ROOM AUDIT</span>
        <h1 style="font-family: 'Newsreader', Georgia, serif; font-size: 24px; font-weight: 700; color: #0f172a; margin: 4px 0 0 0;">
          ${seasonYear} Draft Recap &amp; Grades
        </h1>
      </div>

      <p style="font-size: 14px; color: #334155; line-height: 1.6; margin-bottom: 20px;">
        ${summaryBlurb}
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 22px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <div style="font-size: 11px; font-weight: 700; color: #64748b;">RATED FRANCHISE</div>
              <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${teamName} (${managerName})</div>
            </td>
            <td align="right">
              <div style="font-size: 11px; font-weight: 700; color: #64748b;">GRADE</div>
              <div style="font-size: 22px; font-weight: 900; color: #0f172a;">${grade}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: left;">
        <a href="${String(leagueUrl || '').replace(/#.*$/, '').replace(/\/$/, '')}/draft" style="display: inline-block; padding: 11px 22px; background-color: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px;">
          View War Room Board &rarr;
        </a>
      </div>
    `;

    return emailShell({ title, previewText, bodyContent, leagueName, leagueUrl });
}

// ==========================================
// 3. WEEKLY NEWSLETTER TEMPLATES
// ==========================================

/**
 * Weekly Newsletter Variation A: The Vault Gazette
 */
export function getNewsletterTemplateA({
    leagueName = 'The Dumbarton League',
    weekNum = 1,
    seasonYear = 2026,
    leadHeadline = 'Opening Week Carnage: Underdogs Shake Up The Vault',
    leadSnippet = 'A wild opening week brought unexpected upsets, breakout waiver gems, and down-to-the-wire matchups, as several perennial title favorites fell in opening-day battles.',
    highScorer = { name: 'Jake', points: 148.6 },
    gameOfTheWeek = { teamA: 'Katz in the Cradle', scoreA: 132.4, teamB: 'Madoc', scoreB: 130.1 },
    leagueUrl = 'https://fantasyvault.vercel.app/dmsfantasy'
} = {}) {
    const title = `The Vault Gazette: Week ${weekNum}`;
    const previewText = `Gazette Week ${weekNum}: ${leadHeadline}`;

    const bodyContent = `
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #991b1b;">THE VAULT GAZETTE</span>
            </td>
            <td align="right">
              <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">WEEK ${weekNum} &bull; ${seasonYear}</span>
            </td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 22px;">
        <h1 style="font-family: 'Newsreader', Georgia, serif; font-size: 26px; font-weight: 700; color: #0f172a; line-height: 1.25; margin: 0 0 10px 0;">
          ${leadHeadline}
        </h1>
        <p style="font-size: 14px; color: #334155; line-height: 1.6; margin: 0;">
          ${leadSnippet}
        </p>
      </div>

      <!-- Quick Metrics Grid -->
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
        <tr>
          <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">WEEK HIGH SCORER</div>
            <div style="font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 2px;">${highScorer.name}</div>
            <div style="font-size: 12px; color: #15803d; font-weight: 700;">${highScorer.points} Points</div>
          </td>
          <td width="4%"></td>
          <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px;">
            <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b;">GAME OF THE WEEK</div>
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 2px;">${gameOfTheWeek.teamA} (${gameOfTheWeek.scoreA})</div>
            <div style="font-size: 11px; color: #64748b;">vs. ${gameOfTheWeek.teamB} (${gameOfTheWeek.scoreB})</div>
          </td>
        </tr>
      </table>

      <div style="text-align: center;">
        <a href="${String(leagueUrl || '').replace(/#.*$/, '').replace(/\/$/, '')}/newsletter" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px;">
          Read Full Gazette Edition &rarr;
        </a>
      </div>
    `;

    return emailShell({ title, previewText, bodyContent, leagueName, leagueUrl, topBorder: '4px solid #991b1b' });
}

/**
 * Weekly Newsletter Variation B: Sunday Recap Dispatch
 */
export function getNewsletterTemplateB({
    leagueName = 'The Dumbarton League',
    weekNum = 1,
    seasonYear = 2026,
    leadHeadline = 'Opening Week Carnage: Underdogs Shake Up The Vault',
    leadSnippet = 'The dust has settled on Week 1, as injury fallout, waiver priorities, and early power shifts reshape the championship race.',
    leagueUrl = 'https://fantasyvault.vercel.app/dmsfantasy'
} = {}) {
    const title = `The Sunday Recap: Week ${weekNum}`;
    const previewText = `Sunday Dispatch: ${leadHeadline}`;

    const bodyContent = `
      <div style="text-align: center; margin-bottom: 22px;">
        <span style="font-size: 10px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #991b1b;">WEEKLY CHRONICLE</span>
        <h1 style="font-family: 'Newsreader', Georgia, serif; font-size: 26px; font-weight: 700; color: #0f172a; margin: 6px 0 10px 0; line-height: 1.25;">
          ${leadHeadline}
        </h1>
        <p style="font-size: 14px; color: #64748b; max-width: 460px; margin: 0 auto; line-height: 1.6;">
          ${leadSnippet}
        </p>
      </div>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 22px;">
        <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; margin-bottom: 8px;">
          IN THIS EDITION
        </div>
        <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #334155; line-height: 1.8;">
          <li>Complete matchup breakdowns and scoreboard recaps</li>
          <li>Waiver wire efficiency and priority claim analysis</li>
          <li>Updated playoff probabilities and strength-of-schedule outlook</li>
          <li>Commissioner notes and rivalry history updates</li>
        </ul>
      </div>

      <div style="text-align: center;">
        <a href="${String(leagueUrl || '').replace(/#.*$/, '').replace(/\/$/, '')}/newsletter" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px;">
          Dive Into The Newsletter &rarr;
        </a>
      </div>
    `;

    return emailShell({ title, previewText, bodyContent, leagueName, leagueUrl });
}

/**
 * Weekly Newsletter Variation C: SELECTED PRODUCTION TEMPLATE
 * Authentic Vault Gazette masthead with Volume & Issue metadata,
 * clean editorial headline, no cluttered recap boxes.
 */
export function getNewsletterTemplateC({
    leagueName = 'The Fantasy Vault League',
    newsletterTitle = 'The Weekly Gazette',
    weekNum = 1,
    seasonYear = 2026,
    leadHeadline = 'Opening Week Carnage: Underdogs Shake Up The Vault',
    leadSnippet = 'Historic point margins and nailbiter finishes headline the season debut, as managers scramble for early waiver leverage across the board.',
    leagueUrl = 'https://fantasyvault.vercel.app',
    volume = null
} = {}) {
    const title = `${newsletterTitle}: Week ${weekNum}`;
    const previewText = `Headlines: ${leadHeadline}`;
    // DMS Origin 2018 (Vol 9 in 2026), standard vault format
    const displayVolume = volume !== null && volume !== undefined ? volume : (seasonYear ? (seasonYear - 2017) : 9);

    const bodyContent = `
      <!-- Masthead Bar (Volume & Issue exactly matching the Vault Newsletter Engine) -->
      <div style="border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 22px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="left" valign="middle">
              <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #0f172a;">
                VOL. ${displayVolume} &bull; ISSUE ${weekNum}
              </span>
            </td>
            <td align="right" valign="middle">
              <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
                WEEK ${weekNum} &bull; ${seasonYear}
              </span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Lead Article Section -->
      <div style="margin-bottom: 26px;">
        <div style="margin-bottom: 10px;">
          <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; background-color: #991b1b; color: #ffffff;">
            LEAD STORY
          </span>
          <span style="display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; background-color: #f1f5f9; color: #334155; margin-left: 4px;">
            WEEK ${weekNum} RECAP
          </span>
        </div>
        
        <h1 style="font-family: 'Newsreader', Georgia, serif; font-size: 26px; font-weight: 800; color: #0f172a; line-height: 1.25; margin: 0 0 12px 0;">
          ${leadHeadline}
        </h1>
        <p style="font-size: 15px; color: #334155; line-height: 1.65; margin: 0;">
          ${leadSnippet}
        </p>
      </div>

      <!-- Clean CTA -->
      <div style="text-align: left; margin-bottom: 8px;">
        <a href="${String(leagueUrl || '').replace(/#.*$/, '').replace(/\/$/, '')}/newsletter" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 6px; letter-spacing: 0.5px;">
          Read Full Newsletter &rarr;
        </a>
      </div>
    `;

    return emailShell({ 
        title, 
        previewText, 
        bodyContent, 
        leagueName, 
        leagueUrl, 
        topBorder: '4px solid #991b1b' 
    });
}
