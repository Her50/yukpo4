#!/usr/bin/env python3
"""
Test simple d'upload d'image
"""

import requests
import os

def test_simple_upload():
    """Test simple d'upload sans traitement"""
    
    url = "http://127.0.0.1:3001/api/image-search/upload"
    print(f"🔍 Test simple d'upload: {url}")
    
    # Créer une image très simple (1x1 pixel)
    from PIL import Image
    import io
    
    # Image 1x1 pixel rouge
    img = Image.new('RGB', (1, 1), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    image_data = buffer.getvalue()
    
    print(f"📸 Image créée: {len(image_data)} bytes")
    
    # Token d'authentification
    token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5MTMxNiwiaWF0IjoxNzU2ODA2NTU2LCJleHAiOjE3NTY4OTI5NTZ9.B3TV8SD9I_d92OfmDQ4ejbQodpjPa0wpmCrR7qYd9jU"
    
    # Préparer la requête multipart
    files = {
        'image': ('simple.png', image_data, 'image/png')
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
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Succès! Résultats: {result}")
        else:
            print(f"❌ Erreur: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Erreur de requête: {e}")
    except Exception as e:
        print(f"❌ Erreur inattendue: {e}")

if __name__ == "__main__":
    print("🚀 Test simple d'upload d'image")
    print("=" * 40)
    test_simple_upload() 