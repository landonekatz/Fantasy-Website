// The Fantasy Vault — Client-Side Auth Engine & Join Code System
(function() {
  const STORAGE_KEY = 'vault_auth_session';
  const PERSONA_KEY = 'vault_active_persona';
  const CLAIMS_KEY = 'vault_manager_claims';

  // Registered League Join Codes (6-character uppercase alphanumeric)
  const JOIN_CODES = {
    'DMS202': { leagueId: 'dmsfantasy', name: 'The Dumbarton League', path: '/dmsfantasy/' },
    'KATZ15': { leagueId: 'gaywoodfantasy', name: 'Gaywood / Katz League', path: '/gaywoodfantasy/' }
  };

  const AuthEngine = {
    // Session Management
    getSession() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    setSession(userObj) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userObj));
      // Dispatch custom event for UI updates across components
      window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: userObj }));
    },

    logout() {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PERSONA_KEY);
      window.dispatchEvent(new CustomEvent('vault_auth_changed', { detail: null }));
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
    loginAsFounder() {
      const founderUser = {
        id: 'user_founder_landon',
        email: 'landonekatz@gmail.com',
        name: 'Landon Katz',
        avatar: 'L',
        isFounder: true,
        joinedLeagues: ['dmsfantasy', 'gaywoodfantasy']
      };
      this.setSession(founderUser);
      this.setPersona('founder');
      return founderUser;
    },

    loginWithGoogle(email = 'landonekatz@gmail.com') {
      const isLandon = email.toLowerCase() === 'landonekatz@gmail.com';
      const user = {
        id: 'user_google_' + Math.random().toString(36).substr(2, 9),
        email: email,
        name: isLandon ? 'Landon Katz' : email.split('@')[0],
        avatar: isLandon ? 'L' : email.charAt(0).toUpperCase(),
        isFounder: isLandon,
        joinedLeagues: isLandon ? ['dmsfantasy', 'gaywoodfantasy'] : []
      };
      this.setSession(user);
      this.setPersona(isLandon ? 'founder' : 'member');
      return user;
    },

    loginWithEmail(email, password) {
      if (email.toLowerCase() === 'landonekatz@gmail.com' && (password === 'founder2026' || password === 'admin')) {
        return this.loginAsFounder();
      }
      const user = {
        id: 'user_email_' + Math.random().toString(36).substr(2, 9),
        email: email,
        name: email.split('@')[0],
        avatar: email.charAt(0).toUpperCase(),
        isFounder: false,
        joinedLeagues: []
      };
      this.setSession(user);
      this.setPersona('member');
      return user;
    },

    // 6-Character Join Code Processing
    processJoinCode(code) {
      const cleanCode = (code || '').trim().toUpperCase();
      if (JOIN_CODES[cleanCode]) {
        const info = JOIN_CODES[cleanCode];
        const session = this.getSession();
        if (session) {
          if (!session.joinedLeagues.includes(info.leagueId)) {
            session.joinedLeagues.push(info.leagueId);
            this.setSession(session);
          }
        }
        return { success: true, league: info };
      }
      return { success: false, message: `Invalid code "${cleanCode}". Please check your 6-character Join Code.` };
    },

    // Manager Profile Claiming
    getManagerClaims(leagueId) {
      try {
        const raw = localStorage.getItem(CLAIMS_KEY + '_' + leagueId);
        return raw ? JSON.parse(raw) : {};
      } catch (e) {
        return {};
      }
    },

    claimManagerProfile(leagueId, managerId, managerName) {
      const session = this.getSession();
      const claims = this.getManagerClaims(leagueId);
      claims[managerId] = {
        userId: session ? session.id : 'guest_' + Date.now(),
        email: session ? session.email : 'guest',
        name: managerName,
        claimedAt: new Date().toISOString()
      };
      localStorage.setItem(CLAIMS_KEY + '_' + leagueId, JSON.stringify(claims));
      window.dispatchEvent(new CustomEvent('vault_claims_changed', { detail: { leagueId, claims } }));
    }
  };

  window.AuthEngine = AuthEngine;
  window.JOIN_CODES = JOIN_CODES;
})();
