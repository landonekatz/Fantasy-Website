// The Fantasy Vault, as Client-Side Auth Engine & Join Code System
import { auth, db, database } from './firebase.js';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref as dbRef, set as rtdbSet, get as rtdbGet } from "firebase/database";

const PERSONA_KEY = 'vault_active_persona';

// Registered League Join Codes (6-character uppercase alphanumeric)
const JOIN_CODES = {
  'DNFUAM': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy', managers: [] },
  'Y6CW7J': { leagueId: 'gaywoodfantasy', name: 'Gaywood / Katz League', path: '/gaywoodfantasy', managers: [] },
  // Legacy aliases
  'D8M4S2': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy', managers: [] },
  'DMS202': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy', managers: [] },
  'DMSFANTASY': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy', managers: [] },
  'K9Z15A': { leagueId: 'gaywoodfantasy', name: 'Gaywood / Katz League', path: '/gaywoodfantasy', managers: [] },
  'KATZ15': { leagueId: 'gaywoodfantasy', name: 'Gaywood / Katz League', path: '/gaywoodfantasy', managers: [] },
  'GAYWOODFANTASY': { leagueId: 'gaywoodfantasy', name: 'Gaywood / Katz League', path: '/gaywoodfantasy', managers: [] }
};

// Session Management
let currentSession = null;
try {
  const cached = localStorage.getItem('vault_cached_session');
  if (cached) {
    currentSession = JSON.parse(cached);
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
    return session && session.email === 'landonekatz@gmail.com';
  },

  resolveLeaguePath(slug) {
    if (!slug) return '/';
    const cleanSlug = String(slug).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (cleanSlug === 'dmsfantasy') return '/dmsfantasy/';
    if (cleanSlug === 'gaywoodfantasy') return '/gaywoodfantasy/';
    return `/vault.html?league=${encodeURIComponent(cleanSlug)}`;
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
          throw signupError;
        }
      }
      console.error("Email Auth Error", error);
      throw error;
    }
  },

  // 6-Character Join Code Processing (Validation & Lookup)
  async resolveJoinCode(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) {
      return { success: false, message: "Please enter a 6-character Join Code." };
    }

    if (JOIN_CODES[cleanCode]) {
      const league = { ...JOIN_CODES[cleanCode] };
      if (window.app && window.app.leagueSlug === league.leagueId) {
        league.managers = window.app.members || window.app.managers || league.managers;
      }
      return { success: true, league };
    }

    // Check dynamic active app instance
    if (window.app && window.app.leagueSlug) {
      const appCode = (window.app.leagueSettings?.join_code || '').toUpperCase();
      if (cleanCode === appCode || cleanCode === window.app.leagueSlug.toUpperCase()) {
        const info = {
          leagueId: window.app.leagueSlug,
          name: window.app.leagueSettings?.name || 'Fantasy Football League',
          path: `/${window.app.leagueSlug}`,
          managers: window.app.members || window.app.managers || []
        };
        JOIN_CODES[cleanCode] = info;
        return { success: true, league: info };
      }
    }

    // Check Firebase Realtime Database leagues
    if (database) {
      try {
        const leaguesSnap = await rtdbGet(dbRef(database, 'leagues'));
        if (leaguesSnap.exists()) {
          const allLeagues = leaguesSnap.val();
          for (const [slug, lData] of Object.entries(allLeagues)) {
            const lCode = (lData?.league_settings?.join_code || '').toUpperCase();
            if (cleanCode === lCode || cleanCode === slug.toUpperCase()) {
              const info = {
                leagueId: slug,
                name: lData?.league_settings?.name || `${slug} Vault`,
                path: `/${slug}`,
                managers: lData?.members || lData?.managers || []
              };
              JOIN_CODES[cleanCode] = info;
              return { success: true, league: info };
            }
          }
        }
      } catch (e) {
        console.warn("Database join code lookup warning:", e);
      }
    }

    return { success: false, message: `Invalid code "${cleanCode}". Please check your 6-character Join Code.` };
  },

  processJoinCode(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (JOIN_CODES[cleanCode]) {
      const league = { ...JOIN_CODES[cleanCode] };
      if (window.app && window.app.leagueSlug === league.leagueId) {
        league.managers = window.app.members || window.app.managers || league.managers;
      }
      return { success: true, league };
    }

    // Check dynamic active app instance if present
    if (window.app && window.app.leagueSlug) {
      const appCode = (window.app.leagueSettings?.join_code || '').toUpperCase();
      if (cleanCode && (cleanCode === appCode || cleanCode === window.app.leagueSlug.toUpperCase())) {
        const info = {
          leagueId: window.app.leagueSlug,
          name: window.app.leagueSettings?.name || 'Fantasy Football League',
          path: `/${window.app.leagueSlug}`,
          managers: window.app.members || window.app.managers || []
        };
        JOIN_CODES[cleanCode] = info;
        return { success: true, league: info };
      }
    }

    return { success: false, message: `Invalid code "${cleanCode}". Please check your 6-character Join Code.` };
  },

  async finalizeJoin(code, managerId) {
    const cleanCode = (code || '').trim().toUpperCase();
    let info = JOIN_CODES[cleanCode];
    if (!info) {
      const check = await this.resolveJoinCode(code);
      if (check.success) info = check.league;
    }
    if (!info) return { success: false, message: "Invalid code" };
    
    const session = this.getSession();
    if (!session) return { success: false, message: "Not signed in" };

    try {
      await this.linkUserLeague(info.leagueId, 'member', info.name);
      await this.claimManagerProfile(info.leagueId, managerId, session.email);
      window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: session }));
      return { success: true, league: info };
    } catch (e) {
      console.error("Finalize join error", e);
      return { success: false, message: "Failed to join league." };
    }
  },

  async claimManagerProfile(leagueId, managerId, managerName) {
    const session = this.getSession();
    if (!session) return { success: false, message: "Not signed in" };
    if (!database) return { success: false, message: "Database not connected" };

    try {
      const claimRef = dbRef(database, `leagues/${leagueId}/claims/${managerId}`);
      await rtdbSet(claimRef, {
        userId: session.uid,
        email: session.email,
        name: managerName || session.name,
        claimedAt: Date.now()
      });

      const userClaimRef = dbRef(database, `users/${session.uid}/claims/${leagueId}`);
      await rtdbSet(userClaimRef, {
        managerId: managerId,
        managerName: managerName || session.name,
        claimedAt: Date.now()
      });

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
    const isFounder = user.email === 'landonekatz@gmail.com';
    let joinedLeagues = currentSession?.joinedLeagues || (isFounder ? ['dmsfantasy', 'gaywoodfantasy'] : []);
    let adminLeagues = currentSession?.adminLeagues || (isFounder ? ['dmsfantasy', 'gaywoodfantasy'] : []);
    let leagueDetails = currentSession?.leagueDetails || {
      'dmsfantasy': { name: 'The Dumbarton League', path: '/dmsfantasy/' },
      'gaywoodfantasy': { name: 'Gaywood / Katz League', path: '/gaywoodfantasy/' }
    };
    let claims = currentSession?.claims || {};
    try {
      ['dmsfantasy', 'gaywoodfantasy'].forEach(slug => {
        const stored = localStorage.getItem(`vault_claim_${slug}`);
        if (stored && !claims[slug]) claims[slug] = stored;
      });
    } catch (e) {}

    let lastLeague = currentSession?.last_league || localStorage.getItem('vault_last_league') || (isFounder ? 'dmsfantasy' : null);
    
    currentSession = {
      uid: user.uid,
      email: user.email,
      name: currentSession?.name || user.displayName || user.email.split('@')[0],
      isFounder: isFounder,
      joinedLeagues: joinedLeagues,
      adminLeagues: isFounder ? ['dmsfantasy', 'gaywoodfantasy', ...adminLeagues] : adminLeagues,
      leagueDetails: leagueDetails,
      claims: claims,
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
            name: user.displayName || user.email.split('@')[0],
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
        }

        currentSession = {
          uid: user.uid,
          email: user.email,
          name: userData.name || user.displayName || user.email.split('@')[0],
          isFounder: isFounder,
          joinedLeagues: joinedLeagues,
          adminLeagues: isFounder ? ['dmsfantasy', 'gaywoodfantasy', ...adminLeagues] : adminLeagues,
          leagueDetails: leagueDetails,
          claims: claims,
          last_league: lastLeague
        };
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

// Instantly notify listeners if we had a synchronously cached session
if (currentSession) {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: currentSession }));
  }, 0);
}

