#!/usr/bin/env python3
"""
Test rapide du backend pour vérifier qu'il fonctionne
"""

import requests
import time

def quick_backend_test():
    """Test rapide du backend"""
    print("🔍 Test rapide du backend")
    print("=" * 40)
    
    BASE_URL = "http://localhost:3001"
    
    # Attendre que le backend soit prêt
    print("⏳ Attente du démarrage du backend...")
    
    for attempt in range(10):
        try:
            response = requests.get(f"{BASE_URL}/", timeout=2)
            if response.status_code in [200, 404, 405]:  # 404/405 sont normaux pour la racine
                print(f"✅ Backend accessible (status: {response.status_code})")
                break
        except:
            pass
        
        print(f"  Tentative {attempt + 1}/10...")
        time.sleep(2)
    else:
        print("❌ Backend non accessible après 20 secondes")
        return False
    
    # Test de l'endpoint de recherche d'images
    print("\n🔍 Test de l'endpoint de recherche d'images...")
    try:
        response = requests.get(f"{BASE_URL}/api/image-search/upload", timeout=5)
        print(f"  GET /image-search/upload: {response.status_code}")
        
        if response.status_code == 405:  # Method Not Allowed est normal
            print("  ✅ Endpoint accessible (POST requis)")
        else:
            print(f"  ⚠️ Status inattendu: {response.status_code}")
            
    except Exception as e:
        print(f"  ❌ Erreur: {e}")
        return False
    
    print("\n🎯 Test rapide terminé!")
    return True

if __name__ == "__main__":
    quick_backend_test() 