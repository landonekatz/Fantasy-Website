import sys
sys.path.append("/Users/Landon/Documents/Fantasy-Website/dad-league/scraper")
from espn_client import ESPNClient
import json

client = ESPNClient()
url = f"https://fantasy.espn.com/apis/v3/games/ffl/seasons/2023/segments/0/leagues/262404"
res = client._get(url, {"scoringPeriodId": 1, "view": ["mBoxscore", "mProTeamSchedules_wl"]})
if "proGames" in res:
    print(list(res["proGames"].keys())[:2])
    print(res["proGames"]["10"]["10"]["games"])
