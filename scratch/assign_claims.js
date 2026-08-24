import { db, database } from '../src/firebase.js';
import { ref, set, get, update } from 'firebase/database';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

async function main() {
  console.log('=== ASSIGNING COMPLETE CLAIMS IN FIREBASE ===');

  // 1. Update RTDB leagues/dmsfantasy/claims
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
    mike: {
      claimedAt: 1787606100000,
      email: "mstamatos8@gmail.com",
      managerId: "mike",
      managerName: "Michael S",
      userId: "ruXoFOU5vWZqtfdRsHEyTBvNZjC2"
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
  console.log('Set leagues/dmsfantasy/claims for Landon, Mike, and Madoc.');

  // 2. Update RTDB user for Mike
  const mikeRtdbRef = ref(database, 'users/ruXoFOU5vWZqtfdRsHEyTBvNZjC2');
  const mikeRtdbData = {
    claims: {
      dmsfantasy: {
        claimedAt: 1787606100000,
        managerId: "mike",
        managerName: "Michael S"
      }
    },
    last_active_at: Date.now(),
    last_league: "dmsfantasy",
    leagues: {
      dmsfantasy: {
        joinedAt: 1787606100000,
        name: "The Dumbarton Fantasy Football League HQ",
        role: "member"
      }
    }
  };
  await set(mikeRtdbRef, mikeRtdbData);
  console.log('Set RTDB user for Mike.');

  // 3. Update Firestore user for Mike
  const mikeFirestoreRef = doc(db, 'users', 'ruXoFOU5vWZqtfdRsHEyTBvNZjC2');
  await setDoc(mikeFirestoreRef, {
    email: "mstamatos8@gmail.com",
    name: "Michael S",
    joinedLeagues: ["dmsfantasy"],
    adminLeagues: [],
    last_league: "dmsfantasy",
    claims: {
      dmsfantasy: "mike"
    }
  }, { merge: true });
  console.log('Set Firestore user for Mike.');

  // 4. Update Firestore user for Madoc
  const madocFirestoreRef = doc(db, 'users', 'HLV9NmxxPzd1pEzv2Utd0h1bAMH2');
  await setDoc(madocFirestoreRef, {
    email: "lkatz123@terpmail.umd.edu",
    name: "Madoc",
    joinedLeagues: ["dmsfantasy"],
    adminLeagues: [],
    last_league: "dmsfantasy",
    claims: {
      dmsfantasy: "madoc"
    }
  }, { merge: true });
  console.log('Set Firestore user for Madoc.');

  // 5. Verify RTDB Claims
  const verifyClaims = await get(claimsRef);
  console.log('Verified RTDB Claims:', JSON.stringify(verifyClaims.val(), null, 2));

  // 6. Verify RTDB Users
  const verifyUsers = await get(ref(database, 'users'));
  console.log('Verified RTDB Users:', JSON.stringify(verifyUsers.val(), null, 2));

  console.log('=== ASSIGNMENT COMPLETED SUCCESSFULLY ===');
  process.exit(0);
}

main().catch(e => {
  console.error('Error assigning claims:', e);
  process.exit(1);
});
