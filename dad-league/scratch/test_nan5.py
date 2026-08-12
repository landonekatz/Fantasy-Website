import re

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/records.js") as f:
    text = f.read()

# Replace formatSeasonYear to handle undefined
text = re.sub(
    r'formatSeasonYear\(year\) {\s*const y = Number\(year\);\s*return `\$\{y\}`;',
    r'formatSeasonYear(year) {\n        if (year === undefined || year === null) return "";\n        return `${Number(year)}`;',
    text
)

# And fix m.manager_name instances properly if there's any left
text = re.sub(
    r's\.manager_name \|\| this\.getManagerName\(mid\)',
    r'this.getManagerName(mid, s.manager_name)',
    text
)

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/records.js", "w") as f:
    f.write(text)

