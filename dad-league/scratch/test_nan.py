import re

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/records.js") as f:
    text = f.read()

# Replace formatSeasonYear asterisk logic
text = re.sub(r'if \(y === 2015 \|\| y === 2019\) {\s*return `\$\{y\}\*`;\s*}', '', text)

# Replace manager_name fallback to getManagerName(mid) properly
text = re.sub(r's\.manager_name \|\| this\.getManagerName\(mid\)', r'this.getManagerName(mid, s.manager_name)', text)
text = re.sub(r'm\.name \|\| m\.manager_name \|\| mid', r'this.getManagerName(mid, m.manager_name || m.name)', text)
text = re.sub(r'manager_name: m\.manager_name,', r'manager_name: this.getManagerName(m.manager_id || mid, m.manager_name),', text)

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/records.js", "w") as f:
    f.write(text)

