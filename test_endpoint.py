#!/usr/bin/env python3
"""
Script simple pour tester l'endpoint de recherche d'image
"""

import requests

def test_endpoints():
    """Tester les différents endpoints"""
    base_url = "http://localhost:3001"
    
    print("🔍 Test des endpoints du backend...")
    
    # Test 1: Health check
    try:
        response = requests.get(f"{base_url}/healthz", timeout=5)
        print(f"✅ /healthz: {response.status_code}")
    except Exception as e:
        print(f"❌ /healthz: {e}")
    
    # Test 2: Endpoint de recherche d'image
    try:
        response = requests.get(f"{base_url}/api/image-search/upload", timeout=5)
        print(f"📡 /api/image-search/upload (GET): {response.status_code}")
        if response.status_code == 405:
            print("  ✅ Endpoint accessible (méthode POST requise)")
        elif response.status_code == 404:
            print("  ❌ Endpoint non trouvé (404)")
        else:
            print(f"  ⚠️  Status inattendu: {response.status_code}")
    except Exception as e:
        print(f"❌ /api/image-search/upload: {e}")
    
    # Test 3: Endpoint de traitement des images existantes
    try:
        response = requests.get(f"{base_url}/api/image-search/process-existing", timeout=5)
        print(f"📡 /api/image-search/process-existing (GET): {response.status_code}")
        if response.status_code == 405:
            print("  ✅ Endpoint accessible (méthode POST requise)")
        elif response.status_code == 404:
            print("  ❌ Endpoint non trouvé (404)")
        else:
            print(f"  ⚠️  Status inattendu: {response.status_code}")
    except Exception as e:
        print(f"❌ /api/image-search/process-existing: {e}")
    
    # Test 4: Endpoint de recherche par métadonnées
    try:
        response = requests.get(f"{base_url}/api/image-search/search", timeout=5)
        print(f"📡 /api/image-search/search (GET): {response.status_code}")
        if response.status_code == 405:
            print("  ✅ Endpoint accessible (méthode POST requise)")
        elif response.status_code == 404:
            print("  ❌ Endpoint non trouvé (404)")
        else:
            print(f"  ⚠️  Status inattendu: {response.status_code}")
    except Exception as e:
        print(f"❌ /api/image-search/search: {e}")
    
    # Test 5: Test avec méthode POST
    try:
        response = requests.post(f"{base_url}/api/image-search/process-existing", timeout=5)
        print(f"📡 /api/image-search/process-existing (POST): {response.status_code}")
        if response.status_code == 200:
            print("  ✅ Endpoint fonctionne avec POST")
            print(f"  📊 Response: {response.text[:200]}...")
        else:
            print(f"  ⚠️  Status: {response.status_code}")
            print(f"  📊 Response: {response.text[:200]}...")
    except Exception as e:
        print(f"❌ /api/image-search/process-existing (POST): {e}")

if __name__ == "__main__":
    test_endpoints() 