import requests

url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent"
headers = {
    'Content-Type': 'application/json',
    'X-goog-api-key': None
}
payload = {
    "contents": [{"parts": [{"text": "Hello"}]}]
}
print("Sending request...")
try:
    resp = requests.post(url, headers=headers, json=payload, timeout=10)
    print("Status:", resp.status_code)
    print("Response:", resp.text)
except Exception as e:
    print("Exception:", str(e))
