/**
 * scripts/repair_all_league_members.js
 * 
 * Restores and standardizes canonical manager aliases, active/retired statuses,
 * platform IDs, and avatars across all 5 hosted leagues in Firebase RTDB:
 * 1. dmsfantasy
 * 2. gaywoodfantasyfootball
 * 3. lamarkablefantasy
 * 4. fbo
 * 5. abtherapyleague
 */

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

function buildUrl(subPath) {
  const params = new URLSearchParams();
  if (DB_SECRET) params.set('auth', DB_SECRET);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return `${FIREBASE_DB_URL}/${subPath}.json${qStr}`;
}

async function putJson(subPath, data) {
  const url = buildUrl(subPath);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`PUT ${subPath} failed: ${res.status} ${txt}`);
  }
  return res.json();
}

async function fetchJson(subPath) {
  const res = await fetch(buildUrl(subPath));
  if (!res.ok) return null;
  return res.json();
}

async function main() {
  console.log('='.repeat(70));
  console.log('REPAIRING CANONICAL MANAGER ALIASES ACROSS ALL 5 VAULT LEAGUES');
  console.log('='.repeat(70));

  // ==========================================
  // 1. DMS FANTASY
  // ==========================================
  console.log('\n[1/5] Processing dmsfantasy...');
  const dmsLocalManagers = JSON.parse(fs.readFileSync('dmsfantasy/data/managers.json', 'utf8')).managers || [];
  
  // Mapping of canonical ID to raw Yahoo scraper IDs
  const yahooScraperIdMap = {
    alex: ['yahoo_frenchy'],
    benjamin: ['yahoo_benjamin'],
    carson: ['yahoo_carson'],
    isabella: ['yahoo_isabella'],
    jake: ['yahoo_jake'],
    landon: ['yahoo_landon'],
    luke: ['yahoo_luke'],
    mike: ['yahoo_michael'],
    will: ['yahoo_will'],
    ryan: ['yahoo_ryan'],
    jordan: ['yahoo_bugsbunnyrules'],
    madoc: ['yahoo_madoc']
  };

  const dmsMembers = dmsLocalManagers.map(m => {
    const isActive = m.status === 'current';
    const scraperIds = yahooScraperIdMap[m.id] || [];
    return {
      id: m.id,
      name: m.name,
      alias: m.name,
      canonical_name: m.name,
      manager_name: m.name,
      status: isActive ? 'Active' : 'Retired',
      isActive: isActive,
      is_retired: !isActive,
      favorite_team: m.favorite_team || '',
      logo_url: m.logo_url || '',
      avatar: m.logo_url || '',
      avatar_url: m.logo_url || '',
      platform_ids: [m.id, ...scraperIds],
      espn_ids: [m.id]
    };
  });

  await putJson('leagues/dmsfantasy/members', dmsMembers);
  await putJson('leagues/dmsfantasy/managers', dmsMembers);
  console.log(`  -> Restored ${dmsMembers.length} managers (${dmsMembers.filter(m => m.isActive).length} active) in dmsfantasy`);

  // ==========================================
  // 2. GAYWOOD FANTASY FOOTBALL
  // ==========================================
  console.log('\n[2/5] Processing gaywoodfantasyfootball...');
  const gaywoodCurrentMembers = await fetchJson('leagues/gaywoodfantasyfootball/members') || [];
  const gaywoodHistoricalManagers = JSON.parse(fs.readFileSync('gaywoodfantasy/data/managers.json', 'utf8')).managers || [];

  const gaywoodAliases = {
    '{3415FA77-065E-4CB9-BFBB-C803074EC3B7}': 'Adam B',
    '{58FFDC7E-BDE4-4D47-B3A8-F7B2CBADA24D}': 'Brady',
    '{69E8ED34-E92E-4ED6-A8ED-34E92E5ED660}': 'Mike',
    '{9C7552C0-331D-49ED-9FF6-5138BF1DFF1A}': 'Scott',
    '{BC4778B4-2400-4B0B-8778-B424005B0BF1}': 'Lee',
    '{BFD6F1F8-D676-4D12-9030-3F76A4B7F468}': 'Ira',
    '{DD30D761-92C3-4505-9FAF-EFE381DA6F00}': 'Nick',
    '{E29B3DF4-B743-4BE8-B889-961C630B9BFC}': 'Tyler',
    '{E316AD20-08CA-409C-9BAA-C7DC197CA6FC}': 'Ethan Frey',
    '{FB9735E7-F1A8-4E0D-885F-BAC76F1AA1B6}': 'John',
    '{FDB4062B-AC75-4A46-ADE9-012ADDB91DDD}': 'Luis',
    '{CA572B6F-3343-4B9E-972B-6F3343BB9EFC}': 'Matt',
    '{34CC3E69-D1C5-4C20-9C82-7D9F66E0A7A5}': 'Landon',
    '{73801D46-DE9E-4790-AED8-EC62B65C878B}': 'Ethan'
  };

  const gaywoodHistoricalMappings = {
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

  const gaywoodDuplicateIds = new Set([
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

  const gaywoodMembersMap = new Map();
  gaywoodCurrentMembers.filter(m => !gaywoodDuplicateIds.has(m.id)).forEach(m => {
    const alias = gaywoodAliases[m.id] || m.alias || m.name || 'Manager';
    const extra = gaywoodHistoricalMappings[m.id] || [];
    const existingEspn = Array.isArray(m.espn_ids) ? m.espn_ids : [m.id];
    const existingPlat = Array.isArray(m.platform_ids) ? m.platform_ids : [m.id];
    gaywoodMembersMap.set(m.id, {
      ...m,
      name: alias,
      alias: alias,
      canonical_name: alias,
      manager_name: alias,
      espn_ids: Array.from(new Set([...existingEspn, ...extra])),
      platform_ids: Array.from(new Set([...existingPlat, ...extra]))
    });
  });

  // Ensure all genuine historical retired managers from gaywood data archive are included
  gaywoodHistoricalManagers.forEach(hm => {
    const espnId = hm.espn_id || hm.id;
    if (!gaywoodMembersMap.has(espnId) && !gaywoodDuplicateIds.has(espnId)) {
      gaywoodMembersMap.set(espnId, {
        id: espnId,
        name: hm.name,
        alias: hm.name,
        canonical_name: hm.name,
        manager_name: hm.name,
        firstName: hm.name,
        lastName: hm.full_name?.split(' ').slice(1).join(' ') || '',
        status: 'Retired',
        isActive: false,
        is_retired: true,
        lastSeenYear: 2024,
        platform_ids: [espnId, hm.id].filter(Boolean),
        espn_ids: [espnId, hm.id].filter(Boolean)
      });
    }
  });

  const gaywoodMembers = Array.from(gaywoodMembersMap.values());
  await putJson('leagues/gaywoodfantasyfootball/members', gaywoodMembers);
  await putJson('leagues/gaywoodfantasyfootball/managers', gaywoodMembers);
  console.log(`  -> Restored ${gaywoodMembers.length} managers (${gaywoodMembers.filter(m => m.isActive).length} active) in gaywoodfantasyfootball`);

  // ==========================================
  // 3. LAMARKABLE FANTASY
  // ==========================================
  console.log('\n[3/5] Processing lamarkablefantasy...');
  const lamarkableCanonical = [
    // 12 Active Managers with verified live 200 OK avatars
    { id: '865088988120236032', alias: 'Leo', avatar: 'https://sleepercdn.com/avatars/thumbs/736d350acbdce784be8a59591b5665e0', isActive: true, status: 'Active' },
    { id: '884205459035361280', alias: 'Jamison', avatar: 'https://sleepercdn.com/avatars/thumbs/67432901e9de714cb77d22ee5d46e64d', isActive: true, status: 'Active' },
    { id: '1258232732161417216', alias: 'Frank', avatar: 'https://sleepercdn.com/avatars/thumbs/1edba0c821b721f24495393a11b33c73', isActive: true, status: 'Active' },
    { id: '870742790919901184', alias: 'Thomas', avatar: 'https://sleepercdn.com/avatars/thumbs/061e550c8b264cb5c9142dc3ddfc8fd0', isActive: true, status: 'Active' },
    { id: '1256746836975157248', alias: 'Josh', avatar: 'https://sleepercdn.com/avatars/thumbs/79f55a2cf200bbb671e48c1218661807', isActive: true, status: 'Active' },
    { id: '1179722739718299648', alias: 'Tyler', avatar: 'https://sleepercdn.com/avatars/thumbs/578c6b253dd7b4bab45382e1af102204', isActive: true, status: 'Active' },
    { id: '870487784425750528', alias: 'Laird', avatar: 'https://sleepercdn.com/avatars/thumbs/e7af4deab0289b4f5505646424895246', isActive: true, status: 'Active' },
    { id: '870546917308952576', alias: 'Blake', avatar: 'https://sleepercdn.com/avatars/thumbs/62ac456f8de505eb862ea09cd2d97504', isActive: true, status: 'Active' },
    { id: '1389311619867103232', alias: 'Rocco', avatar: 'https://sleepercdn.com/avatars/thumbs/7572250c2fb084c434fed0e82229e183', isActive: true, status: 'Active' },
    { id: '870366179724849152', alias: 'Monil', avatar: 'https://sleepercdn.com/avatars/thumbs/b319fdf8b7b5b0359d3c78622ba4d70c', isActive: true, status: 'Active' },
    { id: '863584035753054208', alias: 'Patrick', avatar: 'https://sleepercdn.com/avatars/thumbs/a852313daa7d5376a2780407541e051e', isActive: true, status: 'Active' },
    { id: '870840753167962112', alias: 'Asher', avatar: 'https://sleepercdn.com/avatars/thumbs/a0365fe3ac0dfdc1ecab52574c2662d0', isActive: true, status: 'Active' },
    // 8 Retired Managers
    { id: '1132016225690722304', alias: 'Dylan', avatar: 'https://sleepercdn.com/avatars/thumbs/f0edbf4278f53f9425db175073df6584', isActive: false, status: 'Retired', lastSeenYear: 2025 },
    { id: '1126319416876101632', alias: 'Mason', avatar: 'https://sleepercdn.com/avatars/thumbs/969db25e34b3c959787a586164b8c4ed', isActive: false, status: 'Retired', lastSeenYear: 2025 },
    { id: '870523595099676672', alias: 'Noah', avatar: 'https://sleepercdn.com/avatars/thumbs/e2f8da678722bdf5e4e379885b80577f', isActive: false, status: 'Retired', lastSeenYear: 2025 },
    { id: '1159164367884361728', alias: 'Isaac', avatar: 'https://sleepercdn.com/avatars/thumbs/f19fa0950aa0789f40f176e69c09b9e2', isActive: false, status: 'Retired', lastSeenYear: 2024 },
    { id: '863583825240977408', alias: 'Jake', avatar: 'https://sleepercdn.com/avatars/thumbs/50d452125f2e2321822e51af1bffac9e', isActive: false, status: 'Retired', lastSeenYear: 2024 },
    { id: '863850812517011456', alias: 'Wade', avatar: 'https://sleepercdn.com/avatars/thumbs/4f4090e5e9c3941414db40a871e3e909', isActive: false, status: 'Retired', lastSeenYear: 2024 },
    { id: '1014302563640332288', alias: 'Name2?', avatar: 'https://sleepercdn.com/avatars/thumbs/4f4090e5e9c3941414db40a871e3e909', isActive: false, status: 'Retired', lastSeenYear: 2023 },
    { id: '870409523838558208', alias: 'Armaan', avatar: 'https://sleepercdn.com/avatars/thumbs/a45e1e20493fb24e7ecc9c7922c81421', isActive: false, status: 'Retired', lastSeenYear: 2023 }
  ];

  const lamarkableMembers = lamarkableCanonical.map(m => ({
    id: m.id,
    name: m.alias,
    alias: m.alias,
    canonical_name: m.alias,
    manager_name: m.alias,
    avatar: m.avatar,
    avatar_url: m.avatar,
    logo_url: m.avatar,
    isActive: m.isActive,
    status: m.status,
    is_retired: !m.isActive,
    lastSeenYear: m.lastSeenYear || 2026,
    platform_ids: [m.id],
    espn_ids: [m.id]
  }));

  await putJson('leagues/lamarkablefantasy/members', lamarkableMembers);
  await putJson('leagues/lamarkablefantasy/managers', lamarkableMembers);
  console.log(`  -> Restored all ${lamarkableMembers.length} managers (${lamarkableMembers.filter(m => m.isActive).length} active, ${lamarkableMembers.filter(m => !m.isActive).length} retired) in lamarkablefantasy`);

  // ==========================================
  // 4. FBO
  // ==========================================
  console.log('\n[4/5] Processing fbo...');
  const fboCanonical = [
    // 12 Active Managers
    { id: '{03C41B96-9DA4-4E36-841B-969DA46E3647}', alias: 'Owen', isActive: true, status: 'Active' },
    { id: '{1CED4131-A35F-4474-818C-1D6644AFBC68}', alias: 'Aidan', isActive: true, status: 'Active' },
    { id: '{2EB6D3D6-9070-41AF-8938-CE0DA43F20F3}', alias: 'Sean', isActive: true, status: 'Active' },
    { id: '{49438BA4-60B5-4880-928B-40697D861EF5}', alias: 'Will', isActive: true, status: 'Active' },
    { id: '{6859D6E4-7B10-48EA-99D6-E47B1098EA99}', alias: 'Seb', isActive: true, status: 'Active' },
    { id: '{6DF8D817-FF00-422B-B584-F062BADD6D5B}', alias: 'Calvin', isActive: true, status: 'Active' },
    { id: '{702EEE14-4AE6-4660-A677-CD95ECF7ABF9}', alias: 'Cai', isActive: true, status: 'Active' },
    { id: '{826A6C01-F553-441F-982E-773775589D49}', alias: 'Jaiden', isActive: true, status: 'Active' },
    { id: '{BE0E4E44-DCE5-4322-813A-ADE6140C753A}', alias: 'William', isActive: true, status: 'Active' },
    { id: '{F3B6AB0A-B698-4B2F-A5AD-F4DFA6AACC9F}', alias: 'LJ', isActive: true, status: 'Active' },
    { id: '{F8B7D810-07D6-4C1D-9B9B-B814ACCA9DDE}', alias: 'Luke', isActive: true, status: 'Active' },
    { id: '{FEE2A155-2596-42C9-8F0B-DC309135AEE5}', alias: 'David', isActive: true, status: 'Active' },
    // 2 Retired Managers
    { id: '{5D90D910-CFCE-42BC-B117-ED2642382FD6}', alias: 'Aidan', isActive: false, status: 'Retired', lastSeenYear: 2024 },
    { id: '{F8DAAAC3-4203-47BF-8375-80F56D954401}', alias: 'Kalell', isActive: false, status: 'Retired', lastSeenYear: 2022 }
  ];

  const fboMembers = fboCanonical.map(m => ({
    id: m.id,
    name: m.alias,
    alias: m.alias,
    canonical_name: m.alias,
    manager_name: m.alias,
    isActive: m.isActive,
    status: m.status,
    is_retired: !m.isActive,
    lastSeenYear: m.lastSeenYear || 2026,
    platform_ids: [m.id],
    espn_ids: [m.id]
  }));

  await putJson('leagues/fbo/members', fboMembers);
  await putJson('leagues/fbo/managers', fboMembers);
  console.log(`  -> Restored all ${fboMembers.length} managers (${fboMembers.filter(m => m.isActive).length} active, ${fboMembers.filter(m => !m.isActive).length} retired) in fbo`);

  // ==========================================
  // 5. AB THERAPY LEAGUE
  // ==========================================
  console.log('\n[5/5] Processing abtherapyleague...');
  const abCanonical = [
    // 10 Active Managers
    { id: '{21A18AF1-3FEA-423C-B67D-0B2F6D6C6380}', alias: 'Roman', isActive: true, status: 'Active' },
    { id: '{2565CDFF-5036-4C66-B5A0-C1629A56F4E9}', alias: 'Dario', isActive: true, status: 'Active' },
    { id: '{3080A622-F0E1-4574-B371-75E8EBB45707}', alias: 'Gabriel', isActive: true, status: 'Active' },
    { id: '{3B2C627D-34B1-41F2-9687-33660A6BCF88}', alias: 'Nick', isActive: true, status: 'Active' },
    { id: '{6859D6E4-7B10-48EA-99D6-E47B1098EA99}', alias: 'Seb', isActive: true, status: 'Active' },
    { id: '{7CF3D38A-9C8C-4D32-AE96-0DE3FB21C786}', alias: 'Akaal', isActive: true, status: 'Active' },
    { id: '{7D95D7E3-9736-4F10-8538-77C3E0E0CC99}', alias: 'Dhilan', isActive: true, status: 'Active' },
    { id: '{97BD5DB0-39ED-4AB0-BDF1-5BCF31BA8EEE}', alias: 'John', isActive: true, status: 'Active' },
    { id: '{E22C6D9E-AE73-49EB-9324-9B68348E6F4A}', alias: 'Francisco', isActive: true, status: 'Active' },
    { id: '{E3403D85-01B9-4812-803D-8501B91812A4}', alias: 'Scott', isActive: true, status: 'Active' },
    // 17 Retired / Historical Managers
    { id: '{6EE5D988-0A56-4F06-9EF3-2D6CDC389FB5}', alias: 'Noah', isActive: false, status: 'Retired', lastSeenYear: 2026 },
    { id: '{B229343A-7BE3-4718-A745-562AC7ECCA53}', alias: 'Ryan', isActive: false, status: 'Retired', lastSeenYear: 2026 },
    { id: '{127816C9-EEA5-4ABB-80D2-0269939469DE}', alias: 'Jaime', isActive: false, status: 'Retired', lastSeenYear: 2024 },
    { id: '{D2FC9F03-8C7B-44CD-BC9F-038C7B34CDA9}', alias: 'Jaidin', isActive: false, status: 'Retired', lastSeenYear: 2024 },
    { id: '{2282B26C-8AF2-4CE2-927B-314BADF25DD1}', alias: 'Mike', isActive: false, status: 'Retired', lastSeenYear: 2023 },
    { id: '{CCBCE3AB-6E7C-4F78-9FCD-91521FCFD4F8}', alias: 'Matt', isActive: false, status: 'Retired', lastSeenYear: 2023 },
    { id: '{1596A9D1-2DEE-4DA8-BDDB-ACC324D666FF}', alias: 'Alex', isActive: false, status: 'Retired', lastSeenYear: 2023 },
    { id: '{43850DCA-B646-476F-8C6F-26F431466BE7}', alias: 'Caden', isActive: false, status: 'Retired', lastSeenYear: 2023 },
    { id: '{8AC152A5-4E97-4730-8F34-84647C366447}', alias: 'Matthew', isActive: false, status: 'Retired', lastSeenYear: 2023 },
    { id: '{9E16D218-E7C0-4F4F-88E3-D0B264FCEB01}', alias: 'Nik', isActive: false, status: 'Retired', lastSeenYear: 2023 },
    { id: '{6D63384B-5F17-43F7-9B7C-CE722DC3CC89}', alias: 'Christopher', isActive: false, status: 'Retired', lastSeenYear: 2023 },
    { id: '{E180C31C-F6D1-411C-B4BD-80543E6F9233}', alias: 'Steven', isActive: false, status: 'Retired', lastSeenYear: 2022 },
    { id: '{59AD4735-06CB-41C0-B9B4-C5E88F5BF343}', alias: 'Jayson', isActive: false, status: 'Retired', lastSeenYear: 2022 },
    { id: '{FD6F79A2-DD9B-41F9-A25E-9AE9B536DC3C}', alias: 'Joe', isActive: false, status: 'Retired', lastSeenYear: 2022 },
    { id: '{28A24199-110B-4942-84A2-5996E0C6C32C}', alias: 'Casey', isActive: false, status: 'Retired', lastSeenYear: 2022 },
    { id: '{0D590ACF-A3A6-4C7E-ABE9-2ACE8620E4D1}', alias: 'Luke', isActive: false, status: 'Retired', lastSeenYear: 2022 },
    { id: '{3FA8A8F1-4424-4879-84A8-ECB90823E096}', alias: 'Jonathan', isActive: false, status: 'Retired', lastSeenYear: 2022 }
  ];

  const abMembers = abCanonical.map(m => ({
    id: m.id,
    name: m.alias,
    alias: m.alias,
    canonical_name: m.alias,
    manager_name: m.alias,
    isActive: m.isActive,
    status: m.status,
    is_retired: !m.isActive,
    lastSeenYear: m.lastSeenYear || 2026,
    platform_ids: [m.id],
    espn_ids: [m.id]
  }));

  await putJson('leagues/abtherapyleague/members', abMembers);
  await putJson('leagues/abtherapyleague/managers', abMembers);
  console.log(`  -> Restored all ${abMembers.length} managers (${abMembers.filter(m => m.isActive).length} active, ${abMembers.filter(m => !m.isActive).length} retired) in abtherapyleague`);

  console.log('\nALL 5 LEAGUES REPAIRED SUCCESSFULLY WITH COMPLETE HISTORICAL AND ACTIVE ALIASES!');
}

main().catch(err => {
  console.error('Fatal repair error:', err);
  process.exit(1);
});
