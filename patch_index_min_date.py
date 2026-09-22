import re

with open('index.html', 'r') as f:
    content = f.read()

old_js = """    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    document.getElementById('app-date').min = tomorrow.toISOString().split('T')[0];"""

new_js = """    const today = new Date();
    // Allow same-day bookings if before start time
    document.getElementById('app-date').min = today.toISOString().split('T')[0];"""

content = content.replace(old_js, new_js)

with open('index.html', 'w') as f:
    f.write(content)
