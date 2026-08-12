import re
with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/records.js") as f:
    text = f.read()
    
# Let's print out the renderStreakItem
match = re.search(r'const renderStreakItem = \(item, idx\) => \{.*?return `', text, re.DOTALL)
if match:
    print(match.group(0))
