import urllib.request
import json

urls = [
    'http://127.0.0.1:8000/workflow/match-location',
    'https://rentwise-ai-service.onrender.com/workflow/match-location'
]

data = json.dumps({
    "objective": "A house in deh vala",
    "tenant_profile": {"name": "Prospective Tenant", "role": "Tenant"}
}).encode('utf-8')

headers = {'Content-Type': 'application/json'}

for url in urls:
    print(f"Testing {url}...")
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=10) as response:
            result = response.read().decode('utf-8')
            print(f"Success! Response: {result[:200]}...")
    except Exception as e:
        print(f"Failed: {e}")
