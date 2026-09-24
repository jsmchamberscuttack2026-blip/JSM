import re

with open('app.py', 'r') as f:
    content = f.read()

patch_code = """
import socket
import urllib3.util.connection as urllib3_cn

def allowed_gai_family():
    return socket.AF_INET

urllib3_cn.allowed_gai_family = allowed_gai_family
"""

content = content.replace("import requests", patch_code + "\n        import requests")

with open('app.py', 'w') as f:
    f.write(content)
