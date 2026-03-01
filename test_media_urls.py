import urllib.request
import json

backend = "https://yukpo-backend-376093909298.europe-west1.run.app"

# Test 1: Try backend's own media serving endpoint
print("=== Testing backend media endpoints ===")
media_paths = [
    "/api/media/files/services/3/images/image_bafc6328-1f1d-419c-be03-a1d5e637c6db.jpg",
    "/api/media/files/uploads/services/3/images/image_bafc6328-1f1d-419c-be03-a1d5e637c6db.jpg",
    "/uploads/services/3/images/image_bafc6328-1f1d-419c-be03-a1d5e637c6db.jpg",
    "/api/media/temp/",
]
for p in media_paths:
    full = backend + p
    try:
        req = urllib.request.Request(full, method='HEAD')
        resp = urllib.request.urlopen(req, timeout=8)
        ct = resp.getheader('Content-Type', '?')
        cl = resp.getheader('Content-Length', '?')
        print(f"  OK {resp.status} ct={ct} size={cl}: {p}")
    except urllib.error.HTTPError as e:
        print(f"  {e.code}: {p}")
    except Exception as e:
        print(f"  ERR: {p} -> {str(e)[:60]}")

# Test 2: Check what path is stored in media table by querying product media endpoint
print("\n=== Testing product media endpoint ===")
for idx in [0, 1]:
    url = f"{backend}/api/services/3/products/{idx}/media"
    try:
        r = urllib.request.urlopen(url, timeout=10)
        data = json.loads(r.read())
        print(f"  product idx={idx}: {json.dumps(data)[:300]}")
    except urllib.error.HTTPError as e:
        print(f"  product idx={idx}: HTTP {e.code}")
    except Exception as e:
        print(f"  product idx={idx}: {str(e)[:60]}")

# Test 3: Check service detail to see raw data structure
print("\n=== Service 3 detail (raw data) ===")
try:
    r = urllib.request.urlopen(f"{backend}/api/services/3", timeout=10)
    svc = json.loads(r.read())
    data = svc.get("data", {})
    # Check if images/videos are in service.data
    imgs = data.get("images", "ABSENT")
    vids = data.get("videos", "ABSENT")
    print(f"  service.data.images: {json.dumps(imgs)[:200]}")
    print(f"  service.data.videos: {json.dumps(vids)[:200]}")
    # Check produits
    produits = data.get("produits", "ABSENT")
    if isinstance(produits, dict):
        valeur = produits.get("valeur", [])
        if isinstance(valeur, list) and valeur:
            p0 = valeur[0]
            print(f"  produits[0] keys: {list(p0.keys()) if isinstance(p0, dict) else type(p0).__name__}")
            if isinstance(p0, dict):
                print(f"  produits[0].images: {json.dumps(p0.get('images','ABSENT'))[:200]}")
                print(f"  produits[0].videos: {json.dumps(p0.get('videos','ABSENT'))[:200]}")
    elif isinstance(produits, list) and produits:
        print(f"  produits[0].images: {json.dumps(produits[0].get('images','ABSENT'))[:200]}")
except Exception as e:
    print(f"  Error: {e}")

# Test 4: Try different services with media
print("\n=== Scanning services for media ===")
found = 0
for sid in range(1, 50):
    if found >= 5:
        break
    try:
        r = urllib.request.urlopen(f"{backend}/api/services/{sid}/products", timeout=8)
        data = json.loads(r.read())
        for p in data:
            pd = p.get("product_data", {})
            imgs = pd.get("images", [])
            if isinstance(imgs, list) and imgs:
                found += 1
                img0 = imgs[0]
                # Test accessibility
                try:
                    req = urllib.request.Request(img0, method='HEAD')
                    resp = urllib.request.urlopen(req, timeout=6)
                    print(f"  svc={sid} idx={p['product_index']}: OK {resp.status} {img0[:90]}")
                except urllib.error.HTTPError as e:
                    print(f"  svc={sid} idx={p['product_index']}: {e.code} {img0[:90]}")
                except:
                    print(f"  svc={sid} idx={p['product_index']}: ERR {img0[:90]}")
                break
    except:
        pass
