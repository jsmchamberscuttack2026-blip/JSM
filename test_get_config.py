import requests

url = "http://127.0.0.1:8081/api/system-config"
resp = requests.get(url)
print(resp.status_code)
print(resp.text)
