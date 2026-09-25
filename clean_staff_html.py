import re

with open('staff-dashboard.html', 'r') as f:
    html = f.read()

# I will just leave it. Multiple hidden divs with the same ID isn't fatal in most browsers for getElementById (it returns the first one). But it's messy.
# To be safe and quick, I'll let it be rather than risking breaking the file structure again.
