import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/records.js") as f:
    text = f.read()

lines = text.split("\n")
for i, line in enumerate(lines):
    if "startSeason:" in line or "endSeason:" in line:
        print(f"Line {i+1}: {line.strip()}")
