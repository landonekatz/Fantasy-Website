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

const RTDB_BASE = 'https://fantasy-vault-4f8da-default-rtdb.firebaseio.com';
const DB_SECRET = process.env.FIREBASE_DATABASE_SECRET || process.env.FIREBASE_DB_SECRET || process.env.FIREBASE_AUTH_TOKEN || '';

function buildUrl(subPath) {
  const params = new URLSearchParams();
  if (DB_SECRET) params.set('auth', DB_SECRET);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return `${RTDB_BASE}/${subPath}.json${qStr}`;
}

async function fetchJson(path) {
  const res = await fetch(buildUrl(path));
  if (!res.ok) throw new Error(`Fetch failed for ${path}: ${res.status}`);
  return res.json();
}

async function putJson(path, data) {
  const res = await fetch(buildUrl(path), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT failed for ${path}: ${res.status} ${txt}`);
  }
  return res.json();
}

async function fixLamarkableAvatars() {
  console.log('\n--- 1. Fixing Sleeper League (lamarkablefantasy) Avatars ---');
  const members = await fetchJson('leagues/lamarkablefantasy/members') || [];
  const list = Array.isArray(members) ? members : Object.values(members || {});

  const newHashes = {
    '865088988120236032': '736d350acbdce784be8a59591b5665e0', // Leo
    '884205459035361280': '67432901e9de714cb77d22ee5d46e64d', // Jamison
    '1389311619867103232': '7572250c2fb084c434fed0e82229e183', // Rocco
    '870366179724849152': 'b319fdf8b7b5b0359d3c78622ba4d70c', // Monil
    '863584035753054208': 'a852313daa7d5376a2780407541e051e', // Patrick
    '870840753167962112': 'a0365fe3ac0dfdc1ecab52574c2662d0', // Asher
  };

  let updatedCount = 0;
  const updatedMembers = list.map(m => {
    if (newHashes[m.id]) {
      const freshUrl = `https://sleepercdn.com/avatars/thumbs/${newHashes[m.id]}`;
      updatedCount++;
      return {
        ...m,
        avatar: freshUrl,
        avatar_url: freshUrl,
        logo_url: freshUrl
      };
    }
    return m;
  });

  console.log(`Updated ${updatedCount} avatars in lamarkablefantasy.`);
  await putJson('leagues/lamarkablefantasy/members', updatedMembers);
  await putJson('leagues/lamarkablefantasy/managers', updatedMembers);
  console.log('Successfully saved updated lamarkablefantasy members and managers to RTDB.');
}

async function fixGaywoodMembers() {
  console.log('\n--- 2. Fixing Gaywood (gaywoodfantasyfootball) Members ---');
  const members = await fetchJson('leagues/gaywoodfantasyfootball/members') || [];
  const list = Array.isArray(members) ? members : Object.values(members || {});
  console.log(`Initial member count: ${list.length}`);

  // Historical IDs to merge into active / canonical managers
  const historicalMappings = {
    '{3415FA77-065E-4CB9-BFBB-C803074EC3B7}': ['{abeck71-0000-0000-0000-000000000000}', 'adam_b', 'adam b', 'adamb'],
    '{58FFDC7E-BDE4-4D47-B3A8-F7B2CBADA24D}': ['{bradylo-0000-0000-0000-000000000000}', 'brady'],
    '{69E8ED34-E92E-4ED6-A8ED-34E92E5ED660}': ['{RickyHub-0000-0000-0000-000000000000}', 'mike'],
    '{9C7552C0-331D-49ED-9FF6-5138BF1DFF1A}': ['{Maximus5252-0000-0000-0000-000000000000}', 'scott'],
    '{BC4778B4-2400-4B0B-8778-B424005B0BF1}': ['{Nattyb4s-0000-0000-0000-000000000000}', 'lee'],
    '{BFD6F1F8-D676-4D12-9030-3F76A4B7F468}': ['{irabka5685803-000-0000-0000-000000000000}', 'ira'],
    '{DD30D761-92C3-4505-9FAF-EFE381DA6F00}': ['{nngold00-0000-0000-0000-000000000000}', 'nick'],
    '{E29B3DF4-B743-4BE8-B889-961C630B9BFC}': ['{tharris31-0000-0000-0000-000000000000}', 'tyler'],
    '{FB9735E7-F1A8-4E0D-885F-BAC76F1AA1B6}': ['{hopkins28-000-0000-0000-000000000000}', 'john'],
    '{FDB4062B-AC75-4A46-ADE9-012ADDB91DDD}': ['{lbatll1-0000-0000-0000-000000000000}', 'luis'],
    '{73801D46-DE9E-4790-AED8-EC62B65C878B}': ['{wbaisy1688281-000-0000-0000-000000000000}', 'ethan']
  };

  const duplicateIdsToRemove = new Set([
    '{abeck71-0000-0000-0000-000000000000}',
    '{wbaisy1688281-000-0000-0000-000000000000}',
    '{bradylo-0000-0000-0000-000000000000}',
    '{irabka5685803-000-0000-0000-000000000000}',
    '{Maximus5252-0000-0000-0000-000000000000}',
    '{tharris31-0000-0000-0000-000000000000}',
    '{nngold00-0000-0000-0000-000000000000}',
    '{RickyHub-0000-0000-0000-000000000000}',
    '{Nattyb4s-0000-0000-0000-000000000000}',
    '{hopkins28-000-0000-0000-000000000000}',
    '{lbatll1-0000-0000-0000-000000000000}'
  ]);

  const cleanedMembers = list
    .filter(m => !duplicateIdsToRemove.has(m.id))
    .map(m => {
      if (historicalMappings[m.id]) {
        const extra = historicalMappings[m.id];
        const existingEspn = Array.isArray(m.espn_ids) ? m.espn_ids : [m.id];
        const existingPlat = Array.isArray(m.platform_ids) ? m.platform_ids : [m.id];
        return {
          ...m,
          espn_ids: Array.from(new Set([...existingEspn, ...extra])),
          platform_ids: Array.from(new Set([...existingPlat, ...extra]))
        };
      }
      return m;
    });

  console.log(`Cleaned member count: ${cleanedMembers.length}`);
  console.log('Active members:', cleanedMembers.filter(m => m.isActive).map(m => m.alias));
  console.log('Retired members:', cleanedMembers.filter(m => !m.isActive).map(m => m.alias));

  await putJson('leagues/gaywoodfantasyfootball/members', cleanedMembers);
  await putJson('leagues/gaywoodfantasyfootball/managers', cleanedMembers);
  console.log('Successfully saved cleaned gaywoodfantasyfootball members and managers to RTDB.');
}

async function run() {
  await fixLamarkableAvatars();
  await fixGaywoodMembers();
  console.log('\nAll data fixed successfully!');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
