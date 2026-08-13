async function test() {
  const url = 'https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/2023/segments/0/leagues/262404?view=mTeam&view=mRoster&view=mMatchup&view=mSettings&view=mStandings&view=mDraftDetail&view=mMatchupScore';
  const res = await fetch(url);
  const text = await res.text();
  console.log('Size with mMatchupScore (bytes):', text.length);
}
test();
