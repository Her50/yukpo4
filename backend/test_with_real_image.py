#!/usr/bin/env python3
"""
Test avec une vraie image PNG valide
"""

import requests
import os

def test_with_real_image():
    """Test avec la vraie image PNG créée"""
    
    url = "http://127.0.0.1:3001/api/image-search/upload"
    print(f"🔍 Test avec vraie image: {url}")
    
    # Vérifier que l'image existe
    image_path = "test_image.png"
    if not os.path.exists(image_path):
        print(f"❌ Image de test non trouvée: {image_path}")
        return
    
    # Lire l'image
    with open(image_path, 'rb') as f:
        image_data = f.read()
    
    print(f"📸 Image chargée: {len(image_data)} bytes")
    
    # Token d'authentification
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5MTMxNiwiaWF0IjoxNzU2ODA2NTU2LCJleHAiOjE3NTY4OTI5NTZ9.B3TV8SD9I_d92OfmDQ4ejbQodpjPa0wpmCrR7qYd9jU"
    
    # Préparer la requête multipart
    files = {
        'image': ('test_image.png', image_data, 'image/png')
    }
    
    headers = {
        'Authorization': f'Bearer {token}'
    }
    
    try:
        print("📤 Envoi de la requête POST...")
        response = requests.post(
            url,
            files=files,
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
    print("🚀 Test avec vraie image PNG")
    print("=" * 40)
    test_with_real_image() 