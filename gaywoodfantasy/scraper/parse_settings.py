import json
import os
import glob
import re
import zipfile
import xml.etree.ElementTree as ET

RAW_DATA_DIR = os.path.join(os.path.dirname(__file__), "raw_data")
EXCEL_FILE = os.path.join(os.path.dirname(__file__), "../dad-league_scoring_rules_2018_2025.xlsx")
OUT_FILE = os.path.join(os.path.dirname(__file__), "../data/league_settings.json")

# Master ESPN API Stat ID Dictionary
ESPN_STAT_MAP = {
    # Passing
    3: ("Passing", "Passing Yards"),
    4: ("Passing", "TD Pass"),
    7: ("Passing", "Every 20 passing yards"),
    17: ("Passing", "300-399 yard passing game"),
    18: ("Passing", "400+ yard passing game"),
    19: ("Passing", "2pt Passing Conversion"),
    20: ("Passing", "Interceptions Thrown"),

    # Rushing
    24: ("Rushing", "Rushing Yards"),
    25: ("Rushing", "TD Rush"),
    26: ("Rushing", "2pt Rushing Conversion"),
    28: ("Rushing", "Every 10 rushing yards"),
    37: ("Rushing", "100-199 yard rushing game"),
    38: ("Rushing", "200+ yard rushing game"),

    # Receiving
    42: ("Receiving", "Receiving Yards"),
    43: ("Receiving", "TD Reception"),
    44: ("Receiving", "2pt Receiving Conversion"),
    48: ("Receiving", "Every 10 receiving yards"),
    53: ("Receiving", "Each reception"),
    56: ("Receiving", "100-199 yard receiving game"),
    57: ("Receiving", "200+ yard receiving game"),

    # Kicking
    198: ("Kicking", "Each PAT Made"),
    199: ("Kicking", "Extra Point Missed"),
    200: ("Kicking", "FG Made (0-39 yards)"),
    201: ("Kicking", "FG Made (40-49 yards)"),
    202: ("Kicking", "FG Made (50-59 yards)"),
    203: ("Kicking", "FG Made (60+ yards)"),
    204: ("Kicking", "FG Missed (0-39 yards)"),
    205: ("Kicking", "FG Missed (40-49 yards)"),
    206: ("Kicking", "FG Missed (50+ yards)"),

    # Team Defense / Special Teams
    73: ("Team Defense / Special Teams", "Each Sack"),
    74: ("Team Defense / Special Teams", "Each Interception"),
    75: ("Team Defense / Special Teams", "Each Fumble Recovered"),
    77: ("Team Defense / Special Teams", "Interception Return TD"),
    80: ("Team Defense / Special Teams", "Fumble Return TD"),
    82: ("Team Defense / Special Teams", "Kickoff Return TD"),
    83: ("Team Defense / Special Teams", "Punt Return TD"),
    86: ("Team Defense / Special Teams", "Blocked Punt, PAT or FG"),
    89: ("Team Defense / Special Teams", "0 points allowed"),
    90: ("Team Defense / Special Teams", "1-6 points allowed"),
    91: ("Team Defense / Special Teams", "7-13 points allowed"),
    92: ("Team Defense / Special Teams", "14-17 points allowed"),
    93: ("Team Defense / Special Teams", "Blocked Punt or FG return for TD"),
    95: ("Team Defense / Special Teams", "Each Safety"),
    123: ("Team Defense / Special Teams", "28-34 points allowed"),
    124: ("Team Defense / Special Teams", "35-45 points allowed"),
    125: ("Team Defense / Special Teams", "46+ points allowed"),
    128: ("Team Defense / Special Teams", "Less than 100 total yards allowed"),
    129: ("Team Defense / Special Teams", "100-199 total yards allowed"),
    130: ("Team Defense / Special Teams", "200-299 total yards allowed"),
    132: ("Team Defense / Special Teams", "350-399 total yards allowed"),
    133: ("Team Defense / Special Teams", "400-449 total yards allowed"),
    134: ("Team Defense / Special Teams", "450-499 total yards allowed"),
    135: ("Team Defense / Special Teams", "500-549 total yards allowed"),
    136: ("Team Defense / Special Teams", "550+ total yards allowed"),

    # Miscellaneous
    72: ("Miscellaneous", "Total Fumbles Lost")
}

def clean_name(name):
    """Strips parenthetical abbreviations like (FG60), (KRTD), (PA0), (PY), etc."""
    return re.sub(r"\s*\([A-Z0-9+]{2,7}\)$", "", name).strip()

def parse_espn_api_payload(data):
    """Dynamically parses raw ESPN API mSettings JSON payload for any league or year."""
    if isinstance(data, list) and len(data) > 0:
        data = data[0]
        
    scoring_items = data.get("settings", {}).get("scoringSettings", {}).get("scoringItems", [])
    categories = ["Passing", "Rushing", "Receiving", "Kicking", "Team Defense / Special Teams", "Miscellaneous"]
    year_rules = {cat: [] for cat in categories}
    
    for item in scoring_items:
        sid = item.get("statId")
        pts = item.get("points", 0.0)
        overrides = item.get("pointsOverrides") or {}
        
        # Check positional slot overrides (e.g., '16' for D/ST)
        if "16" in overrides:
            pts = overrides["16"]
        elif "17" in overrides:
            pts = overrides["17"]
        elif "0" in overrides:
            pts = overrides["0"]
            
        if pts == 0:
            continue
            
        if sid in ESPN_STAT_MAP:
            cat, name = ESPN_STAT_MAP[sid]
            name = clean_name(name)
            if pts.is_integer():
                pts = int(pts)
            year_rules[cat].append({"name": name, "points": pts, "stat_id": sid})
            
    return {cat: items for cat, items in year_rules.items() if items}

def parse_excel_sheet(z, strings, sheet_index):
    """Parses Excel sheet into clean rules dictionary."""
    s_tree = ET.fromstring(z.read(f"xl/worksheets/sheet{sheet_index}.xml"))
    rows = []
    for row in s_tree.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row"):
        vals = []
        for cell in row.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c"):
            t = cell.attrib.get("t")
            v = cell.find("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v")
            val = v.text if v is not None else ""
            if t == "s" and val != "":
                val = strings[int(val)]
            vals.append(val)
        if any(vals):
            rows.append(vals)
    
    categories = ["Passing", "Rushing", "Receiving", "Kicking", "Team Defense / Special Teams", "Miscellaneous"]
    result = {cat: [] for cat in categories}
    
    current_cat = None
    for r in rows:
        if not r:
            continue
        first_col = r[0].strip() if r[0] else ""
        if first_col in categories:
            current_cat = first_col
            continue
        if first_col == "Category" or first_col.startswith("Scoring"):
            continue
        if current_cat and len(r) >= 2 and r[1] != "":
            name = clean_name(first_col)
            try:
                pts = float(r[1])
                if pts.is_integer():
                    pts = int(pts)
                result[current_cat].append({"name": name, "points": pts})
            except ValueError:
                pass
    return result

def parse_all_settings():
    settings_data = {}
    
    # 1. Parse from Excel if available
    excel_rules_2025 = None
    excel_rules_2018 = None
    if os.path.exists(EXCEL_FILE):
        with zipfile.ZipFile(EXCEL_FILE) as z:
            strings = []
            if "xl/sharedStrings.xml" in z.namelist():
                tree = ET.fromstring(z.read("xl/sharedStrings.xml"))
                for elem in tree.findall("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si"):
                    text = "".join([t.text for t in elem.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t") if t.text])
                    strings.append(text)
            
            wb_tree = ET.fromstring(z.read("xl/workbook.xml"))
            sheets = wb_tree.findall(".//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet")
            sheet_map = {s.attrib["name"]: i + 1 for i, s in enumerate(sheets)}
            
            if "2025" in sheet_map:
                excel_rules_2025 = parse_excel_sheet(z, strings, sheet_map["2025"])
            if "2018" in sheet_map:
                excel_rules_2018 = parse_excel_sheet(z, strings, sheet_map["2018"])

    # 2. Parse from raw ESPN API files
    api_files = glob.glob(os.path.join(RAW_DATA_DIR, "*_mSettings.json"))
    for fpath in api_files:
        fname = os.path.basename(fpath)
        year_str = fname.split("_")[0]
        try:
            year = int(year_str)
        except ValueError:
            continue
            
        with open(fpath, "r") as f:
            try:
                raw_json = json.load(f)
                api_rules = parse_espn_api_payload(raw_json)
            except Exception:
                api_rules = {}
                
        # If Excel ground truth is available for this era, merge/use it
        if year >= 2019 and excel_rules_2025:
            settings_data[str(year)] = excel_rules_2025
        elif year <= 2018 and excel_rules_2018:
            settings_data[str(year)] = excel_rules_2018
        else:
            settings_data[str(year)] = api_rules

    with open(OUT_FILE, "w") as f:
        json.dump(settings_data, f, indent=2)
    print(f"Successfully saved clean scoring settings for {len(settings_data)} years to {OUT_FILE}")

if __name__ == "__main__":
    parse_all_settings()


