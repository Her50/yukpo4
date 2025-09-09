#!/usr/bin/env python3
"""
Script de test pour l'API de recherche d'images
"""

import requests
import json
import base64

# Configuration
BASE_URL = "http://127.0.0.1:3001"
API_ENDPOINT = f"{BASE_URL}/api/image-search/upload"

# Token d'authentification (à remplacer par un vrai token)
TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5MTMxNiwiaWF0IjoxNzU2ODA2MzQ5LCJleHAiOjE3NTY4OTI3NDl9.tJVRzcYunpuXsUDeQhkaxLGHhgO1voDPwaxl2FNohjI"

def test_image_search():
    """Test de la recherche d'images"""
    
    print("🔍 Test de l'API de recherche d'images")
    print(f"URL: {API_ENDPOINT}")
    
    # Créer une image de test simple (1x1 pixel noir)
    test_image_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc```\x00\x00\x00\x04\x00\x01\xf5\x27\xe5\xd7\x00\x00\x00\x00IEND\xaeB`\x82'
    
    # Préparer la requête multipart
    files = {
        'image': ('test.png', test_image_data, 'image/png')
    }
    
    headers = {
        'Authorization': f'Bearer {TOKEN}'
    }
    
    try:
        print("📤 Envoi de la requête...")
        response = requests.post(
            API_ENDPOINT,
            files=files,
            headers=headers,
            timeout=30
        )
        
        print(f"📥 Réponse reçue: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Succès! Résultats: {json.dumps(result, indent=2)}")
        else:
            print(f"❌ Erreur: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de requête: {e}")
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")

if __name__ == "__main__":
    print("🚀 Démarrage des tests de recherche d'images")
    print("=" * 50)
    
    # Test direct de la recherche d'images
    test_image_search() 