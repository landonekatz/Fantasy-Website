"""
ESPN Fantasy Football API Probe Results — League 262404

DATA AVAILABILITY SUMMARY
==========================
Year   Teams  Matchups  Scores  Draft   Boxscore (player-level)
2015   12     ✅         ✅       ✅       ❌  (team totals + pointsByScoringPeriod only)
2016   12     ✅         ✅       ✅       ❌  (team totals + pointsByScoringPeriod only)
2017   12     ✅         ✅       ✅       ❌  (team totals + pointsByScoringPeriod only)
2018   12     ✅         ✅       ✅       ✅  (individual player scores available)
2019   12     ✅         ✅       ✅       ✅
2020   10     ✅         ✅       ✅       ✅
2021   12     ✅         ✅       ✅       ✅
2022   12     ✅         ✅       ✅       ✅
2023   12     ✅         ✅       ✅       ✅
2024   12     ✅         ✅       ✅       ✅
2025   12     ✅         ✅       ✅       ✅  (active season)

KEY FINDINGS
============
- Members (actual user names/IDs) are fully available for ALL years
- Team names, records (W/L/PF/PA) available for ALL years
- Match scores (totalPoints per team, pointsByScoringPeriod per week) available for ALL years
- Draft picks (playerIds, round, pick#, keeper flag) available for ALL years
- Player-level boxscores (who was started, individual player scores) available 2018+
- 2015-2017 gap: we know TEAM scores for each week but NOT which players scored what

MEMBER STRUCTURE
================
members[]: id (SWID-like), displayName, firstName, lastName
teams[]:   id, name, abbrev, primaryOwner (links to member id), owners[], record{}

MATCHUP STRUCTURE (all years)
==============================
schedule[]: matchupPeriodId, winner, home{teamId, totalPoints, pointsByScoringPeriod}, away{...}
- pointsByScoringPeriod: {scoringPeriodId: points} — gives week-by-week breakdown for 2-week playoff matchups

BOXSCORE STRUCTURE (2018+)
==========================
home.rosterForCurrentScoringPeriod.entries[]:
  - lineupSlotId (position slot: 0=QB, 2=RB, 4=WR, 6=TE, 17=K, 16=D/ST, 20=Bench, 21=IR)
  - playerId
  - playerPoolEntry.player.fullName
  - playerPoolEntry.player.proTeamId
  - playerPoolEntry.appliedStatTotal  (fantasy points scored)

DRAFT STRUCTURE (all years)
============================
draftDetail.picks[]:
  - roundId, roundPickNumber, overallPickNumber
  - playerId (need player name lookup)
  - teamId
  - keeper (bool)
  - bidAmount (for auction leagues, 0 for snake)

SETTINGS STRUCTURE
==================
scheduleSettings: playoffTeamCount, matchupPeriodCount, matchupPeriods{}
status: currentMatchupPeriod, finalScoringPeriod, latestScoringPeriod
"""
