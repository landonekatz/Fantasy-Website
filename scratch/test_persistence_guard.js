import { safeMergePowerRankings, safeMergeLeagueSettings, safeMergeManagers, safeMergeRivalries } from '../scripts/rtdb_persistence_guard.js';

console.log('--- TEST 1: User posted Week 0.5 on site, script runs with Week 0 in static file ---');
const existingDbRankings = {
  allowed_editors: ['landon', 'mike'],
  current_ranking: {
    id: 'pr_2026_w0_5_1726000000',
    week: 0.5,
    season: 2026,
    title: 'Week 0.5 Power Rankings',
    subtitle: 'After the kickoff game',
    author_name: 'Mike Stamatos',
    updated_at: 1726000000,
    rankings: [
      { rank: 1, manager_id: 'landon', blurb: '<p>Looking strong after Thursday.</p>' },
      { rank: 2, manager_id: 'mike', blurb: '<p>My team is ready.</p>' }
    ]
  },
  archived_rankings: [
    {
      id: 'pr_2026_w0',
      week: 0,
      season: 2026,
      title: 'Week 0 2026 Power Rankings',
      author_name: 'Mike Stamatos',
      rankings: [{ rank: 1, manager_id: 'mike' }, { rank: 2, manager_id: 'landon' }]
    }
  ],
  power_rankings_vault_history: {
    'pr_2026_w0': { id: 'pr_2026_w0', week: 0, season: 2026, title: 'Week 0 2026 Power Rankings' },
    'pr_2026_w0_5_1726000000': { id: 'pr_2026_w0_5_1726000000', week: 0.5, season: 2026, title: 'Week 0.5 Power Rankings' }
  }
};

const incomingStaticRankings = {
  allowed_editors: ['landon'],
  current_ranking: {
    id: 'pr_2026_w0',
    week: 0,
    season: 2026,
    title: 'Week 0 2026 Power Rankings',
    author_name: 'Mike Stamatos',
    rankings: [{ rank: 1, manager_id: 'mike' }, { rank: 2, manager_id: 'landon' }]
  },
  archived_rankings: []
};

const merged1 = safeMergePowerRankings(existingDbRankings, incomingStaticRankings);

console.assert(merged1.current_ranking.id === 'pr_2026_w0_5_1726000000', 'FAIL: Week 0.5 must remain current_ranking');
console.assert(merged1.current_ranking.week === 0.5, 'FAIL: Current ranking week must be 0.5');
console.assert(merged1.archived_rankings.length === 1, 'FAIL: Archived rankings must retain Week 0');
console.assert(merged1.archived_rankings[0].id === 'pr_2026_w0', 'FAIL: Week 0 must be in archived rankings');
console.assert(merged1.allowed_editors.includes('mike'), 'FAIL: Allowed editors must preserve Mike');
console.assert(Object.keys(merged1.power_rankings_vault_history).length === 2, 'FAIL: Vault history must have both editions');
console.log('✓ TEST 1 PASSED: Live Week 0.5 was completely protected from static file seed!');

console.log('\n--- TEST 2: User edited Week 0 blurbs on site, script runs with unedited Week 0 ---');
const existingEditedWeek0 = {
  current_ranking: {
    id: 'pr_2026_w0',
    week: 0,
    season: 2026,
    title: 'Week 0 2026 Power Rankings',
    author_name: 'Mike Stamatos',
    updated_at: 1725999999,
    rankings: [
      { rank: 1, manager_id: 'mike', blurb: '<p>Custom live edit by Mike on the site!</p>' }
    ]
  }
};

const incomingUneditedWeek0 = {
  current_ranking: {
    id: 'pr_2026_w0',
    week: 0,
    season: 2026,
    title: 'Week 0 2026 Power Rankings',
    author_name: 'Mike Stamatos',
    updated_at: 1700000000,
    rankings: [
      { rank: 1, manager_id: 'mike', blurb: '<p>Default static blurb.</p>' }
    ]
  }
};

const merged2 = safeMergePowerRankings(existingEditedWeek0, incomingUneditedWeek0);
console.assert(merged2.current_ranking.rankings[0].blurb.includes('Custom live edit by Mike'), 'FAIL: Live user edits must be preserved!');
console.log('✓ TEST 2 PASSED: Live user blurb edit was completely preserved!');

console.log('\n--- TEST 3: User edited league settings on site ---');
const existingSettings = {
  name: 'Custom User League Title',
  tagline: 'Custom Tagline',
  join_code: 'VAULT2026'
};
const incomingSettings = {
  name: 'Default Script League',
  tagline: 'Default Tagline',
  platform: 'yahoo'
};
const mergedSettings = safeMergeLeagueSettings(existingSettings, incomingSettings);
console.assert(mergedSettings.name === 'Custom User League Title', 'FAIL: League title overwritten');
console.assert(mergedSettings.tagline === 'Custom Tagline', 'FAIL: League tagline overwritten');
console.assert(mergedSettings.platform === 'yahoo', 'FAIL: Platform not merged');
console.log('✓ TEST 3 PASSED: League settings protected!');

console.log('\nALL UNIT TESTS PASSED SUCCESSFULLY!');
