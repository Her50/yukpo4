#!/usr/bin/env python3
"""
Test de la génération de signature d'image
"""

import requests
import json

def test_signature_generation():
    """Test de la génération de signature d'image"""
    print("🔍 Test de la génération de signature d'image")
    print("=" * 50)
    
    BASE_URL = "http://localhost:3001"
    API_BASE = f"{BASE_URL}/api"
    
    try:
        # Test 1: Vérifier que l'endpoint répond
        print("\n📡 Test 1: Vérification de l'endpoint")
        response = requests.get(f"{API_BASE}/image-search/upload", timeout=5)
        print(f"  GET /image-search/upload: {response.status_code}")
        
        # Test 2: Upload d'image avec une image très simple
        print("\n📤 Test 2: Upload d'image simple")
        
        # Créer une image très simple (1x1 pixel blanc)
        from PIL import Image
        import io
        
        # Créer une image 1x1 pixel blanche
        img = Image.new('RGB', (1, 1), color='white')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='JPEG')
        img_bytes.seek(0)
        
        files = {"image": ("simple_test.jpg", img_bytes, "image/jpeg")}
        
        print("  Envoi d'une image 1x1 pixel...")
        response = requests.post(f"{API_BASE}/image-search/upload", files=files, timeout=30)
        
        print(f"  Status: {response.status_code}")
        print(f"  Content-Type: {response.headers.get('content-type', 'N/A')}")
        
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
                
                # Analyser l'erreur
                error_msg = error_data.get('error', '')
                if 'Erreur lors de la recherche d\'images' in error_msg:
                    print("  🔍 Problème identifié: Erreur dans la recherche d'images")
                    print("  💡 Le problème peut être dans la génération de signature")
                    
            except Exception as e:
                print(f"  ⚠️ Erreur lors du parsing JSON: {e}")
                print(f"  Réponse brute: {response.text}")
                
        else:
            print(f"  ⚠️ Status inattendu: {response.status_code}")
            print(f"  Réponse: {response.text[:200]}")
            
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        import traceback
        print(f"  Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    test_signature_generation() 