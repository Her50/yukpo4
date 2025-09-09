#!/usr/bin/env python3
"""
Test simple d'upload d'image pour diagnostiquer l'erreur 500
"""

import requests
import json

def test_simple_upload():
    """Test simple d'upload d'image"""
    print("🔍 Test simple d'upload d'image")
    print("=" * 50)
    
    BASE_URL = "http://localhost:3001"
    API_BASE = f"{BASE_URL}/api"
    
    try:
        # Test 1: Vérifier que l'endpoint répond
        print("\n📡 Test 1: Vérification de l'endpoint")
        response = requests.get(f"{API_BASE}/image-search/upload", timeout=5)
        print(f"  GET /image-search/upload: {response.status_code}")
        
        # Test 2: Upload d'image simple
        print("\n📤 Test 2: Upload d'image")
        with open("test_image.jpg", "rb") as f:
            files = {"image": f}
            
            print("  Envoi de l'image...")
            response = requests.post(f"{API_BASE}/image-search/upload", files=files, timeout=15)
            
            print(f"  Status: {response.status_code}")
            print(f"  Content-Type: {response.headers.get('content-type', 'N/A')}")
            print(f"  Content-Length: {response.headers.get('content-length', 'N/A')}")
            
            if response.status_code == 200:
                print("  ✅ Succès!")
                try:
                    result = response.json()
                    print(f"  Résultat: {json.dumps(result, indent=2)}")
                except:
                    print(f"  Réponse non-JSON: {response.text[:200]}")
                    
            elif response.status_code == 500:
                print("  ❌ Erreur 500 détectée")
                try:
                    error_data = response.json()
                    print(f"  Erreur JSON: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"  Erreur texte: {response.text}")
                    
            else:
                print(f"  ⚠️ Status inattendu: {response.status_code}")
                print(f"  Réponse: {response.text[:200]}")
                
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        import traceback
        print(f"  Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    test_simple_upload() 