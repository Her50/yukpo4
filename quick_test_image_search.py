#!/usr/bin/env python3
"""
Test rapide de la recherche d'images dans Yukpo
Version simplifiée pour tests rapides
"""

import requests
import base64
import os
import sys

def quick_test():
    """Test rapide de la recherche d'images"""
    print("🚀 Test rapide de recherche d'images dans Yukpo")
    print("=" * 50)
    
    # Configuration
    BASE_URL = "http://localhost:3001"
    API_BASE = f"{BASE_URL}/api"
    
    # Vérifier que l'image de test existe
    test_image_path = "test_image.jpg"
    if not os.path.exists(test_image_path):
        print(f"❌ Image de test non trouvée: {test_image_path}")
        print("💡 Placez l'image de test dans le répertoire courant")
        return False
    
    # Vérifier que le backend est accessible
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print(f"❌ Backend non accessible (status: {response.status_code})")
            return False
        print("✅ Backend accessible")
    except Exception as e:
        print(f"❌ Backend non accessible: {e}")
        return False
    
    # Demander le token
    token = input("🔑 Entrez votre token d'authentification (ou appuyez sur Entrée pour tester sans auth): ").strip()
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        print("✅ Token fourni")
    else:
        print("⚠️ Test sans authentification")
    
    # Test 1: Vérifier l'endpoint de recherche d'images
    print("\n🔍 Test 1: Vérification de l'endpoint de recherche d'images")
    try:
        response = requests.get(f"{API_BASE}/image-search/health", headers=headers, timeout=5)
        if response.status_code == 200:
            print("✅ Endpoint de recherche d'images accessible")
        else:
            print(f"⚠️ Endpoint accessible mais status: {response.status_code}")
    except Exception as e:
        print(f"❌ Endpoint non accessible: {e}")
    
    # Test 2: Vérifier la structure de la base de données
    print("\n🗄️ Test 2: Vérification de la structure de la base")
    try:
        response = requests.get(f"{API_BASE}/admin/db/structure", headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            media_columns = data.get("media", {}).get("columns", [])
            required_columns = ["image_signature", "image_hash", "image_metadata"]
            
            missing_columns = [col for col in required_columns if col not in media_columns]
            if not missing_columns:
                print("✅ Toutes les colonnes de recherche d'images sont présentes")
            else:
                print(f"❌ Colonnes manquantes: {missing_columns}")
                print("💡 Appliquez la migration: migrations/20250110000000_extend_media_for_image_search.sql")
        else:
            print(f"⚠️ Impossible de vérifier la structure (status: {response.status_code})")
    except Exception as e:
        print(f"⚠️ Impossible de vérifier la structure: {e}")
    
    # Test 3: Test de recherche simple
    print("\n🔍 Test 3: Test de recherche d'images")
    try:
        # Encoder l'image en base64
        with open(test_image_path, "rb") as f:
            image_data = f.read()
        
        # Créer un fichier temporaire pour l'upload
        temp_path = "temp_test.jpg"
        with open(temp_path, "wb") as f:
            f.write(image_data)
        
        # Test d'upload et recherche
        with open(temp_path, "rb") as f:
            files = {"image": f}
            response = requests.post(
                f"{API_BASE}/image-search/upload",
                files=files,
#!/usr/bin/env python3
"""
Test rapide de la recherche d'images dans Yukpo
Version simplifiée pour tests rapides
"""

import requests
import base64
import os
import sys

def quick_test():
    """Test rapide de la recherche d'images"""
    print("🚀 Test rapide de recherche d'images dans Yukpo")
    print("=" * 50)
    
    # Configuration
    BASE_URL = "http://localhost:3001"
    API_BASE = f"{BASE_URL}/api"
    
    # Vérifier que l'image de test existe
    test_image_path = "test_image.jpg"
    if not os.path.exists(test_image_path):
        print(f"❌ Image de test non trouvée: {test_image_path}")
        print("💡 Placez l'image de test dans le répertoire courant")
        return False
    
    # Vérifier que le backend est accessible
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code != 200:
            print(f"❌ Backend non accessible (status: {response.status_code})")
            return False
        print("✅ Backend accessible")
    except Exception as e:
        print(f"❌ Backend non accessible: {e}")
        return False
    
    # Demander le token
    token = input("🔑 Entrez votre token d'authentification (ou appuyez sur Entrée pour tester sans auth): ").strip()
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
        print("✅ Token fourni")
    else:
        print("⚠️ Test sans authentification")
    
    # Test 1: Vérifier l'endpoint de recherche d'images
    print("\n🔍 Test 1: Vérification de l'endpoint de recherche d'images")
    try:
        response = requests.get(f"{API_BASE}/image-search/health", headers=headers, timeout=5)
        if response.status_code == 200:
            print("✅ Endpoint de recherche d'images accessible")
        else:
            print(f"⚠️ Endpoint accessible mais status: {response.status_code}")
    except Exception as e:
        print(f"❌ Endpoint non accessible: {e}")
    
    # Test 2: Vérifier la structure de la base de données
    print("\n🗄️ Test 2: Vérification de la structure de la base")
    try:
        response = requests.get(f"{API_BASE}/admin/db/structure", headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            media_columns = data.get("media", {}).get("columns", [])
            required_columns = ["image_signature", "image_hash", "image_metadata"]
            
            missing_columns = [col for col in required_columns if col not in media_columns]
            if not missing_columns:
                print("✅ Toutes les colonnes de recherche d'images sont présentes")
            else:
                print(f"❌ Colonnes manquantes: {missing_columns}")
                print("💡 Appliquez la migration: migrations/20250110000000_extend_media_for_image_search.sql")
        else:
            print(f"⚠️ Impossible de vérifier la structure (status: {response.status_code})")
    except Exception as e:
        print(f"⚠️ Impossible de vérifier la structure: {e}")
    
    # Test 3: Test de recherche simple
    print("\n🔍 Test 3: Test de recherche d'images")
    try:
        # Encoder l'image en base64
        with open(test_image_path, "rb") as f:
            image_data = f.read()
        
        # Créer un fichier temporaire pour l'upload
        temp_path = "temp_test.jpg"
        with open(temp_path, "wb") as f:
            f.write(image_data)
        
        # Test d'upload et recherche
        with open(temp_path, "rb") as f:
            files = {"image": f}
            response = requests.post(
                f"{API_BASE}/image-search/upload",
                files=files,
                headers=headers,
                timeout=30
            )
        
        # Nettoyer le fichier temporaire
        os.remove(temp_path)
        
        if response.status_code == 200:
            results = response.json()
            total_found = results.get("total_found", 0)
            print(f"✅ Recherche réussie! {total_found} résultats trouvés")
            
            if total_found > 0:
                print("📊 Premiers résultats:")
                for i, result in enumerate(results.get("results", [])[:3]):
                    service_id = result.get("service_id", "N/A")
                    score = result.get("similarity_score", 0)
                    print(f"  {i+1}. Service ID: {service_id}, Score: {score:.3f}")
            else:
                print("ℹ️ Aucun résultat trouvé (normal si la base est vide)")
                
        elif response.status_code == 401:
            print("❌ Erreur d'authentification - token requis")
        elif response.status_code == 404:
            print("❌ Endpoint de recherche d'images non trouvé")
        else:
            print(f"❌ Erreur lors de la recherche (status: {response.status_code})")
            print(f"Réponse: {response.text[:200]}...")
            
    except Exception as e:
        print(f"❌ Erreur lors du test de recherche: {e}")
    
    # Test 4: Vérification des médias existants
    print("\n📷 Test 4: Vérification des médias existants")
    try:
        response = requests.get(f"{API_BASE}/admin/media/count", headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            total_media = data.get("total", 0)
            total_images = data.get("images", 0)
            images_with_signature = data.get("images_with_signature", 0)
            
            print(f"📊 Statistiques des médias:")
            print(f"  - Total: {total_media}")
            print(f"  - Images: {total_images}")
            print(f"  - Images avec signature: {images_with_signature}")
            
            if total_images > 0 and images_with_signature == 0:
                print("⚠️ Images présentes mais sans signatures - traitement requis")
            elif total_images == 0:
                print("ℹ️ Aucune image dans la base (normal pour une nouvelle installation)")
            else:
                print("✅ Images correctement traitées")
        else:
            print(f"⚠️ Impossible de récupérer les statistiques (status: {response.status_code})")
    except Exception as e:
        print(f"⚠️ Impossible de récupérer les statistiques: {e}")
    
    print("\n" + "=" * 50)
    
    # Résumé et recommandations
    print("📋 Résumé du test rapide:")
    print("✅ Backend accessible")
    
    # Recommandations
    print("\n🔧 Recommandations:")
    if not token:
        print("1. Fournissez un token d'authentification pour des tests complets")
    
    print("2. Pour un test complet, utilisez: python test_image_search.py")
    print("3. Pour vérifier la base de données: .\\test_image_search.ps1")
    print("4. Pour appliquer la migration: .\\apply_image_search_migration.ps1")
    
    print("\n🎯 Test rapide terminé!")
    return True

if __name__ == "__main__":
    try:
        success = quick_test()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\n❌ Test interrompu par l'utilisateur")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Erreur inattendue: {e}")
        sys.exit(1) 