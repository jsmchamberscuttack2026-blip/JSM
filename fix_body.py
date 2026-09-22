import re

with open('app.py', 'r') as f:
    content = f.read()

# find the broken body string
broken_body = '''        body = f"Dear {name},

Your appointment has been successfully scheduled.

Date: {assigned_date}
Time: {assigned_time}
Subject: {subject}

Please find your official appointment slip attached.

Regards,
JSM Chambers"'''

fixed_body = '''        body = f"""Dear {name},

Your appointment has been successfully scheduled.

Date: {assigned_date}
Time: {assigned_time}
Subject: {subject}

Please find your official appointment slip attached.

Regards,
JSM Chambers"""'''

content = content.replace(broken_body, fixed_body)

with open('app.py', 'w') as f:
    f.write(content)
