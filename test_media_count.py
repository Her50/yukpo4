import urllib.request
import json
import sys

BASE = "https://yukpo-backend-376093909298.europe-west1.run.app"

# 1. Tester /api/services/3/products
print("=== /api/services/3/products ===")
try:
    req = urllib.request.Request(f"{BASE}/api/services/3/products")
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    for p in data:
        pd = p.get("product_data", {})
        imgs = pd.get("images", [])
        vids = pd.get("videos", [])
        pi = p.get("product_index", "?")
        name = pd.get("nom", pd.get("name", "?"))
        
        # Check type of images
        img_type = type(imgs).__name__
        vid_type = type(vids).__name__
        
        print(f"  idx={pi} '{name}': images({img_type})={len(imgs) if isinstance(imgs, list) else imgs}, videos({vid_type})={len(vids) if isinstance(vids, list) else vids}")
        if isinstance(imgs, list) and imgs:
            for i, img in enumerate(imgs):
                url_preview = str(img)[:100]
                print(f"    img[{i}]: {url_preview}...")
        if isinstance(vids, list) and vids:
            for i, vid in enumerate(vids):
                url_preview = str(vid)[:100]
                print(f"    vid[{i}]: {url_preview}...")
except Exception as e:
    print(f"  ERROR: {e}")

# 2. Tester la table media directement via /api/services/3/media
print("\n=== /api/services/3/media ===")
try:
    req = urllib.request.Request(f"{BASE}/api/services/3/media")
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read())
    if isinstance(data, list):
        print(f"  Total media items: {len(data)}")
        for m in data:
            print(f"    id={m.get('id')} type={m.get('media_type',m.get('type'))} idx={m.get('product_index')} path={str(m.get('path',''))[:80]}")
    elif isinstance(data, dict):
        media_list = data.get("media", data.get("data", []))
        print(f"  Total media items: {len(media_list)}")
        for m in media_list:
            print(f"    id={m.get('id')} type={m.get('media_type',m.get('type'))} idx={m.get('product_index')} path={str(m.get('path',''))[:80]}")
except Exception as e:
    print(f"  ERROR: {e}")

# 3. Tester la recherche
print("\n=== /api/search (besoin) ===")
try:
    search_data = json.dumps({"query": "cafe", "latitude": 3.87, "longitude": 11.52}).encode()
    req = urllib.request.Request(f"{BASE}/api/search", data=search_data, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    results = json.loads(resp.read())
    
    items = results if isinstance(results, list) else results.get("results", results.get("data", []))
    print(f"  Total results: {len(items)}")
    for r in items[:5]:
        name = r.get("nom", r.get("name", r.get("service_name", "?")))
        imgs = r.get("images", [])
        vids = r.get("videos", [])
        
        img_type = type(imgs).__name__
        vid_type = type(vids).__name__
        
        img_count = len(imgs) if isinstance(imgs, list) else str(imgs)[:50]
        vid_count = len(vids) if isinstance(vids, list) else str(vids)[:50]
        
        print(f"  '{name}': images({img_type})={img_count}, videos({vid_type})={vid_count}")
        
        # Check products inside result
        products = r.get("produits", r.get("products", []))
        if isinstance(products, list):
            for pp in products[:3]:
                pp_imgs = pp.get("images", [])
                pp_vids = pp.get("videos", [])
                pp_name = pp.get("nom", pp.get("name", "?"))
                pp_idx = pp.get("product_index", "?")
                img_c = len(pp_imgs) if isinstance(pp_imgs, list) else str(pp_imgs)[:50]
                vid_c = len(pp_vids) if isinstance(pp_vids, list) else str(pp_vids)[:50]
                print(f"    product idx={pp_idx} '{pp_name}': images={img_c}, videos={vid_c}")
except Exception as e:
    print(f"  ERROR: {e}")
