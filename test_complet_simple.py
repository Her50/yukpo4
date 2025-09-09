#!/usr/bin/env python3
"""
Test complet et simple de création et recherche d'images dans Yukpo
"""

import requests
import base64
import time
import json

def test_complet():
    """Test complet du système de recherche d'images"""
    print("🚀 Test complet du système de recherche d'images")
    print("=" * 60)
    
    # Configuration
    BASE_URL = "http://localhost:3001"
    API_BASE = f"{BASE_URL}/api"
    
    # Étape 1: Vérifier que le backend est accessible
    print("\n🔍 Étape 1: Vérification de l'accessibilité du backend")
    try:
        response = requests.get(f"{BASE_URL}/", timeout=5)
        print(f"✅ Backend accessible (status: {response.status_code})")
    except Exception as e:
        print(f"❌ Backend non accessible: {e}")
        print("💡 Assurez-vous que le backend est démarré avec: cargo run --features image_search")
        return False
    
    # Étape 2: Charger l'image de test
    print("\n📷 Étape 2: Chargement de l'image de test")
    try:
        with open("test_image.jpg", "rb") as f:
            image_data = f.read()
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        print(f"✅ Image chargée: {len(image_data)} bytes")
    except Exception as e:
        print(f"❌ Erreur lors du chargement de l'image: {e}")
        return False
    
    # Étape 3: Vérifier l'endpoint de recherche d'images
    print("\n🔍 Étape 3: Vérification de l'endpoint de recherche d'images")
    try:
        response = requests.get(f"{API_BASE}/image-search/upload", timeout=5)
        print(f"  GET /image-search/upload: {response.status_code}")
        
        if response.status_code == 405:  # Method Not Allowed est normal pour un endpoint POST
            print("✅ Endpoint de recherche d'images accessible (POST requis)")
        else:
            print(f"⚠️ Endpoint accessible mais status inattendu: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Endpoint non accessible: {e}")
        return False
    
    # Étape 4: Test de recherche d'images (POST)
    print("\n🔍 Étape 4: Test de recherche d'images")
    try:
        with open("test_image.jpg", "rb") as f:
            files = {"image": f}
            response = requests.post(f"{API_BASE}/image-search/upload", files=files, timeout=10)
        
        print(f"  POST /image-search/upload: {response.status_code}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                total_found = result.get('total_found', 0)
                print(f"✅ Recherche réussie! {total_found} résultats trouvés")
                
                if total_found > 0:
                    print("📊 Premiers résultats:")
                    for i, res in enumerate(result.get('results', [])[:3]):
                        service_id = res.get('service_id', 'N/A')
                        score = res.get('similarity_score', 0)
                        print(f"  {i+1}. Service ID: {service_id}, Score: {score:.3f}")
                else:
                    print("ℹ️ Aucun résultat trouvé (normal si la base est vide)")
                    
            except Exception as e:
                print(f"⚠️ Réponse non-JSON: {response.text[:200]}...")
                
        elif response.status_code == 401:
            print("❌ Erreur d'authentification - token requis")
        elif response.status_code == 404:
            print("❌ Endpoint non trouvé - vérifiez que la feature image_search est activée")
        else:
            print(f"❌ Erreur lors de la recherche: {response.status_code}")
            print(f"Réponse: {response.text[:200]}...")
            
    except Exception as e:
        print(f"❌ Erreur lors du test de recherche: {e}")
        return False
    
    # Étape 5: Test de création d'un service (optionnel, nécessite un token)
    print("\n🔧 Étape 5: Test de création de service (optionnel)")
    token = input("🔑 Entrez votre token d'authentification (ou appuyez sur Entrée pour ignorer): ").strip()
    
    if token:
        print("🔧 Test de création de service avec image...")
        try:
            service_data = {
                "titre_service": "Service de test - Blazer élégant",
                "description": "Service de test pour vérifier la recherche d'images.",
                "category": "Mode",
                "is_tarissable": False,
                "prix": 15000,
                "devise": "XAF",
                "base64_image": [image_base64]
            }
            
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            response = requests.post(f"{API_BASE}/prestataire/valider-service", 
                                  json=service_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                service_id = response.json().get("id")
                print(f"✅ Service créé avec succès! ID: {service_id}")
                
                # Attendre un peu puis rechercher
                print("⏳ Attente de 3 secondes pour la synchronisation...")
                time.sleep(3)
                
                # Rechercher à nouveau
                print("🔍 Recherche après création du service...")
                with open("test_image.jpg", "rb") as f:
                    files = {"image": f}
                    response = requests.post(f"{API_BASE}/image-search/upload", files=files, timeout=10)
                
                if response.status_code == 200:
                    result = response.json()
                    total_found = result.get('total_found', 0)
                    print(f"✅ Recherche après création: {total_found} résultats trouvés")
                    
                    # Vérifier si le service créé est trouvé
                    found_service = False
                    for res in result.get('results', []):
                        if res.get('service_id') == service_id:
                            score = res.get('similarity_score', 0)
                            print(f"🎉 Service créé trouvé! Score: {score:.3f}")
                            found_service = True
                            break
                    
                    if not found_service:
                        print("❌ Service créé non trouvé dans la recherche")
                else:
                    print(f"❌ Erreur lors de la recherche après création: {response.status_code}")
                    
            else:
                print(f"❌ Erreur lors de la création du service: {response.status_code}")
                print(f"Réponse: {response.text[:200]}...")
                
        except Exception as e:
            print(f"❌ Erreur lors du test de création: {e}")
    else:
        print("ℹ️ Test de création de service ignoré")
    
    print("\n" + "=" * 60)
    print("🎯 Test complet terminé!")
    return True

if __name__ == "__main__":
    try:
        test_complet()
    except KeyboardInterrupt:
        print("\n\n❌ Test interrompu par l'utilisateur")
    except Exception as e:
        print(f"\n\n❌ Erreur inattendue: {e}") 