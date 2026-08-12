import sys
sys.path.append("/Users/Landon/Documents/Fantasy-Website/dad-league/scraper")
from espn_client import ESPNClient
import json

client = ESPNClient()
data = client.fetch_matchups(2023)
for s in data.get("schedule", [])[:1]:
    print(json.dumps(s.get("home", {}), indent=2))
