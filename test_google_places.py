import urllib.request
import json

KEY = "AIzaSyDqlMAysWsGzv1jQtR6WJn8LZXpH75SwFo"
BASE = "https://maps.googleapis.com/maps/api/place/autocomplete/json"

tests = [
    # Test 1: Direct Google - EXACT meme params que backend proxy
    {"label": "DIRECT: Restaurant Douala (memes params que proxy)",
     "params": f"input=Restaurant+Douala&language=fr&location=4.05,9.7&radius=50000&key={KEY}"},
    
    # Test 2: Direct Google - sans location (plus de resultats?)
    {"label": "DIRECT: Restaurant Douala (sans location)",
     "params": f"input=Restaurant+Douala&language=fr&key={KEY}"},
    
    # Test 3: Direct Google - Pharmacie specifique
    {"label": "DIRECT: Pharmacie centrale Douala",
     "params": f"input=Pharmacie+centrale+Douala&language=fr&location=4.05,9.7&radius=50000&key={KEY}"},
    
    # Test 4: Direct Google - Snack bar precis
    {"label": "DIRECT: Snack bar Akwa Douala",
     "params": f"input=Snack+Akwa+Douala&language=fr&location=4.05,9.7&radius=50000&key={KEY}"},
    
    # Test 5: Direct Google - Adresse precise
    {"label": "DIRECT: Rue Joss Douala",
     "params": f"input=Rue+Joss+Douala&language=fr&location=4.05,9.7&radius=50000&key={KEY}"},
    
    # Test 6: Backend proxy - memes recherches
    {"label": "PROXY: Restaurant Douala",
     "params": "",
     "url": "https://yukpo-backend-376093909298.europe-west1.run.app/api/places/autocomplete?query=Restaurant+Douala&lat=4.05&lng=9.7&radius=50000"},
    
    # Test 7: Backend proxy - Pharmacie
    {"label": "PROXY: Pharmacie centrale Douala",
     "params": "",
     "url": "https://yukpo-backend-376093909298.europe-west1.run.app/api/places/autocomplete?query=Pharmacie+centrale+Douala&lat=4.05&lng=9.7&radius=50000"},
    
    # Test 8: Backend proxy - Snack
    {"label": "PROXY: Snack Akwa Douala",
     "params": "",
     "url": "https://yukpo-backend-376093909298.europe-west1.run.app/api/places/autocomplete?query=Snack+Akwa+Douala&lat=4.05&lng=9.7&radius=50000"},
    
    # Test 9: Backend proxy - Adresse
    {"label": "PROXY: Rue Joss Douala",
     "params": "",
     "url": "https://yukpo-backend-376093909298.europe-west1.run.app/api/places/autocomplete?query=Rue+Joss+Douala&lat=4.05&lng=9.7&radius=50000"},
]

for t in tests:
    label = t["label"]
    url = t.get("url", f"{BASE}?{t['params']}")
    print(f"\n=== {label} ===")
    try:
        req = urllib.request.Request(url)
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read())
        
        if "predictions" in data:
            # Direct Google API response
            status = data.get("status", "?")
            error = data.get("error_message", "none")
            preds = data.get("predictions", [])
            print(f"  Status: {status}, Error: {error}, Count: {len(preds)}")
            for p in preds[:5]:
                types = p.get("types", [])
                desc = p.get("description", "?")[:80]
                print(f"  -> [{','.join(types[:3])}] {desc}")
        elif "results" in data or "data" in data:
            # Backend proxy response
            results = data.get("results", [])
            simple = data.get("data", [])
            success = data.get("success", False)
            error = data.get("error", "none")
            print(f"  Success: {success}, Error: {error}, Results: {len(results)}, Data: {len(simple)}")
            for r in results[:5]:
                desc = r.get("description", "?")[:80]
                types = r.get("types", [])
                print(f"  -> [{','.join(types[:3]) if types else 'no_types'}] {desc}")
            if not results and simple:
                for s in simple[:5]:
                    print(f"  -> {s[:80]}")
        else:
            print(f"  Response keys: {list(data.keys())}")
            print(f"  Raw: {json.dumps(data)[:200]}")
    except Exception as e:
        print(f"  ERROR: {e}")
