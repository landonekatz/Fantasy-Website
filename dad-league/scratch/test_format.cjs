const fs = require('fs');

function formatPlayerStats(player) {
    if (!player.stat_line || Object.keys(player.stat_line).length === 0) return '';
    const stats = player.stat_line;
    let out = [];

    // DEFENSE / SPECIAL TEAMS
    if (player.position === 'D/ST' || player.position === 'DEF') {
        const ptsAllowed = stats['120'];
        const ydsAllowed = stats['127'];
        const sacks = Math.round(stats['99'] || 0);
        const ints = Math.round(stats['95'] || 0);
        const fumRec = Math.round(stats['96'] || 0);
        const safeties = Math.round(stats['98'] || 0);
        const blocks = Math.round(stats['97'] || 0);
        const defTD = Math.round((stats['105'] || 0) + (stats['101'] || 0) + (stats['102'] || 0) + (stats['103'] || 0) + (stats['104'] || 0));

        if (ptsAllowed != null) out.push(`PA: ${ptsAllowed}`);
        if (ydsAllowed != null) out.push(`YA: ${ydsAllowed}`);
        if (sacks > 0) out.push(`Sacks: ${sacks}`);
        if (ints > 0) out.push(`INT: ${ints}`);
        if (fumRec > 0) out.push(`FR: ${fumRec}`);
        if (safeties > 0) out.push(`Safeties: ${safeties}`);
        if (blocks > 0) out.push(`Blk: ${blocks}`);
        if (defTD > 0) out.push(`TD: ${defTD}`);
        
        if (out.length > 0) {
            return `<div class="player-stats-line" style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${out.join(' | ')}</div>`;
        }
        return '';
    }

    // KICKER
    if (player.position === 'K') {
        const fgMade = Math.round(stats['83'] || 0);
        const fgAtt = Math.round(stats['84'] || 0);
        const patMade = Math.round(stats['86'] || 0);
        const patAtt = Math.round(stats['87'] || 0);
        const fg50 = Math.round(stats['74'] || 0);
        
        let fgStr = `FG: ${fgMade}/${Math.max(fgMade, fgAtt)}`;
        if (fg50 > 0) fgStr += ` (50+)`;
        
        let patStr = `PAT: ${patMade}/${Math.max(patMade, patAtt)}`;
        
        out.push(fgStr);
        out.push(patStr);
        
        if (out.length > 0) {
            return `<div class="player-stats-line" style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${out.join(' | ')}</div>`;
        }
        return '';
    }

    // OFFENSE
    const passYd = Math.round(stats['3'] || 0);
    const passTd = Math.round(stats['4'] || 0);
    const passInt = Math.round(stats['20'] || 0);
    const pass2pc = Math.round(stats['19'] || 0);
    if (passYd || passTd || passInt || pass2pc) {
        let pStr = `Pass: ${passYd}yd`;
        if (passTd > 0) pStr += ` ${passTd}TD`;
        if (passInt > 0) pStr += ` ${passInt}INT`;
        if (pass2pc > 0) pStr += ` ${pass2pc}x2PC`;
        out.push(pStr);
    }
    
    const rushAtt = Math.round(stats['23'] || 0);
    const rushYd = Math.round(stats['24'] || 0);
    const rushTd = Math.round(stats['25'] || 0);
    const rush2pc = Math.round(stats['26'] || 0);
    if (rushAtt || rushYd || rushTd || rush2pc) {
        let rStr = `Rush:`;
        if (rushAtt > 0) rStr += ` ${rushAtt}att`;
        rStr += ` ${rushYd}yd`;
        if (rushTd > 0) rStr += ` ${rushTd}TD`;
        if (rush2pc > 0) rStr += ` ${rush2pc}x2PC`;
        out.push(rStr.trim());
    }
    
    const recTgt = Math.round(stats['41'] || 0);
    const recs = Math.round(stats['53'] || 0);
    const recYd = Math.round(stats['42'] || 0);
    const recTd = Math.round(stats['43'] || 0);
    const rec2pc = Math.round(stats['44'] || 0);
    if (recTgt || recs || recYd || recTd || rec2pc) {
        let rStr = `Rec:`;
        if (recTgt > 0) rStr += ` ${recTgt}tgt`;
        if (recs > 0) rStr += ` ${recs}rec`;
        rStr += ` ${recYd}yd`;
        if (recTd > 0) rStr += ` ${recTd}TD`;
        if (rec2pc > 0) rStr += ` ${rec2pc}x2PC`;
        out.push(rStr.trim());
    }

    const fumLost = Math.round(stats['72'] || 0);
    if (fumLost > 0) {
        out.push(`FUM: ${fumLost}`);
    }
    
    if (out.length > 0) {
        return `<div class="player-stats-line" style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">${out.join(' | ')}</div>`;
    }
    return '';
}

const data = JSON.parse(fs.readFileSync('/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json', 'utf8'));

let defTested = false;
let kTested = false;
let qbTested = false;
let defTDTested = false;

for (const p of data) {
    const html = formatPlayerStats(p);
    if (html) {
        if (p.position === 'D/ST' && !defTested && p.stat_line['120'] !== undefined) {
            console.log(p.player_name, "->", html);
            defTested = true;
        }
        if (p.position === 'D/ST' && !defTDTested && p.stat_line['103'] > 0) { // int return td
            console.log("DEF TD: ", p.player_name, "->", html);
            defTDTested = true;
        }
        if (p.position === 'K' && !kTested && p.stat_line['83'] !== undefined) {
            console.log(p.player_name, "->", html);
            kTested = true;
        }
        if (p.position === 'QB' && !qbTested && p.stat_line['20'] > 0 && p.stat_line['72'] > 0) { // ints and fumbles
            console.log(p.player_name, "->", html);
            qbTested = true;
        }
        
        if (defTested && kTested && qbTested && defTDTested) break;
    }
}
