import re

with open('app.py', 'r') as f:
    content = f.read()

# Change model name
content = content.replace("model = genai.GenerativeModel('gemini-1.5-flash')", "model = genai.GenerativeModel('gemini-pro')")

with open('app.py', 'w') as f:
    f.write(content)
    print("Model updated to gemini-pro")
