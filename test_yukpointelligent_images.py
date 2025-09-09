#!/usr/bin/env python3
"""
Script de test pour vérifier que yukpointelligent sauvegarde les images
"""

import requests
import json
import base64
import time
from pathlib import Path

# Configuration
BASE_URL = "http://localhost:3000"
TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOjEsInJvbGUiOiJ1c2VyIiwiZW1haWwiOiJsZWxlaGVybmFuZGV6MjAwN0B5YWhvby5mciIsInRva2Vuc19iYWxhbmNlIjo5OTk5OTI5MzM2MCwiaWF0IjoxNzU2NzM2NTY2LCJleHAiOjE3NTY4MjI5NjZ9._kNdqev7ZXbu4YTnlz0n7KnULkDWWm54QYys_i38k84"

def encode_image_to_base64(image_path):
    """Encode une image en base64"""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def test_yukpointelligent_with_image():
    """Test de création de service avec image via yukpointelligent"""
    
    # Créer une image de test simple (1x1 pixel PNG)
    test_image_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
    
    # Sauvegarder l'image de test
    test_image_path = "test_image.png"
    with open(test_image_path, "wb") as f:
        f.write(test_image_data)
    
    print("🖼️ Image de test créée:", test_image_path)
    
    # Encoder l'image en base64
    base64_image = base64.b64encode(test_image_data).decode('utf-8')
    
    # Préparer la requête pour yukpointelligent
    payload = {
        "texte": "Je vends une veste de qualité",
        "base64_image": [base64_image]
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}"
    }
    
    print("🚀 Test de création de service avec image via yukpointelligent...")
    print("📤 Payload:", json.dumps(payload, indent=2))
    
    try:
        # Appel à yukpointelligent
        response = requests.post(
            f"{BASE_URL}/api/ia/creation-service",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        print(f"📥 Status Code: {response.status_code}")
        print(f"📥 Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Service créé avec succès!")
            print("📊 Détails:", json.dumps(result, indent=2))
            
            # Vérifier si les images ont été sauvegardées
            if result.get("images_saved"):
                print("✅ Images sauvegardées avec succès!")
            else:
                print("❌ Images non sauvegardées")
                
            return result
        else:
            print(f"❌ Erreur: {response.status_code}")
            print(f"❌ Message: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return None
    finally:
        # Nettoyer l'image de test
        if Path(test_image_path).exists():
            Path(test_image_path).unlink()
            print("🧹 Image de test supprimée")

def test_search_with_image():
    """Test de recherche avec la même image"""
    
    # Créer la même image de test
    test_image_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
    base64_image = base64.b64encode(test_image_data).decode('utf-8')
    
    # Préparer la requête de recherche
    payload = {
        "texte": "recherche veste",
        "base64_image": [base64_image]
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {TOKEN}"
    }
    
    print("\n🔍 Test de recherche avec image...")
    print("📤 Payload:", json.dumps(payload, indent=2))
    
    try:
        # Appel à la recherche
        response = requests.post(
            f"{BASE_URL}/api/ia/auto",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        print(f"📥 Status Code: {response.status_code}")
        print(f"📥 Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Recherche réussie!")
            print("📊 Détails:", json.dumps(result, indent=2))
            return result
        else:
            print(f"❌ Erreur: {response.status_code}")
            print(f"❌ Message: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return None

def main():
    """Fonction principale"""
    print("🧪 Test de yukpointelligent avec images")
    print("=" * 50)
    
    # Test 1: Création de service avec image
    print("\n📝 Test 1: Création de service avec image")
    service_result = test_yukpointelligent_with_image()
    
    if service_result:
        print("\n⏳ Attendre 2 secondes pour que la base de données se mette à jour...")
        time.sleep(2)
        
        # Test 2: Recherche avec la même image
        print("\n🔍 Test 2: Recherche avec la même image")
        search_result = test_search_with_image()
        
        if search_result:
            print("\n✅ Tests terminés avec succès!")
        else:
            print("\n❌ Test de recherche échoué")
    else:
        print("\n❌ Test de création échoué")
    
    print("\n" + "=" * 50)
    print("🏁 Fin des tests")

if __name__ == "__main__":
    main() 