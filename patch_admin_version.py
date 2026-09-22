import re

with open('admin-dashboard.html', 'r') as f:
    content = f.read()

content = content.replace("js/admin.js?v=17", "js/admin.js?v=18")

with open('admin-dashboard.html', 'w') as f:
    f.write(content)
