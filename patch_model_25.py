import re

with open('app.py', 'r') as f:
    content = f.read()

content = content.replace("gemini-1.5-flash", "gemini-2.5-flash")

with open('app.py', 'w') as f:
    f.write(content)
    print("Model updated to gemini-2.5-flash")
