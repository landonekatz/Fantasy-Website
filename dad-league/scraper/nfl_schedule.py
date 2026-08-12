import csv
import os

_schedule = None

def get_nfl_game(season, week, pro_team_abbr):
    """
    Looks up an NFL game in nfl_all_games_master.csv.
    Returns: (opponent_abbr, game_result_string)
    Example: get_nfl_game(2023, 1, "KC") -> ("DET", "L 20-21")
    """
    global _schedule
    if _schedule is None:
        _schedule = {}
        csv_path = os.path.join(os.path.dirname(__file__), "..", "nfl_all_games_master.csv")
        if not os.path.exists(csv_path):
            return None, None
            
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # We only care about regular season games for fantasy, or maybe playoffs too? 
                # Boxscores are matched by season and week. The CSV has 'season' and 'week'
                try:
                    s = int(row["season"])
                    w = int(row["week"])
                except ValueError:
                    continue
                
                home = row["home_team"]
                away = row["away_team"]
                try:
                    h_score = int(row["home_score"])
                    a_score = int(row["away_score"])
                except:
                    continue
                    
                key_home = (s, w, home)
                key_away = (s, w, away)
                
                # Format: "W 21-20" or "L 20-21" or "T 20-20"
                if h_score > a_score:
                    h_res = f"W {h_score}-{a_score}"
                    a_res = f"L {a_score}-{h_score}"
                elif a_score > h_score:
                    h_res = f"L {h_score}-{a_score}"
                    a_res = f"W {a_score}-{h_score}"
                else:
                    h_res = f"T {h_score}-{a_score}"
                    a_res = f"T {a_score}-{h_score}"
                    
                _schedule[key_home] = (away, h_res)
                _schedule[key_away] = ("@" + home, a_res)

    # Some mappings might differ between ESPN and this CSV
    # E.g. WSH might be WAS in CSV? Let's check.
    # The csv dump showed: WAS, WSH (maybe both?). 
    # Let's map typical alternatives
    alts = [pro_team_abbr]
    if pro_team_abbr == "WSH": alts.append("WAS")
    if pro_team_abbr == "WAS": alts.append("WSH")
    if pro_team_abbr == "LV": alts.extend(["LVR", "OAK", "RAI"])
    if pro_team_abbr == "LAR": alts.extend(["LA", "RAM"])
    if pro_team_abbr == "LAC": alts.extend(["SD", "CHA"])
    
    for alt in alts:
        key = (season, week, alt)
        if key in _schedule:
            return _schedule[key]
            
    return None, None
