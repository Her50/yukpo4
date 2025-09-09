#!/usr/bin/env python3
"""
Test détaillé pour capturer l'erreur exacte du backend
"""

import requests
import json
import traceback

def test_detailed_error():
    """Test détaillé pour identifier l'erreur exacte"""
    print("🔍 Test détaillé de l'erreur backend")
    print("=" * 50)
    
    BASE_URL = "http://localhost:3001"
    API_BASE = f"{BASE_URL}/api"
    
    try:
        # Test 1: Vérifier que l'endpoint répond
        print("\n📡 Test 1: Vérification de l'endpoint")
        response = requests.get(f"{API_BASE}/image-search/upload", timeout=5)
        print(f"  GET /image-search/upload: {response.status_code}")
        
        # Test 2: Upload d'image avec plus de détails
        print("\n📤 Test 2: Upload d'image détaillé")
        with open("test_image.jpg", "rb") as f:
            files = {"image": f}
            
            print("  Envoi de l'image...")
            response = requests.post(f"{API_BASE}/image-search/upload", files=files, timeout=30)
            
            print(f"  Status: {response.status_code}")
            print(f"  Headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                print("  ✅ Succès!")
                try:
                    result = response.json()
                    print(f"  Résultat: {json.dumps(result, indent=2)}")
                except:
                    print(f"  Réponse non-JSON: {response.text[:200]}")
                    
            elif response.status_code == 500:
                print("  ❌ Erreur 500 détectée")
                print(f"  Content-Type: {response.headers.get('content-type', 'N/A')}")
                print(f"  Content-Length: {response.headers.get('content-length', 'N/A')}")
                
                try:
                    error_data = response.json()
                    print(f"  Erreur JSON: {json.dumps(error_data, indent=2)}")
                    
                    # Analyser l'erreur
                    error_msg = error_data.get('error', '')
                    if 'Erreur lors de la recherche d\'images' in error_msg:
                        print("  🔍 Problème identifié: Erreur dans la recherche d'images")
                        print("  💡 Vérifiez les logs du backend pour plus de détails")
                        
                except Exception as e:
                    print(f"  ⚠️ Erreur lors du parsing JSON: {e}")
                    print(f"  Réponse brute: {response.text}")
                    
            else:
                print(f"  ⚠️ Status inattendu: {response.status_code}")
                print(f"  Réponse: {response.text[:200]}")
                
    except requests.exceptions.Timeout:
        print("  ❌ Timeout - le backend met trop de temps à répondre")
    except requests.exceptions.ConnectionError:
        print("  ❌ Erreur de connexion - vérifiez que le backend est démarré")
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        print(f"  Traceback: {traceback.format_exc()}")
    
    # Test 3: Vérifier la base de données
    print("\n🗄️ Test 3: Vérification de la base de données")
    try:
        import psycopg2
        
        # Demander le mot de passe
        password = input("🔑 Entrez le mot de passe PostgreSQL pour vérifier la base: ").strip()
        
        if password:
            conn = psycopg2.connect(
                host='localhost',
                database='yukpo_db',
                user='postgres',
                password=password
            )
            cursor = conn.cursor()
            
            # Vérifier les données
            cursor.execute("SELECT COUNT(*) FROM media WHERE type = 'image'")
            media_count = cursor.fetchone()[0]
            print(f"  📊 Images dans la base: {media_count}")
            
            if media_count > 0:
                cursor.execute("SELECT id, service_id, image_signature IS NOT NULL, image_metadata IS NOT NULL FROM media WHERE type = 'image' LIMIT 3")
                for row in cursor.fetchall():
                    media_id, service_id, has_signature, has_metadata = row
                    print(f"    - Media ID {media_id}: Service {service_id}, Signature: {has_signature}, Métadonnées: {has_metadata}")
            
            cursor.close()
            conn.close()
        else:
            print("  ⚠️ Mot de passe non fourni, vérification de la base ignorée")
            
    except Exception as e:
        print(f"  ❌ Erreur lors de la vérification de la base: {e}")
    
    print("\n" + "=" * 50)
    print("🎯 Test détaillé terminé!")

if __name__ == "__main__":
    test_detailed_error() 