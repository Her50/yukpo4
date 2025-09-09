#!/usr/bin/env python3
"""
Test du backend avec token de développement
"""

import requests
import json
import base64

# Configuration
BACKEND_URL = "http://localhost:3001"

def create_dev_token():
    """Crée un token de développement pour le backend"""
    # Payload du token
    payload = {
        "sub": "1",  # user_id
        "role": "admin",
        "exp": 9999999999  # Expiration très lointaine
    }
    
    # Encoder en base64
    payload_str = json.dumps(payload)
    payload_b64 = base64.b64encode(payload_str.encode()).decode()
    
    # Créer le token de développement
    dev_token = f"header.{payload_b64}.dev_signature"
    
    return dev_token

def test_backend_with_dev_token():
    print("🧪 TEST DU BACKEND AVEC TOKEN DE DÉVELOPPEMENT")
    print("=" * 50)
    
    # Créer le token de développement
    dev_token = create_dev_token()
    print(f"🔑 Token de développement créé: {dev_token[:50]}...")
    
    # Headers avec autorisation
    auth_headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {dev_token}"
    }
    
    # Payload de test
    search_payload = {
        "message": "je cherche une librairie",
        "user_id": 1
    }
    
    print(f"\n🔍 Envoi de la requête: {search_payload}")
    print(f"📤 Headers: {auth_headers}")
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/yukpo",
            json=search_payload,
            headers=auth_headers
        )
        
        print(f"\n📥 Réponse reçue:")
        print(f"   - Status: {response.status_code}")
        print(f"   - Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Réponse JSON reçue du backend")
            
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
                    print(f"     - GPS: {service.get('gps', 'N/A')}")
                    
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
                    
                    if 'description' in data:
                        description = data['description']
                        if isinstance(description, dict) and 'valeur' in description:
                            print(f"       - Description extraite: {description['valeur']}")
                        else:
                            print(f"       - Description: {description}")
            else:
                print(f"❌ Aucun résultat trouvé")
        else:
            print(f"❌ Erreur backend: {response.status_code}")
            print(f"   Réponse: {response.text}")
            
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 50)
    print("🎯 RÉSULTAT ATTENDU:")
    print("   - Le backend doit retourner les vraies données des services")
    print("   - Pas de champs 'origine_champs' dans les données")
    print("   - Les données doivent correspondre aux services trouvés")
    print("   - Le service 559614 doit avoir des données réelles, pas de recherche")
    print("=" * 50)

if __name__ == "__main__":
    test_backend_with_dev_token() 