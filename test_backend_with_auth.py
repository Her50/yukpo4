#!/usr/bin/env python3
"""
Test du backend avec autorisation - vérification des corrections
"""

import requests
import json

# Configuration
BACKEND_URL = "http://localhost:3001"

def test_backend_with_auth():
    print("🧪 TEST DU BACKEND AVEC AUTORISATION")
    print("=" * 50)
    
    # 1. Test sans autorisation (doit échouer)
    print("\n1️⃣ TEST SANS AUTORISATION")
    print("-" * 40)
    
    search_payload = {
        "message": "je cherche une librairie",
        "user_id": 1
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/yukpo",
            json=search_payload,
            headers={"Content-Type": "application/json"}
        )
        
        print(f"Status: {response.status_code}")
        print(f"Réponse: {response.text}")
        
    except Exception as e:
        print(f"Erreur: {e}")
    
    # 2. Test avec autorisation (doit réussir)
    print("\n2️⃣ TEST AVEC AUTORISATION")
    print("-" * 40)
    
    # Générer un token JWT (simulation)
    auth_headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer test_token_123"
    }
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/yukpo",
            json=search_payload,
            headers=auth_headers
        )
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Réponse reçue du backend")
            
            # Analyser la réponse
            print(f"\n📋 ANALYSE DE LA RÉPONSE:")
            print(f"   - Message: {result.get('message', 'N/A')}")
            print(f"   - Intention: {result.get('intention', 'N/A')}")
            print(f"   - Nombre de résultats: {result.get('nombre_matchings', 0)}")
            
            # Analyser les résultats
            resultats = result.get('resultats', [])
            if resultats:
                print(f"\n🔍 ANALYSE DES RÉSULTATS:")
                for i, service in enumerate(resultats):
                    print(f"\n   Service {i+1}:")
                    print(f"     - ID: {service.get('service_id', 'N/A')}")
                    print(f"     - Score: {service.get('score', 'N/A')}")
                    
                    # Analyser les données
                    data = service.get('data', {})
                    print(f"     - Données brutes: {json.dumps(data, indent=6, ensure_ascii=False)}")
                    
                    # Vérifier si les données contiennent des champs origine_champs
                    has_origine_champs = False
                    for key, value in data.items():
                        if isinstance(value, dict) and 'origine_champs' in value:
                            has_origine_champs = True
                            print(f"       ⚠️ CHAMP 'origine_champs' DÉTECTÉ dans {key}: {value['origine_champs']}")
                    
                    if not has_origine_champs:
                        print(f"       ✅ AUCUN CHAMP 'origine_champs' DÉTECTÉ - Données propres")
                    
                    # Vérifier la structure des données
                    if 'titre' in data:
                        titre = data['titre']
                        if isinstance(titre, dict) and 'valeur' in titre:
                            print(f"       - Titre extrait: {titre['valeur']}")
                        else:
                            print(f"       - Titre: {titre}")
                    
                    if 'category' in data:
                        category = data['category']
                        if isinstance(category, dict) and 'valeur' in category:
                            print(f"       - Catégorie extraite: {category['valeur']}")
                        else:
                            print(f"       - Catégorie: {category}")
            else:
                print(f"❌ Aucun résultat trouvé")
        else:
            print(f"❌ Erreur backend: {response.status_code}")
            print(f"   Réponse: {response.text}")
            
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
    
    print("\n" + "=" * 50)
    print("🎯 RÉSULTAT ATTENDU:")
    print("   - Le backend doit retourner les vraies données des services")
    print("   - Pas de champs 'origine_champs' dans les données")
    print("   - Les données doivent correspondre aux services trouvés")
    print("=" * 50)

if __name__ == "__main__":
    test_backend_with_auth() 