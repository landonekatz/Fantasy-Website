import fs from 'fs';
import path from 'path';

// Load .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const k = trimmed.substring(0, eqIdx).trim();
        const v = trimmed.substring(eqIdx + 1).trim();
        if (!process.env[k]) process.env[k] = v;
      }
    });
  }
} catch (e) {}

const FIREBASE_DB_URL = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';
const DB_SECRET = process.env.FIREBASE_DATABASE_SECRET || process.env.FIREBASE_DB_SECRET || process.env.FIREBASE_AUTH_TOKEN || '';

async function fetchFromFirebase(subPath) {
  const url = `${FIREBASE_DB_URL}/${subPath}.json?auth=${DB_SECRET}`;
  const res = await fetch(url);
  return res.json();
}

async function inspect() {
  const leagues = ['dmsfantasy', 'gaywoodfantasyfootball', 'lamarkablefantasy', 'fbo', 'abtherapyleague'];
  for (const slug of leagues) {
    console.log(`\n==============================================`);
    console.log(`LEAGUE: ${slug}`);
    console.log(`==============================================`);
    const members = await fetchFromFirebase(`leagues/${slug}/members`);
    const claims = await fetchFromFirebase(`leagues/${slug}/claims`);
    console.log(`Members count: ${members ? members.length : 0}`);
    if (members) {
      members.forEach(m => {
        console.log(`  id: ${m.id} | alias: ${m.alias} | name: ${m.name} | active: ${m.isActive} | logo: ${(m.logo_url || m.avatar || '').substring(0, 45)}`);
      });
    }
    console.log('Claims keys:', claims ? Object.keys(claims) : 'none');
    if (claims) {
      Object.entries(claims).forEach(([k, v]) => {
        console.log(`  claim [${k}]: manager_id=${v.manager_id}, alias=${v.alias}, name=${v.name}, email=${v.email}`);
      });
    }
  }
}
inspect();
