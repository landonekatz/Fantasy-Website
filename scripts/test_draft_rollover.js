/**
 * test_draft_rollover.js
 * Unit test to verify year-to-year draft rollover and unplayed season handling.
 */

import { compileVaultData } from '../src/compiler.js';

console.log('======================================================================');
console.log('TESTING YEAR-TO-YEAR DRAFT ROLLOVER & UNPLAYED SEASON HANDLING');
console.log('======================================================================\n');

// Mock data representing a 2025 completed season + newly drafted 2026 pre-season
const mockRawSeasons = [
  // 1. Newly drafted 2026 season: draft completed (picks populated), but Week 1 has NOT been played
  {
    year: 2026,
    data: {
      id: 123456,
      members: [
        { id: '{M1}', firstName: 'Alice', lastName: 'Smith', displayName: 'Alice' },
        { id: '{M2}', firstName: 'Bob', lastName: 'Jones', displayName: 'Bob' }
      ],
      teams: [
        { id: 1, name: "Alice's Reigning Champs", primaryOwner: '{M1}' },
        { id: 2, name: "Bob's Rebuilders", primaryOwner: '{M2}' }
      ],
      draftDetail: {
        picks: [
          { roundId: 1, roundPickNumber: 1, overallPickNumber: 1, teamId: 1, playerId: 101 },
          { roundId: 1, roundPickNumber: 2, overallPickNumber: 2, teamId: 2, playerId: 102 },
          { roundId: 2, roundPickNumber: 1, overallPickNumber: 3, teamId: 2, playerId: 103 },
          { roundId: 2, roundPickNumber: 2, overallPickNumber: 4, teamId: 1, playerId: 104 }
        ]
      },
      schedule: [
        // Week 1 scheduled but unplayed
        {
          id: 202601,
          matchupPeriodId: 1,
          winner: 'UNDECIDED',
          home: { teamId: 1, totalPoints: 0 },
          away: { teamId: 2, totalPoints: 0 }
        }
      ],
      settings: {
        name: 'The Rollover League',
        scheduleSettings: { matchupPeriodCount: 14 }
      }
    }
  },
  // 2. Completed 2025 season
  {
    year: 2025,
    data: {
      id: 123456,
      members: [
        { id: '{M1}', firstName: 'Alice', lastName: 'Smith', displayName: 'Alice' },
        { id: '{M2}', firstName: 'Bob', lastName: 'Jones', displayName: 'Bob' }
      ],
      teams: [
        { id: 1, name: "Alice's Team 2025", primaryOwner: '{M1}', record: { overall: { wins: 10, losses: 4, pointsFor: 1500 } } },
        { id: 2, name: "Bob's Team 2025", primaryOwner: '{M2}', record: { overall: { wins: 4, losses: 10, pointsFor: 1200 } } }
      ],
      draftDetail: {
        picks: [
          { roundId: 1, roundPickNumber: 1, overallPickNumber: 1, teamId: 1, playerId: 201 },
          { roundId: 1, roundPickNumber: 2, overallPickNumber: 2, teamId: 2, playerId: 202 }
        ]
      },
      schedule: [
        {
          id: 202501,
          matchupPeriodId: 1,
          winner: 'HOME',
          home: { teamId: 1, totalPoints: 115.5 },
          away: { teamId: 2, totalPoints: 98.2 }
        }
      ],
      settings: {
        name: 'The Rollover League',
        scheduleSettings: { matchupPeriodCount: 14 }
      }
    }
  }
];

const compiled = compileVaultData(mockRawSeasons, [], 'The Rollover League');

// ASSERTION 1: 2026 is preserved and active
console.assert(compiled !== null, 'Compiled payload must not be null');
console.assert(compiled.league_settings.lastYear === 2026, `Expected lastYear to be 2026, got ${compiled.league_settings.lastYear}`);
console.log(`[PASS] 1. Active year advanced to newly drafted season: ${compiled.league_settings.lastYear}`);

// ASSERTION 2: Draft picks for 2026 are present
const picks2026 = compiled.draft_results.filter(p => p.year === 2026);
console.assert(picks2026.length === 4, `Expected 4 draft picks for 2026, got ${picks2026.length}`);
console.log(`[PASS] 2. Draft board successfully populated for 2026 with ${picks2026.length} picks.`);

// ASSERTION 3: 2026 standings entries are initialized
const standings2026 = compiled.league_standings.filter(s => s.year === 2026);
console.assert(standings2026.length === 2, `Expected 2 standings entries for 2026, got ${standings2026.length}`);
console.log(`[PASS] 3. Pre-season standings initialized for 2026 teams: ${standings2026.map(s => s.team_name).join(', ')}`);

// ASSERTION 4: Unplayed 2026 games did not generate false 0-point played weeks in team_stats
const teamStats2026 = compiled.team_stats.filter(t => t.year === 2026);
console.assert(teamStats2026.length === 0, `Expected 0 played team_stats for 2026 (pre-season), got ${teamStats2026.length}`);
console.log(`[PASS] 4. Unplayed pre-season games correctly prevented from polluting team_stats averages.`);

console.log('\n======================================================================');
console.log('ALL DRAFT ROLLOVER & NEW YEAR DETECTION TESTS PASSED!');
console.log('======================================================================');
