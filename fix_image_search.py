#!/usr/bin/env python3
"""
Script pour résoudre le problème de recherche d'image dans Yukpo
"""

import psycopg2
import json
import base64
import requests
import time
from datetime import datetime

# Configuration de la base de données
DB_CONFIG = {
    "host": "localhost",
    "port": 5432,
    "database": "yukpo_db",
    "user": "postgres",
    "password": "Hernandez87"
}

def step1_check_backend_status():
    """Étape 1: Vérifier que le backend est démarré"""
    print("🔍 ÉTAPE 1: Vérification du statut du backend...")
    
    try:
        response = requests.get("http://localhost:3001/healthz", timeout=5)
        if response.status_code == 200:
            print("✅ Backend démarré et accessible")
            return True
        else:
            print(f"❌ Backend accessible mais retourne {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Backend non accessible: {e}")
        print("💡 Démarrez le backend avec: cd backend && cargo run --features image_search")
        return False

def step2_check_image_search_endpoint():
    """Étape 2: Vérifier que l'endpoint de recherche d'image est accessible"""
    print("\n🔍 ÉTAPE 2: Vérification de l'endpoint de recherche d'image...")
    
    try:
        # Tester l'endpoint avec une requête simple
        response = requests.get("http://localhost:3001/api/image-search/upload", timeout=5)
        if response.status_code == 405:  # Method Not Allowed (normal pour GET sur POST endpoint)
            print("✅ Endpoint de recherche d'image accessible (méthode POST requise)")
            return True
        elif response.status_code == 404:
            print("❌ Endpoint de recherche d'image non trouvé (404)")
            print("💡 Vérifiez que la fonctionnalité image_search est activée dans le backend")
            return False
        else:
            print(f"⚠️  Endpoint accessible mais retourne {response.status_code}")
            return True
    except Exception as e:
        print(f"❌ Erreur lors du test de l'endpoint: {e}")
        return False

def step3_check_media_table_content():
    """Étape 3: Vérifier le contenu de la table media"""
    print("\n🔍 ÉTAPE 3: Vérification du contenu de la table media...")
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Compter les services avec images
        cursor.execute("""
            SELECT COUNT(*) FROM services 
            WHERE data->>'base64_image' IS NOT NULL 
            AND jsonb_array_length(data->'base64_image') > 0
        """)
        services_with_images = cursor.fetchone()[0]
        print(f"📊 Services avec images dans data: {services_with_images}")
        
        # Compter les entrées dans media
        cursor.execute("SELECT COUNT(*) FROM media WHERE type = 'image'")
        images_in_media = cursor.fetchone()[0]
        print(f"📊 Images dans table media: {images_in_media}")
        
        # Vérifier les services récents
        cursor.execute("""
            SELECT id, data->>'titre_service' as titre, created_at
            FROM services 
            ORDER BY created_at DESC 
            LIMIT 3
        """)
        recent_services = cursor.fetchall()
        
        if recent_services:
            print("\n📋 Services récents:")
            for service in recent_services:
                service_id, titre, created_at = service
                print(f"  - ID: {service_id}, Titre: {titre}, Date: {created_at}")
        
        conn.close()
        
        if services_with_images > 0 and images_in_media == 0:
            print("❌ PROBLÈME DÉTECTÉ: Les services ont des images mais elles ne sont pas dans la table media")
            return False
        elif services_with_images == 0:
            print("⚠️  Aucun service avec images trouvé")
            return False
        else:
            print("✅ Images correctement sauvegardées dans la table media")
            return True
            
    except Exception as e:
        print(f"❌ Erreur lors de la vérification de la table media: {e}")
        return False

def step4_fix_media_table():
    """Étape 4: Corriger la table media en récupérant les images des services"""
    print("\n🔍 ÉTAPE 4: Correction de la table media...")
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Récupérer tous les services avec des images
        cursor.execute("""
            SELECT id, data->>'base64_image' as images, data->>'titre_service' as titre
            FROM services 
            WHERE data->>'base64_image' IS NOT NULL 
            AND jsonb_array_length(data->'base64_image') > 0
        """)
        
        services_with_images = cursor.fetchall()
        
        if not services_with_images:
            print("⚠️  Aucun service avec images à traiter")
            return True
        
        print(f"🔄 Traitement de {len(services_with_images)} services avec images...")
        
        for service in services_with_images:
            service_id, images_json, titre = service
            
            try:
                # Parser le JSON des images
                images = json.loads(images_json)
                
                for i, base64_image in enumerate(images):
                    # Générer un nom de fichier unique
                    import uuid
                    file_id = str(uuid.uuid4())
                    file_path = f"uploads/services/{file_id}.jpg"
                    
                    # Décoder et sauvegarder l'image
                    image_data = base64.b64decode(base64_image)
                    
                    # Créer le répertoire s'il n'existe pas
                    import os
                    os.makedirs("uploads/services", exist_ok=True)
                    
                    # Sauvegarder le fichier
                    with open(file_path, "wb") as f:
                        f.write(image_data)
                    
                    # Insérer dans la table media
                    cursor.execute("""
                        INSERT INTO media (service_id, type, path, uploaded_at, service_media_type)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT DO NOTHING
                    """, (service_id, "image", file_path, datetime.now(), "image_realisation"))
                    
                    print(f"  ✅ Image {i+1} du service {service_id} ({titre}) sauvegardée")
                
            except Exception as e:
                print(f"  ❌ Erreur lors du traitement du service {service_id}: {e}")
                continue
        
        # Valider les changements
        conn.commit()
        print("✅ Correction de la table media terminée")
        
        # Vérifier le résultat
        cursor.execute("SELECT COUNT(*) FROM media WHERE type = 'image'")
        new_count = cursor.fetchone()[0]
        print(f"📊 Nouveau total d'images dans media: {new_count}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors de la correction de la table media: {e}")
        return False

def step5_generate_image_signatures():
    """Étape 5: Générer les signatures d'images pour la recherche"""
    print("\n🔍 ÉTAPE 5: Génération des signatures d'images...")
    
    try:
        # Appeler l'endpoint de traitement des images existantes
        response = requests.post("http://localhost:3001/api/image-search/process-existing", timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Signatures générées: {result}")
            return True
        else:
            print(f"❌ Erreur lors de la génération des signatures: {response.status_code}")
            print(f"📡 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur lors de la génération des signatures: {e}")
        return False

def step6_test_image_search():
    """Étape 6: Tester la recherche d'image"""
    print("\n🔍 ÉTAPE 6: Test de la recherche d'image...")
    
    try:
        # Créer une image de test simple
        test_image_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")
        
        # Tester l'endpoint de recherche
        files = {'image': ('test.png', test_image_data, 'image/png')}
        data = {
            'similarity_threshold': '0.3',
            'max_results': '10'
        }
        
        response = requests.post("http://localhost:3001/api/image-search/upload", files=files, data=data, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Recherche d'image fonctionne!")
            print(f"📊 Résultats trouvés: {result.get('total_found', 0)}")
            return True
        else:
            print(f"❌ Recherche d'image échoue: {response.status_code}")
            print(f"📡 Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur lors du test de recherche: {e}")
        return False

def main():
    """Fonction principale"""
    print("🔧 RÉSOLUTION DU PROBLÈME DE RECHERCHE D'IMAGE YUKPO")
    print("=" * 70)
    
    # Étape 1: Vérifier le backend
    if not step1_check_backend_status():
        print("\n❌ Impossible de continuer sans backend démarré")
        return
    
    # Étape 2: Vérifier l'endpoint
    if not step2_check_image_search_endpoint():
        print("\n❌ Problème avec l'endpoint de recherche d'image")
        return
    
    # Étape 3: Vérifier la table media
    media_ok = step3_check_media_table_content()
    
    # Étape 4: Corriger la table media si nécessaire
    if not media_ok:
        if not step4_fix_media_table():
            print("\n❌ Impossible de corriger la table media")
            return
    
    # Étape 5: Générer les signatures
    if not step5_generate_image_signatures():
        print("\n⚠️  Impossible de générer les signatures, mais on continue")
    
    # Étape 6: Tester la recherche
    if step6_test_image_search():
        print("\n🎉 PROBLÈME RÉSOLU! La recherche d'image fonctionne maintenant")
    else:
        print("\n⚠️  La recherche d'image ne fonctionne toujours pas")
        print("💡 Vérifiez les logs du backend pour plus de détails")

if __name__ == "__main__":
    main() 