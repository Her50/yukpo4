#!/usr/bin/env python3
"""
Test simple de création de service avec image
"""

import requests
import base64
import json

def test_create_service_with_image():
    """Test de création d'un service avec une image"""
    print("🔧 Test de création de service avec image")
    
    # Configuration
    BASE_URL = "http://localhost:3001"
    API_BASE = f"{BASE_URL}/api"
    
    # Vérifier que l'image de test existe
    try:
        with open("test_image.jpg", "rb") as f:
            image_data = f.read()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        print(f"✅ Image chargée: {len(image_data)} bytes")
    except Exception as e:
        print(f"❌ Erreur lors du chargement de l'image: {e}")
        return False
    
    # Données du service
    service_data = {
        "titre_service": "Service de test - Blazer élégant",
        "description": "Service de test pour vérifier la recherche d'images.",
        "category": "Mode",
        "is_tarissable": False,
        "prix": 15000,
        "devise": "XAF",
        "base64_image": [image_base64]
    }
    
    print(f"📋 Données du service préparées")
    
    # Test 1: Vérifier l'endpoint de création de service
    print(f"\n🔍 Test 1: Vérification de l'endpoint de création")
    try:
        response = requests.get(f"{API_BASE}/prestataire/valider-service", timeout=5)
        print(f"  GET /prestataire/valider-service: {response.status_code}")
    except Exception as e:
        print(f"  ❌ Erreur: {e}")
    
    # Test 2: Vérifier l'endpoint de recherche d'images
    print(f"\n🔍 Test 2: Vérification de l'endpoint de recherche")
    try:
        response = requests.get(f"{API_BASE}/image-search/upload", timeout=5)
        print(f"  GET /image-search/upload: {response.status_code}")
    except Exception as e:
        print(f"  ❌ Erreur: {e}")
    
    # Test 3: Vérifier l'endpoint de recherche d'images (POST)
    print(f"\n🔍 Test 3: Test de l'endpoint de recherche (POST)")
    try:
        # Créer un fichier temporaire pour l'upload
        with open("test_image.jpg", "rb") as f:
            files = {"image": f}
            response = requests.post(f"{API_BASE}/image-search/upload", files=files, timeout=10)
        
        print(f"  POST /image-search/upload: {response.status_code}")
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"  ✅ Réponse: {result.get('total_found', 'N/A')} résultats trouvés")
            except:
                print(f"  📄 Réponse: {response.text[:200]}...")
        else:
            print(f"  ❌ Erreur: {response.text[:200]}...")
            
    except Exception as e:
        print(f"  ❌ Erreur: {e}")
    
    print(f"\n🎯 Test terminé!")
    return True

if __name__ == "__main__":
    test_create_service_with_image() 