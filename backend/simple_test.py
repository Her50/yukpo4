import requests

# Test simple de l'endpoint
url = "http://127.0.0.1:3001/api/image-search/upload"
print(f"Testing: {url}")

try:
    response = requests.get(url)
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}") 