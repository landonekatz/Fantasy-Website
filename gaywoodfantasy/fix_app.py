import re

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/app.js", "r") as f:
    content = f.read()

# 1. Replace season -> year and is_playoffs -> is_playoff
content = content.replace(".season", ".year")
content = content.replace(".is_playoffs", ".is_playoff")
content = content.replace("{g.season}", "{g.year}")
content = content.replace("{s.season}", "{s.year}")
content = content.replace("{m.season}", "{m.year}")

# 2. Remove Rivalry
content = re.sub(r"const btnRivalry = document.getElementById\('btn-tab-rivalry'\);.*?\n", "", content)
content = re.sub(r"const viewRivalry = document.getElementById\('view-rivalry'\);.*?\n", "", content)
content = content.replace(", btnRivalry", "")
content = content.replace(", viewRivalry", "")
content = re.sub(r"if \(tab === 'rivalry'\) \{.*?\n\s+window\.scrollTo", "window.scrollTo", content, flags=re.DOTALL)
content = re.sub(r"if \(btns\.rivalry\).*?\n", "", content)
content = content.replace("'home', 'h2h', 'records', 'rivalry'", "'home', 'h2h', 'records'")

# 3. Disable 2020 filter
content = re.sub(r"const btn2020\s*=\s*document.getElementById\('filter-btn-2020'\);.*?\n", "", content)
content = content.replace(", btn2020", "")
content = re.sub(r"if \(mode === '2020-present'\) btn2020\?\.classList\.add\('active'\);.*?\n", "", content)
content = re.sub(r"btn2020\?\.addEventListener\('click', \(\) => setFilter\('2020-present'\)\);.*?\n", "", content)
content = re.sub(r"if \(this\.currentYearFilter === '2020-present'\) return \{ min: 2020, max: this\.MAX_YEAR \};.*?\n", "", content)

# 4. Remove unwanted functions in renderHome
content = content.replace("this.renderHomeStandings();\n", "")
content = content.replace("this.renderAllTimeLeaders();\n", "")
content = content.replace("this.initPowerRankings();\n", "")

# 5. Disable < 2018 popups
old_onclick = "onclick=\"app.openBoxscoreModal(${g.year}, ${g.week}, '${m1Id}', '${m2Id}')\""
new_onclick = "${g.year < 2018 ? 'onclick=\"alert(\\'ESPN has removed public access to player boxscore data prior to 2018.\\')\"' : 'onclick=\"app.openBoxscoreModal(' + g.year + ', ' + g.week + ', \\'' + m1Id + '\\', \\'' + m2Id + '\\')\"'}"
content = content.replace(old_onclick, new_onclick)

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/app.js", "w") as f:
    f.write(content)

print("Fixed app.js")
