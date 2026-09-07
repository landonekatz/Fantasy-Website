/**
 * scripts/migrate_and_repair_vault_users.js
 *
 * Restores and synchronizes user accounts, claims, and league rosters across
 * The Fantasy Vault platform in Firebase Realtime Database.
 *
 * Tasks performed:
 * 1. Restores all 11 active DMS Fantasy managers in /leagues/dmsfantasy/claims
 *    with complete metadata (email, name, userId, favorite_team, claimedAt).
 * 2. Populates a dedicated /leagues/{leagueSlug}/users directory for every league,
 *    allowing administrators to easily view all members by league in Firebase Console.
 * 3. Populates top-level email and name fields under /users/{uid} in RTDB.
 */

const FIREBASE_DB_URL = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';

// Canonical display names for DMS Fantasy managers
const DMS_CANONICAL_NAMES = {
  alex: 'Alex Frey',
  benjamin: 'Benjamin Raufman',
  carson: 'Carson Glikin',
  isabella: 'Isabella Sabatino',
  jake: 'Jake Fey',
  jordan: 'Jordan Beck',
  landon: 'Landon Katz',
  luke: 'Luke Gutberlet',
  madoc: 'Madoc Watson',
  mike: 'Mike Stamatos',
  ryan: 'Ryan Boice',
  will: 'Will Lehmann'
};

// Formatting helper
function formatCapitalizedName(name, email) {
  if (email && email.toLowerCase() === 'landonekatz@gmail.com') return 'Landon Katz';
  if (name && typeof name === 'string' && name.trim()) {
    const trimmed = name.trim();
    if (trimmed.toLowerCase() === 'landon' || trimmed.toLowerCase() === 'landonekatz') return 'Landon';
    if (!trimmed.includes('@')) {
      return trimmed.split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
    }
  }
  if (email) {
    const prefix = email.split('@')[0];
    if (prefix.toLowerCase() === 'landonekatz' || prefix.toLowerCase() === 'landon') return 'Landon Katz';
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return 'User';
}

async function fetchJson(path, query = '') {
  const q = query ? `?${query}` : '';
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json${q}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function putJson(path, data) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT ${path} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function patchJson(path, data) {
  const res = await fetch(`${FIREBASE_DB_URL}/${path}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PATCH ${path} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function run() {
  console.log('='.repeat(70));
  console.log('STARTING FIREBASE VAULT USER MIGRATION & REPAIR');
  console.log('='.repeat(70));

  // 1. Fetch current users and leagues
  console.log('\n[1/4] Fetching users and existing league datasets...');
  const users = await fetchJson('users') || {};
  const leaguesIndex = await fetchJson('leagues', 'shallow=true') || {};
  const leagueSlugs = Object.keys(leaguesIndex);

  console.log(`Found ${Object.keys(users).length} users in /users.`);
  console.log(`Found ${leagueSlugs.length} leagues: ${leagueSlugs.join(', ')}.`);

  // 2. Fetch existing claims for all leagues
  const leagueClaims = {};
  for (const slug of leagueSlugs) {
    leagueClaims[slug] = await fetchJson(`leagues/${slug}/claims`) || {};
  }

  // 3. Process and repair DMS claims
  console.log('\n[2/4] Repairing DMS Fantasy manager claims...');
  const dmsClaims = leagueClaims['dmsfantasy'] || {};

  // Find all users who claim or belong to DMS
  for (const [uid, u] of Object.entries(users)) {
    const dmsClaim = u.claims?.dmsfantasy;

    if (dmsClaim) {
      const mId = dmsClaim.managerId;
      if (mId) {
        const canonicalName = DMS_CANONICAL_NAMES[mId] || formatCapitalizedName(dmsClaim.managerName, dmsClaim.email);
        let email = dmsClaim.email || (dmsClaim.managerName?.includes('@') ? dmsClaim.managerName : null) || (u.email || null);
        if (!email && (uid === 'DinYpB2hx4Ul3RBsiHZxi0KHoQe2' || mId === 'landon')) email = 'landonekatz@gmail.com';
        if (!email && mId === 'madoc') email = 'madoc.watson@gmail.com';
        const favoriteTeam = u.favorite_team || dmsClaim.favorite_team || dmsClaims[mId]?.favorite_team || null;
        const claimedAt = dmsClaim.claimedAt || dmsClaims[mId]?.claimedAt || Date.now();

        dmsClaims[mId] = {
          userId: uid,
          email: email || '',
          name: canonicalName,
          managerId: mId,
          claimedAt: claimedAt
        };
        if (favoriteTeam) dmsClaims[mId].favorite_team = favoriteTeam;

        console.log(`  - Restored DMS claim: ${mId} -> ${canonicalName} (${email || 'no email'}) [UID: ${uid}]`);
      }
    }
  }

  // Save repaired claims to /leagues/dmsfantasy/claims
  await putJson('leagues/dmsfantasy/claims', dmsClaims);
  console.log(`Successfully saved ${Object.keys(dmsClaims).length} claims to /leagues/dmsfantasy/claims.`);

  // 4. Populate /leagues/{slug}/users for every league
  console.log('\n[3/4] Building /leagues/{leagueSlug}/users directory for all leagues...');
  const leagueUsersMap = {};
  for (const slug of leagueSlugs) {
    leagueUsersMap[slug] = {};
  }

  // Also track top-level user updates for /users/{uid}
  const userRootUpdates = {};

  for (const [uid, u] of Object.entries(users)) {
    const origUser = users[uid] || {};
    let userEmail = origUser.email || null;
    let userName = origUser.name || null;
    let userFavTeam = origUser.favorite_team || null;

    // Known overrides for accounts that didn't have email in claims
    if (uid === 'DinYpB2hx4Ul3RBsiHZxi0KHoQe2') {
      userEmail = 'landonekatz@gmail.com';
      userName = 'Landon Katz';
    } else if (uid === 'VpQmBJV63SPjqxa4kzGJn2W0TM12') {
      userEmail = 'seb.hammill@gmail.com';
      userName = 'Seb Hammill';
    } else if (uid === 'HLV9NmxxPzd1pEzv2Utd0h1bAMH2') {
      userEmail = 'madoc.watson@gmail.com';
      userName = 'Madoc Watson';
    }

    // Search claims for email and name if not at root
    if (origUser.claims) {
      for (const [slug, cData] of Object.entries(origUser.claims)) {
        if (!userEmail && cData.email) userEmail = cData.email;
        if (!userEmail && cData.managerName && cData.managerName.includes('@')) userEmail = cData.managerName;
        if (!userName && cData.name && !cData.name.includes('@')) userName = cData.name;
        if (!userFavTeam && cData.favorite_team) userFavTeam = cData.favorite_team;
      }
    }

    // Check league claims if still not found
    for (const [slug, claimsObj] of Object.entries(leagueClaims)) {
      for (const [mId, cData] of Object.entries(claimsObj || {})) {
        if (cData && cData.userId === uid) {
          if (!userEmail && cData.email) userEmail = cData.email;
          if (!userName && cData.name && !cData.name.includes('@')) userName = cData.name;
          if (!userFavTeam && cData.favorite_team) userFavTeam = cData.favorite_team;
        }
      }
    }

    if (!userName) {
      userName = formatCapitalizedName(null, userEmail);
    }

    // Prepare root user patch if missing email/name
    const rootPatch = {};
    if (userEmail && (!origUser.email || origUser.email !== userEmail)) rootPatch.email = userEmail;
    if (userName && (!origUser.name || origUser.name !== userName)) rootPatch.name = userName;
    if (userFavTeam && (!origUser.favorite_team || origUser.favorite_team !== userFavTeam)) rootPatch.favorite_team = userFavTeam;

    if (Object.keys(rootPatch).length > 0) {
      userRootUpdates[uid] = rootPatch;
    }

    // Determine all leagues this user belongs to
    const joinedSlugs = new Set();
    if (u.leagues) {
      Object.keys(u.leagues).forEach(s => joinedSlugs.add(s));
    }
    if (u.claims) {
      Object.keys(u.claims).forEach(s => joinedSlugs.add(s));
    }
    if (u.last_league) {
      joinedSlugs.add(u.last_league);
    }

    // Founder always belongs to dmsfantasy
    if (userEmail && userEmail.toLowerCase() === 'landonekatz@gmail.com') {
      joinedSlugs.add('dmsfantasy');
    }

    // Add user to each league's /users record
    for (const slug of joinedSlugs) {
      if (!leagueUsersMap[slug]) leagueUsersMap[slug] = {};

      const leagueInfo = u.leagues?.[slug] || {};
      const userClaim = u.claims?.[slug] || null;
      const leagueClaimMatch = Object.entries(dmsClaims).find(([_, c]) => c.userId === uid);

      const mId = userClaim?.managerId || (slug === 'dmsfantasy' && leagueClaimMatch ? leagueClaimMatch[0] : null);
      const mName = slug === 'dmsfantasy' && mId && DMS_CANONICAL_NAMES[mId]
        ? DMS_CANONICAL_NAMES[mId]
        : (userClaim?.managerName || (leagueClaimMatch ? leagueClaimMatch[1].name : null));

      let role = leagueInfo.role || 'member';
      if (userEmail && userEmail.toLowerCase() === 'landonekatz@gmail.com') {
        role = 'founder';
      }

      const joinedAt = leagueInfo.joinedAt || userClaim?.claimedAt || Date.now();

      leagueUsersMap[slug][uid] = {
        userId: uid,
        email: userEmail || '',
        name: userName,
        role: role,
        managerId: mId || null,
        managerName: mName || null,
        favorite_team: userFavTeam || null,
        joinedAt: joinedAt
      };
      if (userClaim?.claimedAt) {
        leagueUsersMap[slug][uid].claimedAt = userClaim.claimedAt;
      }
    }
  }

  // Push /leagues/{slug}/users for each league
  for (const [slug, usersObj] of Object.entries(leagueUsersMap)) {
    const userCount = Object.keys(usersObj).length;
    if (userCount > 0) {
      await putJson(`leagues/${slug}/users`, usersObj);
      console.log(`  - Saved ${userCount} users to /leagues/${slug}/users.`);
    }
  }

  // 5. Apply top-level updates to /users/{uid}
  console.log('\n[4/4] Updating top-level user profiles in /users...');
  let rootUpdatesCount = 0;
  for (const [uid, patch] of Object.entries(userRootUpdates)) {
    await patchJson(`users/${uid}`, patch);
    rootUpdatesCount++;
  }
  console.log(`Updated ${rootUpdatesCount} user profiles with root email/name/favorite_team.`);

  console.log('\n' + '='.repeat(70));
  console.log('MIGRATION & REPAIR COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(70));
}

run().catch(err => {
  console.error('\nError running migration:', err);
  process.exit(1);
});
