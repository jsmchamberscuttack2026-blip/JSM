import re

with open('app.py', 'r') as f:
    content = f.read()

old_logic = """    # calculate time slot
    sh, sm = map(int, start_time_str.split(':'))
    eh, em = map(int, end_time_str.split(':'))
    total_mins = (eh*60 + em) - (sh*60 + sm)
    slot_size = total_mins / max_per_day
    
    start_mins = (sh*60 + sm) + (count * slot_size)
    ah = int(start_mins // 60)
    am = int(start_mins % 60)
    assigned_time = f"{ah:02d}:{am:02d}"
    assigned_date = date_str"""

new_logic = """    # calculate precise time slot
    slot_duration = int(settings.get("slot_duration", 30))
    sh, sm = map(int, start_time_str.split(':'))
    
    start_mins = (sh*60 + sm) + (count * slot_duration)
    end_mins = start_mins + slot_duration
    
    def format_time_12hr(total_m):
        h = int(total_m // 60)
        m = int(total_m % 60)
        ampm = "AM" if h < 12 else "PM"
        dh = h if h <= 12 else h - 12
        if dh == 0: dh = 12
        return f"{dh:02d}:{m:02d} {ampm}"
        
    assigned_time = f"{format_time_12hr(start_mins)} - {format_time_12hr(end_mins)}"
    assigned_date = date_str"""

content = content.replace(old_logic, new_logic)

with open('app.py', 'w') as f:
    f.write(content)
