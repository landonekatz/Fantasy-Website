import sys
import json
import re
from pathlib import Path
from bs4 import BeautifulSoup

try:
    from .config import RAW_DATA_DIR, MANAGERS_JSON_PATH
except ImportError:
    from config import RAW_DATA_DIR, MANAGERS_JSON_PATH

def parse_teams_html():
    print("=" * 70)
    print("DUMBARTON FANTASY FOOTBALL - TEAM NAME EXTRACTOR")
    print("=" * 70)
    
    # Load current managers.json
    if not MANAGERS_JSON_PATH.exists():
        print(f"Error: {MANAGERS_JSON_PATH} does not exist.")
        return
        
    with open(MANAGERS_JSON_PATH, "r", encoding="utf-8") as f:
        managers_data = json.load(f)
        
    # Get all canonical manager objects
    canonical_managers = {m["id"]: m for m in managers_data.get("managers", [])}
    
    # We iterate over all years in raw_data and parse teams.html if it exists
    years_found = [d.name for d in RAW_DATA_DIR.iterdir() if d.is_dir() and d.name.isdigit()]
    years_found.sort(key=int)
    
    updates_made = False
    
    for year_str in years_found:
        year = int(year_str)
        teams_file = RAW_DATA_DIR / year_str / "league_info" / "teams.html"
        
        if not teams_file.exists():
            continue
            
        print(f"Parsing teams for year {year} from {teams_file.relative_to(RAW_DATA_DIR.parent)}...")
        
        with open(teams_file, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), 'html.parser')
            
        # Find all team rows
        # A typical row has <tr class="team-1">
        team_rows = soup.find_all('tr', class_=re.compile(r"^team-\d+$"))
        
        if not team_rows:
            print(f"  [Warning] No team rows found in {teams_file.name}")
            continue
            
        for row in team_rows:
            # Extract team_id from class (e.g., 'team-1')
            row_class = [c for c in row.get('class', []) if c.startswith('team-')][0]
            team_id = int(row_class.split('-')[1])
            
            # The team name is in a link like <a href="/2025/f1/42542/1">Landon's Team</a>
            # or <a href="https://football.fantasysports.yahoo.com/f1/52841/1">Alex’s fluffy team</a>
            team_name = ""
            for a in row.find_all('a'):
                href = a.get('href', '')
                text = a.text.strip()
                if (href.endswith(f"/{team_id}") or f"/{team_id}?" in href or f"/{team_id}/" in href) and text and not text.startswith("--"):
                    team_name = text
                    break
                    
            # Extract logo_url from teams.html since this is always the most up-to-date image
            logo_url = ""
            img_tag = row.find('img')
            if img_tag and img_tag.get('src'):
                logo_url = img_tag.get('src')
                    
            # The manager name is in <td id="team-1-data" class="user-id">
            manager_name = ""
            td_data = row.find('td', class_='user-id')
            if td_data:
                manager_span = td_data.find('span', class_='user-id')
                if manager_span and manager_span.find('a'):
                    manager_name = manager_span.find('a').text.strip()
                elif manager_span:
                    manager_name = manager_span.text.strip()
                elif td_data.find('a'):
                    manager_name = td_data.find('a').text.strip()
                else:
                    raw_text = td_data.get_text(strip=True).replace("Commissioner", "").strip()
                    if raw_text and not raw_text.startswith("--"):
                        manager_name = raw_text
                    
            # Resolution Priority 1: Check if (year, team_id) already exists in team_mappings
            canonical_id = None
            for mapping in managers_data.get("team_mappings", []):
                if mapping.get("year") == year and mapping.get("team_id") == team_id:
                    canonical_id = mapping.get("manager_id")
                    break
                    
            # Resolution Priority 2: Resolve by manager_name from page if not already mapped
            if not canonical_id and manager_name:
                manager_name_lower = manager_name.lower()
                for m_id, m_data in canonical_managers.items():
                    if m_data.get("name", "").lower() == manager_name_lower:
                        canonical_id = m_id
                        break
                
                # Fallback heuristics for nicknames or common variations
                if not canonical_id:
                    if manager_name_lower in ["frenchy", "frenchfrey", "frenchfrey'sfastfood"]:
                        canonical_id = "alex"
                    elif manager_name_lower in ["cogger"]:
                        canonical_id = "carson"
                    elif manager_name_lower in ["jackie"]:
                        canonical_id = "jack"
                    elif manager_name_lower in ["michael"]:
                        canonical_id = "mike"
                    elif manager_name_lower in ["willis"]:
                        canonical_id = "will"
                    elif manager_name_lower in ["jfoggy", "bugs bunny rules"]:
                        canonical_id = "jordan"
                    elif manager_name_lower in ["tyfood"]:
                        canonical_id = "ty"
                    elif manager_name_lower in ["dawn"]:
                        canonical_id = "landon"
                    elif manager_name_lower in ["marty"]:
                        canonical_id = "joey"

            if not canonical_id:
                print(f"  [Warning] Could not resolve canonical manager for Team {team_id}: '{team_name}' (Manager: {manager_name})")
                continue
                
            # Now update team_mappings
            mapping_exists = False
            for mapping in managers_data.get("team_mappings", []):
                if mapping.get("year") == year and mapping.get("team_id") == team_id:
                    # Update team name if it changed!
                    if team_name and mapping.get("team_name") != team_name:
                        print(f"  [Update] Year {year}, Team {team_id}: '{mapping.get('team_name')}' -> '{team_name}'")
                        mapping["team_name"] = team_name
                        updates_made = True
                    # Also ensure manager is correct
                    if mapping.get("manager_id") != canonical_id:
                        print(f"  [Update] Year {year}, Team {team_id}: Manager '{mapping.get('manager_id')}' -> '{canonical_id}'")
                        mapping["manager_id"] = canonical_id
                        updates_made = True
                    mapping_exists = True
                    break
                    
            if not mapping_exists and team_name:
                print(f"  [New] Year {year}, Team {team_id}: {team_name} ({manager_name} -> {canonical_id})")
                managers_data["team_mappings"].append({
                    "year": year,
                    "team_id": team_id,
                    "team_name": team_name,
                    "manager_id": canonical_id
                })
                updates_made = True
                
            # Update the manager's logo_url if this is the most recent year
            if logo_url and year_str == years_found[-1]:
                for m_data in managers_data.get("managers", []):
                    if m_data.get("id") == canonical_id:
                        if m_data.get("logo_url") != logo_url:
                            print(f"  [Update] Manager '{canonical_id}' logo updated: {logo_url}")
                            m_data["logo_url"] = logo_url
                            updates_made = True
                        break

    if updates_made:
        # Sort mappings by year (descending) and then team_id
        managers_data["team_mappings"].sort(key=lambda x: (-x["year"], x["team_id"]))
        
        with open(MANAGERS_JSON_PATH, "w", encoding="utf-8") as f:
            json.dump(managers_data, f, indent=2, ensure_ascii=False)
        print("\n[SUCCESS] Updated managers.json with new team mappings!")
    else:
        print("\n[OK] No new team mappings or changes found. managers.json is up to date.")

if __name__ == "__main__":
    parse_teams_html()
