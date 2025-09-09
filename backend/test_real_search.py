#!/usr/bin/env python3
"""
Test complet de la recherche d'images
"""

import requests
import base64

def test_real_image_search():
    """Test de la recherche d'images avec une vraie image"""
    
    url = "http://127.0.0.1:3001/api/image-search/upload"
    print(f"🔍 Test de recherche d'images: {url}")
    
    # Token d'authentification (utilisez le vôtre)
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5MTMxNiwiaWF0IjoxNzU2ODA2MzQ5LCJleHAiOjE3NTY4OTI3NDl9.tJVRzcYunpuXsUDeQhkaxLGHhgO1voDPwaxl2FNohjI"
    
    # Créer une image de test simple (1x1 pixel noir en PNG)
    test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01\xf5\x27\xe5\xd7\x00\x00\x00\x00IEND\xaeB`\x82'
    
    # Préparer la requête multipart
    files = {
        'image': ('test.png', test_image_data, 'image/png')
    }
    
    headers = {
        'Authorization': f'Bearer {token}'
    }
    
    try:
        print("📤 Envoi de la requête POST avec image...")
        response = requests.post(
            url,
            files=files,
            headers=headers,
            timeout=30
        )
        
        print(f"📥 Réponse reçue: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
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
    print("🚀 Test complet de la recherche d'images")
    print("=" * 50)
    test_real_image_search() 