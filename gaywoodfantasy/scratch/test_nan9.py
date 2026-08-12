import json

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/records.js") as f:
    text = f.read()

lines = text.split("\n")
for i, line in enumerate(lines):
    if "current.year" in line:
        print(f"{i}: {line.strip()}")
