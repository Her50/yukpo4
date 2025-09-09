#!/usr/bin/env python3
"""
Test des corrections du backend - vérification que les données de service sont correctement retournées
"""

import requests
import json
import time

# Configuration
BACKEND_URL = "http://localhost:3000"  # Port par défaut du backend Rust
FRONTEND_URL = "http://localhost:5173"  # Port par défaut du frontend Vite

def test_backend_search():
    print("🧪 TEST DES CORRECTIONS DU BACKEND")
    print("=" * 50)
    
    # 1. Test de recherche via l'API backend
    print("\n1️⃣ TEST DE RECHERCHE VIA L'API BACKEND")
    print("-" * 40)
    
    search_payload = {
        "message": "je cherche une librairie",
        "user_id": 1
    }
    
    try:
        print(f"🔍 Envoi de la requête: {search_payload}")
        
        response = requests.post(
            f"{BACKEND_URL}/api/yukpo",
            json=search_payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Réponse reçue du backend (status: {response.status_code})")
            
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
            else:
                print(f"❌ Aucun résultat trouvé")
        else:
            print(f"❌ Erreur backend: {response.status_code}")
            print(f"   Réponse: {response.text}")
            
    except Exception as e:
        print(f"❌ Erreur lors du test: {e}")
    
    # 2. Test de recherche via le frontend (simulation)
    print(f"\n2️⃣ TEST DE RECHERCHE VIA LE FRONTEND (SIMULATION)")
    print("-" * 40)
    
    print("🔍 Pour tester le frontend:")
    print("   1. Assurez-vous que le frontend est démarré sur http://localhost:5173")
    print("   2. Allez sur la page de recherche")
    print("   3. Tapez 'je cherche une librairie'")
    print("   4. Vérifiez que les services affichés ont des données propres")
    print("   5. Vérifiez qu'il n'y a plus de champs 'origine_champs'")
    
    print("\n" + "=" * 50)
    print("🎯 RÉSULTAT ATTENDU:")
    print("   - Le backend doit retourner les vraies données des services")
    print("   - Pas de champs 'origine_champs' dans les données")
    print("   - Le frontend doit afficher correctement les services")
    print("=" * 50)

if __name__ == "__main__":
    test_backend_search() 