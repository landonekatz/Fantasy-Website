// The Fantasy Vault — Client-Side Auth Engine & Join Code System
import { auth, db } from './firebase.js';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";

const PERSONA_KEY = 'vault_active_persona';

// Registered League Join Codes (6-character uppercase alphanumeric)
const JOIN_CODES = {
  'DMS202': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy/', managers: [{id: 'mgr_dms_1', name: 'Landon'}, {id: 'mgr_dms_2', name: 'Madoc'}, {id: 'mgr_dms_3', name: 'Jordan'}] },
  'KATZ15': { leagueId: 'gaywoodfantasy', name: 'Gaywood / Katz League', path: '/gaywoodfantasy/', managers: [{id: 'mgr_katz_1', name: 'Landon'}, {id: 'mgr_katz_2', name: 'Doug'}, {id: 'mgr_katz_3', name: 'Mike'}] }
};

let currentSession = null;

const AuthEngine = {
  // Session Management
  getSession() {
    return currentSession;
  },

  logout() {
    signOut(auth).then(() => {
      localStorage.removeItem(PERSONA_KEY);
      window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: null }));
    });
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

  // 6-Character Join Code Processing (Validation only)
  processJoinCode(code) {
    const cleanCode = (code || '').trim().toUpperCase();
    if (JOIN_CODES[cleanCode]) {
      return { success: true, league: JOIN_CODES[cleanCode] };
    }
    return { success: false, message: `Invalid code "${cleanCode}". Please check your 6-character Join Code.` };
  },

  async finalizeJoin(code, managerId) {
    const cleanCode = (code || '').trim().toUpperCase();
    const info = JOIN_CODES[cleanCode];
    if (!info) return { success: false, message: "Invalid code" };
    
    const session = this.getSession();
    if (!session) return { success: false, message: "Not signed in" };

    try {
      const userRef = doc(db, 'users', session.uid);
      await updateDoc(userRef, {
        joinedLeagues: arrayUnion(info.leagueId)
      });
      await this.claimManagerProfile(info.leagueId, managerId, session.email);
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
      const claimRef = doc(db, 'leagues', leagueId, 'claims', managerId);
      await setDoc(claimRef, {
        userId: session.uid,
        email: session.email,
        name: managerName,
        claimedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Claim error", e);
    }
  }
};

// Set up listener for real-time auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Sync to Firestore Users collection
    const userRef = doc(db, 'users', user.uid);
    let userDoc = await getDoc(userRef);
    let userData = {};
    
    if (!userDoc.exists()) {
      userData = {
        email: user.email,
        name: user.displayName || user.email.split('@')[0],
        joinedLeagues: []
      };
      await setDoc(userRef, userData);
    } else {
      userData = userDoc.data();
    }
    
    const isFounder = user.email === 'landonekatz@gmail.com';
    let joinedLeagues = userData.joinedLeagues || [];
    
    // Give founder implicit access to all test leagues
    if (isFounder) {
      if (!joinedLeagues.includes('dmsfantasy')) joinedLeagues.push('dmsfantasy');
      if (!joinedLeagues.includes('gaywoodfantasy')) joinedLeagues.push('gaywoodfantasy');
    }
    
    currentSession = {
      uid: user.uid,
      email: user.email,
      name: userData.name || user.displayName || user.email.split('@')[0],
      isFounder: isFounder,
      joinedLeagues: joinedLeagues,
      adminLeagues: isFounder ? ['dmsfantasy', 'gaywoodfantasy'] : (userData.adminLeagues || [])
    };
    AuthEngine.setPersona(currentSession.isFounder ? 'founder' : 'member');
  } else {
    currentSession = null;
    AuthEngine.setPersona('public');
  }
  window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: currentSession }));
});

window.AuthEngine = AuthEngine;
window.JOIN_CODES = JOIN_CODES;
