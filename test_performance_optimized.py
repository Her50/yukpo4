#!/usr/bin/env python3
"""
Script de test pour vérifier les performances avec les nouveaux logs de temps d'exécution
"""

import requests
import json
import time
import jwt
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "http://localhost:3001"
SECRET_KEY = "dev_secret"

def generate_jwt_token(user_id=1):
    """Génère un token JWT valide"""
    payload = {
        "sub": str(user_id),
        "exp": int((datetime.utcnow() + timedelta(hours=1)).timestamp()),
        "iat": int(datetime.utcnow().timestamp()),
        "user_id": user_id,
        "email": "test@example.com",
        "role": "user"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def test_creation_service():
    """Test de création de service avec mesure des performances"""
    print("🧪 Test de création de service avec logs de performance")
    print("=" * 60)
    
    # Générer le token JWT
    token = generate_jwt_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Données de test
    test_data = {
        "texte": "j'ai une boutique de vente de vêtements et chaussures pour enfants",
        "intention": "creation_service"
    }
    
    print(f"📤 Envoi de la requête à {BACKEND_URL}/api/ia/auto")
    print(f"📝 Données: {json.dumps(test_data, indent=2)}")
    
    # Mesurer le temps total
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ia/auto",
            headers=headers,
            json=test_data,
            timeout=60  # Timeout augmenté à 60s
        )
        
        total_time = time.time() - start_time
        
        print(f"⏱️  Temps total de la requête: {total_time:.3f}s")
        print(f"📊 Status code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Succès!")
            print(f"📄 Réponse: {json.dumps(result, indent=2, ensure_ascii=False)}")
            
            # Extraire les métadonnées de performance si disponibles
            if "tokens_consumed" in result:
                print(f"🎯 Tokens consommés: {result['tokens_consumed']}")
            if "ia_model_used" in result:
                print(f"🤖 Modèle IA utilisé: {result['ia_model_used']}")
            if "confidence" in result:
                print(f"🎯 Confiance: {result['confidence']}")
                
        else:
            print(f"❌ Erreur: {response.status_code}")
            print(f"📄 Réponse: {response.text}")
            
    except requests.exceptions.Timeout:
        print("⏰ Timeout de la requête (60s)")
    except requests.exceptions.ConnectionError:
        print("🔌 Erreur de connexion au backend")
    except Exception as e:
        print(f"💥 Erreur inattendue: {e}")

def test_assistance_generale():
    """Test d'assistance générale avec mesure des performances"""
    print("\n🧪 Test d'assistance générale avec logs de performance")
    print("=" * 60)
    
    # Générer le token JWT
    token = generate_jwt_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Données de test
    test_data = {
        "texte": "Comment fonctionne Yukpo ?",
        "intention": "assistance_generale"
    }
    
    print(f"📤 Envoi de la requête à {BACKEND_URL}/api/ia/auto")
    print(f"📝 Données: {json.dumps(test_data, indent=2)}")
    
    # Mesurer le temps total
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ia/auto",
            headers=headers,
            json=test_data,
            timeout=60  # Timeout augmenté à 60s
        )
        
        total_time = time.time() - start_time
        
        print(f"⏱️  Temps total de la requête: {total_time:.3f}s")
        print(f"📊 Status code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Succès!")
            print(f"📄 Réponse: {json.dumps(result, indent=2, ensure_ascii=False)}")
            
            # Extraire les métadonnées de performance si disponibles
            if "tokens_consumed" in result:
                print(f"🎯 Tokens consommés: {result['tokens_consumed']}")
            if "ia_model_used" in result:
                print(f"🤖 Modèle IA utilisé: {result['ia_model_used']}")
            if "confidence" in result:
                print(f"🎯 Confiance: {result['confidence']}")
                
        else:
            print(f"❌ Erreur: {response.status_code}")
            print(f"📄 Réponse: {response.text}")
            
    except requests.exceptions.Timeout:
        print("⏰ Timeout de la requête (60s)")
    except requests.exceptions.ConnectionError:
        print("🔌 Erreur de connexion au backend")
    except Exception as e:
        print(f"💥 Erreur inattendue: {e}")

def main():
    """Fonction principale"""
    print("🚀 Test des performances avec logs de temps d'exécution")
    print("=" * 60)
    print(f"🎯 Backend URL: {BACKEND_URL}")
    print(f"⏰ Timeout configuré: 30s (IA) + 60s (requête)")
    print()
    
    # Test 1: Création de service
    test_creation_service()
    
    # Test 2: Assistance générale
    test_assistance_generale()
    
    print("\n" + "=" * 60)
    print("✅ Tests terminés!")
    print("📋 Vérifiez les logs du backend pour voir les temps d'exécution détaillés:")
    print("   - Temps de détection d'intention")
    print("   - Temps de génération JSON")
    print("   - Temps total de traitement IA")

if __name__ == "__main__":
    main() 