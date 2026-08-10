"""
Comprehensive Historical Fantasy Football HTML Parser.
Transforms raw Yahoo Fantasy HTML archives (2018-2027) into clean relational JSON datasets.
Handles:
  - Canonical Manager identity mapping (with automatic fallback & warning for unmapped teams)
  - League Standings & Season Metadata
  - Weekly Matchups & Head-to-Head Scores (matchups.json)
  - Player-Level Granular Boxscores (Starters & Bench, Actual/Projected Points, Injury Badges Q/O/IR/D)
  - Complete Transactions & Roster Moves (transactions.json)
  - Draft Results (All Rounds across all tables) (draft_results.json)
  - Seasonal Aggregate Team Stats (team_stats.json)
"""
import os
import re
import json
import urllib.request
from pathlib import Path
from bs4 import BeautifulSoup

try:
    from .config import (
        RAW_DATA_DIR, PROCESSED_DATA_DIR, MANAGERS_JSON_PATH,
        LEAGUE_STANDINGS_JSON, MATCHUPS_JSON, WEEKLY_PLAYER_STATS_JSON,
        DRAFT_RESULTS_JSON, TEAM_STATS_JSON
    )
except ImportError:
    from config import (
        RAW_DATA_DIR, PROCESSED_DATA_DIR, MANAGERS_JSON_PATH,
        LEAGUE_STANDINGS_JSON, MATCHUPS_JSON, WEEKLY_PLAYER_STATS_JSON,
        DRAFT_RESULTS_JSON, TEAM_STATS_JSON
    )


def load_managers_config():
    """Loads canonical managers and team_mappings from data/managers.json."""
    if not MANAGERS_JSON_PATH.exists():
        return {"managers": [], "team_mappings": []}
    with open(MANAGERS_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_managers_config(config):
    """Saves updated canonical managers config back to data/managers.json."""
    with open(MANAGERS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


def clean_team_name(name):
    if not name:
        return ""
    name = str(name).replace("’", "'").replace("‘", "'").replace("\u2019", "'").replace("\u2018", "'")
    if "LGBTQB1" in name:
        name = re.sub(r"LGBTQB1.*", "LGBTQB1", name)
    return name.strip()


def get_canonical_manager(year, team_id, team_name, config=None):
    """
    Resolves any historical team to its canonical manager slug and display name.
    1. Checks explicit team_mappings in data/managers.json.
    2. Checks keyword match against known canonical names.
    3. Prints warning if unmapped so the user can easily update managers.json.
    """
    if config is None:
        config = load_managers_config()

    year = int(year)
    team_id = int(team_id) if team_id is not None else None
    team_name = clean_team_name(team_name)

    # 1. Explicit mapping check by (year, team_id) or (year, team_name)
    tname_clean = team_name.lower().strip() if team_name else ""
    is_truncated = tname_clean.endswith("...") or tname_clean.endswith("…")
    prefix_clean = tname_clean.rstrip(".…").strip() if is_truncated else ""

    for mapping in config.get("team_mappings", []):
        if mapping.get("year") != year:
            continue

        m_id = mapping.get("team_id")
        m_name_clean = mapping.get("team_name", "").lower().strip()

        id_match = team_id is not None and m_id == team_id
        exact_name_match = tname_clean and m_name_clean == tname_clean
        prefix_name_match = (
            is_truncated
            and prefix_clean
            and len(prefix_clean) >= 4
            and m_name_clean.startswith(prefix_clean)
        )

        if id_match or exact_name_match or prefix_name_match:
            mgr_id = mapping.get("manager_id")
            for m in config.get("managers", []):
                if m["id"] == mgr_id:
                    return {"id": m["id"], "name": m["name"], "status": m["status"]}

    # 2. Heuristic keyword matches for known manager / team names
    name_lower = team_name.lower().strip() if team_name else ""
    if name_lower:
        known_mappings = {
            "alex": "alex",
            "frenchy": "alex",
            "frenchfrey": "alex",
            "benjamin": "benjamin",
            "cogger": "carson",
            "carson": "carson",
            "ceedeez nutz": "carson",
            "isabella": "isabella",
            "heisenberg": "isabella",
            "dumpster fire": "isabella",
            "jack": "jack",
            "jackie": "jack",
            "liggity": "jack",
            "jake": "jake",
            "it didn": "jake",
            "king is back": "jake",
            "the king is": "jake",
            "jj and the gang": "isabella",
            "run it back": "jake",
            "actually sco": "jake",
            "bobdiscount": "landon",
            "anita max wynn": "landon",
            "landon": "landon",
            "dawn": "landon",
            "i have never": "landon",
            "justinian ii": "landon",
            "misunderstoo": "landon",
            "3 o'clock boys": "luke_b",
            "3oclock": "luke_b",
            "luke b": "luke_b",
            "poop game": "luke",
            "skid marks": "luke",
            "lukey": "luke",
            "luke": "luke",
            "loser pov": "jordan",
            "winner pov": "jordan",
            "jalens dick": "luke",
            "come lick": "luke",
            "mike": "mike",
            "michael": "mike",
            "the dream is": "mike",
            "will": "will",
            "willis": "will",
            "sub par carr": "jordan",
            "yusuf": "yusuf",
            "lgbtqb1": "jordan",
            "bugs bunny rules": "jordan",
            "ryan": "ryan",
            "sun… dog?": "ryan",
            "sun... dog?": "ryan",
            "jordan": "jordan",
            "jfoggy": "jordan",
            "marty": "joey",
            "joey": "joey",
            "lavar": "luke",
            "charley": "charley",
            "tyfood": "ty",
            "madoc": "madoc",
        }
        for kw, target_id in known_mappings.items():
            if kw in name_lower:
                for m in config.get("managers", []):
                    if m["id"] == target_id:
                        return {"id": m["id"], "name": m["name"], "status": m["status"]}

    # 3. Unmapped warning only if we actually have a team name that couldn't be resolved
    if team_name and not name_lower.startswith(("traded to", "vetoed trade")):
        print(f"    [UNMAPPED TEAM] Season {year}, Team ID {team_id}: '{team_name}'. Needs canonical assignment.")
    return {"id": f"unmapped_{team_id}", "name": team_name or f"Team {team_id}", "status": "unknown"}


def parse_seasons_metadata_and_standings(seasons, config=None):
    """
    Parses regular season standings and season metadata for all requested seasons.
    Returns structured standings list, season metadata list, and a lookup dict of (year, team_id)->team_name.
    """
    if config is None:
        config = load_managers_config()

    standings_data = []
    metadata_data = []
    team_names_lookup = {}

    for year in seasons:
        file_path = RAW_DATA_DIR / str(year) / "league_info" / "standings.html"
        if not file_path.exists():
            continue

        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            html = f.read()

        soup = BeautifulSoup(html, "html.parser")
        tables = soup.find_all("table")
        if len(tables) < 2:
            continue

        standings_table = tables[1]
        rows = standings_table.find_all("tr")

        season_teams = []
        for row in rows[1:]:
            cells = row.find_all(["td", "th"])
            if len(cells) < 5:
                continue

            rank_str = cells[0].get_text(strip=True).replace("*", "")
            rank = int(rank_str) if rank_str.isdigit() else 0

            team_cell = cells[1]
            team_name = clean_team_name(team_cell.get_text(strip=True).replace("\ue010", "").strip())
            a_tag = team_cell.find("a")
            team_id = 0
            if a_tag and "href" in a_tag.attrs:
                parts = a_tag["href"].rstrip("/").split("/")
                if parts[-1].isdigit():
                    team_id = int(parts[-1])

            wlt_str = cells[2].get_text(strip=True)
            wlt_parts = re.split(r"[-–]", wlt_str)
            wins = int(wlt_parts[0]) if len(wlt_parts) > 0 and wlt_parts[0].isdigit() else 0
            losses = int(wlt_parts[1]) if len(wlt_parts) > 1 and wlt_parts[1].isdigit() else 0
            ties = int(wlt_parts[2]) if len(wlt_parts) > 2 and wlt_parts[2].isdigit() else 0

            total_games = wins + losses + ties
            win_pct = round((wins + 0.5 * ties) / total_games, 3) if total_games > 0 else 0.0

            pf_str = cells[3].get_text(strip=True).replace(",", "")
            pa_str = cells[4].get_text(strip=True).replace(",", "")
            pf = float(pf_str) if pf_str.replace(".", "", 1).isdigit() else 0.0
            pa = float(pa_str) if pa_str.replace(".", "", 1).isdigit() else 0.0
            streak = cells[5].get_text(strip=True) if len(cells) > 5 else ""
            img_tag = row.find("img")
            logo_url = img_tag.get("src", "") if img_tag else ""

            faab_balance = 0
            waiver_order = 0
            if len(cells) == 9: # Rank, Team, W-L-T, PF, PA, Streak, Waiver Bdgt, Waiver, Moves
                faab_str = cells[6].get_text(strip=True).replace("$", "").replace(",", "")
                if faab_str.isdigit():
                    faab_balance = int(faab_str)
                waiver_str = cells[7].get_text(strip=True)
                if waiver_str.isdigit():
                    waiver_order = int(waiver_str)
                moves_str = cells[8].get_text(strip=True)
            elif len(cells) >= 8: # Rank, Team, W-L-T, PF, PA, Streak, Waiver, Moves
                waiver_str = cells[6].get_text(strip=True)
                if waiver_str.isdigit():
                    waiver_order = int(waiver_str)
                moves_str = cells[7].get_text(strip=True)
            else:
                moves_str = "0"
            moves = int(moves_str) if moves_str.isdigit() else 0

            team_names_lookup[(year, team_id)] = team_name
            mgr = get_canonical_manager(year, team_id, team_name, config)
            if logo_url:
                # Download logo locally
                local_logo_path = f"assets/logos/{mgr['id']}.jpg"
                full_logo_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "logos", f"{mgr['id']}.jpg")
                if not os.path.exists(full_logo_path):
                    try:
                        req = urllib.request.Request(logo_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})
                        with urllib.request.urlopen(req) as response, open(full_logo_path, 'wb') as out_file:
                            out_file.write(response.read())
                    except Exception as e:
                        print(f"Warning: Failed to download logo for {mgr['id']}: {e}")
                
                # Assign local path to manager config
                for m_cfg in config.get("managers", []):
                    if m_cfg["id"] == mgr["id"]:
                        m_cfg["logo_url"] = local_logo_path
                        # Set current_team_name for easy frontend access
                        if year == max(seasons):
                            m_cfg["current_team_name"] = team_name

            team_record = {
                "season": year,
                "rank": rank,
                "team_id": team_id,
                "team_name": team_name,
                "manager_id": mgr["id"],
                "manager_name": mgr["name"],
                "manager_status": mgr["status"],
                "logo_url": local_logo_path if logo_url else "",
                "waiver_order": waiver_order,
                "faab_balance": faab_balance,
                "wins": wins,
                "losses": losses,
                "ties": ties,
                "win_pct": win_pct,
                "points_for": pf,
                "points_against": pa,
                "streak": streak,
                "transactions": moves,
                "made_playoffs": "*" in cells[0].get_text(strip=True),
            }
            season_teams.append(team_record)

        standings_data.extend(season_teams)

        matchups_dir = RAW_DATA_DIR / str(year) / "matchups"
        scoreboard_files = list(matchups_dir.glob("scoreboard_wk*.html")) if matchups_dir.exists() else []
        total_weeks = len(scoreboard_files)
        reg_weeks = 14
        if total_weeks < reg_weeks and total_weeks > 0:
            reg_weeks = total_weeks

        metadata_data.append({
            "season": year,
            "num_teams": len(season_teams),
            "regular_season_weeks": reg_weeks,
            "total_weeks_scraped": total_weeks,
            "playoff_teams": 6 if len([t for t in season_teams if t["made_playoffs"]]) > 4 else 4,
        })

    # Save updated manager logos back to managers.json
    save_managers_config(config)

    return standings_data, metadata_data, team_names_lookup


def parse_transactions(seasons, config=None):
    """
    Parses all paginated transaction files across seasons.
    Extracts adds, drops, trades, and winning FAAB bids.
    """
    if config is None:
        config = load_managers_config()

    transactions_data = []
    for year in seasons:
        tx_dir = RAW_DATA_DIR / str(year) / "transactions"
        if not tx_dir.exists():
            continue

        for file_path in sorted(tx_dir.glob("transactions_all_count*.html"), key=lambda x: int(re.search(r"count(\d+)", x.name).group(1)) if re.search(r"count(\d+)", x.name) else 0):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                html = f.read()

            soup = BeautifulSoup(html, "html.parser")
            table = soup.find("table")
            if not table:
                continue

            for row in table.find_all("tr")[1:]:
                cells = row.find_all(["td", "th"])
                if len(cells) < 3:
                    continue

                player_cell_text = cells[1].get_text(separator=" ", strip=True)
                manager_cell_text = cells[2].get_text(separator=" | ", strip=True)

                move_type = "add/drop"
                if "Trade" in player_cell_text or "traded" in player_cell_text.lower():
                    move_type = "trade"
                elif "Waiver" in player_cell_text:
                    move_type = "waiver"
                elif "Free Agent" in player_cell_text:
                    move_type = "free_agent"

                s = list(cells[1].stripped_strings)
                added_players = []
                dropped_players = []
                traded_players = []
                trade_partner_team = ""
                trade_partner_mgr_id = ""
                trade_partner_mgr_name = ""

                i = 0
                while i < len(s):
                    token = s[i]
                    if " - " in token and i > 0:
                        pname = s[i-1]
                        j = i + 1
                        action = ""
                        while j < len(s) and (" - " not in s[j] and "Traded to" not in s[j]):
                            if s[j] in ["Free Agent", "Waiver", "To Waivers"]:
                                action = s[j]
                                break
                            j += 1
                        if action in ["Free Agent", "Waiver"]:
                            added_players.append(pname)
                        elif action == "To Waivers":
                            dropped_players.append(pname)
                        elif "Traded to" in s:
                            traded_players.append(pname)
                    elif token == "Traded to" and i + 1 < len(s):
                        trade_partner_team = s[i+1]
                        pmgr = get_canonical_manager(year, None, trade_partner_team, config)
                        trade_partner_mgr_id = pmgr["id"]
                        trade_partner_mgr_name = pmgr["name"]
                    i += 1

                faab_bid = 0
                faab_match = re.search(r"\$(\d+)", player_cell_text)
                if faab_match:
                    faab_bid = int(faab_match.group(1))

                parts = manager_cell_text.split(" | ")
                team_name = clean_team_name(parts[0] if len(parts) > 0 else "")
                timestamp_str = parts[-1] if len(parts) > 1 else ""

                mgr = get_canonical_manager(year, None, team_name, config)

                transactions_data.append({
                    "season": year,
                    "type": move_type,
                    "team_name": team_name,
                    "manager_id": mgr["id"],
                    "manager_name": mgr["name"],
                    "details": player_cell_text,
                    "added_players": added_players,
                    "dropped_players": dropped_players,
                    "traded_players": traded_players,
                    "trade_partner_team": trade_partner_team,
                    "trade_partner_manager_id": trade_partner_mgr_id,
                    "trade_partner_manager_name": trade_partner_mgr_name,
                    "faab_bid": faab_bid,
                    "timestamp": timestamp_str,
                })

    return transactions_data


def parse_draft(seasons, player_lookup=None, config=None):
    """
    Parses draftresults.html for each season across ALL round tables.
    Extracts round, pick number, overall pick, player name, NFL team/position, and cost.
    """
    if config is None:
        config = load_managers_config()

    if player_lookup is None:
        player_lookup = {}

    draft_data = []
    for year in seasons:
        file_path = RAW_DATA_DIR / str(year) / "draft" / "draftresults.html"
        if not file_path.exists():
            continue

        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            html = f.read()

        if "--empty--" in html or "no draft results" in html.lower():
            continue

        soup = BeautifulSoup(html, "html.parser")
        tables = soup.find_all("table")
        if not tables:
            continue

        overall_pick = 0
        for r_idx, table in enumerate(tables):
            current_round = r_idx + 1
            for row in table.find_all("tr")[1:]:
                cells = row.find_all(["td", "th"])
                if len(cells) < 3:
                    continue

                pick_str = cells[0].get_text(strip=True).replace(".", "")
                if not pick_str.isdigit():
                    continue

                pick_in_round = int(pick_str)
                overall_pick += 1

                a_tag = cells[1].find("a", class_="name")
                if a_tag:
                    player_name = a_tag.get_text(strip=True)
                else:
                    player_name = cells[1].get_text(strip=True)

                nfl_team = ""
                position = ""
                full_txt = cells[1].get_text(strip=True)
                m_pos = re.search(r"([A-Z]{2,3})\s*-\s*([A-Z]{1,3})", full_txt)
                if m_pos:
                    nfl_team = m_pos.group(1)
                    position = m_pos.group(2)
                else:
                    p_lower = player_name.lower().strip()
                    if p_lower in player_lookup:
                        nfl_team = player_lookup[p_lower]["nfl_team"]
                        position = player_lookup[p_lower]["position"]

                team_name = clean_team_name(cells[2].get_text(strip=True))

                mgr = get_canonical_manager(year, None, team_name, config)

                draft_data.append({
                    "season": year,
                    "round": current_round,
                    "pick_in_round": pick_in_round,
                    "overall_pick": overall_pick,
                    "team_name": team_name,
                    "manager_id": mgr["id"],
                    "manager_name": mgr["name"],
                    "player_name": player_name,
                    "nfl_team": nfl_team,
                    "position": position,
                })

    return draft_data


def parse_matchups_and_boxscores(seasons, team_names_lookup, config=None, standings_data=None):
    """
    Parses weekly scoreboards and player boxscores across all seasons.
    Extracts head-to-head matchup results, actual/projected scores, and every player line
    including injury status badges ('Q', 'O', 'IR', 'D').
    """
    if config is None:
        config = load_managers_config()

    playoff_team_keys = {(st["season"], st["team_id"]) for st in (standings_data or []) if st.get("made_playoffs")}

    matchups_data = []
    boxscores_data = []

    for year in seasons:
        matchups_dir = RAW_DATA_DIR / str(year) / "matchups"
        if not matchups_dir.exists():
            continue

        all_weeks = set()
        for p in matchups_dir.glob("*wk*.html"):
            m_wk = re.search(r"wk(\d+)", p.name)
            if m_wk:
                all_weeks.add(int(m_wk.group(1)))

        for week_num in sorted(all_weeks):
            wk_file = matchups_dir / f"scoreboard_wk{week_num}.html"

            reg_weeks = 14
            is_playoffs = (week_num > reg_weeks)

            # 1. Parse Scoreboard matchups
            if wk_file.exists():
                with open(wk_file, "r", encoding="utf-8", errors="ignore") as f:
                    html_score = f.read()
                soup_score = BeautifulSoup(html_score, "html.parser")

                p_consolation = None
                for tag in soup_score.find_all("p"):
                    if "Consolation Bracket" in tag.get_text():
                        p_consolation = tag
                        break

                seen_pairs = set()
                for a in soup_score.find_all("a"):
                    href = a.get("href", "")
                    if "matchup?week=" in href and "mid1=" in href and "mid2=" in href:
                        m1_match = re.search(r"mid1=(\d+)", href)
                        m2_match = re.search(r"mid2=(\d+)", href)
                        if not (m1_match and m2_match):
                            continue
                        t1_id = int(m1_match.group(1))
                        t2_id = int(m2_match.group(1))
                        pair_key = tuple(sorted((t1_id, t2_id)))
                        if pair_key in seen_pairs:
                            continue  # avoid duplicates
                        seen_pairs.add(pair_key)

                        container = a.find_parent("li") or a.find_parent("div", class_="matchup") or a.parent.parent
                        if not container:
                            continue

                        is_cons = False
                        if p_consolation and p_consolation.sourceline and a.sourceline:
                            is_cons = (a.sourceline > p_consolation.sourceline)
                        else:
                            prev_p = a.find_previous("p", string=re.compile("Championship Bracket|Consolation Bracket"))
                            if prev_p and "Consolation" in prev_p.get_text():
                                is_cons = True

                        if not is_playoffs:
                            game_type = "regular_season"
                            playoff_round = ""
                        else:
                            if is_cons:
                                li_txt = container.get_text()
                                if "3rd" in li_txt or "3rd Place" in li_txt:
                                    game_type = "consolation - 3rd place"
                                else:
                                    game_type = "consolation"
                                playoff_round = ""
                            else:
                                game_type = "playoffs"
                                playoff_wk_num = week_num - reg_weeks
                                if year <= 2021:
                                    playoff_round = "semifinal" if playoff_wk_num == 1 else "final"
                                else:
                                    playoff_round = "quarterfinal" if playoff_wk_num == 1 else ("semifinal" if playoff_wk_num == 2 else "final")

                        texts = [t for t in container.stripped_strings]

                        # Extract floating point numbers from texts
                        nums = []
                        for txt in texts:
                            txt_clean = txt.replace(",", "")
                            if re.match(r"^\d+\.\d+$", txt_clean):
                                nums.append(float(txt_clean))

                        t1_pts, t1_proj, t2_pts, t2_proj = 0.0, 0.0, 0.0, 0.0
                        if len(nums) >= 4:
                            t1_pts, t1_proj, t2_pts, t2_proj = nums[0], nums[1], nums[2], nums[3]
                        elif len(nums) >= 2:
                            t1_pts, t2_pts = nums[0], nums[1]

                        t1_name = team_names_lookup.get((year, t1_id), f"Team {t1_id}")
                        t2_name = team_names_lookup.get((year, t2_id), f"Team {t2_id}")
                        mgr1 = get_canonical_manager(year, t1_id, t1_name, config)
                        mgr2 = get_canonical_manager(year, t2_id, t2_name, config)

                        winner_id = None
                        if t1_pts > t2_pts:
                            winner_id = t1_id
                        elif t2_pts > t1_pts:
                            winner_id = t2_id

                        matchups_data.append({
                            "season": year,
                            "week": week_num,
                            "is_playoffs": is_playoffs,
                            "game_type": game_type,
                            "playoff_round": playoff_round,
                            "is_playoff_bye": False,
                            "team_1_id": t1_id,
                            "team_1_name": t1_name,
                            "team_1_manager_id": mgr1["id"],
                            "team_1_manager_name": mgr1["name"],
                            "team_1_actual_points": t1_pts,
                            "team_1_projected_points": t1_proj,
                            "team_2_id": t2_id,
                            "team_2_name": t2_name,
                            "team_2_manager_id": mgr2["id"],
                            "team_2_manager_name": mgr2["name"],
                            "team_2_actual_points": t2_pts,
                            "team_2_projected_points": t2_proj,
                            "winner_team_id": winner_id,
                            "margin": round(abs(t1_pts - t2_pts), 2)
                        })
            else:
                seen_pairs = set()
                box_files = sorted(
                    matchups_dir.glob(f"boxscore_wk{week_num}_team*.html"),
                    key=lambda x: int(re.search(r"team(\d+)", x.name).group(1)) if re.search(r"team(\d+)", x.name) else 0
                )
                for bf in box_files:
                    with open(bf, "r", encoding="utf-8", errors="ignore") as fp:
                        html_box = fp.read()
                    m_pair = re.findall(r"(?:recap|matchup)\?week=" + str(week_num) + r"[^\"']*mid1=(\d+)[^\"']*mid2=(\d+)", html_box)
                    if not m_pair:
                        continue
                    t1_id, t2_id = int(m_pair[0][0]), int(m_pair[0][1])
                    pair_key = tuple(sorted((t1_id, t2_id)))
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)

                    soup_box = BeautifulSoup(html_box, "html.parser")
                    scores = []
                    for td in soup_box.find_all("td", class_=re.compile("Fz-xxl|Fz-med|F-shade")):
                        txt = td.get_text(strip=True)
                        if re.match(r"^\d{1,3}\.\d{2}$", txt):
                            scores.append(float(txt))
                    if len(scores) < 4:
                        continue
                    t1_pts, t2_pts, t1_proj, t2_proj = scores[0], scores[1], scores[2], scores[3]

                    t1_name = team_names_lookup.get((year, t1_id), f"Team {t1_id}")
                    t2_name = team_names_lookup.get((year, t2_id), f"Team {t2_id}")
                    mgr1 = get_canonical_manager(year, t1_id, t1_name, config)
                    mgr2 = get_canonical_manager(year, t2_id, t2_name, config)

                    winner_id = None
                    if t1_pts > t2_pts:
                        winner_id = t1_id
                    elif t2_pts > t1_pts:
                        winner_id = t2_id

                    matchups_data.append({
                        "season": year,
                        "week": week_num,
                        "is_playoffs": is_playoffs,
                        "game_type": "regular_season" if not is_playoffs else "playoffs",
                        "playoff_round": "",
                        "is_playoff_bye": False,
                        "team_1_id": t1_id,
                        "team_1_name": t1_name,
                        "team_1_manager_id": mgr1["id"],
                        "team_1_manager_name": mgr1["name"],
                        "team_1_actual_points": t1_pts,
                        "team_1_projected_points": t1_proj,
                        "team_2_id": t2_id,
                        "team_2_name": t2_name,
                        "team_2_manager_id": mgr2["id"],
                        "team_2_manager_name": mgr2["name"],
                        "team_2_actual_points": t2_pts,
                        "team_2_projected_points": t2_proj,
                        "winner_team_id": winner_id,
                        "margin": round(abs(t1_pts - t2_pts), 2)
                    })

            # Check for Playoff BYEs in Quarterfinal week (week_num == reg_weeks + 1)
            if is_playoffs and week_num == reg_weeks + 1 and year >= 2022:
                qf_teams = set()
                for m in matchups_data:
                    if m["season"] == year and m["week"] == week_num and m["game_type"] == "playoffs":
                        qf_teams.add(m["team_1_id"])
                        qf_teams.add(m["team_2_id"])
                for (y, tid), tname in team_names_lookup.items():
                    if y == year and (not playoff_team_keys or (year, tid) in playoff_team_keys) and tid not in qf_teams:
                        in_any_game = any((m["team_1_id"] == tid or m["team_2_id"] == tid) for m in matchups_data if m["season"] == year and m["week"] == week_num)
                        if not in_any_game:
                            bmgr = get_canonical_manager(year, tid, tname, config)
                            matchups_data.append({
                                "season": year,
                                "week": week_num,
                                "is_playoffs": True,
                                "game_type": "playoffs",
                                "playoff_round": "quarterfinal",
                                "is_playoff_bye": True,
                                "team_1_id": tid,
                                "team_1_name": tname,
                                "team_1_manager_id": bmgr["id"],
                                "team_1_manager_name": bmgr["name"],
                                "team_1_actual_points": 0.0,
                                "team_1_projected_points": 0.0,
                                "team_2_id": None,
                                "team_2_name": "BYE",
                                "team_2_manager_id": None,
                                "team_2_manager_name": "BYE",
                                "team_2_actual_points": 0.0,
                                "team_2_projected_points": 0.0,
                                "winner_team_id": tid,
                                "margin": 0.0
                            })

            # Build matchup lookup for this week so we can attach fantasy matchup context to player performances
            weekly_matchups_lookup = {}
            for m in matchups_data:
                if m["season"] == year and m["week"] == week_num:
                    t1, t2 = m["team_1_id"], m["team_2_id"]
                    res1 = "W" if m["winner_team_id"] == t1 else ("L" if m["winner_team_id"] == t2 else "T")
                    res2 = "W" if m["winner_team_id"] == t2 else ("L" if m["winner_team_id"] == t1 else "T")
                    if m["is_playoff_bye"]:
                        res1 = "BYE"
                    weekly_matchups_lookup[t1] = {
                        "team_score": m["team_1_actual_points"],
                        "opponent_team_id": t2,
                        "opponent_team_name": m["team_2_name"],
                        "opponent_manager_id": m["team_2_manager_id"],
                        "opponent_manager_name": m["team_2_manager_name"],
                        "opponent_score": m["team_2_actual_points"],
                        "matchup_result": res1,
                        "game_type": m["game_type"],
                        "playoff_round": m["playoff_round"],
                        "is_playoff_bye": m["is_playoff_bye"],
                    }
                    if t2 is not None:
                        weekly_matchups_lookup[t2] = {
                            "team_score": m["team_2_actual_points"],
                            "opponent_team_id": t1,
                            "opponent_team_name": m["team_1_name"],
                            "opponent_manager_id": m["team_1_manager_id"],
                            "opponent_manager_name": m["team_1_manager_name"],
                            "opponent_score": m["team_1_actual_points"],
                            "matchup_result": res2,
                            "game_type": m["game_type"],
                            "playoff_round": m["playoff_round"],
                            "is_playoff_bye": m["is_playoff_bye"],
                        }

            # 2. Parse individual player boxscores for this week
            for team_id in range(1, 13):
                box_file = matchups_dir / f"boxscore_wk{week_num}_team{team_id}.html"
                if not box_file.exists():
                    continue

                with open(box_file, "r", encoding="utf-8", errors="ignore") as f:
                    html = f.read()

                soup = BeautifulSoup(html, "html.parser")
                tables = soup.find_all("table")
                if len(tables) < 3:
                    continue

                matchup_ctx = weekly_matchups_lookup.get(team_id, {})
                seen_player_keys = set()

                def _parse_and_add_player(p_cell, slot_str, proj_str, pts_str, stat_str, is_starter_flag, t_id, t_ctx):
                    if not p_cell or not slot_str or slot_str in ["Total", "TOTAL", ""]:
                        return
                    a_tag = p_cell.find("a", class_="name")
                    p_name = a_tag.get_text(strip=True) if a_tag else p_cell.get_text(strip=True).split("Final")[0].strip()
                    if not p_name or p_name in ["Total", "TOTAL", "", "Empty", "(Empty)", "BYE"]:
                        return
                    dedup_key = (year, week_num, t_id, p_name, slot_str)
                    if dedup_key in seen_player_keys:
                        return
                    seen_player_keys.add(dedup_key)

                    injury_status = None
                    for span in p_cell.find_all("span"):
                        s_text = span.get_text(strip=True)
                        if s_text in ["Q", "O", "D", "IR", "PUP", "NA", "P"]:
                            injury_status = s_text
                            break

                    proj_clean = proj_str.replace("-", "", 1).replace(".", "", 1)
                    pts_clean = pts_str.replace("-", "", 1).replace(".", "", 1)
                    proj_pts = float(proj_str) if proj_clean.isdigit() else 0.0
                    actual_pts = float(pts_str) if pts_clean.isdigit() else 0.0

                    t_name = team_names_lookup.get((year, t_id), f"Team {t_id}")
                    mgr = get_canonical_manager(year, t_id, t_name, config)

                    nfl_stat_line = stat_str
                    player_cell_raw = p_cell.get_text(separator=" | ", strip=True)
                    parts = [p.strip() for p in player_cell_raw.split(" | ")]
                    nfl_team = parts[-1] if len(parts) > 1 and len(parts[-1]) <= 4 else ""
                    nfl_game_result = ""
                    for p in parts:
                        if "Final" in p or "Bye" in p or "Postponed" in p or "@" in p or "vs" in p:
                            nfl_game_result = p
                            break

                    boxscores_data.append({
                        "season": year,
                        "week": week_num,
                        "is_playoffs": is_playoffs,
                        "game_type": t_ctx.get("game_type", "regular_season" if not is_playoffs else "consolation"),
                        "playoff_round": t_ctx.get("playoff_round", ""),
                        "is_playoff_bye": t_ctx.get("is_playoff_bye", False),
                        "team_id": t_id,
                        "team_name": t_name,
                        "manager_id": mgr["id"],
                        "manager_name": mgr["name"],
                        "team_score": t_ctx.get("team_score", 0.0),
                        "opponent_team_id": t_ctx.get("opponent_team_id"),
                        "opponent_team_name": t_ctx.get("opponent_team_name", "BYE"),
                        "opponent_manager_id": t_ctx.get("opponent_manager_id", ""),
                        "opponent_manager_name": t_ctx.get("opponent_manager_name", ""),
                        "opponent_score": t_ctx.get("opponent_score", 0.0),
                        "matchup_result": t_ctx.get("matchup_result", "N/A"),
                        "is_starter": is_starter_flag,
                        "roster_slot": slot_str,
                        "player_name": p_name,
                        "nfl_team": nfl_team,
                        "nfl_game_result": nfl_game_result,
                        "nfl_stat_line": nfl_stat_line,
                        "injury_status": injury_status,
                        "projected_points": proj_pts,
                        "fantasy_points": actual_pts,
                    })

                left_t_id = team_id
                right_t_id = matchup_ctx.get("opponent_team_id")
                if right_t_id:
                    links = [a.get_text(strip=True) for a in soup.find_all("a", class_="F-link") if a.get_text(strip=True)]
                    if len(links) >= 2:
                        left_name, right_name = links[0].lower().strip(), links[1].lower().strip()
                        t_name_clean = team_names_lookup.get((year, team_id), "").lower().strip()
                        opp_name_clean = matchup_ctx.get("opponent_team_name", "").lower().strip()
                        if (opp_name_clean and opp_name_clean in left_name and not (t_name_clean and t_name_clean in left_name)) or \
                           (t_name_clean and t_name_clean in right_name and not (opp_name_clean and opp_name_clean in right_name)):
                            left_t_id, right_t_id = right_t_id, left_t_id

                left_ctx = weekly_matchups_lookup.get(left_t_id, matchup_ctx)
                right_ctx = weekly_matchups_lookup.get(right_t_id, {}) if right_t_id else {}

                # Table 1: Starters, Table 2: Bench/IR
                for t_idx, table in enumerate([tables[1], tables[2]]):
                    is_starter = (t_idx == 0)
                    for row in table.find_all("tr")[1:]:
                        cells = row.find_all(["td", "th"])
                        if len(cells) < 11:
                            continue

                        # 1. Left Player (left_t_id)
                        _parse_and_add_player(
                            p_cell=cells[1],
                            slot_str=cells[4].get_text(strip=True),
                            proj_str=cells[2].get_text(strip=True),
                            pts_str=cells[3].get_text(strip=True),
                            stat_str=cells[0].get_text(strip=True),
                            is_starter_flag=is_starter,
                            t_id=left_t_id,
                            t_ctx=left_ctx
                        )

                        # 2. Right Player (right_t_id)
                        if right_t_id and len(cells) >= 11:
                            _parse_and_add_player(
                                p_cell=cells[9],
                                slot_str=cells[6].get_text(strip=True),
                                proj_str=cells[8].get_text(strip=True),
                                pts_str=cells[7].get_text(strip=True),
                                stat_str=cells[10].get_text(strip=True),
                                is_starter_flag=is_starter,
                                t_id=right_t_id,
                                t_ctx=right_ctx
                            )

    return matchups_data, boxscores_data


def compute_seasonal_team_stats(standings, matchups, boxscores):
    """
    Computes seasonal aggregate team stats combining standings, matchups, and boxscore data.
    """
    stats_map = {}
    for st in standings:
        key = (st["season"], st["team_id"])
        stats_map[key] = {
            "season": st["season"],
            "team_id": st["team_id"],
            "team_name": st["team_name"],
            "manager_id": st["manager_id"],
            "manager_name": st["manager_name"],
            "manager_status": st["manager_status"],
            "rank": st["rank"],
            "wins": st["wins"],
            "losses": st["losses"],
            "ties": st["ties"],
            "win_pct": st["win_pct"],
            "points_for": st["points_for"],
            "points_against": st["points_against"],
            "streak": st["streak"],
            "transactions": st["transactions"],
            "made_playoffs": st["made_playoffs"],
            "high_score": 0.0,
            "low_score": 9999.0,
            "weeks_played": 0
        }

    for m in matchups:
        # Check team 1
        k1 = (m["season"], m["team_1_id"])
        if k1 in stats_map:
            pts1 = m["team_1_actual_points"]
            stats_map[k1]["weeks_played"] += 1
            if pts1 > stats_map[k1]["high_score"]:
                stats_map[k1]["high_score"] = pts1
            if pts1 < stats_map[k1]["low_score"]:
                stats_map[k1]["low_score"] = pts1

        # Check team 2
        k2 = (m["season"], m["team_2_id"])
        if k2 in stats_map:
            pts2 = m["team_2_actual_points"]
            stats_map[k2]["weeks_played"] += 1
            if pts2 > stats_map[k2]["high_score"]:
                stats_map[k2]["high_score"] = pts2
            if pts2 < stats_map[k2]["low_score"]:
                stats_map[k2]["low_score"] = pts2

    result = []
    for val in stats_map.values():
        if val["low_score"] == 9999.0:
            val["low_score"] = 0.0
        val["avg_points_per_game"] = round(val["points_for"] / max(1, val["weeks_played"]), 2)
        result.append(val)

    return result


def parse_all_and_export(seasons=None):
    """
    Parses all scraped seasons and writes clean relational JSON datasets to /data/.
    """
    if seasons is None:
        try:
            from .config import SEASONS_TO_SCRAPE
            seasons = SEASONS_TO_SCRAPE
        except ImportError:
            from config import SEASONS_TO_SCRAPE
            seasons = SEASONS_TO_SCRAPE

    config = load_managers_config()
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("STARTING FULL HISTORICAL DATA PARSE & EXPORT (2018-2027)")
    print("=" * 70)

    # 1. Standings & Metadata
    print("[1/5] Parsing League Standings and Seasons Metadata...")
    standings, metadata, team_names_lookup = parse_seasons_metadata_and_standings(seasons, config)
    with open(LEAGUE_STANDINGS_JSON, "w", encoding="utf-8") as f:
        json.dump(standings, f, indent=2)
    with open(PROCESSED_DATA_DIR / "seasons_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"  -> Saved {len(standings)} team records across {len(metadata)} seasons.")

    # 2. Transactions
    print("[2/5] Parsing Historical Transactions & Roster Moves...")
    txs = parse_transactions(seasons, config)
    with open(PROCESSED_DATA_DIR / "transactions.json", "w", encoding="utf-8") as f:
        json.dump(txs, f, indent=2)
    print(f"  -> Saved {len(txs)} historical transactions.")

    # 3. Boxscores & Matchups
    print("[3/5] Parsing Weekly Matchups & Granular Player Boxscores...")
    matchups, boxscores = parse_matchups_and_boxscores(seasons, team_names_lookup, config, standings_data=standings)
    with open(MATCHUPS_JSON, "w", encoding="utf-8") as f:
        json.dump(matchups, f, indent=2)
    with open(WEEKLY_PLAYER_STATS_JSON, "w", encoding="utf-8") as f:
        json.dump(boxscores, f, indent=2)
    print(f"  -> Saved {len(matchups)} head-to-head weekly matchup results.")
    print(f"  -> Saved {len(boxscores)} individual player weekly performances (with injury status).")

    # Build comprehensive player_lookup from boxscores, transactions, and historical stars
    player_lookup = {
        "david johnson": {"nfl_team": "ARI", "position": "RB"},
        "antonio brown": {"nfl_team": "PIT", "position": "WR"},
        "le'veon bell": {"nfl_team": "PIT", "position": "RB"},
        "jordan howard": {"nfl_team": "CHI", "position": "RB"},
        "lesean mccoy": {"nfl_team": "BUF", "position": "RB"},
        "jordy nelson": {"nfl_team": "GB", "position": "WR"},
        "marshawn lynch": {"nfl_team": "OAK", "position": "RB"},
        "demarco murray": {"nfl_team": "TEN", "position": "RB"},
        "rob gronkowski": {"nfl_team": "NE", "position": "TE"},
        "ben roethlisberger": {"nfl_team": "PIT", "position": "QB"},
        "doug baldwin": {"nfl_team": "SEA", "position": "WR"},
        "demaryius thomas": {"nfl_team": "DEN", "position": "WR"},
        "todd gurley": {"nfl_team": "LAR", "position": "RB"},
        "lamar miller": {"nfl_team": "HOU", "position": "RB"},
        "isaiah crowell": {"nfl_team": "NYJ", "position": "RB"},
        "ty montgomery ii": {"nfl_team": "GB", "position": "RB"},
        "odell beckham jr.": {"nfl_team": "NYG", "position": "WR"},
        "julio jones": {"nfl_team": "ATL", "position": "WR"},
        "a.j. green": {"nfl_team": "CIN", "position": "WR"},
        "cam newton": {"nfl_team": "CAR", "position": "QB"},
        "matt ryan": {"nfl_team": "ATL", "position": "QB"},
        "philip rivers": {"nfl_team": "LAC", "position": "QB"},
        "tom brady": {"nfl_team": "NE", "position": "QB"},
        "drew brees": {"nfl_team": "NO", "position": "QB"},
        "andrew luck": {"nfl_team": "IND", "position": "QB"},
        "larry fitzgerald": {"nfl_team": "ARI", "position": "WR"},
        "alshon jeffery": {"nfl_team": "PHI", "position": "WR"},
        "golden tate": {"nfl_team": "DET", "position": "WR"},
        "t.y. hilton": {"nfl_team": "IND", "position": "WR"},
        "jarvis landry": {"nfl_team": "MIA", "position": "WR"},
        "carlos hyde": {"nfl_team": "CLE", "position": "RB"},
        "jay ajayi": {"nfl_team": "PHI", "position": "RB"},
        "mark ingram": {"nfl_team": "NO", "position": "RB"},
        "ezekiel elliott": {"nfl_team": "DAL", "position": "RB"},
        "melvin gordon": {"nfl_team": "LAC", "position": "RB"},
        "kareem hunt": {"nfl_team": "KC", "position": "RB"},
        "devonta freeman": {"nfl_team": "ATL", "position": "RB"},
        "jerick mckinnon": {"nfl_team": "SF", "position": "RB"},
        "delanie walker": {"nfl_team": "TEN", "position": "TE"},
        "alex collins": {"nfl_team": "BAL", "position": "RB"},
        "chris hogan": {"nfl_team": "NE", "position": "WR"},
        "jimmy graham": {"nfl_team": "GB", "position": "TE"},
        "jordan reed": {"nfl_team": "WAS", "position": "TE"},
        "pierre garcon": {"nfl_team": "SF", "position": "WR"},
        "randall cobb": {"nfl_team": "GB", "position": "WR"},
        "kelvin benjamin": {"nfl_team": "BUF", "position": "WR"},
        "rex burkhead": {"nfl_team": "NE", "position": "RB"},
        "rishard matthews": {"nfl_team": "TEN", "position": "WR"},
        "greg olsen": {"nfl_team": "CAR", "position": "TE"},
        "bilal powell": {"nfl_team": "NYJ", "position": "RB"},
        "giovani bernard": {"nfl_team": "CIN", "position": "RB"},
        "julian edelman": {"nfl_team": "NE", "position": "WR"},
        "devante parker": {"nfl_team": "MIA", "position": "WR"},
        "d'onta foreman": {"nfl_team": "HOU", "position": "RB"},
    }

    # Add from boxscore roster slots and teams
    for bx in boxscores:
        p_name = bx["player_name"].lower().strip()
        if not p_name:
            continue
        if p_name not in player_lookup:
            player_lookup[p_name] = {"nfl_team": "", "position": ""}
        if bx.get("nfl_team"):
            player_lookup[p_name]["nfl_team"] = bx["nfl_team"]
        slot = bx.get("roster_slot", "")
        if slot in ["QB", "RB", "WR", "TE", "K", "DEF"]:
            player_lookup[p_name]["position"] = slot
        elif bx.get("position") and not player_lookup[p_name]["position"]:
            player_lookup[p_name]["position"] = bx["position"]

    # Add from transaction details (e.g. 'Aaron Jones Sr. Min - RB')
    for tx in txs:
        det = tx.get("details", "")
        for m in re.finditer(r"([A-Za-z0-9\.\-\'\s]+?)\s+([A-Z][a-z]{1,2})\s+-\s+([A-Z]{1,3})\b", det):
            name_part = m.group(1).strip().lower()
            team_part = m.group(2).strip().upper()
            pos_part = m.group(3).strip().upper()
            if len(name_part) > 2:
                if name_part not in player_lookup:
                    player_lookup[name_part] = {"nfl_team": team_part, "position": pos_part}
                else:
                    if not player_lookup[name_part]["nfl_team"]:
                        player_lookup[name_part]["nfl_team"] = team_part
                    if not player_lookup[name_part]["position"]:
                        player_lookup[name_part]["position"] = pos_part

    # 4. Draft Results
    print("[4/5] Parsing Historical Draft Results across all rounds...")
    drafts = parse_draft(seasons, player_lookup, config)
    with open(DRAFT_RESULTS_JSON, "w", encoding="utf-8") as f:
        json.dump(drafts, f, indent=2)
    print(f"  -> Saved {len(drafts)} draft picks across all rounds.")

    # 5. Seasonal Team Stats
    print("[5/5] Computing Seasonal Aggregate Team Statistics...")
    team_stats = compute_seasonal_team_stats(standings, matchups, boxscores)
    with open(TEAM_STATS_JSON, "w", encoding="utf-8") as f:
        json.dump(team_stats, f, indent=2)
    print(f"  -> Saved {len(team_stats)} seasonal team statistics summaries.")

    # 6. Export offline data bundle for frontend usage
    # Load power rankings history
    try:
        with open("data/power_rankings_history.json", "r", encoding="utf-8") as f:
            power_rankings_history = json.load(f)
    except Exception:
        power_rankings_history = []

    bundle = {
        "managers": config,
        "matchups": matchups,
        "weekly_player_stats": boxscores,
        "league_standings": standings,
        "seasons_metadata": metadata,
        "team_stats": team_stats,
        "power_rankings_history": power_rankings_history
    }
    with open("data/data_bundle.js", "w", encoding="utf-8") as f:
        f.write("window.FANTASY_DATA = " + json.dumps(bundle, separators=(",", ":")) + ";")
    print("  -> Saved offline JS data bundle to /data/data_bundle.js.")

    print("=" * 70)
    print("ALL DATASETS SUCESSFULLY PARSED AND WRITTEN TO /data/ !")
    print("=" * 70)


if __name__ == "__main__":
    parse_all_and_export()
