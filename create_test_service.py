#!/usr/bin/env python3
"""
Création d'un service de test avec une image pour tester la recherche
"""

import requests
import base64
import json

def create_test_service():
    """Crée un service de test avec une image"""
    print("🔧 Création d'un service de test avec image")
    print("=" * 50)
    
    BASE_URL = "http://localhost:3001"
    API_BASE = f"{BASE_URL}/api"
    
    # Charger l'image en base64
    try:
        with open("test_image.jpg", "rb") as f:
            image_data = f.read()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        print(f"✅ Image chargée: {len(image_data)} bytes")
    except Exception as e:
        print(f"❌ Erreur lors du chargement de l'image: {e}")
        return False
    
    # Demander le token d'authentification
    token = input("🔑 Entrez votre token d'authentification: ").strip()
    
    if not token:
        print("❌ Token requis pour créer un service")
        return False
    
    # Données du service de test
    service_data = {
        "titre_service": "Service de test - Blazer élégant",
        "description": "Service de test pour vérifier la recherche d'images. Blazer de qualité professionnelle.",
        "category": "Mode",
        "is_tarissable": False,
        "prix": 15000,
        "devise": "XAF",
        "base64_image": [image_base64]
    }
    
    print("\n📤 Création du service...")
    
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        
        response = requests.post(
            f"{API_BASE}/prestataire/valider-service",
            json=service_data,
            headers=headers,
            timeout=15
        )
        
        print(f"  Status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                service_id = result.get("id")
                print(f"✅ Service créé avec succès! ID: {service_id}")
                
                # Vérifier que l'image a été sauvegardée
                print("\n🔍 Vérification de la sauvegarde de l'image...")
                time.sleep(2)  # Attendre un peu
                
                # Vérifier dans la base de données
                print("  Vérifiez dans la base que l'image a été sauvegardée")
                print("  Puis relancez le test de recherche d'images")
                
                return True
                
            except Exception as e:
                print(f"⚠️ Réponse non-JSON: {response.text[:200]}")
                return False
                
        elif response.status_code == 401:
            print("❌ Erreur d'authentification - token invalide")
            return False
        elif response.status_code == 400:
            print("❌ Erreur de validation des données")
            try:
                error_data = response.json()
                print(f"  Détails: {json.dumps(error_data, indent=2)}")
            except:
                print(f"  Réponse: {response.text[:200]}")
            return False
        else:
            print(f"❌ Erreur lors de la création: {response.status_code}")
            print(f"Réponse: {response.text[:200]}")
            return False
            
    except Exception as e:
        print(f"❌ Exception lors de la création: {e}")
        return False

if __name__ == "__main__":
    import time
    create_test_service() 