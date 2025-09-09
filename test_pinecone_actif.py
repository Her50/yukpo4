#!/usr/bin/env python3
"""
Test de la recherche Pinecone active avec le code restauré du 17 juillet
"""

import requests
import json
import time

# Configuration
BACKEND_URL = "http://localhost:3001"

def test_pinecone_actif():
    print("🚀 ACTIVATION ET TEST DE LA RECHERCHE PINECONE")
    print("=" * 60)
    
    # Test de recherche via l'API backend avec autorisation
    print("\n1️⃣ TEST DE RECHERCHE PINECONE AVEC AUTORISATION")
    print("-" * 50)
    
    # Utiliser un token de développement (comme dans le code du 17 juillet)
    auth_headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer test_token_123.dev_signature"
    }
    
    search_payload = {
        "message": "je cherche une librairie",
        "user_id": 1
    }
    
    try:
        print(f"🔍 Envoi de la requête: {search_payload}")
        print(f"🔑 Avec autorisation: {auth_headers['Authorization']}")
        
        response = requests.post(
            f"{BACKEND_URL}/api/ia/auto",
            json=search_payload,
            headers=auth_headers,
            timeout=30
        )
        
        print(f"📥 Réponse reçue:")
        print(f"   - Status: {response.status_code}")
        print(f"   - Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ RECHERCHE PINECONE RÉUSSIE !")
            
            # Analyser la réponse
            print(f"\n📋 ANALYSE DE LA RÉPONSE:")
            print(f"   - Message: {result.get('message', 'N/A')}")
            print(f"   - Intention: {result.get('intention', 'N/A')}")
            print(f"   - Nombre de résultats: {result.get('nombre_matchings', 0)}")
            
            # Analyser les résultats
            resultats = result.get('resultats', [])
            if resultats:
                print(f"\n🔍 RÉSULTATS PINECONE TROUVÉS:")
                for i, service in enumerate(resultats):
                    print(f"\n   Service {i+1}:")
                    print(f"     - ID: {service.get('service_id', 'N/A')}")
                    print(f"     - Score: {service.get('score', 'N/A')}")
                    print(f"     - Score sémantique: {service.get('semantic_score', 'N/A')}")
                    print(f"     - GPS: {service.get('gps', 'N/A')}")
                    
                    # Analyser les données
                    data = service.get('data', {})
                    print(f"     - Données brutes: {json.dumps(data, indent=6, ensure_ascii=False)}")
                    
                    # Vérifier si les données contiennent des champs origine_champs
                    has_origine_champs = False
                    if isinstance(data, dict):
                        for key, value in data.items():
                            if isinstance(value, dict) and 'origine_champs' in value:
                                has_origine_champs = True
                                print(f"       ⚠️ CHAMP 'origine_champs' DÉTECTÉ dans {key}: {value['origine_champs']}")
                    
                    if not has_origine_champs:
                        print(f"       ✅ AUCUN CHAMP 'origine_champs' DÉTECTÉ - Données propres")
                    
                    # Vérifier la structure des données
                    if isinstance(data, dict):
                        if 'titre_service' in data:
                            titre = data['titre_service']
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
                        
                        if 'description_service' in data:
                            description = data['description_service']
                            if isinstance(description, dict) and 'valeur' in description:
                                print(f"       - Description extraite: {description['valeur']}")
                            else:
                                print(f"       - Description: {description}")
            else:
                print(f"❌ Aucun résultat trouvé dans Pinecone")
        else:
            print(f"❌ Erreur backend: {response.status_code}")
            print(f"   Réponse: {response.text}")
            
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
        import traceback
        traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("🎯 RÉSULTAT ATTENDU:")
    print("   - La recherche Pinecone doit être active")
    print("   - Le backend doit retourner les vraies données des services")
    print("   - Pas de champs 'origine_champs' dans les données")
    print("   - Les données doivent correspondre aux services trouvés")
    print("   - La fonction de recherche du 17 juillet doit fonctionner")
    print("=" * 60)

if __name__ == "__main__":
    test_pinecone_actif() 