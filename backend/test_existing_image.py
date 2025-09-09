#!/usr/bin/env python3
"""
Test avec une image existante dans la base de données
"""

import requests
import json

def test_existing_image_search():
    """Test de recherche avec une image existante"""
    
    url = "http://127.0.0.1:3001/api/image-search/search"
    print(f"🔍 Test de recherche par métadonnées: {url}")
    
    # Token d'authentification
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5MTMxNiwiaWF0IjoxNzU2ODA2NTU2LCJleHAiOjE3NTY4OTI5NTZ9.B3TV8SD9I_d92OfmDQ4ejbQodpjPa0wpmCrR7qYd9jU"
    
    # Métadonnées de test (format PNG, dimensions 10x10)
    test_metadata = {
        "format": "PNG",
        "width": 10,
        "height": 10,
        "file_size": 76
    }
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    try:
        print("📤 Envoi de la requête POST avec métadonnées...")
        response = requests.post(
            url,
            json=test_metadata,
            headers=headers,
            timeout=30
        )
        
        print(f"📥 Réponse reçue: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Succès! Résultats: {result}")
            
            if result.get('total_found', 0) > 0:
                print(f"🎯 Images trouvées: {result['total_found']}")
                for i, img in enumerate(result['results']):
                    print(f"  {i+1}. Service ID: {img.get('service_id')}, Score: {img.get('similarity_score')}")
            else:
                print("⚠️  Aucune image similaire trouvée")
                
        else:
            print(f"❌ Erreur: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de requête: {e}")
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")

if __name__ == "__main__":
    print("🚀 Test de recherche avec image existante")
    print("=" * 50)
    test_existing_image_search() 