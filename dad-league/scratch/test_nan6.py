import re

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/records.js") as f:
    text = f.read()

# Fix manager_name fallback logic that prefers the raw name
text = re.sub(
    r'm\.home_manager_name \|\| this\.getManagerName\((.*?)\)',
    r'this.getManagerName(\1, m.home_manager_name)',
    text
)
text = re.sub(
    r'm\.away_manager_name \|\| this\.getManagerName\((.*?)\)',
    r'this.getManagerName(\1, m.away_manager_name)',
    text
)
text = re.sub(
    r'managerName \|\| this\.getManagerName\((.*?)\)',
    r'this.getManagerName(\1, managerName)',
    text
)


with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/records.js", "w") as f:
    f.write(text)

