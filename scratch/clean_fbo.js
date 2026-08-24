import { db, database } from '../src/firebase.js';
import { ref, remove, get } from 'firebase/database';
import { doc, getDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

async function main() {
  console.log('=== CLEANING UP FBO IN FIREBASE ===');

  // 1. Remove leagues/fbofantasy in RTDB
  const fboRef = ref(database, 'leagues/fbofantasy');
  const fboSnap = await get(fboRef);
  if (fboSnap.exists()) {
    console.log('Deleting RTDB leagues/fbofantasy...');
    await remove(fboRef);
    console.log('Deleted RTDB leagues/fbofantasy.');
  } else {
    console.log('RTDB leagues/fbofantasy does not exist.');
  }

  // 2. Check and clean up users in RTDB
  const usersSnap = await get(ref(database, 'users'));
  if (usersSnap.exists()) {
    const users = usersSnap.val();
    for (const [uid, uData] of Object.entries(users)) {
      console.log(`Checking RTDB user ${uid}...`);
      if (uData.leagues && uData.leagues.fbofantasy) {
        console.log(`Removing fbofantasy from RTDB users/${uid}/leagues...`);
        await remove(ref(database, `users/${uid}/leagues/fbofantasy`));
      }
      if (uData.claims && uData.claims.fbofantasy) {
        console.log(`Removing fbofantasy from RTDB users/${uid}/claims...`);
        await remove(ref(database, `users/${uid}/claims/fbofantasy`));
      }
      if (uData.last_league === 'fbofantasy') {
        console.log(`Removing last_league from RTDB users/${uid}...`);
        await remove(ref(database, `users/${uid}/last_league`));
      }

      // Check if user is now empty
      const updatedUserSnap = await get(ref(database, `users/${uid}`));
      const updatedData = updatedUserSnap.val();
      if (!updatedData || ((!updatedData.leagues || Object.keys(updatedData.leagues).length === 0) &&
          (!updatedData.claims || Object.keys(updatedData.claims).length === 0) &&
          !updatedData.last_league)) {
        console.log(`Deleting empty user ${uid} from RTDB...`);
        await remove(ref(database, `users/${uid}`));
      }
    }
  }

  // 3. Check and clean up Firestore
  const firestoreUsers = await getDocs(collection(db, 'users'));
  for (const userDoc of firestoreUsers.docs) {
    const data = userDoc.data();
    let needsUpdate = false;
    let newAdmin = data.adminLeagues;
    let newJoined = data.joinedLeagues;

    if (Array.isArray(newAdmin) && newAdmin.some(l => l.includes('fbo'))) {
      newAdmin = newAdmin.filter(l => !l.includes('fbo'));
      needsUpdate = true;
    }
    if (Array.isArray(newJoined) && newJoined.some(l => l.includes('fbo'))) {
      newJoined = newJoined.filter(l => !l.includes('fbo'));
      needsUpdate = true;
    }
    if (needsUpdate) {
      console.log(`Updating Firestore user ${userDoc.id} to remove fbo...`);
      await updateDoc(doc(db, 'users', userDoc.id), {
        adminLeagues: newAdmin,
        joinedLeagues: newJoined
      });
    }
  }

  // 4. Also free up gaywoodfantasy in Landon's Firestore user if present so it's a completely fresh import
  const landonRef = doc(db, 'users', 'DinYpB2hx4Ul3RBsiHZxi0KHoQe2');
  const landonSnap = await getDoc(landonRef);
  if (landonSnap.exists()) {
    const data = landonSnap.data();
    console.log('Landon Firestore user data before:', data);
    const newAdmin = (data.adminLeagues || []).filter(l => l !== 'gaywoodfantasy' && !l.includes('fbo'));
    const newJoined = (data.joinedLeagues || []).filter(l => l !== 'gaywoodfantasy' && !l.includes('fbo'));
    await updateDoc(landonRef, {
      adminLeagues: newAdmin,
      joinedLeagues: newJoined
    });
    console.log('Updated Landon Firestore doc to free up gaywoodfantasy for fresh import:', { newAdmin, newJoined });
  }

  // 5. Verify everything in RTDB
  const verifyLeagues = await get(ref(database, 'leagues'));
  console.log('Final RTDB leagues:', verifyLeagues.exists() ? Object.keys(verifyLeagues.val()) : 'none');
  const verifyUsers = await get(ref(database, 'users'));
  console.log('Final RTDB users:', verifyUsers.exists() ? Object.keys(verifyUsers.val()) : 'none');

  console.log('=== CLEANUP FINISHED SUCCESSFULLY ===');
  process.exit(0);
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
