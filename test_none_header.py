import requests

try:
    url = "https://httpbin.org/post"
    headers = {'X-Test-Header': None}
    requests.post(url, headers=headers)
except Exception as e:
    print(f"EXCEPTION: {type(e).__name__}: {str(e)}")
