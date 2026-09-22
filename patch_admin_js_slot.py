import re

with open('js/admin.js', 'r') as f:
    content = f.read()

# Load
old_load = """document.getElementById('appt-max-day').value = s.max_per_day || 5;"""
new_load = """document.getElementById('appt-max-day').value = s.max_per_day || 5;
            document.getElementById('appt-slot-duration').value = s.slot_duration || 30;"""
content = content.replace(old_load, new_load)

# Save
old_save = """const max_per_day = parseInt(document.getElementById('appt-max-day').value);"""
new_save = """const max_per_day = parseInt(document.getElementById('appt-max-day').value);
    const slot_duration = parseInt(document.getElementById('appt-slot-duration').value);"""
content = content.replace(old_save, new_save)

old_body = """body: JSON.stringify({ start_time, end_time, max_per_day, available_days })"""
new_body = """body: JSON.stringify({ start_time, end_time, max_per_day, slot_duration, available_days })"""
content = content.replace(old_body, new_body)

with open('js/admin.js', 'w') as f:
    f.write(content)
