import re

with open("staff-dashboard.html", "r") as f:
    html = f.read()

scripts = re.findall(r'<script.*?>([\s\S]*?)</script>', html)

import subprocess
import tempfile
import os

for i, script in enumerate(scripts):
    with tempfile.NamedTemporaryFile(suffix=".js", delete=False) as temp:
        temp.write(script.encode('utf-8'))
        temp_name = temp.name
    
    try:
        # Run node syntax check
        subprocess.run(["node", "--check", temp_name], check=True, capture_output=True, text=True)
        print(f"Script {i} syntax OK")
    except FileNotFoundError:
        print("node not found, cannot check syntax")
        break
    except subprocess.CalledProcessError as e:
        print(f"Script {i} SYNTAX ERROR:")
        print(e.stderr)
    
    os.remove(temp_name)
