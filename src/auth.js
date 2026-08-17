// The Fantasy Vault, as Client-Side Auth Engine & Join Code System
import { auth, db, database } from './firebase.js';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { ref as dbRef, set as rtdbSet, get as rtdbGet } from "firebase/database";

const PERSONA_KEY = 'vault_active_persona';

// Registered League Join Codes (6-character uppercase alphanumeric)
const JOIN_CODES = {
  'D8M4S2': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy/', managers: [{id: 'mgr_dms_1', name: 'Landon'}, {id: 'mgr_dms_2', name: 'Madoc'}, {id: 'mgr_dms_3', name: 'Jordan'}] },
  'K9Z15A': { leagueId: 'gaywoodfantasy', name: 'Gaywood / Katz League', path: '/gaywoodfantasy/', managers: [{id: 'mgr_katz_1', name: 'Landon'}, {id: 'mgr_katz_2', name: 'Doug'}, {id: 'mgr_katz_3', name: 'Mike'}] },
  // Legacy aliases
  'DMS202': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy/', managers: [{id: 'mgr_dms_1', name: 'Landon'}, {id: 'mgr_dms_2', name: 'Madoc'}, {id: 'mgr_dms_3', name: 'Jordan'}] },
  'KATZ15': { leagueId: 'gaywoodfantasy', name: 'Gaywood / Katz League', path: '/gaywoodfantasy/', managers: [{id: 'mgr_katz_1', name: 'Landon'}, {id: 'mgr_katz_2', name: 'Doug'}, {id: 'mgr_katz_3', name: 'Mike'}] }
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
});

const AuthEngine = {
  // Session Management
  getSession() {
    return currentSession;
  },

  ready() {
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
  processJoinCode(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (JOIN_CODES[cleanCode]) {
      return { success: true, league: JOIN_CODES[cleanCode] };
    }

    // Check dynamic active app instance if present
    if (window.app && window.app.leagueSlug) {
      const appCode = (window.app.leagueSettings?.join_code || '').toUpperCase();
      if (cleanCode && (cleanCode === appCode || cleanCode === window.app.leagueSlug.toUpperCase())) {
        const info = {
          leagueId: window.app.leagueSlug,
          name: window.app.leagueSettings?.name || 'Fantasy Football League',
          path: `/${window.app.leagueSlug}/`,
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
      const check = this.processJoinCode(code);
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
    if (!session) return;
    try {
      const claimData = {
        userId: session.uid,
        email: session.email,
        name: managerName || session.name || session.email.split('@')[0],
        claimedAt: new Date().toISOString()
      };

      // 1. Write to Firestore
      try {
        const claimRef = doc(db, 'leagues', leagueId, 'claims', managerId);
        await setDoc(claimRef, claimData);
      } catch (err) {
        console.warn("Firestore claim write warning:", err);
      }

      // 2. Write to Firebase RTDB for instantaneous reactive sync
      if (database) {
        try {
          const rtdbClaimRef = dbRef(database, `leagues/${leagueId}/claims/${managerId}`);
          await rtdbSet(rtdbClaimRef, claimData);
        } catch (err) {
          console.warn("RTDB claim write warning:", err);
        }
      }

      if (!session.claims) session.claims = {};
      session.claims[leagueId] = managerId;
      try {
        localStorage.setItem('vault_cached_session', JSON.stringify(session));
        localStorage.setItem(`vault_claims_${leagueId}`, JSON.stringify({ [managerId]: claimData }));
      } catch (e) {}
    } catch (e) {
      console.error("Claim error", e);
    }
  },

  async linkUserLeague(slug, role = 'member', leagueName = '') {
    const session = this.getSession();
    if (!session) return;
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!cleanSlug) return;

    if (!session.joinedLeagues) session.joinedLeagues = [];
    if (!session.joinedLeagues.includes(cleanSlug)) session.joinedLeagues.push(cleanSlug);

    if (role === 'admin') {
      if (!session.adminLeagues) session.adminLeagues = [];
      if (!session.adminLeagues.includes(cleanSlug)) session.adminLeagues.push(cleanSlug);
    }

    if (!session.leagueDetails) session.leagueDetails = {};
    if (leagueName) {
      session.leagueDetails[cleanSlug] = { name: leagueName, path: `/${cleanSlug}/` };
      try {
        localStorage.setItem(`vault_league_name_${cleanSlug}`, leagueName);
      } catch (e) {}
    }

    localStorage.setItem('vault_last_league', cleanSlug);

    // Save to Firestore
    try {
      const userRef = doc(db, 'users', session.uid);
      const updateData = {
        joinedLeagues: arrayUnion(cleanSlug)
      };
      if (role === 'admin') {
        updateData.adminLeagues = arrayUnion(cleanSlug);
      }
      await updateDoc(userRef, updateData);
    } catch (err) {
      console.warn("Firestore user league update error:", err);
    }

    // Save to RTDB
    if (database) {
      try {
        const userRtdbRef = dbRef(database, `users/${session.uid}/leagues/${cleanSlug}`);
        await rtdbSet(userRtdbRef, {
          role: role,
          name: leagueName || cleanSlug,
          updatedAt: Date.now()
        });
      } catch (err) {
        console.warn("RTDB user league update error:", err);
      }
    }
    try {
      localStorage.setItem('vault_cached_session', JSON.stringify(session));
    } catch (e) {}
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
    const session = this.getSession();
    if (!session) return { success: false, message: "Not signed in" };
    const cleanSlug = leagueSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const cleanEmail = (targetEmail || '').trim().toLowerCase();

    if (!cleanEmail) {
      return { success: false, message: "Please provide a valid recipient email address." };
    }

    try {
      // 1. Update league settings in RTDB if available
      if (database) {
        const adminRef = dbRef(database, `leagues/${cleanSlug}/league_settings/admin_email`);
        await rtdbSet(adminRef, cleanEmail);
      }

      // 2. Update local state
      if (session.adminLeagues && !session.isFounder) {
        session.adminLeagues = session.adminLeagues.filter(s => s !== cleanSlug);
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
    // 1. Sync to Firestore Users collection
    const userRef = doc(db, 'users', user.uid);
    let userDoc = await getDoc(userRef);
    let userData = {};
    
    if (!userDoc.exists()) {
      userData = {
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        joinedLeagues: [],
        adminLeagues: []
      };
      await setDoc(userRef, userData);
    } else {
      userData = userDoc.data();
    }
    
    const isFounder = user.email === 'landonekatz@gmail.com';
    let joinedLeagues = Array.isArray(userData.joinedLeagues) ? [...userData.joinedLeagues] : [];
    let adminLeagues = Array.isArray(userData.adminLeagues) ? [...userData.adminLeagues] : [];
    const leagueDetails = {
      'dmsfantasy': { name: 'The Dumbarton League', path: '/dmsfantasy/' },
      'gaywoodfantasy': { name: 'Gaywood / Katz League', path: '/gaywoodfantasy/' }
    };
    
    // Give founder implicit access to all test leagues
    if (isFounder) {
      if (!joinedLeagues.includes('dmsfantasy')) joinedLeagues.push('dmsfantasy');
      if (!joinedLeagues.includes('gaywoodfantasy')) joinedLeagues.push('gaywoodfantasy');
      if (!adminLeagues.includes('dmsfantasy')) adminLeagues.push('dmsfantasy');
      if (!adminLeagues.includes('gaywoodfantasy')) adminLeagues.push('gaywoodfantasy');
    }

    // 2. Discover dynamically created/administered leagues from RTDB
    if (database) {
      try {
        // A. Check user's RTDB registered leagues
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

        // B. Query all RTDB leagues for matching admin_email or member claims
        const allLeaguesSnap = await rtdbGet(dbRef(database, 'leagues'));
        if (allLeaguesSnap.exists()) {
          const allLeagues = allLeaguesSnap.val();
          const userEmailLower = (user.email || '').toLowerCase();
          
          Object.keys(allLeagues).forEach(slug => {
            const leagueData = allLeagues[slug];
            const adminEmail = leagueData?.league_settings?.admin_email;
            const leagueName = leagueData?.league_settings?.name || slug;

            leagueDetails[slug] = { name: leagueName, path: `/${slug}/` };
            try { localStorage.setItem(`vault_league_name_${slug}`, leagueName); } catch(e){}

            // Check if user is admin
            if (adminEmail && adminEmail.toLowerCase() === userEmailLower) {
              if (!joinedLeagues.includes(slug)) joinedLeagues.push(slug);
              if (!adminLeagues.includes(slug)) adminLeagues.push(slug);
            }

            // Check if user has claims
            if (leagueData?.claims) {
              Object.values(leagueData.claims).forEach(claim => {
                if (claim.userId === user.uid || (claim.email && claim.email.toLowerCase() === userEmailLower)) {
                  if (!joinedLeagues.includes(slug)) joinedLeagues.push(slug);
                }
              });
            }
          });
        }

        // C. Sync any newly discovered leagues back to Firestore doc
        if (joinedLeagues.length !== (userData.joinedLeagues || []).length ||
            adminLeagues.length !== (userData.adminLeagues || []).length) {
          await setDoc(userRef, {
            joinedLeagues: joinedLeagues,
            adminLeagues: adminLeagues
          }, { merge: true });
        }
      } catch (rtdbErr) {
        console.warn("RTDB league discovery error:", rtdbErr);
      }
    }
    
    currentSession = {
      uid: user.uid,
      email: user.email,
      name: userData.name || user.displayName || user.email.split('@')[0],
      isFounder: isFounder,
      joinedLeagues: joinedLeagues,
      adminLeagues: isFounder ? ['dmsfantasy', 'gaywoodfantasy', ...adminLeagues] : adminLeagues,
      leagueDetails: leagueDetails
    };
    try {
      localStorage.setItem('vault_cached_session', JSON.stringify(currentSession));
    } catch (e) {}
    AuthEngine.setPersona(currentSession.isFounder ? 'founder' : 'member');
  } else {
    currentSession = null;
    try {
      localStorage.removeItem('vault_cached_session');
    } catch (e) {}
    AuthEngine.setPersona('public');
  }
  
  authReadyResolve(currentSession);
  window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: currentSession }));
});

window.AuthEngine = AuthEngine;
window.JOIN_CODES = JOIN_CODES;

// Instantly notify listeners if we had a synchronously cached session
if (currentSession) {
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: currentSession }));
  }, 0);
}

