const fs = require('fs');

async function test() {
  const url = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2023/segments/0/leagues/262404?view=mMatchupScore&view=mTransactions2';
  const res = await fetch(url);
  const data = await res.json();
  if (data.schedule && data.schedule[0] && data.schedule[0].home) {
     const entries = data.schedule[0].home.rosterForCurrentScoringPeriod?.entries || [];
     console.log("Roster entries count:", entries.length);
     if (entries.length > 0) {
        console.log("Entry keys:", Object.keys(entries[0]));
        if (entries[0].playerPoolEntry) {
            console.log("Player pool entry keys:", Object.keys(entries[0].playerPoolEntry));
        }
     }
  }
  if (data.transactions) {
     console.log("Transactions count:", data.transactions.length);
  }
}
test();
