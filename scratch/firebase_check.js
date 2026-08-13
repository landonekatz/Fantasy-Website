import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAmIKYxDd4JmZ0ejh6uOCs45kx6wGzfNUE",
  databaseURL: "https://fantasy-vault-4f8da-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function run() {
  const leaguesRef = ref(db, 'leagues');
  const snap = await get(leaguesRef);
  if (snap.exists()) {
    const leagues = snap.val();
    console.log("Leagues:", Object.keys(leagues));
    if (leagues['fbofantasy']) {
      console.log("FBO Fantasy name:", leagues['fbofantasy'].league_settings?.name);
      await remove(ref(db, 'leagues/fbofantasy'));
      console.log("Deleted fbofantasy.");
    }
  } else {
    console.log("No leagues found.");
  }
  process.exit(0);
}

run();
