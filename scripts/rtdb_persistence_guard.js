/**
 * RTDB Persistence & Merge Guard
 * Centralized, non-destructive merge protection layer for The Fantasy Vault platform.
 * Ensures that subsequent scraper runs, seed scripts, builds, and commits NEVER overwrite
 * user-edited fields (league title, tagline, aliases, power rankings, nicknames, claims, notes, rivalries).
 */

/**
 * Safely merges league settings, prioritizing user-edited custom fields over static script defaults.
 */
export function safeMergeLeagueSettings(existing = {}, incoming = {}) {
  if (!existing || typeof existing !== 'object') return { ...incoming };

  const protectedKeys = [
    'name',
    'tagline',
    'subtitle',
    'newsletter_title',
    'allow_nicknames',
    'seasonLabelConvention',
    'waiver_type',
    'uses_faab',
    'scoring_format',
    'admin_password',
    'join_code'
  ];

  const merged = { ...incoming };

  for (const key of protectedKeys) {
    if (existing[key] !== undefined && existing[key] !== null && existing[key] !== '') {
      merged[key] = existing[key];
    }
  }

  return merged;
}

/**
 * Safely merges power rankings, ensuring live user edits, new editions created directly
 * on the site, and intermediate editions (such as Week 0.5 or Week 1) are NEVER wiped out
 * or downgraded by static JSON files or script seeds.
 */
export function safeMergePowerRankings(existing = {}, incoming = {}) {
  if (!existing || typeof existing !== 'object') return { ...incoming };

  const normalizeWeek = (ed) => {
    if (!ed) return 0;
    if (ed.week !== undefined && ed.week !== null && !isNaN(Number(ed.week))) {
      return Number(ed.week);
    }
    const titleMatch = (ed.title || '').match(/week\s*([0-9]+(?:\.[0-9]+)?)/i);
    if (titleMatch) return parseFloat(titleMatch[1]);
    const idMatch = (ed.id || '').match(/w([0-9]+(?:\.[0-9]+)?)/i);
    if (idMatch) return parseFloat(idMatch[1]);
    return 0;
  };

  const normalizeSeason = (ed) => {
    if (!ed) return 2026;
    if (ed.season !== undefined && ed.season !== null && !isNaN(Number(ed.season))) {
      return Number(ed.season);
    }
    const titleMatch = (ed.title || '').match(/(20\d\d)/);
    if (titleMatch) return parseInt(titleMatch[1], 10);
    const idMatch = (ed.id || '').match(/(20\d\d)/);
    if (idMatch) return parseInt(idMatch[1], 10);
    return 2026;
  };

  const getTimestamp = (ed) => {
    if (!ed) return 0;
    return Number(ed.updated_at || ed.created_at || ed.archived_at || 0);
  };

  const hasBlurbContent = (ed) => {
    if (!ed || !Array.isArray(ed.rankings)) return false;
    return ed.rankings.some(r => r && r.blurb && r.blurb.trim() && r.blurb !== '<p></p>' && r.blurb !== '<p><br></p>');
  };

  const existingCurrent = existing.current_ranking;
  const incomingCurrent = incoming.current_ranking;

  const toArray = (obj) => {
    if (!obj) return [];
    if (Array.isArray(obj)) return obj.filter(Boolean);
    return Object.values(obj).filter(Boolean);
  };

  const existingArchived = toArray(existing.archived_rankings);
  const incomingArchived = toArray(incoming.archived_rankings);
  const existingVault = toArray(existing.power_rankings_vault_history);
  const incomingVault = toArray(incoming.power_rankings_vault_history);

  // Pool all known editions.
  // Database entries (existing) are tagged as live/authoritative.
  const pool = [];

  // Add incoming (static/script) first
  incomingArchived.forEach(ed => pool.push({ ed, isLiveDb: false }));
  incomingVault.forEach(ed => pool.push({ ed, isLiveDb: false }));
  if (incomingCurrent) pool.push({ ed: incomingCurrent, isLiveDb: false });

  // Add existing (live RTDB) second so live entries can override/enrich
  existingArchived.forEach(ed => pool.push({ ed, isLiveDb: true }));
  existingVault.forEach(ed => pool.push({ ed, isLiveDb: true }));
  if (existingCurrent) pool.push({ ed: existingCurrent, isLiveDb: true });

  const editionsMap = new Map();

  for (const item of pool) {
    const rawEd = item.ed;
    if (!rawEd) continue;

    const week = normalizeWeek(rawEd);
    const season = normalizeSeason(rawEd);
    const ed = {
      ...rawEd,
      week,
      season,
      id: rawEd.id || `pr_${season}_w${String(week).replace('.', '_')}`
    };

    // Semantic deduplication key based on season + week, plus ID
    const primaryKey = `season_${season}_week_${week}`;
    const idKey = String(ed.id);

    // Check if we already have an edition for this key
    const existingEntry = editionsMap.get(primaryKey) || editionsMap.get(idKey);

    if (!existingEntry) {
      editionsMap.set(primaryKey, ed);
      editionsMap.set(idKey, ed);
    } else {
      // If the new item is from live DB, it ALWAYS wins over incoming static files
      if (item.isLiveDb) {
        // Merge rankings if incoming had something, but keep live blurbs and order
        editionsMap.set(primaryKey, ed);
        editionsMap.set(idKey, ed);
      } else {
        // If existingEntry is from live DB and incoming is static file, NEVER let static overwrite live!
        const existingHasBlurbs = hasBlurbContent(existingEntry);
        const incomingHasBlurbs = hasBlurbContent(ed);
        const existingTs = getTimestamp(existingEntry);
        const incomingTs = getTimestamp(ed);

        if (!existingHasBlurbs && incomingHasBlurbs && incomingTs > existingTs) {
          editionsMap.set(primaryKey, ed);
          editionsMap.set(idKey, ed);
        }
      }
    }
  }

  // Deduplicate unique editions by ID
  const uniqueEditions = Array.from(new Set(editionsMap.values()));

  // Sort descending: highest season first, then highest week first, then newest timestamp first
  uniqueEditions.sort((a, b) => {
    if (b.season !== a.season) return (b.season || 0) - (a.season || 0);
    if (b.week !== a.week) return (b.week || 0) - (a.week || 0);
    return getTimestamp(b) - getTimestamp(a);
  });

  let finalCurrent = null;
  let finalArchived = [];

  if (uniqueEditions.length > 0) {
    // If existingCurrent exists and has user blurbs or higher/equal week to any incoming, protect it!
    const existingCurrentWeek = existingCurrent ? normalizeWeek(existingCurrent) : -1;
    const existingCurrentSeason = existingCurrent ? normalizeSeason(existingCurrent) : -1;
    const topEdition = uniqueEditions[0];

    if (
      existingCurrent &&
      existingCurrentSeason >= topEdition.season &&
      existingCurrentWeek >= topEdition.week
    ) {
      finalCurrent = {
        ...existingCurrent,
        week: existingCurrentWeek,
        season: existingCurrentSeason
      };
      finalArchived = uniqueEditions.filter(ed => ed.id !== finalCurrent.id);
    } else {
      finalCurrent = topEdition;
      finalArchived = uniqueEditions.slice(1);
    }
  }

  // Build immutable vault history map of ALL editions
  const vaultHistory = {};
  uniqueEditions.forEach(ed => {
    if (ed && ed.id) {
      vaultHistory[ed.id] = ed;
    }
  });

  // Preserve allowed_editors (union of sets)
  const allowedEditors = Array.from(new Set([
    ...(Array.isArray(existing.allowed_editors) ? existing.allowed_editors : []),
    ...(Array.isArray(incoming.allowed_editors) ? incoming.allowed_editors : ['landon'])
  ]));

  return {
    allowed_editors: allowedEditors,
    current_ranking: finalCurrent,
    archived_rankings: finalArchived,
    power_rankings_vault_history: vaultHistory
  };
}

/**
 * Safely merges managers / members, preserving admin aliases, nicknames,
 * custom avatars, and user claim authentication links.
 */
export function safeMergeManagers(existing = [], incoming = []) {
  const existingList = Array.isArray(existing) ? existing : (existing ? Object.values(existing) : []);
  const incomingList = Array.isArray(incoming) ? incoming : (incoming ? Object.values(incoming) : []);

  const existingMap = new Map();
  existingList.forEach(m => {
    const id = String(m.id || m.manager_id || '').toLowerCase().trim();
    if (id) existingMap.set(id, m);
  });

  return incomingList.map(inMgr => {
    const id = String(inMgr.id || inMgr.manager_id || '').toLowerCase().trim();
    const exMgr = existingMap.get(id);
    if (!exMgr) return inMgr;

    return {
      ...inMgr,
      // Preserve admin customizations
      alias: exMgr.alias || inMgr.alias || inMgr.name,
      name: exMgr.alias || inMgr.name,
      nickname: exMgr.nickname !== undefined ? exMgr.nickname : inMgr.nickname,
      custom_avatar_url: exMgr.custom_avatar_url || inMgr.custom_avatar_url,
      avatar: exMgr.custom_avatar_url || inMgr.avatar || exMgr.avatar,
      status: exMgr.status || inMgr.status,
      // Preserve claim & identity links
      claimed_by_uid: exMgr.claimed_by_uid || inMgr.claimed_by_uid,
      claimed_by_email: exMgr.claimed_by_email || inMgr.claimed_by_email,
      favorite_team: exMgr.favorite_team || inMgr.favorite_team
    };
  });
}

/**
 * Safely merges commissioner notes, preventing deletion of existing updates.
 */
export function safeMergeCommissionerNotes(existing = [], incoming = []) {
  const existingList = Array.isArray(existing) ? existing : (existing ? Object.values(existing) : []);
  const incomingList = Array.isArray(incoming) ? incoming : (incoming ? Object.values(incoming) : []);

  const notesMap = new Map();
  incomingList.forEach(n => { if (n && n.id) notesMap.set(String(n.id), n); });
  existingList.forEach(n => { if (n && n.id) notesMap.set(String(n.id), n); });

  return Array.from(notesMap.values()).sort((a, b) => (b.timestamp || b.created_at || 0) - (a.timestamp || a.created_at || 0));
}

/**
 * Safely merges rivalries, preserving custom blurbs and editorial text.
 */
export function safeMergeRivalries(existing = [], incoming = []) {
  const existingList = Array.isArray(existing) ? existing : (existing ? Object.values(existing) : []);
  const incomingList = Array.isArray(incoming) ? incoming : (incoming ? Object.values(incoming) : []);

  return incomingList.map(inRiv => {
    const m1 = String(inRiv.manager1 || '').toLowerCase();
    const m2 = String(inRiv.manager2 || '').toLowerCase();

    const exRiv = existingList.find(r => {
      const em1 = String(r.manager1 || '').toLowerCase();
      const em2 = String(r.manager2 || '').toLowerCase();
      return (em1 === m1 && em2 === m2) || (em1 === m2 && em2 === m1);
    });

    if (!exRiv) return inRiv;

    return {
      ...inRiv,
      writeup: exRiv.writeup !== undefined && exRiv.writeup !== null ? exRiv.writeup : inRiv.writeup,
      notes: exRiv.notes !== undefined && exRiv.notes !== null ? exRiv.notes : inRiv.notes
    };
  });
}
