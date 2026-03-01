import urllib.request, json

BASE = "https://yukpo-backend-376093909298.europe-west1.run.app"

print("=== Products service 3 ===")
req = urllib.request.Request(f"{BASE}/api/services/3/products")
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
for p in data:
    pd = p.get("product_data", {})
    pi = p.get("product_index", "?")
    imgs = pd.get("images", [])
    if isinstance(imgs, list):
        paths = [u.split("?")[0].split("/")[-1] for u in imgs]
    else:
        paths = [str(imgs)[:50]]
    print(f"  idx={pi}: {len(imgs)} imgs -> {paths}")

# Test if presigned URL works
print("\n=== Test presigned URL ===")
url = data[0]["product_data"]["images"][0]
print(f"  URL contains BOM: {'%EF%BB%BF' in url}")
try:
    req2 = urllib.request.Request(url, method="HEAD")
    resp2 = urllib.request.urlopen(req2)
    print(f"  Status: {resp2.status}")
except Exception as e:
    print(f"  Error: {e}")
