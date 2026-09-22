import re

with open('index.html', 'r') as f:
    content = f.read()

broken_js = """    const name = document.getElementById("app-name").value.trim();
    const email = document.getElementById("app-email").value.trim();
    

    const name = document.getElementById("app-name").value;
    const email = document.getElementById("app-email").value;"""

fixed_js = """    const name = document.getElementById("app-name").value.trim();
    const email = document.getElementById("app-email").value.trim();"""

content = content.replace(broken_js, fixed_js)

with open('index.html', 'w') as f:
    f.write(content)
