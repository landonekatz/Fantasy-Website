import { db, database } from '../src/firebase.js';
import { ref, set, get } from 'firebase/database';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

async function main() {
  console.log('=== RESTORING DMS LEAGUE DATA IN FIREBASE ===');

  // 1. Restore DMS League Settings
  const settingsRef = ref(database, 'leagues/dmsfantasy/league_settings');
  const dmsSettings = {
    name: "The Dumbarton Fantasy Football League HQ",
    tagline: "8 Seasons • 15 Managers • One Vault",
    subtitle: "8 Seasons • 15 Managers • One Vault",
    is_private: true,
    join_code: "DNFUAM",
    admin_email: "landonekatz@gmail.com",
    allow_nicknames: true
  };
  await set(settingsRef, dmsSettings);
  console.log('Restored leagues/dmsfantasy/league_settings');

  // 2. Restore DMS Claims
  const claimsRef = ref(database, 'leagues/dmsfantasy/claims');
  const dmsClaims = {
    landon: {
      claimedAt: 1787604276935,
      email: "landonekatz@gmail.com",
      managerId: "landon",
      managerName: "Landon",
      nickname: "The Commish",
      userId: "DinYpB2hx4Ul3RBsiHZxi0KHoQe2"
    },
    madoc: {
      claimedAt: 1787606165676,
      email: "lkatz123@terpmail.umd.edu",
      managerId: "madoc",
      managerName: "Madoc",
      userId: "HLV9NmxxPzd1pEzv2Utd0h1bAMH2"
    }
  };
  await set(claimsRef, dmsClaims);
  console.log('Restored leagues/dmsfantasy/claims');

  // 3. Restore Landon RTDB User Profile
  const landonUserRef = ref(database, 'users/DinYpB2hx4Ul3RBsiHZxi0KHoQe2');
  const landonUserData = {
    claims: {
      dmsfantasy: {
        claimedAt: 1787604276935,
        managerId: "landon",
        managerName: "Landon",
        nickname: "The Commish"
      }
    },
    last_active_at: Date.now(),
    last_league: "dmsfantasy",
    leagues: {
      dmsfantasy: {
        joinedAt: 1787604277340,
        name: "The Dumbarton Fantasy Football League HQ",
        role: "admin"
      }
    },
    managerNicknames: {
      dmsfantasy: "The Commish"
    }
  };
  await set(landonUserRef, landonUserData);
  console.log('Restored users/DinYpB2hx4Ul3RBsiHZxi0KHoQe2');

  // 4. Restore Madoc RTDB User Profile
  const madocUserRef = ref(database, 'users/HLV9NmxxPzd1pEzv2Utd0h1bAMH2');
  const madocUserData = {
    claims: {
      dmsfantasy: {
        claimedAt: 1787606165676,
        managerId: "madoc",
        managerName: "Madoc"
      }
    },
    last_active_at: 1787606166276,
    last_league: "dmsfantasy",
    leagues: {
      dmsfantasy: {
        joinedAt: 1787606165605,
        name: "The Dumbarton League",
        role: "member"
      }
    }
  };
  await set(madocUserRef, madocUserData);
  console.log('Restored users/HLV9NmxxPzd1pEzv2Utd0h1bAMH2');

  // 5. Update Firestore user docs
  const landonFirestoreRef = doc(db, 'users', 'DinYpB2hx4Ul3RBsiHZxi0KHoQe2');
  await setDoc(landonFirestoreRef, {
    email: 'landonekatz@gmail.com',
    name: 'Landon Katz',
    adminLeagues: ['dmsfantasy'],
    joinedLeagues: ['dmsfantasy'],
    managerNicknames: {
      dmsfantasy: 'The Commish'
    }
  }, { merge: true });
  console.log('Updated Firestore user doc for Landon');

  // 6. Verify restored RTDB data
  const rootSnap = await get(ref(database, '/'));
  console.log('Restored RTDB State:', JSON.stringify(rootSnap.val(), null, 2));

  console.log('=== RESTORATION COMPLETE ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Restoration error:', err);
  process.exit(1);
});
