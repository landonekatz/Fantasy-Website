import re

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/scraper/parser.py", "r") as f:
    content = f.read()

# I want to find get_manager_slug(tinfo.get("owner_id", ""), managers)
# and replace it with get_manager_slug(tinfo.get("owner_id", ""), managers, tinfo.get("display_name", ""))
content = content.replace(
    'get_manager_slug(tinfo.get("owner_id", ""), managers)',
    'get_manager_slug(tinfo.get("owner_id", ""), managers, tinfo.get("display_name", ""))'
)
# And for owner_id matching directly
content = content.replace(
    'manager_slug = get_manager_slug(owner_id, managers)',
    'manager_slug = get_manager_slug(owner_id, managers, tm.get("display_name", ""))'
)

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/scraper/parser.py", "w") as f:
    f.write(content)
