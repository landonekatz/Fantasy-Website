#!/usr/bin/env python3
import os
import re
import json
import glob
from pathlib import Path

try:
    from .config import PROCESSED_DATA_DIR, MANAGERS_JSON_PATH
except ImportError:
    from config import PROCESSED_DATA_DIR, MANAGERS_JSON_PATH

# Paths
POWER_RANKINGS_DIR = PROCESSED_DATA_DIR / "power_rankings"
MANAGERS_JSON = MANAGERS_JSON_PATH
OUTPUT_JSON = PROCESSED_DATA_DIR / "power_rankings_history.json"

def load_managers():
    if not MANAGERS_JSON.exists():
        return []
    with open(MANAGERS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
        return data.get("managers", [])

def get_manager_id(name, managers):
    name = name.strip().lower()
    # Handle specific aliases
    if name == "benjamin":
        name = "ben"
    
    for m in managers:
        if m["name"].lower() == name or m["id"] == name:
            return m["id"]
    return name # Fallback to whatever was parsed

def parse_rankings(content, managers):
    # Matches lines like:
    # 1. Landon
    # ### 1. Landon
    # <h3>1. Landon</h3>
    # <h2>1. Landon</h2>
    rankings = []
    
    # regex to match number, dot, space, and name AT THE START OF A LINE.
    pattern = re.compile(r'^\s*(?:<h[1-6].*?>|#+\s*)?(\d+)\.\s*([A-Za-z]+)(?:</h[1-6]>)?', re.IGNORECASE | re.MULTILINE)
    
    matches = pattern.findall(content)
    
    # We expect 12 matches, in order 1 through 12. Let's sort them by the number just in case
    # or just keep them in order of appearance.
    # We will trust the order of appearance.
    extracted = []
    for num_str, name in matches:
        extracted.append({
            "rank": int(num_str),
            "name": name
        })
        
    extracted.sort(key=lambda x: x["rank"])
    
    for item in extracted:
        rankings.append(get_manager_id(item["name"], managers))
        
    return rankings

def main():
    if not POWER_RANKINGS_DIR.exists():
        os.makedirs(POWER_RANKINGS_DIR, exist_ok=True)

    managers = load_managers()
    
    existing_history = []
    if OUTPUT_JSON.exists():
        try:
            with open(OUTPUT_JSON, "r", encoding="utf-8") as f:
                existing_history = json.load(f)
        except Exception:
            existing_history = []

    existing_by_week = {}
    for item in existing_history:
        w = item.get("week")
        if w is not None:
            existing_by_week[w] = item

    files = glob.glob(str(POWER_RANKINGS_DIR / "week_*.md"))
    for file_path in files:
        filename = os.path.basename(file_path)
        # Extract week number
        match = re.search(r'week_(\d+)', filename)
        if match:
            week = int(match.group(1))
            
            # If this week already exists with rich structured rankings (dicts with blurbs), preserve it
            if week in existing_by_week and isinstance(existing_by_week[week].get("rankings"), list):
                if len(existing_by_week[week]["rankings"]) > 0 and isinstance(existing_by_week[week]["rankings"][0], dict):
                    continue
            
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            rankings = parse_rankings(content, managers)
            
            existing_by_week[week] = {
                "id": f"pr_2026_w{week}",
                "week": week,
                "season": 2026,
                "title": f"Week {week} Power Rankings",
                "subtitle": f"Week {week} Rankings & Tier Analysis",
                "rankings": rankings,
                "author_name": "Commissioner",
                "html_content": content,
                "created_at": int(os.path.getmtime(file_path) * 1000),
                "updated_at": int(os.path.getmtime(file_path) * 1000)
            }
            
    history = list(existing_by_week.values())
    history.sort(key=lambda x: x.get("week", 0))
    
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)
        
    print(f"Parsed power rankings. Saved {len(history)} weeks to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
