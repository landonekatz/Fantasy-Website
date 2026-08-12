import re
with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/app.js") as f:
    text = f.read()

# Let's see if I have unbalanced brackets or anything crazy.
open_b = text.count('{')
close_b = text.count('}')
print("Braces:", open_b, close_b)

with open("/Users/Landon/Documents/Fantasy-Website/dad-league/src/records.js") as f:
    text2 = f.read()

open_b2 = text2.count('{')
close_b2 = text2.count('}')
print("Braces records:", open_b2, close_b2)
