#!/usr/bin/env python3
"""
Script de test pour la détection d'intention Yukpo
Teste différents cas d'usage pour vérifier que l'IA détecte correctement les intentions
"""

import requests
import json
import time
import jwt
from datetime import datetime, timedelta

# Configuration
BACKEND_URL = "http://127.0.0.1:3001"
SECRET_KEY = "dev_secret"  # Clé secrète du backend

def generate_jwt_token(user_id=1, email="test@example.com"):
    """Génère un token JWT valide pour les tests"""
    now = int(time.time())
    payload = {
        "sub": str(user_id),  # Forcer en string
        "role": "user",
        "email": email,
        "tokens_balance": 999999999999,
        "iat": now,
        "exp": now + 24 * 3600
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    # PyJWT >= 2.x retourne un byte string, il faut le décoder
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token

def test_intention_detection():
    """Teste la détection d'intention avec différents cas"""
    
    # Générer un token JWT
    token = generate_jwt_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # Cas de test avec intentions attendues
    test_cases = [
        {
            "input": "j'ai une boutique de vente de vêtements et chaussures pour enfants",
            "expected_intention": "creation_service",
            "description": "Création de service - boutique"
        },
        {
            "input": "je cherche un plombier pour réparer ma douche",
            "expected_intention": "recherche_besoin",
            "description": "Recherche de service"
        },
        {
            "input": "j'échange mon iPhone contre un Samsung",
            "expected_intention": "echange",
            "description": "Échange de biens"
        },
        {
            "input": "comment fonctionne la plateforme ?",
            "expected_intention": "assistance_generale",
            "description": "Question générale"
        },
        {
            "input": "je vends ma voiture",
            "expected_intention": "creation_service",
            "description": "Création de service - vente"
        },
        {
            "input": "je recherche un appartement à louer",
            "expected_intention": "recherche_besoin",
            "description": "Recherche de logement"
        }
    ]
    
    print("🧪 Test de détection d'intention Yukpo")
    print("=" * 50)
    
    success_count = 0
    total_count = len(test_cases)
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n📝 Test {i}/{total_count}: {test_case['description']}")
        print(f"   Input: '{test_case['input']}'")
        print(f"   Attendu: {test_case['expected_intention']}")
        
        # Préparer la requête
        payload = {
            "texte": test_case["input"],
            "base64_image": [],
            "doc_base64": [],
            "excel_base64": []
        }
        
        try:
            # Appeler l'API
            response = requests.post(
                f"{BACKEND_URL}/api/ia/auto",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Succès (HTTP {response.status_code})")
                
                # Extraire l'intention du résultat
                detected_intention = None
                if "intention" in result:
                    detected_intention = result["intention"]
                elif "data" in result and "intention" in result["data"]:
                    detected_intention = result["data"]["intention"]
                
                if detected_intention:
                    print(f"   Détecté: {detected_intention}")
                    
                    if detected_intention == test_case["expected_intention"]:
                        print(f"   🎯 CORRECT - Intention détectée correctement")
                        success_count += 1
                    else:
                        print(f"   ❌ INCORRECT - Attendu {test_case['expected_intention']}, obtenu {detected_intention}")
                else:
                    print(f"   ⚠️  Intention non trouvée dans la réponse")
                    print(f"   Réponse complète: {json.dumps(result, indent=2)}")
            else:
                print(f"   ❌ Erreur HTTP {response.status_code}")
                print(f"   Réponse: {response.text}")
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Erreur de connexion: {e}")
        except json.JSONDecodeError as e:
            print(f"   ❌ Erreur parsing JSON: {e}")
            print(f"   Réponse brute: {response.text}")
        except Exception as e:
            print(f"   ❌ Erreur inattendue: {e}")
    
    # Résumé
    print("\n" + "=" * 50)
    print(f"📊 RÉSULTATS: {success_count}/{total_count} tests réussis")
    
    if success_count == total_count:
        print("🎉 TOUS LES TESTS SONT PASSÉS !")
        return True
    else:
        print("⚠️  Certains tests ont échoué")
        return False

def test_specific_case():
    """Test spécifique pour le cas problématique"""
    
    token = generate_jwt_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "texte": "j'ai une boutique de vente de vêtements et chaussures pour enfants",
        "base64_image": [],
        "doc_base64": [],
        "excel_base64": []
    }
    
    print("\n🔍 Test spécifique - Boutique de vêtements")
    print("=" * 50)
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/ia/auto",
            headers=headers,
            json=payload,
            timeout=30
        )
        
        print(f"Status: {response.status_code}")
        print(f"Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"Réponse complète: {json.dumps(result, indent=2)}")
        else:
            print(f"Erreur: {response.text}")
            
    except Exception as e:
        print(f"Erreur: {e}")

if __name__ == "__main__":
    print("🚀 Démarrage des tests de détection d'intention")
    
    # Test spécifique d'abord
    test_specific_case()
    
    # Puis tests complets
    print("\n" + "=" * 50)
    test_intention_detection() 