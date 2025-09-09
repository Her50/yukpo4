#!/usr/bin/env python3
"""
Script de test pour la détection d'intention Yukpo
Teste les corrections apportées aux prompts et à la détection d'intention
"""

import requests
import json
import time

# Configuration
BACKEND_URL = "http://localhost:3001"
JWT_SECRET = "dev_secret"

def generate_jwt_token():
    """Génère un token JWT valide pour les tests"""
    import jwt
    from datetime import datetime, timedelta
    
    payload = {
        "user_id": 1,
        "email": "test@yukpo.com",
        "role": "user",
        "exp": datetime.utcnow() + timedelta(hours=1),
        "iat": datetime.utcnow()
    }
    
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def test_intention_detection():
    """Teste la détection d'intention avec différents types de demandes"""
    
    # Token d'authentification
    token = generate_jwt_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Tests de détection d'intention
    test_cases = [
        {
            "name": "Question générale",
            "input": "Comment fonctionne la plateforme Yukpo ?",
            "expected_intention": "assistance_generale"
        },
        {
            "name": "Création de service",
            "input": "Je vends des vêtements d'occasion",
            "expected_intention": "creation_service"
        },
        {
            "name": "Recherche de besoin",
            "input": "Je cherche un professeur de mathématiques",
            "expected_intention": "recherche_besoin"
        },
        {
            "name": "Échange",
            "input": "J'échange mon vélo contre un ordinateur portable",
            "expected_intention": "echange"
        },
        {
            "name": "Question sur le fonctionnement",
            "input": "Quels sont les frais de commission ?",
            "expected_intention": "assistance_generale"
        }
    ]
    
    print("🧪 Test de détection d'intention Yukpo")
    print("=" * 50)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n{i}. {test_case['name']}")
        print(f"   Input: {test_case['input']}")
        print(f"   Attendu: {test_case['expected_intention']}")
        
        try:
            # Préparer la requête
            payload = {
                "texte": test_case['input'],
                "intention": None,  # L'IA doit détecter l'intention
                "context": {
                    "user_id": 1,
                    "langue_preferee": "fr"
                }
            }
            
            # Appeler l'API
            response = requests.post(
                f"{BACKEND_URL}/api/ia/orchestration",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                detected_intention = result.get("intention", "non_détectée")
                
                print(f"   Résultat: {detected_intention}")
                
                if detected_intention == test_case['expected_intention']:
                    print("   ✅ SUCCÈS")
                else:
                    print(f"   ❌ ÉCHEC - Attendu: {test_case['expected_intention']}")
                    
                # Afficher la structure JSON si disponible
                if "data" in result:
                    print(f"   Structure: {json.dumps(result['data'], indent=2, ensure_ascii=False)[:200]}...")
                    
            else:
                print(f"   ❌ Erreur HTTP: {response.status_code}")
                print(f"   Réponse: {response.text[:200]}...")
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Erreur de connexion: {e}")
        except Exception as e:
            print(f"   ❌ Erreur: {e}")
        
        time.sleep(1)  # Pause entre les tests
    
    print("\n" + "=" * 50)
    print("🏁 Tests terminés")

if __name__ == "__main__":
    test_intention_detection() 