// The Fantasy Vault - Client-Side Auth Engine & Join Code System
import { auth, db, database } from './firebase.js';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref as dbRef, set as rtdbSet, get as rtdbGet } from "firebase/database";

const PERSONA_KEY = 'vault_active_persona';

// Registered League Join Codes (6-character uppercase alphanumeric)
const JOIN_CODES = {
  'DNFUAM': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy', managers: [] },
  '7AR345': { leagueId: 'gaywoodfantasyfootball', name: 'Gaywood Fantasy Football', path: '/gaywoodfantasyfootball', managers: [] },
  // Legacy aliases
  'D8M4S2': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy', managers: [] },
  'DMS202': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy', managers: [] },
  'DMSFANTASY': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy', managers: [] }
};

export const NFL_FRANCHISES = [
  { code: 'ARI', name: 'Arizona Cardinals' },
  { code: 'ATL', name: 'Atlanta Falcons' },
  { code: 'BAL', name: 'Baltimore Ravens' },
  { code: 'BUF', name: 'Buffalo Bills' },
  { code: 'CAR', name: 'Carolina Panthers' },
  { code: 'CHI', name: 'Chicago Bears' },
  { code: 'CIN', name: 'Cincinnati Bengals' },
  { code: 'CLE', name: 'Cleveland Browns' },
  { code: 'DAL', name: 'Dallas Cowboys' },
  { code: 'DEN', name: 'Denver Broncos' },
  { code: 'DET', name: 'Detroit Lions' },
  { code: 'GB',  name: 'Green Bay Packers' },
  { code: 'HOU', name: 'Houston Texans' },
  { code: 'IND', name: 'Indianapolis Colts' },
  { code: 'JAX', name: 'Jacksonville Jaguars' },
  { code: 'KC',  name: 'Kansas City Chiefs' },
  { code: 'LV',  name: 'Las Vegas Raiders' },
  { code: 'LAC', name: 'Los Angeles Chargers' },
  { code: 'LAR', name: 'Los Angeles Rams' },
  { code: 'MIA', name: 'Miami Dolphins' },
  { code: 'MIN', name: 'Minnesota Vikings' },
  { code: 'NE',  name: 'New England Patriots' },
  { code: 'NO',  name: 'New Orleans Saints' },
  { code: 'NYG', name: 'New York Giants' },
  { code: 'NYJ', name: 'New York Jets' },
  { code: 'PHI', name: 'Philadelphia Eagles' },
  { code: 'PIT', name: 'Pittsburgh Steelers' },
  { code: 'SF',  name: 'San Francisco 49ers' },
  { code: 'SEA', name: 'Seattle Seahawks' },
  { code: 'TB',  name: 'Tampa Bay Buccaneers' },
  { code: 'TEN', name: 'Tennessee Titans' },
  { code: 'WAS', name: 'Washington Commanders' }
];

export function renderNflTeamSelectOptions(selectedVal = '') {
  const norm = (selectedVal || '').trim().toUpperCase();
  return NFL_FRANCHISES.map(team => {
    const isSel = norm === team.code || norm === team.name.toUpperCase();
    return `<option value="${team.name}" data-code="${team.code}" ${isSel ? 'selected' : ''}>${team.name}</option>`;
  }).join('');
}

export function formatCapitalizedName(name, email) {
  if (email && email.toLowerCase() === 'landonekatz@gmail.com') return 'Landon Katz';
  if (name && typeof name === 'string' && name.trim()) {
    const trimmed = name.trim();
    if (trimmed.toLowerCase() === 'landon' || trimmed.toLowerCase() === 'landonekatz') return 'Landon';
    return trimmed.split(/\s+/).map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
  }
  if (email) {
    const prefix = email.split('@')[0];
    if (prefix.toLowerCase() === 'landonekatz' || prefix.toLowerCase() === 'landon') return 'Landon';
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return 'User';
}

// Session Management
let currentSession = null;
try {
  const cached = localStorage.getItem('vault_cached_session');
  if (cached) {
    currentSession = JSON.parse(cached);
    const isFounderSession = Boolean(currentSession.isFounder || (currentSession.email && currentSession.email.toLowerCase() === 'landonekatz@gmail.com'));
    if (isFounderSession) {
      currentSession.name = 'Landon Katz';
      currentSession.joinedLeagues = ['dmsfantasy'];
      currentSession.adminLeagues = ['dmsfantasy'];
      if (currentSession.claims && currentSession.claims['gaywoodfantasyfootball']) {
        delete currentSession.claims['gaywoodfantasyfootball'];
      }
      if (currentSession.allLeagues && Array.isArray(currentSession.allLeagues)) {
        currentSession.allLeagues.forEach(l => {
          if (l.slug && typeof AuthEngine.resolveLeaguePath === 'function') {
            l.path = AuthEngine.resolveLeaguePath(l.slug);
          }
        });
      }
    } else {
      if (currentSession.name) {
        currentSession.name = formatCapitalizedName(currentSession.name, currentSession.email);
      }
      if (currentSession.last_league === 'gaywoodfantasy') currentSession.last_league = 'gaywoodfantasyfootball';
    }
  }
} catch (e) {
  console.warn("Session cache read error:", e);
}

let authReadyResolve;
const authReadyPromise = new Promise((resolve) => {
  authReadyResolve = resolve;
  if (currentSession) {
    resolve(currentSession);
  }
});

const AuthEngine = {
  // Session Management
  getSession() {
    return currentSession;
  },

  ready() {
    if (currentSession) return Promise.resolve(currentSession);
    return authReadyPromise;
  },

  logout() {
    try {
      localStorage.removeItem(PERSONA_KEY);
      localStorage.removeItem('vault_cached_session');
    } catch (e) {}
    currentSession = null;
    signOut(auth).catch(() => {});
    window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: null }));
    window.location.href = '/';
  },

  // Persona Management (Founder, Admin, Member, Public)
  getPersona() {
    return localStorage.getItem(PERSONA_KEY) || (this.isFounder() ? 'founder' : 'public');
  },

  setPersona(personaMode) {
    localStorage.setItem(PERSONA_KEY, personaMode);
    window.dispatchEvent(new CustomEvent('vault_persona_changed', { detail: personaMode }));
  },

  isFounder() {
    const session = this.getSession();
    return Boolean(session && (session.isFounder || (session.email && session.email.toLowerCase() === 'landonekatz@gmail.com')));
  },

  async fetchAllVaultLeagues() {
    if (this._allLeaguesCache && this._allLeaguesCache.length > 0) {
      return this._allLeaguesCache;
    }
    try {
      const res = await fetch('https://fantasy-vault-4f8da-default-rtdb.firebaseio.com/leagues.json?shallow=true');
      if (!res.ok) throw new Error("Could not fetch leagues index");
      const keysObj = await res.json();
      const keys = Object.keys(keysObj || {});

      // Ensure standard known leagues exist in the list
      if (!keys.includes('dmsfantasy')) keys.push('dmsfantasy');
      if (!keys.includes('gaywoodfantasyfootball')) keys.push('gaywoodfantasyfootball');

      const leagues = await Promise.all(keys.map(async slug => {
        let defaultInfo = {
          slug,
          name: slug.charAt(0).toUpperCase() + slug.slice(1) + ' League',
          path: this.resolveLeaguePath(slug),
          platform: 'espn',
          isPrivate: false,
          totalSeasons: null
        };

        if (slug === 'dmsfantasy') {
          defaultInfo.name = 'The Dumbarton League';
          defaultInfo.platform = 'yahoo';
          defaultInfo.isPrivate = true;
        } else if (slug === 'gaywoodfantasyfootball') {
          defaultInfo.slug = 'gaywoodfantasyfootball';
          defaultInfo.name = 'Gaywood Fantasy Football';
          defaultInfo.path = '/gaywoodfantasyfootball';
          defaultInfo.platform = 'espn';
          defaultInfo.isPrivate = false;
        }

        try {
          const sRes = await fetch(`https://fantasy-vault-4f8da-default-rtdb.firebaseio.com/leagues/${slug}/league_settings.json`);
          if (sRes.ok) {
            const s = await sRes.json();
            if (s) {
              return {
                slug,
                name: s.name || defaultInfo.name,
                path: this.resolveLeaguePath(slug),
                platform: s.platform || defaultInfo.platform,
                isPrivate: Boolean(s.is_private),
                totalSeasons: s.totalSeasons || s.total_seasons || null,
                adminEmail: s.admin_email || null,
                joinCode: s.join_code || null
              };
            }
          }
        } catch (e) {}

        return defaultInfo;
      }));

      // Deduplicate by slug
      const uniqueMap = new Map();
      leagues.forEach(l => {
        if (!uniqueMap.has(l.slug)) uniqueMap.set(l.slug, l);
      });
      const uniqueLeagues = Array.from(uniqueMap.values());

      this._allLeaguesCache = uniqueLeagues;
      return uniqueLeagues;
    } catch (err) {
      console.warn("Error fetching all vault leagues:", err);
      return [
        { slug: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy/', platform: 'yahoo', isPrivate: true },
        { slug: 'gaywoodfantasyfootball', name: 'Gaywood Fantasy Football', path: '/gaywoodfantasyfootball', platform: 'espn', isPrivate: false }
      ];
    }
  },

  resolveLeaguePath(slug) {
    if (!slug) return '/';
    const cleanSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanSlug === 'dmsfantasy') return '/dmsfantasy/';
    if (cleanSlug === 'gaywoodfantasy' || cleanSlug === 'gaywoodfantasyfootball') return '/gaywoodfantasyfootball';
    return `/${cleanSlug}`;
  },

  async recordActiveLeague(leagueSlug) {
    if (!leagueSlug) return;
    const cleanSlug = String(leagueSlug).trim().toLowerCase();
    try {
      localStorage.setItem('vault_last_league', cleanSlug);
    } catch (e) {}

    const session = this.getSession();
    if (session) {
      session.last_league = cleanSlug;
      if (currentSession) currentSession.last_league = cleanSlug;
      try {
        localStorage.setItem('vault_cached_session', JSON.stringify(session));
      } catch (e) {}

      if (database && session.uid) {
        try {
          const userLastLeagueRef = dbRef(database, `users/${session.uid}/last_league`);
          await rtdbSet(userLastLeagueRef, cleanSlug);
          const userLastActiveRef = dbRef(database, `users/${session.uid}/last_active_at`);
          await rtdbSet(userLastActiveRef, Date.now());
        } catch (dbErr) {
          console.warn("Could not save last_league to database:", dbErr);
        }
      }
    }
  },

  // Authentication Actions
  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      console.error("Google Auth Error", error);
      throw error;
    }
  },

  async loginWithEmail(email, password) {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        // Auto-signup if not found
        try {
          const newResult = await createUserWithEmailAndPassword(auth, email, password);
          return newResult.user;
        } catch (signupError) {
          console.error("Signup Error", signupError);
          if (signupError.code === 'auth/operation-not-allowed' || signupError.code === 'auth/admin-restricted-operation') {
            throw new Error("Email/Password sign-in is disabled in Firebase. Enable 'Email/Password' in Firebase Console (Authentication > Sign-in method).");
          }
          if (signupError.code === 'auth/weak-password') {
            throw new Error("Password should be at least 6 characters.");
          }
          throw signupError;
        }
      }
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        throw new Error("Email/Password sign-in is disabled in Firebase. Enable 'Email/Password' in Firebase Console (Authentication > Sign-in method).");
      }
      if (error.code === 'auth/wrong-password') {
        throw new Error("Incorrect password. Please try again.");
      }
      console.error("Email Auth Error", error);
      throw error;
    }
  },

  async registerWithEmail(email, password) {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return result.user;
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') {
        return this.loginWithEmail(email, password);
      }
      if (error.code === 'auth/operation-not-allowed' || error.code === 'auth/admin-restricted-operation') {
        throw new Error("Email/Password sign-in is disabled in Firebase. Enable 'Email/Password' in Firebase Console (Authentication > Sign-in method).");
      }
      if (error.code === 'auth/weak-password') {
        throw new Error("Password should be at least 6 characters.");
      }
      console.error("Signup Error", error);
      throw error;
    }
  },

  // 6-Character Join Code Processing (Validation & Lookup)
  async resolveJoinCode(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: "Please enter a 6-character Join Code." };
    }

    let league = null;

    if (JOIN_CODES[cleanCode]) {
      league = { ...JOIN_CODES[cleanCode] };
    } else if (window.app && window.app.leagueSlug) {
      const appCode = (window.app.leagueSettings?.join_code || '').toUpperCase();
      if (cleanCode === appCode || cleanCode === window.app.leagueSlug.toUpperCase()) {
        league = {
          leagueId: window.app.leagueSlug,
          name: window.app.leagueSettings?.name || 'Fantasy Football League',
          path: this.resolveLeaguePath(window.app.leagueSlug),
          managers: window.app.members || window.app.managers || []
        };
      }
    }

    // Check Firebase Realtime Database leagues if not matched yet
    if (!league && database) {
      try {
        const leaguesSnap = await rtdbGet(dbRef(database, 'leagues'));
        if (leaguesSnap.exists()) {
          const allLeagues = leaguesSnap.val();
          for (const [slug, lData] of Object.entries(allLeagues)) {
            const lCode = (lData?.league_settings?.join_code || '').toUpperCase();
            if (cleanCode === lCode || cleanCode === slug.toUpperCase()) {
              league = {
                leagueId: slug,
                name: lData?.league_settings?.name || `${slug} Vault`,
                path: this.resolveLeaguePath(slug),
                managers: lData?.members || lData?.managers || []
              };
              break;
            }
          }
        }
      } catch (e) {
        console.warn("Database join code lookup warning:", e);
      }
    }

    if (!league) {
      return { success: false, message: `Invalid code "${cleanCode}". Please check your 6-character Join Code.` };
    }

    // Ensure path is standardized
    league.path = this.resolveLeaguePath(league.leagueId);

    // If managers array is empty, fetch manager datasets
    if (!league.managers || league.managers.length === 0) {
      if (window.app && (window.app.leagueSlug === league.leagueId || (league.leagueId === 'dmsfantasy' && window.location.pathname.includes('dmsfantasy')) || (league.leagueId === 'gaywoodfantasyfootball' && window.location.pathname.includes('gaywoodfantasyfootball')))) {
        league.managers = window.app.members || window.app.managers || [];
      }
      
      if (!league.managers || league.managers.length === 0) {
        if (database) {
          try {
            const memSnap = await rtdbGet(dbRef(database, `leagues/${league.leagueId}/members`));
            if (memSnap.exists()) {
              league.managers = memSnap.val() || [];
            } else {
              const mgrSnap = await rtdbGet(dbRef(database, `leagues/${league.leagueId}/managers`));
              if (mgrSnap.exists()) league.managers = mgrSnap.val() || [];
            }
          } catch (e) {}
        }
        if ((!league.managers || league.managers.length === 0) && league.leagueId === 'dmsfantasy') {
          try {
            const resp = await fetch('/dmsfantasy/data/managers.json');
            if (resp.ok) {
              const d = await resp.json();
              league.managers = d.managers || [];
            }
          } catch (e) {}
        }
      }
    }

    // Always fetch existing claims from RTDB so caller knows who is available
    if (database) {
      try {
        const claimsSnap = await rtdbGet(dbRef(database, `leagues/${league.leagueId}/claims`));
        if (claimsSnap.exists()) {
          league.claims = claimsSnap.val() || {};
        } else {
          league.claims = {};
        }
      } catch (e) {
        league.claims = {};
      }
    }

    JOIN_CODES[cleanCode] = league;
    return { success: true, league };
  },

  processJoinCode(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (JOIN_CODES[cleanCode]) {
      const league = { ...JOIN_CODES[cleanCode] };
      if (window.app && window.app.leagueSlug === league.leagueId) {
        league.managers = window.app.members || window.app.managers || league.managers;
      }
      league.path = this.resolveLeaguePath(league.leagueId);
      return { success: true, league };
    }

    // Check dynamic active app instance if present
    if (window.app && window.app.leagueSlug) {
      const appCode = (window.app.leagueSettings?.join_code || '').toUpperCase();
      if (cleanCode && (cleanCode === appCode || cleanCode === window.app.leagueSlug.toUpperCase())) {
        const info = {
          leagueId: window.app.leagueSlug,
          name: window.app.leagueSettings?.name || 'Fantasy Football League',
          path: this.resolveLeaguePath(window.app.leagueSlug),
          managers: window.app.members || window.app.managers || []
        };
        JOIN_CODES[cleanCode] = info;
        return { success: true, league: info };
      }
    }

    return { success: false, message: `Invalid code "${cleanCode}". Please check your 6-character Join Code.` };
  },

  async finalizeJoin(code, managerId, favoriteTeam = null) {
    const cleanCode = (code || '').trim().toUpperCase();
    let info = JOIN_CODES[cleanCode];
    if (!info || !info.managers || info.managers.length === 0) {
      const check = await this.resolveJoinCode(code);
      if (check.success) info = check.league;
    }
    if (!info) return { success: false, message: "Invalid code" };
    
    const session = this.getSession();
    if (!session) return { success: false, message: "Not signed in" };

    try {
      await this.linkUserLeague(info.leagueId, 'member', info.name);
      if (managerId && managerId !== 'unknown' && managerId !== 'guest') {
        await this.claimManagerProfile(info.leagueId, managerId, session.email, favoriteTeam);
      }
      await this.recordActiveLeague(info.leagueId);
      window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: session }));
      return { success: true, league: info };
    } catch (e) {
      console.error("Finalize join error", e);
      return { success: false, message: "Failed to join league." };
    }
  },

  async claimManagerProfile(leagueId, managerId, managerName, favoriteTeam = null) {
    const session = this.getSession();
    if (!session) return { success: false, message: "Not signed in" };
    if (!database) return { success: false, message: "Database not connected" };

    try {
      const cleanManagerName = formatCapitalizedName(managerName || session.name, session.email);
      const teamValue = (favoriteTeam || session.favorite_team || '').trim();

      const claimData = {
        userId: session.uid,
        email: session.email,
        name: cleanManagerName,
        claimedAt: Date.now()
      };
      if (teamValue) claimData.favorite_team = teamValue;

      const claimRef = dbRef(database, `leagues/${leagueId}/claims/${managerId}`);
      await rtdbSet(claimRef, claimData);

      // Also update /leagues/{leagueId}/users/{session.uid} directory
      const leagueUserRef = dbRef(database, `leagues/${leagueId}/users/${session.uid}`);
      const leagueUserData = {
        userId: session.uid,
        email: session.email || '',
        name: cleanManagerName,
        managerId: managerId,
        managerName: cleanManagerName,
        role: session.isFounder ? 'founder' : (session.adminLeagues?.includes(leagueId) ? 'admin' : 'member'),
        claimedAt: Date.now()
      };
      if (teamValue) leagueUserData.favorite_team = teamValue;
      await rtdbSet(leagueUserRef, leagueUserData);

      // Ensure root user email and name are populated in /users/{session.uid}
      if (session.email) {
        await rtdbSet(dbRef(database, `users/${session.uid}/email`), session.email);
      }
      if (cleanManagerName) {
        await rtdbSet(dbRef(database, `users/${session.uid}/name`), cleanManagerName);
      }

      const userClaimData = {
        managerId: managerId,
        managerName: cleanManagerName,
        claimedAt: Date.now()
      };
      if (teamValue) userClaimData.favorite_team = teamValue;

      const userClaimRef = dbRef(database, `users/${session.uid}/claims/${leagueId}`);
      await rtdbSet(userClaimRef, userClaimData);

      if (teamValue) {
        const userFavRef = dbRef(database, `users/${session.uid}/favorite_team`);
        await rtdbSet(userFavRef, teamValue);
        session.favorite_team = teamValue;
        if (currentSession) currentSession.favorite_team = teamValue;
      }

      if (!session.claims) session.claims = {};
      session.claims[leagueId] = managerId;
      if (currentSession) {
        if (!currentSession.claims) currentSession.claims = {};
        currentSession.claims[leagueId] = managerId;
      }

      try {
        localStorage.setItem('vault_cached_session', JSON.stringify(session));
        localStorage.setItem(`vault_claim_${leagueId}`, managerId);
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: session }));
      return { success: true };
    } catch (e) {
      console.error("Claim profile error:", e);
      return { success: false, message: "Failed to claim profile in database." };
    }
  },

  async saveFavoriteTeam(favoriteTeam) {
    const session = this.getSession();
    if (!session || !session.uid) return { success: false, message: "Not signed in" };
    const teamValue = (favoriteTeam || '').trim();
    if (!teamValue) return { success: false, message: "Please select an NFL franchise." };

    try {
      if (database) {
        // 1. Direct write to user's root profile in RTDB
        const userFavRef = dbRef(database, `users/${session.uid}/favorite_team`);
        await rtdbSet(userFavRef, teamValue);

        // 2. Cascade across any claims associated with this user
        const userClaimsSnap = await rtdbGet(dbRef(database, `users/${session.uid}/claims`));
        if (userClaimsSnap.exists()) {
          const claims = userClaimsSnap.val();
          for (const [leagueId, cData] of Object.entries(claims)) {
            const mId = typeof cData === 'object' && cData !== null ? (cData.managerId || cData.id) : cData;
            if (mId) {
              try {
                await rtdbSet(dbRef(database, `users/${session.uid}/claims/${leagueId}/favorite_team`), teamValue);
              } catch (e) {}
              try {
                const claimSnap = await rtdbGet(dbRef(database, `leagues/${leagueId}/claims/${mId}`));
                if (claimSnap.exists()) {
                  await rtdbSet(dbRef(database, `leagues/${leagueId}/claims/${mId}/favorite_team`), teamValue);
                } else {
                  // If claim was missing in the league, restore the full claim object so it never lacks email/userId
                  await rtdbSet(dbRef(database, `leagues/${leagueId}/claims/${mId}`), {
                    userId: session.uid,
                    email: session.email || '',
                    name: formatCapitalizedName(session.name, session.email),
                    managerId: mId,
                    favorite_team: teamValue,
                    claimedAt: Date.now()
                  });
                }
              } catch (e) {}
              try {
                await rtdbSet(dbRef(database, `leagues/${leagueId}/users/${session.uid}/favorite_team`), teamValue);
              } catch (e) {}
            }
          }
        }
      }

      // 3. Update Firestore user document if available
      try {
        if (db) {
          const userRef = doc(db, 'users', session.uid);
          await setDoc(userRef, { favorite_team: teamValue }, { merge: true });
        }
      } catch (fsErr) {
        console.warn("Firestore favorite_team sync error:", fsErr);
      }

      // 4. Update memory session & localStorage cache
      session.favorite_team = teamValue;
      if (currentSession) currentSession.favorite_team = teamValue;
      try {
        localStorage.setItem('vault_cached_session', JSON.stringify(session));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: session }));
      return { success: true, favoriteTeam: teamValue };
    } catch (err) {
      console.error("Save favorite team error:", err);
      return { success: false, message: err.message };
    }
  },

  async linkUserLeague(leagueSlug, role = 'member', leagueName = '') {
    const session = this.getSession();
    if (!session) return { success: false, message: "Not signed in" };

    const userRef = doc(db, 'users', session.uid);
    const fieldToUpdate = role === 'admin' ? 'adminLeagues' : 'joinedLeagues';
    
    try {
      await updateDoc(userRef, {
        [fieldToUpdate]: arrayUnion(leagueSlug)
      });
    } catch (e) {
      await setDoc(userRef, {
        email: session.email,
        name: session.name,
        [fieldToUpdate]: [leagueSlug]
      }, { merge: true });
    }

    if (database) {
      try {
        const userLeaguesRef = dbRef(database, `users/${session.uid}/leagues/${leagueSlug}`);
        await rtdbSet(userLeaguesRef, {
          role: role,
          name: leagueName || leagueSlug,
          joinedAt: Date.now()
        });

        const leagueUserRef = dbRef(database, `leagues/${leagueSlug}/users/${session.uid}`);
        const existingLeagueUserSnap = await rtdbGet(leagueUserRef);
        const existingLeagueUser = existingLeagueUserSnap.exists() ? existingLeagueUserSnap.val() : {};
        await rtdbSet(leagueUserRef, {
          ...existingLeagueUser,
          userId: session.uid,
          email: session.email || existingLeagueUser.email || '',
          name: session.name || existingLeagueUser.name || formatCapitalizedName(null, session.email),
          role: role,
          joinedAt: existingLeagueUser.joinedAt || Date.now()
        });

        if (session.email) {
          await rtdbSet(dbRef(database, `users/${session.uid}/email`), session.email);
        }
        if (session.name) {
          await rtdbSet(dbRef(database, `users/${session.uid}/name`), session.name);
        }
      } catch (rtdbErr) {
        console.warn("RTDB league registration warning:", rtdbErr);
      }
    }

    if (!session.joinedLeagues.includes(leagueSlug)) {
      session.joinedLeagues.push(leagueSlug);
    }
    if (role === 'admin' && !session.adminLeagues.includes(leagueSlug)) {
      session.adminLeagues.push(leagueSlug);
    }
    if (leagueName) {
      if (!session.leagueDetails) session.leagueDetails = {};
      session.leagueDetails[leagueSlug] = { name: leagueName, path: `/${leagueSlug}/` };
      try {
        localStorage.setItem(`vault_league_name_${leagueSlug}`, leagueName);
      } catch(e){}
    }

    try {
      localStorage.setItem('vault_cached_session', JSON.stringify(session));
    } catch (e) {}

    window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: session }));
    return { success: true };
  },

  async joinAsGuest(leagueSlug) {
    const session = this.getSession();
    if (!session) return { success: false, message: "Not signed in" };
    const cleanSlug = leagueSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanSlug) return { success: false, message: "Invalid league identifier" };

    try {
      await this.linkUserLeague(cleanSlug, 'guest', '');
      await this.recordActiveLeague(cleanSlug);
      window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: session }));
      return { success: true };
    } catch (e) {
      console.error("Guest join error", e);
      return { success: false, message: "Failed to join as guest." };
    }
  },

  generateAdminTransferLink(leagueSlug) {
    const origin = window.location.origin;
    return `${origin}/${leagueSlug}/?action=transfer_admin&league=${leagueSlug}`;
  },

  generateManagerClaimLink(leagueSlug, managerId) {
    const origin = window.location.origin;
    return `${origin}/${leagueSlug}/?action=claim_manager&manager=${managerId}`;
  },

  generateGeneralInviteLink(leagueSlug, joinCode) {
    const origin = window.location.origin;
    const code = joinCode || (window.app?.leagueSettings?.join_code || 'INVITE').toUpperCase();
    return `${origin}/${leagueSlug}/?join=${code}`;
  },

  async transferAdminRole(leagueSlug, targetEmail) {
    const cleanEmail = (targetEmail || '').trim().toLowerCase();
    const cleanSlug = (leagueSlug || '').trim();
    if (!cleanEmail || !cleanSlug) {
      return { success: false, message: "Missing email or league slug." };
    }

    const session = this.getSession();
    if (!session) {
      return { success: false, message: "You must be signed in to transfer admin status." };
    }

    const isCurrentAdmin = Boolean(
      session.isFounder || 
      (session.adminLeagues && session.adminLeagues.includes(cleanSlug))
    );

    if (!isCurrentAdmin) {
      return { success: false, message: "Only the current commissioner or founder can transfer admin privileges." };
    }

    try {
      if (database) {
        const leagueSettingsRef = dbRef(database, `leagues/${cleanSlug}/league_settings/admin_email`);
        await rtdbSet(leagueSettingsRef, cleanEmail);
      }

      const userRef = doc(db, 'users', session.uid);
      if (session.adminLeagues && !session.isFounder) {
        const updatedAdmin = session.adminLeagues.filter(s => s !== cleanSlug);
        session.adminLeagues = updatedAdmin;
        await setDoc(userRef, { adminLeagues: updatedAdmin }, { merge: true });
      }

      try {
        localStorage.setItem('vault_cached_session', JSON.stringify(session));
      } catch (e) {}

      window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: session }));
      return { success: true, message: `Admin status for ${cleanSlug} successfully transferred to ${cleanEmail}.` };
    } catch (err) {
      console.error("Admin transfer error:", err);
      return { success: false, message: "Failed to transfer admin status: " + err.message };
    }
  }
};

// Set up listener for real-time auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const isFounder = (user.email || '').toLowerCase() === 'landonekatz@gmail.com';
    let joinedLeagues = isFounder ? ['dmsfantasy'] : (currentSession?.joinedLeagues || []);
    let adminLeagues = isFounder ? ['dmsfantasy'] : (currentSession?.adminLeagues || []);
    let leagueDetails = currentSession?.leagueDetails || {
      'dmsfantasy': { name: 'The Dumbarton League', path: '/dmsfantasy/' }
    };
    let claims = currentSession?.claims || {};
    try {
      ['dmsfantasy'].forEach(slug => {
        const stored = localStorage.getItem(`vault_claim_${slug}`);
        if (stored && !claims[slug]) claims[slug] = stored;
      });
    } catch (e) {}

    let lastLeague = currentSession?.last_league || localStorage.getItem('vault_last_league') || (isFounder ? 'dmsfantasy' : null);
    let initialFavTeam = currentSession?.favorite_team || '';
    
    currentSession = {
      uid: user.uid,
      email: user.email,
      name: formatCapitalizedName(currentSession?.name || user.displayName, user.email),
      isFounder: isFounder,
      joinedLeagues: joinedLeagues,
      adminLeagues: isFounder ? ['dmsfantasy', ...adminLeagues] : adminLeagues,
      leagueDetails: leagueDetails,
      claims: claims,
      favorite_team: initialFavTeam,
      last_league: lastLeague
    };

    try {
      localStorage.setItem('vault_cached_session', JSON.stringify(currentSession));
    } catch (e) {}
    AuthEngine.setPersona(currentSession.isFounder ? 'founder' : 'member');
    
    authReadyResolve(currentSession);
    window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: currentSession }));

    // Run background Firestore and RTDB league discovery without blocking UI
    (async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        let userDoc = await getDoc(userRef);
        let userData = {};
        
        if (!userDoc.exists()) {
          userData = {
            email: user.email,
            name: formatCapitalizedName(user.displayName, user.email),
            joinedLeagues: joinedLeagues,
            adminLeagues: adminLeagues,
            last_league: lastLeague
          };
          await setDoc(userRef, userData);
        } else {
          userData = userDoc.data();
          if (userData.last_league) lastLeague = userData.last_league;
        }
        
        if (Array.isArray(userData.joinedLeagues)) {
          userData.joinedLeagues.forEach(l => { if (!joinedLeagues.includes(l)) joinedLeagues.push(l); });
        }
        if (Array.isArray(userData.adminLeagues)) {
          userData.adminLeagues.forEach(l => { if (!adminLeagues.includes(l)) adminLeagues.push(l); });
        }

        if (database) {
          // Check user's RTDB root profile
          const userRootSnap = await rtdbGet(dbRef(database, `users/${user.uid}`));
          if (userRootSnap.exists()) {
            const uRoot = userRootSnap.val();
            if (uRoot.last_league) lastLeague = uRoot.last_league;
          }

          // Check user's RTDB registered leagues
          const userLeaguesSnap = await rtdbGet(dbRef(database, `users/${user.uid}/leagues`));
          if (userLeaguesSnap.exists()) {
            const userLeagues = userLeaguesSnap.val();
            Object.keys(userLeagues).forEach(slug => {
              if (!joinedLeagues.includes(slug)) joinedLeagues.push(slug);
              if (userLeagues[slug]?.role === 'admin' && !adminLeagues.includes(slug)) {
                adminLeagues.push(slug);
              }
              if (userLeagues[slug]?.name) {
                leagueDetails[slug] = { name: userLeagues[slug].name, path: `/${slug}/` };
                try { localStorage.setItem(`vault_league_name_${slug}`, userLeagues[slug].name); } catch(e){}
              }
            });
          }

          // Check user's RTDB claimed profiles
          const userClaimsSnap = await rtdbGet(dbRef(database, `users/${user.uid}/claims`));
          if (userClaimsSnap.exists()) {
            const rtdbClaims = userClaimsSnap.val();
            Object.entries(rtdbClaims).forEach(([slug, cData]) => {
              const mId = typeof cData === 'object' && cData !== null ? (cData.managerId || cData.id) : cData;
              if (mId) {
                claims[slug] = mId;
                try { localStorage.setItem(`vault_claim_${slug}`, mId); } catch(e){}
              }
            });
          }
          // Check user's favorite NFL team
          let favoriteTeam = currentSession?.favorite_team || '';
          const userFavSnap = await rtdbGet(dbRef(database, `users/${user.uid}/favorite_team`));
          if (userFavSnap.exists()) {
            favoriteTeam = userFavSnap.val() || '';
          } else if (!favoriteTeam && userClaimsSnap.exists()) {
            // Auto-migrate favorite team if recorded in a claimed profile
            const rtdbClaims = userClaimsSnap.val();
            for (const cData of Object.values(rtdbClaims)) {
              if (typeof cData === 'object' && cData?.favorite_team) {
                favoriteTeam = cData.favorite_team;
                try {
                  await rtdbSet(dbRef(database, `users/${user.uid}/favorite_team`), favoriteTeam);
                } catch (e) {}
                break;
              }
            }
          }

          // Self-heal claims and league user directory entries in RTDB
          const cleanUserName = formatCapitalizedName(userData.name || user.displayName, user.email);
          if (user.email) {
            try { await rtdbSet(dbRef(database, `users/${user.uid}/email`), user.email); } catch (e) {}
          }
          if (cleanUserName) {
            try { await rtdbSet(dbRef(database, `users/${user.uid}/name`), cleanUserName); } catch (e) {}
          }

          if (userClaimsSnap.exists()) {
            const rtdbClaims = userClaimsSnap.val();
            for (const [slug, cData] of Object.entries(rtdbClaims)) {
              const mId = typeof cData === 'object' && cData !== null ? (cData.managerId || cData.id) : cData;
              if (mId) {
                try {
                  const leagueClaimSnap = await rtdbGet(dbRef(database, `leagues/${slug}/claims/${mId}`));
                  const existingClaim = leagueClaimSnap.exists() ? leagueClaimSnap.val() : null;
                  if (!existingClaim || !existingClaim.email || !existingClaim.userId) {
                    await rtdbSet(dbRef(database, `leagues/${slug}/claims/${mId}`), {
                      userId: user.uid,
                      email: user.email || existingClaim?.email || '',
                      name: cleanUserName,
                      managerId: mId,
                      favorite_team: favoriteTeam || existingClaim?.favorite_team || '',
                      claimedAt: cData.claimedAt || existingClaim?.claimedAt || Date.now()
                    });
                  }

                  // Also ensure league users directory has complete info
                  const leagueUserSnap = await rtdbGet(dbRef(database, `leagues/${slug}/users/${user.uid}`));
                  const existingUser = leagueUserSnap.exists() ? leagueUserSnap.val() : null;
                  if (!existingUser || !existingUser.email || !existingUser.managerId) {
                    await rtdbSet(dbRef(database, `leagues/${slug}/users/${user.uid}`), {
                      userId: user.uid,
                      email: user.email || existingUser?.email || '',
                      name: cleanUserName,
                      role: isFounder ? 'founder' : (adminLeagues.includes(slug) ? 'admin' : 'member'),
                      managerId: mId,
                      managerName: cleanUserName,
                      favorite_team: favoriteTeam || existingUser?.favorite_team || '',
                      joinedAt: existingUser?.joinedAt || cData.claimedAt || Date.now(),
                      claimedAt: cData.claimedAt || Date.now()
                    });
                  }
                } catch (healErr) {
                  console.warn(`Self-heal claim error for ${slug}/${mId}:`, healErr);
                }
              }
            }
          }

          let allLeagues = currentSession?.allLeagues || [];
          if (!allLeagues || allLeagues.length === 0) {
            try {
              allLeagues = await AuthEngine.fetchAllVaultLeagues();
            } catch (e) {
              allLeagues = [];
            }
          }

          currentSession = {
            uid: user.uid,
            email: user.email,
            name: cleanUserName,
            isFounder: isFounder,
            joinedLeagues: isFounder ? ['dmsfantasy'] : joinedLeagues,
            adminLeagues: isFounder ? ['dmsfantasy'] : adminLeagues,
            leagueDetails: leagueDetails,
            claims: claims,
            favorite_team: favoriteTeam,
            last_league: lastLeague,
            allLeagues: allLeagues
          };
        }
        try {
          localStorage.setItem('vault_cached_session', JSON.stringify(currentSession));
          if (lastLeague) localStorage.setItem('vault_last_league', lastLeague);
        } catch (e) {}
        window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: currentSession }));
      } catch (bgErr) {
        console.warn("Background auth sync warning:", bgErr);
      }
    })();
  } else {
    currentSession = null;
    try {
      localStorage.removeItem('vault_cached_session');
    } catch (e) {}
    AuthEngine.setPersona('public');
    authReadyResolve(null);
    window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: null }));
  }
});

window.AuthEngine = AuthEngine;
window.JOIN_CODES = JOIN_CODES;
window.NFL_FRANCHISES = NFL_FRANCHISES;
window.renderNflTeamSelectOptions = renderNflTeamSelectOptions;

// Instantly notify listeners if we had a synchronously cached session
if (currentSession) {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: currentSession }));
  }, 0);
}

