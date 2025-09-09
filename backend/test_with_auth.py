#!/usr/bin/env python3
"""
Test de l'architecture IA avec authentification correcte
"""

import requests
import json
import time
import jwt
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "http://127.0.0.1:3001"

def generate_test_jwt():
    """Génère un token JWT de test valide"""
    # Clé secrète (doit correspondre à celle du backend)
    secret = "dev_secret"  # Clé par défaut du backend
    
    # Payload du token
    payload = {
        "user_id": 1,
        "email": "test@yukpo.com",
        "exp": datetime.utcnow() + timedelta(hours=1),
        "iat": datetime.utcnow()
    }
    
    try:
        token = jwt.encode(payload, secret, algorithm="HS256")
        return token
    except Exception as e:
        print(f"❌ Erreur génération JWT: {e}")
        return None

def test_backend_connectivity():
    """Test de connectivité avec l'endpoint ping public"""
    print("🔍 Test de connectivité du backend...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/test/ping", timeout=5)
        if response.status_code == 200:
            print("✅ Backend accessible via /api/test/ping")
            print(f"📄 Réponse: {response.json()}")
            return True
        else:
            print(f"❌ Erreur {response.status_code}: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Erreur de connectivité: {e}")
        return False

def test_ia_endpoint_with_auth():
    """Test de l'endpoint IA avec authentification"""
    print("\n🧪 Test de l'endpoint IA avec authentification...")
    
    # Générer un token JWT valide
    token = generate_test_jwt()
    if not token:
        print("❌ Impossible de générer un token JWT valide")
        return False
    
    print(f"🔑 Token JWT généré: {token[:20]}...")
    
    # Test avec le token
    payload = {
        "texte": "Je vends des T-shirts pour enfants à 5000 FCFA",
        "user_id": 1
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ia/auto",
            json=payload,
            headers=headers,
            timeout=30
        )
        
        print(f"📡 Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Requête IA réussie!")
            print(f"📄 Réponse: {json.dumps(result, indent=2, ensure_ascii=False)}")
            return True
        else:
            print(f"❌ Erreur {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur requête IA: {e}")
        return False

def test_without_auth():
    """Test sans authentification (pour voir l'erreur)"""
    print("\n🧪 Test sans authentification...")
    
    payload = {
        "texte": "Test simple",
        "user_id": 1
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ia/auto",
            json=payload,
            headers=headers,
            timeout=10
        )
        
        print(f"📡 Status: {response.status_code}")
        if response.status_code == 401:
            print("✅ Erreur 401 attendue (pas d'authentification)")
            return True
        else:
            print(f"⚠️ Status inattendu: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

if __name__ == "__main__":
    print("🚀 Test de l'architecture IA avec authentification")
    print("=" * 60)
    
    # Test 1: Connectivité
    connectivity_ok = test_backend_connectivity()
    
    # Test 2: Sans authentification
    no_auth_ok = test_without_auth()
    
    # Test 3: Avec authentification
    auth_ok = test_ia_endpoint_with_auth()
    
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ DES TESTS")
    print("=" * 60)
    print(f"✅ Connectivité: {'OK' if connectivity_ok else 'ÉCHEC'}")
    print(f"✅ Sans auth (401): {'OK' if no_auth_ok else 'ÉCHEC'}")
    print(f"✅ Avec auth: {'OK' if auth_ok else 'ÉCHEC'}")
    
    if connectivity_ok and no_auth_ok and auth_ok:
        print("\n🎉 Tous les tests sont passés!")
    else:
        print("\n⚠️ Certains tests ont échoué.") 