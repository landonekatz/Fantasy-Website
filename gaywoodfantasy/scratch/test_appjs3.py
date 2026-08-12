with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/app.js") as f:
    text = f.read()

import re
match = re.search(r'const renderRosterTable = .*?return html;\n        };', text, re.DOTALL)
if match:
    print(match.group(0))
