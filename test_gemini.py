import requests

api_key = "AQ.Ab8RN6IBMVFLPYgY4N6qkf5E0qLnB9xgvgtqjlND2hITrOsNPA"
url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key={api_key}"
headers = {'Content-Type': 'application/json'}
payload = {
    "contents": [{"parts": [{"text": "Hello"}]}]
}
resp = requests.post(url, headers=headers, json=payload)
print(resp.status_code)
print(resp.text)
