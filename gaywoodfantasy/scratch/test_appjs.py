import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/data/weekly_player_stats.json") as f:
    stats = json.load(f)

for p in stats:
    if p.get("year") == 2024 and p.get("matchup_week") == 1 and p.get("manager_id") == "ethan":
        print(f"Slot: {p.get('lineup_slot_id')}, IsStarter: {p.get('is_starter')}")
