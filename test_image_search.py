#!/usr/bin/env python3
"""
Script de test pour vérifier la création d'un service avec une image
et la recherche par image dans Yukpo
"""

import requests
import json
import base64
import time
import os
from PIL import Image
import io

# Configuration
BASE_URL = "http://localhost:3000"  # Ajuster selon votre configuration
API_BASE = f"{BASE_URL}/api"

def encode_image_to_base64(image_path):
    """Encode une image en base64"""
    try:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    except Exception as e:
        print(f"❌ Erreur lors de l'encodage de l'image: {e}")
        return None

def create_test_service_with_image(image_base64, token):
    """Crée un service de test avec une image"""
    print("🔧 Création d'un service de test avec l'image...")
    
    service_data = {
        "titre_service": "Service de test - Blazer élégant",
        "description": "Service de test pour vérifier la recherche d'images. Ce service propose un blazer élégant en plaid beige.",
        "category": "Mode",
        "is_tarissable": False,
        "prix": 15000,
        "devise": "XAF",
        "base64_image": [image_base64]
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{API_BASE}/prestataire/valider-service",
            json=service_data,
            headers=headers
        )
        
        if response.status_code == 200:
            service_id = response.json().get("id")
            print(f"✅ Service créé avec succès! ID: {service_id}")
            return service_id
        else:
            print(f"❌ Erreur lors de la création du service: {response.status_code}")
            print(f"Réponse: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Erreur lors de la création du service: {e}")
        return None

def search_by_image(image_base64, token):
    """Effectue une recherche par image"""
    print("🔍 Recherche par image...")
    
    # Convertir le base64 en bytes pour l'upload
    image_bytes = base64.b64decode(image_base64)
    
    # Créer un fichier temporaire pour l'upload
    temp_image_path = "temp_test_image.jpg"
    with open(temp_image_path, "wb") as f:
        f.write(image_bytes)
    
    try:
        # Upload et recherche
        with open(temp_image_path, "rb") as f:
            files = {"image": f}
            headers = {"Authorization": f"Bearer {token}"}
            
            response = requests.post(
                f"{API_BASE}/image-search/upload",
                files=files,
                headers=headers
            )
        
        # Nettoyer le fichier temporaire
        os.remove(temp_image_path)
        
        if response.status_code == 200:
            results = response.json()
            print(f"✅ Recherche réussie! {results.get('total_found', 0)} résultats trouvés")
            return results
        else:
            print(f"❌ Erreur lors de la recherche: {response.status_code}")
            print(f"Réponse: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Erreur lors de la recherche: {e}")
        # Nettoyer le fichier temporaire en cas d'erreur
        if os.path.exists(temp_image_path):
            os.remove(temp_image_path)
        return None

def verify_image_match(service_id, search_results):
    """Vérifie si l'image du service créé est trouvée dans les résultats de recherche"""
    print(f"🔍 Vérification du match pour le service {service_id}...")
    
    if not search_results or not search_results.get('results'):
        print("❌ Aucun résultat de recherche à vérifier")
        return False
    
    found_service = False
    for result in search_results['results']:
        if result.get('service_id') == service_id:
            similarity = result.get('similarity_score', 0)
            print(f"✅ Service trouvé! Score de similarité: {similarity:.3f}")
            found_service = True
            break
    
    if not found_service:
        print("❌ Le service créé n'a pas été trouvé dans les résultats de recherche")
        print("📊 Résultats disponibles:")
        for i, result in enumerate(search_results['results'][:5]):  # Afficher les 5 premiers
            print(f"  {i+1}. Service ID: {result.get('service_id')}, Score: {result.get('similarity_score', 0):.3f}")
    
    return found_service

def check_database_state(service_id):
    """Vérifie l'état de la base de données pour le service créé"""
    print(f"🗄️ Vérification de l'état de la base de données pour le service {service_id}...")
    
    try:
        # Vérifier le service
        response = requests.get(f"{API_BASE}/services/{service_id}")
        if response.status_code == 200:
            service_data = response.json()
            print(f"✅ Service trouvé dans la base: {service_data.get('titre_service', 'N/A')}")
        else:
            print(f"❌ Service non trouvé dans la base")
        
        # Vérifier les médias associés
        response = requests.get(f"{API_BASE}/media/service/{service_id}")
        if response.status_code == 200:
            media_data = response.json()
            print(f"📷 {len(media_data)} média(x) associé(s) au service")
            for media in media_data:
                print(f"  - Type: {media.get('type')}, Path: {media.get('path')}")
        else:
            print(f"❌ Impossible de récupérer les médias du service")
            
    except Exception as e:
        print(f"❌ Erreur lors de la vérification de la base: {e}")

def main():
    """Fonction principale de test"""
    print("🚀 Test de création et recherche d'images dans Yukpo")
    print("=" * 60)
    
    # Vérifier que l'image de test existe
    test_image_path = "test_image.jpg"  # L'image fournie par l'utilisateur
    if not os.path.exists(test_image_path):
        print(f"❌ Image de test non trouvée: {test_image_path}")
        print("💡 Veuillez placer l'image de test dans le répertoire courant")
        return
    
    # Encoder l'image en base64
    image_base64 = encode_image_to_base64(test_image_path)
    if not image_base64:
        return
    
    print(f"📷 Image encodée en base64 ({len(image_base64)} caractères)")
    
    # Demander le token d'authentification
    token = input("🔑 Entrez votre token d'authentification: ").strip()
    if not token:
        print("❌ Token requis pour continuer")
        return
    
    print("\n" + "=" * 60)
    
    # Étape 1: Créer un service avec l'image
    service_id = create_test_service_with_image(image_base64, token)
    if not service_id:
        print("❌ Impossible de continuer sans service créé")
        return
    
    print("\n" + "=" * 60)
    
    # Attendre un peu pour que le service soit bien enregistré
    print("⏳ Attente de 3 secondes pour la synchronisation...")
    time.sleep(3)
    
    # Étape 2: Vérifier l'état de la base de données
    check_database_state(service_id)
    
    print("\n" + "=" * 60)
    
    # Étape 3: Rechercher par image
    search_results = search_by_image(image_base64, token)
    if not search_results:
        print("❌ Impossible de continuer sans résultats de recherche")
        return
    
    print("\n" + "=" * 60)
    
    # Étape 4: Vérifier le match
    match_found = verify_image_match(service_id, search_results)
    
    print("\n" + "=" * 60)
    
    # Résumé du test
    if match_found:
        print("🎉 SUCCÈS: Le test de création et recherche d'images fonctionne correctement!")
    else:
        print("❌ ÉCHEC: Le service créé n'a pas été trouvé dans la recherche")
        print("\n🔧 Suggestions de débogage:")
        print("1. Vérifier que la migration image_search est appliquée")
        print("2. Vérifier que les signatures d'images sont générées")
        print("3. Vérifier les logs du backend")
        print("4. Vérifier la configuration de la recherche d'images")
    
    print("\n" + "=" * 60)

if __name__ == "__main__":
    main() 