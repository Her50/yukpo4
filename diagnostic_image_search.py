#!/usr/bin/env python3
"""
Diagnostic détaillé du système de recherche d'images
"""

import requests
import json
import traceback

def diagnostic_complet():
    """Diagnostic complet du système de recherche d'images"""
    print("🔍 Diagnostic du système de recherche d'images")
    print("=" * 60)
    
    BASE_URL = "http://localhost:3001"
    API_BASE = f"{BASE_URL}/api"
    
    # Test 1: Vérifier la structure de la base de données
    print("\n📊 Test 1: Vérification de la structure de la base")
    try:
        # Test simple de l'endpoint avec une image
        with open("test_image.jpg", "rb") as f:
            files = {"image": f}
            
            print("  Envoi de l'image...")
            response = requests.post(f"{API_BASE}/image-search/upload", files=files, timeout=15)
            
            print(f"  Status: {response.status_code}")
            print(f"  Headers: {dict(response.headers)}")
            
            if response.status_code == 500:
                print("  ❌ Erreur 500 détectée")
                try:
                    error_data = response.json()
                    print(f"  Erreur JSON: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"  Erreur texte: {response.text[:500]}")
                    
            elif response.status_code == 200:
                print("  ✅ Succès!")
                try:
                    result = response.json()
                    print(f"  Résultat: {json.dumps(result, indent=2)}")
                except:
                    print(f"  Réponse non-JSON: {response.text[:200]}")
                    
            else:
                print(f"  ⚠️ Status inattendu: {response.status_code}")
                print(f"  Réponse: {response.text[:200]}")
                
    except Exception as e:
        print(f"  ❌ Exception: {e}")
        print(f"  Traceback: {traceback.format_exc()}")
    
    # Test 2: Vérifier l'endpoint de recherche par métadonnées
    print("\n🔍 Test 2: Test de recherche par métadonnées")
    try:
        search_data = {
            "query": "blazer",
            "limit": 5
        }
        
        response = requests.post(f"{API_BASE}/image-search/search", 
                               json=search_data, timeout=10)
        
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"  ✅ Recherche par métadonnées réussie: {result.get('total_found', 0)} résultats")
            except:
                print(f"  ⚠️ Réponse non-JSON: {response.text[:200]}")
        else:
            print(f"  ❌ Erreur: {response.status_code}")
            print(f"  Réponse: {response.text[:200]}")
            
    except Exception as e:
        print(f"  ❌ Exception: {e}")
    
    # Test 3: Vérifier l'endpoint de traitement des images existantes
    print("\n🔄 Test 3: Test de traitement des images existantes")
    try:
        response = requests.post(f"{API_BASE}/image-search/process-existing", timeout=10)
        
        print(f"  Status: {response.status_code}")
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"  ✅ Traitement réussi: {result}")
            except:
                print(f"  ⚠️ Réponse non-JSON: {response.text[:200]}")
        else:
            print(f"  ❌ Erreur: {response.status_code}")
            print(f"  Réponse: {response.text[:200]}")
            
    except Exception as e:
        print(f"  ❌ Exception: {e}")
    
    # Test 4: Vérifier la santé du backend
    print("\n💚 Test 4: Vérification de la santé du backend")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"  /health status: {response.status_code}")
        
        if response.status_code == 200:
            print("  ✅ Endpoint /health accessible")
        else:
            print(f"  ⚠️ /health status inattendu: {response.status_code}")
            
    except Exception as e:
        print(f"  ❌ /health non accessible: {e}")
    
    print("\n" + "=" * 60)
    print("🎯 Diagnostic terminé!")

if __name__ == "__main__":
    diagnostic_complet() 