import json
with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/matchups.json") as f:
    matchups = json.load(f)
c = 0
for m in matchups:
    if m.get("year") == 2018 and m.get("week") == 1:
        c += 1
print("Matchups in 2018 W1:", c)
