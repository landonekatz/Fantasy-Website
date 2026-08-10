#!/usr/bin/env python3
import os
import re
import json
import glob
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
POWER_RANKINGS_DIR = BASE_DIR / "data" / "power_rankings"
MANAGERS_JSON = BASE_DIR / "data" / "managers.json"
OUTPUT_JSON = BASE_DIR / "data" / "power_rankings_history.json"

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
    history = []
    
    files = glob.glob(str(POWER_RANKINGS_DIR / "week_*.md"))
    for file_path in files:
        filename = os.path.basename(file_path)
        # Extract week number
        match = re.search(r'week_(\d+)', filename)
        if match:
            week = int(match.group(1))
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
                
            rankings = parse_rankings(content, managers)
            
            history.append({
                "week": week,
                "rankings": rankings,
                "html_content": content
            })
            
    # Sort by week
    history.sort(key=lambda x: x["week"])
    
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2)
        
    print(f"Parsed {len(history)} power rankings files. Saved to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
