#!/usr/bin/env python3
"""
Test simple de l'endpoint de recherche d'images
"""

import requests
import time

def test_image_search_endpoint():
    """Test de l'endpoint /api/image-search/upload"""
    
    url = "http://127.0.0.1:3001/api/image-search/upload"
    print(f"🔍 Test de l'endpoint: {url}")
    
    # Attendre que le serveur soit prêt
    print("⏳ Attente du serveur...")
    time.sleep(2)
    
    try:
        # Test GET (devrait retourner 405 Method Not Allowed)
        print("📤 Test GET...")
        response = requests.get(url, timeout=5)
        print(f"✅ GET Status: {response.status_code}")
        
        if response.status_code == 405:
            print("🎯 Parfait ! L'endpoint existe (405 = Method Not Allowed pour GET)")
            print("💡 L'endpoint attend une requête POST avec une image")
        else:
            print(f"⚠️  Statut inattendu: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Erreur de connexion - Le serveur n'est pas encore démarré")
        print("💡 Attendez que le serveur affiche 'Serveur lancé sur http://127.0.0.1:3001'")
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    print("🚀 Test de l'endpoint de recherche d'images")
    print("=" * 50)
    test_image_search_endpoint() 